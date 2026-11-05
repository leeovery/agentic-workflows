'use strict';

// ---------------------------------------------------------------------------
// The commit door's task (leeway-engine/scripts/domain/commit-task.cjs,
// with environment.cjs, and `commit --paths … --task` in engine.cjs): a
// code commit lands only for a task in flight in the calling conversation —
// several side by side, each builder's commit from its own worktree under
// its own task (12.S21) — its message Claude's with the trailer naming the
// task, joining the trailers it ends in (6.S8); the project's checks — its
// tests, then each linter — run in the code root before each commit is
// written, holding no lock, and the first to fail refuses it, nothing
// committed (6.S9, 15.S11); a merge in progress — the chain's tip
// merged back onto the task's branch — finished through the door, its
// resolution named, the checks run and the trailer on the merge commit,
// refused while a conflict stays unnamed, in a project at a repository's top
// or a folder of it, a child repository merged first
// and its holder's pointer resolved to the child's merged tip, staged by the
// builder as the chain slot says or by the door (12.14); and
// a tree with the state branch checked out is refused before any check runs
// (4.S20); and a commit from a checkout on a branch other than the task's
// refused, naming the worktree that has the task's branch out, or, with
// none, the verb that lays one out. Its paths and repos are today's code commit's,
// test-engine-commit-door-code.cjs's; that landing never reads the trailer as a
// landing is test-engine-land-reads.cjs's.
//
// Layer: git. World: a unit with two tasks written and another unit with a
// task of the first one's number, the code committed; one conversation
// building task 1.1, one building both side by side, another task 1.2, and
// another the other unit's 1.1, each started through `task start`, the
// project's checkout on task 1.1's branch; built once and copied for each
// test, a code worktree beside it for each builder's checks.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, refusedPristine, git, commitAll, fixtureFrom, cleanupFixture, statePath, createFile, initRepo, addSubmodule, commitCode, setEnvironment,
} = require('./engine-harness.cjs');
const { spawnSync } = require('child_process');
const { createManifest, templateFolder } = require('./discovery-test-utils.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const UNIT = 'pay';
const OTHER_UNIT = 'refunds';
const BUILDING = 'commit-task-building';
const PARALLEL = 'commit-task-parallel';
const ELSEWHERE = 'commit-task-elsewhere';
const CLEARED = 'commit-task-cleared';
const REFUNDING = 'commit-task-refunding';
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const MESSAGE = 'feat(pay): take a card';
/** Each task of the unit's branch, by its number. @param {number} n */
const branchOf = (n) => taskBranch({ unit: UNIT, phase: 1, n }, 'feat', 'Take a card');
const TASK = [
  '# Take a card', '', '## Type', 'feat', '', '## Problem', 'A card cannot be taken.', '', '## Solution', 'Add the card form.', '',
  '## Outcome', 'A card is taken.', '', '## Acceptance scenarios', '- Given a card, when it is taken, then it is charged.', '', '## Spec reference', '§1',
].join('\n');

const world = fixtureFrom('commit-task-', (dir) => {
  createManifest(dir, UNIT, {});
  createFile(dir, 'src/card.js', 'const card = 1;\n');
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  const file = path.join(templateFolder('commit-task-files-'), 'task.md');
  fs.writeFileSync(file, TASK);
  ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
  ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
  createManifest(dir, OTHER_UNIT, {});
  commitAll(dir, 'the other unit');
  ok(dir, ['task', 'phase', OTHER_UNIT, '1', '--title', 'Refunds']);
  ok(dir, ['task', 'create', OTHER_UNIT, '1', '--file', file]);
  fs.rmSync(file);
  git(dir, ['checkout', '-q', '-b', branchOf(1)]);
});

/** A call's options in the conversation `session`. @param {string} session */
const as = (session) => ({ env: { CLAUDE_CODE_SESSION_ID: session } });

/** The door's call for a task of the unit. @param {string} [task] @param {string[]} [paths] */
const commitArgs = (task = '1.1', paths = ['src/card.js']) => ['commit', '--paths', ...paths, '--task', UNIT, task, '-m', MESSAGE];

/** The file each marking check appends to, out of the code's tree. @param {string} dir */
const markerOf = (dir) => path.join(dir, '.git', 'checks.log');

/** A check that marks its name, the folder it runs in and the code's HEAD. @param {string} dir @param {string} name */
const marking = (dir, name) => `echo "${name} $(pwd -P) $(git rev-parse --short HEAD)" >> "${markerOf(dir)}"`;

/** What the marking checks wrote; '' where none ran. @param {string} dir */
const marked = (dir) => (fs.existsSync(markerOf(dir)) ? fs.readFileSync(markerOf(dir), 'utf8') : '');

/** The code's HEAD, short. @param {string} dir */
const codeHead = (dir) => git(dir, ['rev-parse', '--short', 'HEAD']).trim();

/**
 * A door call that must refuse, leaving the state as it was, the code's
 * HEAD where it stood and the change to the card uncommitted: its refusal.
 * @param {string} dir @param {string[]} args @param {{env?: Record<string, string|undefined>}} [opts]
 */
function refusedUncommitted(dir, args, opts) {
  const before = codeHead(dir);
  const { error } = refusedPristine(dir, args, opts);
  assert.deepStrictEqual([codeHead(dir), git(dir, ['status', '--porcelain', '--', 'src/card.js'])], [before, ' M src/card.js\n'], `engine ${args.join(' ')} committed on refusing`);
  return error;
}

before(() => {
  const dir = world();
  ok(dir, ['task', 'start', UNIT, '1.1'], as(BUILDING));
  for (const task of ['1.1', '1.2']) ok(dir, ['task', 'start', UNIT, task], as(PARALLEL));
  ok(dir, ['task', 'start', UNIT, '1.2'], as(ELSEWHERE));
  ok(dir, ['task', 'start', OTHER_UNIT, '1.1'], as(REFUNDING));
  cleanupFixture(dir);
});

after(() => {
  for (const session of [BUILDING, PARALLEL, ELSEWHERE, CLEARED, REFUNDING]) fs.rmSync(path.join(CONFIG, 'conversations', session), { recursive: true, force: true });
});

/** @type {string} */ let dir;
beforeEach(() => {
  dir = world();
  createFile(dir, 'src/card.js', 'const card = 2;\n');
});
afterEach(() => cleanupFixture(dir));

describe('commit --task: the task in flight (6.S8)', () => {
  it('6.S8: T in flight in this conversation — the commit lands with Claude\'s message, then the trailer naming T, and answers the task and the checks run, none where the project sets none', () => {
    createFile(dir, 'src/left.js', 'const left = 1;\n');

    const res = ok(dir, commitArgs(), as(BUILDING));

    assert.deepStrictEqual(res, { ok: true, committed: [{ repo: '.', sha: codeHead(dir) }], left_dirty: ['src/left.js'], task: 'pay-1-1', checks: [] });
    assert.deepStrictEqual(
      [git(dir, ['log', '-1', '--format=%B']), git(dir, ['log', '-1', '--format=%(trailers:key=Leeway-Task,valueonly)'])],
      [`${MESSAGE}\n\nLeeway-Task: pay-1-1\n\n`, 'pay-1-1\n\n'],
    );
  });

  it('joins the trailers Claude\'s message ends in, as git adds one, so git reads them all', () => {
    const message = `${MESSAGE}\n\nThe card form.\n\nCo-Authored-By: A Builder <builder@example.com>\nSigned-off-by: A Person <person@example.com>`;

    ok(dir, ['commit', '--paths', 'src/card.js', '--task', UNIT, '1.1', '-m', message], as(BUILDING));

    assert.deepStrictEqual([git(dir, ['log', '-1', '--format=%B']), git(dir, ['log', '-1', '--format=%(trailers)'])], [
      `${message}\nLeeway-Task: pay-1-1\n\n`,
      'Co-Authored-By: A Builder <builder@example.com>\nSigned-off-by: A Person <person@example.com>\nLeeway-Task: pay-1-1\n\n',
    ]);
  });

  it('6.S8: refused, nothing committed — a code commit naming no task, T in flight in another conversation and none in this one, another task in flight in this one, another unit\'s task of the same number', () => {
    assert.match(refusedUncommitted(dir, ['commit', '--paths', 'src/card.js', '-m', MESSAGE], as(BUILDING)), /^Usage: engine commit /);
    assert.deepStrictEqual([CLEARED, ELSEWHERE, REFUNDING].map((session) => refusedUncommitted(dir, commitArgs(), as(session))), [
      'commit --task: no task is in flight in this conversation — start task 1.1 of pay with `engine task start pay 1.1`, then commit again; a /clear begins another conversation, so a task started before one is started again after it',
      'commit --task: task 1.1 of pay is not in flight in this conversation, task 1.2 of pay is — commit under the task the work is for, or start task 1.1 of pay with `engine task start pay 1.1`',
      'commit --task: task 1.1 of pay is not in flight in this conversation, task 1.1 of refunds is — commit under the task the work is for, or start task 1.1 of pay with `engine task start pay 1.1`',
    ]);
  });

  it('N1: refused, nothing committed, from a checkout on a branch other than the task\'s — another task\'s among them — naming the worktree that has its branch out, or, with none, the verb that lays one out', (t) => {
    const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'commit-task-elsewhere-')));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    const other = path.join(folder, '1.2');
    git(dir, ['worktree', 'add', '-q', '-b', branchOf(2), other, 'main']);
    createFile(other, 'src/card.js', 'const card = 12;\n');
    const otherHead = codeHead(other);
    const fromOther = refusedPristine(other, commitArgs(), as(PARALLEL)).error;
    git(dir, ['checkout', '-q', 'main']);
    const none = refusedUncommitted(dir, commitArgs(), as(BUILDING));
    const worktree = path.join(folder, '1.1');
    git(dir, ['worktree', 'add', '-q', worktree, branchOf(1)]);

    assert.deepStrictEqual([fromOther, codeHead(other), none, refusedUncommitted(dir, commitArgs(), as(BUILDING))], [
      `commit --task: this checkout has ${branchOf(2)} out, not task 1.1 of pay's branch, so its commit would land on another branch — commit it from ${dir}, where its branch is checked out`,
      otherHead,
      'commit --task: this checkout has main out, not task 1.1 of pay\'s branch, so its commit would land on another branch — no worktree has it out — `engine task worktree pay 1.1` lays one out, from a worktree of Claude Code\'s isolation',
      `commit --task: this checkout has main out, not task 1.1 of pay's branch, so its commit would land on another branch — commit it from ${worktree}, where its branch is checked out`,
    ]);
  });

  it('12.S21: with several tasks in flight, a commit naming none of them is refused, naming each', () => {
    assert.strictEqual(
      refusedUncommitted(dir, ['commit', '--paths', 'src/card.js', '--task', OTHER_UNIT, '1.1', '-m', MESSAGE], as(PARALLEL)),
      'commit --task: task 1.1 of refunds is not in flight in this conversation, task 1.1 of pay, task 1.2 of pay are — commit under the task the work is for, or start task 1.1 of refunds with `engine task start refunds 1.1`',
    );
  });

  it('refuses before reading a path: no conversation, a unit the project lacks, a task id that is no task', () => {
    const missing = ['src/missing.js'];
    assert.deepStrictEqual([
      refusedUncommitted(dir, commitArgs('1.1', missing)),
      refusedUncommitted(dir, ['commit', '--paths', ...missing, '--task', 'payments', '1.1', '-m', MESSAGE], as(BUILDING)),
      refusedUncommitted(dir, commitArgs('1-1', missing), as(BUILDING)),
    ], [
      'commit --task: no conversation is named, so no task is in flight — CLAUDE_CODE_SESSION_ID is unset; commit from the Claude Code conversation building the task',
      'commit --task: this project has no work unit "payments" — name the unit the task is in',
      'commit --task: "1-1" is not a task — name it {phase}.{n}, as 1.2',
    ]);
  });
});

