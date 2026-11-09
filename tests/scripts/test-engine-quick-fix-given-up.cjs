'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's fix given up (leeway-engine/scripts/domain/fix-end.cjs;
// task-verbs.cjs; fix-branch.cjs): `task close` taking a fix holding no
// work of its own — given up before its commit — and the door then refusing
// a commit under it, which takes no more work, naming the next fix's start
// and a fix of its own (commit-task.cjs); refused, naming the reversal, for
// a fix holding work of its own — given up after its commit — whether or not
// that commit is in the quick-fix's pull request (R3, R14); the reversal
// landing as a fix of its own whose commit through the door reverts the
// change, every git command asked of the shell guard first, the change gone
// from the branch the fixes land on once the pull request merges. Every
// refusal writes nothing. A fix found met is test-engine-quick-fix-end.cjs's;
// one landed by hand, refused, the end suite's and the landing conformance
// suites'; a recorded fix's record taken out as it closes,
// test-engine-quick-fix-record.cjs's.
//
// Layer: git. World: quick-fix-world.cjs's `twoFixesBuilt` — fixes 1.1 and
// 1.2 on the quick-fix's branch, each built through the local driver and
// done — built once and copied. Each test's conversation keeps its records
// in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, refusedPristine, git, createFile, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, DESCRIPTION, BRANCH, RECORDS, createFix, fixChanged, fixDone, recordFile, twoFixesBuilt, guardedGit, checklistClosed,
} = require('./quick-fix-world.cjs');

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

/** The reversal's way on, as a close's refusal of fix `n` holding work not yet landed names it. @param {number} n */
const held = (n) => `task close: task 1.${n} of ${UNIT} holds work of its own — it lands as it is with ${UNIT}'s pull request, done once it is in it, and its change is given up as a landed change is, `
  + `by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`;

describe('task close <quick-fix> <fix> (R3, R14)', () => {
  it('closes a fix given up before its commit, holding no work of its own; the door then refuses a commit under it, naming the next fix\'s start and a fix of its own — a fix of its own alone where no later fix is unended', () => {
    dir = world();
    createFile(dir, 'docs/late.md', '--colour\n');
    const last = refusedPristine(dir, ['commit', '--paths', 'docs/late.md', '--task', UNIT, '1.2', '-m', `fix(${UNIT}): spell the docs late`], as()).error;
    fs.rmSync(path.join(dir, 'docs/late.md'));
    createFix(dir, 3, DOCS, as());
    run(['task', 'start', UNIT, '1.3']);
    close(3);
    createFix(dir, 4, MAN, as());
    createFile(dir, 'docs/late.md', '--colour\n');
    const late = refusedPristine(dir, ['commit', '--paths', 'docs/late.md', '--task', UNIT, '1.3', '-m', `fix(${UNIT}): spell the docs late`], as()).error;

    assert.deepStrictEqual([status(3), late, last], [
      'closed',
      `commit --task: task 1.3 of ${UNIT} is closed, and a task ended takes no more work — commit it under the fix it is for — start the next with \`engine task start ${UNIT} 1.4\` — `
      + `or make it a task of its own with \`engine task create ${UNIT} 1 --file <task.md>\``,
      `commit --task: task 1.2 of ${UNIT} is done, and a task ended takes no more work — make it a task of its own with \`engine task create ${UNIT} 1 --file <task.md>\``,
    ]);
  });

  it('refuses a fix given up after its commit, naming the reversal — whether or not the commit is in the pull request — writing nothing', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    const committed = closeRefused(3);
    run(['land', 'open', UNIT, '1.3']);

    assert.deepStrictEqual([committed, closeRefused(3)], [held(3), held(3)]);
  });

  it('lands the reversal of a fix as a fix of its own, its revert asked of the shell guard and committed through the door on the one branch, the change gone from the branch the fixes land on once the pull request merges', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    const given = git(dir, ['rev-parse', BRANCH]).trim();
    run(['land', 'open', UNIT, '1.3']);
    const refusal = closeRefused(3);
    fixDone(dir, '1.3', as());
    createFix(dir, 4, BACK, as());
    run(['task', 'start', UNIT, '1.4']);
    guardedGit(dir, ['revert', '--no-commit', given], as());
    guardedGit(dir, ['revert', '--quit'], as());
    run(['commit', '--paths', 'docs/flags.md', '--task', UNIT, '1.4', '-m', `fix(${UNIT}): put the docs back`]);
    run(['land', 'open', UNIT, '1.4']);
    fixDone(dir, '1.4', as());
    for (const n of [1, 2, 3, 4]) record(n);
    checklistClosed(dir, as());
    output(dir, ['render', 'finish', UNIT], as());
    const main = git(dir, ['rev-parse', 'main']).trim();
    run(['finish', 'yes', UNIT]);

    assert.strictEqual(refusal, held(3));
    assert.deepStrictEqual([git(dir, ['log', '--format=%s', `${main}..main`]).trim(), git(dir, ['ls-tree', '--name-only', 'main', 'docs']).trim()], [`fix(${UNIT}): ${DESCRIPTION}`, '']);
  });
});
