'use strict';

// ---------------------------------------------------------------------------
// The commit door's bug-proven check (leeway-engine/scripts/domain/
// commit-task.cjs, its rule bug-proven.cjs): a bugfix's code commit of any
// task but the reproducing one — task 1.1, phase 1's lowest-numbered — is
// refused before any check runs until the test that task wrote has run on
// the unfixed code five times, failing each time, at task 1.1's tip, and
// the calling checkout is built on that tip, each refusal naming the way
// on: a first series, a test reworked after a pass, a new series after task
// 1.1 moved, a rebase (6.3.6, 15.5.3, 6.S10, 15.S8, 15.S20, 19.S16); once it
// is, the test runs after the project's tests as a check of its own and
// must pass, catching a command that fails for a reason but the bug
// (15.5.4); and the reproducing task's own commits land with the tests
// failing, the answer saying so, the linters held as ever (6.3.5, F1). The
// series itself is test-engine-verify-unfixed.cjs's; a unit of another type,
// read no further than its manifest, test-engine-commit-task.cjs's.
//
// Layer: git. World: bug-proven-world.cjs's, copied for each test, the
// project's tests and its linter each logging its name where the test logs
// its runs; one conversation building tasks 1.1 and 1.2, both started
// through `task start`.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, cleanupFixture, createFile, commitCode, git, setEnvironment,
} = require('./engine-harness.cjs');
const {
  UNIT, TEST, BUGGY, FIXED, branchOf, logging, testRuns, unfixedArgs, unproven, proven,
} = require('./bug-proven-world.cjs');

const BUGFIXING = 'commit-task-bugfixing';
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const building = Object.freeze({ env: Object.freeze({ CLAUDE_CODE_SESSION_ID: BUGFIXING }) });
const CHECKS = Object.freeze({ run: { tests: logging('tests') }, linters: [{ name: 'eslint', command: logging('eslint') }] });

/** @type {string} */ let dir;

/** The door's call for a task of the unit, its one path `file`. @param {string} task @param {string} file */
const commitArgs = (task, file) => ['commit', '--paths', file, '--task', UNIT, task, '-m', `fix(${UNIT}): hold the checkout`];

/** The fix's commit, task 1.2's, the code at `text`. @param {string} [text] */
function fixAttempted(text = FIXED) {
  createFile(dir, 'src/app.js', text);
  return commitArgs('1.2', 'src/app.js');
}

/** The commit at HEAD, short, and the task its trailer names. */
const lastCommit = () => ({ sha: git(dir, ['rev-parse', '--short', 'HEAD']).trim(), task: git(dir, ['log', '-1', '--format=%(trailers:key=Leeway-Task,valueonly)']).trim() });

/** Where the project's checkout is, as the test logs it. */
const here = () => fs.realpathSync(dir);

/**
 * A door call that must refuse, leaving the state as it was, the code's HEAD
 * where it stood and the code uncommitted: its refusal.
 * @param {string[]} args
 */
function refusedUncommitted(args) {
  const head = git(dir, ['rev-parse', 'HEAD']).trim();
  const { error } = refusedPristine(dir, args, building);
  assert.deepStrictEqual([git(dir, ['rev-parse', 'HEAD']).trim(), git(dir, ['status', '--porcelain', '--', args[2]])], [head, ` M ${args[2]}\n`], `engine ${args.join(' ')} committed on refusing`);
  return error;
}

/** The refusal of the fix's commit while the bug is not proven for it: `why`. @param {string} why */
const unprovenRefusal = (why) => `commit --task: ${UNIT} is a bugfix, so task 1.2 of ${UNIT}'s code lands once its bug is proven by the test its reproducing task wrote — task 1.1, phase 1's lowest-numbered (15.5.3): ${why}`;

/** The series' call again, as a refusal names it. */
const SERIES_CALL = `engine verify run ${UNIT} 1.S1 --unfixed --test 'sh test/crash.sh'`;

/** A new commit on task 1.1's branch, reworking its test, the checkout left on task 1.2's. */
function testReworked() {
  git(dir, ['checkout', '-q', branchOf(1)]);
  createFile(dir, 'test/crash.sh', `${fs.readFileSync(path.join(dir, 'test/crash.sh'), 'utf8')}# reworked\n`);
  commitCode(dir, `test(${UNIT}): rework the test\n\nLeeway-Task: ${UNIT}-1-1`);
  git(dir, ['checkout', '-q', branchOf(2)]);
}

before(() => {
  const world = unproven();
  for (const task of ['1.1', '1.2']) ok(world, ['task', 'start', UNIT, task], building);
  cleanupFixture(world);
});

after(() => fs.rmSync(path.join(CONFIG, 'conversations', BUGFIXING), { recursive: true, force: true }));

afterEach(() => cleanupFixture(dir));

