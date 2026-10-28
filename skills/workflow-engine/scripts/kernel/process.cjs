'use strict';

// ---------------------------------------------------------------------------
// Kernel: process identity — pid + kernel-recorded start time uniquely
// identify a process (a recycled pid carries a different start time). The
// domains that record an owning Claude process (presence heartbeats, session-
// label stashes) share these to answer "does that process still run" and
// "is that record the calling session's own".
// ---------------------------------------------------------------------------

const { execFileSync } = require('child_process');

/**
 * Block the thread for `ms` without burning CPU: Atomics.wait on a throwaway
 * buffer is never notified, so it sleeps the full timeout.
 * @param {number} ms
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * The process's kernel-recorded start time. Null when the pid is gone or
 * `ps` is unavailable.
 * @param {number} pid @returns {string|null}
 */
function processStartTime(pid) {
  try {
    // `lstart` is printed in the caller's timezone and locale; the recorded
    // string is compared verbatim by whichever session reads it later, so
    // both are pinned or two terminals with different TZs never match.
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    });
    return out.trim() || null;
  } catch { return null; }
}

/** @type {string|null} */
let ownStart = null;

/**
 * This process's own start time, read once — it never changes. A read that
 * fails is tried again at the next call.
 * @returns {string|null}
 */
function ownStartTime() {
  ownStart ??= processStartTime(process.pid);
  return ownStart;
}

/** Zero-signal existence probe; EPERM means alive. @param {number} pid */
function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (err) { return /** @type {NodeJS.ErrnoException} */ (err).code === 'EPERM'; }
}

/**
 * Does the record's owning process still run? Identity is pid + start time
 * where the record carries both (a recycled pid carries a different start
 * time), bare aliveness where it predates start times. A record with no pid
 * carries no identity to verify and is never alive. A start time that
 * cannot be read — `ps` failed to spawn or answered nothing — proves
 * nothing, so a pid that is there counts as the record's: only a pid that
 * is gone, or a start time read and found different, reads as dead.
 * `startOf` lets a scan memoise the `ps` read across records.
 * @param {{pid?: number|null, pid_start?: string|null}} record
 * @param {(pid: number) => string|null|undefined} [startOf]
 * @returns {boolean}
 */
function ownerAlive(record, startOf = processStartTime) {
  if (!record.pid || !processAlive(record.pid)) return false;
  if (!record.pid_start) return true;
  const start = startOf(record.pid);
  return start == null || start === record.pid_start;
}

/**
 * Does the calling session own this record? Its own session id, or its own
 * pid where the record predates a session id — so a later conversation in
 * the same process owns its predecessor's records. The one home for the
 * question, because every surface that marks or gates on a peer's record
 * must exclude the caller's own — a session must never gate against, or
 * strike through, itself — and the sweeps that restore a session's own
 * state must recognise it.
 * @param {{session_id?: string|null, pid?: number|null}} record
 * @returns {boolean}
 */
function ownsRow(record) {
  const mySession = process.env.CLAUDE_CODE_SESSION_ID || null;
  const myPid = Number(process.env.CLAUDE_PID) || null;
  return (mySession !== null && record.session_id === mySession) || (myPid !== null && record.pid === myPid);
}

module.exports = { sleepSync, processStartTime, ownStartTime, processAlive, ownerAlive, ownsRow };
