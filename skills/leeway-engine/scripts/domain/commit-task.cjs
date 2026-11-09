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
//   `{phase}.{n}`, a task the tracker holds ended, which takes no start —
//   naming, for a quick-fix's fix, the start of the next fix not ended, and
//   a task of its own made; no task in flight — `task start` puts it there,
//   again after a `/clear`, which begins another conversation — and only other
//   tasks in flight, each named; from a worktree `task worktree` laid out
//   for another task in flight (task-worktree.cjs, conversation.cjs's
//   `taskAt`), any task but that one, naming it; a quick-fix's task that
//   does not hold its one checkout — parked on a question, or freed and
//   waiting behind the fix that holds it — so no commit carries another
//   fix's work under its stamp, naming the fix holding the checkout and the
//   start that takes it back (`refuseOutOfTurn`, task-verbs.cjs's
//   `stepTurn`, 19.5.23); a task with a worktree
//   laid out for it from anywhere else, naming the worktree; from a
//   checkout on a branch other than the task's, any task, naming the
//   worktree that has its branch out, so no task's commit lands on another
//   branch; and a quick-fix's commit git would date before the day before
//   its unit was made, as a clock behind dates it, which no landing would
//   read as the unit's work (landing.cjs), naming the clock and the commit
//   made again (`refuseClockBehind`). A task with none recorded commits
//   from where its branch is out — a quick-fix's task from the project's
//   own checkout, on the quick-fix's one branch, a commit on any other
//   naming that branch and the start that puts the checkout there
//   (fix-branch.cjs). A quick-fix's
//   task done whose work is neither landed nor on the quick-fix's branch, as
//   a branch cut again leaves a commit that did not apply there, takes its
//   change made again though it has ended and is in flight nowhere
//   (fix-end.cjs, `remakesDone`), from the project's own checkout on the
//   branch alone. Each repository nested in the project that a quick-fix's
//   task commits in is put on the quick-fix's branch there first, made
//   where it lacks one (`onWorkBranch`, fix-branch.cjs), so its share of the
//   fix lands with the quick-fix's pull request there (7.2.24), and, once
//   the checks pass, recorded in the unit's state before the commit
//   (`recordWork`), its state commit's warnings the answer's.
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
const { taskOfBranch, quickFixBranch } = require('./landing-names.cjs');
const { taskWorktree, committerTime } = require('./landing-git.cjs');
const { quickFixBuild, FIXES_PHASE } = require('./derivations.cjs');
const fixEnd = () => require('./fix-end.cjs');
const fixBranch = () => require('./fix-branch.cjs');
const landing = () => require('./landing.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { parseShownTask, sameTask, shownTask, taskId, taskName } = require('./task-id.cjs');
const { isBugfix, doorGate } = require('./bug-proven.cjs');
const environment = require('./environment.cjs');
const { trackedPhase, ENDED, stepTurn, turnEnds } = require('./task-verbs.cjs');

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
  if (named !== undefined) {
    if (quickFixBuild(manifest)) refuseOutOfTurn(cwd, ref, manifest);
    return { ref: fromItsWorktree(session, cwd, ref, named.worktree), manifest };
  }
  if (fixEnd().remakesDone(cwd, ref)) {
    refuseOtherBranch(cwd, ref);
    return { ref, manifest };
  }
  refuseEnded(cwd, ref, manifest);
  if (inFlight.length === 0) {
    throw new Error(`commit --task: no task is in flight in this conversation — start ${taskName(ref)} with ${startCall(unit, given)}, then commit again; a /clear begins another conversation, so a task started before one is started again after it`);
  }
  const others = inFlight.map((task) => `task ${task.task} of ${task.unit}`).join(', ');
  throw new Error(`commit --task: ${taskName(ref)} is not in flight in this conversation, ${others} ${inFlight.length === 1 ? 'is' : 'are'} — commit under the task the work is for, or start ${taskName(ref)} with ${startCall(unit, given)}`);
}

/**
 * Refuse a commit under a quick-fix's task that does not hold its one
 * checkout (the header's): one in progress that is not the turn's in
 * flight is behind it, or parked.
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's
 */
function refuseOutOfTurn(cwd, ref, manifest) {
  const turn = stepTurn(cwd, ref.unit, manifest);
  const shown = shownTask(ref);
  if (turn?.inFlight === shown) return;
  const back = `${taskName(ref)}'s change is committed once it holds the checkout again, started again with ${startCall(ref.unit, shown)}`;
  if (turn !== null && turn.behind.includes(shown)) {
    throw new Error(`commit --task: task ${turn.inFlight} holds ${ref.unit}'s one checkout, and ${taskName(ref)} waits behind it, so a commit now would carry task ${turn.inFlight}'s work under ${taskName(ref)}'s stamp — ${back}, once ${turnEnds(turn)}`);
  }
  const holder = turn === null ? 'no fix holds it now' : `task ${turn.inFlight} holds it, and a commit now would carry its work under ${taskName(ref)}'s stamp`;
  throw new Error(`commit --task: a question parks ${taskName(ref)}, so it holds no part of ${ref.unit}'s one checkout — ${holder}; ${back}, once the answer frees it`);
}

