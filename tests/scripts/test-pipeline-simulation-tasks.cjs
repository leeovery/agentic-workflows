'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's tracker scenario: a build phase's tasks written
// through the `task` verbs, ready answering what can start, a fact added to
// a task before its dispatch, the tasks started side by side in the one
// conversation, each builder laying its task's worktree out in its own — the
// note a compaction hands up naming each — and done, and the task they held
// up freed — the project's default task driver running its real tool, its
// store on the state branch alone; a task landing on its
// branch: its builder briefed, a note for later banked, the fix round
// briefed from its pair's reports in the conversation that briefed its
// builder, its account taken once a round passes, then done; and one stuck
// on a failed round, settled by the orchestrator, its account carrying what
// was done.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), and for the landings this file's own, built once
// from it — a feature, its first phase's one task, the task's branch — a
// copy per scenario; each replays the engine calls the skill prose makes,
// in prose order, and the oracle (pipeline-oracle.cjs) audits the whole
// state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stateGit, git, accountTaken } = require('./engine-harness.cjs');
const { Sim, sessionLog, startNew, carryOn, writePhaseTasks, worldFrom } = require('./pipeline-world.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));

const WU = 'ledger';

/** A feature with the spec its builder's brief draws on, its build's first phase written, one task, and that task's branch cut in the project. */
const landingWorld = worldFrom('pipeline-tasks-landing-', (sim) => {
  startNew(sim, 'feature');
  const log = sessionLog(sim, WU);
  sim.run(['workunit', 'create', WU, 'feature', '--description', 'A ledger', '--session-log-file', log]);
  sim.write(`.leeway/${WU}/spec.md`, '# Ledger\n\n## 1. The ledger\n\nThe ledger is written with its header first.\n');
  stateGit(sim.dir, ['add', '-A']);
  stateGit(sim.dir, ['commit', '-q', '-m', `spec(${WU}): the ledger`]);
  writePhaseTasks(sim, WU, 1, 'The ledger', [{ title: 'Write the ledger' }]);
  git(sim.dir, ['branch', taskBranch({ unit: WU, phase: 1, n: 1 }, 'feat', 'Write the ledger')]);
});

describe('pipeline simulation: the tracker', () => {
  let sim;
  /** @type {string} */ let builders;
  beforeEach(() => {
    sim = new Sim();
    builders = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-builders-')));
  });
  afterEach(() => {
    sim.destroy();
    fs.rmSync(builders, { recursive: true, force: true });
  });

  it('a build phase: its tasks written, the ready ones added to, started side by side each in its own worktree and done, the task they held up freed', () => {
    const wu = 'ledger';
    startNew(sim, 'feature');
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'A ledger', '--session-log-file', log]);

    writePhaseTasks(sim, wu, 1, 'The ledger', [
      { title: 'Write the ledger' }, { title: 'Read the ledger' }, { title: 'Fold the ledger', after: ['1.1', '1.2'] },
    ]);

    // The build runs what is ready side by side, every task in flight in the
    // one conversation (12.S21).
    const ready = sim.run(['task', 'ready', wu, '1']).tasks.map((/** @type {{task: string}} */ task) => task.task);
    assert.deepStrictEqual(ready, ['1.1', '1.2'], 'ready answers the two tasks nothing holds up');
    // Before the dispatch, a fact about the code goes onto the task (13.11.3).
    const fact = sim.write(`.leeway/.cache/${wu}/build/addition.md`, 'The ledger file moved to `ledger/store.go`.\n');
    sim.run(['task', 'add', wu, '1.1', '--file', fact, '--by', 'orchestrator']);
    for (const task of ready) sim.run(['task', 'start', wu, task]);
    // Each builder lays its task's worktree out in the one its isolation
    // made (12.7.10), the worktree recorded against its task.
    const trees = ready.map((task, i) => {
      const tree = path.join(builders, `agent-${i + 1}`);
      git(sim.dir, ['worktree', 'add', '-q', '-b', `worktree-agent-${i + 1}`, tree]);
      sim.runIn(tree, ['task', 'worktree', wu, task]);
      return tree;
    });
    assert.deepStrictEqual(carryOn(sim).position.tasks.map((/** @type {{task: string, worktree: string}} */ t) => [t.task, t.worktree]), ready.map((task, i) => [task, trees[i]]),
      'both are in flight in the conversation, each in its own worktree');
    for (const task of ready) {
      accountTaken(sim.dir, wu, task);
      sim.run(['task', 'done', wu, task]);
    }
    assert.strictEqual(carryOn(sim).position.tasks, undefined, 'each done takes its task off');

    assert.deepStrictEqual(sim.run(['task', 'ready', wu]).tasks.map((/** @type {{task: string}} */ task) => task.task), ['1.3'],
      'the task they held up is ready once both are done');
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain']), '', 'every tracker write is on the state branch');
  });

});

