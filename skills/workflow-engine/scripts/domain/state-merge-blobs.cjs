'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state's blobs, read for a merge (4.7). A merge reads
// many blobs, so it reads them together: their sizes in one git call, then
// the bytes of those within the read budget in one more, written to a file,
// so no answer is held to a pipe's limit. A blob over the budget is never
// read; the merge keeps its path whole by its object id. A blob the merge
// reads a line at a time, as it does the ledger at any size, is written to a
// file whole by git, and its lines are read from there a chunk at a time.
//
// A blob's id names its bytes for good, so each blob read is kept on the
// merge's context by its id and never read again.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { GitError } = require('../kernel/git.cjs');

const CHUNK_BYTES = 64 * 1024;

/** A blob's size, and its bytes: null where it is over the read budget. @typedef {{size: number, bytes: Buffer|null}} Blob */

/**
 * What reading blobs takes: a runner bound to the state worktree, the
 * scratch folder in its git dir, the blobs read so far by id, and the read
 * budget in bytes.
 * @typedef {{
 *   git: import('../kernel/isolated-git.cjs').IsolatedGit,
 *   scratch: string,
 *   blobs: Map<string, Blob>,
 *   budget: number,
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

/** Git's output for `args` written to `file` whole. @param {BlobContext} ctx @param {string[]} args @param {string} file @param {string} [input] */
function runToFile(ctx, args, file, input) {
  const fd = fs.openSync(file, 'w');
  try {
    ctx.git.run(args, { input, out: fd });
  } finally {
    fs.closeSync(fd);
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
 * Read the blobs not read yet: every one's size, then the bytes of each
 * within the read budget.
 * @param {BlobContext} ctx @param {string[]} oids
 */
function readBlobs(ctx, oids) {
  const wanted = [...new Set(oids)].filter((oid) => !ctx.blobs.has(oid));
  if (wanted.length === 0) return;
  /** @type {string[]} */
  const within = [];
  for (const [oid, size] of sizesOf(ctx, wanted)) {
    if (size <= ctx.budget) within.push(oid);
    else ctx.blobs.set(oid, { size, bytes: null });
  }
  if (within.length === 0) return;
  const batch = withScratch(ctx, (dir) => {
    const file = path.join(dir, 'blobs');
    runToFile(ctx, ['cat-file', '--batch=%(objectname) %(objectsize)'], file, listed(within));
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

/** A blob, read now where it was not read before. @param {BlobContext} ctx @param {string} oid @returns {Blob} */
function blobOf(ctx, oid) {
  readBlobs(ctx, [oid]);
  return /** @type {Blob} */ (ctx.blobs.get(oid));
}

/** A blob written whole to `file` by git, whatever its size; an empty file where there is none. @param {BlobContext} ctx @param {string|undefined} oid @param {string} file */
function blobToFile(ctx, oid, file) {
  if (oid === undefined) fs.writeFileSync(file, '');
  else runToFile(ctx, ['cat-file', 'blob', oid], file);
}

/**
 * A file's lines, each without its newline, read a chunk at a time.
 * @param {string} file @returns {Generator<string>}
 */
function* fileLines(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const chunk = Buffer.alloc(CHUNK_BYTES);
    let rest = Buffer.alloc(0);
    for (let read = fs.readSync(fd, chunk); read > 0; read = fs.readSync(fd, chunk)) {
      const data = Buffer.concat([rest, chunk.subarray(0, read)]);
      let start = 0;
      for (let eol = data.indexOf(0x0a); eol !== -1; eol = data.indexOf(0x0a, start)) {
        yield data.toString('utf8', start, eol);
        start = eol + 1;
      }
      rest = data.subarray(start);
    }
    if (rest.length > 0) yield rest.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** Whether a file is empty or ends with a newline. @param {string} file */
function endsWithNewline(file) {
  const { size } = fs.statSync(file);
  if (size === 0) return true;
  const last = Buffer.alloc(1);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, last, 0, 1, size - 1);
  } finally {
    fs.closeSync(fd);
  }
  return last[0] === 0x0a;
}

module.exports = { withScratch, readBlobs, blobOf, blobToFile, fileLines, endsWithNewline };
