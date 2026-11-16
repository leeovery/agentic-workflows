'use strict';

// ---------------------------------------------------------------------------
// The local landing driver across nested repositories (ledger-engine/
// scripts/drivers/landing/local/driver.cjs), past what every driver gives
// (the nested conformance suite's): the project's default branch moved where
// its checkout has it out, each clone's checkout moved by its own landing
// and kept on its default branch, stopping where a change the landing would
// move is staged there; and a project that is a folder of a larger
// repository landing a clone in it (7.2.17). The nested repositories the
// driver passes over or refuses are test-engine-land-nested-refusals.cjs's.
// Git layer: the nested world (landing-world.cjs), built once and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, tip, initRepo, commitCode } = require('./engine-harness.cjs');
const { BASE, NESTED, NESTED_TASKS, openArgs, track, commitFiles, setLandingDriver, useNestedWorld, landingCommits } = require('./landing-world.cjs');

const { rates } = NESTED_TASKS;
const project = useNestedWorld('engine-land-nested-', (dir) => setLandingDriver(dir, 'local'));

describe('land phase: the local driver across nested repositories', () => {
  it('moves the project\'s default branch where its checkout has it out, each clone\'s checkout moved by its own landing and kept on its default branch — but stops where a change the landing would move is staged there, as any change not committed', () => {
    const at = project();
    fs.writeFileSync(path.join(at.dir, 'rates.txt'), 'mine\n');
    git(at.dir, ['add', 'rates.txt']);
    ok(at.dir, openArgs(rates));
    const before = tip(at.dir, 'main');
    assert.match(
      refuses(at.dir, ['land', 'phase', 'pay', '1']).error,
      new RegExp(`^land: main is checked out at ${at.dir}, with changes not committed: rates.txt, so nothing moved — .+ \\(phase 1 merged in ext, lib before it\\)$`),
    );
    assert.strictEqual(tip(at.dir, 'main'), before);
    git(at.dir, ['reset', '-q', '--hard']);
    ok(at.dir, ['land', 'phase', 'pay', '1']);
    assert.strictEqual(git(at.dir, ['rev-parse', 'HEAD']).trim(), tip(at.dir, 'main'));
    for (const [clone, { into }] of [[at.ext, NESTED.ext], [at.lib, NESTED.lib]]) {
      assert.deepStrictEqual([git(clone, ['rev-parse', '--symbolic-full-name', 'HEAD']).trim(), git(clone, ['rev-parse', 'HEAD']).trim()], [`refs/heads/${into}`, tip(clone, into)]);
    }
  });

  it('lands a clone in a project that is a folder of a larger repository, in the clone before the project (7.2.17)', () => {
    const at = project();
    const app = path.join(at.dir, 'app');
    fs.mkdirSync(app);
    fs.writeFileSync(path.join(app, 'app.txt'), 'app\n');
    commitCode(at.dir, 'the app');
    const deep = initRepo(path.join(app, 'deep'));
    git(deep, ['commit', '-q', '--allow-empty', '-m', 'deep']);
    git(deep, ['tag', BASE]);
    const task = track(at.dir, '1.5', 'feat', 'Go deep');
    commitFiles(deep, task.branch, 'main', { 'deep.txt': 'deep\n' });
    commitFiles(at.dir, task.branch, 'main', { 'app/deep.txt': 'deep\n' });

    assert.deepStrictEqual(ok(app, openArgs(task)).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['deep', '.']);
    ok(app, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual([landingCommits(deep).map(([shown]) => shown), landingCommits(at.dir).map(([shown]) => shown).slice(-1)], [['pay-1-5'], ['pay-1-5']]);
  });
});
