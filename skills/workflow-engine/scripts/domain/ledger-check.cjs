'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's append-only check (5.4). The ledger only grows
// at its end: the ledger on disk must start, byte for byte, with the one the
// state branch last committed (5.4.3), and each state commit's with its
// parent's (5.4.5).
//
// - Hashed, never extracted: a file's first n bytes, n the committed blob's
//   size, hashed as git names a blob in the repository's object format
//   (kernel/file-stream), against the committed blob's id. A blob is written
//   out of git only to find the line a failed check shows, to test a
//   conversion's pass, or where the blob a commit holds is not the file on
//   disk; the file is read a chunk at a time, and nothing comes through a
//   pipe. A blob written out goes to the git dir under the reading process's
//   id; one a killed process left is cleared by the next.
// - The one change it lets through is a migration's conversion of the
//   ledger's shape (5.4.8, 5.7.3). The conversion leaves a pass in the
//   state worktree's git dir, off the branch, naming the committed ledger it
//   converted and the converted copy (ledger-conversion.cjs). While the
//   committed ledger is the one converted, the ledger may start with the
//   converted copy instead, and the commit carrying it spends the pass. A
//   pass is honoured only where the copy holds the converted ledger's every
//   event, with the same ids in the same order — the door's own rule — so a
//   pass written by hand lifts no other change.
// - A check that fails names the first line not as committed, and the line
//   found there. The engine stops on it (5.4.4), and the stop is kept in the
//   git dir for its screen, as the check found it: a merge's check finds the
//   line in the tree it was to commit, never on disk.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { processAlive } = require('../kernel/process.cjs');
const { blobIds, blobToFile, fileLineBytes, fileLines } = require('../kernel/file-stream.cjs');
const { LEDGER } = require('./ledger-events.cjs');
const { readRecord } = require('./state-merge-landing.cjs');

const PASS = 'leeway-ledger-conversion.json';
const KEPT_STOP = 'leeway-ledger-stop.json';
const SCRATCH = /^leeway-ledger\.(\d+)\./;

/** A committed ledger: its blob's id and size. @typedef {{oid: string, size: number}} LedgerBlob */

/**
 * The first line not as committed, and the line found there: null where the
 * ledger ends before it.
 * @typedef {{line: number, found: string|null}} LedgerChange
 */

/**
 * A conversion's pass: the committed ledger converted, null where there was
 * none, and the converted copy.
 * @typedef {{from: LedgerBlob|null, to: LedgerBlob}} ConversionPass
 */

/**
 * What stopped the engine, kept for its screen: a line not as committed, or
 * a line a newer release wrote, with its version and the one the engine
 * reads.
 * @typedef {({stop: 'changed'} & LedgerChange) | {stop: 'newer', version: number, reads: number}} KeptStop
 */

/**
 * What the check reads in the state worktree: a runner bound to it, its
 * root, and its git dir.
 * @typedef {{git: import('../kernel/isolated-git.cjs').IsolatedGit, root: string, gitDir: string}} CheckedTree
 */

/** The ledger changed other than at its end: the engine stops, showing the line (`render ledger-stop`). */
class LedgerChanged extends Error {
  /** @param {LedgerChange} change @param {string} outcome */
  constructor(change, outcome) {
    const at = change.line.toLocaleString('en-US');
    super(change.found === null
      ? `${LEDGER} changed outside the engine: it ends before line ${at}, which was committed — ${outcome}`
      : `${LEDGER} changed outside the engine: line ${at} is not the line committed there — ${outcome}`);
    this.change = change;
    this.payload = { stop: 'ledger' };
  }
}

/** The object format a blob's id is in, told by its length. @param {string} oid */
function formatOf(oid) {
  return oid.length === 64 ? 'sha256' : 'sha1';
}

/** @param {LedgerBlob|null} a @param {LedgerBlob|null} b */
function sameBlob(a, b) {
  return a === null || b === null ? a === b : a.oid === b.oid && a.size === b.size;
}

/** @param {any} value @returns {value is LedgerBlob} */
function isBlob(value) {
  return value !== null && typeof value === 'object' && typeof value.oid === 'string' && Number.isInteger(value.size);
}

/**
 * The blob each of `objects` names, null where one names none. One git call,
 * whatever the blobs' size.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string[]} objects
 * @returns {(LedgerBlob|null)[]}
 */
function blobsOf(git, objects) {
  const out = git.run(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { input: objects.map((name) => `${name}\n`).join('') });
  return out.split('\n').filter((line) => line !== '').map((line) => {
    const [oid, kind, size] = line.split(' ');
    return kind === 'blob' ? { oid, size: Number(size) } : null;
  });
}

/**
 * The ledger each of `revs` holds — a commit's or a tree's — null where one
 * holds none.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string[]} revs
 * @returns {(LedgerBlob|null)[]}
 */
function ledgerBlobs(git, revs) {
  return blobsOf(git, revs.map((rev) => `${rev}:${LEDGER}`));
}

