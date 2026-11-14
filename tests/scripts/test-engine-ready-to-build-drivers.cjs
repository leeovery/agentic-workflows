'use strict';

// ---------------------------------------------------------------------------
// Ready to build's drivers' check (leeway-engine/scripts/domain/
// ready-to-build.cjs over domain/drivers-verbs.cjs): the drivers checked
// against the tools they need at the screen, the stop drawn in its place
// where a tool is missing or older than its floor — what is missing, or the
// version found, the one needed and where its update instructions live,
// never an install command (22.4.5–22.4.9, 7.2.10) — and again at the yes,
// so a tool gone while the screen waited still stops the build (O20); and
// the yes writing each driver's setting the project lacks, as the first
// verb needing it would (22.4.3, F7). The stop's every wording is
// test-engine-drivers-verbs.cjs's; the defaults resolved from a remote
// test-engine-drivers-remote.cjs's.
//
// Layer: verb. World: the ready to build world closed
// (ready-to-build-world.cjs), copied for each test into a folder named
// `lantern`, the tools the check reads stood in for (drivers-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { ok, output, refusedPristine, sectionOf, readManifest, readState, git, bareRepo, githubOffline, killedAt, stateGit } = require('./engine-harness.cjs');
const { UNIT, SESSION, closed, useReadyWorld } = require('./ready-to-build-world.cjs');
const { toolsEnv } = require('./drivers-world.cjs');

const dir = useReadyWorld(closed, 'lantern');

/** A call's environment: the conversation's, the tools stood in for, `more` over them. @param {Record<string, string>} [more] */
const env = (more = {}) => ({ ...SESSION, ...toolsEnv(more) });

/** The project's drivers setting. */
const drivers = () => JSON.parse(readState(dir(), 'manifest.json')).drivers;

/** The project on GitHub's driver, set through manage's verb. */
const onGithub = () => ok(dir(), ['drivers', 'set', 'landing', 'github'], { env: env() });

/** The screen as `more` leaves the tools. @param {Record<string, string>} [more] */
const screen = (more) => output(dir(), ['render', 'ready-to-build', UNIT], { env: env(more) });

/** The yes in auto, as `more` leaves the tools. @param {Record<string, string>} [more] */
const yes = (more) => ok(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env(more) });

describe('the drivers checked at ready to build (22.4.5–22.4.9)', () => {
  it('a project on GitHub\'s driver with every tool at its floor draws the screen, asking nothing of the drivers, and its yes begins the build', () => {
    onGithub();

    assert.ok(sectionOf(screen(), 'MENU: ready to build').includes('a/auto'));
    assert.deepStrictEqual(yes().position, 'auto');
  });

  it('22.S12, 7.S14, 22.4.8: the stack extension missing — the stop drawn in the screen\'s place, saying what is missing and no install command, with no gate', () => {
    onGithub();
    const out = screen({ GH_STUB_NO_STACK: '1' });

    assert.deepStrictEqual([...out.matchAll(/^=== (.+?) \(/gm)].map((m) => m[1]), ['DISPLAY: drivers stop', 'DISPLAY: drivers account']);
    assert.strictEqual(sectionOf(out, 'DISPLAY: drivers stop').trim(), '⚑ Ready to build stopped: the landing driver is missing a tool');
    assert.strictEqual(sectionOf(out, 'DISPLAY: drivers account').trim(), [
      '> Lantern lands its work through GitHub\'s driver, which needs GitHub\'s CLI 2.30.0 or newer and GitHub\'s stack extension 0.1.0 or newer. GitHub\'s CLI is here; GitHub\'s stack extension isn\'t installed.',
      '>',
      '> Nothing has been built. Ready to build waits until GitHub\'s stack extension is installed, or until the landing driver is changed from manage on the start menu.',
    ].join('\n'));
  });

  it('22.S34, 22.4.9: a tool older than its floor stops it, naming the version found, the one needed and where its update instructions live', () => {
    const out = screen({ TICK_STUB_VERSION: '0.2.9' });

    assert.strictEqual(sectionOf(out, 'DISPLAY: drivers stop').trim(), '⚑ Ready to build stopped: the task driver needs a newer tool');
    assert.strictEqual(sectionOf(out, 'DISPLAY: drivers account').split('\n')[0],
      '> Lantern tracks its tasks through Tick\'s driver, which needs Tick 0.3.0 or newer. Tick is 0.2.9, older than 0.3.0 — its update instructions are at https://github.com/leeovery/tick.');
  });

  it('22.4.5, O20: a tool gone while the screen waited stops the yes, refused with the stop, writing nothing', () => {
    onGithub();
    assert.ok(sectionOf(screen(), 'MENU: ready to build').includes('a/auto'));

    assert.strictEqual(refusedPristine(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env({ GH_STUB_NO_STACK: '1' }) }).error,
      'ready-to-build yes: Ready to build stopped: the landing driver is missing a tool — Lantern lands its work through GitHub\'s driver, which needs GitHub\'s CLI 2.30.0 or newer and GitHub\'s stack extension 0.1.0 or newer. GitHub\'s CLI is here; GitHub\'s stack extension isn\'t installed. Nothing has been built. Ready to build waits until GitHub\'s stack extension is installed, or until the landing driver is changed from manage on the start menu.');
    assert.strictEqual(readManifest(dir(), UNIT).build, undefined);
  });
});

describe('the yes writes both drivers\' settings (22.4.3, F7)', () => {
  it('22.S10, 7.S1: a project with no remote records Tick\'s driver and the local driver, unasked', () => {
    assert.strictEqual(drivers(), undefined);
    yes();

    assert.deepStrictEqual(drivers(), { task: 'tick', landing: 'local' });
  });

  it('22.S25, 7.S18: a project whose remote is not on GitHub records the local driver', () => {
    git(dir(), ['remote', 'add', 'origin', bareRepo(`${dir()}-elsewhere.git`)]);
    yes();

    assert.deepStrictEqual(drivers(), { task: 'tick', landing: 'local' });
  });

  it('22.S9: a project whose remote is on GitHub records GitHub\'s driver, unasked', () => {
    git(dir(), ['remote', 'add', 'origin', 'git@github.com:acme/lantern.git']);
    yes(githubOffline(dir()));

    assert.deepStrictEqual(drivers(), { task: 'tick', landing: 'github' });
  });

  it('keeps a setting the project holds, writing only the one it lacks', () => {
    onGithub();
    yes();

    assert.deepStrictEqual(drivers(), { landing: 'github', task: 'tick' });
  });

  it('killed once a setting is written, the yes run again begins the build, its commit carrying both and nothing left uncommitted', () => {
    killedAt({ method: 'renameSync', file: '.leeway/manifest.json', when: 'after' }, dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env() });
    assert.deepStrictEqual([drivers(), readManifest(dir(), UNIT).build], [{ task: 'tick' }, undefined]);

    yes();
    assert.deepStrictEqual([drivers(), readManifest(dir(), UNIT).build], [{ task: 'tick', landing: 'local' }, { position: 'auto' }]);
    assert.strictEqual(stateGit(dir(), ['status', '--porcelain']), '');
  });
});
