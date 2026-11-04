'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a task's own work starts in each repository holding
// its branch (12.7.10), which its pair's range (brief-records.cjs) and its
// figures (task-account.cjs) both read from, so neither counts what the
// task merged back from its chain: the later of the commit `task worktree`
// laid it out at (round-report.cjs, `laidOutOf`) and the tip of the work
// below it (review-change.cjs, `workBelow`) that its branch holds since,
// merged back onto its chain — else the branch the repository lands on,
// as the landing picks it.
// ---------------------------------------------------------------------------

const { laidOutOf } = require('./round-report.cjs');
const { taskBranch } = require('./landing-names.cjs');
const { branches, branchesHeldBy, defaultBranch, isAncestor, latestOf } = require('./landing-git.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');
const { workBelow } = require('./review-change.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** The branch a repository lands on (landing-git.cjs). @param {string} cwd @param {Repo} repo */
function landsOn(cwd, repo) {
  return defaultBranch(repo.path, repo.dir === '' ? remoteName(cwd) : nestedRemoteName(repo.path), repo.dir !== '');
}

/** A base as git names it: a commit as it is, a branch by its ref. @param {string} base */
const baseRev = (base) => (/^[0-9a-f]{40}$/.test(base) ? base : `refs/heads/${base}`);

/**
 * Each repository's base for the task's own work (the header's), by
 * `holding`'s order: a commit or a branch.
 * @param {string} cwd @param {TaskRef} ref @param {Repo[]} holding @param {string} branch
 * @returns {string[]}
 */
function builtOnBases(cwd, ref, holding, branch) {
  const laid = laidOutOf(cwd, ref);
  const below = workBelow(cwd, ref.unit, ref.phase).flatMap((task) => (task.type === null ? [] : [taskBranch(task.ref, task.type, task.title)]));
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

module.exports = { landsOn, baseRev, builtOnBases };
