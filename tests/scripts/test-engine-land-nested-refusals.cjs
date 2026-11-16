'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's nested repositories it passes over
// (leeway-engine/scripts/drivers/landing/local/driver.cjs): a clone with no
// default branch, the unit's branches in it holding nothing, passed over in
// every verb. The rest of the driver across nested repositories is
// test-engine-land-nested.cjs's. Git layer: the nested world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, git, initRepo } = require('./engine-harness.cjs');
const { NESTED_TASKS, openArgs, setLandingDriver, useNestedWorld, finishReady } = require('./landing-world.cjs');

const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('engine-land-nested-refusals-', (dir) => setLandingDriver(dir, 'local'));

describe('land: the nested repositories the local driver passes over', () => {
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
});
