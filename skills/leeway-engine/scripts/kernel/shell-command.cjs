'use strict';

// ---------------------------------------------------------------------------
// Kernel: a project's own command run by `sh -c` in a folder of its code —
// the commit door's checks (commit-task.cjs), the verify setup's parts and
// the reproducing test (verify.cjs). Its output and its errors go to one
// file whatever their length, with no timeout of the engine's own; what
// comes back is its exit code — one killed by a signal exiting as the shell
// reports it, 128 and the signal's number — and, where it failed, its
// output's last lines; and, where the caller asks, its output as text, at
// most the last of it a byte count gives, from a line's start where one
// leaves something, else from a character's.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { fileLinesBackward } = require('./file-stream.cjs');
const { dropReads } = require('./git-reads.cjs');

/** How many of a failed command's last lines come back. */
const TAIL_LINES = 40;

/** @typedef {{exit: number, tail: string[], output?: string}} CommandRun */

/**
 * A file's last lines, at most `TAIL_LINES`, in their order.
 * @param {string} file @returns {string[]}
 */
function lastLines(file) {
  /** @type {string[]} */
  const lines = [];
  for (const line of fileLinesBackward(file)) {
    lines.unshift(line);
    if (lines.length === TAIL_LINES) break;
  }
  return lines;
}

/** Where the first character starts among bytes: past any that continue one begun before them. @param {Buffer} bytes */
function firstCharacter(bytes) {
  let at = 0;
  while (at < bytes.length && (bytes[at] & 0xc0) === 0x80) at += 1;
  return at;
}

/**
 * A file's text, at most its last `limit` bytes where it holds more: from
 * the first line that starts among them and leaves something, or else from
 * the first character that does — read with the byte before them, so a line
 * starting at the first of them is kept.
 * @param {string} file @param {number} limit
 */
function lastText(file, limit) {
  const { size } = fs.statSync(file);
  if (size <= limit) return fs.readFileSync(file, 'utf8');
  const read = Buffer.alloc(limit + 1);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, read, 0, limit + 1, size - limit - 1);
  } finally {
    fs.closeSync(fd);
  }
  const kept = read.subarray(1);
  const line = read.indexOf(0x0a);
  return kept.subarray(line >= 0 && line < limit ? line : firstCharacter(kept)).toString('utf8');
}

/**
 * `command` run by `sh -c` in `root`, the variables `env` names added to the
 * engine's own: its exit code, where it failed its output's last lines, and
 * where `output` gives a byte count, its output as text, at most that much
 * of its last.
 * @param {string} root @param {string} command @param {Record<string, string>} [env] @param {{output?: number}} [keep]
 * @returns {CommandRun}
 */
function runShellCommand(root, command, env = {}, { output } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-command-'));
  const file = path.join(folder, 'output');
  try {
    const fd = fs.openSync(file, 'w');
    let result;
    try {
      dropReads();
      result = spawnSync('sh', ['-c', command], { cwd: root, stdio: ['ignore', fd, fd], env: { ...process.env, ...env } });
    } finally {
      fs.closeSync(fd);
    }
    if (result.error !== undefined) throw result.error;
    const exit = result.status ?? 128 + os.constants.signals[/** @type {NodeJS.Signals} */ (result.signal)];
    return { exit, tail: exit === 0 ? [] : lastLines(file), ...(output === undefined ? {} : { output: lastText(file, output) }) };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

/** A failed command's output, as a refusal carries it. @param {string[]} tail */
function tailText(tail) {
  return tail.length === 0 ? 'It wrote nothing.' : `The last of its output, ${TAIL_LINES} lines at most:\n${tail.join('\n')}`;
}

module.exports = { TAIL_LINES, runShellCommand, tailText };
