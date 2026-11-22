'use strict';

// ---------------------------------------------------------------------------
// The drivers' verbs and screens (ledger-engine/scripts/domain/
// drivers-verbs.cjs, the screens domain/projections/drivers.cjs; 22.4),
// over the drivers that ship, read from their declarations, so no tool is
// named here (7.1.10): `drivers check`, each kind's driver as things stand
// and how each tool it needs stands, writing nothing; `drivers set`, the
// setting for one kind written and committed alone, refused for a driver
// no shipped one answers to, for one that does not serve the project, and
// while a build is in flight in any unit (O5), and finished by a run again
// after a kill; `render drivers`, manage's d/drivers, a choice asked only
// where another driver serves the project (22.4.4, 22.5.8); and the stop at
// ready to build in every wording its tools can give it, a change of driver
// named only where another of its kind serves the project (7.2.13).
// What each shipped driver's tools answer, and a driver serving a host, are
// its own suite's (tests/drivers/{name}/test-drivers.cjs); where ready to
// build draws the stop and refuses its yes,
// test-engine-ready-to-build-drivers.cjs's; manage's d row
// test-engine-manage.cjs's.
//
// Layer: verb. World: this file's own, built once and copied for each test
// into a folder named `lantern`: a project with no remote and a feature
// complete — `idle`; and the same with a feature whose build is under way
// and a quick-fix whose fixes have begun — `building`. The tools the check
// reads are stood in for at their floors (engine-harness.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, output, refusedPristine, screenOf, sectionOf, commitAll, fixtureFrom, cleanupFixture, killedAt, treeSnapshot, head, lastMessage, touched, statePath, stateGit, toolless } = require('./engine-harness.cjs');
const { createManifest, readState } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { driversStopScreen, driversScreen } = require(path.join(SCRIPTS, 'domain/projections/drivers.cjs'));
const { capitalise } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));

/** @typedef {import('../../skills/ledger-engine/scripts/domain/drivers.cjs').Driver} Driver */
/** @typedef {import('../../skills/ledger-engine/scripts/domain/drivers.cjs').ToolState} ToolState */

const SESSION = 'drivers-session';
const BUILDING = 'lazy-resume-on-attach';
const FIXING = 'typo-in-the-banner';
const COMPLETE = 'enter-attaches-from-preview';

/** A kind's default: the driver it flags. @param {'task'|'landing'} kind */
const flagged = (kind) => /** @type {Driver} */ (listDrivers(kind).find((driver) => driver.isDefault));
const TASK = flagged('task');
const LANDING = flagged('landing');

/** The landing drivers that land through a host, which serve only a remote on it. */
const HOSTED = listDrivers('landing').filter((driver) => 'assertServes' in driver);

/** Each tool a driver needs as the stand-ins answer it, at its floor. @param {Driver} driver @returns {ToolState[]} */
const atFloor = (driver) => driver.needs.map(({ tool, label, floor, update }) => ({ tool, label, floor, update, found: floor, state: 'fine' }));

/** Each tool a driver needs, not installed. @param {Driver} driver @returns {ToolState[]} */
const missing = (driver) => driver.needs.map(({ tool, label, floor, update }) => ({ tool, label, floor, update, found: null, state: 'missing' }));

const idle = fixtureFrom('ledger-drivers-', (dir) => {
  createManifest(dir, COMPLETE, { status: 'completed', build: { position: 'auto' } });
  commitAll(dir, 'a unit complete');
});

const building = fixtureFrom('ledger-drivers-building-', (dir) => {
  createManifest(dir, BUILDING, { build: { position: 'auto' } });
  createManifest(dir, FIXING, { work_type: 'quick-fix', fixes: {} });
  createManifest(dir, COMPLETE, { status: 'completed', build: { position: 'auto' } });
  commitAll(dir, 'the units the drivers verbs tell apart');
});

/** A call's environment: the conversation's, `more` over it. @param {Record<string, string>} [more] */
const env = (more = {}) => ({ CLAUDE_CODE_SESSION_ID: SESSION, ...more });

/** The project's drivers setting. @param {string} dir */
const drivers = (dir) => JSON.parse(readState(dir, 'manifest.json')).drivers;

