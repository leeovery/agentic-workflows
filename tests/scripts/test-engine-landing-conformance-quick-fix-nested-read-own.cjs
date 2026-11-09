'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a nested clone marked as one it
// touches by the person's own commit alone (R17): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. A commit on the clone's branch the engine never wrote,
// the quick-fix's fix in the project alone: opened and landed with the
// quick-fix. The door's stamp alone is
// test-engine-landing-conformance-quick-fix-nested-read.cjs's; the host
// holding the branch alone, -nested-second-clone's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, createFile } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, opened, ended, closed, landed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-read-own-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a nested clone marked as one it touches by the person's own commit alone (R17)`, () => {
    it('the person\'s own commit alone on the clone\'s branch is opened and lands with the quick-fix', () => {
      const at = project();
      opened(at, 1, { [SET[0].file]: SET[0].text });
      git(at.lib, ['switch', '-q', '-c', BRANCH]);
      createFile(at.lib, 'mine.txt', 'mine\n');
      git(at.lib, ['add', 'mine.txt']);
      git(at.lib, ['commit', '-q', '-m', 'My own change']);
      const reopened = ok(at.dir, ['land', 'open', UNIT, '1.1'], as());
      ended(at, 1);
      closed(at);

      assert.deepStrictEqual([reopened.repos.map((/** @type {any} */ { repo }) => repo), landed(at).lib], [['lib', '.'], [[null, ['mine.txt']]]]);
    });
  });
}
