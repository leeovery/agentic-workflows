'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix cancelled with its pull request
// open in the project and in a nested clone, and the fix holding its one
// checkout holding work not committed (18.3.9, 18.S75, 19.5.29): the
// contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn. The cancel sets the holder's work
// aside as a park does, takes each checkout back off the quick-fix's
// branch, closes its pull request in each repository and keeps the branch
// under its own name there; its receipt names the branch and the work
// kept, with the calls that show it, bring it back and drop it.
// Reactivated, the fix's start puts the work back on the branch, and its
// next opening opens the pull request anew in each repository. The
// cancel of a feature, and of a unit with its own branch:
// test-engine-landing-conformance-cancel.cjs. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads
// whether the quick-fix is open in it; this file names no driver and no
// tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, output, sectionOf, createFile, git } = require('./engine-harness.cjs');
const { UNIT, BRANCH, quickFixNestedConformance, entered } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

/** Where fix 1.1's work is set aside. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

/** Fix 1.1's change, by its path in the project: one in the project's own repository, one in `lib`. */
const FIX = Object.freeze({ 'src/flag.js': 'const flag = \'colour\';\n', 'lib/lib.txt': 'lib --colour\n' });

/** What fix 1.1 holds not committed as the quick-fix is cancelled. */
const UNCOMMITTED = Object.freeze({ 'src/alias.js': 'module.exports = \'color\';\n' });

/** The branch the repository at `dir` has out. @param {string} dir */
const out = (dir) => git(dir, ['branch', '--show-current']).trim();

for (const { name } of listDrivers('landing')) {
  const { side, as, project, opened } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-cancel-${name}-`);

  describe(`the ${name} landing driver's quick-fix cancelled with its pull request open in the project and a nested clone (18.3.9, 18.S75)`, () => {
    it('the cancel sets the holder\'s work aside, takes each checkout back, closes each pull request and keeps each branch under its own name, its receipt naming the branch and the work kept; reactivated, the fix\'s start puts the work back and its opening opens each pull request anew', () => {
      const at = project();
      opened(at, 1, FIX);
      for (const [file, text] of Object.entries(UNCOMMITTED)) createFile(at.dir, file, text);
      const tips = [at.dir, at.lib].map((repo) => git(repo, ['rev-parse', BRANCH]).trim());
      const before = [side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)];

      const cancelled = ok(at.dir, ['workunit', 'cancel', UNIT], as());
      const left = {
        open: [side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)],
        tips: [at.dir, at.lib].map((repo) => git(repo, ['rev-parse', BRANCH]).trim()),
        out: [out(at.dir), out(at.lib)],
        status: git(at.dir, ['status', '--porcelain', '--untracked-files=all']).trim(),
      };
      const receipt = sectionOf(output(at.dir, ['render', 'workunit-receipt', UNIT, '--verb', 'cancel'], as()), 'DISPLAY: confirmation');
      ok(at.dir, ['workunit', 'reactivate', UNIT], as());
      entered(at.dir, as());
      const started = ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      const back = fs.readFileSync(path.join(at.dir, 'src/alias.js'), 'utf8');
      ok(at.dir, ['commit', '--paths', 'src/alias.js', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): keep the old alias`], as());
      ok(at.dir, ['land', 'open', UNIT, '1.1'], as());

      assert.deepStrictEqual([before, cancelled.pull_requests_closed, cancelled.checkout], [[true, true], true, 'main']);
      assert.deepStrictEqual(left, { open: [false, false], tips, out: ['main', NESTED.lib.into], status: '' });
      assert.deepStrictEqual(receipt.replace(/\n {2}/g, ' ').split('\n'), [
        '"Typo" marked as cancelled.',
        `⚑ Its commits stay on ${BRANCH} in lib, ${BRANCH}, kept for a reactivate to carry on from`,
        `⚑ Task 1.1's work, set aside as the quick-fix was cancelled, is kept in the project's repository at ${ASIDE} — see it with git diff ${ASIDE}^ ${ASIDE}; bring it into the checkout with git cherry-pick --no-commit ${ASIDE}, settling any conflict; drop it with git update-ref -d ${ASIDE}`,
        '',
      ]);
      assert.deepStrictEqual([started.put_back, back], [['src/alias.js'], UNCOMMITTED['src/alias.js']]);
      assert.deepStrictEqual([side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)], [true, true]);
    });
  });
}
