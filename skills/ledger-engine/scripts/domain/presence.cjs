'use strict';

// ---------------------------------------------------------------------------
// Domain ring: session presence — a per-topic heartbeat file in the topic's
// cache directory. Awareness, never mutual exclusion: the epic view marks
// topics another session holds open, the conclude sweep leaves a held peer's
// dirt alone, the code gate reads the whole project's
// rows and stamps the entrant's when the slot is free, and the spec-side
// resolution flow checks the target discussion before editing its document in
// place. The file records the owning Claude process's identity (pid + start
// time + session id) and the checkout its session works in — presence lives
// in the one state every checkout shares, and the code gate is per checkout;
// `held` — the one verdict — is true while that exact
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
// overwrite a peer's; a verb that closes a topic it may or may not be
// sitting in takes `clearOwnQuietly`, the same ownership guard over the
// clear. The exit sweep is `cleanupPresence`, run from a settings-level
// SessionEnd hook the engine installs in the project's `.claude/settings.json`
// (a SessionEnd hook declared in skill frontmatter never fires): it drops
// every row the ending session owns, by session id, on the exits that keep
// the process alive (`/clear`, `/logout`) — rows that would otherwise read
// held until the process exits. A dead process's row reads unheld through
// the pid check regardless, and a later conversation in the same process
// owns its predecessor's row (`ownsRow`'s pid arm), never gating against it.
//
// Every phase a session sits in carries presence, discovery among them: an
// epic's at the unit itself, and the product's conversation at
// `product/discovery/product` — the product, which has no directory of its
// own, keeping its rows beside the units'. The product's conversation is
// the one place several conversations sit in at once, so it keeps a row for
// each, `presence-{session}`: the hold read there is any other live
// conversation's, whichever beat last, and a conversation leaving it drops
// its own. Every other place keeps one row, `presence`.
//
// So does the migration, while a session carries it on (21.10.10, P7): one
// row, in the folder the runner journals in, which the reshape's commit
// clears with the journals, and which boot drops once it reaches the work,
// the migration done (`dropMigrationRow`). Boot's stop at a directive, or
// for the checks before the reshape's move, stamps it for the session it
// stops, unless another live session holds it, whose row the stop then names
// (`migrationCarrier`); `migrate check` and `migrate checked`, which the
// session runs as it works, re-stamp a row it owns; and the exit sweep drops
// it with the session's other rows.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { callerIdentity, startTimeReader, ownerAlive, ownsRow, handedSession } = require('../kernel/process.cjs');
const { PRODUCT, VALID_PHASES } = require('../kernel/manifest-schema.cjs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { workTree } = require('../kernel/isolated-git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { MIGRATION_JOURNALS } = require('./migration-commit.cjs');
const { safeId } = require('./conversation.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { quickFixBuild } = require('./derivations.cjs');

// Every phase a session sits in.
const PHASES = VALID_PHASES;
// The phases that write the tree and the index — the unpartitionable pair.
const CODE_PHASES = ['implementation', 'review'];

/** A place's rows, by their file names. */
const ROW = /^presence(-[A-Za-z0-9_-]+)?$/;

/**
 * The calling conversation's row at a place (the header's): its own at the
 * product's conversation, the place's one row anywhere else.
 * @param {string} cwd @param {string} wu @param {string} phase @param {string} topic
 */
function presencePath(cwd, wu, phase, topic) {
  const session = handedSession();
  return statePath(cwd, '.cache', wu, phase, topic, wu === PRODUCT && session !== null ? `presence-${safeId(session)}` : 'presence');
}

/** Every row file at the place `dir` holds. @param {string} dir @returns {string[]} */
function rowFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => ROW.test(name)).map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

/** The migration's row. @param {string} cwd */
function migrationPresencePath(cwd) {
  return statePath(cwd, MIGRATION_JOURNALS, 'presence');
}

/** @param {string} cwd @param {string} workUnit @param {string} [phase] @param {string} [topic] */
function assertArgs(cwd, workUnit, phase, topic) {
  if (phase !== undefined && !PHASES.includes(phase)) {
    throw new Error(`presence is ${PHASES.join('|')} only — got "${phase}"`);
  }
  if (topic !== undefined && (!topic || /[\\/]/.test(topic) || topic.includes('..'))) {
    throw new Error(`invalid topic name "${topic}" — no separators or ".."`);
  }
  if (workUnit !== PRODUCT && !fs.existsSync(statePath(cwd, workUnit))) {
    throw new Error(`no work unit directory: ${statePath(cwd, workUnit)}`);
  }
}

/**
 * @typedef {object} PresenceRecord
 * @property {number|null} pid         the owning Claude process (CLAUDE_PID)
 * @property {string|null} pid_start   its start time at beat — recycled-pid guard
 * @property {string|null} session_id  the owning conversation (CLAUDE_CODE_SESSION_ID)
 * @property {string} checkout         the work tree its session works in
 */

/** Parse a heartbeat's identity record; null for unreadable content. @param {string} file @returns {PresenceRecord|null} */
function readRecord(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* unreadable content */ }
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
  stampRow(cwd, presencePath(cwd, workUnit, phase, topic));
  return { work_unit: workUnit, phase, topic, beat: true };
}

