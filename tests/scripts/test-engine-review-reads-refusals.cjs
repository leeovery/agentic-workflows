'use strict';

// ---------------------------------------------------------------------------
// What `engine review reads <unit> <area|tests> …` refuses, writing nothing
// (leeway-engine/scripts/domain/review-verbs.cjs, its records
// review-phase.cjs): round 1, which reads every area and the test surface;
// a unit its entry refuses; a name no area's; a read whose findings made fix
// tasks left out, and one named before dropped (14.3.3); the round before's
// fix tasks not done; a review over; and in step, the round before's fix
// phase waiting at its merge's gate, the lowest phase waiting named first —
// round 1's where a switch from auto left it unmerged — until each has
// merged (14.6.2, 7.2.6). The reads it names are test-engine-review-reads.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const {
  UNIT, inStep, EVERY, FAILING, RECEIPT, useWorld, env, enter, reported, named, recorded, firstRoundReady, secondRoundReady, fixPhaseWritten, taskMade, fixBuilt, fixClosed,
  refusedPristine, git, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** `review <verb>` refused, nothing written: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['review', ...args], { env: env() }).error;

describe('review reads: what it refuses, writing nothing (14.3.3)', () => {
  it('round 1, a unit whose review phase cannot be entered, a name no area\'s, a read whose findings made fix tasks left out, a read named before dropped, fix tasks waiting — a task of their phase written beyond the findings among them — and a review over', () => {
    enter();
    const first = refused(['reads', UNIT, '1-cards']);
    const half = refused(['reads', 'half', '1-cards']);
    firstRoundReady();
    reported(1, EVERY, { '1-cards-a': ['bug: The receipt is never sent.'], 'tests-a': ['bug: No test sends a receipt.'] });
    recorded({ can_now: [], findings: [RECEIPT, { area: 'tests', scope: 'in', call: 'bug', text: 'No test sends a receipt.', from: ['tests-a#1'], fix: '3.1' }] });
    taskMade(3, 'Mail the receipt', '§1.2');
    const waiting = refused(['reads', UNIT, '1-cards', 'tests']);
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    const beyond = refused(['reads', UNIT, '1-cards', 'tests']);
    fixClosed(3, 2);
    enter();
    const unknown = refused(['reads', UNIT, '1-cards', '3-reports', 'tests', 'cards']);
    const leftOut = refused(['reads', UNIT, '1-cards']);
    named(['1-cards', '2-refunds', 'tests']);
    const dropped = refused(['reads', UNIT, '1-cards', 'tests']);

    assert.deepStrictEqual([first, half, waiting, beyond, unknown, leftOut, dropped], [
      'review reads: round 1 reads every area and the test surface (tests) — a later round\'s are named',
      'review reads: half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'review reads: round 2 is read once every fix task of round 1 is done — task 3.1 not started, task 3.2 not started',
      'review reads: round 2 is read once every fix task of round 1 is done — task 3.2 not started',
      `review reads: 3-reports, cards are no area of ${UNIT}'s spec — name its areas by 1-cards, 2-refunds, tests`,
      'review reads: round 2 reads every area whose findings made fix tasks in round 1, and leaves out the test surface (tests)',
      'review reads: round 2 already reads 2-refunds — areas are added, never dropped',
    ]);
    reported(2, EVERY);
    recorded({ can_now: [], findings: [] });
    assert.strictEqual(refused(['reads', UNIT, '1-cards']), `review reads: ${UNIT}'s review phase passed in round 2 — finish is next`);
  });

  it('in step, while the round before\'s fix phase waits at its merge\'s gate — the lowest phase waiting named first, round 1\'s where a switch from auto left it unmerged (7.2.6) — and named once each has merged (14.6.2)', () => {
    secondRoundReady(FAILING);
    fixPhaseWritten(4, [['Send it once', '§1.2']]);
    recorded({ can_now: [], findings: [{ ...RECEIPT, fix: '4.1' }] });
    fixBuilt(4, 1, 'Send it once', 'main', 'src/once.js');
    inStep();
    const landed = (/** @type {string} */ task) => git(dir, ['commit', '-q', '--allow-empty', '-m', `feat(${UNIT}): landed`, '-m', `Task: ${UNIT}-${task}`]);
    const lowest = refused(['reads', UNIT, '1-cards']);
    landed('3-1');
    const next = refused(['reads', UNIT, '1-cards']);
    landed('4-1');

    const waits = (/** @type {number} */ phase) => `review reads: round 3 is read once round 2's fix phase has merged — phase ${phase} waits at its gate: render phase-merge-gate ${UNIT} ${phase}`;
    assert.deepStrictEqual([lowest, next], [waits(3), waits(4)]);
    assert.deepStrictEqual(named(['1-cards']).reads, ['1-cards']);
  });
});
