'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix (7.2.3, 19.S32, 19.S38): the
// contract every landing driver meets for a quick-fix's set of fixes, run
// through the engine's verbs against each shipped driver in turn. Three
// fixes, built one after another in the project's own checkout, land as a
// chain — each fix's pull request based on the fix before it, carrying
// nothing of it, and the close landing them bottom to top, each under its
// fix's subject with only its own change — the checkout put back on the
// default branch, holding the landing. A fix opens only after each fix it
// is laid on, and is done only once its own pull request holds its branch
// as it stands, on every driver alike: `task done` refuses a fix not
// opened, naming its opening, and `land open` a fix laid on one not opened,
// naming that one's — so no pull request carries a fix below it — and,
// opened in turn, each lands with only its own change; `task done` refuses
// a fix whose branch moved past its pull request, naming the driver's way
// back — the branch kept, put back where it opened, the change past it a
// task of its own — and, that followed, every git command asked of the
// shell guard, the fix is done and the change past its opening never lands.
// A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. The close itself is
// test-engine-quick-fix-close.cjs's, how a fix ends
// test-engine-quick-fix-end.cjs's. Conformance layer: the quick-fix of
// quick-fix-world.cjs, its code tagged `landing-base`, built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { own, commandsOf, way, moveStep, short } = require('./landing-world.cjs');
const { UNIT, quickFix, entered, fixChanged, fixBuilt, recordFile, guardedGit, checklistClosed } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const { ok, git, tip, createFile, fixtureFrom, cleanupFixture } = harness;

/** @typedef {import('./landing-world.cjs').DriverSide} DriverSide */

const FIXES = Object.freeze([
  { title: 'Spell the flag --colour', file: 'src/flag.js', text: 'const flag = \'colour\';\n' },
  { title: 'Spell the help --colour', file: 'src/help.js', text: 'const help = \'--colour\';\n' },
  { title: 'Spell the docs --colour', file: 'docs/flags.md', text: '# Flags\n\n--colour\n' },
]);
const BRANCHES = FIXES.map(({ title }, at) => taskBranch({ unit: UNIT, phase: 1, n: at + 1 }, 'fix', title));

const config = useTempFolder('landing-quick-fix-config-');

for (const { name } of listDrivers('landing')) {
  /** @type {DriverSide} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const world = fixtureFrom(`engine-landing-quick-fix-${name}-`, (dir) => {
    quickFix(dir);
    git(dir, ['tag', 'landing-base']);
    side.prepare(dir);
  });

  describe(`the ${name} landing driver's quick-fix (7.2.3, 19.S32)`, () => {
    /** @type {string|null} */
    let dir = null;
    afterEach(() => {
      if (dir !== null) cleanupFixture(dir);
      dir = null;
    });

    /** The calls' options: the driver's environment, in this test's conversation. */
    const as = () => ({ env: { ...side.env, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

    /** A copy of the world, the quick-fix entered by this test's conversation. */
    function project() {
      dir = world();
      entered(dir, as());
      return dir;
    }

    /** Fix `n`'s record written. @param {string} at @param {number} n */
    const record = (at, n) => ok(at, ['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(at, n, { changed: `${FIXES[n - 1].title}.`, why: 'It was spelt the American way.', leaves: 'Nothing.' })], as());

    /** What the default branch gained, each landing by its subject and the paths it changed. @param {string} at */
    const landed = (at) => side.landed(at).map((/** @type {any} */ { subject, paths }) => [subject, paths]);

    /** Fix `n` made, as `fixChanged` makes it. @param {string} at @param {number} n */
    const changed = (at, n) => fixChanged(at, n, FIXES[n - 1].title, FIXES[n - 1].file, FIXES[n - 1].text, as());

    /** Fixes 1.1 and 1.2 recorded and closed, the close landing them. @param {string} at */
    function closed(at) {
      record(at, 1);
      record(at, 2);
      checklistClosed(at, as());
      ok(at, ['finish', 'yes', UNIT], as());
    }

    it('19.S38: three fixes land as a chain — each pull request based on the fix before it, the close landing them bottom to top, each with only its own change, the checkout back on the default branch', () => {
      const at = project();
      const bases = FIXES.map(({ title, file, text }, n) => own(fixBuilt(at, n + 1, title, file, text, as())).base);
      FIXES.forEach((_, n) => record(at, n + 1));
      checklistClosed(at, as());
      const closed = ok(at, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual(bases, ['main', BRANCHES[0], BRANCHES[1]]);
      assert.deepStrictEqual([closed.landed.map((/** @type {any} */ { repo, phases }) => [repo, phases.map((/** @type {any} */ { phase }) => phase)]), closed.checkout], [[['.', [1]]], 'main']);
      assert.deepStrictEqual(landed(at), FIXES.map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
      assert.deepStrictEqual([git(at, ['symbolic-ref', '--short', 'HEAD']).trim(), tip(at, 'main')], ['main', side.defaultTip(at)]);
    });

    it('refuses a fix done before it is opened, and the opening of a fix laid on one not opened, each naming the opening owed, so no pull request carries a fix below it; opened in turn, each lands with only its own change', () => {
      const at = project();
      changed(at, 1);
      const unopened = harness.refuses(at, ['task', 'done', UNIT, '1.1'], as()).error;
      changed(at, 2);
      const laid = harness.refuses(at, ['land', 'open', UNIT, '1.2'], as()).error;
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      const { base } = own(ok(at, ['land', 'open', UNIT, '1.2'], as()));
      ok(at, ['task', 'done', UNIT, '1.2'], as());
      closed(at);

      assert.deepStrictEqual([unopened, laid, base], [
        `task done: task 1.1 of ${UNIT} is not opened to land as its branch stands — a fix is done once it lands: land open ${UNIT} 1.1`,
        `land: task 1.2 of ${UNIT} is laid on 1.1, not opened to land — a fix opens after each fix it is laid on: land open ${UNIT} 1.1`,
        BRANCHES[0],
      ]);
      assert.deepStrictEqual(landed(at), FIXES.slice(0, 2).map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
    });

    it('refuses a fix done while its branch has moved past what its pull request holds, naming the way back — the branch kept, put back where it opened, the change past it a task of its own; followed through the shell guard, the fix is done, and the change past its opening never lands', () => {
      const at = project();
      changed(at, 1);
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      const opened = short(tip(at, BRANCHES[0]));
      createFile(at, 'src/more.js', 'more\n');
      ok(at, ['commit', '--paths', 'src/more.js', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): more`], as());
      const now = short(tip(at, BRANCHES[0]));
      const moved = harness.refuses(at, ['task', 'done', UNIT, '1.1'], as()).error;
      const back = way(at, { here: true, path: at }, BRANCHES[0], moveStep(BRANCHES[0], opened, `put ${BRANCHES[0]} back`), {
        then: 'mark it done again', note: (kept) => `the change from ${opened} to ${now}, on ${kept}, is a task of its own`,
      });
      for (const command of commandsOf(moved)) guardedGit(at, command.split(' ').slice(1), as());
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      fixBuilt(at, 2, FIXES[1].title, FIXES[1].file, FIXES[1].text, as());
      closed(at);

      assert.strictEqual(moved, `task done: task 1.1's branch ${BRANCHES[0]} has moved since it was opened at ${opened}, to ${now} — ${back}`);
      assert.deepStrictEqual(landed(at), FIXES.slice(0, 2).map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
    });
  });
}
