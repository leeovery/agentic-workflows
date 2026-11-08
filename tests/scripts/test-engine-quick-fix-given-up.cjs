'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's fix given up (leeway-engine/scripts/domain/fix-end.cjs;
// task-verbs.cjs; fix-branch.cjs): `task close` taking a fix holding no
// work of its own, even one a later fix is laid on — that fix then opening
// onto the fix below, past the one closed (R4) — and the door then refusing
// a commit under it, which takes no more work, naming the next fix's start
// and a fix of its own (commit-task.cjs). Refused, naming the
// reversal, for a fix opened to land, whatever its own work reads (R9),
// and for one holding work a later fix not closed is laid on — a commit of
// it the later fix's branch holds, though the fix has moved on since; the
// reversal landing as a fix of its own whose commit through the door
// reverts the change, every git command asked of the shell guard first
// (R3). Every refusal writes nothing. A fix holding work neither opened nor
// laid on, closed, the fix after it then opening onto the fix below, on
// every driver, is the quick-fix landing conformance suite's (closed); one
// landed by hand, refused, the end suite's and the by-hand suite's; a
// recorded fix's record taken out as it closes,
// test-engine-quick-fix-record.cjs's.
//
// Layer: git. World: quick-fix-world.cjs's `twoFixesBuilt` — fixes 1.1 and
// 1.2, 1.2 laid on 1.1, each built through the local driver and done —
// built once and copied. Each test's conversation keeps its records in a
// config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, refusedPristine, git, createFile, commitAll, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, FLAG, HELP, RECORDS, createFix, fixChanged, recordFile, twoFixesBuilt, guardedGit, checklistClosed,
} = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

const DOCS = 'Spell the docs --colour';
const MAN = 'Spell the man page --colour';
const BACK = 'Put the docs back';
const RECORD = Object.freeze({ changed: 'A change.', why: 'A reason.', leaves: 'Nothing.' });

const world = fixtureFrom('quick-fix-given-up-', twoFixesBuilt);

let dir = ''; // the project
const config = useTempFolder('quick-fix-given-up-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options. */
const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, as());

/** Fix `n`'s branch. @param {number} n @param {string} title */
const branchOf = (n, title) => taskBranch({ unit: UNIT, phase: 1, n }, 'fix', title);

/** Fix `n` made, as `fixChanged` makes it, in this test's conversation. @param {number} n @param {string} title @param {string} file */
const changed = (n, title, file) => fixChanged(dir, n, title, file, '--colour\n', as());

