'use strict';

// ---------------------------------------------------------------------------
// A review round recorded on the board (leeway-engine/scripts/domain/
// projections/board-review.cjs, 20.10.1–20.10.4, 14.S15): the checks each
// area ran, its findings, its checks not proven, what went to the inbox,
// its verdict and its fix tasks as the build's next phase; a later round's
// own findings beside the earlier round's fix tasks; a finding's page and a
// check's; and that reading it writes nothing. A round that ends the phase
// is test-engine-board-review-rounds-end.cjs; the round under way,
// test-engine-board-review.cjs.
//
// Layer: verb. World: the review phase's (review-world.cjs) — `pay`, its
// build finished, its spec of two areas — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  UNIT, EVERY, RECEIPT, useWorld, env, enter, reported, named, recorded, fixPhaseWritten, fixBuilt, reviewCall, filed, firstRoundReady, ok, git,
} = require('./review-world.cjs');
const { treeSnapshot, head: stateHead } = require('./engine-harness.cjs');
const { fixture, misfits } = require('./board-world.cjs');
const { area, tests, reviewBoard } = require('./review-board-world.cjs');

/** @type {string} */
let dir;
useWorld((made) => {
  dir = made;
});

const { board, head } = reviewBoard(() => dir);

/** Round 1 recorded failing: area 1's receipt fixed by task 3.1, not yet built, and a card's expiry, out of scope, filed to the inbox. */
function roundOneFiled() {
  enter();
  reported(1, EVERY, { '1-cards-a': ['bug: The receipt is never sent.'], '1-cards-b': ['bug: A card\'s expiry is checked nowhere.'] });
  fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
  const call = reviewCall('Filed: a card\'s expiry is checked nowhere.', 'It is a gap beside the change.');
  const item = filed({ kind: 'idea', text: '# Card expiry\n\nNo screen checks a card\'s expiry.', call });
  recorded({
    can_now: ['Pay by card.'],
    findings: [RECEIPT, { area: '1-cards', scope: 'out', call: 'bug', text: 'A card\'s expiry is checked nowhere.', from: ['1-cards-b#1'], inbox: item.filed, ledger: call }],
  });
  enter();
}

