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
//   the remote's, lock the worktree, relink a worktree whose folder moved.
// - Writing it: a verb holds the writer lock (`.leeway/.lock`, the kernel's)
//   across its writes and its commit, so concurrent verbs take turns and the branch
//   stays one line; the lock follows its holder's process, never its age,
//   and a process may take it again while it holds it. The commit is built
//   in a private index from HEAD and the working tree, never through the
//   worktree's own index, so nothing a killed verb or a person left staged
//   there can break it. A merge's landing a kill cut short is finished
//   first (state-merge-landing.cjs), so the commit moves the branch on from
//   where that landing put it. Then the branch is pushed wherever the
//   project has a remote, never forced; a push that fails, runs out of
//   time, or finds no remote chosen among several is a warning, and the
//   commit stands.
//
// Every git call goes through kernel/isolated-git: hooks off, the caller's
// repository environment cleared.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { GitError, literally } = require('../kernel/git.cjs');
const { WRITER_LOCK, withWriterLock } = require('../kernel/manifest-io.cjs');
const { STATE_DIR_NAME, stateRoot } = require('../kernel/state-root.cjs');
const { finishLanding } = require('./state-merge-landing.cjs');

const STATE_BRANCH = 'leeway-state';
const STATE_DIR = STATE_DIR_NAME;
const STATE_LOCK_REASON = 'workflows state, do not remove';
// The lock's claim is written beside it and linked into place, and a
// takeover holds a guard beside it: both are the lock's, ignored with it. A
// manifest's atomic write is a temp file beside it until it is renamed in.
const STATE_GITIGNORE = [
  '/.knowledge/', '/.cache/', `/${WRITER_LOCK}`, `/${WRITER_LOCK}.*`, '.manifest.json.*.tmp', '',
].join('\n');
const FIRST_COMMIT_MESSAGE = `chore: begin ${STATE_BRANCH}`;

const BRANCH_REF = `refs/heads/${STATE_BRANCH}`;
const PRIVATE_INDEX = 'leeway-commit.index';

const PUSH_TIMEOUT_MS = 15000;

/**
 * The worktree git has registered at the state root: the branch it has
 * checked out (null when detached), and its lock.
 * @typedef {{branch: string|null, locked: boolean, reason: string|null}} StateWorktree
 */

/**
 * What is on disk at the state root: no folder; a folder git opens as this
 * repository's state worktree; or a folder git cannot open as it — its link
 * broken, as a moved project folder leaves it.
 * @typedef {'absent'|'linked'|'unlinked'} StateFolder
 */

/**
 * Where the state stands: the main checkout and the state root, the local
 * branch, the project's remotes, the one the state goes to and its branch
 * there as last fetched, the worktree git has registered at the root, and
 * the folder there.
 * @typedef {{
 *   main: string,
 *   root: string,
 *   branch: boolean,
 *   remotes: string[],
 *   remote: string|null,
 *   remoteBranch: boolean,
 *   worktree: StateWorktree|null,
 *   folder: StateFolder,
 * }} StateInspection
 */

/** @typedef {{pushed: boolean, warnings: string[]}} PushOutcome */

/** @typedef {{commit: string|null, pushed: boolean, warnings: string[]}} CommitOutcome */

/**
 * The state worktree as git opens it: a runner bound to it, the ref its HEAD
 * names (`HEAD` when detached), where its private index goes, and its own
 * git dir.
 * @typedef {{
 *   opened: true,
 *   git: import('../kernel/isolated-git.cjs').IsolatedGit,
 *   head: string,
 *   index: string,
 *   gitDir: string,
 * }} OpenWorktree
 */

/** @param {string} root @returns {string} */
function mainOf(root) {
  return path.dirname(root);
}

/** @param {string} remote @returns {string} */
function remoteRef(remote) {
  return `refs/remotes/${remote}/${STATE_BRANCH}`;
}

/** @param {string} file @returns {string} */
function realpathOrSelf(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}

/**
 * The project's remotes, and the one the state goes to: `origin`, else the
 * remote the main checkout's branch tracks, else the project's one remote.
 * `remote` is null where the project has none, or several and none of
 * these chooses one.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git bound to the main checkout
 * @returns {{remote: string|null, remotes: string[]}}
 */
function stateRemote(git) {
  const remotes = git.run(['remote']).split('\n').filter((name) => name !== '');
  if (remotes.includes('origin')) return { remote: 'origin', remotes };
  const branch = (git.tryRun(['symbolic-ref', '--quiet', '--short', 'HEAD']) || '').trim();
  const tracked = branch === '' ? '' : (git.tryRun(['config', '--get', `branch.${branch}.remote`]) || '').trim();
  if (remotes.includes(tracked)) return { remote: tracked, remotes };
  return { remote: remotes.length === 1 ? remotes[0] : null, remotes };
}

/** Why several remotes choose none. @param {string[]} remotes @returns {string} */
function noRemoteChosen(remotes) {
  return `the project has several remotes (${remotes.join(', ')}), and none is named origin or tracked by the main checkout's branch`;
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
    branch: branch === null ? null : branch.replace(/^refs\/heads\//, ''),
    locked: reason !== null,
    reason: reason || null,
  };
}

