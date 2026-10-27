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
//   writer lock, which the landing holds, before the engine stops.
// - The ledger is read a line at a time, never whole and never through a
//   pipe (kernel/file-stream), each line validated against its event's
//   schema, a field a later release added taking its default
//   (ledger-events).
// - An entry is appended under the writer lock, its id, version and time
//   the engine's own: the ledger is checked, then copied beside itself with
//   the line added and renamed over, so a read meets the ledger before the
//   append or after it, never half a line (5.4.6). Nothing is ever edited
//   (5.3.4).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit, gitfileTarget } = require('../kernel/isolated-git.cjs');
const { fileLines, endsWithNewline } = require('../kernel/file-stream.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { isoNow } = require('./dates.cjs');
const { LEDGER, LEDGER_VERSION, parseEntry, validEvent } = require('./ledger-events.cjs');
const { newId } = require('./ledger-ids.cjs');
const { LedgerChanged, diskChange } = require('./ledger-check.cjs');
const { BRANCH_REF, withStateLock } = require('./state-worktree.cjs');
const { projectName } = require('./state-checks.cjs');
const { ledgerStop } = require('./projections/ledger.cjs');

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
 * its end. Takes no lock: what a stop's screen shows.
 * @param {string} root
 * @returns {import('./ledger-check.cjs').LedgerChange|null}
 */
function ledgerChange(root) {
  return diskChange(checkedTree(root), BRANCH_REF);
}

/**
 * Stop where the ledger changed other than at its end: checked, and where
 * that fails checked again under the writer lock, then refused with the
 * line found.
 * @param {string} root
 */
function checkLedger(root) {
  if (ledgerChange(root) === null) return;
  withStateLock(root, () => {
    const change = ledgerChange(root);
    if (change !== null) throw new LedgerChanged(change, 'the engine stops here');
  });
}

/**
 * The ledger's entries in order, checked first, each line read as an event
 * of the current shape. Refuses a line that is not one.
 * @param {string} root
 * @returns {Generator<Record<string, unknown>>}
 */
function* readLedger(root) {
  checkLedger(root);
  const file = ledgerFile(root);
  if (!fs.existsSync(file)) return;
  let number = 0;
  for (const line of fileLines(file)) yield parseEntry(line, ++number);
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
 * @returns {Record<string, unknown>}
 */
function appendEntry(root, fields) {
  const assigned = ASSIGNED.find((name) => Object.hasOwn(fields, name));
  if (assigned !== undefined) throw new Error(`a ledger entry's ${assigned} is the engine's to give — nothing appended`);
  const entry = validEvent({ ...fields, v: LEDGER_VERSION, id: newId(), at: isoNow() });
  return withStateLock(root, () => {
    checkLedger(root);
    const file = ledgerFile(root);
    if (fs.existsSync(file) && !endsWithNewline(file)) throw new Error(`${file} ends in an unfinished line — nothing appended`);
    appendLine(file, `${JSON.stringify(entry)}\n`);
    return entry;
  });
}

/**
 * `render ledger-stop`: the screen of the engine stopped by a ledger
 * changed other than at its end.
 * @param {string} cwd @param {object} _args
 * @returns {string}
 */
function ledgerStopSurface(cwd, _args) {
  const change = ledgerChange(stateRoot(cwd));
  if (change === null) throw new Error('render ledger-stop: the ledger is as the state branch committed it, grown only at its end — nothing stopped the engine');
  return ledgerStop(projectName(cwd), change);
}

module.exports = { ledgerFile, ledgerChange, checkLedger, readLedger, appendEntry, ledgerStopSurface };
