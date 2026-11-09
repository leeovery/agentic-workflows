'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose fix a question parks in a
// project with nested repositories (19.5.23, R20, R26): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. A park setting aside what the fix had not committed in
// each repository holding any — the project's, its submodule's and its
// nested clone's — and its next start putting each back
// (leeway-engine/scripts/domain/fix-aside.cjs); the fix's own commits read
// in each repository, the other fix's between them left out, by its pair
// and by its figures, which count their net change: a line changed twice
// once, a file renamed then edited one file (task-base.cjs, `ownWork`;
// task-account.cjs); and a move to a feature keeping each fix's work set
// aside in every repository, never dropped, its answer naming each with
// the call that shows it. A driver's side (tests/drivers/{name}/
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
  ok, okSections, okSectionsAsync, git, createFile, commitCode, writeState, readState, layout, withEnv,
} = require('./engine-harness.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, HELP, BRANCH, createFix, fixDone, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { roundReportPath } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { accountPath, figuresPath } = require(path.join(SCRIPTS, 'domain/task-account.cjs'));
const { REVIEWER_LETTERS } = require(path.join(SCRIPTS, 'kernel/reviewers.cjs'));
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

/** Where fix 1.1's work is set aside, in each repository holding any. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

/** The builder's question, as a raise puts it. */
const CALL = Object.freeze({
  question: 'Should --color still work?',
  rows: [
    { key: '1', name: 'Alias', text: 'Keep --color as an alias', notice: 'old scripts keep working' },
    { key: '2', name: 'Gone', text: 'Drop --color', notice: 'old scripts fail on the flag' },
  ],
  lean: '1',
  why: 'Scripts in the wild pass --color.',
  sort: 'several',
  mechanism: 'The flag parser maps --color onto --colour.',
  product_wide: false,
});

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

  /** Fix 1.1 started and its work not committed written, one file in each repository, then parked on a question: the raise's answer. @param {import('./quick-fix-world.cjs').NestedQuickFix} at */
  async function parked(at) {
    for (const [file, text] of Object.entries(UNCOMMITTED)) createFile(at.dir, file, text);
    const asked = ledgerHelpers(() => at.dir).write('ask', PLACE, [], { ...MADE, text: 'Does --color still work?' }).id;
    return (await okSectionsAsync(at.dir, ['raise', PLACE, '--answers', asked, '--parks', '1.1'], { ...as(), stdin: JSON.stringify(CALL) })).res;
  }

  /** What each repository's checkout holds not committed, as git lists it. @param {import('./quick-fix-world.cjs').NestedQuickFix} at */
  const statuses = (at) => [at.dir, at.ext, at.lib].map((dir) => git(dir, ['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=all']).trim());

  /** Task 1.1's account written and taken through the engine, both of its round's reports passing: the figures it took. @param {import('./quick-fix-world.cjs').NestedQuickFix} at */
  function accounted(at) {
    const ref = { unit: UNIT, phase: 1, n: 1 };
    for (const letter of REVIEWER_LETTERS) writeState(at.dir, roundReportPath(ref, 1, letter), '## Findings\n\nNone.\n\nVerdict: pass\n');
    writeState(at.dir, accountPath(ref), ['## What was done', 'Built.', '## Where in the code', '- docs/options.md', '## What the tests prove', '- Read by its pair.', '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.', ''].join('\n\n'));
    run(at, ['task', 'account', UNIT, '1.1']);
    const { files, added, removed } = JSON.parse(readState(at.dir, figuresPath(ref)));
    return { files, added, removed };
  }

  describe(`the ${name} landing driver's quick-fix whose fix a question parks, in nested repositories (19.5.23, R20, R26)`, () => {
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
      assert.deepStrictEqual(accounted(at), { files: 2, added: 2, removed: 2 }, 'the flags page renamed then edited one file, lib.txt\'s line changed twice once, 1.2\'s help.txt none');
    });

    it('R26: a move to a feature keeps each fix\'s work set aside in every repository holding it, never dropped, its answer naming each with the call that shows it', async () => {
      const at = project();
      createFix(at.dir, 1, 'Spell the flags --colour', as());
      run(at, ['task', 'start', UNIT, '1.1']);
      createFile(at.dir, 'lib/lib.txt', 'lib --colour\n');
      committed(at, '1.1', ['lib/lib.txt'], 'spell the lib --colour');
      await parked(at);
      const brief = writeState(at.dir, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
      const payload = writeState(at.dir, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
      okSections(at.dir, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload], as());
      const { next } = run(at, ['gate', 'start this work', '--pick', 'y']);
      const moved = run(at, next.argv);

      assert.deepStrictEqual(moved.kept_aside, [
        { task: '1.1', repo: '.', ref: ASIDE, see: `git diff ${ASIDE}^ ${ASIDE}` },
        { task: '1.1', repo: 'ext', ref: ASIDE, see: `git -C ext diff ${ASIDE}^ ${ASIDE}` },
        { task: '1.1', repo: 'lib', ref: ASIDE, see: `git -C lib diff ${ASIDE}^ ${ASIDE}` },
      ]);
      assert.deepStrictEqual([[at.dir, 'src/alias.js'], [at.ext, 'ext.txt'], [at.lib, 'alias.txt']].map(([dir, file]) => git(dir, ['show', `${ASIDE}:${file}`])), Object.values(UNCOMMITTED));
    });
  });
}
