'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the `land` verbs (6.1.8, 7.2.8), a task's change landed
// through the project's landing driver (drivers.cjs): `open` the task's pull
// request, `chain` it into its phase's stack, merge a `phase` whole, and
// `finish`, which merges every phase still standing — the review phase's fix
// phases, after every other (7.2.6). `open` and `chain` refuse a task with
// no account taken of its review as it stands (task-account.cjs, 12.14),
// `open` taking a quick-fix's, which no pair reviews and which owes none
// (19.5.3); `open` a bugfix's reproducing task until its test's series
// proves the bug at its tip (bug-proven.cjs, 15.5.3), and a task of a fix
// phase whose branch does not descend from the unit's work not landed below
// it, which a fix phase is built on (review-change.cjs, 7.2.6); `chain` a
// task its pair has not passed, read off its rounds' reports, or one
// changed under its last round since (round-report.cjs, 12.1.4); and
// `phase` a phase the cut holds until its phase review has passed and its
// fixes are done, as the phase's close reads it (phase-checks.cjs, 7.2.4).
// `chain` answers, where the task chained is the last of a phase of the cut
// not yet ended, the phase's notes consolidated (notes.cjs), its phase
// review not begun and the verify setup naming a mutation tool, the phase's
// mutation run as its `next` (verify.cjs, 15.6.3), once for the phase: a
// task the consolidation writes ends after it. `finish` refuses, naming
// what did not land, a phase it merged offered to merge again, so it never
// loops. Which of a unit's tasks landed — each one a default branch's
// landing names — is read here for the phase's close, the build's standing
// and a bugfix's door, which reads the landings a commit being made holds
// too (`landedTasks`, bug-proven.cjs); for the close in step, whether a
// phase's tasks are each in its stack (`allChained`); and, for a task with
// nothing of its unit's below it, where it starts in each repository
// (`landingTips`).
//
// A quick-fix lands as one pull request (19.5.15): every task of its build,
// its fixes and the fix tasks of a review asked for at its close, commits
// on its one branch (fix-branch.cjs), in the project's own repository
// alone, and its pull request is that branch's, onto the default branch.
// `open` of any of its tasks opens it, or pushes the branch to it where it
// is open, its title and description its landing's message as the branch
// stands (`quickFixMessage`, landing-names.cjs), refused for a task closed
// or landed (fix-end.cjs); `phase` and `finish` each merge it, every task's
// commit squashed into one, refused while a task is neither done nor closed
// (fix-end.cjs) — `already` where no task holds work past the branch it
// lands on not landed, that branch here brought up to the host's. Each
// first cuts the branch again where a merge by hand left it holding work
// landed (`cutAgain`, fix-branch.cjs). Its tasks' landing is read here
// (`quickFixLanding`), each task by content against the default branch as
// the host has it, whether or not the branch is left, as a person's merge
// by hand, by any method, leaves it — for its tasks' opening, end and close
// (fix-end.cjs), the branch cut again, its close (finish.cjs), its record
// (quick-fix-record.cjs) and its move (workunit-move.cjs), which closes the
// pull request open unmerged (`quickFixClose`).
//
// What every driver shares is settled here: the names (landing-names.cjs);
// the default branch everything lands on in each repository, never the
// state branch (4.9.4); and, for a task opened, its type and title, read
// from the tracker as the task verbs read a task (task-verbs.cjs), a task it
// lacks or holds with no type refused (7.2.18, 12.4.1), and its branch,
// named from them, whose change carries nothing under `.leeway/` at the top
// of the project's repository, where the state sits whichever folder of it
// the project is, in any case of its letters (4.1.3, 4.S2). Past the state,
// a project inside a larger repository reads the change from its own folder
// alone (7.2.17): what the change does outside it is the larger
// repository's, never refused, and lands with the task as its branch holds
// it.
//
// A task lands in every repository of the project it touches (7.2.17): the
// project's own and each nested in its folder, a clone or a submodule
// (kernel/repos.cjs), each on its own default branch, under the same names.
// A nested repository holds work on a branch of the unit's where the branch
// holds a commit no branch there but the unit's holds — read without its
// default branch, so one the unit never touched is passed over, whatever
// remote or default branch it lacks; a task's worktree makes the branch in
// every child repository (12.7.10), changed or not. `open` judges, before it
// opens anything, the project's own repository and each nested one holding
// work on the task's branch: touched where the branch holds a commit past
// its chain's tip, which the driver answers there, and refused where it does
// not descend from that tip (12.7.1); one with nothing past its default
// branch or the chain's tip gets nothing. A task whose branch points a
// submodule at a commit the submodule here does not hold is refused before
// anything opens, naming both, so no pointer lands naming a commit no
// repository holds. The other verbs walk the project's
// own repository and each nested one holding work on a branch of the
// unit's in question. Every verb walks them children first, the project's
// own last, so a submodule's landing merges before the repository holding
// it records its pointer, as each driver records it; a merge is told, for
// that, each submodule of its repository, and which of them the walk lands
// in. A merge is refused before anything merges where a default branch
// points a submodule the walk lands in at a commit the submodule's own
// default branch does not descend from — each as it lands, what its driver
// lands onto (`landsOn`) — so no landing moves a pointer off it. A
// driver that lands through a host refuses, before anything moves, a
// repository it walks whose remote it does not serve (`assertServes`). A
// refusal in a nested repository names it, and one after a repository moved
// names what moved where and carries the warnings those landings gave; the
// verb run again picks up where it stopped, a repository done already
// passed over; `open` and `phase` run again where their work is done answer
// `already`. `finish` makes, in each repository, the merge its driver
// picks next (`nextMerge`) until none is left, each warning given once, a
// refusal saying which phases merged before it. A verb answers, children first,
// as `repos`, each repository where its landing did something — a merge,
// those where a phase merged — and every warning, one in a nested
// repository naming it. Every verb,
// before anything else, stops on a rebase stopped in a worktree a remedy
// made in a repository it walks, until it is settled or ended there
// (landing-git.cjs).
//
// The landing's state is read off git and the host each time. Nothing is
// recorded but the driver setting, which the first verb settles where it is
// absent and commits to the state branch, whatever the driver then does;
// the tracker's setting up, which `open`'s read commits where the state
// branch lacks it, as every read of the tracker does; and what a driver
// keeps in a repository's own refs. A verb answers what it committed and
// was warned of, and a refusal after a commit carries that commit's
// warnings.
// ---------------------------------------------------------------------------

