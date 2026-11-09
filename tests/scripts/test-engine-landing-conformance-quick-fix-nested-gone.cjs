'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix across the project and a nested
// clone whose branch is then gone here (7.2.24, R15, R17): the contract
// every landing driver meets, run through the engine's verbs against each
// shipped driver in turn. The close readies the clone's branch from its
// host's copy and lands both shares, the clone's pull request with the
// project's — never the project's alone, the unit completed over a pull
// request left open. The clone alone so is
// test-engine-landing-conformance-quick-fix-nested-clone-gone.cjs's; a second
// clone of it, -nested-second-clone's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { UNIT, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const ID = `${UNIT}-1-1`;

for (const { name } of listDrivers('landing')) {
  const { project, built, closed, landed, gone } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-gone-${name}-`);

  describe(`the ${name} landing driver's quick-fix across the project and a nested clone whose branch is gone here (7.2.24, R15, R17)`, () => {
    it('lands both shares at the close, the clone\'s branch readied from its host\'s copy, children first', () => {
      const at = project();
      built(at, 1, { [SET[0].file]: SET[0].text, 'lib/lib.txt': 'lib --colour\n' });
      gone(at.lib, NESTED.lib.into);
      const close = closed(at);

      assert.deepStrictEqual([close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), landed(at)], [
        [['lib', ['1.1']], ['.', ['1.1']]], { '.': [[ID, [SET[0].file]]], ext: [], lib: [[ID, ['lib.txt']]] },
      ]);
    });
  });
}
