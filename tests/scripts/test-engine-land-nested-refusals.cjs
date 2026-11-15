'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's nested repositories it passes over or refuses
// (leeway-engine/scripts/drivers/landing/local/driver.cjs): a clone with no
// default branch, the unit's branches in it holding nothing, passed over in
// every verb; a task's branch moving the submodule's pointer to a commit
// the submodule here does not hold refused at the open, naming both, and
// opened once it is fetched; and a default branch pointing the submodule at
// a commit the submodule's own does not hold refused before anything
// merges, naming it, a fetch of it no way on, and landed past it once the
// submodule's is pulled up to it. How the pointer moves as a phase lands is
// test-engine-land-nested.cjs's. Git layer: the nested world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, refuses, git, tip, initRepo } = require('./engine-harness.cjs');
const {
  NESTED, NESTED_TASKS, openArgs, track, commitFiles, setLandingDriver, useNestedWorld, refusedMoving, finishReady, pointersOn, extUpstream,
} = require('./landing-world.cjs');

const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('engine-land-nested-refusals-', (dir) => setLandingDriver(dir, 'local'));

describe('land: the nested repositories the local driver passes over or refuses', () => {
  it('passes over, in every verb, a clone the unit never touched that has no default branch to land on, though it holds the unit\'s branches', () => {
    const at = project();
    const odd = initRepo(path.join(at.dir, 'odd'));
    git(odd, ['symbolic-ref', 'HEAD', 'refs/heads/work']);
    git(odd, ['commit', '-q', '--allow-empty', '-m', 'odd']);
    for (const task of [rates, show]) git(odd, ['branch', task.branch]);
    const repos = (/** @type {{repos: {repo: string}[]}} */ answer) => answer.repos.map(({ repo }) => repo);

    assert.deepStrictEqual(repos(ok(at.dir, openArgs(rates))), ['ext', 'lib', '.']);
    assert.deepStrictEqual(repos(ok(at.dir, openArgs(show))), ['.']);
    assert.deepStrictEqual(repos(ok(at.dir, ['land', 'chain', 'pay', '1.2'])), ['.']);
    assert.deepStrictEqual(repos(ok(at.dir, ['land', 'phase', 'pay', '1'])), ['ext', 'lib', '.']);
    finishReady(at.dir);
    assert.deepStrictEqual(repos(ok(at.dir, ['land', 'finish', 'pay'])), []);
  });

  it('refuses, before anything opens, a task moving the submodule\'s pointer to a commit the submodule here does not hold — made in a clone of its own — naming both, and opens it once the commit is there', () => {
    const at = project();
    const task = track(at.dir, '2.2', 'feat', 'Elsewhere');
    const elsewhere = commitFiles(extUpstream(at), task.branch, 'main', { 'ext-elsewhere.txt': 'elsewhere\n' });
    commitFiles(at.dir, task.branch, 'main', { 'elsewhere.txt': 'elsewhere\n' }, { gitlinks: { [NESTED.ext.folder]: elsewhere } });

    assert.strictEqual(
      refusedMoving(at.dir, openArgs(task)),
      `land: task 2.2's branch ${task.branch} points ext at ${elsewhere.slice(0, 7)}, a commit ext here does not hold — commit the change in ext, on ${task.branch}, and open the task again`,
    );
    assert.strictEqual(git(at.ext, ['branch', '--list', task.branch]).trim(), '');
    git(at.ext, ['fetch', '-q', extUpstream(at), `${task.branch}:${task.branch}`]);
    assert.deepStrictEqual(ok(at.dir, openArgs(task)).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['ext', '.']);
  });

  it('refuses, before anything merges, a phase whose default branch points the submodule at a commit the submodule\'s own default branch does not hold — the project pulled, the submodule not — naming it, though the commit is fetched, and lands past it once the submodule\'s default branch is pulled up to it', () => {
    const at = project();
    const pulled = commitFiles(extUpstream(at), 'main', 'main', { 'ext-pulled.txt': 'pulled\n' });
    commitFiles(at.dir, 'main', 'main', {}, { gitlinks: { [NESTED.ext.folder]: pulled }, message: 'bump ext' });
    git(at.dir, ['reset', '-q']);
    const task = track(at.dir, '2.2', 'feat', 'More ext');
    const more = commitFiles(at.ext, task.branch, 'main', { 'ext-more.txt': 'more\n' });
    commitFiles(at.dir, task.branch, 'main', { 'more.txt': 'more\n' }, { gitlinks: { [NESTED.ext.folder]: more } });
    ok(at.dir, openArgs(task));
    const ext = tip(at.ext, 'main');
    const refusal = `land: main points ext at ${pulled.slice(0, 7)}, a commit ext's main does not hold — bring ext's main up to it, as \`git -C ext pull\` does where its remote holds it, and land again`;

    assert.strictEqual(refuses(at.dir, ['land', 'phase', 'pay', '2']).error, refusal);
    git(at.ext, ['fetch', '-q', extUpstream(at), 'main']);
    assert.strictEqual(refuses(at.dir, ['land', 'phase', 'pay', '2']).error, refusal);
    assert.strictEqual(tip(at.ext, 'main'), ext);
    git(at.ext, ['pull', '-q', '--ff-only', extUpstream(at), 'main']);
    ok(at.dir, ['land', 'phase', 'pay', '2']);
    const [[landed, pointer]] = pointersOn(at.dir).slice(-1);
    assert.deepStrictEqual([landed, pointer, git(at.ext, ['rev-parse', `${pointer}^`]).trim()], ['pay-2-2', tip(at.ext, 'main'), pulled]);
  });
});
