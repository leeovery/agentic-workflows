'use strict';

// ---------------------------------------------------------------------------
// The bug-proven run (leeway-engine/scripts/domain/verify.cjs, `verify run
// <unit> <scenario> --unfixed --test "<command>"`; its rule bug-proven.cjs,
// its series runs.cjs): a bugfix's reproducing test — task 1.1's, phase 1's
// lowest-numbered — run on the unfixed code up to five times in a scratch
// worktree the engine lays out at task 1.1's tip once a call, whatever
// checkout it is called from, needing no verify setup; each run recorded
// `unfixed` with the command, its exit as its verdict and its output as its
// evidence, the series committed alone; a pass stopping the series, which
// then proves nothing, a run again at the same commits carrying the series
// on; and in the review phase the same worktree laid out where the build's
// series ran, each run no task's (6.1.12, 15.5.2, 15.5.3, 15.5.6, 15.S20).
// What the door makes of the series is test-engine-commit-task-bugfix.cjs's;
// what the review phase's entry and round make of it, the review suites'.
//
// Layer: git. World: bug-proven-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, cleanupFixture, readState, createFile, commitCode, git, stateGit, lastMessage,
} = require('./engine-harness.cjs');
const {
  UNIT, TEST, branchOf, testRuns, tipOf, scratchOf, unfixedArgs, buildFinished, unproven, proven,
} = require('./bug-proven-world.cjs');

/** @type {string} */ let dir;
afterEach(() => cleanupFixture(dir));

/** A run as recorded, by its number. @param {number} n */
const runAt = (n) => JSON.parse(readState(dir, `${UNIT}/build/runs/1.S1/run-${String(n).padStart(3, '0')}.json`));

/** The runs' files, as the answer names them, from `from`, `count` of them. @param {number} from @param {number} count */
const runFiles = (from, count) => Array.from({ length: count }, (_, at) => `${UNIT}/build/runs/1.S1/run-${String(from + at).padStart(3, '0')}.json`);

/** Whether the scratch worktree is gone and no repository registers it. */
const takenApart = () => !fs.existsSync(scratchOf(dir)) && !git(dir, ['worktree', 'list', '--porcelain']).includes(scratchOf(dir));

