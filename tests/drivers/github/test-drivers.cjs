'use strict';

// ---------------------------------------------------------------------------
// GitHub's driver in the drivers' verbs and at ready to build
// (leeway-engine/scripts/domain/drivers-verbs.cjs, ready-to-build.cjs;
// 22.4): set only where the project's remote is on GitHub, the drivers
// menu offering it there and saying why not elsewhere; its tools — GitHub's
// CLI and its stack extension — read by the check at their floors, missing
// or older; the stack extension missing stopping ready to build at its
// screen and again at its yes (22.S12, O20); and the yes recording it,
// unasked, for a project whose remote is on GitHub (22.S9). The verbs and
// the check over any driver are test-engine-drivers-verbs.cjs's and
// test-engine-ready-to-build-drivers.cjs's.
//
// Layer: verb. World: the ready to build world closed
// (tests/scripts/ready-to-build-world.cjs), copied for each test into a
// folder named `lantern`, its remote on GitHub kept off the network, the
// stand-in gh first on the PATH (tests/scripts/engine-harness.cjs) at its
// floor unless GH_STUB_VERSION says otherwise, GH_STUB_NO_STACK taking its
// stack extension away.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, output, refusedPristine, sectionOf, screenOf, readManifest, readState, git, bareRepo, githubOffline } = require('../../scripts/engine-harness.cjs');
const { UNIT, SESSION, closed, useReadyWorld } = require('../../scripts/ready-to-build-world.cjs');

const ON_GITHUB = 'git@github.com:acme/lantern.git';

const dir = useReadyWorld(closed, 'lantern');

/** @type {Record<string, string>} */
let offline = {};

/** A call's environment: the conversation's, GitHub off the network, `more` over them. @param {Record<string, string>} [more] */
const env = (more = {}) => ({ ...SESSION, ...offline, ...more });

/** The project's remote set to `url`. @param {string} url */
const remote = (url) => git(dir(), ['remote', 'add', 'origin', url]);

/** The project on GitHub's driver, set through manage's verb. */
const onGithub = () => ok(dir(), ['drivers', 'set', 'landing', 'github'], { env: env() });

/** The drivers' menu's rows. */
const rows = () => screenOf(output(dir(), ['render', 'drivers'], { env: env() }), 'MENU: drivers').slice(3, -2);

/** The landing driver's lines on the drivers' menu. */
const landing = () => sectionOf(output(dir(), ['render', 'drivers'], { env: env() }), 'DISPLAY: drivers').trim().split('\n').slice(3);

/** The screen as `more` leaves the tools. @param {Record<string, string>} [more] */
const screen = (more) => output(dir(), ['render', 'ready-to-build', UNIT], { env: env(more) });

/** The yes in auto. */
const yes = () => ok(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env() });

/** The project's drivers setting. */
const drivers = () => JSON.parse(readState(dir(), 'manifest.json')).drivers;

beforeEach(() => { offline = githubOffline(path.dirname(dir())); });

describe('GitHub\'s driver set only on a remote on GitHub (22.4.3, 22.4.4)', () => {
  it('with no remote, the menu says GitHub\'s driver lands through a host the project is not on, offers no row for it, and set refuses it, writing nothing', () => {
    assert.deepStrictEqual([landing(), rows()], [['  · GitHub\'s driver — lands through a host this project\'s remote isn\'t on', '  · the local driver — in use'], []]);
    assert.strictEqual(refusedPristine(dir(), ['drivers', 'set', 'landing', 'github'], { env: env() }).error,
      'drivers set: GitHub\'s driver lands through a host this project\'s remote isn\'t on — the landing drivers that serve this project are local');
  });

  it('with a remote on no host GitHub\'s driver serves, set refuses it alike', () => {
    remote(bareRepo(`${dir()}-elsewhere.git`));

    assert.strictEqual(refusedPristine(dir(), ['drivers', 'set', 'landing', 'github'], { env: env() }).error,
      'drivers set: GitHub\'s driver lands through a host this project\'s remote isn\'t on — the landing drivers that serve this project are local');
  });

  it('with a remote on GitHub, GitHub\'s driver is in use unset and the local driver offered; with the local driver set, the menu offers GitHub\'s back, and set takes it', () => {
    remote(ON_GITHUB);
    assert.deepStrictEqual([landing(), rows()], [['  · GitHub\'s driver — in use', '  · the local driver'], ['1      → Land work through the local driver']]);

    ok(dir(), ['drivers', 'set', 'landing', 'local'], { env: env() });
    assert.deepStrictEqual([landing(), rows()], [['  · GitHub\'s driver', '  · the local driver — in use'], ['1      → Land work through GitHub\'s driver']]);
    assert.deepStrictEqual([onGithub().driver, drivers().landing], ['github', 'github']);
  });
});

