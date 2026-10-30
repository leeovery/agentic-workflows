'use strict';

// ---------------------------------------------------------------------------
// A state branch missing from the remote
// (leeway-engine/scripts/domain/state-checks.cjs, domain/boot.cjs): pushed
// back, never to a remote out of reach, and restored through another clone
// where it is gone here and there.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, tip, remoteTip, statePath, layout, readState, commitOnState, traced } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const { useWorld, cloneInWorld, boot, setUp, placed, IN_PLACE, bootsWithNothingToDo, outOfReach } = require('./boot-state-world.cjs');

useWorld();

// --- a branch missing from the remote ---------------------------------------------

describe('a branch missing from the remote (4.4.12, 4.S31)', () => {
  it('is pushed back — and the next boot has nothing to do', () => {
    const { main, bare } = setUp({ remote: true });
    git(bare, ['branch', '-D', STATE_BRANCH]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
    bootsWithNothingToDo(main, bare);
  });

  it('is never pushed back to a remote out of reach, which says nothing of what it holds', () => {
    const { main, bare } = setUp({ remote: true });
    git(bare, ['branch', '-D', STATE_BRANCH]);
    outOfReach(main);

    const { result: res, commands } = traced(() => boot(main));

    assert.strictEqual(res.state, 'ready');
    assert.ok(!commands.some((c) => c.startsWith('push ')), 'a push was tried');
    assert.match(res.warnings.join('\n'), /could not be fetched from origin/);
    assert.strictEqual(remoteTip(bare), '');
  });

  it('gone here and on the remote but held by another clone: this clone stops, the other pushes it back, and this one restores it with nothing lost', () => {
    const { main: other, root: otherRoot, bare } = setUp({ remote: true });
    const here = cloneInWorld(bare, 'here');
    boot(here);
    const kept = commitOnState(otherRoot, { [layout.projectManifest]: '{"kept":true}\n' }).commit;
    git(bare, ['branch', '-D', STATE_BRANCH]);
    git(here, ['worktree', 'remove', '--force', '--force', statePath(here)]);
    git(here, ['branch', '-D', STATE_BRANCH]);

    assert.deepStrictEqual(boot(here), { ok: true, state: 'lost', warnings: [] });
    assert.strictEqual(boot(other).state, 'ready');
    assert.strictEqual(remoteTip(bare), kept);
    assert.strictEqual(boot(here).state, 'ready');

    assert.strictEqual(tip(here, STATE_BRANCH), kept);
    assert.strictEqual(readState(here, layout.projectManifest), '{"kept":true}\n');
    assert.deepStrictEqual(placed(statePath(here)), IN_PLACE);
  });
});