/**
 * Write the calling session's identity record to the row `file`.
 * @param {string} cwd @param {string} file
 */
function stampRow(cwd, file) {
  const owner = callerIdentity();
  if (!owner.pid) throw new Error('presence beat: CLAUDE_PID is not set — a heartbeat without identity is never held, so none is written');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  /** @type {PresenceRecord} */
  const record = { ...owner, checkout: workTree(codeRoot(cwd)) };
  fs.writeFileSync(file, JSON.stringify(record) + '\n');
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
 * only that. A read (`topic mailbox`, `agent scan`) is reachable for any topic
 * — a foreign topic's mailbox is legitimately checked from another session —
 * so creating a hold here would manufacture a phantom, and stamping over a
 * peer's record would re-attribute a hold. Ownership was established by
 * the write-shaped verbs that are self-referential by construction (`enter`,
 * the entry renders, the cadence commit); this keeps that hold's
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
 * `clearQuietly` under `refreshQuietly`'s ownership guard: drop a heartbeat
 * this session owns, never a peer's — the verb that closes a topic is not
 * always sitting in it. Same silence as `beatQuietly`.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function clearOwnQuietly(cwd, workUnit, phase, topic) {
  try {
    if (!PHASES.includes(phase)) return;
    const record = readRecord(presencePath(cwd, workUnit, phase, topic));
    if (!record || !ownsRow(record)) return;
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
 * @property {string|null} checkout  the work tree the owning session works in, when the record carries one
 */

/**
 * Is the heartbeat held — its owning process verified alive (the kernel's
 * liveness rule)? A missing record is never held.
 * @param {PresenceRecord|null} record
 * @param {(pid: number) => string|null|undefined} startOf
 * @returns {boolean}
 */
function heldBy(record, startOf) {
  return record !== null && ownerAlive(record, startOf);
}

/**
 * One topic's heartbeats as rows, the held verdict applied: none where the
 * topic has none.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 * @param {(pid: number) => string|null|undefined} startOf
 * @returns {PresenceRow[]}
 */
function rowsAt(cwd, workUnit, phase, topic, startOf) {
  return rowFiles(statePath(cwd, '.cache', workUnit, phase, topic)).flatMap((file) => {
    const row = rowOf(file, startOf);
    return row === null ? [] : [{ phase, topic, ...row }];
  });
}

/**
 * The heartbeat at `file` as a row, but for its place, the held verdict
 * applied; null where there is none.
 * @param {string} file @param {(pid: number) => string|null|undefined} startOf
 * @returns {Omit<PresenceRow, 'phase'|'topic'>|null}
 */
function rowOf(file, startOf) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch { return null; }
  const record = readRecord(file);
  return {
    age_seconds: Math.max(0, Math.floor((Date.now() - stat.mtimeMs) / 1000)),
    held: heldBy(record, startOf),
    session_id: record ? record.session_id || null : null,
    pid: record ? record.pid ?? null : null,
    checkout: record ? record.checkout ?? null : null,
  };
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
    const dir = statePath(cwd, '.cache', workUnit, phase);
    /** @type {string[]} */
    let topics = [];
    try {
      topics = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch { /* phase never cached */ }
    for (const topic of topics) rows.push(...rowsAt(cwd, workUnit, phase, topic, startOf));
  }
  return rows;
}

/**
 * Whether the conversation `sessionId` holds the place live — a row of its
 * own there, its owner alive. Catch-up's read (discovery-entry.cjs), at the
 * product's conversation, where several conversations keep rows at once.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic @param {string} sessionId
 */
function holdsLive(cwd, workUnit, phase, topic, sessionId) {
  return rowsAt(cwd, workUnit, phase, topic, startTimeReader()).some((row) => row.held && row.session_id === sessionId);
}

/**
 * The hold a peer has on one topic — its row, naming when it was last
 * active — or null where none does but the caller. The entry's read
 * (enter.cjs), which asks before it takes a topic another session holds.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 * @returns {PresenceRow|null}
 */
function peerHold(cwd, workUnit, phase, topic) {
  if (!PHASES.includes(phase)) return null;
  return rowsAt(cwd, workUnit, phase, topic, startTimeReader()).find((row) => row.held && !ownsRow(row)) ?? null;
}

/**
 * The row of another live session carrying the migration on — naming when
 * it was last active — or null where none does: no row, its owner gone, or
 * the caller's own.
 * @param {string} cwd
 * @returns {Omit<PresenceRow, 'phase'|'topic'>|null}
 */
function migrationCarrier(cwd) {
  const row = rowOf(migrationPresencePath(cwd), startTimeReader());
  return row !== null && row.held && !ownsRow(row) ? row : null;
}

/**
 * The calling session's row at the migration's place, stamped as boot stops
 * it where it carries the migration on. Silent, as `beatQuietly` is.
 * @param {string} cwd
 */
function beatMigrationQuietly(cwd) {
  try {
    stampRow(cwd, migrationPresencePath(cwd));
  } catch { /* liveness is advisory — never fail a verb over it */ }
}

/**
 * The migration's row re-stamped where the calling session owns it, and
 * only then, as `refreshQuietly` keeps a topic's. Same silence.
 * @param {string} cwd
 */
function refreshMigrationQuietly(cwd) {
  try {
    const file = migrationPresencePath(cwd);
    const record = readRecord(file);
    if (record && ownsRow(record)) stampRow(cwd, file);
  } catch { /* liveness is advisory — never fail a verb over it */ }
}

/** Whether a session carries the migration on: its row there, whoever wrote it. @param {string} cwd @returns {boolean} */
function migrationCarried(cwd) {
  return fs.existsSync(migrationPresencePath(cwd));
}

/** Whether the conversation `sessionId` carries the migration on: the migration's row is its. @param {string} cwd @param {string} sessionId @returns {boolean} */
function carriesMigration(cwd, sessionId) {
  return readRecord(migrationPresencePath(cwd))?.session_id === sessionId;
}

/** The migration's row gone, whoever wrote it: the migration is done. @param {string} cwd */
function dropMigrationRow(cwd) {
  fs.rmSync(migrationPresencePath(cwd), { force: true });
}

/**
 * Every heartbeat in the work unit's cache, the held verdict applied — the
 * one read every consumer shares. `held` answers "does a session hold this
 * topic open", unbounded by time; `age_seconds` says how long since it last
 * wrote, and is shown, never judged.
 * @param {string} cwd @param {string} workUnit
 * @returns {{work_unit: string, held: number, sessions: PresenceRow[]}}
 */
function scanPresence(cwd, workUnit) {
  assertArgs(cwd, workUnit, undefined);
  const sessions = collectRows(cwd, workUnit, startTimeReader()).sort((a, b) => a.age_seconds - b.age_seconds);
  return {
    work_unit: workUnit,
    held: sessions.filter((r) => r.held).length,
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
  const cacheRoot = statePath(cwd, '.cache');
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
 * Every held implementation or review heartbeat working in the caller's
 * checkout, minus the calling session's own — the code gate's read. Code is
 * the one resource that does not partition by topic: one tree, one index,
 * so one code session per checkout whatever work unit or topic it sits in;
 * a quick-fix's, built in a worktree of its own (fix-branch.cjs), holds
 * none.
 * @param {string} cwd
 * @returns {(PresenceRow & {work_unit: string})[]}
 */
function heldCodeSessions(cwd) {
  const checkout = workTree(codeRoot(cwd));
  return scanProject(cwd).sessions.filter((row) => row.held
    && CODE_PHASES.includes(row.phase)
    && row.checkout === checkout
    && !ownsRow(row)
    && !builtApart(cwd, row.work_unit));
}

/** Whether the unit's code is built in a worktree of its own, a quick-fix's. @param {string} cwd @param {string} unit */
function builtApart(cwd, unit) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest !== null && quickFixBuild(manifest);
}

/** A place the exit sweep cleared: a topic's, or the migration's. @typedef {{work_unit: string, phase: string, topic: string}|{place: 'migration'}} Cleared */

/**
 * Drop the row at `file` where the named session owns it.
 * @param {string} file @param {string} sessionId @returns {boolean} it was dropped
 */
function dropOwned(file, sessionId) {
  const record = readRecord(file);
  if (!record || record.session_id !== sessionId) return false;
  try {
    fs.unlinkSync(file);
    return true;
  } catch { return false; /* raced away */ }
}

/**
 * Sweep every heartbeat the named session owns, across all work units, and
 * its row at the migration's place — the SessionEnd hook's target, covering
 * the exits that keep the process alive (/clear, logout). Never throws on
 * malformed or missing state: a hook must exit clean.
 * @param {string} cwd @param {string|null} sessionId
 * @returns {{session_id: string|null, cleared: Cleared[]}}
 */
function cleanupPresence(cwd, sessionId) {
  /** @type {Cleared[]} */
  const cleared = [];
  if (!sessionId) return { session_id: null, cleared };
  /** @type {string} */
  let cacheRoot;
  /** @type {string[]} */
  let workUnits = [];
  try {
    cacheRoot = statePath(cwd, '.cache');
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
        if (rowFiles(path.join(dir, topic)).map((file) => dropOwned(file, sessionId)).includes(true)) cleared.push({ work_unit: wu, phase, topic });
      }
    }
  }
  if (dropOwned(migrationPresencePath(cwd), sessionId)) cleared.push({ place: 'migration' });
  return { session_id: sessionId, cleared };
}

module.exports = {
  beatPresence, clearPresence, beatQuietly, refreshQuietly, clearQuietly, clearOwnQuietly,
  scanPresence, scanProject, heldCodeSessions, peerHold, holdsLive, cleanupPresence,
  migrationCarrier, migrationCarried, carriesMigration, beatMigrationQuietly, refreshMigrationQuietly, dropMigrationRow,
  fmtAge,
};
