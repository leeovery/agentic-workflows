'use strict';

// ---------------------------------------------------------------------------
// Domain ring: session presence — a per-topic heartbeat file in the topic's
// cache directory. Awareness, never mutual exclusion: the epic view marks
// topics another session holds open, the analysis dispatch defers an epic-wide
// analysis while a peer session holds a source topic, the conclude sweep
// leaves a held peer's dirt alone, the code gate reads the whole project's
// rows and stamps the entrant's when the slot is free, and the spec-side
// resolution flow checks the target discussion before editing its document in
// place. The file records the owning Claude process's identity (pid + start
// time + session id); `held` — the one verdict — is true while that exact
// process still runs, however long it sits idle. The mtime is display only:
// the row's "last active" age, shown wherever a hold is named and never
// judged. A record without identity cannot be verified and is never held,
// so a beat with no CLAUDE_PID refuses rather than write one.
//
// Beats are mechanical: the engine stamps them as a side effect of the verbs
// a session already runs on its own topic (`beatQuietly`), and the terminal
// conclusion commit clears (`clearQuietly`). A beat writes THIS process's
// identity, so only a structurally self-referential verb may beat — stamping
// it from a verb acting on another topic manufactures a false hold. Read
// verbs are reachable for any topic, so they take `refreshQuietly` instead:
// re-stamp a heartbeat this session already owns, never create one, never
// overwrite a peer's. The SessionEnd hook on the session skills sweeps by
// session id for the exits that keep the process alive (/clear, logout).
//
// Every phase a session sits in carries presence except discovery:
// `discovery-session open` already refuses a second session per epic
// (`active_session`), so it is engine-serialised with nothing for a heartbeat
// to add.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { processStartTime, processAlive } = require('../kernel/process.cjs');
const { VALID_PHASES } = require('../kernel/manifest-schema.cjs');
const { section, CONTINUE_INSTRUCTION, callout } = require('./projections/surfaces.cjs');

// Every phase a session sits in — the schema's list minus discovery.
const PHASES = VALID_PHASES.filter((p) => p !== 'discovery');
// The phases that write the tree and the index — the unpartitionable pair.
const CODE_PHASES = ['implementation', 'review'];
// The corpora the epic-wide analyses read. A held session in any other phase
// is no reason to defer an analysis that never looks at its material.
const SOURCE_PHASES = ['research', 'discussion'];
// The phases whose document a specification extracts from — what the
// spec-side held-doc check looks for a holder on.
const DOCUMENT_PHASES = ['research', 'discussion', 'investigation'];

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
 * is the owning session's identity record, the mtime its last write.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function beatPresence(cwd, workUnit, phase, topic) {
  assertArgs(cwd, workUnit, phase, topic);
  const p = presencePath(cwd, workUnit, phase, topic);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const pid = Number(process.env.CLAUDE_PID) || null;
  if (!pid) throw new Error('presence beat: CLAUDE_PID is not set — a heartbeat without identity is never held, so none is written');
  /** @type {PresenceRecord} */
  const record = {
    pid,
    pid_start: processStartTime(pid),
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
 * The mechanical beat: a verb's heartbeat as a side effect, never observable.
 * Silent on every failure — a phase outside PHASES, a work unit with no
 * directory, an unwritable cache — because no verb's outcome may turn on
 * whether its heartbeat landed.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function beatQuietly(cwd, workUnit, phase, topic) {
  try {
    if (!PHASES.includes(phase)) return;
    beatPresence(cwd, workUnit, phase, topic);
  } catch { /* liveness is advisory — never fail a verb over it */ }
}

/**
 * The read verbs' beat: re-stamp a heartbeat this session already owns, and
 * only that. A read (`topic queue`, `agent scan`) is reachable for any topic
 * — a foreign topic's queue is legitimately checked from another session —
 * so creating a hold here would manufacture a phantom, and stamping over a
 * peer's record would re-attribute a hold. Ownership was established by
 * the write-shaped verbs that are self-referential by construction (`topic
 * start`, the entry renders, the cadence commit); this keeps that hold's
 * last-active age honest through quiet polling turns. Same silence as
 * `beatQuietly`.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function refreshQuietly(cwd, workUnit, phase, topic) {
  try {
    if (!PHASES.includes(phase)) return;
    const record = readRecord(presencePath(cwd, workUnit, phase, topic));
    if (!record || !ownsRow(record)) return;
    beatPresence(cwd, workUnit, phase, topic);
  } catch { /* liveness is advisory — never fail a verb over it */ }
}

