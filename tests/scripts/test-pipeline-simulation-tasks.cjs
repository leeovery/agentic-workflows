'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's tracker scenario: a build phase's tasks written
// through the `task` verbs, ready answering what can start, a fact added to
// a task before its dispatch, the tasks started and done, and the task they
// held up freed — the project's default task driver running its real tool,
// its store on the state branch alone.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { stateGit } = require('./engine-harness.cjs');
const { Sim, sessionLog, startNew, carryOn, writePhaseTasks } = require('./pipeline-world.cjs');

describe('pipeline simulation: the tracker', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('a build phase: its tasks written, the ready ones added to, started and done, the task they held up freed', () => {
    const wu = 'ledger';
    startNew(sim, 'feature');
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'A ledger', '--session-log-file', log]);

    writePhaseTasks(sim, wu, 1, 'The ledger', [
      { title: 'Write the ledger' }, { title: 'Read the ledger' }, { title: 'Fold the ledger', after: ['1.1', '1.2'] },
    ]);

    // The build runs what is ready side by side, each task in flight in a
    // conversation of its own.
    const ready = sim.run(['task', 'ready', wu, '1']).tasks.map((/** @type {{task: string}} */ task) => task.task);
    assert.deepStrictEqual(ready, ['1.1', '1.2'], 'ready answers the two tasks nothing holds up');
    // Before the dispatch, a fact about the code goes onto the task (13.11.3).
    const fact = sim.write(`.leeway/.cache/${wu}/build/addition.md`, 'The ledger file moved to `ledger/store.go`.\n');
    sim.run(['task', 'add', wu, '1.1', '--file', fact, '--by', 'orchestrator']);
    for (const task of ready) {
      sim.handOver();
      sim.run(['task', 'start', wu, task]);
      assert.strictEqual(carryOn(sim).position.task, task, 'the task is in flight in its conversation');
      sim.run(['task', 'done', wu, task]);
    }

    assert.deepStrictEqual(sim.run(['task', 'ready', wu]).tasks.map((/** @type {{task: string}} */ task) => task.task), ['1.3'],
      'the task they held up is ready once both are done');
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain']), '', 'every tracker write is on the state branch');
  });
});