/** Fix `n`'s record written through the verb. @param {number} n */
const record = (n) => run(['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, RECORDS[n] ?? RECORD)]);

/** Fix `n` closed with a reason. @param {number} n */
const close = (n) => run(['task', 'close', UNIT, `1.${n}`, '--reason', 'Not wanted.']);

/** Fix `n`'s close refused, as the refusal reads. @param {number} n */
const closeRefused = (n) => refusedPristine(dir, ['task', 'close', UNIT, `1.${n}`, '--reason', 'Not wanted.'], as()).error;

/** Fix `n`'s status, as the tracker holds it. @param {number} n */
const status = (n) => run(['task', 'show', UNIT, `1.${n}`]).status;

/** The reversal's way on, as a close's refusal names it, after why the fix lands as it is. @param {number} n @param {string} why */
const held = (n, why) => `task close: task 1.${n} of ${UNIT} ${why} — so it lands as it is, done once it lands, and its change is given up as a landed change is, `
  + `by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`;

describe('task close <quick-fix> <fix> (R3, R4, R9)', () => {
  it('R4: closes a fix holding no work of its own though a later fix is laid on it, that fix then opening onto the fix below it; the door then refuses a commit under it, naming the next fix\'s start and a fix of its own — a fix of its own alone where no later fix is unended', () => {
    dir = world();
    createFile(dir, 'docs/late.md', '--colour\n');
    const last = refusedPristine(dir, ['commit', '--paths', 'docs/late.md', '--task', UNIT, '1.2', '-m', `fix(${UNIT}): spell the docs late`], as()).error;
    fs.rmSync(path.join(dir, 'docs/late.md'));
    createFix(dir, 3, DOCS, as());
    run(['task', 'start', UNIT, '1.3']);
    changed(4, MAN, 'docs/man.md');
    close(3);
    const opened = run(['land', 'open', UNIT, '1.4']);
    createFile(dir, 'docs/late.md', '--colour\n');
    const late = refusedPristine(dir, ['commit', '--paths', 'docs/late.md', '--task', UNIT, '1.3', '-m', `fix(${UNIT}): spell the docs late`], as()).error;

    assert.deepStrictEqual([status(3), opened.repos.map((/** @type {any} */ { base }) => base), late, last], [
      'closed', [branchOf(2, HELP)],
      `commit --task: task 1.3 of ${UNIT} is closed, and a task ended takes no more work — commit it under the fix it is for — start the next with \`engine task start ${UNIT} 1.4\` — `
      + `or make it a task of its own with \`engine task create ${UNIT} 1 --file <task.md>\``,
      `commit --task: task 1.2 of ${UNIT} is done, and a task ended takes no more work — make it a task of its own with \`engine task create ${UNIT} 1 --file <task.md>\``,
    ]);
  });

  it('refuses a fix holding work of its own that a later fix not closed is laid on, or that is opened to land, naming each and the reversal, writing nothing', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    changed(4, MAN, 'docs/man.md');
    const laid = closeRefused(3);
    run(['land', 'open', UNIT, '1.3']);
    const both = closeRefused(3);
    run(['land', 'open', UNIT, '1.4']);

    assert.deepStrictEqual([laid, both, closeRefused(4)], [
      held(3, 'holds work of its own that task 1.4 is laid on'), held(3, 'is opened to land, and holds work of its own that task 1.4 is laid on'), held(4, 'is opened to land'),
    ]);
  });

  it('R9: refuses a fix opened to land whose branch holds no commit of its own through the door, naming the reversal', () => {
    dir = world();
    createFix(dir, 3, DOCS, as());
    run(['task', 'start', UNIT, '1.3']);
    createFile(dir, 'docs/flags.md', '--colour\n');
    commitAll(dir, `fix(${UNIT}): spell the docs, by hand`);
    run(['land', 'open', UNIT, '1.3']);

    assert.strictEqual(closeRefused(3), held(3, 'is opened to land'));
  });

  it('refuses a fix whose earlier commit a later fix is laid on though the fix has committed again since, naming the reversal', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    changed(4, MAN, 'docs/man.md');
    run(['task', 'start', UNIT, '1.3']);
    createFile(dir, 'docs/more.md', '--colour\n');
    run(['commit', '--paths', 'docs/more.md', '--task', UNIT, '1.3', '-m', `fix(${UNIT}): spell more docs`]);

    assert.strictEqual(closeRefused(3), held(3, 'holds work of its own that task 1.4 is laid on'));
  });

  it('lands the reversal of a fix opened to land as a fix of its own, its revert asked of the shell guard and committed through the door, the change gone from the branch the fixes land on', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    run(['land', 'open', UNIT, '1.3']);
    const refusal = closeRefused(3);
    run(['task', 'done', UNIT, '1.3']);
    createFix(dir, 4, BACK, as());
    run(['task', 'start', UNIT, '1.4']);
    guardedGit(dir, ['revert', '--no-commit', git(dir, ['rev-parse', branchOf(3, DOCS)]).trim()], as());
    guardedGit(dir, ['revert', '--quit'], as());
    run(['commit', '--paths', 'docs/flags.md', '--task', UNIT, '1.4', '-m', `fix(${UNIT}): put the docs back`]);
    run(['land', 'open', UNIT, '1.4']);
    run(['task', 'done', UNIT, '1.4']);
    for (const n of [1, 2, 3, 4]) record(n);
    checklistClosed(dir, as());
    output(dir, ['render', 'finish', UNIT], as());
    const main = git(dir, ['rev-parse', 'main']).trim();
    run(['finish', 'yes', UNIT]);

    assert.strictEqual(refusal, held(3, 'is opened to land'));
    assert.deepStrictEqual([git(dir, ['log', '--format=%s', `${main}..main`]).trim().split('\n'), git(dir, ['ls-tree', '--name-only', 'main', 'docs']).trim()], [
      [`fix(${UNIT}): ${BACK}`, `fix(${UNIT}): ${DOCS}`, `fix(${UNIT}): ${HELP}`, `fix(${UNIT}): ${FLAG}`], '',
    ]);
  });
});