/**
 * `beatQuietly`'s terminal sibling: drop the heartbeat as a side effect of the
 * verb that ends the session's work on the topic. Same silence.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function clearQuietly(cwd, workUnit, phase, topic) {
  try {
    if (!PHASES.includes(phase)) return;
    clearPresence(cwd, workUnit, phase, topic);
  } catch { /* liveness is advisory — never fail a verb over it */ }
}

/**
 * @typedef {object} PresenceRow
 * @property {string} phase
 * @property {string} topic
 * @property {number} age_seconds  since the last write — "last active", never a verdict
 * @property {boolean} held  the owning process still runs (identity verified;
 *                           a record carrying none is never held)
 * @property {string|null} session_id
 * @property {number|null} pid  the owning Claude process, when the record carries one
 */

/**
 * Memoised process start times — one `ps` per pid across a whole scan.
 * @returns {(pid: number) => string|null|undefined}
 */
function startTimeReader() {
  /** @type {Map<number, string|null>} */
  const cache = new Map();
  return (pid) => {
    if (!cache.has(pid)) cache.set(pid, processStartTime(pid));
    return cache.get(pid);
  };
}

/**
 * Does the record's process still run? Pid + start time where the record
 * carries both, bare aliveness where it predates start times. A record with
 * no identity cannot be verified and is never held.
 * @param {PresenceRecord|null} record
 * @param {(pid: number) => string|null|undefined} startOf
 * @returns {boolean}
 */
function heldBy(record, startOf) {
  if (!record || !record.pid) return false;
  return record.pid_start ? startOf(record.pid) === record.pid_start : processAlive(record.pid);
}

/**
 * Every heartbeat under one work unit's cache, the held verdict applied.
 * @param {string} cwd @param {string} workUnit
 * @param {(pid: number) => string|null|undefined} startOf
 * @returns {PresenceRow[]}
 */
function collectRows(cwd, workUnit, startOf) {
  /** @type {PresenceRow[]} */
  const rows = [];
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
      const record = readRecord(file);
      rows.push({
        phase, topic,
        age_seconds: Math.max(0, Math.floor((Date.now() - stat.mtimeMs) / 1000)),
        held: heldBy(record, startOf),
        session_id: record ? record.session_id || null : null,
        pid: record ? record.pid ?? null : null,
      });
    }
  }
  return rows;
}

/**
 * The held rows an epic-wide analysis would read over — a peer's, never the
 * caller's own: a session that parked its own research and stepped back to
 * the menu is not mid-conversation on it, and a deferral naming that row
 * would wait on the session reading it.
 * @param {PresenceRow[]} sessions
 */
function heldSources(sessions) {
  return sessions.filter((r) => r.held && SOURCE_PHASES.includes(r.phase) && !ownsRow(r));
}

/**
 * The freshest held row a peer holds on one document — the spec-side
 * held-doc gate's read, naming the holder's last-active age. Null when no
 * peer holds it.
 * @param {string} cwd @param {string} workUnit @param {string} doc  the document's topic name
 * @returns {PresenceRow|null}
 */
function heldDocument(cwd, workUnit, doc) {
  const rows = scanPresence(cwd, workUnit).sessions
    .filter((r) => r.held && r.topic === doc && DOCUMENT_PHASES.includes(r.phase) && !ownsRow(r));
  return rows[0] || null;
}

/**
 * Every heartbeat in the work unit's cache, the held verdict applied — the
 * one read every consumer shares. `held` answers "does a session hold this
 * topic open", unbounded by time; `age_seconds` says how long since it last
 * wrote, and is shown, never judged.
 * @param {string} cwd @param {string} workUnit
 * @returns {{work_unit: string, held: number, held_sources: number, sessions: PresenceRow[]}}
 */
