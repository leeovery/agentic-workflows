'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the `land` verbs (6.1.8, 7.2.8), a task's change landed
// through the project's landing driver (drivers.cjs): `open` the task's pull
// request, `chain` it into its phase's stack, merge a `phase` whole, and
// `finish`, which merges every phase still standing — the review phase's fix
// phases, after every other (7.2.6). `open` and `chain` refuse a task with
// no account taken of its review as it stands (task-account.cjs, 12.14),
// `open` taking a quick-fix's before its pair has read it, its one pull
// request opening at its first commit and each later one pushed to it
// (19.5.20) — its `task done` holding it to its account; `open` a bugfix's
// reproducing task until its test's series
// proves the bug at its tip (bug-proven.cjs, 15.5.3), and a task of a fix
// phase whose branch does not descend from the unit's work not landed below
// it, which a fix phase is built on (review-change.cjs, 7.2.6); `chain` a
// quick-fix's task, which has no stack to chain into, and a task its pair
// has not passed, read off its rounds' reports, or one
// changed under its last round since (round-report.cjs, 12.1.4); and
// `phase` a phase the cut holds until its phase review has passed and its
// fixes are done, as the phase's close reads it (phase-checks.cjs, 7.2.4),
// and one of the review's fix phases, past the cut, while a task of it is
// neither done nor closed — in flight among them (`unendedRefusal`); and
// `finish`, for every work type, and a quick-fix's `phase`, which lands its
// one pull request whole, as finish's yes refuses before it lands anything
// (finish.cjs, `finishLandRefusal`): the build's own refusals, the review
// phase not over where the unit has one — a fix task unended, in step a
// phase not merged, and a quick-fix's review asked for and not passed
// among them — a question waiting, a record not indexed, finish's
// checklist not closed, a quick-fix's fix unended or done and not
// recorded, a verdict still to ask, and a quick-fix's checkout holding
// changes not committed.
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
// A quick-fix lands as one pull request in each repository it touches
// (19.5.15, 7.2.24): every task of its build, its fixes and the fix tasks
// of a review asked for at its close, commits on its one branch in each
// (fix-branch.cjs), and each pull request is that branch's, onto that
// repository's default branch, landed children first, a submodule pointed
// at its landing as a task's merge points it (7.2.21). The repositories it
// reads come from its own record (`quickFixRepos`): the project's own, each
// nested one the record names — where the door committed a fix's share,
// recorded in the unit's state before the commit (fix-branch.cjs), so
// every clone carries it — and each nested one whose branch here holds
// work; walked as every verb walks (`walked`), whatever their branches here
// hold, so a branch gone here, a second clone, or a merge by hand that
// keeps the branch's commits leaves no repository out, and no host of any
// other is asked anything. A commit past the branch it lands on is the
// quick-fix's work where it was committed since the day before the unit
// was made — a fix's through the door, which refuses a commit git would
// date before then (commit-task.cjs), or a person's own made during the
// quick-fix (R19) — its stamp naming the task it is: a repository's work is
// the quick-fix's to open and land where its branch holds such a commit,
// and the host's branch is the unit's where it holds one, or a commit
// stamped with one of its tasks since then, as one merged by hand and kept
// there holds, so whatever is pushed is the unit's — one that holds
// neither, made long before, is another's, never taken, brought in,
// retitled or landed (fix-branch.cjs); a pull request is the unit's where
// opened from the repository itself, never a fork, since that day. The
// host's copy of the branch is the truth for what each pull request
// holds: the read fetches it and the open pull request's head, and every
// verb readies the branches from it before anything moves (`readied`,
// fix-branch.cjs), a push leased against the head it read. `open` of any
// of its tasks opens each, or pushes the branch to the one open, its title
// and description its landing's message as the branch stands
// (`quickFixMessage`, landing-names.cjs), its tasks in the order they were
// done (`doneOrder`), refused for a task closed or landed (fix-end.cjs);
// `phase` and `finish` each merge them, every commit on the branch
// squashed into one — a person's own among them — refused while a task is
// neither done nor closed, or done and holding work neither landed nor on
// the branch (fix-end.cjs) — `already` where no branch holds the
// quick-fix's work past the branch it lands on not landed, each brought up
// to the host's here. Its tasks' landing is read here (`quickFixLanding`),
// each task by content against each repository's default branch as the
// host has it, whether or not the branch is left, as a person's merge by
// hand, by any method, leaves it — for its tasks' opening, end and close
// (fix-end.cjs), the branches readied, its close (finish.cjs), its record
// (quick-fix-record.cjs) and its move (workunit-move.cjs), which closes
// each pull request open unmerged (`quickFixClose`), one closed by hand
// read as none open.
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
// repository holds. The other verbs walk the project's own repository and
// each nested one holding work on a branch of the unit's in question
// (`walked`), a quick-fix's each it touches. Every verb walks them
// children first, the project's own last, so a submodule's landing merges
// before the repository holding it records its pointer, as each driver
// records it; a merge is told, for
// that, each submodule of its repository, and which of them the walk lands
// in. A merge is refused before anything merges where a default branch
// points a submodule the walk lands in at a commit the submodule's own
// default branch does not descend from — each as it lands, what its driver
// lands onto (`landsOn`) — so no landing moves a pointer off it; but where
// that branch holds the commit's change, as merging the submodule's pull
// request by hand after its holder's leaves it, for every work type, the
// merge goes on (`repointsOf`): a stack moving that submodule lands its
// pointer at the submodule's landing of the moving commit's change, as
// every merge does (`stackMoves`); one the repository's merge leaves where
// it was is then pointed at the submodule's landing of its change, found
// as a merge finds a submodule's landing, by one commit of its own the
// driver lands (`repoint`) — a re-point made only for a submodule no merge
// of the walk moves, and read by every read after it. A verb answers each
// repository it re-pointed, and a refusal after a merge names it. A
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
const { trackedTask, trackedPhase, trackedBuild, phaseWritten, ENDED } = require('./task-verbs.cjs');
const { taskRounds, pairPassed, changedUnder, changedRefusal, phaseReviewBegun } = require('./round-report.cjs');
const { verifySetup } = require('./environment.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { cutLength, buildLength, quickFixBuild, isFixPhase } = require('./derivations.cjs');
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
const finish = () => require('./finish.cjs');
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
 * A quick-fix to land in one repository: its one branch, the message it
 * lands under, the tasks holding work on the branch past the default
 * branch, shown, in order; the host's copy of the branch as the landing
 * read it, null where the host has none, which a push replaces only while
 * it stands there; the time the unit's pull requests are read from, those
 * opened before it no pull request of the unit's; and, for a merge, the
 * pointers its submodules move to.
 * @typedef {{branch: string, message: string, tasks: string[], head: string|null, since: string|null, pointers: Map<string, string|null>}} QuickFixTask
 */

/**
 * A quick-fix's pull request as a driver reads it in one repository, of
 * those opened from the repository itself, never a fork, since the time
 * the seam names: the head of the one open, null where none is; the heads
 * of those merged into the default branch, each held here; the host's copy
 * of the branch, held here, null where the host has none; and, where the
 * latest was closed by hand, the driver's words for it and its way on,
 * else null.
 * @typedef {{open: string|null, merged: string[], head: string|null, closed: string|null}} QuickFixPull
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
 * own, and each nested one the unit `touches` — each refused before any
 * acts where the driver does not serve its remote.
 * @param {Project} project @param {LandingDriver} driver @param {(repo: Repo) => boolean} touches
 * @returns {Repo[]}
 */
function walked(project, driver, touches) {
  const repos = childrenFirst(project.repos).filter((repo) => repo.dir === '' || touches(repo));
  for (const repo of repos) {
    const ctx = contextOf(project, repo);
    inRepo(ctx.repo, () => driver.assertServes?.(ctx));
  }
  return repos;
}

/**
 * Whether a nested repository holds work on a branch of the unit's `picks`
 * names (`lg.holdsWork`): what a feature's or a bugfix's verbs walk.
 * @param {Project} project @param {(branch: string) => boolean} picks
 * @returns {(repo: Repo) => boolean}
 */
const holdingWork = (project, picks) => (repo) => lg.holdsWork(project.unit, repo, picks);

/** A refusal after repositories moved: the warnings their landings gave, and what the repository refusing merged before its re-point refused (`mergedThenRepointed`). @typedef {Error & {landed?: string[], merged?: Record<string, any>}} Partial */

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
      throw movedBefore(err, done, did, ctx.repo);
    }
  }
  return done;
}

