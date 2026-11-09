'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a submodule the project
// nests, its pull requests in the project and the submodule both merged by
// hand by the first way the driver's side merges by hand, the project's
// first (7.2.21, 7.2.24): the project's default branch then points the
// submodule at the branch's own commit there, whose change the
// submodule's merge lands, so a pull brings nothing. With a fix in the
// project alone after it, the close lands the fix, which leaves the
// submodule where it was, then points the project at the submodule's
// landing of the change, by a commit of its own landed as the driver lands
// a change. With nothing left to land, the close makes the re-point alone:
// test-engine-landing-conformance-quick-fix-submodule-repoint-alone.cjs's;
// a later fix moving the submodule again,
// test-engine-landing-conformance-quick-fix-submodule-moved-again-*.cjs's;
// the submodule's merged by hand alone,
// test-engine-landing-conformance-quick-fix-submodule-by-hand.cjs's; a
// feature's, test-engine-landing-conformance-nested-repoint.cjs's. The
// world is quick-fix-submodule-repoint.cjs's; this file names no driver and
// no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { SET, DESCRIPTION } = require('./quick-fix-world.cjs');
const { EXT, REPOINT, eachWay } = require('./quick-fix-submodule-repoint.cjs');

for (const { name, how, conf, mergedByHand, pointer } of eachWay('engine-landing-quick-fix-submodule-repoint-', (ways) => ways.slice(0, 1))) {
  describe(`the ${name} landing driver's quick-fix in a submodule, its pull requests in the project and there merged by hand by ${how}, the project's first (7.2.21, 7.2.24)`, () => {
    it('the close lands a fix in the project alone, then points the project at the submodule\'s landing of the change, by a commit of its own', () => {
      const { at, landing, before } = mergedByHand();
      conf.built(at, 2, { [SET[1].file]: SET[1].text });
      const answer = conf.closed(at);

      assert.deepStrictEqual(conf.side.landed(at.dir, 'main').slice(before), [{ subject: `fix(typo): ${DESCRIPTION}`, task: 'typo-1-2', paths: [SET[1].file] }, REPOINT]);
      assert.deepStrictEqual([pointer(at), answer.landed.at(-1).repointed.pointers], [landing, { [EXT]: landing }]);
    });
  });
}