function scanPresence(cwd, workUnit) {
  assertArgs(cwd, workUnit, undefined);
  const sessions = collectRows(cwd, workUnit, startTimeReader()).sort((a, b) => a.age_seconds - b.age_seconds);
  return {
    work_unit: workUnit,
    held: sessions.filter((r) => r.held).length,
    // The analyses read research and discussion; `held_sources` is the count
    // that decides a deferral, so a held planning or spec session never holds
    // one up.
    held_sources: heldSources(sessions).length,
    sessions,
  };
}

/**
 * Every heartbeat in the project, work unit named per row — the read the code
 * gate needs, which asks "is any session anywhere in a code phase" and has no
 * work unit to scope by. Same row shape and the same `held` total as the
 * per-work-unit scan, plus `work_unit`; `scope` names the form.
 * @param {string} cwd
 * @returns {{scope: string, held: number, sessions: (PresenceRow & {work_unit: string})[]}}
 */
function scanProject(cwd) {
  const cacheRoot = path.join(cwd, '.workflows', '.cache');
  /** @type {string[]} */
  let workUnits = [];
  try {
    workUnits = fs.readdirSync(cacheRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { /* nothing cached yet */ }
  const startOf = startTimeReader();
  /** @type {(PresenceRow & {work_unit: string})[]} */
  const sessions = [];
  for (const wu of workUnits.sort()) {
    for (const row of collectRows(cwd, wu, startOf)) sessions.push({ work_unit: wu, ...row });
  }
  sessions.sort((a, b) => a.age_seconds - b.age_seconds);
  return {
    scope: 'project',
    held: sessions.filter((r) => r.held).length,
    sessions,
  };
}

/**
 * Does the calling session own this heartbeat? Its own session id, or its own
 * pid where the record predates a session id. The one home for the question,
 * because every surface that marks or gates on a peer's hold must exclude the
 * caller's own — a session must never gate against, or strike through, itself.
 * @param {{session_id?: string|null, pid?: number|null}} row
 * @returns {boolean}
 */
function ownsRow(row) {
  const mySession = process.env.CLAUDE_CODE_SESSION_ID || null;
  const myPid = Number(process.env.CLAUDE_PID) || null;
  return (mySession !== null && row.session_id === mySession) || (myPid !== null && row.pid === myPid);
}

/**
 * Every held implementation or review heartbeat in the project, minus the
 * calling session's own — the code gate's read. Code is the one resource
 * that does not partition by topic: one tree, one index, one checkout, so
 * one code session at a time whatever work unit or topic it sits in.
 * @param {string} cwd
 * @returns {(PresenceRow & {work_unit: string})[]}
 */
function heldCodeSessions(cwd) {
  return scanProject(cwd).sessions.filter((row) => row.held
    && CODE_PHASES.includes(row.phase)
    && !ownsRow(row));
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
 * verbatim (only where an analysis defers — the marker says so). Counts the
 * source phases alone, like the deferral itself, naming each held row with
 * its last-active age. Empty when no source session is held.
 * @param {{work_unit: string, sessions: PresenceRow[]}} scan
 * @returns {string}
 */
function deferralSection(scan) {
  const held = heldSources(scan.sessions);
  if (held.length === 0) return '';
  const names = held.map((r) => `${r.phase}/${r.topic} (last active ${fmtAge(r.age_seconds)} ago)`).join(', ');
  const [first] = held;
  const release = `node .claude/skills/workflow-engine/scripts/engine.cjs presence clear ${scan.work_unit} ${first.phase} ${first.topic}`;
  return section(
    'DISPLAY: presence deferral',
    `only at an analysis deferral: ${CONTINUE_INSTRUCTION}`,
    callout(`Analyses deferred — ${held.length} session(s): ${names}. They read the settled record, so they wait for those sessions to conclude; a session that is wedged but alive releases its hold with \`${release}\`.`),
  );
}

module.exports = {
  beatPresence, clearPresence, beatQuietly, refreshQuietly, clearQuietly,
  scanPresence, scanProject, heldCodeSessions, heldDocument, cleanupPresence, deferralSection,
  fmtAge, ownsRow, CODE_PHASES, SOURCE_PHASES,
};
