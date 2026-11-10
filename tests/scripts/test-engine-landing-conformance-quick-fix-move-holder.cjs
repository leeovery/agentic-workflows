'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix moved to a feature while the
// fix holding its one checkout has work not committed (19.5.9, R26): the
// contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn. The move's yes sets that work aside
// as a park does (workunit-move.cjs, fix-aside.cjs), so it is never refused
// over it: start this work's screen names it before the yes, with where it
// will be kept and the calls that show it and bring it back; the yes takes
// the checkout back clean and keeps it, set aside as the quick-fix moved —
// in its answer and at the feature's first opening — and its recover brings
// it into the checkout. Work a park set aside, kept by a move, in nested
// repositories: test-engine-landing-conformance-quick-fix-nested-move-kept.cjs.
// A driver's side (tests/drivers/{name}/landing.cjs) readies the world;
// this file names no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixConformance`, built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSections, writeState, layout, sectionOf, createFile, git,
} = require('./engine-harness.cjs');
const { UNIT, FLAG, createFix, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

/** Where fix 1.1's work is set aside. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

/** What fix 1.1 holds not committed as the quick-fix moves: a change to a tracked file, and a file of its own. */
const UNCOMMITTED = Object.freeze({ 'README.md': '# The project, its flag spelt --colour\n', 'src/alias.js': 'module.exports = \'color\';\n' });

/** The calls a piece of the work kept at ASIDE is shown and brought back by. */
const CALLS = `see it with git diff ${ASIDE}^ ${ASIDE}; bring it into the checkout with git cherry-pick --no-commit ${ASIDE}, settling any conflict`;

for (const { name } of listDrivers('landing')) {
  const { as, project } = quickFixConformance(name, `engine-landing-quick-fix-move-holder-${name}-`);

  describe(`the ${name} landing driver's quick-fix moved to a feature while its checkout's holder has work not committed (19.5.9, R26)`, () => {
    it('the move sets the holder\'s work aside as a park does, never refused over it: start this work\'s screen names it before the yes, with where it is kept and its calls; the yes takes the checkout back clean, keeping it set aside as the quick-fix moved — in its answer and at the feature\'s first opening — and its recover brings it back', () => {
      const at = project();
      createFix(at, 1, FLAG, as());
      ok(at, ['task', 'start', UNIT, '1.1'], as());
      for (const [file, text] of Object.entries(UNCOMMITTED)) createFile(at, file, text);
      const brief = writeState(at, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
      const payload = writeState(at, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
      const screen = sectionOf(okSections(at, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload], as()).sections, 'DISPLAY: start this work');
      const { next } = ok(at, ['gate', 'start this work', '--pick', 'y'], as());
      const moved = ok(at, next.argv, as());
      const left = git(at, ['status', '--porcelain', '--untracked-files=all']).trim();
      const opening = okSections(at, ['enter', 'discussion', UNIT], as()).sections.split('\n').filter((line) => line.startsWith('kept work: '));
      git(at, moved.kept_aside[0].recover.split(' ').slice(1));
      const brought = Object.keys(UNCOMMITTED).map((file) => fs.readFileSync(path.join(at, file), 'utf8'));

      assert.deepStrictEqual(screen.replace(/\n {2}/g, ' ').split('\n').filter((line) => line.startsWith('⚑ Task')), [
        `⚑ Task 1.1's work not committed — README.md, src/alias.js — is set aside as the quick-fix moves and kept in the project's repository at ${ASIDE} — ${CALLS.replace('see it with', 'see it then with')}`,
      ]);
      assert.deepStrictEqual([moved.fixes_closed, moved.checkout, left], [['1.1'], 'main', '']);
      assert.deepStrictEqual(moved.kept_aside, [{ task: '1.1', repo: '.', ref: ASIDE, why: 'as the quick-fix moved', see: `git diff ${ASIDE}^ ${ASIDE}`, recover: `git cherry-pick --no-commit ${ASIDE}` }]);
      assert.deepStrictEqual(opening, [`kept work: Task 1.1's work, set aside as the quick-fix moved, is kept in the project's repository at ${ASIDE} — ${CALLS}`]);
      assert.deepStrictEqual(brought, Object.values(UNCOMMITTED));
    });
  });
}
