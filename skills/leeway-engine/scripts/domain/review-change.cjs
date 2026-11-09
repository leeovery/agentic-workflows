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
// review-phase.cjs). A quick-fix's review, asked for at its close, reads
// its one branch, `fix/{unit}`, every task of it and the review's fix
// tasks among them on it (19.5.15, fix-branch.cjs). The change is the
// unit's own work, never what others landed beside it — a quick-fix taking
// its turn (12.7.8), the person's own commits, another unit's phase. So in
// each repository:
// - its base is the branch given where it has that branch, else the branch
//   it lands on (landing-git.cjs); a base given that no repository has is
//   refused, so a misnamed one never passes as the default;
// - the unit's landings are the commits on its base's first-parent line
//   whose message names a task of the unit (landing-names.cjs), oldest
//   first, each read against its first parent;
// - the work not landed is every task of the unit's phases, cut and fix,
//   done in the tracker and not landed anywhere (landing.cjs); the stack
//   those tasks make there (phase-stack.cjs), read from where its tip
//   leaves the base — a task not done holds nothing yet to review; a
//   quick-fix's is its branch, read from where it leaves the base, where
//   the repository holds the branch with anything past the base;
// - the change's tip, where its scratch worktree and its runs stand, is
//   that stack's tip — a quick-fix's branch — where the repository holds
//   such work, else its base.
// A repository with neither landings nor work not landed holds none of the
// change. Refused where no repository holds any.
// The cut's scenarios — a quick-fix's, its fixes' (fix-acceptance.cjs) —
// stand where their runs at or behind the change's tips put them
// (`cutStandings`), as a round records them and the board shows
// round 1's while it is read, the board reading the change from its read
// of the tracker, no writer lock taken (`trackedChange`).
// ---------------------------------------------------------------------------

