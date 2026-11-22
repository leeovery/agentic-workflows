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
//   latest of the commit it was laid out at by `task worktree`
//   (round-report.cjs, `laidOutOf`), the tip of the work below it
//   (review-change.cjs, `workBelow`) that its branch holds since, merged
//   back onto its chain — else the branch the repository lands on, as the
//   landing picks it, where its branch holds that — and where its own
//   commits start, as the one read of whose work a commit is reads it
//   (task-landed.cjs, `ownStart`, R32), so the person's own commit below
//   its first is no work of its. Where those make no one line — later work
//   merged back past its first commit — the latest of the others.
// - A quick-fix's task's own work is its own commits alone, wherever they
//   stand on the one branch the fixes share — a fix parked and built again
//   once another fix has its commits between its own (fix-aside.cjs): in
//   each repository holding the branch, those it holds past the branch the
//   repository lands on that the door stamped with the task
//   (commit-task.cjs), oldest first, a merge among them only where it
//   brings in that branch, here or as last fetched, or the host's copy of
//   the quick-fix's branch as last fetched — as a one-line task's merge of
//   either, settling their conflict, is its change — and no merge of
//   another: the one rule its own commits are read by everywhere
//   (`ownCommits`; landing-git.cjs, `quickFixMerges`).
// - A one-line task, the orchestrator's own work, has no rounds and no
//   account to prove it built, so it is built once its branch holds work of
//   its own (`builtOneLine`): in a repository holding it, a commit the door
//   stamped with the task, merges aside — but on a quick-fix's branch, one
//   among its own commits there — past the branch the repository lands on,
//   made since anything added to it: naming as many additions as
//   the task holds (commit-task.cjs, `ADDITIONS`), so a Comment at its gate
//   takes it off its gate until its change is committed. It finished as the newest commit on its branch was made
//   (`oneLineFinished`), the time the board says it finished.
// ---------------------------------------------------------------------------

