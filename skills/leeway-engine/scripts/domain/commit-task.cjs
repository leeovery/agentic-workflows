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
//   `taskAt`), any task but that one, naming it; a task with a worktree
//   laid out for it from anywhere else, naming the worktree; and, from a
//   checkout on a branch other than the task's, any task, naming the
//   worktree that has its branch out, so no task's commit lands on another
//   branch. A task with none recorded commits from where its branch is out
//   — a quick-fix's fix from the project's own checkout, on its branch, a
//   commit on any other naming that branch and the start that puts the
//   checkout there (fix-branch.cjs).
// - The project's checks run before the commit (15.8.3): its tests,
//   `environment.run.tests`, then each of its linters, `environment.linters`
//   (environment.cjs), in that order, each by `sh -c` in the code root of the
//   calling checkout, as a project's command runs (kernel/shell-command.cjs).
//   The first that fails refuses the commit, naming it, its exit code and
//   its output's last lines. The door runs them before any lock is taken, so
//   a check may run the engine.
// - A bugfix's task is held to its bug-proven check (bug-proven.cjs, 6.3.6):
//   the reproducing task's commits land with the tests failing, the answer
//   saying so, the linters held as ever (6.3.5); any other task's is refused
//   before any check runs until the bug is proven, then the test that proves
//   it runs after the tests as a check of its own, `reproducing test`, and
//   must pass (15.5.4). A unit of any other type is read no further than its
//   manifest.
// - The message is Claude's with a trailer naming the task's id
//   (task-id.cjs), `Leeway-Task: {id}` — never landing's `Task:` line, which
//   the landing drivers read as the task landed (landing-names.cjs). It joins
//   the trailers Claude's message ends in, as `git interpret-trailers` adds
//   one, where its last paragraph, past the subject, is all `Token: value`
//   lines; otherwise it opens a paragraph of its own.
// ---------------------------------------------------------------------------

