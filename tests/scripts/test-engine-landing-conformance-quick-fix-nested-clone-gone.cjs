'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a nested clone alone, the
// clone's branch then gone here (7.2.24, R16, R17): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. The close readies the clone's branch from its host's copy
// and lands the fix there — a repository the quick-fix touched read whatever
// its branches here hold. The clone alone with its branch kept is
// test-engine-landing-conformance-quick-fix-nested-clone.cjs's; across the
// project and the clone so, -nested-gone's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readManifest } = require('./engine-harness.cjs');
const { UNIT, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const ID = `${UNIT}-1-1`;

for (const { name } of listDrivers('landing')) {
  const { project, built, closed, landed, gone } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-clone-gone-${name}-`);

  describe(`the ${name} landing driver's quick-fix in a nested clone alone, its branch gone here (7.2.24, R16, R17)`, () => {
    it('lands there at the close from its host\'s copy, the project holding none of it', () => {
      const at = project();
      built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      gone(at.lib, NESTED.lib.into);
      const close = closed(at);

      assert.deepStrictEqual([close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), landed(at), readManifest(at.dir, UNIT).status], [
        [['lib', ['1.1']]], { '.': [], ext: [], lib: [[ID, ['lib.txt']]] }, 'completed',
      ]);
    });
  });
}
