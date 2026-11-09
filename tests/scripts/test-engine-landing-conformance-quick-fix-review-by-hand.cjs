'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose pull request was merged by
// hand, by the first way the driver's side merges by hand, before its
// review is asked for (7.2.22, 19.5.14), the day whole — its first read,
// then round 1's fix task built and round 2's read: the contract every
// landing driver meets, run through the engine's verbs against each
// shipped driver in turn, the cases quick-fix-review-by-hand.cjs's
// `reviewedEachWay` gives. The side's other ways' first reads are
// test-engine-landing-conformance-quick-fix-review-by-hand-ways.cjs's; the
// ways keeping the branch's own commits that those lack, -keeping.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies the world,
// merges by hand and reads what landed where; this file names no driver
// and no tool. Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { reviewedEachWay } = require('./quick-fix-review-by-hand.cjs');

for (const { suite, test, run } of reviewedEachWay('engine-landing-quick-fix-review-by-hand-', (side) => Object.entries(side.byHand).slice(0, 1), true)) {
  describe(suite, () => {
    it(test, run);
  });
}