const { resolveDriver, chosenDriver, needsRefusal } = require('./drivers.cjs');
const { commitStateTail, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');
const { assertUnit, parsePhase, parseShownTask, parseTaskId, shownTask, taskId } = require('./task-id.cjs');
const { trackedTask, trackedPhase, trackedBuild, ENDED } = require('./task-verbs.cjs');
const { taskRounds, pairPassed, changedUnder, changedRefusal, phaseReviewBegun } = require('./round-report.cjs');
const { verifySetup } = require('./environment.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { cutLength, buildLength, quickFixBuild } = require('./derivations.cjs');
const { dayBefore } = require('./dates.cjs');
const { reproducingHold } = require('./bug-proven.cjs');
const names = require('./landing-names.cjs');
const lg = require('./landing-git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { projectRepos, projectPath, childrenFirst, topPath } = require('../kernel/repos.cjs');
const { STATE_DIR_NAME, stateRoot } = require('../kernel/state-root.cjs');

// A phase's checks, and what a fix phase is built on, loaded at their call:
// they read what landed through this module.
const phaseChecks = () => require('./phase-checks.cjs');
const scratch = () => require('./scratch.cjs');
const reviewChange = () => require('./review-change.cjs');
const account = () => require('./task-account.cjs');
const fixEnd = () => require('./fix-end.cjs');
const fixBranch = () => require('./fix-branch.cjs');
const notes = () => require('./notes.cjs');
/** The trailer the door stamps a task's commit with, read when asked: commit-task.cjs reads the landing. */
const stamp = () => require('./commit-task.cjs').TRAILER;

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').LandingDriver} LandingDriver */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/**
 * What a landing driver is called with, for one repository of the project:
 * the folder its git runs in — the code root, for the project's own — and
 * the repository as answers name it, `.` for the project's own; the unit;
 * the default branch everything lands on there; the name of its remote,
 * null where it has none chosen; and, for a merge, each submodule directly
 * inside it, by its path from the repository's top, and of those each the
 * walk lands in, with its own context; and, for a call that moves nothing,
 * the reads a driver keeps there, so each is made once (`readOnce`).
 * @typedef {{root: string, repo: string, unit: string, into: string, remote: string|null, gitlinks: string[], submodules: {path: string, ctx: LandingContext}[], reads?: Map<string, unknown>}} LandingContext
 */

/**
 * A task to land: its id, its branch, and the message it lands under.
 * @typedef {{ref: TaskRef, branch: string, message: string}} LandingTask
 */

/**
 * A quick-fix to land: its one branch, the message it lands under, and the
 * tasks holding work on the branch past the default branch, shown, in order.
 * @typedef {{branch: string, message: string, tasks: string[]}} QuickFixTask
 */

/**
 * The chain's tip a driver answers for a task: the branch the task's branch
 * must descend from, and that branch's commit, which the repository has
 * locally. A driver may carry more on it for its own `open`.
 * @typedef {{name: string, commit: string}} ChainTip
 */

/**
 * The project a verb lands in: its repositories, its own first, and their
 * contexts, each made once, as the verb first needs it — each keeping the
 * reads its driver makes there where the call moves nothing.
 * @typedef {{unit: string, repos: Repo[], contexts: Map<string, LandingContext>, keepsReads?: boolean}} Project
 */

/**
 * One repository's part of a verb, and what it answered: null where there
 * was nothing to do there.
 * @typedef {{ctx: LandingContext, act: () => Record<string, any>|null}} Step
 * @typedef {Record<string, any> & {repo: string}} Answer
 */

const LAND_USAGE = [
  'land open <work-unit> <phase>.<task>',
  'land chain <work-unit> <phase>.<task>',
  'land phase <work-unit> <phase>',
  'land finish <work-unit>',
].join('\n');

/**
 * `act`, a refusal it throws in a nested repository naming it; the
 * project's own repository's as it stands.
 * @template T @param {string} repo as answers name it @param {() => T} act @returns {T}
 */
function inRepo(repo, act) {
  try {
    return act();
  } catch (err) {
    if (repo !== '.' && err instanceof Error) err.message = `land: in ${lg.plain(repo)}, ${err.message.replace(/^land: /, '')}`;
    throw err;
  }
}

/**
 * A repository's context, once no rebase a remedy began is stopped there.
 * @param {string} unit @param {Repo} repo @param {string|null} remote
 * @returns {LandingContext}
 */
function repoContext(unit, repo, remote) {
  const nested = repo.dir !== '';
  const named = nested ? repo.dir : '.';
  return inRepo(named, () => {
    const stopped = lg.scratchBlock(repo.path);
    if (stopped !== null) throw new Error(`land: ${stopped}`);
    return { root: repo.path, repo: named, unit, into: lg.defaultBranch(repo.path, remote, nested), remote, gitlinks: [], submodules: [] };
  });
}

/**
 * The project a verb lands in, its own repository's context made first.
 * @param {string} cwd @param {string} unit @param {Repo[]} [repos] the project's, where the caller has read them
 * @returns {Project}
 */
function projectOf(cwd, unit, repos = projectRepos(codeRoot(cwd))) {
  assertUnit(unit);
  return { unit, repos, contexts: new Map([['', repoContext(unit, repos[0], remoteName(cwd))]]) };
}

/** A repository's context in the project, made once. @param {Project} project @param {Repo} repo @returns {LandingContext} */
function contextOf(project, repo) {
  const made = project.contexts.get(repo.dir) ?? repoContext(project.unit, repo, nestedRemoteName(repo.path));
  if (project.keepsReads) made.reads ??= new Map();
  project.contexts.set(repo.dir, made);
  return made;
}

/**
 * A repository's context for a merge: with each of its submodules, and of
 * those each the walk lands in, by its path from the repository's top.
 * @param {Project} project @param {Repo} repo @param {Repo[]} walking
 * @returns {LandingContext}
 */
function mergingIn(project, repo, walking) {
  const ctx = contextOf(project, repo);
  if (repo.submodules.length === 0) return ctx;
  const subs = repo.submodules.flatMap((folder) => walking.filter((sub) => sub.dir === projectPath(repo.dir, folder)).map((sub) => ({ folder, sub })));
  return {
    ...ctx,
    gitlinks: repo.submodules.map((folder) => topPath(repo, folder)),
    submodules: subs.map(({ folder, sub }) => ({ path: topPath(repo, folder), ctx: contextOf(project, sub) })),
  };
}

/**
 * The repositories a verb but `open` walks, children first: the project's
 * own, and each nested one holding work on a branch `picks` names — each
 * refused before any acts where the driver does not serve its remote.
 * @param {Project} project @param {LandingDriver} driver @param {(branch: string) => boolean} picks
 * @returns {Repo[]}
 */
function walked(project, driver, picks) {
  const repos = childrenFirst(project.repos).filter((repo) => repo.dir === '' || lg.holdsWork(project.unit, repo, picks));
  for (const repo of repos) {
    const ctx = contextOf(project, repo);
    inRepo(ctx.repo, () => driver.assertServes?.(ctx));
  }
  return repos;
}

/** A refusal after repositories moved: the warnings their landings gave. @typedef {Error & {landed?: string[]}} Partial */

/**
 * Each step's answer, in turn, with its repository, those with nothing to
 * do left out. A refusal names its repository and, where those before it
 * moved, what moved where — `did` says it of an answer, null where it moved
 * nothing — carrying the warnings their landings gave.
 * @param {Step[]} steps @param {(answer: Answer) => string|null} did
 * @returns {Answer[]}
 */
function walk(steps, did) {
  /** @type {Answer[]} */
  const done = [];
  for (const { ctx, act } of steps) {
    try {
      const answer = inRepo(ctx.repo, act);
      if (answer !== null) done.push({ repo: ctx.repo, ...answer });
    } catch (err) {
      throw movedBefore(err, done, did);
    }
  }
  return done;
}

/**
 * A refusal carrying what moved, and where, before it, and the warnings
 * those landings gave (`Partial`).
 * @param {unknown} err @param {Answer[]} done @param {(answer: Answer) => string|null} did
 */
function movedBefore(err, done, did) {
  if (!(err instanceof Error)) return err;
  /** @type {Map<string, string[]>} */
  const moved = new Map();
  for (const answer of done) {
    const what = did(answer);
    if (what !== null) moved.set(what, [...(moved.get(what) ?? []), lg.plain(answer.repo)]);
  }
  if (moved.size > 0) err.message = `${err.message} (${[...moved].map(([what, repos]) => `${what} in ${repos.join(', ')}`).join('; ')} before it)`;
  const { warnings } = answered(done, () => false);
  if (warnings !== undefined) /** @type {Partial} */ (err).landed = warnings;
  return err;
}

/**
 * The answers of the repositories where something `happened`, and every
 * repository's warnings beside them, each from a nested repository naming
 * it.
 * @param {Answer[]} answers @param {(answer: Answer) => boolean} [happened]
 * @returns {{repos: Record<string, any>[], warnings?: string[]}}
 */
function answered(answers, happened = () => true) {
  const warnings = answers.flatMap(({ repo, warnings: said = [] }) => said.map((/** @type {string} */ warning) => (repo === '.' ? warning : `in ${lg.plain(repo)}, ${warning}`)));
  const repos = answers.filter(happened).map(({ warnings: _said, ...answer }) => answer);
  return { repos, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * Run a driver's verb with the project's landing driver, committing the
 * setting where this call settled it, whether or not the driver refused. A
 * verb that fails where a tool the driver needs is not installed, or fails
 * to run, is refused for that (`needsRefusal`). The answer carries the
 * verb's last state commit, null where it failed, and every warning:
 * `before`'s — what the verb committed and was warned of before — the
 * setting's own, and the driver's, a refusal's those of the landings before
 * it (`Partial`).
 * @template {Record<string, unknown> & {warnings?: string[]}} T
 * @param {string} cwd @param {(driver: LandingDriver) => T} act
 * @param {{committed?: string|null, warnings?: string[]}} [before]
 * @returns {Omit<T, 'warnings'> & {driver: string, committed?: string|null, warnings?: string[]}}
 */
function withDriver(cwd, act, before = {}) {
  const { driver, written } = resolveDriver(cwd, 'landing');
  const warnings = [...(before.warnings ?? [])];
  let { committed } = before;
  const { warnings: driven = [], ...answer } = carrying(warnings, () => {
    try {
      return act(/** @type {LandingDriver} */ (driver));
    } catch (err) {
      if (err instanceof Error) warnings.push(...(/** @type {Partial} */ (err).landed ?? []));
      const missing = needsRefusal(driver);
      throw missing === null ? err : new Error(`land: ${missing}`);
    } finally {
      if (written) committed = commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `chore: the landing driver is ${driver.name}`, warnings).committed;
    }
  });
  warnings.push(...driven);
  return { ...answer, driver: driver.name, ...(committed === undefined ? {} : { committed }), ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * `act`, a refusal it throws carrying `warnings` — what the verb was warned
 * of by then — as the task verbs' refusals carry their commit's.
 * @template T @param {string[]} warnings @param {() => T} act @returns {T}
 */
function carrying(warnings, act) {
  try {
    return act();
  } catch (err) {
    if (warnings.length > 0 && err instanceof Error) err.message = `${err.message} — and ${warnings.join('; ')}`;
    throw err;
  }
}

/**
 * The refusal of a task the tracker holds with no type: given one by `task
 * type`, or, for a task ended, which that verb refuses, its change landed
 * as a task of its own.
 * @param {TaskRef} ref @param {string} status the tracker's
 */
function untyped(ref, status) {
  const shown = shownTask(ref);
  if (!ENDED.includes(status)) {
    return `land: task ${shown} has no type in the tracker, and its branch and landing are named from it — give it one with \`task type ${ref.unit} ${shown} <type>\` and open it again`;
  }
  return `land: task ${shown} is ${status} in the tracker with no type, and only a task not yet ended takes one — its branch and landing are named from its type, `
    + `so land its change as a task of its own, made with \`task create ${ref.unit} ${ref.phase} --file <path>\``;
}

/**
 * The landing a task opens under, from the type and title the tracker holds
 * for it (7.2.18, 12.4.1), and the repositories holding its branch — a
 * nested one only where the branch holds work there (`lg.holdsWork`): refused
 * where it has no type, where no repository holds its branch, or none holds
 * work on it, and where its change carries the state.
 * @param {Project} project @param {TaskRef} ref @param {{type: string|null, title: string, status: string}} task
 * @returns {{task: LandingTask, holding: Repo[]}}
 */
function landingOf(project, ref, { type, title, status }) {
  const shown = shownTask(ref);
  if (type === null) throw new Error(untyped(ref, status));
  const branch = names.taskBranch(ref, type, title);
  const { named, holding } = lg.holdingBranch(project.unit, project.repos, branch);
  if (!named) {
    throw new Error(`land: task ${shown} has no branch ${branch}, the name its type and title in the tracker give it — name its branch so and open it again`);
  }
  if (holding.length === 0) throw new Error(`land: task ${shown}'s branch ${branch} changes nothing in the repositories holding it — commit its change there first`);
  if (holding[0].dir === '') refuseState(/** @type {LandingContext} */ (project.contexts.get('')), shown, branch, 'task\'s');
  return { task: { ref, branch, message: names.landedMessage(ref, type, title) }, holding };
}

/**
 * Refuse a branch whose change past the default branch carries anything
 * under the state's folder at the top of the project's repository, naming
 * each file.
 * @param {LandingContext} own the project's own repository's @param {string} shown the task opened @param {string} branch @param {string} whose the branch's, as the way on names it
 */
function refuseState(own, shown, branch, whose) {
  const state = lg.changedAtTop(own.root, own.into, branch, STATE_DIR_NAME);
  if (state.length > 0) {
    throw new Error(`land: task ${shown}'s change carries ${state.map(lg.plain).join(', ')} — the workflows' state never lands on a code branch, so take it off the ${whose} branch and open the task again`);
  }
}

/**
 * The repositories a task's branch touches, children first, each with its
 * chain's tip — read in every repository holding the branch, and the branch
 * held to descend from it there, before anything opens; none where the task
 * is opened already wherever it touches. Refuses a task touching none with
 * nothing past a chain's tip — the project's own named, where it holds the
 * branch — and one moving a submodule's pointer to a commit the submodule
 * here lacks (`refuseUnheldMoves`).
 * @param {Project} project @param {LandingDriver} driver @param {LandingTask} task @param {Repo[]} holding
 * @returns {{repo: Repo, ctx: LandingContext, tip: ChainTip}[]}
 */
function touching(project, driver, task, holding) {
  const shown = shownTask(task.ref);
  const judged = childrenFirst(holding).map((repo) => {
    const ctx = contextOf(project, repo);
    return { repo, ctx, found: inRepo(ctx.repo, () => standing(driver, ctx, task)) };
  });
  const opening = judged.flatMap(({ repo, ctx, found }) => ('tip' in found ? [{ repo, ctx, tip: found.tip }] : []));
  for (const { repo, ctx, tip } of opening) inRepo(ctx.repo, () => refuseUnheldMoves(project, repo, task, tip.commit));
  if (opening.length > 0 || judged.some(({ found }) => 'opened' in found)) return opening;
  const idle = judged.flatMap(({ ctx, found }) => ('past' in found ? [{ ctx, past: found.past }] : []));
  const { ctx, past } = idle[idle.length - 1];
  return inRepo(ctx.repo, () => {
    throw new Error(lg.nothingPast(shown, task.branch, past));
  });
}

/**
 * Refuse a task's branch moving a submodule's pointer, past the chain's tip
 * at `from`, to a commit the submodule here does not hold — as a change
 * committed in a clone the task's worktree made of its own leaves it, so
 * the pointer would land naming a commit no repository holds.
 * @param {Project} project @param {Repo} repo @param {LandingTask} task @param {string} from
 */
function refuseUnheldMoves(project, repo, task, from) {
  if (repo.submodules.length === 0) return;
  const paths = repo.submodules.map((folder) => topPath(repo, folder));
  const [before, after] = lg.pointersAt(repo.path, [from, task.branch], paths);
  repo.submodules.forEach((folder, i) => {
    const sha = after.get(paths[i]) ?? null;
    if (sha === null || sha === (before.get(paths[i]) ?? null)) return;
    const nested = project.repos.find((held) => held.dir === projectPath(repo.dir, folder));
    if (nested !== undefined && lg.holdsCommit(nested.path, sha)) return;
    const named = lg.plain(folder);
    throw new Error(`land: task ${shownTask(task.ref)}'s branch ${task.branch} points ${named} at ${lg.short(sha)}, a commit ${named} here does not hold — commit the change in ${named}, on ${task.branch}, and open the task again`);
  });
}

/**
 * Refuse, before anything merges, a repository whose default branch points
 * a submodule the walk lands in at a commit the submodule's own default
 * branch does not descend from, each as it lands (`pointerAhead`).
 * @param {LandingDriver} driver @param {LandingContext[]} merging
 */
function refuseDefaultsAhead(driver, merging) {
  for (const ctx of merging.filter(({ submodules }) => submodules.length > 0)) {
    inRepo(ctx.repo, () => {
      const [pointers] = lg.pointersAt(ctx.root, [landsOn(driver, ctx)], ctx.submodules.map(({ path }) => path));
      for (const { path, ctx: sub } of ctx.submodules) {
        const sha = pointers.get(path) ?? null;
        const ahead = sha === null ? null : lg.pointerAhead(ctx.into, path, sub, sha, landsOn(driver, sub));
        if (ahead !== null) throw new Error(ahead);
      }
    });
  }
}

/**
 * The commit a repository's merge lands onto: its driver's answer
 * (`landsOn`), else its default branch's tip here.
 * @param {LandingDriver} driver @param {LandingContext} ctx
 * @returns {string}
 */
function landsOn(driver, ctx) {
  return driver.landsOn?.(ctx) ?? /** @type {string} */ (lg.branches(ctx.root).get(ctx.into));
}

/**
 * The commit a task with none of its unit's work below it starts at in each
 * of `wanted` (task-worktree.cjs), by its folder: the tip of the branch it
 * lands on, as the project's landing driver reads it (`landsOn`), writing
 * nothing — the branch here where that read fails, a fetch that cannot be
 * made among them, the task's landing merging it back onto the chain's tip.
 * The project is read once, from `repos`.
 * @param {string} cwd the project's folder @param {string} unit @param {Repo[]} repos the project's @param {Repo[]} wanted
 * @returns {Map<string, string>}
 */
function landingTips(cwd, unit, repos, wanted) {
  const project = projectOf(cwd, unit, repos);
  const driver = /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver);
  return new Map(wanted.map((repo) => {
    const ctx = contextOf(project, repo);
    try {
      return [repo.dir, landsOn(driver, ctx)];
    } catch {
      return [repo.dir, /** @type {string} */ (lg.branches(ctx.root).get(ctx.into))];
    }
  }));
}

/**
 * Each repository's part of a merge, children first, `act` run in each —
 * once no default branch points a submodule at a commit its own lacks.
 * @param {Project} project @param {LandingDriver} driver @param {Repo[]} walking @param {(ctx: LandingContext) => Record<string, any>|null} act
 * @returns {Step[]}
 */
function mergeSteps(project, driver, walking, act) {
  const merging = walking.map((repo) => mergingIn(project, repo, walking));
  refuseDefaultsAhead(driver, merging);
  return merging.map((ctx) => ({ ctx, act: () => act(ctx) }));
}

/**
 * Where a task's branch stands in one repository holding it: past the
 * chain's tip, to open on it; opened already; or with nothing past the
 * default branch or the chain's tip — refused where it does not descend
 * from the tip.
 * @param {LandingDriver} driver @param {LandingContext} ctx @param {LandingTask} task
 * @returns {{tip: ChainTip}|{opened: true}|{past: string}}
 */
function standing(driver, ctx, task) {
  if (lg.isAncestor(ctx.root, task.branch, ctx.into)) return { past: ctx.into };
  driver.assertServes?.(ctx);
  const tip = driver.chainTip(ctx, task);
  if (tip === null) return { opened: true };
  if (lg.isAncestor(ctx.root, task.branch, tip.commit)) return { past: tip.name };
  if (lg.isAncestor(ctx.root, tip.commit, task.branch)) return { tip };
  throw new Error(`land: task ${shownTask(task.ref)}'s branch ${task.branch} does not descend from the chain's tip, ${tip.name} (${lg.short(tip.commit)}) — merge it back onto ${tip.name} first`);
}

/**
 * Refuse a task of one of the review's fix phases whose branch, in a
 * repository holding the unit's work not landed below it, does not descend
 * from that work's tip, which a fix phase is built on (7.2.6,
 * review-change.cjs) — or refused as that work's read refuses.
 * @param {string} cwd @param {Project} project @param {LandingTask} task
 */
function refuseOffBase(cwd, project, task) {
  const { phase } = task.ref;
  let base;
  try {
    base = reviewChange().fixBase(cwd, project.unit, phase, project.repos);
  } catch (err) {
    throw new Error(`land: ${messageOf(err)}`);
  }
  for (const [dir, tip] of base) {
    const repo = /** @type {Repo} */ (project.repos.find((held) => held.dir === dir));
    if (!lg.branches(repo.path).has(task.branch) || lg.isAncestor(repo.path, `refs/heads/${tip}`, `refs/heads/${task.branch}`)) continue;
    inRepo(dir === '' ? '.' : dir, () => {
      throw new Error(`land: task ${shownTask(task.ref)}'s branch ${task.branch} does not descend from ${tip}, where ${project.unit}'s work not landed below phase ${phase} ends, which a fix phase is built on (7.2.6) — merge it back onto ${tip} first, then open it again`);
    });
  }
}

/** Refuse a bugfix's reproducing task while its bug is not proven at its tip, naming the series or the rework (bug-proven.cjs). @param {string} cwd @param {TaskRef} ref */
function refuseUnproven(cwd, ref) {
  const held = reproducingHold(cwd, loadWorkUnitManifest(cwd, ref.unit), ref, 'lands');
  if (held !== null) throw new Error(`land: ${held}`);
}

/**
 * The task's pull request opened in every repository its change touches —
 * locally, its change squashed onto its phase's branch there — under the
 * type and title the tracker holds for it; `already` where it is opened
 * wherever it touches, so a rerun reads finished work as done. A task the
 * tracker lacks is refused as the read finds it; a bugfix's reproducing
 * task while its bug is not proven, and a fix phase's off the work below
 * it, before anything opens. A quick-fix's task opens the quick-fix's one
 * pull request (`quickFixOpen`).
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landOpen(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  const shown = shownTask(ref);
  const project = projectOf(cwd, unit);
  const lacking = `land: task ${shown} of ${unit} is not in the tracker — open a task it holds, as \`task list ${unit} ${ref.phase}\` lists them`;
  const { committed, warnings, ...held } = trackedTask(cwd, ref, lacking);
  if (landsAsOne(cwd, unit)) return quickFixOpen(cwd, project, ref, { committed, warnings });
  const { task: landing, holding } = carrying(warnings ?? [], () => landingOf(project, ref, held));
  carrying(warnings ?? [], () => account().refuseUnaccounted(cwd, ref, 'land'));
  carrying(warnings ?? [], () => refuseUnproven(cwd, ref));
  carrying(warnings ?? [], () => refuseOffBase(cwd, project, landing));
  return withDriver(cwd, (driver) => {
    const steps = touching(project, driver, landing, holding).map(({ ctx, tip }) => ({ ctx, act: () => driver.open(ctx, landing, tip) }));
    const already = steps.length === 0 ? { already: true } : {};
    return { task: shown, branch: landing.branch, ...already, ...answered(walk(steps, () => `task ${shown} opened`)) };
  }, { committed, warnings });
}

/**
 * Refuse a task its pair has not passed: no round of its review reported,
 * its last round failed and not settled (12.1.4, 13.4.6), or the task
 * changed under that round since — read off its rounds' reports alone,
 * refused as their read refuses.
 * @param {string} cwd @param {TaskRef} ref
 */
function refuseUnpassed(cwd, ref) {
  const shown = shownTask(ref);
  let rounds;
  try {
    rounds = taskRounds(cwd, ref);
  } catch (err) {
    throw new Error(`land: ${messageOf(err)}`);
  }
  const last = rounds.at(-1);
  if (last === undefined) throw new Error(`land: task ${shown} has no review round reported — a task chains into its phase's stack once its pair has passed it`);
  if (!pairPassed(last)) {
    throw new Error(`land: round ${last.round} of task ${shown} did not pass — a task chains into its phase's stack once every reviewer of a round passes it, or once the orchestrator settles it: task settle ${ref.unit} ${shown} --file <why>`);
  }
  const changed = changedUnder(cwd, ref, rounds);
  if (changed !== null) throw new Error(`land: ${changedRefusal(ref, changed)}`);
  account().refuseUnaccounted(cwd, ref, 'land');
}

/**
 * The phase's mutation run, as the `next` of whatever ends the last of a
 * phase of the cut's tasks (the header's) — its chain, or its close where
 * another of the phase's is done — once its notes are consolidated, its
 * phase review not begun and the verify setup naming a mutation tool;
 * nothing else, and nothing for a phase past the cut — the review's fixes, a
 * quick-fix's — which no phase review reads (15.6.3).
 * @param {string} cwd @param {TaskRef} ref @param {boolean} [chained] whether the task ending holds work of its own
 */
function mutationRun(cwd, ref, chained = true) {
  const manifest = manifestOf(stateRoot(cwd), ref.unit);
  if (manifest === null || ref.phase > cutLength(manifest) || phaseReviewBegun(cwd, ref.unit, ref.phase)) return {};
  if (verifySetup(cwd)?.mutation === undefined) return {};
  if (notes().consolidationFaults(cwd, ref.unit, ref.phase).length > 0) return {};
  const others = (trackedPhase(cwd, ref.unit, ref.phase).tasks ?? []).filter((task) => shownTask(task.ref) !== shownTask(ref));
  if (others.some((task) => !ENDED.includes(task.status))) return {};
  if (!chained && !others.some((task) => task.status === 'done')) return {};
  return { next: { kind: 'engine', argv: ['verify', 'mutants', ref.unit, String(ref.phase)] } };
}

/**
 * The task chained into its phase's stack in every repository it is open
 * in, each answered in the order its tasks were merged back there — refused
 * before anything moves where its pair has not passed it.
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landChain(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  refuseUnpassed(cwd, ref);
  const project = projectOf(cwd, unit);
  const ofTask = (/** @type {string} */ branch) => {
    const of = names.taskOfBranch(unit, branch);
    return of !== null && of.phase === ref.phase && of.n === ref.n;
  };
  return withDriver(cwd, (driver) => {
    const steps = walked(project, driver, ofTask).map((repo) => {
      const ctx = contextOf(project, repo);
      return { ctx, act: () => driver.chain(ctx, ref) };
    });
    const answers = walk(steps, () => `phase ${ref.phase} chained`);
    if (answers.length === 0) throw new Error(`land: task ${shownTask(ref)} is not open — open it first`);
    return { phase: ref.phase, ...answered(answers), ...mutationRun(cwd, ref) };
  });
}

/**
 * A phase merged whole in every repository it lands in, children first —
 * `already` where it is merged wherever it lands, so a rerun reads finished
 * work as done, with every warning bringing the default branch here to it
 * gave — refused before anything moves, for a phase the cut holds, until
 * its phase review has passed and its fixes are done (7.2.4, 12.11.3). A
 * quick-fix's phase lands its one pull request (`quickFixLand`).
 * @param {string} cwd @param {string} unit @param {string} given
 */
function landPhase(cwd, unit, given) {
  const phase = parsePhase(given);
  assertUnit(unit);
  if (landsAsOne(cwd, unit)) return { phase, ...quickFixLand(cwd, unit) };
  const unreviewed = phaseChecks().phaseReviewRefusal(cwd, unit, phase);
  if (unreviewed !== null) throw new Error(`land: ${unreviewed}`);
  const project = projectOf(cwd, unit);
  const ofPhase = (/** @type {string} */ branch) => (names.taskOfBranch(unit, branch)?.phase ?? names.phaseOfBranch(unit, branch)) === phase;
  return withDriver(cwd, (driver) => {
    const steps = mergeSteps(project, driver, walked(project, driver, ofPhase), (ctx) => driver.mergePhase(ctx, phase));
    const answers = walk(steps, (answer) => (answer.already ? null : `phase ${phase} merged`));
    if (answers.length === 0) throw new Error(`land: phase ${phase} of ${unit} has no task opened — open its tasks first`);
    scratch().readersDone(cwd, scratch().READERS.phase(unit, phase));
    const already = answers.every((answer) => answer.already) ? { already: true } : {};
    return { phase, ...already, ...answered(answers, (answer) => !answer.already) };
  });
}

/**
 * Every phase not merged in one repository merged, each as the driver picks
 * it next (`nextMerge`), each warning given once, and what the driver keeps
 * of the unit there then let go (`finished`). Stops at the first refusal,
 * saying which phases merged before it — a phase it merged offered again
 * among them, what it merged not having landed.
 * @param {LandingDriver} driver @param {LandingContext} ctx
 */
function finishing(driver, ctx) {
  /** @type {Record<string, any>[]} */
  const phases = [];
  /** @type {Set<string>} */
  const warned = new Set();
  try {
    for (let next = driver.nextMerge(ctx); next !== null; next = driver.nextMerge(ctx)) {
      const again = phases.find(({ phase }) => phase === next?.phase);
      if (again !== undefined) {
        throw new Error(`land: phase ${again.phase} merged, and still has ${(again.merged ?? []).join(', ')} to land on ${ctx.into} — what merged never reached it, so land it by hand there and finish again`);
      }
      const { warnings = [], ...merged } = next.merge();
      phases.push({ phase: next.phase, ...merged });
      for (const warning of warnings) warned.add(warning);
    }
  } catch (err) {
    if (phases.length === 0) throw err;
    throw new Error(`${messageOf(err)} (finish merged phase ${phases.map(({ phase }) => phase).join(', ')} before it)`);
  }
  driver.finished?.(ctx);
  return { into: ctx.into, phases, ...(warned.size > 0 ? { warnings: [...warned] } : {}) };
}

/**
 * Every phase still standing merged, after every other (7.2.6), in every
 * repository of the unit's, children first — answering those where a phase
 * merged; a quick-fix's one pull request merged (`quickFixLand`).
 * @param {string} cwd @param {string} unit
 */
function landFinish(cwd, unit) {
  if (landsAsOne(cwd, unit)) return quickFixLand(cwd, unit);
  const project = projectOf(cwd, unit);
  return withDriver(cwd, (driver) => {
    const steps = mergeSteps(project, driver, walked(project, driver, (branch) => names.isUnitBranch(unit, branch)), (ctx) => finishing(driver, ctx));
    const did = (/** @type {Answer} */ answer) => (answer.phases.length === 0 ? null : `phase ${answer.phases.map((/** @type {{phase: number}} */ merged) => merged.phase).join(', ')} merged`);
    return answered(walk(steps, did), (answer) => answer.phases.length > 0);
  });
}

/**
 * Whether each of the tasks given, whole, is chained into its phase's stack
 * wherever its change touches: in every repository holding its branch with
 * something past the default branch there, the stack holds it — a task
 * opened nowhere is not chained. Read off git and the host, writing and
 * fetching nothing, through the driver the project's setting names, else
 * the default (`holds`), each repository's stacks read once for every task.
 * Refused as the task's landing is read (`landingOf`), and its stack.
 * @param {string} cwd @param {string} unit @param {import('./drivers.cjs').TaskDetail[]} tasks
 */
function allChained(cwd, unit, tasks) {
  const project = { ...projectOf(cwd, unit), keepsReads: true };
  const driver = /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver);
  return tasks.every((held) => {
    const { task, holding } = landingOf(project, held.ref, held);
    const touched = holding.map((repo) => contextOf(project, repo)).filter((ctx) => !lg.isAncestor(ctx.root, task.branch, ctx.into));
    return touched.length > 0 && touched.every((ctx) => inRepo(ctx.repo, () => {
      driver.assertServes?.(ctx);
      return driver.holds(ctx, task.ref);
    }));
  });
}

/**
 * The commit a landing is read against in a repository: the branch it
 * lands on as the host has it (`landsOn`, fetched where the driver lands
 * through a host), else that branch here where the host cannot be read —
 * read once on a context that keeps its reads.
 * @param {LandingDriver} driver @param {LandingContext} ctx
 * @returns {string}
 */
function hostTip(driver, ctx) {
  return lg.readOnce(ctx, 'host tip', () => {
    try {
      return landsOn(driver, ctx);
    } catch {
      return /** @type {string} */ (lg.branches(ctx.root).get(ctx.into));
    }
  });
}

/** Whether a unit's tasks land as a quick-fix's one pull request: a unit built as a quick-fix (`quickFixBuild`). @param {string} cwd @param {string} unit */
function landsAsOne(cwd, unit) {
  assertUnit(unit);
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest !== null && quickFixBuild(manifest);
}

/** The unit's task an internal id names, as that id, or null where it names none of the unit's. @param {string} unit @param {string|null} id @returns {string|null} */
function unitTask(unit, id) {
  if (id === null) return null;
  try {
    return parseTaskId(id).unit === unit ? id : null;
  } catch {
    return null;
  }
}

/**
 * A quick-fix's task as its landing reads it: its newest own commit on the
 * branch past the default branch as the host has it, null where it has
 * none there; its newest own commit the repository holds anywhere, null
 * for none; whether it holds work of its own; and whether it has landed.
 * @typedef {{own: string|null, found: string|null, held: boolean, landed: boolean}} QuickFixTaskRead
 */

/**
 * A quick-fix's landing, read in the project's own repository, where its
 * one branch is, each read made once (the header's): the context; the
 * branch, and its tip here, undefined where it is gone; the tip of the
 * branch it lands on as the host has it (`hostTip`); the pull request's
 * heads (`quickFixPull`); the commits the branch holds past that tip,
 * oldest first, merges aside, each with the task it is stamped with, null
 * for none of the unit's; whether a commit of a task's has landed — on that
 * tip already, in a pull request merged, its change there with the change
 * it is laid on (`holdsTaskChange`), or a copy of it there (`holdsCopy`);
 * each task's read
 * (`QuickFixTaskRead`): landed as its newest own commit has — the one on
 * the branch past the tip, else the newest the repository has on any ref or
 * reflog since the day before its unit was made, as a branch cut again or
 * deleted leaves it — or, holding none, as the tip names it, by its landing
 * or a commit of its own through the door; holding work of its own where it
 * has such a commit, or has landed; and whether the pull request open holds
 * a task's newest commit. Read off git and the host,
 * writing nothing but the host's branch fetched where the driver fetches
 * it; refused as the driver refuses its read.
 * @param {string} cwd @param {string} unit
 */
function quickFixLanding(cwd, unit) {
  const project = { ...projectOf(cwd, unit), keepsReads: true };
  const driver = /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver);
  const ctx = contextOf(project, project.repos[0]);
  driver.assertServes?.(ctx);
  const { root } = ctx;
  const branch = names.quickFixBranch(unit);
  const at = lg.branches(root).get(branch);
  const tip = hostTip(driver, ctx);
  const since = dayBefore(manifestOf(stateRoot(cwd), unit)?.created);
  const key = stamp();
  const pull = () => lg.readOnce(ctx, 'quick-fix pull', () => driver.quickFixPull(ctx, branch));
  const commits = () => lg.readOnce(ctx, 'quick-fix commits', () => (at === undefined ? [] : lg.stampedPast(root, branch, tip, key))
    .map(({ sha, message, value }) => ({ sha, message, id: unitTask(unit, value) })));
  const named = () => lg.readOnce(ctx, 'quick-fix named', () => lg.tasksNamedOn(root, tip, unit, key, since));
  /** @param {string} sha @param {string} id */
  const landedCommit = (sha, id) => {
    const { merged } = pull();
    return lg.isAncestor(root, sha, tip) || merged.some((head) => lg.isAncestor(root, sha, head)) || lg.holdsTaskChange(root, tip, sha, key, id) || lg.holdsCopy(root, tip, sha);
  };
  /** @param {TaskRef} ref @returns {QuickFixTaskRead} */
  const task = (ref) => {
    const id = taskId(ref);
    const own = commits().filter((commit) => commit.id === id).pop()?.sha ?? null;
    if (own !== null) return { own, found: own, held: true, landed: landedCommit(own, id) };
    const found = lg.lastStamped(root, key, id, since);
    const landed = found === null ? named().has(id) : landedCommit(found, id);
    return { own, found, held: landed || found !== null, landed };
  };
  /** @param {QuickFixTaskRead} read */
  const inPull = (read) => {
    const { open } = pull();
    return read.own !== null && open !== null && lg.isAncestor(root, read.own, open);
  };
  return { ctx, driver, branch, at, tip, pull, commits, landedCommit, task, inPull };
}

/** A quick-fix's landing as `quickFixLanding` reads it. @typedef {ReturnType<typeof quickFixLanding>} QuickFixLanding */

/**
 * A quick-fix as it lands: its branch's tasks holding work past the default
 * branch as the host has it, in order, each by the type and title the
 * tracker holds for it, and the message it lands under (`quickFixMessage`)
 * — refused where the branch is gone, holds nothing past that branch, or
 * carries the state.
 * @param {string} cwd @param {QuickFixLanding} read @param {string} shown the task a refusal names
 * @returns {QuickFixTask}
 */
function quickFixTask(cwd, read, shown) {
  const { ctx, branch, at, tip } = read;
  const { unit } = ctx;
  if (at === undefined) throw new Error(`land: ${unit}'s branch ${branch} is not here — a task's start cuts it: task start ${unit} ${shown}`);
  if (lg.isAncestor(ctx.root, at, tip)) throw new Error(lg.nothingPast(shown, branch, ctx.into));
  refuseState(ctx, shown, branch, 'quick-fix\'s');
  const ids = new Set(read.commits().flatMap(({ id }) => (id === null ? [] : [id])));
  const manifest = loadWorkUnitManifest(cwd, unit);
  const tasks = trackedBuild(cwd, unit, buildLength(manifest)).tasks.filter((held) => ids.has(taskId(held.ref)) && held.type !== null);
  const title = String(manifest.description ?? '').split('\n').map((line) => line.trim()).find(Boolean) ?? unit;
  const message = names.quickFixMessage(unit, title, tasks.map((held) => ({ ref: held.ref, type: /** @type {string} */ (held.type), title: held.title })));
  return { branch, message, tasks: tasks.map((held) => shownTask(held.ref)) };
}

/**
 * What cutting the quick-fix's branch again did, where it did, as an
 * answer carries it (`cutAgain`, fix-branch.cjs): the answer's part, and the
 * warnings it gave.
 * @param {{answer: Record<string, unknown>, warnings: string[]}|null} cut
 */
const cutWords = (cut) => ({ cut: cut === null ? {} : { cut_again: cut.answer }, warnings: cut?.warnings ?? [] });

/**
 * `land open` of a quick-fix's task: its one pull request opened, or the
 * branch pushed to it where it is open (the header's) — refused for a task
 * closed or landed (fix-end.cjs), the branch first cut again where a merge
 * by hand left it holding work landed.
 * @param {string} cwd @param {Project} project @param {TaskRef} ref @param {{committed?: string|null, warnings?: string[]}} before what the tracker's read committed and warned of
 */
function quickFixOpen(cwd, project, ref, before) {
  const shown = shownTask(ref);
  carrying(before.warnings ?? [], () => fixEnd().refuseOpening(cwd, ref));
  return withDriver(cwd, (driver) => {
    const { cut, warnings } = cutWords(fixBranch().cutAgain(cwd, project.unit));
    const read = quickFixLanding(cwd, project.unit);
    const opened = carrying(warnings, () => driver.openQuickFix(read.ctx, quickFixTask(cwd, read, shown)));
    return { task: shown, branch: read.branch, ...(opened.already ? { already: true } : {}), ...answered([{ repo: '.', ...opened, warnings: [...warnings, ...(opened.warnings ?? [])] }]), ...cut };
  }, before);
}

/**
 * `land phase` and `land finish` of a quick-fix: its one pull request
 * merged, every task's commit squashed into one (the header's) — refused
 * before anything moves while a task is neither done nor closed
 * (fix-end.cjs), the branch first cut again where a merge by hand left it
 * holding work landed, so it holds none, and pushed to the pull request as
 * it then stands, opened again where none is open; `already` where the
 * branch holds no task's commit past the default branch as the host has
 * it, that branch here brought up to the host's.
 * @param {string} cwd @param {string} unit
 */
function quickFixLand(cwd, unit) {
  fixEnd().refuseUnended(cwd, unit);
  return withDriver(cwd, (driver) => {
    const { cut, warnings } = cutWords(fixBranch().cutAgain(cwd, unit));
    const read = quickFixLanding(cwd, unit);
    const owed = read.commits().find(({ id }) => id !== null);
    if (owed === undefined) {
      const settled = driver.mergeQuickFix(read.ctx, { branch: read.branch, message: '', tasks: [] });
      return { already: true, ...answered([{ repo: '.', ...settled, warnings: [...warnings, ...(settled.warnings ?? [])] }], () => false), ...cut };
    }
    const merged = carrying(warnings, () => {
      const landing = quickFixTask(cwd, read, shownTask(parseTaskId(/** @type {string} */ (owed.id))));
      driver.openQuickFix(read.ctx, landing);
      return driver.mergeQuickFix(read.ctx, landing);
    });
    return { ...answered([{ repo: '.', ...merged, warnings: [...warnings, ...(merged.warnings ?? [])] }]), ...cut };
  });
}

/**
 * A quick-fix's pull request closed unmerged, where one is open, as its move
 * closes it (workunit-move.cjs), through the driver the project names, its
 * setting left as it stands: whether this call closed one.
 * @param {string} cwd @param {string} unit @returns {{closed: boolean}}
 */
function quickFixClose(cwd, unit) {
  const project = projectOf(cwd, unit);
  const driver = /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver);
  const ctx = contextOf(project, project.repos[0]);
  driver.assertServes?.(ctx);
  return driver.closeQuickFix(ctx, names.quickFixBranch(unit));
}

/**
 * The unit's tasks landed, shown: each a landing on the default branch of a
 * repository of the project names by its `Task:` line, as every driver
 * lands a task (landing-names.cjs), searched from the time `from` names
 * where given (`dayBefore` the unit was made, before which none of its work
 * landed). A repository with no default branch to land on holds none. Where
 * `on` names other revisions of each repository, the landings they hold:
 * those a commit made of them is built on.
 * @param {string} cwd @param {string} unit @param {Repo[]} repos the project's @param {string|null} [from]
 * @param {(repo: Repo) => string[]} [on] the revisions read in each repository
 * @returns {Set<string>}
 */
function landedTasks(cwd, unit, repos, from = null, on = (repo) => [`refs/heads/${lg.landsOn(cwd, repo)}`]) {
  return new Set(repos.flatMap((repo) => {
    let read;
    try {
      read = on(repo);
    } catch {
      return [];
    }
    return lg.messagesNaming(repo.path, read, `Task: ${unit}-`, from).flatMap((message) => names.tasksOfMessage(unit, message).map(shownTask));
  }));
}

module.exports = { LAND_USAGE, landOpen, landChain, landPhase, landFinish, landedTasks, allChained, landingTips, mutationRun, quickFixLanding, quickFixClose };
