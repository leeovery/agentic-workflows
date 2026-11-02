'use strict';

// ---------------------------------------------------------------------------
// The proof by running the product (leeway-engine/scripts/domain/verify.cjs,
// with runs.cjs and environment.cjs's verify setup, and `verify` in
// engine.cjs): `verify setup` records the setup on the project manifest only
// once all five parts have run end to end for a scenario of the cut, leaving
// the checkout as clean as they found it, its drive an executable script under
// its place run with plain arguments, never one placed under `.leeway/`
// (15.S1, 15.S2, 15.S17); `verify run` runs a scenario of the cut through the
// setup's parts in the calling checkout, clean, and records the verdict the
// drive's script wrote, never Claude's, with its text evidence, its
// recordings in the cache under their hash, each repository's HEAD it ran
// against and the task in flight it ran for (15.S4, 15.S7, 4.S28); and
// `runsOf` reads what a scenario's runs prove, whatever their numbers — the
// latest that was not skipped deciding, or against a head the nearest of the
// runs at it or before it in every repository both name, a clone nested in
// the project among them (15.S6, 12.7.10). `verify mutants` is
// test-engine-verify-mutants.cjs's;
// that a run's file refuses Claude's write is the layout hook's suite's
// (6.2.3).
//
// Layer: git. World: verify-world.cjs's, with one conversation building task
// 1.1 and another building 1.1 and 1.2 side by side.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  ok, refusedPristine, git, commitCode, commitAll, initRepo, cleanupFixture, statePath, layout, createFile, readState, writeState, lastMessage, touched, stateGit, output, holdLock, lockAttempts,
} = require('./engine-harness.cjs');
const { UNIT, SETUP, steer, steering, partsRan, fiveParts, setupFile, setupArgs, unrecorded, world } = require('./verify-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { runsOf } = require(path.join(SCRIPTS, 'domain/runs.cjs'));
const { ignoresCase } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));

const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const BUILDING = 'verify-building';
const PARALLEL = 'verify-parallel';
const LAID_OUT = 'verify-laid-out';
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const IGNORES_CASE = ignoresCase(fs.realpathSync(os.tmpdir()));

/** The project manifest as it stands. @param {string} dir */
const projectManifest = (dir) => JSON.parse(readState(dir, layout.projectManifest));

/** The code's HEAD. @param {string} dir */
const codeHead = (dir) => git(dir, ['rev-parse', 'HEAD']).trim();

/** The state's HEAD, short. @param {string} dir */
const stateHead = (dir) => stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();

/** A call's options in the conversation `session`. @param {string} session */
const as = (session) => ({ env: { CLAUDE_CODE_SESSION_ID: session } });

before(() => {
  const dir = world();
  ok(dir, ['task', 'start', UNIT, '1.1'], as(BUILDING));
  for (const task of ['1.1', '1.2']) ok(dir, ['task', 'start', UNIT, task], as(PARALLEL));
  cleanupFixture(dir);
});

after(() => {
  for (const session of [BUILDING, PARALLEL, LAID_OUT]) fs.rmSync(path.join(CONFIG, 'conversations', session), { recursive: true, force: true });
});

/** @type {string} */ let dir;
afterEach(() => cleanupFixture(dir));

