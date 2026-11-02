'use strict';

// ---------------------------------------------------------------------------
// Kernel: a project's own command run by `sh -c` in a folder of its code —
// the commit door's checks (commit-task.cjs) and the verify setup's parts
// (verify.cjs). Its output and its errors go to one file whatever their
// length, with no timeout of the engine's own; what comes back is its exit
// code — one killed by a signal exiting as the shell reports it, 128 and the
// signal's number — and, where it failed, its output's last lines.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { fileLinesBackward } = require('./file-stream.cjs');

/** How many of a failed command's last lines come back. */
const TAIL_LINES = 40;

/** @typedef {{exit: number, tail: string[]}} CommandRun */

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

/**
 * `command` run by `sh -c` in `root`, the variables `env` names added to the
 * engine's own: its exit code, and where it failed its output's last lines.
 * @param {string} root @param {string} command @param {Record<string, string>} [env]
 * @returns {CommandRun}
 */
function runShellCommand(root, command, env = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-command-'));
  const file = path.join(folder, 'output');
  try {
    const fd = fs.openSync(file, 'w');
    let result;
    try {
      result = spawnSync('sh', ['-c', command], { cwd: root, stdio: ['ignore', fd, fd], env: { ...process.env, ...env } });
    } finally {
      fs.closeSync(fd);
    }
    if (result.error !== undefined) throw result.error;
    const exit = result.status ?? 128 + os.constants.signals[/** @type {NodeJS.Signals} */ (result.signal)];
    return { exit, tail: exit === 0 ? [] : lastLines(file) };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

/** A failed command's output, as a refusal carries it. @param {string[]} tail */
function tailText(tail) {
  return tail.length === 0 ? 'It wrote nothing.' : `The last of its output, ${TAIL_LINES} lines at most:\n${tail.join('\n')}`;
}

module.exports = { TAIL_LINES, runShellCommand, tailText };
