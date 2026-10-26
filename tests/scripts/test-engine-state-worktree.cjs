'use strict';

// ---------------------------------------------------------------------------
// The state worktree (workflow-engine/scripts/domain/state-worktree.cjs) and
// the isolated git it runs on (kernel/isolated-git.cjs): the orphan
// `leeway-state` checked out at `.leeway/` in the main checkout and locked,
// found from any worktree through the common git directory; the writer lock
// that keeps concurrent verbs one after the other; the confined commit and
// its push, a failed push a warning; and every call made with hooks off and
// the caller's repository environment cleared.
//
// Real repositories in temp folders, a bare repository as the remote.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const { git, initRepo } = require('./engine-harness.cjs');

const STATE = path.join(__dirname, '../../skills/workflow-engine/scripts/domain/state-worktree.cjs');
const state = require(STATE);
const { REPOSITORY_ENV, isolatedGit, mainCheckout } = require('../../skills/workflow-engine/scripts/kernel/isolated-git.cjs');
const { processStartTime } = require('../../skills/workflow-engine/scripts/kernel/process.cjs');

const {
  STATE_BRANCH, STATE_LOCK_REASON, STATE_GITIGNORE,
  stateRoot, inspectState, createState, addStateWorktree, createStateBranchFromRemote, lockStateWorktree,
  withStateLock, commitState, pushState,
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
 * A project with one code commit on `main`, and a bare remote as `origin`
 * where asked.
 * @param {{remote?: boolean, name?: string}} [opts]
 */
function project({ remote = false, name = 'project' } = {}) {
  const main = initRepo(path.join(world, name));
  fs.writeFileSync(path.join(main, 'README.md'), '# Project\n');
  git(main, ['add', 'README.md']);
  git(main, ['commit', '-q', '-m', 'code']);
  const bare = path.join(world, `${name}-remote.git`);
  if (remote) {
    git(world, ['init', '-q', '--bare', bare]);
    git(main, ['remote', 'add', 'origin', bare]);
    git(main, ['push', '-q', 'origin', 'main']);
  }
  return { main, root: path.join(main, '.leeway'), bare };
}

/** A clone of the bare remote, under the test identity. @param {string} bare @param {string} name */
function clone(bare, name) {
  const dir = path.join(world, name);
  git(world, ['clone', '-q', bare, dir]);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  return dir;
}

/** @param {string} dir @param {string} ref @returns {string} */
function tip(dir, ref) {
  return git(dir, ['rev-parse', ref]).trim();
}

/** The remote's `leeway-state`, or '' where it holds none. @param {string} bare */
function remoteTip(bare) {
  return git(bare, ['for-each-ref', '--format=%(objectname)', `refs/heads/${STATE_BRANCH}`]).trim();
}

/** @param {string} dir @param {string} rel @param {string} content */
function write(dir, rel, content) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
}

/** The files a commit touched, with their status letters. @param {string} dir @param {string} rev */
function touched(dir, rev) {
  return git(dir, ['show', '--name-status', '--format=', rev]).trim().split('\n').filter(Boolean).sort();
}

/** The porcelain record git lists for the worktree at `root`. @param {string} main @param {string} root */
function worktreeRecord(main, root) {
  return git(main, ['worktree', 'list', '--porcelain']).split('\n\n').find((block) => block.startsWith(`worktree ${root}\n`));
}

/** Whether git ignores the path in the state worktree. @param {string} root @param {string} rel */
function ignored(root, rel) {
  return spawnSync('git', ['check-ignore', '-q', rel], { cwd: root }).status === 0;
}

/**
 * Run `fn` with git tracing every command into a file, and answer the
 * commands traced alongside its result.
 * @template T @param {() => T} fn @returns {{result: T, commands: string[]}}
 */
function traced(fn) {
  const file = path.join(world, 'git-trace.log');
  fs.rmSync(file, { force: true });
  process.env.GIT_TRACE = file;
  try {
    const result = fn();
    const log = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const commands = [...log.matchAll(/trace: built-in: git (\S+)/g)].map((m) => m[1]);
    return { result, commands };
  } finally {
    delete process.env.GIT_TRACE;
  }
}

