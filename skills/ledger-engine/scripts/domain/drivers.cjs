'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the drivers, the code behind the `task` verbs (the tracker)
// and the `land` verbs (the code host) (7.1.4, 7.2.1).
//
// A driver is a folder Ledger ships, `drivers/{kind}/{name}/driver.cjs`,
// and never one loaded from elsewhere (7.1.7): the loader reads the shipped
// folders. A driver declares its kind, its name, whether it is its kind's
// default, the words a screen names it by, and the tools it needs: each
// with the words a screen names it by, the oldest version it works with,
// where its update instructions live, and how to find the version installed
// (22.4.9) — so no screen of the engine's names a tool (7.1.10, 7.2.13). It
// carries every required method of its kind, and an optional one only where
// its tool has the capability. A driver short of a required method, or
// declaring any of that amiss, is refused.
//
// Each tool a driver needs stands one of four ways (`toolStates`): fine;
// missing; older than its floor, its version read part by part — one that
// does not read is not judged, as the git floor's is not; or failing,
// installed but erroring as its version is read. The drivers' check at
// ready to build reads them (drivers-verbs.cjs), and a verb a driver fails
// is refused for a tool that is not fine (`needsRefusal`).
//
// The project manifest's `drivers: {task, landing}` names one of each kind.
// Where a kind's setting is absent, the first verb that resolves it settles
// the default and writes it there, so a driver never changes under a build
// (7.1.4): the task driver flagged default (22.4.2); for landing, the driver
// that serves the project's remote, else the one flagged default, the local
// driver (22.4.3, 7.2.16). A setting naming a driver Ledger doesn't ship
// is refused, naming those it does. The code host's driver, which acts on
// the remote's host for setup, is the landing driver that serves the
// remote, whatever the setting; which driver a project lands through can be
// read without settling it. A driver serves the project unless it lands
// through a host (`assertServes`) the project's remote is not on
// (`projectDrivers`). The loader names no host: a driver for
// another one is a folder of its own and nothing else.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { DRIVER_KINDS } = require('../kernel/manifest-schema.cjs');
const { releaseOf, atLeast } = require('../kernel/version.cjs');

/** @typedef {typeof DRIVER_KINDS[number]} DriverKind */

const DRIVERS_ROOT = path.join(__dirname, '..', 'drivers');
const ENTRY = 'driver.cjs';

/** The methods every driver of a kind carries, and those it carries only where its tool can. */
const METHODS = Object.freeze({
  task: {
    required: /** @type {const} */ ([
      'ensureStore', 'storeFiles', 'localFiles', 'mergeStore',
      'createUnit', 'createPhase', 'createTask', 'adoption', 'waitingOn', 'adopt', 'closePlan', 'add', 'setType', 'link', 'unlink',
      'ready', 'start', 'done', 'close', 'removePhase', 'list', 'show', 'tasks', 'started',
    ]),
    optional: /** @type {const} */ ([]),
  },
  landing: {
    required: /** @type {const} */ (['serves', 'taken', 'chainTip', 'holds', 'open', 'chain', 'mergePhase', 'nextMerge', 'quickFixPull', 'openQuickFix', 'mergeQuickFix', 'closeQuickFix', 'landUnit', 'closeUnit', 'closeTasks']),
    optional: /** @type {const} */ (['assertServes', 'landsOn', 'landsOnAsFetched', 'pushedOver', 'finished', 'protectBranch', 'setSquashDefault', 'unitPull', 'openUnit']),
  },
});

/**
 * A tool a driver needs: the words a screen names it by, the oldest version
 * it works with, where its update instructions live, and the version
 * installed — null where it is not, the tool's own error thrown where it is
 * but fails.
 * @typedef {{tool: string, label: string, floor: string, update: string, found: () => string|null}} DriverNeed
 */

/**
 * What every driver declares: `title` the words a screen names it by.
 * @typedef {{kind: DriverKind, name: string, title: string, isDefault: boolean, needs: DriverNeed[]}} DriverDeclaration
 */

/**
 * How a tool a driver needs stands (the header's): the version found, null
 * where none is, and the error it failed with, where it did.
 * @typedef {{tool: string, label: string, floor: string, update: string, found: string|null, state: 'fine'|'missing'|'older'|'failing', error?: string}} ToolState
 */