/** Whether `file` starts byte for byte with `blob`; nothing starts with no ledger. @param {string} file @param {LedgerBlob|null} blob */
function fileStartsWith(file, blob) {
  if (blob === null || blob.size === 0) return true;
  return fs.existsSync(file) && blobIds(file, [blob.size], formatOf(blob.oid))[0] === blob.oid;
}

/** Clear the blobs processes no longer running wrote out to the git dir. @param {string} gitDir */
function sweepScratch(gitDir) {
  for (const name of fs.readdirSync(gitDir)) {
    const pid = Number(SCRATCH.exec(name)?.[1]);
    if (pid > 0 && pid !== process.pid && !processAlive(pid)) fs.rmSync(path.join(gitDir, name), { force: true });
  }
}

/**
 * Run `fn` on the blob written out to a file in the git dir, removed after.
 * @template T @param {CheckedTree} tree @param {string} oid @param {(file: string) => T} fn @returns {T}
 */
function withBlobFile({ git, gitDir }, oid, fn) {
  sweepScratch(gitDir);
  const file = path.join(gitDir, `leeway-ledger.${process.pid}.${oid}`);
  blobToFile(git, oid, file);
  try {
    return fn(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/**
 * Whether the blob `blob` starts byte for byte with `start`: hashed from the
 * ledger on disk where the disk holds the blob, else from the blob itself.
 * @param {CheckedTree} tree @param {LedgerBlob} blob @param {LedgerBlob} start
 */
function blobStartsWith(tree, blob, start) {
  if (blob.size < start.size) return false;
  const disk = path.join(tree.root, LEDGER);
  if (fs.existsSync(disk)) {
    const [whole, head] = blobIds(disk, [blob.size, start.size], formatOf(blob.oid));
    if (whole === blob.oid) return head === start.oid;
  }
  return withBlobFile(tree, blob.oid, (file) => fileStartsWith(file, start));
}

/**
 * Whether a line found holds a committed one: the same bytes, or, for a
 * committed last line with no newline, the same start.
 * @param {Buffer} found @param {Buffer} committed
 */
function holdsLine(found, committed) {
  return committed[committed.length - 1] === 0x0a ? found.equals(committed) : found.subarray(0, committed.length).equals(committed);
}

/** A line's text, without its newline. @param {Buffer} line */
function lineText(line) {
  return line.toString('utf8', 0, line[line.length - 1] === 0x0a ? line.length - 1 : line.length);
}

/**
 * The first line of `committed` that `file` does not hold, or null where it
 * holds them all; no file, or one that is not there, holds none.
 * @param {string} committed @param {string|null} file
 * @returns {LedgerChange|null}
 */
function firstChange(committed, file) {
  const theirs = fileLineBytes(committed);
  const ours = file !== null && fs.existsSync(file) ? fileLineBytes(file) : null;
  try {
    for (let line = 1; ; line += 1) {
      const want = theirs.next();
      if (want.done) return null;
      const got = ours === null ? null : ours.next();
      if (got === null || got.done) return { line, found: null };
      if (!holdsLine(got.value, want.value)) return { line, found: lineText(got.value) };
    }
  } finally {
    theirs.return(undefined);
    ours?.return(undefined);
  }
}

/** A line's entry id: undefined where the line is no JSON object with a string id. @param {string} line */
function idOf(line) {
  try {
    const entry = JSON.parse(line);
    return entry !== null && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.id === 'string' ? entry.id : undefined;
  } catch {
    return undefined;
  }
}

/** Each line's entry id, in order. @param {string} file @returns {Generator<string|undefined>} */
function* idsOf(file) {
  for (const line of fileLines(file)) yield idOf(line);
}

/**
 * Where `copy` first fails to carry every event of `ledger` through with
 * the same id in the same order: the line, and the id each holds there —
 * null where it holds no line, undefined where its line is no entry with an
 * id — or null where it carries them all and nothing more.
 * @param {string} ledger @param {string} copy
 * @returns {{line: number, was: string|null|undefined, is: string|null|undefined}|null}
 */
function idsDeparture(ledger, copy) {
  const was = idsOf(ledger);
  const is = idsOf(copy);
  try {
    for (let line = 1; ; line += 1) {
      const a = was.next();
      const b = is.next();
      if (a.done && b.done) return null;
      const ids = { was: a.done ? null : a.value, is: b.done ? null : b.value };
      if (ids.was === undefined || ids.is === undefined || ids.was !== ids.is) return { line, ...ids };
    }
  } finally {
    was.return(undefined);
    is.return(undefined);
  }
}

/** Where a conversion keeps its pass. @param {string} gitDir */
function passFile(gitDir) {
  return path.join(gitDir, PASS);
}

/**
 * Whether a pass's converted copy is in git and carries the converted
 * ledger's every event through, with the same ids in the same order.
 * @param {CheckedTree} tree @param {LedgerBlob} from @param {LedgerBlob} to
 */
function passKeeps(tree, from, to) {
  if (!sameBlob(blobsOf(tree.git, [to.oid])[0], to)) return false;
  return withBlobFile(tree, from.oid, (ledger) => withBlobFile(tree, to.oid, (copy) => idsDeparture(ledger, copy) === null));
}

/**
 * The pass standing for a conversion of the committed ledger `committed`,
 * or null where none stands, or the one standing does not keep the door's
 * rule.
 * @param {CheckedTree} tree @param {LedgerBlob} committed
 * @returns {ConversionPass|null}
 */
function passFor(tree, committed) {
  const pass = readRecord(passFile(tree.gitDir));
  if (pass === null || typeof pass !== 'object' || !isBlob(pass.to) || !isBlob(pass.from) || !sameBlob(pass.from, committed)) return null;
  return passKeeps(tree, pass.from, pass.to) ? pass : null;
}

/** The pass is spent, its commit landed. @param {string} gitDir */
function spendPass(gitDir) {
  fs.rmSync(passFile(gitDir), { force: true });
}

/** Where the engine's stop on the ledger is kept. @param {string} gitDir */
function stopFile(gitDir) {
  return path.join(gitDir, KEPT_STOP);
}

/** Keep the engine's stop on the ledger for its screen. @param {string} gitDir @param {KeptStop} stop */
function keepStop(gitDir, stop) {
  writeJsonAtomic(stopFile(gitDir), stop);
}

/** The engine's last stop on the ledger, or null. @param {string} gitDir @returns {KeptStop|null} */
function keptStop(gitDir) {
  return readRecord(stopFile(gitDir));
}

/** A state commit landed: no stop stands. @param {string} gitDir */
function dropStop(gitDir) {
  fs.rmSync(stopFile(gitDir), { force: true });
}

/**
 * The engine's stop on a line not as committed: kept, and answered to throw.
 * @param {CheckedTree} tree @param {LedgerChange} change @param {string} outcome
 * @returns {LedgerChanged}
 */
function ledgerStopped(tree, change, outcome) {
  keepStop(tree.gitDir, { stop: 'changed', ...change });
  return new LedgerChanged(change, outcome);
}

/**
 * Where `file` departs from each of `starts`, the latest departure: the
 * line it shows is the one that broke the ledger.
 * @param {CheckedTree} tree @param {string|null} file @param {LedgerBlob[]} starts
 * @returns {LedgerChange}
 */
function departure(tree, file, starts) {
  const changes = starts.map((start) => withBlobFile(tree, start.oid, (committed) => firstChange(committed, file)) ?? { line: 1, found: null });
  return changes.reduce((latest, change) => (change.line > latest.line ? change : latest));
}

/**
 * The first line of the ledger on disk not as `rev` holds it, or null where
 * the disk starts with `rev`'s ledger — or with the converted copy, where a
 * conversion's pass stands for `rev`'s ledger. `rev`'s ledger is read
 * before the file.
 * @param {CheckedTree} tree @param {string} rev
 * @returns {LedgerChange|null}
 */
function diskChange(tree, rev) {
  const [committed] = ledgerBlobs(tree.git, [rev]);
  const disk = path.join(tree.root, LEDGER);
  if (committed === null || fileStartsWith(disk, committed)) return null;
  const pass = passFor(tree, committed);
  if (pass !== null && fileStartsWith(disk, pass.to)) return null;
  return departure(tree, disk, pass === null ? [committed] : [committed, pass.to]);
}

/**
 * Refuse a state commit whose ledger does not start byte for byte with its
 * parent's, keeping the stop: the parent's ledger is the one committed,
 * `treeish` what is committed on it. A conversion's pass standing for the
 * parent's ledger lets the converted copy through instead, and is answered
 * for the commit to spend once it lands; else null.
 * @param {CheckedTree} tree @param {string} parent @param {string} treeish
 * @returns {ConversionPass|null}
 */
function checkLedgerCommit(tree, parent, treeish) {
  const [before, after] = ledgerBlobs(tree.git, [parent, treeish]);
  if (before === null || sameBlob(before, after)) return null;
  if (after !== null && blobStartsWith(tree, after, before)) return null;
  const pass = passFor(tree, before);
  if (pass !== null && after !== null && blobStartsWith(tree, after, pass.to)) return pass;
  const starts = pass === null ? [before] : [before, pass.to];
  const change = after === null ? departure(tree, null, starts) : withBlobFile(tree, after.oid, (file) => departure(tree, file, starts));
  throw ledgerStopped(tree, change, 'nothing committed');
}

module.exports = {
  LedgerChanged,
  ledgerBlobs,
  fileStartsWith,
  idsOf,
  idsDeparture,
  passFile,
  spendPass,
  keepStop,
  keptStop,
  dropStop,
  ledgerStopped,
  diskChange,
  checkLedgerCommit,
};
