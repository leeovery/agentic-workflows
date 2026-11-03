'use strict';

// ---------------------------------------------------------------------------
// What `engine review round <unit> --file <round.json>` refuses, writing
// nothing (leeway-engine/scripts/domain/review-round.cjs, its records
// review-phase.cjs): a call of another shape, as `inbox file`'s is
// (inbox.cjs); a working tree changed outside `.leeway/` since the snapshot
// — a path's status, what it holds, a HEAD moved — naming every path,
// reverting none, and naming the person's way on (12.7.8, 14.S13); no
// snapshot; a unit its entry refuses; a review over; fix tasks of the round
// before not done, and a later round's reads not named (14.3.3); reports
// missing or not reading; a payload of another shape, every fault named —
// where each finding landed, its scope and its file-or-drop call
// (14.3.1–14.3.7) — and every report item answered by exactly one finding,
// at its call; and a verdict neither fixed nor settled, or settled and
// fixed (14.6.3). What it records is test-engine-review-round.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const {
  UNIT, EVERY, calls, useWorld, env, enter, payload, reported, named, recorded, refusedRound, decided, reviewCall, fixBuilt, RECEIPT, FOUND, firstRoundReady,
  ok, refusedPristine, statePath, writeState, git, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** The tree refusal, naming what changed. @param {string} changed */
const treeMoved = (changed) => `review round: the working tree outside .leeway/ changed since the snapshot the round is held to: ${changed} — nothing is reverted; the person decides what stands, and on their word review accept-tree ${UNIT} takes the tree as it is`;

