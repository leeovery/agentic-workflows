'use strict';

// ---------------------------------------------------------------------------
// How a quick-fix's fix opens and ends (leeway-engine/scripts/domain/
// fix-end.cjs; landing.cjs; task-verbs.cjs; fix-branch.cjs;
// quick-fix-record.cjs): `land open` refusing a fix laid on earlier fixes
// not opened, naming each and the lowest one's opening, passing over those
// opened; `task done` taking a fix holding a commit of its own past the
// branch it is laid on, opened to land — refused otherwise, naming its
// opening, or its close as met where it holds none (R1), and one whose
// branch moved past its pull request on every driver in the landing
// conformance suite's quick-fix; `task close` taking a fix
// holding no work of its own, even one a later fix is laid on — that fix
// then opening onto the fix below, past the one closed (R4) — and one
// holding work neither opened to land nor laid on by a later fix not
// closed, the fix after it laid on the fix below and none of its work
// landing; refused otherwise, naming the reversal, which lands as a fix of
// its own whose commit through the door reverts the change, every git
// command asked of the shell guard first (R3); and a recorded fix closed
// having its record taken out of `summary.md` and the fixes recorded, in
// the close's own commit, the file gone with its last record and the
// knowledge base brought in line (R3). Every refusal writes nothing.
//
// Layer: git. World: quick-fix-world.cjs's `twoFixesBuilt` — fixes 1.1 and
// 1.2, 1.2 laid on 1.1, each built through the local driver and done —
// built once and copied. Each test's conversation keeps its records in a
// config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  ok, output, refusedPristine, git, stateGit, statePath, layout, readState, readManifest, createFile, fixtureFrom, cleanupFixture, keywordOnlyKnowledge, touched,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, FLAG, HELP, RECORDS, createFix, fixChanged, fixBuilt, recordFile, twoFixesBuilt, summaryChunks, guardedGit, checklistClosed,
} = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { chosenDriver } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));

const DOCS = 'Spell the docs --colour';
const MAN = 'Spell the man page --colour';
const BACK = 'Put the docs back';
const RECORD = Object.freeze({ changed: 'A change.', why: 'A reason.', leaves: 'Nothing.' });

const world = fixtureFrom('quick-fix-end-', twoFixesBuilt);

let dir = ''; // the project
const config = useTempFolder('quick-fix-end-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options. */
const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, as());

/** A call's refusal, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, as()).error;

/** Fix `n`'s branch. @param {number} n @param {string} title */
const branchOf = (n, title) => taskBranch({ unit: UNIT, phase: 1, n }, 'fix', title);

/** Fix `n` made, as `fixChanged` makes it, in this test's conversation. @param {number} n @param {string} title @param {string} file */
const changed = (n, title, file) => fixChanged(dir, n, title, file, '--colour\n', as());

/** Fix `n`'s record written through the verb. @param {number} n */
const record = (n) => run(['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, RECORDS[n] ?? RECORD)]);

/** Fix `n` closed with a reason. @param {number} n */
const close = (n) => run(['task', 'close', UNIT, `1.${n}`, '--reason', 'Not wanted.']);

/** Fix `n`'s close refused, as the refusal reads. @param {number} n */
const closeRefused = (n) => refused(['task', 'close', UNIT, `1.${n}`, '--reason', 'Not wanted.']);

/** Fix `n`'s status, as the tracker holds it. @param {number} n */
const status = (n) => run(['task', 'show', UNIT, `1.${n}`]).status;

/** The reversal's way on, as a close's refusal names it, after why the fix lands as it is. @param {number} n @param {string} why */
const held = (n, why) => `task close: task 1.${n} of ${UNIT} holds work of its own, and ${why} — so it lands as it is, done once it lands, and its change is given up as a landed change is, `
  + `by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`;

/** The records' headings in `summary.md`, in order. */
const headings = () => readState(dir, layout.unit(UNIT, 'summary.md')).split('\n').filter((line) => line.startsWith('## '));

describe('land open <quick-fix> <fix>', () => {
  it('refuses a fix laid on earlier fixes not opened, naming each and the lowest one\'s opening, writing nothing — those opened, passing over them', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    changed(4, MAN, 'docs/man.md');
    changed(5, BACK, 'docs/back.md');
    const refusal = refused(['land', 'open', UNIT, '1.5']);

    assert.strictEqual(refusal, `land: task 1.5 of ${UNIT} is laid on 1.3, 1.4, not opened to land — a fix opens after each fix it is laid on: land open ${UNIT} 1.3`);
  });
});

describe('task done <quick-fix> <fix> (R1)', () => {
  it('refuses a fix not opened to land, naming its opening, and one holding no commit of its own, naming its close as met — which closes it; opened, the fix is done', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    const unopened = refused(['task', 'done', UNIT, '1.3']);
    run(['land', 'open', UNIT, '1.3']);
    run(['task', 'done', UNIT, '1.3']);
    createFix(dir, 4, MAN, as());
    run(['task', 'start', UNIT, '1.4']);
    const empty = refused(['task', 'done', UNIT, '1.4']);
    run(['task', 'close', UNIT, '1.4', '--reason', 'The docs fix met it.']);

    assert.deepStrictEqual([unopened, empty, status(3), status(4)], [
      `task done: task 1.3 of ${UNIT} is not opened to land as its branch stands — a fix is done once it lands: land open ${UNIT} 1.3`,
      `task done: task 1.4 of ${UNIT} holds no commit of its own — a fix met already, or with nothing to change, is closed as met: task close ${UNIT} 1.4 --reason <why>`,
      'done', 'closed',
    ]);
  });
});

