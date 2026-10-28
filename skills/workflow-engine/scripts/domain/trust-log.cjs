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
//   before its tidy-up, which leaves a folder still holding some
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
//   again.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { systemConfigDir } = require('../kernel/system-config.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { fileLineBytes, fdLinesBackward, endsWithNewline } = require('../kernel/file-stream.cjs');
const { LOCK_TIMEOUT_MS, projectManifestPath, readProjectManifest, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { isId, newId } = require('./ledger-ids.cjs');
const { callerModel, conversationDir, conversationsRoot } = require('./conversation.cjs');
const { MODEL, SESSION, readTrustEvent, trustEvent } = require('./trust-events.cjs');

const TRUST_LOG = 'trust.jsonl';
const PENDING = 'trust-pending.jsonl';
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
 * A line waiting in a conversation, sorted: an event this engine reads, to
 * land as its value written again — never the read event, which carries a
 * later version's fields at their defaults — so nothing but its fields
 * lands; a newer release's line, to wait on for an engine that reads it; or
 * why it is dropped.
 * @param {string} text the line, without its newline
 * @returns {{land: string} | {wait: string} | {drop: string}}
 */
function sortWaiting(text) {
  const parsed = parsedLine(text);
  if ('not' in parsed) return { drop: parsed.not };
  const read = readTrustEvent(parsed.value);
  if ('event' in read) return { land: JSON.stringify(parsed.value) };
  return read.later ? { wait: text } : { drop: read.not };
}

/** Write `text` over `file` whole, renamed over it from a file beside it. @param {string} file @param {string} text */
function replaceFile(file, text) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

/**
 * Append to the trust log `file` the events waiting at `pending`, then
 * `line`. What landed waits no more, a newer release's line waits on, and a
 * dropped line is a warning in `warnings` saying why. Run holding both
 * locks.
 * @param {string} file @param {string} pending @param {string[]} warnings @param {string} line
 */
function appendAfterWaiting(file, pending, warnings, line) {
  /** @type {string[]} */
  const landing = [];
  /** @type {string[]} */
  const later = [];
  for (const sorted of fs.readFileSync(pending, 'utf8').split('\n').slice(0, -1).map(sortWaiting)) {
    if ('land' in sorted) landing.push(`${sorted.land}\n`);
    else if ('wait' in sorted) later.push(`${sorted.wait}\n`);
    else warnings.push(`a line waiting for the trust log in ${pending} was dropped: ${sorted.drop}`);
  }
  fs.appendFileSync(file, landing.join('') + line);
  if (later.length === 0) fs.rmSync(pending, { force: true });
  else replaceFile(pending, later.join(''));
}

/**
 * Append `line` to the trust log `file`, after the events waiting at
 * `pending`, if any. Run holding the trust lock: what waits leaves only
 * under it, so a file of waiting events gone — landed, its folder tidied
 * away, by another boot — has nothing to land.
 * @param {string} file @param {string|null} pending @param {string[]} warnings @param {string} [line]
 */
function landWaiting(file, pending, warnings, line = '') {
  if (pending !== null && fs.existsSync(pending)) withPending(pending, () => appendAfterWaiting(file, pending, warnings, line));
  else if (line !== '') fs.appendFileSync(file, line);
}

/** Whether the conversation folder `dir` holds events waiting to be appended. @param {string} dir */
function holdsWaiting(dir) {
  return fs.existsSync(path.join(dir, PENDING));
}

/**
 * Boot's pass before its tidy-up: append the events every conversation
 * keeps waiting, whether it runs or has ended. A failure is a warning, the
 * events kept waiting.
 * @param {string[]} warnings
 */
function appendWaiting(warnings) {
  const root = conversationsRoot();
  let folders;
  try {
    folders = fs.readdirSync(root).map((name) => path.join(root, name)).filter(holdsWaiting);
  } catch {
    return;
  }
  if (folders.length === 0) return;
  try {
    withTrustLog((file) => {
      for (const dir of folders) landWaiting(file, path.join(dir, PENDING), warnings);
    });
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

/**
 * Record event `type` in the trust log: its own `fields` under the fields
 * the engine sets — its id, the time, the project `cwd` is in, and the
 * model's and the session's ids — appended as one line, after any the
 * conversation could not append before. An append that fails is a warning
 * in `warnings`, the event kept for the conversation's next record. Refuses,
 * recording nothing, an event its schema does not hold, and a project whose
 * manifest holds no project_id.
 * @param {string} type @param {Record<string, unknown>} fields @param {{cwd: string, warnings: string[]}} ctx
 * @returns {Record<string, unknown>} the event recorded
 */
function record(type, fields, { cwd, warnings }) {
  const session = process.env.CLAUDE_CODE_SESSION_ID || null;
  const model = session === null ? null : callerModel(session, cwd);
  const ids = { model: MODEL.test(model) ? model : null, session: SESSION.test(session) ? session : null };
  const event = trustEvent(type, { id: newId(), at: new Date().toISOString(), ...projectOf(cwd), ...ids }, fields);
  const line = `${JSON.stringify(event)}\n`;
  const pending = pendingFile(session);
  try {
    withTrustLog((file) => landWaiting(file, pending, warnings, line));
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

/**
 * Read the trust log through once: `visit` is given each event this engine
 * reads, in the order written, once by its id. Answers how many lines it
 * could not read.
 * @param {(event: Record<string, unknown>) => void} visit
 * @returns {{unread: number}}
 */
function readTrustLog(visit) {
  const file = trustLogPath();
  let unread = 0;
  if (!fs.existsSync(file)) return { unread };
  const seen = new Set();
  for (const line of fileLineBytes(file)) {
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
 * The project's departures the trust log holds a verdict on (16.10.9): the
 * entries whose latest verdict event is one — nothing, a fix later or a
 * real loss — and not a skip, which leaves a departure waiting (16.10.6).
 * The latest is the one given last, by its time, the log's order breaking
 * a tie: a verdict that waited in its conversation lands after ones given
 * later.
 * @param {string} root the project's state root
 * @returns {Set<string>} full entry ids
 */
function judgedDepartures(root) {
  const project = projectId(root);
  /** @type {Map<string, {at: number, verdict: unknown}>} */
  const latest = new Map();
  readTrustLog((event) => {
    if (event.type !== 'verdict' || event.project !== project) return;
    const entry = /** @type {string} */ (event.entry);
    const at = Date.parse(/** @type {string} */ (event.at));
    if (at >= (latest.get(entry)?.at ?? -Infinity)) latest.set(entry, { at, verdict: event.verdict });
  });
  return new Set([...latest].filter(([, { verdict }]) => verdict !== 'skip').map(([entry]) => entry));
}

module.exports = { TRUST_LOG, PENDING, trustLogPath, record, appendWaiting, holdsWaiting, readTrustLog, judgedDepartures };