/** @typedef {(...args: any[]) => any} DriverMethod */
/**
 * @template {{required: readonly string[], optional: readonly string[]}} M
 * @typedef {Record<M['required'][number], DriverMethod> & Partial<Record<M['optional'][number], DriverMethod>>} MethodsOf
 */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** Where a task stands, in the engine's words whatever the tracker calls it. @typedef {'open'|'in-progress'|'done'|'closed'} TaskStatus */
/** @typedef {{ref: TaskRef, title: string, status: TaskStatus}} TaskRow */
/** What goes onto a task before its dispatch, and whose it is (13.11.3). @typedef {{by: 'orchestrator'|'person', text: string}} TaskAddition */
/**
 * A task as the tracker holds it: its type, null where it has none; its
 * text whole; what was added to it, in order; the tasks it waits on; and
 * the reason it was closed, null unless it was.
 * @typedef {TaskRow & {type: string|null, text: string, additions: TaskAddition[], after: TaskRef[], reason: string|null}} TaskDetail
 */
/**
 * A field of the tracker's store both sides set differently: the choice,
 * its pick, and what the screen calls it — the task by the engine's name,
 * and the field by its meaning.
 * @typedef {import('./state-merge-rules.cjs').FieldConflict & {label: {subject: string, name: string, field: string}}} FieldStoreConflict
 */
/**
 * What the person makes again of what a merge set aside, by phase: the
 * phase's title, null for tasks in none; the kept phase's number, null
 * where the phase itself is made again; and the titles of its tasks set
 * aside.
 * @typedef {{phase: string|null, kept: number|null, tasks: string[]}} MadeAgain
 */
/**
 * Engine names both sides made, each its kind and the words `task-id.cjs`
 * gives it, and what of this machine's set aside for them the person makes
 * again.
 * @typedef {{madeTwice: {kind: 'unit'|'phase'|'task', said: string}[], again: MadeAgain[]}} MadeTwice
 */