/**
 * Run `fn` with `vars` in the environment, as a git hook's caller would
 * carry them, and take them off after.
 * @template T @param {Record<string, string>} vars @param {() => T} fn @returns {T}
 */
function withEnv(vars, fn) {
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const name of Object.keys(vars)) delete process.env[name];
  }
}

/** A repo of its own with one commit, for the environment to point at. @param {string} name */
function elsewhereRepo(name = 'elsewhere') {
  const dir = initRepo(path.join(world, name));
  write(dir, 'other.md', 'other\n');
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
    const { main, root } = project();
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
    const bare = path.join(world, 'bare.git');
    git(world, ['init', '-q', '--bare', bare]);
    const seed = initRepo(path.join(world, 'seed'));
    write(seed, 'a.md', 'a\n');
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
});

describe('the isolated runner', () => {
  it('clears every variable git itself counts as local to a repository', () => {
    const local = git(world, ['rev-parse', '--local-env-vars']).trim().split('\n');
    assert.deepStrictEqual(local.filter((name) => !REPOSITORY_ENV.includes(name)), []);
  });

  it('runs in the cwd\'s repository whatever repository the environment names', () => {
    const { main } = project();
    const elsewhere = elsewhereRepo();

    const gitDir = withEnv({ GIT_DIR: path.join(elsewhere, '.git'), GIT_WORK_TREE: elsewhere },
      () => isolatedGit(main).run(['rev-parse', '--absolute-git-dir']).trim());

    assert.strictEqual(gitDir, path.join(main, '.git'));
  });

  it('keeps the state\'s commit and push off whatever the environment points git at', () => {
    const { main, root, bare } = project({ remote: true });
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
      write(root, 'manifest.json', '{}\n');
      return withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest'));
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
  it('makes leeway-state an orphan whose one commit holds the state\'s .gitignore', () => {
    const { main, root } = project();

    const created = createState(root);

    assert.strictEqual(tip(main, STATE_BRANCH), created.commit);
    assert.deepStrictEqual(git(main, ['rev-list', '--parents', STATE_BRANCH]).trim().split(' '), [created.commit]);
    assert.deepStrictEqual(git(main, ['ls-tree', '--name-only', STATE_BRANCH]).trim().split('\n'), ['.gitignore']);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:.gitignore`]), STATE_GITIGNORE);
  });

  it('ignores the knowledge base, the cache and the writer lock in the state worktree, and nothing else', () => {
    const { root } = project();
    createState(root);

    for (const rel of ['.knowledge/store.bin', '.cache/unit/state.json', '.lock']) assert.ok(ignored(root, rel), rel);
    for (const rel of ['manifest.json', '.ledger.jsonl', 'unit/.cache/x', 'unit/.lock']) assert.ok(!ignored(root, rel), rel);
  });

  it('checks the branch out at .leeway/ in the main checkout, locked with the state\'s reason (4.S6)', () => {
    const { main, root } = project();

    createState(root);

    assert.strictEqual(git(root, ['symbolic-ref', 'HEAD']).trim(), `refs/heads/${STATE_BRANCH}`);
    const record = worktreeRecord(main, root);
    assert.ok(record, `no worktree listed at ${root}`);
    assert.match(record, /^locked workflows state, do not remove$/m);
    assert.strictEqual(STATE_LOCK_REASON, 'workflows state, do not remove');
  });

  it('puts .leeway/ in the main checkout when made from a code worktree, never in the worktree (4.S1)', () => {
    const { main, root } = project();
    const code = path.join(world, 'code-worktree');
    git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);

    createState(stateRoot(code));

    assert.ok(fs.existsSync(path.join(main, '.leeway', '.gitignore')));
    assert.ok(!fs.existsSync(path.join(code, '.leeway')));
    assert.ok(worktreeRecord(main, root));
  });

  it('leaves the main checkout\'s branch, HEAD and index as they were', () => {
    const { main, root } = project();
    const before = snapshot(main);

    createState(root);

    const after = snapshot(main);
    assert.strictEqual(after.head, before.head);
    assert.strictEqual(after.sha, before.sha);
    assert.strictEqual(after.index, before.index);
    assert.deepStrictEqual(lines(after.branches), lines(`${before.branches}refs/heads/${STATE_BRANCH} ${tip(main, STATE_BRANCH)}\n`));
  });

  it('pushes the new branch where the project has a remote', () => {
    const { root, bare } = project({ remote: true });

    const created = createState(root);

    assert.deepStrictEqual({ pushed: created.pushed, warnings: created.warnings }, { pushed: true, warnings: [] });
    assert.strictEqual(remoteTip(bare), created.commit);
  });

  it('attempts no push where the project has no remote (4.S5)', () => {
    const { root } = project();

    const { result, commands } = traced(() => createState(root));

    assert.deepStrictEqual({ pushed: result.pushed, warnings: result.warnings }, { pushed: false, warnings: [] });
    assert.ok(commands.includes('commit-tree'), `the trace caught nothing: ${commands}`);
    assert.ok(!commands.includes('push'), `a push was attempted: ${commands}`);
  });

  it('refuses where .leeway/ already exists, creating no branch', () => {
    const { main, root } = project();
    fs.mkdirSync(root);

    assert.throws(() => createState(root), /already exists/);
    assert.strictEqual(git(main, ['branch', '--list', STATE_BRANCH]), '');
  });

  it('refuses where leeway-state already exists, adding no worktree', () => {
    const { main, root } = project();
    git(main, ['branch', STATE_BRANCH]);

    assert.throws(() => createState(root), /cannot create leeway-state/);
    assert.ok(!fs.existsSync(root));
    assert.strictEqual(tip(main, STATE_BRANCH), tip(main, 'main'));
  });
});

describe('inspecting the state', () => {
  it('reads nothing in a project the state has not reached', () => {
    const { main, root } = project();

    assert.deepStrictEqual(inspectState(root), {
      main, root, branch: false, remotes: [], remote: null, remoteBranch: false, worktree: null,
    });
  });

  it('reads the branch and its worktree, present, on the branch and locked', () => {
    const { main, root } = project();
    createState(root);

    assert.deepStrictEqual(inspectState(root), {
      main,
      root,
      branch: true,
      remotes: [],
      remote: null,
      remoteBranch: false,
      worktree: { present: true, branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON },
    });
  });

  it('reads the remote and its branch once pushed', () => {
    const { root } = project({ remote: true });
    assert.deepStrictEqual([inspectState(root).remote, inspectState(root).remoteBranch], ['origin', false]);

    createState(root);

    assert.deepStrictEqual([inspectState(root).remote, inspectState(root).remoteBranch], ['origin', true]);
  });

  it('reads a fresh clone: the remote\'s branch, no local branch, no worktree', () => {
    const { root, bare } = project({ remote: true });
    createState(root);
    const fresh = clone(bare, 'fresh');

    const seen = inspectState(stateRoot(fresh));

    assert.deepStrictEqual(seen, {
      main: fresh, root: path.join(fresh, '.leeway'), branch: false, remotes: ['origin'], remote: 'origin', remoteBranch: true, worktree: null,
    });
  });

  it('reads a worktree whose folder is gone, and one that is unlocked', () => {
    const { main, root } = project();
    createState(root);

    git(main, ['worktree', 'unlock', root]);
    assert.deepStrictEqual(inspectState(root).worktree, { present: true, branch: STATE_BRANCH, locked: false, reason: null });

    lockStateWorktree(root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.deepStrictEqual(inspectState(root).worktree, { present: false, branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON });
  });

  it('takes origin as the state\'s remote, else the one the main checkout\'s branch tracks, else the one remote', () => {
    const { main, root } = project();
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
    const { root, bare } = project({ remote: true });
    createState(root);
    const fresh = clone(bare, 'fresh');
    const freshRoot = stateRoot(fresh);

    createStateBranchFromRemote(freshRoot);
    addStateWorktree(freshRoot);

    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.strictEqual(fs.readFileSync(path.join(freshRoot, '.gitignore'), 'utf8'), STATE_GITIGNORE);
    assert.deepStrictEqual(inspectState(freshRoot).worktree, { present: true, branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON });
  });

  it('restores a lost local branch from the remote\'s (4.S8)', () => {
    const { main, root, bare } = project({ remote: true });
    createState(root);
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    git(main, ['branch', '-D', STATE_BRANCH]);

    createStateBranchFromRemote(root);

    assert.strictEqual(tip(main, STATE_BRANCH), remoteTip(bare));
  });

  it('refuses to take the branch from a remote that is missing or holds none', () => {
    const none = project();
    assert.throws(() => createStateBranchFromRemote(none.root), /no remote to take leeway-state from/);

    const empty = project({ remote: true, name: 'empty' });
    assert.throws(() => createStateBranchFromRemote(empty.root), /origin holds no leeway-state/);
  });

  it('re-adds a removed worktree, locked (4.S29)', () => {
    const { main, root } = project();
    createState(root);
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    assert.strictEqual(inspectState(root).worktree, null);

    addStateWorktree(root);

    assert.deepStrictEqual(inspectState(root).worktree, { present: true, branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON });
  });

  it('re-adds a worktree whose folder was deleted under its locked registration (4.S29)', () => {
    const { root } = project();
    createState(root);
    fs.rmSync(root, { recursive: true, force: true });

    addStateWorktree(root);

    assert.deepStrictEqual(inspectState(root).worktree, { present: true, branch: STATE_BRANCH, locked: true, reason: STATE_LOCK_REASON });
    assert.strictEqual(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), STATE_GITIGNORE);
  });

  it('refuses to add the worktree where there is no local branch', () => {
    const { root } = project();

    assert.throws(() => addStateWorktree(root), /there is no local leeway-state/);
    assert.ok(!fs.existsSync(root));
  });

  it('locks an unlocked worktree with the state\'s reason (4.S29)', () => {
    const { main, root } = project();
    createState(root);
    git(main, ['worktree', 'unlock', root]);

    lockStateWorktree(root);

    assert.match(worktreeRecord(main, root) || '', /^locked workflows state, do not remove$/m);
  });
});

describe('the writer lock', () => {
  it('is .leeway/.lock, held while the verb runs and released after, whatever it throws', () => {
    const { root } = project();
    createState(root);
    const lock = path.join(root, '.lock');

    const held = withStateLock(root, () => JSON.parse(fs.readFileSync(lock, 'utf8')));
    assert.deepStrictEqual(held, { pid: process.pid, pid_start: processStartTime(process.pid) });
    assert.ok(!fs.existsSync(lock));

    assert.throws(() => withStateLock(root, () => { throw new Error('the verb failed'); }), /the verb failed/);
    assert.ok(!fs.existsSync(lock));
  });

  it('takes over at once a lock whose holder is gone, however fresh the lock', () => {
    const { root } = project();
    createState(root);
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

  it('never breaks a live holder, however long it has held: the contender gives up, naming it', () => {
    const { root } = project();
    createState(root);
    const lock = path.join(root, '.lock');

    withStateLock(root, () => {
      const past = (Date.now() - 600000) / 1000;
      fs.utimesSync(lock, past, past);

      assert.throws(() => withStateLock(root, () => null, { timeoutMs: 300 }),
        new RegExp(`Timed out waiting for the state lock .*process ${process.pid} holds it`));
      assert.strictEqual(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, process.pid);
    });
    assert.ok(!fs.existsSync(lock));
  });

  it('leaves the lock alone at release where another holder has taken it', () => {
    const { root } = project();
    createState(root);
    const lock = path.join(root, '.lock');
    const other = JSON.stringify({ pid: 1, pid_start: 'another holder' });

    withStateLock(root, () => fs.writeFileSync(lock, other));

    assert.strictEqual(fs.readFileSync(lock, 'utf8'), other);
  });

  it('never shows as a change in the state worktree, nor do the files its claim makes', () => {
    const { root } = project();
    createState(root);

    const status = withStateLock(root, () => git(root, ['status', '--porcelain', '--untracked-files=all']));

    assert.strictEqual(status, '');
    for (const rel of ['.lock.4242.tmp', '.lock.breaking']) assert.ok(ignored(root, rel), rel);
  });

  it('refuses where there is no state worktree', () => {
    const { root } = project();

    assert.throws(() => withStateLock(root, () => null), /no state worktree at/);
  });
});

describe('committing state', () => {
  it('commits exactly the paths given, on leeway-state, whatever else is changed or staged', () => {
    const { root } = project();
    createState(root);
    write(root, 'manifest.json', '{}\n');
    write(root, 'unit/topics/a/log.md', '# a\n');
    write(root, 'unit/topics/a/brief.md', '# brief\n');
    git(root, ['add', 'unit/topics/a/brief.md']);

    const out = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest'));

    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.strictEqual(git(root, ['log', '-1', '--format=%s', STATE_BRANCH]).trim(), 'state: the manifest');
    assert.deepStrictEqual(touched(root, out.commit), ['A\tmanifest.json']);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), 'A  unit/topics/a/brief.md\n?? unit/topics/a/log.md\n');
  });

  it('commits a file added, one changed and one deleted, a folder taking every file in it', () => {
    const { root } = project();
    createState(root);
    write(root, 'manifest.json', '{}\n');
    write(root, 'unit/old.md', 'old\n');
    withStateLock(root, () => commitState(root, ['manifest.json', 'unit'], 'state: first'));

    write(root, 'manifest.json', '{"a":1}\n');
    fs.rmSync(path.join(root, 'unit/old.md'));
    write(root, 'unit/topics/a/log.md', '# a\n');
    write(root, 'unit/topics/a/brief.md', '# brief\n');
    const out = withStateLock(root, () => commitState(root, [path.join(root, 'manifest.json'), 'unit'], 'state: second'));

    assert.deepStrictEqual(touched(root, out.commit), [
      'A\tunit/topics/a/brief.md', 'A\tunit/topics/a/log.md', 'D\tunit/old.md', 'M\tmanifest.json',
    ]);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
  });

  it('commits a deletion already staged in the state worktree, named by its file or by its folder', () => {
    const { root } = project();
    createState(root);
    write(root, 'unit/old.md', 'old\n');
    write(root, 'unit/gone.md', 'gone\n');
    withStateLock(root, () => commitState(root, ['unit'], 'state: first'));
    git(root, ['rm', '-q', 'unit/old.md', 'unit/gone.md']);

    const byFile = withStateLock(root, () => commitState(root, ['unit/old.md'], 'state: drop old'));
    const byFolder = withStateLock(root, () => commitState(root, ['unit'], 'state: drop gone'));

    assert.deepStrictEqual(touched(root, byFile.commit || ''), ['D\tunit/old.md']);
    assert.deepStrictEqual(touched(root, byFolder.commit || ''), ['D\tunit/gone.md']);
    assert.strictEqual(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
  });

  it('makes no commit and no push where a staged change was undone in the working tree', () => {
    const { root, bare } = project({ remote: true });
    createState(root);
    write(root, 'manifest.json', '{}\n');
    const before = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: first')).commit;
    write(root, 'manifest.json', '{"a":1}\n');
    git(root, ['add', 'manifest.json']);
    write(root, 'manifest.json', '{}\n');

    const { result, commands } = traced(() => withStateLock(root, () => commitState(root, ['manifest.json'], 'state: nothing')));

    assert.deepStrictEqual(result, { commit: null, pushed: false, warnings: [] });
    assert.ok(!commands.includes('push'), `a push was attempted: ${commands}`);
    assert.strictEqual(tip(root, STATE_BRANCH), before);
    assert.strictEqual(remoteTip(bare), before);
  });

  it('makes no commit and no push where the paths hold no change, or where no path is given', () => {
    const { root, bare } = project({ remote: true });
    createState(root);
    const before = tip(root, STATE_BRANCH);
    write(root, 'manifest.json', '{}\n');

    for (const paths of [['.gitignore', 'unit'], []]) {
      const { result, commands } = traced(() => withStateLock(root, () => commitState(root, paths, 'state: nothing')));

      assert.deepStrictEqual(result, { commit: null, pushed: false, warnings: [] }, String(paths));
      assert.ok(!commands.includes('push'), `a push was attempted: ${commands}`);
    }
    assert.strictEqual(tip(root, STATE_BRANCH), before);
    assert.strictEqual(remoteTip(bare), before);
  });

  it('refuses where the state worktree has another branch, or none, checked out — nothing committed', () => {
    const { root } = project();
    createState(root);
    const before = tip(root, STATE_BRANCH);
    write(root, 'manifest.json', '{}\n');

    git(root, ['checkout', '-q', '-b', 'other']);
    assert.throws(() => commitState(root, ['manifest.json'], 'state: x'), /has other checked out, not leeway-state — nothing committed/);

    git(root, ['checkout', '-q', '--detach', STATE_BRANCH]);
    assert.throws(() => commitState(root, ['manifest.json'], 'state: x'), /has a detached HEAD checked out/);

    assert.strictEqual(tip(root, STATE_BRANCH), before);
    assert.strictEqual(tip(root, 'other'), before);
  });

  it('refuses a path outside the state worktree — nothing committed', () => {
    const { main, root } = project();
    createState(root);
    write(root, 'manifest.json', '{}\n');
    const before = tip(root, STATE_BRANCH);

    for (const outside of ['../README.md', path.join(main, 'README.md')]) {
      assert.throws(() => commitState(root, ['manifest.json', outside], 'state: x'), /is outside the state worktree/, outside);
    }
    assert.strictEqual(tip(root, STATE_BRANCH), before);
  });

  it('leaves the main checkout\'s branch, HEAD and index as they were', () => {
    const { main, root } = project();
    createState(root);
    const before = snapshot(main);
    write(root, 'manifest.json', '{}\n');

    withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest'));

    const after = snapshot(main);
    assert.deepStrictEqual([after.head, after.sha, after.index], [before.head, before.sha, before.index]);
    assert.strictEqual(tip(main, 'main'), before.sha);
  });

  it('pushes leeway-state to the remote after the commit', () => {
    const { root, bare } = project({ remote: true });
    createState(root);
    write(root, 'manifest.json', '{}\n');

    const out = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest'));

    assert.deepStrictEqual([out.pushed, out.warnings], [true, []]);
    assert.strictEqual(remoteTip(bare), out.commit);
  });

  it('attempts no push where the project has no remote (4.S5)', () => {
    const { root } = project();
    createState(root);
    write(root, 'manifest.json', '{}\n');

    const { result, commands } = traced(() => withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest')));

    assert.deepStrictEqual([result.pushed, result.warnings], [false, []]);
    assert.ok(commands.includes('commit'), `the trace caught nothing: ${commands}`);
    assert.ok(!commands.includes('push'), `a push was attempted: ${commands}`);
  });

  it('keeps the commit and answers a warning where the remote refuses the push (4.S4)', () => {
    const { root, bare } = project({ remote: true });
    const created = createState(root);
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });
    write(root, 'manifest.json', '{}\n');

    const out = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest'));

    assert.match(out.commit || '', /^[0-9a-f]{40}$/);
    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.strictEqual(git(root, ['show', `${STATE_BRANCH}:manifest.json`]), '{}\n');
    assert.strictEqual(out.pushed, false);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /^leeway-state is committed here but was not pushed to origin: .*no pushes today/s);
    assert.strictEqual(remoteTip(bare), created.commit);
  });

  it('never forces: a remote that moved ahead keeps its tip, and the push is a warning', () => {
    const { root, bare } = project({ remote: true });
    createState(root);
    const other = clone(bare, 'other');
    const otherRoot = stateRoot(other);
    createStateBranchFromRemote(otherRoot);
    addStateWorktree(otherRoot);
    write(otherRoot, 'manifest.json', '{"from":"other"}\n');
    const theirs = withStateLock(otherRoot, () => commitState(otherRoot, ['manifest.json'], 'state: theirs')).commit;
    write(root, 'manifest.json', '{"from":"here"}\n');

    const out = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: ours'));

    assert.strictEqual(remoteTip(bare), theirs);
    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.deepStrictEqual([out.pushed, out.warnings.length], [false, 1]);
    assert.match(out.warnings[0], /rejected/);
  });

  it('gives up on a push the remote never answers, within the timeout, as a warning', () => {
    const { main, root } = project();
    createState(root);
    const silent = path.join(world, 'silent-ssh');
    fs.writeFileSync(silent, '#!/bin/sh\nexec sleep 5\n', { mode: 0o755 });
    git(main, ['remote', 'add', 'origin', 'ssh://state.invalid/project.git']);
    git(main, ['config', 'core.sshCommand', silent]);
    write(root, 'manifest.json', '{}\n');

    const started = Date.now();
    const out = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest', { pushTimeoutMs: 500 }));
    const took = Date.now() - started;

    assert.ok(took < 4000, `the push held the verb for ${took}ms`);
    assert.strictEqual(tip(root, STATE_BRANCH), out.commit);
    assert.deepStrictEqual([out.pushed, out.warnings.length], [false, 1]);
    assert.match(out.warnings[0], /git push timed out after 0\.5s/);
  });

  it('warns on every push where several remotes choose none, and pushes to the one the main checkout\'s branch tracks', () => {
    const { main, root } = project();
    const [fork, upstream] = ['fork', 'upstream'].map((name) => {
      const bare = path.join(world, `${name}.git`);
      git(world, ['init', '-q', '--bare', bare]);
      git(main, ['remote', 'add', name, bare]);
      return bare;
    });
    const unchosen = /^leeway-state is committed here but was not pushed: the project has several remotes \(fork, upstream\), and none is named origin or tracked by the main checkout's branch$/;

    const created = createState(root);
    write(root, 'manifest.json', '{}\n');
    const committed = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest'));
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
    write(root, 'manifest.json', '{"a":1}\n');
    const tracked = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: again'));

    assert.deepStrictEqual([tracked.pushed, tracked.warnings], [true, []]);
    assert.deepStrictEqual([remoteTip(fork), remoteTip(upstream)], ['', tracked.commit]);
  });

  it('pushes the branch as it stands on its own, what a failed push left behind', () => {
    const { root, bare } = project({ remote: true });
    createState(root);
    const hook = path.join(bare, 'hooks', 'pre-receive');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    write(root, 'manifest.json', '{}\n');
    const left = withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest')).commit;
    fs.rmSync(hook);

    assert.deepStrictEqual(pushState(root), { pushed: true, warnings: [] });
    assert.strictEqual(remoteTip(bare), left);
  });
});

describe('a state commit beside the person\'s repository (4.S18)', () => {
  const HOOKS = ['pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit', 'reference-transaction', 'post-checkout', 'pre-push', 'post-index-change'];

  it('runs none of the repository\'s hooks and lands on leeway-state whatever GIT_DIR names', () => {
    const { main, root, bare } = project({ remote: true });
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
      write(at, 'manifest.json', '{}\n');
      return { found: at, created: made, out: withStateLock(at, () => commitState(at, ['manifest.json'], 'state: the manifest')) };
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
    "const ledger = path.join(root, '.ledger.jsonl');",
    'for (let i = 1; i <= Number(turns); i++) {',
    '  withStateLock(root, () => {',
    "    const before = fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8') : '';",
    '    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);',
    "    fs.writeFileSync(ledger, before + JSON.stringify({ who, i }) + '\\n');",
    "    const out = commitState(root, ['.ledger.jsonl'], who + ' ' + i);",
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
    const { root, bare } = project({ remote: true });
    createState(root);
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
