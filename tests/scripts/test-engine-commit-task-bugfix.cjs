'use strict';

// ---------------------------------------------------------------------------
// The commit door's bug-proven check (leeway-engine/scripts/domain/
// commit-task.cjs, its rule bug-proven.cjs): a bugfix's code commit of any
// task but the reproducing one — task 1.1, phase 1's lowest-numbered — is
// refused before any check runs until the test that task wrote has run on
// the unfixed code five times, failing each time, at task 1.1's tip, and
// the commit being made is built on task 1.1's work — its tip below HEAD or
// the merge in progress, or its landing in them, read as the landing reads
// one — each refusal naming the way on: a first series, a test reworked
// after a pass, a new series after task 1.1 moved, a merge of task 1.1's
// branch, phase 1's merge, a merge of the branch it landed on, each merge
// made as the hook before Bash lets a task in flight make one and committed
// through the door, which then takes it (6.3.6, 15.5.3, 6.S10, 15.S8,
// 15.S20, 19.S16); once it is, the test runs after the project's tests as
// a check of its own and must pass, catching a command that fails for a
// reason but the bug, its refusal naming the merge of the fix for a task
// the fix is not in (15.5.4); the reproducing task's own commits land with
// the tests failing, the answer saying so, the linters held as ever (6.3.5,
// F1); and the reproducing task lands (`land open`) and is done (`task
// done`) once its series proves the bug at its tip — task 1.1's branch, in
// a child repository holding it with no work, behind the commit the series
// ran at there counting — and in step stands at its gate then too, its
// landing summary and gate refused and the build's standing naming the
// series till then (landing.cjs, task-verbs.cjs, build-screens.cjs,
// build-entry.cjs, 15.5.3), and is never closed (15.5.5). The series itself is
// test-engine-verify-unfixed.cjs's; a unit of another type, read no further
// than its manifest, test-engine-commit-task.cjs's; the door after a phase
// lands through the landing's own verbs,
// test-pipeline-simulation-bugfix-build.cjs's.
//
// Layer: git. World: bug-proven-world.cjs's, copied for each test, the
// project's tests and its linter each logging its name where the test logs
// its runs, a child repository cloned in it, `api`, where a test says so;
// one conversation building tasks 1.1, 1.2 and 2.1, each started through
// `task start`, its hook before Bash asked as Claude Code asks it; another,
// building none, landing and ending them; and a third stepping through the
// build, task 1.1 in flight there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  call, ok, refusedPristine, cleanupFixture, createFile, git, initRepo, setEnvironment, accountTaken,
} = require('./engine-harness.cjs');
const {
  UNIT, TEST, BUGGY, FIXED, CRASH_TEST, branchOf, HARDEN_BRANCH, landedOnMain, logging, testRuns, unfixedArgs, unproven, proven,
} = require('./bug-proven-world.cjs');

const BUGFIXING = 'commit-task-bugfixing';
const ENDING = 'commit-task-bugfix-ending';
const STEPPING = 'commit-task-bugfix-stepping';
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const building = Object.freeze({ env: Object.freeze({ CLAUDE_CODE_SESSION_ID: BUGFIXING }) });
const ending = Object.freeze({ env: Object.freeze({ CLAUDE_CODE_SESSION_ID: ENDING }) });
const stepping = Object.freeze({ env: Object.freeze({ CLAUDE_CODE_SESSION_ID: STEPPING }) });
const CHECKS = Object.freeze({ run: { tests: logging('tests') }, linters: [{ name: 'eslint', command: logging('eslint') }] });

/** @type {string} */ let dir;

/** The door's call for a task of the unit, its one path `file`. @param {string} task @param {string} file @param {string} [message] */
const commitArgs = (task, file, message = `fix(${UNIT}): hold the checkout`) => ['commit', '--paths', file, '--task', UNIT, task, '-m', message];

/** The fix's commit, task 1.2's, the code at `text`. @param {string} [text] */
function fixAttempted(text = FIXED) {
  createFile(dir, 'src/app.js', text);
  return commitArgs('1.2', 'src/app.js');
}

