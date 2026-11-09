'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose fix a question parks in a
// project with nested repositories (19.5.23, R20): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. A park setting aside what the fix had not committed in
// each repository holding any — the project's, its submodule's and its
// nested clone's — and its next start putting each back
// (leeway-engine/scripts/domain/fix-aside.cjs); the fix's own commits read
// in each repository, the other fix's between them left out, by its pair
// and by its figures, which count their net change: a line changed twice
// once, a file renamed then edited one file (task-base.cjs, `ownWork`;
// task-account.cjs). A move keeping that work:
// test-engine-landing-conformance-quick-fix-nested-move.cjs. A driver's
// side (tests/drivers/{name}/
// landing.cjs) readies each repository; this file names no driver and no
// tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSections, git, createFile, commitCode, withEnv,
} = require('./engine-harness.cjs');
const {
  UNIT, HELP, BRANCH, createFix, fixDone, accountFigures, parkedOn, quickFixNestedConformance,
} = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

/** Where fix 1.1's work is set aside, in each repository holding any. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

/** The project's flags page, long enough that a rename of it reads as one. */
const FLAGS = ['# Flags', '', '--color picks the colour.', '--quiet says less.', '--verbose says more.', '--help shows this page.', '--version names the build.', ''].join('\n');

/** What fix 1.1 had not committed when its question parked it, by its path in the project, one in each repository. */
const UNCOMMITTED = Object.freeze({ 'src/alias.js': 'module.exports = \'color\';\n', 'ext/ext.txt': 'ext --colour\n', 'lib/alias.txt': 'lib --color\n' });

for (const { name } of listDrivers('landing')) {
  const { side, as, project } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-aside-${name}-`);

  /** A call that must succeed. @param {import('./quick-fix-world.cjs').NestedQuickFix} at @param {string[]} args */
  const run = (at, args) => ok(at.dir, args, as());

  /** `files` committed through the door for `task`, from the project. @param {import('./quick-fix-world.cjs').NestedQuickFix} at @param {string} task @param {string[]} files @param {string} subject */
  const committed = (at, task, files, subject) => run(at, ['commit', '--paths', ...files, '--task', UNIT, task, '-m', `fix(${UNIT}): ${subject}`]);

  /** Fix 1.1's work not committed written, one file in each repository, then parked on a question: the raise's answer. @param {import('./quick-fix-world.cjs').NestedQuickFix} at */
  async function parked(at) {
    for (const [file, text] of Object.entries(UNCOMMITTED)) createFile(at.dir, file, text);
    return parkedOn(at.dir, '1.1', as());
  }

  /** What each repository's checkout holds not committed, as git lists it. @param {import('./quick-fix-world.cjs').NestedQuickFix} at */
  const statuses = (at) => [at.dir, at.ext, at.lib].map((dir) => git(dir, ['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=all']).trim());

  describe(`the ${name} landing driver's quick-fix whose fix a question parks, in nested repositories (19.5.23, R20)`, () => {
    it('a park sets aside the fix\'s work not committed in each repository holding any, the next fix built between, and its next start puts each back; its pair reads its own commits in each repository and its figures count their net change, the other fix\'s left out', async () => {
      const at = project();
      createFile(at.dir, 'docs/flags.md', FLAGS);
      commitCode(at.dir, 'the flags page');
      if (side.on(at.dir) !== at.dir) git(at.dir, ['push', '-q', side.on(at.dir), 'main']);
      createFix(at.dir, 1, 'Spell the flags --colour', as());
      run(at, ['task', 'start', UNIT, '1.1']);
      fs.renameSync(path.join(at.dir, 'docs/flags.md'), path.join(at.dir, 'docs/options.md'));
      createFile(at.dir, 'lib/lib.txt', 'lib --color\n');
      committed(at, '1.1', ['docs/flags.md', 'docs/options.md', 'lib/lib.txt'], 'name the flags page options');
      createFile(at.dir, 'docs/options.md', FLAGS.replace('--color picks', '--colour picks'));
      createFile(at.dir, 'lib/lib.txt', 'lib --colour\n');
      committed(at, '1.1', ['docs/options.md', 'lib/lib.txt'], 'spell the flags --colour');
      run(at, ['land', 'open', UNIT, '1.1']);
      const raised = await parked(at);
      const clean = statuses(at);
      createFix(at.dir, 2, HELP, as());
      run(at, ['task', 'start', UNIT, '1.2']);
      createFile(at.dir, 'lib/help.txt', 'help --colour\n');
      committed(at, '1.2', ['lib/help.txt'], 'spell the help --colour');
      run(at, ['land', 'open', UNIT, '1.2']);
      fixDone(at.dir, '1.2', as());
      const { raise } = okSections(at.dir, ['raise', 'draw', UNIT, 'Q1'], as()).res;
      ok(at.dir, ['raise', 'answer', raise, '--pick', '1'], { ...as(), stdin: JSON.stringify({ why: 'Old scripts pass it.' }) });
      const started = run(at, ['task', 'start', UNIT, '1.1']);
      const back = Object.keys(UNCOMMITTED).map((file) => fs.readFileSync(path.join(at.dir, file), 'utf8'));
      const { id } = run(at, ['brief', 'reviewer', UNIT, '1.1', '--letter', 'a']);
      const brief = withEnv({ LEEWAY_CONFIG_DIR: as().env.LEEWAY_CONFIG_DIR }, () => fs.readFileSync(briefPath('sess-1', id), 'utf8'));

      const paths = Object.keys(UNCOMMITTED).sort();
      assert.deepStrictEqual([raised.set_aside, clean, started.put_back.sort(), back], [paths, ['', '', ''], paths, Object.values(UNCOMMITTED)]);
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map((dir) => git(dir, ['for-each-ref', ASIDE]).trim()), ['', '', '']);
      assert.deepStrictEqual(brief.match(/^## In .*$/gm), [`## In the project's repository: its commits on \`${BRANCH}\``, `## In \`lib\`: its commits on \`${BRANCH}\``]);
      assert.ok(!brief.includes('spell the help'), brief);
      assert.deepStrictEqual(accountFigures(at.dir, '1.1', as()), { files: 2, added: 2, removed: 2 }, 'the flags page renamed then edited one file, lib.txt\'s line changed twice once, 1.2\'s help.txt none');
    });
  });
}
