'use strict';

// ---------------------------------------------------------------------------
// The review phase's own verbs beside its round (leeway-engine/scripts/
// domain/review-verbs.cjs, its records review-phase.cjs): `engine review
// reads <unit> <area|tests> …` — a later round's reads named once the round
// before's fix tasks are done, every area whose findings made fix tasks
// among them, the test surface read only where named or its findings made
// one, areas added and never dropped, written in the spec's order and
// committed (14.3.3) — and `engine review accept-tree <unit>`, the tree
// taken as it is on the person's word, its snapshot taken again and nothing
// else written: the one way past a tree changed since the snapshot, which
// entering again, after a `/clear`, never is (12.7.8, 14.S13). What each
// refuses, writing nothing.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { treeSnapshot, head } = require('./engine-harness.cjs');
const {
  UNIT, EVERY, useWorld, env, enter, reported, named, recorded, refusedRound, firstRoundReady, fixBuilt, stateText, lastStateCommit, RECEIPT,
  ok, refusedPristine, statePath, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** `review <verb>` refused, nothing written: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['review', ...args], { env: env() }).error;

/** Round 1 recorded failing, `findings` its record, its fix task 3.1 built and done, round 2 entered. @param {object[]} [findings] */
function fixesDone(findings = [RECEIPT]) {
  firstRoundReady();
  recorded({ can_now: [], findings });
  fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
  enter();
}

/** The snapshot's file, from the state root. */
const SNAPSHOT = `.cache/${UNIT}/review/tree.json`;

/** The state's files and its branch's head, the snapshot aside. */
function stateBeside() {
  const files = treeSnapshot(dir);
  delete files[SNAPSHOT];
  return { files, head: head(dir) };
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

  it('the test surface is read only where named, or where its findings made fix tasks', () => {
    fixesDone();
    named(['1-cards']);
    const brief = refusedPristine(dir, ['brief', 'test-surface', UNIT, '--base', 'main'], { env: env() }).error;
    reported(2, ['1-cards']);
    recorded({ can_now: [], findings: [] });

    assert.strictEqual(brief, 'the test surface is not read in round 2, which reads 1-cards');
    assert.deepStrictEqual(JSON.parse(stateText(`${UNIT}/review/round-2.json`)).reports, ['1-cards-a.md', '1-cards-b.md']);
  });

  it('refused, writing nothing: round 1, a unit whose review phase cannot be entered, a name no area\'s, a read whose findings made fix tasks left out, a read named before dropped, fix tasks waiting, and a review over', () => {
    enter();
    const first = refused(['reads', UNIT, '1-cards']);
    const half = refused(['reads', 'half', '1-cards']);
    firstRoundReady();
    reported(1, EVERY, { '1-cards-a': ['bug: The receipt is never sent.'], 'tests-a': ['bug: No test sends a receipt.'] });
    recorded({ can_now: [], findings: [RECEIPT, { area: 'tests', scope: 'in', call: 'bug', text: 'No test sends a receipt.', from: ['tests-a#1'], fix: '3.1' }] });
    const waiting = refused(['reads', UNIT, '1-cards', 'tests']);
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    const unknown = refused(['reads', UNIT, '1-cards', '3-reports', 'tests', 'cards']);
    const leftOut = refused(['reads', UNIT, '1-cards']);
    named(['1-cards', '2-refunds', 'tests']);
    const dropped = refused(['reads', UNIT, '1-cards', 'tests']);

    assert.deepStrictEqual([first, half, waiting, unknown, leftOut, dropped], [
      'review reads: round 1 reads every area and the test surface (tests) — a later round\'s are named',
      'review reads: half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'review reads: round 2 is read once every fix task of round 1 is done — task 3.1 not started',
      `review reads: 3-reports, cards are no area of ${UNIT}'s spec — name its areas by 1-cards, 2-refunds, tests`,
      'review reads: round 2 reads every area whose findings made fix tasks in round 1, and leaves out the test surface (tests)',
      'review reads: round 2 already reads 2-refunds — areas are added, never dropped',
    ]);
    reported(2, EVERY);
    recorded({ can_now: [], findings: [] });
    assert.strictEqual(refused(['reads', UNIT, '1-cards']), `review reads: ${UNIT}'s review phase passed in round 2 — finish is next`);
  });
});

describe('review accept-tree: the tree taken as it is, on the person\'s word (12.7.8, 14.S13)', () => {
  it('a tree changed since the snapshot stops the round across entering again, as after a /clear; accept-tree takes the snapshot again and writes nothing else, and the round records, its snapshot dropped', () => {
    firstRoundReady();
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 2;\n');
    const stopped = refusedRound({ can_now: [], findings: [RECEIPT] });
    enter();
    const again = refusedRound({ can_now: [], findings: [RECEIPT] });
    const before = stateBeside();
    const res = ok(dir, ['review', 'accept-tree', UNIT], { env: env() });
    const after = stateBeside();

    assert.strictEqual(stopped, `review round: the working tree outside .leeway/ changed since the snapshot the round is held to: src/card.js — nothing is reverted; the person decides what stands, and on their word review accept-tree ${UNIT} takes the tree as it is`);
    assert.strictEqual(again, stopped);
    assert.deepStrictEqual([res, after], [{ ok: true, round: 1, snapshot: 'taken' }, before]);
    assert.match(JSON.parse(fs.readFileSync(statePath(dir, SNAPSHOT), 'utf8')).paths['src/card.js'], /^ M /);
    assert.strictEqual(recorded({ can_now: [], findings: [RECEIPT] }).round, 1);
    assert.strictEqual(fs.existsSync(statePath(dir, SNAPSHOT)), false);
  });

  it('refused, writing nothing: a unit whose review phase cannot be entered, fix tasks waiting, and a review over', () => {
    const half = refused(['accept-tree', 'half']);
    firstRoundReady();
    recorded({ can_now: [], findings: [RECEIPT] });
    const waiting = refused(['accept-tree', UNIT]);
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    reported(2, ['1-cards']);
    recorded({ can_now: [], findings: [] });

    assert.deepStrictEqual([half, waiting, refused(['accept-tree', UNIT])], [
      'review accept-tree: half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'review accept-tree: round 2 is read once every fix task of round 1 is done — task 3.1 not started',
      `review accept-tree: ${UNIT}'s review phase passed in round 2 — finish is next`,
    ]);
  });
});
