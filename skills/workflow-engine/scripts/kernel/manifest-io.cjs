'use strict';

// ---------------------------------------------------------------------------
// Manifest IO — the single implementation of manifest reads, atomic writes,
// and the lock discipline.
//
// Consumed by every manifest writer in the engine (the field commands and
// the transactions), sibling to manifest-schema.cjs: one on-disk contract,
// one serialisation, one lock protocol — writers can never drift. Pure
// mechanism: this module knows file locations, JSON parsing, temp-file
// renames, and lock files; it knows nothing about what a manifest contains.
//
// Every function takes `workflowsDir` — the absolute path of the project's
// `.workflows/` directory — so callers with different cwd conventions share
// one implementation.
//
// Errors throw `Error` with a stable message; read-surface callers translate
// to their exit-code convention, transaction callers let them ride to the
// JSON error line.
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

// A temp file older than this is an orphan from a crashed writer — a live
// writer's temp file exists only for the instant between write and rename.
const TMP_STALE_MS = 60000;

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
 * The root every manifest writer requires: a plain object. JSON.stringify
 * silently drops named properties assigned to an array, and a null/scalar
 * root cannot hold fields at all — a write against such a root would falsely
 * succeed, so it must refuse before any mutation runs.
 * @param {any} root @param {string} file
 */
function assertObjectRoot(root, file) {
  if (root === null || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error(`manifest root is not an object in ${file} — fix it by hand; fields written to it would be silently discarded`);
  }
}

/**
 * Pre-write guard, run under the lock before the writer's `fn`: a manifest
 * already on disk must have an object root before anything may mutate it.
 * Missing and unparseable files pass through — the writer's own read owns
 * those semantics (create writes fresh; corrupt JSON throws its established
 * loud error).
 * @param {string} file
 */
function assertWritableManifest(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  let root;
  try {
    root = JSON.parse(raw);
  } catch {
    return;
  }
  assertObjectRoot(root, file);
}

/**
 * Descend into `parent[key]` as a structural container, creating a plain
 * object when the slot is empty. A slot holding anything else (string,
 * number, array, …) is refused loudly — replacing it would destroy data, and
 * fields assigned into an array are silently dropped by JSON.stringify.
 * @param {Record<string, any>} parent @param {string} key
 * @param {string} label the container's dot-path, for the diagnostic
 * @returns {Record<string, any>}
 */
function ensureContainer(parent, key, label) {
  const existing = parent[key];
  if (existing == null) {
    parent[key] = {};
  } else if (typeof existing !== 'object' || Array.isArray(existing)) {
    throw new Error(`manifest field "${label}" is not an object (found ${Array.isArray(existing) ? 'array' : typeof existing}) — fix the manifest by hand`);
  }
  return parent[key];
}

/**
 * Remove orphaned temp files a crashed writer left beside `file` — the next
 * scoped `git add` would commit them. Only files past TMP_STALE_MS go; a
 * younger one belongs to a live concurrent writer. Best-effort: a file
 * vanishing mid-sweep means another process finished the same job.
 * @param {string} file
 */
function sweepOrphanedTmpFiles(file) {
  const dir = path.dirname(file);
  const prefix = `.${path.basename(file)}.`;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.tmp')) continue;
    const orphan = path.join(dir, name);
    try {
      if (Date.now() - fs.statSync(orphan).mtimeMs > TMP_STALE_MS) fs.unlinkSync(orphan);
    } catch { /* vanished mid-sweep */ }
  }
}

/**
 * Atomic JSON write: serialise, write a hidden pid-suffixed temp file in the
 * same directory, rename over the target — a crash mid-write can never leave
 * a truncated manifest behind. One serialisation for every writer:
 * `JSON.stringify(data, null, 2) + '\n'`.
 * @param {string} file @param {object} data
 */
function writeJsonAtomic(file, data) {
  assertObjectRoot(data, file);
  sweepOrphanedTmpFiles(file);
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
 * Break a stale lock, at most one contender at a time. The `.breaking` guard
 * (O_EXCL, pid recorded) admits a single breaker, which re-checks the lock's
 * mtime INSIDE the guarded section before unlinking. A naive stat-then-unlink
 * lets a contender act on a pre-break observation: after the true break and a
 * re-acquire it would remove the new holder's fresh lock — two writers at
 * once. Inside the guard a stale mtime is decisive: the holder is dead
 * (nothing can release-race the unlink) and creations need the absence the
 * unlink is about to produce. Losers return false and fall back to the
 * acquire loop's wait/retry cadence. A dead breaker's guard heals by the
 * same staleness rule.
 * @param {string} lockFile
 * @returns {boolean} true when this process performed the break
 */
function breakStaleLockFile(lockFile) {
  const guard = `${lockFile}.breaking`;
  let fd;
  try {
    fd = fs.openSync(guard, 'wx');
  } catch {
    try {
      if (Date.now() - fs.statSync(guard).mtimeMs > LOCK_STALE_MS) fs.unlinkSync(guard);
    } catch { /* guard already gone */ }
    return false;
  }
  try {
    fs.writeSync(fd, String(process.pid));
    if (Date.now() - fs.statSync(lockFile).mtimeMs > LOCK_STALE_MS) {
      fs.unlinkSync(lockFile);
      return true;
    }
    return false;
  } catch {
    return false; // lock vanished — already broken, not yet re-acquired
  } finally {
    fs.closeSync(fd);
    try { fs.unlinkSync(guard); } catch { /* healed from under us */ }
  }
}

/**
 * Acquire `lockFile` (O_EXCL create, pid recorded), breaking a stale holder
 * and spinning on a live one up to the timeout.
 * @param {string} lockFile @param {string} timeoutMessage
 * @param {number} [timeoutMs]
 */
function acquireLockFile(lockFile, timeoutMessage, timeoutMs = LOCK_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;

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
        breakStaleLockFile(lockFile);
        continue;
      }
    } catch {
      // Lock was removed between check and stat — retry
      continue;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `${timeoutMessage} (lock file: ${lockFile}). A stale lock from a crashed process clears automatically after ` +
        `${LOCK_STALE_MS / 1000} seconds — retry; if it persists, delete the lock file.`
      );
    }

    // Sleep before retrying — a real synchronous wait, not a CPU spin.
    sleepSync(LOCK_RETRY_MS);
  }
}

/** @param {string} lockFile */
function releaseLockFile(lockFile) {
  try { fs.unlinkSync(lockFile); } catch { /* already gone */ }
}

// Block the thread for `ms` without burning CPU. Atomics.wait on a throwaway
// zero-initialised SharedArrayBuffer int32 never gets notified, so it always
// sleeps the full timeout — a real synchronous sleep, not a spin loop.
/** @param {number} ms */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
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
    assertWritableManifest(workUnitManifestPath(workflowsDir, workUnit));
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
    assertWritableManifest(projectManifestPath(workflowsDir));
    return fn();
  } finally {
    releaseLockFile(lockFile);
  }
}

module.exports = {
  LOCK_STALE_MS,
  LOCK_RETRY_MS,
  LOCK_TIMEOUT_MS,
  TMP_STALE_MS,
  workUnitManifestPath,
  workUnitLockPath,
  projectManifestPath,
  projectLockPath,
  breakStaleLockFile,
  acquireLockFile,
  ensureContainer,
  readWorkUnitManifest,
  writeWorkUnitManifestAtomic,
  readProjectManifest,
  writeProjectManifestAtomic,
  withWorkUnitLock,
  withProjectLock,
};
