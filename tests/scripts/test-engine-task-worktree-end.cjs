'use strict';

// ---------------------------------------------------------------------------
// A task's worktree as the task ends, and tasks side by side
// (leeway-engine/scripts/domain/task-worktree.cjs, `task done` and `task
// close` in task-verbs.cjs; the commit door's binding, commit-task.cjs):
// `task done` and `task close` take every child repository's worktree the
// task has apart before the tracker moves — each with its branch out, never
// a repository's own checkout, and each in the worktree recorded for it —
// deepest first, refused, nothing moved, where one holds changes not
// committed, a nested submodule's pointer among them though never what the
// submodule or a nested clone holds; a removal failing leaves the task in
// flight for the verb run again; so the isolation's worktree is removed
// plainly and the task laid out again in another. Two tasks side by side,
// each in its own worktree and branch, commit through the door there — the
// project's checks reading every repository — and both land, chained, each
// in the repositories it touched, a submodule's pointer recorded in the
// repository holding it (12.S15, 12.S53, 7.S19); a commit naming another
// task from a task's worktree, or a laid-out task from outside its own, is
// refused. Git layer: the task worktree world (task-worktree-world.cjs),
// built once and copied for each test. Laying the worktree out:
// test-engine-task-worktree.cjs.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, refusedPristine, git, tip, createFile, initRepo, addSubmodule, statePath, layout, readState, writeState } = require('./engine-harness.cjs');
const { NESTED, landedOn } = require('./landing-world.cjs');
const { readPosition } = require('../../skills/leeway-engine/scripts/domain/conversation.cjs');
const { SIDE, UNIT, FEES, SHOW, taskWorktreeWorld, as, building, isolation, layOut, checkoutsOf } = require('./task-worktree-world.cjs');

const project = taskWorktreeWorld('engine-task-worktree-end-');

/** The worktrees a repository has registered, by their paths. @param {string} repo */
const registered = (repo) => git(repo, ['worktree', 'list', '--porcelain']).split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));

/** Where a task stands in the tracker. @param {string} dir @param {string} task */
const statusOf = (dir, task) => ok(dir, ['task', 'show', UNIT, task]).status;

/** The project's environment setup set to `environment`. @param {string} dir @param {unknown} environment */
function setEnvironment(dir, environment) {
  const manifest = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...manifest, environment }, null, 2));
}

/** The tasks a default branch gained past the base, oldest first. @param {string} dir @param {string} into */
const tasksOn = (dir, into) => landedOn(dir, into).map(({ task }) => task);

/** A submodule `inner` and a clone `vendor` nested in the project's clone, each with a commit. @param {string} lib */
function nestInLib(lib) {
  const upstream = initRepo(path.join(path.dirname(path.dirname(lib)), 'inner'));
  git(upstream, ['commit', '-q', '--allow-empty', '-m', 'inner']);
  const vendor = initRepo(path.join(lib, 'vendor'));
  git(vendor, ['commit', '-q', '--allow-empty', '-m', 'vendor']);
  return { inner: addSubmodule(lib, 'inner', upstream), vendor };
}

