'use strict';

// ---------------------------------------------------------------------------
// Domain ring: session presence — a per-topic heartbeat file in the topic's
// cache directory. Awareness, never mutual exclusion: the bridge defers
// epic-wide analyses while a peer session is live, the conclude sweep leaves
// a live peer's dirt alone, and triage landings can say whether the target's
// session will drain shortly. The file's mtime is the heartbeat; sessions
// beat it at their per-turn check and clear it at conclusion. A crashed
// session's presence ages out.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

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
 * Refresh the topic's heartbeat. Cache-resident and gitignored; content is
 * incidental (pid), the mtime is the signal.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function beatPresence(cwd, workUnit, phase, topic) {
  assertArgs(cwd, workUnit, phase, topic);
  const p = presencePath(cwd, workUnit, phase, topic);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, String(process.pid) + '\n');
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
 * @property {boolean} live
 */

/**
 * Every heartbeat in the work unit's cache, with liveness applied — the one
 * read every consumer shares.
 * @param {string} cwd @param {string} workUnit
 * @returns {{work_unit: string, stale_after_seconds: number, live: number, sessions: PresenceRow[]}}
 */
function scanPresence(cwd, workUnit) {
  assertArgs(cwd, workUnit, undefined);
  /** @type {PresenceRow[]} */
  const sessions = [];
  for (const phase of PHASES) {
    const dir = path.join(cwd, '.workflows', '.cache', workUnit, phase);
    /** @type {string[]} */
    let topics = [];
    try {
      topics = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch { /* phase never cached */ }
    for (const topic of topics) {
      let stat;
      try {
        stat = fs.statSync(path.join(dir, topic, 'presence'));
      } catch { continue; }
      const age = Math.max(0, Math.floor((Date.now() - stat.mtimeMs) / 1000));
      sessions.push({ phase, topic, age_seconds: age, live: age < STALE_AFTER_SECONDS });
    }
  }
  sessions.sort((a, b) => a.age_seconds - b.age_seconds);
  return { work_unit: workUnit, stale_after_seconds: STALE_AFTER_SECONDS, live: sessions.filter((r) => r.live).length, sessions };
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
  return (
    '=== DISPLAY: presence deferral — emit verbatim as a code block, only at the analysis-dispatch deferral ===\n' +
    `  ⚑ Analyses deferred — ${scan.live} live session(s): ${names}.\n` +
    '    They re-run at the next entry once those sessions conclude.\n'
  );
}

module.exports = { beatPresence, clearPresence, scanPresence, deferralSection, STALE_AFTER_SECONDS };
