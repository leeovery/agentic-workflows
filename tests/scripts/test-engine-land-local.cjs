'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's stacks (workflow-engine/scripts/drivers/landing/
// local/driver.cjs), beyond what every driver does — the landing conformance
// suite's: each phase's stack read off its branch, and merged by one rule,
// its tasks' trailers on the default branch; the work a task is built on —
// a branch it holds while that branch stands, never a tree alike, and the
// work the default branch has counting for nothing; how a phase stacks on
// another and replays onto a default branch that moved on; and what finish
// says where it stops. What it records, and the shapes of landing it reads,
// are test-engine-land-reads.cjs's. Each refusal's way on is the remedy
// table's (landing-remedies.cjs, followed by the
// test-engine-land-remedies-* suites); the person's checkouts,
// test-engine-land-checkout.cjs's and test-engine-land-worktrees.cjs's.
// Git layer: the landing world (landing-world.cjs), built once and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, git, tip } = require('./engine-harness.cjs');
const { TASKS, openArgs, commitFiles, mergeBack, landedOn, useLandingWorld, refusedMoving, way, rebaseSteps } = require('./landing-world.cjs');

const { card, rounding, currency } = TASKS;
const project = useLandingWorld('engine-land-local-');

/** The argv opening a task the test makes a branch of. @param {string} task @param {string} type @param {string} title */
const open = (task, type, title) => ['land', 'open', 'pay', task, '--type', type, '--title', title];

describe('land: what the local driver reads off its stacks', () => {
  it('refuses a phase with nothing opened, a task not open, and a phase merged, saying so', () => {
    const dir = project();
    assert.deepStrictEqual([['land', 'phase', 'pay', '1'], ['land', 'chain', 'pay', '1.1']].map((args) => refusedMoving(dir, args)), [
      'land: phase 1 of pay has no task opened — open its tasks first',
      'land: task 1.1 is not open — open it first',
    ]);
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    commitFiles(dir, 'fix/pay-2.2-round-up', 'main', { 'up.txt': 'up\n' });
    assert.deepStrictEqual(
      [['land', 'phase', 'pay', '2'], open('2.2', 'fix', 'Round up'), ['land', 'chain', 'pay', '2.1']].map((args) => refusedMoving(dir, args)),
      [
        'land: phase 2 is merged into main already — there is nothing more to merge',
        'land: phase 2 is merged into main — task 2.2 lands in a phase not yet merged, so number it in one',
        'land: phase 2 is merged into main — its stack is landed',
      ],
    );
  });

  it('counts a phase merged once the default branch holds its tasks\' trailers, its branch kept or deleted — so a task built on one of them opens', () => {
    const replayed = project();
    git(replayed, ['checkout', '-q', '-b', 'wip']);
    ok(replayed, openArgs(card));
    ok(replayed, openArgs(rounding));
    ok(replayed, ['land', 'phase', 'pay', '1']);
    ok(replayed, ['land', 'phase', 'pay', '2']);
    commitFiles(replayed, 'fix/pay-4.1-round-more', rounding.branch, { 'more.txt': 'more\n' });
    mergeBack(replayed, 'fix/pay-4.1-round-more', 'main');
    assert.strictEqual(ok(replayed, open('4.1', 'fix', 'Round more')).base, 'main');

    const deleted = project();
    ok(deleted, openArgs(rounding));
    ok(deleted, ['land', 'phase', 'pay', '2']);
    git(deleted, ['branch', '-D', 'feat/pay-phase-2']);
    mergeBack(deleted, currency.branch, 'main');
    assert.strictEqual(ok(deleted, openArgs(currency)).base, 'main');
  });

  it('ties a task to another by the branch it holds while that branch stands, never by a tree alike — and, the branch deleted, by its tree, within the task\'s chain', () => {
    const alike = project();
    ok(alike, openArgs(card));
    commitFiles(alike, 'fix/pay-2.4-share-the-card', 'main', card.files);
    commitFiles(alike, 'fix/pay-2.4-share-the-card', 'fix/pay-2.4-share-the-card', { 'share.txt': 'share\n' });
    assert.strictEqual(ok(alike, open('2.4', 'fix', 'Share the card')).base, 'main');

    const stacked = project();
    ok(stacked, openArgs(rounding));
    ok(stacked, openArgs(currency));
    git(stacked, ['branch', '-D', rounding.branch]);
    commitFiles(stacked, 'fix/pay-3.2-more-currency', currency.branch, { 'more.txt': 'more\n' });
    assert.strictEqual(ok(stacked, open('3.2', 'fix', 'More currency')).base, currency.branch);
  });

  it('finish: a phase whose change conflicts with the default branch stops it, saying which merged before, if any', () => {
    const dir = project();
    commitFiles(dir, 'fix/pay-4.1-word-the-card', 'main', { 'card.txt': 'a card\n' });
    ok(dir, openArgs(card));
    ok(dir, open('4.1', 'fix', 'Word the card'));
    const phase = tip(dir, 'feat/pay-phase-4');
    const conflict = 'land: task 4.1 conflicts with main at card.txt, so nothing moved — '
      + way(dir, null, 'feat/pay-phase-4', rebaseSteps(dir, 'feat/pay-phase-4', 'main', 'bring feat/pay-phase-4 up to date with main'));
    assert.strictEqual(refuses(dir, ['land', 'finish', 'pay']).error, `${conflict} (finish merged phase 1 before it)`);
    assert.deepStrictEqual([tip(dir, 'main'), tip(dir, 'feat/pay-phase-4')], [tip(dir, 'feat/pay-phase-1'), phase]);
    assert.strictEqual(refusedMoving(dir, ['land', 'finish', 'pay']), conflict);
  });
});

describe('land: how the local driver stacks and replays', () => {
  it('stacks a phase on the latest unmerged phase its first task was built on, and finish merges each phase after the one it stacks on', () => {
    const dir = project();
    ok(dir, openArgs(rounding));
    ok(dir, openArgs(currency));
    commitFiles(dir, 'feat/pay-1.4-lower', currency.branch, { 'lower.txt': 'lower\n' });
    assert.strictEqual(ok(dir, open('1.4', 'feat', 'Lower')).base, currency.branch);
    assert.deepStrictEqual(ok(dir, ['land', 'finish', 'pay']).phases.map((/** @type {{phase: number}} */ merged) => merged.phase), [2, 3, 1]);
    assert.deepStrictEqual(landedOn(dir, 'main').map(({ paths }) => paths), [['round.txt'], ['currency.txt'], ['lower.txt']]);
  });

  it('merges a stacked phase once the default branch holds every task of the phase below, that phase\'s branch deleted once merged', () => {
    const dir = project();
    ok(dir, openArgs(rounding));
    ok(dir, openArgs(currency));
    ok(dir, openArgs(card));
    ok(dir, ['land', 'phase', 'pay', '1']);
    ok(dir, ['land', 'phase', 'pay', '2']);
    git(dir, ['branch', '-d', 'feat/pay-phase-2']);
    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '3']).merged, ['3.1']);
    assert.deepStrictEqual(landedOn(dir, 'main').map(({ paths }) => paths), [['card.txt'], ['round.txt'], ['currency.txt']]);
  });

  it('replays each task\'s own change onto a default branch that moved on, a later task\'s undoing part of an earlier one\'s', () => {
    const dir = project();
    commitFiles(dir, 'feat/pay-1.4-add-flag', 'main', { 'flag.txt': 'a\nb\n' });
    commitFiles(dir, 'feat/pay-1.5-trim-flag', 'feat/pay-1.4-add-flag', { 'flag.txt': 'a\n' });
    ok(dir, open('1.4', 'feat', 'Add flag'));
    ok(dir, open('1.5', 'feat', 'Trim flag'));
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(
      [git(dir, ['show', 'main:flag.txt']), landedOn(dir, 'main').map(({ subject }) => subject)],
      ['a\n', ['fix(pay): Round totals', 'feat(pay): Add flag', 'feat(pay): Trim flag']],
    );
  });

  it('lands a task whose change the default branch holds already as a commit that changes nothing, and names it', () => {
    const dir = project();
    git(dir, ['checkout', '-q', '-b', 'wip']);
    ok(dir, openArgs(card));
    commitFiles(dir, 'main', 'main', card.files, { message: 'the card, by hand' });
    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']).landed_empty, [{ task: '1.1', why: 'its change was on main already' }]);
    assert.deepStrictEqual(landedOn(dir, 'main'), [
      { subject: 'the card, by hand', task: null, paths: ['card.txt'] },
      { subject: 'feat(pay): Add card', task: 'pay-1-1', paths: [] },
    ]);
  });
});
