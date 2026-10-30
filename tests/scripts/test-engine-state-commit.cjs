'use strict';

// ---------------------------------------------------------------------------
// The state commit (workflow-engine/scripts/domain/state-worktree.cjs):
// exactly the paths given committed on `leeway-state`, the working tree taken
// as it stands over whatever its index was left in; a file given a change
// committed as it makes it of the branch's own, refused where git cannot
// read that; the ignore file's added patterns; and its push, a failed push a
// warning. A commit killed between its steps leaves the branch whole and the
// next commit right; a commit beside the person's repository runs none of
// its hooks (4.S18).
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote (state-worktree-world.cjs). The kill is a `git`
// wrapper first on PATH, the commit in a process of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const { git, bareRepo, layout, createFile, traced, withEnv, cloneOf, codeProject, tip, remoteTip } = require('./engine-harness.cjs');
const { CHILD_TIMEOUT_MS, useWorld, elsewhereRepo, snapshot, childStderr } = require('./state-worktree-world.cjs');

const STATE = path.join(__dirname, '../../skills/workflow-engine/scripts/domain/state-worktree.cjs');
const state = require(STATE);
const { stateRoot } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');

const {
  STATE_BRANCH, STATE_GITIGNORE, createState, addStateWorktree, createStateBranchFromRemote, withStateLock, commitState, pushState,
} = state;

const world = useWorld();

/**
 * The files a commit touched, each `{status}\t{path}` with the path as it
 * stands, unquoted.
 * @param {string} dir @param {string} rev
 */
function touched(dir, rev) {
  const fields = git(dir, ['show', '--name-status', '--no-renames', '-z', '--format=', rev]).replace(/^\n+/, '').split('\0');
  const entries = [];
  for (let i = 0; i + 1 < fields.length; i += 2) entries.push(`${fields[i]}\t${fields[i + 1]}`);
  return entries.sort();
}

