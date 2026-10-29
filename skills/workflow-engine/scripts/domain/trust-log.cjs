'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the trust log (16.13) — the person's own stream of evidence
// across every project on the machine, `trust.jsonl` in the system config
// directory (4.11.14), its events trust-events.cjs's. Only the engine writes
// it (16.13.2): `record` is its one door, and the layout hook refuses
// Claude's own writes to it (layout-hook.cjs). Counts are derived from it as
// they are read, never stored (16.13.6): a read is one pass over the file,
// and what came later goes by an event's time, never its place in the file.
//
// - `record` builds the event, then appends it. A writer that writes a store
//   of its own in the same command — the ledger, an entry the event names —
//   builds the event (`newEvent`) and keeps it waiting in the conversation
//   ahead of its entry (`keepEvent`) before its own write, so what refuses
//   the event writes nothing in either, then lands it (`landKept`) after,
//   where nothing but the append can fail. A kill at any point leaves the
//   event nowhere, waiting with no entry, waiting with its entry, or landed:
//   a landing lands one waiting with its entry and lets go of one whose
//   entry the ledger lacks while the landing holds that state's writer lock,
//   which the writer held from before it kept the event to after its
//   append, so the write died between the two. Any other landing — from
//   another state, or without the lock — leaves it waiting. A kept line is
//   told by the event it holds, and carries a version of its own beside
//   what it awaits: one of a version this engine does not write waits, as
//   a newer release's event does, never dropped; one of this version whose
//   awaits names no ledger and entry is dropped with a warning; and no bad
//   line stops the landing of any other.
// - An event is keyed by the project it happened in (16.13.5): the
//   `project_id` setup writes on the project manifest when it creates the
//   state, never changed, its name beside it. A project manifest without one
//   is refused, never filled in. An event before the project has state
//   carries none. The model is the one the caller's transcript last names
//   (conversation.cjs), by its id: null where none can be read, or what is
//   read is no model's id. The session is the id Claude Code handed the
//   command, null where it handed none, or what it handed is no session's
//   id. An event's time is to the millisecond.
// - An append holds a lock of its own beside the log, one for the machine,
//   never the project's writer lock. Where both are held the writer lock is
//   taken first, and the trust lock is held for the append alone, so never
//   the other way round. Under it, a last line a writer that died mid-append
//   left unterminated is cut away before the line is added.
// - An append that fails is a warning, and the event waits in the
//   conversation's folder, `trust-pending.jsonl` — the folder made for it
//   where the conversation has none yet, as before the project has state —
//   under a lock of its own, taken inside the trust lock where both are
//   held; the conversation's next record appends what waits, in order,
//   before its own event, and so does every boot, for every conversation,
//   holding the writer lock of its project's state where it has one, before
//   its tidy-up, which leaves a folder still holding some
//   (conversation.cjs): an event waiting as its conversation ends is never
//   lost. What waits leaves only under the trust lock. A command Claude
//   Code handed no session id has nowhere to keep it: the warning says the
//   event is lost. The layout hook refuses Claude's writes to every file
//   whose bytes reach the log. Of what waits, an event this engine reads
//   lands as it was parsed, its JSON written again; a newer release's line
//   waits on, for an engine that reads it; and any other line is dropped, a
//   warning saying why.
// - A read streams the file a line at a time and never waits on the lock.
//   A line it cannot read — an unterminated last line, which an append may
//   still be writing, or a line no event of this engine's schema — is
//   skipped and counted as unread, never a stop: engines of several releases
//   share the file (trust-events.cjs). An event is read once by its id,
//   however often it landed: an append that landed but failed is appended
//   again. The verdicts a project's departures are given are read from the
//   log and from what every conversation keeps waiting, so a verdict whose
//   append failed is given all the same, wherever it was given.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { systemConfigDir } = require('../kernel/system-config.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { fileLineBytes, fdLinesBackward, endsWithNewline } = require('../kernel/file-stream.cjs');
const { LOCK_TIMEOUT_MS, isObject, projectManifestPath, readProjectManifest, holdsWriterLock, withStateLockFile, withWriterLock } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { isId, newId } = require('./ledger-ids.cjs');
const { LEDGER } = require('./ledger-events.cjs');
const { idsOf } = require('./ledger-check.cjs');
const { callerModel, conversationDir, conversationsRoot } = require('./conversation.cjs');
const { MODEL, SESSION, readTrustEvent, trustEvent } = require('./trust-events.cjs');

