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
// recorded, a verdict still to ask, and a quick-fix's worktree holding
// changes not committed.
// `chain` answers, where the task chained is the last of a phase of the cut
// not yet ended, the phase's notes consolidated (notes.cjs), its phase
// review not begun and the verify setup naming a mutation tool, the phase's
// mutation run as its `next` (verify.cjs, 15.6.3), once for the phase: a
// task the consolidation writes ends after it. `finish` refuses, naming
// what did not land, a phase it merged offered to merge again, so it never
// loops. Read here too: for the close in step, whether a phase's tasks are
// each in its stack (`allChained`); for a task with nothing of its
// unit's below it, where it starts in each repository (`landingTips`);
// and where a quick-fix's worktree lays out a nested repository lacking its
// branch, the branch it lands on as it stands here, no host asked, so a
// clone the quick-fix never touches never has its host called (R18,
// `tipsHere`).
// Which of a unit's tasks landed is read for every type from its landing
// record, else by its change (task-landed.cjs), each driver asking it of
// the read its repository's context carries (`landedOn`). Every verb keeps
// its reads, as a quick-fix's verbs do, so a driver reads the host once in
// each repository, and again only what a merge of its own moved; each task
// a merge of the verb's landed is noted on the context for the record its
// end writes (`merged`).
//
// Each verb records its landings as it ends (landing-record.cjs,
// `recording`), from the reads it made: by the engine, each task a merge
// of its own landed, at the newest commit on the default branch's
// first-parent line naming it by its `Task:` line, its first landing,
// where no record names one, as the verb first read it; and, where it
// answered rather than refused, by the read, each other task its reads
// found landed with no record — the person's by hand, one it only brought
// here from the host among them. A refusal records only what merged before
// it, and a record not written is a warning beside the verb's answer, the
// next verb acting on the landing reading it again. Its own state commit
// of the record, `land({unit}): record …`, follows the verb's, and none is
// made where nothing new landed; the landing finish's yes makes carries it
// in the completion's commit (`finishMerge`). `open`, `phase` and `finish`
// refuse, before anything moves, a task whose branch moved apart from where
// its work landed (task-landed.cjs, `apart`), naming the commit that
// landed and the way on that lays the branch's work on it.
//
// Where a task stands against its landing is decided there once, for every
// driver and however the task landed (R29): from the commit the driver took
// it at (`taken`), landed, changed after its landing — whatever its branch
// gained since — or never landed (task-landed.cjs, `stands`). A task changed
// after its landing lands its branch whole, as it then stands, with its
// phase's next merge, never refused as a branch moved since it opened, which
// only a task never landed is; a phase landed takes a new task, opened onto
// the default branch, which lands with that merge (R30). Every driver lands
// a task alone so under the message the tracker's type and title give it
// (`message`). A task whose branch holds another task's work not landed —
// past the chain's tip as it opens, past the default branch as it lands
// alone — waits for that landing, but for a task of its own phase the
// driver took, which lands with it: refused before anything moves, naming
// the verb that lands it, `land phase` of its phase, else its open, or the
// branch cut again without it (R31, `refuseHeld`).
//
// A quick-fix lands as one pull request in each repository it touches
// (19.5.15, 7.2.24): every task of its build, its fixes and the fix tasks of
// a review asked for at its close, commits on its one branch in each
// (fix-branch.cjs), and each pull request is that branch's, onto that
// repository's default branch, landed children first (7.2.21). The
// repositories it reads come from its own record (`quickFixRepos`): the
// project's own, each nested one the record names — where the door committed
// a fix's share, recorded in the unit's state before the commit
// (fix-branch.cjs), so every clone carries it — and each nested one whose
// branch here holds work; walked as every verb walks (`walked`), whatever
// their branches here hold, so a branch gone here, a second clone, or a
// merge by hand that keeps the branch's commits leaves no repository out,
// and no host of any other is asked anything. A commit past the branch it
// lands on is the quick-fix's work where it was committed since the day
// before the unit was made — a fix's through the door, which refuses a
// commit git would date before then (commit-task.cjs), or a person's own
// made during the quick-fix (R19) — its stamp naming the task it is: a
// repository's work is the quick-fix's to open and land where its branch
// holds such a commit, and the host's branch is the unit's where it holds
// one, or a commit stamped with one of its tasks since then, as one merged
// by hand and kept there holds, so whatever is pushed is the unit's — one
// that holds neither, made long before, is another's, never taken, brought
// in, retitled or landed (fix-branch.cjs); a pull request is the unit's
// where opened from the repository itself, never a fork, since that day. The
// host's copy of the branch is the truth for what each pull request holds:
// the read fetches it and the open pull request's head, and every verb
// readies the branches from it before anything moves (`readied`,
// fix-branch.cjs), a push leased against the head it read. `open` of any of
// its tasks opens each, or pushes the branch to the one open, its title and
// description its landing's message as the branch stands (`quickFixMessage`,
// landing-names.cjs), its tasks in the order they were done (`doneOrder`),
// refused for a task closed or landed (fix-end.cjs); `phase` and `finish`
// each merge them, every commit on the branch squashed into one — a person's
// own among them — refused while a task is neither done nor closed, or done
// and holding work neither landed nor on the branch (fix-end.cjs) —
// `already` where no branch holds the quick-fix's work past the branch it
// lands on not landed, each brought up to the host's here. Its tasks'
// landing is read here (`quickFixLanding`), each task as every type's is
// read (task-landed.cjs), a merge among its own commits by the one rule
// they are read by everywhere (landing-git.cjs, `quickFixMerges`), against
// each repository's default branch as the host has it, whether or not the
// branch is left, as a person's merge by hand, by any method, leaves it —
// for its tasks' opening, end and close (fix-end.cjs), the branches
// readied, its close (finish.cjs), its record (quick-fix-record.cjs) and its
// move (workunit-move.cjs), which closes each pull request open unmerged
// (`quickFixClose`), one closed by hand read as none open.
//
// A unit's cancel (18.3.9, workunit-lifecycle.cjs) closes every pull
// request open on a branch of the unit's, in each repository it touched,
// and keeps the branches under their own names (`cancelClose`): a
// quick-fix's as its move closes them, any other unit's each of its tasks'
// and its own, in each repository holding its work. The pull requests the
// host names are recorded on the unit's manifest as each closes
// (`closed_by_cancel`), and every context made after carries its
// repository's (`cancelClosed`), which the driver's reads take as none
// while each stays closed, so after a reactivate the landing opens what it
// needs anew, never refusing one of them as closed by hand: a quick-fix's
// close opens its one again as it merges (`quickFixLand`); `land phase`
// and finish's merges each open again, before they merge, every task done
// and not landed of those they merge whose pull request the cancel closed,
// and `land open`, before it opens its task, each such task whose work the
// task's branch holds, as `land open` opens it (`openedAgain`), so nothing
// lands short of the work done and nothing waits on a task the cancel
// closed.
//
// A unit with a branch of its own (7.2.34, unit-branch.cjs) lands its tasks
// and phases on it: each repository's context lands on the unit's landing
// branch (landing-git.cjs, `landingBranch`) — the unit's own where the
// repository holds it, readied first where this clone lacks it here, else
// the repository's default branch — so the default branch, throughout above,
// is the context's, and the landing record names that branch's first-parent
// line. A nested repository gets the unit's own as the unit's first task
// touching it opens there (`nestedMade`, 7.2.40). Finish then lands the
// unit's branch on the default branch in each repository holding it,
// children first, after every phase has merged onto it, in the same walk
// (`unitSteps`, 7.2.38), on contexts landing on the default branches:
// nothing where the unit has landed there, read by content (`unitRead`,
// 7.2.39) — its branch's tip held on the default branch as the driver lands
// onto it, or a commit on that branch's first-parent line past where they
// met holding the branch's change, as a merge, squash or rebase by hand
// leaves it, whatever the default branch changed since; refused before
// anything lands where a host takes no merge commit (`unitPull`); where the
// two would conflict, the default branch brought into the unit's branch
// first by the bring-up's own merge (unit-branch.cjs, `broughtUpToLand`) — a
// conflict left refusing, the merge begun in a worktree, the refusal naming
// the paths, the worktree and the way on, a merge settled there taken onto
// the branch as finish runs again, before anything lands
// (`settlementsTaken`); then landed by the driver by a merge commit
// (`landUnit`), under the names the unit lands under (landing-names.cjs,
// `unitLanding`), its description the phases merged into the branch there.
// Nothing of it is recorded. As its review phase begins, the default branch
// is brought into the branch and the unit's own pull request opened where
// the driver lands through a host (`openUnit`), so finish merges the one
// open (`reviewOpened`).
//
// What every driver shares is settled here: the names (landing-names.cjs);
// the branch everything lands on in each repository, never the
// state branch (4.9.4); and, for a task opened, its type and title, read
// from the tracker as the task verbs read a task (task-verbs.cjs), a task it
// lacks or holds with no type refused (7.2.18, 12.4.1), and its branch,
// named from them, whose change carries nothing under `.ledger/` at the top
// of the project's repository, where the state sits whichever folder of it
// the project is, in any case of its letters (4.1.3, 4.S2). Past the state,
// a project inside a larger repository reads the change from its own folder
// alone (7.2.17): what the change does outside it is the larger
// repository's, never refused, and lands with the task as its branch holds
// it.
//
// A task lands in every repository of the project it touches (7.2.17): the
// project's own and each clone nested in its folder (kernel/repos.cjs), each
// on its own default branch, under the same names. A nested repository holds
// work on a branch of the unit's where the branch holds a commit no branch
// there but the unit's holds — read without its default branch, so one the
// unit never touched is passed over, whatever remote or default branch it
// lacks; a task's worktree makes the branch in every child repository
// (12.7.10), changed or not. `open` judges, before it opens anything, the
// project's own repository and each nested one holding work on the task's
// branch: touched where the branch holds a commit past its chain's tip,
// which the driver answers there, and refused where it does not descend from
// that tip (12.7.1); one with nothing past its default branch or the chain's
// tip gets nothing. The other verbs walk the project's own repository and
// each nested one holding work on a branch of the unit's in question
// (`walked`), a quick-fix's each it touches. Every verb walks them children
// first, the project's own last. A driver that lands through a host refuses,
// before anything moves, a repository it walks whose remote it does not
// serve (`assertServes`). A refusal in a nested repository names it, and one
// after a repository moved names what moved where and carries the warnings
// those landings gave; the verb run again picks up where it stopped, a
// repository done already passed over; `open` and `phase` run again where
// their work is done answer `already`. `finish` makes, in each repository,
// the merge its driver picks next (`nextMerge`) until none is left, each
// warning given once, a refusal saying which phases merged before it. A verb
// answers, children first, as `repos`, each repository where its landing did
// something — a merge, those where a phase merged — and every warning, one
// in a nested repository naming it. Every verb, before anything else, stops
// on a rebase stopped in a worktree a remedy made in a repository it walks,
// until it is settled or ended there (landing-git.cjs).
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
const { taskRounds, pairPassed, changedUnder, changedRefusal, phaseReviewBegun, reviewedNone } = require('./round-report.cjs');
const { verifySetup } = require('./environment.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { cutLength, cutPhases, buildLength, quickFixBuild, fixesBegun, isFixPhase, builtSince, hasLanded } = require('./derivations.cjs');
const { dayBefore } = require('./dates.cjs');
const { reproducingHold } = require('./bug-proven.cjs');
const { repoLanded, landedIn, landedAcross, foundIn, workIn, unitLanded: tasksLanded } = require('./task-landed.cjs');
const { recordsIn, writeLandings, recordLandings } = require('./landing-record.cjs');
const { landsThroughHost, readied, madeNested, bringUp, broughtUpToLand, settlementsTaken } = require('./unit-branch.cjs');
const names = require('./landing-names.cjs');
const lg = require('./landing-git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { withWriterLock } = require('../kernel/manifest-io.cjs');
const { projectRepos, childrenFirst, repoName } = require('../kernel/repos.cjs');
const { STATE_DIR_NAME, stateRoot } = require('../kernel/state-root.cjs');
const { cancelClosedIn, closedAny } = require('./cancel-closed.cjs');

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
/** @typedef {import('./task-landed.cjs').TaskLanding} TaskLanding */
/** @typedef {import('./task-landed.cjs').RepoLanded} RepoLanded */
/** @typedef {import('./drivers.cjs').LandingDriver} LandingDriver */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/**
 * What a landing driver is called with, for one repository of the project:
 * the folder its git runs in — the code root, for the project's own — and
 * the repository as answers name it, `.` for the project's own; the unit;
 * the default branch everything lands on there; the name of its remote,
 * null where it has none chosen; the reads a driver keeps there, so
 * each is made once (`readOnce`); what has landed on a commit there
 * (`landedOn`, task-landed.cjs), the one read of whether a task has landed
 * and where it stands against its landing every driver asks, each commit
 * read once; the tasks, shown, a merge of the verb's landed, noted for the
 * record its end writes (`merged`); the message a task landing alone lands
 * under (`message`); the refusal of a task whose branch, at a commit,
 * holds another's work not landed on the default branch at a commit, past
 * it — or past the chain's tip given (`refuseHeld`); and the refusal of a
 * task whose branch did what no verb reads after its landing on the
 * default branch at a commit (`refuseLanded`), so a driver landing on the
 * host's copy refuses there what the default branch here has not seen;
 * and the pull requests the unit's cancel closed there, by the host's own
 * names (`closed_by_cancel`), which every read of the driver's takes as
 * none while it stays closed (`cancelClosed`).
 * @typedef {{
 *   root: string, repo: string, unit: string, into: string, remote: string|null, cancelClosed: Set<string>,
 *   reads: Map<string, unknown>, landedOn: (tip: string) => RepoLanded, merged: (shown: string[]) => void, message: (ref: TaskRef) => string,
 *   refuseHeld: (task: {ref: TaskRef, branch: string}, head: string, into: string, from?: {name: string, commit: string}) => void,
 *   refuseLanded: (into: string, refs: TaskRef[]) => void,
 * }} LandingContext
 */

/**
 * A task to land: its id, its branch, and the message it lands under.
 * @typedef {{ref: TaskRef, branch: string, message: string}} LandingTask
 */

/**
 * A quick-fix to land in one repository: its one branch, the message it
 * lands under, the tasks holding work on the branch past the default
 * branch, shown, in order; its pull request as the landing read it
 * (`QuickFixPull`), the host's copy of the branch among it, which a push
 * replaces only while it stands there; the time the unit's pull requests
 * are read from, those opened before it no pull request of the unit's.
 * @typedef {{branch: string, message: string, tasks: string[], pull: QuickFixPull, since: string|null}} QuickFixTask
 */

/**
 * A quick-fix's pull request as a driver reads it in one repository, of
 * those opened from the repository itself, never a fork, since the time
 * the seam names: the head of the one open, null where none is; the heads
 * of those merged into the default branch, each held here; the host's copy
 * of the branch, held here, null where the host has none; and, where the
 * latest was closed by hand, the driver's words for it and its way on,
 * else null. A driver may carry more on it: the seam hands the read back
 * to the driver's verbs that act on it, so a verb reads it once.
 * @typedef {{open: string|null, merged: string[], head: string|null, closed: string|null}} QuickFixPull
 */

/**
 * A unit's own pull request, onto the default branch, as a driver that
 * lands through a host reads it in one repository: the number of the one
 * open from the unit's branch, null where none is; and the driver's words
 * for why the host would refuse to land it by a merge commit, null where it
 * would not. The driver may carry more on it: the seam hands it back with
 * the landing (`UnitLanding`).
 * @typedef {{open: number|null, refused: string|null}} UnitPull
 */

/**
 * A unit's own branch to land on the default branch in one repository
 * (landing-names.cjs, `unitLanding`): the branch, its tip as the driver
 * lands it — the host's copy, where it lands through one — its pull
 * request's title and description, the merge commit's subject, and its
 * pull request as read, null for a driver with none.
 * @typedef {{branch: string, tip: string, title: string, body: string, subject: string, pull: UnitPull|null}} UnitLanding
 */

/**
 * The chain's tip a driver answers for a task: the branch the task's branch
 * must descend from, and that branch's commit, which the repository has
 * locally; and, where the task's branch does not descend from it, the
 * commit the task's change is laid onto it from — the driver's, where it
 * answers one, else set by the seam (`laidFrom`). A driver may carry more
 * on it for its own `open`.
 * @typedef {{name: string, commit: string, over?: string}} ChainTip
 */

/**
 * The project a verb lands in: its folder; whether its contexts land on the
 * default branches rather than the unit's landing branch (`onDefault`); its
 * repositories, its own first,
 * and their contexts, each made once, as the verb first needs it, keeping
 * the reads its driver makes there, and of each the commit the driver took
 * each task at, by the repository's root — read as first asked (`taken`),
 * and as far as the verb read it, none where it read none (`took`); each
 * one's default branch's tip as its context was made, null where it had
 * none, the tasks the verb's merges landed there, by their internal ids
 * (the context's `merged`), and the reads it made there, each source's in
 * the order made, by the repository's root; the time the unit's work is
 * read from (`workSince`);
 * its landing driver, read as first asked; and each task's landing
 * message, by the task shown, read as first asked (`taskMessage`).
 * @typedef {{
 *   cwd: string, unit: string, onDefault: boolean, repos: Repo[], contexts: Map<string, LandingContext>,
 *   taken: Map<string, () => Map<string, string>>, took: Map<string, () => Map<string, string>>, tips: Map<string, string|null>, merged: Map<string, Set<string>>, reads: {root: string, made: () => RepoLanded[]}[],
 *   since: string|null, manifest: Record<string, any>|null, driver: () => LandingDriver, messages: Map<string, string>,
 * }} Project
 */

/**
 * A land verb as `recording` wraps it: the project's repositories, read
 * once for the verb, and the projects it made, its record read from them
 * (`landingsLeft`).
 * @typedef {{repos: Repo[], made: Project[]}} Frame
 */

/** The land verbs `recording` wraps, the innermost last. @type {Frame[]} */
const recordingFrames = [];

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
 * The tasks of `shown` a merge of the verb's landed in the repository at
 * `root`, noted on the project for the record the verb's end writes
 * (`landingsLeft`).
 * @param {Project} project @param {string} root @param {string[]} shown
 */
function noteMerged(project, root, shown) {
  const noted = project.merged.get(root) ?? new Set();
  for (const at of shown) noted.add(taskId(parseShownTask(project.unit, at)));
  project.merged.set(root, noted);
}

/**
 * A merge's answer, the tasks it landed noted on its context (`merged`).
 * @template {Record<string, any>|null} A @param {LandingContext} ctx @param {A} answer @returns {A}
 */
function noted(ctx, answer) {
  ctx.merged(answer?.merged ?? []);
  return answer;
}

/**
 * A repository's context, once no rebase a remedy began is stopped there:
 * the branch it lands on the unit's landing branch (landing-git.cjs,
 * `landingBranch`) — its own, readied first where the repository lacks it
 * here (unit-branch.cjs), or, for a project landing on the default
 * branches (`onDefault`), the default branch — and the commit the driver
 * took each task at read once, as first asked.
 * @param {Project} project @param {Repo} repo @param {string|null} remote
 * @returns {LandingContext}
 */
function repoContext(project, repo, remote) {
  const nested = repo.dir !== '';
  const named = nested ? repo.dir : '.';
  return inRepo(named, () => {
    const stopped = lg.scratchBlock(repo.path);
    if (stopped !== null) throw new Error(`land: ${stopped}`);
    const own = project.onDefault ? null : lg.unitBranchIn(project.cwd, repo, project.unit);
    if (own !== null) readied({ root: repo.path, nested: nested ? repo.dir : null, remote, hosted: landsThroughHost(project.driver(), remote) }, project.unit, own);
    const local = lg.branches(repo.path);
    const into = own ?? lg.defaultBranch(repo.path, remote, nested, local);
    project.tips.set(repo.path, local.get(into) ?? null);
    /** @type {Map<string, string>|undefined} */
    let took;
    const taken = () => (took ??= project.driver().taken(ctx));
    project.taken.set(repo.path, taken);
    project.took.set(repo.path, () => took ?? new Map());
    const recorded = recordsIn(project.manifest, named);
    const landedOn = landedIn(repo.path, project.unit, project.since, taken, recorded, workIn(repo.path, project.unit, project.since, local, mergesIn(project.cwd, project.manifest, repo, project.unit)));
    project.reads.push({ root: repo.path, made: landedOn.made });
    /** @type {LandingContext} */
    const ctx = {
      root: repo.path,
      repo: named,
      unit: project.unit,
      into,
      remote,
      cancelClosed: cancelClosedIn(project.manifest, named),
      reads: new Map(),
      landedOn,
      merged: (shown) => noteMerged(project, repo.path, shown),
      message: (ref) => taskMessage(project, ref),
      refuseHeld: (task, head, into, from = { name: ctx.into, commit: into }) => refuseHeld(ctx, taken(), task, head, into, from),
      refuseLanded: (into, refs) => refuseAfterLanding(ctx, into, refs, project.driver()),
    };
    return ctx;
  });
}

/**
 * The project a verb lands in, its own repository's context made first, its
 * landing driver the one its setting names, else the default, read as first
 * asked — its contexts landing on the default branches where `onDefault`,
 * as the unit's own branch lands at finish, and the record its verb writes
 * read from it unless it is not `recorded` (`landingsLeft`): each task's
 * landing is recorded on the unit's landing branch alone.
 * @param {string} cwd @param {string} unit @param {Repo[]} [repos] the project's, where the caller has read them — the land verb's own, `recording` having read them
 * @param {{onDefault?: boolean, recorded?: boolean}} [how]
 * @returns {Project}
 */
function projectOf(cwd, unit, repos = recordingFrames.at(-1)?.repos ?? projectRepos(codeRoot(cwd)), { onDefault = false, recorded = true } = {}) {
  assertUnit(unit);
  /** @type {LandingDriver|undefined} */
  let chosen;
  const manifest = manifestOf(stateRoot(cwd), unit);
  /** @type {Project} */
  const project = {
    cwd,
    unit,
    onDefault,
    repos,
    since: workSince(manifest),
    manifest,
    contexts: new Map(),
    taken: new Map(),
    took: new Map(),
    tips: new Map(),
    merged: new Map(),
    reads: [],
    driver: () => (chosen ??= /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver)),
    messages: new Map(),
  };
  if (recorded) recordingFrames.at(-1)?.made.push(project);
  project.contexts.set('', repoContext(project, repos[0], remoteName(cwd)));
  return project;
}

/** A repository's context in the project, made once. @param {Project} project @param {Repo} repo @returns {LandingContext} */
function contextOf(project, repo) {
  const made = project.contexts.get(repo.dir) ?? repoContext(project, repo, nestedRemoteName(repo.path));
  project.contexts.set(repo.dir, made);
  return made;
}

/**
 * The message a task lands under alone (the header's): its landing's, from
 * the type and title the tracker holds for it, read once — refused as
 * `open` refuses a task the tracker lacks or holds with no type.
 * @param {Project} project @param {TaskRef} ref
 */
function taskMessage(project, ref) {
  const shown = shownTask(ref);
  if (!project.messages.has(shown)) {
    const { type, title, status } = trackedTask(project.cwd, ref, untracked(ref));
    if (type === null) throw new Error(untyped(ref, status));
    project.messages.set(shown, names.landedMessage(ref, type, title));
  }
  return /** @type {string} */ (project.messages.get(shown));
}

/**
 * Refuse a task whose branch, at `head`, holds another of the unit's tasks'
 * work not landed on the default branch at `into`, past `from` (the
 * header's, R31; task-landed.cjs, `heldPast`) — but a task of its own phase
 * the driver took, which lands with it: it waits for that landing, the
 * refusal naming the verb that lands it — `land phase` of its phase, where
 * the driver took it, else its open — or the branch cut again from `from`
 * without it.
 * @param {LandingContext} ctx @param {Map<string, string>} taken the commit the driver took each task at, by its internal id
 * @param {{ref: TaskRef, branch: string}} task @param {string} head @param {string} into @param {{name: string, commit: string}} from
 */
function refuseHeld(ctx, taken, { ref, branch }, head, into, from) {
  const held = ctx.landedOn(into).heldPast(head, [from.commit]).filter((other) => shownTask(other) !== shownTask(ref) && !(other.phase === ref.phase && taken.has(taskId(other))));
  if (held.length === 0) return;
  const holds = `land: task ${shownTask(ref)}'s branch ${branch} holds the work of`;
  const opened = held.filter((other) => taken.has(taskId(other)));
  if (opened.length === 0) throw new Error(`${holds} ${tasksNamed(held)}, not opened — open ${tasksNamed(held)} first`);
  const it = opened.length === 1 ? 'it' : 'them';
  const merges = [...new Set(opened.map(({ phase }) => phase))].map((phase) => `\`land phase ${ctx.unit} ${phase}\``).join(', then ');
  throw new Error(`${holds} ${tasksNamed(opened)}, not landed — land ${it} first with ${merges}, or cut the branch again from ${from.name} without ${it}, and land again`);
}

/** Tasks as a refusal names them. @param {TaskRef[]} refs */
const tasksNamed = (refs) => `task${refs.length === 1 ? '' : 's'} ${refs.map(shownTask).join(', ')}`;

/** The refusal of a task the tracker lacks. @param {TaskRef} ref */
const untracked = (ref) => `land: task ${shownTask(ref)} of ${ref.unit} is not in the tracker — open a task it holds, as \`task list ${ref.unit} ${ref.phase}\` lists them`;

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
 * A refusal carrying what moved, and where, before it, and
 * the warnings those landings gave (`Partial`).
 * @param {unknown} err @param {Answer[]} done @param {(answer: Answer) => string|null} did
 */
function movedBefore(err, done, did) {
  if (!(err instanceof Error)) return err;
  /** @type {Map<string, string[]>} */
  const moved = new Map();
  for (const answer of done) {
    const what = did(answer);
    if (what !== null) moved.set(what, [...(moved.get(what) ?? []), answer.repo === '.' ? 'the project' : lg.plain(answer.repo)]);
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
  const warnings = answers.flatMap(({ repo, warnings: said = [] }) => said.map((/** @type {string} */ warning) => lg.saidIn(repo, warning)));
  const repos = answers.filter(happened).map(({ warnings: _said, ...answer }) => answer);
  return { repos, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * Run a driver's verb with the project's landing driver, committing the
 * setting where this call settled it, whether or not the driver refused. A
 * verb that fails where a tool the driver needs is not installed, is older
 * than the version it needs, or fails to run, is refused for that
 * (`needsRefusal`). The answer carries the verb's last state commit, null
 * where it failed, and every warning: `before`'s — what the verb committed
 * and was warned of before — the setting's own, and the driver's, a refusal's
 * those of the landings before it (`Partial`).
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

/** A task's landing with the repositories holding its branch (`landingOf`). @typedef {{task: LandingTask, holding: Repo[]}} HeldLanding */

/**
 * The landing a task opens under, from the type and title the tracker holds
 * for it (7.2.18, 12.4.1), and the repositories holding its branch — a
 * nested one only where the branch holds work there (`lg.holdsWork`): refused
 * where it has no type, where no repository holds its branch, or none holds
 * work on it, and where its change carries the state.
 * @param {Project} project @param {TaskRef} ref @param {{type: string|null, title: string, status: string}} task
 * @returns {HeldLanding}
 */
function landingOf(project, ref, { type, title, status }) {
  const shown = shownTask(ref);
  if (type === null) throw new Error(untyped(ref, status));
  const branch = names.taskBranch(ref, type, title);
  const { named, holding } = lg.holdingBranch(project.unit, project.repos, branch);
  if (!named) {
    const way = reviewedNone(project.cwd, ref) === null ? 'name its branch so and open it again' : `a one-line task's branch is made as its worktree is laid out, engine task worktree ${project.unit} ${shown}: commit its change there, then open it again`;
    throw new Error(`land: task ${shown} has no branch ${branch}, the name its type and title in the tracker give it — ${way}`);
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
    throw new Error(`land: task ${shown}'s change carries ${state.map(lg.plain).join(', ')} — Ledger's state never lands on a code branch, so take it off the ${whose} branch and open the task again`);
  }
}

/**
 * The repositories a task's branch touches, children first, each with its
 * chain's tip — read in every repository holding the branch, and the branch
 * held to descend from it there, before anything opens; none where the task
 * is opened already wherever it touches. Refuses a task touching none with
 * nothing past a chain's tip — the project's own named, where it holds the
 * branch.
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
  if (opening.length > 0 || judged.some(({ found }) => 'opened' in found)) return opening;
  const idle = judged.flatMap(({ ctx, found }) => ('past' in found ? [{ ctx, past: found.past }] : []));
  const { ctx, past } = idle[idle.length - 1];
  return inRepo(ctx.repo, () => {
    throw new Error(lg.nothingPast(shown, task.branch, past));
  });
}

/**
 * The commit a repository's merge lands onto: its driver's answer
 * (`landsOn`), else its default branch's tip here.
 * @param {LandingDriver} driver @param {LandingContext} ctx
 * @returns {string}
 */
function landsOn(driver, ctx) {
  return driver.landsOn?.(ctx) ?? tipHere(ctx);
}

/** The tip here of the branch a repository's context lands on. @param {LandingContext} ctx */
const tipHere = (ctx) => /** @type {string} */ (lg.branches(ctx.root).get(ctx.into));

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
  const driver = project.driver();
  return new Map(wanted.map((repo) => {
    const ctx = contextOf(project, repo);
    try {
      return [repo.dir, landsOn(driver, ctx)];
    } catch {
      return [repo.dir, tipHere(ctx)];
    }
  }));
}

/**
 * The tip here of the branch each of `wanted` lands on, by its folder, no
 * host asked (the header's). The project is read once, from `repos`.
 * @param {string} cwd the project's folder @param {string} unit @param {Repo[]} repos the project's @param {Repo[]} wanted
 * @returns {Map<string, string>}
 */
function tipsHere(cwd, unit, repos, wanted) {
  const project = projectOf(cwd, unit, repos);
  return new Map(wanted.map((repo) => [repo.dir, tipHere(contextOf(project, repo))]));
}

/**
 * Each repository's part of a merge, children first, `act` run in each —
 * once no task it lands, of those `picks` names, has a branch rewritten or
 * merged into after its landing (`refuseAfterLandingIn`), found before
 * anything merges.
 * @param {Project} project @param {LandingDriver} driver @param {Repo[]} walking @param {(ctx: LandingContext) => Record<string, any>|null} act
 * @param {((ref: TaskRef) => boolean)|null} picks null where the merge lands no task's branch, as a unit's own branch's landing lands none
 * @returns {Step[]}
 */
function mergeSteps(project, driver, walking, act, picks) {
  const merging = walking.map((repo) => contextOf(project, repo));
  if (picks !== null) refuseAfterLandingIn(project, driver, merging, picks);
  return merging.map((ctx) => ({ ctx, act: () => act(ctx) }));
}

/** Whether a repository's part of a walk moved anything. @param {Answer} answer */
const moved = (answer) => !answer.already;

/**
 * Refuse, before anything moves, a task of `refs` whose branch in one
 * repository did, after its landing on the default branch here, at `into`,
 * what no verb reads (task-landed.cjs): moved apart from its landing
 * point's tip, rewritten or behind it (`apart`), the way on its work laid
 * on that tip, so no landed work leaves the default branch — an amend or a
 * fold of what landed coming through as a conflict to settle, or as
 * nothing new; or merged into past that tip (`mergedPast`), the way on its
 * own commits since that tip — its first-parent line's, the merges left out
 * (`lg.ownLinePast`) — made again on the default branch as the driver lands
 * on it (`theirsOf`), so neither the merge nor what it brought in is
 * replayed. Each way on pushes the branch over its copy on
 * the host, where the driver holds one (`pushedOver`), so that copy
 * stands where the branch here does, then opens the task: the one refusal
 * of it every land verb acting on a task's landing makes.
 * @param {LandingContext} ctx @param {string} into @param {TaskRef[]} refs @param {LandingDriver} driver
 */
function refuseAfterLanding(ctx, into, refs, driver) {
  const read = ctx.landedOn(into);
  for (const ref of refs) {
    const shown = shownTask(ref);
    /** @param {string} branch */
    const then = (branch) => {
      const push = driver.pushedOver?.(ctx, branch) ?? null;
      return `${push === null ? '' : `, push it with \`${push}\``}, and open the task with \`land open ${ctx.unit} ${shown}\``;
    };
    /** @param {string|null} landing */
    const landed = (landing) => (landing === null ? '' : ` (${lg.short(landing)})`);
    const off = read.apart(ref);
    if (off !== null) {
      throw new Error(`land: task ${shown}'s branch ${off.branch} has moved apart from where its work landed on ${ctx.into}${landed(off.landing)}: its commit ${lg.short(off.sha)} landed, which the branch lacks — `
        + `${lg.laidOn(off.branch, off.sha)}${then(off.branch)}`);
    }
    const merge = read.mergedPast(ref);
    if (merge !== null) {
      throw new Error(`land: task ${shown}'s branch ${merge.branch} merged ${lg.short(merge.merge)} past its work's landing on ${ctx.into}${landed(merge.landing)}, at its commit ${lg.short(merge.sha)}, and nothing is read past a merge — `
        + `${lg.madeAgainOn(merge.branch, theirsOf(driver, ctx), lg.ownLinePast(ctx.root, merge.sha, merge.branch))}${then(merge.branch)}`);
    }
  }
}

/**
 * The landing branch a way on lays a branch onto, as the driver lands on
 * it: as the host has it, where the driver lands through the host
 * (unit-branch.cjs, `landsThroughHost`), else here.
 * @param {LandingDriver} driver @param {LandingContext} ctx
 */
const theirsOf = (driver, ctx) => (landsThroughHost(driver, ctx.remote) ? `${ctx.remote}/${ctx.into}` : ctx.into);

/**
 * Refuse, before anything merges, a task the walk lands — of those `picks`
 * names, by their refs — whose branch did after its landing what no verb
 * reads (`refuseAfterLanding`), in each repository merging, read at its
 * default branch's tip as its context was made.
 * @param {Project} project @param {LandingDriver} driver @param {LandingContext[]} merging @param {(ref: TaskRef) => boolean} picks
 */
function refuseAfterLandingIn(project, driver, merging, picks) {
  for (const ctx of merging) {
    const into = project.tips.get(ctx.root);
    if (into !== null && into !== undefined) inRepo(ctx.repo, () => refuseAfterLanding(ctx, into, ctx.landedOn(into).branched().filter(picks), driver));
  }
}

/**
 * The commit a task whose branch does not descend from the chain's tip has
 * its change laid onto that tip from, its change read past it, as the
 * default branch at `into` reads it: for a task changed after its landing,
 * its tip at that landing (task-landed.cjs, `landedTip`), else the landing
 * its branch holds; for one whose own work starts on a commit neither the
 * tip nor the default branch holds — a task below it landed by a squash,
 * its commits never on the default branch — where its own work starts
 * (`ownStart`), so what it
 * undid of that task's work stays undone, which merging the tip in, over
 * where it was cut, brings back (S1, S2). Null for any other, whose branch
 * the person merges the tip into.
 * @param {LandingContext} ctx @param {string|undefined} into @param {LandingTask} task @param {ChainTip} tip
 * @returns {string|null}
 */
function laidFrom(ctx, into, task, tip) {
  if (into === undefined) return null;
  const read = ctx.landedOn(into);
  if (read.stands(task.ref) === 'changed') return read.landedTip(task.ref) ?? read.landing(task.ref);
  const start = read.ownStart(task.ref);
  return start !== null && !lg.isAncestor(ctx.root, start, into) && !lg.isAncestor(ctx.root, start, tip.commit) ? start : null;
}

/**
 * Where a task's branch stands in one repository holding it — refused
 * first where its branch did after its landing what no verb reads
 * (`refuseAfterLanding`), which a task read landed may: landed on the
 * default branch, as the one read of what has landed reads it, or opened
 * already; past the chain's tip, to open on it, its change laid onto it,
 * where its branch does not descend from it, from where the driver's tip
 * says (`ChainTip`), else where `laidFrom` reads it; or with nothing past the default branch or the chain's tip — refused
 * where it does not descend from the tip and its change is laid from
 * nowhere, or where it holds another task's work not landed past it
 * (`refuseHeld`).
 * @param {LandingDriver} driver @param {LandingContext} ctx @param {LandingTask} task
 * @returns {{tip: ChainTip}|{opened: true}|{past: string}}
 */
function standing(driver, ctx, task) {
  const into = lg.branches(ctx.root).get(ctx.into);
  if (into !== undefined) refuseAfterLanding(ctx, into, [task.ref], driver);
  if (into !== undefined && ctx.landedOn(into).task(task.ref).landed) return { opened: true };
  if (lg.isAncestor(ctx.root, task.branch, ctx.into)) return { past: ctx.into };
  driver.assertServes?.(ctx);
  const tip = driver.chainTip(ctx, task);
  if (tip === null) return { opened: true };
  if (lg.isAncestor(ctx.root, task.branch, tip.commit)) return { past: tip.name };
  const over = lg.isAncestor(ctx.root, tip.commit, task.branch) ? undefined : tip.over ?? laidFrom(ctx, into, task, tip);
  if (over === null) {
    throw new Error(`land: task ${shownTask(task.ref)}'s branch ${task.branch} does not descend from the chain's tip, ${tip.name} (${lg.short(tip.commit)}) — merge it back onto ${tip.name} first`);
  }
  ctx.refuseHeld(task, `refs/heads/${task.branch}`, /** @type {string} */ (lg.branches(ctx.root).get(ctx.into)), tip);
  return { tip: over === undefined ? tip : { ...tip, over } };
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

/**
 * The unit's own branch made in each nested repository the task's branch
 * holds work in that lacks it, here and as last fetched, before anything
 * opens (unit-branch.cjs, `madeNested`) — none where the unit lands on the
 * default branch, and none on a host the driver does not serve, which the
 * task's opening refuses (`assertServes`).
 * @param {Project} project @param {LandingDriver} driver @param {LandingTask} task @param {Repo[]} holding
 */
function nestedMade(project, driver, task, holding) {
  const branch = lg.recordedBranch(project.cwd, project.unit);
  if (branch === null) return;
  for (const repo of holding.filter((held) => held.dir !== '' && lg.unitBranchIn(project.cwd, held, project.unit) === null)) {
    const remote = nestedRemoteName(repo.path);
    const hosted = landsThroughHost(driver, remote);
    if (hosted && !driver.serves(lg.remoteUrlOf(repo.path, /** @type {string} */ (remote)))) continue;
    inRepo(repo.dir, () => madeNested({ root: repo.path, nested: repo.dir, remote, hosted }, project.unit, branch, task.branch));
    lg.landingMade(repo, project.unit, branch);
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
 * it, before anything opens. For a unit a cancel closed a pull request of,
 * each task done and not landed whose work its branch holds is opened again
 * first (`openedAgain`, `heldBy`), so it opens onto them as it would have
 * before the cancel. A quick-fix's task opens the quick-fix's one pull
 * request (`quickFixOpen`).
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landOpen(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  const shown = shownTask(ref);
  const project = projectOf(cwd, unit);
  const { committed, warnings, ...held } = trackedTask(cwd, ref, untracked(ref));
  if (landsAsOne(cwd, unit)) return quickFixOpen(cwd, project, ref, { committed, warnings });
  const { task: landing, holding } = carrying(warnings ?? [], () => landingOf(project, ref, held));
  carrying(warnings ?? [], () => account().refuseUnaccounted(cwd, ref, 'land'));
  carrying(warnings ?? [], () => refuseUnproven(cwd, ref));
  carrying(warnings ?? [], () => refuseOffBase(cwd, project, landing));
  return withDriver(cwd, (driver) => {
    const opening = openedAgain(project, driver, heldBy(project, landing, holding));
    nestedMade(opening, driver, landing, holding);
    const steps = touching(opening, driver, landing, holding).map(({ ctx, tip }) => ({ ctx, act: () => driver.open(ctx, landing, tip) }));
    const already = steps.length === 0 ? { already: true } : {};
    return { task: shown, branch: landing.branch, ...already, ...answered(walk(steps, () => `task ${shown} opened`)) };
  }, { committed, warnings });
}

/**
 * Refuse a task its reviewers have not passed: no round of its review reported,
 * its last round failed and not settled (12.1.4, 13.4.6), or the task
 * changed under that round since — read off its rounds' reports alone,
 * refused as their read refuses; a one-line task until it is built
 * (task-account.cjs, `refuseUnaccounted`).
 * @param {string} cwd @param {TaskRef} ref
 */
function refuseUnpassed(cwd, ref) {
  if (reviewedNone(cwd, ref) !== null) {
    account().refuseUnaccounted(cwd, ref, 'land');
    return;
  }
  const shown = shownTask(ref);
  let rounds;
  try {
    rounds = taskRounds(cwd, ref);
  } catch (err) {
    throw new Error(`land: ${messageOf(err)}`);
  }
  const last = rounds.at(-1);
  if (last === undefined) throw new Error(`land: task ${shown} has no review round reported — a task chains into its phase's stack once its reviewers have passed it`);
  if (!pairPassed(last)) {
    throw new Error(`land: round ${last.round} of task ${shown} did not pass — a task chains into its phase's stack once every reviewer of a round passes it, or once the orchestrator settles it: task settle ${ref.unit} ${shown} --file <why>`);
  }
  const changed = changedUnder(cwd, ref, rounds);
  if (changed !== null) throw new Error(`land: ${changedRefusal(cwd, ref, changed)}`);
  account().refuseUnaccounted(cwd, ref, 'land');
}

/**
 * The phase's mutation run, as the `next` of whatever ends the last of a
 * phase of the cut's tasks (the header's) — its chain, or its close where
 * another of the phase's built since the migration cut the unit is done
 * (`builtSince`) — once its notes are consolidated, its
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
  if (!chained && !builtSince(manifest, others).some((task) => task.status === 'done')) return {};
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
 * The unit's tasks whose work a task's branch holds not landed past the
 * branch each repository holding it lands on (task-landed.cjs, `heldPast`,
 * R31), but its own — read once, where first asked: those its `land open`
 * opens again first (`openedAgain`).
 * @param {Project} project @param {LandingTask} task @param {Repo[]} holding
 * @returns {(ref: TaskRef) => boolean}
 */
function heldBy(project, task, holding) {
  /** @type {Set<string>|undefined} */
  let held;
  return (ref) => {
    held ??= new Set(holding.flatMap((repo) => {
      const ctx = contextOf(project, repo);
      const into = lg.branches(ctx.root).get(ctx.into);
      return into === undefined ? [] : ctx.landedOn(into).heldPast(`refs/heads/${task.branch}`, [into]).map(taskId);
    }));
    return taskId(ref) !== taskId(task.ref) && held.has(taskId(ref));
  };
}

/**
 * Each task done and not landed, of those `picks` names, opened again as
 * `land open` opens it, before a landing reads what is open (the header's):
 * after a cancel closed its pull request and a reactivate, it is open
 * nowhere — those below it in their stack first (`stackOrder`), each on
 * contexts made afresh, so each opens onto the one opened before it.
 * Answers the project to merge in, made afresh where any opened; the one
 * given, nothing opened, for a unit no cancel closed a pull request of.
 * @param {Project} project @param {LandingDriver} driver @param {(ref: TaskRef) => boolean} picks
 * @returns {Project}
 */
function openedAgain(project, driver, picks) {
  const { cwd, unit, manifest } = project;
  if (manifest === null || !closedAny(manifest)) return project;
  const landed = hasLanded(manifest, tasksLanded(cwd, unit, project.repos, project.since, manifest).landed);
  const waiting = trackedBuild(cwd, unit, buildLength(manifest)).tasks.filter((task) => task.status === 'done' && picks(task.ref) && !landed(task.ref));
  let opened = false;
  for (const { task, holding } of stackOrder(project, waiting.map((held) => landingOf(project, held.ref, held)))) {
    for (const { ctx, tip } of touching(projectOf(cwd, unit, project.repos), driver, task, holding)) {
      inRepo(ctx.repo, () => driver.open(ctx, task, tip));
      opened = true;
    }
  }
  return opened ? projectOf(cwd, unit, project.repos) : project;
}

/**
 * Tasks in the order their stack holds them: each after every task below it
 * (`belowIn`); else in the order given.
 * @param {Project} project @param {HeldLanding[]} landings
 */
function stackOrder(project, landings) {
  const below = belowIn(project);
  const left = [...landings];
  const order = [];
  while (left.length > 0) {
    const next = left.find((b) => !left.some((a) => a !== b && below(a, b) && !below(b, a))) ?? left[0];
    order.push(next);
    left.splice(left.indexOf(next), 1);
  }
  return order;
}

/**
 * Whether one task is below another in their stack: in a repository
 * holding both, the lower's branch holding work of its own there
 * (`ownWork`), the other's descending from it, as a task merged back onto
 * the one below it does — never where a task's worktree merely made its
 * branch, in a clone it changes nothing in (12.7.10).
 * @param {Project} project @returns {(a: HeldLanding, b: HeldLanding) => boolean}
 */
const belowIn = (project) => (a, b) => b.holding.some((repo) => a.holding.some((held) => held.dir === repo.dir)
  && ownWork(project, repo, a.task.branch) && lg.isAncestor(repo.path, a.task.branch, b.task.branch));

/**
 * Whether a task's branch holds work of its own in a repository holding it:
 * in a nested one, as holding it reads (`landingOf`); in the project's own,
 * which holds every branch it names, past the branch it lands on.
 * @param {Project} project @param {Repo} repo @param {string} branch
 */
const ownWork = (project, repo, branch) => repo.dir !== '' || !lg.isAncestor(repo.path, branch, contextOf(project, repo).into);

/**
 * A phase merged whole in every repository it lands in, children first —
 * `already` where it is merged wherever it lands, or where no driver reads
 * a stack of it and its tasks have landed, as the close reads it, so a
 * rerun reads finished work as done, with every warning bringing the
 * default branch here to it gave — each task of it done and not landed
 * whose pull request the unit's cancel closed opened again first
 * (`openedAgain`) — refused before anything moves, for a phase the cut holds, until
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
  const ofPhase = (/** @type {string} */ branch) => (names.taskOfBranch(unit, branch)?.phase ?? names.phaseOfBranch(unit, branch)) === phase;
  const opening = projectOf(cwd, unit);
  return withDriver(cwd, (driver) => {
    const project = openedAgain(opening, driver, (ref) => ref.phase === phase);
    const steps = mergeSteps(project, driver, walked(project, driver, holdingWork(project, ofPhase)), (ctx) => noted(ctx, driver.mergePhase(ctx, phase)), (ref) => ref.phase === phase);
    const answers = walk(steps, (answer) => (answer.already ? null : `phase ${phase} merged`));
    if (answers.length === 0 && !phaseChecks().landedPhase(cwd, unit, phase)) throw new Error(`land: phase ${phase} of ${unit} has no task opened — open its tasks first`);
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
      const { warnings = [], ...merged } = noted(ctx, next.merge());
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
 * merged; a quick-fix's one pull request merged as it closes
 * (`quickFixLand`). Refused before anything moves as finish's yes refuses
 * before it lands (`refuseUnfinished`).
 * @param {string} cwd @param {string} unit
 */
function landFinish(cwd, unit) {
  assertUnit(unit);
  refuseUnfinished(cwd, unit);
  return finishMerge(cwd, unit);
}

/** What `act` answers, its refusal worded as a land verb's. @template T @param {() => T} act @returns {T} */
function asLanding(act) {
  try {
    return act();
  } catch (err) {
    if (err instanceof Error && !err.message.startsWith('land: ')) err.message = `land: ${err.message}`;
    throw err;
  }
}

/**
 * `land finish` past its refusals, which finish's yes makes itself before
 * it lands: a merge into the unit's own branch held in its worktree taken
 * onto it first (unit-branch.cjs, `settlementsTaken`), and each task done
 * and not landed whose pull request the unit's cancel closed opened again
 * (`openedAgain`); every phase still
 * standing merged onto the unit's landing branch, then, for a unit with a
 * branch of its own, that branch landed on the default branch
 * (`unitSteps`) — one walk, so a refusal names the phases merged before
 * it. `then` is the step a refusal's way on runs again.
 * @param {string} cwd @param {string} unit @param {string} [then]
 */
function finishMerge(cwd, unit, then = 'land again') {
  if (landsAsOne(cwd, unit)) return quickFixLand(cwd, unit, true);
  asLanding(() => settlementsTaken(cwd, unit, { undone: 'nothing landed', then }));
  const opening = projectOf(cwd, unit);
  return withDriver(cwd, (driver) => {
    const project = openedAgain(opening, driver, () => true);
    const walking = walked(project, driver, holdingWork(project, (branch) => names.isUnitBranch(unit, branch)));
    const steps = [...mergeSteps(project, driver, walking, (ctx) => finishing(driver, ctx), () => true), ...unitSteps(project, driver, walking, then)];
    const merged = (/** @type {Answer} */ answer) => (answer.phases ?? []).length > 0;
    const did = (/** @type {Answer} */ answer) => {
      if (answer.landed !== undefined) return `${answer.landed} landed on ${answer.into}`;
      return merged(answer) ? `phase ${answer.phases.map((/** @type {{phase: number}} */ phase) => phase.phase).join(', ')} merged` : null;
    };
    return answered(walk(steps, did), (answer) => merged(answer) || answer.landed !== undefined);
  });
}

/**
 * The unit's own branch landed on the default branch in each repository of
 * `walking` holding it, children first (7.2.38), as a merge's steps are
 * made (`mergeSteps`), on contexts landing on the default branches — none
 * for a unit with no branch of its own. Refused before anything
 * lands where a repository's host takes no merge commit and the unit's
 * branch has not landed there (`unitPull`). `then` is the step a refusal's
 * way on runs again.
 * @param {Project} project the unit's, landing on its own branch @param {LandingDriver} driver @param {Repo[]} walking @param {string} then
 * @returns {Step[]}
 */
function unitSteps(project, driver, walking, then) {
  const branch = lg.recordedBranch(project.cwd, project.unit);
  if (branch === null) return [];
  const holding = walking.filter((repo) => lg.unitBranchIn(project.cwd, repo, project.unit) !== null);
  const onDefault = projectOf(project.cwd, project.unit, project.repos, { onDefault: true, recorded: false });
  /** @type {Map<string, UnitPull|null>} */
  const pulls = new Map();
  const steps = mergeSteps(onDefault, driver, holding, (ctx) => unitLanded(project, driver, ctx, { pull: pulls.get(ctx.root) ?? null, onDefault, then }), null);
  for (const { ctx } of steps) {
    pulls.set(ctx.root, inRepo(ctx.repo, () => {
      const pull = driver.unitPull?.(ctx, branch) ?? null;
      if (pull !== null && pull.refused !== null && !unitRead(project, driver, ctx).held) throw new Error(`land: ${pull.refused.replace('land again', then)}`);
      return pull;
    }));
  }
  return steps;
}

/**
 * A unit's own branch readied as its review phase begins, at its first
 * round (review-entry.cjs): the default branch brought into it
 * (unit-branch.cjs, `bringUp`, 7.2.36), then its own pull request opened
 * in each repository holding it, children first, where the driver lands
 * through a host (`openUnit`) and the unit has not landed there
 * (`unitRead`), one open taken as it is (7.2.38) — under the writer lock,
 * as a land verb pushes; nothing for a unit with no branch of its own.
 * @param {string} cwd @param {string} unit
 */
function reviewOpened(cwd, unit) {
  const branch = lg.recordedBranch(cwd, unit);
  if (branch === null) return;
  withWriterLock(stateRoot(cwd), () => {
    bringUp(cwd, unit, branch, { undone: 'the review phase was not entered', then: 'enter the review again' });
    const project = projectOf(cwd, unit);
    withDriver(cwd, (driver) => {
      const opens = driver.openUnit;
      if (opens === undefined) return {};
      const onDefault = projectOf(cwd, unit, project.repos, { onDefault: true, recorded: false });
      for (const repo of childrenFirst(project.repos).filter((held) => lg.unitBranchIn(cwd, held, unit) !== null)) {
        contextOf(project, repo);
        const ctx = contextOf(onDefault, repo);
        inRepo(ctx.repo, () => {
          const read = unitRead(project, driver, ctx);
          if (!read.held) opens(ctx, unitLanding(project, ctx, read, null));
        });
      }
      return {};
    });
  });
}

/**
 * The unit's own branch in a repository against its default branch, each
 * as the driver lands onto it (`landsOn`): their tips, where they met, and
 * where the unit has landed there (7.2.39), `held` where it has — the
 * branch's tip, held on the default branch, or the oldest commit on its
 * first-parent line past where they met holding the branch's change, as a
 * merge by hand, by any method, leaves it, whatever the default branch
 * changed since; null where it has not.
 * @param {Project} project the unit's, landing on its own branch @param {LandingDriver} driver @param {LandingContext} ctx the repository's, landing on its default branch
 */
function unitRead(project, driver, ctx) {
  const own = /** @type {LandingContext} */ (project.contexts.get(ctx.repo === '.' ? '' : ctx.repo));
  const tip = landsOn(driver, own);
  const onto = landsOn(driver, ctx);
  const base = lg.mergeBase(ctx.root, onto, tip);
  const at = base === tip ? tip : landedAt(ctx.root, lg.firstParentLine(ctx.root, base, onto), { tip, base });
  return { own, tip, onto, base, held: at !== null, at };
}

/**
 * The oldest commit of `line`, a first-parent line newest first, holding
 * the change of the unit's branch at `tip` since `base`, or null where
 * none does.
 * @param {string} root @param {{sha: string, tree: string}[]} line @param {{tip: string, base: string}} branch
 */
function landedAt(root, line, { tip, base }) {
  if (line.length === 0) return null;
  const holds = lg.holdChanges(root, line.map(({ sha, tree }) => ({ ours: sha, tree, theirs: tip, base })));
  return line[holds.lastIndexOf(true)]?.sha ?? null;
}

/**
 * A repository's part of the unit's landing at finish (7.2.38): nothing
 * where the unit has landed there (`unitRead`), the driver bringing the
 * default branch here up alone; else, where its branch would conflict with
 * the default branch, the default branch brought into it first by the
 * bring-up's merge (unit-branch.cjs, `broughtUpToLand`) — refused, the
 * merge begun in its worktree, where the two still conflict; then landed
 * by the driver by a merge commit, under the names the unit lands under
 * (landing-names.cjs, `unitLanding`), the phases merged into its branch
 * there each a line of its description.
 * @param {Project} project the unit's, landing on its own branch @param {LandingDriver} driver @param {LandingContext} ctx the repository's, landing on its default branch
 * @param {{pull: UnitPull|null, onDefault: Project, then: string}} landing its pull request as read, null for none; the project landing on its default branches; and the step a refusal's way on runs again
 */
function unitLanded(project, driver, ctx, { pull, onDefault, then }) {
  const read = unitRead(project, driver, ctx);
  if (read.held) return driver.landUnit(ctx, null);
  if (!('conflicts' in lg.mergeTree(ctx.root, read.base, read.onto, read.tip))) return driver.landUnit(ctx, unitLanding(project, ctx, read, pull));
  const repo = /** @type {Repo} */ (onDefault.repos.find((held) => held.path === ctx.root));
  const merging = { branch: read.own.into, into: ctx.into, theirs: read.onto };
  const tip = asLanding(() => broughtUpToLand(project.cwd, repo, project.unit, merging, { undone: `${project.unit} did not land on ${ctx.into}`, then }));
  return driver.landUnit(ctx, unitLanding(project, ctx, { ...read, tip, base: read.onto }, pull));
}

/**
 * The unit's own branch to land in a repository, as read there
 * (`unitRead`): under the names the unit lands under (landing-names.cjs,
 * `unitLanding`), the phases merged into its branch there each a line of
 * its description, and its pull request as read, null for none.
 * @param {Project} project the unit's, landing on its own branch @param {LandingContext} ctx the repository's, landing on its default branch @param {ReturnType<typeof unitRead>} read @param {UnitPull|null} pull
 * @returns {UnitLanding}
 */
function unitLanding(project, ctx, { own, tip, base }, pull) {
  const manifest = /** @type {Record<string, any>} */ (project.manifest);
  const phases = [...new Set(lg.namedPast(ctx.root, project.unit, base, tip).flatMap(({ ids }) => ids.map((id) => parseTaskId(id).phase)))].sort((a, b) => a - b);
  const lines = phases.map((phase) => `Phase ${phase}: ${cutPhases(manifest)[phase - 1]?.name ?? 'the review\'s fixes'}`);
  return { branch: own.into, tip, ...names.unitLanding(project.unit, unitTitle(manifest), lines), pull };
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
  const project = projectOf(cwd, unit);
  const driver = project.driver();
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
 * read once on its context.
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
 * alone, read once on its context.
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

/** The title a unit lands under as a whole — a quick-fix's, or a unit's own branch's — its description's first line, else its name. @param {Record<string, any>} manifest the unit's */
const unitTitle = (manifest) => String(manifest.description ?? '').split('\n').map((line) => line.trim()).find(Boolean) ?? manifest.name;

/**
 * The rule a merge stamped with one of the unit's tasks is read as its work
 * by in a repository (`workIn`): a quick-fix's own (`lg.quickFixMerges`);
 * none for any other unit, whose every such merge is.
 * @param {string} cwd @param {Record<string, any>|null} manifest the unit's @param {Repo} repo @param {string} unit
 */
const mergesIn = (cwd, manifest, repo, unit) => (manifest !== null && quickFixBuild(manifest) ? lg.quickFixMerges(cwd, repo, unit) : undefined);

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

/** A commit the quick-fix's branch holds past the default branch as the host has it, the time it was committed, in milliseconds, and the unit's task it is stamped with, null for none. @typedef {{sha: string, message: string, committed: number, id: string|null}} QuickFixCommit */

/**
 * A quick-fix's landing in one repository it touches (the header's), each
 * read of the host made once: the context; the branch; the tip of the
 * branch it lands on as the host has it (`hostTip`); the branch's tip here,
 * read as it stands, undefined where it is gone; the time the unit's work
 * is read from; the pull request as the driver reads it (`pullOf`), the
 * host's copy of the branch among it; the commits a commit holds past that
 * tip, oldest first, merges aside, each with its time and task — the
 * branch's, none where it is gone — and those of the branch's stamped with
 * a task, a merge the door finished among them where it brings in the
 * branch it lands on or the host's copy of the branch, as the one rule a
 * quick-fix's task's own commits are read by takes it (`lg.quickFixMerges`),
 * as a one-line task merging either in leaves one, a task's newest its
 * own and every task among them one its landing names (`stamped`);
 * whether the branch's hold the quick-fix's work: a commit committed since `since`, a fix's through the
 * door or a person's own made during the quick-fix (R19); whether the
 * host's copy is another's, holding none of the quick-fix's work past the
 * tip and no commit stamped with one of the unit's tasks since `since`
 * (`lg.stampsUnit`), as a branch of that name made long before holds
 * neither and one merged by hand and kept there holds the stamped;
 * whether a commit, and each task, has landed on that tip, as every type's
 * task is read (task-landed.cjs) — its merges by that one rule, its work
 * branch the quick-fix's one, and
 * a pull request merged landing a commit of its own — and whether a commit holds
 * one past the tip that has not; and whether the pull request open holds a
 * task's newest commit, refused where the latest was closed by hand
 * (`refuseClosed`). `asFetched`, no host is asked: the tip is the branch
 * it lands on as last fetched (`fetchedTip`), and no pull request is read
 * (`unreadPull`).
 * @param {Project} project @param {LandingDriver} driver @param {Repo} repo @param {boolean} asFetched
 */
function repoLanding(project, driver, repo, asFetched) {
  const ctx = contextOf(project, repo);
  const { root, unit } = ctx;
  const { since } = project;
  const branch = names.quickFixBranch(unit);
  const tip = asFetched ? fetchedTip(driver, ctx) : hostTip(driver, ctx);
  const key = stamp();
  const at = () => lg.branches(root).get(branch);
  const pull = asFetched ? unreadPull : () => pullOf(driver, ctx, branch, since);
  const from = sinceTime(since);
  const merges = lg.quickFixMerges(project.cwd, repo, unit);
  /** @param {string} rev @returns {QuickFixCommit[]} */
  const commitsOn = (rev) => lg.readOnce(ctx, `quick-fix commits ${rev}`, () => lg.stampedPast(root, rev, tip, key).map(({ sha, message, committed, value }) => ({ sha, message, committed, id: unitTask(unit, value) })));
  /** @returns {QuickFixCommit[]} */
  const commits = () => {
    const head = at();
    return head === undefined ? [] : commitsOn(head);
  };
  /** @returns {QuickFixCommit[]} */
  const stamped = () => {
    const head = at();
    const read = head === undefined ? [] : lg.readOnce(ctx, `quick-fix stamped ${head}`, () => lg.stampedPast(root, head, tip, key, null, { merges }).map(({ sha, message, committed, value }) => ({ sha, message, committed, id: unitTask(unit, value) })));
    return read.filter(({ id }) => id !== null);
  };
  /** @param {QuickFixCommit} commit */
  const isWork = ({ committed }) => committed >= from;
  const holdsQuickFixWork = () => commits().some(isWork);
  const foreign = () => {
    const { head } = pull();
    return head !== null && !commitsOn(head).some(isWork) && !lg.stampsUnit(root, head, key, unit, since);
  };
  const landed = repoLanded(root, unit, tip, { since, own: (id) => stamped().filter((commit) => commit.id === id).pop() ?? null, merged: () => pull().merged, work: workIn(root, unit, since, undefined, merges), recorded: recordsIn(project.manifest, ctx.repo) });
  project.reads.push({ root, made: () => [landed] });
  const { task, landedCommit, marking, line, landings } = landed;
  /** @param {string} rev */
  const holdsUnlanded = (rev) => commitsOn(rev).some(({ sha, id }) => !landedCommit(sha, id));
  const refuseClosed = () => {
    const { closed } = pull();
    if (closed !== null) inRepo(ctx.repo, () => { throw new Error(`land: ${closed}`); });
  };
  /** @param {TaskLanding} read */
  const inPull = (read) => {
    refuseClosed();
    const { open } = pull();
    return read.own !== null && open !== null && lg.isAncestor(root, read.own, open);
  };
  return { repo, ctx, branch, tip, at, since, pull, foreign, commits, stamped, holdsQuickFixWork, landedCommit, holdsUnlanded, task, marking, line, landings, refuseClosed, inPull, found: () => foundIn(landed, repo) };
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
  const project = projectOf(cwd, unit);
  const driver = project.driver();
  const branch = names.quickFixBranch(unit);
  const manifest = manifestOf(stateRoot(cwd), unit);
  const repos = quickFixRepos(project, driver, manifest).map((repo) => repoLanding(project, driver, repo, asFetched));
  /** @param {TaskRef} ref */
  const task = (ref) => landedAcross(repos.map((read) => ({ read, task: read.task(ref) })));
  return {
    project, driver, branch, repos, own: /** @type {RepoLanding} */ (repos.at(-1)), task, refuseClosed: () => repos.forEach((read) => read.refuseClosed()),
    found: () => repos.flatMap((read) => read.found()),
  };
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
 * its pull request as it was read, and the time the unit's pull requests
 * are read from — refused for a task with no type (7.2.18), and, in the
 * project's own repository, where its change carries the state.
 * @param {string} cwd @param {RepoLanding} read @param {string} shown the task a refusal names
 * @returns {QuickFixTask}
 */
function quickFixTask(cwd, read, shown) {
  const { ctx, branch } = read;
  const { unit } = ctx;
  if (ctx.repo === '.') refuseState(ctx, shown, branch, 'quick-fix\'s');
  const manifest = loadWorkUnitManifest(cwd, unit);
  const ids = doneOrder(manifest, [...new Set(read.stamped().map(({ id }) => /** @type {string} */ (id)))]);
  const held = new Map(trackedBuild(cwd, unit, buildLength(manifest)).tasks.map((tracked) => [taskId(tracked.ref), tracked]));
  const tasks = ids.flatMap((id) => {
    const tracked = held.get(id);
    if (tracked === undefined) return [];
    if (tracked.type === null) throw new Error(untyped(tracked.ref, tracked.status));
    return [{ ref: tracked.ref, type: tracked.type, title: tracked.title }];
  });
  return { branch, message: names.quickFixMessage(unit, unitTitle(manifest), tasks), tasks: tasks.map(({ ref }) => shownTask(ref)), pull: read.pull(), since: read.since };
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
 * (the header's) — refused for a task closed or landed (fix-end.cjs);
 * each branch first readied (`readied`, fix-branch.cjs).
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
    const steps = opening.map(({ held, landing }) => ({ ctx: held.ctx, act: () => driver.openQuickFix(held.ctx, landing) }));
    const answers = carrying(warnings, () => walk(steps, () => `${project.unit}'s pull request opened`));
    const already = answers.every((answer) => answer.already) ? { already: true } : {};
    return { task: shown, branch: read.branch, ...already, ...walkedWith(warnings, answers), ...cut };
  }, before);
}

/**
 * `land phase` and `land finish` of a quick-fix: its one pull request merged
 * in every repository it touches whose branch holds anything past the branch
 * it lands on as the host has it, children first, every task's commit
 * squashed into one (the header's), each other repository's default branch
 * here brought up to the host's — reached only past the refusals finish's
 * yes makes before it lands (`refuseUnfinished`, or the yes's own before
 * `finishMerge`), a task unended among them; refused before anything moves
 * while a task done holds work that is neither landed nor on its branch
 * (fix-end.cjs); each branch first readied (`readied`, fix-branch.cjs), so
 * it holds no work landed, then pushed to its pull request as it stands,
 * opened again where none is open; where the landing `closes` the quick-fix
 * — finish's, never a phase's — what the driver keeps of the unit in each
 * then let go (`finished`). `already` where no branch holds anything past
 * it.
 * @param {string} cwd @param {string} unit @param {boolean} [closes]
 */
function quickFixLand(cwd, unit, closes = false) {
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
        if (!past.includes(held)) return noted(ctx, driver.mergeQuickFix(ctx, null));
        const landing = quickFixTask(cwd, held, shown);
        return noted(ctx, driver.mergeQuickFix(ctx, landing, driver.openQuickFix(held.ctx, landing)));
      }, () => false);
      return walk(steps, (answer) => (answer.already ? null : `${unit}'s pull request merged`));
    });
    if (closes) read.repos.forEach((held) => driver.finished?.(held.ctx));
    const already = answers.some(moved) ? {} : { already: true };
    return { ...already, ...walkedWith(warnings, answers, moved), ...cut };
  });
}

/**
 * What a move's or a cancel's close did: whether it closed any pull
 * request, and what settling the landing driver warned of, where it did.
 * @typedef {{closed: boolean, warnings?: string[]}} Closed
 */

/** Each pull request a close closes, by the repository it was in and the host's own name for it, told as it closes. @typedef {(repo: string, name: string) => void} Told */

/** A close with nothing to close. @returns {Closed} */
const nothingClosed = () => ({ closed: false });

/**
 * Each repository's closes made in turn, a refusal in a nested one naming
 * it, each pull request closed told to `told` with its repository as it
 * closes: whether any closed.
 * @param {{ctx: LandingContext, closes: ((closed: import('./drivers.cjs').Closing) => import('./drivers.cjs').PullsClosed)[]}[]} steps @param {Told} told
 * @returns {Closed}
 */
function closedIn(steps, told) {
  const made = steps.flatMap(({ ctx, closes }) => closes.map((close) => inRepo(ctx.repo, () => close((name) => told(ctx.repo, name)))));
  return { closed: made.some((answer) => answer.closed) };
}

/**
 * A quick-fix's pull request closed unmerged in each repository its
 * landing `read` walks, where that read found one open — as its move and
 * its cancel close it (workunit-move.cjs, `cancelClose`) — through the
 * driver the project names, its setting left as it stands, each told as it
 * closes where the caller asks (`Told`).
 * @param {QuickFixLanding} read @param {Told} [told]
 * @returns {Closed}
 */
function quickFixClose(read, told = () => {}) {
  return closedIn(read.repos.map((held) => ({ ctx: held.ctx, closes: [(closed) => read.driver.closeQuickFix(held.ctx, held.pull(), closed)] })), told);
}

/**
 * Whether a pull request of the unit's may stand open for its cancel to
 * close, asking no host (18.3.9): in a repository landing through a host
 * (`landsThroughHost`), its remote holding a branch of the unit's as last
 * fetched, as an opening pushes it.
 * @param {string} cwd @param {string} unit
 */
function mayHoldOpen(cwd, unit) {
  const { driver } = chosenDriver(cwd, 'landing');
  return projectRepos(codeRoot(cwd)).some((repo) => {
    const remote = lg.remoteOf(cwd, repo);
    return landsThroughHost(/** @type {LandingDriver} */ (driver), remote) && lg.trackedBranches(repo.path, /** @type {string} */ (remote)).some((branch) => names.isUnitBranch(unit, branch));
  });
}

/**
 * The cancel's close (18.3.9): every pull request open on a branch of the
 * unit's closed unmerged, in each repository it touched, the branches left
 * as they stand, each told to `told` as it closes, so a refusal part way
 * keeps those it closed — a refusal the cancel's, its way on the cancel
 * run again (`cancelling`).
 * @param {string} cwd @param {string} unit @param {Told} told
 * @returns {Closed}
 */
function cancelClose(cwd, unit, told) {
  try {
    return cancelling(cwd, unit, told);
  } catch (err) {
    if (err instanceof Error) err.message = err.message.replace(/^land:/, 'cancel:').replace(/land again/g, 'cancel again');
    throw err;
  }
}

/**
 * `cancelClose` past its wording: a quick-fix's, once its fixes have
 * begun, as its move closes it (`quickFixClose`); any other unit's in each
 * repository holding its work, walked as the land verbs walk them
 * (`holdingWork`), children first, on contexts landing on the default
 * branches — each of its tasks' open there (`closeTasks`) and, where the
 * repository holds the unit's own branch, its own (`closeUnit`) — the
 * landing driver settled where it is not (`withDriver`); nothing, and no
 * host asked, where no repository holds its work.
 * @param {string} cwd @param {string} unit @param {Told} told
 * @returns {Closed}
 */
function cancelling(cwd, unit, told) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest !== null && quickFixBuild(manifest)) return fixesBegun(manifest) ? quickFixClose(quickFixLanding(cwd, unit), told) : nothingClosed();
  const project = projectOf(cwd, unit, undefined, { onDefault: true, recorded: false });
  const holds = holdingWork(project, (branch) => names.isUnitBranch(unit, branch));
  if (!project.repos.some(holds)) return nothingClosed();
  const own = lg.recordedBranch(cwd, unit);
  const { closed, warnings } = withDriver(cwd, (driver) => closedIn(walked(project, driver, holds).map((repo) => {
    const ctx = contextOf(project, repo);
    const holdsOwn = own !== null && lg.unitBranchIn(cwd, repo, unit) !== null;
    return { ctx, closes: [(closed) => driver.closeTasks(ctx, closed), ...(holdsOwn ? [(/** @type {import('./drivers.cjs').Closing} */ closed) => driver.closeUnit(ctx, driver.unitPull?.(ctx, own) ?? null, closed)] : [])] };
  }), told));
  return { closed, ...(warnings === undefined ? {} : { warnings }) };
}

