'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix cancelled with its pull request
// open in the project and in a nested clone, and the fix holding its
// worktree holding work not committed (18.3.9, 18.S75, 19.5.29), its
// confirm saying what the yes does to them: the contract every landing
// driver meets, run through the engine's verbs against each shipped driver
// in turn. The cancel sets the holder's work aside as a park does, takes
// the worktree apart, closes its pull request in each repository and keeps
// the branch under its own name there, the person's checkouts never
// touched; its receipt names the pull requests it closed on a host, the
// branch and the work kept, with the calls that show it, bring it back and
// drop it. Reactivated, the work's refusal names the cancel that set it
// aside, and the fix's start lays the worktree out again on the branch
// before it puts the work back there — in the nested clone onto the fix's
// own change, not onto the branch it lands on — and its next opening opens
// the pull request anew in each repository; its confirm says the close only
// where the driver lands through a host. The person's own changes in their
// checkouts the restart never meets. The cancel of a feature, and of a unit with its own branch:
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

const { ok, okSections, refuses, output, sectionOf, createFile, git } = require('./engine-harness.cjs');
const { UNIT, BRANCH, quickFixNestedConformance, entered, fixTree } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

/** Where fix 1.1's work is set aside. */
const ASIDE = `refs/ledger/aside/${UNIT}/${UNIT}-1-1`;

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
    it('the cancel sets the holder\'s work aside, takes the worktree apart, closes each pull request and keeps each branch under its own name, its receipt naming the pull requests closed, the branch and the work kept; reactivated, the fix\'s start lays the worktree out again on the branch, the work back onto it, and its opening opens each pull request anew — the person\'s checkouts never moved', () => {
      const at = project();
      opened(at, 1, FIX);
      const tree = fixTree(at.dir);
      const trees = [tree, path.join(tree, NESTED.lib.folder)];
      for (const [file, text] of Object.entries(UNCOMMITTED)) createFile(tree, file, text);
      const tips = [at.dir, at.lib].map((repo) => git(repo, ['rev-parse', BRANCH]).trim());
      const before = [side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)];
      const gate = output(at.dir, ['render', 'cancel-gate', UNIT], as());

      const { res: cancelled, sections } = okSections(at.dir, ['workunit', 'cancel', UNIT], as());
      const left = {
        open: [side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)],
        tips: [at.dir, at.lib].map((repo) => git(repo, ['rev-parse', BRANCH]).trim()),
        out: [out(at.dir), out(at.lib)],
        status: git(at.dir, ['status', '--porcelain', '--untracked-files=all']).trim(),
        tree: fs.existsSync(tree),
      };
      const receipt = sectionOf(sections, 'DISPLAY: confirmation');
      ok(at.dir, ['workunit', 'reactivate', UNIT], as());
      entered(at.dir, as());
      const waits = refuses(at.dir, ['brief', 'builder', UNIT, '1.1'], as()).error;
      const started = ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      const back = { out: trees.map(out), mine: [out(at.dir), out(at.lib)], files: Object.keys(UNCOMMITTED).map((file) => fs.readFileSync(path.join(tree, file), 'utf8')) };
      ok(tree, ['commit', '--paths', ...Object.keys(UNCOMMITTED), '--task', UNIT, '1.1', '-m', `fix(${UNIT}): keep the old alias`], as());
      ok(at.dir, ['land', 'open', UNIT, '1.1'], as());

      const hosted = side.on(at.dir) !== at.dir;
      assert.deepStrictEqual([before, cancelled.pull_requests_closed, cancelled.checkout], [[true, true], true, undefined]);
      assert.match(gate, new RegExp(` It ${hosted ? 'closes its open pull requests and keeps' : 'keeps'} ${BRANCH}, taking its worktree apart, any work not committed set aside and kept\\.`));
      assert.deepStrictEqual(left, { open: [false, false], tips, out: ['main', NESTED.lib.into], status: '', tree: false });
      assert.deepStrictEqual(receipt.replace(/\n {2}/g, ' ').split('\n'), [
        '"Typo" marked as cancelled.',
        ...(hosted ? ['⚑ Its open pull requests were closed, each branch kept: #1; #1 in lib'] : []),
        `⚑ Its commits stay on ${BRANCH}, ${BRANCH} in lib, kept for a reactivate to carry on from`,
        `⚑ Task 1.1's work, set aside as the quick-fix was cancelled, is kept in the project's repository at ${ASIDE} — ${calls('git')}`,
        `⚑ Task 1.1's work, set aside as the quick-fix was cancelled, is kept in lib at ${ASIDE} — ${calls('git -C lib')}`,
        '',
      ]);
      assert.match(waits, /task 1\.1 of typo's work, set aside as the quick-fix was cancelled, is not back in typo's worktree/);
      assert.deepStrictEqual([[...started.put_back].sort(), back], [Object.keys(UNCOMMITTED).sort(), { out: [BRANCH, BRANCH], mine: ['main', NESTED.lib.into], files: Object.values(UNCOMMITTED) }]);
      assert.deepStrictEqual([side.quickFixOpen(at.dir, UNIT), side.quickFixOpen(at.lib, UNIT)], [true, true]);
    });

    it('19.5.28: reactivated, the fix\'s start lays the worktree out again beside the person\'s own changes in each checkout — a new file and an edit of a file the fix changed, in the project and in the nested clone — which it never meets', () => {
      const at = project();
      opened(at, 1, FIX);
      ok(at.dir, ['workunit', 'cancel', UNIT], as());
      ok(at.dir, ['workunit', 'reactivate', UNIT], as());
      entered(at.dir, as());
      const mine = { 'notes/mine.md': 'my own note\n', 'src/flag.js': 'const flag = \'mine\';\n', 'lib/mine.txt': 'mine\n', 'lib/lib.txt': 'lib --mine\n' };
      for (const [file, text] of Object.entries(mine)) createFile(at.dir, file, text);

      const started = ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      const tree = fixTree(at.dir);

      assert.deepStrictEqual([started.worktree, out(tree), out(path.join(tree, NESTED.lib.folder)), out(at.dir), out(at.lib)], [tree, BRANCH, BRANCH, 'main', NESTED.lib.into]);
      assert.deepStrictEqual(Object.keys(mine).map((file) => fs.readFileSync(path.join(at.dir, file), 'utf8')), Object.values(mine));
      assert.deepStrictEqual([fs.readFileSync(path.join(tree, 'src/flag.js'), 'utf8'), fs.existsSync(path.join(tree, 'notes/mine.md'))], [FIX['src/flag.js'], false]);
    });
  });
}