describe('verify setup: recorded once it runs end to end (15.2.5, 15.2.7, 15.2.11, 22.5.12)', () => {
  beforeEach(() => { dir = unrecorded(); });

  it('15.S1, 15.S17: all five parts run in order in the checkout for the scenario, then the setup is recorded on the project manifest — its place, the feature map\'s beside it, its five parts, its mutation tool and the run it was recorded after — beside the environment\'s other parts, committed alone, nothing drawn, no run recorded', () => {
    const project = projectManifest(dir);
    writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { run: { tests: 'npm test' } } }, null, 2));
    commitAll(dir, 'the tests');
    steering(dir, 'verdict', 'fail\n');
    const out = output(dir, setupArgs(dir, SETUP));
    const res = JSON.parse(out);

    const recorded = { ...SETUP, ran: { unit: UNIT, scenario: '1.S1', verdict: 'fail', commits: [{ repo: '.', commit: codeHead(dir) }], at: res.setup.ran.at } };
    assert.match(res.setup.ran.at, AT);
    assert.deepStrictEqual(res, { ok: true, unit: UNIT, setup: recorded, committed: stateHead(dir) });
    assert.strictEqual(out, `${JSON.stringify(res)}\n`, 'one line, no screen');
    assert.deepStrictEqual(projectManifest(dir).environment, { run: { tests: 'npm test' }, verify: recorded });
    assert.deepStrictEqual(partsRan(dir), fiveParts('1.S1', dir));
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], ['verify(pay): the verify setup recorded', ['M\tmanifest.json']]);
    assert.strictEqual(fs.existsSync(statePath(dir, layout.run(UNIT, '1.S1'))), false, 'the trial is no run');
  });

  it('15.2.7: a drive that writes no verdict, or evidence a run cannot hold, keeps the setup from counting — refused, nothing recorded', () => {
    assert.strictEqual(refusedPristine(dir, setupArgs(dir, SETUP)).error, 'verify setup: the run cannot be recorded — the drive wrote no verdict to $LEEWAY_RUN/verdict — it exited 0. Nothing was recorded.');
    steering(dir, 'verdict', 'pass\n');
    steering(dir, 'evidence/frame.png', Buffer.from([0xff, 0xfe]));
    assert.strictEqual(refusedPristine(dir, setupArgs(dir, SETUP)).error,
      'verify setup: the run cannot be recorded — evidence/frame.png is not a text file — a recording or an image goes in recordings/. Nothing was recorded.');
  });

  it('15.S1: a setup whose health check fails is refused, naming it, its exit code and its output, the cleanup run all the same, and nothing recorded', () => {
    steering(dir, 'fail-health', '3');

    const { error } = refusedPristine(dir, setupArgs(dir, SETUP));

    assert.strictEqual(error, 'verify setup: the setup\'s health failed with exit 3. The last of its output, 40 lines at most:\nhealth broke\nNothing was recorded — fix the setup where it breaks (15.2.8) and run it again.');
    assert.deepStrictEqual(partsRan(dir), ['launch', 'health', 'cleanup'].map((part) => `${part} 1.S1 ${dir}`));
  });

  it('15.2.7: a cleanup that fails after the rest held is refused too — the setup never ran end to end', () => {
    steering(dir, 'verdict', 'pass\n');
    steering(dir, 'fail-cleanup', '1');

    assert.strictEqual(refusedPristine(dir, setupArgs(dir, SETUP)).error,
      'verify setup: the setup\'s cleanup failed with exit 1. The last of its output, 40 lines at most:\ncleanup broke\nNothing was recorded — fix the setup where it breaks (15.2.8) and run it again.');
  });

  it('15.S2: a setup placed under .leeway/, or its feature map there — reached through `..`, or in another case where the filesystem ignores it — is refused before any part runs (15.2.12)', () => {
    const places = [['place', '.leeway/verify'], ['feature_map', 'verify/../.leeway/features.md'], ...(IGNORES_CASE ? [['place', '.Leeway/verify']] : [])];
    for (const [key, place] of places) {
      assert.strictEqual(refusedPristine(dir, setupArgs(dir, { ...SETUP, [key]: place })).error,
        `verify setup: the ${key} ${place} is under .leeway/, the workflows' state — the verify setup lives in the product's code, riding the phase's pull requests (15.2.12)`);
    }
    assert.deepStrictEqual(partsRan(dir), []);
  });

  it('15.2.10: the drive\'s command is an executable file under the place, then plain arguments — from the root, through `./`, or by its whole path — the other parts free', () => {
    steering(dir, 'verdict', 'pass\n');

    for (const drive of ['./verify/part.sh drive --headed', `${dir}/verify/part.sh drive`]) {
      assert.strictEqual(ok(dir, setupArgs(dir, { ...SETUP, drive, launch: 'true && sh verify/part.sh launch' })).setup.drive, drive);
    }
  });

  it('15.2.10, 15.4.2: a drive that is no script under the place is refused before any part runs, saying how to wrap a tool — a tool called by name, a script not executable, outside the place or reached through a link out of it, and any shell operator or expansion; so is a place that is the code root', () => {
    fs.chmodSync(createFile(dir, 'src/run.sh', '#!/bin/sh\n'), 0o755);
    fs.symlinkSync('/bin/sh', path.join(dir, 'verify', 'sh'));
    const drives = [
      'npm run drive', 'make drive', 'make -C verify drive', 'pnpm exec playwright test verify/e2e', '--config=verify/x',
      'sh -c \'printf pass > "$LEEWAY_RUN/verdict"\' verify/part.sh', 'true verify/features.md; printf pass > "$LEEWAY_RUN/verdict"',
      'verify/features.md', 'src/run.sh', 'verify/sh verify/part.sh drive', 'verify/missing.sh',
      ...[';', '&', '|', '<', '>', '$', '`', '(', ')', '\n'].map((syntax) => `verify/part.sh drive ${syntax} x`),
    ];

    const refused = drives.map((drive) => refusedPristine(dir, setupArgs(dir, { ...SETUP, drive })).error);
    const atRoot = ['.', 'verify/..'].map((place) => refusedPristine(dir, setupArgs(dir, { ...SETUP, place })).error);

    assert.deepStrictEqual(refused, drives.map((drive) => `verify setup: the drive "${drive}" is no script under the place verify — its command is the path of an executable file there, then plain arguments, `
      + 'with no shell operator or expansion, since the verdict is the product\'s reviewed code\'s (15.2.10); wrap a tool in a script there, such as verify/drive.sh running npm run drive'));
    assert.deepStrictEqual(atRoot, ['.', 'verify/..'].map((place) => `verify setup: the place ${place} is the code root — the setup's place is a folder below it, holding the drive's script (15.2.10)`));
    assert.deepStrictEqual(partsRan(dir), []);
  });

  it('a setup whose parts leave a file the checkout does not ignore is refused at its trial, naming it and the way on — and the refusal before the next run says the same; once ignored, it records', () => {
    steering(dir, 'verdict', 'pass\n');
    steering(dir, 'leave-launch', 'test-results/report.json');
    const wayOn = 'Ignore a file a run leaves behind, have the setup\'s cleanup remove it, or write it under $LEEWAY_RUN; commit one through the door (engine commit --paths … --task) only where it belongs to the product.';

    const refused = [refusedPristine(dir, setupArgs(dir, SETUP)).error, refusedPristine(dir, setupArgs(dir, SETUP)).error];

    assert.deepStrictEqual(refused, [
      `verify setup: the setup's parts left test-results/report.json in the checkout at ${dir}, so nothing was recorded. ${wayOn}`,
      `verify setup: the checkout at ${dir} holds changes not committed — test-results/report.json — a run proves committed code. ${wayOn}`,
    ]);
    assert.deepStrictEqual(partsRan(dir), fiveParts('1.S1', dir));
    createFile(dir, '.gitignore', 'test-results/\n');
    commitCode(dir, 'chore: ignore the test results');
    assert.strictEqual(ok(dir, setupArgs(dir, SETUP)).setup.ran.verdict, 'pass');
  });

  it('a file holding no setup is refused, naming every fault; so are a place the checkout lacks, a scenario none of the cut\'s, and a call without its scenario', () => {
    const { launch: _launch, ...partial } = SETUP;
    const faulty = { ...partial, place: '/abs/verify', feature_map: '../features.md', drive: '', mutation: 7, ran: {}, extra: true };

    assert.deepStrictEqual([
      refusedPristine(dir, setupArgs(dir, faulty)).error,
      refusedPristine(dir, setupArgs(dir, { ...SETUP, place: 'drive' })).error,
      refusedPristine(dir, ['verify', 'setup', UNIT, '--file', setupFile(dir, SETUP), '--scenario', '3.S1']).error,
      refusedPristine(dir, ['verify', 'setup', UNIT, '--file', setupFile(dir, SETUP)]).error,
    ], [
      'verify setup: the setup file does not hold a verify setup — "ran" is no field of the verify setup; "extra" is no field of the verify setup; place is not a path inside the code, from its root; '
        + 'feature_map is not a path inside the code, from its root; launch is not a command; drive is not a command; mutation is not a command',
      `verify setup: the place drive is not in the checkout at ${dir} — record the setup from the checkout it was built in`,
      'verify setup: 3.S1 is no scenario of pay\'s cut — engine manifest get pay cut lists them',
      'Usage: engine verify run <work-unit> <scenario> | engine verify setup <work-unit> --file <setup.json> --scenario <scenario> | engine verify mutants <work-unit> <N>',
    ]);
    assert.deepStrictEqual(partsRan(dir), []);
  });
});