/** The commit at HEAD, short, and the task its trailer names. */
const lastCommit = () => ({ sha: git(dir, ['rev-parse', '--short', 'HEAD']).trim(), task: git(dir, ['log', '-1', '--format=%(trailers:key=Leeway-Task,valueonly)']).trim() });

/** Where the project's checkout is, as the test logs it. */
const here = () => fs.realpathSync(dir);

/** The code's HEAD, and how its path `file` stands. @param {string} file */
const codeAt = (file) => [git(dir, ['rev-parse', 'HEAD']).trim(), git(dir, ['status', '--porcelain', '--', file])];

/**
 * A door call that must refuse, leaving the state as it was, the code's HEAD
 * where it stood and its path uncommitted: its refusal.
 * @param {string[]} args
 */
function refusedUncommitted(args) {
  const before = codeAt(args[2]);
  const { error } = refusedPristine(dir, args, building);
  assert.deepStrictEqual(codeAt(args[2]), before, `engine ${args.join(' ')} committed on refusing`);
  return error;
}

/**
 * The way on a refusal names, taken as the product takes it while a task is
 * in flight: the merge it names, which the hook before Bash lets through for
 * the building conversation, made there.
 * @param {string} refusal
 */
function mergedAsNamed(refusal) {
  const command = /`(git (?:-C \S+ )?merge --no-ff --no-commit [^`]+)`/.exec(refusal)?.[1];
  assert.ok(command !== undefined, `no merge named in: ${refusal}`);
  const input = {
    session_id: BUGFIXING, transcript_path: `/t/${BUGFIXING}.jsonl`, cwd: dir, permission_mode: 'default', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, description: 'Merge it in' },
  };
  assert.strictEqual(call(dir, ['shell', 'guard'], { stdin: JSON.stringify(input) }).code, 0, `the hook before Bash refuses ${command}`);
  git(dir, command.split(' ').slice(1));
}

/** How a merge through the door ends, as a refusal names it. */
const THROUGH_THE_DOOR = 'resolve what conflicts, then commit the merge through the door, which finishes it';

/** The refusal of a task's commit while the bug is not proven for it — the fix's where no task is given: `why`. @param {string} why @param {string} [task] */
const unprovenRefusal = (why, task = '1.2') => `commit --task: ${UNIT} is a bugfix, so task ${task} of ${UNIT}'s code lands once its bug is proven by the test its reproducing task wrote — task 1.1, phase 1's lowest-numbered (15.5.3): ${why}`;

/** The series' call again, as a refusal names it. */
const SERIES_CALL = `engine verify run ${UNIT} 1.S1 --unfixed --test 'sh test/crash.sh'`;

/** Task 1.1's test reworked, a new commit on its branch through the door, its account taken again; the checkout left on task 1.2's. */
function testReworked() {
  git(dir, ['checkout', '-q', branchOf(1)]);
  createFile(dir, 'test/crash.sh', `${fs.readFileSync(path.join(dir, 'test/crash.sh'), 'utf8')}# reworked\n`);
  ok(dir, commitArgs('1.1', 'test/crash.sh', `test(${UNIT}): rework the test`), building);
  accountTaken(dir, UNIT, '1.1');
  git(dir, ['checkout', '-q', branchOf(2)]);
}

/** Task 1.1 landed and ended: `land open`, then `task done`. */
const LANDED = [['land', 'open', UNIT, '1.1'], ['task', 'done', UNIT, '1.1']];

/** Why task 1.1 waits on its bug proven, with no series run and with one the test passed in. */
const NO_SERIES = `no series of it has run on the unfixed code — run it there five times: engine verify run ${UNIT} <scenario> --unfixed --test '<the command that runs that test alone>', its scenario one of task 1.1's`;
const PASSED = `the test passed on the unfixed code in its series, so it proves nothing — rework the test, a new commit on task 1.1, then run a new series: engine verify run ${UNIT} 1.S1 --unfixed --test true`;