/**
 * A refusal carrying what moved, and where, before it — what the refusing
 * repository, `repo`, merged before its re-point refused among it — and
 * the warnings those landings gave (`Partial`).
 * @param {unknown} err @param {Answer[]} done @param {(answer: Answer) => string|null} did @param {string} repo
 */
function movedBefore(err, done, did, repo) {
  if (!(err instanceof Error)) return err;
  const { merged } = /** @type {Partial} */ (err);
  const all = merged === undefined ? done : [...done, { repo, ...merged }];
  /** @type {Map<string, string[]>} */
  const moved = new Map();
  for (const answer of all) {
    const what = did(answer);
    if (what !== null) moved.set(what, [...(moved.get(what) ?? []), answer.repo === '.' ? 'the project' : lg.plain(answer.repo)]);
  }
  if (moved.size > 0) err.message = `${err.message} (${[...moved].map(([what, repos]) => `${what} in ${repos.join(', ')}`).join('; ')} before it)`;
  const { warnings } = answered(all, () => false);
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
 * Each repository whose default branch points a submodule the walk lands
 * in at a commit the submodule's own default branch does not descend from,
 * each as it lands, with the commit each such submodule is pointed at
 * instead: the submodule's landing there of that pointer's change, as a
 * merge by hand of the submodule after the repository holding it leaves
 * it, by the tasks the commit that last moved the pointer names
 * (`repointing`), each by the commit it points at now and that landing —
 * refused, before anything merges, where there is none.
 * @param {LandingDriver} driver @param {LandingContext[]} merging
 * @returns {Map<string, Map<string, {from: string, to: string}>>} by the repository, as answers name it
 */
function repointsOf(driver, merging) {
  /** @type {Map<string, Map<string, {from: string, to: string}>>} */
  const repoints = new Map();
  for (const ctx of merging.filter(({ submodules }) => submodules.length > 0)) {
    inRepo(ctx.repo, () => {
      const tip = landsOn(driver, ctx);
      const [pointers] = lg.pointersAt(ctx.root, [tip], ctx.submodules.map(({ path }) => path));
      /** @type {Map<string, {from: string, to: string}>} */
      const pointed = new Map();
      for (const { path, ctx: sub } of ctx.submodules) {
        const sha = pointers.get(path) ?? null;
        if (sha === null) continue;
        const tasks = () => names.tasksOfMessage(ctx.unit, lg.lastPointing(ctx.root, tip, path)).map(shownTask);
        const found = lg.repointing(ctx.into, path, sub, sha, landsOn(driver, sub), tasks);
        if (found === null) continue;
        if ('refused' in found) throw new Error(found.refused);
        pointed.set(path, { from: sha, to: found.to });
      }
      if (pointed.size > 0) repoints.set(ctx.repo, pointed);
    });
  }
  return repoints;
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
 * once no default branch points a submodule at a commit its own lacks,
 * found before anything merges (`repointsOf`); then, in a repository whose
 * default branch pointed one at a commit whose change the submodule
 * landed, each such submodule its merge left where it was pointed at that
 * landing through the driver (`mergedThenRepointed`).
 * @param {Project} project @param {LandingDriver} driver @param {Repo[]} walking @param {(ctx: LandingContext) => Record<string, any>|null} act
 * @returns {Step[]}
 */
function mergeSteps(project, driver, walking, act) {
  const merging = walking.map((repo) => mergingIn(project, repo, walking));
  const repoints = repointsOf(driver, merging);
  return merging.map((ctx) => {
    const found = repoints.get(ctx.repo);
    return { ctx, act: () => (found === undefined ? act(ctx) : mergedThenRepointed(driver, ctx, found, act)) };
  });
}

/** What a re-point did, as an answer or a refusal says it. @param {Iterable<string>} paths @returns {string} */
function pointedWords(paths) {
  const listed = [...paths].map(lg.plain);
  return `${listed.join(', ')} pointed at ${listed.length === 1 ? 'its landing' : 'their landings'}`;
}

/**
 * A repository's part of a merge, `act` first, then each submodule `found`
 * that the merge left pointing where it did, as the default branch it
 * lands onto now points it, re-pointed through the driver at its landing
 * (`mergeSteps`): what `act` answered — `already` where it merged nothing —
 * with `repointed` where a re-point was made, and the warnings of both; a
 * refusal of the re-point carrying what `act` merged before it
 * (`Partial`), for the walk to name.
 * @param {LandingDriver} driver @param {LandingContext} ctx @param {Map<string, {from: string, to: string}>} found @param {(ctx: LandingContext) => Record<string, any>|null} act
 */
function mergedThenRepointed(driver, ctx, found, act) {
  const { warnings = [], ...answer } = act(ctx) ?? { into: ctx.into, already: true };
  const [now] = lg.pointersAt(ctx.root, [landsOn(driver, ctx)], [...found.keys()]);
  const pointers = new Map([...found].filter(([path, { from }]) => (now.get(path) ?? null) === from).map(([path, { to }]) => [path, to]));
  if (pointers.size === 0) return { ...answer, ...(warnings.length > 0 ? { warnings } : {}) };
  let repointed;
  try {
    repointed = driver.repoint(ctx, pointers);
  } catch (err) {
    if (err instanceof Error) /** @type {Partial} */ (err).merged = { ...answer, warnings };
    throw err;
  }
  const { warnings: said = [], ...made } = repointed;
  const all = [...warnings, ...said];
  return { ...answer, repointed: { pointers: Object.fromEntries(pointers), ...made }, ...(all.length > 0 ? { warnings: all } : {}) };
}

/** Whether a repository's part of a walk moved anything: merged, or re-pointed (`mergedThenRepointed`). @param {Answer} answer */
const moved = (answer) => !answer.already || 'repointed' in answer;

/**
 * What a repository's part of a walk did, as a refusal after it names it:
 * what `did` says it merged, then its re-point.
 * @param {(answer: Answer) => string|null} did @returns {(answer: Answer) => string|null}
 */
const didWith = (did) => (answer) => {
  const words = [did(answer), ...('repointed' in answer ? [pointedWords(Object.keys(answer.repointed.pointers))] : [])].filter((said) => said !== null);
  return words.length === 0 ? null : words.join(', then ');
};

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
 * before anything moves for a quick-fix's, which has no stack, and where its
 * pair has not passed it.
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landChain(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  if (landsAsOne(cwd, unit)) throw new Error(`land: ${unit} is a quick-fix, whose tasks land in its one pull request — land open ${unit} ${shownTask(ref)} takes each, with no stack to chain it into`);
  refuseUnpassed(cwd, ref);
  const project = projectOf(cwd, unit);
  const ofTask = (/** @type {string} */ branch) => {
    const of = names.taskOfBranch(unit, branch);
    return of !== null && of.phase === ref.phase && of.n === ref.n;
  };
  return withDriver(cwd, (driver) => {
    const steps = walked(project, driver, holdingWork(project, ofTask)).map((repo) => {
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
 * its phase review has passed and its fixes are done (7.2.4, 12.11.3), and
 * for one of the review's fix phases while a task of it is unended. A
 * quick-fix's phase lands its one pull request (`quickFixLand`), refused
 * for a phase the tracker holds none of, and as its finish's landing is
 * (`refuseUnfinished`).
 * @param {string} cwd @param {string} unit @param {string} given
 */
function landPhase(cwd, unit, given) {
  const phase = parsePhase(given);
  assertUnit(unit);
  if (landsAsOne(cwd, unit)) {
    if (!phaseWritten(cwd, unit, phase)) throw new Error(`land: ${unit} has no phase ${phase} — a quick-fix lands as one pull request, every phase it holds with it: land finish ${unit}`);
    refuseUnfinished(cwd, unit);
    return { phase, ...quickFixLand(cwd, unit) };
  }
  const unreviewed = phaseChecks().phaseReviewRefusal(cwd, unit, phase) ?? fixPhaseRefusal(cwd, unit, phase);
  if (unreviewed !== null) throw new Error(`land: ${unreviewed}`);
  const project = projectOf(cwd, unit);
  const ofPhase = (/** @type {string} */ branch) => (names.taskOfBranch(unit, branch)?.phase ?? names.phaseOfBranch(unit, branch)) === phase;
  return withDriver(cwd, (driver) => {
    const steps = mergeSteps(project, driver, walked(project, driver, holdingWork(project, ofPhase)), (ctx) => driver.mergePhase(ctx, phase));
    const answers = walk(steps, didWith((answer) => (answer.already ? null : `phase ${phase} merged`)));
    if (answers.length === 0) throw new Error(`land: phase ${phase} of ${unit} has no task opened — open its tasks first`);
    scratch().readersDone(cwd, scratch().READERS.phase(unit, phase));
    const already = answers.some(moved) ? {} : { already: true };
    return { phase, ...already, ...answered(answers, moved) };
  });
}

/**
 * Why a landing waits on tasks neither done nor closed, the first of them
 * named in its way on: `{lands} once each of its tasks is done or closed`,
 * where `lands` says what waits.
 * @param {string} unit @param {string[]} open shown, in order @param {string} lands
 */
function unendedRefusal(unit, open, lands) {
  const [named, are] = open.length === 1 ? [`task ${open[0]}`, 'is'] : [`tasks ${open.join(', ')}`, 'are'];
  return `${lands} once each of its tasks is done or closed — ${named} ${are} neither: task done ${unit} ${open[0]}, or task close ${unit} ${open[0]} --reason <why>`;
}

/**
 * Why one of the review's fix phases, past the cut (P14), cannot merge yet:
 * a task of it neither done nor closed, in flight among them — null for any
 * other phase, and where none is.
 * @param {string} cwd @param {string} unit @param {number} phase @returns {string|null}
 */
function fixPhaseRefusal(cwd, unit, phase) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest === null || !isFixPhase(manifest, phase)) return null;
  const open = (trackedPhase(cwd, unit, phase).tasks ?? []).filter(({ status }) => !ENDED.includes(status)).map(({ ref }) => shownTask(ref));
  return open.length === 0 ? null : unendedRefusal(unit, open, `phase ${phase} of ${unit} merges`);
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

/** Refuse, before anything moves, a landing of the unit's finish as finish's yes refuses before it lands (`finishLandRefusal`, finish.cjs). @param {string} cwd @param {string} unit */
function refuseUnfinished(cwd, unit) {
  const unfinished = finish().finishLandRefusal(cwd, unit);
  if (unfinished !== null) throw new Error(`land: ${unfinished}`);
}

/**
 * Every phase still standing merged, after every other (7.2.6), in every
 * repository of the unit's, children first — answering those where a phase
 * merged; a quick-fix's one pull request merged (`quickFixLand`). Refused
 * before anything moves as finish's yes refuses before it lands
 * (`refuseUnfinished`).
 * @param {string} cwd @param {string} unit
 */
function landFinish(cwd, unit) {
  assertUnit(unit);
  refuseUnfinished(cwd, unit);
  if (landsAsOne(cwd, unit)) return quickFixLand(cwd, unit);
  const project = projectOf(cwd, unit);
  return withDriver(cwd, (driver) => {
    const steps = mergeSteps(project, driver, walked(project, driver, holdingWork(project, (branch) => names.isUnitBranch(unit, branch))), (ctx) => finishing(driver, ctx));
    const merged = (/** @type {Answer} */ answer) => (answer.phases ?? []).length > 0;
    const did = (/** @type {Answer} */ answer) => (merged(answer) ? `phase ${answer.phases.map((/** @type {{phase: number}} */ phase) => phase.phase).join(', ')} merged` : null);
    return answered(walk(steps, didWith(did)), (answer) => merged(answer) || 'repointed' in answer);
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

/**
 * A quick-fix's pull request in a repository as its driver reads it
 * (`quickFixPull`), those opened from the repository itself since `since`
 * alone, read once on a context that keeps its reads.
 * @param {LandingDriver} driver @param {LandingContext} ctx @param {string} branch @param {string|null} since
 * @returns {QuickFixPull}
 */
const pullOf = (driver, ctx, branch, since) => lg.readOnce(ctx, 'quick-fix pull', () => inRepo(ctx.repo, () => driver.quickFixPull(ctx, branch, since)));

/**
 * The commit a landing is read against with no host asked: the branch it
 * lands on as last fetched (`landsOnAsFetched`), fetching nothing, else that
 * branch here.
 * @param {LandingDriver} driver @param {LandingContext} ctx
 * @returns {string}
 */
const fetchedTip = (driver, ctx) => driver.landsOnAsFetched?.(ctx) ?? /** @type {string} */ (lg.branches(ctx.root).get(ctx.into));

/** A quick-fix's pull request as a read asking no host takes it: none open, none merged, no copy on the host, none closed. @returns {QuickFixPull} */
const unreadPull = () => ({ open: null, merged: [], head: null, closed: null });

/**
 * The repositories a quick-fix's verbs walk (`walked`), children first (the
 * header's): the project's own, each nested one its record names
 * (`recordedRepos`, fix-branch.cjs), and each nested one whose branch here
 * holds work (`lg.holdsWork`) — no other read, and no host asked of any
 * other.
 * @param {Project} project @param {LandingDriver} driver @param {Record<string, any>|null} manifest the unit's
 * @returns {Repo[]}
 */
function quickFixRepos(project, driver, manifest) {
  const branch = names.quickFixBranch(project.unit);
  const recorded = new Set(fixBranch().recordedRepos(manifest));
  return walked(project, driver, (repo) => recorded.has(repo.dir) || lg.holdsWork(project.unit, repo, (held) => held === branch));
}

/** The time a quick-fix's work is read from: the day before its unit was made (`dayBefore`). @param {Record<string, any>|null} manifest the unit's */
const workSince = (manifest) => dayBefore(manifest?.created);

/** That time in milliseconds, none before it where the unit names no date. @param {string|null} since */
const sinceTime = (since) => (since === null ? -Infinity : Date.parse(since));

/** The time a quick-fix's work is read from, in milliseconds (`workSince`): a commit made before it none of the unit's work. @param {Record<string, any>|null} manifest the unit's */
const workFrom = (manifest) => sinceTime(workSince(manifest));

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
 * A quick-fix's task as its landing reads it in one repository: its newest
 * own commit on the branch past the default branch as the host has it,
 * null where it has none there; its newest own commit the repository holds
 * anywhere, null for none; whether it holds work of its own there; and
 * whether that work has landed.
 * @typedef {{own: string|null, found: string|null, held: boolean, landed: boolean}} QuickFixTaskRead
 */

/** A commit the quick-fix's branch holds past the default branch as the host has it, the time it was committed, in milliseconds, and the unit's task it is stamped with, null for none. @typedef {{sha: string, message: string, committed: number, id: string|null}} QuickFixCommit */

/**
 * A quick-fix's landing in one repository it touches (the header's), each
 * read of the host made once: the context; the branch; the tip of the
 * branch it lands on as the host has it (`hostTip`); the branch's tip here,
 * read as it stands, undefined where it is gone; the time the unit's work
 * is read from; the pull request as the driver reads it (`pullOf`), the
 * host's copy of the branch among it; the commits a commit holds past that
 * tip, oldest first, merges aside, each with its time and task — the
 * branch's, none where it is gone — and whether the branch's hold the
 * quick-fix's work: a commit committed since `since`, a fix's through the
 * door or a person's own made during the quick-fix (R19); whether the
 * host's copy is another's, holding none of the quick-fix's work past the
 * tip and no commit stamped with one of the unit's tasks since `since`
 * (`lg.stampsUnit`), as a branch of that name made long before holds
 * neither and one merged by hand and kept there holds the stamped;
 * whether a commit has
 * landed — on that tip already, in a pull request merged, a task's change
 * there with the change it is laid on (`holdsTaskChange`), or a copy of it
 * there (`holdsCopy`) — and whether a commit holds one past the tip that
 * has not; each task's read (`QuickFixTaskRead`): landed as its newest own
 * commit has — the one on the branch past the tip, else the newest the
 * repository has on any ref or reflog since `since`, as a branch cut again
 * or deleted leaves it — or, holding none, as the tip names it; holding
 * work where it has such a commit, or has landed; and whether the pull
 * request open holds a task's newest commit, refused where the latest was
 * closed by hand (`refuseClosed`). `asFetched`, no host is asked: the tip
 * is the branch it lands on as last fetched (`fetchedTip`), and no pull
 * request is read (`unreadPull`).
 * @param {Project} project @param {LandingDriver} driver @param {Repo} repo @param {string|null} since @param {boolean} asFetched
 */
function repoLanding(project, driver, repo, since, asFetched) {
  const ctx = contextOf(project, repo);
  const { root, unit } = ctx;
  const branch = names.quickFixBranch(unit);
  const tip = asFetched ? fetchedTip(driver, ctx) : hostTip(driver, ctx);
  const key = stamp();
  const at = () => lg.branches(root).get(branch);
  const pull = asFetched ? unreadPull : () => pullOf(driver, ctx, branch, since);
  const from = sinceTime(since);
  /** @param {string} rev @returns {QuickFixCommit[]} */
  const commitsOn = (rev) => lg.readOnce(ctx, `quick-fix commits ${rev}`, () => lg.stampedPast(root, rev, tip, key).map(({ sha, message, committed, value }) => ({ sha, message, committed, id: unitTask(unit, value) })));
  /** @returns {QuickFixCommit[]} */
  const commits = () => {
    const head = at();
    return head === undefined ? [] : commitsOn(head);
  };
  /** @param {QuickFixCommit} commit */
  const isWork = ({ committed }) => committed >= from;
  const holdsQuickFixWork = () => commits().some(isWork);
  const foreign = () => {
    const { head } = pull();
    return head !== null && !commitsOn(head).some(isWork) && !lg.stampsUnit(root, head, key, unit, since);
  };
  const named = () => lg.readOnce(ctx, 'quick-fix named', () => lg.tasksNamedOn(root, tip, unit, key, since));
  /** @param {string} sha @param {string|null} id */
  const landedCommit = (sha, id) => lg.isAncestor(root, sha, tip) || pull().merged.some((head) => lg.isAncestor(root, sha, head))
    || (id !== null && lg.holdsTaskChange(root, tip, sha, key, id)) || lg.holdsCopy(root, tip, sha);
  /** @param {string} rev */
  const holdsUnlanded = (rev) => commitsOn(rev).some(({ sha, id }) => !landedCommit(sha, id));
  /** @param {TaskRef} ref @returns {QuickFixTaskRead} */
  const task = (ref) => {
    const id = taskId(ref);
    const own = commits().filter((commit) => commit.id === id).pop()?.sha ?? null;
    if (own !== null) return { own, found: own, held: true, landed: landedCommit(own, id) };
    const found = lg.lastStamped(root, key, id, since);
    const landed = found === null ? named().has(id) : landedCommit(found, id);
    return { own, found, held: landed || found !== null, landed };
  };
  const refuseClosed = () => {
    const { closed } = pull();
    if (closed !== null) inRepo(ctx.repo, () => { throw new Error(`land: ${closed}`); });
  };
  /** @param {QuickFixTaskRead} read */
  const inPull = (read) => {
    refuseClosed();
    const { open } = pull();
    return read.own !== null && open !== null && lg.isAncestor(root, read.own, open);
  };
  return { repo, ctx, branch, tip, at, since, pull, foreign, commits, holdsQuickFixWork, landedCommit, holdsUnlanded, task, refuseClosed, inPull };
}

/** A quick-fix's landing in one repository, as `repoLanding` reads it. @typedef {ReturnType<typeof repoLanding>} RepoLanding */

/**
 * A quick-fix's landing (the header's), read once per verb in every
 * repository it touches, as a verb walks them (`quickFixRepos`), children
 * first, the project's own last. A task's read gathers each repository's:
 * where it holds work, whether that work has landed in every one of them,
 * in any, and each repository's read of it. Read off git and the host,
 * writing nothing but the host's branches fetched where the driver fetches
 * them; refused as the driver refuses its reads — or, `asFetched`, as the
 * board reads it, off git alone, the host's branches as last fetched and
 * no pull request read, writing nothing (`repoLanding`).
 * @param {string} cwd @param {string} unit @param {{asFetched?: boolean}} [how]
 */
function quickFixLanding(cwd, unit, { asFetched = false } = {}) {
  const project = { ...projectOf(cwd, unit), keepsReads: true };
  const driver = /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver);
  const branch = names.quickFixBranch(unit);
  const manifest = manifestOf(stateRoot(cwd), unit);
  const since = workSince(manifest);
  const repos = quickFixRepos(project, driver, manifest).map((repo) => repoLanding(project, driver, repo, since, asFetched));
  /** @param {TaskRef} ref */
  const task = (ref) => {
    const each = repos.map((read) => ({ read, task: read.task(ref) })).filter((held) => held.task.held);
    return { held: each.length > 0, landed: each.length > 0 && each.every((held) => held.task.landed), landedAny: each.some((held) => held.task.landed), each };
  };
  return { project, driver, branch, repos, own: /** @type {RepoLanding} */ (repos.at(-1)), task, refuseClosed: () => repos.forEach((read) => read.refuseClosed()) };
}

/** A quick-fix's landing as `quickFixLanding` reads it. @typedef {ReturnType<typeof quickFixLanding>} QuickFixLanding */

/**
 * The order a quick-fix's tasks land in (19.5.17): the fixes in the order
 * they were done, as their records were written, then the rest in the
 * order their commits stand on the branch.
 * @param {Record<string, any>} manifest @param {string[]} ids in the branch's order
 */
function doneOrder(manifest, ids) {
  /** @type {string[]} */
  const recorded = manifest.fixes?.recorded ?? [];
  const place = (/** @type {string} */ id) => (recorded.includes(id) ? recorded.indexOf(id) : recorded.length + ids.indexOf(id));
  return [...ids].sort((a, b) => place(a) - place(b));
}

/**
 * A quick-fix as it lands in one repository: its branch, the tasks its
 * commits past the default branch as the host has it are stamped with, in
 * the order they land (`doneOrder`), each by the type and title the
 * tracker holds for it, the message it lands under (`quickFixMessage`),
 * the host's copy of the branch as it was read, null where the host has
 * none, and the time the unit's pull requests are read from — refused for
 * a task with no type (7.2.18), and, in the project's own repository, where
 * its change carries the state.
 * @param {string} cwd @param {RepoLanding} read @param {string} shown the task a refusal names
 * @returns {QuickFixTask}
 */
function quickFixTask(cwd, read, shown) {
  const { ctx, branch } = read;
  const { unit } = ctx;
  if (ctx.repo === '.') refuseState(ctx, shown, branch, 'quick-fix\'s');
  const manifest = loadWorkUnitManifest(cwd, unit);
  const ids = doneOrder(manifest, [...new Set(read.commits().flatMap(({ id }) => (id === null ? [] : [id])))]);
  const held = new Map(trackedBuild(cwd, unit, buildLength(manifest)).tasks.map((tracked) => [taskId(tracked.ref), tracked]));
  const tasks = ids.flatMap((id) => {
    const tracked = held.get(id);
    if (tracked === undefined) return [];
    if (tracked.type === null) throw new Error(untyped(tracked.ref, tracked.status));
    return [{ ref: tracked.ref, type: tracked.type, title: tracked.title }];
  });
  const title = String(manifest.description ?? '').split('\n').map((line) => line.trim()).find(Boolean) ?? unit;
  return { branch, message: names.quickFixMessage(unit, title, tasks), tasks: tasks.map(({ ref }) => shownTask(ref)), head: read.pull().head, since: read.since, pointers: new Map() };
}

/**
 * Refuse a quick-fix's opening where its branch is not in the project's
 * own repository, or no repository it touches holds the quick-fix's work
 * past the branch it lands on as the host has it (`holdsQuickFixWork`);
 * else the repositories that do.
 * @param {QuickFixLanding} read @param {string} shown
 * @returns {RepoLanding[]}
 */
function owing(read, shown) {
  const { own, branch } = read;
  const { unit } = own.ctx;
  if (own.at() === undefined) throw new Error(`land: ${unit}'s branch ${branch} is not here — a task's start cuts it: task start ${unit} ${shown}`);
  const past = read.repos.filter((held) => held.holdsQuickFixWork());
  if (past.length === 0) throw new Error(lg.nothingPast(shown, branch, own.ctx.into));
  return past;
}

/**
 * What readying the quick-fix's branches did, as an answer carries it
 * (`readied`, fix-branch.cjs): the answer's part — each repository cut
 * again — the warning of each task left off, and the rest it gave.
 * @param {{cut: Record<string, unknown>[], remakes: string[], warnings: string[]}} made
 */
const cutWords = ({ cut, remakes, warnings }) => ({ cut: cut.length === 0 ? {} : { cut_again: cut }, remakes, warnings });

/**
 * A walk's answers, each repository's where `happened`, with the warnings
 * the verb gave before it — readying the branches — first.
 * @param {string[]} warnings @param {Answer[]} answers @param {(answer: Answer) => boolean} [happened]
 */
function walkedWith(warnings, answers, happened) {
  const { repos, warnings: said = [] } = answered(answers, happened);
  const all = [...warnings, ...said];
  return { repos, ...(all.length > 0 ? { warnings: all } : {}) };
}

/**
 * `land open` of a quick-fix's task: its one pull request opened in every
 * repository it touches whose branch holds anything past the branch it
 * lands on, children first, or the branch pushed to it where it is open
 * (the header's) — refused for a task closed or landed (fix-end.cjs), and
 * before anything opens where a branch points a submodule at a commit the
 * submodule here lacks (`refuseUnheldMoves`); each branch first readied
 * (`readied`, fix-branch.cjs).
 * @param {string} cwd @param {Project} project @param {TaskRef} ref @param {{committed?: string|null, warnings?: string[]}} before what the tracker's read committed and warned of
 */
function quickFixOpen(cwd, project, ref, before) {
  const shown = shownTask(ref);
  const read = carrying(before.warnings ?? [], () => quickFixLanding(cwd, project.unit));
  carrying(before.warnings ?? [], () => {
    read.refuseClosed();
    fixEnd().refuseOpening(cwd, ref, read);
  });
  return withDriver(cwd, (driver) => {
    const { cut, remakes, warnings: rest } = cutWords(fixBranch().readied(read));
    const warnings = [...remakes, ...rest];
    const opening = carrying(warnings, () => owing(read, shown).map((held) => ({ held, landing: quickFixTask(cwd, held, shown) })));
    carrying(warnings, () => opening.forEach(({ held, landing }) => inRepo(held.ctx.repo, () => refuseUnheldMoves(read.project, held.repo, { ref, branch: landing.branch, message: landing.message }, held.tip))));
    const steps = opening.map(({ held, landing }) => ({ ctx: held.ctx, act: () => driver.openQuickFix(held.ctx, landing) }));
    const answers = carrying(warnings, () => walk(steps, () => `${project.unit}'s pull request opened`));
    const already = answers.every((answer) => answer.already) ? { already: true } : {};
    return { task: shown, branch: read.branch, ...already, ...walkedWith(warnings, answers), ...cut };
  }, before);
}

/**
 * The pointers a repository's branch moves its submodules to as the
 * quick-fix lands (7.2.21): each it moves, a submodule the walk lands in at
 * its landing of the latest task that moved it, read off its default branch
 * by its `Task:` line — else, where that branch lacks the branch's pointer,
 * at the oldest commit there holding the pointer's change, as a merge by
 * hand under the person's own message lands it — and any found by neither,
 * or in a submodule the walk passes, at the branch's own pointer
 * (`stackMoves`) — read against the branch it lands onto as it stands now.
 * @param {LandingDriver} driver @param {RepoLanding} held @param {LandingContext} ctx the repository's merge context
 * @returns {Map<string, string|null>}
 */
function pointersOf(driver, held, ctx) {
  if (ctx.gitlinks.length === 0) return new Map();
  const tip = landsOn(driver, ctx);
  const ids = new Map(held.commits().map(({ sha, id }) => [sha, id]));
  const commits = lg.commitsPast(ctx.root, /** @type {string} */ (held.at()), [tip]).map(({ sha, parents }) => {
    const id = ids.get(sha) ?? null;
    return { sha, parents, tasks: id === null ? [] : [shownTask(parseTaskId(id))] };
  });
  return new Map(lg.stackMoves(ctx, commits, tip, (sub) => landsOn(driver, sub)).flatMap((moves) => [...moves]));
}

/**
 * `land phase` and `land finish` of a quick-fix: its one pull request
 * merged in every repository it touches whose branch holds anything past
 * the branch it lands on as the host has it, children first, every task's
 * commit squashed into one (the header's), a repository holding submodules
 * the walk lands in pointing them at their landings (`pointersOf`), each
 * other repository's default branch here brought up to the host's —
 * reached only past the refusals finish's yes makes before it lands
 * (`refuseUnfinished`), a task unended among them; refused before anything
 * moves while a task done holds work that is neither landed nor on its
 * branch (fix-end.cjs); each branch first readied (`readied`,
 * fix-branch.cjs), so it holds no work landed, then pushed to its pull
 * request as it stands, opened again where none is open. `already` where
 * no branch holds anything past it and nothing was re-pointed — the walk
 * made all the same, so a repository whose submodule's pull request was
 * merged by hand after its own is pointed at that landing.
 * @param {string} cwd @param {string} unit
 */
function quickFixLand(cwd, unit) {
  const read = quickFixLanding(cwd, unit);
  read.refuseClosed();
  return withDriver(cwd, (driver) => {
    const { cut, remakes, warnings: rest } = cutWords(fixBranch().readied(read));
    carrying(rest, () => fixEnd().refuseLeftOff(cwd, read));
    const warnings = [...remakes, ...rest];
    const past = read.repos.filter((held) => held.holdsQuickFixWork());
    const first = past.flatMap((held) => held.commits()).find(({ id }) => id !== null)?.id ?? null;
    const shown = first === null ? `${unit}'s first fix` : shownTask(parseTaskId(first));
    const answers = carrying(warnings, () => {
      const steps = mergeSteps(read.project, driver, read.repos.map((held) => held.repo), (ctx) => {
        const held = /** @type {RepoLanding} */ (read.repos.find((each) => each.ctx.repo === ctx.repo));
        if (!past.includes(held)) return driver.mergeQuickFix(ctx, null);
        const landing = { ...quickFixTask(cwd, held, shown), pointers: pointersOf(driver, held, ctx) };
        driver.openQuickFix(held.ctx, landing);
        return driver.mergeQuickFix(ctx, landing);
      });
      return walk(steps, didWith((answer) => (answer.already ? null : `${unit}'s pull request merged`)));
    });
    const already = answers.some(moved) ? {} : { already: true };
    return { ...already, ...walkedWith(warnings, answers, moved), ...cut };
  });
}

/**
 * A quick-fix's pull request closed unmerged in each repository it touches
 * (`quickFixRepos`), where one is open — as its move closes it
 * (workunit-move.cjs) — through the driver the project names, its setting
 * left as it stands: whether this call closed one.
 * @param {string} cwd @param {string} unit @returns {{closed: boolean}}
 */
function quickFixClose(cwd, unit) {
  const project = projectOf(cwd, unit);
  const driver = /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver);
  const manifest = manifestOf(stateRoot(cwd), unit);
  const closed = quickFixRepos(project, driver, manifest).map((repo) => {
    const ctx = contextOf(project, repo);
    return inRepo(ctx.repo, () => driver.closeQuickFix(ctx, names.quickFixBranch(unit), workSince(manifest)).closed);
  });
  return { closed: closed.some(Boolean) };
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

module.exports = {
  LAND_USAGE, landOpen, landChain, landPhase, landFinish, landedTasks, allChained, landingTips, mutationRun, quickFixLanding, quickFixClose, workFrom, unendedRefusal,
};
