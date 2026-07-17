'use strict';

// ---------------------------------------------------------------------------
// Manifest IO — the single implementation of manifest reads, atomic writes,
// and the lock discipline.
//
// Consumed by BOTH writers (the manifest CLI and the engine), sibling to
// manifest-schema.cjs: one on-disk contract, one serialisation, one lock
// protocol — the two writers can never drift. Pure mechanism: this module
// knows file locations, JSON parsing, temp-file renames, and lock files; it
// knows nothing about what a manifest contains.
//
// Every function takes `workflowsDir` — the absolute path of the project's
// `.workflows/` directory — so callers with different cwd conventions (the
// CLI resolves against process.cwd(), the engine passes the project root)
// share one implementation.
//
// Errors throw `Error` with a stable message; CLI callers translate to their
// exit-code convention, engine callers let them ride to the JSON error line.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

// Lock discipline: a lock file created with O_EXCL is the mutex; a holder
// that dies leaves a file whose mtime ages past LOCK_STALE_MS and is broken
// by the next contender; a live holder is waited on in LOCK_RETRY_MS spins
// up to LOCK_TIMEOUT_MS.
const LOCK_STALE_MS = 30000;
const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 10000;

/** @param {string} workflowsDir @param {string} workUnit */
function workUnitManifestPath(workflowsDir, workUnit) {
  return path.join(workflowsDir, workUnit, 'manifest.json');
}

/** @param {string} workflowsDir @param {string} workUnit */
function workUnitLockPath(workflowsDir, workUnit) {
  return path.join(workflowsDir, workUnit, '.lock');
}

/** @param {string} workflowsDir */
function projectManifestPath(workflowsDir) {
  return path.join(workflowsDir, 'manifest.json');
}

/** @param {string} workflowsDir */
function projectLockPath(workflowsDir) {
  return path.join(workflowsDir, '.project-lock');
}

/**
 * Atomic JSON write: serialise, write a hidden pid-suffixed temp file in the
 * same directory, rename over the target — a crash mid-write can never leave
 * a truncated manifest behind. One serialisation for every writer:
 * `JSON.stringify(data, null, 2) + '\n'`.
 * @param {string} file @param {object} data
 */
function writeJsonAtomic(file, data) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Load and parse one work unit's manifest. Loud on a missing file and loud
 * on corrupt JSON — a manifest that cannot be read must never be silently
 * replaced by an empty document.
 * @param {string} workflowsDir
 * @param {string} workUnit
 * @returns {any}
 */
function readWorkUnitManifest(workflowsDir, workUnit) {
  const file = workUnitManifestPath(workflowsDir, workUnit);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`manifest not found: ${file}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON in ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Save one work unit's manifest atomically.
 * @param {string} workflowsDir @param {string} workUnit @param {object} manifest
 */
function writeWorkUnitManifestAtomic(workflowsDir, workUnit, manifest) {
  writeJsonAtomic(workUnitManifestPath(workflowsDir, workUnit), manifest);
}

/**
 * Read and parse the project manifest. A missing file is a legitimate
 * first-write state ({}); any other read error, and corrupt JSON in an
 * existing file, surface loudly — a write against a silently-empty document
 * would replace every registered work unit.
 * @param {string} workflowsDir
 * @returns {Record<string, any>}
 */
function readProjectManifest(workflowsDir) {
  const file = projectManifestPath(workflowsDir);
  let raw = null;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? err.code : null;
    if (code !== 'ENOENT') {
      throw new Error(`failed to read project manifest at ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (raw === null) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `project manifest at ${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)} — ` +
      'inspect and fix it by hand; a write against a corrupt manifest would replace all registered work units'
    );
  }
}

/**
 * Save the project manifest atomically, creating `.workflows/` when absent.
 * @param {string} workflowsDir @param {object} data
 */
function writeProjectManifestAtomic(workflowsDir, data) {
  fs.mkdirSync(workflowsDir, { recursive: true });
  writeJsonAtomic(projectManifestPath(workflowsDir), data);
}

/**
 * Acquire `lockFile` (O_EXCL create, pid recorded), breaking a stale holder
 * and spinning on a live one up to the timeout.
 * @param {string} lockFile @param {string} timeoutMessage
 */
function acquireLockFile(lockFile, timeoutMessage) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e) || e.code !== 'EEXIST') throw e;
    }

    // Check stale lock
    try {
      const stat = fs.statSync(lockFile);
      if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        fs.unlinkSync(lockFile);
        continue;
      }
    } catch {
      // Lock was removed between check and stat — retry
      continue;
    }

    if (Date.now() >= deadline) {
      throw new Error(timeoutMessage);
    }

    // Busy wait (short)
    const end = Date.now() + LOCK_RETRY_MS;
    while (Date.now() < end) { /* spin */ }
  }
}

/** @param {string} lockFile */
function releaseLockFile(lockFile) {
  try { fs.unlinkSync(lockFile); } catch { /* already gone */ }
}

/**
 * Run `fn` holding the work unit's manifest lock. A missing work-unit
 * directory refuses upfront with the same not-found error the read throws —
 * there is no manifest to protect, and creating a lock file would conjure
 * the directory.
 * @template T
 * @param {string} workflowsDir @param {string} workUnit @param {() => T} fn
 * @returns {T}
 */
function withWorkUnitLock(workflowsDir, workUnit, fn) {
  if (!fs.existsSync(path.join(workflowsDir, workUnit))) {
    throw new Error(`manifest not found: ${workUnitManifestPath(workflowsDir, workUnit)}`);
  }
  const lockFile = workUnitLockPath(workflowsDir, workUnit);
  acquireLockFile(lockFile, `Timed out waiting for lock on "${workUnit}"`);
  try {
    return fn();
  } finally {
    releaseLockFile(lockFile);
  }
}

/**
 * Run `fn` holding the project manifest lock (`.workflows/` created when
 * absent — the lock file lives inside it).
 * @template T
 * @param {string} workflowsDir @param {() => T} fn
 * @returns {T}
 */
function withProjectLock(workflowsDir, fn) {
  fs.mkdirSync(workflowsDir, { recursive: true });
  const lockFile = projectLockPath(workflowsDir);
  acquireLockFile(lockFile, 'Timed out waiting for project manifest lock');
  try {
    return fn();
  } finally {
    releaseLockFile(lockFile);
  }
}

module.exports = {
  LOCK_STALE_MS,
  LOCK_RETRY_MS,
  LOCK_TIMEOUT_MS,
  workUnitManifestPath,
  workUnitLockPath,
  projectManifestPath,
  projectLockPath,
  readWorkUnitManifest,
  writeWorkUnitManifestAtomic,
  readProjectManifest,
  writeProjectManifestAtomic,
  withWorkUnitLock,
  withProjectLock,
};