describe('review round: what it refuses, writing nothing', () => {
  it('a call of another shape, as inbox file\'s is: a verb it lacks, no unit, no payload or reads, an extra word, a flag it takes none of', () => {
    const file = payload('round.json', { can_now: [], findings: [] });
    const usage = (/** @type {string[]} */ args) => refusedPristine(dir, args, { env: env() }).error;
    const reviewUsage = 'Usage: engine review round <work-unit> --file <round.json> | engine review reads <work-unit> <area|tests> [<area|tests> …] | engine review accept-tree <work-unit>';

    for (const args of [
      ['review', 'record', UNIT, '--file', file], ['review', 'round', '--file', file], ['review', 'round', UNIT], ['review', 'round', UNIT, 'more', '--file', file], ['review', 'round', UNIT, '--file', file, '--force', 'x'],
      ['review', 'reads', UNIT], ['review', 'reads', UNIT, '1-cards', '--file', file], ['review', 'accept-tree'], ['review', 'accept-tree', UNIT, 'more'],
    ]) {
      assert.strictEqual(usage(args), reviewUsage, args.join(' '));
    }
    for (const args of [['inbox', 'file', '--file', file], ['inbox', 'file', UNIT], ['inbox', 'file', UNIT, 'more', '--file', file], ['inbox', 'file', UNIT, '--file', file, '--kind', 'idea']]) {
      assert.strictEqual(usage(args), 'Usage: engine inbox <archive|restore|delete> <path> [<path> …] | engine inbox file <work-unit> --file <item.json>', args.join(' '));
    }
  });

  it('14.S13: a working tree changed outside .leeway/ since the snapshot, naming every path and the person\'s way on, the change left as it stands', () => {
    firstRoundReady();
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 2;\n');
    fs.writeFileSync(path.join(dir, 'src/stray.js'), 'export const stray = 1;\n');

    assert.strictEqual(refusedRound({ can_now: [], findings: [RECEIPT] }), treeMoved('src/card.js, src/stray.js'));
    assert.deepStrictEqual([fs.readFileSync(path.join(dir, 'src/card.js'), 'utf8'), fs.existsSync(path.join(dir, 'src/stray.js'))], ['export const card = 2;\n', true]);
  });

  it('a file already changed when the snapshot was taken and changed again since, its status the same, told by what it holds', () => {
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 2;\n');
    firstRoundReady();
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 3;\n');

    assert.strictEqual(refusedRound({ can_now: [], findings: [RECEIPT] }), treeMoved('src/card.js'));
  });

  it('a commit made since the snapshot, naming the repository and where its HEAD moved', () => {
    firstRoundReady();
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'a stray commit']);
    const after = git(dir, ['rev-parse', 'HEAD']).trim();

    assert.strictEqual(refusedRound({ can_now: [], findings: [RECEIPT] }), treeMoved(`the project's repository is at ${after.slice(0, 7)}, not ${before.slice(0, 7)}`));
  });

  it('no snapshot of a later round\'s held, its cache lost mid-round, naming the person\'s way on — never entering again; a unit whose review phase cannot be entered; and a review phase over', () => {
    firstRoundReady();
    recorded({ can_now: [], findings: [RECEIPT] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    named(['1-cards']);
    reported(2, ['1-cards']);
    fs.rmSync(statePath(dir, `.cache/${UNIT}/review/tree.json`));
    enter();
    const none = refusedRound({ can_now: [], findings: [] });
    const half = refusedPristine(dir, ['review', 'round', 'half', '--file', payload('round.json', { can_now: [], findings: [] })], { env: env() }).error;
    ok(dir, ['review', 'accept-tree', UNIT], { env: env() });
    recorded({ can_now: [], findings: [] });

    assert.deepStrictEqual([none, half, refusedRound({ can_now: [], findings: [] })], [
      `review round: no snapshot of round 2's working tree is held — its cache is gone, and nothing is taken of the tree unasked: the person decides what stands, and on their word review accept-tree ${UNIT} takes the tree as it is`,
      'review round: half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      `review round: ${UNIT}'s review phase passed in round 2 — finish is next`,
    ]);
  });

  it('a fix task of the round before not done, which the round waits on, then the round\'s reads not yet named', () => {
    firstRoundReady();
    recorded({ can_now: [], findings: [RECEIPT] });
    enter();
    reported(2, ['1-cards']);
    const waiting = refusedRound({ can_now: [], findings: [] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();

    assert.deepStrictEqual([waiting, refusedRound({ can_now: [], findings: [] })], [
      'review round: round 2 is read once every fix task of round 1 is done — task 3.1 not started',
      `review round: round 2's areas are not yet named — review reads ${UNIT} <area> …, from what round 1's fix tasks changed, among them 1-cards`,
    ]);
  });

  it('a report the round asks for missing, and one not reading as a reviewer\'s', () => {
    enter();
    reported(1, EVERY);
    fs.rmSync(statePath(dir, `${UNIT}/review/round-1/2-refunds-b.md`));
    writeState(dir, `${UNIT}/review/round-1/tests-a.md`, 'All fine.\n');

    assert.strictEqual(refusedRound({ can_now: [], findings: [] }), [
      `review round: round 1 has no report at ${UNIT}/review/round-1/2-refunds-b.md`,
      `${UNIT}/review/round-1/tests-a.md does not read as a reviewer's report — its last heading at level one or two is not \`## Findings\`; its last line is not \`Verdict: pass\` or \`Verdict: fail\`; brief its reviewer again, and its report replaces it`,
    ].join('; '));
  });

  it('a payload of another shape, every fault named', () => {
    enter();
    reported(1, EVERY, { '1-cards-a': ['bug: a', 'bug: b', 'bug: c', 'bug: d', 'bug: e', 'nit: f', 'nit: g', 'nit: h', 'bug: i'] });
    const person = decided(dir, `${UNIT}.review`, 'Is it filed?', { by: 'person', text: 'File it.', why: 'I want it.' });
    const unfiled = statePath(dir, '.inbox/ideas/2026-01-01--x.md');
    const findings = [
      { area: '3-reports', scope: 'near', call: 'major', text: '', drop: 'No.' },
      { area: '1-cards', scope: 'in', call: 'bug', text: 'Two.', fix: '3.1', drop: 'Both.' },
      { area: '1-cards', scope: 'in', call: 'bug', text: 'Not written.', fix: '3.2' },
      { area: '1-cards', scope: 'out', call: 'bug', text: 'Out.', fix: '3.1', ledger: calls.token },
      { area: '1-cards', scope: 'in', call: 'bug', text: 'Filed.', inbox: unfiled },
      { area: '1-cards', scope: 'in', call: 'nit', text: 'Dropped.', drop: '', ledger: calls.token },
      { area: '1-cards', scope: 'out', call: 'nit', text: 'Unfiled.', inbox: unfiled, ledger: person },
      { area: '1-cards', scope: 'out', call: 'nit', text: 'No call.', drop: 'Not ours.' },
      { area: '1-cards', scope: 'in', call: 'bug', text: 'Not real.', drop: 'The reviewer misread it.' },
    ].map((finding, at) => ({ ...finding, from: [`1-cards-a#${at + 1}`] }));

    assert.strictEqual(refusedRound({ can_now: ['Pay.', ''], findings, settled: '' }), [
      'review round: each of can_now is a line of what the person can now do',
      'finding 1 is of "3-reports", which the round does not read — it reads 1-cards, 2-refunds, tests',
      'finding 1\'s scope is in or out',
      'finding 1\'s call is serious, bug or nit',
      'finding 1 says nothing',
      'finding 2 lands in one of fix, inbox or drop, never two',
      `finding 3 names task 3.2, which the tracker does not hold — write it first: task create ${UNIT} 3 --file <task>`,
      'finding 4 is out of scope, and a fix task is for a finding in scope (14.3.2)',
      `finding 4: ${calls.token} is no decision made at ${UNIT}.review — a file-or-drop call is Claude's, written there: ledger decide ${UNIT}.review`,
      'finding 5 is in scope, and a finding in scope is fixed or dropped, never filed (14.3.2)',
      'finding 6 is dropped with no why',
      'finding 6 names a ledger call, which only a finding out of scope, or one in scope dropped above a nit, is filed or dropped by',
      `finding 7 names ${unfiled}, which the inbox does not hold — file it first: inbox file <unit> --file <item>`,
      `finding 7: ${person} is the person's decision — a file-or-drop call is Claude's own, never offered (14.3.5)`,
      'finding 8 names no ledger call filing or dropping it — Claude\'s call at the review, counted for the person (14.3.7)',
      'finding 9 names no ledger call filing or dropping it — Claude\'s call at the review, counted for the person (14.3.7)',
      'settled says how Claude settled the round',
    ].join('; '));
  });

  it('report items a finding answers none of, names that no report holds, or calls lesser than its own; and each item answered by no finding or by two', () => {
    enter();
    reported(1, EVERY, { '1-cards-a': ['bug: The receipt is never sent.', 'nit: The label is terse.'], '1-cards-b': ['bug: No receipt follows.'], 'tests-a': ['nit: A test is slow.'] });
    const found = { area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt is never sent.', drop: 'Not real.', ledger: reviewCall('Dropped.', 'Not real.') };

    assert.strictEqual(refusedRound({ can_now: [], findings: [
      { ...found, from: [] },
      { ...found, from: ['1-cards-a#1', '1-cards-c#1', '1-cards-a#3'] },
      { ...found, call: 'nit', from: ['1-cards-b#1'], drop: 'Below the floor.', ledger: undefined },
      { ...found, from: ['1-cards-a#1'] },
    ].map((finding) => JSON.parse(JSON.stringify(finding))), settled: 'Nothing stands.' }), [
      'review round: finding 1 answers no report item — name each in from, as 1-cards-a#1',
      'finding 2 names 1-cards-c#1, 1-cards-a#3, which no report the round read holds',
      'finding 3 is a nit, and the report items it answers call it a bug',
      '1-cards-a#1 is named by findings 2 and 4, and is one finding\'s',
      '1-cards-a#2 is answered by no finding — every item of every report lands in the round\'s record (14.3.1)',
      'tests-a#1 is answered by no finding — every item of every report lands in the round\'s record (14.3.1)',
    ].join('; '));
  });

  it('a round passing with nits recorded without them, each nit named; recorded once each lands', () => {
    enter();
    reported(1, EVERY, { '2-refunds-a': ['nit: A refund\'s label is terse.'], 'tests-a': ['nit: A test is slow.'] });
    const refused = refusedRound({ can_now: ['Pay by card.'], findings: [] });
    const nit = (/** @type {string} */ area, /** @type {string} */ item, /** @type {string} */ text) => ({ area, scope: 'in', call: 'nit', text, from: [item], drop: 'Below the floor.' });

    assert.strictEqual(refused, [
      'review round: 2-refunds-a#1 is answered by no finding — every item of every report lands in the round\'s record (14.3.1)',
      'tests-a#1 is answered by no finding — every item of every report lands in the round\'s record (14.3.1)',
    ].join('; '));
    assert.strictEqual(recorded({ can_now: ['Pay by card.'], findings: [nit('2-refunds', '2-refunds-a#1', 'A refund\'s label is terse.'), nit('tests', 'tests-a#1', 'A test is slow.')] }).passed, true);
  });

  it('a failing round neither fixed nor settled, a settled round making fix tasks, and a passing round settled — its verdict always the reports\', never Claude\'s', () => {
    firstRoundReady();
    const dropped = reviewCall('Dropped.', 'Later.');
    const unfixed = refusedRound({ can_now: [], findings: [{ ...FOUND, from: ['1-cards-a#1'], drop: 'Later.', ledger: dropped }] });
    const fixedAndSettled = refusedRound({ can_now: [], findings: [RECEIPT], settled: 'Settled.' });
    reported(1, EVERY);

    assert.deepStrictEqual([unfixed, fixedAndSettled, refusedRound({ can_now: [], findings: [], settled: 'It passed.' })], [
      `review round: round 1 failed — write its fixes as tasks of phase 3 of ${UNIT} and name each on its finding, or say how it is settled`,
      'review round: round 1 is settled, and makes fix tasks — a round settled makes none, its failing findings fixed in earlier rounds or dropped',
      'review round: round passed, and only a failing round is settled',
    ]);
  });
});