/**
 * The landings the engine made in one repository, as the verb's end
 * records them: each task a merge of the verb's landed there (`merged`),
 * at the newest commit of `range`, the default branch's first-parent line
 * past where it stood as the verb began, naming it by its `Task:` line, at
 * its branch's tip — its newest stamped commit where it has none — its
 * first, where no record names one, its landing as the verb's read of the
 * default branch below that commit found it, the newest read the verb made
 * on that line (`readBelow`, `earlier`, R30), so a task changed after it
 * landed by hand keeps that landing.
 * @param {Repo} repo
 * @param {{range: {sha: string, at: string, ids: string[]}[], merged: Set<string>, recorded: Map<string, import('./landing-record.cjs').LandingRecord>, work: ReturnType<typeof workIn>, readBelow: (commit: string) => RepoLanded, took: () => Map<string, string>}} read
 * @returns {import('./landing-record.cjs').Landing[]}
 */
function engineLandings(repo, { range, merged, recorded, work, readBelow, took }) {
  return [...merged].flatMap((id) => {
    const named = range.find(({ ids }) => ids.includes(id));
    if (named === undefined) return [];
    const { sha: commit, at } = named;
    const landing = { id, repo: repoName(repo), root: repo.path, commit, tip: work.tips().get(id) ?? work.last(id)?.sha ?? commit, by: /** @type {const} */ ('engine') };
    const earlier = recorded.has(id) ? null : readBelow(commit).earlier(parseTaskId(id), took);
    return earlier === null || earlier === commit ? [{ ...landing, at }] : [{ ...landing, commit: earlier }, { ...landing, at }];
  });
}

