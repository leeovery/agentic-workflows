'use strict';

// ---------------------------------------------------------------------------
// A review round recorded (leeway-engine/scripts/domain/review-round.cjs,
// its records review-phase.cjs, the change review-change.cjs): `engine
// review round <unit> --file <round.json>`, and `engine inbox file <unit>
// --file <item.json>` (inbox.cjs). The round's record — the reports it
// read, its verdict theirs, what the person can now do, each finding with
// its area, scope, call, the report items it answers — two reviewers' one
// bug one finding — and where it landed, a fix task of the round's fix
// phase, an item filed, or dropped with why, each out of scope and each
// bug in scope dropped by a call of Claude's at `{unit}.review`
// (14.3.1–14.3.7), the settlement, each scenario's standing at the change's
// tips (15.3.3) — its checks, every report whole (14.4.2), and its commit;
// each round's fix tasks a phase of their own past the cut (P14, 14.S12);
// no count of rounds, a round failing again settled, said so and never
// passed (14.S15); and in step, the failing verdict stopping nothing
// (14.S14). The item filed: its file, its commit, and what it refuses
// (14.S5). What the round refuses is test-engine-review-refusals.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const path = require('path');
const { withFrozenClock } = require('./engine-harness.cjs');
const {
  UNIT, inStep, AREAS, EVERY, calls, useWorld, env, enter, payload, reportText, reported, recorded, refusedRound, fixPhaseWritten, fixBranch, stateText, lastStateCommit,
  reviewCall, filed, RECEIPT, FOUND, firstRoundReady, secondRoundReady,
  refusedPristine, statePath, writeState, git, assert,
} = require('./review-world.cjs');

const { runsRel } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/runs.cjs'));

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** `inbox file` refused, nothing written: its error. @param {object} item */
const refusedFiling = (item) => refusedPristine(dir, ['inbox', 'file', UNIT, '--file', payload('item.json', item)], { env: env() }).error;

/** Round 1's reports: area 1's pair each finding the receipt, the second a nit beside it; area 2's second a nit; the test reader a gap out of scope. */
const FIRST = Object.freeze({
  '1-cards-a': ['bug: The receipt is never sent.'],
  '1-cards-b': ['bug: No receipt follows a charge.', 'nit: The gateway retries on its own.'],
  '2-refunds-b': ['nit: A refund\'s label is terse.'],
  'tests-a': ['bug: A card\'s expiry is checked nowhere.'],
});
const NAMES = Object.freeze(['1-cards-a', '1-cards-b', '2-refunds-a', '2-refunds-b', 'tests-a']);

