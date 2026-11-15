'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix of two commits, the
// second rewriting the line the first wrote, merged by hand mid-set by the
// first way the driver's side merges by hand (7.2.22, R14): its first
// commit landed with it, the next fix starts on the branch cut again,
// nothing left off and no warning. Merged with the set, the review's
// change of it is test-engine-landing-conformance-quick-fix-rewritten-review.cjs's;
// a commit that does not apply, left off,
// test-engine-landing-conformance-quick-fix-left-off.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and merges by hand;
// this file names no driver and no tool. Conformance layer: the quick-fix
// of quick-fix-world.cjs (`quickFixConformance`), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok } = require('./engine-harness.cjs');
const { UNIT, BRANCH, quickFixConformance, createFix, fixRewritten, cutLeftOff } = require('./quick-fix-world.cjs');
const { HELP } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project } = quickFixConformance(name, `engine-landing-quick-fix-rewritten-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, a fix of two commits, the second rewriting the line the first wrote, merged by hand mid-set by ${how}: its first commit landed with it (7.2.22, R14)`, () => {
    it('the next fix starts on the branch cut again, nothing left off and no warning', () => {
      const at = project();
      fixRewritten(at, as());
      merge(at, BRANCH);
      createFix(at, 2, HELP.title, as());

      assert.deepStrictEqual(cutLeftOff(ok(at, ['task', 'start', UNIT, '1.2'], as())), [[], []]);
    });
  });
}
