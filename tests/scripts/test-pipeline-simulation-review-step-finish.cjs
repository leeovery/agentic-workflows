'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's finish in step, as the review phase's skill
// runs it: a feature whose build has closed its cut, every phase merged at
// its gate, switched to step; round 1 failing, nothing stopping on the
// verdict, a stray change in the working tree stopping its record at the
// gate over the tree and put back there (14.S13); its fix task built
// through the task loop, stopping at its gate, and its fix phase merging at
// its own before the next round's reads are named (14.S14); round 2
// reading the area the fix changed and passing; and finish, its gate's yes
// landing nothing left, the fix phase merged with the rest, and handing the
// work to the start menu (24.1.2). The review phase in auto is
// test-pipeline-simulation-review.cjs's; a round failing again and
// settled, -review-settled.cjs's.
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
const fs = require('fs');
const path = require('path');
const {
  Sim, worlds, answerGate, writePhaseTasks, builders, taskBuilt, areaRead, testsRead, reviewNext, strayRound, finished, handoff,
} = require('./pipeline-world.cjs');

const WU = 'ledger';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';

describe('pipeline simulation: finish in step', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed(WU));
  });
  afterEach(() => {
    sim.destroy();
  });

  it('a stray change put back at the gate over the tree; round 1\'s fix task stopping at its gate and its fix phase merged at its own before round 2\'s reads are named; round 2 passing, finish lands nothing and hands the work to the start menu (14.S13, 14.S14, 24.1.2)', () => {
    sim.run(['workunit', 'position', WU, 'step']);
    const { move, fixPhase: phase } = reviewNext(sim, WU);
    assert.strictEqual(move, 'round');
    areaRead(sim, WU, UNCHECKED);
    testsRead(sim, WU);
    writePhaseTasks(sim, WU, phase, 'The review\'s fixes', [{ title: 'Check the hash on read', type: 'fix', scenarios: ['an entry read back'], reference: '§1' }]);
    strayRound(sim, WU, {
      can_now: ['Keep a ledger.'],
      findings: [{ area: '1-the-work', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', from: ['1-the-work-a#1'], fix: `${phase}.1` }],
    }, 'p');
    assert.strictEqual(fs.existsSync(path.join(sim.dir, 'stray.txt')), false, 'put back: the stray file the round found is gone');
    sim.render(['review-report', WU], { expect: 'content' });

    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    const tree = builders.make(`agent-${phase}`);
    taskBuilt(sim, WU, `${phase}.1`, tree, { 'src/hash.js': 'export const hash = 1;\n' }, false, { gated: true });
    builders.remove(sim, tree);
    assert.strictEqual(reviewNext(sim, WU).move, 'merge');
    sim.render(['phase-merge-gate', WU, String(phase)], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);

    assert.strictEqual(reviewNext(sim, WU).move, 'reads');
    sim.run(['review', 'reads', WU, '1-the-work']);
    assert.deepStrictEqual(reviewNext(sim, WU).data.reads, ['1-the-work'], 'once its fix phase has merged, the next round reads the area it changed');
    areaRead(sim, WU);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger whose entries are checked.'], findings: [] })]).ends, true);
    sim.render(['review-report', WU], { expect: 'content' });

    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    const { landed, next } = finished(sim, WU);
    assert.deepStrictEqual(landed, [], 'every phase merged at its gate, the fix phase among them, so finish lands nothing');
    assert.deepStrictEqual(next, { kind: 'handoff', skill: 'leeway', args: [] }, 'a feature finished is handed to the start menu');
    handoff(sim, '/leeway');
  });
});