const { git } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { projectRepos, repoName } = require('../kernel/repos.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { isFixPhase, cutPhases, quickFixBuild } = require('./derivations.cjs');
const { runsOf } = require('./runs.cjs');
const { trackedLists, trackedPhase } = require('./task-verbs.cjs');
const { landedTasks } = require('./landing.cjs');
const { tasksOfMessage, quickFixBranch } = require('./landing-names.cjs');
const { branches, landsOn, mergeBase, isAncestor } = require('./landing-git.cjs');
const { fixAcceptance, fixScenarios } = require('./fix-acceptance.cjs');
const { stackOf } = require('./phase-stack.cjs');
const { shownTask } = require('./task-id.cjs');

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
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
function landsOnOrNone(cwd, repo) {
  try {
    return landsOn(cwd, repo);
  } catch {
    return null;
  }
}

/** Where a part starting before a commit starts: its first parent, of the parents `parents` names, or the empty tree before a first commit. @param {Repo} repo @param {string} parents */
function before(repo, parents) {
  const [first] = parents.split(' ').filter(Boolean);
  return first ?? git(repo.path, ['hash-object', '-t', 'tree', '--stdin'], undefined, '').trim();
}

/**
 * The unit's landings on a branch's first-parent line, oldest first, each a
 * part read against its first parent.
 * @param {Repo} repo @param {string} branch @param {string} unit @returns {ChangePart[]}
 */
function landings(repo, branch, unit) {
  const logged = git(repo.path, ['log', '--first-parent', '--reverse', '-z', '--format=%H%n%P%n%s%n%B', '--fixed-strings', `--grep=Task: ${unit}-`, `refs/heads/${branch}`, '--']);
  return logged.split('\0').filter(Boolean).flatMap((entry) => {
    const [commit, parents, subject, ...message] = entry.split('\n');
    if (tasksOfMessage(unit, message.join('\n')).length === 0) return [];
    return [{ from: before(repo, parents), to: commit, landed: { commit, subject }, branch: null }];
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
 * `numbers`, in order, from each phase's list `lists` holds, the tasks
 * landed `landedOf` reads, and the tasks whole `wholeOf` reads of the
 * phases among them holding any.
 * @param {number[]} numbers @param {(TaskRow[]|null|undefined)[]} lists
 * @param {() => Set<string>} landedOf @param {(phases: number[]) => TaskDetail[][]} wholeOf
 * @returns {TaskDetail[]}
 */
function notLanded(numbers, lists, landedOf, wholeOf) {
  if (!lists.some((list) => (list ?? []).some(({ status }) => status === 'done'))) return [];
  const landed = landedOf();
  const waiting = (/** @type {TaskRow} */ { ref, status }) => status === 'done' && !landed.has(shownTask(ref));
  return wholeOf(numbers.filter((_, at) => (lists[at] ?? []).some(waiting))).flatMap((tasks) => tasks.filter(waiting));
}

/**
 * The unit's tasks done and not landed, whole, in each of the phases
 * `numbers`, in order, as the tracker holds them under the writer lock.
 * @param {string} cwd @param {string} unit @param {number[]} numbers @param {Repo[]} [repos] the project's, where read already
 * @returns {TaskDetail[]}
 */
function unlandedTasks(cwd, unit, numbers, repos) {
  const lists = withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, numbers).phases);
  return notLanded(numbers, lists, () => landedTasks(cwd, unit, reposOr(cwd, repos)), (phases) => withStateLock(stateRoot(cwd), () => phases.map((phase) => trackedPhase(cwd, unit, phase).tasks ?? [])));
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
const changeOf = (cwd, unit, phases, given, repos) => changeOn(cwd, unit, unlandedTasks(cwd, unit, phasesTo(phases), repos), given, repos);

/**
 * The whole change, each repository at its own base, its work not landed
 * read from the unit's phases to `phases` as the caller read them, for a
 * reader that never takes the writer lock: each phase's list, the tasks
 * landed, and the tasks whole of the phases holding one done and not
 * landed, read only where any is.
 * @param {string} cwd @param {string} unit @param {number} phases
 * @param {{lists: (TaskRow[]|null)[], landed: Set<string>, wholeOf: (phases: number[]) => TaskDetail[][]}} read @param {Repo[]} repos the project's
 * @returns {Change}
 */
function trackedChange(cwd, unit, phases, { lists, landed, wholeOf }, repos) {
  const numbers = phasesTo(phases);
  return changeOn(cwd, unit, notLanded(numbers, numbers.map((phase) => lists[phase - 1]), () => landed, wholeOf), null, repos);
}

/** Whether the unit is built as a quick-fix (`quickFixBuild`). @param {string} cwd @param {string} unit */
function isQuickFix(cwd, unit) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest !== null && quickFixBuild(manifest);
}

/**
 * Where a repository holds the unit's work not landed past its base, by the
 * branch at its tip, undefined where it holds none.
 * @typedef {(repo: Repo, base: string) => string|undefined} WorkOn
 */

/** The work not landed the tasks `pending` make: their stack's tip in each repository holding it. @param {string} cwd @param {string} unit @param {TaskDetail[]} pending @param {Repo[]} repos @returns {WorkOn} */
function stackWork(cwd, unit, pending, repos) {
  const stack = new Map([...stackTips(cwd, unit, pending, `${unit}'s build`, repos)].map(([repo, tip]) => [repo.path, tip]));
  return (repo) => stack.get(repo.path);
}

/** A quick-fix's work not landed: its branch, where a repository holds it with anything past the base. @param {string} unit @returns {WorkOn} */
function quickFixWork(unit) {
  const branch = quickFixBranch(unit);
  return (repo, base) => {
    const at = branches(repo.path).get(branch);
    return at === undefined || isAncestor(repo.path, at, `refs/heads/${base}`) ? undefined : branch;
  };
}

/**
 * The whole change (the header's), its work not landed `pending` — a
 * quick-fix's its branch, whatever `pending` holds.
 * @param {string} cwd @param {string} unit @param {TaskDetail[]} pending @param {string|null} given the base named, or null for each repository's own @param {Repo[]} repos the project's
 * @returns {Change}
 */
function changeOn(cwd, unit, pending, given, repos) {
  if (given !== null && !repos.some((repo) => branches(repo.path).has(given))) throw new Error(`the base ${given} is no local branch in any repository of the project`);
  const workOn = isQuickFix(cwd, unit) ? quickFixWork(unit) : stackWork(cwd, unit, pending, repos);
  const holding = repos.flatMap((repo) => {
    const base = given !== null && branches(repo.path).has(given) ? given : landsOnOrNone(cwd, repo);
    if (base === null) return [];
    const parts = landings(repo, base, unit);
    const branch = workOn(repo, base);
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

/**
 * The scenarios the unit's review holds the change to, in order: its
 * cut's, or a quick-fix's, its fixes' (fix-acceptance.cjs).
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @returns {string[]}
 */
function reviewScenarios(cwd, unit, manifest) {
  if (quickFixBuild(manifest)) return fixScenarios(fixAcceptance(cwd, unit)).map(({ scenario }) => scenario);
  return cutPhases(manifest).flatMap(({ scenarios }) => scenarios);
}

/**
 * What each scenario of the cut — a quick-fix's, of its fixes — stands at,
 * at a change's tips: the code a round reads (runs.cjs, 15.3.3).
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {Change} change
 * @returns {{scenario: string, standing: string}[]}
 */
function cutStandings(cwd, unit, manifest, change) {
  const tips = changeTips(change);
  return reviewScenarios(cwd, unit, manifest).map((scenario) => ({ scenario, standing: runsOf(cwd, unit, scenario, tips).standing }));
}

module.exports = { changeOf, trackedChange, changeTips, cutStandings, fixBase, workBelow, belowTips };