describe('task close <quick-fix> <fix> (R3, R4)', () => {
  it('R4: closes a fix holding no work of its own though a later fix is laid on it, that fix then opening onto the fix below it', () => {
    dir = world();
    createFix(dir, 3, DOCS, as());
    run(['task', 'start', UNIT, '1.3']);
    changed(4, MAN, 'docs/man.md');
    close(3);
    const opened = run(['land', 'open', UNIT, '1.4']);

    assert.deepStrictEqual([status(3), opened.repos.map((/** @type {any} */ { base }) => base)], ['closed', [branchOf(2, HELP)]]);
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
      held(3, 'task 1.4 is laid on it'), held(3, 'it is opened to land, and task 1.4 is laid on it'), held(4, 'it is opened to land'),
    ]);
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

    assert.strictEqual(refusal, held(3, 'it is opened to land'));
    assert.deepStrictEqual([git(dir, ['log', '--format=%s', `${main}..main`]).trim().split('\n'), git(dir, ['ls-tree', '--name-only', 'main', 'docs']).trim()], [
      [`fix(${UNIT}): ${BACK}`, `fix(${UNIT}): ${DOCS}`, `fix(${UNIT}): ${HELP}`, `fix(${UNIT}): ${FLAG}`], '',
    ]);
  });

  it('closes a fix holding work of its own neither opened to land nor laid on; the fix after it laid on the fix below it, the close lands none of the closed fix\'s work', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    close(3);
    const { base } = fixBuilt(dir, 4, MAN, 'docs/man.md', '--colour\n', as()).repos[0];
    for (const n of [1, 2, 4]) record(n);
    checklistClosed(dir, as());
    const main = git(dir, ['rev-parse', 'main']).trim();
    run(['finish', 'yes', UNIT]);

    assert.deepStrictEqual([base, git(dir, ['log', '--format=%s', `${main}..main`]).trim().split('\n'), git(dir, ['ls-tree', '-r', '--name-only', 'main', 'docs']).trim()], [
      branchOf(2, HELP), [`fix(${UNIT}): ${MAN}`, `fix(${UNIT}): ${HELP}`, `fix(${UNIT}): ${FLAG}`], 'docs/man.md',
    ]);
  });
});

describe('a recorded fix closed (R3)', () => {
  it('takes its record out of summary.md and the fixes recorded, where it stands among them, in the close\'s own commit, the knowledge base in line', () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    record(1);
    createFix(dir, 3, DOCS, as());
    createFix(dir, 4, MAN, as());
    for (const [n, file] of /** @type {const} */ ([[4, 'docs/man.md'], [3, 'docs/flags.md']])) {
      run(['task', 'start', UNIT, `1.${n}`]);
      createFile(dir, file, '--colour\n');
      run(['commit', '--paths', file, '--task', UNIT, `1.${n}`, '-m', `fix(${UNIT}): fix ${n}`]);
      record(n);
    }
    const before = headings();
    const res = close(3);

    assert.deepStrictEqual([before, headings(), readManifest(dir, UNIT).fixes.recorded, summaryChunks(dir), res.warnings], [
      [`## ${FLAG}`, `## ${DOCS}`, `## ${MAN}`], [`## ${FLAG}`, `## ${MAN}`], [`${UNIT}-1-1`, `${UNIT}-1-4`], [FLAG, MAN], undefined,
    ]);
    assert.deepStrictEqual([stateGit(dir, ['log', '-1', '--format=%s']).trim(), touched(statePath(dir), 'HEAD')], [
      `task(${UNIT}): close 1.3`,
      [...chosenDriver(dir, 'task').driver.storeFiles().map((file) => `M\t${file}`), `M\t${layout.manifest(UNIT)}`, `M\t${layout.unit(UNIT, 'summary.md')}`].sort(),
    ]);
  });

  it('removes summary.md with its last record, a later fix laid on the fix closed first, the knowledge base left holding none of it', () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    changed(3, DOCS, 'docs/flags.md');
    record(3);
    changed(4, MAN, 'docs/man.md');
    record(4);
    close(4);
    close(3);

    assert.deepStrictEqual([readManifest(dir, UNIT).fixes.recorded, summaryChunks(dir)], [[], []]);
    assert.ok(touched(statePath(dir), 'HEAD').includes(`D\t${layout.unit(UNIT, 'summary.md')}`), 'the close\'s commit removes summary.md');
  });
});