/**
 * Open the folder at `root` as git sees it: opened only where its top is
 * the root and its common directory the main checkout's `.git`. A folder
 * whose link is broken — git cannot read it, or reads it as another
 * repository's, or as no worktree at all — answers why.
 * @param {string} root
 * @returns {OpenWorktree|{opened: false, why: string}}
 */
function openWorktree(root) {
  const git = isolatedGit(root);
  let out;
  try {
    out = git.run(['rev-parse', '--show-toplevel', '--git-common-dir', '--git-path', PRIVATE_INDEX, '--absolute-git-dir', '--symbolic-full-name', 'HEAD']);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { opened: false, why: err.message };
  }
  const [top, common, index, gitDir, head] = out.split('\n');
  const repository = realpathOrSelf(path.resolve(root, common));
  if (realpathOrSelf(top) !== root || repository !== path.join(mainOf(root), '.git')) {
    return { opened: false, why: `git reads it as part of ${top}, whose repository is ${repository}` };
  }
  return { opened: true, git, head, index: path.resolve(root, index), gitDir };
}

/** @param {string} root @returns {StateFolder} */
function folderAt(root) {
  if (!fs.existsSync(root)) return 'absent';
  return openWorktree(root).opened ? 'linked' : 'unlinked';
}

/**
 * Where the state stands, for boot to act on.
 * @param {string} root
 * @returns {StateInspection}
 */
