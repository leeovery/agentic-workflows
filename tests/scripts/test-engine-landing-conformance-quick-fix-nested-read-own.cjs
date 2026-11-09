'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a nested clone whose branch of
// the quick-fix's name holds no fix's work (R18): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. A commit on the clone's branch the engine never wrote —
// the person's own, or a branch made by hand before — the quick-fix's fix
// in the project alone: the clone is walked, its work never the
// quick-fix's to open or land, so nothing it pushes is another's; the close
// completes, the commit left on the branch there. The record alone naming a
// clone is test-engine-landing-conformance-quick-fix-nested-read.cjs's; the
// person's own commit on a branch holding a fix's, landing with it,
// -host-own's. A driver's side (tests/drivers/{name}/landing.cjs) readies
// each repository and reads what landed where; this file names no driver
// and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, createFile, readManifest } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project, opened, ended, closed, landed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-read-own-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a nested clone whose branch of its name holds no fix's work (R18)`, () => {
    it('the person\'s own commit alone on the clone\'s branch is never opened nor landed, and the close completes, the commit left on the branch there', () => {
      const at = project();
      opened(at, 1, { [SET[0].file]: SET[0].text });
      git(at.lib, ['switch', '-q', '-c', BRANCH]);
      createFile(at.lib, 'mine.txt', 'mine\n');
      git(at.lib, ['add', 'mine.txt']);
      git(at.lib, ['commit', '-q', '-m', 'My own change']);
      const reopened = ok(at.dir, ['land', 'open', UNIT, '1.1'], as());
      ended(at, 1);
      closed(at);

      assert.deepStrictEqual([reopened.repos.map((/** @type {any} */ { repo }) => repo), landed(at).lib, side.quickFixOpen(at.lib, UNIT), git(at.lib, ['log', '-1', '--format=%s', BRANCH]).trim(), readManifest(at.dir, UNIT).status], [
        ['.'], [], false, 'My own change', 'completed',
      ]);
    });
  });
}
