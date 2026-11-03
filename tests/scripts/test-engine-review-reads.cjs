'use strict';

// ---------------------------------------------------------------------------
// `engine review reads <unit> <area|tests> …` (leeway-engine/scripts/domain/
// review-verbs.cjs, its records review-phase.cjs): a later round's reads
// named once the round before's fix tasks are done — in step, once their
// phase has merged too (14.6.2) — every read whose findings made fix tasks
// among them — each finding's area and each read whose report holds an
// item it answers — the test surface read only where named or its findings
// made one, areas added and never dropped, written in the spec's order and
// committed (14.3.3). What it refuses is
// test-engine-review-reads-refusals.cjs's; the round's snapshot taken
// there, and `review accept-tree`, test-engine-review-tree.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const {
  UNIT, EVERY, RECEIPT, useWorld, env, enter, reported, named, recorded, firstRoundReady, fixBuilt, stateText, lastStateCommit,
  refusedPristine, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** `review <verb>` refused, nothing written: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['review', ...args], { env: env() }).error;

/** Round 1 recorded failing on area 1's receipt, its fix task 3.1 built and done, round 2 entered. */
function fixesDone() {
  firstRoundReady();
  recorded({ can_now: [], findings: [RECEIPT] });
  fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
  enter();
}

describe('review reads: a later round\'s reads named (14.3.3)', () => {
  it('writes them in the spec\'s order, the test surface last, and commits them — the round reading each it names', () => {
    fixesDone();
    const res = named(['tests', '2-refunds', '1-cards']);
    const commit = lastStateCommit();
    reported(2, EVERY);

    assert.deepStrictEqual(res, { ok: true, round: 2, reads: ['1-cards', '2-refunds', 'tests'], committed: res.committed });
    assert.deepStrictEqual(JSON.parse(stateText(`${UNIT}/review/round-2-reads.json`)), { reads: ['1-cards', '2-refunds', 'tests'] });
    assert.deepStrictEqual(commit, { subject: `review(${UNIT}): round 2 reads 1-cards, 2-refunds, tests`, files: [`${UNIT}/review/round-2-reads.json`] });
    assert.deepStrictEqual(recorded({ can_now: [], findings: [] }).round, 2);
    assert.deepStrictEqual(JSON.parse(stateText(`${UNIT}/review/round-2.json`)).reports, ['1-cards-a.md', '1-cards-b.md', '2-refunds-a.md', '2-refunds-b.md', 'tests-a.md']);
  });

  it('a finding filed under one area that answers another read\'s item makes that read one the next round takes', () => {
    firstRoundReady();
    reported(1, EVERY, { '1-cards-a': ['bug: The receipt is never sent.'], '2-refunds-b': ['bug: No receipt follows a refund.'] });
    recorded({ can_now: [], findings: [{ ...RECEIPT, from: ['1-cards-a#1', '2-refunds-b#1'] }] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');

    assert.strictEqual(refused(['reads', UNIT, '1-cards']), 'review reads: round 2 reads every area whose findings made fix tasks in round 1, and leaves out 2-refunds');
    assert.deepStrictEqual(named(['1-cards', '2-refunds']).reads, ['1-cards', '2-refunds']);
  });

  it('an area\'s finding that answers the test reader\'s item makes the test surface one the next round takes', () => {
    firstRoundReady();
    reported(1, EVERY, { '1-cards-a': ['bug: The receipt is never sent.'], 'tests-a': ['bug: No test sends a receipt.'] });
    recorded({ can_now: [], findings: [{ ...RECEIPT, from: ['1-cards-a#1', 'tests-a#1'] }] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');

    assert.strictEqual(refused(['reads', UNIT, '1-cards']), 'review reads: round 2 reads every area whose findings made fix tasks in round 1, and leaves out the test surface (tests)');
    assert.deepStrictEqual(named(['1-cards', 'tests']).reads, ['1-cards', 'tests']);
  });

  it('the test surface is read only where named, or where its findings made fix tasks', () => {
    fixesDone();
    named(['1-cards']);
    const brief = refusedPristine(dir, ['brief', 'test-surface', UNIT, '--base', 'main'], { env: env() }).error;
    reported(2, ['1-cards']);
    recorded({ can_now: [], findings: [] });

    assert.strictEqual(brief, 'the test surface is not read in round 2, which reads 1-cards');
    assert.deepStrictEqual(JSON.parse(stateText(`${UNIT}/review/round-2.json`)).reports, ['1-cards-a.md', '1-cards-b.md']);
  });
});
