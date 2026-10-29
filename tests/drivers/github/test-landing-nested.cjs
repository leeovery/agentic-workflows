'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver across nested repositories (workflow-engine/
// scripts/drivers/landing/github/), past what every driver gives (the
// nested conformance suite's): a repository a task touches whose remote
// GitHub's driver does not serve — none chosen, or one not on GitHub —
// refused before anything moves, at the open or the merge, naming it, with
// the way on, and one the unit lands nothing in passed over, whatever its
// remote; the submodule's pointer recorded at its merged tip in one commit
// on the project's top task branch — a task merged back onto the one below
// moving nothing — pushed before the project's stack merges, which squashes
// it into the top task's landing under that task's own subject (7.2.17,
// 7.2.18); a stack whose squash would meet a pointer both sides moved
// brought up to date with the default branch on GitHub first, one merge per
// branch, and refused before anything is pushed where a merge conflicts in
// a file; the pointer's commit refused before it is pushed where the branch
// is checked out with changes; and a merge refused in one repository
// carrying the warnings of those landed before it. Git layer: the nested
// world (landing-world.cjs), each repository on a fake GitHub of its own
// (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('../../scripts/engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, cutTask, commitFiles, mergeBack, useNestedWorld } = require('../../scripts/landing-world.cjs');
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

  it('records the submodule\'s pointer at its merged tip in one commit on the project\'s top task branch, pushed before the project\'s stack merges — a task merged back onto the one below moving nothing — squashed into the top task\'s landing under that task\'s subject; and passes over, in every verb, a clone the unit never touched, with no remote or one not on GitHub, though it holds the unit\'s branches', () => {
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

    const merged = tipOnGithub(at.ext, NESTED.ext.into);
    const top = bareOf(at.dir);
    assert.deepStrictEqual(git(top, ['log', '--first-parent', '--format=%s', `${rates.branch}..${show.branch}`]).split('\n').filter(Boolean), [
      'chore(pay): point ext at its landing', `merge ${rates.branch} into ${show.branch}`, `work on ${show.branch}`,
    ]);
    assert.strictEqual(git(top, ['rev-parse', `${show.branch}:${NESTED.ext.folder}`]).trim(), merged);
    assert.strictEqual(tip(at.dir, show.branch), tipOnGithub(at.dir, show.branch), 'the branch here is not at the commit pushed');
    assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), ['feat(pay): Add rates', 'feat(pay): Show rates']);
    assert.strictEqual(git(top, ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), merged);
    assert.deepStrictEqual(repos(ok(at.dir, ['land', 'finish', 'pay'])), []);
  });

  it('brings a stack up to date with the default branch on GitHub where a squash would meet a pointer both sides moved — the default branch merged into the bottom, each branch into the one above — and refuses one conflicting in a file before anything is pushed', () => {
    const at = project();
    const fix = cutTask(at.dir, '3.1', 'fix', 'Fix the app', show.branch, { 'fix.txt': 'fix\n' });
    const lower = cutTask(at.dir, '4.1', 'fix', 'Fix the rest', show.branch, { 'rest.txt': 'rest\n' });
    const upper = cutTask(at.dir, '4.2', 'fix', 'Fix it again', lower.branch, { 'fix.txt': 'again\n' });
    for (const task of [rates, show, fix, lower, upper]) ok(at.dir, openArgs(task));
    ok(at.dir, ['land', 'chain', 'pay', '4.2']);
    ok(at.dir, ['land', 'phase', 'pay', '1']);
    const [head, main] = [tipOnGithub(at.dir, fix.branch), tipOnGithub(at.dir, 'main')];

    ok(at.dir, ['land', 'phase', 'pay', '3']);
    const top = bareOf(at.dir);
    const brought = tipOnGithub(at.dir, fix.branch);
    assert.deepStrictEqual(git(top, ['log', '-1', '--format=%s%n%P', brought]).trim().split('\n'), [`chore(pay): merge main into ${fix.branch}`, `${head} ${main}`]);
    assert.strictEqual(tip(at.dir, fix.branch), brought, 'the branch here is not at the commit pushed');
    assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), ['feat(pay): Add rates', 'feat(pay): Show rates', 'fix(pay): Fix the app']);
    assert.strictEqual(git(top, ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), tipOnGithub(at.ext, NESTED.ext.into));

    const heads = [lower, upper].map((task) => tipOnGithub(at.dir, task.branch));
    assert.strictEqual(
      refused(at.dir, ['land', 'phase', 'pay', '4']),
      `land: ${upper.branch} conflicts with origin/main at fix.txt, so nothing was pushed and nothing merged — merge origin/main into ${upper.branch}, settling the conflict, push it, and land again`,
    );
    assert.deepStrictEqual([[lower, upper].map((task) => tipOnGithub(at.dir, task.branch)), [lower, upper].map((task) => tip(at.dir, task.branch))], [heads, heads]);
    assert.deepStrictEqual(pullStates([at.dir]), [['MERGED', 'MERGED', 'MERGED', 'OPEN', 'OPEN']]);
  });

  it('passes over a submodule the phase lands nothing in — its remote not on GitHub, and a task pinning it off its default branch keeping its pin', () => {
    const at = project();
    const release = commitFiles(at.ext, 'release', NESTED.ext.into, { 'release.txt': 'release\n' });
    git(at.ext, ['remote', 'set-url', 'origin', 'https://git.example.org/acme/ext.git']);
    const pin = cutTask(at.dir, '4.1', 'chore', 'Pin ext to its release', 'main', {}, { gitlinks: { [NESTED.ext.folder]: release } });
    ok(at.dir, openArgs(pin));
    ok(at.dir, ['land', 'phase', 'pay', '4']);
    assert.strictEqual(git(bareOf(at.dir), ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), release);
  });

  it('refuses, before the pointer is pushed, a top task branch checked out with changes not committed — nothing pushed, the stack left open', () => {
    const at = project();
    ok(at.dir, openArgs(rates));
    ok(at.dir, openArgs(show));
    const held = path.join(path.dirname(at.dir), 'held');
    git(at.dir, ['worktree', 'add', '-q', held, show.branch]);
    fs.writeFileSync(path.join(held, 'show.txt'), 'changed\n');
    const pushed = tipOnGithub(at.dir, show.branch);

    assert.match(refused(at.dir, ['land', 'phase', 'pay', '1']), new RegExp(`^land: ${show.branch} is checked out at ${held}, with changes not committed: show\\.txt, so nothing moved — .+ \\(phase 1 merged in ext, lib before it\\)$`));
    assert.deepStrictEqual([tipOnGithub(at.dir, show.branch), tip(at.dir, show.branch), pullStates([at.dir])], [pushed, pushed, [['OPEN', 'OPEN']]]);
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
});