/** @typedef {FieldStoreConflict|MadeTwice} StoreConflict */
/** The store merged: its text, and what it leaves the person. @typedef {{text: string, conflicts: StoreConflict[]}} StoreMerge */
/**
 * A task driver. Every method but the three that name the store takes the
 * state root, where the tracker's store lives and the tool runs; the
 * engine's ids go in and come out, the tracker's own never. A unit holds the
 * phases written for it, a phase its tasks. `ensureStore` makes the store at
 * the root where it is missing, answering whether it did; no method that
 * writes runs before it. The reads — `list`, `ready`, `tasks`, `show` and
 * `started` — also work in a root holding the store's files alone, copied
 * there for a read that must not wait on a writer (task-verbs.cjs), and
 * answer there as they would in the state root, writing nothing beyond what
 * `localFiles` names, and in a root where the store is not set up yet —
 * what set up means is the driver's — answer as a tracker holding nothing.
 * `storeFiles` and `localFiles` name, from the root, the
 * files the state branch carries and the gitignore patterns of those the
 * tool keeps local. The engine owns the refusals: `list`, `tasks` and
 * `ready` answer null for a phase not written, `show` null for a task the
 * tracker lacks,
 * and the engine refuses in its words before any other method names one. A
 * verb a driver's method fails, where a tool the driver needs is not
 * installed, is older than the version it needs, or fails to run, is
 * refused for that (`needsRefusal`), so a driver lets its tool's absence
 * throw as it falls. What stays with the
 * driver is what only its tracker can know: a store it cannot read and a
 * link that would make a cycle, in the tool's words with the engine's names
 * for what they name; a line of the store it cannot read, naming the file
 * and the line; a store where one task carries two of the engine's names or
 * two tasks carry one; and a unit or phase ended by the person in the
 * tracker, cancelled or done — nothing is made under it, nothing is
 * reopened, and the refusal names each parent the person must reopen.
 * Every task, phase and unit is named in the words `task-id.cjs` gives.
 * `createUnit` makes the unit's parent where it is missing, answering
 * whether it did; a phase or a task is made under its parent whether or not
 * every task before it has ended, where it was the tracker that ended the
 * parent. `adopt` gives a plan the tracker held from before Ledger the
 * engine's names for one phase (21.8.8): the parent the migration names, by
 * the tracker's own id, is the phase written, its own tasks the phase's —
 * one holding a task's name of the phase already keeping its number, the
 * rest in the numbers left, in `order`, the tracker's own ids as the old
 * plan orders them, which the migration's cut gives, then in the order the
 * tracker made them — and the
 * parent above it the unit, where
 * the unit has none and that parent no name of the engine's; it adds to what each holds, changing nothing else of
 * it — its status, its history, any name of the person's — and answers the
 * phase's tasks so named. A name a task holds already is left, so a run
 * again adds only what the last left out; and it refuses, adding nothing,
 * a parent the tracker lacks, a task named apart from the name it would
 * take, and a name another task holds. `adoption` reads the phases named,
 * each by its parent, as their adoption in that order would leave them —
 * each phase's tasks whole, as `tasks` gives them, a link resolved through
 * the names the adoption gives, the name its old plan carries on its root,
 * its topic's (`--refs` before Ledger), the root's first ref no name of the
 * engine's, null where it has none, and the phase's title as its parent
 * holds it, read as a phase's title is — writing nothing, and refusing
 * as `adopt` refuses: what the migration's cut checks before its first
 * write. `waitingOn` reads the same adoption from the other side: each
 * task of another unit the tracker names held after a task the adoption
 * names, whole, as `tasks` gives it, its links resolved through those
 * names — so a unit cut first, whose tasks were held after this one's
 * before they had names, is seen at this one's cut.
 * `closePlan` closes a plan the tracker held from before Ledger whose unit
 * built nothing, or was cancelled (21.8.4): under the root the migration
 * names, by the tracker's own id, each task holding no task of its own,
 * neither done nor closed, is closed with the reason given, the parents
 * ended by the tracker, the plan given no name of the engine's, so the
 * unit's parent and the phases the build writes are made afresh; it answers
 * how many it closed, a run again closing none; and it refuses, closing
 * nothing, a plan holding a task done — the tracker wins, its unit built
 * some of it — but where `keepDone`, a cancelled unit's, whose tasks done
 * stand.
 * `unlink` takes off the link holding a task after another, for the
 * migration's cut, before its adoption (21.8.8): each task named as
 * adopting the unit's `phases` in turn would name it, as `adoption`
 * reads them, another unit's by the names it holds, either of the two —
 * writing no name.
 * `removePhase` takes a phase written out of the tracker for good,
 * every task under it with it and every link to them dropped, so it reads
 * as never written and its number and its tasks' names are made again as
 * new. `add` puts an addition onto a task, after any before it;
 * `setType` replaces its type. `ready` answers every task, of the phase or
 * of every written phase, waiting to be started with nothing it is linked
 * after still to finish: a task done or closed holds nothing up. `list`
 * answers a phase's tasks in order, and `tasks` each of them whole, as
 * `show` gives it, in one read of the tracker. `started` answers when a
 * task first moved into progress, as the tracker's own record of the move
 * holds it, so
 * a second clone's merge of the store carries it; null where it never has,
 * or the tracker lacks it. `mergeStore` merges the store's files
 * between two clones (4.7, 29.14.9): given the common ancestor's text, this
 * machine's and the remote's, it matches the tracker's records by the
 * tracker's own ids, takes a record only one side changed from that side,
 * and merges one both changed field by field against the ancestor, its
 * notes and links unioned; a field both set differently is a choice, which
 * `pickOf` answers or leaves open, shown in the engine's words and labelled
 * by the engine's name for its task. A status the tracker derives from a
 * record's children reads, once merged, as the tracker's own rules would
 * leave it over the merged children, never a choice. An engine name both
 * sides made under ids of their own stays the remote's: this machine's
 * record is set aside, with all it holds, and the rest merged; the merge
 * answers it as one more conflict, naming the names made twice and what
 * to make again by phase, and the engine stops on it and keeps this machine's
 * whole copy beside. A copy it cannot read is refused with a MergeError
 * naming the side and the line. Each task driver's folder declares where a
 * project from before Ledger kept its tracker's store, `pre-ledger-store.json`
 * beside its module (`{files, localFiles}`, project-relative, both empty
 * for a tracker that kept none): frozen, since the reshape's migrations
 * read it with fs alone, outside this loader.
 * @typedef {DriverDeclaration & MethodsOf<typeof METHODS.task> & {
 *   ensureStore: (root: string) => boolean,
 *   storeFiles: () => string[],
 *   localFiles: () => string[],
 *   mergeStore: (base: string, local: string, remote: string, pickOf?: import('./state-merge-rules.cjs').PickOf) => StoreMerge,
 *   createUnit: (root: string, unit: string) => boolean,
 *   createPhase: (root: string, unit: string, phase: number, title: string) => void,
 *   createTask: (root: string, ref: TaskRef, task: {title: string, type: string, text: string}) => void,
 *   adoption: (root: string, unit: string, phases: {phase: number, parent: string, order?: string[]}[]) => {phase: number, plan: string|null, title: string, tasks: TaskDetail[]}[],
 *   waitingOn: (root: string, unit: string, phases: {phase: number, parent: string, order?: string[]}[]) => TaskDetail[],
 *   adopt: (root: string, unit: string, phase: number, parent: string, order?: string[]) => TaskRef[],
 *   closePlan: (root: string, unit: string, parent: string, reason: string, keepDone?: boolean) => number,
 *   add: (root: string, ref: TaskRef, addition: TaskAddition) => void,
 *   setType: (root: string, ref: TaskRef, type: string) => void,
 *   link: (root: string, task: TaskRef, after: TaskRef) => void,
 *   unlink: (root: string, unit: string, phases: {phase: number, parent: string, order?: string[]}[], task: TaskRef, after: TaskRef) => void,
 *   ready: (root: string, unit: string, phase: number|null) => TaskRow[]|null,
 *   start: (root: string, ref: TaskRef) => void,
 *   done: (root: string, ref: TaskRef) => void,
 *   close: (root: string, ref: TaskRef, reason: string) => void,
 *   removePhase: (root: string, unit: string, phase: number) => void,
 *   list: (root: string, unit: string, phase: number) => TaskRow[]|null,
 *   show: (root: string, ref: TaskRef) => TaskDetail|null,
 *   tasks: (root: string, unit: string, phase: number) => TaskDetail[]|null,
 *   started: (root: string, ref: TaskRef) => string|null,
 * }} TaskDriver
 */
