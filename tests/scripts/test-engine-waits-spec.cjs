'use strict';

// ---------------------------------------------------------------------------
// What the menus read of a unit at its spec: what waits on the person there
// (leeway-engine/scripts/domain/waits.cjs; 18.2.3) — the spec's gaps while
// it is under way, and else ready to build once its screen draws — each its
// door the specification; and how far the unit has come. Before the spec:
// test-engine-waits.cjs.
//
// Layer: verb, the reads called in process. World: the spec writer's
// (spec-review-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readManifest } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers, MADE } = require('./ledger-world.cjs');
const { UNIT: PAYMENTS, AT_SPEC, made: specMade, useSpecReviewWorld, specReviewHelpers } = require('./spec-review-world.cjs');
const { specBoard } = require('./spec-board-world.cjs');
const { waitsIn, progress, door, wait } = require('./waits-world.cjs');

describe('a spec\'s gaps and ready to build (18.2.3)', () => {
  const dir = useSpecReviewWorld();
  const { cleanPass } = specReviewHelpers(dir);
  const { tracedLanded, readyClosed, bothWaiting } = specBoard(dir);
  const { write } = ledgerHelpers(dir);
  const intoSpec = door('leeway-specification-process', 'epic', PAYMENTS);

  it('each gap waits while the spec is under way, by its entry and words, its door the specification: a question asked at the spec and a replacement a pass raised — the spec written, still once a topic is set back in progress, and no longer once the build has begun', () => {
    const asked = bothWaiting();
    const gaps = waitsIn(dir(), [PAYMENTS]);
    const manifest = readManifest(dir(), PAYMENTS);
    manifest.phases.discussion.items.refunds.status = 'in-progress';
    createManifest(dir(), PAYMENTS, manifest);
    const reopened = waitsIn(dir(), [PAYMENTS]);
    createManifest(dir(), PAYMENTS, { ...readManifest(dir(), PAYMENTS), build: { position: 'auto' } });
    const GAPS = { [PAYMENTS]: [wait('gap', asked, 'Is a refund ever split?', intoSpec), wait('gap', specMade.where, 'Back to the card.', intoSpec)] };

    assert.deepStrictEqual([gaps, reopened, waitsIn(dir(), [PAYMENTS])], [GAPS, GAPS, { [PAYMENTS]: [] }]);
  });

  it('ready to build waits once its screen draws, its door the specification, and not while a gap waits, its screen refusing then; the unit is in its specification', () => {
    tracedLanded();
    cleanPass();
    readyClosed();
    const ready = waitsIn(dir(), [PAYMENTS]);
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;

    assert.deepStrictEqual([ready, waitsIn(dir(), [PAYMENTS]), progress(dir(), PAYMENTS)], [
      { [PAYMENTS]: [wait('ready', 'ready-to-build', 'Ready to build', intoSpec)] },
      { [PAYMENTS]: [wait('gap', asked, 'Is a refund ever split?', intoSpec)] },
      'specification',
    ]);
  });
});
