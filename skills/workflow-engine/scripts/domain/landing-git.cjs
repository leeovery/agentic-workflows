'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the code-side git a landing runs, for every landing driver.
// What lands is code, so this is the person's own git, with their config,
// identity, signing and hooks (kernel/git.cjs), never the state's isolated
// runner — but for the settings that change what a command makes of refs
// and commits, or what a read prints that the landing parses: each pinned
// to git's own default on every call (`PINNED`), the options a fast-forward
// takes from the branch's own config, its strategy and a signature check
// besides; and on every rebase a remedy prints, the replay's merge settings
// (`MERGE_PINS`), its backend and strategy, and every other branch left
// where it is.
//
// - A push or a fetch names its refspec, the branch to the branch of its
//   name, and takes nothing with it — no tag, no signature, no nested
//   repository — so no `push.*` or `fetch.*` setting changes what goes
//   where; it never prompts, and is held to the state's time limits
//   (state-worktree.cjs).
// - The default branch: the one the project's remote names its HEAD; else
//   the first the repository has of the one `init.defaultBranch` names,
//   `main` and `master`. Never the branch a checkout happens to be on, and
//   never the state branch (4.9.4).
// - A change is read from the project's folder alone, named from it — a
//   project inside a larger repository reads only its own folder (7.2.17) —
//   but for what a caller asks of a folder at the repository's top.
// - A commit is made with no checkout: a tree committed onto a parent, or a
//   commit replayed onto another, which stops on a conflict; signed where
//   the person's config signs every commit, as `git commit` signs it. A
//   commit git cannot make, a key it cannot sign with among them, is refused
//   in git's words, naming the commit, and nothing moves.
// - A branch moves by its ref alone, so no checkout moves — but for a branch
//   a worktree has checked out, which moves only by a fast-forward there,
//   its tracked files clean, nothing at a path the move adds, ignored or
//   not, and in the middle of no operation. A submodule's own checkout is
//   its repository's: the move leaves it where it is, and it is no dirt of
//   the parent's. A rebase stopped in a worktree leaves it detached, yet
//   holds the branch it rebases and those it updates, so no such branch
//   moves. Otherwise the move stops, saying what is in the way and the way
//   on.
// - No remedy changes the files of any worktree but one it makes itself.
//   Before it moves or rewrites a branch, it keeps the branch as it stands
//   on a `.kept-` branch and frees it: a worktree an earlier remedy left
//   with it out is removed, and the worktree that has it out, the person's
//   own checkout among them, is detached at its own commit, which changes
//   no file — switching back is the person's — or, its folder missing, is
//   removed, and no other worktree with it. The branch then moves by
//   `git branch -f`, or is rebased in a worktree the remedy makes under the
//   repository's `leeway/` folder and removes after. A rebase stopped there
//   stops every verb until it is settled or ended. Every path and word a
//   remedy names is quoted for the shell, and what the person wrote that a
//   refusal names — a subject, a title, a path — never opens a command.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { git: personGit, tryGit: personTryGit, operationInProgress, dirtyEntries, GitError, READ_BUDGET_BYTES } = require('../kernel/git.cjs');
const { STATE_BRANCH, NETWORK_ENV, PUSH_TIMEOUT_MS, FETCH_TIMEOUT_MS } = require('./state-worktree.cjs');
const names = require('./landing-names.cjs');

/**
 * A worktree of the repository: where it is, the branch it has checked out,
 * if any, the branches a rebase stopped there is rewriting, whether a remedy
 * made it, and whether it is locked.
 * @typedef {{path: string, branch: string|null, rebasing: string[], scratch: boolean, locked: boolean}} Worktree
 */

/** The settings a replay merges by, at git's own defaults, each against what the person's could make of it; a printed rebase carries them too. */
const MERGE_PINS = [
  'merge.renames=true', // a replay stopping on a rename it never looked for,
  'merge.renameLimit=7000', // or on renames past a lower limit
  'merge.directoryRenames=conflict', // a file moved, or left behind, without a word where its folder moved
  'merge.renormalize=false', // a replay landing where git's own merge stops on line endings alone
  'merge.default=text', // a replay landing where the task and the default branch changed one line, both lines kept
];

/** Every call's settings, at git's own defaults, each against what the person's could make of it. */
const PINNED = [
  'log.showSignature=false', // a signed commit's check printed ahead of the format a read parses
  'i18n.logOutputEncoding=UTF-8', // a message read re-encoded, and replayed so
  'i18n.commitEncoding=UTF-8', // a replayed message labelled another encoding
  ...MERGE_PINS,
].flatMap((setting) => ['-c', setting]);

/** The landing's git: the person's, its settings pinned. @param {string} cwd @param {string[]} args @param {string} [input] */
const git = (cwd, args, input) => personGit(cwd, [...PINNED, ...args], undefined, input);

/** The landing's git over the network, as the state's is held: no prompt, and a time limit. @param {string} cwd @param {string[]} args @param {number} timeoutMs */
const networkGit = (cwd, args, timeoutMs) => personGit(cwd, [...PINNED, ...args], NETWORK_ENV, undefined, timeoutMs);

