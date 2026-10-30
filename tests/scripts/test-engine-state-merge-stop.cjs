'use strict';

// ---------------------------------------------------------------------------
// The merge's kept stop (leeway-engine/scripts/domain/state-merge.cjs):
// kept in the state worktree's git dir for the person's picks, answerable
// from a new session, asked afresh as either side moves, a pick for a choice
// no longer asked refused, and finished by the next catch-up once every field
// is picked, a kill between included.
//
// Layer: git. World: real repositories in a temp folder per test, a project
// on a bare remote and a second clone of it on "another machine", each with
// its state worktree made through the machinery (state-merge-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { git, tip, remoteTip, layout, commitOnState } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState, pendingStateMerge, pickStateMerge, stateMergeGateSurface } = require(MERGE);

const { createFile, readFile } = require('./discovery-test-utils.cjs');
const { useWorld, machinesSharing, status, commitUnpushed, projectManifest, keptStopFile, shownChoice, pickShown, mergeLeftovers, killedAfter } = require('./state-merge-world.cjs');

const world = useWorld();

describe('a kept stop', () => {
  /** Two machines stopped on the roadmap item's horizon. */
  function stopped() {
    const machines = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    commitUnpushed(machines.here, { [layout.projectManifest]: projectManifest('next') });
    commitOnState(machines.there.root, { [layout.projectManifest]: projectManifest('someday') });
    assert.strictEqual(catchUpState(machines.here.root).action, 'stopped');
    return machines;
  }

  it('is kept in the state worktree\'s git dir, never on the branch or in the worktree', () => {
    const { here } = stopped();

    const file = keptStopFile(here.root);
    assert.ok(fs.existsSync(file));
    assert.ok(file.startsWith(path.join(here.main, '.git') + path.sep), file);
    assert.strictEqual(status(here.root), '');
    assert.ok(!git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH]).includes('leeway-merge'));
    const gitDir = path.dirname(file);
    assert.deepStrictEqual(fs.readdirSync(gitDir).filter((name) => name.startsWith('leeway-')), ['leeway-merge.json']);
  });

  it('is still answerable from a new session', () => {
    const { here, bare } = stopped();
    const session = [
      'const [mod, main, root] = process.argv.slice(1);',
      'const merge = require(mod);',
      "const before = merge.pendingStateMerge(root).conflicts.map((c) => c.label.path);",
      "const out = merge.pickStateMerge(root, '1', /^choice: (\\S+)$/m.exec(merge.stateMergeGateSurface(main, {}))[1]);",
      'process.stdout.write(JSON.stringify({ before, action: out.action, pushed: out.pushed }));',
    ].join('\n');

    const res = spawnSync('node', ['-e', session, MERGE, here.main, here.root], { encoding: 'utf8' });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(JSON.parse(res.stdout), { before: ['roadmap.items.a-lifetime-tier.horizon'], action: 'merged', pushed: true });
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(JSON.parse(readFile(here.root, layout.projectManifest)).roadmap.items['a-lifetime-tier'].horizon, 'next');
  });

  it('keeps the picks made so far through a catch-up that finds the same sides', () => {
    const { here, there } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next', { defaults: { plan_format: 'tick' } }) });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday', { defaults: { plan_format: 'linear' } }) });
    catchUpState(here.root);
    pickShown(here, '2');

    const again = catchUpState(here.root);

    assert.deepStrictEqual([again.action, again.conflicts.map((c) => c.pick)], ['stopped', ['remote', null]]);
    assert.strictEqual(pickShown(here, '1').action, 'merged');
    const merged = JSON.parse(readFile(here.root, layout.projectManifest));
    assert.deepStrictEqual([merged.defaults.plan_format, merged.roadmap.items['a-lifetime-tier'].horizon], ['linear', 'next']);
  });

  it('asks the new choice once the remote moves under a pick, the old pick not taken for it', () => {
    const { here, there, bare } = stopped();
    const moved = commitOnState(there.root, { [layout.projectManifest]: projectManifest('later') }).commit;

    const out = pickShown(here, '1');

    assert.strictEqual(out.action, 'stopped');
    assert.deepStrictEqual([out.conflicts[0].remote, out.conflicts[0].pick], [{ set: true, value: 'later' }, null]);
    assert.match(out.warnings.join('\n'), /sides moved since it stopped/);
    assert.strictEqual(remoteTip(bare), moved);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(keptStopFile(here.root), 'utf8')).conflicts.map((c) => [c.remote.value, c.pick]), [['later', null]]);
  });

  it('takes a pick shown before this clone moved where the merge still asks the same choice', () => {
    const { here } = stopped();
    const shown = shownChoice(here);

    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next', { defaults: { plan_format: 'tick' } }) });

    assert.strictEqual(shownChoice(here), shown);
    assert.strictEqual(pickStateMerge(here.root, '1', shown).action, 'merged');
    const merged = JSON.parse(readFile(here.root, layout.projectManifest));
    assert.deepStrictEqual([merged.defaults.plan_format, merged.roadmap.items['a-lifetime-tier'].horizon], ['tick', 'next']);
  });

  it('refuses a pick for a choice the merge no longer asks, the stop rewritten by another catch-up between its screen and the pick', () => {
    const { here, there } = stopped();
    const shown = shownChoice(here);
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('later') });
    assert.strictEqual(catchUpState(here.root).action, 'stopped');

    const refused = pickStateMerge(here.root, '1', shown);

    assert.deepStrictEqual([refused.action, refused.conflicts.map((c) => [c.remote, c.pick])], ['stopped', [[{ set: true, value: 'later' }, null]]]);
    assert.deepStrictEqual(refused.warnings, ['the pick answered a question the state merge no longer asks, so it was not taken']);
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('next'));
    assert.notStrictEqual(shownChoice(here), shown);

    assert.strictEqual(pickShown(here, '2').action, 'fast-forwarded');
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('later'));
  });

  it('asks afresh as this clone moves, showing this machine\'s value as it now stands', () => {
    const { here } = stopped();
    const shown = shownChoice(here);

    commitUnpushed(here, { [layout.projectManifest]: projectManifest('never') });

    assert.match(stateMergeGateSurface(here.main, {}), /^> - this machine: never$/m);
    assert.strictEqual(pickStateMerge(here.root, '1', shown).action, 'stopped');
    assert.strictEqual(pickShown(here, '1').action, 'merged');
    assert.strictEqual(JSON.parse(readFile(here.root, layout.projectManifest)).roadmap.items['a-lifetime-tier'].horizon, 'never');
  });

  it('asks with the uncommitted value as the working tree now holds it', () => {
    const { here, there } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    createFile(here.root, layout.projectManifest, projectManifest('next'));
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    assert.strictEqual(catchUpState(here.root).action, 'stopped');

    createFile(here.root, layout.projectManifest, projectManifest('never'));

    assert.deepStrictEqual(pendingStateMerge(here.root)?.conflicts.map((c) => c.local), [{ set: true, value: 'never' }]);
  });

  it('with every field picked offline, is not asked again, and the next catch-up finishes it', () => {
    const { here, bare } = stopped();
    const away = path.join(world(), 'moved-away.git');
    fs.renameSync(bare, away);

    const offline = pickShown(here, '1');

    assert.strictEqual(offline.action, 'unreachable');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(keptStopFile(here.root), 'utf8')).conflicts.map((c) => c.pick), ['local']);
    assert.strictEqual(pendingStateMerge(here.root), null);
    assert.throws(() => stateMergeGateSurface(here.main, {}), /^Error: render state-merge-gate: no state merge is waiting on a pick$/);

    fs.renameSync(away, bare);
    const online = catchUpState(here.root);

    assert.deepStrictEqual([online.action, online.pushed], ['merged', true]);
    assert.strictEqual(JSON.parse(readFile(here.root, layout.projectManifest)).roadmap.items['a-lifetime-tier'].horizon, 'next');
    assert.ok(!fs.existsSync(keptStopFile(here.root)));
  });

  it('asks nothing while a landing a kill cut short stands, and the next catch-up finishes it with no question', () => {
    const { here, there } = stopped();
    killedAfter(here.root, `merge.pickStateMerge(root, '2', '${shownChoice(here)}')`, 'reset --quiet');
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('later') });
    git(here.main, ['fetch', '-q', 'origin']);

    assert.strictEqual(pendingStateMerge(here.root), null);
    assert.throws(() => pickStateMerge(here.root, '1', 'a1b2c3d4e5f6'), /^Error: no state merge is waiting on a pick$/);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.conflicts], ['fast-forwarded', []]);
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('later'));
    assert.deepStrictEqual(mergeLeftovers(here.root), []);
  });

  it('with every field picked and the pick killed before it finished, is finished by the next catch-up', () => {
    const { here, bare } = stopped();

    killedAfter(here.root, `merge.pickStateMerge(root, '2', '${shownChoice(here)}')`, 'ls-remote');

    assert.deepStrictEqual(JSON.parse(fs.readFileSync(keptStopFile(here.root), 'utf8')).conflicts.map((c) => c.pick), ['remote']);
    assert.strictEqual(pendingStateMerge(here.root), null);

    const out = catchUpState(here.root);

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(tip(here.main, STATE_BRANCH), remoteTip(bare));
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('someday'));
  });
});