function inspectState(root) {
  const main = mainOf(root);
  const git = isolatedGit(main);
  const { remote, remotes } = stateRemote(git);
  const wanted = remote === null ? [BRANCH_REF] : [BRANCH_REF, remoteRef(remote)];
  const refs = git.run(['for-each-ref', '--format=%(refname)', ...wanted]).split('\n');
  return {
    main,
    root,
    branch: refs.includes(BRANCH_REF),
    remotes,
    remote,
    remoteBranch: remote !== null && refs.includes(remoteRef(remote)),
    worktree: registeredWorktree(git, root),
    folder: folderAt(root),
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
 * folder is cleared first. Refuses where there is no local branch, and
 * where a folder is at `root`: a folder whose link broke is relinked by
 * `repairStateWorktree`, keeping what it holds, never added over.
 * @param {string} root
 */
function addStateWorktree(root) {
  const git = isolatedGit(mainOf(root));
  if (git.tryRun(['rev-parse', '--quiet', '--verify', BRANCH_REF]) === null) {
    throw new Error(`there is no local ${STATE_BRANCH} to check out at ${root}`);
  }
  if (fs.existsSync(root)) {
    throw new Error(`a folder is already at ${root} — repair its worktree rather than add one over it`);
  }
  if (registeredWorktree(git, root) !== null) git.run(['worktree', 'remove', '--force', '--force', root]);
  addLockedWorktree(git, root);
}

/**
 * Relink the state worktree whose folder git can no longer open — the
 * project folder moved, so git's registration and the folder's link name
 * the old place. The folder and everything in it stay as they are; git's
 * registration keeps its lock. Git 2.29 on.
 * @param {string} root
 */
function repairStateWorktree(root) {
  isolatedGit(mainOf(root)).run(['worktree', 'repair', root]);
}

/**
 * Make the local `leeway-state` from the remote's, as last fetched — a fresh
 * clone's, or the repair for a local branch that is gone.
 * @param {string} root
 */
function createStateBranchFromRemote(root) {
  const git = isolatedGit(mainOf(root));
  const { remote, remotes } = stateRemote(git);
  if (remote === null) {
    throw new Error(remotes.length === 0
      ? `the project has no remote to take ${STATE_BRANCH} from`
      : `cannot take ${STATE_BRANCH} from a remote: ${noRemoteChosen(remotes)}`);
  }
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
 * Run `fn` holding the writer lock, `.leeway/.lock` — the kernel's, which
 * the manifests' writes hold too — across a verb's state writes and its
 * commit, so concurrent verbs write one after the other. The lock records
 * its holder: a holder whose process is gone is taken over at once, and a
 * live one is never broken — the contender gives up after `timeoutMs`
 * instead, naming it. A process holding the lock takes it again at once,
 * and it is released when the outermost hold ends. `fn` runs synchronously.
 * Refuses where there is no state worktree.
 * @template T
 * @param {string} root @param {() => T} fn
 * @param {{timeoutMs?: number}} [opts]
 * @returns {T}
 */
function withStateLock(root, fn, opts) {
  return withWriterLock(root, fn, opts);
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

/** Whether anything, a dangling link included, is at the path. @param {string} file */
function onDisk(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} index */
function clearPrivateIndex(index) {
  for (const file of [index, `${index}.lock`]) fs.rmSync(file, { force: true });
}

/**
 * Commit the working tree's state of the pathspecs onto `leeway-state`. The
 * tree is built in a private index seeded from HEAD — never the worktree's
 * own, whatever it holds staged — and the branch moves only from the HEAD it
 * was built on. A kill at any step leaves the branch where it was or at the
 * whole commit, and the private index is cleared before and after. Null
 * where the tree comes out as HEAD's.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git bound to the state worktree
 * @param {string} root @param {string} index @param {string[]} specs @param {string} message
 * @returns {string|null}
 */
function commitPaths(git, root, index, specs, message) {
  const [head, headTree] = git.run(['rev-parse', 'HEAD', 'HEAD^{tree}']).trim().split('\n');
  const env = { GIT_INDEX_FILE: index };
  clearPrivateIndex(index);
  try {
    git.run(['read-tree', head], { env });
    const known = git.run(['ls-files', '-z', '--', ...literally(specs)], { env }).split('\0').filter((file) => file !== '');
    // `add` refuses a pathspec that matches nothing on disk or in the index:
    // a path gone from both has nothing to commit.
    const stageable = specs.filter((spec) => spec === '.' || onDisk(path.join(root, spec))
      || known.some((file) => file === spec || file.startsWith(`${spec}/`)));
    if (stageable.length > 0) git.run(['add', '--all', '--', ...literally(stageable)], { env });
    const tree = git.run(['write-tree'], { env }).trim();
    if (tree === headTree) return null;
    const commit = git.run(['commit-tree', tree, '-p', head, '-m', message]).trim();
    git.run(['update-ref', '-m', `commit: ${message.split('\n')[0]}`, BRANCH_REF, commit, head]);
    return commit;
  } finally {
    clearPrivateIndex(index);
  }
}

/**
 * Bring the worktree's own index into line with HEAD under the pathspecs,
 * so `git status` there reads what was committed; entries under other paths
 * stay as they are. The commit never reads this index, so a failure here —
 * another process holding it — is a warning.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string[]} specs
 * @returns {string[]} warnings
 */
function alignIndex(git, specs) {
  try {
    git.run(['reset', '--quiet', '--', ...literally(specs)]);
    return [];
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return [`the state worktree's index was not brought into line with ${STATE_BRANCH}: ${err.message}`];
  }
}

/**
 * Push `leeway-state` to the state's remote, never forcing, within
 * `timeoutMs`. No remote, no push; several remotes that choose none, a
 * refused push or a timed-out one is a warning.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git bound to the main checkout
 * @param {number} timeoutMs
 * @returns {PushOutcome}
 */
function push(git, timeoutMs) {
  const { remote, remotes } = stateRemote(git);
  if (remote === null) {
    return { pushed: false, warnings: remotes.length === 0 ? [] : [`${STATE_BRANCH} is committed here but was not pushed: ${noRemoteChosen(remotes)}`] };
  }
  try {
    git.run(['push', '--quiet', remote, `${BRANCH_REF}:${BRANCH_REF}`], { timeoutMs, env: { GIT_TERMINAL_PROMPT: '0' } });
    return { pushed: true, warnings: [] };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { pushed: false, warnings: [`${STATE_BRANCH} is committed here but was not pushed to ${remote}: ${err.message}`] };
  }
}

/**
 * Commit exactly `paths`, as the working tree holds them, onto
 * `leeway-state` in the state worktree, then push. The caller holds the
 * writer lock (`withStateLock`). Refuses, committing nothing, where git
 * cannot open the state worktree and where it has another branch checked
 * out. A merge's landing a kill cut short is finished first. Paths that hold
 * no change commit nothing and push nothing.
 * @param {string} root
 * @param {string[]} paths absolute, or from the state root
 * @param {string} message
 * @param {{pushTimeoutMs?: number}} [opts]
 * @returns {CommitOutcome}
 */
function commitState(root, paths, message, { pushTimeoutMs = PUSH_TIMEOUT_MS } = {}) {
  if (!fs.existsSync(root)) throw new Error(`no state worktree at ${root}`);
  const specs = paths.map((given) => fromRoot(root, given));
  const worktree = openWorktree(root);
  if (!worktree.opened) throw new Error(`git cannot open the state worktree at ${root}: ${worktree.why} — nothing committed`);
  if (worktree.head !== BRANCH_REF) {
    const checkedOut = worktree.head === 'HEAD' ? 'a detached HEAD' : worktree.head.replace(/^refs\/heads\//, '');
    throw new Error(`the state worktree at ${root} has ${checkedOut} checked out, not ${STATE_BRANCH} — nothing committed`);
  }
  if (specs.length === 0) return { commit: null, pushed: false, warnings: [] };
  const landed = finishLanding(root, STATE_BRANCH, worktree.gitDir);
  const commit = commitPaths(worktree.git, root, worktree.index, specs, message);
  const warnings = [...landed, ...alignIndex(worktree.git, specs)];
  if (commit === null) return { commit: null, pushed: false, warnings };
  const pushed = push(isolatedGit(mainOf(root)), pushTimeoutMs);
  return { commit, pushed: pushed.pushed, warnings: [...warnings, ...pushed.warnings] };
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
  repairStateWorktree,
  createStateBranchFromRemote,
  lockStateWorktree,
  withStateLock,
  commitState,
  pushState,
};
