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
// Every function takes `stateDir` — the absolute path of the state root — so
// callers with different cwd conventions share one implementation.
//
// One lock guards every write to the state: the writer lock, `.lock` at the
// state root, held for a whole verb — its writes and its commit — so
// concurrent sessions write the state one after the other. A manifest write
// takes it too, so a write made outside a verb's hold is serialised the
// same way; inside one it is held already, and taken again for nothing.
// A lock file elsewhere is held the same way (`withStateLockFile`): the one
// boot's checks hold while the state worktree, and so the writer lock, may
// not be there yet.
//
// Errors throw `Error` with a stable message; read-surface callers translate
// to their exit-code convention, transaction callers let them ride to the
// JSON error line.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { ownerAlive, processStartTime, sleepSync } = require('./process.cjs');

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

// The writer lock is held across a verb's writes, its commit and its push.
// It records its holder's process, so a holder that is gone is taken over at
// once and a live one is never broken: a contender waits a minute for it —
// longer than any push the holder makes under the lock may take.
const WRITER_LOCK = '.lock';
const WRITER_LOCK_TIMEOUT_MS = 60000;

/** @param {string} stateDir @param {string} workUnit */
function workUnitManifestPath(stateDir, workUnit) {
  return path.join(stateDir, workUnit, 'manifest.json');
}

/** @param {string} stateDir */
function projectManifestPath(stateDir) {
  return path.join(stateDir, 'manifest.json');
}

/** @param {string} stateDir */
function writerLockPath(stateDir) {
  return path.join(stateDir, WRITER_LOCK);
}

/**
 * The root every manifest writer requires: a plain object. JSON.stringify
 * silently drops named properties assigned to an array, and a null/scalar
 * root cannot hold fields at all — a write against such a root would falsely
 * succeed, so it must refuse before any mutation runs.
 * @param {any} root @param {string} file
 */
function assertObjectRoot(root, file) {
  if (!isObject(root)) {
    throw new Error(`manifest root is not an object in ${file} — fix it by hand; fields written to it would be silently discarded`);
  }
}

/**
 * Whether a parsed JSON value is an object — not an array, not null.
 * @param {unknown} v @returns {v is Record<string, any>}
 */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
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

/** The one serialisation every JSON writer uses. @param {object} data @returns {string} */
function jsonText(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * Atomic JSON write: serialise (`jsonText`), write a hidden pid-suffixed temp
 * file in the same directory, rename over the target — a crash mid-write can
 * never leave a truncated manifest behind. A `mode` is the file's exactly,
 * set before the rename, so the content is never readable under another.
 * @param {string} file @param {object} data @param {{mode?: number}} [options]
 */
function writeJsonAtomic(file, data, { mode } = {}) {
  assertObjectRoot(data, file);
  sweepOrphanedTmpFiles(file);
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, jsonText(data), { encoding: 'utf8', mode });
  if (mode !== undefined) fs.chmodSync(tmp, mode);
  fs.renameSync(tmp, file);
}

/**
 * Load and parse one work unit's manifest. Loud on a missing file and loud
 * on corrupt JSON — a manifest that cannot be read must never be silently
 * replaced by an empty document.
 * @param {string} stateDir
 * @param {string} workUnit
 * @returns {any}
 */
