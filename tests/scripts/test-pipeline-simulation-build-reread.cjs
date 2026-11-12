'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build with a task held open on its blind
// question changed again while its pair re-reads it (12.1.4, 16.17.6), the
// decision point forced to draw blind: the task held once its pair passes
// it, something added lifting the hold, its builder building that and its
// pair briefed for round 2, then something more added before round 2 is
// reported whole. A change is read only by a round briefed after it, so the
// question holds the task through none of it: in step, the other task never
// starts while the held task's pair re-reads it; in auto, the task alone
// left, the build goes on with it rather than stopping on the question. A
// task held and lifted once is test-pipeline-simulation-build-held.cjs's.
//
// Layer: simulation. World: the named world `worlds.buildBegun`, built once
// per run (pipeline-world.cjs) — a feature through its spec to ready to
// build's pick in auto, its one phase written and started; a copy per
// scenario, which replays the engine calls
// the build's prose makes, in order, the oracle (pipeline-oracle.cjs)
// auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const {
  Sim, worlds, SPEC_TO_BUILD_UNIT, landed, placeIn, buildLoop, wentAheadBlind, PASSED_REPORT,
} = require('./pipeline-world.cjs');

const WU = SPEC_TO_BUILD_UNIT;
const CALL = Object.freeze({ question: 'Should a show print the entry\'s id?', lean: 'A show prints the id.', other: 'A show hides the id.' });

describe('pipeline simulation: the build with a held task changed again while its pair re-reads it', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(worlds.buildBegun);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  /** Something added to 1.1 by the orchestrator. @param {string} text */
  const added = (text) => sim.run(['task', 'add', WU, '1.1', '--file', sim.write(`.leeway/.cache/${WU}/build/addition.md`, `${text}\n`), '--by', 'orchestrator']);

  /**
   * 1.1's builder's call going ahead while Q1 waits, its pair passing it,
   * so it is held; something added lifting the hold, its builder building
   * it, round 2's pair briefed and `reported` of them passing it; then
   * something more added.
   * @param {import('node:test').TestContext} t @param {number} reported
   */
  async function changedAgainWhileReread(t, reported) {
    sim.run(['task', 'start', WU, '1.1']);
    loop.brief(['builder', WU, '1.1']);
    const tree = loop.isolated('1.1');
    await wentAheadBlind(t, sim, WU, '1.1', CALL);
    loop.committed(tree, '1.1', { 'src/show.js': 'export const show = 1;\n' });
    loop.pairRound('1.1');
    added('An entry is shown by its id.');
    loop.brief(['builder', WU, '1.1']);
    loop.committed(tree, '1.1', { 'src/show.js': 'export const show = 2;\n' }, `feat(${WU}): an entry shown by its id`);
    const briefs = ['a', 'b'].map((letter) => loop.brief(['reviewer', WU, '1.1', '--letter', letter]));
    for (const brief of briefs.slice(0, reported)) landed(placeIn(sim, brief, 'Where your report goes'), PASSED_REPORT);
    added('An entry shows its hash too.');
  }

  it('12.1.4, 16.17.6: in step, the other task never starts while the held task\'s pair re-reads it after a second change', async (t) => {
    sim.run(['workunit', 'position', WU, 'step']);

    await changedAgainWhileReread(t, 0);

    sim.refuses(['task', 'start', WU, '1.2'], /task 1\.1 is in flight or at its gate/);
  });

  it('12.1.4, 16.17.6: in auto, the task alone left, the build goes on with it after a second change while round 2 is half reported, never stopping on its question', async (t) => {
    sim.run(['task', 'close', WU, '1.2', '--reason', 'Folded into 1.1.']);

    await changedAgainWhileReread(t, 1);

    sim.refuses(['render', 'build-stop', WU], /build goes on with task 1\.1, which no question parks/);
  });
});
