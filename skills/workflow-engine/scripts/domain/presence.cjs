'use strict';

// ---------------------------------------------------------------------------
// Domain ring: session presence — a per-topic heartbeat file in the topic's
// cache directory. Awareness, never mutual exclusion: the epic view marks
// topics another session holds open, the bridge defers epic-wide analyses
// while a peer session is active, the conclude sweep leaves a held peer's
// dirt alone, and triage landings can say whether the target's session will
// drain shortly. The file records the owning Claude process's identity
// (pid + start time + session id); `held` is true while that exact process
// still runs — however long it sits idle — and the mtime is the activity
// signal (`live` = held and beaten within the staleness window). A record
// without identity (no CLAUDE_PID at beat time) degrades to mtime-only.
// Sessions beat at their per-turn check, clear at conclusion; the SessionEnd
// hook on the session skills sweeps by session id for the exits that keep
// the process alive (/clear, logout).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { section, CONTINUE_INSTRUCTION, callout } = require('./projections/surfaces.cjs');

const STALE_AFTER_SECONDS = 900;
const PHASES = ['research', 'discussion'];

/** @param {string} cwd @param {string} wu @param {string} phase @param {string} topic */
function presencePath(cwd, wu, phase, topic) {
  return path.join(cwd, '.workflows', '.cache', wu, phase, topic, 'presence');
}

/** @param {string} cwd @param {string} workUnit @param {string} [phase] @param {string} [topic] */
function assertArgs(cwd, workUnit, phase, topic) {
  if (phase !== undefined && !PHASES.includes(phase)) {
    throw new Error(`presence is ${PHASES.join('|')} only — got "${phase}"`);
  }
  if (topic !== undefined && (!topic || /[\\/]/.test(topic) || topic.includes('..'))) {
    throw new Error(`invalid topic name "${topic}" — no separators or ".."`);
  }
  if (!fs.existsSync(path.join(cwd, '.workflows', workUnit))) {
    throw new Error(`no work unit directory: .workflows/${workUnit}`);
  }
}

/**
 * The process's kernel-recorded start time — pid + start time is a unique
 * process identity (a recycled pid carries a different start time). Null when
 * the pid is gone or `ps` is unavailable.
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

/**
 * @typedef {object} PresenceRecord
 * @property {number|null} pid         the owning Claude process (CLAUDE_PID)
 * @property {string|null} pid_start   its start time at beat — recycled-pid guard
 * @property {string|null} session_id  the owning conversation (CLAUDE_CODE_SESSION_ID)
 */

/** Parse a heartbeat's identity record; null for legacy/unreadable content. @param {string} file @returns {PresenceRecord|null} */
function readRecord(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* legacy bare-pid content */ }
  return null;
}

/** Human age for render surfaces — `40s`, `12m`, `3h`, `2d`. @param {number} seconds */
function fmtAge(seconds) {
  if (seconds < 90) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * Refresh the topic's heartbeat. Cache-resident and gitignored; the content
 * is the owning session's identity record, the mtime is the activity signal.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function beatPresence(cwd, workUnit, phase, topic) {
  assertArgs(cwd, workUnit, phase, topic);
  const p = presencePath(cwd, workUnit, phase, topic);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const pid = Number(process.env.CLAUDE_PID) || null;
  /** @type {PresenceRecord} */
  const record = {
    pid,
    pid_start: pid ? processStartTime(pid) : null,
    session_id: process.env.CLAUDE_CODE_SESSION_ID || null,
  };
  fs.writeFileSync(p, JSON.stringify(record) + '\n');
  return { work_unit: workUnit, phase, topic, beat: true };
}

/**
 * Drop the topic's heartbeat — a session's orderly exit. Missing is fine.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function clearPresence(cwd, workUnit, phase, topic) {
  assertArgs(cwd, workUnit, phase, topic);
  try { fs.unlinkSync(presencePath(cwd, workUnit, phase, topic)); } catch { /* never set */ }
  return { work_unit: workUnit, phase, topic, cleared: true };
}

/**
 * @typedef {object} PresenceRow
 * @property {string} phase
 * @property {string} topic
 * @property {number} age_seconds
 * @property {boolean} held  the owning process still runs (identity verified;
 *                           mtime-fallback when the record carries none)
 * @property {boolean} live  held and beaten within the staleness window
 * @property {string|null} session_id
 */

