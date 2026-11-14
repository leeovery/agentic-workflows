'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the drivers' verbs and screens (22.4) — `drivers check`,
// `drivers set <task|landing> <name>`, `render drivers` and `render
// drivers-stop` — over the drivers the project's setting names, or each
// kind's default where none is set (drivers.cjs).
//
// - The check reads the project's driver of each kind as things stand,
//   writing nothing, and how each tool it needs stands (`toolStates`):
//   missing, older than its floor, failing, or fine. A driver with a tool
//   not fine stops ready to build (`driversStop`), at its screen and again
//   at its yes, so a tool gone while the screen waited still stops it
//   (22.4.5–22.4.9, 7.2.10); a driver needing nothing never stops it.
// - `set` writes the project's setting for one kind, under the project
//   manifest's lock, and commits it alone, pushed (`drivers: the {kind}
//   driver is {name}`); run again where its write stands, it commits what a
//   kill left uncommitted. It refuses a name no shipped driver answers to,
//   naming those that do, and refuses while a build is in flight in any
//   unit — one in progress whose build has begun, or a quick-fix whose
//   fixes have — naming each, since a build never changes driver under it
//   (22.4.3). Its next draws the drivers again.
// - `render drivers` draws the menu manage's d/drivers opens; `render
//   drivers-stop` the stop, refused where nothing stops.
// ---------------------------------------------------------------------------

const { readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { DRIVER_KINDS } = require('../kernel/manifest-schema.cjs');
const { chosenDriver, listDrivers, settingOf, toolStates } = require('./drivers.cjs');
const { loadActiveManifests } = require('./reads.cjs');
const { buildBegun, quickFixBuild, fixesBegun } = require('./derivations.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { projectName } = require('./state-checks.cjs');
const { refusing } = require('./staged-payload.cjs');
const { MENUS, drawMenu } = require('./menus.cjs');
const { driversStopScreen, driversStopReason, driversScreen } = require('./projections/drivers.cjs');

/** @typedef {typeof DRIVER_KINDS[number]} DriverKind */
/** @typedef {import('./projections/drivers.cjs').DriverCheck} DriverCheck */

const DRIVERS_USAGE = [
  'drivers check',
  `drivers set <${DRIVER_KINDS.join('|')}> <name>`,
].join('\n');

/** @returns {never} */
function usage() {
  throw new Error(`Usage: ${DRIVERS_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
}

/**
 * The project's driver of each kind as things stand, and how each tool it
 * needs stands; `set` says the project's setting names it.
 * @param {string} cwd @returns {(DriverCheck & {set: boolean})[]}
 */
function driversCheck(cwd) {
  return DRIVER_KINDS.map((kind) => {
    const { driver, set } = chosenDriver(cwd, kind);
    return { kind, driver: driver.name, title: driver.title, set, tools: toolStates(driver) };
  });
}

/** Each driver of the check with a tool not fine. @param {DriverCheck[]} checks */
const stoppingOf = (checks) => checks.filter(({ tools }) => tools.some(({ state }) => state !== 'fine'));

/**
 * What stops ready to build in the drivers' check — its screen, and the
 * stop in one line — or null where nothing does.
 * @param {string} cwd @returns {{screen: () => string, reason: string}|null}
 */
function driversStop(cwd) {
  const stopping = stoppingOf(driversCheck(cwd));
  if (stopping.length === 0) return null;
  const project = projectName(cwd);
  return { screen: () => driversStopScreen(project, stopping), reason: driversStopReason(project, stopping) };
}

/** Each unit whose build is in flight: in progress, its build begun, or a quick-fix's fixes. @param {string} cwd @returns {string[]} */
function buildsInFlight(cwd) {
  return loadActiveManifests(cwd)
    .filter((manifest) => buildBegun(manifest) || (quickFixBuild(manifest) && fixesBegun(manifest)))
    .map((manifest) => manifest.name);
}

/** @param {string} kind @returns {kind is DriverKind} */
const isKind = (kind) => (/** @type {readonly string[]} */ (DRIVER_KINDS)).includes(kind);

/**
 * `drivers set <kind> <name>`: the project's setting for the kind, written
 * and committed.
 * @param {string} cwd @param {string} kind @param {string} name
 */
function setDriver(cwd, kind, name) {
  if (!isKind(kind)) throw new Error(`there is no kind of driver "${kind}" — the kinds are ${DRIVER_KINDS.join(', ')}`);
  const installed = listDrivers(kind);
  const driver = installed.find((each) => each.name === name);
  if (driver === undefined) throw new Error(`no ${kind} driver "${name}" is installed — the ${kind} drivers are ${installed.map((each) => each.name).join(', ')}`);
  const building = buildsInFlight(cwd);
  if (building.length > 0) {
    const units = building.length === 1 ? building[0] : `${building.slice(0, -1).join(', ')} and ${building.at(-1)}`;
    throw new Error(`a build is in flight in ${units}, and a build never changes driver under it — change the ${kind} driver once ${building.length === 1 ? 'it finishes' : 'each finishes'}`);
  }
  const was = settingOf(readProjectManifest(cwd), kind);
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    writeProjectManifestAtomic(cwd, { ...manifest, drivers: { ...(isObject(manifest.drivers) ? manifest.drivers : {}), [kind]: name } });
  });
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `drivers: the ${kind} driver is ${name}`, warnings);
  /** @type {Record<string, unknown>} */
  const result = { kind, driver: name, title: driver.title, was, committed: outcome.committed, next: { kind: 'engine', argv: ['render', 'drivers'] } };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, '--state');
  return result;
}

/**
 * `drivers <verb> …`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string|undefined} verb @param {string[]} args
 * @returns {Record<string, unknown>}
 */
function runDriversVerb(cwd, verb, args) {
  if (args.some((arg) => arg.startsWith('--'))) usage();
  if (verb === 'check' && args.length === 0) {
    return refusing('drivers check', () => {
      const drivers = driversCheck(cwd);
      return { drivers, stopped: stoppingOf(drivers).length > 0 };
    });
  }
  if (verb === 'set' && args.length === 2) return refusing('drivers set', () => setDriver(cwd, args[0], args[1]));
  return usage();
}

/**
 * `render drivers`: the drivers menu.
 * @param {string} cwd @returns {string}
 */
function driversSurface(cwd) {
  return refusing('render drivers', () => drawMenu(cwd, MENUS.drivers, {}, driversScreen(DRIVER_KINDS.map((kind) => ({
    kind,
    using: chosenDriver(cwd, kind).driver.name,
    installed: listDrivers(kind).map(({ name, title }) => ({ name, title })),
  })))));
}

/**
 * `render drivers-stop`: the stop at ready to build, refused where nothing
 * stops it.
 * @param {string} cwd @returns {string}
 */
function driversStopSurface(cwd) {
  return refusing('render drivers-stop', () => {
    const stop = driversStop(cwd);
    if (stop === null) throw new Error('every tool the drivers need is here — nothing stops ready to build');
    return stop.screen();
  });
}

module.exports = { DRIVERS_USAGE, runDriversVerb, driversStop, driversSurface, driversStopSurface };