/** The landing's git, null where it fails. @param {string} cwd @param {string[]} args */
const tryGit = (cwd, args) => personTryGit(cwd, [...PINNED, ...args]);

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

/**
 * Whether any of the local `branches` holds a commit none of `others` does.
 * @param {string} root @param {string[]} branches @param {string[]} others
 * @returns {boolean}
 */
function holdsBeyond(root, branches, others) {
  const refs = (/** @type {string[]} */ names) => names.map((name) => `${HEADS}${name}`);
  return git(root, ['rev-list', '-1', ...refs(branches), '--not', ...refs(others)]).trim() !== '';
}

/** Whether `ancestor` is `commit` or one it descends from. @param {string} root @param {string} ancestor @param {string} commit @returns {boolean} */
function isAncestor(root, ancestor, commit) {
  return tryGit(root, ['merge-base', '--is-ancestor', ancestor, commit]) !== null;
}

/** The best common ancestor of two commits. @param {string} root @param {string} a @param {string} b @returns {string} */
function mergeBase(root, a, b) {
  return git(root, ['merge-base', a, b]).trim();
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
  if (lines.length > 0) git(root, ['update-ref', '--stdin'], `${lines.join('\n')}\n`);
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

/** The folder the code root is of its repository, from the repository's top: `''` at the top, else ending in `/`. @param {string} root */
function prefixOf(root) {
  return git(root, ['rev-parse', '--show-prefix']).trim();
}

/**
 * The commit each of `commits` points each submodule of `paths` at, null
 * where it holds no submodule there; the paths from the repository's top.
 * @param {string} root @param {string[]} commits @param {string[]} paths
 * @returns {Map<string, string|null>[]} by path, in `commits`' order
 */
function pointersAt(root, commits, paths) {
  const asked = commits.flatMap((commit) => paths.map((at) => `${commit}:${at}`));
  const answers = git(root, ['cat-file', '--batch-check=%(objectname) %(objecttype)'], `${asked.join('\n')}\n`).split('\n');
  return commits.map((_, i) => new Map(paths.map((at, j) => {
    const [sha, type] = answers[i * paths.length + j].split(' ');
    return [at, type === 'submodule' ? sha : null];
  })));
}

/**
 * A tree's own, or a commit's, with each submodule of `pointers` pointed at
 * its commit — or taken out, where that is null — the paths from the
 * repository's top: built in an index of its own, so no checkout's index is
 * touched.
 * @param {string} root @param {string} treeish @param {Map<string, string|null>} pointers
 * @returns {string} the tree
 */
function treeWithPointers(root, treeish, pointers) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-pointers-'));
  const env = { GIT_INDEX_FILE: path.join(folder, 'index') };
  try {
    personGit(root, [...PINNED, 'read-tree', treeish], env);
    const none = '0'.repeat(git(root, ['rev-parse', treeish]).trim().length);
    const entries = [...pointers].map(([at, sha]) => (sha === null ? `0 ${none}\t${at}\n` : `160000 commit ${sha}\t${at}\n`)).join('');
    personGit(root, [...PINNED, 'update-index', '--index-info'], env, entries);
    return personGit(root, [...PINNED, 'write-tree'], env).trim();
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

/**
 * A commit, standing alone and never signed, of `commit`'s tree with each
 * submodule of `paths` pointed as `like` points it: the base a merge is
 * given so that its side holding `like`'s pointers takes the other side's,
 * and no merge of a submodule's two moves is ever git's to make.
 * @param {string} root @param {string} commit @param {string} like @param {string[]} paths
 * @returns {string}
 */
function pointedLike(root, commit, like, paths) {
  const [pointers] = pointersAt(root, [like], paths);
  return git(root, ['commit-tree', '--no-gpg-sign', treeWithPointers(root, commit, pointers), '-m', 'leeway: a merge base']).trim();
}

/**
 * A submodule whose landings a stack's moves of its pointer are read
 * against: its repository's folder, the unit, and its default branch's tip,
 * read when first needed.
 * @typedef {{root: string, unit: string, tip: () => string}} Landed
 */

/**
 * Each of a stack's own commits' moves of the pointers at `paths`, in the
 * commits' order: where a commit points a submodule other than every parent
 * of it does — so a merge taking one side's pointer moves nothing, and a
 * pointer the stack inherited from below it is no move of its — the
 * submodule's landing of the latest of the commit's tasks it landed, read
 * off its default branch's first-parent line from where `since` points it
 * to its tip, for a submodule of `subs`; else the commit's own pointer. One
 * taken out stays out.
 * @param {string} root @param {{sha: string, parents: string[], tasks: string[]}[]} commits
 * @param {string[]} paths @param {Map<string, Landed>} subs @param {string} since the default branch's tip
 * @returns {Map<string, string|null>[]}
 */
function stackMoves(root, commits, paths, subs, since) {
  if (commits.length === 0 || paths.length === 0) return commits.map(() => new Map());
  const asked = [since, ...commits.flatMap(({ sha, parents }) => [sha, ...parents])];
  const read = new Map(pointersAt(root, asked, paths).map((pointers, i) => [asked[i], pointers]));
  const from = /** @type {Map<string, string|null>} */ (read.get(since));
  /** @type {Map<string, Map<string, string>>} */
  const landings = new Map();
  /** The submodule's landing of the latest of `tasks` it landed, if any. @param {string} at @param {string[]} tasks */
  const landing = (at, tasks) => {
    const sub = subs.get(at);
    const start = from.get(at) ?? null;
    if (sub === undefined || start === null) return undefined;
    if (!landings.has(at)) landings.set(at, names.landingsByTask(sub.unit, firstParentLine(sub.root, start, sub.tip())));
    return [...tasks].reverse().map((task) => landings.get(at)?.get(task)).find((sha) => sha !== undefined);
  };
  return commits.map(({ sha, parents, tasks }) => {
    const own = /** @type {Map<string, string|null>} */ (read.get(sha));
    /** @type {Map<string, string|null>} */
    const moves = new Map();
    for (const at of paths) {
      const pointer = own.get(at) ?? null;
      const before = parents.length === 0 ? [null] : parents.map((parent) => read.get(parent)?.get(at) ?? null);
      if (!before.includes(pointer)) moves.set(at, pointer === null ? null : landing(at, tasks) ?? pointer);
    }
    return moves;
  });
}

/**
 * The commits `head` holds that none of `not` does, oldest first — parents
 * before children — each with its parents; a commit of `not` this
 * repository lacks is passed over.
 * @param {string} root @param {string} head @param {string[]} not
 * @returns {{sha: string, parents: string[]}[]}
 */
function commitsPast(root, head, not) {
  return git(root, ['rev-list', '--ignore-missing', '--reverse', '--topo-order', '--parents', head, '--not', ...not]).split('\n').filter(Boolean).map((line) => {
    const [sha, ...parents] = line.split(' ');
    return { sha, parents };
  });
}

/**
 * The paths a change touches under a folder at the repository's top, in any
 * case of its letters, whichever folder of it the project is, named from
 * that top.
 * @param {string} root @param {string} base @param {string} tip @param {string} folder
 * @returns {string[]}
 */
function changedAtTop(root, base, tip, folder) {
  return git(root, ['diff', '--name-only', '-z', '--no-renames', '--no-relative', `${base}...${tip}`, '--', `:(top,icase)${folder}`]).split('\0').filter(Boolean);
}

/** Whether the person's config signs every commit, as `git commit` reads it. @param {string} root @returns {boolean} */
function signs(root) {
  return git(root, ['config', '--type=bool', '--default=false', '--get', 'commit.gpgSign']).trim() === 'true';
}

/**
 * A tree committed onto its parents under a message, signed where `signed`:
 * `what` the commit is, as a refusal of one git cannot make names it, and
 * `then` the way on once what git names is cleared.
 * @param {string} root @param {{tree: string, parent: string|string[], message: string, signed: boolean}} commit @param {string} what @param {string} then
 * @returns {string}
 */
function commitTree(root, { tree, parent, message, signed }, what, then) {
  const parents = (Array.isArray(parent) ? parent : [parent]).flatMap((sha) => ['-p', sha]);
  try {
    return git(root, ['commit-tree', ...(signed ? ['-S'] : []), tree, ...parents, '-F', '-'], message).trim();
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    throw new Error(`land: ${what} could not be committed (${plain(err.message)}), so nothing moved — clear what git names and ${then}`);
  }
}

/** A change that conflicts where it is merged: its message names it, and where. */
class Conflict extends Error {}

/**
 * The tree `theirs` merged into `ours` makes over `base`, as git's own merge
 * makes it — or the paths it conflicts at.
 * @param {string} root @param {string} base @param {string} ours @param {string} theirs
 * @returns {{tree: string}|{conflicts: string[]}}
 */
function mergeTree(root, base, ours, theirs) {
  const args = [...PINNED, 'merge-tree', '--write-tree', '-z', '--name-only', '--no-messages', `--merge-base=${base}`, ours, theirs];
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: READ_BUDGET_BYTES });
  if (res.status === 1) return { conflicts: res.stdout.split('\0').slice(1).filter(Boolean) };
  if (res.error || res.status !== 0) throw new GitError(`git merge-tree failed: ${(res.error?.message ?? res.stderr).trim()}`);
  return { tree: res.stdout.split('\0')[0] };
}

