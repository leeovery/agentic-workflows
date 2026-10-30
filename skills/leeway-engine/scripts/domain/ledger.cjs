'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's data layer (§5) — the project's stream of
// events, `.ledger.jsonl` at the state root, written by the engine alone.
//
// - Every read is checked first (5.4.3): the ledger on disk must start, byte
//   for byte, with the one the state branch last committed (ledger-check).
//   The branch is read before the file, so an append committed meanwhile
//   never reads as a change. A catch-up's landing rewrites the file before
//   it moves the branch, so a check that fails is made again under the
//   writer lock, which the landing holds, once a landing a kill cut short is
//   finished (state-merge-landing.cjs), before the engine stops. What that
//   landing says on the way is handed to the reader or the appender, even
//   where the engine then stops.
// - The ledger is read a line at a time, never whole and never through a
//   pipe (kernel/file-stream), each line validated against the shape its
//   version names, a field a later version added taking its default
//   (ledger-events), and its id held by no earlier line: a line that is no
//   entry, or repeats an id, is refused, naming it — and the line holding
//   the id first — so every read stops on it (5.4.4), and every write,
//   which reads the ledger under the lock before it appends. A line a
//   newer release wrote stops the engine. A read that shows entries keeps
//   where each line sits and reads the ones it shows again, from the file
//   it opened.
// - An entry is appended under the writer lock, its id, version and time
//   the engine's own, the time taken under the lock so the lines' order is
//   their times': the ledger is checked, then copied beside itself with the
//   line added and renamed over, so a read meets the ledger before the
//   append or after it, never half a line (5.4.6). Nothing is ever edited
//   (5.3.4).
// - Entries a write appended and a kill, or a commit git refused, left
//   uncommitted are committed whole by the next commit of the ledger: a
//   write's, or boot's before its catch-up (4.7.8). Boot counts them past
//   the ledger the branch holds once a landing a kill cut short is
//   finished, since that landing rewrote the file first, and commits them
//   only where each is a whole line a read takes, by the same rule: a line
//   written outside the engine, committed, would stop every read and write
//   on every clone. Else it commits nothing and says which line it found.
// - Every stop on the ledger is kept for its screen (`render ledger-stop`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit, gitfileTarget } = require('../kernel/isolated-git.cjs');
const { fdLines, lineAt, endsWithNewline } = require('../kernel/file-stream.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { isoNow } = require('./dates.cjs');
const { LEDGER, LEDGER_VERSION, LedgerLineError, LedgerNewer, parseEntry, validEvent } = require('./ledger-events.cjs');
const { newId, shortId } = require('./ledger-ids.cjs');
const { idOf, idsOf, keepStop, keptStop, ledgerStopped, diskChange, ledgerBlobs, fileStartsWith } = require('./ledger-check.cjs');
const { STATE_BRANCH, BRANCH_REF, openWorktree, withStateLock, commitHere } = require('./state-worktree.cjs');
const { finishLanding } = require('./state-merge-landing.cjs');
const { projectName } = require('./state-checks.cjs');
const { ledgerStop, ledgerNewerStop, idInLine } = require('./projections/ledger.cjs');

/** The fields the engine assigns an entry, never its caller. */
const ASSIGNED = ['v', 'id', 'at'];

/** @param {string} root */
function ledgerFile(root) {
  return path.join(root, LEDGER);
}

/**
 * What the check reads in the state worktree at `root`.
 * @param {string} root
 * @returns {import('./ledger-check.cjs').CheckedTree}
 */
function checkedTree(root) {
  const gitDir = gitfileTarget(path.join(root, '.git'));
  if (gitDir === null) throw new Error(`no state worktree at ${root}`);
  return { git: isolatedGit(root), root, gitDir };
}

/**
 * The first line of the ledger on disk not as the state branch last
 * committed it, or null where the ledger is as committed and grew only at
 * its end. Takes no lock.
 * @param {string} root
 * @returns {import('./ledger-check.cjs').LedgerChange|null}
 */
function ledgerChange(root) {
  return diskChange(checkedTree(root), BRANCH_REF);
}

/**
 * Stop where the ledger changed other than at its end: checked, and where
 * that fails checked again under the writer lock, a landing a kill cut short
 * finished first; then refused with the line found, the stop kept.
 * @param {string} root
 * @param {string[]} notes what a landing finished here said, pushed to before any stop
 */
function checkLedger(root, notes) {
  if (ledgerChange(root) === null) return;
  withStateLock(root, () => {
    const worktree = openWorktree(root);
    if (worktree.opened) notes.push(...finishLanding(worktree, STATE_BRANCH));
    const change = ledgerChange(root);
    if (change !== null) throw ledgerStopped(checkedTree(root), change, 'the engine stops here');
  });
}

/** A line read as an entry, refused where it is none. @typedef {(line: string, number: number) => {id?: unknown}} EntryReader */

/**
 * The ids a read of the ledger meets, line by line: one an earlier line
 * holds is refused, naming both lines (5.4.4).
 * @returns {(id: unknown, number: number) => void}
 */
function eachIdOnce() {
  /** @type {Map<unknown, number>} */
  const lines = new Map();
  return (id, number) => {
    const first = lines.get(id);
    if (first !== undefined) throw new LedgerLineError(`line ${number} of the ledger repeats the id ${id}, which line ${first} holds`);
    lines.set(id, number);
  };
}

/**
 * How many entries the ledger holds past the one the state branch last
 * committed, where it starts with that one, each line read by `read`.
 * Refuses, naming the line, one `read` refuses, an id an earlier line
 * holds, and a last line with no newline. Takes no lock.
 * @param {string} root @param {EntryReader} read
 */
function uncommittedEntries(root, read) {
  const [committed] = ledgerBlobs(checkedTree(root).git, [BRANCH_REF]);
  const file = ledgerFile(root);
  const from = committed?.size ?? 0;
  if (!fs.existsSync(file) || fs.statSync(file).size <= from || !fileStartsWith(file, committed)) return 0;
  const once = eachIdOnce();
  let [number, entries] = [0, 0];
  const fd = fs.openSync(file, 'r');
  try {
    for (const { text, span } of fdLines(fd)) {
      number += 1;
      const tail = span.offset >= from;
      const id = tail ? read(text, number).id : idOf(text);
      if (id !== undefined) once(id, number);
      if (tail) entries += 1;
    }
  } finally {
    fs.closeSync(fd);
  }
  if (!endsWithNewline(file)) throw new Error(`line ${number} of the ledger is unfinished: it has no newline`);
  return entries;
}

/**
 * Commit the entries past the committed ledger, pushing nothing, each line
 * read by `read` — today's schema unless given: how many, and what the
 * commit and a landing it finished said. Commits nothing where a line is
 * refused, refusing it. The caller holds the writer lock.
 * @param {string} root @param {string} message @param {EntryReader} [read]
 * @returns {{entries: number, warnings: string[]}}
 */
function commitUncommitted(root, message, read = parseEntry) {
  if (uncommittedEntries(root, read) === 0) return { entries: 0, warnings: [] };
  const worktree = openWorktree(root);
  const warnings = worktree.opened ? finishLanding(worktree, STATE_BRANCH) : [];
  const entries = uncommittedEntries(root, read);
  if (entries > 0) warnings.push(...commitHere(root, [LEDGER], message).warnings);
  return { entries, warnings };
}

/**
 * Line `number` read as an entry; a newer release's line stops the engine,
 * the stop kept.
 * @param {string} root @param {string} line @param {number} number
 * @returns {Record<string, unknown>}
 */
function entryAt(root, line, number) {
  try {
    return parseEntry(line, number);
  } catch (err) {
    if (err instanceof LedgerNewer) keepStop(checkedTree(root).gitDir, { stop: 'newer', version: err.version, reads: err.reads });
    throw err;
  }
}

/** Where an entry's line sits: its number, from 1, and its span. @typedef {{number: number} & import('../kernel/file-stream.cjs').LineSpan} EntryPlace */

/**
 * The ledger checked, then opened for reading: its file descriptor, or null
 * where there is no ledger yet.
 * @param {string} root @param {string[]} notes what a landing the check finished said, pushed to
 * @returns {number|null}
 */
function openChecked(root, notes) {
  checkLedger(root, notes);
  try {
    return fs.openSync(ledgerFile(root), 'r');
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * The entries of the ledger open at `fd`, in order, each with where its line
 * sits. Refuses a line that is no entry, or that repeats an id.
 * @param {string} root @param {number} fd
 * @returns {Generator<{event: Record<string, unknown>, place: EntryPlace}>}
 */
function* entriesAt(root, fd) {
  const once = eachIdOnce();
  let number = 0;
  for (const { text, span } of fdLines(fd)) {
    number += 1;
    const event = entryAt(root, text, number);
    once(event.id, number);
    yield { event, place: { number, ...span } };
  }
}

/**
 * The ledger as `withLedger` hands it over: its entries in order, each with
 * where its line sits, and the entry at any place read again.
 * @typedef {{
 *   entries: () => Generator<{event: Record<string, unknown>, place: EntryPlace}>,
 *   entryAt: (place: EntryPlace) => Record<string, unknown>,
 * }} OpenLedger
 */

/** @type {OpenLedger} */
const NO_LEDGER = Object.freeze({
  * entries() {},
  entryAt: () => {
    throw new Error(`there is no ${LEDGER} to read an entry from`);
  },
});

/**
 * `read` given the ledger opened once, checked first: its entries in order,
 * each line read as an event of the shape its version names, and the entry
 * at any place read again — both from the one file opened, so an append or
 * a landing, each renaming a new file in, never shows mid-read.
 * @template T
 * @param {string} root @param {string[]} notes what a landing the check finished said, pushed to
 * @param {(ledger: OpenLedger) => T} read
 * @returns {T}
 */
function withLedger(root, notes, read) {
  const fd = openChecked(root, notes);
  if (fd === null) return read(NO_LEDGER);
  try {
    return read({
      entries: () => entriesAt(root, fd),
      entryAt: (place) => entryAt(root, lineAt(fd, place), place.number),
    });
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * The ledger copied beside itself with `line` added, then renamed over it:
 * the copy cloned where the file system can, flushed before it is renamed
 * in. A copy a killed append left is the lock holder's to clear.
 * @param {string} file @param {string} line
 */
function appendLine(file, line) {
  const prefix = `${path.basename(file)}.`;
  for (const name of fs.readdirSync(path.dirname(file))) {
    if (name.startsWith(prefix) && name.endsWith('.tmp')) fs.rmSync(path.join(path.dirname(file), name), { force: true });
  }
  const tmp = `${file}.${process.pid}.tmp`;
  if (fs.existsSync(file)) fs.copyFileSync(file, tmp, fs.constants.COPYFILE_FICLONE);
  const fd = fs.openSync(tmp, 'a');
  try {
    fs.writeSync(fd, line);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/**
 * Every line of the ledger read as a read takes it, the first it refuses
 * refused (5.4.4): for a writer that read the ledger before taking the
 * lock, so a line written outside the engine meanwhile is never committed
 * with its own.
 * @param {string} root
 * @param {string[]} notes what a landing the check finished said, pushed to
 */
function checkLines(root, notes) {
  withLedger(root, notes, (ledger) => {
    const lines = ledger.entries();
    while (!lines.next().done);
  });
}

/**
 * Append one entry: `fields` are its event, tags and own fields, and the
 * engine gives it its version, id and time. Under the writer lock, the
 * ledger checked first. Refuses an entry that is not an event of the
 * current shape, one naming a field the engine assigns, and a ledger whose
 * last line is unfinished. Answers the entry as written.
 * @param {string} root @param {Record<string, unknown>} fields
 * @param {string[]} notes what a landing the check finished said, pushed to
 * @param {string} [id] the entry's id, minted by the writer where it names
 * the entry before the line is written
 * @returns {Record<string, unknown>}
 */
function appendEntry(root, fields, notes, id = newId()) {
  const assigned = ASSIGNED.find((name) => Object.hasOwn(fields, name));
  if (assigned !== undefined) throw new Error(`a ledger entry's ${assigned} is the engine's to give — nothing appended`);
  return withStateLock(root, () => {
    checkLedger(root, notes);
    const file = ledgerFile(root);
    if (fs.existsSync(file) && !endsWithNewline(file)) throw new Error(`${file} ends in an unfinished line — nothing appended`);
    const entry = validEvent({ ...fields, v: LEDGER_VERSION, id, at: isoNow() });
    appendLine(file, `${JSON.stringify(entry)}\n`);
    return entry;
  });
}

/** The ids of the ledger's entries on disk, a line at a time. @param {string} root @returns {Generator<string>} */
function* entryIds(root) {
  const file = ledgerFile(root);
  if (!fs.existsSync(file)) return;
  for (const id of idsOf(file)) if (id !== undefined) yield id;
}

/**
 * The short form of the id a line found holds, among the ledger's ids on
 * disk, or null where the line shows none.
 * @param {string} root @param {string|null} found
 * @returns {string|null}
 */
function shortIdOf(root, found) {
  const id = found === null ? null : idInLine(found);
  return id === null ? null : shortId(id, entryIds(root));
}

/**
 * A refusal carrying, beside its own payload, what a landing finished on the
 * way said.
 * @param {unknown} err @param {string[]} notes
 * @returns {unknown}
 */
function carrying(err, notes) {
  if (notes.length === 0 || !(err instanceof Error)) return err;
  const { payload } = /** @type {Error & {payload?: object}} */ (err);
  return Object.assign(err, { payload: { ...payload, warnings: notes } });
}

/**
 * `render ledger-stop`: the screen of the engine's last stop on the ledger,
 * as the stop found it.
 * @param {string} cwd @param {object} _args
 * @returns {string}
 */
function ledgerStopSurface(cwd, _args) {
  const root = stateRoot(cwd);
  const stop = keptStop(checkedTree(root).gitDir);
  if (stop === null) throw new Error('render ledger-stop: no stop on the ledger is kept — nothing stopped the engine');
  if (stop.stop === 'newer') return ledgerNewerStop(projectName(cwd), stop);
  return ledgerStop(projectName(cwd), stop, shortIdOf(root, stop.found));
}

module.exports = { ledgerFile, checkLedger, checkLines, commitUncommitted, withLedger, appendEntry, carrying, ledgerStopSurface };
