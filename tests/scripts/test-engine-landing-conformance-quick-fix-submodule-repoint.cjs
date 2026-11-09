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
// a change; with nothing left to land, the close makes the re-point
// alone. A later fix moving the submodule again is
// test-engine-landing-conformance-quick-fix-submodule-moved-again.cjs's;
// the submodule's merged by hand alone,
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

const { folder: EXT, into: EXT_INTO } = NESTED.ext;
const REPOINT = { subject: 'chore(typo): point ext at its landing', task: null, paths: [EXT] };

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed } = quickFixNestedConformance(name, `engine-landing-quick-fix-submodule-repoint-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  /** Fix 1.1 built in the submodule, its pull requests merged by hand, the project's first: the world, and the submodule's landing. */
  const mergedByHand = () => {
    const at = project();
    built(at, 1, { 'ext/ext.txt': 'ext --colour\n' });
    merge(at.dir, BRANCH, 'main');
    merge(at.ext, BRANCH, EXT_INTO);
    return { at, landing: side.defaultTip(at.ext, EXT_INTO), before: side.landed(at.dir, 'main').length };
  };
  const pointer = (/** @type {{dir: string}} */ at) => git(side.on(at.dir), ['rev-parse', `main:${EXT}`]).trim();

  describe(`the ${name} landing driver's quick-fix in a submodule, its pull requests in the project and there merged by hand by ${how}, the project's first (7.2.21, 7.2.24)`, () => {
    it('the close lands a fix in the project alone, then points the project at the submodule\'s landing of the change, by a commit of its own', () => {
      const { at, landing, before } = mergedByHand();
      built(at, 2, { [SET[1].file]: SET[1].text });
      const answer = closed(at);

      assert.deepStrictEqual(side.landed(at.dir, 'main').slice(before), [{ subject: `fix(typo): ${DESCRIPTION}`, task: 'typo-1-2', paths: [SET[1].file] }, REPOINT]);
      assert.deepStrictEqual([pointer(at), answer.landed.at(-1).repointed.pointers], [landing, { [EXT]: landing }]);
    });

    it('with nothing left to land, the close makes the re-point alone, answering it', () => {
      const { at, landing, before } = mergedByHand();
      const answer = closed(at);

      assert.deepStrictEqual(side.landed(at.dir, 'main').slice(before), [REPOINT]);
      assert.deepStrictEqual([pointer(at), answer.landed.map((/** @type {{repo: string}} */ { repo }) => repo)], [landing, ['.']]);
    });
  });
}
