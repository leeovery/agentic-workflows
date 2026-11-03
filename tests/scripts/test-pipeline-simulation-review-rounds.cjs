'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's scenario of the review's rounds: a unit whose
// build has closed every phase of its cut, reviewed whole in auto and
// failing twice — round 1's fix phase built through the task loop and left
// unlanded; round 2 reading the area it changed, failing again, its fix
// phase built on the first's, left unlanded too (7.2.6); round 3 reading
// the change both hold, passing and closing the review (14.S12); and
// finish's yes landing both fix phases in order and completing the unit.
// The review phase's other steps — its first round's readers, a finding
// filed, its report and calls drawn — are
// test-pipeline-simulation-review-phase.cjs's.
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
const { git } = require('./engine-harness.cjs');
const { Sim, worldFrom, writePhaseTasks, builders, taskBuilt, cutClosed, areaRead, testsRead, finished } = require('./pipeline-world.cjs');

const WU = 'ledger';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';
const UNSALTED = '## Findings\n\n- bug: the ledger never salts its hash\n  Scenario: an entry hashed\n\nVerdict: fail\n';

/** A feature through its spec to ready to build's pick, its cut's one phase built, reviewed, merged and closed. */
const roundsWorld = worldFrom('pipeline-review-rounds-', (sim) => cutClosed(sim, WU));

/**
 * The round under review recorded failing on area 1's finding `text`, its
 * fix written as phase `phase`'s one task, `title`, and built through the
 * task loop in a worktree of its own, adding `file`.
 * @param {Sim} sim @param {number} phase @param {string} text @param {string} title @param {string} file
 */
function fixedRound(sim, phase, text, title, file) {
  writePhaseTasks(sim, WU, phase, 'Review fixes', [{ title }]);
  sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
    can_now: ['Keep a ledger.'],
    findings: [{ area: '1-the-work', scope: 'in', call: 'bug', text, from: ['1-the-work-a#1'], fix: `${phase}.1` }],
  })]);
  const tree = builders.make(`agent-${phase}`);
  taskBuilt(sim, WU, `${phase}.1`, tree, { [file]: 'export const fix = 1;\n' }, false);
  builders.remove(sim, tree);
}

describe('pipeline simulation: the review\'s rounds', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(roundsWorld);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('round 1 failing, its fix phase built and left unlanded; round 2 reading the area it changed, failing again, its fix phase built on the first\'s; round 3 reading the change both hold, passing and closing the review (14.S12); finish landing both fix phases in order', () => {
    sim.run(['enter', 'review', WU]);
    areaRead(sim, WU, UNCHECKED);
    testsRead(sim, WU);
    fixedRound(sim, 2, 'The ledger never checks its hash on read.', 'Check the hash', 'src/hash.js');

    sim.run(['enter', 'review', WU]);
    sim.run(['review', 'reads', WU, '1-the-work']);
    areaRead(sim, WU, UNSALTED);
    fixedRound(sim, 3, 'The hash is never salted.', 'Salt the hash', 'src/salt.js');
    assert.strictEqual(git(sim.dir, ['merge-base', '--is-ancestor', 'feat/ledger-2.1-check-the-hash', 'feat/ledger-3.1-salt-the-hash']), '', 'round 2\'s fix is built on round 1\'s');

    sim.run(['enter', 'review', WU]);
    sim.run(['review', 'reads', WU, '1-the-work']);
    areaRead(sim, WU);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger whose entries are checked and salted.'], findings: [] })]).ends, true);

    assert.deepStrictEqual(finished(sim, WU), [[2, 3]]);
  });
});
