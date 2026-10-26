'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state worktree. The workflows keep their state on a
// branch of its own, `leeway-state`, an orphan checked out as a git worktree
// at `.leeway/` inside the repository's main checkout and locked there. A
// session in a code worktree finds the same `.leeway/` through the common git
// directory: there is one copy of the state, and no code worktree holds one.
//
// - Creating it: the orphan branch's first commit is built with plumbing, so
//   the main checkout's branch, HEAD and index are never touched; then the
//   worktree is added and locked. Each piece stands alone too, for the
//   repairs: add the worktree for a local branch, make the local branch from
//   the remote's, lock the worktree.
// - Writing it: a verb holds the writer lock (`.leeway/.lock`) across its
//   writes and its commit, so concurrent verbs take turns and the branch
//   stays one line. The commit takes exactly the paths given, then the branch
//   is pushed wherever the project has a remote, never forced; a push that
//   fails or runs out of time is a warning, and the commit stands.
//
// Every git call goes through kernel/isolated-git: hooks off, the caller's
// repository environment cleared.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit, mainCheckout } = require('../kernel/isolated-git.cjs');
const { GitError, literally } = require('../kernel/git.cjs');
const { acquireLockFile, releaseLockFile } = require('../kernel/manifest-io.cjs');

const STATE_BRANCH = 'leeway-state';
const STATE_DIR = '.leeway';
const STATE_LOCK_REASON = 'workflows state, do not remove';
const WRITER_LOCK = '.lock';
const STATE_GITIGNORE = ['/.knowledge/', '/.cache/', `/${WRITER_LOCK}`, ''].join('\n');
const FIRST_COMMIT_MESSAGE = `chore: begin ${STATE_BRANCH}`;

const BRANCH_REF = `refs/heads/${STATE_BRANCH}`;

// The writer lock is held across a verb's writes, its commit and its push,
// so it keeps the commit lock's clocks: a holder is stale only after five
// minutes, and a contender waits a minute — longer than any push may take.
const WRITER_LOCK_STALE_MS = 300000;
const WRITER_LOCK_TIMEOUT_MS = 60000;
const PUSH_TIMEOUT_MS = 15000;

/**
 * The worktree git has registered at the state root: whether its folder is
 * there, the branch it has checked out (null when detached), and its lock.
 * @typedef {{present: boolean, branch: string|null, locked: boolean, reason: string|null}} StateWorktree
 */

/**
 * Where the state stands: the main checkout and the state root, the local
 * branch, the remote the state goes to and its branch there as last fetched,
 * and the worktree registered at the root.
 * @typedef {{
 *   main: string,
 *   root: string,
 *   branch: boolean,
 *   remote: string|null,
 *   remoteBranch: boolean,
 *   worktree: StateWorktree|null,
 * }} StateInspection
 */

/** @typedef {{pushed: boolean, warnings: string[]}} PushOutcome */

/** @typedef {{commit: string|null, pushed: boolean, warnings: string[]}} CommitOutcome */

/**
 * The state root, `.leeway/` in the main checkout, from any cwd in the
 * repository.
 * @param {string} cwd
 * @returns {string} absolute
 */
function stateRoot(cwd) {
  return path.join(mainCheckout(cwd), STATE_DIR);
}

/** @param {string} root @returns {string} */
function mainOf(root) {
  return path.dirname(root);
}

/** @param {string} remote @returns {string} */
function remoteRef(remote) {
  return `refs/remotes/${remote}/${STATE_BRANCH}`;
}

/**
 * The remote the state goes to: `origin`, else the project's one remote;
 * none where the project has no remote, or several and no `origin`.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git
 * @returns {string|null}
 */
function stateRemote(git) {
  const remotes = git.run(['remote']).split('\n').filter((name) => name !== '');
  if (remotes.includes('origin')) return 'origin';
  return remotes.length === 1 ? remotes[0] : null;
}

/**
 * The worktree git has registered at `root`, or null. Its lock is read off
 * the porcelain listing, which names locks from git 2.31.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} root
 * @returns {StateWorktree|null}
 */
