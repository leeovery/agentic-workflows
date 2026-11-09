'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its pull request in a nested
// clone squashed by hand, by the first way the driver's side merges by
// hand, before a fix is done and after (R17): the contract every landing
// driver meets, run through the engine's verbs against each shipped driver
// in turn, the day quick-fix-nested-by-hand.cjs's `mergedInClone` runs. The
// ways that keep the branch's own commits are
// test-engine-landing-conformance-quick-fix-nested-by-hand.cjs's and
// -nested-by-hand-ways's; a squash in the submodule,
// -submodule-by-hand's. A driver's side (tests/drivers/{name}/landing.cjs)
// readies each repository, merges by hand and reads what landed where;
// this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED_BY_HAND, mergedInClone } = require('./quick-fix-nested-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-by-hand-squash-${name}-`);
  const [[how, merge]] = Object.entries(conf.side.byHand);
  describe(NESTED_BY_HAND.title(name, how), () => {
    it(NESTED_BY_HAND.test, () => mergedInClone(conf, merge));
  });
}