/**
 * Each submodule's pointer a replay records (`stackMoves`): the paths it
 * decides, from the repository's top, and each commit's moves of them.
 * @typedef {{paths: string[], moves: Map<string, string|null>[]}} Pointers
 */

/**
 * Commits replayed onto `onto`, oldest first, each its own change under its
 * own message: the commit the last replay made, and those whose change was
 * there already, each replayed as a commit that changes nothing — a commit
 * that changes nothing itself is none of them. Where `pointers` decides a
 * submodule's pointer, git never merges it: each commit keeps the pointer
 * of the one it is replayed onto but where it moves it, and then takes its
 * move. Stops on the first change that conflicts, naming it and its paths
 * (`Conflict`), and is refused at the first commit git cannot make
 * (`commitTree`).
 * @template {{sha: string, message: string, name: string}} C
 * @param {string} root @param {C[]} commits @param {string} onto @param {string} ontoName @param {Pointers} [pointers]
 * @returns {{tip: string, empty: C[]}}
 */
function replay(root, commits, onto, ontoName, pointers) {
  let at = onto;
  let [atTree] = treesOf(root, [onto]);
  const own = treesOf(root, commits.flatMap(({ sha }) => [`${sha}^`, sha]));
  const signed = signs(root);
  /** @type {C[]} */
  const empty = [];
  commits.forEach((commit, i) => {
    const base = pointers === undefined ? `${commit.sha}^` : pointedLike(root, `${commit.sha}^`, commit.sha, pointers.paths);
    const merged = mergeTree(root, base, at, commit.sha);
    if ('conflicts' in merged) throw new Conflict(`land: ${commit.name} conflicts with ${ontoName} at ${merged.conflicts.map(plain).join(', ')}`);
    const moves = pointers?.moves[i] ?? new Map();
    const tree = moves.size === 0 ? merged.tree : treeWithPointers(root, merged.tree, moves);
    if (tree === atTree && own[2 * i] !== own[2 * i + 1]) empty.push(commit);
    at = commitTree(root, { tree, parent: at, message: commit.message, signed }, `${commit.name}'s replay onto ${ontoName}`, 'land again');
    atTree = tree;
  });
  return { tip: at, empty };
}