describe('verify run --unfixed: the reproducing test on the unfixed code (15.5.2)', () => {
  it('15.5.2: from a checkout holding none of it, the test runs five times at task 1.1\'s tip in one scratch worktree the engine lays out and takes apart — no verify setup asked — each run recorded unfixed with its command, its exit its verdict and its output its evidence, task 1.1\'s, the series committed alone and answered: five failures', () => {
    dir = unproven();
    git(dir, ['checkout', '-q', 'main']);
    const tip = tipOf(dir, branchOf(1));

    const res = ok(dir, unfixedArgs());

    const files = runFiles(1, 5);
    assert.deepStrictEqual(res, {
      ok: true, unit: UNIT, scenario: '1.S1', command: TEST, runs: files.map((run) => ({ run, verdict: 'fail' })), proven: true, committed: res.committed,
    });
    assert.deepStrictEqual(testRuns(dir), Array(5).fill(`${scratchOf(dir)} ${tip}`), 'run five times, in one worktree laid out at task 1.1\'s tip');
    const first = runAt(1);
    assert.deepStrictEqual(first, {
      verdict: 'fail', unfixed: true, command: TEST, at: first.at, checkout: scratchOf(dir), commits: [{ repo: '.', commit: tip }], task: '1.1', evidence: [{ name: 'output', text: 'checking the checkout\n' }], recordings: [],
    });
    assert.deepStrictEqual([2, 3, 4, 5].map((n) => runAt(n)), Array(4).fill(null).map((_, at) => ({ ...first, at: runAt(at + 2).at })));
    assert.deepStrictEqual([lastMessage(dir), stateGit(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n')], [`verify(${UNIT}): 1.S1 on the unfixed code, five failures`, files]);
    assert.ok(takenApart(), 'the scratch worktree is taken apart');
  });

  it('15.5.3: a pass stops the series at once and proves nothing, said with the way on; run again at the same commits, the series carries on, the pass in it standing', () => {
    dir = unproven();
    const counter = '"$(git rev-parse --path-format=absolute --git-common-dir)/count"';
    const counted = `n=$(($(cat ${counter} 2>/dev/null || echo 0) + 1)); echo $n > ${counter}; [ $n -ge 3 ]`;

    const passed = ok(dir, unfixedArgs(counted));
    const message = lastMessage(dir);
    const again = ok(dir, unfixedArgs());

    const way = 'the test passed on the unfixed code in its series, so it proves nothing — rework the test, a new commit on task 1.1, then run a new series (15.5.3)';
    assert.deepStrictEqual([passed.runs, passed.proven, passed.way, message], [
      runFiles(1, 3).map((run, at) => ({ run, verdict: at === 2 ? 'pass' : 'fail' })), false, way, `verify(${UNIT}): 1.S1 on the unfixed code, passed in run 3`,
    ]);
    assert.deepStrictEqual([again.runs.length, again.proven, again.way], [5, false, way], 'five more failures at the same commits leave the pass in the series');
  });

  it('a new commit on task 1.1\'s branch begins another series, laid out at the branch\'s new tip', () => {
    dir = unproven();
    ok(dir, unfixedArgs('true'));
    git(dir, ['checkout', '-q', branchOf(1)]);
    createFile(dir, 'test/crash.sh', `${fs.readFileSync(path.join(dir, 'test/crash.sh'), 'utf8')}# reworked\n`);
    commitCode(dir, `test(${UNIT}): rework the test\n\nLeeway-Task: ${UNIT}-1-1`);

    const res = ok(dir, unfixedArgs());

    assert.deepStrictEqual([res.proven, testRuns(dir).at(-1)], [true, `${scratchOf(dir)} ${tipOf(dir, branchOf(1))}`]);
  });

  it('a run\'s evidence is its output\'s last 64 KB, from the first line that starts among them — one starting at their first byte among them', () => {
    dir = unproven();
    const counter = '"$(git rev-parse --path-format=absolute --git-common-dir)/count"';
    // Run k prints 1 to 19,999 + k: the first run's last 64 KB open on a
    // line's start, the rest's mid-line.
    ok(dir, unfixedArgs(`n=$(($(cat ${counter} 2>/dev/null || echo 0) + 1)); echo $n > ${counter}; seq 1 $((19999 + n)); exit 1`));

    const kept = (/** @type {number} */ last) => {
      const output = Buffer.from(Array.from({ length: last }, (_, at) => `${at + 1}\n`).join(''));
      const tail = output.subarray(output.length - 64 * 1024 - 1);
      return tail.subarray(tail.indexOf(0x0a) + 1).toString('utf8');
    };
    assert.strictEqual(Buffer.byteLength(kept(20000)), 64 * 1024, 'the first run\'s last 64 KB open on a line\'s start');
    assert.deepStrictEqual([1, 2, 3, 4, 5].map((n) => runAt(n).evidence), [1, 2, 3, 4, 5].map((n) => [{ name: 'output', text: kept(19999 + n) }]));
  });
});

describe('verify run --unfixed: in the review phase, where the build\'s series ran (15.5.6, 15.S20)', () => {
  it('15.S20: once every phase of the cut has closed, the test runs again at the commits the build\'s series ran at — not task 1.1\'s tip, moved since — each run the review\'s, no task\'s, failing as it must', () => {
    dir = proven();
    const ran = tipOf(dir, branchOf(1));
    git(dir, ['checkout', '-q', branchOf(1)]);
    createFile(dir, 'test/crash.sh', `${fs.readFileSync(path.join(dir, 'test/crash.sh'), 'utf8')}# reworked\n`);
    commitCode(dir, `test(${UNIT}): rework the test\n\nLeeway-Task: ${UNIT}-1-1`);
    buildFinished(dir);

    const res = ok(dir, unfixedArgs());

    assert.deepStrictEqual([res.runs.map(({ run }) => run), res.proven], [runFiles(6, 5), true]);
    assert.deepStrictEqual(testRuns(dir), Array(5).fill(`${scratchOf(dir)} ${ran}`));
    assert.deepStrictEqual([runAt(6).task, runAt(6).commits], [null, [{ repo: '.', commit: ran }]]);
  });

  it('a test that passes there is said to fail round 1, unfixed#1 the finding it carries', () => {
    dir = unproven();
    const flaky = '[ -f "$(git rev-parse --path-format=absolute --git-common-dir)/flaky" ]';
    ok(dir, unfixedArgs(flaky));
    buildFinished(dir);
    fs.writeFileSync(path.join(dir, '.git', 'flaky'), '');

    const res = ok(dir, unfixedArgs(flaky));

    assert.deepStrictEqual([res.runs, res.proven, res.way], [
      [{ run: runFiles(6, 1)[0], verdict: 'pass' }], false, 'the test passed on the unfixed code again, so round 1 carries it as a finding, unfixed#1, and fails (15.5.6)',
    ]);
  });

  it('a command but the build\'s series\' is refused there, naming the series\' own call', () => {
    dir = proven();
    buildFinished(dir);

    assert.strictEqual(refusedPristine(dir, unfixedArgs('true')).error,
      `verify run: the review phase runs the test that reproduces the bug again as the build's series ran it (15.5.6): engine verify run ${UNIT} 1.S1 --unfixed --test 'sh test/crash.sh'`);
  });
});

describe('verify run --unfixed: refused, recording nothing', () => {
  it('a unit but a bugfix, a scenario none of phase 1\'s or none of task 1.1\'s, task 1.1 not in the tracker, and its branch holding no work — each naming the way on', () => {
    dir = unproven();
    const refused = (/** @type {string} */ unit, /** @type {string} */ scenario) => refusedPristine(dir, ['verify', 'run', unit, scenario, '--unfixed', '--test', TEST]).error;

    assert.deepStrictEqual([refused('pay', '1.S1'), refused(UNIT, '2.S1'), refused(UNIT, '1.S2'), refused('ghost', '1.S1'), refused('slow', '1.S1')], [
      'verify run: pay is a feature, and a run on the unfixed code is a bugfix\'s, proving its bug (15.5.5)',
      `verify run: 2.S1 is no scenario of phase 1 of ${UNIT}'s cut, where the reproducing task's lies — engine manifest get ${UNIT} cut lists them`,
      'verify run: 1.S2 is none of task 1.1\'s acceptance scenarios — a run on the unfixed code is of a scenario the reproducing task holds',
      'verify run: phase 1 of ghost has no task 1.1 yet — the reproducing task, phase 1\'s lowest-numbered, writes the test that reproduces the bug (15.5.1)',
      `verify run: no repository of the project holds work on ${branchOf(1, 'slow')}, task 1.1's branch — its test is committed there through the door first (15.5.1)`,
    ]);
    assert.deepStrictEqual(testRuns(dir), [], 'the test never ran');
  });

  it('--unfixed without --test, and --test without --unfixed, answer the usage', () => {
    dir = unproven();
    for (const args of [['verify', 'run', UNIT, '1.S1', '--unfixed'], ['verify', 'run', UNIT, '1.S1', '--test', TEST]]) {
      assert.match(refusedPristine(dir, args).error, /^Usage: engine verify run <work-unit> <scenario> \| engine verify run <work-unit> <scenario> --unfixed --test <command> \| /);
    }
  });
});
