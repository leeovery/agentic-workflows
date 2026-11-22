'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (ledger-engine/scripts/drivers/landing/github/)
// and a task landed outside its open pull request — squashed or picked onto
// main by hand and pushed, which GitHub never marks merged (N3) — past what
// every driver does (the landing conformance suite's). With nothing past
// that landing, `land phase` closes its pull request as landed, never
// merging it, so main gains no second landing of it and its record keeps
// the one by hand: alone; beneath a later task's pull request, whose own
// then merges, over its head, so what the later task took back of its work
// stays taken back; or a later task having rewritten its card and landed since,
// the phase then asking the person to settle nothing, the later task's
// card kept. Changed after that landing, its pull request is brought up
// over the landing and its change alone lands, its first landing kept. Its
// pull request closed on GitHub by hand stops nothing once its task has
// landed. A cherry-picked task's pull request beneath a later task's is
// test-landing-by-hand-read.cjs's. Git layer: the landing world on a fake
// GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { UNIT, TASKS, openArgs, cutTask, commitFiles, mergeBack, useLandingWorld } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { bareOf, closeByHand, ok, pulls } = require('./world.cjs');
const { git, readManifest } = require('../../scripts/engine-harness.cjs');

const { card, total } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];

const project = useLandingWorld('github-landing-outside-pull-', side.prepare, 'landing-github-');

/** The ways a person lands card's branch outside its pull request, in their terminal, pushed to GitHub. @type {Record<string, (dir: string) => void>} */
const OUTSIDE = {
  'a squash': (dir) => side.squashedHere(dir, card.branch),
  'a cherry-pick': (dir) => side.picked(dir, git(dir, ['rev-parse', card.branch]).trim()),
};

/** Card's record: who landed it last and its first landing. @param {string} dir */
const cardRecord = (dir) => {
  const { by, first } = readManifest(dir, UNIT).landings[`${UNIT}-1-1`]['.'];
  return { by, first };
};

/** Card's file on GitHub's main. @param {string} dir */
const cardOnGithub = (dir) => git(bareOf(dir), ['show', 'main:card.txt']);

/** The tasks a verb's answer merged, in every repository it answers for. @param {{repos: {merged?: string[]}[]}} answer */
const mergedBy = (answer) => answer.repos.flatMap(({ merged = [] }) => merged);

describe('GitHub\'s landing driver: a task landed outside its open pull request (N3)', () => {
  for (const [how, land] of Object.entries(OUTSIDE)) {
    it(`by ${how}, nothing past it: land phase closes its pull request as landed, main gaining nothing, its record its landing by hand`, () => {
      const dir = project();
      ok(dir, openArgs(card));
      land(dir);
      const landed = side.defaultTip(dir);
      const answer = ok(dir, PHASE);

      assert.deepStrictEqual([mergedBy(answer), pulls(dir).map(({ state }) => state), side.defaultTip(dir), cardRecord(dir)], [[], ['CLOSED'], landed, { by: 'read', first: landed }]);
    });

    it(`by ${how}, then a later task rewriting its card and landing: land phase closes its pull request as landed, asking nothing settled, the later task's card kept`, () => {
      const dir = project();
      ok(dir, openArgs(card));
      land(dir);
      ok(dir, openArgs(cutTask(dir, '4.1', 'fix', 'Word the card', 'main', { 'card.txt': 'a card\n' })));
      ok(dir, ['land', 'phase', UNIT, '4']);
      const answer = ok(dir, PHASE);

      assert.deepStrictEqual([mergedBy(answer), pulls(dir).find(({ number }) => number === 1)?.state, cardOnGithub(dir)], [[], 'CLOSED', 'a card\n']);
    });

    it(`by ${how}, then changed: land phase brings its pull request up over that landing and lands the change alone, its first landing kept`, () => {
      const dir = project();
      ok(dir, openArgs(card));
      land(dir);
      const landed = side.defaultTip(dir);
      commitFiles(dir, card.branch, card.branch, { 'fix.txt': 'fix\n' });
      const answer = ok(dir, PHASE);

      assert.deepStrictEqual([mergedBy(answer), side.holds(dir).includes('fix.txt'), cardOnGithub(dir), cardRecord(dir)], [['1.1'], true, 'card\n', { by: 'engine', first: landed }]);
    });
  }

  it('by a squash, beneath a later task\'s pull request: land phase closes its pull request as landed and merges the later task\'s, main gaining that alone', () => {
    const dir = project();
    ok(dir, openArgs(card));
    mergeBack(dir, total.branch, card.branch);
    ok(dir, openArgs(total));
    side.squashedHere(dir, card.branch);
    const landed = side.defaultTip(dir);
    const answer = ok(dir, PHASE);

    assert.deepStrictEqual([mergedBy(answer), pulls(dir).map(({ state }) => state), git(bareOf(dir), ['log', '--format=%s', `${landed}..main`]).trim().split('\n').length, side.holds(dir).includes('total.txt')], [
      ['1.2'], ['CLOSED', 'MERGED'], 1, true,
    ]);
  });

  it('by a squash, beneath a later task\'s pull request taking its card back: land phase closes its pull request as landed and merges the later task\'s over its head, the card gone from main', () => {
    const dir = project();
    ok(dir, openArgs(card));
    mergeBack(dir, total.branch, card.branch);
    commitFiles(dir, total.branch, total.branch, {}, { removed: ['card.txt'] });
    ok(dir, openArgs(total));
    side.squashedHere(dir, card.branch);
    const answer = ok(dir, PHASE);

    assert.deepStrictEqual([mergedBy(answer), pulls(dir).map(({ state }) => state), ['card.txt', 'total.txt'].filter((file) => side.holds(dir).includes(file))], [['1.2'], ['CLOSED', 'MERGED'], ['total.txt']]);
  });

  it('by a squash, its pull request then closed on GitHub by hand: land phase stops at nothing, its record its landing by hand', () => {
    const dir = project();
    ok(dir, openArgs(card));
    side.squashedHere(dir, card.branch);
    const landed = side.defaultTip(dir);
    closeByHand(dir, 1);
    const answer = ok(dir, PHASE);

    assert.deepStrictEqual([mergedBy(answer), side.defaultTip(dir), cardRecord(dir)], [[], landed, { by: 'read', first: landed }]);
  });
});
