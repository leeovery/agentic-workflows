'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (leeway-engine/scripts/drivers/landing/github/)
// and a feature's stack merged by hand on GitHub's site, each pull request
// into its own base as its button merges it (R12 (c), (e)), past what every
// driver does (the landing conformance suite's): merged to its top, it
// never reached main, so it is never answered as merged already — the
// phase lands it whole, the top opened again onto main; merged in part, or
// at its bottom with that branch kept or deleted, it is a stack still — its
// tasks chained and opened, a task opened into it stacked on its last open
// and linked with the open pull requests alone — and the phase lands it
// whole, one merged into a branch that never reached main opened again
// onto it. A pull request closed by hand, and every other stop, are
// test-landing-stops.cjs's; a quick-fix's set merged by hand,
// test-landing-quick-fix*.cjs's. Git layer: the landing world on a fake
// GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { TASKS, openArgs, own, cutTask, landedOn, useLandingWorld } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { bareOf, calls, mergeByHand, headDeleted, pulls, ok, stackOfTwo } = require('./world.cjs');

const { card, total } = TASKS;
const project = useLandingWorld('github-landing-by-hand-', side.prepare);

describe('a feature\'s stack merged by hand on GitHub\'s site (R12 (c), (e))', () => {
  it('a stack merged by hand on GitHub\'s site, each pull request into its own base, so it never reached main: a stack still, its tasks chained, a task opened into it on its top, and the phase landed whole by its merge — the one merged into the branch below opened again onto main', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 1);
    mergeByHand(dir, 2);
    const chained = own(ok(dir, ['land', 'chain', 'pay', '1.2'])).stack;
    const tax = cutTask(dir, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });
    const opened = own(ok(dir, openArgs(tax))).base;
    ok(dir, ['land', 'phase', 'pay', '1']);

    assert.deepStrictEqual([chained, opened, landedOn(bareOf(dir), 'main').map(({ task }) => task), pulls(dir)], [['1.1', '1.2'], total.branch, ['pay-1-1', 'pay-1-2', 'pay-1-4'], [
      { number: 1, state: 'MERGED', base: 'main' }, { number: 2, state: 'MERGED', base: card.branch }, { number: 4, state: 'MERGED', base: 'main' }, { number: 5, state: 'MERGED', base: 'main' },
    ]]);
    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']), { ok: true, phase: 1, already: true, repos: [], driver: 'github' });
  });

  it('a stack merged by hand on GitHub\'s site to its top, each pull request into its own base, so its top never reached main: never answered as merged already — the phase landed whole by its merge, the top opened again onto main', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 1);
    mergeByHand(dir, 2);
    const landed = ok(dir, ['land', 'phase', 'pay', '1']);

    assert.deepStrictEqual([landed.already, landedOn(bareOf(dir), 'main').map(({ task }) => task), pulls(dir)], [undefined, ['pay-1-1', 'pay-1-2'], [
      { number: 1, state: 'MERGED', base: 'main' }, { number: 2, state: 'MERGED', base: card.branch }, { number: 4, state: 'MERGED', base: 'main' },
    ]]);
  });

  for (const [how, deleted] of /** @type {const} */ ([['kept', false], ['deleted, GitHub retargeting the next onto main', true]])) {
    it(`a stack whose bottom pull request was merged by hand on GitHub's site, its branch ${how}: its tasks merged chained and opened, a task opened into it on the last open, linked with the open alone, and the phase landed whole by its merge`, () => {
      const dir = project();
      stackOfTwo(dir);
      mergeByHand(dir, 1);
      if (deleted) headDeleted(dir, 1);
      const before = calls(dir).length;
      const chained = ['1.1', '1.2'].map((task) => own(ok(dir, ['land', 'chain', 'pay', task])).stack);
      const again = ok(dir, openArgs(card));
      const tax = cutTask(dir, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });
      const opened = own(ok(dir, openArgs(tax))).base;
      ok(dir, ['land', 'chain', 'pay', '1.4']);
      const linked = calls(dir).slice(before).filter((call) => call.startsWith('stack link'));
      ok(dir, ['land', 'phase', 'pay', '1']);

      assert.deepStrictEqual([chained, again.already, opened, linked, landedOn(bareOf(dir), 'main').map(({ task }) => task)], [
        [['1.1', '1.2'], ['1.1', '1.2']], true, total.branch, ['stack link --base main --remote origin 2 4'], ['pay-1-1', 'pay-1-2', 'pay-1-4'],
      ]);
    });
  }
});
