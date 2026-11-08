'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its pull request merged by hand
// mid-set, its branch kept (R12, R14): the contract every landing driver
// meets, run through the engine's verbs against each shipped driver in turn,
// by the first way the driver's side merges by hand (quick-fix-by-hand.cjs,
// `mergedMidSet`). A fix the merge landed reads as landed, its opening
// refused as done; a fix in flight across the merge, its commit made after
// it on the branch the merge left, has that commit replayed once the branch
// is cut again from the branch it lands on as the host has it — at its
// opening, which then opens a pull request of its own holding it alone —
// and lands at the close. The side's other ways are
// test-engine-landing-conformance-quick-fix-by-hand-ways.cjs's; a commit
// that does not apply where the branch is cut again,
// test-engine-landing-conformance-quick-fix-left-off.cjs's; the branch
// deleted with the merge, test-engine-landing-conformance-quick-fix-branch-
// gone.cjs's. A driver's side (tests/drivers/{name}/landing.cjs) readies the
// world, merges by hand and reads what landed where; this file names no
// driver and no tool. Conformance layer: the quick-fix of
// quick-fix-world.cjs (`quickFixConformance`), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { quickFixConformance } = require('./quick-fix-world.cjs');
const { MID_SET, mergedMidSet } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-by-hand-${name}-`);
  const [[how, merge]] = Object.entries(conf.side.byHand);

  describe(MID_SET.title(name, how), () => {
    it(MID_SET.test, () => mergedMidSet(conf, merge));
  });
}
