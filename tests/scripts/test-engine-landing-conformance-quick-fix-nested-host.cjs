'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a nested clone lacking the
// quick-fix's branch its host holds (7.2.24, R15, R16): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. The clone, as a second clone of it does, takes the host's
// branch at the next fix's first commit there, never cutting one, and the
// close lands both fixes there. A fix across the project and the clone, and
// one in the clone alone, are
// test-engine-landing-conformance-quick-fix-nested.cjs's; a fix in the
// submodule is test-engine-landing-conformance-quick-fix-submodule.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and reads what landed where; this file names no driver and no tool.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance`,
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { UNIT, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-host-${name}-`);

  describe(`the ${name} landing driver's quick-fix in a nested clone lacking the branch its host holds (7.2.24, R15, R16)`, () => {
    it('the clone lacking the quick-fix\'s branch its host holds, as a second clone of it does, takes the host\'s at the next fix\'s first commit there, never cutting one, and the close lands both fixes there', () => {
      const at = project();
      built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      const held = git(at.lib, ['rev-parse', 'fix/typo']).trim();
      git(at.lib, ['switch', '-q', 'trunk']);
      git(at.lib, ['branch', '-q', '-D', 'fix/typo']);
      git(at.lib, ['update-ref', '-d', 'refs/remotes/origin/fix/typo']);
      built(at, 2, { 'lib/rates.txt': 'rates --colour\n' });
      const taken = git(at.lib, ['rev-parse', 'fix/typo~1']).trim();
      closed(at);

      assert.deepStrictEqual([taken, git(side.on(at.lib), ['log', '-1', '--format=%B', 'trunk']).match(/^Task: .*$/gm)], [held, [`Task: ${UNIT}-1-1`, `Task: ${UNIT}-1-2`]]);
    });
  });
}
