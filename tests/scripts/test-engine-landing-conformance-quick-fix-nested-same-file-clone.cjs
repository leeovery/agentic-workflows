'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a nested clone's branch gone as
// a second clone of it has it, then the next fix in the same file there
// (R16, R17's N1): the contract every landing driver meets, run through the
// engine's verbs against each shipped driver in turn, the day
// quick-fix-nested-same-file.cjs's `nextInSameFile` runs. The branch
// deleted here is
// test-engine-landing-conformance-quick-fix-nested-same-file.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and reads what landed where; this file names no driver and no tool.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance`,
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { SAME_FILE, nextInSameFile } = require('./quick-fix-nested-same-file.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-same-file-clone-${name}-`);

  describe(SAME_FILE.title(name, 'gone, as a second clone of it has it'), () => {
    it(SAME_FILE.test, () => nextInSameFile(conf, conf.secondClone));
  });
}
