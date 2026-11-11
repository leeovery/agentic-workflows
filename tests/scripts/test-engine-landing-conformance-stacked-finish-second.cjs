'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's fix phases stacked across nested
// repositories and landed at finish (landing-stacked-finish.cjs, 7.3.4,
// 7.2.6, 7.2.17, the landing half of 7.S19), every commit of phase 1's
// landing — the engine's own pointing the submodule at its landing, and
// the squashes landing it — made in one second: the phase read landed as
// it is a second apart, never landed again at finish. As the machine's
// clock runs is test-engine-landing-conformance-stacked-finish.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and reads what landed where; this file names no driver and no tool.
// Conformance layer: the nested world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { datedAt } = require('./engine-harness.cjs');
const { nestedConformance } = require('./landing-world.cjs');
const { stackedFinishes, STACKED_FINISH } = require('./landing-stacked-finish.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = nestedConformance(name, `engine-landing-stacked-finish-second-${name}-`);

  describe(STACKED_FINISH.title(name), () => {
    it(STACKED_FINISH.test('every commit of it in one second'), () => stackedFinishes(conf, (act) => datedAt(`${Math.floor(Date.now() / 1000)} +0000`, act)));
  });
}
