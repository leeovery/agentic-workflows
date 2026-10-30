'use strict';

// ---------------------------------------------------------------------------
// The state worktree (workflow-engine/scripts/domain/state-worktree.cjs) and
// the isolated git it runs on (kernel/isolated-git.cjs): the orphan
// `leeway-state` checked out at `.leeway/` in the main checkout and locked,
// found from any worktree through the common git directory; every call made
// with the caller's repository environment cleared, and within a time limit;
// creating the state, inspecting it, each repair on its own, the remote
// asked, and a branch holding code history. The locks are
// test-engine-state-lock.cjs's; the commit, its push and its hooks off,
// test-engine-state-commit.cjs's.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote (state-worktree-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git, initRepo, testIdentity, bareRepo, STATE_DIR_NAME, statePath, layout, createFile, traced, childLimits, withEnv, cloneOf, codeProject, tip, remoteTip } = require('./engine-harness.cjs');
const { useWorld, elsewhereRepo, snapshot, ignored } = require('./state-worktree-world.cjs');

const ISOLATED_GIT = path.join(__dirname, '../../skills/workflow-engine/scripts/kernel/isolated-git.cjs');
const { REPOSITORY_ENV, CALL_TIMEOUT_MS, isolatedGit, mainCheckout } = require(ISOLATED_GIT);
const { GitError } = require('../../skills/workflow-engine/scripts/kernel/git.cjs');

const { stateRoot } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');
const { isId } = require('../../skills/workflow-engine/scripts/domain/ledger-ids.cjs');

const {
  STATE_BRANCH, STATE_LOCK_REASON, STATE_GITIGNORE,
  inspectState, createState, addStateWorktree, repairStateWorktree, createStateBranchFromRemote, lockStateWorktree,
  askStateRemote, fetchStateTip, codeBranchSharing, stateRemoteUrl, withStateLock, commitState,
} = require('../../skills/workflow-engine/scripts/domain/state-worktree.cjs');

const world = useWorld();

/** The inspection's worktree and folder. @param {{worktree: unknown, folder: string}} seen */
function pick({ worktree, folder }) {
  return { worktree, folder };
}

/** The porcelain record git lists for the worktree at `root`. @param {string} main @param {string} root */
function worktreeRecord(main, root) {
  return git(main, ['worktree', 'list', '--porcelain']).split('\n\n').find((block) => block.startsWith(`worktree ${root}\n`));
}

/** @param {string} text @returns {string[]} */
function lines(text) {
  return text.split('\n').filter(Boolean).sort();
}

