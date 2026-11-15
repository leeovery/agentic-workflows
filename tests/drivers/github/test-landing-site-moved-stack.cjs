'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (leeway-engine/scripts/drivers/landing/github/)
// and a stack of two — 1.1 opened from main, 1.2 stacked on its branch —
// whose landed task's branch moved on GitHub's site since its landing, a
// commit made there, nothing of it here (`refuseMovedSince`). 1.2 merged on
// the site into 1.1's branch, 1.1 then squashed there, then a commit on
// 1.1's branch there: `land phase` refuses, moving no ref here, the way on
// to pull that copy first; followed, the commit lands. 1.1 squashed on the
// site, a commit on its branch there, then 1.2 merged into that branch:
// refused so, then refused for the merge pulled past 1.1's landing, each
// way on followed, and both land. 1.1 squashed, then 1.2 merged into its
// branch, nothing else: that branch holds nothing past 1.2's merge, and
// the stack lands unrefused. Both squashed into main on the site, then a
// commit on 1.1's branch there: `land finish`, the stack landed, refuses,
// nothing merged; followed, the commit lands. Git layer: the landing world
// on a fake GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { UNIT, TASKS, useLandingWorld, finishReady, followedOn, heldOn, short } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, mergeByHand, madeOnGithub, ok, stackOfTwo, tipOnGithub } = require('./world.cjs');
const { call, git } = require('../../scripts/engine-harness.cjs');

const { card } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];
const FINISH = ['land', 'finish', UNIT];
const project = useLandingWorld('github-landing-site-moved-stack-', side.prepare);

/** A commit made on 1.1's branch on the site after its landing, writing post.txt: its sha. @param {string} dir */
const posted = (dir) => madeOnGithub(dir, card.branch, { 'post.txt': 'post\n' }, 'Apply suggestion after');

/** The refusal of 1.1's branch on GitHub moved to `at` since its pull request landed. @param {string} at */
const movedSince = (at) => `land: task 1.1's branch ${card.branch} on GitHub, at ${short(at)}, holds work made since its pull request #1 landed, which main lacks, and nothing merged — `
  + `on ${card.branch}, pull its copy on GitHub first with \`git pull --rebase origin ${card.branch}\`, and land again`;

/**
 * `args` run as the person runs them, each refusal's way on followed on
 * 1.1's branch, until they go through: the refusals, in order.
 * @param {string} dir @param {string[]} args
 */
function landed(dir, args) {
  const refusals = [];
  for (let res = call(dir, args, { env: GH_ENV }); res.code !== 0; res = call(dir, args, { env: GH_ENV })) {
    const { error } = JSON.parse(res.stderr.trim());
    refusals.push(error);
    if (refusals.length > 3) throw new Error(`still refused: ${error}`);
    followedOn(dir, card.branch, error, GH_ENV);
  }
  return refusals;
}

/** What main on GitHub holds of `files`. @param {string} dir @param {string[]} files */
const onMain = (dir, files) => files.map((file) => heldOn(bareOf(dir), file));

describe('a stack whose landed task\'s branch moved on GitHub\'s site since its landing', () => {
  it('1.2 merged on the site into 1.1\'s branch, 1.1 then squashed there, then a commit made on 1.1\'s branch there, main pulled here: land phase refuses before anything merges, moving no ref here, naming the way on — that copy pulled first; followed, the commit lands', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 2, undefined, 'merge');
    mergeByHand(dir, 1, undefined, 'squash');
    const at = posted(dir);
    side.pulled(dir);
    const refs = () => git(dir, ['for-each-ref', '--format=%(refname) %(objectname)']);
    const before = refs();
    const res = call(dir, PHASE, { env: GH_ENV });
    const stood = refs();
    const error = res.code === 0 ? null : JSON.parse(res.stderr.trim()).error;
    if (error !== null) followedOn(dir, card.branch, error, GH_ENV);
    const after = landed(dir, PHASE);
    finishReady(dir);
    ok(dir, FINISH);

    assert.deepStrictEqual([error, stood, after, onMain(dir, ['post.txt', 'total.txt'])], [movedSince(at), before, [], ['post\n', 'total\n']]);
  });

  it('1.1 squashed on the site, a commit then made on its branch there, then 1.2 merged on the site into that branch: land phase refuses for the commit, then for the merge pulled past 1.1\'s landing, each way on followed, and both land', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 1, undefined, 'squash');
    posted(dir);
    mergeByHand(dir, 2, undefined, 'merge');
    const at = tipOnGithub(dir, card.branch);
    const refusals = landed(dir, PHASE);
    finishReady(dir);
    ok(dir, FINISH);

    assert.deepStrictEqual([refusals.length, refusals[0], / merged \S+ past its work's landing on main /.test(refusals[1]), onMain(dir, ['post.txt', 'total.txt'])], [2, movedSince(at), true, ['post\n', 'total\n']]);
  });

  it('1.1 squashed on the site, then 1.2 merged on the site into 1.1\'s branch, nothing else: that branch holds nothing past 1.2\'s merge, and land phase and land finish land the stack unrefused', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 1, undefined, 'squash');
    mergeByHand(dir, 2, undefined, 'merge');
    const refusals = landed(dir, PHASE);
    finishReady(dir);
    ok(dir, FINISH);

    assert.deepStrictEqual([refusals, onMain(dir, ['card.txt', 'total.txt'])], [[], ['card\n', 'total\n']]);
  });

  it('1.1 and 1.2 each squashed into main on the site, then a commit made on 1.1\'s branch there: land finish, the stack landed, refuses before anything merges, naming the way on — that copy pulled first; followed, land finish lands the commit', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 1, undefined, 'squash');
    mergeByHand(dir, 2, 'main', 'squash');
    const at = posted(dir);
    finishReady(dir);
    const refusals = landed(dir, FINISH);

    assert.deepStrictEqual([refusals, onMain(dir, ['post.txt', 'total.txt'])], [[movedSince(at)], ['post\n', 'total\n']]);
  });
});