describe('a round recorded (20.10.1, 20.10.2)', () => {
  it('a failing round shows its finding in scope, its verdict and its fix tasks as the build\'s phase after the cut until the next round opens; open, the next waits on the areas they changed, every other unchanged, the fix task built counted among the tasks built (20.10.2); the banner says the round fails, its fix tasks building while any is not done, then the next round reading (D36); drawing it writes nothing (20.1); the unit\'s tab says what each phase\'s records hold (20.15.1); and its pages (20.10.3): while it is read, a finding as its reviewer\'s report holds it, by its report item, and a check as it stands at the change\'s tips (N4); recorded, a finding in full — its area, scope, call, words and the fix task it went to — by its number or the report item it answers, and a check by where the round stands it; what the round lacks or never ran unavailable, saying why', () => {
    firstRoundReady();
    const pages = () => [board(['--page', 'finding:1:1-cards-a#1']).view, board(['--page', 'check:1:1.S2']).view];
    const reading = pages();
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    const read = pages();
    const unavailable = ['finding:1:2', 'finding:1:1-cards-b#1', 'check:1:3.S1'].map((ref) => board(['--page', ref]).view.reason);
    const byNumber = board(['--page', 'finding:1:1']).view;
    enter();
    const standing = () => ({ tree: treeSnapshot(dir), state: stateHead(dir), project: git(dir, ['rev-parse', 'HEAD']).trim() });
    const before = standing();
    const { view: failed, banner: failing } = board();
    const after = standing();
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    const built = board().banner;
    named(['1-cards']);
    const found = [{ round: 1, finding: 1, from: null, area: '1-cards', call: 'bug', text: 'The receipt is never sent.' }];
    const fixes = (/** @type {string} */ state) => ({ phase: 3, round: 1, tasks: [{ task: '3.1', title: 'Send the receipt', state, since: null, on: [] }] });

    assert.deepStrictEqual(after, before);
    assert.deepStrictEqual([failed, board().view], [
      {
        ...head(1), recorded: true, areas: [area('1', 'Cards', 'read', { ran: 2, found: 1 }), area('2', 'Refunds', 'read', { ran: 1 }), tests('read')], found, not_proven: failed.not_proven, inbox: [], verdict: 'failed', fixes: fixes('not-started'),
      },
      {
        ...head(2), built: 4, recorded: false, areas: [area('1', 'Cards', 'waiting'), area('2', 'Refunds', 'unchanged'), tests('unchanged')], found: [], not_proven: failed.not_proven, inbox: [], verdict: null, fixes: fixes('done'),
      },
    ]);
    assert.deepStrictEqual(failed.not_proven.map(/** @param {{round: number}} check */ ({ round }) => round), [1, 1], 'round 1\'s checks stand under round 2 until it is recorded (N2)');
    assert.deepStrictEqual([failing, built, board().banner].map(({ state, facts: said }) => [state, said.at(-1).text]), [
      ['running', 'round 1 fails · fix tasks building'],
      ['running', 'round 1 fails'],
      ['running', 'round 2 reading'],
    ]);
    assert.deepStrictEqual(board(['--tab', 'unit']).view.phases.slice(2).map(({ phase, state, words }) => ({ phase, state, words })), [
      { phase: 'specification', state: 'complete', words: '2 sections · 2 build phases' },
      { phase: 'build', state: 'complete', words: '3 tasks done' },
      { phase: 'review', state: 'running', words: 'round 2' },
    ]);
    const check = { kind: 'check', unit: UNIT, round: 1, scenario: '1.S2', standing: 'not proven', text: 'Given a charge, when it lands, then a receipt follows.' };
    const receipt = { kind: 'finding', unit: UNIT, round: 1, finding: 1, area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt is never sent.', fix: '3.1', inbox: null, reviewer: null };

    assert.deepStrictEqual([reading, read, byNumber], [
      [{ kind: 'finding', unit: UNIT, round: 1, finding: null, area: '1-cards', scope: null, call: 'bug', text: 'The receipt is never sent.\nScenario: A customer pays.', fix: null, inbox: null, reviewer: 'a' }, check],
      [receipt, check],
      receipt,
    ]);
    assert.deepStrictEqual(unavailable, [
      'round 1 of pay\'s review holds no finding 2',
      'round 1 of pay\'s review holds no finding 1-cards-b#1',
      'round 1 of pay\'s review ran no check of 3.S1',
    ]);
  });

  it('a later round under way shows only what its own landed reports found, round 1\'s checks not proven, what round 1 filed to the inbox and round 1\'s fix tasks; recorded passing, it keeps those fix tasks and that filing (N2); the fix task\'s page lists each finding that went to it, and no other (D17); and the reviews the mod reads are shaped as these, round 1 failed and round 2 passed, every list holding one at least (N7)', async () => {
    roundOneFiled();
    const failed = board().view;
    const fixPage = board(['--page', 'task:3.1']).view.fixes;
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    reported(2, ['1-cards'], { '1-cards-a': ['nit: The receipt says Reciept.'] });
    const reading = board().view;
    reported(2, ['1-cards']);
    recorded({ can_now: ['Pay by card.'], findings: [] });
    const passed = board().view;
    const filedOne = [{ round: 1, finding: 2, text: 'A card\'s expiry is checked nowhere.' }];
    const held = (/** @type {any} */ view) => [view.found.length > 0, view.not_proven.length > 0, view.inbox.length > 0, view.fixes?.tasks.length > 0];
    const [failing, ended] = [await fixture('board-review-failed.mjs'), await fixture('board-review.mjs')];

    assert.deepStrictEqual(
      [reading.found, reading.not_proven.map(({ round }) => round), reading.inbox, [reading.fixes.phase, reading.fixes.round]],
      [[{ round: 2, finding: null, from: '1-cards-a#1', area: '1-cards', call: 'nit', text: 'The receipt says Reciept.' }], [1, 1], filedOne, [3, 1]],
    );
    assert.deepStrictEqual([passed.verdict, passed.found, passed.inbox, [passed.fixes.phase, passed.fixes.round]], ['passed', [], filedOne, [3, 1]]);
    assert.deepStrictEqual(fixPage, [{ round: 1, finding: 1, from: null, area: '1-cards', call: 'bug', text: 'The receipt is never sent.' }]);
    assert.deepStrictEqual(
      [misfits(failing, failed), misfits(ended, passed), held(failing), held(failed), held(ended).slice(1), held(passed).slice(1)],
      [[], [], [true, true, true, true], [true, true, true, true], [true, true, true], [true, true, true]],
    );
  });

  it('This session follows the session from its build into its review phase (20.3.4)', () => {
    ok(dir, ['enter', 'implementation', UNIT], { env: env() });
    const inBuild = board().view.kind;
    enter();

    assert.deepStrictEqual([inBuild, board().view.kind], ['build', 'review']);
  });
});
