'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (ledger-engine/scripts/drivers/landing/github/)
// and a feature's task merged by hand on GitHub's site, read as the one
// read of what has landed reads it (task-landed.cjs), past what every
// driver does (the landing conformance suite's). One merged with no landing
// naming it is read as landed — by a merge commit, main holding its last
// commit; rebased, its copies holding its change; or squashed under the
// person's own message, by its change: `land phase` answers it merged, and
// the phase moves on — its close reading its stack merged in auto, no merge
// gate standing for it in step (7.2.22, 29.15.7). A task that has landed
// stays landed: one of two commits squashed under the person's own message,
// a later task then rewriting a line of it, still answered merged, its
// stack merged, no gate, and the review's change keeping its landing (R25).
// Only content decides a landing (R28): a task of two commits, its first
// cherry-picked onto main by hand, its copy carrying the door's stamp, has
// not landed — its stack open — until `land phase` merges its pull request;
// a task of one commit cherry-picked so, its pull request open beneath
// another's, has landed and has not changed since, so `land phase` closes
// its pull request as landed, never merging it, and merges the later
// task's, bringing neither up to main (R29, N3); one changed
// after its pull request merged is test-landing-again.cjs's (7.2.23). A
// task's last
// commit is its branch's tip: one moved since it opened, kept aside and put
// back as the refusal says, then merged by GitHub's default button, pulled
// or not, has landed, the commit kept aside a task of its own; one whose
// last commit was dropped before it opened, then merged by a merge commit,
// has landed, never read by the commit the reflog keeps. A feature's stack
// merged by hand is test-landing-by-hand.cjs's. Git layer: the landing
// world on a fake GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { openArgs, own, cutTask, commitFiles, useLandingWorld, phaseReviewed, followRemedy } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, mergeByHand, onGithub, ok, refused, squashFromPullRequests, pulls } = require('./world.cjs');
const { git, withEnv, datedAt } = require('../../scripts/engine-harness.cjs');
const { changeOf } = require('../../../skills/ledger-engine/scripts/domain/review-change.cjs');
const { unitLanded } = require('../../../skills/ledger-engine/scripts/domain/task-landed.cjs');
const { projectRepos } = require('../../../skills/ledger-engine/scripts/kernel/repos.cjs');

const project = useLandingWorld('github-landing-by-hand-read-', side.prepare);

/** A repository's squash default making each squash's message the pull request's title alone, as a person's own message has no `Task:` line. */
const OWN_MESSAGE = Object.freeze({ squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'BLANK' });

/** The subjects of the landings the review's change draws, its work not landed read from phases 1 to `phases`. @param {string} dir @param {number} phases */
const landingsDrawn = (dir, phases) => withEnv(GH_ENV, () => changeOf(dir, 'pay', phases, null, projectRepos(dir), [])).holding.flatMap(({ parts }) => parts.map(({ landed }) => landed?.subject ?? null));

/**
 * The ways a person merges a feature's pull request on GitHub's site that
 * leave no landing naming its task by its `Task:` line: with a merge
 * commit, main then holding its last commit; rebased, its copies carrying
 * its stamp; or squashed under a message of their own — the repository's
 * squash default the pull request's title alone — read by its change.
 * @type {[string, 'merge'|'rebase'|'squash', boolean][]}
 */
const UNNAMED = [['a merge commit', 'merge', false], ['a rebase', 'rebase', false], ['a squash under the person\'s own message', 'squash', true]];

/** The phase's close: its stack-merged item's state. @param {string} dir @param {number} phase */
const stackMerged = (dir, phase) => ok(dir, ['checklist', 'show', 'phase-close', 'pay', String(phase)]).items.find((/** @type {{key: string}} */ item) => item.key === 'stack-merged').state;

