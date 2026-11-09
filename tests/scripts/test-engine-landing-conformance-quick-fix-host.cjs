'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its branch as the host has it
// the truth for what its pull request holds (R15): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. The branch deleted here while its pull request is open is
// taken from the host's copy, and the close lands every fix in it. A commit
// of the person's own on the branch is
// test-engine-landing-conformance-quick-fix-host-own.cjs's; a host's own —
// a review's suggestion, its update of the branch, a second clone, a head
// moved after it was read — are its driver's suites'
// (tests/drivers/{name}/); a fix done left off by the close's own cut,
// -close-left-off's. A driver's side (tests/drivers/{name}/landing.cjs)
// readies the world, merges by hand and reads what landed where; this file
// names no driver and no tool. Conformance layer: the quick-fix of
// quick-fix-world.cjs (`quickFixConformance`), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git, readManifest } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, quickFixConformance } = require('./quick-fix-world.cjs');
const { HELP, steps } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-host-${name}-`);
  const { project, built, landed } = conf;
  const { closed } = steps(conf);

  describe(`the ${name} landing driver's quick-fix, its branch as the host has it the truth (R15)`, () => {
    it('its branch deleted here while its pull request is open: taken from the host\'s copy, the close landing every fix in it', () => {
      const at = project();
      built(at, 1);
      built(at, 2);
      git(at, ['switch', '-q', 'main']);
      git(at, ['branch', '-q', '-D', BRANCH]);
      closed(at);

      assert.deepStrictEqual([landed(at), readManifest(at, UNIT).status], [[[`fix(${UNIT}): ${DESCRIPTION}`, [SET[0].file, HELP.file]]], 'completed']);
    });
  });
}
