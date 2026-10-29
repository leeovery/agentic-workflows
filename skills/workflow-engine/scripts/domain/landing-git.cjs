'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the code-side git a landing runs, for every landing driver.
// What lands is code, so this is the person's own git, with their config,
// identity and hooks (kernel/git.cjs), never the state's isolated runner.
//
// - The default branch: the one the project's remote names its HEAD; else
//   the first the repository has of the one `init.defaultBranch` names,
//   `main` and `master`. Never the branch a checkout happens to be on, and
//   never the state branch (4.9.4).
// - A commit is made with no checkout: a tree committed onto a parent, or a
//   commit replayed onto another, which stops on a conflict.
// - A branch moves by its ref alone, so no checkout moves — but for a branch
//   a worktree has checked out, which moves only by a fast-forward there,
//   its tracked files clean, nothing at a path the move adds, ignored or
//   not, and in the middle of no operation. A rebase stopped in a worktree
//   leaves it detached, yet holds the branch it rebases and those it
//   updates, so no such branch moves. Otherwise the move stops, saying what
//   is in the way and the way on.
// - A remedy never acts in the person's own checkout but on a branch it has
//   out: a branch moves by its ref, or in the worktree that has it; a
//   branch's history is rewritten there, or in a worktree the remedy makes
//   for it and removes. What it takes off a branch it keeps on one first.
//   Every path and word it names is quoted for the shell.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { git, tryGit, operationInProgress, dirtyEntries, GitError } = require('../kernel/git.cjs');
const { STATE_BRANCH } = require('./state-worktree.cjs');

/**
 * A worktree of the repository: where it is, the branch it has checked out,
 * if any, and the branches a rebase stopped there is rewriting.
 * @typedef {{path: string, branch: string|null, rebasing: string[]}} Worktree
 */

const HEADS = 'refs/heads/';

/** The names a default branch goes by where nothing names it: GitHub's and git's own. */
const TRUNKS = ['main', 'master'];

/** A commit as messages name it. @param {string} sha @returns {string} */
function short(sha) {
  return sha.slice(0, 7);
}

/** Every local branch, by name, at its tip. @param {string} root @returns {Map<string, string>} */
function branches(root) {
  const lines = git(root, ['for-each-ref', '--format=%(refname)%00%(objectname)', HEADS]).split('\n').filter(Boolean);
  return new Map(lines.map((line) => {
    const [ref, sha] = line.split('\0');
    return [ref.slice(HEADS.length), sha];
  }));
}

/** The local branches whose tips a commit holds. @param {string} root @param {string} commit @returns {Set<string>} */
function branchesHeldBy(root, commit) {
  const refs = git(root, ['for-each-ref', `--merged=${commit}`, '--format=%(refname)', HEADS]).split('\n').filter(Boolean);
  return new Set(refs.map((ref) => ref.slice(HEADS.length)));
}

/** Whether `ancestor` is `commit` or one it descends from. @param {string} root @param {string} ancestor @param {string} commit @returns {boolean} */
function isAncestor(root, ancestor, commit) {
  return tryGit(root, ['merge-base', '--is-ancestor', ancestor, commit]) !== null;
}

/** The trees of commits, in their order. @param {string} root @param {string[]} commits @returns {string[]} */
function treesOf(root, commits) {
  return git(root, ['rev-parse', ...commits.map((commit) => `${commit}^{tree}`)]).trim().split('\n');
}

/**
 * Every ref under a prefix, by its name past the prefix, at its commit.
 * @param {string} root @param {string} prefix ending in `/`
 * @returns {Map<string, string>}
 */
function refsUnder(root, prefix) {
  const lines = git(root, ['for-each-ref', '--format=%(refname)%00%(objectname)', prefix]).split('\n').filter(Boolean);
  return new Map(lines.map((line) => {
    const [ref, sha] = line.split('\0');
    return [ref.slice(prefix.length), sha];
  }));
}

/**
 * Refs set and deleted in one transaction.
 * @param {string} root @param {{set?: [string, string][], drop?: string[]}} change
 */
function updateRefs(root, { set = [], drop = [] }) {
  const lines = [...set.map(([ref, sha]) => `update ${ref} ${sha}`), ...drop.map((ref) => `delete ${ref}`)];
  if (lines.length > 0) git(root, ['update-ref', '--stdin'], undefined, `${lines.join('\n')}\n`);
}

