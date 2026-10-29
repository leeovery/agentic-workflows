'use strict';

// ---------------------------------------------------------------------------
// The state worktree (workflow-engine/scripts/domain/state-worktree.cjs) and
// the isolated git it runs on (kernel/isolated-git.cjs): the orphan
// `leeway-state` checked out at `.leeway/` in the main checkout and locked,
// found from any worktree through the common git directory; the writer lock
// that keeps concurrent verbs one after the other; the confined commit — a
// file given a change committed as it makes it of the branch's own, refused
// where git cannot read that — and its push, a failed push a warning; the
// ignore file's added patterns; and every call made with hooks off and the
// caller's repository environment cleared.
//
// Real repositories in temp folders, a bare repository as the remote.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');

const { git, initRepo, testIdentity, bareRepo, STATE_DIR_NAME, statePath, layout, createFile, traced, withEnv, cloneOf, codeProject, tip, remoteTip } = require('./engine-harness.cjs');

const STATE = path.join(__dirname, '../../skills/workflow-engine/scripts/domain/state-worktree.cjs');
const state = require(STATE);
const { REPOSITORY_ENV, isolatedGit, mainCheckout } = require('../../skills/workflow-engine/scripts/kernel/isolated-git.cjs');
const { processStartTime } = require('../../skills/workflow-engine/scripts/kernel/process.cjs');

const { stateRoot } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');
const { isId } = require('../../skills/workflow-engine/scripts/domain/ledger-ids.cjs');

const {
  STATE_BRANCH, STATE_LOCK_REASON, STATE_GITIGNORE,
  inspectState, createState, addStateWorktree, repairStateWorktree, createStateBranchFromRemote, lockStateWorktree,
  askStateRemote, fetchStateTip, codeBranchSharing, stateRemoteUrl, withStateLock, withBootLock, commitState, pushState,
} = state;

/** @type {string} */
let world;

beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'state-worktree-')));
});

afterEach(() => {
  fs.rmSync(world, { recursive: true, force: true });
});

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

/** The inspection's worktree and folder. @param {{worktree: unknown, folder: string}} seen */
function pick({ worktree, folder }) {
  return { worktree, folder };
}

/** The porcelain record git lists for the worktree at `root`. @param {string} main @param {string} root */
function worktreeRecord(main, root) {
  return git(main, ['worktree', 'list', '--porcelain']).split('\n\n').find((block) => block.startsWith(`worktree ${root}\n`));
}

/** Whether git ignores the path in the state worktree. @param {string} root @param {string} rel */
function ignored(root, rel) {
  return spawnSync('git', ['check-ignore', '-q', rel], { cwd: root }).status === 0;
}

/** A repo of its own with one commit, for the environment to point at. @param {string} name */
function elsewhereRepo(name = 'elsewhere') {
  const dir = initRepo(path.join(world, name));
  createFile(dir, 'other.md', 'other\n');
  git(dir, ['add', 'other.md']);
  git(dir, ['commit', '-q', '-m', 'other']);
  return dir;
}

/** @param {string} text @returns {string[]} */
function lines(text) {
  return text.split('\n').filter(Boolean).sort();
}

/** What a repo looks like from outside: its HEAD, its branches, its index. @param {string} dir */
function snapshot(dir) {
  return {
    head: git(dir, ['symbolic-ref', 'HEAD']).trim(),
    sha: tip(dir, 'HEAD'),
    branches: git(dir, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']),
    index: git(dir, ['ls-files', '--stage']),
  };
}

describe('the main checkout', () => {
  it('is found from the main checkout, a folder below it, a code worktree and the state worktree', () => {
    const { main, root } = codeProject(world);
    fs.mkdirSync(path.join(main, 'src', 'deep'), { recursive: true });
    const code = path.join(world, 'code-worktree');
    git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);
    createState(root);

    for (const cwd of [main, path.join(main, 'src', 'deep'), code, root]) {
      assert.strictEqual(mainCheckout(cwd), main, cwd);
      assert.strictEqual(stateRoot(cwd), root, cwd);
    }
  });

  it('refuses a bare repository, from its folder and from a worktree of it', () => {
    const bare = bareRepo(path.join(world, 'bare.git'));
    const seed = initRepo(path.join(world, 'seed'));
    createFile(seed, 'a.md', 'a\n');
    git(seed, ['add', 'a.md']);
    git(seed, ['commit', '-q', '-m', 'a']);
    git(seed, ['push', '-q', bare, 'main']);
    const linked = path.join(world, 'linked');
    git(bare, ['worktree', 'add', '-q', linked, 'main']);

    for (const cwd of [bare, linked]) {
      assert.throws(() => stateRoot(cwd), /has no main checkout — a bare repository/, cwd);
    }
  });

  it('refuses a folder outside any repository', () => {
    assert.throws(() => mainCheckout(world), /is not inside a git repository/);
  });

  it('refuses a copy\'s worktree folder, which git reads as the original\'s, and finds the copy from its own main checkout', () => {
    const { main, root } = codeProject(world, { state: true });
    const side = path.join(main, 'side');
    git(main, ['worktree', 'add', '-q', '-b', 'side', side]);
    const copy = path.join(world, 'copy');
    fs.cpSync(main, copy, { recursive: true, verbatimSymlinks: true });

    for (const [cwd, original] of [[statePath(copy), root], [path.join(copy, 'side'), side]]) {
      assert.throws(() => mainCheckout(cwd),
        new RegExp(`^Error: ${cwd} is in a copy of the worktree at ${original}: git reads it as that worktree, in that repository, so the workflows read and write nothing through it — run from the copy's own project folder$`));
    }
    assert.strictEqual(mainCheckout(copy), copy);
  });
});

