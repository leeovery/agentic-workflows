'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the whole change the review phase holds against the spec
// (14.1.1), read off git in every repository of the project holding the
// unit's work (7.2.17) — what an area pair's and the test reader's briefs
// draw its commits and scratch worktree from (brief-records.cjs), and the
// code a round's scenarios are judged at (runs.cjs, 15.3.3).
//
// By the review phase every phase of the cut has closed, each merged onto
// the branch it lands on — or, in step, its stack waiting at its gate
// (7.2.4). A failing round's fix phase is built on the unit's work not
// landed below it, in every repository holding that work, so the work not
// landed is one stack, its tip holding every fix (`fixBase`, the layout
// task-worktree.cjs makes and `land open` holds a fix task to); in auto the
// fix phases land only at finish, in that order (7.2.6), and in step each
// merges at its gate before the next round is read (14.6.2,
// review-phase.cjs). The change is the unit's own work, never what others
// landed beside it — a quick-fix taking its turn (12.7.8), the person's own
// commits, another unit's phase. So in each repository:
// - its base is the branch given where it has that branch, else the branch
//   it lands on (landing-git.cjs); a base given that no repository has is
//   refused, so a misnamed one never passes as the default;
// - the unit's landings are the commits on its base's first-parent line
//   whose message names a task of the unit (landing-names.cjs), oldest
//   first, each read against its first parent;
// - the work not landed is every task of the unit's phases, cut and fix,
//   done in the tracker and not landed anywhere (landing.cjs); the stack
//   those tasks make there (phase-stack.cjs), read from where its tip
//   leaves the base — a task not done holds nothing yet to review;
// - the change's tip, where its scratch worktree and its runs stand, is
//   that stack's tip where the repository holds such work, else its base.
// A repository with neither landings nor work not landed holds none of the
// change. Refused where no repository holds any.
// ---------------------------------------------------------------------------