describe('the main checkout', () => {
  it('is found from the main checkout, a folder below it, a code worktree and the state worktree', () => {
    const { main, root } = codeProject(world());
    fs.mkdirSync(path.join(main, 'src', 'deep'), { recursive: true });
    const code = path.join(world(), 'code-worktree');
    git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);
    createState(root);

    for (const cwd of [main, path.join(main, 'src', 'deep'), code, root]) {
      assert.strictEqual(mainCheckout(cwd), main, cwd);
      assert.strictEqual(stateRoot(cwd), root, cwd);
    }
  });

  it('refuses a bare repository, from its folder and from a worktree of it', () => {
    const bare = bareRepo(path.join(world(), 'bare.git'));
    const seed = initRepo(path.join(world(), 'seed'));
    createFile(seed, 'a.md', 'a\n');
    git(seed, ['add', 'a.md']);
    git(seed, ['commit', '-q', '-m', 'a']);
    git(seed, ['push', '-q', bare, 'main']);
    const linked = path.join(world(), 'linked');
    git(bare, ['worktree', 'add', '-q', linked, 'main']);

    for (const cwd of [bare, linked]) {
      assert.throws(() => stateRoot(cwd), /has no main checkout — a bare repository/, cwd);
    }
  });

  it('refuses a folder outside any repository', () => {
    assert.throws(() => mainCheckout(world()), /is not inside a git repository/);
  });

  it('refuses a copy\'s worktree folder, which git reads as the original\'s, and finds the copy from its own main checkout', () => {
    const { main, root } = codeProject(world(), { state: true });
    const side = path.join(main, 'side');
    git(main, ['worktree', 'add', '-q', '-b', 'side', side]);
    const copy = path.join(world(), 'copy');
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
    const local = git(world(), ['rev-parse', '--local-env-vars']).trim().split('\n');
    assert.deepStrictEqual(local.filter((name) => !REPOSITORY_ENV.includes(name)), []);
  });

  it('runs in the cwd\'s repository whatever repository the environment names', () => {
    const { main } = codeProject(world());
    const elsewhere = elsewhereRepo();

    const gitDir = withEnv({ GIT_DIR: path.join(elsewhere, '.git'), GIT_WORK_TREE: elsewhere },
      () => isolatedGit(main).run(['rev-parse', '--absolute-git-dir']).trim());

    assert.strictEqual(gitDir, path.join(main, '.git'));
  });

  it('reads an answer past spawnSync\'s 1 MiB default whole', () => {
    const { main } = codeProject(world());
    const runner = isolatedGit(main);
    const text = `${'x'.repeat(2 * 1024 * 1024)}\n`;
    const oid = runner.run(['hash-object', '-w', '--stdin'], { input: text }).trim();

    assert.strictEqual(runner.run(['cat-file', 'blob', oid]), text);
  });

  it('writes an answer to the file it is given whole, answering nothing', () => {
    const { main } = codeProject(world());
    const runner = isolatedGit(main);
    const text = `${'x'.repeat(2 * 1024 * 1024)}\n`;
    const oid = runner.run(['hash-object', '-w', '--stdin'], { input: text }).trim();
    const file = path.join(world(), 'answer');
    const fd = fs.openSync(file, 'w');

    try {
      assert.deepStrictEqual([runner.run(['cat-file', 'blob', oid], { out: fd }), runner.tryRun(['cat-file', 'blob', oid], { out: fd })], ['', '']);
    } finally {
      fs.closeSync(fd);
    }
    assert.strictEqual(fs.readFileSync(file, 'utf8'), text + text);
  });

  it('runs every git within a time limit: the call\'s own, else CALL_TIMEOUT_MS — the config\'s hooks read at the first call too', (t) => {
    const limits = childLimits(t, ISOLATED_GIT, (/** @type {typeof import('../../skills/workflow-engine/scripts/kernel/isolated-git.cjs')} */ fresh) => {
      const runner = fresh.isolatedGit(world());
      runner.run(['--version']);
      runner.tryRun(['--version']);
      runner.run(['--version'], { timeoutMs: 1234 });
    });

    assert.deepStrictEqual(limits, [CALL_TIMEOUT_MS, CALL_TIMEOUT_MS, CALL_TIMEOUT_MS, 1234]);
  });

  it('throws for a call past its time limit, naming it, from tryRun as from run — never the null of a git that said no', () => {
    const runner = isolatedGit(world());
    const waits = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'alias.wait', GIT_CONFIG_VALUE_0: '!sleep 3' };

    assert.strictEqual(runner.tryRun(['rev-parse', '--git-dir']), null, 'outside a repository git says no');
    for (const call of [() => runner.tryRun(['wait'], { timeoutMs: 100, env: waits }), () => runner.run(['wait'], { timeoutMs: 100, env: waits })]) {
      assert.throws(call, (/** @type {Error} */ err) => err instanceof GitError && err.message === 'git wait timed out after 0.1s');
    }
  });

  it('keeps the state\'s commit and push off whatever the environment points git at', () => {
    const { main, root, bare } = codeProject(world(), { remote: true });
    const elsewhere = elsewhereRepo();
    const before = snapshot(elsewhere);
    fs.mkdirSync(path.join(world(), 'quarantine'));

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
      GIT_QUARANTINE_PATH: path.join(world(), 'quarantine'),
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
    const { main, root } = codeProject(world());

    const created = createState(root);

    assert.strictEqual(tip(main, STATE_BRANCH), created.commit);
    assert.deepStrictEqual(git(main, ['rev-list', '--parents', STATE_BRANCH]).trim().split(' '), [created.commit]);
    assert.deepStrictEqual(git(main, ['ls-tree', '--name-only', STATE_BRANCH]).trim().split('\n'), ['.gitignore', layout.projectManifest]);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:.gitignore`]), STATE_GITIGNORE);
    const manifest = JSON.parse(git(main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]));
    assert.deepStrictEqual(Object.keys(manifest), ['project_id']);
    assert.ok(isId(manifest.project_id), manifest.project_id);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(root, layout.projectManifest), 'utf8')), manifest, 'checked out at the state root');

    const other = codeProject(world(), { name: 'other' });
    createState(other.root);
    assert.notStrictEqual(JSON.parse(git(other.main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`])).project_id, manifest.project_id, 'each project its own');
  });

  it('ignores the knowledge base, the cache and the writer lock in the state worktree, and nothing else', () => {
    const { root } = codeProject(world(), { state: true });

    for (const rel of [layout.knowledge('store.bin'), layout.cache('unit', 'state.json'), layout.lock]) assert.ok(ignored(root, rel), rel);
    for (const rel of [layout.projectManifest, layout.ledger, 'unit/.cache/x', 'unit/.lock']) assert.ok(!ignored(root, rel), rel);
  });

  it('checks the branch out at .leeway/ in the main checkout, locked with the state\'s reason (4.S6)', () => {
    const { main, root } = codeProject(world());

    createState(root);

    assert.strictEqual(git(root, ['symbolic-ref', 'HEAD']).trim(), `refs/heads/${STATE_BRANCH}`);
    const record = worktreeRecord(main, root);
    assert.ok(record, `no worktree listed at ${root}`);
    assert.match(record, /^locked workflows state, do not remove$/m);
    assert.strictEqual(STATE_LOCK_REASON, 'workflows state, do not remove');
  });

  it('puts .leeway/ in the main checkout when made from a code worktree, never in the worktree (4.1.4)', () => {
    const { main, root } = codeProject(world());
    const code = path.join(world(), 'code-worktree');
    git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);

    createState(stateRoot(code));

    assert.ok(fs.existsSync(statePath(main, layout.gitignore)));
    assert.ok(!fs.existsSync(path.join(code, STATE_DIR_NAME)));
    assert.ok(worktreeRecord(main, root));
  });

  it('leaves the main checkout\'s branch, HEAD and index as they were', () => {
    const { main, root } = codeProject(world());
    const before = snapshot(main);

    createState(root);

    const after = snapshot(main);
    assert.strictEqual(after.head, before.head);
    assert.strictEqual(after.sha, before.sha);
    assert.strictEqual(after.index, before.index);
    assert.deepStrictEqual(lines(after.branches), lines(`${before.branches}refs/heads/${STATE_BRANCH} ${tip(main, STATE_BRANCH)}\n`));
  });

  it('pushes the new branch where the project has a remote', () => {
    const { root, bare } = codeProject(world(), { remote: true });

    const created = createState(root);

    assert.deepStrictEqual({ pushed: created.pushed, warnings: created.warnings }, { pushed: true, warnings: [] });
    assert.strictEqual(remoteTip(bare), created.commit);
  });

  it('attempts no push where the project has no remote (4.S5)', () => {
    const { root } = codeProject(world());

    const { result, commands } = traced(() => createState(root));

    assert.deepStrictEqual({ pushed: result.pushed, warnings: result.warnings }, { pushed: false, warnings: [] });
    assert.ok(commands.some((c) => c.startsWith('commit-tree ')), `the trace caught nothing: ${commands}`);
    assert.ok(!commands.some((c) => c.startsWith('push ')), `a push was attempted: ${commands}`);
  });

  it('refuses where .leeway/ already exists, creating no branch', () => {
    const { main, root } = codeProject(world());
    fs.mkdirSync(root);

    assert.throws(() => createState(root), /already exists/);
    assert.strictEqual(git(main, ['branch', '--list', STATE_BRANCH]), '');
  });

  it('clears a registration a deleted folder left at .leeway/, and checks the new branch out there', () => {
    const { main, root } = codeProject(world(), { state: true });
    fs.rmSync(root, { recursive: true, force: true });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);

    const created = createState(root);

    assert.strictEqual(tip(main, STATE_BRANCH), created.commit);
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('refuses where leeway-state already exists, adding no worktree', () => {
    const { main, root } = codeProject(world());
    git(main, ['branch', STATE_BRANCH]);

    assert.throws(() => createState(root), /cannot create leeway-state/);
    assert.ok(!fs.existsSync(root));
    assert.strictEqual(tip(main, STATE_BRANCH), tip(main, 'main'));
  });
});