/** A world copied into a folder named `lantern`. @param {(dir: string) => string} world */
const lantern = (world) => world(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-drivers-')), 'lantern'));

describe('the drivers\' verbs (22.4)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = lantern(idle); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('check: each kind\'s driver as things stand — its kind\'s default where none is set, the one set where one is — and each tool with its floor and the version found, writing nothing', () => {
    ok(dir, ['drivers', 'set', 'landing', LANDING.name], { env: env() });
    const before = { tree: treeSnapshot(dir), head: head(dir) };

    assert.deepStrictEqual(ok(dir, ['drivers', 'check'], { env: env() }), {
      ok: true,
      drivers: [
        { kind: 'task', driver: TASK.name, title: TASK.title, set: false, tools: atFloor(TASK) },
        { kind: 'landing', driver: LANDING.name, title: LANDING.title, set: true, tools: atFloor(LANDING) },
      ],
      stopped: false,
    });
    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before);
  });

  it('check: stopped where a tool a driver in use needs is not installed, each such tool missing; a driver needing nothing never stops it', { skip: TASK.needs.length === 0 }, () => {
    const { drivers: [task, landing], stopped } = ok(dir, ['drivers', 'check'], { env: env({ PATH: toolless(path.dirname(dir)) }) });

    assert.deepStrictEqual([stopped, task.tools, landing.tools], [true, missing(TASK), missing(LANDING)]);
    assert.deepStrictEqual(LANDING.needs, [], 'the landing default needs nothing');
  });

  it('22.S11, 7.S18: set writes the kind\'s setting, the other kept, committed alone, and draws the drivers again; run again, it commits nothing', () => {
    ok(dir, ['drivers', 'set', 'task', TASK.name], { env: env() });
    const answer = ok(dir, ['drivers', 'set', 'landing', LANDING.name], { env: env() });

    assert.deepStrictEqual(answer, { ok: true, kind: 'landing', driver: LANDING.name, title: LANDING.title, was: null, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'engine', argv: ['render', 'drivers'] } });
    assert.deepStrictEqual([drivers(dir), lastMessage(dir), touched(statePath(dir), 'HEAD')], [{ task: TASK.name, landing: LANDING.name }, `drivers: the landing driver is ${LANDING.name}`, ['M\tmanifest.json']]);

    const again = ok(dir, ['drivers', 'set', 'landing', LANDING.name], { env: env() });
    assert.deepStrictEqual([again.was, again.committed, drivers(dir)], [LANDING.name, null, { task: TASK.name, landing: LANDING.name }]);
  });

  it('set killed once its setting is written: run again, it commits what the kill left', () => {
    killedAt({ method: 'renameSync', file: '.ledger/manifest.json', when: 'after' }, dir, ['drivers', 'set', 'task', TASK.name], { env: env() });
    assert.notStrictEqual(stateGit(dir, ['status', '--porcelain']), '');

    const answer = ok(dir, ['drivers', 'set', 'task', TASK.name], { env: env() });
    assert.deepStrictEqual([answer.was, answer.committed === null, stateGit(dir, ['status', '--porcelain']), lastMessage(dir)], [TASK.name, false, '', `drivers: the task driver is ${TASK.name}`]);
  });

  it('set refuses a name no driver of the kind ships, naming those that do, and a kind or arguments of another shape, writing nothing', () => {
    const refused = (/** @type {string[]} */ args) => refusedPristine(dir, ['drivers', ...args], { env: env() }).error;

    assert.strictEqual(refused(['set', 'task', 'gamma']), `drivers set: no task driver "gamma" is installed — the task drivers are ${listDrivers('task').map(({ name }) => name).join(', ')}`);
    assert.strictEqual(refused(['set', 'tracker', TASK.name]), 'drivers set: there is no kind of driver "tracker" — the kinds are task, landing');
    for (const args of [['set', 'task'], ['set', 'task', TASK.name, '--force'], ['check', 'now'], ['adopt'], []]) {
      assert.strictEqual(refused(args), 'Usage: engine drivers check | engine drivers set <task|landing> <name>', args.join(' '));
    }
  });

  it('set refuses a driver landing through a host the project has no remote on, naming the drivers that serve it, writing nothing', () => {
    const serving = listDrivers('landing').filter((driver) => !HOSTED.includes(driver)).map(({ name }) => name).join(', ');
    assert.ok(HOSTED.length > 0, 'a landing driver lands through a host');

    for (const driver of HOSTED) {
      assert.strictEqual(refusedPristine(dir, ['drivers', 'set', 'landing', driver.name], { env: env() }).error,
        `drivers set: ${capitalise(driver.title)} lands through a host this project's remote isn't on — the landing drivers that serve this project are ${serving}`);
    }
  });
});

