'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build-phase scenario: a phase of a unit's cut as
// the build runs it — the task writer briefed from the cut and the phase's
// tasks written through the `task` verbs, then, its task built on its
// branch — the verify setup, its mutation tool among it, committed through
// the door and recorded once it ran end to end, the phase's scenario proven
// by its run — and a note for later banked, the consolidation agent and the
// phase review briefed over the phase's stack, the review reading the
// scenario's runs at the phase's HEAD and what survived the mutation tool,
// run once over the phase before the pair is briefed, each reviewer's report
// written to its own file.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick, its cut one phase — a copy per scenario,
// which replays the engine calls the build makes, in order, the oracle
// (pipeline-oracle.cjs) auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { stateGit, git } = require('./engine-harness.cjs');
const {
  Sim, startUnit, discussed, specToBuild, writePhaseTasks, worldFrom,
} = require('./pipeline-world.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));

const WU = 'ledger';

/** A feature through its spec to ready to build's pick: its cut, one phase. */
const builtWorld = worldFrom('pipeline-build-phase-', (sim) => {
  startUnit(sim, 'feature', WU, 'A ledger');
  discussed(sim, WU, WU);
  specToBuild(sim, WU, [WU], 'a');
});

describe('pipeline simulation: a phase of the cut', () => {
  let sim;
  beforeEach(() => { sim = new Sim(builtWorld); });
  afterEach(() => { sim.destroy(); });

  it('the task writer briefed from the cut writes the phase\'s tasks; its task built on its branch, its scenario proven and a note banked, the consolidation agent and the phase review are briefed over the phase\'s stack, the review reading the runs at its HEAD and the survivors', () => {
    const wu = WU;
    assert.strictEqual(sim.run(['brief', 'task-writer', wu, '1']).agent, 'leeway-task-writer');
    writePhaseTasks(sim, wu, 1, 'The work', [{ title: 'Write the ledger' }]);
    git(sim.dir, ['checkout', '-q', '-b', taskBranch({ unit: wu, phase: 1, n: 1 }, 'feat', 'Write the ledger')]);
    sim.run(['task', 'start', wu, '1.1']);

    sim.write('verify/features.md', '# Features\n');
    fs.chmodSync(path.join(sim.dir, sim.write('verify/drive.sh', '#!/bin/sh\nprintf "pass\\n" > "$LEEWAY_RUN/verdict"\n')), 0o755);
    sim.run(['commit', '--paths', 'verify/features.md', 'verify/drive.sh', '--task', wu, '1.1', '-m', 'feat(ledger): the verify setup']);
    const setup = sim.write(`.leeway/.cache/${wu}/build/verify-setup.json`, {
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
      mutation: 'echo "[]" > "$LEEWAY_RUN/survivors.json"',
    });
    sim.run(['verify', 'setup', wu, '--file', setup, '--scenario', '1.S1']);
    sim.run(['verify', 'run', wu, '1.S1']);
    sim.run(['task', 'note', wu, '--file', sim.write(`.leeway/.cache/${wu}/build/note.md`, 'Reading the ledger back never checks its hash.\n')]);
    sim.run(['task', 'done', wu, '1.1']);

    assert.strictEqual(sim.run(['brief', 'consolidation', wu, '1', '--base', 'main']).agent, 'leeway-consolidation');
    assert.deepStrictEqual(sim.run(['verify', 'mutants', wu, '1']).survivors, [], 'the mutation tool runs once, before the pair is briefed');
    const review = sim.run(['brief', 'phase-review', wu, '1', '--base', 'main', '--letter', 'a', '--head', git(sim.dir, ['rev-parse', 'HEAD']).trim()]);
    assert.strictEqual(review.agent, 'leeway-reviewer');
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain']), '', 'the tracker\'s writes and the note are on the state branch');
  });
});