/**
 * The landings a land verb leaves (landing-record.cjs, 7.2.22), in each
 * repository it made a context in, read from the reads it made there
 * (`frame`): by the engine, each task a merge of the verb's landed
 * (`engineLandings`); and, where the verb answered rather than refused
 * (`acted`), each other task its reads found landed with no record
 * (`foundIn`) — the person's by hand, one changed since found at the
 * commit its driver took as the verb read it — each task the repository
 * holds work of that none of them was asked of asked of its last. A read
 * of the default branch here is made where the verb made none there, or
 * where that branch gained commits the verb's merges never laid, as it
 * brings the default branch here up to the host's: the landings it only
 * brought here are the read's, each changed since found at the commit its
 * driver took, read where the verb never did. A refusal records only what
 * merged before it; a repository the verb made no context in is left to
 * the next verb working there.
 * @param {string} cwd @param {string} unit @param {Frame} frame @param {boolean} acted
 * @returns {import('./landing-record.cjs').Landing[]}
 */
function landingsLeft(cwd, unit, frame, acted) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  const since = workSince(manifest);
  const { made } = frame;
  return frame.repos.flatMap((repo) => {
    const [project] = made.filter(({ tips }) => tips.has(repo.path));
    if (project === undefined) return [];
    const refs = lg.branches(repo.path);
    const at = refs.get(/** @type {LandingContext} */ (project.contexts.get(repo.dir)).into);
    if (at === undefined) return [];
    const from = project.tips.get(repo.path) ?? null;
    const merged = new Set(made.flatMap((each) => [...(each.merged.get(repo.path) ?? [])]));
    const reads = made.flatMap((each) => each.reads.filter(({ root }) => root === repo.path).flatMap((read) => read.made()));
    /** @param {'took'|'taken'} how */
    const driven = (how) => () => new Map(made.flatMap((each) => [...(each[how].get(repo.path)?.() ?? [])]));
    const took = driven('took');
    const recorded = recordsIn(manifest, repoName(repo));
    const work = workIn(repo.path, unit, since, refs, mergesIn(cwd, manifest, repo, unit));
    const fresh = (/** @type {string} */ tip) => landedIn(repo.path, unit, since, driven('taken'), recorded, work)(tip);
    const range = from === null || from === at ? [] : lg.namedPast(repo.path, unit, from, at);
    const readBelow = (/** @type {string} */ commit) => [...range.slice(range.findIndex(({ sha }) => sha === commit) + 1).map(({ sha }) => sha), from]
      .map((sha) => reads.find((each) => each.revision === sha)).find((each) => each !== undefined) ?? reads[0] ?? fresh(/** @type {string} */ (from));
    const engine = merged.size === 0 ? [] : engineLandings(repo, { range, merged, recorded, work, readBelow, took });
    if (!acted) return engine;
    const brought = range.some(({ ids }) => !ids.some((id) => merged.has(id)));
    const asked = reads.length === 0 || brought ? [...reads, fresh(at)] : reads;
    const last = /** @type {RepoLanded} */ (asked.at(-1));
    const read = new Set(asked.flatMap((each) => each.asked()));
    for (const ref of last.known()) if (!read.has(taskId(ref))) last.task(ref);
    return [...asked.flatMap((each) => foundIn(each, repo, reads.includes(each) ? took : undefined)).filter(({ id }) => !merged.has(id)), ...engine];
  });
}

