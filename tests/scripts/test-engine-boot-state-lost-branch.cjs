'use strict';

// ---------------------------------------------------------------------------
// A lost local state branch (workflow-engine/scripts/domain/state-checks.cjs,
// domain/boot.cjs): restored from the remote, or from where its folder
// stands, what the folder holds kept and the remote's moves undone by
// nothing; refused where the folder holds code history or boot cannot tell
// where it stands.
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
const { STATE_BRANCH, withStateLock, commitState } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const {
  useWorld, write, read, tip, remoteTip, codeProject, cloneOf, boot, bootRefused, setUp, commitOnState, placed, IN_PLACE, bootsWithNothingToDo, untouched,
} = require('./boot-state-world.cjs');

const world = useWorld();

// --- a lost local branch --------------------------------------------------------

describe('a lost local branch (4.S8)', () => {
  it('deleted with its worktree, is restored from the remote and checked out again, locked', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    commitOnState(root, { 'manifest.json': '{"kept":true}\n' });
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    git(main, ['branch', '-D', STATE_BRANCH]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(root, 'manifest.json'), '{"kept":true}\n');
    bootsWithNothingToDo(main, bare);
  });

  it('deleted under its worktree, is restored and the folder linked to it again, what the folder holds kept', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);
    write(root, 'notes.md', 'not yet committed\n');

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(root, 'notes.md'), 'not yet committed\n');
    bootsWithNothingToDo(main, bare);
  });

  it('deleted under its worktree while the remote moved on, its folder is brought to the remote\'s tip: the next write undoes nothing the remote changed, and edits not yet committed survive', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    commitOnState(root, { 'notes.md': 'one\ntwo\nthree\n' });
    const other = cloneOf(bare, 'other');
    boot(other);
    commitOnState(path.join(other, '.leeway'), { 'notes.md': 'one\ntwo\nthree, theirs\n', 'theirs.md': 'from the other clone\n' });
    write(root, 'notes.md', 'one, mine\ntwo\nthree\n');
    write(root, 'draft.md', 'not yet committed\n');
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    const res = boot(main);

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(read(root, 'theirs.md'), 'from the other clone\n');
    assert.strictEqual(read(root, 'notes.md'), 'one, mine\ntwo\nthree, theirs\n');
    assert.strictEqual(read(root, 'draft.md'), 'not yet committed\n');
    assert.deepStrictEqual(git(root, ['status', '--porcelain']).split('\n').filter(Boolean), [' M notes.md', '?? draft.md'],
      'the index reads the remote\'s tip: only the edits show');

    const next = withStateLock(root, () => commitState(root, ['.'], 'state: everything'));

    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:theirs.md`]), 'from the other clone\n');
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:notes.md`]), 'one, mine\ntwo\nthree, theirs\n');
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:draft.md`]), 'not yet committed\n');
    assert.strictEqual(remoteTip(bare), next.commit);
  });

  it('deleted under its worktree holding a commit a failed push left behind, is restored with that commit, which the catch-up pushes', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    const hook = path.join(bare, 'hooks', 'pre-receive');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const left = commitOnState(root, { 'mine.md': 'committed, never pushed\n' }).commit;
    fs.rmSync(hook);
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(tip(main, STATE_BRANCH), left);
    assert.strictEqual(remoteTip(bare), left);
    assert.strictEqual(read(root, 'mine.md'), 'committed, never pushed\n');
    assert.strictEqual(git(root, ['status', '--porcelain']), '');
  });

  it('deleted under its worktree in a repository whose config turns ref logs off, still reads where the folder stands — the engine logs the state\'s refs whatever the config says', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const main = codeProject({ remote: bare });
    git(main, ['config', 'core.logAllRefUpdates', 'false']);
    assert.strictEqual(boot(main).state, 'ready');
    const root = path.join(main, '.leeway');
    const left = commitOnState(root, { 'mine.md': 'committed\n' }).commit;
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.strictEqual(tip(main, STATE_BRANCH), left);
    assert.strictEqual(git(root, ['status', '--porcelain']), '');
  });

  it('deleted under a folder with a code branch checked out, is refused: the commit the folder stands at holds code history — nothing written, no ref made', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    git(root, ['checkout', '-q', '--ignore-other-worktrees', 'main']);
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);
    const before = untouched(main, bare);

    assert.strictEqual(bootRefused(main), [
      `the commit the state folder ${root} stands at holds code history — it shares commits with main, where the state branch is a line of its own — `,
      `so boot makes no leeway-state there, and wrote nothing. To carry on, move ${root} aside, keeping what it holds, and boot again: `,
      'leeway-state is restored from origin',
    ].join(''));

    assert.deepStrictEqual(untouched(main, bare), before);
  });

  it('deleted under its worktree whose HEAD log is gone, is refused: boot cannot tell where the folder stands, and writes nothing', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);
    const registration = read(root, '.git').replace(/^gitdir: /, '').trim();
    fs.rmSync(path.join(registration, 'logs'), { recursive: true, force: true });
    const before = git(main, ['for-each-ref']);

    assert.match(bootRefused(main), new RegExp(
      `^the state folder ${root} is still there, but leeway-state is gone from this clone, and its log no longer says which commit ` +
      'the folder\'s files stand at, so boot wrote nothing — move .* aside, keeping what it holds, and boot again: leeway-state is restored from origin$',
    ));

    assert.strictEqual(git(main, ['for-each-ref']), before);
  });
});
