'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver bringing a stack up to date across nested
// repositories (workflow-engine/scripts/drivers/landing/github/), past what
// every driver gives (the nested conformance suites'): a stack whose squash
// of a pull request would meet a pointer both sides moved — its bottom's,
// or one above it of a phase side by side — brought up to date with the
// default branch on GitHub first, the default branch merged into the
// bottom, each branch into the one above, every task then landing under
// its own subject and the default branch pointing the submodule at the
// submodule's (7.2.17, 7.2.18); refused before anything is pushed where a
// merge conflicts in a file or a branch here is checked out with changes;
// and landed, once, by landing again where its merges were pushed but never
// moved here, each branch here brought to its pull request's head. The rest
// of the driver across nested repositories is test-landing-nested.cjs's.
// Git layer: the nested world (landing-world.cjs), each repository on a
// fake GitHub of its own (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { git, tip } = require('../../scripts/engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, track, cutTask, commitFiles, useNestedWorld } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { github, bareOf, tipOnGithub, ok, refused } = require('./world.cjs');

const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('github-landing-merge-up-', (dir) => {
  side.prepare(dir);
  for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
});

/** Each of the project's pull requests' state on GitHub. @param {string} dir */
const pullStates = (dir) => github(dir).pulls.map(({ state }) => state);

describe('GitHub\'s landing driver bringing a stack up to date across nested repositories (7.2.17)', () => {
  it('brings a stack up to date with the default branch on GitHub where a squash of its bottom pull request, or of one above it, would meet a pointer both sides moved — the default branch merged into the bottom, each branch into the one above — refused before anything is pushed where a merge conflicts in a file or a branch here is checked out with changes; and lands, once, a stack whose merge-up was pushed and never moved here', () => {
    const at = project();
    const fix = cutTask(at.dir, '3.1', 'fix', 'Fix the app', show.branch, { 'fix.txt': 'fix\n' });
    const lower = cutTask(at.dir, '4.1', 'fix', 'Fix the rest', show.branch, { 'rest.txt': 'rest\n' });
    const upper = cutTask(at.dir, '4.2', 'fix', 'Fix it again', lower.branch, { 'fix.txt': 'again\n' });
    const [page, again] = [cutTask(at.dir, '5.1', 'fix', 'Fix the page', 'main', { 'page.txt': 'page\n' }), track(at.dir, '5.2', 'fix', 'Fix ext again')];
    const moved = commitFiles(at.ext, again.branch, NESTED.ext.into, { 'ext-again.txt': 'again\n' });
    commitFiles(at.dir, again.branch, page.branch, { 'again.txt': 'again\n' }, { gitlinks: { [NESTED.ext.folder]: moved } });
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
    assert.strictEqual(git(top, ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), tipOnGithub(at.ext, NESTED.ext.into));

    const heads = [lower, upper].map((task) => tipOnGithub(at.dir, task.branch));
    assert.strictEqual(
      refused(at.dir, ['land', 'phase', 'pay', '4']),
      `land: ${upper.branch} conflicts with origin/main at fix.txt, so nothing was pushed and nothing merged — merge origin/main into ${upper.branch}, settling the conflict, push it, and land again`,
    );
    assert.deepStrictEqual([[lower, upper].map((task) => tipOnGithub(at.dir, task.branch)), [lower, upper].map((task) => tip(at.dir, task.branch))], [heads, heads]);
    assert.deepStrictEqual(pullStates(at.dir), ['MERGED', 'MERGED', 'MERGED', 'OPEN', 'OPEN', 'OPEN', 'OPEN']);

    const beside = [page, again];
    const opened = beside.map((task) => tipOnGithub(at.dir, task.branch));
    const held = path.join(path.dirname(at.dir), 'held');
    git(at.dir, ['worktree', 'add', '-q', held, page.branch]);
    git(held, ['update-index', '--cacheinfo', `160000,${moved},${NESTED.ext.folder}`]);
    assert.match(refused(at.dir, ['land', 'phase', 'pay', '5']), new RegExp(`^land: ${page.branch} is checked out at ${held}, with changes not committed: ext, so nothing moved — .+ \\(phase 5 merged in ext before it\\)$`));
    assert.deepStrictEqual(beside.map((task) => tipOnGithub(at.dir, task.branch)), opened);

    git(held, ['reset', '-q', '--', NESTED.ext.folder]);
    assert.match(refused(at.dir, ['land', 'phase', 'pay', '5'], { GH_STUB_FAULT: 'unmergeable@stack merge' }), /^land: gh could not merge phase 5's stack: /);
    const pushed = beside.map((task) => tipOnGithub(at.dir, task.branch));
    assert.deepStrictEqual(pushed.map((made) => git(top, ['log', '-1', '--format=%s', made]).trim()), [`chore(pay): merge main into ${page.branch}`, `chore(pay): merge ${page.branch} into ${again.branch}`]);
    git(held, ['reset', '-q', '--hard', opened[0]]);
    git(at.dir, ['update-ref', `refs/heads/${again.branch}`, opened[1]]);

    ok(at.dir, ['land', 'phase', 'pay', '5']);
    assert.deepStrictEqual(beside.map((task) => tip(at.dir, task.branch)), pushed);
    assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), [
      'feat(pay): Add rates', 'feat(pay): Show rates', 'fix(pay): Fix the app', 'fix(pay): Fix the page', 'fix(pay): Fix ext again',
    ]);
    assert.strictEqual(git(top, ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), tipOnGithub(at.ext, NESTED.ext.into));
    assert.deepStrictEqual(pullStates(at.dir), ['MERGED', 'MERGED', 'MERGED', 'OPEN', 'OPEN', 'MERGED', 'MERGED']);
  });
});
