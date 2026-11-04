'use strict';

// ---------------------------------------------------------------------------
// A round's snapshot of the working tree outside `.leeway/` and the
// person's word over it (leeway-engine/scripts/domain/review-verbs.cjs,
// review-phase.cjs, review-round.cjs): a later round's taken as `review
// reads` opens the round, entered or not, kept while held as more reads are
// named, and the round held to its own alone; and `engine review accept-tree
// <unit>`, the tree taken as it is on the person's word, its snapshot taken
// again and nothing else written — the one way past a tree changed since the
// snapshot, which entering again, after a `/clear`, never is (12.7.8,
// 14.1.5, 14.S13); and what it refuses, writing nothing. The gate over a
// tree changed is test-engine-review-tree-gate.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { treeSnapshot, head } = require('./engine-harness.cjs');
const {
  UNIT, AREAS, useWorld, env, enter, reported, named, recorded, refusedRound, firstRoundReady, fixBuilt, RECEIPT,
  ok, refusedPristine, statePath, assert,
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

/** The snapshot's file, from the state root. */
const SNAPSHOT = `.cache/${UNIT}/review/tree.json`;

/** The state's files and its branch's head, the snapshot aside. */
function stateBeside() {
  const files = treeSnapshot(dir);
  delete files[SNAPSHOT];
  return { files, head: head(dir) };
}

describe('a later round\'s snapshot, taken as review reads opens the round (14.1.5, 14.S13)', () => {
  it('with no entry after the fix phase, the round\'s runs leaving the tree changed stop the round, and entering again — a /clear mid-round — takes none: only the person\'s word does', () => {
    firstRoundReady();
    recorded({ can_now: [], findings: [RECEIPT] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    named(['1-cards']);
    reported(2, ['1-cards']);
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 999;\n');
    const stopped = refusedRound({ can_now: [], findings: [] });
    enter();
    const again = refusedRound({ can_now: [], findings: [] });

    assert.strictEqual(stopped, `review round: the working tree outside .leeway/ changed since the snapshot the round is held to: src/card.js — nothing is put back unasked: render review-tree ${UNIT} asks the person whether it is put back or kept`);
    assert.strictEqual(again, stopped);
    assert.deepStrictEqual(ok(dir, ['review', 'accept-tree', UNIT], { env: env() }), { ok: true, round: 2, snapshot: 'taken' });
    assert.strictEqual(recorded({ can_now: [], findings: [] }).round, 2);
  });

  it('naming more reads keeps the snapshot held, the tree changed between them still stopping the round', () => {
    fixesDone();
    named(['1-cards']);
    const held = fs.readFileSync(statePath(dir, SNAPSHOT), 'utf8');
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 999;\n');
    named(['1-cards', '2-refunds']);
    reported(2, AREAS);

    assert.strictEqual(fs.readFileSync(statePath(dir, SNAPSHOT), 'utf8'), held);
    assert.match(refusedRound({ can_now: [], findings: [] }), /^review round: the working tree outside \.leeway\/ changed since the snapshot the round is held to: src\/card\.js — /);
  });

  it('a snapshot held for an earlier round is no snapshot of this one\'s — the round holds the tree to its own alone, the refusal naming the round it holds', () => {
    firstRoundReady();
    const first = fs.readFileSync(statePath(dir, SNAPSHOT), 'utf8');
    recorded({ can_now: [], findings: [RECEIPT] });
    fs.writeFileSync(statePath(dir, SNAPSHOT), first);
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    named(['1-cards']);
    reported(2, ['1-cards']);

    assert.match(refusedRound({ can_now: [], findings: [] }), /^review round: no snapshot of round 2's working tree is held — the one held is round 1's, and nothing is taken of the tree unasked: /);
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

    assert.strictEqual(stopped, `review round: the working tree outside .leeway/ changed since the snapshot the round is held to: src/card.js — nothing is put back unasked: render review-tree ${UNIT} asks the person whether it is put back or kept`);
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
