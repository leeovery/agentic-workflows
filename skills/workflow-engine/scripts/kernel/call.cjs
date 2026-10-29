'use strict';

// ---------------------------------------------------------------------------
// Kernel: one engine invocation — the command a person types to start one,
// what it acts on, where its answers go, the one JSON object a command takes
// on stdin, how a command ends it with an exit code without ending its
// caller, what a failure says, and how a command starts one detached, to
// outlive it.
// ---------------------------------------------------------------------------

const path = require('path');
const childProcess = require('child_process');
const { isObject } = require('./manifest-io.cjs');

/** The command a person types at the project root to run the engine. */
const ENGINE_COMMAND = 'node .claude/skills/workflow-engine/scripts/engine.cjs';

const ENGINE_CJS = path.join(__dirname, '..', 'engine.cjs');

/**
 * The one door a detached engine job — the vector fill, the late
 * one-decision check — is launched through: its own process, run from `cwd`,
 * its output dropped, never waited on. Replaced by a test that must observe
 * a launch without a process.
 */
const launcher = {
  /** @param {string} cwd @param {string[]} argv the engine command */
  launch(cwd, argv) {
    const child = childProcess.spawn(process.execPath, [ENGINE_CJS, ...argv], { cwd, detached: true, stdio: 'ignore' });
    // A job that could not start leaves its work for the next launch — never
    // an unhandled error in the command that launched it.
    child.on('error', () => {});
    child.unref();
  },
};

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

/**
 * Stdin's one JSON object, `what` it holds, refused in the words of `said`,
 * the command asking.
 * @param {string} stdin @param {string} said @param {string} what
 * @returns {Record<string, unknown>}
 */
function stdinObject(stdin, said, what) {
  let value;
  try {
    value = JSON.parse(stdin);
  } catch (err) {
    throw new Error(`${said}: ${what} comes on stdin as a JSON object, and stdin holds no JSON — ${messageOf(err)}`);
  }
  if (!isObject(value)) throw new Error(`${said}: ${what} comes on stdin as a JSON object, not ${JSON.stringify(value)}`);
  return value;
}

module.exports = { ENGINE_COMMAND, ExitSignal, messageOf, stdinObject, launcher };
