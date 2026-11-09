'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a submodule the project
// nests, its pull requests in the project and the submodule both merged by
// hand by the first way the driver's side merges by hand, the project's
// first, nothing left to land (7.2.21, 7.2.24): the project's default
// branch points the submodule at the branch's own commit there, and the
// close's landing, `land finish`, makes the re-point alone — a commit of
// its own pointing the project at the submodule's landing of the change —
// answering it, and never as landed already. With a
// fix in the project alone after the same merges,
// test-engine-landing-conformance-quick-fix-submodule-repoint.cjs's. The
// world is quick-fix-submodule-repoint.cjs's; this file names no driver and
// no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok } = require('./engine-harness.cjs');
const { UNIT, checklistClosed } = require('./quick-fix-world.cjs');
const { REPOINT, eachWay } = require('./quick-fix-submodule-repoint.cjs');

for (const { name, how, conf, mergedByHand, pointer } of eachWay('engine-landing-quick-fix-submodule-repoint-alone-', (ways) => ways.slice(0, 1))) {
  describe(`the ${name} landing driver's quick-fix in a submodule, its pull requests in the project and there merged by hand by ${how}, the project's first, nothing left to land (7.2.21, 7.2.24)`, () => {
    it('with nothing left to land, the close\'s landing makes the re-point alone, answering it, never already', () => {
      const { at, landing, before } = mergedByHand();
      checklistClosed(at.dir, conf.as());
      const answer = ok(at.dir, ['land', 'finish', UNIT], conf.as());

      assert.deepStrictEqual(conf.side.landed(at.dir, 'main').slice(before), [REPOINT]);
      assert.deepStrictEqual([pointer(at), answer.repos.map((/** @type {{repo: string}} */ { repo }) => repo), answer.already], [landing, ['.'], undefined]);
    });
  });
}