describe('inspecting the state', () => {
  it('reads nothing in a project the state has not reached', () => {
    const { main, root } = codeProject(world());

    assert.deepStrictEqual(inspectState(root), {
      main, root, branch: false, remotes: [], remote: null, remoteBranch: false, worktree: null, folder: 'absent',
    });
  });

  it('reads the branch, its worktree on the branch and locked, and the folder git opens', () => {
    const { main, root } = codeProject(world(), { state: true });

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
    const { root } = codeProject(world(), { remote: true });
    assert.deepStrictEqual([inspectState(root).remote, inspectState(root).remoteBranch], ['origin', false]);

    createState(root);

    assert.deepStrictEqual([inspectState(root).remote, inspectState(root).remoteBranch], ['origin', true]);
  });

  it('reads a fresh clone: the remote\'s branch, no local branch, no worktree', () => {
    const { bare } = codeProject(world(), { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world(), 'fresh'));

    const seen = inspectState(stateRoot(fresh));

    assert.deepStrictEqual(seen, {
      main: fresh, root: statePath(fresh), branch: false, remotes: ['origin'], remote: 'origin', remoteBranch: true, worktree: null, folder: 'absent',
    });
  });

  it('reads a worktree whose folder is gone, and one that is unlocked', () => {
    const { main, root } = codeProject(world(), { state: true });

    git(main, ['worktree', 'unlock', root]);
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: false, reason: null }, folder: 'linked' });

    lockStateWorktree(root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'absent' });
  });

  it('takes origin as the state\'s remote, else the one the main checkout\'s branch tracks, else the one remote', () => {
    const { main, root } = codeProject(world());
    const seen = () => {
      const { remotes, remote } = inspectState(root);
      return { remotes, remote };
    };

    git(main, ['remote', 'add', 'upstream', path.join(world(), 'upstream.git')]);
    assert.deepStrictEqual(seen(), { remotes: ['upstream'], remote: 'upstream' });

    git(main, ['remote', 'add', 'fork', path.join(world(), 'fork.git')]);
    assert.deepStrictEqual(seen(), { remotes: ['fork', 'upstream'], remote: null });

    git(main, ['config', 'branch.main.remote', 'fork']);
    assert.deepStrictEqual(seen(), { remotes: ['fork', 'upstream'], remote: 'fork' });

    git(main, ['remote', 'add', 'origin', path.join(world(), 'origin.git')]);
    assert.deepStrictEqual(seen(), { remotes: ['fork', 'origin', 'upstream'], remote: 'origin' });
  });
});

