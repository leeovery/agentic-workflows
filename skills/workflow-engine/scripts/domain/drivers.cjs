'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the drivers, the code behind the `task` verbs (the tracker)
// and the `land` verbs (the code host) (7.1.4, 7.2.1).
//
// A driver is a folder the workflows ship, `drivers/{kind}/{name}/driver.cjs`,
// and never one loaded from elsewhere (7.1.7): the loader reads the shipped
// folders. A driver declares its kind, its name, whether it is its kind's
// default, and the tools it needs: each with the oldest version it works
// with, where its update instructions live, and how to find the version
// installed (22.4.9). It carries every required method of its kind, and an
// optional one only where its tool has the capability. A driver short of a
// required method, or declaring any of that amiss, is refused.
//
// The project manifest's `drivers: {task, landing}` names one of each kind.
// Where a kind's setting is absent, the first verb that resolves it settles
// the default and writes it there, so a driver never changes under a build
// (7.1.4): the task driver flagged default (22.4.2); for landing, the driver
// that serves the project's remote, else the one flagged default, the local
// driver (22.4.3, 7.2.16). A setting naming a driver the workflows don't ship
// is refused, naming those they do. The code host's driver, which acts on
// the remote's host for setup, is the landing driver that serves the
// remote, whatever the setting. The loader names no host: a driver for
// another one is a folder of its own and nothing else.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { DRIVER_KINDS } = require('../kernel/manifest-schema.cjs');
const { remoteUrl } = require('./remote.cjs');

/** @typedef {typeof DRIVER_KINDS[number]} DriverKind */

const DRIVERS_ROOT = path.join(__dirname, '..', 'drivers');
const ENTRY = 'driver.cjs';

/** The methods every driver of a kind carries, and those it carries only where its tool can. */
const METHODS = Object.freeze({
  task: {
    required: /** @type {const} */ ([
      'ensureStore', 'storeFiles', 'localFiles', 'mergeStore',
      'createUnit', 'createPhase', 'createTask', 'add', 'setType', 'link',
      'ready', 'start', 'done', 'close', 'list', 'show',
    ]),
    optional: /** @type {const} */ ([]),
  },
  landing: {
    required: /** @type {const} */ (['serves', 'chainTip', 'open', 'chain', 'mergePhase', 'finish']),
    optional: /** @type {const} */ (['protectBranch']),
  },
});

/**
 * A tool a driver needs: the oldest version it works with, where its update
 * instructions live, and the version installed — null where it is not, the
 * tool's own error thrown where it is but fails.
 * @typedef {{tool: string, floor: string, update: string, found: () => string|null}} DriverNeed
 */

/**
 * What every driver declares.
 * @typedef {{kind: DriverKind, name: string, isDefault: boolean, needs: DriverNeed[]}} DriverDeclaration
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
 * A task driver. Every method but the three that name the store takes the
 * state root, where the tracker's store lives and the tool runs; the
 * engine's ids go in and come out, the tracker's own never. A unit holds the
 * phases written for it, a phase its tasks. `ensureStore` makes the store at
 * the root where it is missing, answering whether it did; no other method
 * runs before it. `storeFiles` and `localFiles` name, from the root, the
 * files the state branch carries and the gitignore patterns of those the
 * tool keeps local. The engine owns the refusals: `list` and `ready` answer
 * null for a phase not written, `show` null for a task the tracker lacks,
 * and the engine refuses in its words before any other method names one. A
 * verb a driver's method fails, where a tool the driver needs is not
 * installed or fails to run, is refused for that (`needsRefusal`), so a
 * driver lets its tool's absence throw as it falls. What stays with the
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
 * parent. `add` puts an addition onto a task, after any before it;
 * `setType` replaces its type. `ready` answers every task, of the phase or
 * of every written phase, waiting to be started with nothing it is linked
 * after still to finish: a task done or closed holds nothing up. `list`
 * answers a phase's tasks in order.
 * @typedef {DriverDeclaration & MethodsOf<typeof METHODS.task> & {
 *   ensureStore: (root: string) => boolean,
 *   storeFiles: () => string[],
 *   localFiles: () => string[],
 *   createUnit: (root: string, unit: string) => boolean,
 *   createPhase: (root: string, unit: string, phase: number, title: string) => void,
 *   createTask: (root: string, ref: TaskRef, task: {title: string, type: string, text: string}) => void,
 *   add: (root: string, ref: TaskRef, addition: TaskAddition) => void,
 *   setType: (root: string, ref: TaskRef, type: string) => void,
 *   link: (root: string, task: TaskRef, after: TaskRef) => void,
 *   ready: (root: string, unit: string, phase: number|null) => TaskRow[]|null,
 *   start: (root: string, ref: TaskRef) => void,
 *   done: (root: string, ref: TaskRef) => void,
 *   close: (root: string, ref: TaskRef, reason: string) => void,
 *   list: (root: string, unit: string, phase: number) => TaskRow[]|null,
 *   show: (root: string, ref: TaskRef) => TaskDetail|null,
 * }} TaskDriver
 */
