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
//   (ledger-events). A line a newer release wrote stops the engine.
// - An entry is appended under the writer lock, its id, version and time
//   the engine's own, the time taken under the lock so the lines' order is
//   their times': the ledger is checked, then copied beside itself with the
//   line added and renamed over, so a read meets the ledger before the
//   append or after it, never half a line (5.4.6). Nothing is ever edited
//   (5.3.4).
// - Every stop on the ledger is kept for its screen (`render ledger-stop`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit, gitfileTarget } = require('../kernel/isolated-git.cjs');
const { fileLines, endsWithNewline } = require('../kernel/file-stream.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { isoNow } = require('./dates.cjs');
const { LEDGER, LEDGER_VERSION, LedgerNewer, parseEntry, validEvent } = require('./ledger-events.cjs');
const { newId, shortId } = require('./ledger-ids.cjs');
const { idsOf, keepStop, keptStop, ledgerStopped, diskChange } = require('./ledger-check.cjs');
const { STATE_BRANCH, BRANCH_REF, openWorktree, withStateLock } = require('./state-worktree.cjs');
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

/**
 * The ledger's entries in order, checked first, each line read as an event
 * of the shape its version names. Refuses a line that is not one.
 * @param {string} root @param {string[]} notes what a landing the check finished said, pushed to
 * @returns {Generator<Record<string, unknown>>}
 */
function* readLedger(root, notes) {
  checkLedger(root, notes);
  const file = ledgerFile(root);
  if (!fs.existsSync(file)) return;
  let number = 0;
  for (const line of fileLines(file)) yield entryAt(root, line, ++number);
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
 * Append one entry: `fields` are its event, tags and own fields, and the
 * engine gives it its version, id and time. Under the writer lock, the
 * ledger checked first. Refuses an entry that is not an event of the
 * current shape, one naming a field the engine assigns, and a ledger whose
 * last line is unfinished. Answers the entry as written.
 * @param {string} root @param {Record<string, unknown>} fields
 * @param {string[]} notes what a landing the check finished said, pushed to
 * @returns {Record<string, unknown>}
 */
function appendEntry(root, fields, notes) {
  const assigned = ASSIGNED.find((name) => Object.hasOwn(fields, name));
  if (assigned !== undefined) throw new Error(`a ledger entry's ${assigned} is the engine's to give — nothing appended`);
  return withStateLock(root, () => {
    checkLedger(root, notes);
    const file = ledgerFile(root);
    if (fs.existsSync(file) && !endsWithNewline(file)) throw new Error(`${file} ends in an unfinished line — nothing appended`);
    const entry = validEvent({ ...fields, v: LEDGER_VERSION, id: newId(), at: isoNow() });
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

module.exports = { ledgerFile, ledgerChange, checkLedger, readLedger, appendEntry, ledgerStopSurface };