/**
 * Refuse a commit under a task the tracker holds ended, which takes no more
 * work and no start: naming, for a quick-fix's fix, the start of the next
 * fix not ended, where one is — the same kind of work — and the making of a
 * task of its own.
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's
 */
function refuseEnded(cwd, ref, manifest) {
  const tasks = trackedPhase(cwd, ref.unit, ref.phase).tasks ?? [];
  const task = tasks.find((held) => held.ref.n === ref.n);
  if (task === undefined || !ENDED.includes(task.status)) return;
  const fix = quickFixBuild(manifest) && ref.phase === FIXES_PHASE.number;
  const next = fix ? tasks.find((held) => held.ref.n > ref.n && !ENDED.includes(held.status)) : undefined;
  const own = `make it a task of its own with \`engine task create ${ref.unit} ${ref.phase} --file <task.md>\``;
  const way = next === undefined ? own : `commit it under the fix it is for — start the next with ${startCall(ref.unit, shownTask(next.ref))} — or ${own}`;
  throw new Error(`commit --task: ${taskName(ref)} is ${task.status}, and a task ended takes no more work — ${way}`);
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
 * none has, the verb that lays one out; a quick-fix's task, built in the
 * project's own checkout on the quick-fix's one branch, naming that branch
 * and the start that puts the checkout there (fix-branch.cjs). A detached
 * HEAD and the state branch are the door's own to refuse (engine.cjs).
 * @param {string} cwd @param {TaskRef} ref
 */
function refuseOtherBranch(cwd, ref) {
  const root = codeRoot(cwd);
  const branch = tryGit(root, ['symbolic-ref', '-q', '--short', 'HEAD'])?.trim();
  if (branch === undefined || branch === STATE_BRANCH) return;
  const quickFix = quickFixBuild(loadWorkUnitManifest(cwd, ref.unit));
  const own = taskOfBranch(ref.unit, branch);
  if (quickFix ? branch === quickFixBranch(ref.unit) : own !== null && sameTask(own, ref)) return;
  const whose = quickFix ? `${ref.unit}'s branch` : `${taskName(ref)}'s branch`;
  throw new Error(`commit --task: this checkout has ${branch} out, not ${whose}, so its commit would land on another branch — ${quickFix ? fixBranch().branchWayOn(ref) : wayOn(root, ref)}`);
}

/** Where the task's commit is made instead (`refuseOtherBranch`). @param {string} root @param {TaskRef} ref */
function wayOn(root, ref) {
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

/**
 * Each nested repository a quick-fix's task commits in put on the
 * quick-fix's branch (`putOnBranch`, fix-branch.cjs); nothing for a task of
 * any other unit.
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's @param {import('../kernel/repos.cjs').Repo[]} repos those the commit commits in
 */
function onWorkBranch(cwd, ref, manifest, repos) {
  if (quickFixBuild(manifest)) fixBranch().putOnBranch(cwd, ref.unit, repos);
}

/**
 * Refuse a quick-fix's commit, nothing moved, where git would date it
 * before the unit's work is read from (`workFrom`, landing.cjs), as a clock
 * behind dates it, so no landing would read it as the unit's work, naming
 * the way on; nothing for a task of any other unit.
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's
 */
function refuseClockBehind(cwd, ref, manifest) {
  if (!quickFixBuild(manifest)) return;
  const at = committerTime(codeRoot(cwd));
  if (at >= landing().workFrom(manifest)) return;
  throw new Error(`commit --task: git would date this commit ${new Date(at).toISOString().slice(0, 10)}, before ${ref.unit} was made on ${manifest.created}, so no landing would read it as ${ref.unit}'s work, and nothing moved — set this machine's clock right, then commit again`);
}

/**
 * Each nested repository a quick-fix's task commits in recorded in the
 * unit's state, before the commit (`recordRepos`, fix-branch.cjs): what
 * that warned of; nothing for a task of any other unit.
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's @param {import('../kernel/repos.cjs').Repo[]} repos those the commit commits in
 * @returns {string[]}
 */
function recordWork(cwd, ref, manifest, repos) {
  return quickFixBuild(manifest) ? fixBranch().recordRepos(cwd, ref.unit, repos) : [];
}

/** A work commit's message: Claude's, and the trailer naming its task. @param {string} message @param {TaskRef} ref */
function workMessage(message, ref) {
  const text = message.trimEnd();
  const paragraphs = text.split(/\n[ \t]*\n/);
  const trailers = paragraphs.length > 1 && paragraphs[paragraphs.length - 1].split('\n').every((line) => TRAILER_LINE.test(line));
  return `${text}${trailers ? '\n' : '\n\n'}${TRAILER}: ${taskId(ref)}`;
}

module.exports = { TRAILER, inFlightTask, refuseClockBehind, onWorkBranch, checksFor, runChecks, recordWork, workMessage };
