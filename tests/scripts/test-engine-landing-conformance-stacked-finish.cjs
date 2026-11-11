'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's fix phases stacked across nested
// repositories and landed at finish (landing-stacked-finish.cjs, 7.3.4,
// 7.2.6, 7.2.17, the landing half of 7.S19), phase 1 landed as the
// machine's clock runs, run through the `land` verbs against each shipped
// driver in turn. Every commit of its landing made in one second is
// test-engine-landing-conformance-stacked-finish-second.cjs's. A driver's
// side (tests/drivers/{name}/landing.cjs) readies each repository and reads
// what landed where; this file names no driver and no tool. Conformance
// layer: the nested world (landing-world.cjs), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { nestedConformance } = require('./landing-world.cjs');
const { stackedFinishes, STACKED_FINISH } = require('./landing-stacked-finish.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = nestedConformance(name, `engine-landing-stacked-finish-${name}-`);

  describe(STACKED_FINISH.title(name), () => {
    it(STACKED_FINISH.test('as the clock runs'), () => stackedFinishes(conf, (act) => act()));
  });
}
