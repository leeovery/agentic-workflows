'use strict';

// ---------------------------------------------------------------------------
// The review phase's screens (leeway-engine/scripts/domain/review-round.cjs,
// projections/review-phase.cjs): `engine render review-report <unit>
// [--round N]` — a round's report, product first: what the person can now
// do, what running it proved and what it did not, in the standing's words,
// the fix tasks the round made — fixed where done, not built where closed,
// else to build as their phase — what went to the inbox and never what was
// dropped, how a failing round was settled, and one line counting the calls
// decided for the person by the kind each carries, the unlabelled last, its
// checks never shown (14.4.1, 14.4.2, 15.3.3);
// the closing report once a round ends the review, every round broken up by
// round, each with only its own fix tasks, and the calls across the unit
// with the build's share (14.4.3) — each drawn from the records to it, each
// fix's standing in the tracker now and the calls as `review-calls` counts
// them, the file `review round` wrote keeping its fix tasks as filed,
// claiming no standing, and its calls as the round was recorded; and
// `engine render review-calls <unit>`, every call decided for the
// person across the unit, grouped by kind in the ledger's order of kinds,
// those that change what the product does first, then process and
// internals, the unlabelled last (14.4.4, 16.11.3, P11); and the stop once
// the cut is through, the review's own, refused while the review goes on
// without the person, naming what (12.13.22). Both hold back Claude's call
// a blind question waits on, gone ahead for its task (16.17.2).
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const path = require('path');
const { describe, it } = require('node:test');
const { call, output, refuses, sectionOf, ledgerEntries } = require('./engine-harness.cjs');
const {
  UNIT, SESSION_ID, EVERY, FAILING, RECEIPT, useWorld, env, enter, reported, named, recorded, firstRoundReady, firstRoundFailed, raisedAtReview, reviewCall, filed, fixPhaseWritten, fixBranch, fixBuilt, fixClosed, stateText, decided, statePath, assert,
} = require('./review-world.cjs');

const { appendEntry } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/ledger.cjs'));

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** A screen's text, its marker line aside. @param {string[]} args */
const screen = (args) => output(dir, ['render', ...args], { env: env() }).split('\n').slice(1).join('\n');

/** Round `round`'s part of a closing report. @param {string} text @param {number} round */
function roundPart(text, round) {
  const from = text.indexOf(`ROUND ${round} — `);
  const next = text.indexOf(`ROUND ${round + 1} — `, from);
  return text.slice(from, next < 0 ? text.indexOf('CALLS DECIDED FOR YOU', from) : next);
}