const TRUST_LOG = 'trust.jsonl';
const PENDING = 'trust-pending.jsonl';
// The version of a kept line's own shape: what it awaits, beside its event.
const KEPT_VERSION = 1;
const NEWLINE = 0x0a;
const TRUST_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the trust log\'s lock' };
const PENDING_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on the conversation\'s waiting trust events' };

/** The trust log's file. */
function trustLogPath() {
  return path.join(systemConfigDir(), TRUST_LOG);
}

/**
 * The project's key in the trust log: the id setup wrote on its manifest.
 * Refuses a manifest that holds none.
 * @param {string} root the project's state root
 * @returns {string}
 */
function projectId(root) {
  const id = readProjectManifest(root).project_id;
  if (!isId(id)) {
    throw new Error(`the project manifest at ${projectManifestPath(root)} holds no project_id — setup gives the project one as it creates the state, and the trust log knows the project by it`);
  }
  return id;
}

/**
 * The project an event recorded from `cwd` happened in: its id, and its
 * name, the folder of its main checkout; none before the project has state.
 * @param {string} cwd
 */
function projectOf(cwd) {
  const root = findStateRoot(cwd);
  return root === null ? { project: null, project_name: null } : { project: projectId(root), project_name: path.basename(path.dirname(root)) };
}

