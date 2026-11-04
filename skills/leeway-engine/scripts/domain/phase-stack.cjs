'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a phase's stack as the project's repositories hold it, read
// off git for what judges the phase whole — the phase review's brief
// (brief-records.cjs) and the phase's close (phase-checks.cjs) — and the
// stack the review phase reads of the unit's tasks not landed, whatever
// their phases, which stack on one another (review-change.cjs). In each
// repository holding work on the branch of a task of the phase not closed
// (landing-git.cjs, `holdingBranch`), the stack's tip is the branch every
// other the phase's tasks hold there descends from. The phase's tips — each
// repository by its name, at the commit its tip is at, as a run names its
// commits (runs.cjs) — are the code the phase's runs are judged against.
// Refused where a task has no type, from which its branch is named; where
// the tasks are no one stack in a repository; and where no repository holds
// work on them.
// ---------------------------------------------------------------------------

const { git } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos, repoName } = require('../kernel/repos.cjs');
const { taskName, phaseName } = require('./task-id.cjs');
const { taskBranch } = require('./landing-names.cjs');
const { branches, holdingBranches, latestOf, plain } = require('./landing-git.cjs');

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./runs.cjs').RepoCommit} RepoCommit */
/**
 * A phase's stack: the project's repositories, the stack's tip in each
 * holding its work, and the phase as a refusal names it.
 * @typedef {{repos: Repo[], tips: Map<Repo, string>, what: string}} PhaseStack
 */

/** A repository as a refusal names it. @param {Repo} repo */
const repoNamed = (repo) => (repo.dir === '' ? 'the project\'s repository' : `\`${plain(repo.dir)}\``);

/**
 * The branch of a task of the phase, among those a repository holds work
 * on, that every other descends from: the tip of the stack they make there.
 * @param {Repo} repo @param {string[]} held @param {string} what the phase, as a refusal names it
 */
function stackTip(repo, held, what) {
  const local = branches(repo.path);
  const tip = held[latestOf(repo.path, held.map((branch) => /** @type {string} */ (local.get(branch))))];
  if (tip === undefined) throw new Error(`${what}'s tasks are no one stack in ${repoNamed(repo)} — ${held.join(', ')} each hold work another lacks; chain them before its range is read`);
  return tip;
}

/**
 * The phase's stack, from its tasks as the tracker holds them (the
 * header's).
 * @param {string} cwd @param {string} unit @param {number} phase @param {TaskDetail[]} tasks the phase's, whole
 * @returns {PhaseStack}
 */
function phaseStack(cwd, unit, phase, tasks) {
  return stackOf(projectRepos(codeRoot(cwd)), unit, tasks, phaseName(unit, phase));
}

/**
 * The stack the tasks not closed among `tasks` make (the header's).
 * @param {Repo[]} repos the project's @param {string} unit @param {TaskDetail[]} tasks whole @param {string} what the tasks' owner, as a refusal names it
 * @returns {PhaseStack}
 */
function stackOf(repos, unit, tasks, what) {
  const named = tasks.filter(({ status }) => status !== 'closed').map((task) => {
    if (task.type === null) throw new Error(`${taskName(task.ref)} has no type in the tracker, and its branch is named from it`);
    return taskBranch(task.ref, task.type, task.title);
  });
  const held = holdingBranches(unit, repos, named).map(({ holding }) => holding);
  const holding = repos.map((repo) => ({ repo, on: named.filter((_, at) => held[at].includes(repo)) })).filter(({ on }) => on.length > 0);
  if (holding.length === 0) throw new Error(`no repository of the project holds work on ${what}'s tasks`);
  return { repos, tips: new Map(holding.map(({ repo, on }) => [repo, stackTip(repo, on, what)])), what };
}

/** The stack's tips, each repository by its name at the commit its tip is at. @param {PhaseStack} stack @returns {RepoCommit[]} */
function tipCommits({ tips }) {
  return [...tips].map(([repo, tip]) => ({ repo: repoName(repo), commit: git(repo.path, ['rev-parse', `refs/heads/${tip}`]).trim() }));
}

module.exports = { repoNamed, phaseStack, stackOf, tipCommits };
