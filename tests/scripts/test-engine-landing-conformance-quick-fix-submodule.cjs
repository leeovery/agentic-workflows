'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a submodule the project
// nests (7.2.24, 7.2.21, R16): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. A fix
// changing the submodule's code lands there through a pull request of its
// own, the project's pointer at it committed through the door with it and
// landing at the submodule's squash, children first. A fix across the
// project and a clone, and one in the clone alone, are
// test-engine-landing-conformance-quick-fix-nested.cjs's; the clone lacking
// the branch its host holds is
// test-engine-landing-conformance-quick-fix-nested-host.cjs's. A driver's
// side (tests/drivers/{name}/landing.cjs) readies each repository and reads
// what landed where; this file names no driver and no tool. Conformance
// layer: quick-fix-world.cjs's `quickFixNestedConformance`, built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { UNIT, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const ID = `${UNIT}-1-1`;

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed, landed } = quickFixNestedConformance(name, `engine-landing-quick-fix-submodule-${name}-`);

  describe(`the ${name} landing driver's quick-fix in a submodule (7.2.24, 7.2.21, R16)`, () => {
    it('a fix in the submodule lands there through a pull request of its own, the project\'s pointer committed with it and landing at the submodule\'s squash, children first', () => {
      const at = project();
      const opened = built(at, 1, { 'ext/ext.txt': 'ext --colour\n' });
      const close = closed(at);

      assert.deepStrictEqual([opened.repos.map((/** @type {any} */ { repo }) => repo), close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged])], [
        ['ext', '.'], [['ext', ['1.1']], ['.', ['1.1']]],
      ]);
      assert.deepStrictEqual(landed(at), { '.': [[ID, ['ext']]], ext: [[ID, ['ext.txt']]], lib: [] });
      assert.strictEqual(git(side.on(at.dir), ['rev-parse', 'main:ext']).trim(), side.defaultTip(at.ext, 'main'));
    });
  });
}
