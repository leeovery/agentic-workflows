'use strict';

// ---------------------------------------------------------------------------
// A task's worktree (leeway-engine/scripts/domain/task-worktree.cjs, `task
// worktree` in task-verbs.cjs; the record on the position, position.cjs and
// conversation.cjs's `taskAt`; the commit door's binding, commit-task.cjs):
// run by the builder in the worktree Claude Code's isolation made, it makes
// the task's branch there in place, the isolation's own branch left as it
// stands, and lays each child repository out at its folder on the same
// branch — a submodule at the commit the worktree's commit points it at, a
// clone at its own checkout's commit, a branch made already checked out as it
// stands, a worktree already there on another branch taking it in place as
// the project's own does, switched to where clean — recording the worktree
// against the task, and answering a run again so (12.7.10); a branch out in
// a worktree whose folder is gone refused with the way on, which lays it out
// once followed; every refusal making nothing. Two tasks side by side, each
// in its own worktree and branch, commit through the door there — the
// project's checks reading every repository — and both land, chained, each
// in the repositories it touched, a submodule's pointer recorded in the
// repository holding it (12.S15, 12.S53, 7.S19); a commit naming another
// task from a task's worktree, or a laid-out task from outside its own, is
// refused. `task done` and `task close` take the child worktrees apart,
// deepest first, refused where one holds changes not committed, so the
// isolation's worktree is removed plainly and the task laid out again in
// another. Git layer: the nested world (landing-world.cjs), built once and
// copied for each test, an isolation's worktree beside the project for each
// builder.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, call, refuses, refusedPristine, git, tip, commitAll, createFile, initRepo, addSubmodule, statePath, layout, readState, writeState,
} = require('./engine-harness.cjs');
const { NESTED, NESTED_TASKS, TRACKER, track, landedOn, setLandingDriver, useNestedWorld, followRemedy } = require('./landing-world.cjs');
const { readPosition } = require('../../skills/leeway-engine/scripts/domain/conversation.cjs');

const SIDE = require(path.join(__dirname, '..', 'drivers', TRACKER.name, 'task.cjs'));

const UNIT = 'pay';
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const FEES = 'feat/pay-3.1-add-fees';
const SHOW = 'feat/pay-3.2-show-fees';
const CAP = 'feat/pay-3.3-cap-fees';
const { rates, cache } = NESTED_TASKS;

const project = useNestedWorld('engine-task-worktree-', (dir) => {
  setLandingDriver(dir, 'local');
  track(dir, '3.1', 'feat', 'Add fees');
  track(dir, '3.2', 'feat', 'Show fees');
  track(dir, '3.3', 'feat', 'Cap fees');
  commitAll(dir, 'phase 3\'s tasks');
});

/** @type {string[]} */
const sessions = [];
after(() => sessions.forEach((session) => fs.rmSync(path.join(CONFIG, 'conversations', session), { recursive: true, force: true })));

/** A call's options in the conversation `session`. @param {string} session */
const as = (session) => ({ env: { CLAUDE_CODE_SESSION_ID: session } });

/** A conversation of its own, building each of `tasks`, each started through `task start`. @param {string} dir @param {string[]} tasks */
function building(dir, tasks) {
  const session = `task-worktree-${sessions.length + 1}`;
  sessions.push(session);
  for (const task of tasks) ok(dir, ['task', 'start', UNIT, task], as(session));
  return session;
}

/** The worktree Claude Code's isolation makes for a builder, on a branch of its own, beside the project. @param {string} dir @param {string} name */
function isolation(dir, name) {
  const tree = path.join(fs.realpathSync(path.dirname(dir)), 'worktrees', name);
  git(dir, ['worktree', 'add', '-q', '-b', `worktree-agent-${name}`, tree]);
  return tree;
}

/** The argv laying a task's worktree out. @param {string} task */
const layOut = (task) => ['task', 'worktree', UNIT, task];

/** Task 3.1 laid out at `tree` in the conversation `session`: its refusal, if it is refused. @param {string} tree @param {string} session @returns {{error?: string}} */
function layOutOrRefusal(tree, session) {
  const res = call(tree, layOut('3.1'), as(session));
  return res.code === 0 ? {} : { error: JSON.parse(res.stderr).error };
}

/** What a layout makes, in each repository of the nested world: its branches at their tips, and its worktrees on theirs. @param {import('./landing-world.cjs').Nested} at */
const madeIn = (at) => [at.dir, at.ext, at.lib].map((repo) => [
  git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']).split('\n').filter((line) => !line.startsWith('refs/heads/leeway-state ')),
  git(repo, ['worktree', 'list', '--porcelain']),
]);