describe('the isolated runner', () => {
  it('clears every variable git itself counts as local to a repository', () => {
    const local = git(world, ['rev-parse', '--local-env-vars']).trim().split('\n');
    assert.deepStrictEqual(local.filter((name) => !REPOSITORY_ENV.includes(name)), []);
  });

  it('runs in the cwd\'s repository whatever repository the environment names', () => {
    const { main } = codeProject(world);
    const elsewhere = elsewhereRepo();

    const gitDir = withEnv({ GIT_DIR: path.join(elsewhere, '.git'), GIT_WORK_TREE: elsewhere },
      () => isolatedGit(main).run(['rev-parse', '--absolute-git-dir']).trim());

    assert.strictEqual(gitDir, path.join(main, '.git'));
  });

  it('reads an answer past spawnSync\'s 1 MiB default whole', () => {
    const { main } = codeProject(world);
    const runner = isolatedGit(main);
    const text = `${'x'.repeat(2 * 1024 * 1024)}\n`;
    const oid = runner.run(['hash-object', '-w', '--stdin'], { input: text }).trim();

    assert.strictEqual(runner.run(['cat-file', 'blob', oid]), text);
  });

  it('writes an answer to the file it is given whole, answering nothing', () => {
    const { main } = codeProject(world);
    const runner = isolatedGit(main);
    const text = `${'x'.repeat(2 * 1024 * 1024)}\n`;
    const oid = runner.run(['hash-object', '-w', '--stdin'], { input: text }).trim();
    const file = path.join(world, 'answer');
    const fd = fs.openSync(file, 'w');

    try {
      assert.deepStrictEqual([runner.run(['cat-file', 'blob', oid], { out: fd }), runner.tryRun(['cat-file', 'blob', oid], { out: fd })], ['', '']);
    } finally {
      fs.closeSync(fd);
    }
    assert.strictEqual(fs.readFileSync(file, 'utf8'), text + text);
  });

  it('keeps the state\'s commit and push off whatever the environment points git at', () => {
    const { main, root, bare } = codeProject(world, { remote: true });
    const elsewhere = elsewhereRepo();
    const before = snapshot(elsewhere);
    fs.mkdirSync(path.join(world, 'quarantine'));

    const out = withEnv({
      GIT_DIR: path.join(elsewhere, '.git'),
      GIT_COMMON_DIR: path.join(elsewhere, '.git'),
      GIT_WORK_TREE: elsewhere,
      GIT_INDEX_FILE: path.join(elsewhere, '.git', 'index'),
      GIT_OBJECT_DIRECTORY: path.join(elsewhere, '.git', 'objects'),
      GIT_CONFIG_PARAMETERS: "'user.email'='leaked@example.com'",
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.name',
      GIT_CONFIG_VALUE_0: 'Leaked',
      GIT_NAMESPACE: 'leaked',
      GIT_QUARANTINE_PATH: path.join(world, 'quarantine'),
    }, () => {
      createState(root);
      createFile(root, layout.projectManifest, '{}\n');
      return withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));
    });

    assert.deepStrictEqual([out.pushed, out.warnings], [true, []]);
    assert.strictEqual(tip(main, STATE_BRANCH), out.commit);
    assert.strictEqual(git(main, ['log', '-1', '--format=%an <%ae>', STATE_BRANCH]).trim(), 'Test <test@example.com>');
    assert.strictEqual(remoteTip(bare), out.commit);
    assert.strictEqual(git(bare, ['for-each-ref', 'refs/namespaces']), '');
    assert.deepStrictEqual(snapshot(elsewhere), before);
  });
});