describe('commit --task: the project\'s checks (6.S9)', () => {
  it('6.S9: the tests, then each linter, run in the code worktree the call is made from, before the commit is written — and the commit lands, answering each', (t) => {
    setEnvironment(dir, { run: { tests: marking(dir, 'tests') }, linters: [{ name: 'eslint', command: marking(dir, 'eslint') }, { name: 'tsc', command: marking(dir, 'tsc') }] });
    const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'commit-task-worktree-')));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    const worktree = path.join(folder, 'card');
    git(dir, ['checkout', '-q', 'main']);
    git(dir, ['worktree', 'add', '-q', worktree, branchOf(1)]);
    createFile(worktree, 'src/card.js', 'const card = 3;\n');
    const before = codeHead(worktree);

    const res = ok(worktree, commitArgs(), as(BUILDING));

    assert.deepStrictEqual(res.checks, [{ name: 'tests', exit: 0 }, { name: 'eslint', exit: 0 }, { name: 'tsc', exit: 0 }]);
    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: codeHead(worktree) }]);
    assert.strictEqual(marked(dir), ['tests', 'eslint', 'tsc'].map((name) => `${name} ${worktree} ${before}\n`).join(''));
  });

  it('12.S21, 15.S11, 2.S3: several tasks in flight, each builder in a worktree of its own — its commands carrying the conversation\'s id — commits under its own task, the checks run first in its worktree', (t) => {
    setEnvironment(dir, { run: { tests: marking(dir, 'tests') }, linters: [{ name: 'eslint', command: marking(dir, 'eslint') }] });
    const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'commit-task-builders-')));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    git(dir, ['checkout', '-q', 'main']);
    const builders = ['1.1', '1.2'].map((task, at) => {
      const worktree = path.join(folder, task);
      git(dir, ['worktree', 'add', '-q', ...(at === 0 ? [worktree, branchOf(1)] : ['-b', branchOf(2), worktree])]);
      createFile(worktree, 'src/card.js', `const card = '${task}';\n`);
      return { task, worktree, before: codeHead(worktree) };
    });

    const commits = builders.map(({ task, worktree }) => ok(worktree, commitArgs(task), as(PARALLEL)));

    assert.deepStrictEqual(commits.map(({ task, checks }) => ({ task, checks })), ['pay-1-1', 'pay-1-2'].map((id) => ({ task: id, checks: [{ name: 'tests', exit: 0 }, { name: 'eslint', exit: 0 }] })));
    assert.deepStrictEqual(builders.map(({ worktree }) => git(worktree, ['log', '-1', '--format=%(trailers:key=Leeway-Task,valueonly)']).trim()), ['pay-1-1', 'pay-1-2']);
    assert.strictEqual(marked(dir), builders.map(({ worktree, before }) => `tests ${worktree} ${before}\neslint ${worktree} ${before}\n`).join(''));
  });

  it('6.S9: a failing check refuses the commit, nothing committed, naming the check, its exit code — a signal\'s as 128 and its number — and the last 40 lines of its output and errors; no check after it runs, and its output\'s folder goes', () => {
    const outputs = () => fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('leeway-check-'));
    const before = outputs();
    const failed = (/** @type {string} */ name, /** @type {number} */ exit, /** @type {string} */ output) => `commit --task: the check "${name}" failed with exit ${exit}, so nothing was committed — fix what it reports and commit again; `
      + `the Bash tool stops a call at two minutes unless given a longer timeout, so give the commit's call one where the checks run long. ${output}`;

    setEnvironment(dir, { run: { tests: marking(dir, 'tests') }, linters: [{ name: 'eslint', command: 'seq 1 45; echo "unused card" >&2; exit 3' }, { name: 'tsc', command: marking(dir, 'tsc') }] });
    const exited = refusedUncommitted(dir, commitArgs(), as(BUILDING));
    setEnvironment(dir, { linters: [{ name: 'fmt', command: 'kill -KILL $$' }] });
    const killed = refusedUncommitted(dir, commitArgs(), as(BUILDING));

    const tail = [...Array.from({ length: 39 }, (_, at) => String(at + 7)), 'unused card'].join('\n');
    assert.deepStrictEqual([exited, killed], [failed('eslint', 3, `The last of its output, 40 lines at most:\n${tail}`), failed('fmt', 137, 'It wrote nothing.')]);
    assert.deepStrictEqual([marked(dir), outputs()], [`tests ${dir} ${codeHead(dir)}\n`, before]);
  });

  it('refuses a tests command of another shape before running any check', () => {
    setEnvironment(dir, { run: { tests: 7 }, linters: [{ name: 'tsc', command: marking(dir, 'tsc') }] });
    assert.strictEqual(refusedUncommitted(dir, commitArgs(), as(BUILDING)), 'the project manifest\'s environment.run.tests is not a command');
    assert.strictEqual(marked(dir), '');
  });

  it('holds no lock while the checks run: a check takes the writer lock and the commit lock, and gives them back', () => {
    const locks = [statePath(dir, '.lock'), path.join(dir, '.git', 'leeway-commit.lock')];
    setEnvironment(dir, { run: { tests: `set -C; ${locks.map((lock) => `: > "${lock}" && rm "${lock}" && `).join('')}echo free > "${markerOf(dir)}"` } });

    assert.deepStrictEqual(ok(dir, commitArgs(), as(BUILDING)).checks, [{ name: 'tests', exit: 0 }]);
    assert.strictEqual(marked(dir), 'free\n');
  });
});