/** Why task 1.1 does `outcome` only once the bug is proven at its tip: `why`. @param {string} outcome @param {string} why */
const unprovenFor = (outcome, why) => `${UNIT} is a bugfix, so task 1.1 of ${UNIT}, its reproducing task, ${outcome} once the test it wrote proves the bug, failing five times on the unfixed code at its tip (15.5.3): ${why}`;

/** The refusals of task 1.1's landing and of its end while the bug is not proven at its tip: `why`. @param {string} why */
const heldBack = (why) => [`land: ${unprovenFor('lands', why)}`, `task done: ${unprovenFor('is done', why)}`];

/** A child repository, `api`, cloned in the project and ignored by it, task 1.1's branch there at its main: its folder. */
function apiCloned() {
  const api = initRepo(path.join(dir, 'api'));
  committedIn(api, 'README.md', 'init');
  fs.mkdirSync(path.join(dir, '.git/info'), { recursive: true });
  fs.appendFileSync(path.join(dir, '.git/info/exclude'), 'api/\n');
  git(api, ['branch', branchOf(1)]);
  return api;
}

/** A commit in the repository at `repo`, on the branch it has out, adding `file`. @param {string} repo @param {string} file @param {string} message */
function committedIn(repo, file, message) {
  createFile(repo, file, `${message}\n`);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', message]);
}

before(() => {
  const world = unproven();
  for (const task of ['1.1', '1.2', '2.1']) ok(world, ['task', 'start', UNIT, task], building);
  cleanupFixture(world);
});

after(() => {
  for (const session of [BUGFIXING, ENDING, STEPPING]) fs.rmSync(path.join(CONFIG, 'conversations', session), { recursive: true, force: true });
});

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
      + 'the test task 1.1 wrote fails here, and passes once the bug is fixed (15.5.4) — fix what it reports and commit again, or, for a task the fix is not in, once the fix\'s task is done, '
      + `merge its branch in with \`git merge --no-ff --no-commit <the fix's branch>\`, ${THROUGH_THE_DOOR}; where its command fails for another reason, such as a wrong path, `
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

  it('the test reworked after its series, the fix\'s commit is refused until a new series runs at task 1.1\'s new tip, then until it takes task 1.1\'s branch in; merged in as the refusal names it, the merge lands through the door, and the fix lands open', () => {
    dir = proven();
    testReworked();
    const moved = refusedUncommitted(fixAttempted());
    ok(dir, unfixedArgs());
    const behind = refusedUncommitted(fixAttempted());
    git(dir, ['checkout', '-q', '--', 'src/app.js']);
    mergedAsNamed(behind);

    assert.deepStrictEqual([moved, behind], [
      unprovenRefusal(`task 1.1's branch ${branchOf(1)} has moved past the commits its series ran at, so the test as it stands is not proven — run a new series: ${SERIES_CALL}`),
      unprovenRefusal(`in the project's repository, this commit holds neither ${branchOf(1)}, task 1.1's branch, where the test was proven, nor its landing — merge it in with \`git merge --no-ff --no-commit ${branchOf(1)}\`, ${THROUGH_THE_DOOR}`),
    ]);
    assert.strictEqual(ok(dir, fixAttempted(), building).task, `${UNIT}-1-2`);
    accountTaken(dir, UNIT, '1.2');
    assert.deepStrictEqual(['1.1', '1.2'].map((task) => ok(dir, ['land', 'open', UNIT, task], ending).task), ['1.1', '1.2']);
  });

  it('a series whose command fails for a reason but the bug — a wrong path — is caught by the test the door runs after the fix; a new series with the right command lets the fix land', () => {
    dir = unproven();
    ok(dir, unfixedArgs('sh test/missing.sh'));

    assert.match(refusedUncommitted(fixAttempted()), /^commit --task: the check "reproducing test" failed with exit 127, so nothing was committed — the test task 1\.1 wrote fails here.*sh: .*test\/missing\.sh/s);
    ok(dir, unfixedArgs());
    assert.deepStrictEqual(ok(dir, fixAttempted(), building).checks, [{ name: 'reproducing test', exit: 0 }]);
  });
});

