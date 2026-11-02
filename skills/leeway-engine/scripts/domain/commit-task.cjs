'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the task a code commit names (6.3.1, 6.3.3–6.3.5, 12.9.6) —
// `commit --paths <file>… --task <unit> <N.M> -m "<message>"`, the door's
// half that is the task's, beside its paths and repos (engine.cjs):
//
// - The task must be one of those in flight in the calling conversation,
//   the one `CLAUDE_CODE_SESSION_ID` names, as its position records them
//   (conversation.cjs, `tasksInFlight`, the read the hook before Bash makes
//   too) — a builder's commands carry the conversation's id, so a commit
//   from its worktree finds its task. Refused, each with the way on: no
//   conversation, a unit the project lacks, a task id that does not read
//   `{phase}.{n}`, no task in flight — `task start` puts it there, again
//   after a `/clear`, which begins another conversation — and only other
//   tasks in flight, each named; from a worktree `task worktree` laid out
//   for another task in flight (task-worktree.cjs, conversation.cjs's
//   `taskAt`), any task but that one, naming it; and a task with a worktree
//   laid out for it from anywhere else, naming the worktree. A task with
//   none recorded commits from where it is called.
// - The project's checks run before the commit (15.8.3): its tests,
//   `environment.run.tests`, then each of its linters, `environment.linters`
//   (environment.cjs), in that order, each by `sh -c` in the code root of the
//   calling checkout, as a project's command runs (kernel/shell-command.cjs).
//   The first that fails refuses the commit, naming it, its exit code and
//   its output's last lines. The door runs them before any lock is taken, so
//   a check may run the engine.
// - The message is Claude's with a trailer naming the task's id
//   (task-id.cjs), `Leeway-Task: {id}` — never landing's `Task:` line, which
//   the landing drivers read as the task landed (landing-names.cjs). It joins
//   the trailers Claude's message ends in, as `git interpret-trailers` adds
//   one, where its last paragraph, past the subject, is all `Token: value`
//   lines; otherwise it opens a paragraph of its own.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { handedSession } = require('../kernel/process.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { runShellCommand, tailText } = require('../kernel/shell-command.cjs');
const { tasksInFlight, taskAt } = require('./conversation.cjs');
const { parseShownTask, shownTask, taskId, taskName } = require('./task-id.cjs');
const environment = require('./environment.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {{name: string, command: string}} Check */
/** @typedef {{name: string, exit: number}} CheckRun */

/** The trailer a work commit names its task in. */
const TRAILER = 'Leeway-Task';

/** A trailer's line, as git reads one: a token of letters, digits and hyphens, a colon, and its value. */
const TRAILER_LINE = /^[A-Za-z0-9-]+:[ \t]*\S/;

/** Starting a task, as its way on says it. @param {string} unit @param {string} shown */
const startCall = (unit, shown) => `\`engine task start ${unit} ${shown}\``;

/**
 * The task `unit` and `given` name, where it is in flight in the calling
 * conversation; refused otherwise.
 * @param {string} cwd @param {string} unit @param {string} given `{phase}.{n}`
 * @returns {TaskRef}
 */
function inFlightTask(cwd, unit, given) {
  const session = handedSession();
  if (session === null) {
    throw new Error('commit --task: no conversation is named, so no task is in flight — CLAUDE_CODE_SESSION_ID is unset; commit from the Claude Code conversation building the task');
  }
  if (workUnitNameRefusal(unit) !== null || !fs.existsSync(statePath(cwd, unit, 'manifest.json'))) {
    throw new Error(`commit --task: this project has no work unit "${unit}" — name the unit the task is in`);
  }
  const ref = shownRef(unit, given);
  const inFlight = tasksInFlight(session);
  const named = inFlight.find((task) => task.unit === unit && task.task === shownTask(ref));
  if (named !== undefined) return fromItsWorktree(session, cwd, ref, named.worktree);
  if (inFlight.length === 0) {
    throw new Error(`commit --task: no task is in flight in this conversation — start ${taskName(ref)} with ${startCall(unit, given)}, then commit again; a /clear begins another conversation, so a task started before one is started again after it`);
  }
  const others = inFlight.map((task) => `task ${task.task} of ${task.unit}`).join(', ');
  throw new Error(`commit --task: ${taskName(ref)} is not in flight in this conversation, ${others} ${inFlight.length === 1 ? 'is' : 'are'} — commit under the task the work is for, or start ${taskName(ref)} with ${startCall(unit, given)}`);
}

/**
 * The task in flight, where the call is made in its own worktree, or, with
 * none recorded for it, in no worktree of another task in flight; refused
 * otherwise, naming the worktree.
 * @param {string} session @param {string} cwd @param {TaskRef} ref @param {string|undefined} worktree the task's, where one is recorded
 * @returns {TaskRef}
 */
function fromItsWorktree(session, cwd, ref, worktree) {
  const owner = taskAt(session, cwd);
  if (owner !== null && (owner.unit !== ref.unit || owner.task !== shownTask(ref))) {
    throw new Error(`commit --task: the worktree at ${owner.worktree} is task ${owner.task} of ${owner.unit}'s — commit ${taskName(ref)}'s work from its own worktree, or this work under task ${owner.task}`);
  }
  if (worktree !== undefined && owner === null) {
    throw new Error(`commit --task: ${taskName(ref)} is built in its worktree at ${worktree}, and its branch is checked out there alone — commit its work from there`);
  }
  return ref;
}

/** The unit's task a shown id names; refused where it does not read as one. @param {string} unit @param {string} given */
function shownRef(unit, given) {
  try {
    return parseShownTask(unit, given);
  } catch {
    throw new Error(`commit --task: "${given}" is not a task — name it {phase}.{n}, as 1.2`);
  }
}

/** The project's checks, in the order they run: its tests, then each linter. @param {string} cwd @returns {Check[]} */
function checksOf(cwd) {
  const tests = environment.tests(cwd);
  return [...(tests === null ? [] : [{ name: 'tests', command: tests }]), ...environment.linters(cwd)];
}

/** A failed check's refusal. @param {Check} check @param {number} exit @param {string[]} tail */
function checkFailed({ name }, exit, tail) {
  return `commit --task: the check "${name}" failed with exit ${exit}, so nothing was committed — fix what it reports and commit again; `
    + `the Bash tool stops a call at two minutes unless given a longer timeout, so give the commit's call one where the checks run long. ${tailText(tail)}`;
}

/**
 * The project's checks run in the code root of the checkout `cwd` is in,
 * in order, the first that fails refused: each run, with its exit code.
 * @param {string} cwd @returns {CheckRun[]}
 */
function runChecks(cwd) {
  const root = codeRoot(cwd);
  /** @type {CheckRun[]} */
  const ran = [];
  for (const check of checksOf(cwd)) {
    const { exit, tail } = runShellCommand(root, check.command);
    if (exit !== 0) throw new Error(checkFailed(check, exit, tail));
    ran.push({ name: check.name, exit });
  }
  return ran;
}

/** A work commit's message: Claude's, and the trailer naming its task. @param {string} message @param {TaskRef} ref */
function workMessage(message, ref) {
  const text = message.trimEnd();
  const paragraphs = text.split(/\n[ \t]*\n/);
  const trailers = paragraphs.length > 1 && paragraphs[paragraphs.length - 1].split('\n').every((line) => TRAILER_LINE.test(line));
  return `${text}${trailers ? '\n' : '\n\n'}${TRAILER}: ${taskId(ref)}`;
}

module.exports = { TRAILER, inFlightTask, runChecks, workMessage };