function readWorkUnitManifest(stateDir, workUnit) {
  const file = workUnitManifestPath(stateDir, workUnit);
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
 * @param {string} stateDir @param {string} workUnit @param {object} manifest
 */
function writeWorkUnitManifestAtomic(stateDir, workUnit, manifest) {
  writeJsonAtomic(workUnitManifestPath(stateDir, workUnit), manifest);
}

/**
 * Read and parse the project manifest. A missing file is a legitimate
 * first-write state ({}); any other read error, and corrupt JSON in an
 * existing file, surface loudly — a write against a silently-empty document
 * would replace every registered work unit.
 * @param {string} stateDir
 * @returns {Record<string, any>}
 */
function readProjectManifest(stateDir) {
  const file = projectManifestPath(stateDir);
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
 * Every work unit's manifest: the registered names, or — while none are
 * registered — the directories in the state. A name whose manifest is
 * missing or unreadable is passed over; no state, no manifests. Loud on a
 * corrupt project manifest, as its read is.
 * @param {string} stateDir
 * @param {Record<string, any>} [project]  the project manifest, where the caller has read it already
 * @returns {Array<Record<string, any>>}
 */
function listWorkUnitManifests(stateDir, project) {
  if (!fs.existsSync(stateDir)) return [];
  const registered = Object.keys((project || readProjectManifest(stateDir)).work_units || {});
  const names = registered.length > 0
    ? registered
    : fs.readdirSync(stateDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  /** @type {Array<Record<string, any>>} */
  const manifests = [];
  for (const name of names) {
    try {
      manifests.push(readWorkUnitManifest(stateDir, name));
    } catch {
      // missing or unreadable — passed over
    }
  }
  return manifests;
}

/**
 * Save the project manifest atomically.
 * @param {string} stateDir @param {object} data
 */
function writeProjectManifestAtomic(stateDir, data) {
  writeJsonAtomic(projectManifestPath(stateDir), data);
}

/**
 * Break a lock, at most one contender at a time, where `breakable` says so.
 * The `.breaking` guard (O_EXCL, pid recorded) admits a single breaker,
 * which asks `breakable` again INSIDE the guarded section before unlinking.
 * A naive check-then-unlink lets a contender act on an observation made
 * before the true break: after the break and a re-acquire it would remove
 * the new holder's lock — two holders at once. Losers return false and
 * fall back to their own cadence. A dead breaker's guard heals once it is
 * older than `staleMs`.
 * @param {string} lockFile @param {() => boolean} breakable @param {number} staleMs
 * @returns {boolean} true when this process performed the break
 */
function breakGuarded(lockFile, breakable, staleMs) {
  const guard = `${lockFile}.breaking`;
  let fd;
  try {
    fd = fs.openSync(guard, 'wx');
  } catch {
    try {
      if (Date.now() - fs.statSync(guard).mtimeMs > staleMs) fs.unlinkSync(guard);
    } catch { /* guard already gone */ }
    return false;
  }
  try {
    fs.writeSync(fd, String(process.pid));
    if (breakable()) {
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
 * Break a stale lock (see breakGuarded): inside the guard a stale mtime is
 * decisive — the holder is dead, and creations need the absence the unlink
 * is about to produce.
 * @param {string} lockFile
 * @returns {boolean} true when this process performed the break
 */
function breakStaleLockFile(lockFile, staleMs = LOCK_STALE_MS) {
  return breakGuarded(lockFile, () => Date.now() - fs.statSync(lockFile).mtimeMs > staleMs, staleMs);
}

/**
 * Acquire `lockFile` (O_EXCL create, pid recorded), breaking a stale holder
 * and spinning on a live one up to the timeout. `staleMs` lets a caller with
 * a longer-running critical section (the commit lock, whose holder may run
 * git hooks) keep live holders safe from the break.
 * @param {string} lockFile @param {string} timeoutMessage
 * @param {number} [timeoutMs] @param {number} [staleMs]
 */
function acquireLockFile(lockFile, timeoutMessage, timeoutMs = LOCK_TIMEOUT_MS, staleMs = LOCK_STALE_MS) {
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
      if (Date.now() - stat.mtimeMs > staleMs) {
        breakStaleLockFile(lockFile, staleMs);
        continue;
      }
    } catch {
      // Lock was removed between check and stat — retry
      continue;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `${timeoutMessage} (lock file: ${lockFile}). A stale lock from a crashed process clears automatically after ` +
        `${staleMs / 1000} seconds — retry; if it persists, delete the lock file.`
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

/**
 * The owner a claim's record names — null where it names none.
 * @param {string} record @returns {{pid?: number, pid_start?: string|null}|null}
 */
function ownerIn(record) {
  try {
    const owner = JSON.parse(record);
    return owner && typeof owner === 'object' ? owner : null;
  } catch {
    return null;
  }
}

/**
 * The owner a claim file records — null where it cannot be read.
 * @param {string} claimFile @returns {{pid?: number, pid_start?: string|null}|null}
 */
function claimOwner(claimFile) {
  try {
    return ownerIn(fs.readFileSync(claimFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Where a claim stands: `gone`; `held` while its owner still runs — or,
 * where no owner can be read, while it is younger than `staleMs`; and
 * `abandoned` after. Its record and its age are read through one open, so
 * both are the same claim's.
 * @param {string} claimFile @param {number} staleMs
 * @returns {'gone'|'held'|'abandoned'}
 */
function claimState(claimFile, staleMs) {
  let fd;
  try {
    fd = fs.openSync(claimFile, 'r');
  } catch (e) {
    if (!(e && typeof e === 'object' && 'code' in e) || e.code !== 'ENOENT') throw e;
    return 'gone';
  }
  try {
    const owner = ownerIn(fs.readFileSync(fd, 'utf8'));
    const stands = owner ? ownerAlive(owner) : Date.now() - fs.fstatSync(fd).mtimeMs <= staleMs;
    return stands ? 'held' : 'abandoned';
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Create `claimFile` holding `record`, exclusively: the record is written
 * whole beside it and linked into place, so no reader ever meets an empty
 * claim.
 * @param {string} claimFile @param {string} record
 * @returns {boolean} whether this process created it
 */
function createClaim(claimFile, record) {
  const tmp = `${claimFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, record);
  try {
    fs.linkSync(tmp, claimFile);
    return true;
  } catch (e) {
    if (!(e && typeof e === 'object' && 'code' in e) || e.code !== 'EEXIST') throw e;
    return false;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/**
 * Claim `claimFile` for this process without waiting — a job only one
 * process may run at a time, whose holder may run for as long as the job
 * takes, so liveness is its owner's, never its age. The claim is created
 * exclusively with this process's identity, or taken over (guarded, as a
 * stale lock's break is) from an owner that no longer runs; a claim whose
 * owner cannot be read stands until it is older than `staleMs`. A claim
 * found gone is created again, never broken: by the time a break unlinks
 * it, the file may be a claim another contender has just made.
 * @param {string} claimFile @param {number} [staleMs]
 * @returns {(() => void)|null} the release — which removes the claim only
 *   while it is still this process's — or null while another holds it
 */
function tryClaimFile(claimFile, staleMs = LOCK_STALE_MS) {
  const own = { pid: process.pid, pid_start: processStartTime(process.pid) };
  const release = () => {
    const owner = claimOwner(claimFile);
    if (owner && owner.pid === own.pid && owner.pid_start === own.pid_start) releaseLockFile(claimFile);
  };
  const abandoned = () => claimState(claimFile, staleMs) === 'abandoned';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (createClaim(claimFile, JSON.stringify(own))) return release;
    const state = claimState(claimFile, staleMs);
    if (state === 'held') return null;
    if (state === 'abandoned') breakGuarded(claimFile, abandoned, staleMs);
  }
  return null;
}

/** Who holds a claim, as its record names it. @param {string} claimFile @returns {string} */
function claimHolder(claimFile) {
  const owner = claimOwner(claimFile);
  return owner && owner.pid ? `process ${owner.pid}` : 'another process';
}

/**
 * Claim a state lock, waiting up to `timeoutMs` for a live holder.
 * @param {string} lockFile @param {number} timeoutMs
 * @returns {() => void} the release
 */
function claimStateLock(lockFile, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let release = tryClaimFile(lockFile);
  while (release === null) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for the state lock (lock file: ${lockFile}) — ${claimHolder(lockFile)} holds it`);
    }
    sleepSync(LOCK_RETRY_MS);
    release = tryClaimFile(lockFile);
  }
  return release;
}

/** @type {Map<string, number>} the state locks this process holds, by file, each with the depth of its holds */
const stateHolds = new Map();

/**
 * Run `fn` holding the state lock at `lockFile` — waiting for a live holder,
 * taking over from one that is gone — taken again for nothing where this
 * process holds it already. `fn` runs synchronously.
 * @template T
 * @param {string} lockFile @param {() => T} fn
 * @param {{timeoutMs?: number}} [opts]
 * @returns {T}
 */
function withStateLockFile(lockFile, fn, { timeoutMs = WRITER_LOCK_TIMEOUT_MS } = {}) {
  const depth = stateHolds.get(lockFile) || 0;
  const release = depth === 0 ? claimStateLock(lockFile, timeoutMs) : null;
  stateHolds.set(lockFile, depth + 1);
  try {
    return fn();
  } finally {
    if (release === null) {
      stateHolds.set(lockFile, depth);
    } else {
      stateHolds.delete(lockFile);
      release();
    }
  }
}

/**
 * Run `fn` holding the writer lock of the state at `stateDir`, taken again
 * for nothing where this process holds it already. `fn` runs synchronously.
 * Refuses where the state worktree is not there: the lock file would conjure
 * a plain folder where the worktree belongs.
 * @template T
 * @param {string} stateDir @param {() => T} fn
 * @param {{timeoutMs?: number}} [opts]
 * @returns {T}
 */
function withWriterLock(stateDir, fn, opts) {
  if (!fs.existsSync(stateDir)) throw new Error(`no state worktree at ${stateDir} — nothing written`);
  return withStateLockFile(writerLockPath(stateDir), fn, opts);
}

/**
 * Run `fn` holding the writer lock, over a work unit's manifest. A missing
 * work-unit directory refuses upfront with the same not-found error the read
 * throws — there is no manifest to protect.
 * @template T
 * @param {string} stateDir @param {string} workUnit @param {() => T} fn
 * @returns {T}
 */
function withWorkUnitLock(stateDir, workUnit, fn) {
  if (!fs.existsSync(path.join(stateDir, workUnit))) {
    throw new Error(`manifest not found: ${workUnitManifestPath(stateDir, workUnit)}`);
  }
  return withWriterLock(stateDir, () => {
    assertWritableManifest(workUnitManifestPath(stateDir, workUnit));
    return fn();
  });
}

/**
 * Run `fn` holding the writer lock, over the project manifest.
 * @template T
 * @param {string} stateDir @param {() => T} fn
 * @returns {T}
 */
function withProjectLock(stateDir, fn) {
  return withWriterLock(stateDir, () => {
    assertWritableManifest(projectManifestPath(stateDir));
    return fn();
  });
}

module.exports = {
  LOCK_STALE_MS,
  LOCK_RETRY_MS,
  LOCK_TIMEOUT_MS,
  TMP_STALE_MS,
  WRITER_LOCK,
  WRITER_LOCK_TIMEOUT_MS,
  workUnitManifestPath,
  projectManifestPath,
  writerLockPath,
  breakStaleLockFile,
  acquireLockFile,
  releaseLockFile,
  tryClaimFile,
  ensureContainer,
  isObject,
  readWorkUnitManifest,
  jsonText,
  writeJsonAtomic,
  writeWorkUnitManifestAtomic,
  readProjectManifest,
  listWorkUnitManifests,
  writeProjectManifestAtomic,
  withStateLockFile,
  withWriterLock,
  withWorkUnitLock,
  withProjectLock,
};