/** @typedef {import('./landing.cjs').LandingContext} LandingContext */
/** @typedef {import('./landing.cjs').LandingTask} LandingTask */
/** @typedef {import('./landing.cjs').ChainTip} ChainTip */
/** @typedef {import('./landing.cjs').QuickFixTask} QuickFixTask */
/** @typedef {import('./landing.cjs').QuickFixPull} QuickFixPull */
/** @typedef {import('./landing.cjs').UnitPull} UnitPull */
/** @typedef {import('./landing.cjs').UnitLanding} UnitLanding */
/**
 * A landing driver's methods, and the least each answers — what the landing
 * conformance suite reads. Each verb acts in one repository of the
 * project, its context's, and answers what it did there. `serves` answers
 * whether it serves a remote's URL; a driver that lands through a host
 * refuses a repository whose remote it does not serve (`assertServes`),
 * which the seam asks of every repository it walks before any acts; and a
 * driver whose default branch is not the local one answers the commit a
 * merge lands onto (`landsOn`), fetched, and that commit as last fetched,
 * fetching nothing (`landsOnAsFetched`), as a read asking no host takes
 * it — the seam reads the local branch's tip where it does not.
 * `taken` answers the commit it took each of the unit's tasks at, by its
 * internal id — where its branch stood as it opened, its pull request's
 * head — each a commit the repository holds, writing nothing but heads
 * fetched, which the seam reads where each task stands against its landing
 * (landing.cjs); a driver decides that of no task. A driver landing
 * through a host answers the command a way on that remakes a task's
 * branch here ends with, pushing it over its copy there (`pushedOver`),
 * null where the host holds none.
 * `chainTip` answers the branch a task's branch must descend from, at a
 * commit the repository has locally, which the seam checks before `open` —
 * null where the task's phase's stack holds it already; `holds`, whether it
 * does, fetching and writing nothing, as the close in step asks it of every
 * task of a phase, the stacks read once on its context
 * (landing-git.cjs, `readOnce`); `chain`, null where the task is not open
 * there; `mergePhase`, null where no task of the phase is open there, and
 * `already` where each of its tasks' changes is on the branch it lands on —
 * a stack merged in part, by hand, finished; a merge, what it was warned
 * of.
 * `nextMerge` answers the merge finish makes next there — its phase, and
 * the merge, made from what the driver read to pick it — null where every
 * phase is merged; the seam makes each in turn, and
 * `finished` lets go, once finish has merged them all, what the driver
 * keeps of the unit there.
 * A quick-fix lands as one pull request, its branch's, in each repository
 * it touches (landing.cjs): `quickFixPull` answers its heads, of the pull
 * requests opened from the repository itself, never a fork, since the time
 * the seam names — the one open's, null where none is, and those of the
 * ones merged, each a commit the repository holds — the host's copy of the
 * branch, held here, null where the host has none, and the driver's words
 * for a pull request closed by hand, null where the latest was not —
 * writing nothing but heads fetched, and carrying what more the driver's
 * verbs below need of it, since the seam hands that read back to them, so
 * a verb reads the host's pull requests once; `openQuickFix` opens it at
 * the branch as it stands, under the landing's message, from the read the
 * landing carries, a push replacing the host's copy only while it stands
 * where the landing read it, `already` where it is; `mergeQuickFix` merges
 * the one that opening answered, given with the landing, the branch
 * squashed onto the branch it lands on as one commit under that message —
 * answering `behind`, the host's branch that brings it up and what stops
 * it, where the merge stands and that branch here could not be brought to
 * it — or, given no
 * landing, brings that branch here to the host's, answering `already`; and `closeQuickFix` closes the one open unmerged the read given
 * found, as a move and a cancel close it, answering whether it did. A unit with a branch
 * of its own lands it on the default branch at finish (landing.cjs), its
 * context's branch the default branch: `unitPull`, where the driver lands
 * through a host, reads the unit's pull request from that branch, the one
 * open and why the host would refuse a merge commit, writing nothing;
 * `openUnit`, there too, opens the unit's pull request from that branch,
 * given its landing, as its review phase begins, where none is open,
 * answering its number and whether it opened it; `landUnit`
 * lands the branch, given its landing, by a merge commit whose first parent
 * is the default branch, under the landing's subject and description — a
 * host's through the unit's pull request, the one open else one opened —
 * the default branch here brought to it, or, given none, that branch here
 * brought to the host's alone, answering `already`; and `closeUnit` closes
 * the open pull request a read given found, answering whether it did.
 * A cancel closes every pull request open on a branch of the unit's
 * (18.3.9): `closeTasks` closes each of its tasks' open there, answering
 * whether it closed any. Each close tells `closed` the host's own name for
 * each pull request as it closes it, none for a driver that keeps them on
 * no host: the seam records each on the unit's manifest as it is told, so
 * a close that fails part way keeps those it made, and hands them back on
 * every later context (`cancelClosed`), whose reads take each as none
 * while it stays closed, so a landing after a reactivate opens what it
 * needs anew.
 * Where the host can, run from a repository's checkout against its remote's
 * repository:
 * `protectBranch` sets a rule refusing a branch's deletion and any push to
 * it that is not a fast-forward (4.4.6), and `setSquashDefault` makes a
 * squash merge's commit the pull request's title and description (7.2.18),
 * left as it is where it does — each answering the repository as its host
 * names it, and why the setting is not made, null where it is.
 * @typedef {(root: string, url: string) => {repository: string, unset: string|null}} HostSetting
 * @typedef {{closed: boolean}} PullsClosed
 * @typedef {(name: string) => void} Closing
 * @typedef {{
 *   serves: (url: string) => boolean,
 *   taken: (ctx: LandingContext) => Map<string, string>,
 *   assertServes?: (ctx: LandingContext) => void,
 *   landsOn?: (ctx: LandingContext) => string,
 *   landsOnAsFetched?: (ctx: LandingContext) => string,
 *   pushedOver?: (ctx: LandingContext, branch: string) => string|null,
 *   protectBranch?: (root: string, url: string, branch: string) => {repository: string, unset: string|null},
 *   setSquashDefault?: HostSetting,
 *   chainTip: (ctx: LandingContext, task: LandingTask) => ChainTip|null,
 *   holds: (ctx: LandingContext, ref: TaskRef) => boolean,
 *   open: (ctx: LandingContext, task: LandingTask, tip: ChainTip) => {base: string},
 *   chain: (ctx: LandingContext, ref: TaskRef) => {stack: string[]}|null,
 *   mergePhase: (ctx: LandingContext, phase: number) => {into: string, merged: string[], warnings?: string[]}|{into: string, already: true, warnings?: string[]}|null,
 *   nextMerge: (ctx: LandingContext) => {phase: number, merge: () => {into: string, merged: string[], warnings?: string[]}}|null,
 *   quickFixPull: (ctx: LandingContext, branch: string, since: string|null) => QuickFixPull,
 *   openQuickFix: (ctx: LandingContext, landing: QuickFixTask) => {already?: true, warnings?: string[]},
 *   mergeQuickFix: (ctx: LandingContext, landing: QuickFixTask|null, opened?: Record<string, any>) => {into: string, merged: string[], behind?: {branch: string, why: string}, warnings?: string[]}|{into: string, already: true, warnings?: string[]},
 *   closeQuickFix: (ctx: LandingContext, pull: QuickFixPull, closed: Closing) => PullsClosed,
 *   unitPull?: (ctx: LandingContext, branch: string) => UnitPull,
 *   openUnit?: (ctx: LandingContext, landing: UnitLanding) => {into: string, pull_request: number, opened?: true},
 *   landUnit: (ctx: LandingContext, landing: UnitLanding|null) => {into: string, landed: string, commit?: string, pull_requests?: number[], warnings?: string[]}|{into: string, already: true, warnings?: string[]},
 *   closeUnit: (ctx: LandingContext, pull: UnitPull|null, closed: Closing) => PullsClosed,
 *   closeTasks: (ctx: LandingContext, closed: Closing) => PullsClosed,
 *   finished?: (ctx: LandingContext) => void,
 * }} LandingMethods
 */
