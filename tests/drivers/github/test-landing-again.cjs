'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (leeway-engine/scripts/drivers/landing/github/)
// and a feature's task changed after its pull request was squashed by hand
// on GitHub's site, its branch kept there (7.2.23): not landed — its stack
// open, the merge gate standing — until `land phase` lands its change
// through a new pull request from its branch, pushed first, brought up to
// main on GitHub over its tip at its landing (R29); then its stack merged,
// and no gate. A branch here brought onto main since, off GitHub's head
// that landed, is pushed over it, and lands so; where its change conflicts
// with a later change on main on GitHub, refused before anything is pushed
// or opened, the way on followed, it lands. GitHub's copy of its branch
// holding work the branch here lacks is test-landing-again-pull.cjs's;
// landings by hand read, test-landing-by-hand-read.cjs's. Git layer: the
// landing world on a fake GitHub (world.cjs), built once and copied for
// each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { openArgs, own, cutTask, commitFiles, landedOn, useLandingWorld, phaseReviewed, heldOn, followedOn, short } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, calls, headDeleted, pulls, ok, refused, tipOnGithub, squashedByHand, madeSince } = require('./world.cjs');
const { call, git } = require('../../scripts/engine-harness.cjs');

const project = useLandingWorld('github-landing-again-', side.prepare);

/** Whether step's merge gate for a phase stands, drawn rather than refused. @param {string} dir @param {number} phase */
function gateDrawn(dir, phase) {
  phaseReviewed(dir, phase, 'step');
  return call(dir, ['render', 'phase-merge-gate', 'pay', String(phase)], { env: GH_ENV }).code === 0;
}

/** The phase's close: its stack-merged item's state. @param {string} dir @param {number} phase */
const stackMerged = (dir, phase) => ok(dir, ['checklist', 'show', 'phase-close', 'pay', String(phase)]).items.find((/** @type {{key: string}} */ item) => item.key === 'stack-merged').state;

/** What a branch's head on GitHub was brought up to main from: its first parent. @param {string} dir @param {string} branch */
const broughtFrom = (dir, branch) => git(bareOf(dir), ['rev-parse', `${branch}^`]).trim();

/** The pull requests the two calls make: the new one, opened and squashed. */
const OPENED_AGAIN = Object.freeze([
  'pr create --base main --head feat/pay-4.1-add-tip --title feat(pay): Add tip --body Task: pay-4-1',
  'pr merge 2 --squash --subject feat(pay): Add tip (#2) --body Task: pay-4-1',
]);