describe('set while a build is in flight (O5, 22.4.3)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = building(); });
  afterEach(() => cleanupFixture(dir));

  it('refuses, naming each unit whose build is in flight — one whose build has begun, a quick-fix whose fixes have — and a complete unit\'s build holds nothing', () => {
    assert.strictEqual(refusedPristine(dir, ['drivers', 'set', 'landing', LANDING.name], { env: env() }).error,
      `drivers set: a build is in flight in ${BUILDING} and ${FIXING}, and a build never changes driver under it — change the landing driver once each finishes`);

    createManifest(dir, FIXING, { status: 'completed' });
    commitAll(dir, `${FIXING} finished`);
    assert.strictEqual(refusedPristine(dir, ['drivers', 'set', 'task', TASK.name], { env: env() }).error,
      `drivers set: a build is in flight in ${BUILDING}, and a build never changes driver under it — change the task driver once it finishes`);
  });
});

describe('the drivers menu (22.4.4, 22.5.8)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = lantern(idle); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('shows each kind\'s drivers that ship, the one in use marked, each landing through a host the project has no remote on saying so, a numbered row for each other that serves it — or, where none does, the drivers in use — and back to manage', () => {
    const out = output(dir, ['render', 'drivers'], { env: env() });
    const shown = JSON.parse(fs.readFileSync(path.join(/** @type {string} */ (process.env.LEDGER_CONFIG_DIR), 'conversations', SESSION, SHOWN), 'utf8'));
    const others = (/** @type {'task'|'landing'} */ kind, /** @type {Driver} */ using) => listDrivers(kind).filter((driver) => driver !== using && !HOSTED.includes(driver)).map((driver) => ({ kind, driver }));
    const choices = [...others('task', TASK), ...others('landing', LANDING)];
    const marked = (/** @type {Driver} */ driver) => {
      if (driver === LANDING) return ' — in use';
      return HOSTED.includes(driver) ? ' — lands through a host this project\'s remote isn\'t on' : '';
    };

    assert.deepStrictEqual(sectionOf(out, 'DISPLAY: drivers').trim().split('\n'), [
      'THE TASK DRIVER',
      ...listDrivers('task').map((driver) => `  · ${driver.title}${driver === TASK ? ' — in use' : ''}`),
      'THE LANDING DRIVER',
      ...listDrivers('landing').map((driver) => `  · ${driver.title}${marked(driver)}`),
    ]);
    const choosing = { task: 'Track tasks through', landing: 'Land work through' };
    const [rule, ...menu] = screenOf(out, 'MENU: drivers');
    const asked = menu.findIndex((line) => line.startsWith('◆ '));
    assert.deepStrictEqual([rule, menu.slice(0, Math.max(asked - 1, 0)).join(' '), ...menu.slice(asked)], [
      '· · · · · · · · · · · ·',
      choices.length === 0 ? `No other driver serves Lantern: it tracks its tasks through ${TASK.title} and lands its work through ${LANDING.title}.` : '',
      choices.length === 0 ? '◆ What would you like to do?' : '◆ Which driver would you like to use?',
      '',
      ...choices.map(({ kind, driver }, at) => `${at + 1}      → ${choosing[kind]} ${driver.title}`),
      'h/help → What this menu is for, row by row',
      'b/back → Back to manage',
    ]);
    assert.deepStrictEqual(Object.fromEntries(shown.options.map((/** @type {{key: string, next: unknown}} */ { key, next }) => [key, next])), {
      ...Object.fromEntries(choices.map(({ kind, driver }, at) => [at + 1, { kind: 'engine', argv: ['drivers', 'set', kind, driver.name] }])),
      h: { kind: 'engine', argv: ['render', 'help', 'drivers'] },
      b: { kind: 'engine', argv: ['render', 'manage'] },
    });
  });
});

describe('the drivers menu\'s screen (22.4.4)', () => {
  /** A kind's view, the stand-in `using` in use, and another `serves` the project or not. @param {'task'|'landing'} kind @param {boolean} serves */
  const view = (kind, serves) => ({ kind, using: kind, installed: [{ name: kind, title: `the ${kind} stand-in`, serves: true }, { name: `other-${kind}`, title: `another ${kind} stand-in`, serves }] });

  it('asks which driver to use where another serves the project, a row for each', () => {
    const screen = driversScreen('Lantern', [view('task', false), view('landing', true)]);

    assert.deepStrictEqual([screen.statement, screen.question, screen.rows.map(({ label, next }) => [label, next])], [
      undefined, 'Which driver would you like to use?', [['Land work through another landing stand-in', { kind: 'engine', argv: ['drivers', 'set', 'landing', 'other-landing'] }]],
    ]);
  });

  it('where no other driver serves the project, says what it works through and asks no choice', () => {
    const screen = driversScreen('Lantern', [view('task', false), view('landing', false)]);

    assert.deepStrictEqual([screen.statement, screen.question, screen.rows], [
      'No other driver serves Lantern: it tracks its tasks through the task stand-in and lands its work through the landing stand-in.', undefined, [],
    ]);
  });
});