describe('verify run: a scenario run and its run recorded (15.4.1, 15.4.2, 15.4.4)', () => {
  beforeEach(() => { dir = world(); });

  it('15.S4: a scenario of the cut runs through launch, the health check, the drive, the evidence and the cleanup in the checkout, and the verdict the drive wrote is recorded — with the checkout and each repository\'s HEAD it ran against — committed alone', () => {
    steering(dir, 'verdict', 'pass\n');

    const res = ok(dir, ['verify', 'run', UNIT, '1.S2']);

    const file = layout.run(UNIT, '1.S2', '001');
    assert.deepStrictEqual(res, { ok: true, unit: UNIT, scenario: '1.S2', verdict: 'pass', run: file, standing: 'proven', committed: stateHead(dir) });
    const run = JSON.parse(readState(dir, file));
    assert.match(run.at, AT);
    assert.deepStrictEqual(run, { verdict: 'pass', unfixed: false, at: run.at, checkout: dir, commits: [{ repo: '.', commit: codeHead(dir) }], task: null, evidence: [], recordings: [] });
    assert.deepStrictEqual(partsRan(dir), fiveParts('1.S2', dir));
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], ['verify(pay): 1.S2 pass', [`A\t${file}`]]);
  });

  it('a run proves committed code: a checkout holding a change not committed, tracked or untracked, is refused before any part runs, naming each file; a nested repository\'s HEAD is recorded beside the root\'s', () => {
    steering(dir, 'verdict', 'pass\n');
    createFile(dir, 'src/card.js', 'const card = 2;\n');
    createFile(dir, 'src/new.js', 'new\n');
    assert.strictEqual(refusedPristine(dir, ['verify', 'run', UNIT, '1.S1']).error,
      `verify run: the checkout at ${dir} holds changes not committed — src/card.js, src/new.js — a run proves committed code. Ignore a file a run leaves behind, have the setup's cleanup remove it, `
      + 'or write it under $LEEWAY_RUN; commit one through the door (engine commit --paths … --task) only where it belongs to the product.');
    assert.deepStrictEqual(partsRan(dir), []);
    commitCode(dir, 'feat(pay): the card');
    const lib = initRepo(path.join(dir, 'lib'));
    createFile(lib, 'x.js', 'x\n');
    commitCode(lib, 'feat(pay): lib');

    const run = JSON.parse(readState(dir, ok(dir, ['verify', 'run', UNIT, '1.S1']).run));

    assert.deepStrictEqual(run.commits, [{ repo: '.', commit: codeHead(dir) }, { repo: 'lib', commit: codeHead(lib) }]);
  });

  it('15.4.2: a drive that exits failing having written its verdict is recorded as it wrote it; one that wrote none — or a folder in its place — records nothing, the refusal carrying its exit code and output, and so does a word of its own', () => {
    steering(dir, 'verdict/pass', 'pass\n');
    assert.strictEqual(refusedPristine(dir, ['verify', 'run', UNIT, '1.S1']).error, 'verify run: the run cannot be recorded — the drive wrote no verdict to $LEEWAY_RUN/verdict — it exited 0. Nothing was recorded.');
    fs.rmSync(path.join(steer(dir), 'verdict'), { recursive: true });
    steering(dir, 'fail-drive', '1');
    assert.strictEqual(refusedPristine(dir, ['verify', 'run', UNIT, '1.S1']).error,
      'verify run: the run cannot be recorded — the drive wrote no verdict to $LEEWAY_RUN/verdict — it exited 1. The last of its output, 40 lines at most:\ndrive broke. Nothing was recorded.');
    steering(dir, 'verdict', 'proven\n');
    assert.strictEqual(refusedPristine(dir, ['verify', 'run', UNIT, '1.S1']).error, 'verify run: the run cannot be recorded — the drive\'s verdict "proven" is none of pass, fail, skipped. Nothing was recorded.');
    steering(dir, 'verdict', 'fail\n');

    assert.strictEqual(ok(dir, ['verify', 'run', UNIT, '1.S1']).verdict, 'fail');
    assert.strictEqual(JSON.parse(readState(dir, layout.run(UNIT, '1.S1', '001'))).verdict, 'fail');
  });

  it('15.S6, 12.7.10: a drive whose criterion\'s tests were skipped records skipped, and the scenario reads named, not run at the commits it ran at — a pass at code it does not hold counting for nothing, though it differs only in a nested clone', () => {
    steering(dir, 'verdict', 'skipped\n');
    const lib = initRepo(path.join(dir, 'lib'));
    git(lib, ['commit', '-q', '--allow-empty', '-m', 'the library']);
    const elsewhere = git(lib, ['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'another builder\'s work']).trim();
    writeState(dir, layout.run(UNIT, '1.S1', '001'), JSON.stringify({
      verdict: 'pass', unfixed: false, at: '2026-11-01T00:00:00Z', commits: [{ repo: '.', commit: codeHead(dir) }, { repo: 'lib', commit: elsewhere }],
    }));
    stateGit(dir, ['add', '-A']);
    stateGit(dir, ['commit', '-qm', 'a run at another builder\'s code']);

    const res = ok(dir, ['verify', 'run', UNIT, '1.S1']);

    assert.deepStrictEqual([res.verdict, res.standing, JSON.parse(readState(dir, res.run)).verdict], ['skipped', 'named, not run', 'skipped']);
  });

  it('a part that fails before the drive refuses, naming it and the cleanup that failed after it, nothing recorded', () => {
    steering(dir, 'fail-launch', '2');
    steering(dir, 'fail-cleanup', '5');
    steering(dir, 'verdict', 'pass\n');

    const { error } = refusedPristine(dir, ['verify', 'run', UNIT, '1.S1']);

    assert.strictEqual(error, 'verify run: the setup\'s launch failed with exit 2. The last of its output, 40 lines at most:\nlaunch broke\nThen the setup\'s cleanup failed with exit 5. The last of its output, 40 lines at most:\ncleanup broke\nNothing was recorded — fix the setup where it breaks (15.2.8) and run it again.');
    assert.deepStrictEqual(partsRan(dir).map((line) => line.split(' ')[0]), ['launch', 'cleanup']);
  });

  it('15.S7, 4.S28: the text evidence is kept with the run, and each recording sits in the unit\'s cache at the run\'s path there under its hash, the hash in the run, never committed', () => {
    const recording = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    steering(dir, 'verdict', 'pass\n');
    steering(dir, 'evidence/screen.txt', '┌ card ┐\n│ Visa │\n');
    steering(dir, 'recordings/screen.png', recording);

    const res = ok(dir, ['verify', 'run', UNIT, '1.S1']);

    const sha256 = crypto.createHash('sha256').update(recording).digest('hex');
    const run = JSON.parse(readState(dir, res.run));
    assert.deepStrictEqual([run.evidence, run.recordings], [[{ name: 'screen.txt', text: '┌ card ┐\n│ Visa │\n' }], [{ name: 'screen.png', sha256 }]]);
    assert.deepStrictEqual(fs.readFileSync(statePath(dir, layout.cache(UNIT, 'build', 'runs', '1.S1', sha256, 'screen.png'))), recording);
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [`A\t${res.run}`]);
  });

  it('15.4.4: among the evidence, a file that is not text, one over 64 KB, a folder and a symbolic link are refused, and among the recordings a folder and a symbolic link — nothing recorded', () => {
    steering(dir, 'verdict', 'pass\n');
    steering(dir, 'evidence/frame.png', Buffer.from([0xff, 0xfe, 0x00]));
    steering(dir, 'evidence/long.txt', 'x'.repeat(64 * 1024 + 1));
    steering(dir, 'evidence/fits.txt', 'x'.repeat(64 * 1024));
    steering(dir, 'evidence/more/screen.txt', 'x\n');
    steering(dir, 'recordings/takes/one.cast', 'x\n');
    fs.symlinkSync('/etc/hosts', path.join(steer(dir), 'evidence', 'hosts.txt'));
    fs.symlinkSync('/etc/hosts', path.join(steer(dir), 'recordings', 'hosts.cast'));

    assert.strictEqual(refusedPristine(dir, ['verify', 'run', UNIT, '1.S1']).error, 'verify run: the run cannot be recorded — evidence/frame.png is not a text file — a recording or an image goes in recordings/; '
      + 'evidence/hosts.txt is a symbolic link; evidence/long.txt is over 64 KB — a large one goes in recordings/; evidence/more is not a file; '
      + 'recordings/hosts.cast is a symbolic link; recordings/takes is not a file. Nothing was recorded.');
  });

  it('builder attribution: run in a code worktree, the run records that checkout\'s HEAD and the one task of the unit in flight in the calling conversation — with several in flight, the one whose worktree `task worktree` laid out there; else, or with none, no task', () => {
    steering(dir, 'verdict', 'pass\n');
    const worktree = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-worktree-'))), 'card');
    git(dir, ['worktree', 'add', '-q', '-b', 'card', worktree]);
    createFile(worktree, 'src/card.js', 'const card = 2;\n');
    commitCode(worktree, 'feat(pay): take a card');
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'start', UNIT, task], as(LAID_OUT));
    ok(worktree, ['task', 'worktree', UNIT, '1.2'], as(LAID_OUT));

    const runs = [
      ok(worktree, ['verify', 'run', UNIT, '1.S1'], as(BUILDING)), ok(worktree, ['verify', 'run', UNIT, '1.S1'], as(LAID_OUT)),
      ok(dir, ['verify', 'run', UNIT, '1.S1'], as(PARALLEL)), ok(dir, ['verify', 'run', UNIT, '1.S1']),
    ].map((res) => JSON.parse(readState(dir, res.run)));

    assert.deepStrictEqual(runs.map(({ commits, checkout, task }) => ({ commits, checkout, task })), [
      { commits: [{ repo: '.', commit: codeHead(worktree) }], checkout: worktree, task: '1.1' },
      { commits: [{ repo: '.', commit: codeHead(worktree) }], checkout: worktree, task: '1.2' },
      { commits: [{ repo: '.', commit: codeHead(dir) }], checkout: dir, task: null },
      { commits: [{ repo: '.', commit: codeHead(dir) }], checkout: dir, task: null },
    ]);
    assert.notStrictEqual(codeHead(worktree), codeHead(dir));
    assert.strictEqual(partsRan(dir)[0], `launch 1.S1 ${worktree}`);
    fs.rmSync(path.dirname(worktree), { recursive: true, force: true });
  });

  it('the parts run holding no lock: the writer lock is first tried once all five have run, around the record and its commit alone', (t) => {
    steering(dir, 'verdict', 'pass\n');
    const lock = holdLock(statePath(dir, layout.lock));
    /** @type {number[]} */
    const ranWhenTried = [];
    const attempts = lockAttempts(t, lock, () => {
      ranWhenTried.push(partsRan(dir).length);
      fs.unlinkSync(lock);
    });

    ok(dir, ['verify', 'run', UNIT, '1.S1']);

    assert.deepStrictEqual([ranWhenTried, attempts], [[5], ['taken', 'made']]);
  });

  it('a run is numbered past the highest its scenario holds, and holds no number of its own', () => {
    steering(dir, 'verdict', 'fail\n');
    ok(dir, ['verify', 'run', UNIT, '2.S1']);
    stateGit(dir, ['mv', layout.run(UNIT, '2.S1', '001'), layout.run(UNIT, '2.S1', '007')]);
    stateGit(dir, ['commit', '-qm', 'renumbered as a merge would']);

    const res = ok(dir, ['verify', 'run', UNIT, '2.S1']);

    assert.strictEqual(res.run, layout.run(UNIT, '2.S1', '008'));
    assert.deepStrictEqual(Object.keys(JSON.parse(readState(dir, res.run))).filter((key) => /number|scenario|file/.test(key)), []);
  });

  it('refused, nothing run or recorded: a unit the project lacks, a scenario none of the cut\'s, and a usage the verb does not take — a unit named as a verb among them', () => {
    assert.deepStrictEqual([
      refusedPristine(dir, ['verify', 'run', 'nope', '1.S1']).error,
      refusedPristine(dir, ['verify', 'run', UNIT, '3.S1']).error,
      refusedPristine(dir, ['verify', 'run', UNIT, 'cards']).error,
      refusedPristine(dir, ['verify', 'run', 'setup', '1.S1']).error,
      refusedPristine(dir, ['verify', UNIT, '1.S1']).error,
    ], [
      'verify run: there is no work unit "nope"',
      'verify run: 3.S1 is no scenario of pay\'s cut — engine manifest get pay cut lists them',
      'verify run: cards is no scenario of pay\'s cut — engine manifest get pay cut lists them',
      'verify run: there is no work unit "setup"',
      'Usage: engine verify run <work-unit> <scenario> | engine verify setup <work-unit> --file <setup.json> --scenario <scenario> | engine verify mutants <work-unit> <N>',
    ]);
    assert.deepStrictEqual(partsRan(dir), []);
  });

  it('before a setup is recorded, verify run and verify mutants refuse, naming verify setup', () => {
    cleanupFixture(dir);
    dir = unrecorded();
    const named = 'the project has no verify setup recorded — the first phase\'s tasks build it in the product\'s code, and engine verify setup pay --file <setup.json> --scenario <scenario> records it once it has run end to end';

    assert.deepStrictEqual([refusedPristine(dir, ['verify', 'run', UNIT, '1.S1']).error, refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error], [`verify run: ${named}`, `verify mutants: ${named}`]);
  });
});

