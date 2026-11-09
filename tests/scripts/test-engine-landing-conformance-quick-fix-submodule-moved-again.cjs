'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a submodule the project
// nests, its pull requests in the project and the submodule both merged by
// hand, the project's first, by a squash or a rebase, then a later fix
// moving the submodule again (7.2.21, 7.2.24): the project's default
// branch points the submodule at the branch's own commit there, whose
// change the submodule landed; the close lands the later fix in the
// submodule, then in the project, its pointer set at the submodule's
// landing of the later fix's change — no re-point made, nothing refused.
// The fix in the project alone after the same merges by hand is
// test-engine-landing-conformance-quick-fix-submodule-repoint.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository, merges by hand and reads what landed where; this file names
// no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { BRANCH, SET, DESCRIPTION, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { folder: EXT, into: EXT_INTO } = NESTED.ext;

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed } = quickFixNestedConformance(name, `engine-landing-quick-fix-submodule-moved-again-${name}-`);

  for (const [how, merge] of Object.entries(side.byHand).filter(([named]) => /squash|rebase/.test(named))) {
    describe(`the ${name} landing driver's quick-fix in a submodule, its pull requests merged by hand by ${how}, the project's first, then a later fix moving the submodule again (7.2.21, 7.2.24)`, () => {
      it('the close lands the later fix, the project\'s pointer at the submodule\'s landing of its change, no re-point made', () => {
        const at = project();
        built(at, 1, { 'ext/ext.txt': 'ext --colour\n' });
        merge(at.dir, BRANCH, 'main');
        merge(at.ext, BRANCH, EXT_INTO);
        const before = side.landed(at.dir, 'main').length;
        built(at, 2, { 'ext/ext-help.txt': 'help --colour\n', [SET[1].file]: SET[1].text });
        const answer = closed(at);

        assert.deepStrictEqual(side.landed(at.dir, 'main').slice(before), [{ subject: `fix(typo): ${DESCRIPTION}`, task: 'typo-1-2', paths: [EXT, SET[1].file].sort() }]);
        assert.deepStrictEqual(answer.landed.map((/** @type {{repointed?: unknown}} */ { repointed }) => repointed), answer.landed.map(() => undefined));
        assert.strictEqual(git(side.on(at.dir), ['rev-parse', `main:${EXT}`]).trim(), side.defaultTip(at.ext, EXT_INTO));
      });
    });
  }
}
