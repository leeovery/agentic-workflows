'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state's blobs, read for a merge (4.7) — and the code
// branches' blobs the trace is read from where the state is lost
// (domain/code-trace). A merge reads many blobs, so it reads them together:
// their sizes in one git call, then the bytes of each within the limit its
// caller reads it to in one more, written to a file, so no answer is held to
// a pipe's limit. A blob over its limit is never read. A blob the merge reads
// a line at a time, as it does the ledger at any size, is written to a file
// whole and read a chunk at a time (kernel/file-stream).
//
// A blob's id names its bytes for good, so each blob read is kept on the
// merge's context by its id and never read again.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { GitError } = require('../kernel/git.cjs');
const { runToFile } = require('../kernel/file-stream.cjs');

/** A blob's size, and its bytes: null where it is over the limit it was read to. @typedef {{size: number, bytes: Buffer|null}} Blob */

/**
 * What reading blobs takes: a runner bound to the state worktree, the
 * scratch folder in its git dir, and the blobs read so far by id.
 * @typedef {{
 *   git: import('../kernel/isolated-git.cjs').IsolatedGit,
 *   scratch: string,
 *   blobs: Map<string, Blob>,
 * }} BlobContext
 */

/** @param {string[]} oids */
function listed(oids) {
  return oids.map((oid) => `${oid}\n`).join('');
}

/**
 * Run `fn` with the scratch folder made afresh, and cleared after.
 * @template T @param {BlobContext} ctx @param {(dir: string) => T} fn @returns {T}
 */
function withScratch(ctx, fn) {
  fs.rmSync(ctx.scratch, { recursive: true, force: true });
  fs.mkdirSync(ctx.scratch, { recursive: true });
  try {
    return fn(ctx.scratch);
  } finally {
    fs.rmSync(ctx.scratch, { recursive: true, force: true });
  }
}

/** Blobs' sizes by id. Refuses one the repository lacks. @param {BlobContext} ctx @param {string[]} oids @returns {Map<string, number>} */
function sizesOf(ctx, oids) {
  /** @type {Map<string, number>} */
  const sizes = new Map();
  for (const line of ctx.git.run(['cat-file', '--batch-check=%(objectname) %(objectsize)'], { input: listed(oids) }).split('\n')) {
    if (line === '') continue;
    const [oid, size] = line.split(' ');
    if (size === 'missing') throw new GitError(`git cat-file failed: the state's object ${oid} is missing`);
    sizes.set(oid, Number(size));
  }
  return sizes;
}

/**
 * Read blobs: the size of each not sized yet, then the bytes of each not
 * read yet that is within the limit it is asked for with.
 * @param {BlobContext} ctx @param {[string, number][]} wanted  each blob's id, and the most bytes it is read to
 */
function readBlobs(ctx, wanted) {
  /** @type {Map<string, number>} */
  const limits = new Map();
  for (const [oid, limit] of wanted) limits.set(oid, Math.max(limit, limits.get(oid) ?? 0));
  const unsized = [...limits.keys()].filter((oid) => !ctx.blobs.has(oid));
  if (unsized.length > 0) {
    for (const [oid, size] of sizesOf(ctx, unsized)) ctx.blobs.set(oid, { size, bytes: null });
  }
  const unread = [...limits].filter(([oid, limit]) => {
    const blob = /** @type {Blob} */ (ctx.blobs.get(oid));
    return blob.bytes === null && blob.size <= limit;
  }).map(([oid]) => oid);
  if (unread.length === 0) return;
  const batch = withScratch(ctx, (dir) => {
    const file = path.join(dir, 'blobs');
    runToFile(ctx.git, ['cat-file', '--batch=%(objectname) %(objectsize)'], file, listed(unread));
    return fs.readFileSync(file);
  });
  for (let at = 0; at < batch.length;) {
    const eol = batch.indexOf(0x0a, at);
    const [oid, size] = batch.toString('latin1', at, eol).split(' ');
    const end = eol + 1 + Number(size);
    ctx.blobs.set(oid, { size: Number(size), bytes: batch.subarray(eol + 1, end) });
    at = end + 1;
  }
}

/** A blob, read now to `limit` bytes where it was not read before. @param {BlobContext} ctx @param {string} oid @param {number} limit @returns {Blob} */
function blobOf(ctx, oid, limit) {
  readBlobs(ctx, [[oid, limit]]);
  return /** @type {Blob} */ (ctx.blobs.get(oid));
}

module.exports = { withScratch, readBlobs, blobOf };