/**
 * Each repository of a laid-out project, by its folder there — the nested
 * world's, unless given — the branch it has out and its commit.
 * @param {string} tree @param {string[]} [folders]
 */
const checkoutsOf = (tree, folders = ['.', NESTED.ext.folder, NESTED.lib.folder]) => folders.map((folder) => {
  const at = path.join(tree, folder);
  return [git(at, ['symbolic-ref', '--short', 'HEAD']).trim(), tip(at, 'HEAD')];
});

/** The project's environment setup set to `environment`. @param {string} dir @param {unknown} environment */
function setEnvironment(dir, environment) {
  const manifest = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...manifest, environment }, null, 2));
}

/** The tasks a default branch gained past the base, oldest first. @param {string} dir @param {string} into */
const tasksOn = (dir, into) => landedOn(dir, into).map(({ task }) => task);

describe('task worktree: every repository laid out (12.7.10, 7.2.21)', () => {
  it('makes the task\'s branch in place and lays each child repository out on it — a submodule at the commit the worktree\'s commit points it at, a clone at its own checkout\'s — recording the worktree against the task, the isolation\'s branch left as it stands', () => {
    const at = project();
    git(at.ext, ['checkout', '-q', rates.branch]);
    git(at.lib, ['checkout', '-q', cache.branch]);
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');
    const was = { head: tip(tree, 'HEAD'), status: git(tree, ['status', '--porcelain']) };

    const answer = ok(tree, layOut('3.1'), as(session));

    assert.deepStrictEqual(answer, {
      ok: true, task: '3.1', id: 'pay-3-1', branch: FEES, worktree: tree,
      repos: [{ repo: '.', path: tree }, { repo: 'ext', path: path.join(tree, 'ext') }, { repo: 'lib', path: path.join(tree, 'lib') }],
      recorded: true,
    });
    assert.deepStrictEqual(checkoutsOf(tree), [[FEES, was.head], [FEES, tip(at.dir, 'HEAD:ext')], [FEES, tip(at.lib, 'HEAD')]]);
    assert.notStrictEqual(tip(at.dir, 'HEAD:ext'), tip(at.ext, 'HEAD'), 'the submodule\'s own checkout is elsewhere');
    assert.deepStrictEqual([tip(at.dir, 'worktree-agent-a'), git(tree, ['status', '--porcelain'])], [was.head, was.status]);
    assert.deepStrictEqual(readPosition(session)?.tasks, [{ task: '3.1', builder: null, reviewers: [], worktree: tree }]);
  });

  it('answers each repository laid out already where it is run again, making nothing', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');
    ok(tree, layOut('3.1'), as(session));
    const before = madeIn(at);

    assert.deepStrictEqual(ok(tree, layOut('3.1'), as(session)).repos.map(({ repo, already }) => [repo, already]), [['.', true], ['ext', true], ['lib', true]]);
    assert.deepStrictEqual(madeIn(at), before);
  });

  it('checks a child repository\'s branch made already, and out nowhere, out as it stands', () => {
    const at = project();
    git(at.lib, ['branch', FEES, cache.branch]);
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');

    ok(tree, layOut('3.1'), as(session));

    assert.deepStrictEqual(checkoutsOf(tree)[2], [FEES, tip(at.lib, cache.branch)]);
  });

  it('lays out only the folder of a larger repository the project is, a submodule there at the commit its path from the repository\'s top points it at (7.2.17)', () => {
    const at = project();
    const upstream = initRepo(path.join(path.dirname(at.dir), 'deep'));
    git(upstream, ['commit', '-q', '--allow-empty', '-m', 'deep']);
    const deep = addSubmodule(at.dir, 'app/deep', upstream);
    git(deep, ['commit', '-q', '--allow-empty', '-m', 'past the pointer']);
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');
    const app = path.join(tree, 'app');

    const answer = ok(app, layOut('3.1'), as(session));

    assert.deepStrictEqual([answer.worktree, answer.repos], [tree, [{ repo: '.', path: app }, { repo: 'deep', path: path.join(app, 'deep') }]]);
    assert.deepStrictEqual(checkoutsOf(app, ['.', 'deep'])[1], [FEES, tip(at.dir, 'HEAD:app/deep')]);
    assert.notStrictEqual(tip(at.dir, 'HEAD:app/deep'), tip(deep, 'HEAD'), 'the submodule\'s own checkout is elsewhere');
  });

  it('refuses, making nothing: no conversation, the task not in flight, the project\'s own checkout, another task\'s worktree, a task with no type, its branch made already where this worktree has changes not committed or out in another worktree, a child\'s folder holding something else', () => {
    const at = project();
    SIDE.makeTask(statePath(at.dir), 'Round fees', { unit: UNIT, phase: 3, n: 5 });
    const session = building(at.dir, ['3.1', '3.2', '3.3', '3.5']);
    const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map((name) => isolation(at.dir, name));
    git(at.lib, ['worktree', 'add', '-q', '-b', 'unmounted', path.join(e, NESTED.lib.folder), NESTED.lib.into]);
    fs.rmSync(path.join(e, NESTED.lib.folder), { recursive: true });
    ok(a, layOut('3.1'), as(session));
    git(at.dir, ['branch', SHOW, 'main']);
    createFile(b, 'app.txt', 'my edit\n');
    fs.mkdirSync(path.join(c, NESTED.lib.folder));
    createFile(c, `${NESTED.lib.folder}/mine.txt`, 'mine\n');
    const stray = path.join(path.dirname(a), 'lib-tree');
    git(at.lib, ['worktree', 'add', '-q', '-b', CAP, stray, NESTED.lib.into]);
    const before = madeIn(at);

    const refusals = [
      [b, layOut('3.1'), {}],
      [b, layOut('3.4'), as(session)],
      [at.dir, layOut('3.1'), as(session)],
      [a, layOut('3.2'), as(session)],
      [b, layOut('3.5'), as(session)],
      [b, layOut('3.2'), as(session)],
      [b, layOut('3.1'), as(session)],
      [c, layOut('3.3'), as(session)],
      [d, layOut('3.3'), as(session)],
      [e, layOut('3.3'), as(session)],
    ].map(([cwd, args, opts]) => refuses(/** @type {string} */ (cwd), /** @type {string[]} */ (args), /** @type {object} */ (opts)).error);

    assert.deepStrictEqual(refusals, [
      'task worktree: no conversation is named, so no task is in flight — CLAUDE_CODE_SESSION_ID is unset; run it from the Claude Code conversation building the task',
      'task worktree: task 3.4 of pay is not in flight in this conversation — start it with `engine task start pay 3.4`, then run it again',
      `task worktree: ${fs.realpathSync(at.dir)} is the project's own checkout — run it in the worktree made for task 3.1 of pay`,
      `task worktree: this worktree, ${a}, is task 3.1 of pay's — build task 3.2 of pay in a worktree of its own`,
      'task worktree: task 3.5 of pay has no type in the tracker, and its branch is named from it — give it one with `engine task type pay 3.5 <type>`, then run it again',
      `task worktree: ${SHOW} is made already, and ${b} has changes not committed: app.txt, so nothing was laid out — commit them, or move them out of the way, then run it again`,
      `task worktree: task 3.1 of pay's branch ${FEES} is checked out at ${a} — build the task there`,
      'task worktree: lib in this worktree holds something other than a worktree of lib — move it out of the way, then run it again',
      `task worktree: task 3.3 of pay's branch ${CAP} is checked out in lib at ${stray} — build the task there`,
      `task worktree: lib in this worktree is a worktree of lib, at ${path.join(e, 'lib')}, whose folder is missing — remove that worktree with \`git -C ${fs.realpathSync(at.lib)} worktree remove ${path.join(e, 'lib')}\`, then run it again`,
    ]);
    assert.deepStrictEqual(madeIn(at), before);
  });

  it('takes the branch in place where a worktree is on another branch, the project\'s own and a child\'s alike — made at its commit, or, made already and out nowhere, switched to where the worktree is clean', () => {
    const at = project();
    const session = building(at.dir, ['3.1', '3.2']);
    git(at.dir, ['branch', FEES, rates.branch]);
    git(at.lib, ['branch', SHOW, cache.branch]);
    const [a, b] = ['a', 'b'].map((name) => isolation(at.dir, name));
    git(at.lib, ['worktree', 'add', '-q', '-b', 'mine', path.join(a, NESTED.lib.folder), cache.branch]);
    git(at.lib, ['worktree', 'add', '-q', '-b', 'yours', path.join(b, NESTED.lib.folder), NESTED.lib.into]);
    createFile(b, 'lib/lib.txt', 'my edit\n');

    ok(a, layOut('3.1'), as(session));
    const dirty = refuses(b, layOut('3.2'), as(session)).error;
    git(path.join(b, NESTED.lib.folder), ['checkout', '--', 'lib.txt']);
    ok(b, layOut('3.2'), as(session));

    assert.deepStrictEqual(checkoutsOf(a), [[FEES, tip(at.dir, rates.branch)], [FEES, tip(at.dir, `${rates.branch}:ext`)], [FEES, tip(at.lib, cache.branch)]]);
    assert.strictEqual(dirty, `task worktree: ${SHOW} is made already, and ${path.join(b, 'lib')} has changes not committed: lib.txt, so nothing was laid out — commit them, or move them out of the way, then run it again`);
    assert.deepStrictEqual(checkoutsOf(b)[2], [SHOW, tip(at.lib, cache.branch)]);
  });

  it('names a branch held by a worktree whose folder is gone, the way on removing it as the landing\'s remedy does — and lays out once each is followed', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    fs.renameSync(a, `${a} unmounted`);
    const b = isolation(at.dir, 'b');
    const [ext, lib] = [at.ext, at.lib].map((repo) => fs.realpathSync(repo));

    const refusals = [];
    for (let tries = 0; tries < 4; tries += 1) {
      const res = layOutOrRefusal(b, session);
      if (res.error === undefined) break;
      refusals.push(res.error);
      followRemedy(at.dir, res.error);
    }

    const gone = (/** @type {string} */ where, /** @type {string} */ tree, /** @type {string} */ command) => `task worktree: task 3.1 of pay's branch ${FEES} is checked out${where} at ${tree}, whose folder is missing — remove that worktree with \`${command}\`, then run it again`;
    assert.deepStrictEqual(refusals, [
      gone('', a, `git worktree remove ${a}`),
      gone(' in ext', path.join(a, 'ext'), `git -C ${ext} worktree remove ${path.join(a, 'ext')}`),
      gone(' in lib', path.join(a, 'lib'), `git -C ${lib} worktree remove ${path.join(a, 'lib')}`),
    ]);
    assert.deepStrictEqual(checkoutsOf(b).map(([branch]) => branch), [FEES, FEES, FEES]);
  });
});

