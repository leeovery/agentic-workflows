'use strict';

// ---------------------------------------------------------------------------
// How a quick-fix's fix opens and is done (leeway-engine/scripts/domain/
// fix-end.cjs; landing.cjs; task-verbs.cjs; fix-branch.cjs): `land open`
// refusing a fix closed, which lands nothing; `task done` taking a fix
// committed and in the quick-fix's one pull request — its newest commit of
// its own through the door there — refused where it holds no commit of its
// own, naming its close as met, which closes it, and where its newest commit
// is not in the pull request, never opened or committed again since, naming
// `land open`, which pushes it (R1, R14); and a fix landed by hand read by
// its newest commit on the branch it lands on: one whose commits that branch
// holds, moved to them by hand, done, its opening refused naming its done,
// its close naming the reversal (R11); one committed again since, refused
// until that commit is in the pull request (R14); one merged by a squash
// under the person's own message before it ever opened, its branch then
// deleted, read by its change there, its commit found where the deleted
// branch leaves it (R12 (b)); and one whose commit was cherry-picked there,
// its line changed since, read by the copy there (R12 (a)). The pull
// request merged by hand on every driver is the quick-fix landing
// conformance suites'; a fix given up, test-engine-quick-fix-given-up.cjs's.
// Every refusal writes nothing.
//
// Layer: git. World: quick-fix-world.cjs's `twoFixesBuilt` — fixes 1.1 and
// 1.2 on the quick-fix's branch, each built through the local driver and
// done — built once and copied. Each test's conversation keeps its records
// in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const { ok, refusedPristine, git, createFile, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, BRANCH, createFix, fixChanged, twoFixesBuilt } = require('./quick-fix-world.cjs');

const DOCS = 'Spell the docs --colour';
const MAN = 'Spell the man page --colour';

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

/** Another commit of fix `n`'s through the door. @param {number} n @param {string} file */
const again = (n, file) => {
  createFile(dir, file, '--colour\n');
  run(['commit', '--paths', file, '--task', UNIT, `1.${n}`, '-m', `fix(${UNIT}): spell ${file}`]);
};

/** Fix `n`'s status, as the tracker holds it. @param {number} n */
const status = (n) => run(['task', 'show', UNIT, `1.${n}`]).status;

/** Done's refusal of fix `n` whose newest commit is not in the pull request. @param {number} n */
const unpushed = (n) => `task done: task 1.${n} of ${UNIT}'s newest commit is not in ${UNIT}'s pull request — a task is done once it is committed and in it: land open ${UNIT} 1.${n} pushes it`;

describe('land open <quick-fix> <fix>', () => {
  it('refuses a fix closed, which lands nothing, writing nothing', () => {
    dir = world();
    createFix(dir, 3, DOCS, as());
    run(['task', 'close', UNIT, '1.3', '--reason', 'Met already.']);

    assert.strictEqual(refused(['land', 'open', UNIT, '1.3']), `land: task 1.3 of ${UNIT} is closed — a fix closed lands nothing`);
  });
});

describe('task done <quick-fix> <fix> (R1, R14)', () => {
  it('refuses a fix whose newest commit is not in the pull request, naming land open, which pushes it — and again once it is committed after its opening — and one holding no commit of its own, naming its close as met, which closes it; pushed, the fix is done', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    const unopened = refused(['task', 'done', UNIT, '1.3']);
    run(['land', 'open', UNIT, '1.3']);
    again(3, 'docs/more.md');
    const moved = refused(['task', 'done', UNIT, '1.3']);
    run(['land', 'open', UNIT, '1.3']);
    run(['task', 'done', UNIT, '1.3']);
    createFix(dir, 4, MAN, as());
    run(['task', 'start', UNIT, '1.4']);
    const empty = refused(['task', 'done', UNIT, '1.4']);
    run(['task', 'close', UNIT, '1.4', '--reason', 'The docs fix met it.']);

    assert.deepStrictEqual([unopened, moved, empty, status(3), status(4)], [
      unpushed(3), unpushed(3),
      `task done: task 1.4 of ${UNIT} holds no commit of its own — a fix met already, or with nothing to change, is closed as met: task close ${UNIT} 1.4 --reason <why>`,
      'done', 'closed',
    ]);
  });

  it('R11: reads a fix whose commits the branch it lands on holds, moved to them by hand, as landed — done, its opening refused naming its done, its close naming the reversal', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    git(dir, ['branch', '-f', 'main', BRANCH]);
    const opening = refused(['land', 'open', UNIT, '1.3']);
    const closing = refused(['task', 'close', UNIT, '1.3', '--reason', 'Not wanted.']);
    run(['task', 'done', UNIT, '1.3']);

    assert.deepStrictEqual([opening, closing, status(3)], [
      `land: task 1.3 of ${UNIT} has landed — a fix is done once it lands: task done ${UNIT} 1.3`,
      `task close: task 1.3 of ${UNIT} holds work of its own — it has landed, so it is done, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`,
      'done',
    ]);
  });

  it('R14: refuses a fix landed by hand, then committed again, until its newest commit is in the pull request — what is done is its newest commit, landed or in it', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    run(['land', 'open', UNIT, '1.3']);
    git(dir, ['branch', '-f', 'main', BRANCH]);
    again(3, 'docs/more.md');
    const moved = refused(['task', 'done', UNIT, '1.3']);
    run(['land', 'open', UNIT, '1.3']);
    run(['task', 'done', UNIT, '1.3']);

    assert.deepStrictEqual([moved, status(3)], [unpushed(3), 'done']);
  });

  it('R12: takes a fix merged by hand before it ever opened, by a squash under the person\'s own message, its branch then deleted, done — read by its change on the branch it lands on, its own commit found where the deleted branch leaves it', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['merge', '-q', '--squash', BRANCH]);
    git(dir, ['commit', '-q', '-m', 'Spell the docs the British way']);
    git(dir, ['branch', '-q', '-D', BRANCH]);
    run(['task', 'done', UNIT, '1.3']);

    assert.strictEqual(status(3), 'done');
  });

  it('R12: takes a fix whose own commit was put on the branch it lands on by a cherry-pick, its line changed there since, done — read by the copy there', () => {
    dir = world();
    changed(3, DOCS, 'docs/flags.md');
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['cherry-pick', BRANCH]);
    createFile(dir, 'docs/flags.md', '--color\n');
    git(dir, ['commit', '-q', '-am', 'Spell the docs the American way']);
    run(['task', 'done', UNIT, '1.3']);

    assert.strictEqual(status(3), 'done');
  });
});