/** The calls a report counts, and those `review-calls` lists, as each is drawn now. */
const callCounts = () => [
  /** @type {RegExpExecArray} */ (/ {2}(\d+) calls/.exec(screen(['review-report', UNIT])))[1],
  /** @type {RegExpExecArray} */ (/ — (\d+) calls decided for you/.exec(screen(['review-calls', UNIT])))[1],
];

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
  it('14.S6, 14.S10, 14.S17, 15.S5: what the person can now do, each scenario proven or not in its standing\'s words, the fix tasks as their phase, what went to the inbox and not what was dropped, and the calls decided for the person counted by kind, the unlabelled last — its checks never shown; the round\'s file the same, its fix tasks as filed and its calls as the round was recorded', () => {
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
      `  5 calls: 1 danger · 1 words · 1 behaviour · 2 unlabelled — render review-calls ${UNIT} lists them`,
      '',
    ].join('\n'));
    assert.strictEqual(stateText(`${UNIT}/review/round-1.md`), shown.replace('TO FIX, PHASE 3', 'FIX TASKS, PHASE 3').replace('  5 calls:', '  5 calls, when round 1 was recorded:'));
  });

  it('a round that failed again and was settled says how; --round draws an earlier round from its record, its fix now built and the calls as they stand now; refused for a unit with no round recorded and a round not recorded', () => {
    const none = refuses(dir, ['render', 'review-report', UNIT], { env: env() }).error;
    firstRoundRecorded();
    const first = screen(['review-report', UNIT]);
    nextRound(2, 'Send the receipt', 'src/send.js');
    const drop = reviewCall('Dropped: the amount is on the statement.', 'The bank shows it.');
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt names no amount.', from: ['1-cards-b#1'], drop: 'The amount is on the card statement.', ledger: drop }], settled: 'The amount is the bank\'s to show.' });
    const settled = screen(['review-report', UNIT]);

    assert.ok(settled.startsWith('Pay — review settled in round 2, the certificate of the work\n'), settled);
    assert.ok(settled.includes('SETTLED\n  └─ The amount is the bank\'s to show.\n'), settled);
    assert.ok(first.includes('  5 calls: 1 danger · 1 words · 1 behaviour · 2 unlabelled — render review-calls'), first);
    assert.strictEqual(screen(['review-report', UNIT, '--round', '1']), first.replace('TO FIX, PHASE 3 (1 task)\n  └─ 3.1 The receipt is never sent.', 'FIXED (1)\n  └─ The receipt is never sent.').replace('  5 calls: 1 danger · 1 words · 1 behaviour · 2 unlabelled', '  6 calls: 1 danger · 1 words · 1 behaviour · 3 unlabelled'));
    assert.deepStrictEqual([none, refuses(dir, ['render', 'review-report', UNIT, '--round', '3'], { env: env() }).error], [
      `render review-report: ${UNIT}'s review phase has recorded no round yet — review round ${UNIT} --file <round.json> records one`,
      'render review-report: --round names a round recorded, 1 to 2',
    ]);
  });

  it('14.S7: the review passing on its third round closes with every round, broken up by round, each with only the fix tasks it made, and the calls across the unit with the build\'s share', () => {
    firstRoundRecorded();
    nextRound(2, 'Send the receipt', 'src/send.js');
    fixPhaseWritten(4, [['Name the amount', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt names no amount.', from: ['1-cards-b#1'], fix: '4.1' }] });
    nextRound(3, 'Name the amount', 'src/amount.js');
    recorded({ can_now: ['Pay by card and keep the receipt.'], findings: [] });
    const shown = screen(['review-report', UNIT]);

    const lines = (/** @type {string} */ text) => text.split('\n').filter((line) => /^(Pay|ROUND|FIXED|NOT BUILT|TO FIX|FIX TASKS|CALLS|  \d+ calls|  └─ (\d\.\d )?The receipt)/.test(line));
    const calls = `  5 calls across the work unit, 3 of them in the build: 1 danger · 1 words · 1 behaviour · 2 unlabelled — render review-calls ${UNIT} lists them`;

    assert.deepStrictEqual(lines(shown), [
      'Pay — review passed in round 3, the certificate of the work',
      'ROUND 1 — failed — 1 fix task, phase 3',
      'FIXED (1)',
      '  └─ The receipt is never sent.',
      'ROUND 2 — failed — 1 fix task, phase 4',
      'FIXED (1)',
      '  └─ The receipt names no amount.',
      'ROUND 3 — passed',
      'CALLS DECIDED FOR YOU',
      calls,
    ]);
    assert.deepStrictEqual(lines(stateText(`${UNIT}/review/round-3.md`)), [
      'Pay — review passed in round 3, the certificate of the work',
      'ROUND 1 — failed — 1 fix task, phase 3',
      'FIX TASKS, PHASE 3 (1 task)',
      '  └─ 3.1 The receipt is never sent.',
      'ROUND 2 — failed — 1 fix task, phase 4',
      'FIX TASKS, PHASE 4 (1 task)',
      '  └─ 4.1 The receipt names no amount.',
      'ROUND 3 — passed',
      'CALLS DECIDED FOR YOU',
      calls.replace(':', ', when round 3 was recorded:'),
    ]);
  });

  it('14.4.1: each round\'s fixes stand as the tracker holds them when drawn — one whose task was closed shown not built, never fixed; a passing round\'s nit fix to build, then fixed once built — and the calls counted as review-calls counts them, one made in that build among them; the round\'s file keeping each round\'s fix tasks as filed and its calls as the round was recorded', () => {
    firstRoundRecorded();
    fixClosed(3, 1);
    enter();
    named(['1-cards']);
    reported(2, ['1-cards'], { '1-cards-a': ['nit: The receipt\'s label is terse.'] });
    fixPhaseWritten(4, [['Word the label', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'nit', text: 'The receipt\'s label is terse.', from: ['1-cards-a#1'], fix: '4.1' }] });
    const building = screen(['review-report', UNIT]);
    const counted = callCounts();
    fixBuilt(4, 1, 'Word the label', 'main', 'src/label.js');
    decided(dir, `${UNIT}.implementation`, 'Is the label one word?', { by: 'claude', text: 'Two words.', why: 'It reads plainer.' });
    const built = screen(['review-report', UNIT]);
    const file = stateText(`${UNIT}/review/round-2.md`);
    const unbuilt = 'NOT BUILT (1)\n  └─ The receipt is never sent. — its fix task was closed';

    assert.deepStrictEqual([roundPart(building, 1).includes(unbuilt), roundPart(building, 2).includes('TO FIX, PHASE 4 (1 task)\n  └─ 4.1 The receipt\'s label is terse.')], [true, true]);
    assert.deepStrictEqual([roundPart(built, 1).includes(unbuilt), roundPart(built, 2).includes('FIXED (1)\n  └─ The receipt\'s label is terse.')], [true, true]);
    assert.doesNotMatch(roundPart(building, 2), /NOT BUILT|FIXED/);
    assert.doesNotMatch(roundPart(built, 2), /NOT BUILT|TO FIX/);
    assert.doesNotMatch(roundPart(built, 1), /FIXED|TO FIX/);
    assert.deepStrictEqual([counted, callCounts()], [['5', '5'], ['6', '6']]);
    assert.doesNotMatch(file, /FIXED|NOT BUILT|TO FIX/);
    assert.match(roundPart(file, 1), /FIX TASKS, PHASE 3 \(1 task\)\n {2}└─ 3\.1 The receipt is never sent\./);
    assert.match(roundPart(file, 2), /FIX TASKS, PHASE 4 \(1 task\)\n {2}└─ 4\.1 The receipt's label is terse\./);
    assert.match(file, / {2}5 calls across the work unit, 3 of them in the build, when round 2 was recorded: /);
  });
});

describe('a blind question\'s call gone ahead, held back (16.17.2)', () => {
  /**
   * A blind question waiting on Claude's call `id`, which went ahead for
   * task `task` (16.17.6), its park as the raise lands it.
   * @param {string} id @param {string} task
   */
  function blindOn(id, task) {
    const { id: call, answers } = /** @type {{id: string, answers: string}} */ (ledgerEntries(statePath(dir)).find((line) => String(line.id).startsWith(id)));
    appendEntry(statePath(dir), {
      event: 'parked', unit: UNIT, topic: null, phase: 'implementation', session: SESSION_ID,
      question: null, replaces: call, reason: 'asked-blind', cause: null, relies_on: [], task: null, went_ahead: task, number: 1,
      call: {
        question: 'Is the label one word?',
        rows: [{ key: '1', name: 'Two', text: 'Two words.', notice: 'the label reads plainer' }, { key: '2', name: 'One', text: 'One word.', notice: 'the label is shorter' }],
        lean: '1', why: 'It reads plainer.', sort: 'several', mechanism: 'The label\'s text.', product_wide: false,
      },
      rows_judged: [], why_asking: 'Asked cold.', label: null, model: null, blocks_build: true, replaced_by: null, always: null, measured: null, chain: answers, blind: true,
    }, []);
  }

  it('the report\'s count of the calls decided for the person holds back Claude\'s call a blind question waits on, gone ahead for its task, as review-calls does, the two agreeing', () => {
    firstRoundRecorded();
    const made = decided(dir, `${UNIT}.implementation`, 'Is the label one word?', { by: 'claude', text: 'Two words.', why: 'It reads plainer.' });
    const counted = callCounts();

    blindOn(made, '4.1');

    assert.deepStrictEqual([counted, callCounts()], [['6', '6'], ['5', '5']]);
  });
});

describe('render review-calls: the calls decided for the person (14.4.4)', () => {
  it('14.S8, 14.S16: every call decided for the person across the unit, grouped by kind in the ledger\'s order — those changing what the product does first, then process, the unlabelled last — never the person\'s own, nor one replaced', () => {
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

describe('render build-stop: the review stopped (12.13.22)', () => {
  it('once every phase of the cut has closed, the review has stopped, under its own marker naming the fix phase running and the position', async () => {
    firstRoundFailed();
    await raisedAtReview('Should a receipt be sent by email?', '3.1');
    const out = output(dir, ['render', 'build-stop', UNIT], { env: env() });

    assert.deepStrictEqual([sectionOf(out, 'DISPLAY: build marker'), sectionOf(out, 'DISPLAY: build stop')], [
      '**`□ Review (the review\'s fixes, round 1) · auto`**\n', '⚑ The review has stopped: nothing more can go on until you answer\n',
    ]);
  });

  it('refuses while the review goes on without the person, naming what — a round\'s readers to brief or still reading, a fix task ready, the next round\'s reads to name; once every report of a round is in, it is drawn', async () => {
    /** The stop's refusal, or 'drawn'. */
    const stop = () => {
      const res = call(dir, ['render', 'build-stop', UNIT], { env: env() });
      return res.code === 0 ? 'drawn' : JSON.parse(res.stderr).error.replace(/ — it stops only where nothing can go on without the person's answer \(12\.13\.22\)$/, '');
    };
    enter();
    await raisedAtReview('Should a refund send a receipt too?');
    const briefing = stop();
    reported(1, EVERY, FAILING);
    const reportsIn = stop();
    fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    const fixing = stop();
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    const naming = stop();
    named(['1-cards']);

    assert.deepStrictEqual([briefing, reportsIn, fixing, naming, stop()], [
      `render build-stop: ${UNIT}'s review goes on: round 1's readers are still to brief or reading: 1-cards-a, 1-cards-b, 2-refunds-a, 2-refunds-b, tests-a`,
      'drawn',
      `render build-stop: ${UNIT}'s build goes on with task 3.1, which no question parks`,
      `render build-stop: ${UNIT}'s review goes on: round 2's reads are named next: review reads ${UNIT} <area> …`,
      `render build-stop: ${UNIT}'s review goes on: round 2's readers are still to brief or reading: 1-cards-a, 1-cards-b`,
    ]);
  });
});