describe('committing state', () => {
  it('commits exactly the paths given, on leeway-state, whatever else is changed or staged', () => {
    const { root } = codeProject(world(), { state: true });
    createFile(root, layout.manifest('pay'), '{}\n');
    createFile(root, 'unit/topics/a/log.md', '# a\n');
    createFile(root, 'unit/topics/a/brief.md', '# brief\n');
    git(root, ['add', 'unit/topics/a/brief.md']);

    const out = withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: the manifest'));

    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.strictEqual(git(root, ['log', '-1', '--format=%s', STATE_BRANCH]).trim(), 'state: the manifest');
    assert.deepStrictEqual(touched(root, out.commit), [`A\t${layout.manifest('pay')}`]);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), 'A  unit/topics/a/brief.md\n?? unit/topics/a/log.md\n');
  });

  it('commits a file added, one changed and one deleted, a folder taking every file in it', () => {
    const { root } = codeProject(world(), { state: true });
    createFile(root, layout.projectManifest, '{}\n');
    createFile(root, 'unit/old.md', 'old\n');
    withStateLock(root, () => commitState(root, [layout.projectManifest, 'unit'], 'state: first'));

    createFile(root, layout.projectManifest, '{"a":1}\n');
    fs.rmSync(path.join(root, 'unit/old.md'));
    createFile(root, 'unit/topics/a/log.md', '# a\n');
    createFile(root, 'unit/topics/a/brief.md', '# brief\n');
    const out = withStateLock(root, () => commitState(root, [path.join(root, layout.projectManifest), 'unit'], 'state: second'));

    assert.deepStrictEqual(touched(root, out.commit), [
      'A\tunit/topics/a/brief.md', 'A\tunit/topics/a/log.md', 'D\tunit/old.md', 'M\tmanifest.json',
    ]);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
  });

  it('commits a file given a change as it makes it of the branch\'s own — a new one among them, and over what the paths give of it — the working file\'s own changes left uncommitted', () => {
    const { root } = codeProject(world(), { state: true });
    createFile(root, '.gitignore', `${STATE_GITIGNORE}/mine/\n`);
    createFile(root, 'unit/state.json', '{"a":1,"mine":true}\n');
    createFile(root, 'unit/new.md', 'theirs\n');
    /** @type {Record<string, string|null>} */
    const seen = {};
    /** @param {string} file @param {(held: string|null) => string|null} change */
    const seeing = (file, change) => (/** @type {string|null} */ held) => { seen[file] = held; return change(held); };

    const out = withStateLock(root, () => commitState(root, ['unit/state.json'], 'state: given', {
      contents: {
        '.gitignore': seeing('.gitignore', (held) => `${held}/given/\n`),
        'unit/state.json': seeing('unit/state.json', () => '{"a":1}\n'),
        'unit/new.md': seeing('unit/new.md', () => null),
      },
    }));

    assert.deepStrictEqual(seen, { '.gitignore': STATE_GITIGNORE, 'unit/state.json': null, 'unit/new.md': null });
    assert.deepStrictEqual(touched(root, out.commit || ''), ['A\tunit/state.json', 'M\t.gitignore']);
    assert.deepStrictEqual([git(root, ['show', 'HEAD:unit/state.json']), git(root, ['show', 'HEAD:.gitignore'])], ['{"a":1}\n', `${STATE_GITIGNORE}/given/\n`]);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), ' M .gitignore\n M unit/state.json\n?? unit/new.md\n');
  });

  it('refuses a commit where a file it is given a change to cannot be read from the branch, naming it and the commit, committing nothing', () => {
    const { root } = codeProject(world(), { state: true });
    const head = git(root, ['rev-parse', 'HEAD']).trim();
    const object = git(root, ['rev-parse', 'HEAD:.gitignore']).trim();
    fs.rmSync(path.join(root, '..', '.git', 'objects', object.slice(0, 2), object.slice(2)));

    assert.throws(() => withStateLock(root, () => commitState(root, [], 'state: given', { contents: { '.gitignore': (held) => `${held}/given/\n` } })), {
      message: new RegExp(`^\\.gitignore could not be read from ${STATE_BRANCH} at ${head} — nothing committed: `),
    });
    assert.strictEqual(git(root, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('adds the patterns an ignore file lacks after its lines, its last line ended first where it was not, and nothing where it lacks none', () => {
    assert.deepStrictEqual(
      [state.withIgnored('/a/\n', ['/a/', '/b/', '/c/']), state.withIgnored('/a/', ['/b/']), state.withIgnored('', ['/b/']), state.withIgnored('/a/\n/b/\n', ['/b/'])],
      ['/a/\n/b/\n/c/\n', '/a/\n/b/\n', '/b/\n', null],
    );
  });

  it('commits a deletion already staged in the state worktree, named by its file or by its folder', () => {
    const { root } = codeProject(world(), { state: true });
    createFile(root, 'unit/old.md', 'old\n');
    createFile(root, 'unit/gone.md', 'gone\n');
    withStateLock(root, () => commitState(root, ['unit'], 'state: first'));
    git(root, ['rm', '-q', 'unit/old.md', 'unit/gone.md']);

    const byFile = withStateLock(root, () => commitState(root, ['unit/old.md'], 'state: drop old'));
    const byFolder = withStateLock(root, () => commitState(root, ['unit'], 'state: drop gone'));

    assert.deepStrictEqual(touched(root, byFile.commit || ''), ['D\tunit/old.md']);
    assert.deepStrictEqual(touched(root, byFolder.commit || ''), ['D\tunit/gone.md']);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
  });

  it('makes no commit and no push where a staged change was undone in the working tree', () => {
    const { root, bare } = codeProject(world(), { remote: true, state: true });
    createFile(root, layout.projectManifest, '{}\n');
    const before = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: first')).commit;
    createFile(root, layout.projectManifest, '{"a":1}\n');
    git(root, ['add', layout.projectManifest]);
    createFile(root, layout.projectManifest, '{}\n');

    const { result, commands } = traced(() => withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: nothing')));

    assert.deepStrictEqual(result, { commit: null, pushed: false, warnings: [] });
    assert.ok(!commands.some((c) => c.startsWith('push ')), `a push was attempted: ${commands}`);
    assert.strictEqual(tip(root, STATE_BRANCH), before);
    assert.strictEqual(remoteTip(bare), before);
  });

  // Every state the worktree's own index can be left in under a path, by a
  // killed verb or by a person: the commit takes the working tree as it
  // stands, leaves `git status` clean under the path, and the next commit
  // finds nothing more to take.
  const INDEX_STATES = [
    {
      name: 'AD: added to the index, then deleted',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => { createFile(root, 'u/n.md', 'n\n'); git(root, ['add', 'u/n.md']); fs.rmSync(path.join(root, 'u/n.md')); },
      touched: [],
    },
    {
      name: 'MD: changed in the index, then deleted',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => { createFile(root, 'u/m.md', 'm2\n'); git(root, ['add', 'u/m.md']); fs.rmSync(path.join(root, 'u/m.md')); },
      touched: ['D\tu/m.md'],
    },
    {
      name: 'rm --cached, the file kept',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => git(root, ['rm', '-q', '--cached', 'u/m.md']),
      touched: [],
    },
    {
      name: 'intent to add',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => { createFile(root, 'u/n.md', 'n\n'); git(root, ['add', '-N', 'u/n.md']); },
      touched: ['A\tu/n.md'],
    },
    {
      name: 'AM: added, then changed again',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => { createFile(root, 'u/n.md', 'n1\n'); git(root, ['add', 'u/n.md']); createFile(root, 'u/n.md', 'n2\n'); },
      touched: ['A\tu/n.md'],
    },
    {
      name: 'a staged deletion',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => git(root, ['rm', '-q', 'u/m.md']),
      touched: ['D\tu/m.md'],
    },
    {
      name: 'a staged change undone in the working tree',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => { createFile(root, 'u/m.md', 'm2\n'); git(root, ['add', 'u/m.md']); createFile(root, 'u/m.md', 'm\n'); },
      touched: [],
    },
    {
      name: 'a folder become a file',
      base: { 'u/x/a.md': 'a\n' },
      setup: (root) => { fs.rmSync(path.join(root, 'u/x'), { recursive: true }); createFile(root, 'u/x', 'x\n'); },
      touched: ['A\tu/x', 'D\tu/x/a.md'],
    },
    {
      name: 'a file become a folder',
      base: { 'u/x': 'x\n' },
      setup: (root) => { fs.rmSync(path.join(root, 'u/x')); createFile(root, 'u/x/a.md', 'a\n'); },
      touched: ['A\tu/x/a.md', 'D\tu/x'],
    },
    {
      name: 'symlinks, one dangling',
      base: { 'u/m.md': 'm\n' },
      setup: (root) => { fs.symlinkSync('m.md', path.join(root, 'u/link')); fs.symlinkSync('nowhere', path.join(root, 'u/dangling')); },
      touched: ['A\tu/dangling', 'A\tu/link'],
    },
    {
      name: 'a file become a symlink',
      base: { 'u/m.md': 'm\n', 'u/n.md': 'n\n' },
      setup: (root) => { fs.rmSync(path.join(root, 'u/n.md')); fs.symlinkSync('m.md', path.join(root, 'u/n.md')); },
      touched: ['T\tu/n.md'],
    },
  ];

  for (const { name, base, setup, touched: expected } of INDEX_STATES) {
    it(`commits the working tree as it stands over an index left in a state: ${name}`, () => {
      const { root } = codeProject(world(), { state: true });
      for (const [rel, content] of Object.entries(base)) createFile(root, rel, content);
      withStateLock(root, () => commitState(root, ['u'], 'state: base'));
      setup(root);

      const out = withStateLock(root, () => commitState(root, ['u'], 'state: the change'));

      assert.deepStrictEqual(out.commit === null ? [] : touched(root, out.commit), expected);
      assert.deepStrictEqual(out.warnings, []);
      assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all', '--', 'u']), '');
      assert.strictEqual(withStateLock(root, () => commitState(root, ['u'], 'state: again')).commit, null);
    });
  }

  it('takes every name literally, odd characters and all', () => {
    const { root } = codeProject(world(), { state: true });
    const names = ['u/a b.md', 'u/"quoted".md', 'u/é.md', 'u/-dash.md', 'u/star*.md', 'u/starX.md', 'u/[b].md', 'u/b.md', 'u/tab\there.md', 'u/new\nline.md'];
    for (const rel of names) createFile(root, rel, `${rel}\n`);

    const named = withStateLock(root, () => commitState(root, ['u/star*.md', 'u/[b].md'], 'state: two by name'));
    const rest = withStateLock(root, () => commitState(root, ['u'], 'state: the rest'));

    assert.deepStrictEqual(touched(root, named.commit || ''), ['A\tu/[b].md', 'A\tu/star*.md']);
    assert.deepStrictEqual(touched(root, rest.commit || ''),
      names.filter((rel) => !['u/star*.md', 'u/[b].md'].includes(rel)).map((rel) => `A\t${rel}`).sort());
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
  });

  it('refuses a path the state ignores, committing nothing', () => {
    const { root } = codeProject(world(), { state: true });
    const before = tip(root, STATE_BRANCH);
    createFile(root, layout.cache('unit', 'state.json'), '{}\n');

    assert.throws(() => commitState(root, [layout.cache('unit', 'state.json')], 'state: x'), /ignored/);
    assert.strictEqual(tip(root, STATE_BRANCH), before);
  });

  it('commits past a private index and its lock a kill left mid-step', () => {
    const { root } = codeProject(world(), { state: true });
    const index = path.resolve(root, git(root, ['rev-parse', '--git-path', 'leeway-commit.index']).trim());
    fs.writeFileSync(index, 'left by a killed verb');
    fs.writeFileSync(`${index}.lock`, '');
    createFile(root, layout.manifest('pay'), '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: the manifest'));

    assert.deepStrictEqual(touched(root, out.commit || ''), [`A\t${layout.manifest('pay')}`]);
    assert.ok(!fs.existsSync(index) && !fs.existsSync(`${index}.lock`));
  });

  it('keeps the commit and warns where the worktree\'s own index is held, and lines it up on the next commit', () => {
    const { root } = codeProject(world(), { state: true });
    const indexLock = path.resolve(root, git(root, ['rev-parse', '--git-path', 'index.lock']).trim());
    fs.writeFileSync(indexLock, '');
    createFile(root, layout.manifest('pay'), '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: the manifest'));

    assert.deepStrictEqual(touched(root, out.commit || ''), [`A\t${layout.manifest('pay')}`]);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /^the state worktree's index was not brought into line with leeway-state: .*index\.lock/s);

    fs.rmSync(indexLock);
    assert.deepStrictEqual(withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: again')), { commit: null, pushed: false, warnings: [] });
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
  });

  it('makes no commit and no push where the paths hold no change, or where no path is given', () => {
    const { root, bare } = codeProject(world(), { remote: true, state: true });
    const before = tip(root, STATE_BRANCH);
    createFile(root, layout.projectManifest, '{}\n');

    for (const paths of [['.gitignore', 'unit'], []]) {
      const { result, commands } = traced(() => withStateLock(root, () => commitState(root, paths, 'state: nothing')));

      assert.deepStrictEqual(result, { commit: null, pushed: false, warnings: [] }, String(paths));
      assert.ok(!commands.some((c) => c.startsWith('push ')), `a push was attempted: ${commands}`);
    }
    assert.strictEqual(tip(root, STATE_BRANCH), before);
    assert.strictEqual(remoteTip(bare), before);
  });

  it('refuses where the state worktree has another branch, or none, checked out — nothing committed', () => {
    const { root } = codeProject(world(), { state: true });
    const before = tip(root, STATE_BRANCH);
    createFile(root, layout.projectManifest, '{}\n');

    git(root, ['checkout', '-q', '-b', 'other']);
    assert.throws(() => commitState(root, [layout.projectManifest], 'state: x'), /has other checked out, not leeway-state — nothing committed/);

    git(root, ['checkout', '-q', '--detach', STATE_BRANCH]);
    assert.throws(() => commitState(root, [layout.projectManifest], 'state: x'), /has a detached HEAD checked out/);

    assert.strictEqual(tip(root, STATE_BRANCH), before);
    assert.strictEqual(tip(root, 'other'), before);
  });

  it('refuses a path outside the state worktree — nothing committed', () => {
    const { main, root } = codeProject(world(), { state: true });
    createFile(root, layout.projectManifest, '{}\n');
    const before = tip(root, STATE_BRANCH);

    for (const outside of ['../README.md', path.join(main, 'README.md')]) {
      assert.throws(() => commitState(root, [layout.projectManifest, outside], 'state: x'), /is outside the state worktree/, outside);
    }
    assert.strictEqual(tip(root, STATE_BRANCH), before);
  });

  it('leaves the main checkout\'s branch, HEAD and index as they were', () => {
    const { main, root } = codeProject(world(), { state: true });
    const before = snapshot(main);
    createFile(root, layout.projectManifest, '{}\n');

    withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));

    const after = snapshot(main);
    assert.deepStrictEqual([after.head, after.sha, after.index], [before.head, before.sha, before.index]);
    assert.strictEqual(tip(main, 'main'), before.sha);
  });

  it('pushes leeway-state to the remote after the commit', () => {
    const { root, bare } = codeProject(world(), { remote: true, state: true });
    createFile(root, layout.projectManifest, '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));

    assert.deepStrictEqual([out.pushed, out.warnings], [true, []]);
    assert.strictEqual(remoteTip(bare), out.commit);
  });

  it('attempts no push where the project has no remote (4.S5)', () => {
    const { root } = codeProject(world(), { state: true });
    createFile(root, layout.projectManifest, '{}\n');

    const { result, commands } = traced(() => withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest')));

    assert.deepStrictEqual([result.pushed, result.warnings], [false, []]);
    assert.ok(commands.some((c) => c.startsWith('commit-tree ')), `the trace caught nothing: ${commands}`);
    assert.ok(!commands.some((c) => c.startsWith('push ')), `a push was attempted: ${commands}`);
  });

  it('keeps the commit and answers a warning where the remote refuses the push (4.S4)', () => {
    const { root, bare } = codeProject(world(), { remote: true });
    const created = createState(root);
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });
    createFile(root, layout.projectManifest, '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));

    assert.match(out.commit || '', /^[0-9a-f]{40}$/);
    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.strictEqual(git(root, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]), '{}\n');
    assert.strictEqual(out.pushed, false);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /^leeway-state is committed here but was not pushed to origin — the commit stands, and the next boot pushes it: .*no pushes today/s);
    assert.strictEqual(remoteTip(bare), created.commit);
  });

  it('never forces: a remote that moved ahead keeps its tip, and the push is a warning that says what is true, never git\'s advice to pull', () => {
    const { root, bare } = codeProject(world(), { remote: true, state: true });
    const other = cloneOf(bare, path.join(world(), 'other'));
    const otherRoot = stateRoot(other);
    createStateBranchFromRemote(otherRoot);
    addStateWorktree(otherRoot);
    createFile(otherRoot, layout.projectManifest, '{"from":"other"}\n');
    const theirs = withStateLock(otherRoot, () => commitState(otherRoot, [layout.projectManifest], 'state: theirs')).commit;
    createFile(root, layout.projectManifest, '{"from":"here"}\n');

    const out = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: ours'));

    assert.strictEqual(remoteTip(bare), theirs);
    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.deepStrictEqual([out.pushed, out.warnings.length], [false, 1]);
    assert.match(out.warnings[0], /^leeway-state is committed here but was not pushed to origin — the commit stands, and the next boot pushes it: .*rejected/s);
    assert.doesNotMatch(out.warnings[0], /hint:|git pull/);
  });

  it('gives up on a push the remote never answers, within the timeout, as a warning', () => {
    const { main, root } = codeProject(world(), { state: true });
    const silent = path.join(world(), 'silent-ssh');
    fs.writeFileSync(silent, '#!/bin/sh\nexec sleep 5\n', { mode: 0o755 });
    git(main, ['remote', 'add', 'origin', 'ssh://state.invalid/project.git']);
    git(main, ['config', 'core.sshCommand', silent]);
    createFile(root, layout.projectManifest, '{}\n');

    const started = Date.now();
    const out = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest', { pushTimeoutMs: 500 }));
    const took = Date.now() - started;

    assert.ok(took < 4000, `the push held the verb for ${took}ms`);
    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.deepStrictEqual([out.pushed, out.warnings.length], [false, 1]);
    assert.match(out.warnings[0], /git push timed out after 0\.5s/);
  });

  it('warns on every push where several remotes choose none, and pushes to the one the main checkout\'s branch tracks', () => {
    const { main, root } = codeProject(world());
    const [fork, upstream] = ['fork', 'upstream'].map((name) => {
      const bare = bareRepo(path.join(world(), `${name}.git`));
      git(main, ['remote', 'add', name, bare]);
      return bare;
    });
    const unchosen = /^leeway-state is committed here but was not pushed: the project has several remotes \(fork, upstream\), and none is named origin or tracked by the main checkout's branch$/;

    const created = createState(root);
    createFile(root, layout.projectManifest, '{}\n');
    const committed = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));
    const pushed = pushState(root);

    for (const out of [created, committed, pushed]) {
      assert.strictEqual(out.pushed, false);
      assert.strictEqual(out.warnings.length, 1);
      assert.match(out.warnings[0], unchosen);
    }
    assert.strictEqual(tip(root, STATE_BRANCH), committed.commit);
    assert.deepStrictEqual([remoteTip(fork), remoteTip(upstream)], ['', '']);
    assert.throws(() => createStateBranchFromRemote(root), /cannot take leeway-state from a remote: the project has several remotes \(fork, upstream\)/);

    git(main, ['config', 'branch.main.remote', 'upstream']);
    createFile(root, layout.projectManifest, '{"a":1}\n');
    const tracked = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: again'));

    assert.deepStrictEqual([tracked.pushed, tracked.warnings], [true, []]);
    assert.deepStrictEqual([remoteTip(fork), remoteTip(upstream)], ['', tracked.commit]);
  });

  it('pushes the branch as it stands on its own, what a failed push left behind', () => {
    const { root, bare } = codeProject(world(), { remote: true, state: true });
    const hook = path.join(bare, 'hooks', 'pre-receive');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    createFile(root, layout.projectManifest, '{}\n');
    const left = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest')).commit;
    fs.rmSync(hook);

    assert.deepStrictEqual(pushState(root), { pushed: true, warnings: [] });
    assert.strictEqual(remoteTip(bare), left);
  });
});