/**
 * The commits past `from` on `to`'s first-parent line, newest first, each
 * with its tree and message.
 * @param {string} root @param {string} from @param {string} to
 * @returns {{sha: string, tree: string, message: string}[]}
 */
function firstParentLine(root, from, to) {
  return git(root, ['log', '--first-parent', '-z', '--format=%H %T%n%B', `${from}..${to}`]).split('\0').filter(Boolean).map((entry) => {
    const nl = entry.indexOf('\n');
    const [sha, tree] = entry.slice(0, nl).split(' ');
    return { sha, tree, message: entry.slice(nl + 1) };
  });
}

/** The message of every commit `to` holds past `from`, whatever its parent. @param {string} root @param {string} from @param {string} to @returns {string[]} */
function messagesPast(root, from, to) {
  return git(root, ['log', '-z', '--format=%B', `${from}..${to}`]).split('\0').filter(Boolean);
}

/** A commit's message. @param {string} root @param {string} commit @returns {string} */
function messageOf(root, commit) {
  return git(root, ['log', '-1', '--format=%B', commit]);
}

/**
 * The newest commit `to` holds past `from` whose tree is `tree`, or null.
 * @param {string} root @param {string} from @param {string} to @param {string} tree
 * @returns {string|null}
 */
function commitWithTree(root, from, to, tree) {
  const found = git(root, ['log', '--format=%H %T', `${from}..${to}`]).split('\n').find((line) => line.endsWith(` ${tree}`));
  return found === undefined ? null : found.split(' ')[0];
}

/** The trees of every commit `to` holds past `from`. @param {string} root @param {string} from @param {string} to @returns {Set<string>} */
function treesPast(root, from, to) {
  return new Set(git(root, ['log', '--format=%T', `${from}..${to}`]).split('\n').filter(Boolean));
}

/**
 * The paths a change touches from where `tip` left `base` to `tip`, each
 * with whether it is a nested repository's pointer.
 * @param {string} root @param {string} base @param {string} tip
 * @returns {{path: string, gitlink: boolean}[]}
 */
function changeOf(root, base, tip) {
  const fields = git(root, ['diff', '--raw', '-z', '--no-renames', '--ignore-submodules=none', `${base}...${tip}`]).split('\0');
  /** @type {{path: string, gitlink: boolean}[]} */
  const change = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const [before, after] = fields[i].slice(1).split(' ');
    change.push({ path: fields[i + 1], gitlink: before === '160000' || after === '160000' });
  }
  return change;
}

/** A tree committed onto a parent under a message. @param {string} root @param {string} tree @param {string} parent @param {string} message @returns {string} */
function commitTree(root, tree, parent, message) {
  return git(root, ['commit-tree', tree, '-p', parent, '-F', '-'], undefined, message).trim();
}

/** A change that conflicts where it is replayed: its message names it, and where. */
class Conflict extends Error {}

/**
 * Commits replayed onto `onto`, oldest first, each its own change under its
 * own message: the commit the last replay made, and those whose change was
 * there already, each replayed as a commit that changes nothing. Stops on
 * the first change that conflicts, naming it and its paths (`Conflict`).
 * @template {{sha: string, message: string, name: string}} C
 * @param {string} root @param {C[]} commits @param {string} onto @param {string} ontoName
 * @returns {{tip: string, empty: C[]}}
 */
function replay(root, commits, onto, ontoName) {
  let at = onto;
  let [atTree] = treesOf(root, [onto]);
  /** @type {C[]} */
  const empty = [];
  for (const commit of commits) {
    const args = ['merge-tree', '--write-tree', '--name-only', '--no-messages', `--merge-base=${commit.sha}^`, at, commit.sha];
    const res = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (res.status === 1) {
      const paths = res.stdout.split('\n').slice(1).filter(Boolean);
      throw new Conflict(`land: ${commit.name} conflicts with ${ontoName} at ${paths.join(', ')}`);
    }
    if (res.error || res.status !== 0) throw new GitError(`git merge-tree failed: ${(res.error?.message ?? res.stderr).trim()}`);
    const tree = res.stdout.split('\n')[0];
    if (tree === atTree) empty.push(commit);
    at = commitTree(root, tree, at, commit.message);
    atTree = tree;
  }
  return { tip: at, empty };
}