/**
 * Whether the commits `to` holds past `from`, merges aside, change nothing
 * between the first's parent and the last.
 * @param {string} root @param {string} from @param {string} to
 * @returns {boolean}
 */
function ownChangeEmpty(root, from, to) {
  const own = git(root, ['rev-list', '--no-merges', `${from}..${to}`]).split('\n').filter(Boolean);
  if (own.length === 0) return true;
  const [before, after] = treesOf(root, [`${own[own.length - 1]}^`, own[0]]);
  return before === after;
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
 * The folder of a repository's main checkout, from where git's listing
 * names it: a submodule's is named by its git directory, which holds no
 * `.git`, and is asked of that directory.
 * @param {string} listed
 * @returns {string}
 */
function mainCheckout(listed) {
  if (!fs.existsSync(listed) || fs.existsSync(path.join(listed, '.git'))) return listed;
  return tryGit(listed, ['rev-parse', '--show-toplevel'])?.trim() || listed;
}

/**
 * The repository's worktrees, the main checkout first, each with the branch
 * it has checked out and those a rebase stopped there is rewriting — which
 * leaves the worktree detached, though the rebase holds them.
 * @param {string} root @param {string} [made] where a remedy makes its worktrees
 * @returns {Worktree[]}
 */
function worktrees(root, made = scratchRoot(root)) {
  return git(root, ['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map((block, i) => {
    const lines = block.split('\n');
    const listed = lines[0].slice('worktree '.length);
    const tree = i === 0 ? mainCheckout(listed) : listed;
    const branch = lines.find((line) => line.startsWith(`branch ${HEADS}`));
    return {
      path: tree,
      branch: branch === undefined ? null : branch.slice(`branch ${HEADS}`.length),
      rebasing: lines.includes('detached') && fs.existsSync(tree) ? rebasing(gitDirOf(tree)) : [],
      scratch: samePlace(path.dirname(tree), made),
      locked: lines.some((line) => line === 'locked' || line.startsWith('locked ')),
    };
  });
}

/** Where a remedy makes the worktrees it rebases in: `leeway/` in the repository's git directory. @param {string} root */
function scratchRoot(root) {
  return path.join(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim(), 'leeway');
}

/** The worktree a remedy makes to rebase a branch, where it makes them. @param {string} made @param {string} branch */
function scratchTree(made, branch) {
  return path.join(made, branch.replace(/\//g, '-'));
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

/** What the person wrote, as a refusal names it: each backquote a quote, so no command opens in it. @param {string} text */
function plain(text) {
  return text.replace(/`/g, "'");
}

/** A word as the shell takes it whole: bare where nothing in it is special, else single-quoted. @param {string} word */
function quoted(word) {
  return /^[\w@%+=:,./^-]+$/.test(word) ? word : `'${word.replace(/'/g, "'\\''")}'`;
}

/**
 * Whether a worktree is the one the code root is in — the person's own
 * checkout, the project a folder of it or not.
 * @param {string} root @param {string} tree
 */
function ownCheckout(root, tree) {
  return samePlace(git(root, ['rev-parse', '--show-toplevel']).trim(), tree);
}

/** Git as a remedy runs it in a worktree: plainly in the person's own checkout, by `-C` elsewhere. @param {string} root @param {string} tree */
function gitIn(root, tree) {
  return ownCheckout(root, tree) ? 'git' : `git -C ${quoted(tree)}`;
}

/** The worktree that has a branch checked out, if any — never one a remedy made. @param {string} root @param {string} branch @param {Worktree[]} [trees] */
function holderOf(root, branch, trees = worktrees(root)) {
  return trees.find((tree) => !tree.scratch && tree.branch === branch);
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
 * A cherry-pick or revert of several commits stopped in a worktree with
 * nothing but its sequence to say so — its stop committed by hand — as a
 * refusal names it, and the command that ends it there, keeping what it
 * made; or null where none is.
 * @param {string} root @param {string} tree
 * @returns {{operation: string, end: string}|null}
 */
function sequenceAt(root, tree) {
  const sequence = path.join(gitDirOf(tree), 'sequencer');
  if (!fs.existsSync(sequence)) return null;
  const todo = path.join(sequence, 'todo');
  const verb = fs.existsSync(todo) && /^revert\b/.test(fs.readFileSync(todo, 'utf8')) ? 'revert' : 'cherry-pick';
  return { operation: `a ${verb}`, end: `\`${gitIn(root, tree)} ${verb} --quit\`` };
}

/**
 * The operation stopped in a worktree, as a refusal names it, and the
 * command that ends it there, or null where none is.
 * @param {string} root @param {string} tree
 * @returns {{operation: string, end: string}|null}
 */
function stoppedAt(root, tree) {
  const open = operationInProgress(tree);
  if (open === null) return sequenceAt(root, tree);
  const applying = open.marker === 'rebase-apply' && fs.existsSync(path.join(gitDirOf(tree), 'rebase-apply', 'applying'));
  const [operation, abort] = applying ? ['git am', 'am --abort'] : [open.operation, ABORTS[/** @type {keyof typeof ABORTS} */ (open.marker)]];
  return { operation, end: `\`${gitIn(root, tree)} ${abort}\`` };
}

/**
 * How a worktree that has a branch out lets it go without a file changing:
 * detached at its own commit, the switch back the person's.
 * @param {string} root @param {Worktree} holder @param {string} branch @param {string} tip the branch's commit
 * @returns {{step: string, note: string}}
 */
function detaching(root, holder, branch, tip) {
  const who = ownCheckout(root, holder.path) ? 'your checkout' : `the worktree at ${holder.path}`;
  return {
    step: `detach ${who} from ${branch} with \`${gitIn(root, holder.path)} switch --detach\`, which leaves it at ${short(tip)} with its edits`,
    note: `switching ${who} back to ${branch} is yours, when you're ready`,
  };
}

/**
 * The way a worktree an earlier remedy left is cleared: unlocked where it is
 * locked, and removed — which git does where its folder is gone too.
 * @param {Worktree} tree
 */
function clearing(tree) {
  return tree.locked
    ? `unlock the worktree an earlier remedy left with \`git worktree unlock ${quoted(tree.path)}\`, then remove it with ${removing(tree)}`
    : `remove the worktree an earlier remedy left with ${removing(tree)}`;
}

/** The command that removes a worktree, as a remedy names it — its folder there or missing. @param {Worktree} tree */
function removing(tree) {
  return `\`git worktree remove ${quoted(tree.path)}\``;
}

/**
 * How a remedy keeps a branch as it stands: on `{branch}.kept-{sha}`, a name
 * no task's or phase's branch can take — reused where it is at the commit
 * already, and made fresh where it holds another, so a keep never fails and
 * never moves a branch.
 * @param {string} root @param {string} branch @param {string} commit
 * @returns {{kept: string, step: string}}
 */
function keepStep(root, branch, commit) {
  const local = branches(root);
  const base = `${branch}.kept-${short(commit)}`;
  let kept = base;
  for (let n = 2; local.has(kept) && local.get(kept) !== commit; n += 1) kept = `${base}-${n}`;
  return {
    kept,
    step: local.has(kept) ? `${branch} as it stands is kept on ${kept} already` : `keep ${branch} as it stands with \`git branch ${quoted(kept)} ${short(commit)}\``,
  };
}

/**
 * A rebase stopped in a worktree that is rewriting a branch, as every
 * refusal words it — the fact, and the way on, finished or ended there — or
 * null where none is.
 * @param {string} root @param {string} branch @param {Worktree[]} trees
 * @returns {{fact: string, way: string}|null}
 */
function rebasingAt(root, branch, trees) {
  const rebased = trees.find((tree) => tree.rebasing.includes(branch));
  if (rebased === undefined) return null;
  return { fact: `${branch} is being rebased at ${rebased.path}`, way: `finish that rebase, or end it with \`${gitIn(root, rebased.path)} rebase --abort\`` };
}

/**
 * What holds a branch so no remedy can free it — a rebase of it, or another
 * operation, stopped where it is out — for the person to finish or end
 * first; or null where nothing does.
 * @param {string} root @param {string} branch @param {Worktree[]} trees
 * @returns {string|null}
 */
function heldFirst(root, branch, trees) {
  const rebased = rebasingAt(root, branch, trees);
  if (rebased !== null) return `${rebased.fact}, so first ${rebased.way}`;
  const holder = holderOf(root, branch, trees);
  const stopped = holder === undefined || !fs.existsSync(holder.path) ? null : stoppedAt(root, holder.path);
  return holder === undefined || stopped === null ? null : `first finish ${stopped.operation} at ${holder.path}, where ${branch} is out, or end it with ${stopped.end}`;
}

/**
 * A remedy's way on for a branch it moves or rewrites (see the header): an
 * operation that holds the branch, ended first and alone; else a worktree an
 * earlier remedy left with it out, or at its path, cleared, the branch kept
 * as it stands, the worktree that has it out removed where its folder is
 * missing — that worktree alone — or else detached, and the steps `act`
 * gives for the worktree a rebase is made in, told whether a folder no
 * worktree holds is left at its path. `note` says what the keep leaves,
 * given the branch it keeps on.
 * @param {string} root @param {string} branch
 * @param {(scratch: string, folderLeft: boolean) => string[]} act
 * @param {{then?: string, note?: (kept: string) => string}} [opts]
 * @returns {string} the steps, and what follows them
 */
function remedy(root, branch, act, { then = 'land again', note } = {}) {
  const made = scratchRoot(root);
  const trees = worktrees(root, made);
  const first = heldFirst(root, branch, trees);
  if (first !== null) return `${first}, and ${then}`;
  const scratch = scratchTree(made, branch);
  const tip = /** @type {string} */ (branches(root).get(branch));
  const { kept, step } = keepStep(root, branch, tip);
  const steps = [...trees.filter((tree) => tree.scratch && (tree.branch === branch || samePlace(tree.path, scratch))).map(clearing), step];
  const notes = note === undefined ? [] : [note(kept)];
  const holder = holderOf(root, branch, trees);
  if (holder !== undefined && !fs.existsSync(holder.path)) steps.push(`remove the worktree that has it out, whose folder ${holder.path} is missing, with ${removing(holder)}`);
  else if (holder !== undefined) {
    const freed = detaching(root, holder, branch, tip);
    steps.push(freed.step);
    notes.push(freed.note);
  }
  steps.push(...act(scratch, fs.existsSync(scratch) && !trees.some((tree) => samePlace(tree.path, scratch))));
  return `${steps.join(', then ')}, and ${then}${notes.map((line) => `; ${line}`).join('')}`;
}

/**
 * A remedy's step moving a branch, once free, to a commit.
 * @param {string} branch @param {string} to @param {string} how what the move does
 * @returns {(scratch: string, folderLeft: boolean) => string[]}
 */
function moveTo(branch, to, how) {
  return () => [`${how} with \`git branch -f ${quoted(branch)} ${quoted(to)}\``];
}

/**
 * A remedy's steps rebasing a branch, once free, in a worktree made for it —
 * a folder left at its path cleared first — and removed after, settling each
 * conflict there as the rebase stops. The rebase is the merge backend's,
 * which keeps a landing that changes nothing, and moves no branch but its
 * own.
 * @param {string} branch @param {string} args the rebase's own, quoted @param {string} how what the rebase does
 * @returns {(scratch: string, folderLeft: boolean) => string[]}
 */
function rewrite(branch, args, how) {
  return (scratch, folderLeft) => {
    const there = rebasingIn(scratch);
    return [
      ...(folderLeft ? [`clear the folder left at ${scratch}, which no worktree holds, with \`rm -rf ${quoted(scratch)}\``] : []),
      `${how} in a worktree of its own with \`git worktree add ${quoted(scratch)} ${quoted(branch)}\``,
      `\`${there} rebase --merge --no-update-refs -s ort ${args}\`, settling each conflict at ${scratch} as it stops and going on with \`${there} rebase --continue\``,
      `\`git worktree remove ${quoted(scratch)}\``,
    ];
  };
}

/**
 * Git as a printed rebase runs it in the worktree made for it, merging by
 * the replay's settings (`MERGE_PINS`) — each picked commit, and each the
 * rebase goes on to once a conflict is settled.
 * @param {string} scratch
 */
function rebasingIn(scratch) {
  return `git -C ${quoted(scratch)} ${MERGE_PINS.map((setting) => `-c ${setting}`).join(' ')}`;
}

/**
 * What a rebase stopped in a worktree a remedy made says, and the way on —
 * settled or ended there, and the worktree removed — or null where none is.
 * Every verb asks before anything else.
 * @param {string} root
 * @returns {string|null}
 */
function scratchBlock(root) {
  const stopped = worktrees(root).find((tree) => tree.scratch && tree.rebasing.length > 0);
  if (stopped === undefined) return null;
  return `${stopped.rebasing[0]} is being rebased at ${stopped.path}, a worktree a remedy made, so nothing moved — `
    + `settle each conflict there and go on with \`${rebasingIn(stopped.path)} rebase --continue\`, or end it with \`git -C ${quoted(stopped.path)} rebase --abort\`, `
    + `then remove it with ${removing(stopped)}, and land again`;
}

/**
 * What a rebase stopped in a worktree says of a branch it is rewriting, and
 * how to end it, or null where none is.
 * @param {string} root @param {string} branch @param {Worktree[]} [trees]
 * @returns {string|null}
 */
function rebaseBlock(root, branch, trees = worktrees(root)) {
  const rebased = rebasingAt(root, branch, trees);
  return rebased === null ? null : `${rebased.fact}, so nothing moved — ${rebased.way}, and land again`;
}

/**
 * The tracked changes not committed in a worktree, by path — but for a
 * submodule's own checkout, its commit or its files, which no move there
 * touches (`PINNED`); a pointer staged there is the worktree's own.
 * @param {string} tree
 * @returns {string[]}
 */
function changesAt(tree) {
  const entries = dirtyEntries(tree).filter((entry) => entry.status !== '??');
  const unstaged = entries.filter((entry) => entry.status[0] === ' ').map((entry) => `:(literal)${entry.path}`);
  if (unstaged.length === 0) return entries.map((entry) => entry.path);
  const submodules = new Set(git(tree, ['ls-files', '--stage', '-z', '--', ...unstaged]).split('\0')
    .filter((line) => line.startsWith('160000 ')).map((line) => line.slice(line.indexOf('\t') + 1)));
  return entries.filter((entry) => !(entry.status[0] === ' ' && submodules.has(entry.path))).map((entry) => entry.path);
}

/**
 * What stops a branch a worktree holds from moving there, and the way on —
 * a rebase rewriting it, a worktree an earlier remedy left with it out, the
 * worktree that has it out with its folder missing, an operation in
 * progress, tracked changes not committed, and, for a move given, one that
 * is no fast-forward or would overwrite a file — or null where nothing does,
 * or no worktree holds it.
 * @param {string} root @param {string} branch
 * @param {{from: string, to: string}} [move] @param {Worktree[]} [trees]
 * @returns {string|null}
 */
function checkoutBlock(root, branch, move, trees = worktrees(root)) {
  const rebased = rebaseBlock(root, branch, trees);
  if (rebased !== null) return rebased;
  const left = trees.find((tree) => tree.scratch && tree.branch === branch);
  if (left !== undefined) return `${branch} is checked out at ${left.path}, so nothing moved — ${clearing(left)} and land again`;
  const holder = holderOf(root, branch, trees);
  if (holder === undefined) return null;
  const at = `${branch} is checked out at ${holder.path}`;
  if (!fs.existsSync(holder.path)) return `${at}, whose folder is missing, so nothing moved — remove that worktree with ${removing(holder)} and land again`;
  const stopped = stoppedAt(root, holder.path);
  if (stopped !== null) return `${at}, where ${stopped.operation} is in progress, so nothing moved — finish it, or end it with ${stopped.end}, and land again`;
  const dirt = changesAt(holder.path).map(plain);
  if (dirt.length > 0) {
    const freed = detaching(root, holder, branch, git(root, ['rev-parse', `${HEADS}${branch}`]).trim());
    return `${at}, with changes not committed: ${dirt.join(', ')}, so nothing moved — commit them, or ${freed.step}, and land again; ${freed.note}`;
  }
  if (move === undefined) return null;
  if (!isAncestor(root, move.from, move.to)) {
    return `${at}, and the landing would move it to a commit it does not lead to, so nothing moved — check out another branch there, as \`${gitIn(root, holder.path)} switch --detach\` does, and land again`;
  }
  const files = inTheWay(holder.path, move.from, move.to);
  if (files.length > 0) return `${at}, where files not tracked are in the way: ${files.map(plain).join(', ')}, so nothing moved — move them out of the way and land again`;
  return null;
}

/**
 * Move a branch from `from` to `to` — `from` null makes it — by its ref
 * alone where no worktree holds it, or by a fast-forward in the one that has
 * it checked out, once nothing stops it there (`checkoutBlock`).
 * @param {string} root @param {string} branch @param {string|null} from @param {string} to
 */
function moveBranch(root, branch, from, to) {
  const trees = worktrees(root);
  const block = from === null ? null : checkoutBlock(root, branch, { from, to }, trees);
  if (block !== null) throw new Error(`land: ${block}`);
  const holder = holderOf(root, branch, trees);
  if (holder === undefined) git(root, ['update-ref', '-m', `land: ${branch}`, `${HEADS}${branch}`, to, from ?? '']);
  else git(holder.path, ['-c', `branch.${branch}.mergeOptions=`, 'merge', '-s', 'ort', '--ff-only', '--no-verify-signatures', '--no-overwrite-ignore', '-q', to]);
}

/** The URL a remote fetches from, any `insteadOf` applied. @param {string} root @param {string} remote @returns {string} */
function remoteUrlOf(root, remote) {
  return git(root, ['remote', 'get-url', remote]).trim();
}

/**
 * A branch pushed to the remote under its own name — at its tip here, or at
 * `commit` — as `pushBranches` pushes it.
 * @param {string} root @param {string} remote @param {string} branch @param {string} then @param {string} [commit]
 */
function pushBranch(root, remote, branch, then, commit) {
  pushBranches(root, remote, [{ branch, commit: commit ?? `${HEADS}${branch}` }], then);
}

/**
 * Branches pushed to the remote under their own names, each at its
 * `commit`, all or none: each refspec named, no tag following them, nothing
 * signed, and no nested repository pushed with them, so no `push.*` setting
 * changes what goes where. Refused in git's words, hints aside, where the
 * remote refuses them or cannot be reached, saying what `then` did not
 * happen.
 * @param {string} root @param {string} remote @param {{branch: string, commit: string}[]} pushed @param {string} then
 */
function pushBranches(root, remote, pushed, then) {
  const atomic = pushed.length > 1 ? ['--atomic'] : [];
  try {
    networkGit(root, ['push', '--quiet', '--no-follow-tags', '--no-signed', '--recurse-submodules=no', ...atomic, remote, ...pushed.map(({ branch, commit }) => `${commit}:${HEADS}${branch}`)], PUSH_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    throw new Error(`land: ${pushed.map(({ branch }) => branch).join(', ')} could not be pushed to ${remote} (${gitSaid(err)}), so ${then}`);
  }
}

/** What a failed git call said, on one line, its hints aside. @param {GitError} err */
function gitSaid(err) {
  return plain(err.message.split('\n').map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('hint:')).join(' '));
}

/**
 * A remote's branch fetched to its remote-tracking ref by its refspec,
 * nothing else with it, and that ref's commit; where it cannot be, what git
 * said, on one line.
 * @param {string} root @param {string} remote @param {string} branch
 * @returns {{commit: string}|{failed: string}}
 */
function fetchBranch(root, remote, branch) {
  const tracking = `refs/remotes/${remote}/${branch}`;
  try {
    networkGit(root, ['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', '--recurse-submodules=no', remote, `+${HEADS}${branch}:${tracking}`], FETCH_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { failed: gitSaid(err) };
  }
  return { commit: git(root, ['rev-parse', tracking]).trim() };
}

/**
 * The refusal of a task whose branch holds nothing past the chain's tip,
 * which no driver lands.
 * @param {string} shown @param {string} branch @param {string} tip the chain tip's name
 */
function nothingPast(shown, branch, tip) {
  return `land: task ${shown}'s branch ${branch} changes nothing past ${tip} — commit its change there first`;
}

/** The branch the remote names its HEAD, or null. @param {string} root @param {string|null} remote @returns {string|null} */
function remoteHead(root, remote) {
  if (remote === null) return null;
  const prefix = `refs/remotes/${remote}/`;
  const ref = tryGit(root, ['symbolic-ref', '-q', `${prefix}HEAD`])?.trim() ?? '';
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : null;
}

/**
 * The default branch everything lands on in a repository (see the header) —
 * the project's own, or one `nested` in its folder. Refuses where nothing
 * names one, where it is the state branch, and where the repository has no
 * local branch of its name.
 * @param {string} root @param {string|null} remote the repository's @param {boolean} [nested]
 * @returns {string}
 */
function defaultBranch(root, remote, nested = false) {
  const local = branches(root);
  const configured = tryGit(root, ['config', '--get', 'init.defaultBranch'])?.trim() ?? '';
  const named = remoteHead(root, remote) ?? [configured, ...TRUNKS].find((branch) => local.has(branch));
  if (named === undefined) {
    throw new Error(
      'land: no default branch to land on — the remote names none, and the repository has no branch init.defaultBranch names, nor main or master; '
      + `name it with \`git config init.defaultBranch <branch>\` ${nested ? 'there' : 'in the project'}`,
    );
  }
  if (named === STATE_BRANCH) {
    throw new Error(`land: the default branch reads as ${STATE_BRANCH}, the workflows' state branch, which nothing lands on — name ${nested ? 'its' : 'the project\'s'} own with \`git config init.defaultBranch <branch>\``);
  }
  if (!local.has(named)) {
    throw new Error(`land: the default branch is ${named}, and the repository has no local branch of that name — make one with \`git branch ${named} ${remote}/${named}\``);
  }
  return named;
}

module.exports = {
  short, branches, branchesHeldBy, holdsBeyond, refsUnder, updateRefs, isAncestor, mergeBase, treesOf, firstParentLine, messagesPast, messageOf, commitWithTree, treesPast,
  prefixOf, pointersAt, treeWithPointers, pointedLike, stackMoves, commitsPast, changedAtTop, signs, commitTree, Conflict, mergeTree, replay, ownChangeEmpty, plain, quoted, remedy, moveTo, rewrite, scratchBlock, rebaseBlock, checkoutBlock, moveBranch,
  defaultBranch, remoteUrlOf, pushBranch, pushBranches, gitSaid, fetchBranch, nothingPast,
};
