'use strict';

// ---------------------------------------------------------------------------
// The commit door's task (leeway-engine/scripts/domain/commit-task.cjs,
// with environment.cjs, and `commit --paths … --task` in engine.cjs): a
// code commit lands only for the task in flight in the calling conversation,
// its message Claude's with the trailer naming the task, joining the
// trailers it ends in (6.S8); the project's checks — its tests, then each
// linter — run in the code root before the commit is written, holding no
// lock, and the first to fail refuses it, nothing committed (6.S9); and a
// tree with the state branch checked out is refused before any check runs
// (4.S20). Its paths and repos are today's code commit's,
// test-engine-commit-door-code.cjs's; that landing never reads the trailer as a
// landing is test-engine-land-reads.cjs's.
//
// Layer: git. World: a unit with two tasks written and another unit with a
// task of the first one's number, the code committed; one conversation
// building task 1.1, another task 1.2, and a third the other unit's 1.1,
// each started through `task start`; built once and copied for each test,
// a code worktree beside it for the checks' folder.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, refusedPristine, git, commitAll, fixtureFrom, cleanupFixture, statePath, layout, createFile, readState, writeState } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'pay';
const OTHER_UNIT = 'refunds';
const BUILDING = 'commit-task-building';
const ELSEWHERE = 'commit-task-elsewhere';
const CLEARED = 'commit-task-cleared';
const REFUNDING = 'commit-task-refunding';
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const MESSAGE = 'feat(pay): take a card';
const TASK = [
  '# Take a card', '', '## Type', 'feat', '', '## Problem', 'A card cannot be taken.', '', '## Solution', 'Add the card form.', '',
  '## Outcome', 'A card is taken.', '', '## Acceptance scenarios', '- Given a card, when it is taken, then it is charged.', '', '## Spec reference', '§1',
].join('\n');

const world = fixtureFrom('commit-task-', (dir) => {
  createManifest(dir, UNIT, {});
  createFile(dir, 'src/card.js', 'const card = 1;\n');
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  const file = path.join(dir, '..', 'commit-task.md');
  fs.writeFileSync(file, TASK);
  ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
  ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
  createManifest(dir, OTHER_UNIT, {});
  commitAll(dir, 'the other unit');
  ok(dir, ['task', 'phase', OTHER_UNIT, '1', '--title', 'Refunds']);
  ok(dir, ['task', 'create', OTHER_UNIT, '1', '--file', file]);
  fs.rmSync(file);
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

/** The project's environment setup set to `environment`. @param {string} dir @param {unknown} environment */
function setEnvironment(dir, environment) {
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment }, null, 2));
}

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
  ok(dir, ['task', 'start', UNIT, '1.2'], as(ELSEWHERE));
  ok(dir, ['task', 'start', OTHER_UNIT, '1.1'], as(REFUNDING));
  cleanupFixture(dir);
});

after(() => {
  for (const session of [BUILDING, ELSEWHERE, CLEARED, REFUNDING]) fs.rmSync(path.join(CONFIG, 'conversations', session), { recursive: true, force: true });
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

  it('refuses before reading a path: no conversation, a unit the project lacks, a task id that is no task, a task beside --for', () => {
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
    assert.match(refusedUncommitted(dir, [...commitArgs(), '--for', UNIT, `implementation/${UNIT}`], as(BUILDING)), /^Usage: engine commit /);
  });
});

describe('commit --task: the project\'s checks (6.S9)', () => {
  it('6.S9: the tests, then each linter, run in the code worktree the call is made from, before the commit is written — and the commit lands, answering each', (t) => {
    setEnvironment(dir, { run: { tests: marking(dir, 'tests') }, linters: [{ name: 'eslint', command: marking(dir, 'eslint') }, { name: 'tsc', command: marking(dir, 'tsc') }] });
    const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'commit-task-worktree-')));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    const worktree = path.join(folder, 'card');
    git(dir, ['worktree', 'add', '-q', '-b', 'card', worktree]);
    createFile(worktree, 'src/card.js', 'const card = 3;\n');
    const before = codeHead(worktree);

    const res = ok(worktree, commitArgs(), as(BUILDING));

    assert.deepStrictEqual(res.checks, [{ name: 'tests', exit: 0 }, { name: 'eslint', exit: 0 }, { name: 'tsc', exit: 0 }]);
    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: codeHead(worktree) }]);
    assert.strictEqual(marked(dir), ['tests', 'eslint', 'tsc'].map((name) => `${name} ${worktree} ${before}\n`).join(''));
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

describe('commit --task: never a code commit on the state branch (4.S20)', () => {
  it('4.S20: a tree with leeway-state checked out is refused before any check runs, nothing committed on either branch', () => {
    setEnvironment(dir, { run: { tests: marking(dir, 'tests') } });
    const main = git(dir, ['rev-parse', 'main']);
    git(dir, ['symbolic-ref', 'HEAD', 'refs/heads/leeway-state']);

    const { error } = refusedPristine(dir, commitArgs(), as(BUILDING));

    assert.strictEqual(error, 'commit --paths: . has the state branch leeway-state checked out — the state commits through its own door');
    assert.deepStrictEqual([git(dir, ['rev-parse', 'main']), marked(dir)], [main, '']);
  });
});