describe('GitHub\'s tools in the drivers\' check (22.4.9)', () => {
  beforeEach(() => {
    remote(ON_GITHUB);
    onGithub();
  });

  /** The landing driver's tools as the check reads them. @param {Record<string, string>} [more] */
  const tools = (more) => ok(dir(), ['drivers', 'check'], { env: env(more) }).drivers[1].tools;

  it('reads GitHub\'s CLI and its stack extension at their floors, each with its words and where its update instructions live', () => {
    assert.deepStrictEqual(tools(), [
      { tool: 'gh', label: 'GitHub\'s CLI', floor: '2.30.0', update: 'https://cli.github.com', found: '2.30.0', state: 'fine' },
      { tool: 'gh-stack', label: 'GitHub\'s stack extension', floor: '0.1.0', update: 'https://github.com/github/gh-stack', found: '0.1.0', state: 'fine' },
    ]);
  });

  it('reads the stack extension missing, and GitHub\'s CLI older than its floor', () => {
    assert.deepStrictEqual([...tools({ GH_STUB_NO_STACK: '1' }), ...tools({ GH_STUB_VERSION: '2.29.9' })].map(({ found, state }) => [found, state]), [['2.30.0', 'fine'], [null, 'missing'], ['2.29.9', 'older'], ['0.1.0', 'fine']]);
  });
});

describe('GitHub\'s driver at ready to build (22.4.5–22.4.9)', () => {
  beforeEach(() => remote(ON_GITHUB));

  it('with every tool at its floor, the screen draws, and its yes begins the build', () => {
    onGithub();

    assert.ok(sectionOf(screen(), 'MENU: ready to build').includes('a/auto'));
    assert.deepStrictEqual(yes().position, 'auto');
  });

  it('22.S12, 7.S14, 22.4.8: the stack extension missing — the stop drawn in the screen\'s place, saying what is missing and no install command', () => {
    onGithub();
    const out = screen({ GH_STUB_NO_STACK: '1' });

    assert.strictEqual(sectionOf(out, 'DISPLAY: drivers stop').trim(), '⚑ Ready to build stopped: the landing driver is missing a tool');
    assert.strictEqual(sectionOf(out, 'DISPLAY: drivers account').trim(), [
      '> Lantern lands its work through GitHub\'s driver, which needs GitHub\'s CLI 2.30.0 or newer and GitHub\'s stack extension 0.1.0 or newer. GitHub\'s CLI is here; GitHub\'s stack extension isn\'t installed.',
      '>',
      '> Nothing has been built. Ready to build waits until GitHub\'s stack extension is installed — or, while no build is in flight, until the landing driver is changed from manage on the start menu.',
    ].join('\n'));
  });

  it('22.4.5, O20: the stack extension gone while the screen waited stops the yes, refused with the stop, writing nothing', () => {
    onGithub();
    assert.ok(sectionOf(screen(), 'MENU: ready to build').includes('a/auto'));

    assert.strictEqual(refusedPristine(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env({ GH_STUB_NO_STACK: '1' }) }).error,
      'ready-to-build yes: Ready to build stopped: the landing driver is missing a tool — Lantern lands its work through GitHub\'s driver, which needs GitHub\'s CLI 2.30.0 or newer and GitHub\'s stack extension 0.1.0 or newer. GitHub\'s CLI is here; GitHub\'s stack extension isn\'t installed. Nothing has been built. Ready to build waits until GitHub\'s stack extension is installed — or, while no build is in flight, until the landing driver is changed from manage on the start menu.');
    assert.strictEqual(readManifest(dir(), UNIT).build, undefined);
  });

  it('22.S9: a project whose remote is on GitHub records GitHub\'s driver at the yes, unasked', () => {
    yes();

    assert.strictEqual(drivers().landing, 'github');
  });
});
