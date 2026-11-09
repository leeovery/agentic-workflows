'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the branch a task's work is built on, and where its own work
// starts in each repository holding it (12.7.10), which its pair's range
// (brief-records.cjs) and its figures (task-account.cjs) both read from, so
// neither counts what the task merged back from its chain, nor a
// quick-fix's task the fixes before it: the later of the commit it was laid
// out at (round-report.cjs, `laidOutOf`) — by `task worktree`, or a
// quick-fix's task at its first start, its one branch's tip then
// (fix-branch.cjs) — and the tip of the work below it (review-change.cjs,
// `workBelow`) that its branch holds since, merged back onto its chain,
// which a quick-fix's task has none of — else the branch the repository
// lands on, as the landing picks it. A task's branch is its own, named from
// its type and title; a quick-fix's, every task of it, the quick-fix's one
// branch, `fix/{unit}` (19.5.15).
// ---------------------------------------------------------------------------

const { laidOutOf } = require('./round-report.cjs');
const { taskBranch, quickFixBranch } = require('./landing-names.cjs');
const { quickFixBuild } = require('./derivations.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { taskName } = require('./task-id.cjs');
const { branches, branchesHeldBy, defaultBranch, landsOn, isAncestor, latestOf } = require('./landing-git.cjs');
const { remoteName } = require('./remote.cjs');
const { workBelow } = require('./review-change.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** The branch the project's own repository lands on, its child repositories unread. @param {string} cwd */
const projectLandsOn = (cwd) => defaultBranch(codeRoot(cwd), remoteName(cwd), false);

/** A base as git names it: a commit as it is, a branch by its ref. @param {string} base */
const baseRev = (base) => (/^[0-9a-f]{40}$/.test(base) ? base : `refs/heads/${base}`);

/** Whether the unit is built as a quick-fix. @param {string} cwd @param {string} unit */
const ofQuickFix = (cwd, unit) => {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest !== null && quickFixBuild(manifest);
};

/**
 * The branch the task's work is built on (the header's), refused for a
 * task of no quick-fix that has no type, its branch named from it.
 * @param {string} cwd @param {TaskRef} ref @param {{type: string|null, title: string}} task
 */
function workBranch(cwd, ref, { type, title }) {
  if (ofQuickFix(cwd, ref.unit)) return quickFixBranch(ref.unit);
  if (type === null) throw new Error(`${taskName(ref)} has no type in the tracker, and its branch is named from it`);
  return taskBranch(ref, type, title);
}

/**
 * Each repository's base for the task's own work (the header's), by
 * `holding`'s order: a commit or a branch.
 * @param {string} cwd @param {TaskRef} ref @param {Repo[]} holding @param {string} branch
 * @returns {string[]}
 */
function builtOnBases(cwd, ref, holding, branch) {
  const laid = laidOutOf(cwd, ref);
  const below = ofQuickFix(cwd, ref.unit) ? [] : workBelow(cwd, ref.unit, ref.phase).flatMap((task) => (task.type === null ? [] : [taskBranch(task.ref, task.type, task.title)]));
  return holding.map((repo) => {
    const local = branches(repo.path);
    const merged = branchesHeldBy(repo.path, `refs/heads/${branch}`);
    const at = laid[repo.dir];
    const under = [
      ...(at !== undefined && isAncestor(repo.path, at, `refs/heads/${branch}`) ? [{ base: at, commit: at }] : []),
      ...below.filter((other) => other !== branch && merged.has(other)).map((other) => ({ base: other, commit: /** @type {string} */ (local.get(other)) })),
    ];
    return under[latestOf(repo.path, under.map(({ commit }) => commit))]?.base ?? landsOn(cwd, repo);
  });
}

module.exports = { projectLandsOn, baseRev, workBranch, builtOnBases };
