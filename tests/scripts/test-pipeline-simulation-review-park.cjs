'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase with a fix task parked on the
// person, as its skill runs it: a feature whose build has closed its cut,
// in auto, round 1 failing on a bug its fix task builds. The fix task's
// builder meets a question only the person can answer, raised at the
// review's place, parking the task; across a /clear, the review still
// waits on the fix, and a compaction carries on in the review phase's
// skill. Nothing else can go on, so the stop is drawn, the person,
// ready, answers through its raise, and a new builder builds the task
// again and lands it (12.13.7, 24.2.2).
//
// Layer: simulation. World: the named world `worlds.cutClosed`, built once
// per run (pipeline-world.cjs) — a feature through its spec to ready to
// build's pick, its cut one phase, built and closed — a copy per scenario,
// which replays the engine calls the review phase's skill makes, in order,
// the oracle (pipeline-oracle.cjs) auditing the whole state after every
// mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  Sim, worlds, CUT_CLOSED_UNIT, failedHashRound, raisedAtReview, answeredAtStop, reviewNext, buildLoop, carryOn,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

const WU = CUT_CLOSED_UNIT;
const ASKS = 'Should a read check its hash?';

describe('pipeline simulation: a fix task parked on the person in the review phase', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  it('12.13.7, 24.2.2: a fix task parked on a question at the review\'s place, across a /clear: the review waits on the fix and carries on in its skill, the stop is drawn, the person answers through its raise, and a new builder builds the task again and lands it', async () => {
    const task = failedHashRound(sim, WU);
    sim.run(['task', 'start', WU, task]);
    loop.brief(['builder', WU, task]);
    loop.isolated(task);
    await raisedAtReview(sim, WU, ASKS, leaningCall('Reads check the hash.', 'Reads trust the ledger.'), task);
    sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
    sim.handOver();

    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    assert.strictEqual(carryOn(sim).skill, path.join(sim.dir, '.claude/skills/leeway-review-process/SKILL.md'), 'a compaction there carries on in the review phase\'s skill');

    answeredAtStop(sim, WU);
    loop.brief(['builder', WU, task]);
    const tree = loop.isolated(task, `agent-${task}-second`);
    loop.committed(tree, task, { 'src/hash.js': 'export const hash = 1;\n' }, `fix(${WU}): a read checks its hash`);
    loop.pairRound(task);
    loop.accounted(task, ['Passed.']);
    loop.landedTask(task);
    assert.strictEqual(reviewNext(sim, WU).move, 'reads', 'the fix task done, the next round\'s reads are named');
  });
});
