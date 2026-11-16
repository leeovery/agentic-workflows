'use strict';

// ---------------------------------------------------------------------------
// Kernel: files of any size, never held whole and never read through a pipe.
// A runner answers what a git call prints through a pipe buffered to its
// read budget (kernel/git.cjs), so a call whose answer may be large — a
// blob, a batch of them — writes it to a file instead. A file is read a
// chunk at a time: as bytes, as lines, or hashed the way git names a blob,
// so none is held in memory for its size alone; an open file's lines come
// with where each sits, so one can be read again alone, and can be read from
// the end, so the last of a long file's lines are read without the rest.
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
 * An open file's bytes from its start, a chunk at a time; each chunk holds
 * until the next is read.
 * @param {number} fd @returns {Generator<Buffer>}
 */
function* fdChunks(fd) {
  const chunk = Buffer.alloc(CHUNK_BYTES);
  let position = 0;
  for (let read = fs.readSync(fd, chunk, 0, CHUNK_BYTES, position); read > 0; read = fs.readSync(fd, chunk, 0, CHUNK_BYTES, position)) {
    yield chunk.subarray(0, read);
    position += read;
  }
}

/**
 * A file's bytes, a chunk at a time; each chunk holds until the next is
 * read.
 * @param {string} file @returns {Generator<Buffer>}
 */
function* fileChunks(file) {
  const fd = fs.openSync(file, 'r');
  try {
    yield* fdChunks(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * The lines of a stream of chunks as bytes, each with its newline but a last
 * one the stream does not end with.
 * @param {Iterable<Buffer>} chunks @returns {Generator<Buffer>}
 */
function* linesOf(chunks) {
  let rest = Buffer.alloc(0);
  for (const chunk of chunks) {
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

/** A line's text, without its newline. @param {Buffer} line */
function lineText(line) {
  return line.toString('utf8', 0, line[line.length - 1] === 0x0a ? line.length - 1 : line.length);
}

/**
 * A file's lines as bytes, each with its newline but a last one the file
 * does not end with, read a chunk at a time.
 * @param {string} file @returns {Generator<Buffer>}
 */
function* fileLineBytes(file) {
  yield* linesOf(fileChunks(file));
}

/**
 * A file's lines, each without its newline, read a chunk at a time.
 * @param {string} file @returns {Generator<string>}
 */
function* fileLines(file) {
  for (const line of fileLineBytes(file)) yield lineText(line);
}

/** Where a line sits in its file: the byte it starts at, and its bytes, its newline among them. @typedef {{offset: number, bytes: number}} LineSpan */

/**
 * An open file's lines from its start, each without its newline and with
 * where it sits, read a chunk at a time.
 * @param {number} fd @returns {Generator<{text: string, span: LineSpan}>}
 */
function* fdLines(fd) {
  let offset = 0;
  for (const line of linesOf(fdChunks(fd))) {
    yield { text: lineText(line), span: { offset, bytes: line.length } };
    offset += line.length;
  }
}

/**
 * An open file's lines from its end, each without its newline and with
 * where it sits, read a chunk at a time from the end — so a line near the
 * end is read without what comes before it. Each read reaches back at
 * least as far as the line it has not finished, so a long line is read in
 * time linear in its length.
 * @param {number} fd @returns {Generator<{text: string, span: LineSpan}>}
 */
function* fdLinesBackward(fd) {
  let position = fs.fstatSync(fd).size;
  /** The bytes from `position` on not yet yielded, no line's start found among them but at their first. */
  let rest = Buffer.alloc(0);
  while (rest.length > 0 || position > 0) {
    const eol = rest.length > 1 ? rest.lastIndexOf(0x0a, rest.length - 2) : -1;
    if (eol === -1 && position > 0) {
      const bytes = Math.min(Math.max(CHUNK_BYTES, rest.length), position);
      position -= bytes;
      rest = Buffer.concat([bytesAt(fd, position, bytes), rest]);
      continue;
    }
    const line = rest.subarray(eol + 1);
    yield { text: lineText(line), span: { offset: position + eol + 1, bytes: line.length } };
    rest = rest.subarray(0, eol + 1);
  }
}

/**
 * A file's lines from its end, each without its newline, read a chunk at a
 * time from the end.
 * @param {string} file @returns {Generator<string>}
 */
function* fileLinesBackward(file) {
  const fd = fs.openSync(file, 'r');
  try {
    for (const { text } of fdLinesBackward(fd)) yield text;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * The line of an open file that sits at `span`, without its newline.
 * @param {number} fd @param {LineSpan} span @returns {string}
 */
function lineAt(fd, { offset, bytes }) {
  return lineText(bytesAt(fd, offset, bytes));
}

/**
 * The `bytes` bytes of an open file at `offset`.
 * @param {number} fd @param {number} offset @param {number} bytes @returns {Buffer}
 */
function bytesAt(fd, offset, bytes) {
  const read = Buffer.alloc(bytes);
  for (let at = 0; at < bytes;) {
    const got = fs.readSync(fd, read, at, bytes - at, offset + at);
    if (got === 0) throw new Error(`the file ends before the ${bytes} bytes at ${offset}`);
    at += got;
  }
  return read;
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

module.exports = {
  runToFile, blobToFile, fileLineBytes, fileLines, fdLines, fdLinesBackward, fileLinesBackward, lineAt, endsWithNewline, blobIds,
};