function registeredWorktree(git, root) {
  const record = git.run(['worktree', 'list', '--porcelain']).split('\n\n')
    .map((block) => block.split('\n'))
    .find((lines) => lines[0] === `worktree ${root}`);
  if (record === undefined) return null;
  /** @param {string} name @returns {string|null} */
  const field = (name) => {
    const line = record.find((l) => l === name || l.startsWith(`${name} `));
    return line === undefined ? null : line.slice(name.length + 1);
  };
  const branch = field('branch');
  const reason = field('locked');
  return {
    present: fs.existsSync(path.join(root, '.git')),
    branch: branch === null ? null : branch.replace(/^refs\/heads\//, ''),
    locked: reason !== null,
    reason: reason || null,
  };
}

/**
 * Where the state stands, for boot to act on.
 * @param {string} root
 * @returns {StateInspection}
 */
function inspectState(root) {
  const main = mainOf(root);
  const git = isolatedGit(main);
  const remote = stateRemote(git);
  const wanted = remote === null ? [BRANCH_REF] : [BRANCH_REF, remoteRef(remote)];
  const refs = git.run(['for-each-ref', '--format=%(refname)', ...wanted]).split('\n');
  return {
    main,
    root,
    branch: refs.includes(BRANCH_REF),
    remote,
    remoteBranch: remote !== null && refs.includes(remoteRef(remote)),
    worktree: registeredWorktree(git, root),
  };
}

/**
 * Create the local state branch at `commit`, refusing where it exists.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} commit
 */
function createBranchAt(git, commit) {
  try {
    git.run(['update-ref', BRANCH_REF, commit, '']);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    throw new Error(`cannot create ${STATE_BRANCH}: ${err.message}`);
  }
}

/** @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} root */
function lockWorktree(git, root) {
  git.run(['worktree', 'lock', '--reason', STATE_LOCK_REASON, root]);
}

/** @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} root */
function addLockedWorktree(git, root) {
  git.run(['worktree', 'add', '--quiet', root, STATE_BRANCH]);
  lockWorktree(git, root);
}

/**
 * Create the state: the orphan `leeway-state` whose first commit holds the
 * state's `.gitignore`, checked out at `root` and locked, then pushed where
 * the project has a remote. Refuses where `root` already exists or the branch
 * does, creating nothing.
 * @param {string} root
 * @param {{pushTimeoutMs?: number}} [opts]
 * @returns {CommitOutcome & {commit: string}}
 */
function createState(root, { pushTimeoutMs = PUSH_TIMEOUT_MS } = {}) {
  if (fs.existsSync(root)) throw new Error(`cannot create the state: ${root} already exists`);
  const git = isolatedGit(mainOf(root));
  const blob = git.run(['hash-object', '-w', '--stdin'], { input: STATE_GITIGNORE }).trim();
  const tree = git.run(['mktree'], { input: `100644 blob ${blob}\t.gitignore\n` }).trim();
  const commit = git.run(['commit-tree', tree, '-m', FIRST_COMMIT_MESSAGE]).trim();
  createBranchAt(git, commit);
  addLockedWorktree(git, root);
  return { commit, ...push(git, pushTimeoutMs) };
}

/**
 * Check the local `leeway-state` out at `root` and lock it — the repair for
 * a branch whose worktree is gone. A registration left behind by a removed
 * folder is cleared first. Refuses where there is no local branch.
 * @param {string} root
 */
function addStateWorktree(root) {
  const git = isolatedGit(mainOf(root));
  if (git.tryRun(['rev-parse', '--quiet', '--verify', BRANCH_REF]) === null) {
    throw new Error(`there is no local ${STATE_BRANCH} to check out at ${root}`);
  }
  const registered = registeredWorktree(git, root);
  if (registered !== null && !registered.present) git.run(['worktree', 'remove', '--force', '--force', root]);
  addLockedWorktree(git, root);
}

/**
 * Make the local `leeway-state` from the remote's, as last fetched — a fresh
 * clone's, or the repair for a local branch that is gone.
 * @param {string} root
 */
function createStateBranchFromRemote(root) {
  const git = isolatedGit(mainOf(root));
  const remote = stateRemote(git);
  if (remote === null) throw new Error(`the project has no remote to take ${STATE_BRANCH} from`);
  const tip = git.tryRun(['rev-parse', '--quiet', '--verify', `${remoteRef(remote)}^{commit}`]);
  if (tip === null) throw new Error(`${remote} holds no ${STATE_BRANCH}`);
  createBranchAt(git, tip.trim());
}

/**
 * Lock the state worktree with the state's reason.
 * @param {string} root
 */
function lockStateWorktree(root) {
  lockWorktree(isolatedGit(mainOf(root)), root);
}

/**
 * Run `fn` holding the writer lock, `.leeway/.lock` — across a verb's state
 * writes and its commit, so concurrent verbs write one after the other.
 * `fn` runs synchronously.
 * @template T
 * @param {string} root @param {() => T} fn
 * @returns {T}
 */
function withStateLock(root, fn) {
  if (!fs.existsSync(root)) throw new Error(`no state worktree at ${root}`);
  const lockFile = path.join(root, WRITER_LOCK);
  acquireLockFile(lockFile, 'Timed out waiting for the state lock', WRITER_LOCK_TIMEOUT_MS, WRITER_LOCK_STALE_MS);
  try {
    return fn();
  } finally {
    releaseLockFile(lockFile);
  }
}

/**
 * A path given to a state commit, named from the state root. Refuses one
 * outside it.
 * @param {string} root @param {string} given absolute, or from the root
 * @returns {string}
 */
function fromRoot(root, given) {
  const rel = path.relative(root, path.resolve(root, given));
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`${given} is outside the state worktree at ${root} — nothing committed`);
  }
  return rel === '' ? '.' : rel;
}

