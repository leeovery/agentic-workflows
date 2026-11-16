'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver across nested repositories (leeway-engine/
// scripts/drivers/landing/github/), each repository asked in turn, past what
// every driver gives (the nested conformance suite's): the squash default
// set by one yes on the project's repository and each nested one on GitHub,
// and a stack in a repository nested since refused, naming that yes; a merge
// refused in one repository carrying the warnings of those landed before it;
// and a task squashed by hand under the person's own message in every
// repository it touches, read landed (7.2.22, R25). The remotes a task's
// repositories land through are test-landing-nested.cjs's. Git layer: the
// nested world (landing-world.cjs), each repository on a fake GitHub of its
// own (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('../../scripts/engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, commitFiles, useNestedWorld } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GITHUB_SQUASH } = require('./gh-stub.cjs');
const { github, onGithub, calls, ok, refused } = require('./world.cjs');

const { git } = harness;
const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('github-landing-nested-each-', (dir) => {
  side.prepare(dir);
  for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
});

describe('GitHub\'s landing driver across nested repositories, each asked in turn (7.2.17)', () => {
  it('sets the squash default, on one yes, on the project\'s repository and each nested one on GitHub, each read first and left as it is where set; a stack in a repository nested since refused, naming that yes, taken again once answered', () => {
    const at = project();
    const squashing = (/** @type {ReturnType<typeof github>} */ state) => {
      state.squash = { ...GITHUB_SQUASH };
    };
    for (const dir of [at.dir, at.ext]) onGithub(dir, squashing);
    const read = (/** @type {string} */ repo) => ['auth status --hostname github.com', `api repos/acme/${repo}`];
    const set = (/** @type {string} */ repo) => `api --method PATCH repos/acme/${repo} -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY -F allow_merge_commit=true`;
    const squashes = () => [at.dir, at.ext, at.lib].map((dir) => github(dir).squash);
    const fromPulls = { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'PR_BODY' };

    assert.strictEqual(ok(at.dir, ['github-squash', 'yes']).github_squash, 'set');
    assert.deepStrictEqual([at.dir, at.ext, at.lib].map(calls), [[...read('portal'), set('portal')], [...read('ext'), set('ext')], read('lib')]);
    assert.deepStrictEqual(squashes(), [fromPulls, fromPulls, fromPulls]);

    onGithub(at.lib, squashing);
    commitFiles(at.lib, show.branch, rates.branch, { 'lib-show.txt': 'show\n' });
    for (const task of [rates, show]) ok(at.dir, openArgs(task));
    assert.strictEqual(
      refused(at.dir, ['land', 'phase', 'pay', '1']),
      'land: in lib, acme/lib does not squash a pull request into its title and description, so phase 1\'s stack would land under other subjects than its tasks\' — '
      + 'set that squash default on every repository the project lands in on GitHub, as `engine github-squash yes` does, and land again (phase 1 merged in ext before it)',
    );
    const before = [at.dir, at.ext].map((dir) => calls(dir).length);
    assert.strictEqual(ok(at.dir, ['github-squash', 'yes']).github_squash, 'set');
    assert.deepStrictEqual([at.dir, at.ext].map((dir, i) => calls(dir).slice(before[i])), [read('portal'), read('ext')]);
    assert.deepStrictEqual([calls(at.lib).slice(-3), squashes()], [[...read('lib'), set('lib')], [fromPulls, fromPulls, fromPulls]]);
  });

  it('refuses a merge in one repository carrying the warnings of those landed before it', () => {
    const at = project();
    ok(at.dir, openArgs(rates));
    fs.writeFileSync(path.join(at.ext, 'local.txt'), 'local\n');
    git(at.ext, ['add', 'local.txt']);
    git(at.ext, ['commit', '-q', '-m', 'local work']);
    const { env } = side.refuseMerge(at.lib);

    assert.match(
      refused(at.dir, ['land', 'phase', 'pay', '1'], env),
      /^land: in lib, .+ \(phase 1 merged in ext before it\) — and in ext, main here holds commits origin\/main does not, so it was not moved to the merge — bring it up to date with origin\/main yourself$/,
    );
  });

  it('a task squashed by hand under the person\'s own message in each repository it touches, its two commits in the project\'s: landed in every one, its phase answered merged (7.2.22, R25)', () => {
    const at = project();
    commitFiles(at.dir, rates.branch, rates.branch, { 'rates-more.txt': 'more\n' });
    git(at.dir, ['branch', '-f', show.branch, rates.branch]);
    ok(at.dir, openArgs(rates));
    for (const [repo, into] of [[at.dir, 'main'], [at.ext, NESTED.ext.into], [at.lib, NESTED.lib.into]]) {
      onGithub(repo, (state) => { state.squash = { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'BLANK' }; });
      side.mergedOnGithub(repo, rates.branch, 'squash', true, into);
    }
    const merged = { ok: true, phase: 1, already: true, repos: [], driver: 'github' };

    assert.deepStrictEqual(ok(at.dir, ['land', 'phase', 'pay', '1']), merged);
  });
});
