'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a nested clone as a second
// clone of it has it, its pull request there merged by hand by the first
// way the driver's side merges by hand and its branch deleted on the host
// too (7.2.24, R15, R17): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. The
// clone holds no branch, no copy of its host's and no commit of the
// branch's in a reflog, and its host no branch — the pull request merged
// there the one trace of the clone's share, where the local driver keeps
// the opening in the repository's own refs: the next fix in the project
// alone, the close lands it and completes the unit, the clone's share read
// as landed. The host's branch standing is
// test-engine-landing-conformance-quick-fix-nested-second-clone.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository, merges by hand and reads what landed where; this file names
// no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git, readManifest } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed, secondClone } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-host-deleted-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix in a nested clone as a second clone of it has it, its pull request merged by hand and its branch deleted on the host (7.2.24, R15, R17)`, () => {
    it(`merged by ${how}: the close lands the project's fix and completes the unit`, () => {
      const { into } = NESTED.lib;
      const at = project();
      built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      merge(at.lib, BRANCH, into);
      side.deleted(at.lib, BRANCH, into);
      secondClone(at.lib, into);
      built(at, 2, { [SET[1].file]: SET[1].text });
      const close = closed(at);

      assert.deepStrictEqual([close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), readManifest(at.dir, UNIT).status, git(side.on(at.lib), ['show', `${into}:lib.txt`])], [
        [['.', ['1.2']]], 'completed', 'lib --colour\n',
      ]);
    });
  });
}
