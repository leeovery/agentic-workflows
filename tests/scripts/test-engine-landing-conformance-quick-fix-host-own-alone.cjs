'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a commit of the person's own
// alone on its branch once every fix has landed by hand (R19): the contract
// every landing driver meets, run through the engine's verbs against each
// shipped driver in turn. Made during the quick-fix, it is the quick-fix's
// work: the close lands it under the quick-fix's title, and, its merge
// refused once, made again reads the branch it pushed as the quick-fix's.
// Kept with a fix's commits and replayed by the next start,
// test-engine-landing-conformance-quick-fix-host-own.cjs's; in a nested
// clone, -nested-read-own's. A driver's side (tests/drivers/{name}/
// landing.cjs) readies the world, merges by hand and reads what landed
// where; this file names no driver and no tool. Conformance layer: the
// quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, readManifest } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, ownCommit, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, record, project, built, landed } = quickFixConformance(name, `engine-landing-quick-fix-host-own-alone-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, a commit of the person's own alone on its branch (R19)`, () => {
    it(`every fix merged by hand by ${how}, then a commit of the person's own alone on its branch: the close, its merge refused once, made again lands it alone under the quick-fix's title, the branch it pushed read as the quick-fix's, and the unit completes`, () => {
      const at = project();
      built(at, 1);
      merge(at, BRANCH);
      ownCommit(at, 'My own change');
      record(at, 1);
      checklistClosed(at, as());
      const { env: refusing, undo } = side.refuseMerge(at);
      refuses(at, ['finish', 'yes', UNIT], { env: { ...as().env, ...refusing } });
      undo();
      ok(at, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual([landed(at).at(-1), readManifest(at, UNIT).status], [[`fix(${UNIT}): ${DESCRIPTION}`, ['mine.txt']], 'completed']);
    });
  });
}