describe('commit --task: built on task 1.1\'s work where its landing is, every landing squashing it (15.5.3)', () => {
  it('a task of another phase, laid out on main before phase 1 lands, is refused naming phase 1\'s merge; once task 1.1 has landed, naming the merge of main; main merged in as the refusal names it, holding task 1.1\'s landing, the merge lands through the door — the test run there passing — and the task lands open', () => {
    dir = proven();
    git(dir, ['checkout', '-q', '-b', HARDEN_BRANCH, 'main']);
    const hardening = () => {
      createFile(dir, 'src/hardened.js', 'export const hardened = true;\n');
      return commitArgs('2.1', 'src/hardened.js');
    };
    const beside = refusedUncommitted(hardening());
    fs.rmSync(path.join(dir, 'src/hardened.js'));
    git(dir, ['checkout', '-q', 'main']);
    landedOnMain(dir, 1, { 'test/crash.sh': CRASH_TEST });
    landedOnMain(dir, 2, { 'src/app.js': FIXED });
    git(dir, ['checkout', '-q', HARDEN_BRANCH]);
    const unmerged = refusedUncommitted(hardening());
    mergedAsNamed(unmerged);

    const neither = `in the project's repository, this commit holds neither ${branchOf(1)}, task 1.1's branch, where the test was proven, nor its landing`;
    const merge = `merge main in with \`git merge --no-ff --no-commit main\`, ${THROUGH_THE_DOOR}`;
    assert.deepStrictEqual([beside, unmerged], [
      unprovenRefusal(`${neither} — task 1.1 lands with phase 1 of ${UNIT}: once that phase has merged, ${merge}`, '2.1'),
      unprovenRefusal(`${neither}, which is on main — ${merge}`, '2.1'),
    ]);
    assert.deepStrictEqual(ok(dir, hardening(), building).checks, [{ name: 'reproducing test', exit: 0 }]);
    accountTaken(dir, UNIT, '2.1');
    assert.strictEqual(ok(dir, ['land', 'open', UNIT, '2.1'], ending).task, '2.1');
  });
});

describe('land open and task done: a bugfix\'s reproducing task lands and is done once its bug is proven at its tip (15.5.3)', () => {
  /** Each of task 1.1's landing and its end, refused with nothing moved: its refusal. */
  const held = () => LANDED.map((args) => refusedPristine(dir, args, ending).error);

  it('refused, nothing moved, with no series run and with one the test passed in, naming the series and the rework; the test reworked through the door and its new series five failures, it lands, then is done', () => {
    dir = unproven();
    accountTaken(dir, UNIT, '1.1');

    const none = held();
    ok(dir, unfixedArgs('true'));
    const passed = held();
    testReworked();
    ok(dir, unfixedArgs());
    // The world lays the fix's branch at task 1.1's first tip; the landing
    // refuses task 1.1 while its branch holds one of a task not opened.
    git(dir, ['checkout', '-q', '-B', branchOf(2), branchOf(1)]);

    assert.deepStrictEqual([none, passed], [heldBack(NO_SERIES), heldBack(PASSED)]);
    assert.deepStrictEqual(LANDED.map((args) => ok(dir, args, ending).task), ['1.1', '1.1']);
  });

  it('task 1.1 moved past a series of five failures, no new series run: refused, nothing moved, naming the new series', () => {
    dir = proven();
    accountTaken(dir, UNIT, '1.1');
    testReworked();

    assert.deepStrictEqual(held(), heldBack(`task 1.1's branch ${branchOf(1)} has moved past the commits its series ran at, so the test as it stands is not proven — run a new series: ${SERIES_CALL}`));
  });

  it('a child repository holding task 1.1\'s branch with no work on it, its main moved after the branch was laid and before the series: the branch there behind the commit the series ran at, task 1.1 lands and the fix commits', () => {
    dir = unproven();
    const api = apiCloned();
    committedIn(api, 'CHANGES.md', 'the person\'s own work');
    ok(dir, unfixedArgs());
    accountTaken(dir, UNIT, '1.1');

    assert.deepStrictEqual([ok(dir, LANDED[0], ending).task, ok(dir, fixAttempted(), building).task], ['1.1', `${UNIT}-1-2`]);
  });

  it('task close refuses it, nothing moved, naming its test\'s rework and the unit\'s cancel (15.5.5)', () => {
    dir = unproven();

    assert.strictEqual(refusedPristine(dir, ['task', 'close', UNIT, '1.1', '--reason', 'given up'], ending).error, `task close: ${UNIT} is a bugfix, so task 1.1 of ${UNIT}, its reproducing task, is never closed: `
      + 'the test it writes proves the bug, which is what a bugfix is (15.5.5) — where its test proves nothing, rework it, its builder sent back in with what its series showed: '
      + `engine task add ${UNIT} 1.1 --file <addition> --by orchestrator; where the bugfix is given up, cancel it: engine workunit cancel ${UNIT}`);
  });
});

