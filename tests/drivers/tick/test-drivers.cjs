'use strict';

// ---------------------------------------------------------------------------
// Tick's driver in the drivers' check and at ready to build
// (leeway-engine/scripts/domain/drivers-verbs.cjs, ready-to-build.cjs;
// 22.4.9): Tick read by the check at the version it answers; older than its
// floor, ready to build stopped naming the version found, the one needed and
// where its update instructions live (22.S34); and a Tick whose version does
// not read as Tick prints it, failing, ready to build stopped with its error
// at the screen and again at the yes — each stop naming no change of driver,
// no other task driver shipping to serve the project in its place. The check
// over any driver is test-engine-drivers-verbs.cjs's and
// test-engine-ready-to-build-drivers.cjs's.
//
// Layer: verb. World: the ready to build world closed
// (tests/scripts/ready-to-build-world.cjs), copied for each test into a
// folder named `lantern`, the stand-in tick first on the PATH
// (tests/scripts/engine-harness.cjs), answering its version at
// TICK_STUB_VERSION, or TICK_STUB_SAID in its place.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, output, refusedPristine, sectionOf, readManifest } = require('../../scripts/engine-harness.cjs');
const { UNIT, SESSION, closed, useReadyWorld } = require('../../scripts/ready-to-build-world.cjs');

const dir = useReadyWorld(closed, 'lantern');

/** A call's environment: the conversation's, `more` over it. @param {Record<string, string>} [more] */
const env = (more = {}) => ({ ...SESSION, ...more });

/** The screen as `more` leaves Tick. @param {Record<string, string>} more */
const screen = (more) => output(dir(), ['render', 'ready-to-build', UNIT], { env: env(more) });

/** The stop's alert, then its account's lines. @param {string} out */
const stop = (out) => [sectionOf(out, 'DISPLAY: drivers stop').trim(), ...sectionOf(out, 'DISPLAY: drivers account').trim().split('\n>\n')];

const FAILS = 'Tick v0.3.0';

describe('Tick in the drivers\' check (22.4.9)', () => {
  it('reads Tick at the version it answers, with its words and where its update instructions live', () => {
    assert.deepStrictEqual(ok(dir(), ['drivers', 'check'], { env: env({ TICK_STUB_VERSION: '0.3.2' }) }).drivers[0], {
      kind: 'task', driver: 'tick', title: 'Tick\'s driver', set: false,
      tools: [{ tool: 'tick', label: 'Tick', floor: '0.3.0', update: 'https://github.com/leeovery/tick', found: '0.3.2', state: 'fine' }],
    });
  });

  it('reads a Tick whose version does not read as Tick prints it as failing, its answer kept', () => {
    const [tool] = ok(dir(), ['drivers', 'check'], { env: env({ TICK_STUB_SAID: FAILS }) }).drivers[0].tools;

    assert.deepStrictEqual([tool.found, tool.state, tool.error], [null, 'failing', `tick version: ${FAILS}`]);
  });
});

describe('Tick at ready to build (22.4.5–22.4.9)', () => {
  it('22.S34: Tick older than its floor stops it, naming the version found, the one needed and where its update instructions live', () => {
    assert.deepStrictEqual(stop(screen({ TICK_STUB_VERSION: '0.2.9' })), [
      '⚑ Ready to build stopped: the task driver needs a newer tool',
      '> Lantern tracks its tasks through Tick\'s driver, which needs Tick 0.3.0 or newer. Tick is 0.2.9, older than 0.3.0 — its update instructions are at https://github.com/leeovery/tick.',
      '> Nothing has been built. Ready to build waits until Tick is updated.',
    ]);
  });

  it('a Tick failing stops the screen with its error, and the yes, writing nothing', () => {
    assert.deepStrictEqual(stop(screen({ TICK_STUB_SAID: FAILS })), [
      '⚑ Ready to build stopped: the task driver is held up by a tool',
      `> Lantern tracks its tasks through Tick's driver, which needs Tick 0.3.0 or newer. Tick is installed but fails — tick version: ${FAILS}.`,
      '> Nothing has been built. Ready to build waits until Tick is working.',
    ]);

    assert.strictEqual(refusedPristine(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: env({ TICK_STUB_SAID: FAILS }) }).error,
      `ready-to-build yes: Ready to build stopped: the task driver is held up by a tool — Lantern tracks its tasks through Tick's driver, which needs Tick 0.3.0 or newer. Tick is installed but fails — tick version: ${FAILS}. Nothing has been built. Ready to build waits until Tick is working.`);
    assert.strictEqual(readManifest(dir(), UNIT).build, undefined);
  });
});
