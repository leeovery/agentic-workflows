'use strict';

// ---------------------------------------------------------------------------
// A task's worktree and its submodules, each one a gitlink `.gitmodules`
// maps (kernel/repos.cjs; task-worktree.cjs; the commit door, engine.cjs's
// checkedGroups): a submodule whose path holds a space is read whole — laid
// out at the commit its holder points at, its pointer the task moved
// recorded by the ordinary route, staged by `git add -A` and never refused,
// and by the merge route; a project nested in a larger repository commits
// such a pointer staged as its own names it; and as the task ends, a
// submodule's folder is made again where its worktree went, a nested clone's
// that `git add` staged never. Git layer: the task worktree world
// (task-worktree-world.cjs), built once and copied for each test. The links
// and nested clones held out of the door: test-engine-task-worktree-held-out.cjs.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, git, createFile, initRepo, addSubmodule, accountTaken } = require('./engine-harness.cjs');
const { UNIT, taskWorktreeWorld, as, building, isolation, layOut } = require('./task-worktree-world.cjs');

const project = taskWorktreeWorld('engine-task-worktree-submodules-');

/** A commit in `repo` adding `file`, made by git as a builder makes one. @param {string} repo @param {string} file */
function committed(repo, file) {
  createFile(repo, file, `${file}\n`);
  git(repo, ['add', file]);
  git(repo, ['commit', '-q', '-m', file]);
}

/** A merge in progress in `repo`, `--no-ff --no-commit`, of a commit holding HEAD's tree, as the chain slot begins one. @param {string} repo */
function mergeBegun(repo) {
  git(repo, ['merge', '-q', '--no-ff', '--no-commit', git(repo, ['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'chained']).trim()]);
}

describe('a task\'s worktree: a submodule is a gitlink .gitmodules maps', () => {
  it('N1: a submodule whose path holds a space is read from .gitmodules whole — laid out at the commit its holder points at, never its own tip; its pointer the task moved recorded by the ordinary route, staged by git add -A and never refused, and by the merge route', () => {
    const at = project();
    const upstream = initRepo(path.join(path.dirname(at.dir), 'sdk-upstream'));
    git(upstream, ['commit', '-q', '--allow-empty', '-m', 'sdk']);
    const own = addSubmodule(at.lib, 'my sdk', upstream);
    const pointer = git(at.lib, ['rev-parse', 'HEAD:my sdk']).trim();
    git(own, ['commit', '-q', '--allow-empty', '-m', 'past the pointer']);
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    const lib = path.join(a, 'lib');
    const sdk = path.join(lib, 'my sdk');
    const laidAt = git(sdk, ['rev-parse', 'HEAD']).trim();
    const recorded = () => git(lib, ['rev-parse', 'HEAD:my sdk']).trim() === git(sdk, ['rev-parse', 'HEAD']).trim();

    createFile(sdk, 'a.txt', 'a\n');
    ok(a, ['commit', '--paths', 'lib/my sdk/a.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): a'], as(session));
    const ordinary = recorded();
    committed(sdk, 'b.txt');
    createFile(lib, 'lib-b.txt', 'b\n');
    git(lib, ['add', '-A']);
    ok(a, ['commit', '--paths', 'lib/lib-b.txt', 'lib/my sdk', '--task', UNIT, '3.1', '-m', 'feat(pay): b'], as(session));
    const staged = recorded();
    mergeBegun(lib);
    committed(sdk, 'c.txt');
    createFile(lib, 'lib-c.txt', 'c\n');
    git(lib, ['add', '-A']);
    ok(a, ['commit', '--paths', 'lib/lib-c.txt', '--task', UNIT, '3.1', '-m', 'merge(pay): the chain back'], as(session));

    assert.deepStrictEqual([laidAt, ordinary, staged], [pointer, true, true]);
    assert.deepStrictEqual([recorded(), git(lib, ['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(' ').length - 1], [true, 2], 'the merge route');
  });

  it('N2: a project nested in a larger repository commits its submodule\'s pointer the task moved and git add -A staged, read by the project\'s own names, never refused', () => {
    const at = project();
    const upstream = initRepo(path.join(path.dirname(at.dir), 'deep-upstream'));
    git(upstream, ['commit', '-q', '--allow-empty', '-m', 'deep']);
    addSubmodule(at.dir, 'app/deep', upstream);
    const session = building(at.dir, ['3.1']);
    const app = path.join(isolation(at.dir, 'a'), 'app');
    ok(app, layOut('3.1'), as(session));
    const deep = path.join(app, 'deep');
    committed(deep, 'd.txt');
    createFile(app, 'fees.txt', 'fees\n');
    git(app, ['add', '-A']);

    ok(app, ['commit', '--paths', 'fees.txt', 'deep', '--task', UNIT, '3.1', '-m', 'feat(pay): fees'], as(session));

    assert.strictEqual(git(app, ['rev-parse', 'HEAD:app/deep']).trim(), git(deep, ['rev-parse', 'HEAD']).trim());
  });

  it('N3: as the task ends, a submodule\'s folder is made again where its worktree went, as its holder\'s checkout leaves it — a nested clone\'s that git add -f staged in its holder past an ignore rule never', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    git(a, ['add', '-f', 'lib']);
    accountTaken(at.dir, UNIT, '3.1');

    const { removed } = ok(at.dir, ['task', 'done', UNIT, '3.1'], as(session));

    assert.deepStrictEqual([removed, fs.existsSync(path.join(a, 'ext')), fs.existsSync(path.join(a, 'lib'))], [[path.join(a, 'ext'), path.join(a, 'lib')], true, false]);
  });
});
