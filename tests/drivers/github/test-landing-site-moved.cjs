'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (leeway-engine/scripts/drivers/landing/github/)
// and a task's pull request whose head moved on GitHub's site while it was
// open — a review's suggestion committed there, or its "Update branch"
// merging main in — the branch here never gaining that commit. Squashed or
// merged on the site, its head kept or deleted there, fetched here or not,
// the head GitHub took is fetched from the pull request's own ref where the
// repository lacks it: the branch here behind its landing has nothing new,
// and `land phase` answers already; given a commit of its own here, it is
// refused, nothing moved, the way on its own work laid on the commit that
// landed, and followed, that commit lands. Left open, the engine lands it
// at its head on GitHub. Every way, `land finish` goes through and main on
// GitHub holds the site's commit. Git layer: the landing world on a fake
// GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { UNIT, TASKS, openArgs, commitFiles, useLandingWorld, finishReady, followedOn, heldOn, short } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, headDeleted, mergeByHand, madeOnGithub, updatedOnGithub, ok, tipOnGithub } = require('./world.cjs');
const { call, git } = require('../../scripts/engine-harness.cjs');

const { card } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];
const project = useLandingWorld('github-landing-site-moved-', side.prepare);

/** A review's suggestion committed on the site to 1.1's pull request: the head GitHub then holds. @param {string} dir */
const suggested = (dir) => madeOnGithub(dir, card.branch, { 'card.txt': 'card, as suggested\n' }, 'Apply suggestions from code review');

/** 1.1's pull request squashed on the site: the landing on GitHub's main. @param {string} dir */
function squashed(dir) {
  mergeByHand(dir, 1, undefined, 'squash');
  return tipOnGithub(dir, 'main');
}

/**
 * The refusal of 1.1's branch apart from its landing at `landing`, which
 * landed `head`, behind it with work of its own.
 * @param {string} head @param {string} landing
 */
const behind = (head, landing) => `land: task 1.1's branch ${card.branch} has moved apart from where its work landed on main (${short(landing)}): its commit ${short(head)} landed, which the branch lacks — `
  + `lay ${card.branch}'s own work on that commit with \`git rebase ${short(head)} ${card.branch}\`, and open the task with \`land open ${UNIT} 1.1\``;

/**
 * Each way the pull request's head moves on the site and it then lands, 1.1
 * opened first: what is done, answering what `land phase` first says — its
 * refusal, `already`, or `landed`; and what main on GitHub then holds.
 * @type {[string, (dir: string) => string, Record<string, string>][]}
 */
const ROWS = [
  ['a suggestion committed, squashed on the site, its head kept there and never fetched here', (dir) => {
    suggested(dir);
    squashed(dir);
    return 'already';
  }, { 'card.txt': 'card, as suggested\n' }],
  ['a suggestion committed, squashed on the site, its head deleted there and fetched here before', (dir) => {
    suggested(dir);
    squashed(dir);
    headDeleted(dir, 1);
    git(dir, ['fetch', '-q', 'origin']);
    return 'already';
  }, { 'card.txt': 'card, as suggested\n' }],
  ['a suggestion committed, squashed on the site, its head deleted there and never fetched here, then a commit here', (dir) => {
    const head = suggested(dir);
    const landing = squashed(dir);
    headDeleted(dir, 1);
    commitFiles(dir, card.branch, card.branch, { 'more.txt': 'more\n' });
    return behind(head, landing);
  }, { 'card.txt': 'card, as suggested\n', 'more.txt': 'more\n' }],
  ['"Update branch" on the site after a commit of the person\'s own on main, merged on the site by a merge commit, fetched here, then a commit here', (dir) => {
    side.picked(dir, commitFiles(dir, 'aside', 'main', { 'own.txt': 'own\n' }, { message: 'my own on main' }));
    updatedOnGithub(dir, card.branch);
    mergeByHand(dir, 1, undefined, 'merge');
    git(dir, ['fetch', '-q', 'origin']);
    commitFiles(dir, card.branch, card.branch, { 'more.txt': 'more\n' });
    return 'landed';
  }, { 'card.txt': 'card\n', 'more.txt': 'more\n', 'own.txt': 'own\n' }],
  ['a suggestion committed, its pull request left open, never fetched here', (dir) => {
    suggested(dir);
    return 'landed';
  }, { 'card.txt': 'card, as suggested\n' }],
];

describe('a task\'s pull request whose head moved on GitHub\'s site, the branch here never gaining that commit, landed', () => {
  for (const [how, move, held] of ROWS) {
    it(`${how}: land phase answers as its landing stands, refusing only work here past it, the way on followed; land finish goes through, and main on GitHub holds the site's commit`, () => {
      const dir = project();
      ok(dir, openArgs(card));
      const answered = move(dir);
      const first = call(dir, PHASE, { env: GH_ENV });
      const said = first.code === 0 ? (JSON.parse(first.stdout.split('\n')[0]).already ? 'already' : 'landed') : JSON.parse(first.stderr.trim()).error;
      if (first.code !== 0) {
        followedOn(dir, card.branch, said, GH_ENV);
        ok(dir, PHASE);
      }
      finishReady(dir);
      ok(dir, ['land', 'finish', UNIT]);

      assert.deepStrictEqual([said, Object.keys(held).map((file) => heldOn(bareOf(dir), file))], [answered, Object.values(held)]);
    });
  }
});