describe('the step gate: a bugfix\'s reproducing task stands at its gate once its bug is proven at its tip (15.5.3, 12.7.9)', () => {
  /** The build in step, task 1.1 in flight in the stepping conversation and its account taken. */
  function stepped() {
    ok(dir, ['workunit', 'position', UNIT, 'step']);
    ok(dir, ['task', 'start', UNIT, '1.1'], stepping);
    accountTaken(dir, UNIT, '1.1');
  }

  /** Task 1.1's line in the build's standing, as the entry gives it to the stepping conversation. */
  const lineOf = () => call(dir, ['enter', 'implementation', UNIT], stepping).stdout.split('\n').find((line) => line.startsWith('in flight: task 1.1,'));

  it('its landing summary and its gate refused, nothing moved, and its line naming the series, with no series run and after one the test passed in', () => {
    dir = unproven();
    stepped();
    const held = () => [...['task-landed', 'step-gate'].map((surface) => refusedPristine(dir, ['render', surface, UNIT, '1.1'], stepping).error), lineOf()];

    const none = held();
    ok(dir, unfixedArgs('true'));
    const passed = held();

    const waits = (/** @type {string} */ why) => [
      `render task-landed: ${unprovenFor('lands', why)}`, `render step-gate: ${unprovenFor('lands', why)}`, `in flight: task 1.1, its account taken, its bug not yet proven — ${unprovenFor('lands', why)}`,
    ];
    assert.deepStrictEqual([none, passed], [waits(NO_SERIES), waits(PASSED)]);
  });

  it('its bug proven, it stands at its gate', () => {
    dir = proven();
    stepped();

    assert.strictEqual(lineOf(), `in flight: task 1.1, at its gate — it waits on the person's go there, the gate drawn again with render step-gate ${UNIT} 1.1, and its builder is never sent afresh`);
  });
});

describe('commit --task: a child repository holding task 1.1\'s work', () => {
  it('a commit not built on it there is refused, naming that repository and the merge run in its folder; merged in as named, the merge lands through the door', () => {
    dir = unproven();
    const api = apiCloned();
    git(api, ['checkout', '-q', branchOf(1)]);
    committedIn(api, 'test/api.sh', 'reproduce the crash in the api');
    git(api, ['checkout', '-q', 'main']);
    ok(dir, unfixedArgs());

    const behind = refusedUncommitted(fixAttempted());
    mergedAsNamed(behind);

    assert.strictEqual(behind, unprovenRefusal(`in \`api\`, this commit holds neither ${branchOf(1)}, task 1.1's branch, where the test was proven, nor its landing — merge it in with \`git -C api merge --no-ff --no-commit ${branchOf(1)}\`, ${THROUGH_THE_DOOR}`));
    assert.strictEqual(ok(dir, ['commit', '--paths', 'src/app.js', 'api/test/api.sh', '--task', UNIT, '1.2', '-m', `fix(${UNIT}): hold the checkout`], building).task, `${UNIT}-1-2`);
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
