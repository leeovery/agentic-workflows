'use strict';

// ---------------------------------------------------------------------------
// Where the state lives (leeway-engine/scripts/kernel/state-root.cjs): the
// one `.leeway/` in the main checkout, found from any folder of the
// repository or any of its worktrees, symbolic links resolved and memoised
// per folder; a root pinned for a world no repository holds; the nullable
// find; and the two path forms — absolute for a
// file, state-relative for a pathspec or an identity, a given path's `..`
// read from its text and its links followed — with what lies
// outside the state, a sibling whose name only begins with the state's,
// answered as outside.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, initRepo, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const {
  STATE_DIR_NAME, stateRoot, pinStateRoot, findStateRoot, statePath, stateSpec, stateRelative, insideState, ignoresCase,
} = require('../../skills/leeway-engine/scripts/kernel/state-root.cjs');

/** @type {string} */
let dir;
/** @type {string} */
let root;

beforeEach(() => {
  dir = setupGitFixture('state-root-');
  root = path.join(dir, STATE_DIR_NAME);
});

afterEach(() => cleanupFixture(dir));

/** A linked code worktree of the fixture's repository, on its own branch. @returns {string} */
function codeWorktree() {
  git(dir, ['commit', '-q', '--allow-empty', '-m', 'code']);
  const wt = path.join(dir, 'wt');
  git(dir, ['worktree', 'add', '-q', '-b', 'side', wt]);
  return wt;
}

describe('stateRoot', () => {
  it('is `.leeway/` in the main checkout, from its root and from any folder below it', () => {
    assert.strictEqual(stateRoot(dir), root);
    fs.mkdirSync(path.join(dir, 'src/deep'), { recursive: true });
    assert.strictEqual(stateRoot(path.join(dir, 'src/deep')), root);
    assert.strictEqual(stateRoot(root), root, 'the state worktree is in the same repository');
  });

  it('is the main checkout\'s from a linked code worktree, which holds none of its own', () => {
    const wt = codeWorktree();
    assert.strictEqual(stateRoot(wt), root);
    assert.strictEqual(fs.existsSync(path.join(wt, STATE_DIR_NAME)), false);
  });

  it('resolves symbolic links: a checkout reached through a link answers its real path', () => {
    const link = path.join(fs.realpathSync(os.tmpdir()), `state-root-link-${process.pid}`);
    fs.symlinkSync(dir, link);
    try {
      assert.strictEqual(stateRoot(link), root);
    } finally {
      fs.unlinkSync(link);
    }
  });

  it('answers whether or not the state worktree exists yet', () => {
    const bare = initRepo(path.join(dir, 'other'));
    assert.strictEqual(stateRoot(bare), path.join(bare, STATE_DIR_NAME));
  });

  it('throws outside any git repository, naming the folder', () => {
    const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'state-root-outside-')));
    try {
      assert.throws(() => stateRoot(outside), new RegExp(`^Error: no workflows state for ${outside}: `));
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('is memoised per folder for the life of the process', () => {
    const sub = path.join(dir, 'memo');
    fs.mkdirSync(sub);
    assert.strictEqual(stateRoot(sub), root);
    fs.renameSync(path.join(dir, '.git'), path.join(dir, 'git-moved'));
    assert.strictEqual(stateRoot(sub), root, 'answered from the memo, git never asked again');
    fs.renameSync(path.join(dir, 'git-moved'), path.join(dir, '.git'));
  });
});

describe('pinStateRoot', () => {
  it('answers the pinned root for that folder outside any repository, and for no other', () => {
    const world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'state-root-world-')));
    try {
      const pinned = path.join(world, STATE_DIR_NAME);
      pinStateRoot(world, pinned);
      assert.strictEqual(stateRoot(world), pinned);
      assert.strictEqual(statePath(world, 'pay', 'manifest.json'), path.join(pinned, 'pay/manifest.json'));
      fs.mkdirSync(path.join(world, 'below'));
      assert.throws(() => stateRoot(path.join(world, 'below')), /^Error: no workflows state for /, 'a folder below it is not pinned');
    } finally {
      fs.rmSync(world, { recursive: true, force: true });
    }
  });
});

