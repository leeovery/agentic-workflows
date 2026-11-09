'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a nested clone whose branch of
// the quick-fix's name holds a commit dated long before the unit was made
// (R19): the contract every landing driver meets, run through the engine's
// verbs against each shipped driver in turn. The quick-fix's fix in the
// project alone, the clone walked as its branch there holds work: the
// commit is none of the quick-fix's, never opened nor landed, the close
// completing with it left on the branch there, so all that is pushed is the
// unit's. The person's own made during the quick-fix is
// test-engine-landing-conformance-quick-fix-nested-read-own.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and reads what landed where; this file names no driver and no tool.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance`,
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, readManifest, datedAt } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, ownBranchCommit, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project, opened, ended, closed, landed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-read-old-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a nested clone whose branch of its name holds a commit dated long before the unit (R19)`, () => {
    it('a commit on it dated long before the unit was made is none of its: never opened nor landed, and the close completes, the commit left on the branch there', () => {
      const at = project();
      opened(at, 1, { [SET[0].file]: SET[0].text });
      datedAt('2020-01-01T00:00:00Z', () => ownBranchCommit(at.lib, 'An old change of mine'));
      const reopened = ok(at.dir, ['land', 'open', UNIT, '1.1'], as());
      ended(at, 1);
      closed(at);

      assert.deepStrictEqual([reopened.repos.map((/** @type {any} */ { repo }) => repo), landed(at).lib, side.quickFixOpen(at.lib, UNIT), git(at.lib, ['log', '-1', '--format=%s', BRANCH]).trim(), readManifest(at.dir, UNIT).status], [
        ['.'], [], false, 'An old change of mine', 'completed',
      ]);
    });
  });
}
