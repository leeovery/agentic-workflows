'use strict';

// ---------------------------------------------------------------------------
// How a quick-fix's fix opens and is done (leeway-engine/scripts/domain/
// fix-end.cjs; landing.cjs; task-verbs.cjs; fix-branch.cjs): `land open`
// refusing a fix laid on earlier fixes not opened — each holding a commit
// of its own the fix's branch holds — naming each and the lowest one's
// opening, passing over those opened and an earlier fix in flight that
// holds nothing; `task done` taking a fix holding a commit of its own
// through the door that the branch it lands on lacks, opened to land —
// refused otherwise, naming its opening, or its close as met where it holds
// none (R1, R8) — and one whose own commits that branch holds, moved to
// them by hand, read as landed: done, its opening refused naming its done,
// its close naming the reversal, and its done never asked whether its
// branch moved past what its pull request holds, what landed being what
// that branch holds (R11, R12 (b)); and one merged by hand before it ever
// opened, by a squash under the person's own message, its branch then
// deleted, read by its change on that branch, its own commits found where a
// deleted branch leaves them: done (R12 (a), (b)); and one whose own commit
// was cherry-picked onto that branch, its line changed there since, read as
// landed by that commit, which names it: done (R12 (a)). A closed fix's
// opening, the order fixes open in, a fix whose branch moved past its pull
// request and a fix merged by hand, on every driver, are the quick-fix
// landing conformance suites'; a fix given up,
// test-engine-quick-fix-given-up.cjs's. Every refusal writes nothing.
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
const { ok, refusedPristine, git, createFile, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, HELP, createFix, fixChanged, twoFixesBuilt } = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

const DOCS = 'Spell the docs --colour';
const MAN = 'Spell the man page --colour';
const BACK = 'Put the docs back';

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

/** Fix `n` made, as `fixChanged` makes it, in this test's conversation. @param {number} n @param {string} title @param {string} file */
const changed = (n, title, file) => fixChanged(dir, n, title, file, '--colour\n', as());

/** Fix `n`'s status, as the tracker holds it. @param {number} n */
const status = (n) => run(['task', 'show', UNIT, `1.${n}`]).status;

describe('land open <quick-fix> <fix>', () => {
  it('refuses a fix laid on earlier fixes not opened, naming each and the lowest one\'s opening, writing nothing — those opened, passing over them', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    changed(4, MAN, 'docs/man.md');
    changed(5, BACK, 'docs/back.md');
    const refusal = refused(['land', 'open', UNIT, '1.5']);

    assert.strictEqual(refusal, `land: task 1.5 of ${UNIT} is laid on 1.3, 1.4, not opened to land — a fix opens after each fix it is laid on: land open ${UNIT} 1.3`);
  });

  it('opens a fix over an earlier fix in flight that holds no commit of its own, which it is laid on nothing of, onto the fix below that one', () => {
    dir = world();
    createFix(dir, 3, DOCS, as());
    run(['task', 'start', UNIT, '1.3']);
    changed(4, MAN, 'docs/man.md');
    const opened = run(['land', 'open', UNIT, '1.4']);

    assert.deepStrictEqual([status(3), opened.repos.map((/** @type {any} */ { base }) => base)], ['in-progress', [taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'fix', HELP)]]);
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

  it('R11: reads a fix whose own commits the branch it lands on holds, moved to them by hand, as landed — done, its opening refused naming its done, its close naming the reversal', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    git(dir, ['branch', '-f', 'main', taskBranch({ unit: UNIT, phase: 1, n: 3 }, 'fix', DOCS)]);
    const opening = refused(['land', 'open', UNIT, '1.3']);
    const closing = refused(['task', 'close', UNIT, '1.3', '--reason', 'Not wanted.']);
    run(['task', 'done', UNIT, '1.3']);

    assert.deepStrictEqual([opening, closing, status(3)], [
      `land: task 1.3 of ${UNIT} has landed — a fix is done once it lands: task done ${UNIT} 1.3`,
      `task close: task 1.3 of ${UNIT} has landed — so it is done, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`,
      'done',
    ]);
  });

  it('R12: takes a fix landed by hand done though its branch has moved past what its pull request holds — what landed is what the branch it lands on holds', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    run(['land', 'open', UNIT, '1.3']);
    git(dir, ['branch', '-f', 'main', taskBranch({ unit: UNIT, phase: 1, n: 3 }, 'fix', DOCS)]);
    createFile(dir, 'docs/more.md', '--colour\n');
    run(['commit', '--paths', 'docs/more.md', '--task', UNIT, '1.3', '-m', `fix(${UNIT}): spell more docs`]);
    run(['task', 'done', UNIT, '1.3']);

    assert.strictEqual(status(3), 'done');
  });

  it('R12: takes a fix merged by hand before it ever opened, by a squash under the person\'s own message, its branch then deleted, done — read by its change on the branch it lands on, its own commits found where the deleted branch leaves them', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    const branch = taskBranch({ unit: UNIT, phase: 1, n: 3 }, 'fix', DOCS);
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['merge', '-q', '--squash', branch]);
    git(dir, ['commit', '-q', '-m', 'Spell the docs the British way']);
    git(dir, ['branch', '-q', '-D', branch]);
    run(['task', 'done', UNIT, '1.3']);

    assert.strictEqual(status(3), 'done');
  });

  it('R12: takes a fix whose own commit was put on the branch it lands on by a cherry-pick, its line changed there since, done — read as landed by that commit, which names it', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['cherry-pick', taskBranch({ unit: UNIT, phase: 1, n: 3 }, 'fix', DOCS)]);
    createFile(dir, 'docs/flags.md', '--color\n');
    git(dir, ['commit', '-q', '-am', 'Spell the docs the American way']);
    run(['task', 'done', UNIT, '1.3']);

    assert.strictEqual(status(3), 'done');
  });
});