/** Cut away a last line a writer that died mid-append left unterminated. @param {string} file */
function cutTornTail(file) {
  if (!fs.existsSync(file) || endsWithNewline(file)) return;
  const fd = fs.openSync(file, 'r+');
  try {
    for (const { span } of fdLinesBackward(fd)) {
      fs.ftruncateSync(fd, span.offset);
      break;
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Where the calling conversation keeps the events it could not append:
 * none for a command Claude Code handed no session id.
 * @param {string|null} session @returns {string|null}
 */
function pendingFile(session) {
  return session === null ? null : path.join(conversationDir(session), PENDING);
}

/** Run `fn` holding the lock on the waiting events at `pending`. @param {string} pending @param {() => void} fn */
function withPending(pending, fn) {
  withStateLockFile(`${pending}.lock`, () => {
    cutTornTail(pending);
    fn();
  }, PENDING_LOCK);
}

/** Run `fn` on the trust log's file holding its lock, a torn last line cut away. @param {(file: string) => void} fn */
function withTrustLog(fn) {
  const file = trustLogPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  withStateLockFile(`${file}.lock`, () => {
    cutTornTail(file);
    fn(file);
  }, TRUST_LOCK);
}

/** A line's JSON value, or why it has none. @param {string} text @returns {{value: unknown} | {not: string}} */
function parsedLine(text) {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { not: 'it is not JSON' };
  }
}

/**
 * What a landing from a folder knows of the ledger an event kept ahead of
 * its entry waits on: the state root, none before the project has state;
 * whether its ledger holds an entry, read the first time it is asked; and
 * whether this process holds that state's writer lock, so that no write of
 * the state is under way.
 * @typedef {{root: string|null, holds: (entry: string) => boolean, locked: boolean}} Landing
 */

/**
 * An event kept waiting ahead of its entry, as its line holds it: the line's
 * own version; what it awaits, the state root whose ledger the entry is
 * appended to and the entry; and the event. Its `event` marks it a kept
 * line, whatever its version.
 * @typedef {{v: unknown, awaits: unknown, event: unknown}} KeptAhead
 */

/** The ids of the entries on disk in the ledger of the state at `root`. @param {string} root @returns {Set<string|undefined>} */
function ledgerIds(root) {
  const file = path.join(root, LEDGER);
  return new Set(fs.existsSync(file) ? idsOf(file) : []);
}

/** A landing from `cwd`. @param {string} cwd @returns {Landing} */
function landingFrom(cwd) {
  const root = findStateRoot(cwd);
  if (root === null) return { root, holds: () => false, locked: false };
  /** @type {Set<string|undefined>|null} */
  let ids = null;
  return { root, holds: (entry) => (ids ??= ledgerIds(root)).has(entry), locked: holdsWriterLock(root) };
}

/**
 * An event kept ahead of its entry (`keepEvent`), sorted by what `landing`
 * knows of the ledger it waits on: to land once the entry is there; to
 * wait on while its write may still append it, or for a landing from that
 * ledger's project; or gone, its write found dead before it appended the
 * entry — the writer lock held, and the entry not there.
 * @param {{ledger: string, entry: string}} awaits @param {string} event the event's JSON
 * @param {string} text the line @param {Landing} landing
 * @returns {{land: string} | {wait: string} | {gone: string}}
 */
function sortAwaiting({ ledger, entry }, event, text, landing) {
  if (ledger !== landing.root) return { wait: text };
  if (landing.holds(entry)) return { land: event };
  return landing.locked ? { gone: entry } : { wait: text };
}

/**
 * An event as a waiting line holds it, sorted: one this engine reads, to
 * land as its value written again — never the read event, which carries a
 * later version's fields at their defaults — so nothing but its fields
 * lands; a newer release's, to wait on in its line `text` for an engine
 * that reads it; or why it is dropped.
 * @param {unknown} value @param {string} text
 * @returns {{land: string} | {wait: string} | {drop: string}}
 */
function sortEvent(value, text) {
  const read = readTrustEvent(value);
  if ('event' in read) return { land: JSON.stringify(value) };
  return read.later ? { wait: text } : { drop: read.not };
}

/** Whether `awaits` names a ledger and an entry, as a kept line of this version holds them. @param {unknown} awaits @returns {awaits is {ledger: string, entry: string}} */
function isAwaits(awaits) {
  return isObject(awaits) && typeof awaits.ledger === 'string' && typeof awaits.entry === 'string';
}

/**
 * A kept line, sorted: one of a version this engine does not write, to
 * wait on for an engine that reads it, never dropped; one whose awaits
 * names no ledger and entry, dropped; its event sorted as any waiting
 * event is; and one this engine reads by what `landing` knows of the
 * ledger it waits on.
 * @param {KeptAhead} kept @param {string} text the line @param {Landing} landing
 * @returns {{land: string} | {wait: string} | {drop: string} | {gone: string}}
 */
function sortKept({ v, awaits, event }, text, landing) {
  if (v !== KEPT_VERSION) return { wait: text };
  if (!isAwaits(awaits)) return { drop: `what it awaits, ${JSON.stringify(awaits)}, is no ledger and entry` };
  const sorted = sortEvent(event, text);
  return 'land' in sorted ? sortAwaiting(awaits, sorted.land, text, landing) : sorted;
}

/**
 * A line waiting in a conversation, sorted: a kept line (`sortKept`), told
 * by the event it holds, or an event; or why it is dropped. Never refuses,
 * so one bad line stops no other.
 * @param {string} text the line, without its newline @param {Landing} landing
 * @returns {{land: string} | {wait: string} | {drop: string} | {gone: string}}
 */
function sortWaiting(text, landing) {
  const parsed = parsedLine(text);
  if ('not' in parsed) return { drop: parsed.not };
  const { value } = parsed;
  return isObject(value) && Object.hasOwn(value, 'event') ? sortKept(/** @type {KeptAhead} */ (value), text, landing) : sortEvent(value, text);
}

/** Write `text` over `file` whole, renamed over it from a file beside it. @param {string} file @param {string} text */
function replaceFile(file, text) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

/**
 * Append to the trust log `file` the events waiting at `pending`, sorted by
 * `landing`, then `line`. What landed, or is gone, waits no more; what
 * waits on stays, the file left as it is where all of it does; and a
 * dropped line is a warning in `warnings` saying why. Run holding both
 * locks.
 * @param {string} file @param {string} pending @param {string[]} warnings @param {Landing} landing @param {string} line
 */
function appendAfterWaiting(file, pending, warnings, landing, line) {
  const waiting = fs.readFileSync(pending, 'utf8').split('\n').slice(0, -1);
  /** @type {string[]} */
  const landed = [];
  /** @type {string[]} */
  const later = [];
  for (const text of waiting) {
    const sorted = sortWaiting(text, landing);
    if ('land' in sorted) landed.push(`${sorted.land}\n`);
    else if ('wait' in sorted) later.push(`${sorted.wait}\n`);
    else if ('drop' in sorted) warnings.push(`a line waiting for the trust log in ${pending} was dropped: ${sorted.drop}`);
  }
  const appended = landed.join('') + line;
  if (appended !== '') fs.appendFileSync(file, appended);
  if (later.length === 0) fs.rmSync(pending, { force: true });
  else if (later.length < waiting.length) replaceFile(pending, later.join(''));
}

/**
 * Append `line` to the trust log `file`, after the events waiting at
 * `pending`, if any, sorted by `landing`. Run holding the trust lock: what
 * waits leaves only under it, so a file of waiting events gone — landed,
 * its folder tidied away, by another boot — has nothing to land.
 * @param {string} file @param {string|null} pending @param {string[]} warnings @param {Landing} landing @param {string} [line]
 */
function landWaiting(file, pending, warnings, landing, line = '') {
  if (pending !== null && fs.existsSync(pending)) withPending(pending, () => appendAfterWaiting(file, pending, warnings, landing, line));
  else if (line !== '') fs.appendFileSync(file, line);
}

/** Whether the conversation folder `dir` holds events waiting to be appended. @param {string} dir */
function holdsWaiting(dir) {
  return fs.existsSync(path.join(dir, PENDING));
}

/** The files of waiting events of every conversation that keeps some, in the order of their folders' names. @returns {string[]} */
function waitingFiles() {
  const root = conversationsRoot();
  try {
    return fs.readdirSync(root).sort().map((name) => path.join(root, name)).filter(holdsWaiting).map((dir) => path.join(dir, PENDING));
  } catch {
    return [];
  }
}

/**
 * Boot's pass before its tidy-up, run from `cwd`: append the events every
 * conversation keeps waiting, whether it runs or has ended, holding the
 * writer lock of the project's state where it has one, so those kept ahead
 * of their entry in its ledger land or go. A failure is a warning, the
 * events kept waiting.
 * @param {string} cwd @param {string[]} warnings
 */
function appendWaiting(cwd, warnings) {
  const files = waitingFiles();
  if (files.length === 0) return;
  const pass = () => withTrustLog((file) => {
    const landing = landingFrom(cwd);
    for (const pending of files) landWaiting(file, pending, warnings, landing);
  });
  const root = findStateRoot(cwd);
  try {
    if (root === null) pass();
    else withWriterLock(root, pass);
  } catch (err) {
    warnings.push(`the trust log was not written: ${messageOf(err)} — the events waiting in the conversations wait for the next record or start`);
  }
}

/**
 * Keep `line`, which could not be appended for `err`, waiting at `pending`:
 * the warning that says so, or that it is lost.
 * @param {string} line @param {string|null} pending @param {unknown} err
 * @returns {string}
 */
function keep(line, pending, err) {
  const failed = `the trust log was not written: ${messageOf(err)}`;
  if (pending === null) return `${failed} — the event is lost, with no conversation to keep it in`;
  try {
    fs.mkdirSync(path.dirname(pending), { recursive: true });
    withPending(pending, () => fs.appendFileSync(pending, line));
  } catch (kept) {
    return `${failed}, nor kept in the conversation: ${messageOf(kept)} — the event is lost`;
  }
  return `${failed} — the event waits in the conversation, appended first by its next record`;
}

/** The session id Claude Code handed the command, null where it handed none. @returns {string|null} */
function handedSession() {
  return process.env.CLAUDE_CODE_SESSION_ID || null;
}

/**
 * Event `type` as the trust log records it, built and checked, nothing
 * written: its own `fields` under the fields the engine sets — its id, the
 * time, the project `cwd` is in, and the model's and the session's ids.
 * Refuses an event its schema does not hold, and a project whose manifest
 * holds no project_id.
 * @param {string} type @param {Record<string, unknown>} fields @param {string} cwd
 * @returns {Record<string, unknown>}
 */
function newEvent(type, fields, cwd) {
  const session = handedSession();
  const model = session === null ? null : callerModel(session, cwd);
  const ids = { model: MODEL.test(model) ? model : null, session: SESSION.test(session) ? session : null };
  return trustEvent(type, { id: newId(), at: new Date().toISOString(), ...projectOf(cwd), ...ids }, fields);
}

/**
 * Keep `event`, as `newEvent` built it, waiting in the calling conversation
 * ahead of its entry `entry`, which the command appends next to the ledger
 * of the state at `ledger`: a landing lands it once the entry is there, and
 * lets it go where it finds its write died first. Refuses, keeping nothing,
 * where the file cannot be written.
 * @param {Record<string, unknown>} event @param {string} ledger @param {string} entry
 */
function keepEvent(event, ledger, entry) {
  const pending = /** @type {string} */ (pendingFile(handedSession()));
  /** @type {KeptAhead} */
  const kept = { v: KEPT_VERSION, awaits: { ledger, entry }, event };
  try {
    fs.mkdirSync(path.dirname(pending), { recursive: true });
    withPending(pending, () => fs.appendFileSync(pending, `${JSON.stringify(kept)}\n`));
  } catch (err) {
    throw new Error(`the trust log's event could not be kept in the conversation: ${messageOf(err)}`);
  }
}

/**
 * Land what the calling conversation keeps waiting, run from `cwd`: the
 * event a write kept ahead of its entry among it, once the entry is
 * appended. Never refuses: an append that fails is a warning in
 * `warnings`, the events waiting on for the conversation's next record.
 * @param {string} cwd @param {string[]} warnings
 */
function landKept(cwd, warnings) {
  try {
    withTrustLog((file) => landWaiting(file, pendingFile(handedSession()), warnings, landingFrom(cwd)));
  } catch (err) {
    warnings.push(`the trust log was not written: ${messageOf(err)} — the event waits in the conversation, appended first by its next record`);
  }
}

/**
 * Record event `type` in the trust log: built by `newEvent`, which refuses,
 * recording nothing, what it cannot build, then appended as one line after
 * any the conversation could not append before. An append that fails is a
 * warning in `warnings`, the event kept for the conversation's next record.
 * @param {string} type @param {Record<string, unknown>} fields @param {{cwd: string, warnings: string[]}} ctx
 * @returns {Record<string, unknown>} the event recorded
 */
function record(type, fields, { cwd, warnings }) {
  const event = newEvent(type, fields, cwd);
  const line = `${JSON.stringify(event)}\n`;
  const pending = pendingFile(handedSession());
  try {
    withTrustLog((file) => landWaiting(file, pending, warnings, landingFrom(cwd), line));
  } catch (err) {
    warnings.push(keep(line, pending, err));
  }
  return event;
}

/**
 * A line of the log as its event, or why this engine cannot read it.
 * @param {string} text the line, without its newline
 * @returns {{event: Record<string, unknown>} | {not: string}}
 */
function readLine(text) {
  const parsed = parsedLine(text);
  return 'not' in parsed ? parsed : readTrustEvent(parsed.value);
}

/** The lines of each of `files` there is, in turn, as bytes. @param {string[]} files @returns {Generator<Buffer>} */
function* linesOfEach(files) {
  for (const file of files) if (fs.existsSync(file)) yield* fileLineBytes(file);
}

/**
 * Read `files` through once each, in turn: `visit` is given each event this
 * engine reads, in the order written, once by its id across them all.
 * Answers how many lines it could not read.
 * @param {string[]} files @param {(event: Record<string, unknown>) => void} visit
 * @returns {{unread: number}}
 */
function readEvents(files, visit) {
  let unread = 0;
  const seen = new Set();
  for (const line of linesOfEach(files)) {
    const ended = line[line.length - 1] === NEWLINE;
    const read = ended ? readLine(line.toString('utf8', 0, line.length - 1)) : null;
    if (read === null || 'not' in read) {
      unread += 1;
    } else if (!seen.has(read.event.id)) {
      seen.add(read.event.id);
      visit(read.event);
    }
  }
  return { unread };
}

/**
 * Read the trust log through once: `visit` is given each event this engine
 * reads, in the order written, once by its id. Answers how many lines it
 * could not read.
 * @param {(event: Record<string, unknown>) => void} visit
 * @returns {{unread: number}}
 */
function readTrustLog(visit) {
  return readEvents([trustLogPath()], visit);
}

/**
 * The project's departures given a verdict (16.10.9): the entries whose
 * latest verdict event, in the trust log or waiting in any conversation
 * for it, is one — nothing, a fix later or a real loss — and not a skip,
 * which leaves a departure waiting (16.10.6). The latest is the one given
 * last, by its time, the order read breaking a tie — the log's, then each
 * conversation's — as a verdict that waited lands after the log's.
 * @param {string} root the project's state root
 * @returns {Set<string>} full entry ids
 */
function judgedDepartures(root) {
  const project = projectId(root);
  /** @type {Map<string, {at: number, verdict: unknown}>} */
  const latest = new Map();
  readEvents([trustLogPath(), ...waitingFiles()], (event) => {
    if (event.type !== 'verdict' || event.project !== project) return;
    const entry = /** @type {string} */ (event.entry);
    const at = Date.parse(/** @type {string} */ (event.at));
    if (at >= (latest.get(entry)?.at ?? -Infinity)) latest.set(entry, { at, verdict: event.verdict });
  });
  return new Set([...latest].filter(([, { verdict }]) => verdict !== 'skip').map(([entry]) => entry));
}

module.exports = { TRUST_LOG, PENDING, trustLogPath, newEvent, keepEvent, landKept, record, appendWaiting, holdsWaiting, readTrustLog, judgedDepartures };
