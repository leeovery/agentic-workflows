'use strict';

// ---------------------------------------------------------------------------
// The state worktree (workflow-engine/scripts/domain/state-checks.cjs,
// domain/state-worktree.cjs): added again where removed or its folder
// deleted, locked again where unlocked, refused on a detached HEAD or
// another branch; and a project folder moved or copied, its state worktree
// linked where it now is, the copy's made its own.
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
const { git, tip } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH, STATE_GITIGNORE } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const { createFile, readFile } = require('./discovery-test-utils.cjs');
const { useWorld, boot, bootRefused, setUp, commitOnState, placed, IN_PLACE, bootsWithNothingToDo } = require('./boot-state-world.cjs');

const world = useWorld();

// --- the worktree ---------------------------------------------------------------

describe('the state worktree (4.S29, 22.S3)', () => {
  it('removed, is added again, locked — and the next boot has nothing to do', () => {
    const { main, root } = setUp();
    git(main, ['worktree', 'remove', '--force', '--force', root]);

    assert.strictEqual(boot(main).state, 'ready');

    assert.deepStrictEqual(placed(root), IN_PLACE);
    bootsWithNothingToDo(main, null);
  });

  it('its folder deleted under its registration, is added again, locked', () => {
    const { main, root } = setUp();
    fs.rmSync(root, { recursive: true, force: true });

    assert.strictEqual(boot(main).state, 'ready');

    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(readFile(root, '.gitignore'), STATE_GITIGNORE);
    bootsWithNothingToDo(main, null);
  });

  it('unlocked, is locked — and checked again on the next boot, which locks it again', () => {
    const { main, root } = setUp();
    git(main, ['worktree', 'unlock', root]);

    boot(main);
    assert.deepStrictEqual(placed(root), IN_PLACE);

    git(main, ['worktree', 'unlock', root]);
    boot(main);
    assert.deepStrictEqual(placed(root), IN_PLACE);
    bootsWithNothingToDo(main, null);
  });

  it('with a detached HEAD or another branch checked out, is refused, nothing written', () => {
    const { main, root } = setUp();
    git(root, ['checkout', '-q', '--detach']);
    const before = tip(main, STATE_BRANCH);

    assert.match(bootRefused(main), /has a detached HEAD checked out, not leeway-state, so boot wrote nothing — check leeway-state out there again$/);

    git(root, ['checkout', '-q', '-b', 'elsewhere']);
    assert.match(bootRefused(main), /has elsewhere checked out, not leeway-state/);
    assert.strictEqual(tip(main, STATE_BRANCH), before);
  });
});

// --- a moved or copied project folder ------------------------------------------------

/** Every file git keeps for a project's worktrees, and each worktree's link, by path. @param {string} main @param {string[]} worktrees */
function links(main, worktrees) {
  /** @type {Record<string, string>} */
  const files = {};
  const admin = path.join(main, '.git/worktrees');
  for (const id of fs.readdirSync(admin)) {
    for (const name of fs.readdirSync(path.join(admin, id))) {
      const file = path.join(admin, id, name);
      if (fs.statSync(file).isFile()) files[file] = fs.readFileSync(file, 'utf8');
    }
  }
  for (const dir of worktrees) files[path.join(dir, '.git')] = readFile(dir, '.git');
  return files;
}

describe('a project folder moved or copied', () => {
  it('moved: the state worktree is linked where it now is, what it holds and its lock kept, and commits again', () => {
    const { main, root } = setUp();
    createFile(root, 'manifest.json', '{"kept":true}\n');
    const moved = path.join(world(), 'moved');
    fs.renameSync(main, moved);

    const res = boot(moved);

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    const movedRoot = path.join(moved, '.leeway');
    assert.deepStrictEqual(placed(movedRoot), IN_PLACE);
    assert.strictEqual(readFile(movedRoot, 'manifest.json'), '{"kept":true}\n');
    const out = commitOnState(movedRoot, { 'manifest.json': '{"kept":true}\n' });
    assert.strictEqual(tip(moved, STATE_BRANCH), out.commit);
    bootsWithNothingToDo(moved, null);
  });

  it('copied: the copy\'s state worktree becomes its own, and the original — its state worktree and its code worktrees — is untouched and works', () => {
    const { main: original, root } = setUp();
    const side = path.join(original, '.claude/worktrees/side');
    git(original, ['worktree', 'add', '-q', '-b', 'side', side]);
    const before = links(original, [root, side]);
    const copy = path.join(world(), 'copy');
    fs.cpSync(original, copy, { recursive: true, verbatimSymlinks: true });

    const res = boot(copy);

    assert.strictEqual(res.state, 'ready');
    assert.deepStrictEqual(res.warnings, [`this project is a copy of ${original}: its state worktree was linked to that project's, and is now this one's own — ${original} is untouched`]);
    const copyRoot = path.join(copy, '.leeway');
    assert.deepStrictEqual(placed(copyRoot), IN_PLACE);
    assert.deepStrictEqual(links(original, [root, side]), before, 'the original\'s links were rewritten');
    assert.deepStrictEqual(placed(root), IN_PLACE);
    assert.strictEqual(git(side, ['rev-parse', '--git-common-dir']).trim(), path.join(original, '.git'));

    const theirs = commitOnState(root, { 'manifest.json': '{"original":true}\n' }).commit;
    const ours = commitOnState(copyRoot, { 'manifest.json': '{"copy":true}\n' }).commit;
    assert.strictEqual(tip(original, STATE_BRANCH), theirs);
    assert.strictEqual(tip(copy, STATE_BRANCH), ours);
    bootsWithNothingToDo(copy, null);
  });

  it('a boot from inside a copy\'s state worktree, which git reads as the original\'s, is refused and touches nothing', () => {
    const { main: original, root } = setUp();
    const before = { links: links(original, [root]), refs: git(original, ['for-each-ref']), log: git(root, ['log', '--format=%H']) };
    const copy = path.join(world(), 'copy');
    fs.cpSync(original, copy, { recursive: true, verbatimSymlinks: true });

    assert.match(bootRefused(path.join(copy, '.leeway')), new RegExp(`is in a copy of the worktree at ${root}: git reads it as that worktree, in that repository, so the workflows read and write nothing through it`));

    assert.deepStrictEqual({ links: links(original, [root]), refs: git(original, ['for-each-ref']), log: git(root, ['log', '--format=%H']) }, before);
  });
});
