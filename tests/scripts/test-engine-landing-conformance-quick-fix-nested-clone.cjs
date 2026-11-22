'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a nested clone alone (7.2.24,
// R16, R17): the contract every landing driver meets, run through the
// engine's verbs against each shipped driver in turn. A fix in the clone
// alone is done, recorded and landed there, the project holding none of it;
// the close deletes the quick-fix's branch wherever it holds nothing past
// the branch it lands on — the project's and the clone it never touched —
// and in the clone holding the fix's commit, where it stands at the tip its
// landing recorded, nothing added since. One a commit came after is kept:
// test-engine-quick-fix-close-yes.cjs's.
// The clone's branch then gone here is
// test-engine-landing-conformance-quick-fix-nested-clone-gone.cjs's; a fix
// across the project and the clone, -nested's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readManifest, git } = require('./engine-harness.cjs');
const { UNIT, BRANCH, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const ID = `${UNIT}-1-1`;

for (const { name } of listDrivers('landing')) {
  const { project, built, closed, landed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-clone-${name}-`);

  describe(`the ${name} landing driver's quick-fix in a nested clone alone (7.2.24, R16, R17)`, () => {
    it('a fix in the clone alone is done, recorded and landed there, the project holding none of it; the close deletes the quick-fix\'s branch where it holds nothing past the branch it lands on, and in the clone, where it stands at the tip its landing recorded', () => {
      const at = project();
      const opened = built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      closed(at);
      const kept = [at.dir, at.ext, at.lib].map((repo) => git(repo, ['branch', '--list', BRANCH]).trim() !== '');

      assert.deepStrictEqual([opened.repos.map((/** @type {any} */ { repo }) => repo), landed(at), readManifest(at.dir, UNIT).status], [
        ['lib'], { '.': [], ext: [], lib: [[ID, ['lib.txt']]] }, 'completed',
      ]);
      assert.deepStrictEqual(kept, [false, false, false]);
    });
  });
}