describe('findStateRoot', () => {
  it('is the state root where the state worktree is in place', () => {
    assert.strictEqual(findStateRoot(dir), root);
    assert.strictEqual(findStateRoot(codeWorktree()), root);
  });

  it('is null where the repository holds no state yet', () => {
    assert.strictEqual(findStateRoot(initRepo(path.join(dir, 'other'))), null);
  });

  it('is null outside any git repository, never throwing', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'state-root-outside-'));
    try {
      assert.strictEqual(findStateRoot(outside), null);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('statePath and stateSpec', () => {
  it('statePath is absolute in the state; no segments names the root', () => {
    assert.strictEqual(statePath(dir), root);
    assert.strictEqual(statePath(dir, 'pay', 'manifest.json'), path.join(root, 'pay/manifest.json'));
  });

  it('stateSpec joins segments with `/` as given; no segments is `.`', () => {
    assert.strictEqual(stateSpec(), '.');
    assert.strictEqual(stateSpec('pay', 'manifest.json'), 'pay/manifest.json');
    assert.strictEqual(stateSpec('pay/research'), 'pay/research');
  });
});

describe('stateRelative', () => {
  it('names a path in the state from the state root, `.` for the root itself', () => {
    assert.strictEqual(stateRelative(dir, path.join(root, 'pay/manifest.json')), 'pay/manifest.json');
    assert.strictEqual(stateRelative(dir, root), '.');
  });

  it('reads a relative path from the folder it is given in', () => {
    assert.strictEqual(stateRelative(dir, '.leeway/pay/research/pay.md'), 'pay/research/pay.md');
    assert.strictEqual(stateRelative(root, 'pay/research/pay.md'), 'pay/research/pay.md');
  });

  it('names a path not yet written, the part that exists resolved', () => {
    const link = path.join(fs.realpathSync(os.tmpdir()), `state-root-rel-${process.pid}`);
    fs.symlinkSync(dir, link);
    try {
      assert.strictEqual(stateRelative(dir, path.join(link, STATE_DIR_NAME, 'new/file.md')), 'new/file.md');
    } finally {
      fs.unlinkSync(link);
    }
  });

  it('reads a `..` from the text, then follows every link — a dangling one to where it points', () => {
    const away = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'state-root-away-')));
    try {
      fs.mkdirSync(path.join(root, 'pay'));
      fs.symlinkSync(path.join(root, 'pay'), path.join(away, 'unit'));
      fs.symlinkSync(away, path.join(root, 'away'));
      fs.symlinkSync(path.join(root, 'not-yet.md'), path.join(away, 'dangling'));
      assert.strictEqual(stateRelative(dir, `${path.join(away, 'unit')}/../manifest.json`), null);
      assert.strictEqual(stateRelative(dir, `${path.join(root, 'away', 'sub')}/../../manifest.json`), 'manifest.json');
      assert.strictEqual(stateRelative(dir, path.join(away, 'unit', 'manifest.json')), 'pay/manifest.json');
      assert.strictEqual(stateRelative(dir, path.join(away, 'dangling')), 'not-yet.md');
    } finally {
      fs.rmSync(away, { recursive: true, force: true });
    }
  });

  it('names the part that exists as the disk spells it, where the filesystem ignores case', () => {
    if (!ignoresCase(root)) return;
    fs.mkdirSync(path.join(root, 'pay'));
    assert.strictEqual(stateRelative(dir, path.join(dir, '.LEEWAY', 'PAY', 'New.md')), 'pay/New.md');
  });

  it('tells whether the filesystem ignores case from a folder named with no letters too, asking the folder above', () => {
    const digits = path.join(root, '2026', '10');
    fs.mkdirSync(digits, { recursive: true });
    assert.strictEqual(ignoresCase(digits), ignoresCase(root));
  });

  it('is null for a path outside the state: the code tree, a parent, a sibling whose name begins with the state\'s', () => {
    assert.strictEqual(stateRelative(dir, path.join(dir, 'src/app.js')), null);
    assert.strictEqual(stateRelative(dir, dir), null);
    assert.strictEqual(stateRelative(dir, path.join(dir, `${STATE_DIR_NAME}foo`, 'x.md')), null);
    assert.strictEqual(stateRelative(dir, path.join(dir, `${STATE_DIR_NAME}foo`)), null);
  });

  it('answers a code worktree\'s path into the main checkout\'s state, and its own tree as outside', () => {
    const wt = codeWorktree();
    assert.strictEqual(stateRelative(wt, path.join(root, 'pay/manifest.json')), 'pay/manifest.json');
    assert.strictEqual(stateRelative(wt, path.join(wt, STATE_DIR_NAME, 'pay/manifest.json')), null);
  });
});

describe('insideState', () => {
  it('holds for the root and anything below it', () => {
    assert.strictEqual(insideState(dir, root), true);
    assert.strictEqual(insideState(dir, path.join(root, 'pay/manifest.json')), true);
  });

  it('with segments, holds for that folder and below, never a sibling whose name begins with it', () => {
    assert.strictEqual(insideState(dir, path.join(root, '.cache'), '.cache'), true);
    assert.strictEqual(insideState(dir, path.join(root, '.cache/pay/x'), '.cache'), true);
    assert.strictEqual(insideState(dir, path.join(root, '.cachefoo/x'), '.cache'), false);
    assert.strictEqual(insideState(dir, path.join(root, 'pay/x'), '.cache'), false);
  });

  it('is false outside the state, a sibling whose name begins with the state\'s among it', () => {
    assert.strictEqual(insideState(dir, path.join(dir, 'README.md')), false);
    assert.strictEqual(insideState(dir, path.join(dir, `${STATE_DIR_NAME}foo/x`)), false);
  });
});
