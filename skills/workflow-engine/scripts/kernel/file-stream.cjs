'use strict';

// ---------------------------------------------------------------------------
// Kernel: files of any size, never held whole and never read through a pipe.
// A runner answers what a git call prints through a pipe buffered to its
// read budget (kernel/git.cjs), so a call whose answer may be large — a
// blob, a batch of them — writes it to a file instead. A file is read a
// chunk at a time: as bytes, as lines, or hashed the way git names a blob,
// so none is held in memory for its size alone.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');

const CHUNK_BYTES = 64 * 1024;

/**
 * Git's output for `args` written to `file` whole.
 * @param {import('./isolated-git.cjs').IsolatedGit} git @param {string[]} args @param {string} file @param {string} [input]
 */
function runToFile(git, args, file, input) {
  const fd = fs.openSync(file, 'w');
  try {
    git.run(args, { input, out: fd });
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * A blob written whole to `file` by git, whatever its size; an empty file
 * where there is none.
 * @param {import('./isolated-git.cjs').IsolatedGit} git @param {string|undefined} oid @param {string} file
 */
function blobToFile(git, oid, file) {
  if (oid === undefined) fs.writeFileSync(file, '');
  else runToFile(git, ['cat-file', 'blob', oid], file);
}

/**
 * A file's bytes, a chunk at a time; each chunk holds until the next is
 * read.
 * @param {string} file @returns {Generator<Buffer>}
 */
function* fileChunks(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const chunk = Buffer.alloc(CHUNK_BYTES);
    for (let read = fs.readSync(fd, chunk); read > 0; read = fs.readSync(fd, chunk)) yield chunk.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * A file's lines as bytes, each with its newline but a last one the file
 * does not end with, read a chunk at a time.
 * @param {string} file @returns {Generator<Buffer>}
 */
function* fileLineBytes(file) {
  let rest = Buffer.alloc(0);
  for (const chunk of fileChunks(file)) {
    const data = Buffer.concat([rest, chunk]);
    let start = 0;
    for (let eol = data.indexOf(0x0a); eol !== -1; eol = data.indexOf(0x0a, start)) {
      yield data.subarray(start, eol + 1);
      start = eol + 1;
    }
    rest = data.subarray(start);
  }
  if (rest.length > 0) yield rest;
}

/**
 * A file's lines, each without its newline, read a chunk at a time.
 * @param {string} file @returns {Generator<string>}
 */
function* fileLines(file) {
  for (const line of fileLineBytes(file)) {
    yield line.toString('utf8', 0, line[line.length - 1] === 0x0a ? line.length - 1 : line.length);
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

/**
 * The id git names each of the file's first `n` bytes by, as a blob in the
 * repository's object format (`sha1` or `sha256`), for each `n` of
 * `lengths`: null where the file holds fewer. Read once, a chunk at a time,
 * no further than the longest.
 * @param {string} file @param {number[]} lengths @param {string} objectFormat
 * @returns {(string|null)[]}
 */
function blobIds(file, lengths, objectFormat) {
  const hashes = lengths.map((n) => crypto.createHash(objectFormat).update(`blob ${n}\0`));
  const longest = Math.max(0, ...lengths);
  let read = 0;
  if (longest > 0) {
    for (const chunk of fileChunks(file)) {
      lengths.forEach((n, i) => {
        if (read < n) hashes[i].update(chunk.subarray(0, n - read));
      });
      read += chunk.length;
      if (read >= longest) break;
    }
  }
  return hashes.map((hash, i) => (read >= lengths[i] ? hash.digest('hex') : null));
}

module.exports = { runToFile, blobToFile, fileChunks, fileLineBytes, fileLines, endsWithNewline, blobIds };
