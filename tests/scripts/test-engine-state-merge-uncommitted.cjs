'use strict';

// ---------------------------------------------------------------------------
// The working tree's uncommitted state through a catch-up
// (workflow-engine/scripts/domain/state-merge-worktree.cjs): an uncommitted
// file merged in place with the update and never committed, a field it and
// the update changed differently asked of the person, and a file and a
// folder at one path set beside each other.
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

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState, stateMergeGateSurface } = require(MERGE);

const { createFile, readFile } = require('./discovery-test-utils.cjs');
const { useWorld, machinesSharing, blobId, treeId, status, commitUnpushed, ledger, projectManifest, appendOnly, pickShown } = require('./state-merge-world.cjs');

/** @typedef {import('./state-merge-world.cjs').Machine} Machine */

useWorld();

describe('the worktree\'s uncommitted state through a catch-up', () => {
  it('leaves an uncommitted file the update does not touch exactly as it was, uncommitted, through a fast-forward', () => {
    const { here, there, bare } = machinesSharing({ 'unit/topics/a/log.md': '# a\n', 'unit/topics/c/log.md': '# c\n' });
    createFile(here.root, 'unit/topics/a/log.md', '# a\n\n## a session not yet committed\n');
    createFile(here.root, 'unit/topics/b/log.md', '# b, new and uncommitted\n');
    const theirs = commitOnState(there.root, { 'unit/topics/c/log.md': '# c\n\n## elsewhere\n' }).commit;

    const out = catchUpState(here.root);

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(tip(here.main, STATE_BRANCH), theirs);
    assert.strictEqual(remoteTip(bare), theirs);
    assert.deepStrictEqual(out.uncommitted, { kept: ['unit/topics/a/log.md', 'unit/topics/b/log.md'], merged: [] });
    assert.strictEqual(readFile(here.root, 'unit/topics/a/log.md'), '# a\n\n## a session not yet committed\n');
    assert.strictEqual(readFile(here.root, 'unit/topics/b/log.md'), '# b, new and uncommitted\n');
    assert.strictEqual(readFile(here.root, 'unit/topics/c/log.md'), '# c\n\n## elsewhere\n');
    assert.strictEqual(status(here.root), ' M unit/topics/a/log.md\n?? unit/topics/b/log.md\n');
  });

  it('fast-forwards with no new commit where only the remote moved, merging an uncommitted file it changed in place, still uncommitted', () => {
    const { here, there, bare } = machinesSharing({ 'unit/topics/a/log.md': '# a\n\n## first\n' });
    createFile(here.root, 'unit/topics/a/log.md', '# a\n\n## first\n\n## here, uncommitted\n');
    const theirsText = '# a\n\n## first\n\n## elsewhere\n';
    const theirs = commitOnState(there.root, { 'unit/topics/a/log.md': theirsText }).commit;

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, theirs]);
    assert.deepStrictEqual(out.uncommitted, { kept: [], merged: ['unit/topics/a/log.md'] });
    assert.strictEqual(tip(here.main, STATE_BRANCH), theirs);
    assert.strictEqual(remoteTip(bare), theirs);
    assert.strictEqual(git(bare, ['show', `${STATE_BRANCH}:unit/topics/a/log.md`]), theirsText);
    assert.strictEqual(readFile(here.root, 'unit/topics/a/log.md'), '# a\n\n## first\n\n## elsewhere\n## here, uncommitted\n');
    assert.strictEqual(status(here.root), ' M unit/topics/a/log.md\n');
    assert.match(out.warnings.join('\n'), /unit\/topics\/a\/log\.md was changed in the same place on both machines/);
  });

  it('merges committed state alone into the merge commit where both moved, the uncommitted bytes merged into the working tree', () => {
    const { here, there, bare } = machinesSharing({ [layout.ledger]: ledger('base'), 'unit/topics/a/log.md': '# a\n' });
    commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1') });
    createFile(here.root, layout.ledger, ledger('base', 'a1', 'u1'));
    createFile(here.root, 'unit/topics/a/log.md', '# a\n\n## here, uncommitted\n');
    commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1'), 'unit/topics/a/log.md': '# a\n\n## elsewhere\n' });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${layout.ledger}`]), ledger('base', 'b1', 'a1'));
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:unit/topics/a/log.md`]), '# a\n\n## elsewhere\n');
    assert.strictEqual(spawnSync('git', ['grep', '-l', '-e', 'u1', '-e', 'uncommitted', STATE_BRANCH, '--', layout.ledger, 'unit/topics/a/log.md'], { cwd: here.main, encoding: 'utf8' }).stdout, '',
      'uncommitted bytes reached the commit');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base', 'b1', 'a1', 'u1'));
    assert.strictEqual(readFile(here.root, 'unit/topics/a/log.md'), '# a\n\n## elsewhere\n## here, uncommitted\n');
    assert.strictEqual(status(here.root), ` M ${layout.ledger}\n M unit/topics/a/log.md\n`);
    assert.ok(appendOnly(here.root), 'the uncommitted ledger no longer starts with the committed one');
  });

  it('stops on a field the uncommitted copy and the update changed differently, its pick written into the working copy, never a commit', () => {
    const { here, there } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    createFile(here.root, layout.projectManifest, projectManifest('next'));
    const theirs = commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') }).commit;
    const before = tip(here.main, STATE_BRANCH);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.commit], ['stopped', before]);
    assert.deepStrictEqual(out.conflicts.map((c) => [c.uncommitted, c.local, c.remote]), [[true, { set: true, value: 'next' }, { set: true, value: 'someday' }]]);
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('next'));

    const picked = pickShown(here, '1');

    assert.deepStrictEqual([picked.action, picked.commit], ['fast-forwarded', theirs]);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]), projectManifest('someday'));
    assert.strictEqual(JSON.parse(readFile(here.root, layout.projectManifest)).roadmap.items['a-lifetime-tier'].horizon, 'next');
    assert.strictEqual(status(here.root), ` M ${layout.projectManifest}\n`);
  });

  /** A stop on the horizon both sides committed, with the working tree's copy changing it again. */
  function stoppedWithWork() {
    const { here, there } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next') });
    createFile(here.root, layout.projectManifest, projectManifest('never'));
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    const out = catchUpState(here.root);
    assert.deepStrictEqual(out.conflicts.map((c) => [c.uncommitted, c.local.set && c.local.value]), [[false, 'next']]);
    return here;
  }

  /** The horizon committed, and the working tree's. @param {Machine} here */
  function horizons(here) {
    return [
      JSON.parse(git(here.main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`])).roadmap.items['a-lifetime-tier'].horizon,
      JSON.parse(readFile(here.root, layout.projectManifest)).roadmap.items['a-lifetime-tier'].horizon,
    ];
  }

  it('asks nothing of a field the working tree changed where the pick on the branch settles it', () => {
    const here = stoppedWithWork();

    assert.strictEqual(pickShown(here, '1').action, 'merged');
    assert.deepStrictEqual(horizons(here), ['next', 'never']);
  });

  it('asks a field the working tree changed once the branch\'s fields are picked, where their pick leaves it standing', () => {
    const here = stoppedWithWork();

    const next = pickShown(here, '2');

    assert.deepStrictEqual(next.conflicts.map((c) => [c.uncommitted, c.local.set && c.local.value, c.pick]), [[false, 'next', 'remote'], [true, 'never', null]]);
    const screen = stateMergeGateSurface(here.main, {});
    assert.match(screen, /^⚑ The state merge stopped: this machine's uncommitted copy and the update changed one field differently$/m);
    assert.match(screen, /^> In .*\n>\n> - this machine's uncommitted copy: never\n> - the update from the remote: someday$/m);
    assert.strictEqual(pickShown(here, '1').action, 'fast-forwarded');
    assert.deepStrictEqual(horizons(here), ['someday', 'never']);
  });

  it('sets an uncommitted folder beside where the update writes a file at its path', () => {
    const { here, there } = machinesSharing({ 'unit/assets/x': 'x was a file\n' });
    fs.rmSync(path.join(here.root, 'unit/assets/x'));
    createFile(here.root, 'unit/assets/x/new.md', 'uncommitted, where x was\n');
    const theirs = commitOnState(there.root, { 'unit/assets/x': 'x changed elsewhere\n' }).commit;

    const out = catchUpState(here.root);

    const beside = `unit/assets/x.${treeId(here.root, { 'new.md': 'uncommitted, where x was\n' }).slice(0, 8)}`;
    assert.deepStrictEqual([out.action, out.commit], ['fast-forwarded', theirs]);
    assert.strictEqual(readFile(here.root, 'unit/assets/x'), 'x changed elsewhere\n');
    assert.strictEqual(readFile(here.root, `${beside}/new.md`), 'uncommitted, where x was\n');
    assert.deepStrictEqual(out.warnings, [
      'unit/assets/x was deleted on one machine and changed on the other: the changed copy is kept',
      `unit/assets/x is a file on the remote and a folder on this machine: the remote's file stays at unit/assets/x, and this machine's folder is kept beside it as ${beside}`,
    ]);
    assert.deepStrictEqual(out.uncommitted, { kept: [], merged: ['unit/assets/x', 'unit/assets/x/new.md'] });
    assert.strictEqual(status(here.root), `?? ${beside}/new.md\n`);
  });

  it('sets an uncommitted file beside where the update writes a folder at its path', () => {
    const { here, there } = machinesSharing({ 'unit/assets/a.md': 'a\n' });
    createFile(here.root, 'unit/assets/y', 'an uncommitted file\n');
    commitOnState(there.root, { 'unit/assets/y/b.md': 'b, there\n' });

    const out = catchUpState(here.root);

    const beside = `unit/assets/y.${blobId('an uncommitted file\n').slice(0, 8)}`;
    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(readFile(here.root, 'unit/assets/y/b.md'), 'b, there\n');
    assert.strictEqual(readFile(here.root, beside), 'an uncommitted file\n');
    assert.deepStrictEqual(out.warnings, [
      `unit/assets/y is a folder on the remote and a file on this machine: the remote's folder stays at unit/assets/y, and this machine's file is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), `?? ${beside}\n`);
  });
});
