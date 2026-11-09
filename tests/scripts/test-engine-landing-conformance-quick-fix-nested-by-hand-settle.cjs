'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix across the project and a nested
// clone, the clone's pull request merged by hand while the project's share
// is still to land (R17): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. Merged
// by the side's second way, the close lands the project's share and brings
// the clone's default branch here up to its host's, nothing left past it
// there, and nothing of the quick-fix's open there — the local driver's
// opening, which a merge by hand leaves, dropped. The clone merged by hand
// mid-set is
// test-engine-landing-conformance-quick-fix-nested-by-hand.cjs's,
// -nested-by-hand-ways's and -nested-by-hand-squash's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository, merges by
// hand and reads what landed where; this file names no driver and no tool.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance`,
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { FILES } = require('./quick-fix-nested-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-by-hand-settle-${name}-`);
  const [, [how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix across the project and a nested clone, the clone's pull request merged by hand by ${how} (R17)`, () => {
    it('the close lands the project\'s share, brings the clone\'s default branch here up to its host\'s, and leaves nothing open there', () => {
      const { into } = NESTED.lib;
      const at = project();
      built(at, 1, { [SET[0].file]: SET[0].text, ...FILES[0] });
      merge(at.lib, BRANCH, into);
      const close = closed(at);

      assert.deepStrictEqual([close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), git(at.lib, ['rev-parse', into]).trim(), side.quickFixOpen(at.lib, UNIT)], [
        [['.', ['1.1']]], side.defaultTip(at.lib, into), false,
      ]);
    });
  });
}