describe('a feature\'s task merged by hand on GitHub\'s site, no landing naming it (7.2.22, 29.15.7)', () => {
  for (const [how, method, ownMessage] of UNNAMED) {
    it(`by ${how}: read as landed — land phase answers it merged, its close reads its stack merged in auto, and in step no merge gate stands for it`, () => {
      const dir = project();
      const tip = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' }, { message: 'feat(pay): add the tip\n\nLedger-Task: pay-4-1' });
      ok(dir, openArgs(tip));
      if (ownMessage) onGithub(dir, (state) => { state.squash = { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'BLANK' }; });
      mergeByHand(dir, 1, undefined, method);
      phaseReviewed(dir, 4, 'auto');
      const landed = ok(dir, ['land', 'phase', 'pay', '4']);
      const auto = stackMerged(dir, 4);
      phaseReviewed(dir, 4, 'step');

      assert.deepStrictEqual([landed.already, auto, refused(dir, ['render', 'phase-merge-gate', 'pay', '4'])], [
        true, 'done', 'render phase-merge-gate: phase 4 of pay is merged already — its tasks are on the default branch',
      ]);
    });
  }
});

describe('a feature\'s task that has landed, read again (7.2.22, R25)', () => {
  it('a task of two commits squashed by hand under the person\'s own message, then a later task rewriting a line it wrote: landed still — land phase answers it merged, its close reads its stack merged, no merge gate stands for it in step, and the review\'s change keeps its landing', () => {
    const dir = project();
    const tip = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'one\ntwo\nthree\n' });
    commitFiles(dir, tip.branch, tip.branch, { 'tip.txt': 'one\nTWO\nthree\n' });
    ok(dir, openArgs(tip));
    onGithub(dir, (state) => { state.squash = OWN_MESSAGE; });
    mergeByHand(dir, 1, undefined, 'squash');
    squashFromPullRequests(dir);
    phaseReviewed(dir, 4, 'auto');
    ok(dir, ['land', 'phase', 'pay', '4']);
    ok(dir, openArgs(cutTask(dir, '5.1', 'feat', 'Quiet two', 'main', { 'tip.txt': 'one\nTwo!\nthree\n' })));
    phaseReviewed(dir, 5, 'auto');
    ok(dir, ['land', 'phase', 'pay', '5']);
    const again = ok(dir, ['land', 'phase', 'pay', '4']);
    const auto = stackMerged(dir, 4);
    phaseReviewed(dir, 4, 'step');

    assert.deepStrictEqual([again.already, auto, refused(dir, ['render', 'phase-merge-gate', 'pay', '4']), landingsDrawn(dir, 5)], [
      true, 'done', 'render phase-merge-gate: phase 4 of pay is merged already — its tasks are on the default branch', ['feat(pay): Add tip', 'feat(pay): Quiet two (#2)'],
    ]);
  });

});

describe('a feature\'s task read by its content alone, the door\'s stamp never naming its landing (R28)', () => {
  it('a task of two commits, its first cherry-picked onto main by hand after the second, its copy carrying the stamp: not landed — its close reads its stack open, until land phase merges its pull request, main on GitHub gaining the rest of its work', () => {
    const dir = project();
    const task = cutTask(dir, '4.1', 'feat', 'Add ab', 'main', { 'a.txt': 'a\n' }, { message: 'feat(pay): add a\n\nLedger-Task: pay-4-1' });
    const first = git(dir, ['rev-parse', task.branch]).trim();
    commitFiles(dir, task.branch, task.branch, { 'b.txt': 'b\n' }, { message: 'feat(pay): add b\n\nLedger-Task: pay-4-1' });
    ok(dir, openArgs(task));
    const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
    git(dir, ['switch', '-q', 'main']);
    datedAt(new Date(Date.now() + 60_000).toISOString(), () => git(dir, ['cherry-pick', first]));
    git(dir, ['push', '-q', 'origin', 'main']);
    git(dir, ['switch', '-q', back]);
    phaseReviewed(dir, 4, 'auto');
    const before = [withEnv(GH_ENV, () => unitLanded(dir, 'pay', projectRepos(dir), null).landed({ unit: 'pay', phase: 4, n: 1 })), stackMerged(dir, 4)];
    const merged = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([before, [merged.merged, merged.pull_requests], git(bareOf(dir), ['show', 'main:b.txt']), stackMerged(dir, 4)], [[false, 'open'], [['4.1'], [1]], 'b\n', 'done']);
  });

  it('a task of one commit cherry-picked onto main by hand, its pull request open beneath a later task\'s: landed, never changed after its landing — land phase closes its pull request as landed and merges the later task\'s, bringing neither up to main (N3)', () => {
    const dir = project();
    const first = cutTask(dir, '4.1', 'feat', 'Add a', 'main', { 'a.txt': 'a\n' }, { message: 'feat(pay): add a\n\nLedger-Task: pay-4-1' });
    const second = cutTask(dir, '4.2', 'feat', 'Add b', first.branch, { 'b.txt': 'b\n' }, { message: 'feat(pay): add b\n\nLedger-Task: pay-4-2' });
    for (const task of [first, second]) ok(dir, openArgs(task));
    side.picked(dir, git(dir, ['rev-parse', first.branch]).trim());
    const heads = [first, second].map(({ branch }) => git(bareOf(dir), ['rev-parse', branch]).trim());
    phaseReviewed(dir, 4, 'auto');
    const merged = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([merged.merged, pulls(dir).map(({ state }) => state), [first, second].map(({ branch }) => git(bareOf(dir), ['rev-parse', branch]).trim()), git(bareOf(dir), ['show', 'main:b.txt'])], [
      ['4.2'], ['CLOSED', 'MERGED'], heads, 'b\n',
    ]);
  });
});

