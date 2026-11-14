'use strict';

// ---------------------------------------------------------------------------
// The drivers' verbs and screens (leeway-engine/scripts/domain/
// drivers-verbs.cjs, the screens domain/projections/drivers.cjs; 22.4):
// `drivers check`, each kind's driver as things stand and how each tool it
// needs stands, writing nothing; `drivers set`, the setting for one kind
// written and committed alone, refused for a driver no shipped one answers
// to and while a build is in flight in any unit (O5), and finished by a run
// again after a kill; `render drivers`, manage's d/drivers (22.4.4,
// 22.5.8); `render drivers-stop`, the stop at ready to build in every
// wording its tools can give it, drawn from the drivers' declarations alone
// (7.2.13). Where ready to build draws the stop and refuses its yes is
// test-engine-ready-to-build-drivers.cjs's; manage's d row
// test-engine-manage.cjs's.
//
// Layer: verb. World: this file's own, built once and copied for each test
// into a folder named `lantern` — a feature whose build is under way, a
// quick-fix whose fixes have begun, and a feature complete — the tools the
// check reads stood in for (drivers-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, output, refusedPristine, screenOf, sectionOf, commitAll, fixtureFrom, cleanupFixture, killedAt, treeSnapshot, head, lastMessage, touched, statePath, stateGit } = require('./engine-harness.cjs');
const { createManifest, readState } = require('./discovery-test-utils.cjs');
const { toolsEnv } = require('./drivers-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { driversStopScreen } = require(path.join(SCRIPTS, 'domain/projections/drivers.cjs'));

const SESSION = 'drivers-session';
const BUILDING = 'lazy-resume-on-attach';
const FIXING = 'typo-in-the-banner';
const COMPLETE = 'enter-attaches-from-preview';

const world = fixtureFrom('leeway-drivers-', (dir) => {
  createManifest(dir, BUILDING, { build: { position: 'auto' } });
  createManifest(dir, FIXING, { work_type: 'quick-fix', fixes: {} });
  createManifest(dir, COMPLETE, { status: 'completed', build: { position: 'auto' } });
  commitAll(dir, 'the units the drivers verbs tell apart');
});

/** A call's environment: the conversation's, the tools stood in for, `more` over them. @param {Record<string, string>} [more] */
const env = (more = {}) => ({ CLAUDE_CODE_SESSION_ID: SESSION, ...toolsEnv(more) });

/** The project's drivers setting. @param {string} dir */
const drivers = (dir) => JSON.parse(readState(dir, 'manifest.json')).drivers;

/** A unit's build and fixes taken off, so no build is in flight. @param {string} dir @param {string} unit */
function finished(dir, unit) {
  createManifest(dir, unit, { status: 'completed' });
  commitAll(dir, `${unit} finished`);
}

describe('the drivers\' verbs (22.4)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = world(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-drivers-')), 'lantern'));
    finished(dir, BUILDING);
    finished(dir, FIXING);
  });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('check: each kind\'s driver as things stand — the task driver its kind\'s default, the landing driver the one set — and each tool with its floor and the version found, writing nothing', () => {
    ok(dir, ['drivers', 'set', 'landing', 'github'], { env: env() });
    const before = { tree: treeSnapshot(dir), head: head(dir) };

    assert.deepStrictEqual(ok(dir, ['drivers', 'check'], { env: env({ TICK_STUB_VERSION: '0.3.2' }) }), {
      ok: true,
      drivers: [
        { kind: 'task', driver: 'tick', title: 'Tick\'s driver', set: false, tools: [{ tool: 'tick', label: 'Tick', floor: '0.3.0', update: 'https://github.com/leeovery/tick', found: '0.3.2', state: 'fine' }] },
        {
          kind: 'landing', driver: 'github', title: 'GitHub\'s driver', set: true, tools: [
            { tool: 'gh', label: 'GitHub\'s CLI', floor: '2.30.0', update: 'https://cli.github.com', found: '2.30.0', state: 'fine' },
            { tool: 'gh-stack', label: 'GitHub\'s stack extension', floor: '0.1.0', update: 'https://github.com/github/gh-stack', found: '0.1.0', state: 'fine' },
          ],
        },
      ],
      stopped: false,
    });
    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before);
  });

  it('check: stopped where a tool the driver in use needs is missing; the local driver, needing nothing, never stops it', () => {
    const missing = env({ GH_STUB_NO_STACK: '1' });
    assert.deepStrictEqual([ok(dir, ['drivers', 'check'], { env: missing }).stopped, ok(dir, ['drivers', 'check'], { env: missing }).drivers[1].tools], [false, []]);

    ok(dir, ['drivers', 'set', 'landing', 'github'], { env: env() });
    const { drivers: [, landing], stopped } = ok(dir, ['drivers', 'check'], { env: missing });
    assert.deepStrictEqual([stopped, landing.tools.map(({ found, state }) => ({ found, state }))], [true, [{ found: '2.30.0', state: 'fine' }, { found: null, state: 'missing' }]]);
  });

  it('22.S11, 7.S18: set writes the kind\'s setting, the other kept, committed alone, and draws the drivers again; run again, it commits nothing', () => {
    ok(dir, ['drivers', 'set', 'task', 'tick'], { env: env() });
    const answer = ok(dir, ['drivers', 'set', 'landing', 'github'], { env: env() });

    assert.deepStrictEqual(answer, { ok: true, kind: 'landing', driver: 'github', title: 'GitHub\'s driver', was: null, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'engine', argv: ['render', 'drivers'] } });
    assert.deepStrictEqual([drivers(dir), lastMessage(dir), touched(statePath(dir), 'HEAD')], [{ task: 'tick', landing: 'github' }, 'drivers: the landing driver is github', ['M\tmanifest.json']]);

    const back = ok(dir, ['drivers', 'set', 'landing', 'local'], { env: env() });
    const again = ok(dir, ['drivers', 'set', 'landing', 'local'], { env: env() });
    assert.deepStrictEqual([back.was, again.was, again.committed, drivers(dir).landing], ['github', 'local', null, 'local']);
  });

  it('set killed once its setting is written: run again, it commits what the kill left', () => {
    killedAt({ method: 'renameSync', file: '.leeway/manifest.json', when: 'after' }, dir, ['drivers', 'set', 'landing', 'github'], { env: env() });
    assert.notStrictEqual(stateGit(dir, ['status', '--porcelain']), '');

    const answer = ok(dir, ['drivers', 'set', 'landing', 'github'], { env: env() });
    assert.deepStrictEqual([answer.was, answer.committed === null, stateGit(dir, ['status', '--porcelain']), lastMessage(dir)], ['github', false, '', 'drivers: the landing driver is github']);
  });

  it('set refuses a name no driver of the kind ships, naming those that do, and a kind or arguments of another shape, writing nothing', () => {
    const refused = (/** @type {string[]} */ args) => refusedPristine(dir, ['drivers', ...args], { env: env() }).error;

    assert.strictEqual(refused(['set', 'task', 'gamma']), 'drivers set: no task driver "gamma" is installed — the task drivers are tick');
    assert.strictEqual(refused(['set', 'tracker', 'tick']), 'drivers set: there is no kind of driver "tracker" — the kinds are task, landing');
    for (const args of [['set', 'task'], ['set', 'task', 'tick', '--force'], ['check', 'now'], ['adopt'], []]) {
      assert.strictEqual(refused(args), 'Usage: engine drivers check | engine drivers set <task|landing> <name>', args.join(' '));
    }
  });

  it('render drivers-stop draws the stop where a tool stops ready to build, and is refused where nothing does', () => {
    assert.strictEqual(refusedPristine(dir, ['render', 'drivers-stop'], { env: env() }).error, 'render drivers-stop: every tool the drivers need is here — nothing stops ready to build');

    assert.strictEqual(sectionOf(output(dir, ['render', 'drivers-stop'], { env: env({ TICK_STUB_VERSION: '0.2.9' }) }), 'DISPLAY: drivers stop').trim(), '⚑ Ready to build stopped: the task driver needs a newer tool');
  });
});

