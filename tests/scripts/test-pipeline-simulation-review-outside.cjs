'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase with a task written beyond its
// findings' fixes, as its skill runs it: a feature whose build has closed
// its cut, in auto, a fix task's builder finding a wrong result its task
// does not hold, which lands as a task of the fix phase through the first
// door outside the plan (outside-the-plan.md). The review's standing reads
// every task of the fix phase from the tracker: round 1 failing, once the
// round's own fix is done it still waits on the other, the next round's
// reads refused (14.6.1). Finish held open
// over one across a /clear is test-pipeline-simulation-review-outside-finish.cjs's.
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
const {
  Sim, worlds, writeTasks, builtAside, failedHashRound, reviewNext,
} = require('./pipeline-world.cjs');

const WU = 'ledger';

describe('pipeline simulation: a task beyond the review\'s findings', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed(WU));
  });
  afterEach(() => {
    sim.destroy();
  });

  /** The wrong result a fix task's builder finds beyond its task, written as a task of the fix phase of `fix`: the task. @param {string} fix */
  const beyond = (fix) => writeTasks(sim, WU, Number(fix.split('.')[0]), [{ title: 'Check the hash on write', type: 'fix', scenarios: ['an entry written'], reference: '§1' }])[0];

  it('14.6.1: round 1 failing, once its own fix is done the review waits on the task beyond it, the next round\'s reads refused', () => {
    const fix = failedHashRound(sim, WU);
    beyond(fix);
    builtAside(sim, WU, fix, 'src/hash.js');

    assert.strictEqual(reviewNext(sim, WU).move, 'fixes', 'the round\'s own fix done, the review waits on the other');
    sim.refuses(['review', 'reads', WU, '1-the-work'], null);
  });
});
