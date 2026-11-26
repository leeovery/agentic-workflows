'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase with a task written beyond its
// findings' fixes, as its skill runs it: a feature whose build has closed
// its cut, in auto, a fix task's builder finding a wrong result its task
// does not hold, which lands as a task of the fix phase through the first
// door outside the plan (outside-the-plan.md). The review's standing reads
// every task of the fix phase from the tracker: round 1 failing, once the
// round's own fix is done it still waits on the other, the next round's
// reads refused (14.6.1). And something small the person asks for while
// round 1's readers read, before any fix phase is written: the one-line
// task refused into a phase not written, naming the way on, then made in
// the fix phase the entry names once written, built and landed, and finish
// landing it; and the same asked as a Comment at finish, the review
// passed, the entry naming the fix phase after it. Finish held open
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
const { git } = require('./engine-harness.cjs');
const {
  Sim, worlds, CUT_CLOSED_UNIT, writeTasks, builtAside, failedHashRound, reviewNext, buildLoop, sectionRead, testsRead, finished, finishClosed, typeAtGate,
} = require('./pipeline-world.cjs');

const WU = CUT_CLOSED_UNIT;

describe('pipeline simulation: a task beyond the review\'s findings', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed);
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

  /**
   * The one-line task a request makes, in the fix phase the entry names:
   * refused while that phase is not written, naming the way on, then
   * written, made, built and landed. Answers the phase.
   */
  function requestBuilt() {
    const { fixPhase: phase } = reviewNext(sim, WU);
    const create = ['task', 'create', WU, String(phase), '--title', 'Make the close button teal', '--type', 'feat', '--why', 'one word, nothing for a reviewer to read'];
    sim.refuses(create, new RegExp(`^phase ${phase} of ${WU} is not written — write it first: engine task phase ${WU} ${phase} --title <title>$`));
    sim.run(['task', 'phase', WU, String(phase), '--title', 'The review\'s fixes']);
    const { task } = sim.run(create);
    sim.run(['task', 'start', WU, task]);
    const loop = buildLoop(sim, WU);
    const own = sim.run(['task', 'worktree', WU, task]).worktree;
    loop.committed(own, task, { 'src/close.css': '.close { color: teal; }\n' }, `feat(${WU}): make the close button teal`);
    loop.landedTask(task);
    return phase;
  }

  it('a request at any point: something small asked for while round 1\'s readers read, no fix phase written, is a one-line task of the fix phase the entry names, written first; built and landed, the round passing, finish lands it', () => {
    requestBuilt();
    sectionRead(sim, WU);
    testsRead(sim, WU);
    sim.run(['review', 'round', WU, '--file', sim.write(`.ledger/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger.'], findings: [] })]);

    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    finished(sim, WU);
    assert.strictEqual(git(sim.dir, ['cat-file', '-t', 'main:src/close.css']).trim(), 'blob', 'finish lands the one-line task');
  });

  it('a request at finish: the review passed, something small asked for as finish\'s Comment is a one-line task of the fix phase after the passing round, which the entry names, written first; built and landed, finish lands it', () => {
    reviewNext(sim, WU);
    sectionRead(sim, WU);
    testsRead(sim, WU);
    sim.run(['review', 'round', WU, '--file', sim.write(`.ledger/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger.'], findings: [] })]);
    finishClosed(sim, WU);
    sim.render(['finish', WU], { expect: 'content' });
    typeAtGate(sim, 'finish', 'Make the close button teal');

    const { move, data } = reviewNext(sim, WU);
    const phase = requestBuilt();
    finished(sim, WU);

    assert.deepStrictEqual([move, data['fix phase']], ['closing', [`phase ${phase}, where a request met before finish goes`]]);
    assert.strictEqual(git(sim.dir, ['cat-file', '-t', 'main:src/close.css']).trim(), 'blob', 'finish lands the one-line task');
  });
});
