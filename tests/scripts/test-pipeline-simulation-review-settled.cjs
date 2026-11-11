'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase settling a stuck round, as its
// skill runs it (14.6.3): a feature whose build has closed its cut, in auto;
// round 1 failing, its report drawn and its fix built through the task
// loop, its builder banking a note for later; round 2 reading the area the
// fix changed and failing again on what the fix addressed, the finding
// dropped by Claude's call and the round settled, the builder's note
// answered among its items, dropped so too (14.3.5), a stray change in the
// working tree stopping its record at the gate over the tree and kept there
// (14.S13); the review over, finish next. In step,
// test-pipeline-simulation-review-step-finish.cjs; a review failing then
// passing with a fix each time, -review-rounds.cjs.
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
  Sim, worlds, writePhaseTasks, builders, taskBuilt, areaRead, testsRead, reviewNext, reviewCall, strayRound,
} = require('./pipeline-world.cjs');

const WU = 'ledger';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';

describe('pipeline simulation: a stuck round settled', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed(WU));
  });
  afterEach(() => {
    sim.destroy();
  });

  it('round 2 failing again on what its fix addressed is settled by Claude, a stray change kept at the gate over the tree, and the review is over (14.S15, 14.S13)', () => {
    const { fixPhase: phase } = reviewNext(sim, WU);
    areaRead(sim, WU, UNCHECKED);
    testsRead(sim, WU);
    writePhaseTasks(sim, WU, phase, 'The review\'s fixes', [{ title: 'Check the hash on read', type: 'fix', scenarios: ['an entry read back'], reference: '§1' }]);
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
      can_now: ['Keep a ledger.'],
      findings: [{ area: '1-the-work', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', from: ['1-the-work-a#1'], fix: `${phase}.1` }],
    })]);
    sim.render(['review-report', WU], { expect: 'content' });
    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    const tree = builders.make(`agent-${phase}`);
    const note = taskBuilt(sim, WU, `${phase}.1`, tree, { 'src/hash.js': 'export const hash = 1;\n' }, false, { note: 'The ledger\'s export skips refunds, at src/export.js.' });
    builders.remove(sim, tree);

    const reads = reviewNext(sim, WU);
    assert.deepStrictEqual([reads.move, reads.data['builder note']], ['reads', [`notes#${note}`]], 'the fix task\'s builder\'s note is an item of the next round');
    sim.run(['review', 'reads', WU, '1-the-work']);
    assert.strictEqual(reviewNext(sim, WU).move, 'round');
    areaRead(sim, WU, UNCHECKED);
    const dropped = reviewCall(sim, WU, 'Is the hash on read, found again, fixed or dropped?', `Dropped: task ${phase}.1 checks the hash on read.`, 'The reader read the hash before the fix.');
    const later = reviewCall(sim, WU, 'Is the export\'s note filed or dropped?', 'Dropped: the export\'s refunds.', 'The export is rewritten next.');
    const settled = strayRound(sim, WU, {
      can_now: ['Keep a ledger whose entries are checked.'],
      findings: [
        { area: '1-the-work', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', from: ['1-the-work-a#1'], drop: `Fixed by task ${phase}.1.`, ledger: dropped },
        { area: 'notes', scope: 'out', call: 'nit', text: 'The export skips refunds.', from: [`notes#${note}`], drop: 'The export is rewritten next.', ledger: later },
      ],
      settled: `Task ${phase}.1 checks the hash on read, and its test proves it.`,
    }, 'k');
    assert.deepStrictEqual([settled.passed, settled.ends, settled.fixes], [false, true, []], 'a round failing again on what its fix addressed is settled, and the review is over (14.S15)');
    assert.strictEqual(fs.existsSync(path.join(sim.dir, 'stray.txt')), true, 'kept: the stray file stands');
    sim.render(['review-report', WU], { expect: 'content' });
    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
  });
});