/**
 * `write` run, a record it leaves not written answered as a warning in
 * `warnings`, the next verb acting on the landing reading it again.
 * @param {() => unknown} write @param {string[]} warnings
 */
function settled(write, warnings) {
  try {
    write();
  } catch (err) {
    warnings.push(`the landing record was not written (${messageOf(err)}) — the next verb acting on the landing records it`);
  }
}

/**
 * A land verb's answer, `act`'s, its landings recorded as it ends
 * (`landingsLeft`) — a refusal's among them, after whatever merged before
 * it — the state commit's warnings beside the answer's; `joined`, an
 * answer's written for the caller's own commit of the unit to carry, as
 * finish's yes completes it. A record not written leaves the answer as it
 * stands, a warning saying so beside it (`settled`), and a refusal as it
 * was refused.
 * @template {{warnings?: string[]}} R
 * @param {string} cwd @param {string} unit @param {() => R} act @param {boolean} [joined]
 * @returns {R}
 */
function recording(cwd, unit, act, joined = false) {
  assertUnit(unit);
  /** @type {Frame} */
  const frame = { repos: projectRepos(codeRoot(cwd)), made: [] };
  /** @type {R} */
  let answer;
  recordingFrames.push(frame);
  try {
    answer = act();
  } catch (err) {
    settled(() => recordLandings(cwd, unit, landingsLeft(cwd, unit, frame, false), []), []);
    throw err;
  } finally {
    recordingFrames.pop();
  }
  /** @type {string[]} */
  const warnings = [];
  settled(() => {
    const found = landingsLeft(cwd, unit, frame, true);
    if (joined) writeLandings(cwd, unit, found);
    else recordLandings(cwd, unit, found, warnings);
  }, warnings);
  return warnings.length === 0 ? answer : { ...answer, warnings: [...(answer.warnings ?? []), ...warnings] };
}

