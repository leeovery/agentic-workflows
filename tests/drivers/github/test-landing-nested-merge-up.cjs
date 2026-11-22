'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver bringing a stack up to date across nested
// repositories (ledger-engine/scripts/drivers/landing/github/), past what
// every driver gives (the nested conformance suites'): a stack built on a
// phase GitHub squashed, its bottom's or one above it of a phase beside it,
// brought up to date with the default branch on GitHub first, the default
// branch merged into the bottom, each branch into the one above, every
// task then landing under its own subject (7.2.17, 7.2.18, S3); refused
// before anything is pushed where a merge conflicts in a file — naming its
// own commits rebased onto the default branch — or a branch here is
// checked out with changes the merge would touch; its merge refused where
// GitHub has not worked out by the driver's wait's end that each pull
// request pushed to can merge; and landed, once, by landing again where
// its merges were pushed but never moved here, each branch here brought to
// its pull request's head, nothing pushed anew, once GitHub has. The rest
// of the driver across nested repositories is test-landing-nested.cjs's.
// Git layer: the nested world (landing-world.cjs), each repository on a
// fake GitHub of its own (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git, tip } = require('../../scripts/engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, cutTask, useNestedWorld } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { github, bareOf, calls, lagOnGithub, tipOnGithub, ok, refused } = require('./world.cjs');

const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('github-landing-merge-up-', (dir) => {
  side.prepare(dir);
  for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
});

/** Each of the project's pull requests' state on GitHub. @param {string} dir */
const pullStates = (dir) => github(dir).pulls.map(({ state }) => state);

describe('GitHub\'s landing driver bringing a stack up to date across nested repositories (7.2.17)', () => {
  it('brings a stack built on a phase GitHub squashed up to date with the default branch on GitHub — the default branch merged into the bottom, each branch into the one above — refused before anything is pushed where a merge conflicts in a file or a branch here is checked out with changes; its merge refused where GitHub has not worked out by the wait\'s end that each pull request pushed to can merge; and lands, once, a stack whose merge-up was pushed and never moved here, nothing pushed anew, once GitHub has', () => {
    const at = project();
    const fix = cutTask(at.dir, '3.1', 'fix', 'Fix the app', show.branch, { 'fix.txt': 'fix\n' });
    const lower = cutTask(at.dir, '4.1', 'fix', 'Fix the rest', show.branch, { 'rest.txt': 'rest\n' });
    const upper = cutTask(at.dir, '4.2', 'fix', 'Fix it again', lower.branch, { 'fix.txt': 'again\n' });
    const page = cutTask(at.dir, '5.1', 'fix', 'Fix the page', show.branch, { 'page.txt': 'page\n' });
    const again = cutTask(at.dir, '5.2', 'fix', 'Fix the page again', page.branch, { 'again.txt': 'again\n' });
    for (const task of [rates, show, fix, lower, upper, page, again]) ok(at.dir, openArgs(task));
    for (const top of ['4.2', '5.2']) ok(at.dir, ['land', 'chain', 'pay', top]);
    ok(at.dir, ['land', 'phase', 'pay', '1']);
    const [head, main] = [tipOnGithub(at.dir, fix.branch), tipOnGithub(at.dir, 'main')];

    ok(at.dir, ['land', 'phase', 'pay', '3']);
    const top = bareOf(at.dir);
    const brought = tipOnGithub(at.dir, fix.branch);
    assert.deepStrictEqual(git(top, ['log', '-1', '--format=%s%n%P', brought]).trim().split('\n'), [`chore(pay): merge main into ${fix.branch}`, `${head} ${main}`]);
    assert.strictEqual(tip(at.dir, fix.branch), brought, 'the branch here is not at the commit pushed');
    assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), ['feat(pay): Add rates', 'feat(pay): Show rates', 'fix(pay): Fix the app']);

    const heads = [lower, upper].map((task) => tipOnGithub(at.dir, task.branch));
    assert.strictEqual(
      refused(at.dir, ['land', 'phase', 'pay', '4']),
      `land: ${upper.branch} conflicts with origin/main at fix.txt, so nothing was pushed and nothing merged — rebase phase 4's own commits onto origin/main, settling the conflict, with \`git rebase --onto origin/main ${git(at.dir, ['rev-parse', `${lower.branch}^`]).trim().slice(0, 7)} ${upper.branch} --update-refs\`, push its branches with \`git push --force-with-lease origin ${lower.branch} ${upper.branch}\`, and land again`,
    );
    assert.deepStrictEqual([[lower, upper].map((task) => tipOnGithub(at.dir, task.branch)), [lower, upper].map((task) => tip(at.dir, task.branch))], [heads, heads]);
    assert.deepStrictEqual(pullStates(at.dir), ['MERGED', 'MERGED', 'MERGED', 'OPEN', 'OPEN', 'OPEN', 'OPEN']);

    const beside = [page, again];
    const opened = beside.map((task) => tipOnGithub(at.dir, task.branch));
    const held = path.join(path.dirname(at.dir), 'held');
    git(at.dir, ['worktree', 'add', '-q', held, page.branch]);
    fs.writeFileSync(path.join(held, 'fix.txt'), 'mine\n');
    git(held, ['add', 'fix.txt']);
    assert.match(refused(at.dir, ['land', 'phase', 'pay', '5']), new RegExp(`^land: ${page.branch} is checked out at ${held}, with changes not committed: fix.txt, so nothing moved — `));
    assert.deepStrictEqual(beside.map((task) => tipOnGithub(at.dir, task.branch)), opened);

    git(held, ['reset', '-q', '--hard']);
    lagOnGithub(at.dir, 8);
    const reads = () => calls(at.dir).filter((call) => /^(pr view|stack merge) /.test(call)).map((call) => call.split(' --')[0]);
    const before = reads().length;
    assert.strictEqual(
      refused(at.dir, ['land', 'phase', 'pay', '5']),
      'land: GitHub has not finished checking whether #6 (task 5.1), #7 (task 5.2) can merge, so phase 5\'s stack was not merged — land again in a moment',
    );
    assert.deepStrictEqual(reads().slice(before), Array(7).fill(['pr view 6', 'pr view 7']).flat(), 'each pull request pushed to is read through the wait, and nothing merges');
    const pushed = beside.map((task) => tipOnGithub(at.dir, task.branch));
    assert.deepStrictEqual(pushed.map((made) => git(top, ['log', '-1', '--format=%s', made]).trim()), [`chore(pay): merge main into ${page.branch}`, `chore(pay): merge ${page.branch} into ${again.branch}`]);
    git(held, ['reset', '-q', '--hard', opened[0]]);
    git(at.dir, ['update-ref', `refs/heads/${again.branch}`, opened[1]]);

    const rerun = reads().length;
    ok(at.dir, ['land', 'phase', 'pay', '5']);
    assert.deepStrictEqual(reads().slice(rerun), ['pr view 6', 'pr view 7', 'pr view 6', 'pr view 7', 'stack merge 7'], 'merged once GitHub has worked them out');
    assert.deepStrictEqual(beside.map((task) => tip(at.dir, task.branch)), pushed);
    assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), [
      'feat(pay): Add rates', 'feat(pay): Show rates', 'fix(pay): Fix the app', 'fix(pay): Fix the page', 'fix(pay): Fix the page again',
    ]);
    assert.deepStrictEqual(pullStates(at.dir), ['MERGED', 'MERGED', 'MERGED', 'OPEN', 'OPEN', 'MERGED', 'MERGED']);
  });
});