describe('a state commit interrupted between its steps', () => {
  // The commit as a verb makes it, in a process of its own; a refusal
  // exits 3 with its message.
  const COMMIT = [
    'const [mod, root] = process.argv.slice(1);',
    'const { withStateLock, commitState } = require(mod);',
    "try { withStateLock(root, () => commitState(root, ['u'], 'state: the change')); }",
    'catch (err) { process.stdout.write(err.message); process.exit(3); }',
  ].join('\n');

  /**
   * A `git` that runs the real one, then, once the step named in KILL_AFTER
   * has run, kills the process that called it, and once the step named in
   * MOVE_AFTER has run, moves `leeway-state` to MOVE_TO — a writer the lock
   * did not hold back.
   */
  function interruptingGit() {
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8', timeout: CHILD_TIMEOUT_MS }).trim();
    const dir = path.join(world(), 'interrupting-git');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'git'), [
      '#!/bin/sh',
      `"${real}" "$@"`,
      'status=$?',
      'for arg in "$@"; do',
      '  if [ -n "$KILL_AFTER" ] && [ "$arg" = "$KILL_AFTER" ]; then kill -9 "$PPID"; fi',
      `  if [ -n "$MOVE_AFTER" ] && [ "$arg" = "$MOVE_AFTER" ]; then "${real}" update-ref refs/heads/${STATE_BRANCH} "$MOVE_TO"; fi`,
      'done',
      'exit $status',
      '',
    ].join('\n'), { mode: 0o755 });
    return dir;
  }

  /** Run the verb's commit in its own process under `env`. @param {string} root @param {Record<string, string>} env */
  function commitInterrupted(root, env) {
    return spawnSync(process.execPath, ['-e', COMMIT, STATE, root], {
      encoding: 'utf8', timeout: CHILD_TIMEOUT_MS, env: { ...process.env, PATH: `${interruptingGit()}:${process.env.PATH}`, ...env },
    });
  }

  it('moves the branch only from the tip it built on: one that moved meanwhile refuses the commit', () => {
    const { root } = codeProject(world(), { state: true });
    createFile(root, 'u/a.md', 'a\n');
    withStateLock(root, () => commitState(root, ['u'], 'state: base'));
    const elsewhere = git(root, ['commit-tree', `${STATE_BRANCH}^{tree}`, '-p', STATE_BRANCH, '-m', 'a writer the lock missed']).trim();
    createFile(root, 'u/a.md', 'a2\n');

    const res = commitInterrupted(root, { MOVE_AFTER: 'commit-tree', MOVE_TO: elsewhere });

    assert.strictEqual(res.status, 3, childStderr(res.signal, res.stderr));
    assert.match(res.stdout, /^git update-ref failed: /);
    assert.strictEqual(tip(root, STATE_BRANCH), elsewhere);
  });

  for (const step of ['read-tree', 'add', 'write-tree', 'commit-tree', 'update-ref', 'reset']) {
    it(`leaves the branch at its old tip or the whole commit, and the next commit right, when killed after ${step}`, () => {
      const { root } = codeProject(world(), { state: true });
      createFile(root, 'u/a.md', 'a\n');
      createFile(root, 'u/b.md', 'b\n');
      withStateLock(root, () => commitState(root, ['u'], 'state: base'));
      const before = tip(root, STATE_BRANCH);
      createFile(root, 'other.md', 'other\n');
      git(root, ['add', 'other.md']);
      createFile(root, 'u/a.md', 'a2\n');
      fs.rmSync(path.join(root, 'u/b.md'));
      createFile(root, 'u/c/d.md', 'd\n');

      const killed = commitInterrupted(root, { KILL_AFTER: step });
      assert.strictEqual(killed.signal, 'SIGKILL', killed.signal === 'SIGTERM' ? childStderr(killed.signal, killed.stderr) : `the verb was not killed: ${killed.stderr}`);
      const landed = tip(root, STATE_BRANCH);
      assert.ok(landed === before || git(root, ['rev-parse', `${landed}^`]).trim() === before, 'the branch moved somewhere else');

      const out = withStateLock(root, () => commitState(root, ['u'], 'state: the change'));

      assert.strictEqual(out.commit === null, landed !== before);
      assert.strictEqual(git(root, ['rev-list', '--count', `${before}..${STATE_BRANCH}`]).trim(), '1');
      assert.deepStrictEqual(touched(root, STATE_BRANCH), ['A\tu/c/d.md', 'D\tu/b.md', 'M\tu/a.md']);
      assert.strictEqual(git(root, ['show', `${STATE_BRANCH}:u/a.md`]), 'a2\n');
      assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), 'A  other.md\n');
      const index = path.resolve(root, git(root, ['rev-parse', '--git-path', 'leeway-commit.index']).trim());
      assert.ok(!fs.existsSync(index) && !fs.existsSync(`${index}.lock`), 'the private index was left behind');
    });
  }
});