module.exports = {
  LAND_USAGE,
  /** `land open`, its landings recorded. @param {string} cwd @param {string} unit @param {string} task */
  landOpen: (cwd, unit, task) => recording(cwd, unit, () => landOpen(cwd, unit, task)),
  /** `land chain`, its landings recorded. @param {string} cwd @param {string} unit @param {string} task */
  landChain: (cwd, unit, task) => recording(cwd, unit, () => landChain(cwd, unit, task)),
  /** `land phase`, its landings recorded. @param {string} cwd @param {string} unit @param {string} given */
  landPhase: (cwd, unit, given) => recording(cwd, unit, () => landPhase(cwd, unit, given)),
  /** `land finish`, its landings recorded. @param {string} cwd @param {string} unit */
  landFinish: (cwd, unit) => recording(cwd, unit, () => landFinish(cwd, unit)),
  /** `land finish` past its refusals, its landings written for finish's yes's commit of the unit to carry, `then` the step a refusal's way on runs again. @param {string} cwd @param {string} unit @param {string} then */
  finishMerge: (cwd, unit, then) => recording(cwd, unit, () => finishMerge(cwd, unit, then), true),
  allChained, landingTips, tipsHere, mutationRun, quickFixLanding, quickFixClose, cancelClose, mayHoldOpen, workFrom, unendedRefusal, reviewOpened,
};
