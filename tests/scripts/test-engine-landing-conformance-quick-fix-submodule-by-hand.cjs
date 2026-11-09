'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a submodule the project
// nests, its pull request there merged by hand by the first way the
// driver's side merges by hand, then a fix in the project alone (7.2.21,
// R17): the contract every landing driver meets, run through the engine's
// verbs against each shipped driver in turn. The submodule stays in the
// walk though its branch holds nothing past its default branch, so the
// close points it at its landing there — named by its `Task:` line, else
// the oldest commit there holding the change, as a squash under the
// person's own message lands it, whatever its default branch gained after
// — never at a commit its default branch lacks, which would refuse every
// landing after. A fix in the submodule landed by the
// close is test-engine-landing-conformance-quick-fix-submodule.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository, merges by hand and reads what landed where; this file names
// no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, createFile } = require('./engine-harness.cjs');
const { BRANCH, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, project, built, closed } = quickFixNestedConformance(name, `engine-landing-quick-fix-submodule-by-hand-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix in a submodule, its pull request there merged by hand by ${how}, then a fix in the project alone (7.2.21, R17)`, () => {
    it('the close points the submodule at its landing on its default branch, not at what that branch gained after', () => {
      const { into } = NESTED.ext;
      const at = project();
      built(at, 1, { 'ext/ext.txt': 'ext --colour\n' });
      merge(at.ext, BRANCH, into);
      const landing = side.defaultTip(at.ext, into);
      const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-fix-ext-elsewhere-'));
      git(side.on(at.ext), ['worktree', 'add', '-q', tree, into]);
      createFile(tree, 'other.txt', 'other\n');
      git(tree, ['add', 'other.txt']);
      git(tree, ['commit', '-q', '-m', 'Another change']);
      git(side.on(at.ext), ['worktree', 'remove', '--force', tree]);
      built(at, 2, { [SET[1].file]: SET[1].text });
      closed(at);

      assert.strictEqual(git(side.on(at.dir), ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), landing);
    });
  });
}
