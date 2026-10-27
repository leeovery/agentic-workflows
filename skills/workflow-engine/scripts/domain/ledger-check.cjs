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
//   out of git only to find the line a failed check shows, or where the
//   blob a commit holds is not the file on disk; the file is read a chunk
//   at a time, and nothing comes through a pipe.
// - The one change it lets through is a migration's conversion of the
//   ledger's shape (5.4.8, 5.7.3). The conversion leaves a pass in the
//   state worktree's git dir, off the branch, naming the committed ledger it
//   converted and the converted copy (ledger-conversion.cjs). While the
//   committed ledger is the one converted, the ledger may start with the
//   converted copy instead, and the commit carrying it spends the pass.
// - A check that fails names the first line not as committed, and the line
//   found there, for the engine's stop (5.4.4).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { LEDGER } = require('./ledger-events.cjs');
const { blobIds, blobToFile, fileLineBytes } = require('../kernel/file-stream.cjs');

const PASS = 'leeway-ledger-conversion.json';

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
 * The ledger each of `revs` holds — a commit's or a tree's — null where one
 * holds none. One git call, whatever the ledger's size.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string[]} revs
 * @returns {(LedgerBlob|null)[]}
 */
function ledgerBlobs(git, revs) {
  const out = git.run(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { input: revs.map((rev) => `${rev}:${LEDGER}\n`).join('') });
  return out.split('\n').filter((line) => line !== '').map((line) => {
    const [oid, kind, size] = line.split(' ');
    return kind === 'blob' ? { oid, size: Number(size) } : null;
  });
}

/** Whether `file` starts byte for byte with `blob`; nothing starts with no ledger. @param {string} file @param {LedgerBlob|null} blob */
function fileStartsWith(file, blob) {
  if (blob === null || blob.size === 0) return true;
  return fs.existsSync(file) && blobIds(file, [blob.size], formatOf(blob.oid))[0] === blob.oid;
}

/**
 * Run `fn` on the blob written out to a file in the git dir, removed after.
 * @template T @param {CheckedTree} tree @param {string} oid @param {(file: string) => T} fn @returns {T}
 */
function withBlobFile({ git, gitDir }, oid, fn) {
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

/** Where a conversion keeps its pass. @param {string} gitDir */
function passFile(gitDir) {
  return path.join(gitDir, PASS);
}

/**
 * The pass standing for a conversion of the committed ledger `committed`,
 * or null.
 * @param {string} gitDir @param {LedgerBlob|null} committed
 * @returns {ConversionPass|null}
 */
function passFor(gitDir, committed) {
  let pass;
  try {
    pass = JSON.parse(fs.readFileSync(passFile(gitDir), 'utf8'));
  } catch {
    return null;
  }
  if (pass === null || typeof pass !== 'object' || !isBlob(pass.to) || !(pass.from === null || isBlob(pass.from))) return null;
  return sameBlob(pass.from, committed) ? pass : null;
}

/**
 * Leave the pass for a conversion, replacing any standing.
 * @param {string} gitDir @param {ConversionPass} pass
 */
function writePass(gitDir, pass) {
  const file = passFile(gitDir);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(pass)}\n`);
  fs.renameSync(tmp, file);
}

/** The pass is spent, its commit landed. @param {string} gitDir */
function spendPass(gitDir) {
  fs.rmSync(passFile(gitDir), { force: true });
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
  const pass = passFor(tree.gitDir, committed);
  if (pass !== null && fileStartsWith(disk, pass.to)) return null;
  return departure(tree, disk, pass === null ? [committed] : [committed, pass.to]);
}

/**
 * Refuse a state commit whose ledger does not start byte for byte with its
 * parent's: the parent's ledger is the one committed, `treeish` what is
 * committed on it. A conversion's pass standing for the parent's ledger
 * lets the converted copy through instead, and is answered for the commit
 * to spend once it lands; else null.
 * @param {CheckedTree} tree @param {string} parent @param {string} treeish
 * @returns {ConversionPass|null}
 */
function checkLedgerCommit(tree, parent, treeish) {
  const [before, after] = ledgerBlobs(tree.git, [parent, treeish]);
  if (before === null || sameBlob(before, after)) return null;
  if (after !== null && blobStartsWith(tree, after, before)) return null;
  const pass = passFor(tree.gitDir, before);
  if (pass !== null && after !== null && blobStartsWith(tree, after, pass.to)) return pass;
  const starts = pass === null ? [before] : [before, pass.to];
  const change = after === null ? departure(tree, null, starts) : withBlobFile(tree, after.oid, (file) => departure(tree, file, starts));
  throw new LedgerChanged(change, 'nothing committed');
}

module.exports = { LedgerChanged, ledgerBlobs, diskChange, checkLedgerCommit, writePass, spendPass };