describe('review round: the round recorded, its report and checks written, and all committed with its reports', () => {
  it('14.S3, 14.S4, 14.S5: every item of every report answered by one finding, two reviewers\' one bug one finding — a fix task of the fix phase past the cut, a nit below the floor dropped with why, out of scope one filed and one dropped, each by Claude\'s call — every report read, each scenario\'s standing at the change\'s tips, and the areas the next round reads at least', () => {
    firstRoundReady();
    reported(1, EVERY, FIRST);
    const fileCall = reviewCall('Filed: a card\'s expiry is checked nowhere.', 'It is a gap beside the change.');
    const dropCall = reviewCall('Dropped: the gateway\'s own retry.', 'The gateway owns it.');
    const item = filed({ kind: 'idea', text: '# Card expiry\n\nNo screen checks a card\'s expiry.', call: fileCall });
    const inbox = path.relative(statePath(dir), item.filed);
    const findings = [
      { ...RECEIPT, from: ['1-cards-a#1', '1-cards-b#1'] },
      { area: '2-refunds', scope: 'in', call: 'nit', text: 'A refund\'s label is terse.', from: ['2-refunds-b#1'], drop: 'Below the floor: no failure follows.' },
      { area: 'tests', scope: 'out', call: 'bug', text: 'A card\'s expiry is checked nowhere.', from: ['tests-a#1'], inbox: item.filed, ledger: fileCall },
      { area: '1-cards', scope: 'out', call: 'nit', text: 'The gateway retries on its own.', from: ['1-cards-b#2'], drop: 'The gateway owns it.', ledger: dropCall },
    ];
    const res = recorded({ can_now: ['Pay by card.', 'Refund a charge.'], findings });

    assert.deepStrictEqual(res, { ok: true, round: 1, passed: false, fixes: ['3.1'], ends: false, fix_phase: 3, reads_at_least: ['1-cards'], areas: AREAS, committed: res.committed });
    assert.deepStrictEqual(JSON.parse(stateText(`${UNIT}/review/round-1.json`)), {
      reports: NAMES.map((name) => `${name}.md`),
      passed: false,
      can_now: ['Pay by card.', 'Refund a charge.'],
      findings: findings.map((finding) => (finding.inbox === undefined ? finding : { ...finding, inbox })),
      settled: null,
      scenarios: [{ scenario: '1.S1', standing: 'proven' }, { scenario: '1.S2', standing: 'not proven' }, { scenario: '2.S1', standing: 'named, not run' }],
    });
    assert.strictEqual(stateText(`${UNIT}/review/round-1-checks.md`), [
      '# Round 1\'s checks', ...NAMES.map((name) => `# ${name}\n\n${reportText(FIRST[name] ?? []).trimEnd()}`),
    ].join('\n\n') + '\n');
    assert.deepStrictEqual(lastStateCommit(), {
      subject: `review(${UNIT}): round 1`,
      files: [...NAMES.map((name) => `${UNIT}/review/round-1/${name}.md`), ...['-checks.md', '.json', '.md'].map((end) => `${UNIT}/review/round-1${end}`)].sort(),
    });
  });

  it('14.S12: each failing round\'s fix tasks are a phase of their own past the cut — round 1\'s phase 3, round 2\'s phase 4 — a fix naming the round before\'s phase refused', () => {
    secondRoundReady({ '1-cards-b': ['bug: The receipt names no amount.'] });
    fixPhaseWritten(4, [['Name the amount', '§1.2']]);
    const amount = { area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt names no amount.', from: ['1-cards-b#1'] };
    const wrong = refusedRound({ can_now: [], findings: [{ ...amount, fix: '3.1' }] });
    const res = recorded({ can_now: ['Pay by card.'], findings: [{ ...amount, fix: '4.1' }] });

    assert.strictEqual(wrong, 'review round: finding 1 names task 3.1, which is no task of phase 4 of pay, this round\'s fix phase');
    assert.deepStrictEqual(res, { ok: true, round: 2, passed: false, fixes: ['4.1'], ends: false, fix_phase: 4, reads_at_least: ['1-cards'], areas: AREAS, committed: res.committed });
  });

  it('15.3.3: a round\'s scenarios stand at the change\'s tips — a pass at the fix phase\'s tip proves the scenario that failed where the cut landed', () => {
    secondRoundReady();
    const tip = git(dir, ['rev-parse', fixBranch(3, 1, 'Send the receipt')]).trim();
    writeState(dir, `${runsRel(UNIT, '1.S2')}/run-002.json`, JSON.stringify({
      verdict: 'pass', unfixed: false, at: '2026-11-02T10:00:00.000Z', checkout: dir, commits: [{ repo: '.', commit: tip }], task: '3.1', evidence: [], recordings: [],
    }));
    recorded({ can_now: [], findings: [] });

    assert.deepStrictEqual(JSON.parse(stateText(`${UNIT}/review/round-2.json`)).scenarios, [
      { scenario: '1.S1', standing: 'proven' }, { scenario: '1.S2', standing: 'proven' }, { scenario: '2.S1', standing: 'named, not run' },
    ]);
  });

  it('14.S15: no count of rounds stops the review — a round failing again on a finding its fix addressed, dropped by Claude\'s call, is settled, and the review is over, said settled and never passed', () => {
    secondRoundReady({ '1-cards-a': ['bug: The receipt is never sent.'] });
    const call = reviewCall('Dropped: the reviewer read a stale build.', 'Task 3.1 sends the receipt.');
    const res = recorded({
      can_now: ['Pay by card.'], findings: [{ ...FOUND, from: ['1-cards-a#1'], drop: 'Fixed by 3.1; the reviewer read a stale build.', ledger: call }], settled: 'Task 3.1 sends the receipt; its test proves it.',
    });

    assert.deepStrictEqual(res, { ok: true, round: 2, passed: false, fixes: [], ends: true, areas: AREAS, committed: res.committed });
    assert.strictEqual(JSON.parse(stateText(`${UNIT}/review/round-2.json`)).settled, 'Task 3.1 sends the receipt; its test proves it.');
    assert.strictEqual(stateText(`${UNIT}/review/round-2.md`).split('\n')[0], 'Pay — review settled in round 2, the certificate of the work');
    assert.ok(enter().sections.includes('\nround: the review phase was settled in round 2 — finish is next\n'));
    assert.strictEqual(refusedRound({ can_now: [], findings: [] }), `review round: ${UNIT}'s review phase was settled in round 2 — finish is next`);
  });

  it('14.S14: in step, a failing round answers as in auto — its fix phase next, nothing stopping on its verdict', () => {
    inStep();
    firstRoundReady();
    const res = recorded({ can_now: [], findings: [RECEIPT] });

    assert.deepStrictEqual(res, { ok: true, round: 1, passed: false, fixes: ['3.1'], ends: false, fix_phase: 3, reads_at_least: ['1-cards'], areas: AREAS, committed: res.committed });
  });
});

describe('inbox file: a finding out of scope filed to the inbox (14.3.5, 6.1.15)', () => {
  it('14.S5: writes the item under its kind\'s folder, named by the day and its title, and commits it, by Claude\'s file call at the review', () => {
    enter();
    const call = reviewCall('Filed: refunds want their own receipt.', 'It is out of the change.');
    const res = filed({ kind: 'quick-fix', text: '# Refund receipts\n\nA refund sends no receipt.\n\n', call });
    const rel = '.inbox/quickfixes/2026-01-01--refund-receipts.md';

    assert.deepStrictEqual(res, { ok: true, filed: statePath(dir, rel), committed: res.committed });
    assert.deepStrictEqual([stateText(rel), lastStateCommit()], ['# Refund receipts\n\nA refund sends no receipt.\n', { subject: `workflow(inbox): file refund-receipts from ${UNIT}'s review`, files: [rel] }]);
  });

  it('refused, nothing written: a kind not the inbox\'s, a text with no title, a call not Claude\'s at the review, an item filed already, and a unit whose review phase cannot be entered', () => {
    const call = reviewCall('Filed.', 'Out of the change.');
    filed({ kind: 'idea', text: '# Card expiry', call });
    const half = refusedPristine(dir, ['inbox', 'file', 'half', '--file', payload('item.json', { kind: 'idea', text: '# X', call })], { env: env() }).error;

    assert.deepStrictEqual([
      refusedFiling({ kind: 'note', text: 'No title.', call: calls.pdf }),
      withFrozenClock(() => refusedFiling({ kind: 'idea', text: '# Card expiry\n\nAgain.', call })),
      refusedFiling({ kind: 'idea', text: '# X' }),
      half,
    ], [
      `inbox file: its kind is one of idea, bug, quick-fix, not "note"; its text holds its title, \`# Title\`; ${calls.pdf} is no decision made at ${UNIT}.review — a file-or-drop call is Claude's, written there: ledger decide ${UNIT}.review`,
      `inbox file: ${statePath(dir, '.inbox/ideas/2026-01-01--card-expiry.md')} is filed already — group this finding with it, or title it apart`,
      'inbox file: the item must be {kind, text, call}',
      'inbox file: half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
    ]);
  });
});