/** The merge of `branch` begun in the repository at `repo` as the chain slot has it, its conflicts left: whether it conflicted. @param {string} repo @param {string} branch */
const mergeBegun = (repo, branch) => spawnSync('git', ['merge', '--no-ff', '--no-commit', branch], { cwd: repo, encoding: 'utf8' }).status !== 0;

/** Whether a merge is in progress in the repository at `repo`. @param {string} repo */
const merging = (repo) => fs.existsSync(path.join(repo, git(repo, ['rev-parse', '--git-dir']).trim(), 'MERGE_HEAD'));

/** The parents of the commit at HEAD in the repository at `repo`, and its task trailer. @param {string} repo */
const mergeCommit = (repo) => ({
  parents: git(repo, ['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(' ').length - 1,
  task: git(repo, ['log', '-1', '--format=%(trailers:key=Leeway-Task,valueonly)']).trim(),
});

describe('commit --task: a merge in progress, the chain merged back (12.14)', () => {
  /** The card changed on main and, otherwise, on `chained`, its merge begun on main. @param {Record<string, string>} [more] the other files `chained` changes */
  function conflicted(more = {}) {
    commitCode(dir, 'card 2');
    git(dir, ['checkout', '-q', '-b', 'chained', 'HEAD~1']);
    for (const [file, text] of Object.entries({ 'src/card.js': 'const card = 3;\n', ...more })) createFile(dir, file, text);
    commitCode(dir, 'card 3');
    git(dir, ['checkout', '-q', branchOf(1)]);
    assert.ok(mergeBegun(dir, 'chained'), 'the merge conflicts');
  }

  it('finishes the merge through the door: the resolution staged, the project\'s checks run, the merge committed whole under the task\'s trailer', () => {
    setEnvironment(dir, { run: { tests: marking(dir, 'tests') } });
    conflicted({ 'src/fee.js': 'const fee = 1;\n' });
    createFile(dir, 'src/card.js', 'const card = 2;\nconst chained = 3;\n');

    const res = ok(dir, commitArgs(), as(BUILDING));

    assert.deepStrictEqual([res.task, res.checks, merging(dir), mergeCommit(dir)], ['pay-1-1', [{ name: 'tests', exit: 0 }], false, { parents: 2, task: 'pay-1-1' }]);
    assert.deepStrictEqual([git(dir, ['show', 'HEAD:src/card.js']), git(dir, ['show', 'HEAD:src/fee.js'])], ['const card = 2;\nconst chained = 3;\n', 'const fee = 1;\n'], 'the resolution and what the merge brought, committed whole');
  });

  it('7.2.17: finishes the merge in a project that is a folder of a larger repository, the resolution named from the folder', () => {
    conflicted();
    createFile(dir, 'src/card.js', 'const card = 2;\nconst chained = 3;\n');

    ok(path.join(dir, 'src'), commitArgs('1.1', ['card.js']), as(BUILDING));

    assert.deepStrictEqual([merging(dir), mergeCommit(dir), git(dir, ['show', 'HEAD:src/card.js'])], [false, { parents: 2, task: 'pay-1-1' }, 'const card = 2;\nconst chained = 3;\n']);
  });

  it('refuses, before any check runs and committing nothing, while a path the merge conflicts in is not named', () => {
    setEnvironment(dir, { run: { tests: marking(dir, 'tests') } });
    commitCode(dir, 'card 2');
    git(dir, ['checkout', '-q', '-b', 'chained', 'HEAD~1']);
    createFile(dir, 'src/card.js', 'const card = 3;\n');
    createFile(dir, 'src/till.js', 'const till = 3;\n');
    commitCode(dir, 'card 3');
    git(dir, ['checkout', '-q', branchOf(1)]);
    createFile(dir, 'src/till.js', 'const till = 2;\n');
    commitCode(dir, 'till 2');
    assert.ok(mergeBegun(dir, 'chained'));
    const before = codeHead(dir);
    createFile(dir, 'src/card.js', 'const card = 2;\n');

    const { error } = refusedPristine(dir, commitArgs(), as(BUILDING));

    assert.strictEqual(error, 'commit --paths: the merge in progress in . still conflicts in src/till.js — resolve each and name it, then run the commit again');
    assert.deepStrictEqual([codeHead(dir), merging(dir), marked(dir)], [before, true, '']);
  });

  /**
   * The submodule `ext`, its chain past the task's branch in it and in the
   * project, each with work of its own beside; the child's merge back begun,
   * clean, and committed through the door.
   * @param {import('node:test').TestContext} t @returns {{ext: string, extMerge: unknown}}
   */
  function childMergedBack(t) {
    const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'commit-task-child-')));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    const source = initRepo(path.join(folder, 'ext-source'));
    createFile(source, 'ext.txt', 'ext\n');
    commitCode(source, 'ext');
    const ext = addSubmodule(dir, 'ext', source);
    git(ext, ['checkout', '-q', '-b', 'chained']);
    createFile(ext, 'chained.txt', 'chained\n');
    commitCode(ext, 'chained in ext');
    git(dir, ['checkout', '-q', '-b', 'chained']);
    git(dir, ['add', 'ext']);
    git(dir, ['commit', '-q', '-m', 'ext chained']);
    git(dir, ['checkout', '-q', branchOf(1)]);
    git(ext, ['checkout', '-q', '-B', 'main', 'main']);
    createFile(ext, 'own.txt', 'own\n');
    commitCode(ext, 'own in ext');
    git(dir, ['add', 'ext']);
    git(dir, ['commit', '-q', '-m', 'ext own']);

    assert.strictEqual(mergeBegun(ext, 'chained'), false, 'the child merges clean');
    ok(dir, ['commit', '--paths', 'ext/chained.txt', '--task', UNIT, '1.1', '-m', 'merge(pay): the chain back, in ext'], as(BUILDING));
    return { ext, extMerge: mergeCommit(ext) };
  }

  it('a child repository merged first, then the project\'s, its pointer named staged by the door as the child stands — past the merged tip the merge itself resolves it to', (t) => {
    const { ext, extMerge } = childMergedBack(t);
    createFile(ext, 'fix.txt', 'fix\n');
    commitCode(ext, 'a fix in ext');
    const fixed = git(ext, ['rev-parse', 'HEAD']).trim();
    mergeBegun(dir, 'chained');
    ok(dir, ['commit', '--paths', 'ext', '--task', UNIT, '1.1', '-m', 'merge(pay): the chain back'], as(BUILDING));

    assert.deepStrictEqual([extMerge, mergeCommit(dir)], [{ parents: 2, task: 'pay-1-1' }, { parents: 2, task: 'pay-1-1' }]);
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD:ext']).trim(), fixed, 'the pointer at the child as it stands');
  });

  it('a child repository merged first, then the project\'s, its pointer at the child as it stands, past the merged tip, staged by git add before the door, as the chain slot says — committed, never refused', (t) => {
    const { ext } = childMergedBack(t);
    createFile(ext, 'fix.txt', 'fix\n');
    commitCode(ext, 'a fix in ext');
    mergeBegun(dir, 'chained');
    git(dir, ['add', 'ext']);
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only', 'HEAD']).trim(), 'ext', 'the pointer staged');

    ok(dir, ['commit', '--paths', 'ext', '--task', UNIT, '1.1', '-m', 'merge(pay): the chain back'], as(BUILDING));

    assert.deepStrictEqual([mergeCommit(dir), git(dir, ['rev-parse', 'HEAD:ext']).trim()], [{ parents: 2, task: 'pay-1-1' }, git(ext, ['rev-parse', 'HEAD']).trim()]);
  });
});

describe('commit --task: never a code commit on the state branch (4.S20)', () => {
  it('4.S20: a tree with leeway-state checked out is refused before any check runs, nothing committed on either branch', () => {
    setEnvironment(dir, { run: { tests: marking(dir, 'tests') } });
    const main = git(dir, ['rev-parse', branchOf(1)]);
    git(dir, ['symbolic-ref', 'HEAD', 'refs/heads/leeway-state']);

    const { error } = refusedPristine(dir, commitArgs(), as(BUILDING));

    assert.strictEqual(error, 'commit --paths: . has the state branch leeway-state checked out — the state commits through its own door');
    assert.deepStrictEqual([git(dir, ['rev-parse', branchOf(1)]), marked(dir)], [main, '']);
  });
});