/** @typedef {DriverDeclaration & Omit<MethodsOf<typeof METHODS.landing>, keyof LandingMethods> & LandingMethods} LandingDriver */
/** @typedef {TaskDriver | LandingDriver} Driver */

/** @param {unknown} kind @returns {asserts kind is DriverKind} */
function assertKind(kind) {
  if (!DRIVER_KINDS.includes(/** @type {DriverKind} */ (kind))) {
    throw new Error(`drivers: "${String(kind)}" is not a kind of driver — the kinds are ${DRIVER_KINDS.join(', ')}`);
  }
}

/** @param {unknown} value @returns {boolean} */
function isText(value) {
  return typeof value === 'string' && value !== '';
}

/** @param {unknown} need @returns {boolean} */
function isNeed(need) {
  return isObject(need) && isText(need.tool) && isText(need.label) && isText(need.floor) && releaseOf(need.floor) !== null
    && isText(need.update) && typeof need.found === 'function';
}

/**
 * What is amiss in what a driver declares or carries, or null where nothing is.
 * @param {DriverKind} kind @param {string} name @param {any} driver
 * @returns {string|null}
 */
function faultOf(kind, name, driver) {
  if (!isObject(driver) || driver.kind !== kind || driver.name !== name) {
    return `must declare kind "${kind}" and name "${name}", as its folder does`;
  }
  if (typeof driver.isDefault !== 'boolean') return 'must declare isDefault, true or false';
  if (!isText(driver.title)) return 'must declare its title, the words a screen names it by';
  if (!Array.isArray(driver.needs) || !driver.needs.every(isNeed)) return 'must declare its needs as a list of {tool, label, floor, update, found}, each floor a version';
  const { required, optional } = METHODS[kind];
  const missing = required.filter((method) => typeof driver[method] !== 'function');
  if (missing.length > 0) return `lacks ${missing.join(', ')}`;
  const amiss = /** @type {readonly string[]} */ (optional).filter((method) => method in driver && typeof driver[method] !== 'function');
  return amiss.length > 0 ? `carries ${amiss.join(', ')} as other than a method` : null;
}

