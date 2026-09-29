'use strict';

// ---------------------------------------------------------------------------
// Kernel: one engine invocation — the command a person types to start one,
// what it acts on, where its answers go, how a command ends it with an exit
// code without ending its caller, and what a failure says.
// ---------------------------------------------------------------------------

/** The command a person types at the project root to run the engine. */
const ENGINE_COMMAND = 'node .claude/skills/workflow-engine/scripts/engine.cjs';

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

/**
 * What a thrown value says: an error's message, anything else as text.
 * @param {unknown} err @returns {string}
 */
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

module.exports = { ENGINE_COMMAND, ExitSignal, messageOf };
