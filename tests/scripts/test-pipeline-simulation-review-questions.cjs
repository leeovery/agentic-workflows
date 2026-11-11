'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase with a question asked in a round,
// parking nothing, as its skill runs it: a feature whose build has closed
// its cut, in auto, round 1 failing on a bug its fix task builds. In round
// 2 a question only the person can answer is raised at the review's place;
// the round passes, and finish holds the unit open until the person, at the
// stop, answers it; then finish goes through (12.13.22). From start this
// work to finish the person is stopped at start this work, the one screen,
// decided and ready to build, finish, and the question the ask rule sent,
// and nowhere else (19.S6). A fix task parked on the person is
// test-pipeline-simulation-review-park.cjs's.
//
// Layer: simulation. World: the named world `worlds.cutClosed`, built once
// per run (pipeline-world.cjs) — a feature through its spec to ready to
// build's pick, its cut one phase, built and closed, its build holding that
// the person was stopped on the way at start this work and the one screen
// alone (19.S6) — a copy per scenario, which replays the engine calls the
// review phase's skill makes, in order, the oracle (pipeline-oracle.cjs)
// auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  Sim, worlds, builtAside, areaRead, failedHashRound, raisedAtReview, answeredAtStop, reviewNext, finished, handoff, gatesAnswered,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

const WU = 'ledger';

describe('pipeline simulation: a question asked in a review round', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed(WU));
  });
  afterEach(() => {
    sim.destroy();
  });

  it('12.13.22: a question raised in round 2, parking nothing, and the round passing: finish holds the unit open until the person answers it at the stop; then finish goes through', async () => {
    const task = failedHashRound(sim, WU);
    builtAside(sim, WU, task, 'src/hash.js');
    sim.run(['review', 'reads', WU, '1-the-work']);
    areaRead(sim, WU);
    await raisedAtReview(sim, WU, 'Should the export check hashes in this work?', leaningCall('The export checks them.', 'The export is left as it is.'));
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger whose entries are checked.'], findings: [] })]);

    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    sim.write(`.leeway/${WU}/build/log.md`, '# The build\n\nPhase 1 built; the review fixed the hash on read in round 1 and passed in round 2.\n');
    sim.run(['checklist', 'done', 'finish', WU, 'build-log-closed']);
    sim.refuses(['checklist', 'close', 'finish', WU], null);

    answeredAtStop(sim, WU);
    assert.deepStrictEqual(finished(sim, WU).next, { kind: 'handoff', skill: 'leeway', args: [] });
    handoff(sim, '/leeway');
    assert.strictEqual(sim.manifest(WU).status, 'completed', 'the unit finishes once nothing waits on the person');
    assert.deepStrictEqual(gatesAnswered(sim), ['finish'], '19.S6: past the build, the person is stopped at finish, and at the question the ask rule sent');
  });
});