describe('a feature\'s task read by its branch as it stands (7.2.22)', () => {
  /** Task 4.1 cut, its commit stamped as the door stamps it, and opened. @param {string} dir */
  const opened = (dir) => {
    const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' }, { message: 'feat(pay): add the tip\n\nLedger-Task: pay-4-1' });
    ok(dir, openArgs(task));
    return task;
  };
  /** Whether task 4.1 has landed, as the one read reads it. @param {string} dir */
  const landed = (dir) => withEnv(GH_ENV, () => unitLanded(dir, 'pay', projectRepos(dir), null).landed({ unit: 'pay', phase: 4, n: 1 }));

  for (const [how, pulled, deleted] of /** @type {const} */ ([['pulled', true, false], ['not pulled', false, false], ['pulled, its branch deleted', true, true]])) {
    it(`moved since it opened, kept aside and put back as the refusal says, then merged by GitHub's default button, ${how}: landed — land phase answers it merged, its close reads its stack merged — the commit kept aside a task of its own`, () => {
      const dir = project();
      const task = opened(dir);
      commitFiles(dir, task.branch, `${task.branch}^`, { 'tip.txt': 'tip, made again\n' }, { message: 'feat(pay): add the tip, made again\n\nLedger-Task: pay-4-1' });
      phaseReviewed(dir, 4, 'auto');
      const refusal = refused(dir, ['land', 'phase', 'pay', '4']);
      followRemedy(dir, refusal);
      side.mergedOnGithub(dir, task.branch, 'merge', pulled);
      if (deleted) side.deleted(dir, task.branch);

      assert.deepStrictEqual([/has moved since it was opened/.test(refusal), ok(dir, ['land', 'phase', 'pay', '4']).already, stackMerged(dir, 4)], [true, true, 'done']);
    });
  }

  it('its last commit dropped from its branch before it opened, then merged by a merge commit, pulled: landed, never read by the commit the reflog keeps — land phase answers it merged, its close reads its stack merged', () => {
    const dir = project();
    const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' }, { message: 'feat(pay): add the tip\n\nLedger-Task: pay-4-1' });
    commitFiles(dir, task.branch, task.branch, { 'tip.txt': 'tip, a wrong turn\n' }, { message: 'feat(pay): a wrong turn\n\nLedger-Task: pay-4-1' });
    git(dir, ['branch', '-f', task.branch, `${task.branch}~1`]);
    ok(dir, openArgs(task));
    side.mergedOnGithub(dir, task.branch, 'merge', true);
    phaseReviewed(dir, 4, 'auto');

    assert.deepStrictEqual([landed(dir), ok(dir, ['land', 'phase', 'pay', '4']).already, stackMerged(dir, 4)], [true, true, 'done']);
  });
});
