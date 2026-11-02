'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's tracker scenario: a build phase's tasks written
// through the `task` verbs, ready answering what can start, a fact added to
// a task before its dispatch, the tasks started side by side in the one
// conversation — the note a compaction hands up naming each — and done, and
// the task they held up freed — the project's default task driver running
// its real tool, its store on the state branch alone; the first phase's
// verify setup recorded once it ran end to end, then a task in flight
// proving its scenario by running the product, the run on the state branch;
// a task landing on its branch: a note for later banked, the fix round
// briefed from its pair's reports, its account taken once a round passes,
// then done; and one stuck on a failed round, settled by the orchestrator,
// its account carrying what was done.
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
const path = require('path');
const { stateGit, git } = require('./engine-harness.cjs');
const { Sim, sessionLog, startNew, carryOn, writePhaseTasks, worldFrom, cutTheSpec } = require('./pipeline-world.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));

const WU = 'ledger';

/** A feature with its build's first phase written, one task, and that task's branch cut in the project. */
const landingWorld = worldFrom('pipeline-tasks-landing-', (sim) => {
  startNew(sim, 'feature');
  const log = sessionLog(sim, WU);
  sim.run(['workunit', 'create', WU, 'feature', '--description', 'A ledger', '--session-log-file', log]);
  writePhaseTasks(sim, WU, 1, 'The ledger', [{ title: 'Write the ledger' }]);
  git(sim.dir, ['branch', taskBranch({ unit: WU, phase: 1, n: 1 }, 'feat', 'Write the ledger')]);
});

describe('pipeline simulation: the tracker', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('a build phase: its tasks written, the ready ones added to, started side by side and done, the task they held up freed', () => {
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
    assert.deepStrictEqual(carryOn(sim).position.tasks.map((/** @type {{task: string}} */ t) => t.task), ready, 'both are in flight in the conversation');
    for (const task of ready) sim.run(['task', 'done', wu, task]);
    assert.strictEqual(carryOn(sim).position.tasks, undefined, 'each done takes its task off');

    assert.deepStrictEqual(sim.run(['task', 'ready', wu]).tasks.map((/** @type {{task: string}} */ task) => task.task), ['1.3'],
      'the task they held up is ready once both are done');
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain']), '', 'every tracker write is on the state branch');
  });

  it('the first phase builds the verify setup and records it once it runs end to end; a task in flight then proves its scenario through it (15.S1, 15.S4)', () => {
    const wu = 'ledger';
    startNew(sim, 'feature');
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'A ledger', '--session-log-file', sessionLog(sim, wu)]);
    sim.write(`.leeway/${wu}/spec.md`, [
      '# A ledger', '', '## 1. The ledger', '', '### 1.1 Writing', '', '1.1.1 An entry is written. [builder]', '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given a ledger, when an entry is written, then it reads back. (1.1.1)', '',
    ].join('\n'));
    cutTheSpec(sim, wu, [{ name: 'The ledger', goal: 'Entries are written.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }]);
    writePhaseTasks(sim, wu, 1, 'The ledger', [{ title: 'Write the ledger' }]);
    sim.run(['task', 'start', wu, '1.1']);

    // The task builds the setup in the product's code, commits it through
    // the door, then records it, run end to end for its scenario.
    sim.write('verify/features.md', '# Features\n');
    fs.chmodSync(path.join(sim.dir, sim.write('verify/drive.sh', '#!/bin/sh\nprintf "pass\\n" > "$LEEWAY_RUN/verdict"\n')), 0o755);
    sim.run(['commit', '--paths', 'verify/features.md', 'verify/drive.sh', '--task', wu, '1.1', '-m', 'feat(ledger): the verify setup']);
    const setup = sim.write(`.leeway/.cache/${wu}/build/verify-setup.json`, {
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true',
      drive: 'verify/drive.sh', evidence: 'mkdir -p "$LEEWAY_RUN/evidence" && echo read back > "$LEEWAY_RUN/evidence/screen.txt"', cleanup: 'true',
    });
    sim.run(['verify', 'setup', wu, '--file', setup, '--scenario', '1.S1']);
    assert.deepStrictEqual(sim.run(['verify', 'run', wu, '1.S1']).standing, 'proven', 'the scenario is proven by its run');
    sim.run(['task', 'done', wu, '1.1']);
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', 'manifest.json', `${wu}/build`]), '', 'the setup and the run are on the state branch');
  });
});

describe('pipeline simulation: a task landing', () => {
  let sim;
  beforeEach(() => { sim = new Sim(landingWorld); });
  afterEach(() => { sim.destroy(); });

  it('a task lands on its branch: a find beyond it banked as a note, its pair failing it on a bug, the fix round briefed from their reports, a round of nits passing it, its account taken, then done', () => {
    const wu = WU;
    sim.run(['task', 'start', wu, '1.1']);

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
