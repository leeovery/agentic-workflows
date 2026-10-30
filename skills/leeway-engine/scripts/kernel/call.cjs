'use strict';

// ---------------------------------------------------------------------------
// Kernel: one engine invocation — the command a person types to start one,
// what it acts on, where its answers go — the process's own at the shell
// door — the one JSON object a command takes on stdin, a hook's among them,
// how a command ends it with an exit code without ending its caller, what a
// failure says, and how a command starts one detached, to outlive it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { isObject } = require('./manifest-io.cjs');
const { findStateRoot } = require('./state-root.cjs');

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
 * The shell door's call: the process's own directory, streams and stdin.
 * @returns {Call}
 */
function processCall() {
  // A terminal hands nothing over until someone types; a hook's JSON
  // arrives on a pipe.
  const terminal = process.stdin.isTTY;
  return {
    cwd: process.cwd(),
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
    stdin: () => (terminal ? '' : fs.readFileSync(0, 'utf8')),
    ...(terminal ? { terminal: { input: process.stdin, output: process.stdout } } : {}),
  };
}

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
 * The exit code a stop answers with. A stop that is no ExitSignal is a
 * handler that threw without answering, and gets the CLI's last word — the
 * message on stderr, exit 1.
 * @param {Call} call @param {unknown} err @returns {number}
 */
function exitCodeOf(call, err) {
  if (err instanceof ExitSignal) return err.code;
  call.err(messageOf(err) + '\n');
  return 1;
}

/**
 * The JSON Claude Code hands a hook on stdin; empty where none arrived or it
 * does not parse.
 * @param {Call} call @returns {Record<string, unknown>}
 */
function hookInput(call) {
  try {
    const input = JSON.parse(call.stdin());
    return input && typeof input === 'object' ? input : {};
  } catch {
    return {};
  }
}

/**
 * The folder a hook acts from: the invocation cwd when its repository holds
 * the state, else CLAUDE_PROJECT_DIR for a hook fired from a drifted cwd.
 * @param {string} cwd @returns {string}
 */
function hookProjectDir(cwd) {
  return findStateRoot(cwd) !== null ? cwd : (process.env.CLAUDE_PROJECT_DIR || cwd);
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

module.exports = { ENGINE_COMMAND, processCall, ExitSignal, messageOf, exitCodeOf, stdinObject, hookInput, hookProjectDir, launcher };
