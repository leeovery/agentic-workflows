'use strict';

// ---------------------------------------------------------------------------
// The guards — the hooks Claude Code runs before a tool call, each fed the
// call's JSON on stdin: `layout guard` before Write, Edit and NotebookEdit
// (domain/layout-hook), `brief guard` before Agent and SendMessage
// (domain/brief-guard), and `shell guard` before Bash (domain/shell-guard).
// Each answers in Claude Code's terms: silent where the call goes through as
// made; the hook's answer on stdout where it hands the call on changed; a
// refusal on stderr with exit 2, the code Claude Code blocks the call on.
// Any other failure lets the call through.
//
// A guard stands before every call of its tools, so the shell door runs it
// before the engine loads anything else (`guardDoor`, called first thing in
// engine.cjs), loading only the guard's own module; the in-process door runs
// it through the engine's dispatch as it does any command.
// ---------------------------------------------------------------------------

const { ExitSignal, exitCodeOf, hookInput, hookProjectDir, processCall } = require('./kernel/call.cjs');

/** @typedef {import('./kernel/call.cjs').Call} Call */
/** @typedef {{answer: object}|{refused: string}|null} GuardAnswer */
/** @typedef {(cwd: string, input: Record<string, unknown>) => GuardAnswer} Guard */

/** A refusal's reason as a guard's answer. @param {string|null} reason @returns {GuardAnswer} */
const refusing = (reason) => (reason === null ? null : { refused: reason });

/**
 * Each guard by its verb: its answer to a tool call made from the folder
 * `cwd`, its module loaded only when it runs.
 * @type {Readonly<Record<string, Guard>>}
 */
const GUARDS = Object.freeze({
  'layout guard': (cwd, input) => refusing(require('./domain/layout-hook.cjs').layoutRefusal(cwd, input)),
  'brief guard': (cwd, input) => require('./domain/brief-guard.cjs').guardDispatch(cwd, input),
  'shell guard': (cwd, input) => refusing(require('./domain/shell-guard.cjs').shellRefusal(cwd, input)),
});

/** Every guard's verb. */
const GUARD_VERBS = Object.freeze(Object.keys(GUARDS));

/**
 * The guard `verb` against a bound call, the tool call's folder its JSON's
 * `cwd`, else the folder a hook acts from: its answer written; a refusal
 * stops the command with exit 2, a stray argument with the usage and exit 1.
 * @param {Call} call @param {string} verb @param {string[]} argv the words after the verb
 */
function runGuard(call, verb, argv) {
  if (argv.length !== 0) {
    call.err(`Usage: engine ${verb}\n`);
    throw new ExitSignal(1);
  }
  const input = hookInput(call);
  const answer = GUARDS[verb](typeof input.cwd === 'string' ? input.cwd : hookProjectDir(call.cwd), input);
  if (answer === null) return;
  if ('answer' in answer) {
    call.out(`${JSON.stringify(answer.answer)}\n`);
    return;
  }
  call.err(`${answer.refused}\n`);
  throw new ExitSignal(2);
}

/**
 * The guard `argv` names, run at the shell door on the process's own
 * streams, its exit code left on the process: whether argv names one.
 * @param {string[]} argv @returns {boolean}
 */
function guardDoor(argv) {
  const verb = argv.slice(0, 2).join(' ');
  if (!Object.hasOwn(GUARDS, verb)) return false;
  const call = processCall();
  try {
    runGuard(call, verb, argv.slice(2));
  } catch (err) {
    process.exitCode = exitCodeOf(call, err);
  }
  return true;
}

module.exports = { GUARD_VERBS, runGuard, guardDoor };
