'use strict';

// ---------------------------------------------------------------------------
// What the menus read of a unit from its build on: what waits on the person
// there (leeway-engine/scripts/domain/waits.cjs; 18.2.3) — the build's
// questions and else finish (D18), each with its door; what the read costs,
// one read of the ledger checked once whatever the units (N3); and how far
// the unit has come, as a menu's row says it, a phase not yet written saying
// so (domain/progress.cjs; 7.4.2, 7.S16, 28.2.1). Before the build:
// test-engine-waits.cjs; a quick-fix's: test-engine-waits-quick-fix.cjs.
//
// Layer: verb, the reads called in process. World: the review phase's
// (review-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { readManifest, statePath, FROZEN_AT } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const review = require('./review-world.cjs');
const { waitsIn, progress, door, wait } = require('./waits-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { waitsOf } = require(path.join(SCRIPTS, 'domain/waits.cjs'));
const { readShown } = require(path.join(SCRIPTS, 'domain/ledger-read.cjs'));

/** A checklist closed, as its close records it. */
const CLOSED = Object.freeze({ items: {}, closed: FROZEN_AT });

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

  it('N3: what waits in one unit and in every unit of the project — in its build, at its review, at its spec, a quick-fix and one under the old plan among them — is read from one read of the ledger, checked once: the ledger opened twice either way; and handed a caller\'s read, it reads none of its own', (t) => {
    const units = [review.UNIT, 'half', 'open', 'solo', 'five', 'fresh', 'tweak', 'old'];
    const real = fs.openSync;
    let opened = 0;
    t.mock.method(fs, 'openSync', (/** @type {Parameters<typeof fs.openSync>} */ ...args) => {
      if (String(args[0]).endsWith('.ledger.jsonl')) opened += 1;
      return real(...args);
    });
    /** How often `read` opens the ledger. @param {() => unknown} read */
    const opens = (read) => {
      opened = 0;
      read();
      return opened;
    };
    /** What waits in every unit, read in a caller's own read of the ledger. */
    const handed = () => readShown(statePath(dir), [], (shower) => waitsOf(dir, units.map((unit) => readManifest(dir, unit)), { shower }));

    assert.deepStrictEqual([opens(() => waitsIn(dir, [review.UNIT])), opens(() => waitsIn(dir, units)), opens(handed)], [2, 2, 2]);
  });

  it('7.4.2, 28.2.1: a build says the phase it is at, the first of its cut not closed, of every phase the cut holds, one whose start has not closed not yet written; a review its name; a unit of a type the reshape retires that it waits on the migration\'s cut', () => {
    for (const unit of ['open', 'half']) createManifest(dir, unit, { ...readManifest(dir, unit), phases: { discussion: { items: { [unit]: { status: 'completed' } } } } });
    createManifest(dir, 'mixed', { work_type: 'cross-cutting' });

    assert.deepStrictEqual(['open', 'half', review.UNIT, 'mixed'].map((unit) => progress(dir, unit)), ['build, phase 1 of 2, not yet written', 'build, phase 2 of 2, not yet written', 'review', 'waiting on the migration\'s cut']);
  });

  it('7.S16: a cut of five phases, two written — the build at the second says how far it is; the second closed, the third says it is not yet written', () => {
    const cut = { phases: [1, 2, 3, 4, 5].map((n) => ({ name: `Phase ${n}`, goal: 'A customer pays.', scenarios: [], sections: [String(n)], relies_on: [] })) };
    const written = { 'phase-1-start': CLOSED, 'phase-1-close': CLOSED, 'phase-2-start': CLOSED };
    createManifest(dir, 'paced', { phases: { discussion: { items: { paced: { status: 'completed' } } } }, build: { position: 'auto' }, cut, checklists: written });
    const second = progress(dir, 'paced');
    createManifest(dir, 'paced', { ...readManifest(dir, 'paced'), checklists: { ...written, 'phase-2-close': CLOSED } });

    assert.deepStrictEqual([second, progress(dir, 'paced')], ['build, phase 2 of 5', 'build, phase 3 of 5, not yet written']);
  });
});
