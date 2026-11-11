'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (leeway-engine/scripts/drivers/landing/github/)
// and a feature's task changed after its pull request was squashed by hand
// on GitHub's site, its branch kept there (7.2.23): not landed — its stack
// open, the merge gate standing — until `land phase` lands its change
// through a new pull request from its branch, pushed first; then its stack
// merged, and no gate. A branch here moved off GitHub's head, that head
// landed — its last commit made again — is pushed over it, and lands so;
// where its change conflicts with main on GitHub, refused before anything
// is pushed or opened, the way on followed, it lands. A branch here moved
// off a head GitHub holds that has not landed is refused, both changed
// since the task landed, nothing pushed or opened — GitHub's merged into
// it, the two land whole. Landings by
// hand read are test-landing-by-hand-read.cjs's. Git layer: the landing
// world on a fake GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { openArgs, own, cutTask, commitFiles, landedOn, useLandingWorld, phaseReviewed, heldOn, mergedInto } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, calls, mergeByHand, headDeleted, pulls, ok, refused, tipOnGithub } = require('./world.cjs');
const { call, git } = require('../../scripts/engine-harness.cjs');

const project = useLandingWorld('github-landing-again-', side.prepare);

/** Whether step's merge gate for a phase stands, drawn rather than refused. @param {string} dir @param {number} phase */
function gateDrawn(dir, phase) {
  phaseReviewed(dir, phase, 'step');
  return call(dir, ['render', 'phase-merge-gate', 'pay', String(phase)], { env: GH_ENV }).code === 0;
}

/** The phase's close: its stack-merged item's state. @param {string} dir @param {number} phase */
const stackMerged = (dir, phase) => ok(dir, ['checklist', 'show', 'phase-close', 'pay', String(phase)]).items.find((/** @type {{key: string}} */ item) => item.key === 'stack-merged').state;

/** The pushes and pull requests made since the call count `from`. @param {string} dir @param {number} from */
const madeSince = (dir, from) => calls(dir).slice(from).filter((made) => /^pr (create|merge)/.test(made));

/** Task 4.1, its commit stamped as the door stamps it, opened, squashed by hand on GitHub's site, and phase 4 landed. @param {string} dir */
function squashedByHand(dir) {
  const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' }, { message: 'feat(pay): add the tip\n\nLeeway-Task: pay-4-1' });
  ok(dir, openArgs(task));
  mergeByHand(dir, 1, undefined, 'squash');
  phaseReviewed(dir, 4, 'auto');
  ok(dir, ['land', 'phase', 'pay', '4']);
  return task;
}

/** Task 4.1's last commit made again here, as an amend leaves it, writing `files`. @param {string} dir @param {string} branch @param {Record<string, string>} files */
const madeAgain = (dir, branch, files) => commitFiles(dir, branch, `${branch}^`, files, { message: 'feat(pay): add the tip, made again\n\nLeeway-Task: pay-4-1' });

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

  it('its last commit made again here, GitHub\'s head that landed: its branch pushed over that head, and its change landed through a new pull request', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    const head = tipOnGithub(dir, tip.branch);
    const again = madeAgain(dir, tip.branch, { 'tip.txt': 'tip\n', 'more.txt': 'more\n' });
    const from = calls(dir).length;
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([head === again, [landed.merged, landed.pull_requests], madeSince(dir, from), tipOnGithub(dir, tip.branch), heldOn(bareOf(dir), 'more.txt'), stackMerged(dir, 4)], [
      false, [['4.1'], [2]], OPENED_AGAIN, again, 'more\n', 'done',
    ]);
  });

  it('its last commit made again here, its change conflicting with main on GitHub: refused before anything is pushed or opened, naming the way on; main merged into its branch, its change lands', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    const head = tipOnGithub(dir, tip.branch);
    madeAgain(dir, tip.branch, { 'tip.txt': 'tip, made again\n' });
    const from = calls(dir).length;
    const refusal = refused(dir, ['land', 'phase', 'pay', '4']);
    const untouched = [madeSince(dir, from), tipOnGithub(dir, tip.branch)];
    mergedInto(dir, tip.branch, 'origin/main');
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([refusal, untouched, landed.merged, heldOn(bareOf(dir), 'tip.txt'), stackMerged(dir, 4)], [
      `land: task 4.1's change conflicts with origin/main at tip.txt, so its pull request was not opened again and nothing merged — merge origin/main into ${tip.branch}, settling the conflict, and land again`,
      [[], head], ['4.1'], 'tip, made again\n', 'done',
    ]);
  });

  it('its last commit made again here, GitHub\'s head moved on since it merged by a commit not landed: refused, both changed since it landed, nothing pushed or opened — GitHub\'s merged into it as the refusal says, the two land whole', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    commitFiles(dir, tip.branch, tip.branch, { 'note.txt': 'note\n' }, { message: 'feat(pay): a note\n\nLeeway-Task: pay-4-1' });
    git(dir, ['push', '-q', 'origin', tip.branch]);
    const head = tipOnGithub(dir, tip.branch);
    git(dir, ['branch', '-f', tip.branch, `${tip.branch}~1`]);
    const again = madeAgain(dir, tip.branch, { 'tip.txt': 'tip\n', 'more.txt': 'more\n' });
    const from = calls(dir).length;
    const refusal = refused(dir, ['land', 'phase', 'pay', '4']);
    const untouched = [madeSince(dir, from), tipOnGithub(dir, tip.branch)];
    mergedInto(dir, tip.branch, `origin/${tip.branch}`);
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([refusal, untouched, landed.merged, ['note.txt', 'more.txt'].map((file) => heldOn(bareOf(dir), file))], [
      `land: task 4.1's branch ${tip.branch} has moved here and on GitHub since its pull request #1 merged, to ${again.slice(0, 7)} and ${head.slice(0, 7)} — merge origin/${tip.branch} into ${tip.branch}, and land again`,
      [[], head], ['4.1'], ['note\n', 'more\n'],
    ]);
  });

  it('its branch deleted on GitHub after its pull request merged, as auto-delete leaves it, then changed on top here: land phase pushes it there afresh and lands its change through a new pull request from it', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    headDeleted(dir, 1);
    const changed = commitFiles(dir, tip.branch, tip.branch, { 'tip-note.txt': 'note\n' });
    const from = calls(dir).length;
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([[landed.merged, landed.pull_requests], madeSince(dir, from), tipOnGithub(dir, tip.branch), heldOn(bareOf(dir), 'tip-note.txt'), stackMerged(dir, 4)], [
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
