'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver across nested repositories (ledger-engine/
// scripts/drivers/landing/github/), past what every driver gives (the
// nested conformance suite's): a repository a task touches whose remote
// GitHub's driver does not serve — none chosen, or one not on GitHub —
// refused before anything moves, at the open or the merge, naming it, with
// the way on, and one the unit lands nothing in passed over, whatever its
// remote; and the project's stack, a task merged back onto the one below,
// landed under each task's own subject (7.2.17, 7.2.18). What is asked of each repository in
// turn is test-landing-nested-each.cjs's; a stack brought up to date with
// the default branch, test-landing-nested-merge-up.cjs's. Git layer: the
// nested world (landing-world.cjs), each repository on a fake GitHub of its
// own (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('../../scripts/engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, commitFiles, mergeBack, useNestedWorld, finishReady } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { github, bareOf, tipOnGithub, ok, refused } = require('./world.cjs');

const { git, tip, initRepo } = harness;
const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('github-landing-nested-', (dir) => {
  side.prepare(dir);
  for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
});

/** Each pull request's state on GitHub, in each repository at `dirs`. @param {string[]} dirs */
const pullStates = (dirs) => dirs.map((dir) => github(dir).pulls.map(({ state }) => state));

describe('GitHub\'s landing driver across nested repositories (7.2.17)', () => {
  it('refuses, before anything moves, a task touching a repository whose remote it does not serve — none chosen at the open, one not on GitHub at the merge — naming the repository, with the way on', () => {
    const at = project();
    const url = git(at.lib, ['remote', 'get-url', 'origin']).trim();
    git(at.lib, ['remote', 'remove', 'origin']);
    assert.strictEqual(
      refused(at.dir, openArgs(rates)),
      'land: in lib, GitHub\'s driver lands every repository a task touches through that repository\'s own remote, and this one has none chosen — '
      + 'add its repository on GitHub as origin there, or change the landing driver from manage on the start menu',
    );
    assert.deepStrictEqual([pullStates([at.dir, at.ext]), tipOnGithub(at.ext, rates.branch), tipOnGithub(at.dir, rates.branch)], [[[], []], '', '']);

    git(at.lib, ['remote', 'add', 'origin', url]);
    ok(at.dir, openArgs(rates));
    ok(at.dir, openArgs(show));
    git(at.lib, ['remote', 'set-url', 'origin', 'https://git.example.org/acme/lib.git']);
    assert.strictEqual(
      refused(at.dir, ['land', 'phase', 'pay', '1']),
      'land: in lib, its remote, origin, is not on GitHub (https://git.example.org/acme/lib.git), where GitHub\'s driver lands — '
      + 'point it at its repository on GitHub, or change the landing driver from manage on the start menu',
    );
    assert.deepStrictEqual(pullStates([at.dir, at.ext]), [['OPEN', 'OPEN'], ['OPEN']]);
  });

  it('lands the project\'s stack, a task merged back onto the one below, under each task\'s subject; and passes over, in every verb, a clone the unit never touched, with no remote or one not on GitHub, though it holds the unit\'s branches', () => {
    const at = project();
    commitFiles(at.dir, show.branch, 'main', { 'show.txt': 'show\n' });
    mergeBack(at.dir, show.branch, rates.branch);
    for (const [folder, url] of [['plain', null], ['elsewhere', 'https://git.example.org/acme/elsewhere.git']]) {
      const clone = initRepo(path.join(at.dir, folder));
      git(clone, ['commit', '-q', '--allow-empty', '-m', folder]);
      for (const task of [rates, show]) git(clone, ['branch', task.branch]);
      if (url !== null) git(clone, ['remote', 'add', 'origin', url]);
    }
    const repos = (/** @type {{repos: {repo: string}[]}} */ answer) => answer.repos.map(({ repo }) => repo);
    assert.deepStrictEqual(repos(ok(at.dir, openArgs(rates))), ['ext', 'lib', '.']);
    assert.deepStrictEqual(repos(ok(at.dir, openArgs(show))), ['.']);
    assert.deepStrictEqual(repos(ok(at.dir, ['land', 'chain', 'pay', '1.2'])), ['.']);
    assert.deepStrictEqual(repos(ok(at.dir, ['land', 'phase', 'pay', '1'])), ['ext', 'lib', '.']);

    assert.deepStrictEqual(git(bareOf(at.dir), ['log', '--first-parent', '--format=%s', `${rates.branch}..${show.branch}`]).split('\n').filter(Boolean), [
      `merge ${rates.branch} into ${show.branch}`, `work on ${show.branch}`,
    ]);
    assert.strictEqual(tip(at.dir, show.branch), tipOnGithub(at.dir, show.branch), 'the branch here is not at the commit pushed');
    assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), ['feat(pay): Add rates', 'feat(pay): Show rates']);
    finishReady(at.dir);
    assert.deepStrictEqual(repos(ok(at.dir, ['land', 'finish', 'pay'])), []);
  });
});
