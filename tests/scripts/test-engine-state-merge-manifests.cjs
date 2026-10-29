'use strict';

// ---------------------------------------------------------------------------
// The migrations record and the manifests through a merge where both sides
// moved (workflow-engine/scripts/domain/state-merge-paths.cjs): a migration
// kept once, a field each side changed kept from each, and a field both
// changed differently stopping the merge with nothing written until the
// person picks.
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
const { git, tip, remoteTip } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState, pendingStateMerge, pickStateMerge, stateMergeGateSurface } = require(MERGE);

const { readFile } = require('./discovery-test-utils.cjs');
const { useWorld, parents, status, commitOn, commitUnpushed, twoMachines, ledger, projectManifest, traced, keptStopFile, pickShown } = require('./state-merge-world.cjs');

useWorld();

describe('the migrations record (4.S16)', () => {
  it('keeps one line for a migration both clones applied', () => {
    const { here, there } = twoMachines({ '.state/migrations': '001\n002\n' });
    commitUnpushed(here, { '.state/migrations': '001\n002\n073\n075\n' });
    commitOn(there, { '.state/migrations': '001\n002\n073\n074\n' });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(readFile(here.root, '.state/migrations'), '001\n002\n073\n074\n075\n');
  });
});

describe('the manifests (4.S17)', () => {
  it('keeps both changes where each side changed a different field', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('now', { defaults: { plan_format: 'tick' } }) });
    commitOn(there, { 'manifest.json': projectManifest('next') });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.conflicts], ['merged', []]);
    const merged = JSON.parse(readFile(here.root, 'manifest.json'));
    assert.strictEqual(merged.defaults.plan_format, 'tick');
    assert.strictEqual(merged.roadmap.items['a-lifetime-tier'].horizon, 'next');
  });

  it('stops on a field both sides changed to different values, with both values and nothing written; the pick finishes the merge', () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now'), '.ledger.jsonl': ledger('base') });
    const mine = commitUnpushed(here, { 'manifest.json': projectManifest('next'), '.ledger.jsonl': ledger('base', 'a1') });
    const theirs = commitOn(there, { 'manifest.json': projectManifest('someday'), '.ledger.jsonl': ledger('base', 'b1') }).commit;

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.commit, out.pushed], ['stopped', mine, false]);
    assert.deepStrictEqual(out.conflicts, [{
      manifest: 'manifest.json',
      uncommitted: false,
      field: ['roadmap', 'items', 'a-lifetime-tier', 'horizon'],
      local: { set: true, value: 'next' },
      remote: { set: true, value: 'someday' },
      pick: null,
      label: {
        owner: "Fumi's project manifest",
        subject: 'the roadmap item "A lifetime tier"',
        name: 'A lifetime tier',
        field: 'horizon',
        path: 'roadmap.items.a-lifetime-tier.horizon',
      },
    }]);
    assert.ok(!commands.some((c) => /^(commit-tree|update-ref|push|checkout-index) /.test(c)), `the stop wrote: ${commands.filter((c) => /^(commit-tree|update-ref|push|checkout-index) /.test(c))}`);
    assert.strictEqual(tip(here.main, STATE_BRANCH), mine);
    assert.strictEqual(remoteTip(bare), theirs);
    assert.strictEqual(readFile(here.root, 'manifest.json'), projectManifest('next'));
    assert.strictEqual(readFile(here.root, '.ledger.jsonl'), ledger('base', 'a1'));
    assert.strictEqual(status(here.root), '');

    const picked = pickShown(here, '2');

    assert.deepStrictEqual([picked.action, picked.pushed], ['merged', true]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [theirs]);
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(JSON.parse(readFile(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon, 'someday');
    assert.strictEqual(readFile(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'a1'));
    assert.ok(!fs.existsSync(keptStopFile(here.root)));
    assert.strictEqual(pendingStateMerge(here.root), null);
  });

  it('writes this machine\'s value where the person picks it', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    const picked = pickShown(here, '1');

    assert.strictEqual(picked.action, 'merged');
    assert.strictEqual(JSON.parse(git(here.main, ['show', `${STATE_BRANCH}:manifest.json`])).roadmap.items['a-lifetime-tier'].horizon, 'next');
  });

  it('asks each conflict in turn, and finishes once every one is picked', () => {
    const base = projectManifest('now');
    const { here, there } = twoMachines({ 'manifest.json': base });
    commitUnpushed(here, { 'manifest.json': projectManifest('next', { defaults: { plan_format: 'tick' } }) });
    commitOn(there, { 'manifest.json': projectManifest('someday', { defaults: { plan_format: 'linear' } }) });

    const stopped = catchUpState(here.root);
    assert.deepStrictEqual(stopped.conflicts.map((c) => c.label.path), ['defaults.plan_format', 'roadmap.items.a-lifetime-tier.horizon']);
    assert.match(stateMergeGateSurface(here.main, {}), /Field 1 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed/);

    const next = pickShown(here, '1');
    assert.deepStrictEqual([next.action, next.conflicts.map((c) => c.pick)], ['stopped', ['local', null]]);
    assert.strictEqual(readFile(here.root, 'manifest.json'), projectManifest('next', { defaults: { plan_format: 'tick' } }));
    assert.match(stateMergeGateSurface(here.main, {}), /Field 2 of 2\. In Fumi's project manifest, the horizon of the roadmap item "A lifetime tier" changed/);

    const done = pickShown(here, '2');
    assert.strictEqual(done.action, 'merged');
    const merged = JSON.parse(readFile(here.root, 'manifest.json'));
    assert.deepStrictEqual([merged.defaults.plan_format, merged.roadmap.items['a-lifetime-tier'].horizon], ['tick', 'someday']);
  });

  it('refuses a pick that is neither side, and a pick with nothing waiting', () => {
    const { here } = twoMachines({ 'manifest.json': projectManifest('now') });

    assert.throws(() => pickStateMerge(here.root, '3', 'a1b2c3d4e5f6'), /a state merge pick is 1 \(this machine's value\) or 2 \(the remote's\), got "3"/);
    assert.throws(() => pickStateMerge(here.root, '1', 'a1b2c3d4e5f6'), /^Error: no state merge is waiting on a pick$/);
  });
});
