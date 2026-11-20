'use strict';

// ---------------------------------------------------------------------------
// Ready to build's drivers' check (ledger-engine/scripts/domain/
// ready-to-build.cjs over domain/drivers-verbs.cjs), over the drivers that
// ship, read from their declarations, so no tool is named here (7.1.10):
// the drivers checked against the tools they need at the screen and again
// at the yes, each after the environment setup, the stop drawn in the
// screen's place where a tool is not fine (22.4.5–22.4.9, 7.2.10), a change
// of driver named only where another serves the project, and a tool gone
// while the screen waited still stopping the build (O20); and the yes writing
// each driver's setting the project lacks, as the first verb needing it
// would (22.4.3, F7). The stop's every wording is
// test-engine-drivers-verbs.cjs's; each shipped driver's tools missing,
// older or failing at ready to build, and a remote on a host, its own
// suite's (tests/drivers/{name}/test-drivers.cjs); the defaults resolved
// from a remote test-engine-drivers-remote.cjs's.
//
// Layer: verb. World: the ready to build world closed
// (ready-to-build-world.cjs), copied for each test into a folder named
// `lantern`, the tools the check reads stood in for at their floors
// (engine-harness.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, output, refusedPristine, sectionOf, readManifest, readState, git, bareRepo, killedAt, stateGit, toolless, setEnvironment, commitAll } = require('./engine-harness.cjs');
const { UNIT, SESSION, closed, useReadyWorld } = require('./ready-to-build-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { driversStopScreen, driversStopReason } = require(path.join(SCRIPTS, 'domain/projections/drivers.cjs'));

/** @typedef {import('../../skills/ledger-engine/scripts/domain/drivers.cjs').Driver} Driver */

/** A kind's default: the driver it flags. @param {'task'|'landing'} kind */
const flagged = (kind) => /** @type {Driver} */ (listDrivers(kind).find((driver) => driver.isDefault));
const TASK = flagged('task');
const LANDING = flagged('landing');

/** The task driver's stop, its every tool not installed, and whether another task driver serves a project with no remote. */
const TASK_MISSING = Object.freeze([{
  kind: /** @type {const} */ ('task'),
  driver: TASK.name,
  title: TASK.title,
  tools: TASK.needs.map(({ tool, label, floor, update }) => ({ tool, label, floor, update, found: null, state: /** @type {const} */ ('missing') })),
  changeable: listDrivers('task').some((driver) => driver !== TASK && !('assertServes' in driver)),
}]);

const dir = useReadyWorld(closed, 'lantern');

/** A call's environment: the conversation's, `more` over it. @param {Record<string, string>} [more] */
const env = (more = {}) => ({ ...SESSION, ...more });

/** No tool a driver needs on the PATH. */
const withoutTools = () => env({ PATH: toolless(path.dirname(dir())) });

/** The project's drivers setting. */
const drivers = () => JSON.parse(readState(dir(), 'manifest.json')).drivers;

/** The screen as `callEnv` leaves the tools. @param {Record<string, string>} [callEnv] */
const screen = (callEnv = env()) => output(dir(), ['render', 'ready-to-build', UNIT], { env: callEnv });

/** The yes in auto. */
const yes = () => ok(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env() });

describe('the drivers checked at ready to build (22.4.5–22.4.9)', () => {
  it('with every tool at its floor, the screen draws, asking nothing of the drivers, and its yes begins the build', () => {
    assert.ok(sectionOf(screen(), 'MENU: ready to build').includes('a/auto'));
    assert.deepStrictEqual(yes().position, 'auto');
  });

  it('22.4.8, 7.S14: a tool not installed — the stop drawn in the screen\'s place, with no gate', { skip: TASK.needs.length === 0 }, () => {
    const out = screen(withoutTools());

    assert.deepStrictEqual([...out.matchAll(/^=== (.+?) \(/gm)].map((m) => m[1]), ['DISPLAY: drivers stop', 'DISPLAY: drivers account']);
    assert.strictEqual(out, driversStopScreen('Lantern', TASK_MISSING));
  });

  it('22.4.5, O20: a tool gone while the screen waited stops the yes, refused with the stop, writing nothing', { skip: TASK.needs.length === 0 }, () => {
    assert.ok(sectionOf(screen(), 'MENU: ready to build').includes('a/auto'));

    assert.strictEqual(refusedPristine(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: withoutTools() }).error,
      `ready-to-build yes: ${driversStopReason('Lantern', TASK_MISSING)}`);
    assert.strictEqual(readManifest(dir(), UNIT).build, undefined);
  });

  it('22.5.3: the environment setup comes first — where it is not recorded, the screen and the yes are each refused for it before the drivers are checked', { skip: TASK.needs.length === 0 }, () => {
    setEnvironment(dir(), undefined);
    commitAll(dir(), 'the environment setup never asked');
    const open = 'ready-to-build has items open since its close: environment-recorded — they are worked, and it is closed again';

    assert.deepStrictEqual([
      refusedPristine(dir(), ['render', 'ready-to-build', UNIT], { env: withoutTools() }).error,
      refusedPristine(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: withoutTools() }).error,
    ], [`render ready-to-build: ${open}`, `ready-to-build yes: ${open}`]);
  });
});

describe('the yes writes both drivers\' settings (22.4.3, F7)', () => {
  it('4.4.6: a project landing through GitHub is offered the squash default in the screen\'s place at its first ready to build, its answer leading back to the screen, and never again', () => {
    git(dir(), ['remote', 'add', 'origin', 'git@github.com:acme/lantern.git']);

    const offer = screen();
    ok(dir(), ['github-squash', 'no'], { env: env() });

    assert.deepStrictEqual([offer.includes('=== MENU: github squash gate '), offer.includes('MENU: ready to build'), screen().includes('=== MENU: ready to build ')], [true, false, true]);
  });

  it('22.S10, 7.S1: a project with no remote records each kind\'s default, unasked', () => {
    assert.strictEqual(drivers(), undefined);
    yes();

    assert.deepStrictEqual(drivers(), { task: TASK.name, landing: LANDING.name });
  });

  it('22.S25, 7.S18: a project whose remote is on no host a driver serves records the landing default', () => {
    git(dir(), ['remote', 'add', 'origin', bareRepo(`${dir()}-elsewhere.git`)]);
    yes();

    assert.deepStrictEqual(drivers(), { task: TASK.name, landing: LANDING.name });
  });

  it('keeps a setting the project holds, writing only the one it lacks', () => {
    ok(dir(), ['drivers', 'set', 'landing', LANDING.name], { env: env() });
    yes();

    assert.deepStrictEqual(Object.entries(drivers()), [['landing', LANDING.name], ['task', TASK.name]]);
  });

  it('killed once a setting is written, the yes run again begins the build, its commit carrying both and nothing left uncommitted', () => {
    killedAt({ method: 'renameSync', file: '.ledger/manifest.json', when: 'after' }, dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env() });
    assert.deepStrictEqual([drivers(), readManifest(dir(), UNIT).build], [{ task: TASK.name }, undefined]);

    yes();
    assert.deepStrictEqual([drivers(), readManifest(dir(), UNIT).build], [{ task: TASK.name, landing: LANDING.name }, { position: 'auto' }]);
    assert.strictEqual(stateGit(dir(), ['status', '--porcelain']), '');
  });
});
