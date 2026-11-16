'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix cancelled with its pull request
// open in the project and in a nested clone, and the fix holding its one
// checkout holding work not committed (18.3.9, 18.S75, 19.5.29), its
// confirm saying what the yes does to them: the
// contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn. The cancel sets the holder's work
// aside as a park does, takes each checkout back off the quick-fix's
// branch, closes its pull request in each repository and keeps the branch
// under its own name there; its receipt names the pull requests it closed
// on a host, the branch and the work kept, with the calls that show it,
// bring it back and drop it. Reactivated, the work's refusal names the
// cancel that set it aside, and the fix's start puts each checkout back on
// the branch before it puts the work back there — in the nested clone onto
// the fix's own change, not onto the branch it lands on — and its next
// opening opens the pull request anew in each repository; its confirm says
// the close only where the driver lands through a host. A change the
// person makes in a checkout while the cancel has it off the branch is
// theirs: the restart refuses it, naming each, before anything moves. The
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

const { ok, refuses, output, sectionOf, createFile, git } = require('./engine-harness.cjs');
const { UNIT, BRANCH, quickFixNestedConformance, entered } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

/** Where fix 1.1's work is set aside. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

/** The calls a receipt names for a piece of work kept at ASIDE, in a repository by its `git` call. @param {string} gitIn */
const calls = (gitIn) => `see it with ${gitIn} diff ${ASIDE}^ ${ASIDE}; bring it into the checkout with ${gitIn} cherry-pick --no-commit ${ASIDE}, settling any conflict; drop it with ${gitIn} update-ref -d ${ASIDE}`;

/** Fix 1.1's change, by its path in the project: one in the project's own repository, one in `lib`. */
const FIX = Object.freeze({ 'src/flag.js': 'const flag = \'colour\';\n', 'lib/lib.txt': 'lib --colour\n' });

/** What fix 1.1 holds not committed as the quick-fix is cancelled: a new file in the project's repository, and in `lib` an edit of its own change and a new file. */
const UNCOMMITTED = Object.freeze({ 'src/alias.js': 'module.exports = \'color\';\n', 'lib/lib.txt': 'lib --colour --no-color\n', 'lib/new.txt': 'new\n' });

/** The branch the repository at `dir` has out. @param {string} dir */
const out = (dir) => git(dir, ['branch', '--show-current']).trim();

for (const { name } of listDrivers('landing')) {
  const { side, as, project, opened } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-cancel-${name}-`);

  describe(`the ${name} landing driver's quick-fix cancelled with its pull request open in the project and a nested clone (18.3.9, 18.S75)`, () => {
    it('the cancel sets the holder\'s work aside, takes each checkout back, closes each pull request and keeps each branch under its own name, its receipt naming the pull requests closed, the branch and the work kept; reactivated, the fix\'s start puts each checkout back on the branch, the work back onto it, and its opening opens each pull request anew', () => {
      const at = project();
      opened(at, 1, FIX);
      for (const [file, text] of Object.entries(UNCOMMITTED)) createFile(at.dir, file, text);
      const tips = [at.dir, at.lib].map((repo) => git(repo, ['rev-parse', BRANCH]).trim());
      const before = [side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)];
      const gate = output(at.dir, ['render', 'cancel-gate', UNIT], as());

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
      const waits = refuses(at.dir, ['brief', 'builder', UNIT, '1.1'], as()).error;
      const started = ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      const back = { out: [out(at.dir), out(at.lib)], files: Object.keys(UNCOMMITTED).map((file) => fs.readFileSync(path.join(at.dir, file), 'utf8')) };
      ok(at.dir, ['commit', '--paths', ...Object.keys(UNCOMMITTED), '--task', UNIT, '1.1', '-m', `fix(${UNIT}): keep the old alias`], as());
      ok(at.dir, ['land', 'open', UNIT, '1.1'], as());

      const hosted = side.on(at.dir) !== at.dir;
      assert.deepStrictEqual([before, cancelled.pull_requests_closed, cancelled.checkout], [[true, true], true, 'main']);
      assert.match(gate, new RegExp(` It ${hosted ? 'closes its open pull requests and keeps' : 'keeps'} ${BRANCH}, taking each checkout off it, any work not committed set aside and kept\\.`));
      assert.deepStrictEqual(left, { open: [false, false], tips, out: ['main', NESTED.lib.into], status: '' });
      assert.deepStrictEqual(receipt.replace(/\n {2}/g, ' ').split('\n'), [
        '"Typo" marked as cancelled.',
        ...(hosted ? ['⚑ Its open pull requests were closed, each branch kept: #1; #1 in lib'] : []),
        `⚑ Its commits stay on ${BRANCH}, ${BRANCH} in lib, kept for a reactivate to carry on from`,
        `⚑ Task 1.1's work, set aside as the quick-fix was cancelled, is kept in the project's repository at ${ASIDE} — ${calls('git')}`,
        `⚑ Task 1.1's work, set aside as the quick-fix was cancelled, is kept in lib at ${ASIDE} — ${calls('git -C lib')}`,
        '',
      ]);
      assert.match(waits, /task 1\.1 of typo's work, set aside as the quick-fix was cancelled, is not back in the checkout/);
      assert.deepStrictEqual([[...started.put_back].sort(), back], [Object.keys(UNCOMMITTED).sort(), { out: [BRANCH, BRANCH], files: Object.values(UNCOMMITTED) }]);
      assert.deepStrictEqual([side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)], [true, true]);
    });

    it('19.5.28: reactivated, the fix\'s start refuses the person\'s own changes in each checkout it would put back on the branch — a new file and an edit of a file the fix changed, in the project and in the nested clone — naming each, nothing moved', () => {
      const at = project();
      opened(at, 1, FIX);
      ok(at.dir, ['workunit', 'cancel', UNIT], as());
      ok(at.dir, ['workunit', 'reactivate', UNIT], as());
      entered(at.dir, as());
      const mine = { 'notes/mine.md': 'my own note\n', 'src/flag.js': 'const flag = \'mine\';\n', 'lib/mine.txt': 'mine\n', 'lib/lib.txt': 'lib --mine\n' };
      for (const [file, text] of Object.entries(mine)) createFile(at.dir, file, text);

      const refusal = refuses(at.dir, ['task', 'start', UNIT, '1.1'], as()).error;

      const named = /^task start: task 1\.1 of typo is built in the project's own checkout, which holds changes not committed — (.+) — so it was not put on typo's branch: commit them or set them aside, then start the task again$/.exec(refusal);
      assert.deepStrictEqual([named?.[1].split(', ').sort(), out(at.dir), out(at.lib)], [Object.keys(mine).sort(), 'main', NESTED.lib.into]);
    });
  });
}
