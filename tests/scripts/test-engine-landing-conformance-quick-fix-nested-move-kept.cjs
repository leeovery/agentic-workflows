'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in nested repositories, moved
// to a feature with a fix's work a question's park set aside (19.5.9, R26):
// the contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn. The move keeps that work in every
// repository holding it, never dropped (fix-aside.cjs, `keptAside`): each
// piece named on start this work's screen before the yes, in its answer and
// at the feature's first opening, with the calls that show it and bring it
// into the checkout where the move leaves it, which bring it there. The
// move itself in nested repositories:
// test-engine-landing-conformance-quick-fix-nested-move.cjs. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository; this file
// names no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSections, writeState, layout, sectionOf, createFile, git,
} = require('./engine-harness.cjs');
const {
  UNIT, FLAG, createFix, parkedOn, quickFixNestedConformance,
} = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

/** Where fix 1.1's work is set aside, in each repository holding any. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

/** What fix 1.1 had not committed when its question parked it, by its path in the project, one in each repository. */
const UNCOMMITTED = Object.freeze({ 'src/alias.js': 'module.exports = \'color\';\n', 'ext/ext.txt': 'ext --colour\n', 'lib/alias.txt': 'lib --color\n' });

/** Fix 1.1's work kept in a repository, as the person reads it: `where` it is, and the git call `gitIn` it. @param {string} where @param {string} gitIn */
const keptWords = (where, gitIn) => `Task 1.1's work, set aside when a question parked it, is kept in ${where} at ${ASIDE} — see it with ${gitIn} diff ${ASIDE}^ ${ASIDE}; bring it into the checkout with ${gitIn} cherry-pick --no-commit ${ASIDE}, settling any conflict`;

for (const { name } of listDrivers('landing')) {
  const { as, project } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-move-kept-${name}-`);

  /** Claude's payload for the move to a feature, its brief drafted in the cache: the payload's path. @param {string} dir */
  const payload = (dir) => {
    const brief = writeState(dir, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
    return writeState(dir, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
  };

  describe(`the ${name} landing driver's quick-fix in nested repositories, moved to a feature with a fix's work set aside (19.5.9, R26)`, () => {
    it('R26: the move keeps each fix\'s work set aside in every repository holding it, never dropped, naming each — on start this work\'s screen before the yes, in its answer and at the feature\'s first opening — with the calls that show it and bring it into the checkout where the move leaves it, which bring it there', async () => {
      const at = project();
      createFix(at.dir, 1, FLAG, as());
      ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      createFile(at.dir, 'lib/lib.txt', 'lib --colour\n');
      ok(at.dir, ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the lib --colour`], as());
      for (const [file, text] of Object.entries(UNCOMMITTED)) createFile(at.dir, file, text);
      await parkedOn(at.dir, '1.1', as());
      const screen = sectionOf(okSections(at.dir, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload(at.dir)], as()).sections, 'DISPLAY: start this work');
      const { next } = ok(at.dir, ['gate', 'start this work', '--pick', 'y'], as());
      const moved = ok(at.dir, next.argv, as());
      const opening = okSections(at.dir, ['enter', 'discussion', UNIT], as()).sections.split('\n').filter((line) => line.startsWith('kept work: '));
      for (const { recover } of moved.kept_aside) git(at.dir, recover.split(' ').slice(1));
      const brought = Object.keys(UNCOMMITTED).map((file) => fs.readFileSync(path.join(at.dir, file), 'utf8'));

      const words = [keptWords('the project\'s repository', 'git'), keptWords('ext', 'git -C ext'), keptWords('lib', 'git -C lib')];
      assert.deepStrictEqual(moved.kept_aside.map(({ task, repo, ref }) => [task, repo, ref]), [['1.1', '.', ASIDE], ['1.1', 'ext', ASIDE], ['1.1', 'lib', ASIDE]]);
      assert.deepStrictEqual([screen.replace(/\n {2}/g, ' ').split('\n').filter((line) => line.startsWith('⚑ Task')), opening], [words.map((line) => `⚑ ${line}`), words.map((line) => `kept work: ${line}`)]);
      assert.deepStrictEqual([brought, git(at.dir, ['symbolic-ref', '--short', 'HEAD']).trim()], [Object.values(UNCOMMITTED), 'main']);
    });
  });
}