describe('runsOf: what a scenario\'s runs prove (15.3.5, 15.4.3)', () => {
  beforeEach(() => { dir = world(); });

  /**
   * Runs of 1.S1 written as `verdicts` give them, each recorded a day after
   * the one before unless `at` says otherwise, numbered out of step; then what
   * they prove.
   * @param {string[]} verdicts @param {{unfixed?: boolean, at?: (i: number) => string, number?: (i: number) => number}} [shape]
   */
  function standingOf(verdicts, { unfixed = false, at = (i) => `2026-11-0${i + 1}T00:00:00Z`, number = (i) => i * 4 + 3 } = {}) {
    fs.rmSync(statePath(dir, layout.run(UNIT, '1.S1')), { recursive: true, force: true });
    verdicts.forEach((verdict, i) => writeState(dir, layout.run(UNIT, '1.S1', String(number(i)).padStart(3, '0')), JSON.stringify({ verdict, unfixed, at: at(i) })));
    return runsOf(dir, UNIT, '1.S1').standing;
  }

  it('15.S6, 15.S5: the latest run not skipped decides — proven where it passed, not proven where it failed, a regression after a pass among them; named, not run only where every run was skipped; not proven with none', () => {
    assert.deepStrictEqual(
      [['pass', 'fail'], ['fail', 'pass'], ['pass', 'skipped'], ['fail', 'skipped'], ['skipped', 'skipped'], [], ['fail']].map((verdicts) => standingOf(verdicts)),
      ['not proven', 'proven', 'proven', 'not proven', 'named, not run', 'not proven', 'not proven'],
    );
  });

  it('runs recorded at the same moment are ordered by their numbers', () => {
    const sameMoment = { at: () => '2026-11-01T00:00:00Z' };
    assert.deepStrictEqual([
      standingOf(['pass', 'fail'], { ...sameMoment, number: (i) => 9 - i }),
      standingOf(['pass', 'fail'], { ...sameMoment, number: (i) => i + 1 }),
    ], ['proven', 'not proven']);
  });

  it('a run on the unfixed code proves nothing of the change (15.5)', () => {
    assert.strictEqual(standingOf(['pass'], { unfixed: true }), 'not proven');
  });

  it('the runs come back in the order they were recorded, each naming its file', () => {
    standingOf(['fail', 'pass']);
    assert.deepStrictEqual(runsOf(dir, UNIT, '1.S1').runs.map(({ file, verdict }) => [file, verdict]), [[layout.run(UNIT, '1.S1', '003'), 'fail'], [layout.run(UNIT, '1.S1', '007'), 'pass']]);
  });

  describe('read against a head, the code to judge in every repository it names', () => {
    /**
     * Each repository's commits by name: the project's own, `P0` to `P3`,
     * and a clone nested in it, `lib`, `L0` to `L3`, each a line from its
     * first; `Pb` and `Lb` each a branch off its first, as a builder cut
     * before the line moved on.
     * @type {Record<string, string>}
     */ let at;
    beforeEach(() => {
      const lib = initRepo(path.join(dir, 'lib'));
      git(lib, ['commit', '-q', '--allow-empty', '-m', 'the library']);
      const child = (/** @type {string} */ repo, /** @type {string} */ parent, /** @type {string} */ name) => git(repo, ['commit-tree', `${parent}^{tree}`, '-p', parent, '-m', name]).trim();
      at = { P0: codeHead(dir), L0: codeHead(lib) };
      for (const [repo, line] of /** @type {Array<[string, string]>} */ ([[dir, 'P'], [lib, 'L']])) {
        for (const n of [1, 2, 3]) at[`${line}${n}`] = child(repo, at[`${line}${n - 1}`], `${line}${n}`);
        at[`${line}b`] = child(repo, at[`${line}0`], `${line}b`);
      }
    });

    /** Code as a run or a head names it, `.` the project's own repository. @param {Record<string, string>} commits */
    const code = (commits) => Object.entries(commits).map(([repo, name]) => ({ repo, commit: at[name] ?? name }));

    /**
     * Runs of 1.S1 written, each `[verdict, its code, day]`, numbered in
     * order; then what they prove against `head`, and the runs that count.
     * @param {Array<[string, Record<string, string>, number]>} runs @param {Record<string, string>} [head]
     */
    function against(runs, head) {
      fs.rmSync(statePath(dir, layout.run(UNIT, '1.S1')), { recursive: true, force: true });
      runs.forEach(([verdict, commits, day], i) => writeState(dir, layout.run(UNIT, '1.S1', String(i + 1).padStart(3, '0')),
        JSON.stringify({ verdict, unfixed: false, at: `2026-11-0${day}T00:00:00Z`, commits: code(commits) })));
      const { standing, runs: counted } = runsOf(dir, UNIT, '1.S1', head === undefined ? undefined : code(head));
      return [standing, counted.map(({ file }) => path.basename(file))];
    }

    it('12.7.10: side by side in a clone, the project\'s commit never moving — 1.1\'s merged regression fails at the merged tips, then 1.2\'s builder, branched before it landed, passes at older code: against the merged tips the regression stands; without a head the later pass reads proven', () => {
      const runs = /** @type {Array<[string, Record<string, string>, number]>} */ ([
        ['fail', { '.': 'P0', lib: 'L1' }, 1], ['pass', { '.': 'P0', lib: 'L0' }, 2], ['pass', { '.': 'P0', lib: 'Lb' }, 3],
      ]);

      assert.deepStrictEqual([against(runs, { '.': 'P0', lib: 'L1' }), against(runs, { '.': 'P0', lib: 'Lb' }), against(runs)], [
        ['not proven', ['run-001.json', 'run-002.json']],
        ['proven', ['run-002.json', 'run-003.json']],
        ['proven', ['run-001.json', 'run-002.json', 'run-003.json']],
      ]);
    });

    it('a repository only one side names decides nothing — the head\'s clone the run never named, nor a repository only the run names, at a commit the project holds nowhere', () => {
      assert.deepStrictEqual(against([['pass', { '.': 'P1', ext: 'f'.repeat(40) }, 1]], { '.': 'P2', lib: 'L1' }), ['proven', ['run-001.json']]);
    });

    it('the runs nearest the head decide, the commits between summed over the repositories both name — however one repository alone would order them — then the latest by when they were recorded', () => {
      const head = { '.': 'P3', lib: 'L3' };
      assert.deepStrictEqual([
        against([['pass', { '.': 'P2', lib: 'L2' }, 1], ['fail', { '.': 'P3', lib: 'L0' }, 2]], head)[0],
        against([['pass', { '.': 'P2', lib: 'L2' }, 1], ['fail', { '.': 'P0', lib: 'L3' }, 2]], head)[0],
        against([['fail', { '.': 'P2', lib: 'L2' }, 1], ['pass', { '.': 'P3', lib: 'L1' }, 2]], head)[0],
        against([['pass', { '.': 'P2', lib: 'L2' }, 1], ['fail', { '.': 'P3', lib: 'L1' }, 2]], head)[0],
      ], ['proven', 'proven', 'proven', 'not proven']);
    });

    it('skipped runs are passed over; named, not run where every run counted was skipped; not proven where none reached the head, in any repository', () => {
      const head = { '.': 'P3', lib: 'L3' };
      assert.deepStrictEqual([
        against([['pass', { '.': 'P0', lib: 'L0' }, 3], ['fail', { '.': 'P1', lib: 'L1' }, 1], ['skipped', head, 2]], head)[0],
        against([['skipped', { '.': 'P1', lib: 'L1' }, 1], ['pass', { '.': 'Pb', lib: 'L1' }, 2], ['pass', { '.': 'P1', lib: 'Lb' }, 3]], head)[0],
        against([['pass', { '.': 'P1', lib: 'L1' }, 1]], { '.': 'P0', lib: 'L3' })[0],
      ], ['not proven', 'named, not run', 'not proven']);
    });
  });
});
