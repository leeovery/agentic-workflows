'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's conversion door (5.7.3). A real break in the
// ledger's shape — a rename, a split, a change of meaning — is a migration
// writing a converted copy of the whole stream, and this is its one door.
// Only a migration passes it: the door refuses any caller but a migration's
// own file, a numbered `.cjs` in a `migrations` folder as the runner finds
// them (workflow-migrate), so no verb reaches it.
//
// The migration's converter takes the ledger's events in order, each line
// read as JSON, and yields the converted copy's. The door's check refuses
// unless every event comes through, with the same ids in the same order,
// and then nothing is changed. Else the copy replaces the ledger, and a pass
// left in the state worktree's git dir lets the commit carrying it through
// the append-only check, that commit alone (ledger-check.cjs); the parent
// commit keeps the original byte for byte. The pass is left before the copy
// is renamed in, so a kill between leaves the original standing, which the
// check still passes.
//
// The door reads the ledger in whatever shape a migration finds it, never
// the current schema's: the migrations after it convert it on. It takes no
// lock, as no migration does: they run while boot holds the writer lock.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit, gitfileTarget } = require('../kernel/isolated-git.cjs');
const { fileLines } = require('../kernel/file-stream.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { LEDGER } = require('./ledger-events.cjs');
const { LedgerChanged, ledgerBlobs, diskChange, writePass } = require('./ledger-check.cjs');
const { BRANCH_REF } = require('./state-worktree.cjs');

const MIGRATION_FILE = /(?:^|[\\/])migrations[\\/]\d+-[^\\/]*\.cjs$/;

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
 * The lines of `file` as events, each a JSON object with an id. Refuses a
 * line that is not one, naming `whose` file it is in.
 * @param {string} file @param {string} whose
 * @returns {Generator<SourceEvent>}
 */
function* eventsOf(file, whose) {
  if (!fs.existsSync(file)) return;
  let number = 0;
  for (const line of fileLines(file)) {
    number += 1;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      event = null;
    }
    if (event === null || typeof event !== 'object' || Array.isArray(event) || typeof event.id !== 'string') {
      throw new Error(`line ${number} of ${whose} is not an entry with an id — nothing converted`);
    }
    yield event;
  }
}

/**
 * Where the converted copy first fails to carry the ledger's events through
 * with the same ids in the same order — the line, and the id each holds
 * there, null where it holds none — or null where it carries them all.
 * @param {string} ledger @param {string} copy
 * @returns {{line: number, was: string|null, is: string|null}|null}
 */
function departure(ledger, copy) {
  const was = eventsOf(ledger, 'the ledger');
  const is = eventsOf(copy, 'the converted copy');
  for (let line = 1; ; line += 1) {
    const a = was.next();
    const b = is.next();
    if (a.done && b.done) return null;
    if (a.done || b.done || a.value.id !== b.value.id) return { line, was: a.done ? null : a.value.id, is: b.done ? null : b.value.id };
  }
}

/**
 * Convert the ledger's shape: `convert` takes the ledger's events in order
 * and yields the converted copy's. Refuses any caller but a migration, a
 * ledger the append-only check stops on, and a copy that does not carry
 * every event through with the same ids in the same order — nothing changed.
 * Answers how many events came through.
 * @param {string} projectDir the folder a migration is run in
 * @param {(events: Iterable<SourceEvent>) => Iterable<unknown>} convert
 * @returns {{events: number}}
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
  if (change !== null) throw new LedgerChanged(change, 'nothing converted');

  const file = path.join(root, LEDGER);
  const copy = `${file}.${process.pid}.tmp`;
  try {
    let events = 0;
    const fd = fs.openSync(copy, 'w');
    try {
      for (const event of convert(eventsOf(file, 'the ledger'))) {
        fs.writeSync(fd, `${JSON.stringify(event)}\n`);
        events += 1;
      }
    } finally {
      fs.closeSync(fd);
    }
    const lost = departure(file, copy);
    if (lost !== null) {
      throw new Error(`the converted copy does not carry every event through with the same ids in the same order: at line ${lost.line} the ledger holds ${lost.was ?? 'no event'} and the copy ${lost.is ?? 'none'} — nothing converted`);
    }
    const [from] = ledgerBlobs(tree.git, [BRANCH_REF]);
    if (from !== null) {
      const to = { oid: tree.git.run(['hash-object', '-w', '--no-filters', '--', copy]).trim(), size: fs.statSync(copy).size };
      writePass(gitDir, { from, to });
    }
    fs.renameSync(copy, file);
    return { events };
  } finally {
    fs.rmSync(copy, { force: true });
  }
}

module.exports = { convertLedger };
