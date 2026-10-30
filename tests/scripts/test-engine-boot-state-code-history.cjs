'use strict';

// ---------------------------------------------------------------------------
// A leeway-state holding code history
// (leeway-engine/scripts/domain/state-checks.cjs): refused here and on the
// remote, never pushed, refused by the catch-up, and told from a state
// started again elsewhere.
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
const { datedAt } = require('./discovery-test-utils.cjs');
const { git, initRepo, tip, remoteTip, statePath, layout, readState, commitOnState } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH, STATE_LOCK_REASON, createState } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const { useWorld, remoteProject, cloneInWorld, boot, bootRefused, setUp } = require('./boot-state-world.cjs');

const world = useWorld();

const NOTES = layout.assets('unit', 'notes.md');

// --- code history ---------------------------------------------------------------

describe('a leeway-state holding code history (4.9.2, 4.S19)', () => {
  it('here, is refused: no worktree is added onto it, and it is never pushed', () => {
    const { main, bare } = remoteProject();
    git(main, ['branch', STATE_BRANCH]);

    assert.match(bootRefused(main), /^leeway-state holds code history — it shares commits with main, where the state branch is a line of its own — so boot neither checks it out nor pushes it, and wrote nothing\. Rename that branch, and boot sets the state up afresh$/);

    assert.ok(!fs.existsSync(statePath(main)));
    assert.strictEqual(remoteTip(bare), '');
  });

  it('on the remote, is refused: no local branch is made from it', () => {
    const { main, bare } = remoteProject();
    git(main, ['push', '-q', 'origin', `main:${STATE_BRANCH}`]);
    const fresh = cloneInWorld(bare, 'fresh');

    assert.match(bootRefused(fresh), /^origin's leeway-state holds code history — it shares commits with (origin\/)?(main|HEAD)/);

    assert.strictEqual(git(fresh, ['for-each-ref', `refs/heads/${STATE_BRANCH}`]), '');
    assert.ok(!fs.existsSync(statePath(fresh)));
  });

  it('checked out at .leeway/ by hand, is never pushed to a remote that lacks it', () => {
    const { main, bare } = remoteProject();
    git(main, ['worktree', 'add', '-q', '-b', STATE_BRANCH, statePath(main)]);
    git(main, ['worktree', 'lock', '--reason', STATE_LOCK_REASON, statePath(main)]);

    assert.match(bootRefused(main), /^leeway-state holds code history/);
    assert.strictEqual(remoteTip(bare), '');
  });

  /** What a refused catch-up must leave: the branch, the worktree's files and the remote. @param {string} main @param {string} bare */
  function stateAsIs(main, bare) {
    return { branch: tip(main, STATE_BRANCH), files: fs.readdirSync(statePath(main)).sort(), remote: remoteTip(bare), log: git(main, ['log', '--format=%H', STATE_BRANCH]) };
  }

  for (const fetched of [false, true]) {
    it(`pushed over the remote's, is refused by the catch-up before anything is merged or pushed${fetched ? ' — the person having fetched it already' : ''}`, () => {
      const { main, bare } = setUp({ remote: true });
      commitOnState(statePath(main), { [layout.projectManifest]: '{"kept":true}\n' });
      git(main, ['push', '-q', '-f', 'origin', `main:${STATE_BRANCH}`]);
      if (fetched) git(main, ['fetch', '-q', 'origin']);
      const before = stateAsIs(main, bare);

      assert.strictEqual(bootRefused(main), [
        "origin's leeway-state holds code history — it shares commits with main, where the state branch is a line of its own — ",
        "so the catch-up neither merges nor pushes it, and wrote nothing. To carry on, put the state's own line back on origin — ",
        "this clone's leeway-state holds it",
      ].join(''));

      assert.deepStrictEqual(stateAsIs(main, bare), before);
      assert.ok(!fs.existsSync(statePath(main, 'README.md')), 'the code came into the state worktree');
    });
  }

  it('pointed at code under its worktree, is refused by the catch-up and never pushed', () => {
    const { main, bare } = setUp({ remote: true });
    git(main, ['update-ref', `refs/heads/${STATE_BRANCH}`, 'main']);
    const before = stateAsIs(main, bare);

    assert.strictEqual(bootRefused(main), [
      "this clone's leeway-state holds code history — it shares commits with main, where the state branch is a line of its own — ",
      'so the catch-up neither merges nor pushes it, and wrote nothing. To carry on, point leeway-state back at the state\'s own line — ',
      "origin's leeway-state holds it",
    ].join(''));

    assert.deepStrictEqual(stateAsIs(main, bare), before);
  });

  it('is told from a state started again elsewhere, a line of its own too, which the catch-up merges as ever', () => {
    const { main, bare } = setUp({ remote: true });
    commitOnState(statePath(main), { [NOTES]: 'kept here\n' });
    const other = initRepo(path.join(world(), 'other'));
    const again = datedAt('2025-01-01T00:00:00Z', () => createState(statePath(other))).commit;
    git(other, ['push', '-q', '-f', bare, `${STATE_BRANCH}:${STATE_BRANCH}`]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(git(main, ['log', '-1', '--format=%P', STATE_BRANCH]).trim(), again, 'merged onto the remote\'s line');
    assert.strictEqual(readState(main, NOTES), 'kept here\n');
    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
  });
});