const { handedSession } = require('../kernel/process.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, STATE_BRANCH } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { runShellCommand, tailText } = require('../kernel/shell-command.cjs');
const { tryGit } = require('../kernel/git.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { tasksInFlight, taskAt } = require('./conversation.cjs');
const { taskOfBranch } = require('./landing-names.cjs');
const { taskWorktree } = require('./landing-git.cjs');
const { fixWayOn } = require('./fix-branch.cjs');
const { quickFixBuild, FIXES_PHASE } = require('./derivations.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { parseShownTask, shownTask, taskId, taskName } = require('./task-id.cjs');
const { isBugfix, doorGate } = require('./bug-proven.cjs');
const environment = require('./environment.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** A check the door runs: its name and command, why it may fail where it may, and the way on where it fails and may not. @typedef {{name: string, command: string, allowed?: string, way?: string}} Check */
/** A check run: its name and exit code, and where it failed and may, why, with its output's last lines. @typedef {{name: string, exit: number, allowed?: string, tail?: string[]}} CheckRun */

/** The trailer a work commit names its task in. */
const TRAILER = 'Leeway-Task';

/** A trailer's line, as git reads one: a token of letters, digits and hyphens, a colon, and its value. */
const TRAILER_LINE = /^[A-Za-z0-9-]+:[ \t]*\S/;

/** Starting a task, as its way on says it. @param {string} unit @param {string} shown */
const startCall = (unit, shown) => `\`engine task start ${unit} ${shown}\``;

/**
 * The task `unit` and `given` name, where it is in flight in the calling
 * conversation, with its unit's manifest; refused otherwise.
 * @param {string} cwd @param {string} unit @param {string} given `{phase}.{n}`
 * @returns {{ref: TaskRef, manifest: Record<string, any>}}
 */
function inFlightTask(cwd, unit, given) {
  const session = handedSession();
  if (session === null) {
    throw new Error('commit --task: no conversation is named, so no task is in flight — CLAUDE_CODE_SESSION_ID is unset; commit from the Claude Code conversation building the task');
  }
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`commit --task: this project has no work unit "${unit}" — name the unit the task is in`);
  const ref = shownRef(unit, given);
  const inFlight = tasksInFlight(session);
  const named = inFlight.find((task) => task.unit === unit && task.task === shownTask(ref));
  if (named !== undefined) return { ref: fromItsWorktree(session, cwd, ref, named.worktree), manifest };
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
  refuseOtherBranch(cwd, ref);
  return ref;
}

/**
 * Refuse a commit of the task from a checkout on a branch other than the
 * task's, naming the worktree that has the task's branch out — or, where
 * none has, the verb that lays one out; a quick-fix's fix, built in the
 * project's own checkout, naming its branch and the start that puts the
 * checkout there (fix-branch.cjs). A detached HEAD and the state branch are
 * the door's own to refuse (engine.cjs).
 * @param {string} cwd @param {TaskRef} ref
 */
function refuseOtherBranch(cwd, ref) {
  const root = codeRoot(cwd);
  const branch = tryGit(root, ['symbolic-ref', '-q', '--short', 'HEAD'])?.trim();
  const own = branch === undefined ? null : taskOfBranch(ref.unit, branch);
  if (branch === undefined || branch === STATE_BRANCH || (own !== null && own.phase === ref.phase && own.n === ref.n)) return;
  throw new Error(`commit --task: this checkout has ${branch} out, not ${taskName(ref)}'s branch, so its commit would land on another branch — ${wayOn(cwd, root, ref)}`);
}

/** Where the task's commit is made instead (`refuseOtherBranch`). @param {string} cwd @param {string} root @param {TaskRef} ref */
function wayOn(cwd, root, ref) {
  if (quickFixBuild(loadWorkUnitManifest(cwd, ref.unit)) && ref.phase === FIXES_PHASE.number) return fixWayOn(root, ref);
  const holder = taskWorktree(root, ref);
  return holder === undefined
    ? `no worktree has it out — \`engine task worktree ${ref.unit} ${shownTask(ref)}\` lays one out, from a worktree of Claude Code's isolation`
    : `commit it from ${holder.path}, where its branch is checked out`;
}

/** The unit's task a shown id names; refused where it does not read as one. @param {string} unit @param {string} given */
function shownRef(unit, given) {
  try {
    return parseShownTask(unit, given);
  } catch {
    throw new Error(`commit --task: "${given}" is not a task — name it {phase}.{n}, as 1.2`);
  }
}

/** Why the reproducing task's tests may fail, as the door's answer says it. */
const TESTS_MAY_FAIL = 'the tests failed, as the reproducing task\'s commits may: its test reproduces the bug before any fix lands (6.3.5, 15.5.1)';

/**
 * What a bugfix's task adds to the project's checks (bug-proven.cjs), read
 * for a bugfix alone: the tests allowed to fail, or the reproducing test to
 * run after them; refused where the task's code waits on its bug proven.
 * @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref
 * @returns {{testsMayFail?: true, test?: Check}}
 */
function bugChecks(cwd, manifest, ref) {
  if (!isBugfix(manifest)) return {};
  const gate = doorGate(cwd, manifest, ref, projectRepos(codeRoot(cwd)));
  if ('unproven' in gate) throw new Error(`commit --task: ${gate.unproven}`);
  return 'testsMayFail' in gate ? { testsMayFail: true } : { test: { name: 'reproducing test', command: gate.test, way: gate.way } };
}

/**
 * The checks the door runs for the task `ref` of the unit `manifest` holds,
 * in order: the project's tests, then a bugfix's reproducing test, then
 * each linter; refused, before any runs, where the task's code waits on its
 * bug proven (the header's).
 * @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref @returns {Check[]}
 */
function checksFor(cwd, manifest, ref) {
  const { testsMayFail, test } = bugChecks(cwd, manifest, ref);
  const tests = environment.tests(cwd);
  return [
    ...(tests === null ? [] : [{ name: 'tests', command: tests, ...(testsMayFail ? { allowed: TESTS_MAY_FAIL } : {}) }]),
    ...(test === undefined ? [] : [test]),
    ...environment.linters(cwd),
  ];
}

/** A failed check's refusal. @param {Check} check @param {number} exit @param {string[]} tail */
function checkFailed({ name, way = 'fix what it reports and commit again' }, exit, tail) {
  return `commit --task: the check "${name}" failed with exit ${exit}, so nothing was committed — ${way}; `
    + `the Bash tool stops a call at two minutes unless given a longer timeout, so give the commit's call one where the checks run long. ${tailText(tail)}`;
}

/**
 * The checks run in the code root of the checkout `cwd` is in, in order,
 * the first that fails and may not refused: each run, with its exit code,
 * and one that failed and may, why, with its output's last lines.
 * @param {string} cwd @param {Check[]} checks @returns {CheckRun[]}
 */
function runChecks(cwd, checks) {
  const root = codeRoot(cwd);
  /** @type {CheckRun[]} */
  const ran = [];
  for (const check of checks) {
    const { exit, tail } = runShellCommand(root, check.command);
    if (exit !== 0 && check.allowed === undefined) throw new Error(checkFailed(check, exit, tail));
    ran.push({ name: check.name, exit, ...(exit === 0 ? {} : { allowed: check.allowed, tail }) });
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

module.exports = { TRAILER, inFlightTask, checksFor, runChecks, workMessage };