describe('a feature\'s task changed after its pull request merged on GitHub (7.2.23)', () => {
  it('changed on top of its branch: not landed — its close reads its stack open and the merge gate stands in step, until land phase lands its change through a new pull request from its branch, pushed first; then its stack merged, and no gate', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    commitFiles(dir, tip.branch, tip.branch, { 'tip-note.txt': 'note\n' });
    const before = [stackMerged(dir, 4), gateDrawn(dir, 4)];
    phaseReviewed(dir, 4, 'auto');
    const from = calls(dir).length;
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));
    const after = [stackMerged(dir, 4), gateDrawn(dir, 4)];

    assert.deepStrictEqual([before, [landed.merged, landed.pull_requests], madeSince(dir, from), landedOn(bareOf(dir), 'main').map(({ task, paths }) => [task, paths]), after], [
      ['open', true], [['4.1'], [2]], OPENED_AGAIN, [['pay-4-1', ['tip.txt']], ['pay-4-1', ['tip-note.txt']]], ['done', false],
    ]);
  });

  it('changed on top here, then brought onto main since its landing, off GitHub\'s head that landed: read as new work, its branch pushed over that head, brought up to main, and its change landed through a new pull request', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    const head = tipOnGithub(dir, tip.branch);
    commitFiles(dir, tip.branch, tip.branch, { 'more.txt': 'more\n' });
    git(dir, ['rebase', '-q', '--onto', 'origin/main', head, tip.branch]);
    git(dir, ['switch', '-q', 'main']);
    const brought = git(dir, ['rev-parse', tip.branch]).trim();
    const from = calls(dir).length;
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([[landed.merged, landed.pull_requests], madeSince(dir, from), broughtFrom(dir, tip.branch), heldOn(bareOf(dir), 'more.txt'), stackMerged(dir, 4)], [
      [['4.1'], [2]], OPENED_AGAIN, brought, 'more\n', 'done',
    ]);
  });

  it('changed on top here, its change conflicting with a later change of its line on main on GitHub: refused before anything is pushed or opened, naming the way on — its commits since its landing rebased onto main and pushed; that followed, the conflict settled its way, its change lands', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    const later = cutTask(dir, '5.1', 'fix', 'Keep the tip', 'main', { 'tip.txt': 'tip, kept\n' }, { message: 'fix(pay): keep the tip\n\nLeeway-Task: pay-5-1' });
    ok(dir, openArgs(later));
    phaseReviewed(dir, 5, 'auto');
    ok(dir, ['land', 'phase', 'pay', '5']);
    const head = tipOnGithub(dir, tip.branch);
    commitFiles(dir, tip.branch, tip.branch, { 'tip.txt': 'tip, made again\n' });
    const from = calls(dir).length;
    const refusal = refused(dir, ['land', 'phase', 'pay', '4']);
    const untouched = [madeSince(dir, from), tipOnGithub(dir, tip.branch)];
    followedOn(dir, tip.branch, refusal, GH_ENV);
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([refusal, untouched, landed.merged, heldOn(bareOf(dir), 'tip.txt'), stackMerged(dir, 4)], [
      `land: task 4.1's change conflicts with origin/main at tip.txt, so its pull request was not opened again and nothing merged — rebase ${tip.branch}'s commits since its landing onto origin/main, settling the conflict in the rebase, with \`git rebase --onto origin/main ${short(head)} ${tip.branch}\`, push it with \`git push --force-with-lease origin ${tip.branch}\`, and land again`,
      [[], head], ['4.1'], 'tip, made again\n', 'done',
    ]);
  });

  it('its branch deleted on GitHub after its pull request merged, as auto-delete leaves it, then changed on top here: land phase pushes it there afresh and lands its change through a new pull request from it', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    headDeleted(dir, 1);
    const changed = commitFiles(dir, tip.branch, tip.branch, { 'tip-note.txt': 'note\n' });
    const from = calls(dir).length;
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([[landed.merged, landed.pull_requests], madeSince(dir, from), broughtFrom(dir, tip.branch), heldOn(bareOf(dir), 'tip-note.txt'), stackMerged(dir, 4)], [
      [['4.1'], [2]], OPENED_AGAIN, changed, 'note\n', 'done',
    ]);
  });

  it('changed on top here, main checked out with a change not committed to the file its change writes: refused before anything is pushed or opened, naming it', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    const head = tipOnGithub(dir, tip.branch);
    commitFiles(dir, tip.branch, tip.branch, { 'tip-note.txt': 'note\n' });
    fs.writeFileSync(path.join(dir, 'tip-note.txt'), 'in the way\n');
    git(dir, ['add', 'tip-note.txt']);
    const main = git(dir, ['rev-parse', '--short', 'main']).trim();
    const from = calls(dir).length;

    assert.deepStrictEqual([refused(dir, ['land', 'phase', 'pay', '4']), madeSince(dir, from), tipOnGithub(dir, tip.branch)], [
      `land: main is checked out at ${dir}, with changes not committed: tip-note.txt, so nothing moved — commit them, or detach your checkout from main with \`git switch --detach\`, which leaves it at ${main} with its edits, and land again; switching your checkout back to main is yours, when you're ready`,
      [], head,
    ]);
  });

  it('its file taken back on top here, main checked out with a change not committed to that file: refused before anything is pushed or opened, naming it — the merge read over its tip at its landing, which sees the file go', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    const head = tipOnGithub(dir, tip.branch);
    commitFiles(dir, tip.branch, tip.branch, {}, { removed: ['tip.txt'] });
    fs.writeFileSync(path.join(dir, 'tip.txt'), 'in the way\n');
    git(dir, ['add', 'tip.txt']);
    const main = git(dir, ['rev-parse', '--short', 'main']).trim();
    const from = calls(dir).length;

    assert.deepStrictEqual([refused(dir, ['land', 'phase', 'pay', '4']), madeSince(dir, from), tipOnGithub(dir, tip.branch)], [
      `land: main is checked out at ${dir}, with changes not committed: tip.txt, so nothing moved — commit them, or detach your checkout from main with \`git switch --detach\`, which leaves it at ${main} with its edits, and land again; switching your checkout back to main is yours, when you're ready`,
      [], head,
    ]);
  });

  it('changed on top here, GitHub refusing the merge of the pull request opened again, as for a required check: refused, that pull request left open; the next land phase merges it, opening none', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    commitFiles(dir, tip.branch, tip.branch, { 'tip-note.txt': 'note\n' });
    const from = calls(dir).length;
    const refusal = refused(dir, ['land', 'phase', 'pay', '4'], side.refuseMerge(dir).env);
    const left = [pulls(dir), madeSince(dir, from)];
    const between = calls(dir).length;
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([refusal, left, [landed.merged, landed.pull_requests], madeSince(dir, between), heldOn(bareOf(dir), 'tip-note.txt')], [
      'land: gh could not merge phase 4\'s stack: GraphQL: Required status check "test" is expected. (mergePullRequest) — settle what GitHub names, then land again',
      [[{ number: 1, state: 'MERGED', base: 'main' }, { number: 2, state: 'OPEN', base: 'main' }], OPENED_AGAIN], [['4.1'], [2]], [OPENED_AGAIN[1]], 'note\n',
    ]);
  });
});
