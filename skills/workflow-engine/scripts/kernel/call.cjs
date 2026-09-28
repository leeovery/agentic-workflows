'use strict';

// ---------------------------------------------------------------------------
// Kernel: one engine invocation — what it acts on, where its answers go, and
// how a command ends it with an exit code without ending its caller.
// ---------------------------------------------------------------------------

/**
 * The directory an invocation acts on, where its two output streams go, and
 * the text it was handed on stdin (read lazily — a command that wants none
 * never asks). `terminal` is present only at the shell door with a terminal
 * on stdin: the interactive commands prompt through it, and are refused
 * anywhere else.
 * @typedef {object} Call
 * @property {string} cwd
 * @property {(text: string) => void} out
 * @property {(text: string) => void} err
 * @property {() => string} stdin
 * @property {{input: NodeJS.ReadStream, output: NodeJS.WriteStream}} [terminal]
 */

/**
 * A command's exit, thrown rather than taken on the process: the shell door
 * turns it into an exit code, the in-process door answers with one. A
 * handler that stops the command must never stop its caller.
 */
class ExitSignal extends Error {
  /** @param {number} code */
  constructor(code) {
    super(`engine exited ${code}`);
    this.code = code;
  }
}

module.exports = { ExitSignal };