/** A kind's folder, refused where none of its drivers ships. @param {DriverKind} kind @param {string} root @returns {string} */
function kindFolder(kind, root) {
  assertKind(kind);
  const folder = path.join(root, kind);
  if (!fs.existsSync(folder)) throw new Error(`drivers: no ${kind} driver ships — there is no ${kind}/ folder of drivers`);
  return folder;
}

/** The driver folders of a kind, by name. @param {string} folder @returns {string[]} */
function namesIn(folder) {
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * The shipped driver of a kind by its name. Refuses a name no driver ships,
 * naming those that do, and a driver whose folder or declaration is amiss.
 * `root` is the drivers' folder, a test's own; Ledger's is the only
 * one the engine reads.
 * @param {DriverKind} kind @param {string} name @param {string} [root]
 * @returns {Driver}
 */
function loadDriver(kind, name, root = DRIVERS_ROOT) {
  const folder = kindFolder(kind, root);
  const shipped = namesIn(folder);
  if (!shipped.includes(name)) throw new Error(`drivers: no ${kind} driver "${name}" ships — the ${kind} drivers are ${shipped.join(', ') || 'none'}`);
  const entry = path.join(folder, name, ENTRY);
  if (!fs.existsSync(entry)) throw new Error(`drivers: the ${kind} driver in ${kind}/${name}/ has no ${ENTRY}`);
  const driver = require(entry);
  const fault = faultOf(kind, name, driver);
  if (fault !== null) throw new Error(`drivers: the ${kind} driver in ${kind}/${name}/ ${fault}`);
  return driver;
}

/**
 * Every shipped driver of a kind, by name.
 * @param {DriverKind} kind @param {string} [root] as `loadDriver`'s
 * @returns {Driver[]}
 */
function listDrivers(kind, root = DRIVERS_ROOT) {
  return namesIn(kindFolder(kind, root)).map((name) => loadDriver(kind, name, root));
}

/** @param {Driver[]} drivers @returns {string} */
function namesOf(drivers) {
  return drivers.map((driver) => driver.name).join(', ') || 'none';
}

/**
 * The one landing driver of `drivers` that serves a remote's URL, or null
 * where none does. Refuses a URL several serve.
 * @param {LandingDriver[]} drivers @param {string} url
 * @returns {LandingDriver|null}
 */
function servingOf(drivers, url) {
  const serving = drivers.filter((driver) => driver.serves(url));
  if (serving.length > 1) throw new Error(`drivers: several landing drivers serve ${url} — ${namesOf(serving)}`);
  return serving[0] ?? null;
}

/**
 * The code host's driver: the shipped landing driver that serves the
 * remote's URL, whatever the project's landing setting, or null where none
 * does.
 * @param {string} url @param {string} [root] as `loadDriver`'s
 * @returns {LandingDriver|null}
 */
function hostDriver(url, root = DRIVERS_ROOT) {
  return servingOf(/** @type {LandingDriver[]} */ (listDrivers('landing', root)), url);
}

/**
 * A kind's default among its drivers: for landing, the one driver that
 * serves the remote's URL where there is one; else the one flagged default.
 * @param {DriverKind} kind @param {Driver[]} drivers @param {string|null} url the remote's
 * @returns {Driver}
 */
function defaultDriver(kind, drivers, url) {
  const serving = kind === 'landing' && url !== null ? servingOf(/** @type {LandingDriver[]} */ (drivers), url) : null;
  if (serving !== null) return serving;
  const flagged = drivers.filter((driver) => driver.isDefault);
  if (flagged.length !== 1) throw new Error(`drivers: one ${kind} driver is flagged default — flagged: ${namesOf(flagged)}`);
  return flagged[0];
}

/**
 * The name the project manifest's `drivers.{kind}` sets, or null where none
 * is set.
 * @param {Record<string, any>} project @param {DriverKind} kind
 * @returns {string|null}
 */
function settingOf(project, kind) {
  if (project.drivers === undefined) return null;
  const set = isObject(project.drivers) ? project.drivers[kind] : null;
  if (set === undefined) return null;
  if (typeof set !== 'string') throw new Error(`drivers: the project's drivers.${kind} setting is not a driver's name`);
  return set;
}

/**
 * The URL of the project's remote where a kind's drivers read it — the
 * landing drivers' — else null.
 * @param {string} cwd @param {DriverKind} kind
 * @returns {string|null}
 */
function remoteOf(cwd, kind) {
  // Loaded here, not with the module: the layout guard reads the drivers
  // before every write under the state, and remote.cjs brings the state
  // worktree's modules with it.
  return kind === 'landing' ? require('./remote.cjs').remoteUrl(cwd) : null;
}

/**
 * Whether a driver serves a project whose remote's URL is `url`: a task
 * driver serves any, as does a landing driver landing through no host; one
 * landing through a host (`assertServes`) serves only a remote it serves.
 * @param {Driver} driver @param {string|null} url
 * @returns {boolean}
 */
function servesRemote(driver, url) {
  if (driver.kind !== 'landing') return true;
  const landing = /** @type {LandingDriver} */ (driver);
  return landing.assertServes === undefined || (url !== null && landing.serves(url));
}

/**
 * A kind's shipped drivers, each with whether it serves the project.
 * @param {string} cwd @param {DriverKind} kind @param {string} [root] as `loadDriver`'s
 * @returns {{driver: Driver, serves: boolean}[]}
 */
function projectDrivers(cwd, kind, root = DRIVERS_ROOT) {
  const url = remoteOf(cwd, kind);
  return listDrivers(kind, root).map((driver) => ({ driver, serves: servesRemote(driver, url) }));
}

/**
 * The project's driver of a kind as things stand, writing nothing: the one
 * its setting names, or the kind's default; `set` says the setting names it.
 * @param {string} cwd @param {DriverKind} kind @param {string} [root] as `loadDriver`'s
 * @returns {{driver: Driver, set: boolean}}
 */
function chosenDriver(cwd, kind, root = DRIVERS_ROOT) {
  const set = settingOf(readProjectManifest(cwd), kind);
  if (set !== null) return { driver: loadDriver(kind, set, root), set: true };
  return { driver: defaultDriver(kind, listDrivers(kind, root), remoteOf(cwd, kind)), set: false };
}

/**
 * The project's driver of a kind: the one its setting names, or, where the
 * setting is absent, the kind's default, written to the project manifest
 * under the writer lock as the setting from then on. `written` says this
 * call wrote it, for the caller's commit to carry. Refuses a setting naming
 * a driver Ledger doesn't ship.
 * @param {string} cwd @param {DriverKind} kind @param {string} [root] as `loadDriver`'s
 * @returns {{driver: Driver, written: boolean}}
 */
function resolveDriver(cwd, kind, root = DRIVERS_ROOT) {
  const { driver, set } = chosenDriver(cwd, kind, root);
  if (set) return { driver, written: false };
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    manifest.drivers = { ...(isObject(manifest.drivers) ? manifest.drivers : {}), [kind]: driver.name };
    writeProjectManifestAtomic(cwd, manifest);
  });
  return { driver, written: true };
}

