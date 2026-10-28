'use strict';

// ---------------------------------------------------------------------------
// The catch-up at boot (workflow-engine/scripts/domain/boot.cjs with
// domain/state-merge.cjs): run before the migrations, a merge stop ending
// boot there, and what a failed push left behind pushed.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const {
  useWorld, engine, read, tip, remoteTip, cloneOf, boot, setUp, commitOnState,
} = require('./boot-state-world.cjs');

const world = useWorld();

// --- the catch-up at boot ------------------------------------------------------------

/** Two clones of one project's state: `there` set up and pushed, `here` a clone of it. */
function twoClones() {
  const bare = harness.bareRepo(path.join(world(), 'portal.git'));
  const there = setUp({ name: 'there', remote: bare });
  commitOnState(there.root, { 'manifest.json': JSON.stringify({ defaults: { plan_format: 'local' } }, null, 2) + '\n' });
  const main = cloneOf(bare, 'here');
  boot(main);
  return { bare, there, here: { main, root: path.join(main, '.leeway') } };
}

describe('the catch-up at boot (4.7.8)', () => {
  it('fast-forwards a branch only the remote moved before the migrations run (4.S36)', () => {
    const { there, here } = twoClones();
    const moved = commitOnState(there.root, { 'notes.md': 'from there\n' }).commit;
    const mark = path.join(world(), 'migrated');

    const res = boot(here.main, { STUB_MIGRATE_MARK: mark });

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    assert.strictEqual(tip(here.main, STATE_BRANCH), moved);
    assert.strictEqual(read(here.root, 'notes.md'), 'from there\n');
    assert.strictEqual(fs.readFileSync(mark, 'utf8').trim(), moved, 'the migrations ran over the state already caught up');
  });

  it('a merge stopped by a field both clones changed ends boot there, with no migrations run; the screen and the pick answer it, and the next boot carries on', () => {
    const { bare, there, here } = twoClones();
    git(here.main, ['config', 'remote.origin.pushurl', path.join(world(), 'nowhere.git')]);
    commitOnState(here.root, { 'manifest.json': JSON.stringify({ defaults: { plan_format: 'tick' } }, null, 2) + '\n' });
    git(here.main, ['config', '--unset', 'remote.origin.pushurl']);
    commitOnState(there.root, { 'manifest.json': JSON.stringify({ defaults: { plan_format: 'linear' } }, null, 2) + '\n' });
    const mark = path.join(world(), 'migrated');

    assert.deepStrictEqual(boot(here.main, { STUB_MIGRATE_MARK: mark }), { ok: true, state: 'merge', warnings: [] });
    assert.ok(!fs.existsSync(mark), 'the migrations ran past the stop');

    const screen = engine.output(here.main, ['render', 'state-merge-gate']);
    assert.match(screen, /⚑ The state merge stopped: one field changed on both machines/);
    const choice = /^choice: (\S+)$/m.exec(screen);
    assert.ok(choice !== null);
    const picked = engine.ok(here.main, ['state-merge', 'pick', '1', choice[1]]);
    assert.strictEqual(picked.action, 'merged');

    const res = boot(here.main, { STUB_MIGRATE_MARK: mark });
    assert.strictEqual(res.state, 'ready');
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).defaults.plan_format, 'tick');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(fs.readFileSync(mark, 'utf8').trim(), tip(here.main, STATE_BRANCH));
  });

  it('pushes what a failed push left behind, the remote not moved since', () => {
    const { bare, here } = twoClones();
    git(here.main, ['config', 'remote.origin.pushurl', path.join(world(), 'nowhere.git')]);
    const unpushed = commitOnState(here.root, { 'notes.md': 'unpushed\n' }).commit;
    git(here.main, ['config', '--unset', 'remote.origin.pushurl']);
    assert.notStrictEqual(remoteTip(bare), unpushed);

    assert.strictEqual(boot(here.main).state, 'ready');

    assert.strictEqual(remoteTip(bare), unpushed);
  });
});
