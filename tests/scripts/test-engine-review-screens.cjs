'use strict';

// ---------------------------------------------------------------------------
// The review phase's screens (leeway-engine/scripts/domain/review-round.cjs,
// projections/review-phase.cjs): `engine render review-report <unit>
// [--round N]` — a round's report, product first: what the person can now
// do, what running it proved and what it did not, in the standing's words,
// what was fixed — a fix task done — and what was not built — one closed —
// the round's fix tasks still to build as their phase, what went to the
// inbox and never what was dropped, how a failing round was settled, and one
// line counting the calls decided for the person as the round recorded them,
// its checks never shown (14.4.1, 14.4.2, 15.3.3); the closing report once
// a round ends the review, every round broken up by round and the calls
// across the unit with the build's share (14.4.3) — each drawn from the
// records to it and each fix's standing in the tracker now, the file
// `review round` wrote keeping its fix tasks as filed and claiming no
// standing; and `engine render review-calls <unit>`, every call decided for the
// person across the unit, grouped by kind in the ledger's order of kinds,
// those that change what the product does first, then process and
// internals, the unlabelled last (14.4.4, 16.11.3, P11).
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const { output, refuses, sectionOf } = require('./engine-harness.cjs');
const {
  UNIT, EVERY, FAILING, RECEIPT, useWorld, env, enter, reported, named, recorded, firstRoundReady, reviewCall, filed, fixPhaseWritten, fixBranch, fixBuilt, fixClosed, stateText, decided, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** A screen's text, its marker line aside. @param {string[]} args */
const screen = (args) => output(dir, ['render', ...args], { env: env() }).split('\n').slice(1).join('\n');

/**
 * Round 1 recorded failing: area 1's receipt fixed by 3.1, a finding out of
 * scope filed to the inbox by Claude's call, a nit dropped below the floor.
 */
function firstRoundRecorded() {
  firstRoundReady();
  reported(1, EVERY, { ...FAILING, 'tests-a': ['bug: A card\'s expiry is checked nowhere.'], '2-refunds-a': ['nit: A refund\'s label is terse.'] });
  const call = reviewCall('Filed.', 'It is out of the change.');
  const item = filed({ kind: 'idea', text: '# Card expiry\n\nNothing checks it.', call });
  recorded({ can_now: ['Pay by card.'], findings: [
    RECEIPT,
    { area: 'tests', scope: 'out', call: 'bug', text: 'A card\'s expiry is checked nowhere.', from: ['tests-a#1'], inbox: item.filed, ledger: call },
    { area: '2-refunds', scope: 'in', call: 'nit', text: 'A refund\'s label is terse.', from: ['2-refunds-a#1'], drop: 'Below the floor.' },
  ] });
}

/**
 * Round `round` under review once round `round - 1`'s fix task, `{round + 1}.1`, is built, chained on the fix before it.
 * @param {number} round @param {string} title @param {string} file
 */
function nextRound(round, title, file) {
  fixBuilt(round + 1, 1, title, round === 2 ? 'main' : fixBranch(3, 1, 'Send the receipt'), file);
  enter();
  named(['1-cards']);
  reported(round, ['1-cards'], round === 3 ? {} : { '1-cards-b': ['bug: The receipt names no amount.'] });
}

describe('render review-report: a round\'s report (14.4.1)', () => {
  it('14.S6, 14.S10, 15.S5: what the person can now do, each scenario proven or not in its standing\'s words, the fix tasks as their phase, what went to the inbox and not what was dropped, and the calls decided for the person counted — its checks never shown, the text the round wrote', () => {
    firstRoundRecorded();
    const shown = screen(['review-report', UNIT]);

    assert.strictEqual(shown, [
      'Pay — review, round 1: failed — 1 fix task, phase 3',
      '',
      'WHAT YOU CAN NOW DO',
      '  └─ Pay by card.',
      '',
      'PROVEN BY RUNNING IT (1 of 3)',
      '  └─ 1.S1 Given a card form, when the number is typed, then it is',
      '     checked.',
      '',
      'NOT PROVEN (2)',
      '  ├─ 1.S2 Given a charge, when it lands, then a receipt follows.',
      '  │  — not proven',
      '  └─ 2.S1 Given a charge, when it is refunded whole, then the',
      '     card is credited. — named, not run',
      '',
      'TO FIX, PHASE 3 (1 task)',
      '  └─ 3.1 The receipt is never sent.',
      '',
      'WENT TO THE INBOX (1)',
      '  └─ Card expiry (idea)',
      '',
      'CALLS DECIDED FOR YOU',
      `  5 calls — render review-calls ${UNIT} lists them`,
      '',
    ].join('\n'));
    assert.strictEqual(shown, `${stateText(`${UNIT}/review/round-1.md`)}`);
  });

  it('a round that failed again and was settled says how; --round draws an earlier round from its record, its calls as it counted them, its fix now built; refused for a unit with no round recorded and a round not recorded', () => {
    const none = refuses(dir, ['render', 'review-report', UNIT], { env: env() }).error;
    firstRoundRecorded();
    const first = screen(['review-report', UNIT]);
    nextRound(2, 'Send the receipt', 'src/send.js');
    const drop = reviewCall('Dropped: the amount is on the statement.', 'The bank shows it.');
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt names no amount.', from: ['1-cards-b#1'], drop: 'The amount is on the card statement.', ledger: drop }], settled: 'The amount is the bank\'s to show.' });
    const settled = screen(['review-report', UNIT]);

    assert.ok(settled.startsWith('Pay — review settled in round 2, the certificate of the work\n'), settled);
    assert.ok(settled.includes('SETTLED\n  └─ The amount is the bank\'s to show.\n'), settled);
    assert.ok(first.includes('  5 calls — render review-calls'), first);
    assert.strictEqual(screen(['review-report', UNIT, '--round', '1']), first.replace('TO FIX, PHASE 3 (1 task)\n  └─ 3.1 The receipt is never sent.', 'FIXED (1)\n  └─ The receipt is never sent.'));
    assert.deepStrictEqual([none, refuses(dir, ['render', 'review-report', UNIT, '--round', '3'], { env: env() }).error], [
      `render review-report: ${UNIT}'s review phase has recorded no round yet — review round ${UNIT} --file <round.json> records one`,
      'render review-report: --round names a round recorded, 1 to 2',
    ]);
  });

  it('14.S7: the review passing on its third round closes with every round, broken up by round, and the calls across the unit with the build\'s share', () => {
    firstRoundRecorded();
    nextRound(2, 'Send the receipt', 'src/send.js');
    fixPhaseWritten(4, [['Name the amount', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt names no amount.', from: ['1-cards-b#1'], fix: '4.1' }] });
    nextRound(3, 'Name the amount', 'src/amount.js');
    recorded({ can_now: ['Pay by card and keep the receipt.'], findings: [] });
    const shown = screen(['review-report', UNIT]);

    const lines = (/** @type {string} */ text) => text.split('\n').filter((line) => /^(Pay|ROUND|FIXED|NOT BUILT|TO FIX|CALLS|  \d+ calls)/.test(line));
    const calls = `  5 calls across the work unit, 3 of them in the build — render review-calls ${UNIT} lists them`;

    assert.deepStrictEqual(lines(shown), [
      'Pay — review passed in round 3, the certificate of the work',
      'ROUND 1 — failed — 1 fix task, phase 3',
      'FIXED (1)',
      'ROUND 2 — failed — 1 fix task, phase 4',
      'FIXED (2)',
      'ROUND 3 — passed',
      'FIXED (2)',
      'CALLS DECIDED FOR YOU',
      calls,
    ]);
    assert.deepStrictEqual(lines(stateText(`${UNIT}/review/round-3.md`)), [
      'Pay — review passed in round 3, the certificate of the work',
      'ROUND 1 — failed — 1 fix task, phase 3',
      'TO FIX, PHASE 3 (1 task)',
      'ROUND 2 — failed — 1 fix task, phase 4',
      'TO FIX, PHASE 4 (1 task)',
      'ROUND 3 — passed',
      'CALLS DECIDED FOR YOU',
      calls,
    ]);
  });

  it('14.4.1: each fix stands as the tracker holds it when drawn — one whose task was closed shown not built, never fixed; a passing round\'s nit fix to build, then fixed once built — the round\'s file keeping its fix tasks as filed', () => {
    firstRoundRecorded();
    fixClosed(3, 1);
    enter();
    named(['1-cards']);
    reported(2, ['1-cards'], { '1-cards-a': ['nit: The receipt\'s label is terse.'] });
    fixPhaseWritten(4, [['Word the label', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'nit', text: 'The receipt\'s label is terse.', from: ['1-cards-a#1'], fix: '4.1' }] });
    const building = screen(['review-report', UNIT]);
    fixBuilt(4, 1, 'Word the label', 'main', 'src/label.js');
    const round2 = (/** @type {string} */ text) => text.slice(text.indexOf('ROUND 2 — '), text.indexOf('CALLS DECIDED FOR YOU'));

    assert.strictEqual(round2(building), [
      'ROUND 2 — passed — 1 fix task, phase 4', 'WHAT YOU CAN NOW DO\n  └─ Pay by card.', building.slice(building.indexOf('PROVEN BY RUNNING IT', building.indexOf('ROUND 2')), building.indexOf('NOT BUILT', building.indexOf('ROUND 2'))).trimEnd(),
      'NOT BUILT (1)\n  └─ The receipt is never sent. — its fix task was closed', 'TO FIX, PHASE 4 (1 task)\n  └─ 4.1 The receipt\'s label is terse.', '',
    ].join('\n\n'));
    assert.ok(round2(screen(['review-report', UNIT])).includes('FIXED (1)\n  └─ The receipt\'s label is terse.\n\nNOT BUILT (1)\n  └─ The receipt is never sent. — its fix task was closed\n\n'));
    assert.doesNotMatch(round2(screen(['review-report', UNIT])), /TO FIX/);
    assert.doesNotMatch(stateText(`${UNIT}/review/round-2.md`), /FIXED|NOT BUILT/);
    assert.match(round2(stateText(`${UNIT}/review/round-2.md`)), /TO FIX, PHASE 4 \(1 task\)\n  └─ 4\.1 The receipt's label is terse\./);
  });
});

describe('render review-calls: the calls decided for the person (14.4.4)', () => {
  it('14.S8: every call decided for the person across the unit, grouped by kind in the ledger\'s order — those changing what the product does first, then process, the unlabelled last — never the person\'s own, nor one replaced', () => {
    decided(dir, `${UNIT}.review`, 'Is the expiry finding filed or dropped?', { by: 'claude', text: 'Filed.', why: 'It is out of the change.' });
    decided(dir, `${UNIT}.implementation`, 'Is each task\'s branch kept?', { by: 'claude', text: 'Branches are kept.', why: 'They are cheap.', kind: 'process' });

    assert.strictEqual(sectionOf(output(dir, ['render', 'review-calls', UNIT], { env: env() }), 'DISPLAY: review calls'), [
      'Pay — 6 calls decided for you',
      '',
      'DANGER (1)',
      '  └─ ◇ How is a card kept?    [specification]',
      '        A card is tokenised.',
      '',
      'WORDS (1)',
      '  └─ ◇ What does the receipt say?    [specification]',
      '        The receipt names the shop.',
      '',
      'BEHAVIOUR (1)',
      '  └─ ◇ What form is the receipt?    [implementation · your call]',
      '        The receipt is a PDF.',
      '',
      'PROCESS (1)',
      '  └─ ◇ Is each task\'s branch kept?    [implementation]',
      '        Branches are kept.',
      '',
      'UNLABELLED (2)',
      '  ├─ ◇ How often is a charge retried?          [implementation]',
      '  │     A charge is retried twice.',
      '  └─ ◇ Is the expiry finding filed or dropped? [review]',
      '        Filed.',
      '',
    ].join('\n'));
  });

  it('a unit whose calls were all the person\'s says so', () => {
    assert.ok(screen(['review-calls', 'solo']).startsWith('Solo — 0 calls decided for you\n\n  None — every call in this work unit was yours.'));
  });
});