describe('set while a build is in flight (O5, 22.4.3)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(dir));

  it('refuses, naming each unit whose build is in flight — one whose build has begun, a quick-fix whose fixes have — and a complete unit\'s build holds nothing', () => {
    assert.strictEqual(refusedPristine(dir, ['drivers', 'set', 'landing', 'github'], { env: env() }).error,
      `drivers set: a build is in flight in ${BUILDING} and ${FIXING}, and a build never changes driver under it — change the landing driver once each finishes`);

    finished(dir, FIXING);
    assert.strictEqual(refusedPristine(dir, ['drivers', 'set', 'task', 'tick'], { env: env() }).error,
      `drivers set: a build is in flight in ${BUILDING}, and a build never changes driver under it — change the task driver once it finishes`);
    finished(dir, BUILDING);
    assert.strictEqual(ok(dir, ['drivers', 'set', 'task', 'tick'], { env: env() }).driver, 'tick');
  });
});

describe('the drivers menu (22.4.4, 22.5.8)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = world(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-drivers-')), 'lantern'));
    finished(dir, BUILDING);
    finished(dir, FIXING);
  });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('shows each kind\'s drivers that ship, the one in use marked, a numbered row for each other leading to set, and back to manage', () => {
    const out = output(dir, ['render', 'drivers'], { env: env() });
    const shown = JSON.parse(fs.readFileSync(path.join(/** @type {string} */ (process.env.LEEWAY_CONFIG_DIR), 'conversations', SESSION, SHOWN), 'utf8'));

    assert.deepStrictEqual(sectionOf(out, 'DISPLAY: drivers').trim().split('\n'), [
      'THE TASK DRIVER',
      '  · Tick\'s driver — in use',
      'THE LANDING DRIVER',
      '  · GitHub\'s driver',
      '  · the local driver — in use',
    ]);
    assert.deepStrictEqual(screenOf(out, 'MENU: drivers'), [
      '· · · · · · · · · · · ·',
      '◆ Which driver would you like to use?',
      '',
      '1      → Land work through GitHub\'s driver',
      'h/help → What this menu is for, row by row',
      'b/back → Back to manage',
    ]);
    assert.deepStrictEqual(Object.fromEntries(shown.options.map((/** @type {{key: string, next: unknown}} */ { key, next }) => [key, next])), {
      1: { kind: 'engine', argv: ['drivers', 'set', 'landing', 'github'] },
      h: { kind: 'engine', argv: ['render', 'help', 'drivers'] },
      b: { kind: 'engine', argv: ['render', 'manage'] },
    });
  });

  it('marks the driver a setting names in use, once set, and offers the other', () => {
    ok(dir, ['drivers', 'set', 'landing', 'github'], { env: env() });

    assert.deepStrictEqual(screenOf(output(dir, ['render', 'drivers'], { env: env() }), 'MENU: drivers')[3], '1      → Land work through the local driver');
  });
});