describe('task done and task close: the task\'s worktree taken apart', () => {
  it('removes each child repository\'s worktree before the task ends — refused, nothing moved, where one has changes not committed — so the worktree is removed plainly, no child repository holds the branch out, and the task laid out again in a fresh one', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    createFile(a, 'fees.txt', 'fees\n');
    createFile(a, 'lib/lib-fees.txt', 'fees\n');
    ok(a, ['commit', '--paths', 'fees.txt', 'lib/lib-fees.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(session));
    createFile(a, 'lib/left.txt', 'left\n');
    const trees = () => [at.ext, at.lib].map(registered);
    const laidOut = trees();

    const { error } = refusedPristine(at.dir, ['task', 'done', UNIT, '3.1'], as(session));
    const kept = { tasks: readPosition(session)?.tasks?.map(({ task }) => task), trees: trees(), status: statusOf(at.dir, '3.1') };
    fs.rmSync(path.join(a, 'lib', 'left.txt'));
    const done = ok(at.dir, ['task', 'done', UNIT, '3.1'], as(session));
    git(at.dir, ['worktree', 'remove', a]);
    git(at.ext, ['branch', '-d', FEES]);
    SIDE.reopenTask(statePath(at.dir), 'Add fees');
    ok(at.dir, ['task', 'start', UNIT, '3.1'], as(session));
    const b = isolation(at.dir, 'b');
    ok(b, layOut('3.1'), as(session));

    assert.strictEqual(error, `task done: ${FEES} is checked out at ${path.join(a, 'lib')}, with changes not committed: left.txt, so nothing moved — commit them, or move them out of the way, then run it again`);
    assert.deepStrictEqual(kept, { tasks: ['3.1'], trees: laidOut, status: 'in-progress' });
    assert.deepStrictEqual(done, { ok: true, task: '3.1', id: 'pay-3-1', committed: done.committed, removed: [path.join(a, 'ext'), path.join(a, 'lib')] });
    assert.ok(!registered(at.lib).includes(path.join(a, 'lib')), 'lib keeps a registration in the removed worktree');
    assert.deepStrictEqual(checkoutsOf(b), [[FEES, tip(at.dir, FEES)], [FEES, tip(at.dir, `${FEES}:ext`)], [FEES, tip(at.lib, FEES)]]);
  });

  it('removes them as a task is closed too, deepest first — a submodule of a clone before the clone — a registration whose folder is gone with them, and one in the worktree recorded for the task though off its branch', () => {
    const at = project();
    const { inner } = nestInLib(at.lib);
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    fs.rmSync(path.join(a, 'ext'), { recursive: true });
    git(path.join(a, 'lib'), ['switch', '-q', '--detach']);

    const closed = ok(at.dir, ['task', 'close', UNIT, '3.1', '--reason', 'not wanted'], as(session));

    assert.deepStrictEqual(closed.removed, [path.join(a, 'lib', 'vendor'), path.join(a, 'lib', 'inner'), path.join(a, 'ext'), path.join(a, 'lib')]);
    assert.deepStrictEqual([at.ext, at.lib, inner].map((repo) => registered(repo).some((tree) => tree.startsWith(a))), [false, false, false]);
  });

  it('finds them by the task\'s branch where the conversation holds no record of its worktree, as after a /clear — never taking a repository\'s own checkout, nor, for a task with no type to name its branch, a worktree on none', () => {
    const at = project();
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(building(at.dir, ['3.1'])));
    git(at.lib, ['checkout', '-q', '-b', SHOW, NESTED.lib.into]);
    const detached = path.join(path.dirname(a), 'lib-detached');
    git(at.lib, ['worktree', 'add', '-q', '--detach', detached, NESTED.lib.into]);
    SIDE.makeTask(statePath(at.dir), 'Round fees', { unit: UNIT, phase: 3, n: 5 });
    const session = building(at.dir, ['3.1', '3.2', '3.5']);

    const ended = ['3.1', '3.2', '3.5'].map((task) => ok(at.dir, ['task', 'done', UNIT, task], as(session)).removed);

    assert.deepStrictEqual(ended, [[path.join(a, 'ext'), path.join(a, 'lib')], undefined, undefined]);
    assert.deepStrictEqual([git(at.lib, ['symbolic-ref', '--short', 'HEAD']).trim(), registered(at.lib).includes(detached)], [SHOW, true]);
  });

  it('holds a nested submodule\'s pointer moved, staged or not, as a change its holder has not committed — never what the submodule holds, through the door, nor a nested clone\'s folder', () => {
    const at = project();
    nestInLib(at.lib);
    const session = building(at.dir, ['3.1', '3.2']);
    const [a, b] = ['a', 'b'].map((name) => isolation(at.dir, name));
    ok(a, layOut('3.1'), as(session));
    ok(b, layOut('3.2'), as(session));
    createFile(a, 'lib/inner/fees.txt', 'fees\n');
    ok(a, ['commit', '--paths', 'lib/inner/fees.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(session));
    const raw = path.join(b, 'lib', 'inner');
    git(raw, ['commit', '-q', '--allow-empty', '-m', 'raw']);

    const refusals = [refuses(at.dir, ['task', 'done', UNIT, '3.2'], as(session)).error];
    git(path.join(b, 'lib'), ['add', 'inner']);
    refusals.push(refuses(at.dir, ['task', 'done', UNIT, '3.2'], as(session)).error);
    const done = ok(at.dir, ['task', 'done', UNIT, '3.1'], as(session));

    const unpointed = `task done: ${SHOW} is checked out at ${path.join(b, 'lib')}, with changes not committed: inner, so nothing moved — commit them, or move them out of the way, then run it again`;
    assert.deepStrictEqual(refusals, [unpointed, unpointed]);
    assert.deepStrictEqual(done.removed, [path.join(a, 'lib', 'vendor'), path.join(a, 'lib', 'inner'), path.join(a, 'ext'), path.join(a, 'lib')]);
  });

  it('leaves the task in flight where a removal fails, and the verb run again finishes what is left', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    git(at.lib, ['worktree', 'lock', path.join(a, 'lib')]);

    refuses(at.dir, ['task', 'done', UNIT, '3.1'], as(session));
    const inFlight = () => (readPosition(session)?.tasks ?? []).map(({ task }) => task);
    const left = { status: statusOf(at.dir, '3.1'), tasks: inFlight() };
    git(at.lib, ['worktree', 'unlock', path.join(a, 'lib')]);
    const done = ok(at.dir, ['task', 'done', UNIT, '3.1'], as(session));

    assert.deepStrictEqual(left, { status: 'in-progress', tasks: ['3.1'] });
    assert.deepStrictEqual([done.removed, statusOf(at.dir, '3.1'), inFlight()], [[path.join(a, 'lib')], 'done', []]);
  });
});

describe('task worktree: tasks side by side (12.S15, 12.S53, 7.S19)', () => {
  it('two tasks, each in its own worktree and branch, commit through the door there — the project\'s checks reading every repository — and land chained, each in the repositories it touched, the submodule\'s pointer recorded in the project', () => {
    const at = project();
    setEnvironment(at.dir, { run: { tests: `test -f ${NESTED.lib.folder}/lib.txt && test -f ${NESTED.ext.folder}/ext.txt` } });
    const session = building(at.dir, ['3.1', '3.2']);
    const [a, b] = ['a', 'b'].map((name) => isolation(at.dir, name));
    ok(a, layOut('3.1'), as(session));
    ok(b, layOut('3.2'), as(session));
    createFile(a, 'fees.txt', 'fees\n');
    createFile(a, 'lib/lib-fees.txt', 'fees\n');
    createFile(b, 'show.txt', 'show\n');
    createFile(b, 'ext/ext-fees.txt', 'fees\n');

    const commits = [
      ok(a, ['commit', '--paths', 'fees.txt', 'lib/lib-fees.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(session)),
      ok(b, ['commit', '--paths', 'show.txt', 'ext/ext-fees.txt', '--task', UNIT, '3.2', '-m', 'feat(pay): show fees'], as(session)),
    ];
    git(b, ['merge', '-q', '--no-edit', FEES]);
    for (const task of ['3.1', '3.2']) ok(at.dir, ['land', 'open', UNIT, task]);
    const chained = ok(at.dir, ['land', 'chain', UNIT, '3.2']);
    ok(at.dir, ['land', 'phase', UNIT, '3']);

    assert.deepStrictEqual(commits.map(({ committed, checks }) => [committed.map(({ repo }) => repo), checks]), [
      [['lib', '.'], [{ name: 'tests', exit: 0 }]],
      [['ext', '.'], [{ name: 'tests', exit: 0 }]],
    ]);
    assert.deepStrictEqual(chained.repos.map(({ repo, stack }) => [repo, stack]), [['ext', ['3.2']], ['.', ['3.1', '3.2']]]);
    assert.deepStrictEqual([tasksOn(at.dir, 'main'), tasksOn(at.lib, NESTED.lib.into), tasksOn(at.ext, NESTED.ext.into)], [['pay-3-1', 'pay-3-2'], ['pay-3-1'], ['pay-3-2']]);
    assert.strictEqual(tip(at.dir, `main:${NESTED.ext.folder}`), tip(at.ext, NESTED.ext.into));
  });

  it('refuses a commit naming another task in flight from a task\'s worktree, and one for a task laid out from outside its worktree, naming the worktree — nothing committed', () => {
    const at = project();
    const session = building(at.dir, ['3.1', '3.2']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    createFile(a, 'fees.txt', 'fees\n');
    createFile(at.dir, 'nit.txt', 'nit\n');
    const heads = [tip(a, 'HEAD'), tip(at.dir, 'HEAD')];

    const errors = [
      refuses(a, ['commit', '--paths', 'fees.txt', '--task', UNIT, '3.2', '-m', 'feat(pay): show fees'], as(session)).error,
      refuses(at.dir, ['commit', '--paths', 'nit.txt', '--task', UNIT, '3.1', '-m', 'fix(pay): a nit'], as(session)).error,
    ];

    assert.deepStrictEqual(errors, [
      `commit --task: the worktree at ${a} is task 3.1 of pay's — commit task 3.2 of pay's work from its own worktree, or this work under task 3.1`,
      `commit --task: task 3.1 of pay is built in its worktree at ${a}, and its branch is checked out there alone — commit its work from there`,
    ]);
    assert.deepStrictEqual([tip(a, 'HEAD'), tip(at.dir, 'HEAD'), git(a, ['status', '--porcelain']), git(at.dir, ['status', '--porcelain', '--', 'nit.txt'])], [...heads, '?? fees.txt\n', '?? nit.txt\n']);
  });
});
