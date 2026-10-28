'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the drivers, the code behind the `task` verbs (the tracker)
// and the `land` verbs (the code host) (7.1.4, 7.2.1).
//
// A driver is a folder the workflows ship, `drivers/{kind}/{name}/driver.cjs`,
// and never one loaded from elsewhere (7.1.7): the loader lists the shipped
// folders. A driver declares its kind, its name, whether it is its kind's
// default, and the tools it needs, each with the oldest version it works
// with and where that tool's update instructions live (22.4.9). It carries
// every method of its kind; a driver short of one is refused.
//
// The project manifest's `drivers: {task, landing}` picks one of each kind.
// Absent, the task driver is the one flagged default (22.4.2); the landing
// driver is GitHub's where the project's remote is on GitHub, and the one
// flagged default otherwise, the local driver (22.4.3). A setting naming a
// driver the workflows don't ship is refused, naming those they do.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { DRIVER_KINDS } = require('../kernel/manifest-schema.cjs');
const { stateRepository } = require('./github-rule.cjs');

/** @typedef {typeof DRIVER_KINDS[number]} DriverKind */

const DRIVERS_ROOT = path.join(__dirname, '..', 'drivers');
const ENTRY = 'driver.cjs';

/** GitHub's landing driver: the landing default where the remote is on GitHub. */
const GITHUB_LANDING = 'github';

/** The methods each kind of driver carries. */
const METHODS = Object.freeze({
  task: /** @type {const} */ ([
    'ensureStore', 'storeFiles', 'localFiles', 'mergeStore',
    'createUnit', 'createPhase', 'createTask', 'link',
    'ready', 'start', 'done', 'close', 'list', 'show',
  ]),
  landing: /** @type {const} */ (['open', 'chain', 'mergePhase', 'finish']),
});

/**
 * A tool a driver needs: the oldest version it works with, and where its
 * update instructions live.
 * @typedef {{tool: string, floor: string, update: string}} DriverNeed
 */

/**
 * What every driver declares.
 * @typedef {{kind: DriverKind, name: string, isDefault: boolean, needs: DriverNeed[]}} DriverDeclaration
 */

/** @typedef {(...args: any[]) => any} DriverMethod */
/** @typedef {DriverDeclaration & Record<typeof METHODS.task[number], DriverMethod>} TaskDriver */
/** @typedef {DriverDeclaration & Record<typeof METHODS.landing[number], DriverMethod>} LandingDriver */
/** @typedef {TaskDriver | LandingDriver} Driver */

/** @param {unknown} kind @returns {asserts kind is DriverKind} */
function assertKind(kind) {
  if (!DRIVER_KINDS.includes(/** @type {DriverKind} */ (kind))) {
    throw new Error(`drivers: "${String(kind)}" is not a kind of driver — the kinds are ${DRIVER_KINDS.join(', ')}`);
  }
}

/**
 * The driver a folder holds, refused where it declares another kind or name
 * than its folder's, or lacks a method of its kind.
 * @param {DriverKind} kind @param {string} name @param {any} driver
 * @returns {Driver}
 */
function checked(kind, name, driver) {
  const refuse = (/** @type {string} */ why) => new Error(`drivers: the ${kind} driver in ${kind}/${name}/ ${why}`);
  if (!isObject(driver) || driver.kind !== kind || driver.name !== name) {
    throw refuse(`must declare kind "${kind}" and name "${name}"`);
  }
  const missing = METHODS[kind].filter((method) => typeof driver[method] !== 'function');
  if (missing.length > 0) throw refuse(`lacks ${missing.join(', ')}`);
  return /** @type {Driver} */ (driver);
}

/**
 * The shipped drivers of a kind, by name. `root` is the drivers' folder, a
 * test's own; the workflows' is the only one the engine reads.
 * @param {DriverKind} kind @param {string} [root]
 * @returns {Driver[]}
 */
function listDrivers(kind, root = DRIVERS_ROOT) {
  assertKind(kind);
  const folder = path.join(root, kind);
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => checked(kind, name, require(path.join(folder, name, ENTRY))));
}

/** @param {Driver[]} drivers @returns {string} */
function namesOf(drivers) {
  return drivers.map((driver) => driver.name).join(', ') || 'none';
}

/**
 * The name of a kind's default driver: GitHub's for landing where the remote
 * is on GitHub, else the one driver flagged default.
 * @param {DriverKind} kind @param {Driver[]} drivers @param {boolean} onGithub
 * @returns {string}
 */
function defaultDriverName(kind, drivers, onGithub) {
  if (kind === 'landing' && onGithub) return GITHUB_LANDING;
  const flagged = drivers.filter((driver) => driver.isDefault);
  if (flagged.length !== 1) throw new Error(`drivers: one ${kind} driver is flagged default — flagged: ${namesOf(flagged)}`);
  return flagged[0].name;
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
 * The project's driver of a kind: its setting, else the kind's default.
 * Refuses a setting naming a driver the workflows don't ship.
 * @param {string} cwd @param {DriverKind} kind @param {string} [root] as `listDrivers`'s
 * @returns {Driver}
 */
function projectDriver(cwd, kind, root = DRIVERS_ROOT) {
  const drivers = listDrivers(kind, root);
  const name = settingOf(readProjectManifest(cwd), kind)
    ?? defaultDriverName(kind, drivers, kind === 'landing' && stateRepository(cwd) !== null);
  const driver = drivers.find((shipped) => shipped.name === name);
  if (driver === undefined) throw new Error(`drivers: no ${kind} driver "${name}" ships — the ${kind} drivers are ${namesOf(drivers)}`);
  return driver;
}

module.exports = { METHODS, GITHUB_LANDING, listDrivers, defaultDriverName, projectDriver };
