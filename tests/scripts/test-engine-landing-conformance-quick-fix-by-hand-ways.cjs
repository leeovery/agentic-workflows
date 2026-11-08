'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its pull request merged by hand
// mid-set by each way the driver's side merges by hand past its first (R12,
// R14): the contract every landing driver meets, run through the engine's
// verbs against each shipped driver in turn, each way the day
// quick-fix-by-hand.cjs's `mergedMidSet` runs. The first way is
// test-engine-landing-conformance-quick-fix-by-hand.cjs's; a commit that
// does not apply where the branch is cut again,
// test-engine-landing-conformance-quick-fix-left-off.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { quickFixConformance } = require('./quick-fix-world.cjs');
const { MID_SET, mergedMidSet } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-by-hand-ways-${name}-`);
  for (const [how, merge] of Object.entries(conf.side.byHand).slice(1)) {
    describe(MID_SET.title(name, how), () => {
      it(MID_SET.test, () => mergedMidSet(conf, merge));
    });
  }
}