describe('creating the state', () => {
  it('makes leeway-state an orphan whose one commit holds the state\'s .gitignore and the project manifest, a new project_id its one field (16.13.5)', () => {
    const { main, root } = codeProject(world);

    const created = createState(root);

    assert.strictEqual(tip(main, STATE_BRANCH), created.commit);
    assert.deepStrictEqual(git(main, ['rev-list', '--parents', STATE_BRANCH]).trim().split(' '), [created.commit]);
    assert.deepStrictEqual(git(main, ['ls-tree', '--name-only', STATE_BRANCH]).trim().split('\n'), ['.gitignore', layout.projectManifest]);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:.gitignore`]), STATE_GITIGNORE);
    const manifest = JSON.parse(git(main, ['show', `${STATE_BRANCH}:manifest.json`]));
    assert.deepStrictEqual(Object.keys(manifest), ['project_id']);
    assert.ok(isId(manifest.project_id), manifest.project_id);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(root, layout.projectManifest), 'utf8')), manifest, 'checked out at the state root');

    const other = codeProject(world, { name: 'other' });
    createState(other.root);
    assert.notStrictEqual(JSON.parse(git(other.main, ['show', `${STATE_BRANCH}:manifest.json`])).project_id, manifest.project_id, 'each project its own');
  });

  it('ignores the knowledge base, the cache and the writer lock in the state worktree, and nothing else', () => {
    const { root } = codeProject(world, { state: true });

    for (const rel of ['.knowledge/store.bin', '.cache/unit/state.json', '.lock']) assert.ok(ignored(root, rel), rel);
    for (const rel of [layout.projectManifest, layout.ledger, 'unit/.cache/x', 'unit/.lock']) assert.ok(!ignored(root, rel), rel);
  });

  it('checks the branch out at .leeway/ in the main checkout, locked with the state\'s reason (4.S6)', () => {
    const { main, root } = codeProject(world);

    createState(root);

    assert.strictEqual(git(root, ['symbolic-ref', 'HEAD']).trim(), `refs/heads/${STATE_BRANCH}`);
    const record = worktreeRecord(main, root);
    assert.ok(record, `no worktree listed at ${root}`);
    assert.match(record, /^locked workflows state, do not remove$/m);
    assert.strictEqual(STATE_LOCK_REASON, 'workflows state, do not remove');
  });

  it('puts .leeway/ in the main checkout when made from a code worktree, never in the worktree (4.1.4)', () => {
    const { main, root } = codeProject(world);
    const code = path.join(world, 'code-worktree');
    git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);

    createState(stateRoot(code));

    assert.ok(fs.existsSync(statePath(main, layout.gitignore)));
    assert.ok(!fs.existsSync(path.join(code, STATE_DIR_NAME)));
    assert.ok(worktreeRecord(main, root));
  });

  it('leaves the main checkout\'s branch, HEAD and index as they were', () => {
    const { main, root } = codeProject(world);
    const before = snapshot(main);

    createState(root);

    const after = snapshot(main);
    assert.strictEqual(after.head, before.head);
    assert.strictEqual(after.sha, before.sha);
    assert.strictEqual(after.index, before.index);
    assert.deepStrictEqual(lines(after.branches), lines(`${before.branches}refs/heads/${STATE_BRANCH} ${tip(main, STATE_BRANCH)}\n`));
  });

  it('pushes the new branch where the project has a remote', () => {
    const { root, bare } = codeProject(world, { remote: true });

    const created = createState(root);

    assert.deepStrictEqual({ pushed: created.pushed, warnings: created.warnings }, { pushed: true, warnings: [] });
    assert.strictEqual(remoteTip(bare), created.commit);
  });

  it('attempts no push where the project has no remote (4.S5)', () => {
    const { root } = codeProject(world);

    const { result, commands } = traced(() => createState(root));

    assert.deepStrictEqual({ pushed: result.pushed, warnings: result.warnings }, { pushed: false, warnings: [] });
    assert.ok(commands.some((c) => c.startsWith('commit-tree ')), `the trace caught nothing: ${commands}`);
    assert.ok(!commands.some((c) => c.startsWith('push ')), `a push was attempted: ${commands}`);
  });

  it('refuses where .leeway/ already exists, creating no branch', () => {
    const { main, root } = codeProject(world);
    fs.mkdirSync(root);

    assert.throws(() => createState(root), /already exists/);
    assert.strictEqual(git(main, ['branch', '--list', STATE_BRANCH]), '');
  });

  it('clears a registration a deleted folder left at .leeway/, and checks the new branch out there', () => {
    const { main, root } = codeProject(world, { state: true });
    fs.rmSync(root, { recursive: true, force: true });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    const created = createState(root);

    assert.strictEqual(tip(main, STATE_BRANCH), created.commit);
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('refuses where leeway-state already exists, adding no worktree', () => {
    const { main, root } = codeProject(world);
    git(main, ['branch', STATE_BRANCH]);

    assert.throws(() => createState(root), /cannot create leeway-state/);
    assert.ok(!fs.existsSync(root));
    assert.strictEqual(tip(main, STATE_BRANCH), tip(main, 'main'));
  });
});

describe('inspecting the state', () => {
  it('reads nothing in a project the state has not reached', () => {
    const { main, root } = codeProject(world);

    assert.deepStrictEqual(inspectState(root), {
      main, root, branch: false, remotes: [], remote: null, remoteBranch: false, worktree: null, folder: 'absent',
    });
  });

  it('reads the branch, its worktree on the branch and locked, and the folder git opens', () => {
    const { main, root } = codeProject(world, { state: true });

    assert.deepStrictEqual(inspectState(root), {
      main,
      root,
      branch: true,
      remotes: [],
      remote: null,
      remoteBranch: false,
      worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON },
      folder: 'linked',
    });
  });

  it('reads the remote and its branch once pushed', () => {
    const { root } = codeProject(world, { remote: true });
    assert.deepStrictEqual([inspectState(root).remote, inspectState(root).remoteBranch], ['origin', false]);

    createState(root);

    assert.deepStrictEqual([inspectState(root).remote, inspectState(root).remoteBranch], ['origin', true]);
  });

  it('reads a fresh clone: the remote\'s branch, no local branch, no worktree', () => {
    const { bare } = codeProject(world, { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world, 'fresh'));

    const seen = inspectState(stateRoot(fresh));

    assert.deepStrictEqual(seen, {
      main: fresh, root: statePath(fresh), branch: false, remotes: ['origin'], remote: 'origin', remoteBranch: true, worktree: null, folder: 'absent',
    });
  });

  it('reads a worktree whose folder is gone, and one that is unlocked', () => {
    const { main, root } = codeProject(world, { state: true });

    git(main, ['worktree', 'unlock', root]);
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: false, reason: null }, folder: 'linked' });

    lockStateWorktree(root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'absent' });
  });

  it('takes origin as the state\'s remote, else the one the main checkout\'s branch tracks, else the one remote', () => {
    const { main, root } = codeProject(world);
    const seen = () => {
      const { remotes, remote } = inspectState(root);
      return { remotes, remote };
    };

    git(main, ['remote', 'add', 'upstream', path.join(world, 'upstream.git')]);
    assert.deepStrictEqual(seen(), { remotes: ['upstream'], remote: 'upstream' });

    git(main, ['remote', 'add', 'fork', path.join(world, 'fork.git')]);
    assert.deepStrictEqual(seen(), { remotes: ['fork', 'upstream'], remote: null });

    git(main, ['config', 'branch.main.remote', 'fork']);
    assert.deepStrictEqual(seen(), { remotes: ['fork', 'upstream'], remote: 'fork' });

    git(main, ['remote', 'add', 'origin', path.join(world, 'origin.git')]);
    assert.deepStrictEqual(seen(), { remotes: ['fork', 'origin', 'upstream'], remote: 'origin' });
  });
});

describe('the repairs, each on its own', () => {
  it('brings a fresh clone\'s state in from the remote: the branch, then the worktree, locked (4.S11)', () => {
    const { bare } = codeProject(world, { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world, 'fresh'));
    const freshRoot = stateRoot(fresh);

    createStateBranchFromRemote(freshRoot);
    addStateWorktree(freshRoot);

    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.strictEqual(fs.readFileSync(path.join(freshRoot, '.gitignore'), 'utf8'), STATE_GITIGNORE);
    assert.deepStrictEqual(pick(inspectState(freshRoot)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('restores a lost local branch from the remote\'s (4.S8)', () => {
    const { main, root, bare } = codeProject(world, { remote: true, state: true });
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    git(main, ['branch', '-D', STATE_BRANCH]);

    createStateBranchFromRemote(root);

    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
  });

  it('refuses to take the branch from a remote that is missing or holds none', () => {
    const none = codeProject(world);
    assert.throws(() => createStateBranchFromRemote(none.root), /no remote to take leeway-state from/);

    const empty = codeProject(world, { remote: true, name: 'empty' });
    assert.throws(() => createStateBranchFromRemote(empty.root), /origin holds no leeway-state/);
  });

  it('re-adds a removed worktree, locked (4.S29)', () => {
    const { main, root } = codeProject(world, { state: true });
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: null, folder: 'absent' });

    addStateWorktree(root);

    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('re-adds a worktree whose folder was deleted under its locked registration (4.S29)', () => {
    const { root } = codeProject(world, { state: true });
    fs.rmSync(root, { recursive: true, force: true });

    addStateWorktree(root);

    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
    assert.strictEqual(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), STATE_GITIGNORE);
  });

  it('refuses to add the worktree where there is no local branch', () => {
    const { root } = codeProject(world);

    assert.throws(() => addStateWorktree(root), /there is no local leeway-state/);
    assert.ok(!fs.existsSync(root));
  });

  it('locks an unlocked worktree with the state\'s reason (4.S29)', () => {
    const { main, root } = codeProject(world, { state: true });
    git(main, ['worktree', 'unlock', root]);

    lockStateWorktree(root);

    assert.match(worktreeRecord(main, root) || '', /^locked workflows state, do not remove$/m);
  });

  it('relinks the state worktree after the project folder moved, keeping what it holds, and commits again', () => {
    const { main, root } = codeProject(world, { state: true });
    createFile(root, layout.projectManifest, '{"kept":true}\n');
    const moved = path.join(world, 'moved');
    fs.renameSync(main, moved);
    const movedRoot = stateRoot(moved);

    const seen = inspectState(movedRoot);
    assert.deepStrictEqual([seen.branch, pick(seen)], [true, { worktree: null, folder: 'unlinked' }]);
    assert.throws(() => commitState(movedRoot, [layout.projectManifest], 'state: x'),
      /^Error: git cannot open the state worktree at .*moved\/\.leeway: git rev-parse failed: fatal: .+ — nothing committed$/s);
    assert.throws(() => addStateWorktree(movedRoot), /a folder is already at .*moved\/\.leeway — repair its worktree rather than add one over it/);

    assert.deepStrictEqual(repairStateWorktree(movedRoot), { was: 'moved', from: main });

    assert.deepStrictEqual(pick(inspectState(movedRoot)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
    assert.strictEqual(fs.readFileSync(path.join(movedRoot, layout.projectManifest), 'utf8'), '{"kept":true}\n');
    const out = withStateLock(movedRoot, () => commitState(movedRoot, [layout.projectManifest], 'state: after the move'));
    assert.strictEqual(tip(moved, STATE_BRANCH), out.commit);
    assert.strictEqual(git(moved, ['show', `${STATE_BRANCH}:manifest.json`]), '{"kept":true}\n');
  });

  it('never writes through a copied project\'s state worktree, which git reads as the original\'s', () => {
    const { main } = codeProject(world, { state: true });
    const before = tip(main, STATE_BRANCH);
    const copy = path.join(world, 'copy');
    fs.cpSync(main, copy, { recursive: true, verbatimSymlinks: true });
    const copyRoot = stateRoot(copy);
    createFile(copyRoot, layout.projectManifest, '{}\n');

    assert.strictEqual(inspectState(copyRoot).folder, 'unlinked');
    assert.throws(() => commitState(copyRoot, [layout.projectManifest], 'state: x'),
      new RegExp(`git cannot open the state worktree at .*copy/\\.leeway: git reads it as part of .*, whose repository is ${main}/\\.git`));
    assert.strictEqual(tip(main, STATE_BRANCH), before);
    assert.strictEqual(tip(copy, STATE_BRANCH), before);
  });

  it('relinks a copied project\'s state worktree to the copy\'s own registration, the original\'s links — its code worktrees\' too — left as they were', () => {
    const { main, root } = codeProject(world, { state: true });
    const side = path.join(main, 'side');
    git(main, ['worktree', 'add', '-q', '-b', 'side', side]);
    const admin = path.join(main, '.git/worktrees');
    const links = () => [path.join(root, '.git'), path.join(side, '.git'), ...fs.readdirSync(admin).map((id) => path.join(admin, id, 'gitdir'))]
      .map((file) => [file, fs.readFileSync(file, 'utf8')]);
    const before = links();
    const copy = path.join(world, 'copy');
    fs.cpSync(main, copy, { recursive: true, verbatimSymlinks: true });
    const copyRoot = stateRoot(copy);

    assert.deepStrictEqual(repairStateWorktree(copyRoot), { was: 'copied', from: main });

    assert.deepStrictEqual(links(), before);
    assert.deepStrictEqual(pick(inspectState(copyRoot)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
    createFile(copyRoot, layout.projectManifest, '{"copy":true}\n');
    const ours = withStateLock(copyRoot, () => commitState(copyRoot, [layout.projectManifest], 'state: the copy'));
    assert.strictEqual(tip(copy, STATE_BRANCH), ours.commit);
    assert.notStrictEqual(tip(main, STATE_BRANCH), ours.commit);
  });

  it('relinks a registration whose own link went stale, the folder\'s already right', () => {
    const { main, root } = codeProject(world, { state: true });
    fs.writeFileSync(path.join(main, '.git/worktrees/-leeway/gitdir'), `${path.join(world, 'elsewhere/.git')}\n`);

    assert.deepStrictEqual(repairStateWorktree(root), { was: 'own', from: main });

    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('refuses a folder holding no link, and one naming a registration this repository does not keep — nothing relinked', () => {
    const { main, root } = codeProject(world, { state: true });

    fs.writeFileSync(path.join(root, '.git'), 'not a link\n');
    assert.throws(() => repairStateWorktree(root), new RegExp(`^Error: ${root} holds no worktree link git can read — nothing relinked$`));

    const stranger = path.join(world, 'other/.git/worktrees/stranger');
    fs.writeFileSync(path.join(root, '.git'), `gitdir: ${stranger}\n`);
    assert.throws(() => repairStateWorktree(root), new RegExp(`^Error: ${root} links to ${stranger}, and this repository keeps no registration by that name — nothing relinked$`));
    assert.strictEqual(fs.readFileSync(path.join(main, '.git/worktrees/-leeway/gitdir'), 'utf8'), `${path.join(root, '.git')}\n`);
  });
});

describe('the remote, asked', () => {
  it('answers no remote where the project has none, never asking', () => {
    const { root } = codeProject(world, { state: true });

    const { result, commands } = traced(() => askStateRemote(root));

    assert.deepStrictEqual(result, { remote: null, remotes: [] });
    assert.ok(!commands.some((c) => c.startsWith('ls-remote ')));
  });

  it('answers the remote\'s tip, or none where it holds no leeway-state', () => {
    const { main, root, bare } = codeProject(world, { remote: true });

    assert.deepStrictEqual(askStateRemote(root), { remote: 'origin', remotes: ['origin'], tip: null });
    createState(root);
    assert.deepStrictEqual(askStateRemote(root), { remote: 'origin', remotes: ['origin'], tip: remoteTip(bare) });
    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
  });

  it('answers why a remote out of reach could not be reached, never that it holds none', () => {
    const { main, root } = codeProject(world, { remote: true });
    git(main, ['remote', 'set-url', 'origin', path.join(world, 'nowhere.git')]);

    const answer = askStateRemote(root);

    assert.deepStrictEqual([answer.remote, 'tip' in answer], ['origin', false]);
    assert.match(/** @type {{unreachable: string}} */ (answer).unreachable, /^git ls-remote failed: /);
  });

  it('brings the remote\'s tip into its tracking branch: set where this clone holds it, fetched where not', () => {
    const { bare } = codeProject(world, { remote: true, state: true });
    const fresh = path.join(world, 'fresh');
    git(world, ['clone', '-q', '--single-branch', '--branch', 'main', `file://${bare}`, fresh]);
    testIdentity(fresh);

    const fetched = traced(() => fetchStateTip(stateRoot(fresh), 'origin', remoteTip(bare)));
    assert.deepStrictEqual([fetched.result, fetched.commands.some((c) => c.startsWith('fetch '))], [null, true]);
    assert.strictEqual(tip(fresh, `refs/remotes/origin/${STATE_BRANCH}`), remoteTip(bare));

    git(fresh, ['update-ref', '-d', `refs/remotes/origin/${STATE_BRANCH}`]);
    const set = traced(() => fetchStateTip(stateRoot(fresh), 'origin', remoteTip(bare)));
    assert.deepStrictEqual([set.result, set.commands.some((c) => c.startsWith('fetch '))], [null, false]);
    assert.strictEqual(tip(fresh, `refs/remotes/origin/${STATE_BRANCH}`), remoteTip(bare));
  });

  it('answers why a fetch failed, the tracking branch untouched', () => {
    const { bare } = codeProject(world, { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world, 'fresh'));
    git(fresh, ['update-ref', '-d', `refs/remotes/origin/${STATE_BRANCH}`]);
    git(fresh, ['remote', 'set-url', 'origin', path.join(world, 'nowhere.git')]);

    assert.match(fetchStateTip(stateRoot(fresh), 'origin', 'f'.repeat(40)) ?? '', /^git fetch failed: /);
    assert.strictEqual(git(fresh, ['for-each-ref', `refs/remotes/origin/${STATE_BRANCH}`]), '');
  });

  it('reads the URL the state\'s remote fetches from, any insteadOf applied, and none without a remote', () => {
    const { main, root, bare } = codeProject(world, { remote: true });
    git(main, ['config', `url.${bare}.insteadOf`, 'gh:acme/portal']);
    git(main, ['remote', 'set-url', 'origin', 'gh:acme/portal']);

    assert.strictEqual(stateRemoteUrl(root), bare);
    assert.strictEqual(stateRemoteUrl(codeProject(world, { name: 'alone' }).root), null);
  });
});