const { git, tryGit } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { projectRepos, repoName } = require('../kernel/repos.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { isFixPhase } = require('./derivations.cjs');
const { trackedLists, trackedPhase } = require('./task-verbs.cjs');
const { landedTasks } = require('./landing.cjs');
const { tasksOfMessage } = require('./landing-names.cjs');
const { branches, defaultBranch, mergeBase } = require('./landing-git.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');
const { stackOf } = require('./phase-stack.cjs');
const { shownTask } = require('./task-id.cjs');

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./runs.cjs').RepoCommit} RepoCommit */

/**
 * One part of the change in a repository, read `from..to`: a landing, by
 * its commit and its subject, or the work not landed, by its stack's tip.
 * @typedef {{from: string, to: string, landed: {commit: string, subject: string}|null, branch: string|null}} ChangePart
 */
/**
 * The change in one repository: its base, its parts in order — its
 * landings, then its work not landed — and its tip by the branch it is on
 * and by its commit.
 * @typedef {{repo: Repo, base: string, parts: ChangePart[], tip: string, commit: string}} ChangeIn
 */
/** The whole change: the project's repositories, and the change in each holding it, the project's own first. @typedef {{repos: Repo[], holding: ChangeIn[]}} Change */

/** The branch a repository lands on, null where it names none. @param {string} cwd @param {Repo} repo */
function landsOn(cwd, repo) {
  try {
    return defaultBranch(repo.path, repo.dir === '' ? remoteName(cwd) : nestedRemoteName(repo.path), repo.dir !== '');
  } catch {
    return null;
  }
}

/** Where a part starting before a commit starts: its first parent, or the empty tree before a first commit. @param {Repo} repo @param {string} commit */
function before(repo, commit) {
  return tryGit(repo.path, ['rev-parse', '--verify', `${commit}^`])?.trim() ?? git(repo.path, ['hash-object', '-t', 'tree', '--stdin'], undefined, '').trim();
}

/**
 * The unit's landings on a branch's first-parent line, oldest first, each a
 * part read against its first parent.
 * @param {Repo} repo @param {string} branch @param {string} unit @returns {ChangePart[]}
 */
function landings(repo, branch, unit) {
  const logged = git(repo.path, ['log', '--first-parent', '--reverse', '-z', '--format=%H%n%s%n%B', '--fixed-strings', `--grep=Task: ${unit}-`, `refs/heads/${branch}`, '--']);
  return logged.split('\0').filter(Boolean).flatMap((entry) => {
    const [commit, subject, ...message] = entry.split('\n');
    if (tasksOfMessage(unit, message.join('\n')).length === 0) return [];
    return [{ from: before(repo, commit), to: commit, landed: { commit, subject }, branch: null }];
  });
}

/**
 * The unit's tasks done and not landed, whole, in every phase to `phases`.
 * @param {string} cwd @param {string} unit @param {number} phases @returns {TaskDetail[]}
 */
function unlandedTasks(cwd, unit, phases) {
  const landed = landedTasks(cwd, unit);
  const numbers = Array.from({ length: phases }, (_, at) => at + 1);
  return withStateLock(stateRoot(cwd), () => {
    const lists = trackedLists(cwd, unit, numbers).phases;
    const waiting = (/** @type {{ref: import('./task-id.cjs').TaskRef, status: string}} */ { ref, status }) => status === 'done' && !landed.has(shownTask(ref));
    return numbers.filter((_, at) => (lists[at] ?? []).some(waiting)).flatMap((phase) => (trackedPhase(cwd, unit, phase).tasks ?? []).filter(waiting));
  });
}

/**
 * The stack the unit's work not landed in its phases to `phases` makes: its
 * tip in each repository holding that work, none where no such task is
 * done.
 * @param {string} cwd @param {string} unit @param {number} phases @param {string} what the work, as a refusal names it
 * @returns {Map<Repo, string>}
 */
function unlandedStack(cwd, unit, phases, what) {
  const pending = unlandedTasks(cwd, unit, phases);
  return pending.length === 0 ? new Map() : stackOf(cwd, unit, pending, what).tips;
}

/**
 * What a task of a phase is built on, by the folder of each repository
 * holding it: for one of the review's fix phases, the branch at the tip of
 * the unit's work not landed below it (the header's); nothing for any other
 * phase, nor where nothing below it waits to land.
 * @param {string} cwd @param {string} unit @param {number} phase
 * @returns {Map<string, string>}
 */
function fixBase(cwd, unit, phase) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest === null || !isFixPhase(manifest, phase)) return new Map();
  return new Map([...unlandedStack(cwd, unit, phase - 1, `${unit}'s work not landed below phase ${phase}`)].map(([repo, tip]) => [repo.dir, tip]));
}

/**
 * The whole change (the header's), its work not landed read from the
 * unit's phases to `phases`.
 * @param {string} cwd @param {string} unit @param {number} phases @param {string|null} given the base named, or null for each repository's own
 * @returns {Change}
 */
function changeOf(cwd, unit, phases, given) {
  const repos = projectRepos(codeRoot(cwd));
  if (given !== null && !repos.some((repo) => branches(repo.path).has(given))) throw new Error(`the base ${given} is no local branch in any repository of the project`);
  const stack = new Map([...unlandedStack(cwd, unit, phases, `${unit}'s build`)].map(([repo, tip]) => [repo.path, tip]));
  const holding = repos.flatMap((repo) => {
    const base = given !== null && branches(repo.path).has(given) ? given : landsOn(cwd, repo);
    if (base === null) return [];
    const parts = landings(repo, base, unit);
    const branch = stack.get(repo.path);
    if (branch !== undefined) {
      const to = git(repo.path, ['rev-parse', `refs/heads/${branch}`]).trim();
      parts.push({ from: mergeBase(repo.path, `refs/heads/${base}`, to), to, landed: null, branch });
    }
    if (parts.length === 0) return [];
    const tip = branch ?? base;
    return [{ repo, base, parts, tip, commit: git(repo.path, ['rev-parse', `refs/heads/${tip}`]).trim() }];
  });
  if (holding.length === 0) throw new Error(`no repository of the project holds ${unit}'s change — nothing of it has landed, and no task of it is done`);
  return { repos, holding };
}

/** The change's tips, each repository by its name at its tip's commit, as a run names its commits. @param {Change} change @returns {RepoCommit[]} */
const changeTips = ({ holding }) => holding.map(({ repo, commit }) => ({ repo: repoName(repo), commit }));

module.exports = { changeOf, changeTips, fixBase };
