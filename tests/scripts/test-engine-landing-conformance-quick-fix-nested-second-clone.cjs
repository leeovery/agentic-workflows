'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a nested clone as a second
// clone of it has it (7.2.24, R15, R17): the contract every landing driver
// meets, run through the engine's verbs against each shipped driver in
// turn. A fix in the clone done, the clone then holding no branch, no copy
// of its host's and no commit of the branch's in a reflog — its host the one
// place holding the quick-fix's work there, as the local driver keeps it in
// the repository's own refs — and the next fix in the project alone: the
// clone's branch is taken from its host's at the next fix's start, and the
// close lands both fixes, the earlier in the clone. So where its pull
// request was merged by hand and its branch deleted on the host too is
// test-engine-landing-conformance-quick-fix-nested-host-deleted.cjs's; the
// clone lacking the branch at its own next fix,
// test-engine-landing-conformance-quick-fix-nested-host.cjs's. A driver's
// side (tests/drivers/{name}/landing.cjs) readies each repository and reads
// what landed where; this file names no driver and no tool. Conformance
// layer: quick-fix-world.cjs's `quickFixNestedConformance`, built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readManifest } = require('./engine-harness.cjs');
const { UNIT, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { project, built, closed, landed, secondClone } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-second-clone-${name}-`);

  describe(`the ${name} landing driver's quick-fix in a nested clone as a second clone of it has it (7.2.24, R15, R17)`, () => {
    it('takes the clone\'s branch from its host\'s at the next fix\'s start, that fix in the project alone, and the close lands both, the earlier in the clone', () => {
      const at = project();
      built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      secondClone(at.lib, NESTED.lib.into);
      built(at, 2, { [SET[1].file]: SET[1].text });
      const close = closed(at);

      assert.deepStrictEqual([close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), landed(at), readManifest(at.dir, UNIT).status], [
        [['lib', ['1.1']], ['.', ['1.2']]], { '.': [[`${UNIT}-1-2`, [SET[1].file]]], ext: [], lib: [[`${UNIT}-1-1`, ['lib.txt']]] }, 'completed',
      ]);
    });
  });
}