describe('task done and task close: the task\'s worktree taken apart', () => {
  it('removes each child repository\'s worktree as the task ends — refused, nothing moved, where one has changes not committed — so the worktree is removed plainly, no child repository holds the branch out, and the task laid out again in a fresh one', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    createFile(a, 'fees.txt', 'fees\n');
    createFile(a, 'lib/lib-fees.txt', 'fees\n');
    ok(a, ['commit', '--paths', 'fees.txt', 'lib/lib-fees.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(session));
    createFile(a, 'lib/left.txt', 'left\n');

    const { error } = refusedPristine(at.dir, ['task', 'done', UNIT, '3.1'], as(session));
    const kept = readPosition(session)?.tasks?.map(({ task }) => task);
    fs.rmSync(path.join(a, 'lib', 'left.txt'));
    const done = ok(at.dir, ['task', 'done', UNIT, '3.1'], as(session));
    git(at.dir, ['worktree', 'remove', a]);
    git(at.ext, ['branch', '-d', FEES]);
    SIDE.reopenTask(statePath(at.dir), 'Add fees');
    ok(at.dir, ['task', 'start', UNIT, '3.1'], as(session));
    const b = isolation(at.dir, 'b');
    ok(b, layOut('3.1'), as(session));

    assert.strictEqual(error, `task done: ${FEES} is checked out at ${path.join(a, 'lib')}, with changes not committed: left.txt, so nothing moved — commit them, or move them out of the way, then run it again`);
    assert.deepStrictEqual(kept, ['3.1']);
    assert.deepStrictEqual(done, { ok: true, task: '3.1', id: 'pay-3-1', committed: done.committed, removed: [path.join(a, 'ext'), path.join(a, 'lib')] });
    assert.ok(!git(at.lib, ['worktree', 'list', '--porcelain']).includes(a), 'lib keeps a registration in the removed worktree');
    assert.deepStrictEqual(checkoutsOf(b), [[FEES, tip(at.dir, FEES)], [FEES, tip(at.dir, `${FEES}:ext`)], [FEES, tip(at.lib, FEES)]]);
  });

  it('removes them as a task is closed too, deepest first — a submodule of a clone before the clone — and a registration whose folder is gone with them', () => {
    const at = project();
    const upstream = initRepo(path.join(path.dirname(at.dir), 'inner'));
    git(upstream, ['commit', '-q', '--allow-empty', '-m', 'inner']);
    const inner = addSubmodule(at.lib, 'inner', upstream);
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    fs.rmSync(path.join(a, 'ext'), { recursive: true });

    const closed = ok(at.dir, ['task', 'close', UNIT, '3.1', '--reason', 'not wanted'], as(session));

    assert.deepStrictEqual(closed.removed, [path.join(a, 'lib', 'inner'), path.join(a, 'ext'), path.join(a, 'lib')]);
    assert.deepStrictEqual([at.ext, at.lib, inner].map((repo) => git(repo, ['worktree', 'list', '--porcelain']).includes(a)), [false, false, false]);
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