describe('the stop\'s words (22.4.7–22.4.9, 7.2.13)', () => {
  /** @param {string} tool @param {Partial<import('../../skills/leeway-engine/scripts/domain/drivers.cjs').ToolState>} state */
  const tool = (tool, state) => /** @type {import('../../skills/leeway-engine/scripts/domain/drivers.cjs').ToolState} */ ({ tool, label: tool.toUpperCase(), floor: '1.2.0', update: `https://example.invalid/${tool}`, found: '1.2.0', state: 'fine', ...state });
  /** @param {'task'|'landing'} kind @param {ReturnType<typeof tool>[]} tools */
  const check = (kind, tools) => ({ kind, driver: kind, title: `the ${kind} stand-in`, tools });
  /** The stop's alert and account. @param {ReturnType<typeof check>[]} stopping */
  const stop = (stopping) => {
    const out = driversStopScreen('Lantern', stopping);
    return [sectionOf(out, 'DISPLAY: drivers stop').trim(), ...sectionOf(out, 'DISPLAY: drivers account').trim().split('\n>\n')];
  };

  it('names both drivers where both stop, each tool as it stands — missing, older with its update instructions, failing with its error — and each put right in turn', () => {
    assert.deepStrictEqual(stop([
      check('task', [tool('ay', { found: null, state: 'missing' }), tool('bee', { found: '1.1.0', state: 'older' })]),
      check('landing', [tool('sea', { found: null, state: 'failing', error: 'exited 3' }), tool('dee', {})]),
    ]), [
      '⚑ Ready to build stopped: the drivers are held up by their tools',
      '> Lantern tracks its tasks through the task stand-in, which needs AY 1.2.0 or newer and BEE 1.2.0 or newer. AY isn\'t installed; BEE is 1.1.0, older than 1.2.0 — its update instructions are at https://example.invalid/bee.',
      '> Lantern lands its work through the landing stand-in, which needs SEA 1.2.0 or newer and DEE 1.2.0 or newer. SEA is installed but fails — exited 3; DEE is here.',
      '> Nothing has been built. Ready to build waits until AY is installed, BEE is updated and SEA is working, or until the drivers are changed from manage on the start menu.',
    ]);
  });

  it('says what one driver lacks by how its tools stand: missing tools, newer ones, or one held up', () => {
    const alert = (/** @type {ReturnType<typeof tool>[]} */ tools) => stop([check('landing', tools)])[0];

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