describe('the stop\'s words (22.4.7–22.4.9, 7.2.13)', () => {
  /** @param {string} tool @param {Partial<ToolState>} state @returns {ToolState} */
  const tool = (tool, state) => ({ tool, label: tool.toUpperCase(), floor: '1.2.0', update: `https://example.invalid/${tool}`, found: '1.2.0', state: 'fine', ...state });
  /** @param {'task'|'landing'} kind @param {ToolState[]} tools @param {boolean} [changeable] another driver of the kind serves the project */
  const check = (kind, tools, changeable = true) => ({ kind, driver: kind, title: `the ${kind} stand-in`, tools, changeable });
  /** The stop's alert and account. @param {ReturnType<typeof check>[]} stopping */
  const stop = (stopping) => {
    const out = driversStopScreen('Lantern', stopping);
    return [sectionOf(out, 'DISPLAY: drivers stop').trim(), ...sectionOf(out, 'DISPLAY: drivers account').trim().split('\n>\n')];
  };

  it('names both drivers where both stop, each tool as it stands — missing, older with its update instructions, failing with its error — and each put right in turn, or the drivers changed once no build is in flight', () => {
    assert.deepStrictEqual(stop([
      check('task', [tool('ay', { found: null, state: 'missing' }), tool('bee', { found: '1.1.0', state: 'older' })]),
      check('landing', [tool('sea', { found: null, state: 'failing', error: 'exited 3' }), tool('dee', {})]),
    ]), [
      '⚑ Ready to build stopped: the drivers are held up by their tools',
      '> Lantern tracks its tasks through the task stand-in, which needs AY 1.2.0 or newer and BEE 1.2.0 or newer. AY isn\'t installed; BEE is 1.1.0, older than 1.2.0 — its update instructions are at https://example.invalid/bee.',
      '> Lantern lands its work through the landing stand-in, which needs SEA 1.2.0 or newer and DEE 1.2.0 or newer. SEA is installed but fails — exited 3; DEE is here.',
      '> Nothing has been built. Ready to build waits until AY is installed, BEE is updated and SEA is working — or, while no build is in flight, until the drivers are changed from manage on the start menu.',
    ]);
  });

  it('names changing a driver only where another of its kind serves the project: the one that could change, or the wait alone where neither could', () => {
    const waits = (/** @type {boolean} */ task, /** @type {boolean} */ landing) => stop([
      check('task', [tool('ay', { found: null, state: 'missing' })], task),
      check('landing', [tool('bee', { found: '1.1.0', state: 'older' })], landing),
    ]).at(-1);

    assert.deepStrictEqual([waits(false, true), waits(false, false)], [
      '> Nothing has been built. Ready to build waits until AY is installed and BEE is updated — or, while no build is in flight, until the landing driver is changed from manage on the start menu.',
      '> Nothing has been built. Ready to build waits until AY is installed and BEE is updated.',
    ]);
  });

  it('says what one driver lacks by how its tools stand: missing tools, newer ones, or one held up', () => {
    const alert = (/** @type {ToolState[]} */ tools) => stop([check('landing', tools)])[0];

    assert.deepStrictEqual([
      alert([tool('ay', { found: null, state: 'missing' }), tool('bee', { found: null, state: 'missing' })]),
      alert([tool('ay', { found: '1.0.0', state: 'older' })]),
      alert([tool('ay', { found: '1.0.0', state: 'older' }), tool('bee', { found: '1.0.0', state: 'older' })]),
      alert([tool('ay', { found: null, state: 'failing', error: 'exited 3' })]),
      alert([tool('ay', { found: null, state: 'missing' }), tool('bee', { found: '1.0.0', state: 'older' })]),
    ], [
      '⚑ Ready to build stopped: the landing driver is missing tools',
      '⚑ Ready to build stopped: the landing driver needs a newer tool',
      '⚑ Ready to build stopped: the landing driver needs newer tools',
      '⚑ Ready to build stopped: the landing driver is held up by a tool',
      '⚑ Ready to build stopped: the landing driver is held up by its tools',
    ]);
  });
});
