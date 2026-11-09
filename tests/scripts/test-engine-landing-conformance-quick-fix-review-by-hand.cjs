'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose pull request was merged by
// hand, by the first way the driver's side merges by hand, before its
// review is asked for (7.2.22, 19.5.14): the contract every landing driver
// meets, run through the engine's verbs against each shipped driver in
// turn, the day quick-fix-review-by-hand.cjs's `reviewedEachWay` gives. The
// side's second way is
// test-engine-landing-conformance-quick-fix-review-by-hand-ways.cjs's, its
// others -rest.cjs's; the ways keeping the branch's own commits that those
// lack, -keeping.cjs's. A driver's side (tests/drivers/{name}/landing.cjs)
// readies the world, merges by hand and reads what landed where; this file
// names no driver and no tool. Conformance layer: the quick-fix of
// quick-fix-world.cjs (`quickFixConformance`), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { reviewedEachWay } = require('./quick-fix-review-by-hand.cjs');

for (const { suite, test, run } of reviewedEachWay('engine-landing-quick-fix-review-by-hand-', (side) => Object.entries(side.byHand).slice(0, 1))) {
  describe(suite, () => {
    it(test, run);
  });
}