/**
 * The files under the pathspecs that differ from HEAD, untracked ones each
 * on its own, named from the worktree's root. No pathspec, no file — never
 * the whole worktree.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string[]} specs
 * @returns {string[]}
 */
function changedFiles(git, specs) {
  if (specs.length === 0) return [];
  return git.run(['status', '--porcelain', '-z', '--no-renames', '--untracked-files=all', '--', ...literally(specs)])
    .split('\0').filter((entry) => entry.length > 3).map((entry) => entry.slice(3));
}

/**
 * Push `leeway-state` to the state's remote, never forcing, within
 * `timeoutMs`. No remote, no push; a refused or timed-out push is a warning.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {number} timeoutMs
 * @returns {PushOutcome}
 */
function push(git, timeoutMs) {
  const remote = stateRemote(git);
  if (remote === null) return { pushed: false, warnings: [] };
  try {
    git.run(['push', '--quiet', remote, `${BRANCH_REF}:${BRANCH_REF}`], { timeoutMs, env: { GIT_TERMINAL_PROMPT: '0' } });
    return { pushed: true, warnings: [] };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { pushed: false, warnings: [`${STATE_BRANCH} is committed here but was not pushed to ${remote}: ${err.message}`] };
  }
}

/**
 * Commit exactly `paths` in the state worktree on `leeway-state`, then push.
 * The caller holds the writer lock (`withStateLock`). Refuses where the
 * worktree has another branch checked out, committing nothing. Paths that
 * hold no change commit nothing and push nothing.
 * @param {string} root
 * @param {string[]} paths absolute, or from the state root
 * @param {string} message
 * @param {{pushTimeoutMs?: number}} [opts]
 * @returns {CommitOutcome}
 */
function commitState(root, paths, message, { pushTimeoutMs = PUSH_TIMEOUT_MS } = {}) {
  if (!fs.existsSync(root)) throw new Error(`no state worktree at ${root}`);
  const specs = paths.map((given) => fromRoot(root, given));
  const git = isolatedGit(root);
  const head = (git.tryRun(['symbolic-ref', '--quiet', 'HEAD']) || '').trim();
  if (head !== BRANCH_REF) {
    const checkedOut = head === '' ? 'a detached HEAD' : head.replace(/^refs\/heads\//, '');
    throw new Error(`the state worktree at ${root} has ${checkedOut} checked out, not ${STATE_BRANCH} — nothing committed`);
  }
  const changed = changedFiles(git, specs);
  if (changed.length === 0) return { commit: null, pushed: false, warnings: [] };
  git.run(['add', '--all', '--', ...literally(changed)]);
  git.run(['commit', '--quiet', '-m', message, '--', ...literally(changed)]);
  const commit = git.run(['rev-parse', 'HEAD']).trim();
  return { commit, ...push(git, pushTimeoutMs) };
}

/**
 * Push `leeway-state` as it stands — what a failed push left behind, or a
 * branch the remote lost.
 * @param {string} root
 * @param {{timeoutMs?: number}} [opts]
 * @returns {PushOutcome}
 */
function pushState(root, { timeoutMs = PUSH_TIMEOUT_MS } = {}) {
  return push(isolatedGit(mainOf(root)), timeoutMs);
}

module.exports = {
  STATE_BRANCH,
  STATE_DIR,
  STATE_LOCK_REASON,
  STATE_GITIGNORE,
  stateRoot,
  inspectState,
  createState,
  addStateWorktree,
  createStateBranchFromRemote,
  lockStateWorktree,
  withStateLock,
  commitState,
  pushState,
};
