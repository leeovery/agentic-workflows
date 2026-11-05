'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix (7.2.3, 19.S32, 19.S38): the
// contract every landing driver meets for a quick-fix's set of fixes, run
// through the engine's verbs against each shipped driver in turn. Three
// fixes, built one after another in the project's own checkout, land as a
// chain — each fix's pull request based on the fix before it, carrying
// nothing of it, and the close landing them bottom to top, each under its
// fix's subject with only its own change — the checkout put back on the
// default branch, holding the landing, and summary.md holding each fix's
// record in the order they landed. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. The close itself is
// test-engine-quick-fix-close.cjs's. Conformance layer: the quick-fix of
// quick-fix-world.cjs, its code tagged `landing-base`, built once per driver
// and copied for the test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, git, tip, fixtureFrom, cleanupFixture, readState, writeState, layout } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { own } = require('./landing-world.cjs');
const { UNIT, quickFix, entered, fixBuilt, recordFile } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

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

    it('19.S38: three fixes land as a chain — each pull request based on the fix before it, the close landing them bottom to top, each with only its own change, the checkout back on the default branch and summary.md holding each record in the order they landed', () => {
      const at = world();
      dir = at;
      const as = { env: { ...side.env, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } };
      entered(at, as);
      const bases = FIXES.map(({ title, file, text }, n) => own(fixBuilt(at, n + 1, title, file, text, as)).base);
      FIXES.forEach(({ title }, n) => {
        const record = { changed: `${title}.`, why: 'The flag was spelt the American way.', leaves: 'Nothing.' };
        ok(at, ['quick-fix', 'record', UNIT, `1.${n + 1}`, '--file', recordFile(at, n + 1, record)], as);
      });
      writeState(at, layout.unit(UNIT, 'build', 'log.md'), '# The fixes\n');
      for (const key of ['inbox-closed', 'build-log-closed']) ok(at, ['checklist', 'done', 'finish', UNIT, key], as);
      ok(at, ['checklist', 'close', 'finish', UNIT], as);
      const closed = ok(at, ['finish', 'yes', UNIT], as);

      assert.deepStrictEqual(bases, ['main', BRANCHES[0], BRANCHES[1]]);
      assert.deepStrictEqual([closed.landed.map((/** @type {any} */ { repo, phases }) => [repo, phases.map((/** @type {any} */ { phase }) => phase)]), closed.checkout], [[['.', [1]]], 'main']);
      assert.deepStrictEqual(side.landed(at).map((/** @type {any} */ { subject, paths }) => [subject, paths]), FIXES.map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
      assert.deepStrictEqual([git(at, ['symbolic-ref', '--short', 'HEAD']).trim(), tip(at, 'main')], ['main', side.defaultTip(at)]);
      assert.deepStrictEqual(readState(at, layout.unit(UNIT, 'summary.md')).split('\n').filter((line) => line.startsWith('## ')), FIXES.map(({ title }) => `## ${title}`));
    });
  });
}
