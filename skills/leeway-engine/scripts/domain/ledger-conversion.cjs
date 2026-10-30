'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's conversion door (5.7.3). A real break in the
// ledger's shape — a rename, a split, a change of meaning — is a migration
// writing a converted copy of the whole stream, and this is its one door.
// Only a migration passes it: the door refuses any caller but a migration's
// own file, a numbered `.cjs` in a `migrations` folder as the runner finds
// them (workflow-migrate), so no verb reaches it.
//
// Lines an earlier write left uncommitted are committed first, so every
// line the conversion rewrites is in git as it was written — where each is
// a whole line holding a JSON object with an id no earlier line holds, else
// nothing is committed or converted. The migration's converter then takes
// the ledger's events in order, each line read as JSON, and yields the
// converted copy's. The door's rule refuses unless every event comes
// through, with the same ids in the same order (ledger-check.cjs), and then
// nothing is converted. Else the copy replaces the ledger, and a pass left
// in the state worktree's git dir lets the commit carrying it through the
// append-only check, that commit alone; the parent commit keeps the
// original byte for byte. The pass is left before the copy is renamed in,
// so a kill between leaves the original standing, which the check still
// passes.
//
// The door reads the ledger in whatever shape a migration finds it, never
// the current schema's: the migrations after it convert it on. It takes no
// lock, as no migration does: they run while boot holds the writer lock.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit, gitfileTarget } = require('../kernel/isolated-git.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { fileLines } = require('../kernel/file-stream.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { LEDGER } = require('./ledger-events.cjs');
const { ledgerBlobs, idsDeparture, passFile, ledgerStopped, diskChange } = require('./ledger-check.cjs');
const { BRANCH_REF } = require('./state-worktree.cjs');
const { commitUncommitted } = require('./ledger.cjs');

const MIGRATION_FILE = /(?:^|[\\/])migrations[\\/]\d+-[^\\/]*\.cjs$/;
const TAIL_MESSAGE = 'state: the ledger as written, before its conversion';

/** @typedef {Record<string, unknown> & {id: string}} SourceEvent */

/**
 * The file of the code that called `fn`, or null where it was no file's.
 * @param {Function} fn @returns {string|null}
 */
function callerOf(fn) {
  const prepare = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, frames) => frames;
  try {
    /** @type {{stack?: NodeJS.CallSite[]}} */
    const holder = {};
    Error.captureStackTrace(holder, fn);
    return holder.stack?.[0]?.getFileName() ?? null;
  } finally {
    Error.prepareStackTrace = prepare;
  }
}

/**
 * Line `number` of the ledger as an event, in whatever shape it was written:
 * a JSON object with an id. Refuses a line that is not one.
 * @param {string} line @param {number} number
 * @returns {SourceEvent}
 */
function sourceEvent(line, number) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    event = null;
  }
  if (event === null || typeof event !== 'object' || Array.isArray(event) || typeof event.id !== 'string') {
    throw new Error(`line ${number} of the ledger is not an entry with an id — nothing converted`);
  }
  return event;
}

/**
 * The ledger's lines as events, each a JSON object with an id. Refuses a
 * line that is not one.
 * @param {string} file
 * @returns {Generator<SourceEvent>}
 */
function* eventsOf(file) {
  if (!fs.existsSync(file)) return;
  let number = 0;
  for (const line of fileLines(file)) {
    number += 1;
    yield sourceEvent(line, number);
  }
}

/**
 * Write the converted copy: `convert` takes the ledger's events and yields
 * the copy's. Answers how many it yielded.
 * @param {string} file @param {string} copy @param {(events: Iterable<SourceEvent>) => Iterable<unknown>} convert
 * @returns {number}
 */
function writeCopy(file, copy, convert) {
  let events = 0;
  const fd = fs.openSync(copy, 'w');
  try {
    for (const event of convert(eventsOf(file))) {
      fs.writeSync(fd, `${JSON.stringify(event)}\n`);
      events += 1;
    }
  } finally {
    fs.closeSync(fd);
  }
  return events;
}

/**
 * Refuse a copy that does not carry the ledger's every event through with
 * the same ids in the same order.
 * @param {string} file @param {string} copy
 */
function refuseLosses(file, copy) {
  const lost = idsDeparture(file, copy);
  if (lost === null) return;
  if (lost.is === undefined) throw new Error(`line ${lost.line} of the converted copy is not an entry with an id — nothing converted`);
  throw new Error(`the converted copy does not carry every event through with the same ids in the same order: at line ${lost.line} the ledger holds ${lost.was ?? 'no event'} and the copy ${lost.is ?? 'none'} — nothing converted`);
}

/**
 * Convert the ledger's shape: `convert` takes the ledger's events in order
 * and yields the converted copy's. Refuses any caller but a migration, a
 * ledger the append-only check stops on, and a copy that does not carry
 * every event through with the same ids in the same order — nothing
 * converted. Answers how many events came through, and the warnings of the
 * commit of lines left uncommitted.
 * @param {string} projectDir the folder a migration is run in
 * @param {(events: Iterable<SourceEvent>) => Iterable<unknown>} convert
 * @returns {{events: number, warnings: string[]}}
 */
function convertLedger(projectDir, convert) {
  const caller = callerOf(convertLedger);
  if (caller === null || !MIGRATION_FILE.test(caller)) {
    throw new Error(`only a migration converts the ledger's shape, and ${caller ?? 'this caller'} is no migration — nothing converted`);
  }
  const root = stateRoot(path.resolve(projectDir));
  const gitDir = gitfileTarget(path.join(root, '.git'));
  if (gitDir === null) throw new Error(`no state worktree at ${root} — nothing converted`);
  const tree = { git: isolatedGit(root), root, gitDir };
  const change = diskChange(tree, BRANCH_REF);
  if (change !== null) throw ledgerStopped(tree, change, 'nothing converted');

  const file = path.join(root, LEDGER);
  const { warnings } = commitUncommitted(root, TAIL_MESSAGE, sourceEvent);
  const copy = `${file}.${process.pid}.tmp`;
  try {
    const events = writeCopy(file, copy, convert);
    refuseLosses(file, copy);
    const [from] = ledgerBlobs(tree.git, [BRANCH_REF]);
    if (from !== null) {
      const to = { oid: tree.git.run(['hash-object', '-w', '--no-filters', '--', copy]).trim(), size: fs.statSync(copy).size };
      writeJsonAtomic(passFile(gitDir), { from, to });
    }
    fs.renameSync(copy, file);
    return { events, warnings };
  } finally {
    fs.rmSync(copy, { force: true });
  }
}

module.exports = { convertLedger };