describe('a leeway-state holding code history', () => {
  it('shares a commit with a code branch, which is named; the orphan shares none, its remote copies not counted as code', () => {
    const code = codeProject(world, { name: 'code' });
    git(code.main, ['branch', STATE_BRANCH, 'main']);
    assert.strictEqual(codeBranchSharing(code.root, STATE_BRANCH), 'main');

    const { root, bare } = codeProject(world, { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world, 'fresh'));
    createStateBranchFromRemote(stateRoot(fresh));
    assert.strictEqual(codeBranchSharing(root, STATE_BRANCH), null);
    assert.strictEqual(codeBranchSharing(stateRoot(fresh), STATE_BRANCH), null);
  });

  it('reads a remote\'s as last fetched', () => {
    const { main, bare } = codeProject(world, { remote: true });
    git(main, ['push', '-q', 'origin', `main:refs/heads/${STATE_BRANCH}`]);
    const fresh = cloneOf(bare, path.join(world, 'fresh'));

    assert.strictEqual(codeBranchSharing(stateRoot(fresh), `refs/remotes/origin/${STATE_BRANCH}`), 'origin/main');
  });
});

describe('the writer lock', () => {
  it('is .leeway/.lock, held while the verb runs and released after, whatever it throws', () => {
    const { root } = codeProject(world, { state: true });
    const lock = path.join(root, '.lock');

    const held = withStateLock(root, () => JSON.parse(fs.readFileSync(lock, 'utf8')));
    assert.deepStrictEqual(held, { pid: process.pid, pid_start: processStartTime(process.pid) });
    assert.ok(!fs.existsSync(lock));

    assert.throws(() => withStateLock(root, () => { throw new Error('the verb failed'); }), /the verb failed/);
    assert.ok(!fs.existsSync(lock));
  });

  it('takes over at once a lock whose holder is gone, however fresh the lock', () => {
    const { root } = codeProject(world, { state: true });
    const lock = path.join(root, '.lock');
    const ended = spawnSync('node', ['-e', '']).pid;

    for (const left of [{ pid: ended, pid_start: 'gone' }, { pid: process.pid, pid_start: 'a process before this one' }]) {
      fs.writeFileSync(lock, JSON.stringify(left));
      const started = Date.now();

      const ran = withStateLock(root, () => JSON.parse(fs.readFileSync(lock, 'utf8')).pid_start);

      assert.ok(Date.now() - started < 2000, `waited ${Date.now() - started}ms on ${JSON.stringify(left)}`);
      assert.strictEqual(ran, processStartTime(process.pid));
      assert.ok(!fs.existsSync(lock));
    }
  });

  // A holder in a process of its own: it takes the lock, ages it ten
  // minutes, says it holds it, and keeps it until told to let go.
  const HOLDER = [
    "const fs = require('fs');",
    "const path = require('path');",
    'const [mod, root, signals] = process.argv.slice(1);',
    'const { withStateLock } = require(mod);',
    'withStateLock(root, () => {',
    '  const past = (Date.now() - 600000) / 1000;',
    "  fs.utimesSync(path.join(root, '.lock'), past, past);",
    "  fs.writeFileSync(path.join(signals, 'held'), '');",
    "  while (!fs.existsSync(path.join(signals, 'go'))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);",
    '});',
  ].join('\n');

  /** Wait, without blocking the loop, until `ready` holds. @param {() => boolean} ready */
  async function until(ready) {
    const deadline = Date.now() + 10000;
    while (!ready()) {
      if (Date.now() > deadline) throw new Error('waited ten seconds');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it('never breaks a live holder, however long it has held: the contender gives up, naming it', async () => {
    const { root } = codeProject(world, { state: true });
    const lock = path.join(root, '.lock');
    const holder = spawn('node', ['-e', HOLDER, STATE, root, world]);
    let stderr = '';
    holder.stderr.on('data', (chunk) => { stderr += chunk; });
    const exited = new Promise((resolve) => holder.on('exit', resolve));
    try {
      await until(() => fs.existsSync(path.join(world, 'held')));

      assert.throws(() => withStateLock(root, () => null, { timeoutMs: 300 }),
        new RegExp(`Timed out waiting for the state lock .*process ${holder.pid} holds it`));
      assert.strictEqual(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, holder.pid);
    } finally {
      fs.writeFileSync(path.join(world, 'go'), '');
    }
    assert.strictEqual(await exited, 0, stderr);
    assert.ok(!fs.existsSync(lock));
  });

  it('is taken again at once by the process holding it, and let go when the outermost hold ends', () => {
    const { root } = codeProject(world, { state: true });
    const lock = path.join(root, '.lock');
    const started = Date.now();

    const seen = withStateLock(root, () => {
      const inner = withStateLock(root, () => withStateLock(root, () => fs.existsSync(lock)));
      assert.throws(() => withStateLock(root, () => { throw new Error('the inner verb failed'); }), /the inner verb failed/);
      return [inner, fs.existsSync(lock)];
    });

    assert.ok(Date.now() - started < 2000, `the nested holds waited ${Date.now() - started}ms`);
    assert.deepStrictEqual(seen, [true, true]);
    assert.ok(!fs.existsSync(lock));
  });

  it('leaves the lock alone at release where another holder has taken it', () => {
    const { root } = codeProject(world, { state: true });
    const lock = path.join(root, '.lock');
    const other = JSON.stringify({ pid: 1, pid_start: 'another holder' });

    withStateLock(root, () => fs.writeFileSync(lock, other));

    assert.strictEqual(fs.readFileSync(lock, 'utf8'), other);
  });

  it('never shows as a change in the state worktree, nor do the files its claim makes', () => {
    const { root } = codeProject(world, { state: true });

    const status = withStateLock(root, () => git(root, ['status', '--porcelain', '--untracked-files=all']));

    assert.strictEqual(status, '');
    for (const rel of ['.lock.4242.tmp', '.lock.breaking']) assert.ok(ignored(root, rel), rel);
  });

  it('refuses where there is no state worktree', () => {
    const { root } = codeProject(world);

    assert.throws(() => withStateLock(root, () => null), /no state worktree at/);
  });
});

describe('boot\'s lock', () => {
  it('is .git/leeway-boot.lock in the main checkout, there before the state worktree is, held while boot\'s checks run and released after, whatever they throw', () => {
    const { main, root } = codeProject(world);
    const lock = path.join(main, '.git/leeway-boot.lock');

    const held = withBootLock(root, () => {
      createState(root);
      return JSON.parse(fs.readFileSync(lock, 'utf8'));
    });
    assert.deepStrictEqual(held, { pid: process.pid, pid_start: processStartTime(process.pid) });
    assert.ok(!fs.existsSync(lock));

    assert.throws(() => withBootLock(root, () => { throw new Error('the checks failed'); }), /the checks failed/);
    assert.ok(!fs.existsSync(lock));
  });
});

describe('committing state', () => {
  it('commits exactly the paths given, on leeway-state, whatever else is changed or staged', () => {
    const { root } = codeProject(world, { state: true });
    createFile(root, layout.manifest('pay'), '{}\n');
    createFile(root, 'unit/topics/a/log.md', '# a\n');
    createFile(root, 'unit/topics/a/brief.md', '# brief\n');
    git(root, ['add', 'unit/topics/a/brief.md']);

    const out = withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: the manifest'));

    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.strictEqual(git(root, ['log', '-1', '--format=%s', STATE_BRANCH]).trim(), 'state: the manifest');
    assert.deepStrictEqual(touched(root, out.commit), ['A\tpay/manifest.json']);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), 'A  unit/topics/a/brief.md\n?? unit/topics/a/log.md\n');
  });

  it('commits a file added, one changed and one deleted, a folder taking every file in it', () => {
    const { root } = codeProject(world, { state: true });
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
    const { root } = codeProject(world, { state: true });
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
    const { root } = codeProject(world, { state: true });
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
    const { root } = codeProject(world, { state: true });
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
    const { root, bare } = codeProject(world, { remote: true, state: true });
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
      const { root } = codeProject(world, { state: true });
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
    const { root } = codeProject(world, { state: true });
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
    const { root } = codeProject(world, { state: true });
    const before = tip(root, STATE_BRANCH);
    createFile(root, '.cache/unit/state.json', '{}\n');

    assert.throws(() => commitState(root, ['.cache/unit/state.json'], 'state: x'), /ignored/);
    assert.strictEqual(tip(root, STATE_BRANCH), before);
  });

  it('commits past a private index and its lock a kill left mid-step', () => {
    const { root } = codeProject(world, { state: true });
    const index = path.resolve(root, git(root, ['rev-parse', '--git-path', 'leeway-commit.index']).trim());
    fs.writeFileSync(index, 'left by a killed verb');
    fs.writeFileSync(`${index}.lock`, '');
    createFile(root, layout.manifest('pay'), '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: the manifest'));

    assert.deepStrictEqual(touched(root, out.commit || ''), ['A\tpay/manifest.json']);
    assert.ok(!fs.existsSync(index) && !fs.existsSync(`${index}.lock`));
  });

  it('keeps the commit and warns where the worktree\'s own index is held, and lines it up on the next commit', () => {
    const { root } = codeProject(world, { state: true });
    const indexLock = path.resolve(root, git(root, ['rev-parse', '--git-path', 'index.lock']).trim());
    fs.writeFileSync(indexLock, '');
    createFile(root, layout.manifest('pay'), '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: the manifest'));

    assert.deepStrictEqual(touched(root, out.commit || ''), ['A\tpay/manifest.json']);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /^the state worktree's index was not brought into line with leeway-state: .*index\.lock/s);

    fs.rmSync(indexLock);
    assert.deepStrictEqual(withStateLock(root, () => commitState(root, [layout.manifest('pay')], 'state: again')), { commit: null, pushed: false, warnings: [] });
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
  });

  it('makes no commit and no push where the paths hold no change, or where no path is given', () => {
    const { root, bare } = codeProject(world, { remote: true, state: true });
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
    const { root } = codeProject(world, { state: true });
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
    const { main, root } = codeProject(world, { state: true });
    createFile(root, layout.projectManifest, '{}\n');
    const before = tip(root, STATE_BRANCH);

    for (const outside of ['../README.md', path.join(main, 'README.md')]) {
      assert.throws(() => commitState(root, [layout.projectManifest, outside], 'state: x'), /is outside the state worktree/, outside);
    }
    assert.strictEqual(tip(root, STATE_BRANCH), before);
  });

  it('leaves the main checkout\'s branch, HEAD and index as they were', () => {
    const { main, root } = codeProject(world, { state: true });
    const before = snapshot(main);
    createFile(root, layout.projectManifest, '{}\n');

    withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));

    const after = snapshot(main);
    assert.deepStrictEqual([after.head, after.sha, after.index], [before.head, before.sha, before.index]);
    assert.strictEqual(tip(main, 'main'), before.sha);
  });

  it('pushes leeway-state to the remote after the commit', () => {
    const { root, bare } = codeProject(world, { remote: true, state: true });
    createFile(root, layout.projectManifest, '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));

    assert.deepStrictEqual([out.pushed, out.warnings], [true, []]);
    assert.strictEqual(remoteTip(bare), out.commit);
  });

  it('attempts no push where the project has no remote (4.S5)', () => {
    const { root } = codeProject(world, { state: true });
    createFile(root, layout.projectManifest, '{}\n');

    const { result, commands } = traced(() => withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest')));

    assert.deepStrictEqual([result.pushed, result.warnings], [false, []]);
    assert.ok(commands.some((c) => c.startsWith('commit-tree ')), `the trace caught nothing: ${commands}`);
    assert.ok(!commands.some((c) => c.startsWith('push ')), `a push was attempted: ${commands}`);
  });

  it('keeps the commit and answers a warning where the remote refuses the push (4.S4)', () => {
    const { root, bare } = codeProject(world, { remote: true });
    const created = createState(root);
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });
    createFile(root, layout.projectManifest, '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));

    assert.match(out.commit || '', /^[0-9a-f]{40}$/);
    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.strictEqual(git(root, ['show', `${STATE_BRANCH}:manifest.json`]), '{}\n');
    assert.strictEqual(out.pushed, false);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /^leeway-state is committed here but was not pushed to origin — the commit stands, and the next boot pushes it: .*no pushes today/s);
    assert.strictEqual(remoteTip(bare), created.commit);
  });

  it('never forces: a remote that moved ahead keeps its tip, and the push is a warning that says what is true, never git\'s advice to pull', () => {
    const { root, bare } = codeProject(world, { remote: true, state: true });
    const other = cloneOf(bare, path.join(world, 'other'));
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
    const { main, root } = codeProject(world, { state: true });
    const silent = path.join(world, 'silent-ssh');
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
    const { main, root } = codeProject(world);
    const [fork, upstream] = ['fork', 'upstream'].map((name) => {
      const bare = bareRepo(path.join(world, `${name}.git`));
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
    const { root, bare } = codeProject(world, { remote: true, state: true });
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
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const dir = path.join(world, 'interrupting-git');
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
    return spawnSync('node', ['-e', COMMIT, STATE, root], {
      encoding: 'utf8', env: { ...process.env, PATH: `${interruptingGit()}:${process.env.PATH}`, ...env },
    });
  }

  it('moves the branch only from the tip it built on: one that moved meanwhile refuses the commit', () => {
    const { root } = codeProject(world, { state: true });
    createFile(root, 'u/a.md', 'a\n');
    withStateLock(root, () => commitState(root, ['u'], 'state: base'));
    const elsewhere = git(root, ['commit-tree', `${STATE_BRANCH}^{tree}`, '-p', STATE_BRANCH, '-m', 'a writer the lock missed']).trim();
    createFile(root, 'u/a.md', 'a2\n');

    const res = commitInterrupted(root, { MOVE_AFTER: 'commit-tree', MOVE_TO: elsewhere });

    assert.strictEqual(res.status, 3, res.stderr);
    assert.match(res.stdout, /^git update-ref failed: /);
    assert.strictEqual(tip(root, STATE_BRANCH), elsewhere);
  });

  for (const step of ['read-tree', 'add', 'write-tree', 'commit-tree', 'update-ref', 'reset']) {
    it(`leaves the branch at its old tip or the whole commit, and the next commit right, when killed after ${step}`, () => {
      const { root } = codeProject(world, { state: true });
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
      assert.strictEqual(killed.signal, 'SIGKILL', `the verb was not killed: ${killed.stderr}`);
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
    const { main, root, bare } = codeProject(world, { remote: true });
    const elsewhere = elsewhereRepo();
    const elsewhereBefore = snapshot(elsewhere);

    const fired = path.join(world, 'hooks-fired');
    const hookScript = (name) => `#!/bin/sh\necho ${name} >> "${fired}"\nexit 1\n`;
    for (const hook of HOOKS) fs.writeFileSync(path.join(main, '.git', 'hooks', hook), hookScript(hook), { mode: 0o755 });
    git(main, ['config', 'hook.guard.command', `echo config >> "${fired}"; exit 1`]);
    for (const hook of HOOKS) git(main, ['config', '--add', 'hook.guard.event', hook]);
    const fsmonitor = path.join(world, 'fsmonitor');
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
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:manifest.json`]), '{}\n');
    assert.strictEqual(remoteTip(bare), out.commit);
    assert.deepStrictEqual(snapshot(elsewhere), elsewhereBefore);
  });
});

describe('two sessions writing state at once (4.S3)', () => {
  // One session's verbs: under the writer lock, read the ledger, append its
  // line, commit it — a lost update would show as a missing line.
  const SESSION = [
    "const fs = require('fs');",
    "const path = require('path');",
    'const [mod, root, who, turns] = process.argv.slice(1);',
    'const { withStateLock, commitState } = require(mod);',
    `const ledger = path.join(root, ${JSON.stringify(layout.ledger)});`,
    'for (let i = 1; i <= Number(turns); i++) {',
    '  withStateLock(root, () => {',
    "    const before = fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8') : '';",
    '    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);',
    "    fs.writeFileSync(ledger, before + JSON.stringify({ who, i }) + '\\n');",
    `    const out = commitState(root, [${JSON.stringify(layout.ledger)}], who + ' ' + i);`,
    '    if (out.commit === null || !out.pushed) throw new Error(JSON.stringify(out));',
    '  });',
    '}',
  ].join('\n');

  /** @param {string} root @param {string} who @param {number} turns */
  function session(root, who, turns) {
    const proc = spawn('node', ['-e', SESSION, STATE, root, who, String(turns)]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    return new Promise((resolve) => proc.on('exit', (code) => resolve({ code, stderr })));
  }

  it('writes one after the other: every line kept, one line per commit, a linear branch with no merge', async () => {
    const { root, bare } = codeProject(world, { remote: true, state: true });
    const turns = 6;

    const results = await Promise.all([session(root, 'a', turns), session(root, 'b', turns)]);

    for (const r of results) assert.strictEqual(r.code, 0, `a session failed: ${r.stderr}`);
    const lines = git(root, ['show', `${STATE_BRANCH}:.ledger.jsonl`]).trim().split('\n').map((line) => JSON.parse(line));
    for (const who of ['a', 'b']) {
      assert.deepStrictEqual(lines.filter((l) => l.who === who).map((l) => l.i), [1, 2, 3, 4, 5, 6], who);
    }
    const commits = git(root, ['rev-list', '--parents', STATE_BRANCH]).trim().split('\n').map((line) => line.split(' '));
    assert.strictEqual(commits.length, 2 * turns + 1);
    assert.ok(commits.every((c) => c.length <= 2), 'a commit with more than one parent');
    assert.strictEqual(git(root, ['rev-list', '--merges', STATE_BRANCH]), '');
    for (const [sha, parent] of commits.slice(0, -1)) {
      assert.strictEqual(git(root, ['diff', '--numstat', parent, sha]), '1\t0\t.ledger.jsonl\n', sha);
    }
    assert.strictEqual(remoteTip(bare), tip(root, STATE_BRANCH));
  });
});