describe('a state commit beside the person\'s repository (4.S18)', () => {
  const HOOKS = ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit', 'reference-transaction', 'post-checkout', 'pre-push', 'post-index-change'];

  it('runs none of the repository\'s hooks and lands on leeway-state whatever GIT_DIR names', () => {
    const { main, root, bare } = codeProject(world(), { remote: true });
    const elsewhere = elsewhereRepo();
    const elsewhereBefore = snapshot(elsewhere);

    const fired = path.join(world(), 'hooks-fired');
    const hookScript = (name) => `#!/bin/sh\necho ${name} >> "${fired}"\nexit 1\n`;
    for (const hook of HOOKS) fs.writeFileSync(path.join(main, '.git', 'hooks', hook), hookScript(hook), { mode: 0o755 });
    git(main, ['config', 'hook.guard.command', `echo config >> "${fired}"; exit 1`]);
    for (const hook of HOOKS) git(main, ['config', '--add', 'hook.guard.event', hook]);
    const fsmonitor = path.join(world(), 'fsmonitor');
    fs.writeFileSync(fsmonitor, hookScript('fsmonitor'), { mode: 0o755 });
    git(main, ['config', 'core.fsmonitor', fsmonitor]);

    const { found, created, out } = withEnv({
      GIT_DIR: path.join(elsewhere, '.git'), GIT_WORK_TREE: elsewhere, GIT_INDEX_FILE: path.join(elsewhere, '.git', 'index'),
    }, () => {
      const at = stateRoot(main);
      const made = createState(at);
      createFile(at, layout.projectManifest, '{}\n');
      return { found: at, created: made, out: withStateLock(at, () => commitState(at, [layout.projectManifest], 'state: the manifest')) };
    });

    assert.ok(!fs.existsSync(fired), `hooks fired: ${fs.existsSync(fired) ? fs.readFileSync(fired, 'utf8') : ''}`);
    assert.strictEqual(found, root);
    assert.deepStrictEqual([created.pushed, out.pushed, out.warnings], [true, true, []]);
    assert.strictEqual(tip(root, 'HEAD'), out.commit);
    assert.strictEqual(tip(main, STATE_BRANCH), out.commit);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]), '{}\n');
    assert.strictEqual(remoteTip(bare), out.commit);
    assert.deepStrictEqual(snapshot(elsewhere), elsewhereBefore);
  });
});
