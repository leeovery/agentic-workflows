'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state worktree. The workflows keep their state on a
// branch of its own, `leeway-state`, an orphan checked out as a git worktree
// at `.leeway/` inside the repository's main checkout and locked there. A
// session in a code worktree finds the same `.leeway/` through the common git
// directory: there is one copy of the state, and no code worktree holds one.
//
// - Creating it: the orphan branch's first commit is built with plumbing, so
//   the main checkout's branch, HEAD and index are never touched — the
//   state's `.gitignore`, and the project manifest holding the project's id,
//   `project_id`, given here once and never changed, which keys the
//   project's evidence in the trust log (16.13.5); then the worktree is
//   added and locked. Each piece stands alone too, for the
//   repairs: add the worktree for a local branch, make the local branch from
//   the remote's or at the commit a folder still there holds, lock the
//   worktree, relink a worktree whose project folder moved or was copied.
//   The relink writes the two links itself, both inside the project: `git
//   worktree repair` rewrites the link of every worktree the repository
//   registers, and a copy's registrations name the original's, so it would
//   take the original's worktrees over. The commit a folder holds is read
//   from its registration's HEAD log, which git cannot read once the branch
//   is gone, and which every state commit, landing and checkout writes:
//   git's own log setting is overridden for the state's calls.
// - The remote: asked where its `leeway-state` stands, its tip brought into
//   the remote-tracking branch, and whether a branch by that name holds code
//   history — a state branch is an orphan line of its own.
// - Writing it: a verb holds the writer lock (`.leeway/.lock`, the kernel's)
//   across its writes and its commit, so concurrent verbs take turns and the branch
//   stays one line; the lock follows its holder's process, never its age,
//   and a process may take it again while it holds it. Boot's checks, which
//   put the worktree holding that lock in place, take one of their own in
//   the main checkout's git directory. The commit is built
//   in a private index from HEAD and the working tree, never through the
//   worktree's own index, so nothing a killed verb or a person left staged
//   there can break it. A merge's landing a kill cut short is finished
//   first (state-merge-landing.cjs), so the commit moves the branch on from
//   where that landing put it; a file the commit is given a change to is
//   read from there too, and changed alone. A commit whose ledger does not
//   start, byte for byte, with its parent's is refused (ledger-check.cjs),
//   but for the one a migration's conversion lets through. Then the branch
//   is pushed wherever the project has a remote, never forced; a push that
//   fails, runs out of time, or finds no remote chosen among several is a
//   warning, and the commit stands.
// - While the migration runs: the migration checks the state worktree out
//   on a `leeway-state` with no commit yet, and the migration's commit makes
//   its first (21.9.3). Until then every commit is held — held to the
//   layout as ever, the writes stay in the worktree, nothing is committed or
//   pushed, for that commit to take.
// - The backstop: every state commit is the engine's, so a commit reads the
//   state worktree's changes once, untracked files among them, ignored ones
//   not, and holds each against the layout (layout.cjs), its names spelled
//   as the state's filesystem spells them. A file on disk the layout has no
//   place for — one a shell wrote, past the layout hook — refuses the
//   commit, naming it, with nothing committed (6.2.5); a file gone is never
//   refused, as removing one is the way on. Every changed log of the
//   layout's rides along with what the verb gives (6.3.2). The files the
//   person's tools leave beside the state's — an operating system's folder
//   metadata, an editor's swap files, backups and locks — are neither
//   refused nor committed. A merge's landing is no verb's commit, and is
//   never checked.
// - Its `.gitignore`: written whole at the orphan's first commit; the task
//   driver's local files are added to it later, as its store is made.
//
// The state's branch, its remote, and their time limits are named here once,
// for the catch-up too (state-merge.cjs), as is the refusal of a branch
// holding code history.
//
// Every git call goes through kernel/isolated-git: hooks off, the caller's
// repository environment cleared.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit, gitfileTarget, realpathOrSelf } = require('../kernel/isolated-git.cjs');
const { GitError, literally } = require('../kernel/git.cjs');
const { STATE_BRANCH, BRANCH_REF } = require('../kernel/state-root.cjs');
const { WRITER_LOCK, jsonText, writeTextAtomic, withWriterLock, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { folding, layoutPlace } = require('./layout.cjs');
const { withPrivateIndex } = require('./state-merge-paths.cjs');
const { alignIndex } = require('./state-merge-worktree.cjs');
const { landingRecorded, finishLanding } = require('./state-merge-landing.cjs');
const { checkLedgerCommit, spendPass, dropStop } = require('./ledger-check.cjs');
const { LEDGER } = require('./ledger-events.cjs');
const { newId } = require('./ledger-ids.cjs');

const STATE_LOCK_REASON = 'leeway state, do not remove';
// The lock's claim is written beside it and linked into place, and a
// takeover holds a guard beside it: both are the lock's, ignored with it. A
// manifest's atomic write, and the ledger's append, is a temp file beside
// it until it is renamed in.
const STATE_GITIGNORE = [
  '/.knowledge/', '/.cache/', `/${WRITER_LOCK}`, `/${WRITER_LOCK}.*`, '.manifest.json.*.tmp', `/${LEDGER}.*.tmp`, '',
].join('\n');
const FIRST_COMMIT_MESSAGE = `chore: begin ${STATE_BRANCH}`;

const PRIVATE_INDEX = 'leeway-commit.index';
const BOOT_LOCK = 'leeway-boot.lock';

// The files the person's tools leave beside the state's, by base name, `*`
// any run of characters: Finder's, Explorer's and the AppleDouble halves a
// Mac writes on a foreign disk; Vim's swap files; Emacs's backups,
// autosaves and locks; JetBrains' safe-write copies.
const TOOL_SIDECARS = Object.freeze([
  '.DS_Store', 'Thumbs.db', 'desktop.ini', '._*',
  '.*.swp', '.*.swo', '.*.swx',
  '*~', '#*#', '.#*',
  '*___jb_tmp___', '*___jb_old___',
]);
const SIDECAR_NAME = new RegExp(`^(?:${TOOL_SIDECARS.map((glob) => glob.replace(/[^\w*]/g, '\\$&').replace(/\*/g, '.*')).join('|')})$`);
const SIDECARS_HELD_OUT = Object.freeze(TOOL_SIDECARS.map((glob) => `:(exclude,glob)**/${glob}`));

const PUSH_TIMEOUT_MS = 15000;
const FETCH_TIMEOUT_MS = 15000;
const NETWORK_ENV = Object.freeze({ GIT_TERMINAL_PROMPT: '0' });

/**
 * What the state's remote holds, asked once: no remote chosen; its
 * `leeway-state` tip, null where it holds none; or why it could not be
 * reached — never read as holding none.
 * @typedef {{remote: null, remotes: string[]}
 *   | {remote: string, remotes: string[], tip: string|null}
 *   | {remote: string, remotes: string[], unreachable: string}} RemoteAnswer
 */

/**
 * What a relinked state folder was: moved with its project, copied from
 * another project's, or already naming this repository's registration; and
 * the project its link named.
 * @typedef {{was: 'moved'|'copied'|'own', from: string}} Relinked
 */

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

/** @typedef {{commit: string|null, pushed: boolean, held?: true, warnings: string[]}} CommitOutcome */

/**
 * A change a state commit makes to a file as the branch holds it: given
 * its text, null where the branch has no such file, it answers the text to
 * commit, or null to leave the file as it is.
 * @typedef {(held: string|null) => string|null} Change
 */

/** The commit HEAD stands at, and its tree. @typedef {{commit: string, tree: string}} HeadAt */

/**
 * The state worktree as git opens it: its root, a runner bound to it, the
 * ref its HEAD names (`HEAD` when detached), where HEAD stands as it was
 * opened — null where that branch has no commit yet — where its private
 * index goes, its own git dir, and the hash its objects are named by.
 * @typedef {{
 *   opened: true,
 *   root: string,
 *   git: import('../kernel/isolated-git.cjs').IsolatedGit,
 *   head: string,
 *   at: HeadAt|null,
 *   index: string,
 *   gitDir: string,
 *   objectFormat: string,
 * }} OpenWorktree
 */

/** @param {string} root @returns {string} */
function mainOf(root) {
  return path.dirname(root);
}

/** The remote's `leeway-state` as this clone last fetched it. @param {string} remote @returns {string} */
function trackingRef(remote) {
  return `refs/remotes/${remote}/${STATE_BRANCH}`;
}

/**
 * The project's remotes, and the one the state goes to: `origin`, else the
 * remote the main checkout's branch tracks, else the project's one remote.
 * `remote` is null where the project has none, or several and none of
 * these chooses one. A nested repository's remote is chosen by the same
 * rule, bound to its own checkout (remote.cjs).
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git bound to the main checkout
 * @returns {{remote: string|null, remotes: string[]}}
 */
function stateRemote(git) {
  const remotes = git.run(['remote']).split('\n').filter((name) => name !== '');
  if (remotes.includes('origin')) return { remote: 'origin', remotes };
  if (remotes.length < 2) return { remote: remotes[0] ?? null, remotes };
  const branch = (git.tryRun(['symbolic-ref', '--quiet', '--short', 'HEAD']) || '').trim();
  const tracked = branch === '' ? '' : (git.tryRun(['config', '--get', `branch.${branch}.remote`]) || '').trim();
  return { remote: remotes.includes(tracked) ? tracked : null, remotes };
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

const OPENING = ['--show-toplevel', '--git-common-dir', '--git-path', PRIVATE_INDEX, '--absolute-git-dir', '--show-object-format'];

/** Where HEAD stands. @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @returns {HeadAt} */
function headAt(git) {
  const [commit, tree] = git.run(['rev-parse', 'HEAD', 'HEAD^{tree}']).trim().split('\n');
  return { commit, tree };
}

/**
 * The branch HEAD names where that branch has no commit yet, else null.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git
 * @returns {string|null}
 */
function unbornHead(git) {
  const ref = git.tryRun(['symbolic-ref', '--quiet', 'HEAD'])?.trim();
  if (!ref) return null;
  return git.tryRun(['rev-parse', '--quiet', '--verify', `${ref}^{commit}`]) === null ? ref : null;
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
  let answers;
  /** @type {HeadAt|null} */
  let at = null;
  try {
    const [commit, tree, ...rest] = git.run(['rev-parse', 'HEAD', 'HEAD^{tree}', ...OPENING, '--symbolic-full-name', 'HEAD']).split('\n');
    answers = rest;
    at = { commit, tree };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    const unborn = unbornHead(git);
    if (unborn === null) return { opened: false, why: err.message };
    answers = [...git.run(['rev-parse', ...OPENING]).trimEnd().split('\n'), unborn];
  }
  const [top, common, index, gitDir, objectFormat, head] = answers;
  const repository = realpathOrSelf(path.resolve(root, common));
  if (realpathOrSelf(top) !== root || repository !== path.join(mainOf(root), '.git')) {
    return { opened: false, why: `git reads it as part of ${top}, whose repository is ${repository}` };
  }
  return { opened: true, root, git, head, at, index: path.resolve(root, index), gitDir, objectFormat };
}

/**
 * Whether the migration runs in the state at `root`: its worktree there,
 * checked out on a `leeway-state` with no commit yet, the first of which
 * the migration's commit makes (21.9.3).
 * @param {string} root
 * @returns {boolean}
 */
function migrationRuns(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return false;
  const git = isolatedGit(root);
  return git.tryRun(['rev-parse', '--quiet', '--verify', 'HEAD^{commit}']) === null && unbornHead(git) === BRANCH_REF;
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
  const wanted = remote === null ? [BRANCH_REF] : [BRANCH_REF, trackingRef(remote)];
  const refs = git.run(['for-each-ref', '--format=%(refname)', ...wanted]).split('\n');
  return {
    main,
    root,
    branch: refs.includes(BRANCH_REF),
    remotes,
    remote,
    remoteBranch: remote !== null && refs.includes(trackingRef(remote)),
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

/**
 * Check the branch out at `root` and lock it, clearing first a registration
 * a removed folder left there.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} root
 */
function addLockedWorktree(git, root) {
  if (registeredWorktree(git, root) !== null) git.run(['worktree', 'remove', '--force', '--force', root]);
  git.run(['worktree', 'add', '--quiet', root, STATE_BRANCH]);
  lockWorktree(git, root);
}

/**
 * Create the state: the orphan `leeway-state` whose first commit holds the
 * state's `.gitignore` and the project manifest with a new `project_id`,
 * checked out at `root` and locked, then pushed where the project has a
 * remote. Refuses where `root` already exists or the branch does, creating
 * nothing.
 * @param {string} root
 * @param {{pushTimeoutMs?: number}} [opts]
 * @returns {CommitOutcome & {commit: string}}
 */
function createState(root, { pushTimeoutMs = PUSH_TIMEOUT_MS } = {}) {
  if (fs.existsSync(root)) throw new Error(`cannot create the state: ${root} already exists`);
  const git = isolatedGit(mainOf(root));
  const blob = (/** @type {string} */ input) => git.run(['hash-object', '-w', '--stdin'], { input }).trim();
  const entries = [['.gitignore', blob(STATE_GITIGNORE)], ['manifest.json', blob(jsonText({ project_id: newId() }))]];
  const tree = git.run(['mktree'], { input: entries.map(([name, oid]) => `100644 blob ${oid}\t${name}\n`).join('') }).trim();
  const commit = git.run(['commit-tree', tree, '-m', FIRST_COMMIT_MESSAGE]).trim();
  createBranchAt(git, commit);
  addLockedWorktree(git, root);
  return { commit, ...push(git, pushTimeoutMs) };
}

/**
 * Check the local `leeway-state` out at `root` and lock it — the repair for
 * a branch whose worktree is gone. Refuses where there is no local branch,
 * and where a folder is at `root`: a folder whose link broke is relinked by
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
  addLockedWorktree(git, root);
}

/**
 * An ignore file's text with the patterns it lacks added after its lines,
 * or null where it lacks none.
 * @param {string} held @param {string[]} patterns
 * @returns {string|null}
 */
function withIgnored(held, patterns) {
  const lines = held.split('\n');
  const missing = patterns.filter((pattern) => !lines.includes(pattern));
  if (missing.length === 0) return null;
  return `${held}${held === '' || held.endsWith('\n') ? '' : '\n'}${missing.join('\n')}\n`;
}

/**
 * The patterns the state's `.gitignore` lacks, added after the lines it
 * holds: the ones `STATE_GITIGNORE` cannot name, since only the task
 * driver knows its tool's local files (7.1.10). Whether any was added.
 * Refuses where the file is gone, saying how to bring it back.
 * @param {string} root @param {string[]} patterns
 * @returns {boolean}
 */
function ignoreInState(root, patterns) {
  const file = path.join(root, '.gitignore');
  if (!fs.existsSync(file)) {
    throw new Error(`the state's .gitignore is gone from ${root} — bring it back as ${STATE_BRANCH} holds it: git -C "${root}" checkout HEAD -- .gitignore`);
  }
  const text = withIgnored(fs.readFileSync(file, 'utf8'), patterns);
  if (text === null) return false;
  writeTextAtomic(file, text);
  return true;
}

/**
 * The registration the state folder at `root` links to, and this
 * repository's own registration of that name — the same one where the
 * folder never moved — or null where the folder holds no link git can read.
 * @param {string} root
 * @returns {{named: string, own: string}|null}
 */
function registrationOf(root) {
  const named = gitfileTarget(path.join(root, '.git'));
  return named === null ? null : { named, own: path.join(mainOf(root), '.git', 'worktrees', path.basename(named)) };
}

/**
 * Relink the state worktree whose folder git can no longer open as this
 * repository's: the project folder moved, so its links name the old place,
 * or was copied, so they name the original's registration. The folder's
 * `.git` is pointed at this repository's registration of the same name, and
 * that registration at the folder — both inside this project; the
 * registration it named, and anything of the project it was copied from,
 * are never read or written. The folder's contents and the registration's
 * lock stay as they are. Refuses where the folder holds no link, or this
 * repository keeps no registration by its name.
 * @param {string} root
 * @returns {Relinked}
 */
function repairStateWorktree(root) {
  const dotgit = path.join(root, '.git');
  const link = registrationOf(root);
  if (link === null) throw new Error(`${root} holds no worktree link git can read — nothing relinked`);
  const { named, own } = link;
  if (!fs.existsSync(own)) {
    throw new Error(`${root} links to ${named}, and this repository keeps no registration by that name — nothing relinked`);
  }
  const from = path.dirname(path.dirname(path.dirname(named)));
  /** @type {Relinked['was']} */
  let was = 'own';
  if (realpathOrSelf(named) !== realpathOrSelf(own)) {
    was = fs.existsSync(named) ? 'copied' : 'moved';
    writeTextAtomic(dotgit, `gitdir: ${own}\n`);
  }
  writeTextAtomic(path.join(own, 'gitdir'), `${dotgit}\n`);
  return { was, from };
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
  const tip = git.tryRun(['rev-parse', '--quiet', '--verify', `${trackingRef(remote)}^{commit}`]);
  if (tip === null) throw new Error(`${remote} holds no ${STATE_BRANCH}`);
  createBranchAt(git, tip.trim());
}

const NO_COMMIT = /^0+$/;

/**
 * The commit the files of the state folder at `root` were last checked out
 * or committed at, whatever became of the branch since: the last its
 * registration's HEAD log moved to. Null where the folder links to no
 * registration of this repository's, or the log names no commit this clone
 * holds.
 * @param {string} root
 * @returns {string|null}
 */
function folderCommit(root) {
  const link = registrationOf(root);
  if (link === null) return null;
  let log;
  try {
    log = fs.readFileSync(path.join(link.own, 'logs', 'HEAD'), 'utf8');
  } catch {
    return null;
  }
  const moved = log.split('\n').map((entry) => entry.split(' ')[1]).filter((to) => to !== undefined && !NO_COMMIT.test(to));
  if (moved.length === 0) return null;
  const commit = isolatedGit(mainOf(root)).tryRun(['rev-parse', '--quiet', '--verify', `${moved[moved.length - 1]}^{commit}`]);
  return commit === null ? null : commit.trim();
}

/**
 * Make the local `leeway-state` at `commit` — the repair for a branch lost
 * under a folder still there, made where the folder's files stand, so they
 * are what the catch-up moves on from.
 * @param {string} root @param {string} commit
 */
function createStateBranchAt(root, commit) {
  createBranchAt(isolatedGit(mainOf(root)), commit);
}

/**
 * Lock the state worktree with the state's reason.
 * @param {string} root
 */
function lockStateWorktree(root) {
  lockWorktree(isolatedGit(mainOf(root)), root);
}

/**
 * Ask the state's remote where its `leeway-state` stands — the one call
 * over the network a boot with nothing to do makes.
 * @param {string} root
 * @param {{timeoutMs?: number}} [opts]
 * @returns {RemoteAnswer}
 */
function askStateRemote(root, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const git = isolatedGit(mainOf(root));
  const { remote, remotes } = stateRemote(git);
  if (remote === null) return { remote, remotes };
  try {
    const out = git.run(['ls-remote', remote, BRANCH_REF], { timeoutMs, env: NETWORK_ENV });
    const tip = out.split('\n').map((line) => line.split('\t')).find(([, ref]) => ref === BRANCH_REF)?.[0] ?? null;
    return { remote, remotes, tip };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { remote, remotes, unreachable: err.message };
  }
}

/**
 * Bring the remote's `leeway-state` at `tip` into its remote-tracking
 * branch: set there where this clone holds the commit, fetched where it
 * does not. Null once there, else why the fetch failed.
 * @param {string} root @param {string} remote @param {string} tip
 * @param {{timeoutMs?: number}} [opts]
 * @returns {string|null}
 */
function fetchStateTip(root, remote, tip, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const git = isolatedGit(mainOf(root));
  if (git.tryRun(['cat-file', '-e', `${tip}^{commit}`]) !== null) {
    git.run(['update-ref', trackingRef(remote), tip]);
    return null;
  }
  try {
    git.run(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, `+${BRANCH_REF}:${trackingRef(remote)}`], { timeoutMs, env: NETWORK_ENV });
    return null;
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return err.message;
  }
}

/**
 * Bring every branch the remote holds into its remote-tracking branches, in
 * one fetch — a branch pushed from another clone this one never fetched
 * included. Null once fetched, else why the fetch failed.
 * @param {string} root @param {string} remote
 * @param {{timeoutMs?: number}} [opts]
 * @returns {string|null}
 */
function fetchRemoteBranches(root, remote, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  try {
    isolatedGit(mainOf(root)).run(
      ['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, `+refs/heads/*:refs/remotes/${remote}/*`],
      { timeoutMs, env: NETWORK_ENV },
    );
    return null;
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return err.message;
  }
}

/** Whether a ref is a state branch: this clone's, or a remote's as last fetched. @param {string} ref */
function isStateRef(ref) {
  return ref === BRANCH_REF || (ref.startsWith('refs/remotes/') && ref.endsWith(`/${STATE_BRANCH}`));
}

/**
 * The code branch, here or on a remote as last fetched, whose history `ref`
 * shares a commit with, or null where it shares none — a state branch is an
 * orphan line of its own, so a shared commit is code history. Two histories
 * share a commit exactly where one holds a root of the other's, so only the
 * roots of `ref` are looked for.
 * @param {string} root @param {string} ref
 * @returns {string|null}
 */
function codeBranchSharing(root, ref) {
  const git = isolatedGit(mainOf(root));
  for (const first of git.run(['rev-list', '--max-parents=0', ref]).split('\n').filter(Boolean)) {
    const holders = git.run(['for-each-ref', '--format=%(refname)', '--contains', first, 'refs/heads', 'refs/remotes']).split('\n');
    const code = holders.find((holder) => holder !== '' && !isStateRef(holder));
    if (code !== undefined) return code.replace(/^refs\/(heads|remotes)\//, '');
  }
  return null;
}

/**
 * Refuse `ref` where it holds code history (`codeBranchSharing`): the
 * refusal names it as `named`, then says what was left undone and the way
 * on (`after`).
 * @param {string} root @param {string} ref @param {string} named @param {string} after
 */
function refuseCodeHistory(root, ref, named, after) {
  const code = codeBranchSharing(root, ref);
  if (code !== null) {
    throw new Error(`${named} holds code history — it shares commits with ${code}, where the state branch is a line of its own — ${after}`);
  }
}

/**
 * The name of the state's remote, or null where none is chosen.
 * @param {string} root
 * @returns {string|null}
 */
function stateRemoteName(root) {
  return stateRemote(isolatedGit(mainOf(root))).remote;
}

/**
 * The URL a checkout's chosen remote (`stateRemote`) fetches from, any
 * `insteadOf` applied, or null where none is chosen.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git bound to the checkout
 * @returns {string|null}
 */
function chosenRemoteUrl(git) {
  const { remote } = stateRemote(git);
  return remote === null ? null : git.run(['remote', 'get-url', remote]).trim();
}

/**
 * The URL the state's remote fetches from, any `insteadOf` applied, or null
 * where no remote is chosen.
 * @param {string} root
 * @returns {string|null}
 */
function stateRemoteUrl(root) {
  return chosenRemoteUrl(isolatedGit(mainOf(root)));
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
 * Run `fn` holding the lock boot's checks of the state take — a file in the
 * main checkout's git directory, there before the state worktree is — held
 * as the writer lock is. Two boots putting the state in place at once
 * would each make the branch and add the worktree, and two `git worktree
 * add` at one path undo each other: the one that fails deletes the folder
 * the other made.
 * @template T
 * @param {string} root @param {() => T} fn
 * @returns {T}
 */
function withBootLock(root, fn) {
  return withStateLockFile(path.join(mainOf(root), '.git', BOOT_LOCK), fn);
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

/**
 * A file's text as the commit `head` holds it, or null where the commit
 * holds no such path. Refuses, naming the path and the commit, where git
 * cannot read it.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} head @param {string} spec
 * @returns {string|null}
 */
function heldAt(git, head, spec) {
  try {
    const listed = git.run(['ls-tree', '-z', head, '--', spec]).split('\0')[0];
    return listed === '' ? null : git.run(['cat-file', 'blob', listed.split('\t')[0].split(' ')[2]]);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    throw new Error(`${spec} could not be read from ${STATE_BRANCH} at ${head} — nothing committed: ${err.message}`);
  }
}

/**
 * The text `change` makes of a file as the commit `head` holds it, or null
 * to leave it. Refuses, naming the path and the commit and how to go on,
 * where the change cannot be made of what the file holds.
 * @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} head @param {string} spec @param {Change} change
 * @returns {string|null}
 */
function changedAt(git, head, spec, change) {
  const held = heldAt(git, head, spec);
  try {
    return change(held);
  } catch (err) {
    throw new Error(`${spec} as ${STATE_BRANCH} holds it at ${head} cannot take the change — nothing committed; commit ${spec} mended to go on: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * A path whose file in the state worktree differs from HEAD, named from the
 * root: whether it is gone from the working tree, and its place in the
 * layout, null where it has none.
 * @typedef {{rel: string, gone: boolean, at: import('./layout.cjs').Place|null}} PlacedChange
 */

/**
 * Every path whose file in the state worktree differs from HEAD — changed,
 * added, untracked or gone, never one git ignores — read in one `status`,
 * the files the person's tools leave beside the state's left out, each with
 * its place in the layout as the state's filesystem spells names.
 * @param {OpenWorktree} worktree
 * @returns {PlacedChange[]}
 */
function placedChanges({ git, root }) {
  const fold = folding(root);
  return git.run(['status', '--porcelain', '-z', '--untracked-files=all', '--no-renames']).split('\0')
    .filter((entry) => entry !== '' && !SIDECAR_NAME.test(path.posix.basename(entry.slice(3))))
    .map((entry) => {
      const rel = entry.slice(3);
      return { rel, gone: entry[1] === 'D' || entry.startsWith('D '), at: layoutPlace(rel, fold) };
    });
}

/**
 * Refuse a state commit, committing nothing, where a file on disk has no
 * place in the layout, naming each and the way on (6.2.5).
 * @param {string} root @param {PlacedChange[]} changes
 */
function refuseOutsideLayout(root, changes) {
  const strays = changes.filter(({ at, gone }) => at === null && !gone).map(({ rel }) => rel);
  if (strays.length === 0) return;
  const it = strays.length === 1 ? 'it' : 'each';
  throw new Error(`the state at ${root} holds ${strays.join(', ')}, outside the workflows' layout — nothing committed; remove ${it}, or move ${it} into the layout`);
}

/**
 * Commit the working tree's state of the pathspecs onto `leeway-state`,
 * HEAD standing `at`. The tree is built in a private index seeded from HEAD
 * — never the worktree's own, whatever it holds staged — and the branch
 * moves only from the HEAD it was built on. A tree whose ledger does not
 * start with HEAD's is refused (ledger-check.cjs), but for a conversion's,
 * whose pass the commit spends; a commit that lands clears the engine's
 * kept stop on the ledger.
 * A kill at any step leaves the branch where it was or at the whole commit,
 * and the private index is cleared before and after. A file given a change
 * is committed as the change makes it of HEAD's, whatever the working tree
 * holds. The files the person's tools leave beside the state's are never
 * staged. Of `kept`, what is on disk is staged as additions and edits
 * alone — a folder's new files with them — never a removal. Null where the
 * tree comes out as HEAD's.
 * @param {OpenWorktree} worktree @param {HeadAt} at @param {string[]} specs @param {string} message
 * @param {Record<string, Change>} changes @param {string[]} kept
 * @returns {string|null}
 */
function commitPaths(worktree, { commit: head, tree: headTree }, specs, message, changes, kept) {
  const { git, root, index, gitDir } = worktree;
  const changed = Object.entries(changes).flatMap(([spec, change]) => {
    const text = changedAt(git, head, spec, change);
    return text === null ? [] : [{ spec, text }];
  });
  return withPrivateIndex(index, (env) => {
    git.run(['read-tree', head], { env });
    // `add` refuses a pathspec that matches nothing on disk or in the index:
    // a path gone from both has nothing to commit.
    const gone = specs.filter((spec) => spec !== '.' && !onDisk(path.join(root, spec)));
    const known = gone.length === 0 ? [] : git.run(['ls-files', '-z', '--', ...literally(gone)], { env }).split('\0').filter((file) => file !== '');
    const stageable = specs.filter((spec) => !gone.includes(spec) || known.some((file) => file === spec || file.startsWith(`${spec}/`)));
    if (stageable.length > 0) git.run(['add', '--all', '--', ...literally(stageable), ...SIDECARS_HELD_OUT], { env });
    const present = kept.filter((spec) => onDisk(path.join(root, spec)));
    if (present.length > 0) {
      git.run(['add', '--ignore-removal', '--pathspec-from-file=-', '--pathspec-file-nul'], { env, input: [...literally(present), ...SIDECARS_HELD_OUT].join('\0') });
    }
    for (const { spec, text } of changed) {
      const blob = git.run(['hash-object', '-w', '--stdin'], { input: text }).trim();
      git.run(['update-index', '--add', '--cacheinfo', `100644,${blob},${spec}`], { env });
    }
    const tree = git.run(['write-tree'], { env }).trim();
    if (tree === headTree) return null;
    const conversion = checkLedgerCommit(worktree, head, tree);
    const commit = git.run(['commit-tree', tree, '-p', head, '-m', message]).trim();
    git.run(['update-ref', '-m', `commit: ${message.split('\n')[0]}`, BRANCH_REF, commit, head]);
    if (conversion !== null) spendPass(gitDir);
    dropStop(gitDir);
    return commit;
  });
}

/**
 * Why a push failed, as git says it, without git's hints: they advise
 * pulling, and the state branch is never pulled — the catch-up merges it.
 * @param {GitError} err
 * @returns {string}
 */
function pushRefusal(err) {
  return err.message.split('\n').filter((line) => !line.startsWith('hint:')).join('\n').trim();
}

/**
 * Push `leeway-state` to the state's remote, never forcing, within
 * `timeoutMs`. No remote, no push; several remotes that choose none, a
 * refused push or a timed-out one is a warning, and the commit stands for
 * the next boot's catch-up to push.
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
    git.run(['push', '--quiet', remote, `${BRANCH_REF}:${BRANCH_REF}`], { timeoutMs, env: NETWORK_ENV });
    return { pushed: true, warnings: [] };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return {
      pushed: false,
      warnings: [`${STATE_BRANCH} is committed here but was not pushed to ${remote} — the commit stands, and the next boot pushes it: ${pushRefusal(err)}`],
    };
  }
}

/**
 * Commit `paths`, as the working tree holds them, onto `leeway-state` in
 * the state worktree, with every log of the layout's changed since the last
 * commit, pushing nothing. The caller holds the writer lock
 * (`withStateLock`). Refuses, committing nothing, where git cannot open the
 * state worktree, where it has another branch checked out, and where a file
 * in it has no place in the layout. A merge's landing a kill cut short is
 * finished first. Paths that hold no change commit nothing. A file in
 * `contents` is committed as its change makes it of the file the branch
 * holds once any landing is finished — over whatever `paths` gives of it —
 * the working file's own changes left as they are, uncommitted; a file the
 * branch holds that git cannot read, or that its change cannot be made of,
 * refuses the commit. While the migration runs — `leeway-state` with no
 * commit yet — the commit is held, once the layout holds every file: the
 * writes stay as they are, for the migration's commit to take (21.9.3).
 * Of `kept`, what is on disk is taken as additions and edits alone, never a
 * removal: a ledger commit's files its asset links name (ledger.cjs).
 * @param {string} root
 * @param {string[]} paths absolute, or from the state root
 * @param {string} message
 * @param {{contents?: Record<string, Change>, kept?: string[]}} [opts] `contents` by path as `paths` gives one; `kept` as `paths` gives one
 * @returns {{commit: string|null, held?: true, warnings: string[]}}
 */
function commitHere(root, paths, message, { contents = {}, kept = [] } = {}) {
  if (!fs.existsSync(root)) throw new Error(`no state worktree at ${root}`);
  const specs = paths.map((given) => fromRoot(root, given));
  const keptSpecs = kept.map((given) => fromRoot(root, given));
  const given = Object.fromEntries(Object.entries(contents).map(([file, change]) => [fromRoot(root, file), change]));
  const worktree = openWorktree(root);
  if (!worktree.opened) throw new Error(`git cannot open the state worktree at ${root}: ${worktree.why} — nothing committed`);
  if (worktree.head !== BRANCH_REF) {
    const checkedOut = worktree.head === 'HEAD' ? 'a detached HEAD' : worktree.head.replace(/^refs\/heads\//, '');
    throw new Error(`the state worktree at ${root} has ${checkedOut} checked out, not ${STATE_BRANCH} — nothing committed`);
  }
  const taken = [...specs, ...Object.keys(given)];
  if (taken.length === 0) return { commit: null, warnings: [] };
  if (worktree.at === null) {
    refuseOutsideLayout(root, placedChanges(worktree));
    return { commit: null, held: true, warnings: [] };
  }
  const recorded = landingRecorded(worktree);
  const landed = finishLanding(worktree, STATE_BRANCH);
  const changes = placedChanges(worktree);
  refuseOutsideLayout(root, changes);
  const logs = changes.filter(({ at }) => at?.kind === 'log').map(({ rel }) => rel);
  const commit = commitPaths(worktree, recorded ? headAt(worktree.git) : worktree.at, [...specs, ...logs], message, given, keptSpecs);
  return { commit, warnings: [...landed, ...alignIndex(worktree.git, STATE_BRANCH, 'HEAD', [...taken, ...logs, ...keptSpecs])] };
}

/**
 * Commit `paths` as `commitHere` does, then push. Paths that hold no change,
 * with no log changed, commit nothing and push nothing.
 * @param {string} root
 * @param {string[]} paths absolute, or from the state root
 * @param {string} message
 * @param {{pushTimeoutMs?: number, contents?: Record<string, Change>, kept?: string[]}} [opts] `contents` and `kept` as `commitHere` takes them
 * @returns {CommitOutcome}
 */
function commitState(root, paths, message, { pushTimeoutMs = PUSH_TIMEOUT_MS, contents = {}, kept = [] } = {}) {
  const { commit, held, warnings } = commitHere(root, paths, message, { contents, kept });
  if (commit === null) return { commit: null, pushed: false, ...(held ? { held } : {}), warnings };
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
  STATE_LOCK_REASON,
  STATE_GITIGNORE,
  BRANCH_REF,
  FETCH_TIMEOUT_MS,
  PUSH_TIMEOUT_MS,
  NETWORK_ENV,
  trackingRef,
  noRemoteChosen,
  stateRemote,
  openWorktree,
  migrationRuns,
  inspectState,
  createState,
  addStateWorktree,
  repairStateWorktree,
  createStateBranchFromRemote,
  createStateBranchAt,
  folderCommit,
  lockStateWorktree,
  askStateRemote,
  fetchStateTip,
  fetchRemoteBranches,
  codeBranchSharing,
  refuseCodeHistory,
  stateRemoteName,
  stateRemoteUrl,
  chosenRemoteUrl,
  withStateLock,
  withBootLock,
  ignoreInState,
  withIgnored,
  commitHere,
  commitState,
  pushState,
  pushRefusal,
};
