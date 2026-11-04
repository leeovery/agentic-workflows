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
// landed is one stack, its tip holding every fix (`fixBase`, which `land
// open` holds a fix task to), each fix task laid out on that work with its
// own phase's chain (`belowTips`, task-worktree.cjs) and its pair reading
// it from there (`workBelow`, brief-records.cjs). A task of the cut is laid
// out on its own phase's chain alone: a phase relying on another starts
// once that one has merged, and one relying on nothing unfinished may start
// beside one still open, whose review's fixes go on moving its chain
// (12.11.3), so no other phase's work not landed is ever under it. In auto
// the fix phases land only at finish, in that order (7.2.6), and in step
// each merges at its gate before the next round is read (14.6.2,
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

/** The phases 1 to `phases`. @param {number} phases */
const phasesTo = (phases) => Array.from({ length: phases }, (_, at) => at + 1);

/**
 * The project's repos: those read already, else read now.
 * @param {string} cwd @param {Repo[]} [repos]
 */
const reposOr = (cwd, repos) => repos ?? projectRepos(codeRoot(cwd));

/**
 * The unit's tasks done and not landed, whole, in each of the phases
 * `numbers`, in order.
 * @param {string} cwd @param {string} unit @param {number[]} numbers @param {Repo[]} [repos] the project's, where read already
 * @returns {TaskDetail[]}
 */
function unlandedTasks(cwd, unit, numbers, repos) {
  const lists = withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, numbers).phases);
  if (!lists.some((list) => (list ?? []).some(({ status }) => status === 'done'))) return [];
  const landed = landedTasks(cwd, unit, reposOr(cwd, repos));
  const waiting = (/** @type {{ref: import('./task-id.cjs').TaskRef, status: string}} */ { ref, status }) => status === 'done' && !landed.has(shownTask(ref));
  return withStateLock(stateRoot(cwd), () => numbers.filter((_, at) => (lists[at] ?? []).some(waiting)).flatMap((phase) => (trackedPhase(cwd, unit, phase).tasks ?? []).filter(waiting)));
}

/**
 * The stack the tasks among `pending` make: its tip in each repository
 * holding their work, none where there are none.
 * @param {string} cwd @param {string} unit @param {TaskDetail[]} pending @param {string} what the work, as a refusal names it @param {Repo[]} [repos] the project's, where read already
 * @returns {Map<Repo, string>}
 */
const stackTips = (cwd, unit, pending, what, repos) => (pending.length === 0 ? new Map() : stackOf(reposOr(cwd, repos), unit, pending, what).tips);

/**
 * The stack the unit's work not landed in its phases to `phases` makes (`stackTips`).
 * @param {string} cwd @param {string} unit @param {number} phases @param {string} what @param {Repo[]} [repos]
 */
const unlandedStack = (cwd, unit, phases, what, repos) => stackTips(cwd, unit, unlandedTasks(cwd, unit, phasesTo(phases), repos), what, repos);

/**
 * The unit's work not landed below a task of phase `phase`, whole — what
 * the task is laid out on and its pair reads from (brief-records.cjs): for
 * one of the review's fix phases, its tasks done and not landed in its
 * phases to `phase`, the work below it with its own chain (7.2.6); for a
 * phase of the cut, its own chain alone (the header's).
 * @param {string} cwd @param {string} unit @param {number} phase @param {Repo[]} [repos] the project's, where read already
 * @returns {TaskDetail[]}
 */
function workBelow(cwd, unit, phase, repos) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return unlandedTasks(cwd, unit, manifest !== null && isFixPhase(manifest, phase) ? phasesTo(phase) : [phase], repos);
}

/**
 * Where a task of phase `phase` is laid out, by the folder of each
 * repository holding the work below it (`workBelow`): the branch at that
 * work's tip there (task-worktree.cjs, 12.7.10); none where nothing below
 * it waits to land. Refused where that work is no one stack in a
 * repository (phase-stack.cjs).
 * @param {string} cwd @param {string} unit @param {number} phase @param {Repo[]} repos the project's
 * @returns {Map<string, string>}
 */
function belowTips(cwd, unit, phase, repos) {
  return new Map([...stackTips(cwd, unit, workBelow(cwd, unit, phase, repos), `the work below ${unit}'s phase ${phase}`, repos)].map(([repo, tip]) => [repo.dir, tip]));
}

/**
 * What a task of a phase is built on, by the folder of each repository
 * holding it: for one of the review's fix phases, the branch at the tip of
 * the unit's work not landed below it (the header's); nothing for any other
 * phase, nor where nothing below it waits to land.
 * @param {string} cwd @param {string} unit @param {number} phase @param {Repo[]} repos the project's
 * @returns {Map<string, string>}
 */
function fixBase(cwd, unit, phase, repos) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest === null || !isFixPhase(manifest, phase)) return new Map();
  return new Map([...unlandedStack(cwd, unit, phase - 1, `${unit}'s work not landed below phase ${phase}`, repos)].map(([repo, tip]) => [repo.dir, tip]));
}

/**
 * The whole change (the header's), its work not landed read from the
 * unit's phases to `phases`.
 * @param {string} cwd @param {string} unit @param {number} phases @param {string|null} given the base named, or null for each repository's own @param {Repo[]} repos the project's
 * @returns {Change}
 */
function changeOf(cwd, unit, phases, given, repos) {
  if (given !== null && !repos.some((repo) => branches(repo.path).has(given))) throw new Error(`the base ${given} is no local branch in any repository of the project`);
  const stack = new Map([...unlandedStack(cwd, unit, phases, `${unit}'s build`, repos)].map(([repo, tip]) => [repo.path, tip]));
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

module.exports = { changeOf, changeTips, fixBase, workBelow, belowTips };