/** @typedef {import('./landing.cjs').LandingContext} LandingContext */
/** @typedef {import('./landing.cjs').LandingTask} LandingTask */
/** @typedef {import('./landing.cjs').ChainTip} ChainTip */
/**
 * A landing driver's methods, and the least each answers — what the landing
 * conformance suite reads. `serves` answers whether it serves a remote's
 * URL; `chainTip` the branch a task's branch must descend from, at a commit
 * the repository has locally, which the seam checks before `open`.
 * `protectBranch`, where the host can, sets a rule on the remote's
 * repository refusing a branch's deletion and any push to it that is not a
 * fast-forward (4.4.6), answering the repository as its host names it, and
 * why the rule is not set, null where it is.
 * @typedef {{
 *   serves: (url: string) => boolean,
 *   protectBranch?: (url: string, branch: string) => {repository: string, unset: string|null},
 *   chainTip: (ctx: LandingContext, task: LandingTask) => ChainTip,
 *   open: (ctx: LandingContext, task: LandingTask, tip: ChainTip) => {task: string, branch: string, base: string},
 *   chain: (ctx: LandingContext, ref: TaskRef) => {stack: string[]},
 *   mergePhase: (ctx: LandingContext, phase: number) => {merged: string[]},
 *   finish: (ctx: LandingContext) => {phases: {phase: number, merged: string[]}[]},
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
  return isObject(need) && isText(need.tool) && isText(need.floor) && isText(need.update) && typeof need.found === 'function';
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
  if (!Array.isArray(driver.needs) || !driver.needs.every(isNeed)) return 'must declare its needs as a list of {tool, floor, update, found}';
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
 * `root` is the drivers' folder, a test's own; the workflows' is the only
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
 * The project's driver of a kind: the one its setting names, or, where the
 * setting is absent, the kind's default, written to the project manifest
 * under the writer lock as the setting from then on. `written` says this
 * call wrote it, for the caller's commit to carry. Refuses a setting naming
 * a driver the workflows don't ship.
 * @param {string} cwd @param {DriverKind} kind @param {string} [root] as `loadDriver`'s
 * @returns {{driver: Driver, written: boolean}}
 */
function resolveDriver(cwd, kind, root = DRIVERS_ROOT) {
  const set = settingOf(readProjectManifest(cwd), kind);
  if (set !== null) return { driver: loadDriver(kind, set, root), written: false };
  const driver = defaultDriver(kind, listDrivers(kind, root), kind === 'landing' ? remoteUrl(cwd) : null);
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    manifest.drivers = { ...(isObject(manifest.drivers) ? manifest.drivers : {}), [kind]: driver.name };
    writeProjectManifestAtomic(cwd, manifest);
  });
  return { driver, written: true };
}

/**
 * Why a driver can't run, naming every tool it needs that is not installed
 * and where its updates are, and passing through the error of each that is
 * installed but fails; null when each one runs.
 * @param {Driver} driver
 * @returns {string|null}
 */
function needsRefusal(driver) {
  /** @type {DriverNeed[]} */
  const missing = [];
  /** @type {string[]} */
  const failing = [];
  for (const need of driver.needs) {
    try {
      if (need.found() === null) missing.push(need);
    } catch (err) {
      failing.push(`${need.tool} is installed but fails — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const absent = missing.length === 0 ? [] : [
    `needs ${missing.map((need) => need.tool).join(' and ')}, not installed — ${missing.map((need) => `${need.tool}'s updates are at ${need.update}`).join('; ')}`,
  ];
  const faults = [...absent, ...failing];
  return faults.length === 0 ? null : `the ${driver.kind} driver ${faults.join('; and ')}`;
}

module.exports = { METHODS, loadDriver, listDrivers, defaultDriver, hostDriver, resolveDriver, settingOf, needsRefusal };
