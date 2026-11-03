'use strict';

// ---------------------------------------------------------------------------
// What `engine review round <unit> --file <round.json>` refuses, writing
// nothing (leeway-engine/scripts/domain/review-round.cjs, its records
// review-phase.cjs): a call of another shape, as `inbox file`'s is
// (inbox.cjs); a working tree changed outside `.leeway/` since the entry —
// a path's status, what it holds, a HEAD moved — naming every path and
// reverting none (12.7.8, 14.S13); no snapshot; a unit its entry refuses;
// a review over; fix tasks of the round before not done (14.3.3); reports
// missing or not reading; a payload of another shape, every fault named —
// where each finding landed, its scope and its file-or-drop call
// (14.3.1–14.3.7); and a verdict neither fixed nor settled (14.6.3). What
// it records is test-engine-review-round.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const {
  UNIT, AREAS, calls, useWorld, env, enter, payload, reported, recorded, refusedRound, decided, RECEIPT, FOUND, firstRoundReady,
  refusedPristine, statePath, writeState, git, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

describe('review round: what it refuses, writing nothing', () => {
  it('a call of another shape, as inbox file\'s is: a verb it lacks, no unit, no payload, an extra word, a flag it takes none of', () => {
    const file = payload('round.json', { can_now: [], findings: [] });
    const usage = (/** @type {string[]} */ args) => refusedPristine(dir, args, { env: env() }).error;

    for (const args of [['review', 'record', UNIT, '--file', file], ['review', 'round', '--file', file], ['review', 'round', UNIT], ['review', 'round', UNIT, 'more', '--file', file], ['review', 'round', UNIT, '--file', file, '--force', 'x']]) {
      assert.strictEqual(usage(args), 'Usage: engine review round <work-unit> --file <round.json>', args.join(' '));
    }
    for (const args of [['inbox', 'file', '--file', file], ['inbox', 'file', UNIT], ['inbox', 'file', UNIT, 'more', '--file', file], ['inbox', 'file', UNIT, '--file', file, '--kind', 'idea']]) {
      assert.strictEqual(usage(args), 'Usage: engine inbox <archive|restore|delete> <path> [<path> …] | engine inbox file <work-unit> --file <item.json>', args.join(' '));
    }
  });

  it('14.S13: a working tree changed outside .leeway/ since the entry, naming every path, the change left as it stands; entering again takes the tree as it is', () => {
    firstRoundReady();
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 2;\n');
    fs.writeFileSync(path.join(dir, 'src/stray.js'), 'export const stray = 1;\n');
    const error = refusedRound({ can_now: [], findings: [RECEIPT] });

    assert.strictEqual(error, `review round: the working tree outside .leeway/ changed since the review phase was entered: src/card.js, src/stray.js — nothing is reverted; the person decides what stands, and enter review ${UNIT} then takes the tree as it is`);
    assert.deepStrictEqual([fs.readFileSync(path.join(dir, 'src/card.js'), 'utf8'), fs.existsSync(path.join(dir, 'src/stray.js'))], ['export const card = 2;\n', true]);
    enter();
    assert.strictEqual(recorded({ can_now: [], findings: [RECEIPT] }).round, 1);
  });

  it('a file already changed when the review phase was entered and changed again since, its status the same, told by what it holds', () => {
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 2;\n');
    firstRoundReady();
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 3;\n');

    assert.strictEqual(refusedRound({ can_now: [], findings: [RECEIPT] }), `review round: the working tree outside .leeway/ changed since the review phase was entered: src/card.js — nothing is reverted; the person decides what stands, and enter review ${UNIT} then takes the tree as it is`);
  });

  it('a commit made since the entry, naming the repository and where its HEAD moved', () => {
    firstRoundReady();
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'a stray commit']);
    const after = git(dir, ['rev-parse', 'HEAD']).trim();

    assert.strictEqual(refusedRound({ can_now: [], findings: [RECEIPT] }), `review round: the working tree outside .leeway/ changed since the review phase was entered: the project's repository is at ${after.slice(0, 7)}, not ${before.slice(0, 7)} — nothing is reverted; the person decides what stands, and enter review ${UNIT} then takes the tree as it is`);
  });

  it('no snapshot, a unit whose review phase cannot be entered, and a review phase over', () => {
    reported(1, AREAS);
    const none = refusedRound({ can_now: [], findings: [] });
    const half = refusedPristine(dir, ['review', 'round', 'half', '--file', payload('round.json', { can_now: [], findings: [] })], { env: env() }).error;
    enter();
    recorded({ can_now: [], findings: [] });

    assert.deepStrictEqual([none, half, refusedRound({ can_now: [], findings: [] })], [
      `review round: no snapshot of the working tree was taken — enter review ${UNIT} takes one`,
      'review round: half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      `review round: ${UNIT}'s review phase passed in round 1 — finish is next`,
    ]);
  });

  it('a fix task of the round before not done, which the round waits on', () => {
    firstRoundReady();
    recorded({ can_now: [], findings: [RECEIPT] });
    enter();
    reported(2, ['1-cards']);

    assert.strictEqual(refusedRound({ can_now: [], findings: [] }), 'review round: round 2 reads the areas round 1\'s fix tasks changed once every one is done — task 3.1 not started');
  });

  it('a report the round asks for missing, and one not reading as a reviewer\'s', () => {
    enter();
    reported(1, AREAS);
    fs.rmSync(statePath(dir, `${UNIT}/review/round-1/2-refunds-b.md`));
    writeState(dir, `${UNIT}/review/round-1/tests-a.md`, 'All fine.\n');

    assert.strictEqual(refusedRound({ can_now: [], findings: [] }), [
      `review round: round 1 has no report at ${UNIT}/review/round-1/2-refunds-b.md`,
      `${UNIT}/review/round-1/tests-a.md does not read as a reviewer's report — its last heading at level one or two is not \`## Findings\`; its last line is not \`Verdict: pass\` or \`Verdict: fail\`; brief its reviewer again, and its report replaces it`,
    ].join('; '));
  });

  it('a payload of another shape, every fault named', () => {
    firstRoundReady();
    const person = decided(dir, `${UNIT}.review`, 'Is it filed?', { by: 'person', text: 'File it.', why: 'I want it.' });
    const unfiled = statePath(dir, '.inbox/ideas/2026-01-01--x.md');

    assert.strictEqual(refusedRound({ can_now: ['Pay.', ''], findings: [
      { area: '3-reports', scope: 'near', call: 'major', text: '', drop: 'No.' },
      { area: '1-cards', scope: 'in', call: 'bug', text: 'Two.', fix: '3.1', drop: 'Both.' },
      { area: '1-cards', scope: 'in', call: 'bug', text: 'Not written.', fix: '3.2' },
      { area: '1-cards', scope: 'out', call: 'bug', text: 'Out.', fix: '3.1', ledger: calls.token },
      { area: '1-cards', scope: 'in', call: 'bug', text: 'Filed.', inbox: unfiled },
      { area: '1-cards', scope: 'in', call: 'nit', text: 'Dropped.', drop: '', ledger: calls.token },
      { area: '1-cards', scope: 'out', call: 'nit', text: 'Unfiled.', inbox: unfiled, ledger: person },
      { area: '1-cards', scope: 'out', call: 'nit', text: 'No call.', drop: 'Not ours.' },
    ], settled: '' }), [
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
      'finding 6 names a ledger call, which only a finding out of scope is filed or dropped by',
      `finding 7 names ${unfiled}, which the inbox does not hold — file it first: inbox file <unit> --file <item>`,
      `finding 7: ${person} is the person's decision — a file-or-drop call is Claude's own, never offered (14.3.5)`,
      'finding 8 is out of scope, and names no ledger call filing or dropping it (14.3.7)',
      'settled says how Claude settled the round',
    ].join('; '));
  });

  it('a failing round neither fixed nor settled, and a passing round settled — its verdict always the reports\', never Claude\'s', () => {
    firstRoundReady();
    const unfixed = refusedRound({ can_now: [], findings: [{ ...FOUND, drop: 'Later.' }] });
    reported(1, AREAS);

    assert.deepStrictEqual([unfixed, refusedRound({ can_now: [], findings: [], settled: 'It passed.' })], [
      `review round: round 1 failed — write its fixes as tasks of phase 3 of ${UNIT} and name each on its finding, or say how it is settled`,
      'review round: round passed, and only a failing round is settled',
    ]);
  });
});
