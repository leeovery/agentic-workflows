'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a nested clone whose branch of
// the quick-fix's name holds the person's own commit alone (R19): the
// contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn. The quick-fix's fix in the project
// alone, the clone walked as its branch there holds work: the commit, made
// during the quick-fix, is the quick-fix's work, opened and landed there
// with the close. One dated long before the unit was made is
// test-engine-landing-conformance-quick-fix-nested-read-old.cjs's; the
// record alone naming a clone, -nested-read's; the person's own commit in
// the project, -host-own's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, readManifest } = require('./engine-harness.cjs');
const { UNIT, SET, ownBranchCommit, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project, opened, ended, closed, landed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-read-own-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a nested clone whose branch of its name holds the person's own commit alone (R19)`, () => {
    it('the person\'s own commit alone on the clone\'s branch, made during the quick-fix, is its work: opened there and landed with the close', () => {
      const at = project();
      opened(at, 1, { [SET[0].file]: SET[0].text });
      ownBranchCommit(at.lib, 'My own change');
      const reopened = ok(at.dir, ['land', 'open', UNIT, '1.1'], as());
      ended(at, 1);
      closed(at);

      assert.deepStrictEqual([reopened.repos.map((/** @type {any} */ { repo }) => repo), landed(at).lib, side.quickFixOpen(at.lib, UNIT), readManifest(at.dir, UNIT).status], [
        ['lib', '.'], [[null, ['mine.txt']]], false, 'completed',
      ]);
    });
  });
}
