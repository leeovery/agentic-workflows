'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a submodule the project
// nests, its pull requests in the project and the submodule both merged by
// hand by the first way the driver's side merges by hand, the project's
// first, then a fix in the project alone (7.2.21, 7.2.24): the project's
// default branch then points the submodule at the branch's own commit
// there, whose change the submodule's merge lands, so a pull brings
// nothing. The close points the project at the submodule's landing of the
// change, by a commit of its own landed as the driver lands a change, then
// lands the fix. The submodule's merged by hand alone is
// test-engine-landing-conformance-quick-fix-submodule-by-hand.cjs's; a
// feature's, test-engine-landing-conformance-nested-repoint.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository, merges by hand and reads what landed where; this file names
// no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { BRANCH, SET, DESCRIPTION, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed } = quickFixNestedConformance(name, `engine-landing-quick-fix-submodule-repoint-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix in a submodule, its pull requests in the project and there merged by hand by ${how}, the project's first (7.2.21, 7.2.24)`, () => {
    it('the close points the project at the submodule\'s landing of the change, by a commit of its own, and lands the fix after', () => {
      const { into } = NESTED.ext;
      const at = project();
      built(at, 1, { 'ext/ext.txt': 'ext --colour\n' });
      merge(at.dir, BRANCH, 'main');
      merge(at.ext, BRANCH, into);
      const landing = side.defaultTip(at.ext, into);
      const before = side.landed(at.dir, 'main').length;
      built(at, 2, { [SET[1].file]: SET[1].text });
      closed(at);

      assert.deepStrictEqual(side.landed(at.dir, 'main').slice(before), [
        { subject: 'chore(typo): point ext at its landing', task: null, paths: [NESTED.ext.folder] },
        { subject: `fix(typo): ${DESCRIPTION}`, task: 'typo-1-2', paths: [SET[1].file] },
      ]);
      assert.strictEqual(git(side.on(at.dir), ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), landing);
    });
  });
}