/**
 * Every heartbeat in the work unit's cache, with liveness applied — the one
 * read every consumer shares. `held` answers "does a session hold this topic
 * open" (unbounded by time); `live` answers "is it actively working".
 * @param {string} cwd @param {string} workUnit
 * @returns {{work_unit: string, stale_after_seconds: number, live: number, held: number, sessions: PresenceRow[]}}
 */
function scanPresence(cwd, workUnit) {
  assertArgs(cwd, workUnit, undefined);
  /** @type {PresenceRow[]} */
  const sessions = [];
  /** @type {Map<number, string|null>} */
  const startCache = new Map();
  const startOf = (/** @type {number} */ pid) => {
    if (!startCache.has(pid)) startCache.set(pid, processStartTime(pid));
    return startCache.get(pid);
  };
  for (const phase of PHASES) {
    const dir = path.join(cwd, '.workflows', '.cache', workUnit, phase);
    /** @type {string[]} */
    let topics = [];
    try {
      topics = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch { /* phase never cached */ }
    for (const topic of topics) {
      const file = path.join(dir, topic, 'presence');
      let stat;
      try {
        stat = fs.statSync(file);
      } catch { continue; }
      const age = Math.max(0, Math.floor((Date.now() - stat.mtimeMs) / 1000));
      const record = readRecord(file);
      let held;
      if (record && record.pid) {
        held = record.pid_start ? startOf(record.pid) === record.pid_start : processAlive(record.pid);
      } else {
        held = age < STALE_AFTER_SECONDS;
      }
      sessions.push({
        phase, topic, age_seconds: age,
        held, live: held && age < STALE_AFTER_SECONDS,
        session_id: record ? record.session_id || null : null,
      });
    }
  }
  sessions.sort((a, b) => a.age_seconds - b.age_seconds);
  return {
    work_unit: workUnit,
    stale_after_seconds: STALE_AFTER_SECONDS,
    live: sessions.filter((r) => r.live).length,
    held: sessions.filter((r) => r.held).length,
    sessions,
  };
}

/**
 * Sweep every heartbeat the named session owns, across all work units — the
 * SessionEnd hook's target, covering the exits that keep the process alive
 * (/clear, logout). Never throws on malformed or missing state: a hook must
 * exit clean.
 * @param {string} cwd @param {string|null} sessionId
 * @returns {{session_id: string|null, cleared: {work_unit: string, phase: string, topic: string}[]}}
 */
function cleanupPresence(cwd, sessionId) {
  /** @type {{work_unit: string, phase: string, topic: string}[]} */
  const cleared = [];
  if (!sessionId) return { session_id: null, cleared };
  const cacheRoot = path.join(cwd, '.workflows', '.cache');
  /** @type {string[]} */
  let workUnits = [];
  try {
    workUnits = fs.readdirSync(cacheRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return { session_id: sessionId, cleared }; }
  for (const wu of workUnits) {
    for (const phase of PHASES) {
      const dir = path.join(cacheRoot, wu, phase);
      /** @type {string[]} */
      let topics = [];
      try {
        topics = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
      } catch { continue; }
      for (const topic of topics) {
        const file = path.join(dir, topic, 'presence');
        const record = readRecord(file);
        if (record && record.session_id === sessionId) {
          try {
            fs.unlinkSync(file);
            cleared.push({ work_unit: wu, phase, topic });
          } catch { /* raced away */ }
        }
      }
    }
  }
  return { session_id: sessionId, cleared };
}

/**
 * The deferral callout, rendered engine-side so calling flows emit it
 * verbatim (only at the dispatch deferral the marker names). Empty when
 * nothing is live.
 * @param {{live: number, sessions: PresenceRow[]}} scan
 * @returns {string}
 */
function deferralSection(scan) {
  if (scan.live === 0) return '';
  const names = scan.sessions.filter((r) => r.live).map((r) => `${r.phase}/${r.topic}`).join(', ');
  return section(
    'DISPLAY: presence deferral',
    `only at the analysis-dispatch deferral: ${CONTINUE_INSTRUCTION}`,
    callout(`Analyses deferred — ${scan.live} live session(s): ${names}. They re-run at the next entry once those sessions conclude.`),
  );
}

module.exports = { beatPresence, clearPresence, scanPresence, cleanupPresence, deferralSection, fmtAge, STALE_AFTER_SECONDS };