describe('the repairs, each on its own', () => {
  it('brings a fresh clone\'s state in from the remote: the branch, then the worktree, locked (4.S11)', () => {
    const { bare } = codeProject(world(), { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world(), 'fresh'));
    const freshRoot = stateRoot(fresh);

    createStateBranchFromRemote(freshRoot);
    addStateWorktree(freshRoot);

    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.strictEqual(fs.readFileSync(path.join(freshRoot, '.gitignore'), 'utf8'), STATE_GITIGNORE);
    assert.deepStrictEqual(pick(inspectState(freshRoot)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('restores a lost local branch from the remote\'s (4.S8)', () => {
    const { main, root, bare } = codeProject(world(), { remote: true, state: true });
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    git(main, ['branch', '-D', STATE_BRANCH]);

    createStateBranchFromRemote(root);

    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
  });

  it('refuses to take the branch from a remote that is missing or holds none', () => {
    const none = codeProject(world());
    assert.throws(() => createStateBranchFromRemote(none.root), /no remote to take leeway-state from/);

    const empty = codeProject(world(), { remote: true, name: 'empty' });
    assert.throws(() => createStateBranchFromRemote(empty.root), /origin holds no leeway-state/);
  });

  it('re-adds a removed worktree, locked (4.S29)', () => {
    const { main, root } = codeProject(world(), { state: true });
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    assert.deepStrictEqual(pick(inspectState(root)), { worktree: null, folder: 'absent' });

    addStateWorktree(root);

    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('re-adds a worktree whose folder was deleted under its locked registration (4.S29)', () => {
    const { root } = codeProject(world(), { state: true });
    fs.rmSync(root, { recursive: true, force: true });

    addStateWorktree(root);

    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
    assert.strictEqual(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), STATE_GITIGNORE);
  });

  it('refuses to add the worktree where there is no local branch', () => {
    const { root } = codeProject(world());

    assert.throws(() => addStateWorktree(root), /there is no local leeway-state/);
    assert.ok(!fs.existsSync(root));
  });

  it('locks an unlocked worktree with the state\'s reason (4.S29)', () => {
    const { main, root } = codeProject(world(), { state: true });
    git(main, ['worktree', 'unlock', root]);

    lockStateWorktree(root);

    assert.match(worktreeRecord(main, root) || '', /^locked workflows state, do not remove$/m);
  });

  it('relinks the state worktree after the project folder moved, keeping what it holds, and commits again', () => {
    const { main, root } = codeProject(world(), { state: true });
    createFile(root, layout.projectManifest, '{"kept":true}\n');
    const moved = path.join(world(), 'moved');
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
    assert.strictEqual(git(moved, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]), '{"kept":true}\n');
  });

  it('never writes through a copied project\'s state worktree, which git reads as the original\'s', () => {
    const { main } = codeProject(world(), { state: true });
    const before = tip(main, STATE_BRANCH);
    const copy = path.join(world(), 'copy');
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
    const { main, root } = codeProject(world(), { state: true });
    const side = path.join(main, 'side');
    git(main, ['worktree', 'add', '-q', '-b', 'side', side]);
    const admin = path.join(main, '.git/worktrees');
    const links = () => [path.join(root, '.git'), path.join(side, '.git'), ...fs.readdirSync(admin).map((id) => path.join(admin, id, 'gitdir'))]
      .map((file) => [file, fs.readFileSync(file, 'utf8')]);
    const before = links();
    const copy = path.join(world(), 'copy');
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
    const { main, root } = codeProject(world(), { state: true });
    fs.writeFileSync(path.join(main, '.git/worktrees/-leeway/gitdir'), `${path.join(world(), 'elsewhere/.git')}\n`);

    assert.deepStrictEqual(repairStateWorktree(root), { was: 'own', from: main });

    assert.deepStrictEqual(pick(inspectState(root)), { worktree: { branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON }, folder: 'linked' });
  });

  it('refuses a folder holding no link, and one naming a registration this repository does not keep — nothing relinked', () => {
    const { main, root } = codeProject(world(), { state: true });

    fs.writeFileSync(path.join(root, '.git'), 'not a link\n');
    assert.throws(() => repairStateWorktree(root), new RegExp(`^Error: ${root} holds no worktree link git can read — nothing relinked$`));

    const stranger = path.join(world(), 'other/.git/worktrees/stranger');
    fs.writeFileSync(path.join(root, '.git'), `gitdir: ${stranger}\n`);
    assert.throws(() => repairStateWorktree(root), new RegExp(`^Error: ${root} links to ${stranger}, and this repository keeps no registration by that name — nothing relinked$`));
    assert.strictEqual(fs.readFileSync(path.join(main, '.git/worktrees/-leeway/gitdir'), 'utf8'), `${path.join(root, '.git')}\n`);
  });
});

describe('the remote, asked', () => {
  it('answers no remote where the project has none, never asking', () => {
    const { root } = codeProject(world(), { state: true });

    const { result, commands } = traced(() => askStateRemote(root));

    assert.deepStrictEqual(result, { remote: null, remotes: [] });
    assert.ok(!commands.some((c) => c.startsWith('ls-remote ')));
  });

  it('answers the remote\'s tip, or none where it holds no leeway-state', () => {
    const { main, root, bare } = codeProject(world(), { remote: true });

    assert.deepStrictEqual(askStateRemote(root), { remote: 'origin', remotes: ['origin'], tip: null });
    createState(root);
    assert.deepStrictEqual(askStateRemote(root), { remote: 'origin', remotes: ['origin'], tip: remoteTip(bare) });
    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
  });

  it('answers why a remote out of reach could not be reached, never that it holds none', () => {
    const { main, root } = codeProject(world(), { remote: true });
    git(main, ['remote', 'set-url', 'origin', path.join(world(), 'nowhere.git')]);

    const answer = askStateRemote(root);

    assert.deepStrictEqual([answer.remote, 'tip' in answer], ['origin', false]);
    assert.match(/** @type {{unreachable: string}} */ (answer).unreachable, /^git ls-remote failed: /);
  });

  it('brings the remote\'s tip into its tracking branch: set where this clone holds it, fetched where not', () => {
    const { bare } = codeProject(world(), { remote: true, state: true });
    const fresh = path.join(world(), 'fresh');
    git(world(), ['clone', '-q', '--single-branch', '--branch', 'main', `file://${bare}`, fresh]);
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
    const { bare } = codeProject(world(), { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world(), 'fresh'));
    git(fresh, ['update-ref', '-d', `refs/remotes/origin/${STATE_BRANCH}`]);
    git(fresh, ['remote', 'set-url', 'origin', path.join(world(), 'nowhere.git')]);

    assert.match(fetchStateTip(stateRoot(fresh), 'origin', 'f'.repeat(40)) ?? '', /^git fetch failed: /);
    assert.strictEqual(git(fresh, ['for-each-ref', `refs/remotes/origin/${STATE_BRANCH}`]), '');
  });

  it('reads the URL the state\'s remote fetches from, any insteadOf applied, and none without a remote', () => {
    const { main, root, bare } = codeProject(world(), { remote: true });
    git(main, ['config', `url.${bare}.insteadOf`, 'gh:acme/portal']);
    git(main, ['remote', 'set-url', 'origin', 'gh:acme/portal']);

    assert.strictEqual(stateRemoteUrl(root), bare);
    assert.strictEqual(stateRemoteUrl(codeProject(world(), { name: 'alone' }).root), null);
  });
});

describe('a leeway-state holding code history', () => {
  it('shares a commit with a code branch, which is named; the orphan shares none, its remote copies not counted as code', () => {
    const code = codeProject(world(), { name: 'code' });
    git(code.main, ['branch', STATE_BRANCH, 'main']);
    assert.strictEqual(codeBranchSharing(code.root, STATE_BRANCH), 'main');

    const { root, bare } = codeProject(world(), { remote: true, state: true });
    const fresh = cloneOf(bare, path.join(world(), 'fresh'));
    createStateBranchFromRemote(stateRoot(fresh));
    assert.strictEqual(codeBranchSharing(root, STATE_BRANCH), null);
    assert.strictEqual(codeBranchSharing(stateRoot(fresh), STATE_BRANCH), null);
  });

  it('reads a remote\'s as last fetched', () => {
    const { main, bare } = codeProject(world(), { remote: true });
    git(main, ['push', '-q', 'origin', `main:refs/heads/${STATE_BRANCH}`]);
    const fresh = cloneOf(bare, path.join(world(), 'fresh'));

    assert.strictEqual(codeBranchSharing(stateRoot(fresh), `refs/remotes/origin/${STATE_BRANCH}`), 'origin/main');
  });
});