/**
 * How each tool a driver needs stands (the header's), in the order it
 * declares them.
 * @param {Driver} driver
 * @returns {ToolState[]}
 */
function toolStates(driver) {
  return driver.needs.map(({ tool, label, floor, update, found: read }) => {
    const need = { tool, label, floor, update };
    /** @type {string|null} */
    let found;
    try {
      found = read();
    } catch (err) {
      return { ...need, found: null, state: /** @type {const} */ ('failing'), error: err instanceof Error ? err.message : String(err) };
    }
    if (found === null) return { ...need, found, state: /** @type {const} */ ('missing') };
    const release = releaseOf(found);
    const older = release !== null && !atLeast(release, /** @type {number[]} */ (releaseOf(floor)));
    return { ...need, found, state: older ? /** @type {const} */ ('older') : /** @type {const} */ ('fine') };
  });
}

/**
 * Why a driver can't run: every tool it needs that is not installed, and
 * where its updates are; each older than its floor, with the version found
 * and where its updates are; and the error of each installed but failing —
 * null where each one is fine.
 * @param {Driver} driver
 * @returns {string|null}
 */
function needsRefusal(driver) {
  const states = toolStates(driver);
  const missing = states.filter(({ state }) => state === 'missing');
  const absent = missing.length === 0 ? [] : [
    `needs ${missing.map((need) => need.tool).join(' and ')}, not installed — ${missing.map((need) => `${need.tool}'s updates are at ${need.update}`).join('; ')}`,
  ];
  const faults = [...absent, ...states.flatMap((need) => {
    if (need.state === 'older') return [`${need.tool} is ${need.found}, older than the ${need.floor} it needs — its updates are at ${need.update}`];
    return need.state === 'failing' ? [`${need.tool} is installed but fails — ${need.error}`] : [];
  })];
  return faults.length === 0 ? null : `the ${driver.kind} driver ${faults.join('; and ')}`;
}

module.exports = { METHODS, loadDriver, listDrivers, defaultDriver, hostDriver, chosenDriver, resolveDriver, settingOf, toolStates, needsRefusal, projectDrivers };
