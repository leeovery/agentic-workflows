'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the branch a task's work is built on, and its own work there
// (12.7.10), which its pair's range (brief-records.cjs) and its figures
// (task-account.cjs) both read, so neither counts what the task merged back
// from its chain, nor a quick-fix's task another fix's.
//
// - A task's branch is its own, named from its type and title; a
//   quick-fix's, every task of it, the quick-fix's one branch, `fix/{unit}`
//   (19.5.15).
// - A task's own work starts, in each repository holding its branch, at the
//   later of the commit it was laid out at by `task worktree`
//   (round-report.cjs, `laidOutOf`) and the tip of the work below it
//   (review-change.cjs, `workBelow`) that its branch holds since, merged
//   back onto its chain — else at the branch the repository lands on, as
//   the landing picks it.
// - A quick-fix's task's own work is its own commits alone, wherever they
//   stand on the one branch the fixes share — a fix parked and built again
//   once another fix has its commits between its own (fix-aside.cjs): in
//   each repository holding the branch, those it holds past the branch the
//   repository lands on that the door stamped with the task
//   (commit-task.cjs), oldest first (`ownCommits`).
// ---------------------------------------------------------------------------

const { laidOutOf } = require('./round-report.cjs');
const { taskBranch, quickFixBranch } = require('./landing-names.cjs');
const { quickFixBuild } = require('./derivations.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { taskId, taskName } = require('./task-id.cjs');
const { branches, branchesHeldBy, defaultBranch, landsOn, isAncestor, latestOf, stampedPast } = require('./landing-git.cjs');
const { remoteName } = require('./remote.cjs');
const { workBelow } = require('./review-change.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** The door's stamp on a task's commit, read when asked: the door reads the task verbs, which read this module. */
const stampKey = () => require('./commit-task.cjs').TRAILER;

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

/**
 * A quick-fix's task's own commits in one repository holding the
 * quick-fix's branch (the header's), oldest first.
 * @param {string} cwd @param {TaskRef} ref @param {Repo} repo
 * @returns {{sha: string, subject: string}[]}
 */
function ownCommits(cwd, ref, repo) {
  const id = taskId(ref);
  return stampedPast(repo.path, `refs/heads/${quickFixBranch(ref.unit)}`, landsOn(cwd, repo), stampKey())
    .filter(({ value }) => value === id).map(({ sha, message }) => ({ sha, subject: message.split('\n')[0] }));
}

/**
 * Each repository of `holding` where a quick-fix's task has commits of its
 * own, with them (`ownCommits`).
 * @param {string} cwd @param {TaskRef} ref @param {Repo[]} holding
 */
const ownWork = (cwd, ref, holding) => holding.map((repo) => ({ repo, commits: ownCommits(cwd, ref, repo) })).filter(({ commits }) => commits.length > 0);

module.exports = { projectLandsOn, baseRev, ofQuickFix, workBranch, builtOnBases, ownWork };
