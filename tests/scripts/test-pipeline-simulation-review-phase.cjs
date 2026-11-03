'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review-phase scenario: a unit whose build has
// closed every phase of its cut, reviewed whole — the review phase entered;
// each area's pair and the test reader briefed, their reports written as
// the agents write them, a `.txt` beside the file their brief names,
// renamed to it; a finding out of scope filed to the inbox by Claude's call
// at the review; the failing round recorded, every item of its reports
// answered, with its fix task, written as a phase past the cut and built
// through the task loop with no phase review over it; the next round's
// reads named, the area the fix changed alone, the test surface not read
// again, passing and closing the review; then its report and the calls
// decided for the person drawn; and finish — its checklist worked and
// closed, its gate drawn, and its yes landing the fix phase and completing
// the unit. A review failing twice, its fix phases built one on the other,
// is test-pipeline-simulation-review-rounds.cjs's.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick, its cut one phase, built and closed — a
// copy per scenario, which replays the engine calls the review phase makes,
// in order, the oracle (pipeline-oracle.cjs) auditing the whole state after
// every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Sim, worldFrom, writePhaseTasks, builders, taskBuilt, cutClosed, areaRead, testsRead, finished } = require('./pipeline-world.cjs');

const WU = 'ledger';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';
const UNEXPORTED = '## Findings\n\n- nit: the ledger has no export\n  Scenario: an entry exported\n\nVerdict: pass\n';

/** A feature through its spec to ready to build's pick, its cut's one phase built, reviewed, merged and closed. */
const reviewWorld = worldFrom('pipeline-review-phase-', (sim) => cutClosed(sim, WU));

describe('pipeline simulation: the review phase', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(reviewWorld);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('the review phase entered; the area\'s pair and the test reader briefed and reporting; a finding out of scope filed; the failing round\'s fix task built as a phase past the cut; the next round\'s reads named, reading the area it changed, passing and closing the review; its report and the calls drawn; finish landing the fix phase', () => {
    sim.run(['enter', 'review', WU]);
    assert.ok(sim.sections.includes('reads: 1-the-work, the test surface (tests)\n'), sim.sections);

    // Round 1: the area's pair, one failing it, and the test reader.
    areaRead(sim, WU, UNCHECKED);
    testsRead(sim, WU, UNEXPORTED);

    // Out of scope: Claude's call to file it, then the item filed.
    const question = sim.run(['ledger', 'ask', `${WU}.review`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Is the export finding filed or dropped?' })).id;
    const call = sim.run(['ledger', 'decide', `${WU}.review`, '--answers', question], null, JSON.stringify({
      by: 'claude', who_moved_whom: 'none', text: 'Filed: the ledger has no export.', why: 'It is beside the change.',
    })).id;
    const item = sim.run(['inbox', 'file', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/item.json`, { kind: 'idea', text: '# Ledger export\n\nThe ledger has no export.', call })]);

    // The fix written as a phase past the cut, and the round recorded.
    writePhaseTasks(sim, WU, 2, 'Review fixes', [{ title: 'Check the hash' }]);
    const round = sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
      can_now: ['Keep a ledger.'],
      findings: [
        { area: '1-the-work', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', from: ['1-the-work-a#1'], fix: '2.1' },
        { area: 'tests', scope: 'out', call: 'nit', text: 'The ledger has no export.', from: ['tests-a#1'], inbox: item.filed, ledger: call },
      ],
    })]);
    assert.deepStrictEqual([round.fix_phase, round.reads_at_least], [2, ['1-the-work']]);

    // The fix built through the task loop, with no phase review over it.
    const tree = builders.make('agent-2');
    taskBuilt(sim, WU, '2.1', tree, { 'src/hash.js': 'export const hash = 1;\n' }, false);
    builders.remove(sim, tree);

    // Round 2's reads named — the area the fix changed — read, passing, and closing the review.
    sim.run(['enter', 'review', WU]);
    sim.run(['review', 'reads', WU, '1-the-work']);
    areaRead(sim, WU);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger whose entries are checked.'], findings: [] })]).ends, true);

    sim.render(['review-report', WU], { expect: 'content' });
    sim.render(['review-calls', WU], { expect: 'content' });

    // Finish: Claude's items marked, the checklist closed, the gate drawn, and the yes landing the fix phase and completing the unit.
    assert.deepStrictEqual(finished(sim, WU), [[2]]);
  });
});
