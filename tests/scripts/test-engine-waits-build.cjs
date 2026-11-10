'use strict';

// ---------------------------------------------------------------------------
// What the menus read of a unit from its build on, with no conversation of
// their own: what waits on the person there (leeway-engine/scripts/domain/
// waits.cjs; 18.2.3) — the build's questions and else finish (D18), each
// with its door; and how far the unit has come, as a menu's row says it
// (domain/progress.cjs; 7.4.2, 28.2.1). Before the build:
// test-engine-waits.cjs; a quick-fix's: test-engine-waits-quick-fix.cjs.
//
// Layer: verb, the reads called in process. World: the review phase's
// (review-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readManifest } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const review = require('./review-world.cjs');
const { waitsIn, progress, door, wait } = require('./waits-world.cjs');

describe('the build\'s questions and finish (18.2.3, D18)', () => {
  /** @type {string} */
  let dir;
  review.useWorld((copied) => {
    dir = copied;
  });
  const intoReview = door('leeway-review-process', 'feature', review.UNIT);
  const QUESTION = 'Is the receipt mailed or printed?';

  it('a question a fix task is parked on waits by its number and words, its door the review', async () => {
    review.firstRoundFailed();
    review.enter();
    await review.fixParked();

    assert.deepStrictEqual(waitsIn(dir, [review.UNIT]), { [review.UNIT]: [wait('question', 'Q1', QUESTION, intoReview)] });
  });

  it('D18: finish waits once its screen draws, its door the review; not while a question of the build waits, one parking no task among them, its screen refusing then', async () => {
    review.finishReady();
    const finishing = waitsIn(dir, [review.UNIT]);
    await review.raisedAtReview(QUESTION);

    assert.deepStrictEqual([finishing, waitsIn(dir, [review.UNIT])], [
      { [review.UNIT]: [wait('finish', 'finish', 'Finish', intoReview)] },
      { [review.UNIT]: [wait('question', 'Q1', QUESTION, intoReview)] },
    ]);
  });

  it('7.4.2, 28.2.1: a build says the phase it is at, the first of its cut not closed, of every phase the cut holds; a review its name; a unit of a type the reshape retires that it waits on the migration\'s cut', () => {
    for (const unit of ['open', 'half']) createManifest(dir, unit, { ...readManifest(dir, unit), phases: { discussion: { items: { [unit]: { status: 'completed' } } } } });
    createManifest(dir, 'mixed', { work_type: 'cross-cutting' });

    assert.deepStrictEqual(['open', 'half', review.UNIT, 'mixed'].map((unit) => progress(dir, unit)), ['build, phase 1 of 2', 'build, phase 2 of 2', 'review', 'waiting on the migration\'s cut']);
  });
});
