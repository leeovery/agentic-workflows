'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a nested clone lacking the
// quick-fix's branch its host holds (7.2.24, R15, R16): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. The clone, as a second clone of it does, takes the host's
// branch at the start of the next fix there, never cutting one at its first
// commit, and the close lands both fixes there. The next fix in the same
// file there is test-engine-landing-conformance-quick-fix-nested-same-file*.cjs's;
// the next fix in the project alone, -nested-second-clone's; a fix across
// the project and the clone,
// test-engine-landing-conformance-quick-fix-nested.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance`,
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { UNIT, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed, gone } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-host-${name}-`);

  describe(`the ${name} landing driver's quick-fix in a nested clone lacking the branch its host holds (7.2.24, R15, R16)`, () => {
    it('the clone lacking the quick-fix\'s branch its host holds, as a second clone of it does, takes the host\'s at the next fix\'s start there, never cutting one at its first commit, and the close lands both fixes there', () => {
      const at = project();
      built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      const held = git(at.lib, ['rev-parse', 'fix/typo']).trim();
      gone(at.lib, NESTED.lib.into);
      built(at, 2, { 'lib/rates.txt': 'rates --colour\n' });
      const taken = git(at.lib, ['rev-parse', 'fix/typo~1']).trim();
      closed(at);

      assert.deepStrictEqual([taken, git(side.on(at.lib), ['log', '-1', '--format=%B', 'trunk']).match(/^Task: .*$/gm)], [held, [`Task: ${UNIT}-1-1`, `Task: ${UNIT}-1-2`]]);
    });
  });
}