/** A worktree's own git directory. @param {string} tree @returns {string} */
function gitDirOf(tree) {
  const dotGit = path.join(tree, '.git');
  if (fs.statSync(dotGit).isDirectory()) return dotGit;
  return path.resolve(tree, fs.readFileSync(dotGit, 'utf8').replace(/^gitdir: /, '').trim());
}

/**
 * The branches a rebase stopped in a worktree is rewriting: the one it
 * rebases, and those `--update-refs` moves at its end.
 * @param {string} gitDir
 * @returns {string[]}
 */
function rebasing(gitDir) {
  return ['rebase-merge', 'rebase-apply'].flatMap((folder) => ['head-name', 'update-refs'].flatMap((file) => {
    const at = path.join(gitDir, folder, file);
    if (!fs.existsSync(at)) return [];
    return fs.readFileSync(at, 'utf8').split('\n').filter((line) => line.startsWith(HEADS)).map((ref) => ref.slice(HEADS.length));
  }));
}

/**
 * The repository's worktrees, the main checkout first, each with the branch
 * it has checked out and those a rebase stopped there is rewriting — which
 * leaves the worktree detached, though the rebase holds them.
 * @param {string} root
 * @returns {Worktree[]}
 */
function worktrees(root) {
  return git(root, ['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map((block) => {
    const lines = block.split('\n');
    const tree = lines[0].slice('worktree '.length);
    const branch = lines.find((line) => line.startsWith(`branch ${HEADS}`));
    return {
      path: tree,
      branch: branch === undefined ? null : branch.slice(`branch ${HEADS}`.length),
      rebasing: lines.includes('detached') && fs.existsSync(tree) ? rebasing(gitDirOf(tree)) : [],
    };
  });
}

/**
 * What a worktree has at a path or in its way: the path itself, or the
 * first leading component that is no directory — a file, or a symbolic
 * link, which git never follows — or null where nothing is.
 * @param {string} tree @param {string} file
 * @returns {string|null}
 */
function presentAt(tree, file) {
  const parts = file.split('/');
  for (let i = 1; i <= parts.length; i += 1) {
    const at = parts.slice(0, i).join('/');
    let stat;
    try {
      stat = fs.lstatSync(path.join(tree, at));
    } catch {
      return null;
    }
    if (i === parts.length || !stat.isDirectory()) return at;
  }
  return null;
}

/**
 * What a move from `from` to `to` would overwrite in a worktree: whatever
 * it has, tracked by nothing, ignored or not, at a path the move adds or in
 * that path's way. What the worktree tracks is no such thing — a file, a
 * link, or a directory of tracked files the move replaces, as it does a
 * file renamed in its case alone where `core.ignorecase` is set.
 * @param {string} tree @param {string} from @param {string} to
 * @returns {string[]}
 */
function inTheWay(tree, from, to) {
  const added = git(tree, ['diff', '--name-only', '-z', '--no-renames', '--diff-filter=A', from, to]).split('\0').filter(Boolean);
  const present = [...new Set(added.flatMap((file) => presentAt(tree, file) ?? []))];
  if (present.length === 0) return [];
  const icase = tryGit(tree, ['config', '--bool', '--get', 'core.ignorecase'])?.trim() === 'true';
  /** @param {string} file */
  const fold = (file) => (icase ? file.toLowerCase() : file);
  const tracked = new Set(git(tree, ['ls-files', '-z']).split('\0').filter(Boolean).flatMap((file) => {
    const parts = fold(file).split('/');
    return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  }));
  return present.filter((file) => !tracked.has(fold(file)));
}

/** Whether two paths name one folder. @param {string} a @param {string} b */
function samePlace(a, b) {
  const real = (/** @type {string} */ at) => (fs.existsSync(at) ? fs.realpathSync(at) : path.resolve(at));
  return real(a) === real(b);
}

/** A word as the shell takes it whole: bare where nothing in it is special, else single-quoted. @param {string} word */
function quoted(word) {
  return /^[\w@%+=:,./^-]+$/.test(word) ? word : `'${word.replace(/'/g, "'\\''")}'`;
}

/** Git as a remedy runs it in a worktree: plainly in the code root, by `-C` elsewhere. @param {string} root @param {string} tree */
function gitIn(root, tree) {
  return samePlace(root, tree) ? 'git' : `git -C ${quoted(tree)}`;
}

