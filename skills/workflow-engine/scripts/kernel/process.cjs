'use strict';

// ---------------------------------------------------------------------------
// Kernel: process identity — pid + kernel-recorded start time uniquely
// identify a process (a recycled pid carries a different start time). The
// domains that record an owning Claude process (presence heartbeats, session-
// label stashes) share these to answer "does that process still run".
// ---------------------------------------------------------------------------

const { execFileSync } = require('child_process');

/**
 * The process's kernel-recorded start time. Null when the pid is gone or
 * `ps` is unavailable.
 * @param {number} pid @returns {string|null}
 */
function processStartTime(pid) {
  try {
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() || null;
  } catch { return null; }
}

/** Zero-signal existence probe; EPERM means alive. @param {number} pid */
function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (err) { return /** @type {NodeJS.ErrnoException} */ (err).code === 'EPERM'; }
}

module.exports = { processStartTime, processAlive };