describe('commit --task: a bugfix\'s fix waits on its bug proven (6.3.6, 15.5.3)', () => {
  it('6.S10, 15.S8, 19.S16: with no series of the test run on the unfixed code, the fix\'s commit is refused before any check runs, nothing committed, naming task 1.1 by its position and the call that runs the series', () => {
    dir = unproven();
    setEnvironment(dir, CHECKS);

    assert.strictEqual(refusedUncommitted(fixAttempted()), unprovenRefusal(
      `no series of it has run on the unfixed code — run it there five times: engine verify run ${UNIT} <scenario> --unfixed --test '<the command that runs that test alone>', its scenario one of task 1.1's`,
    ));
    assert.deepStrictEqual(testRuns(dir), [], 'no check ran');
  });

  it('6.S10, 15.S8, 19.S16, 15.5.4: once the series is five failures, the fix\'s commit lands — the test run after the project\'s tests, before the linter, as a check of its own, passing on the fixed code', () => {
    dir = proven();
    setEnvironment(dir, CHECKS);
    const head = git(dir, ['rev-parse', 'HEAD']).trim();

    const res = ok(dir, fixAttempted(), building);

    assert.deepStrictEqual([res.checks, res.committed, lastCommit().task], [
      [{ name: 'tests', exit: 0 }, { name: 'reproducing test', exit: 0 }, { name: 'eslint', exit: 0 }], [{ repo: '.', sha: lastCommit().sha }], `${UNIT}-1-2`,
    ]);
    assert.deepStrictEqual(testRuns(dir), ['tests', `${here()} ${head}`, 'eslint']);
  });

  it('15.5.4: at every later code commit the test runs again, and one it fails on is refused, nothing committed, no linter run, saying it passes once the bug is fixed', () => {
    dir = proven();
    setEnvironment(dir, CHECKS);

    assert.strictEqual(refusedUncommitted(fixAttempted(`${BUGGY}// tidied\n`)), 'commit --task: the check "reproducing test" failed with exit 1, so nothing was committed — '
      + 'the test task 1.1 wrote fails here, and passes once the bug is fixed (15.5.4) — fix what it reports and commit again; where its command fails for another reason, such as a wrong path, '
      + `run a new series with the right one: engine verify run ${UNIT} 1.S1 --unfixed --test '<the command that runs that test alone>'; `
      + 'the Bash tool stops a call at two minutes unless given a longer timeout, so give the commit\'s call one where the checks run long. The last of its output, 40 lines at most:\nchecking the checkout');
    assert.deepStrictEqual(testRuns(dir).at(-1), `${here()} ${git(dir, ['rev-parse', 'HEAD']).trim()}`, 'the linter never ran');
  });

  it('15.S20: a series the test passed in refuses the fix\'s commit, saying the test is reworked', () => {
    dir = unproven();
    ok(dir, unfixedArgs('true'));

    assert.strictEqual(refusedUncommitted(fixAttempted()), unprovenRefusal(
      `the test passed on the unfixed code in its series, so it proves nothing — rework the test, a new commit on task 1.1, then run a new series: engine verify run ${UNIT} 1.S1 --unfixed --test true`,
    ));
  });

  it('the test reworked after its series, the fix\'s commit is refused until a new series runs at task 1.1\'s new tip, then until task 1.2\'s branch is rebased onto it; then it lands', () => {
    dir = proven();
    testReworked();
    const moved = refusedUncommitted(fixAttempted());
    ok(dir, unfixedArgs());
    const behind = refusedUncommitted(fixAttempted());
    git(dir, ['checkout', '-q', '--', 'src/app.js']);
    git(dir, ['rebase', '-q', branchOf(1)]);

    assert.deepStrictEqual([moved, behind], [
      unprovenRefusal(`task 1.1's branch ${branchOf(1)} has moved past the commits its series ran at, so the test as it stands is not proven — run a new series: ${SERIES_CALL}`),
      unprovenRefusal(`this checkout is not built on ${branchOf(1)}, task 1.1's branch, where the test was proven — rebase onto it, then commit again`),
    ]);
    assert.strictEqual(ok(dir, fixAttempted(), building).task, `${UNIT}-1-2`);
  });

  it('a series whose command fails for a reason but the bug — a wrong path — is caught by the test the door runs after the fix; a new series with the right command lets the fix land', () => {
    dir = unproven();
    ok(dir, unfixedArgs('sh test/missing.sh'));

    assert.match(refusedUncommitted(fixAttempted()), /^commit --task: the check "reproducing test" failed with exit 127, so nothing was committed — the test task 1\.1 wrote fails here.*sh: .*test\/missing\.sh/s);
    ok(dir, unfixedArgs());
    assert.deepStrictEqual(ok(dir, fixAttempted(), building).checks, [{ name: 'reproducing test', exit: 0 }]);
  });
});

describe('commit --task: the reproducing task\'s own commits (6.3.5, F1)', () => {
  it('land with the project\'s tests failing, the answer saying so with their output\'s last lines, the linters run as ever — and a failing linter refuses', () => {
    dir = unproven();
    git(dir, ['checkout', '-q', branchOf(1)]);
    setEnvironment(dir, { run: { tests: TEST }, linters: [{ name: 'eslint', command: logging('eslint') }] });
    createFile(dir, 'test/crash.sh', `${fs.readFileSync(path.join(dir, 'test/crash.sh'), 'utf8')}# commented\n`);

    const res = ok(dir, commitArgs('1.1', 'test/crash.sh'), building);
    createFile(dir, 'test/crash.sh', `${fs.readFileSync(path.join(dir, 'test/crash.sh'), 'utf8')}# again\n`);
    setEnvironment(dir, { run: { tests: TEST }, linters: [{ name: 'eslint', command: 'echo "unused log" >&2; exit 2' }] });

    assert.deepStrictEqual([res.checks, lastCommit().task, testRuns(dir).at(-1)], [[
      { name: 'tests', exit: 1, allowed: 'the tests failed, as the reproducing task\'s commits may: its test reproduces the bug before any fix lands (6.3.5, 15.5.1)', tail: ['checking the checkout'] },
      { name: 'eslint', exit: 0 },
    ], `${UNIT}-1-1`, 'eslint']);
    assert.match(refusedUncommitted(commitArgs('1.1', 'test/crash.sh')), /^commit --task: the check "eslint" failed with exit 2, so nothing was committed — fix what it reports and commit again; .*unused log$/s);
  });
});