/** The worktree that has a branch checked out, if any. @param {string} root @param {string} branch @param {Worktree[]} [trees] */
function holderOf(root, branch, trees = worktrees(root)) {
  return trees.find((tree) => tree.branch === branch);
}

/**
 * The command that keeps a commit on a branch of its own, named for the
 * branch it is taken off and the commit — a name no task's or phase's
 * branch can take.
 * @param {string} branch @param {string} commit
 * @returns {{kept: string, command: string}}
 */
function keepCommand(branch, commit) {
  const kept = `${branch}.kept-${short(commit)}`;
  return { kept, command: `\`git branch ${kept} ${short(commit)}\`` };
}

/**
 * The command that moves a branch to a commit, fitted to where it is out:
 * a reset there, keeping what is not committed, or the branch alone where
 * nothing has it out.
 * @param {string} root @param {string} branch @param {string} to
 * @returns {string}
 */
function moveCommand(root, branch, to) {
  const holder = holderOf(root, branch);
  if (holder === undefined) return `\`git branch -f ${branch} ${to}\``;
  if (!fs.existsSync(holder.path)) return `\`git worktree prune\`, then \`git branch -f ${branch} ${to}\``;
  return `\`${gitIn(root, holder.path)} reset --keep ${to}\``;
}

/** Where a remedy makes a worktree for a branch it rewrites. @param {string} root @param {string} branch */
function scratchTree(root, branch) {
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
  return path.join(common, 'leeway', branch.replace(/\//g, '-'));
}

/**
 * The commands that rebase a branch, fitted to where it is out: in the
 * worktree that has it, its changes not committed set aside first; or, where
 * nothing has it out, in a worktree made for it and removed after — never in
 * the person's own checkout. `settle` says how a stop on a conflict goes on.
 * @param {string} root @param {string} branch @param {string} args the rebase's own
 * @param {{settle?: boolean}} [opts]
 * @returns {string}
 */
function rebaseCommand(root, branch, args, { settle = false } = {}) {
  const holder = holderOf(root, branch);
  const live = holder !== undefined && fs.existsSync(holder.path);
  const tree = live ? holder.path : scratchTree(root, branch);
  const there = gitIn(root, tree);
  /** @type {string[]} */
  const steps = [];
  if (holder !== undefined && !live) steps.push('`git worktree prune`');
  if (!live) steps.push(`\`git worktree add ${quoted(tree)} ${branch}\``);
  else if (dirtyEntries(tree).some((entry) => entry.status !== '??')) steps.push(`\`${there} stash\` to set aside the changes not committed there`);
  steps.push(`\`${there} rebase ${args}\``);
  if (settle) steps.push(`settle each conflict at ${tree} as it stops and go on with \`${there} rebase --continue\``);
  if (!live) steps.push(`\`git worktree remove ${quoted(tree)}\``);
  return steps.join(', then ');
}

/** How an operation stopped in a worktree is abandoned, by the marker git leaves. */
const ABORTS = Object.freeze({
  MERGE_HEAD: 'merge --abort',
  CHERRY_PICK_HEAD: 'cherry-pick --abort',
  REVERT_HEAD: 'revert --abort',
  'rebase-merge': 'rebase --abort',
  'rebase-apply': 'rebase --abort',
  BISECT_START: 'bisect reset',
});

/**
 * What a rebase stopped in a worktree says of a branch it is rewriting, and
 * how to end it, or null where none is.
 * @param {string} root @param {string} branch @param {Worktree[]} [trees]
 * @returns {string|null}
 */
function rebaseBlock(root, branch, trees = worktrees(root)) {
  const rebased = trees.find((tree) => tree.rebasing.includes(branch));
  if (rebased === undefined) return null;
  return `${branch} is being rebased at ${rebased.path}, so nothing moved — finish that rebase, or end it with \`${gitIn(root, rebased.path)} rebase --abort\`, and land again`;
}

/**
 * What stops a branch a worktree holds from moving there, and the way on —
 * a rebase rewriting it, the worktree deleted but not pruned, an operation
 * in progress, tracked changes not committed, and, for a move given, one
 * that is no fast-forward or would overwrite a file — or null where nothing
 * does, or no worktree holds it.
 * @param {string} root @param {string} branch
 * @param {{from: string, to: string}} [move]
 * @returns {string|null}
 */
function checkoutBlock(root, branch, move) {
  const trees = worktrees(root);
  const rebased = rebaseBlock(root, branch, trees);
  if (rebased !== null) return rebased;
  const holder = holderOf(root, branch, trees);
  if (holder === undefined) return null;
  const at = `${branch} is checked out at ${holder.path}`;
  if (!fs.existsSync(holder.path)) return `${at}, a worktree since deleted, so nothing moved — clear it with \`git worktree prune\` and land again`;
  const there = gitIn(root, holder.path);
  const open = operationInProgress(holder.path);
  if (open !== null) {
    const applying = open.marker === 'rebase-apply' && fs.existsSync(path.join(gitDirOf(holder.path), 'rebase-apply', 'applying'));
    const [operation, abort] = applying ? ['git am', 'am --abort'] : [open.operation, ABORTS[/** @type {keyof typeof ABORTS} */ (open.marker)]];
    return `${at}, where ${operation} is in progress, so nothing moved — finish it, or end it with \`${there} ${abort}\`, and land again`;
  }
  const dirt = dirtyEntries(holder.path).filter((entry) => entry.status !== '??').map((entry) => entry.path);
  if (dirt.length > 0) return `${at}, with changes not committed: ${dirt.join(', ')}, so nothing moved — commit them, or set them aside with \`${there} stash\`, and land again`;
  if (move === undefined) return null;
  if (!isAncestor(root, move.from, move.to)) {
    return `${at}, and the landing would move it to a commit it does not lead to, so nothing moved — check out another branch there, as \`${there} switch --detach\` does, and land again`;
  }
  const files = inTheWay(holder.path, move.from, move.to);
  if (files.length > 0) return `${at}, where files not tracked are in the way: ${files.join(', ')}, so nothing moved — move them out of the way and land again`;
  return null;
}

/**
 * Move a branch from `from` to `to` — `from` null makes it — by its ref
 * alone where no worktree holds it, or by a fast-forward in the one that has
 * it checked out, once nothing stops it there (`checkoutBlock`).
 * @param {string} root @param {string} branch @param {string|null} from @param {string} to
 */
function moveBranch(root, branch, from, to) {
  const block = from === null ? null : checkoutBlock(root, branch, { from, to });
  if (block !== null) throw new Error(`land: ${block}`);
  const holder = holderOf(root, branch);
  if (holder === undefined) git(root, ['update-ref', '-m', `land: ${branch}`, `${HEADS}${branch}`, to, from ?? '']);
  else git(holder.path, ['merge', '--ff-only', '--no-overwrite-ignore', '-q', to]);
}

/** The branch the remote names its HEAD, or null. @param {string} root @param {string|null} remote @returns {string|null} */
function remoteHead(root, remote) {
  if (remote === null) return null;
  const prefix = `refs/remotes/${remote}/`;
  const ref = tryGit(root, ['symbolic-ref', '-q', `${prefix}HEAD`])?.trim() ?? '';
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : null;
}

/**
 * The default branch everything lands on (see the header). Refuses where
 * nothing names one, where it is the state branch, and where the repository
 * has no local branch of its name.
 * @param {string} root @param {string|null} remote the project's
 * @returns {string}
 */
function defaultBranch(root, remote) {
  const local = branches(root);
  const configured = tryGit(root, ['config', '--get', 'init.defaultBranch'])?.trim() ?? '';
  const named = remoteHead(root, remote) ?? [configured, ...TRUNKS].find((branch) => local.has(branch));
  if (named === undefined) {
    throw new Error(
      'land: no default branch to land on — the remote names none, and the repository has no branch init.defaultBranch names, nor main or master; '
      + 'name it with `git config init.defaultBranch <branch>` in the project',
    );
  }
  if (named === STATE_BRANCH) {
    throw new Error(`land: the default branch reads as ${STATE_BRANCH}, the workflows' state branch, which nothing lands on — name the project's own with \`git config init.defaultBranch <branch>\``);
  }
  if (!local.has(named)) {
    throw new Error(`land: the default branch is ${named}, and the repository has no local branch of that name — make one with \`git branch ${named} ${remote}/${named}\``);
  }
  return named;
}

module.exports = {
  short, branches, branchesHeldBy, refsUnder, updateRefs, isAncestor, treesOf, firstParentLine, messagesPast, messageOf, commitWithTree, treesPast,
  changeOf, commitTree, Conflict, replay, quoted, keepCommand, moveCommand, rebaseCommand, rebaseBlock, checkoutBlock, moveBranch, defaultBranch,
};