const { laidOutOf } = require('./round-report.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { taskBranch, quickFixBranch } = require('./landing-names.cjs');
const { quickFixBuild } = require('./derivations.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { taskId, taskName } = require('./task-id.cjs');
const { branches, branchesHeldBy, defaultBranch, landingBranch, landingRev, quickFixMerges, isAncestor, latestOf, stampedPast, holdingBranch } = require('./landing-git.cjs');
const { remoteName } = require('./remote.cjs');
const { workBelow } = require('./review-change.cjs');
const { repoLanded } = require('./task-landed.cjs');
const { dayBefore } = require('./dates.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { git } = require('../kernel/git.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** The door's stamp on a task's commit, read when asked: the door reads the task verbs, which read this module. */
const stampKey = () => require('./commit-task.cjs').TRAILER;

/** The project's own repository's default branch, its child repositories unread. @param {string} cwd */
const projectDefault = (cwd) => defaultBranch(codeRoot(cwd), remoteName(cwd), false);

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

/** A base a task's own work may start at: as the range names it, and its commit. @typedef {{base: string, commit: string}} Under */

/** The latest of `under`, where they make one line, else undefined. @param {Repo} repo @param {Under[]} under */
const latestUnder = (repo, under) => under[latestOf(repo.path, under.map(({ commit }) => commit))];

/**
 * Each repository's base for the task's own work (the header's), by
 * `holding`'s order: a commit or a branch.
 * @param {string} cwd @param {TaskRef} ref @param {Repo[]} holding @param {string} branch
 * @returns {string[]}
 */
function builtOnBases(cwd, ref, holding, branch) {
  const laid = laidOutOf(cwd, ref);
  const below = workBelow(cwd, ref.unit, ref.phase).flatMap((task) => (task.type === null ? [] : [taskBranch(task.ref, task.type, task.title)]));
  const since = dayBefore(manifestOf(stateRoot(cwd), ref.unit)?.created);
  return holding.map((repo) => {
    const local = branches(repo.path);
    const merged = branchesHeldBy(repo.path, `refs/heads/${branch}`);
    const landsOn = landingBranch(cwd, repo, ref.unit);
    const at = laid[repo.dir];
    /** @type {Under[]} */
    const under = [
      ...(at !== undefined && isAncestor(repo.path, at, `refs/heads/${branch}`) ? [{ base: at, commit: at }] : []),
      ...below.filter((other) => other !== branch && merged.has(other)).map((other) => ({ base: other, commit: /** @type {string} */ (local.get(other)) })),
    ];
    const floor = under.length > 0 || !merged.has(landsOn) ? under : [{ base: landsOn, commit: /** @type {string} */ (local.get(landsOn)) }];
    const start = repoLanded(repo.path, ref.unit, landingRev(cwd, repo, ref.unit), { since }).ownStart(ref);
    const own = start === null ? undefined : latestUnder(repo, [...floor, { base: start, commit: start }]);
    return (own ?? latestUnder(repo, under))?.base ?? landsOn;
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
  return stampedOn(cwd, ref.unit, repo, quickFixBranch(ref.unit))
    .filter(({ value }) => value === id).map(({ sha, message }) => ({ sha, subject: message.split('\n')[0] }));
}

/**
 * The commits a task's branch holds past the branch the repository lands
 * the unit on, with the door's stamp each carries (the header's): merges
 * aside, but, on a quick-fix's branch, one its own by the one rule its
 * own commits are read by (`quickFixMerges`).
 * @param {string} cwd @param {string} unit @param {Repo} repo @param {string} branch
 */
function stampedOn(cwd, unit, repo, branch) {
  const how = branch === quickFixBranch(unit) ? { merges: quickFixMerges(cwd, repo, unit) } : {};
  return stampedPast(repo.path, `refs/heads/${branch}`, landingBranch(cwd, repo, unit), stampKey(), null, how);
}

/**
 * Each repository of `holding` where a quick-fix's task has commits of its
 * own, with them (`ownCommits`).
 * @param {string} cwd @param {TaskRef} ref @param {Repo[]} holding
 */
const ownWork = (cwd, ref, holding) => holding.map((repo) => ({ repo, commits: ownCommits(cwd, ref, repo) })).filter(({ commits }) => commits.length > 0);

/** How many additions a one-line task's commit names (the header's), none where it names none. @param {string} message */
function additionsNamed(message) {
  const named = new RegExp(`^${require('./commit-task.cjs').ADDITIONS}:[ \\t]*(\\d+)$`, 'm').exec(message);
  return named === null ? 0 : Number(named[1]);
}

/**
 * Whether a one-line task is built (the header's), its detail as the
 * tracker holds it.
 * @param {string} cwd @param {TaskRef} ref @param {{type: string|null, title: string, additions: unknown[]}} [task]
 */
function builtOneLine(cwd, ref, task = require('./task-verbs.cjs').trackedTask(cwd, ref)) {
  const branch = workBranch(cwd, ref, task);
  const { holding } = holdingBranch(ref.unit, projectRepos(codeRoot(cwd)), branch);
  const id = taskId(ref);
  const own = ({ value, message }) => value === id && additionsNamed(message) >= task.additions.length;
  return holding.some((repo) => stampedOn(cwd, ref.unit, repo, branch).some(own));
}

/**
 * When a one-line task finished (the header's): the newest commit on its
 * branch in any repository holding it, as ISO time; null where none does.
 * @param {string} cwd @param {TaskRef} ref
 * @returns {string|null}
 */
function oneLineFinished(cwd, ref) {
  const branch = workBranch(cwd, ref, require('./task-verbs.cjs').trackedTask(cwd, ref));
  const { holding } = holdingBranch(ref.unit, projectRepos(codeRoot(cwd)), branch);
  const times = holding.map((repo) => git(repo.path, ['log', '-1', '--format=%cI', `refs/heads/${branch}`]).trim()).sort();
  return times.at(-1) ?? null;
}

module.exports = { projectDefault, baseRev, ofQuickFix, workBranch, builtOnBases, ownWork, builtOneLine, oneLineFinished };
