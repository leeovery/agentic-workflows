'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a nested clone, moved to a
// feature (19.5.9, R17): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn, the
// clone read as every verb reads the repositories the quick-fix touches. A
// fix landed in the clone by hand, by the first way the driver's side
// merges by hand that keeps the branch's own commits, refuses the move; a
// fix opened there and not landed moves, the yes closing the clone's pull
// request unmerged and keeping its branch under the move's name. A driver's
// side (tests/drivers/{name}/landing.cjs) readies each repository, merges
// by hand and reads what landed where; this file names no driver and no
// tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, okSections, refuses, writeState, layout } = require('./engine-harness.cjs');
const { UNIT, BRANCH, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const LIB = { 'lib/lib.txt': 'lib --colour\n' };

for (const { name } of listDrivers('landing')) {
  const { side, as, project, opened } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-move-${name}-`);
  const [[how, merge]] = Object.entries(side.byHandKeeping);

  /** Claude's payload for the move to a feature, its brief drafted in the cache: the payload's path. @param {string} dir */
  const payload = (dir) => {
    const brief = writeState(dir, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
    return writeState(dir, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
  };

  describe(`the ${name} landing driver's quick-fix in a nested clone, moved to a feature (19.5.9, R17)`, () => {
    it(`a fix landed in the clone by hand by ${how} refuses the move`, () => {
      const at = project();
      opened(at, 1, LIB);
      merge(at.lib, BRANCH, NESTED.lib.into);

      assert.strictEqual(refuses(at.dir, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload(at.dir)], as()).error,
        `${UNIT}'s fix 1.1 has landed — finish the quick-fix, then start the feature as work of its own`);
    });

    it('a fix opened in the clone and not landed moves, the yes closing the clone\'s pull request unmerged and keeping its branch there', () => {
      const at = project();
      opened(at, 1, LIB);
      okSections(at.dir, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload(at.dir)], as());
      const { next } = ok(at.dir, ['gate', 'start this work', '--pick', 'y'], as());
      const moved = ok(at.dir, next.argv, as());

      assert.deepStrictEqual([moved.work_type, moved.pull_request_closed, moved.branches], ['feature', true, [`moved/${BRANCH} in lib`]]);
    });
  });
}