describe('pipeline simulation: a task landing', () => {
  let sim;
  beforeEach(() => { sim = new Sim(landingWorld); });
  afterEach(() => { sim.destroy(); });

  it('a task lands on its branch: its builder briefed, a find beyond it banked as a note, its pair failing it on a bug, the fix round briefed from their reports, a round of nits passing it, its account taken, then done', () => {
    const wu = WU;
    sim.run(['task', 'start', wu, '1.1']);
    sim.run(['brief', 'builder', wu, '1.1']);

    sim.run(['task', 'note', wu, '--file', sim.write(`.leeway/.cache/${wu}/build/note.md`, 'Reading the ledger back never checks its hash.\n')]);
    const report = (/** @type {number} */ round, /** @type {string} */ letter, /** @type {string} */ findings, /** @type {string} */ verdict) => sim.write(
      `.leeway/${wu}/build/tasks/1.1/round-${round}-${letter}.md`, `## Findings\n\n${findings}\n\nVerdict: ${verdict}\n`,
    );
    report(1, 'a', '- bug: an empty ledger writes no header.\n  Scenario: a first write to a new ledger.', 'fail');
    report(1, 'b', 'None.', 'pass');
    sim.run(['brief', 'fix', wu, '1.1']);
    report(2, 'a', '- nit: a comment names the task.\n  Scenario: a reader of the code.', 'pass');
    report(2, 'b', 'None.', 'pass');
    sim.write(`.leeway/${wu}/build/tasks/1.1.md`, [
      '## What was done', 'An empty ledger now writes its header first.', '## Where in the code', '- ledger/store.go', '## What the tests prove', '- A first write to a new ledger holds its header.',
      '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'The header was missing; the builder wrote it.', '### Round 2', 'Passed, one nit fixed.',
    ].join('\n\n'));
    sim.run(['task', 'account', wu, '1.1']);
    sim.run(['task', 'done', wu, '1.1']);

    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain']), '', 'the note, the reports, the account and its figures are on the state branch');
  });

  it('a task stuck on a failed round: the orchestrator settles it, its account says what was done, then done', () => {
    const wu = WU;
    sim.run(['task', 'start', wu, '1.1']);

    for (const letter of ['a', 'b']) {
      sim.write(`.leeway/${wu}/build/tasks/1.1/round-1-${letter}.md`, `## Findings\n\n- bug: the ledger's lock is never freed.\n  Scenario: a second write.\n\nVerdict: fail\n`);
    }
    sim.run(['task', 'settle', wu, '1.1', '--file', sim.write(`.leeway/.cache/${wu}/build/settle.md`, 'The lock is the driver\'s; the orchestrator freed it in the driver.\n')]);
    sim.write(`.leeway/${wu}/build/tasks/1.1.md`, [
      '## What was done', 'A ledger write takes the lock and frees it.', '## Where in the code', '- ledger/store.go', '## What the tests prove', '- A second write follows the first.',
      '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'The lock was never freed.', '### Settled', 'The orchestrator freed it in the driver.',
    ].join('\n\n'));
    assert.deepStrictEqual(sim.run(['task', 'account', wu, '1.1']).settled, [1], 'the account is of a task whose first round was settled');
    sim.run(['task', 'done', wu, '1.1']);

    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain']), '', 'the settlement, the reports and the account are on the state branch');
  });
});
