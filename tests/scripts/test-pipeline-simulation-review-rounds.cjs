'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's scenario of the review's rounds, as the review
// phase's skill runs them: a unit whose build has closed every phase of its
// cut, reviewed whole in auto — round 1 failing, its fix phase built
// through the task loop and left unlanded; round 2 reading the area it
// changed and passing on a nit, ending the review, its fix phase built on
// the first's, left unlanded too (7.2.6), its builder banking a note for
// later as the task loop banks one, which is answered on its own before
// finish, dropped by Claude's call, and the report drawn again (14.3.5); and
// finish's yes landing both fix phases in order and completing the unit.
// Each failing round's fix phase past the cut, round after round (14.S12),
// is test-engine-review-round.cjs's; the review phase's other steps — its
// first round's readers, a finding filed, its report and calls drawn —
// test-pipeline-simulation-review.cjs's.
//
// Layer: simulation. World: the named world `worlds.cutClosed`, built once
// per run (pipeline-world.cjs) — a feature through its spec to ready to
// build's pick, its cut one phase, built and closed — a copy per scenario,
// which replays the engine calls the review phase makes, in order, the
// oracle (pipeline-oracle.cjs) auditing the whole state after every
// mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worlds, writePhaseTasks, builders, taskBuilt, areaRead, testsRead, reviewNext, reviewCall, finished,
} = require('./pipeline-world.cjs');

const WU = 'ledger';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';
const UNSALTED = '## Findings\n\n- nit: the ledger never salts its hash\n  Scenario: an entry hashed\n\nVerdict: pass\n';

/**
 * The round under review recorded on area 1's finding `text`, called
 * `call`, met by `scenario`, its fix written as phase `phase`'s one task,
 * `title`; its report drawn; and, the entry saying so, the fix built
 * through the task loop in a worktree of its own, adding `file`, its
 * builder banking `note` where one is given. Answers what the record
 * answered, and the note's number, null where none was banked.
 * @param {Sim} sim @param {number} phase @param {{call: string, text: string, scenario: string, title: string, file: string, note?: string}} fix
 */
function fixedRound(sim, phase, {
  call, text, scenario, title, file, note,
}) {
  writePhaseTasks(sim, WU, phase, 'Review fixes', [{ title, type: 'fix', scenarios: [scenario], reference: '§1' }]);
  const res = sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
    can_now: ['Keep a ledger.'],
    findings: [{ area: '1-the-work', scope: 'in', call, text, from: ['1-the-work-a#1'], fix: `${phase}.1` }],
  })]);
  sim.render(['review-report', WU], { expect: 'content' });
  assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
  const tree = builders.make(`agent-${phase}`);
  const banked = taskBuilt(sim, WU, `${phase}.1`, tree, { [file]: 'export const fix = 1;\n' }, false, { note });
  builders.remove(sim, tree);
  return { res, note: banked };
}

describe('pipeline simulation: the review\'s rounds', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(worlds.cutClosed(WU));
  });
  afterEach(() => {
    sim.destroy();
  });

  it('round 1 failing, its fix phase built and left unlanded; round 2 reading the area it changed and passing on a nit, its fix phase built on the first\'s and its builder\'s note answered before finish (14.3.5); finish landing both fix phases in order', () => {
    const first = /** @type {number} */ (reviewNext(sim, WU).fixPhase);
    areaRead(sim, WU, UNCHECKED);
    testsRead(sim, WU);
    fixedRound(sim, first, {
      call: 'bug', text: 'The ledger never checks its hash on read.', scenario: 'an entry read back', title: 'Check the hash', file: 'src/hash.js',
    });

    assert.strictEqual(reviewNext(sim, WU).move, 'reads');
    sim.run(['review', 'reads', WU, '1-the-work']);
    const again = reviewNext(sim, WU);
    assert.deepStrictEqual([again.move, again.data.reads], ['round', ['1-the-work']], 'round 2 reads the area its fix changed');
    const second = /** @type {number} */ (again.fixPhase);
    areaRead(sim, WU, UNSALTED);
    const { res: passed, note } = fixedRound(sim, second, {
      call: 'nit', text: 'The hash is never salted.', scenario: 'an entry hashed', title: 'Salt the hash', file: 'src/salt.js', note: 'The ledger\'s export skips refunds, at src/export.js.',
    });
    assert.deepStrictEqual([passed.passed, passed.ends], [true, true], 'a round passing on a nit ends the review, its fix still to build');
    assert.strictEqual(git(sim.dir, ['merge-base', '--is-ancestor', `fix/ledger-${first}.1-check-the-hash`, `fix/ledger-${second}.1-salt-the-hash`]), '', 'round 2\'s fix is built on round 1\'s');

    const notes = reviewNext(sim, WU);
    assert.deepStrictEqual([notes.move, notes.data['builder note']], ['notes', [`notes#${note}`]], 'the fix\'s builder\'s note is answered before finish (14.3.5)');
    const dropped = reviewCall(sim, WU, 'Is the export\'s note filed or dropped?', 'Dropped: the export\'s refunds.', 'The export is rewritten next.');
    sim.run(['review', 'notes', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/notes.json`, {
      findings: [{ area: 'notes', scope: 'out', call: 'nit', text: 'The export skips refunds.', from: [`notes#${note}`], drop: 'The export is rewritten next.', ledger: dropped }],
    })]);
    sim.render(['review-report', WU], { expect: 'content' });

    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    assert.deepStrictEqual(finished(sim, WU).landed, [[first, second]]);
  });
});
