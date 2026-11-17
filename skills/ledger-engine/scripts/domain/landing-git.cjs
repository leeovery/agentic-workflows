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
//   name, and takes nothing with it — no tag, no signature — so no
//   `push.*` or `fetch.*` setting changes what goes where; it never
//   prompts, and is held to the state's time limits (state-worktree.cjs).
// - The default branch: the one the project's remote names its HEAD; else
//   the first the repository has of the one `init.defaultBranch` names,
//   `main` and `master`. Never the branch a checkout happens to be on, and
//   never the state branch (4.9.4). A unit's landing branch (7.2.34) is its
//   own branch where its manifest records one — the project's own
//   repository always, a nested one where it holds that branch, here or as
//   last fetched (7.2.40) — else the default branch (`landingBranch`); a
//   read takes it as last fetched, the branch here, else the remote's as
//   fetched (`landingRev`). A repository of the project is read for each
//   once for each read of the project's repositories: nothing a call does
//   names another, but the unit's branch it makes there (`landingMade`).
// - A repository holds a task's branch where it names it: the project's own
//   always, a nested one only where the branch holds a commit no branch
//   there but the unit's holds (7.2.17) — the rule the landing walks by and
//   a reviewer's brief draws its ranges by.
// - A change is read from the project's folder alone, named from it — a
//   project inside a larger repository reads only its own folder (7.2.17) —
//   but for what a caller asks of a folder at the repository's top. A branch
//   holds a commit's change where merging the commit there changes nothing
//   (`holdsChange`), however the change got there, meeting no conflict; and
//   a task's commits through the door are found by their stamp on its line
//   where its work branch stands — the branch's tip's first-parent line, a
//   merge's other parents never on it (`taskLine`), else what its tip holds
//   — else on any ref or reflog, so a branch deleted loses none, a branch a
//   remedy kept never among them (`lastStamped`), as a branch holding one is
//   told by its history (`stampsUnit`). What a read asks of many commits at
//   once — whether each of many holds another's change, or a copy of it — is
//   read in one call however many are asked (`holdChanges`, `belowOwn`,
//   `copiesOf`).
// - A commit is made with no checkout: a tree committed onto a parent, or a
//   commit replayed onto another, which stops on a conflict; signed where
//   the person's config signs every commit, as `git commit` signs it. A
//   commit git cannot make, a key it cannot sign with among them, is refused
//   in git's words, naming the commit, and nothing moves.
// - A branch moves by its ref alone, so no checkout moves — but for a branch
//   a worktree has checked out, which moves only by a fast-forward there,
//   its tracked files clean where the move changes them — changes to any
//   other carried across, as the fast-forward carries them — nothing at a
//   path the move adds, ignored or not, and in the middle of no operation. A
//   rebase stopped in a worktree leaves it detached, yet holds the branch it
//   rebases and those it updates, so no such branch moves. Otherwise the
//   move stops, saying what is in the way and the way on.
// - No remedy changes the files of any worktree but one it makes itself.
//   Before it moves or rewrites a branch, it keeps the branch as it stands
//   on a `.kept-` branch and frees it: a worktree an earlier remedy left
//   with it out is removed, and the worktree that has it out, the person's
//   own checkout among them, is detached at its own commit, which changes
//   no file — switching back is the person's — or, its folder missing, is
//   removed, and no other worktree with it. The branch then moves by
//   `git branch -f`, or is rebased in a worktree the remedy makes under the
//   repository's `ledger/` folder and removes after. A rebase stopped there
//   stops every verb until it is settled or ended; so does the merge of the
//   default branch into a unit's own branch begun in a worktree there,
//   detached, where the two conflict (unit-branch.cjs, `mergingTree`),
//   until what began it takes it onto that branch. Every path and word a
//   remedy names is quoted for the shell, and what the person wrote that a
//   refusal names — a subject, a title, a path — never opens a command.
// - A task's worktree (task-worktree.cjs) is laid out by the same git: its
//   branch made in place at the worktree's own commit or the commit a fix
//   phase is built on, or switched to, and
//   a worktree of each child repository added on it, none tracking a
//   branch; and each child worktree removed as git removes a clean one.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git: personGit, tryGit: personTryGit, gitRun, operationInProgress, mergeInProgress, dirtyEntries, GitError } = require('../kernel/git.cjs');
const { placeOf, folderUnder } = require('../kernel/repos.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { workUnitManifestPath, readWorkUnitManifest } = require('../kernel/manifest-io.cjs');
const { repoFacts } = require('../kernel/isolated-git.cjs');
const { STATE_BRANCH, NETWORK_ENV, PUSH_TIMEOUT_MS, FETCH_TIMEOUT_MS } = require('./state-worktree.cjs');
const names = require('./landing-names.cjs');
const { taskId } = require('./task-id.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');

/**
 * A worktree of the repository: where it is, the branch it has checked out,
 * if any, the branches a rebase stopped there is rewriting, whether a remedy
 * made it, and whether it is locked.
 * @typedef {{path: string, branch: string|null, rebasing: string[], scratch: boolean, locked: boolean}} Worktree
 */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

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

/**
 * What `read` answers of a repository a landing reads, kept on its context
 * where the context keeps reads — a call that moves nothing between them —
 * so it is read once there; read afresh where it does not.
 * @template T @param {{reads?: Map<string, unknown>}} ctx @param {string} key @param {() => T} read @returns {T}
 */
function readOnce(ctx, key, read) {
  if (ctx.reads === undefined) return read();
  if (!ctx.reads.has(key)) ctx.reads.set(key, read());
  return /** @type {T} */ (ctx.reads.get(key));
}

/**
 * What `read` answers of a repository afresh, once the call has itself
 * moved what it reads, kept on its context as `readOnce` keeps a read for
 * the reads after it.
 * @template T @param {{reads?: Map<string, unknown>}} ctx @param {string} key @param {() => T} read @returns {T}
 */
function readAgain(ctx, key, read) {
  ctx.reads?.delete(key);
  return readOnce(ctx, key, read);
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

/**
 * Whether a nested repository holds work on a branch of the unit's `picks`
 * names: a commit no branch there but the unit's holds — read without its
 * default branch, so a repository the unit never touched is passed over
 * whatever it lacks.
 * @param {string} unit @param {Repo} repo @param {(branch: string) => boolean} picks
 */
function holdsWork(unit, repo, picks) {
  const held = [...branches(repo.path).keys()];
  const picked = held.filter(picks);
  return picked.length > 0 && holdsBeyond(repo.path, picked, held.filter((branch) => !names.isUnitBranch(unit, branch)));
}

/**
 * The commits among `tips` that none of `others` holds. @param {string} root @param {string[]} tips @param {string[]} others
 * @returns {Set<string>}
 */
function tipsBeyond(root, tips, others) {
  return new Set(git(root, ['rev-list', ...tips, '--not', ...others]).split('\n').filter((commit) => tips.includes(commit)));
}

/**
 * The repositories holding each of the unit's task branches `asked`, in the
 * order given: each naming it, a nested one only where the branch holds
 * work there, as `holdsWork` reads it; and whether any names it at all.
 * Each repository's branches, and what they hold beyond its others, are
 * read once however many branches are asked.
 * @param {string} unit @param {Repo[]} repos @param {string[]} asked
 * @returns {{named: boolean, holding: Repo[]}[]}
 */
function holdingBranches(unit, repos, asked) {
  const held = asked.map(() => ({ named: false, holding: /** @type {Repo[]} */ ([]) }));
  for (const repo of repos) {
    const local = branches(repo.path);
    const named = asked.flatMap((branch, at) => (local.has(branch) ? [at] : []));
    if (named.length === 0) continue;
    const tipOf = (/** @type {number} */ at) => /** @type {string} */ (local.get(asked[at]));
    const others = [...local].flatMap(([branch, tip]) => (names.isUnitBranch(unit, branch) ? [] : [tip]));
    const beyond = repo.dir === '' ? null : tipsBeyond(repo.path, named.map(tipOf), others);
    for (const at of named) {
      held[at].named = true;
      if (beyond === null || beyond.has(tipOf(at))) held[at].holding.push(repo);
    }
  }
  return held;
}

/**
 * The repositories holding a task's branch (`holdingBranches`).
 * @param {string} unit @param {Repo[]} repos @param {string} branch
 * @returns {{named: boolean, holding: Repo[]}}
 */
const holdingBranch = (unit, repos, branch) => holdingBranches(unit, repos, [branch])[0];

/** Whether `ancestor` is `commit` or one it descends from. @param {string} root @param {string} ancestor @param {string} commit @returns {boolean} */
function isAncestor(root, ancestor, commit) {
  return tryGit(root, ['merge-base', '--is-ancestor', ancestor, commit]) !== null;
}

/** Whether `commit` is a merge of `other`, a full sha, into its first parent. @param {string} root @param {string} commit @param {string} other @returns {boolean} */
function mergeOf(root, commit, other) {
  return tryGit(root, ['rev-parse', '--verify', '--quiet', `${commit}^2`])?.trim() === other;
}

/**
 * Where among `commits`, each in full, the first stands that every other is
 * an ancestor of — the tip of the one line they make — or -1 where none
 * is; read in one call however many are given.
 * @param {string} root @param {string[]} commits @returns {number}
 */
function latestOf(root, commits) {
  if (commits.length <= 1) return commits.length - 1;
  const independent = git(root, ['merge-base', '--independent', ...commits]).trim().split('\n');
  return independent.length === 1 ? commits.indexOf(independent[0]) : -1;
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
 * Every ref under a prefix, by its name past the prefix, at its commit —
 * where `since` names a time, those whose commit was committed at or after
 * it alone.
 * @param {string} root @param {string} prefix ending in `/` @param {string|null} [since]
 * @returns {Map<string, string>}
 */
function refsUnder(root, prefix, since = null) {
  const from = since === null ? -Infinity : Date.parse(since) / 1000;
  const lines = git(root, ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(committerdate:unix)', prefix]).split('\n').filter(Boolean);
  return new Map(lines.map((line) => line.split('\0')).filter(([, , at]) => Number(at) >= from).map(([ref, sha]) => [ref.slice(prefix.length), sha]));
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
 * The commits of a first-parent line `git log` gives for `range`, newest
 * first, each with its tree and message.
 * @param {string} root @param {string[]} range
 * @returns {{sha: string, tree: string, message: string}[]}
 */
function lineOf(root, range) {
  return git(root, ['log', '--first-parent', '-z', '--format=%H %T%n%B', ...range, '--']).split('\0').filter(Boolean).map((entry) => {
    const nl = entry.indexOf('\n');
    const [sha, tree] = entry.slice(0, nl).split(' ');
    return { sha, tree, message: entry.slice(nl + 1) };
  });
}

/** The commits past `from` on `to`'s first-parent line, newest first (`lineOf`). @param {string} root @param {string} from @param {string} to */
const firstParentLine = (root, from, to) => lineOf(root, [`${from}..${to}`]);

/** The commit `rev` names, with its tree and message (`lineOf`). @param {string} root @param {string} rev */
const commitAt = (root, rev) => lineOf(root, ['--max-count=1', rev])[0];

/** A commit on a first-parent line: its tree, its parents, the time it was committed, in milliseconds, and its message. @typedef {{sha: string, tree: string, parents: string[], committed: number, message: string}} LineCommit */

/**
 * The revision `tip`'s first-parent line, of the commits it holds
 * committed at or after the time `since` names — every one where it names
 * none — oldest first; and, for each of those commits, the one on the line
 * that brought it in: itself, where it is on the line, else the oldest
 * there that holds it. Read in one call however many are asked of.
 * @param {string} root @param {string} tip @param {string|null} since
 * @returns {{line: LineCommit[], broughtIn: Map<string, string>}}
 */
function lineSince(root, tip, since) {
  const bound = since === null ? [] : [`--since=${since}`];
  const logged = git(root, ['log', '-z', '--topo-order', '--format=%H %T %ct %P%n%B', ...bound, tip, '--']).split('\0').filter(Boolean);
  /** @type {Map<string, LineCommit>} */
  const commits = new Map(logged.map((entry) => {
    const end = entry.indexOf('\n');
    const [sha, tree, time, ...parents] = entry.slice(0, end).split(' ');
    return [sha, { sha, tree, parents: parents.filter(Boolean), committed: Number(time) * 1000, message: entry.slice(end + 1) }];
  }));
  /** @type {LineCommit[]} */
  const line = [];
  for (let at = commits.values().next().value; at !== undefined; at = commits.get(at.parents[0] ?? '')) line.push(at);
  line.reverse();
  /** @type {Map<string, string>} */
  const broughtIn = new Map();
  for (const { sha } of line) {
    const reach = [sha];
    for (let next = reach.pop(); next !== undefined; next = reach.pop()) {
      const commit = commits.get(next);
      if (commit === undefined || broughtIn.has(next)) continue;
      broughtIn.set(next, sha);
      reach.push(...commit.parents);
    }
  }
  return { line, broughtIn };
}

/** A commit `commitPaths` lists. @typedef {{sha: string, committed: number, parents: string[], merge: boolean, values: string[], paths: Set<string>}} PathsCommit */

/**
 * The commits `git log` lists for `args`, each with the time it was
 * committed, in milliseconds, its parents, whether it is a merge, the paths
 * it changes — a merge's against its first parent — and the values of the
 * trailer `key` it carries: read in one call however many are listed.
 * @param {string} root @param {string[]} args @param {string} key
 * @returns {PathsCommit[]}
 */
function commitPaths(root, args, key) {
  const read = git(root, ['log', '-z', '--diff-merges=first-parent', '--name-only', `--format=%x01%H%x1f%ct%x1f%P%x1f%(trailers:key=${key},valueonly,separator=%x1f)`, ...args, '--']);
  /** @type {PathsCommit[]} */
  const commits = [];
  for (const field of read.split('\0')) {
    if (field.startsWith('\x01')) {
      const [sha, time, parentsOf, ...values] = field.slice(1).split('\x1f');
      const parents = parentsOf.split(' ').filter(Boolean);
      commits.push({ sha, committed: Number(time) * 1000, parents, merge: parents.length > 1, values: values.map((value) => value.trim()).filter(Boolean), paths: new Set() });
    } else if (field.trim() !== '') commits[commits.length - 1].paths.add(field.replace(/^\n/, ''));
  }
  return commits;
}

/**
 * A task's line: the commits of `byCommit` from its branch's tip, `tip`,
 * down that tip's first-parent line, newest first — a merge's other
 * parents, the default branch merged back or another task's branch, never
 * on it. The one reading of a task's line every read of its own commits
 * takes (R32).
 * @template {{parents: string[]}} C @param {Map<string, C>} byCommit @param {string} tip @returns {C[]}
 */
function taskLine(byCommit, tip) {
  /** @type {C[]} */
  const line = [];
  for (let at = byCommit.get(tip); at !== undefined; at = byCommit.get(at.parents[0] ?? '')) line.push(at);
  return line;
}

/**
 * The commits of `listed` that `from` holds, itself among them.
 * @param {Map<string, {sha: string, parents: string[]}>} listed @param {string} from @returns {Set<string>}
 */
function heldIn(listed, from) {
  /** @type {Set<string>} */
  const held = new Set();
  for (const next = [from]; next.length > 0;) {
    const commit = listed.get(/** @type {string} */ (next.pop()));
    if (commit === undefined || held.has(commit.sha)) continue;
    held.add(commit.sha);
    next.push(...commit.parents);
  }
  return held;
}

/** A commit `commitGraph` lists: its tree, its parents, the values of the trailer it carries, and the time it was committed, in milliseconds. @typedef {{sha: string, tree: string, parents: string[], values: string[], committed: number}} GraphCommit */

/**
 * The commits any of `revs` holds, committed at or after the time `since`
 * names where it names one, each after its parents, with the values of the
 * trailer `key` it carries and the time it was committed — read in one call
 * however many.
 * @param {string} root @param {string[]} revs @param {string|null} since @param {string} key
 * @returns {GraphCommit[]}
 */
function commitGraph(root, revs, since, key) {
  if (revs.length === 0) return [];
  const bound = since === null ? [] : [`--since=${since}`];
  const read = git(root, ['log', '-z', '--topo-order', '--reverse', `--format=%H%x1f%T%x1f%ct%x1f%P%x1f%(trailers:key=${key},valueonly,separator=%x1f)`, ...bound, ...revs, '--']);
  return read.split('\0').filter(Boolean).map((entry) => {
    const [sha, tree, time, parents, ...values] = entry.split('\x1f');
    return { sha, tree, parents: parents.split(' ').filter(Boolean), values: values.map((value) => value.trim()).filter(Boolean), committed: Number(time) * 1000 };
  });
}

/**
 * The commits the commit `rev` holds that the revision `other` does not —
 * nor any of them, where it names several; every one, where it names none
 * — committed at or after the time `since` names where it names one,
 * oldest first, each after its parents, merges aside — each with its
 * message, the time it was committed, in milliseconds, and the value of
 * the trailer `key` it carries, null where it carries none.
 * @param {string} root @param {string} rev @param {string|string[]} other @param {string} key @param {string|null} [since]
 * @returns {{sha: string, message: string, committed: number, value: string|null}[]}
 */
function stampedPast(root, rev, other, key, since = null) {
  const others = [other].flat().map((one) => revOf(root, one));
  const bound = since === null ? [] : [`--since=${since}`];
  const read = git(root, ['log', '-z', '--reverse', '--topo-order', '--no-merges', `--format=%H%x1f%ct%x1f%(trailers:key=${key},valueonly)%x1f%B`, ...bound, rev, ...(others.length === 0 ? [] : ['--not', ...others]), '--']);
  return read.split('\0').filter(Boolean).map((entry) => {
    const [sha, time, values, message] = entry.split('\x1f');
    return { sha, message, committed: Number(time) * 1000, value: values.split('\n').map((value) => value.trim()).find(Boolean) ?? null };
  });
}

/** The time git dates a commit made now in the repository at `root`, in milliseconds: its committer's, as the clock or `GIT_COMMITTER_DATE` gives it. @param {string} root */
const committerTime = (root) => Number(git(root, ['var', 'GIT_COMMITTER_IDENT']).trim().split(' ').at(-2)) * 1000;

/** A commit's whole name, SHA-1 or SHA-256. */
const FULL_NAME = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/** A local branch's full name where `rev` names one, else `rev` as it is: a full ref, a commit, or a remote's branch — a full ref or a commit's whole name taken as it is unread. @param {string} root @param {string} rev */
const revOf = (root, rev) => (rev.startsWith('refs/') || FULL_NAME.test(rev) || tryGit(root, ['show-ref', '--verify', '--quiet', `${HEADS}${rev}`]) === null ? rev : `${HEADS}${rev}`);

/**
 * Whether `tip` holds the change of `commit` already: merging it there —
 * over `base` where given, else over their merge base — changes nothing
 * (`holdChanges`).
 * @param {string} root @param {string} tip @param {string} commit @param {string} [base]
 */
function holdsChange(root, tip, commit, base) {
  if (isAncestor(root, commit, tip)) return true;
  if (tryGit(root, ['merge-base', tip, commit]) === null) return false;
  return holdChanges(root, [{ ours: tip, tree: treesOf(root, [tip])[0], theirs: commit, base }])[0];
}

/**
 * Whose work a commit since the unit's work began is, by its sha and the
 * values of the trailer it carries: the tasks, by their internal ids, none
 * for no task's (task-landed.cjs, `ownersOf`).
 * @typedef {(sha: string, stamps: string[]) => string[]} Owners
 */

/**
 * Whether `tip` holds the change of the task `id`'s work ending at `own`,
 * read over the commit below its work (`holdsChange`, `belowOwn`), and the
 * change it is laid on — so a task undoing work below it, landed or not,
 * is not read as landed for the undoing.
 * @param {string} root @param {string} tip @param {string} own @param {string} key @param {string} id @param {Owners} ownersOf
 */
function holdsTaskChange(root, tip, own, key, id, ownersOf) {
  const [{ own: below }] = belowOwn(root, tip, key, [{ sha: own, id }], ownersOf);
  return holdsChange(root, tip, own, below) && (below === undefined || holdsChange(root, tip, below));
}

/**
 * Whether `tip` holds a copy of `commit` — a commit past their merge base
 * making the same change, as a cherry-pick or a rebase makes one, however
 * the lines it changed moved there since.
 * @param {string} root @param {string} tip @param {string} commit
 */
function holdsCopy(root, tip, commit) {
  return git(root, ['cherry', tip, commit, `${commit}^`]).startsWith('-');
}

/**
 * Whether each of `pairs` holds its change, as `holdsChange` reads one:
 * merging `theirs` into `ours`, whose tree is `tree`, over `base` where it
 * names one, else over their merge base, changes nothing (`mergeTrees`,
 * `heldMerges`) — the git calls the same however many pairs.
 * @param {string} root @param {{ours: string, tree: string, theirs: string, base?: string}[]} pairs
 * @returns {boolean[]}
 */
const holdChanges = (root, pairs) => heldMerges(mergeTrees(root, pairs));

/**
 * A merge of `pairs`' each — `theirs` into `ours`, over `base` where it
 * names one, else over their merge base — in one call, none where none is
 * asked: whether it met no conflict and the tree it gives, with the tree
 * `ours` has.
 * @param {string} root @param {{ours: string, tree: string, theirs: string, base?: string}[]} pairs
 * @returns {Merge[]}
 */
function mergeTrees(root, pairs) {
  if (pairs.length === 0) return [];
  const input = pairs.map(({ ours, theirs, base }) => `${base === undefined ? '' : `${base} -- `}${ours} ${theirs}\n`).join('');
  const args = [...PINNED, 'merge-tree', '--write-tree', '--stdin', '-z', '--name-only', '--no-messages', '--allow-unrelated-histories'];
  const res = gitRun(root, args, undefined, input);
  if (res.error || res.status !== 0) throw new GitError(`git merge-tree failed: ${(res.error?.message ?? res.stderr).trim()}`);
  const fields = res.stdout.split('\0');
  return pairs.map(({ ours, tree, theirs }) => {
    const clean = fields.shift() === '1';
    const merged = /** @type {string} */ (fields.shift());
    let field = fields.shift();
    while (field !== undefined && field !== '') field = fields.shift();
    return { ours, theirs, tree, clean, merged };
  });
}

/** A merge `mergeTrees` made. @typedef {{ours: string, theirs: string, tree: string, clean: boolean, merged: string}} Merge */

/**
 * Whether each of `merges` changes nothing: it gives the tree `ours` has,
 * meeting no conflict.
 * @param {Merge[]} merges
 * @returns {boolean[]}
 */
function heldMerges(merges) {
  return merges.map((merge) => merge.merged === merge.tree && merge.clean);
}

/**
 * The paths at which each of `pairs`' trees, `merged` and `tree`, differ,
 * by the pair — read in one call, none where none is asked.
 * @template {{merged: string, tree: string}} Pair
 * @param {string} root @param {Pair[]} pairs
 * @returns {Map<Pair, string[]>}
 */
function pathsApart(root, pairs) {
  if (pairs.length === 0) return new Map();
  const asked = [...new Set(pairs.map(({ merged, tree }) => `${merged} ${tree}\n`))];
  let rest = git(root, ['diff-tree', '-r', '-z', '--name-only', '--no-renames', '--stdin'], asked.join(''));
  /** @type {Map<string, string[]>} */
  const byTrees = new Map();
  for (const [at, trees] of asked.entries()) {
    rest = rest.slice(trees.length);
    const next = asked[at + 1];
    /** @type {string[]} */
    const paths = [];
    while (rest !== '' && (next === undefined || !rest.startsWith(next))) {
      const end = rest.indexOf('\0');
      paths.push(rest.slice(0, end));
      rest = rest.slice(end + 1);
    }
    byTrees.set(trees, paths);
  }
  return new Map(pairs.map((pair) => [pair, /** @type {string[]} */ (byTrees.get(`${pair.merged} ${pair.tree}\n`))]));
}

/** Those of `shas` the repository holds as commits, in one call. @param {string} root @param {string[]} shas @returns {Set<string>} */
function commitsIn(root, shas) {
  const asked = [...new Set(shas)];
  const answers = git(root, ['cat-file', '--batch-check=%(objecttype)'], `${asked.join('\n')}\n`).split('\n');
  return new Set(asked.filter((_, at) => answers[at] === 'commit'));
}

/**
 * Below each of `lasts`, on its line past the revision `tip` (`taskLine`),
 * the newest commit another task's work, as `ownersOf` reads whose work
 * each is from the values of the trailer `key` it carries, its branch
 * landing whole, no task's commits on it with its own: `own`, where the
 * task's own work starts, which its change is read over; and `laid`, the
 * change it is laid on, where the tip lacks it (`holdsTaskChange`), below
 * the commits of any task whose work lands with it too (`landsWith`, its
 * chain) — read in one call however many: each undefined where the line
 * reaches the tip first.
 * @param {string} root @param {string} tip @param {string} key @param {{sha: string, id: string}[]} lasts @param {Owners} ownersOf
 * @param {(id: string, other: string) => boolean} [landsWith] whether the task `other`'s work lands with the task `id`'s branch
 * @returns {{own: string|undefined, laid: string|undefined}[]}
 */
function belowOwn(root, tip, key, lasts, ownersOf, landsWith = () => false) {
  if (lasts.length === 0) return [];
  const logged = git(root, ['log', '-z', '--first-parent', `--format=%H%x1f%P%x1f%(trailers:key=${key},valueonly,separator=%x1f)`, ...new Set(lasts.map(({ sha }) => sha)), '--not', tip, '--']);
  /** @type {Map<string, {sha: string, parents: string[], values: string[]}>} */
  const past = new Map(logged.split('\0').filter(Boolean).map((entry) => {
    const [sha, parents, ...values] = entry.split('\x1f');
    return [sha, { sha, parents: parents.split(' ').filter(Boolean), values: values.map((value) => value.trim()).filter(Boolean) }];
  }));
  /** Whether a commit lands with the task `id`'s branch: its work, or no task's — or, `chain`, a task's whose work lands with it. @param {string} id @param {boolean} chain @returns {(commit: {sha: string, values: string[]}) => boolean} */
  const withTask = (id, chain) => ({ sha, values }) => {
    const owners = ownersOf(sha, values);
    return owners.length === 0 || owners.includes(id) || (chain && owners.every((other) => landsWith(id, other)));
  };
  return lasts.map(({ sha, id }) => {
    const line = taskLine(past, sha);
    return { own: line.find((commit) => !withTask(id, false)(commit))?.sha, laid: line.find((commit) => !withTask(id, true)(commit))?.sha };
  });
}

/**
 * The copies of each of `commits` the revision `tip` holds, committed at or
 * after the time `since` names where it names one — a commit making the
 * same change, as `holdsCopy` reads one, which changes one of `paths` —
 * read in two calls however many, the paths given on git's input, as no
 * command line holds every one a task may change.
 * @param {string} root @param {string} tip @param {string|null} since @param {string[]} commits @param {string[]} paths
 * @returns {Map<string, string[]>} by commit
 */
function copiesOf(root, tip, since, commits, paths) {
  /** @type {Map<string, string[]>} */
  const copies = new Map(commits.map((sha) => [sha, []]));
  if (commits.length === 0 || paths.length === 0) return copies;
  const bound = since === null ? [] : [`--since=${since}`];
  const input = [tip, ...commits, '--', ...paths.map((file) => `:(top,literal)${file}`)].map((line) => `${line}\n`).join('');
  const patches = git(root, ['log', '-p', '--full-diff', '--no-merges', '--no-renames', '--no-color', '--no-ext-diff', '--format=commit %H', ...bound, '--stdin'], input);
  const ids = git(root, ['patch-id', '--stable'], patches).split('\n').filter(Boolean).map((row) => row.split(' '));
  const byPatch = new Map(ids.filter(([, sha]) => copies.has(sha)).map(([patch, sha]) => [patch, sha]));
  for (const [patch, sha] of ids) {
    const of = byPatch.get(patch);
    if (of !== undefined && of !== sha) /** @type {string[]} */ (copies.get(of)).push(sha);
  }
  return copies;
}

/** Where a commit stands against a revision (`standings`). @typedef {'held'|'apart'|'moved'} Standing */

/**
 * Where each of `commits` stands against the revision `tip`, read in two
 * calls however many are given (`standingsOn`): `held` where the tip holds
 * it; `apart` where it is laid on the tip, which moved past none of it,
 * and its tree is not the tip's — so the tip holds neither its change
 * (`holdsChange`) nor a copy of it (`holdsCopy`); else `moved`, the tip not
 * holding it.
 * @param {string} root @param {string} tip @param {string[]} commits
 * @returns {Map<string, Standing>}
 */
const standings = (root, tip, commits) => standingsOn(root, tip, commits).standing;

/**
 * `standings`, with the commit `tip` names, null where no commit is asked,
 * and the commits asked whose first-parent line runs down onto it past
 * none of its own (`onTip`), as a branch laid on the tip by its own
 * commits lies — never one meeting it through a merge's other parent.
 * @param {string} root @param {string} tip @param {string[]} commits
 * @returns {{tip: string|null, standing: Map<string, Standing>, onTip: Set<string>}}
 */
function standingsOn(root, tip, commits) {
  /** @type {Map<string, Standing>} */
  const standing = new Map();
  const asked = [...new Set(commits)];
  if (asked.length === 0) return { tip: null, standing, onTip: new Set() };
  const [tipSha, tipTree] = git(root, ['rev-parse', tip, `${tip}^{tree}`]).trim().split('\n');
  const listed = git(root, ['rev-list', '--topo-order', '--reverse', '--format=%T %P', ...asked, '--not', tip, '--']).split('\n').filter(Boolean);
  /** @type {Map<string, string>} each commit the tip lacks, by its tree */
  const past = new Map();
  /** @type {Set<string>} */
  const laid = new Set();
  /** @type {Set<string>} */
  const onLine = new Set();
  for (let at = 0; at < listed.length; at += 2) {
    const sha = listed[at].slice('commit '.length);
    const [tree, ...parents] = listed[at + 1].split(' ');
    past.set(sha, tree);
    if (parents.some((parent) => parent === tipSha || laid.has(parent))) laid.add(sha);
    if (parents[0] === tipSha || onLine.has(parents[0])) onLine.add(sha);
  }
  for (const sha of asked) {
    standing.set(sha, !past.has(sha) ? 'held' : laid.has(sha) && past.get(sha) !== tipTree ? 'apart' : 'moved');
  }
  return { tip: tipSha, standing, onTip: new Set(asked.filter((sha) => onLine.has(sha))) };
}

/**
 * The newest commit stamped by the trailer `key` with each of the unit's
 * tasks, committed at or after the time `since` names where it names one:
 * by the task's internal id, with the time it was committed. Where the
 * task's own branch stands, the one nearest its tip on its line
 * (`taskLine`), whatever the times — so a commit dropped from it, kept off
 * it by a remedy, or the default branch's copy of it merged back, is none
 * of its; a quick-fix's task, where its own branch stands none, of the
 * quick-fix's one branch's line; where neither line holds one, the newest
 * its branch's tip holds (`newestHeld`): `newest`, with `owned`, every task
 * a work branch here stands for, and `oldest`, the oldest commit stamped
 * with it on the line its newest came from, with that line's tip. A task
 * none does — its branch deleted —
 * has as its last the newest of its commits on any ref or reflog, but a
 * branch's a remedy kept (`stampedAnywhere`), which the caller reads only
 * where it asks of such a task.
 * @param {string} root @param {string} key @param {string} unit @param {string|null} since @param {Map<string, string>} [local] the branches here, where the caller read them
 * @returns {{newest: Map<string, TimedCommit>, owned: Set<string>, oldest: Map<string, OldestOn>}}
 */
function lastStamped(root, key, unit, since, local = branches(root)) {
  const bound = since === null ? [] : [`--since=${since}`];
  const work = [...local].filter(([name]) => names.isWorkBranch(unit, name));
  const { newest, oldest } = newestOnBranches(root, key, unit, bound, work);
  const owned = new Set([...newest.keys(), ...work.flatMap(([name]) => {
    const ref = names.taskOfBranch(unit, name);
    return ref === null ? [] : [taskId(ref)];
  })]);
  return { newest, owned, oldest };
}

/** The oldest commit stamped with a task on a work branch's line, and the tip that line runs from. @typedef {{sha: string, tip: string}} OldestOn */

/** A commit's stamps as `%(trailers)` lists them, of the unit's tasks. @param {string} unit @param {string[]} values */
const unitStamps = (unit, values) => values.map((value) => value.trim()).filter((value) => value.startsWith(`${unit}-`));

/**
 * The commit stamped with each of the unit's tasks nearest the tip of its
 * work branch among `work` on its line (`taskLine`) — a task's own branch
 * its task's, the quick-fix's one branch every task's its own branch does
 * not stand for — and the oldest so stamped on that line (`OldestOn`),
 * read in one call however many.
 * @param {string} root @param {string} key @param {string} unit @param {string[]} bound @param {[string, string][]} work by name, at its tip
 * @returns {{newest: Map<string, TimedCommit>, oldest: Map<string, OldestOn>}}
 */
function newestOnBranches(root, key, unit, bound, work) {
  /** @type {Map<string, TimedCommit>} */
  const newest = new Map();
  /** @type {Map<string, OldestOn>} */
  const oldest = new Map();
  if (work.length === 0) return { newest, oldest };
  const logged = git(root, ['log', '-z', '--first-parent', `--format=%H%x1f%P%x1f%ct%x1f%(trailers:key=${key},valueonly,separator=%x1f)`, ...bound, ...new Set(work.map(([, tip]) => tip)), '--']);
  /** @type {Map<string, {parents: string[], commit: TimedCommit, ids: string[]}>} */
  const commits = new Map(logged.split('\0').filter(Boolean).map((entry) => {
    const [sha, parents, time, ...values] = entry.split('\x1f');
    return [sha, { parents: parents.split(' ').filter(Boolean), commit: { sha, committed: Number(time) * 1000 }, ids: unitStamps(unit, values) }];
  }));
  const owned = work.map(([name, tip]) => ({ ref: names.taskOfBranch(unit, name), tip })).sort((one, other) => Number(one.ref === null) - Number(other.ref === null));
  for (const { ref, tip } of owned) {
    const owns = (/** @type {string} */ id) => ref === null || id === taskId(ref);
    const claimed = new Set();
    for (const { commit, ids } of taskLine(commits, tip)) {
      for (const id of ids.filter(owns)) {
        if (!newest.has(id)) {
          newest.set(id, commit);
          claimed.add(id);
        }
        if (claimed.has(id)) oldest.set(id, { sha: commit.sha, tip });
      }
    }
  }
  const unfound = owned.flatMap(({ ref, tip }) => (ref === null || newest.has(taskId(ref)) ? [] : [{ id: taskId(ref), tip }]));
  for (const [id, commit] of newestHeld(root, key, unit, bound, unfound)) newest.set(id, commit);
  return { newest, oldest };
}

/**
 * For each task of `unfound` whose branch's line holds no commit stamped
 * with it, the newest its branch's tip holds, in topological order —
 * as the branch fast-forwarded onto a default branch that a merge commit
 * landed it on leaves it — read in one call however many.
 * @param {string} root @param {string} key @param {string} unit @param {string[]} bound @param {{id: string, tip: string}[]} unfound
 * @returns {Map<string, TimedCommit>}
 */
function newestHeld(root, key, unit, bound, unfound) {
  /** @type {Map<string, TimedCommit>} */
  const newest = new Map();
  if (unfound.length === 0) return newest;
  const logged = git(root, ['log', '-z', '--topo-order', `--format=%H%x1f%P%x1f%ct%x1f%(trailers:key=${key},valueonly,separator=%x1f)`, ...bound, ...new Set(unfound.map(({ tip }) => tip)), '--']);
  const order = logged.split('\0').filter(Boolean).map((entry) => {
    const [sha, parents, time, ...values] = entry.split('\x1f');
    return { sha, parents: parents.split(' ').filter(Boolean), commit: { sha, committed: Number(time) * 1000 }, ids: unitStamps(unit, values) };
  });
  const bySha = new Map(order.map((commit) => [commit.sha, commit]));
  for (const { id, tip } of unfound) {
    const held = heldIn(bySha, tip);
    const found = order.find(({ sha, ids }) => ids.includes(id) && held.has(sha));
    if (found !== undefined) newest.set(id, found.commit);
  }
  return newest;
}

/**
 * The commits stamped with each of the unit's tasks, committed at or after
 * the time `since` names where it names one, on any ref, or kept by a
 * reflog, but a branch a remedy kept, and its reflog, where `local` holds
 * one: by the task's internal id, newest first, in one call.
 * @param {string} root @param {string} key @param {string} unit @param {string|null} since @param {Map<string, string>} local the branches here
 * @returns {Map<string, TimedCommit[]>}
 */
function stampedAnywhere(root, key, unit, since, local) {
  const format = `--format=%H %ct%n%(trailers:key=${key},valueonly)`;
  const read = [...(since === null ? [] : [`--since=${since}`]), '--fixed-strings', `--grep=${key}: ${unit}-`];
  const found = [...local.keys()].some(isKept)
    ? git(root, ['log', '-z', '--date-order', format, '--exclude=refs/*.kept-*', '--all', ...read, '--stdin', '--'], keptAside(root))
    : git(root, ['log', '-z', '--date-order', format, '--all', '--reflog', ...read, '--']);
  /** @type {Map<string, TimedCommit[]>} */
  const stamped = new Map();
  for (const [head, ...values] of found.split('\0').filter(Boolean).map((entry) => entry.split('\n'))) {
    const commit = timedCommit(head);
    for (const value of unitStamps(unit, values)) stamped.set(value, [...(stamped.get(value) ?? []), commit]);
  }
  return stamped;
}

/** Every commit a reflog keeps but a kept branch's, one a line, as `git log --stdin` reads them. @param {string} root */
function keptAside(root) {
  const entries = git(root, ['reflog', 'show', '--all', '--format=%H %gD']).split('\n').filter(Boolean);
  return `${[...new Set(entries.filter((entry) => !isKept(entry.slice(entry.indexOf(' ') + 1).replace(/@\{[^}]*\}$/, ''))).map((entry) => entry.split(' ')[0]))].join('\n')}\n`;
}

/** A commit and the time it was committed, in milliseconds. @typedef {{sha: string, committed: number}} TimedCommit */

/** A commit read from `%H %ct`. @param {string} line @returns {TimedCommit} */
function timedCommit(line) {
  const [sha, time] = line.split(' ');
  return { sha, committed: Number(time) * 1000 };
}

/** Each commit's committer time, ISO, in one call. @param {string} root @param {string[]} shas @returns {Map<string, string>} */
function committedAt(root, shas) {
  const lines = git(root, ['log', '--no-walk=unsorted', '--format=%H %cI', ...new Set(shas)]).trim().split('\n').filter(Boolean);
  return new Map(lines.map((line) => {
    const [sha, at] = line.split(' ');
    return [sha, new Date(at).toISOString()];
  }));
}

/**
 * Whether the revision `rev` holds a commit the trailer `key` stamps with a
 * task of the unit's, committed at or after the time `since` names where it
 * names one.
 * @param {string} root @param {string} rev @param {string} key @param {string} unit @param {string|null} since
 */
function stampsUnit(root, rev, key, unit, since) {
  const bound = since === null ? [] : [`--since=${since}`];
  const found = git(root, ['log', '-z', '--format=%B', '--fixed-strings', `--grep=${key}: ${unit}-`, ...bound, rev, '--']);
  return found.split('\0').some((message) => names.tasksOfMessage(unit, message, key).length > 0);
}

/**
 * The unit's tasks the commits the revision `on` holds — a local branch
 * where it names one — mark, committed at or after the time `since` names
 * where it names one: `named`, by a `Task:` line, as the engine's squash
 * names each task it lands; `stamped`, by the trailer `key`, as the door
 * stamps a task's own commit and a cherry-pick or a rebase copies it. Each
 * by the task's internal id, the commits marking it, each before every
 * commit it holds, whenever any was made, each with the time it was
 * committed: read in one call however many.
 * @param {string} root @param {string} on @param {string} unit @param {string} key @param {string|null} since
 * @returns {{named: Map<string, TimedCommit[]>, stamped: Map<string, TimedCommit[]>}}
 */
function tasksMarkedOn(root, on, unit, key, since) {
  const bound = since === null ? [] : [`--since=${since}`];
  const logged = git(root, ['log', '-z', '--topo-order', '--format=%H %ct%n%B', '--fixed-strings', `--grep=Task: ${unit}-`, `--grep=${key}: ${unit}-`, ...bound, revOf(root, on), '--']);
  const marked = { named: new Map(), stamped: new Map() };
  for (const entry of logged.split('\0').filter(Boolean)) {
    const [head, ...lines] = entry.split('\n');
    const commit = timedCommit(head);
    const message = lines.join('\n');
    for (const [by, read] of /** @type {const} */ ([['named', 'Task'], ['stamped', key]])) {
      for (const id of names.tasksOfMessage(unit, message, read).map(taskId)) marked[by].set(id, [...(marked[by].get(id) ?? []), commit]);
    }
  }
  return marked;
}

/**
 * The commits on `to`'s first-parent line past `from`, newest first, each
 * with the time it was committed, ISO, and the unit's tasks it names by its
 * `Task:` lines, by their internal ids: a landing's name, as the engine's
 * own writes one (landing-names.cjs).
 * @param {string} root @param {string} unit @param {string} from @param {string} to
 * @returns {{sha: string, at: string, ids: string[]}[]}
 */
function namedPast(root, unit, from, to) {
  return git(root, ['log', '-z', '--first-parent', '--format=%H %cI%n%B', `${from}..${to}`, '--']).split('\0').filter(Boolean).map((entry) => {
    const end = entry.indexOf('\n');
    const [sha, at] = entry.slice(0, end).split(' ');
    return { sha, at: new Date(at).toISOString(), ids: names.tasksOfMessage(unit, entry.slice(end + 1)).map(taskId) };
  });
}

/** Every commit `to` holds past `from`, oldest first, as a refusal names it: short, then its subject. @param {string} root @param {string} from @param {string} to @returns {string[]} */
function commitsNamed(root, from, to) {
  return git(root, ['log', '--reverse', '--format=%H%x00%s', `${from}..${to}`]).split('\n').filter(Boolean).map((line) => {
    const [sha, subject] = line.split('\0');
    return `${short(sha)} "${plain(subject)}"`;
  });
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

/** Whether the repository holds `sha` as a commit. @param {string} root @param {string} sha */
function holdsCommit(root, sha) {
  return tryGit(root, ['cat-file', '-e', `${sha}^{commit}`]) !== null;
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
 * makes it — or the paths it conflicts at, named from `root`, as git names
 * them from where it runs.
 * @param {string} root @param {string} base @param {string} ours @param {string} theirs
 * @returns {{tree: string}|{conflicts: string[]}}
 */
function mergeTree(root, base, ours, theirs) {
  const args = [...PINNED, 'merge-tree', '--write-tree', '-z', '--name-only', '--no-messages', `--merge-base=${base}`, ours, theirs];
  const res = gitRun(root, args);
  if (res.status === 1) return { conflicts: res.stdout.split('\0').slice(1).filter(Boolean) };
  if (res.error || res.status !== 0) throw new GitError(`git merge-tree failed: ${(res.error?.message ?? res.stderr).trim()}`);
  return { tree: res.stdout.split('\0')[0] };
}

/**
 * Commits replayed onto `onto`, oldest first, each its own change under its
 * own message: the commit the last replay made, and those whose change was
 * there already, each replayed as a commit that changes nothing — a commit
 * that changes nothing itself is none of them. Stops on the first change
 * that conflicts, naming it and its paths (`Conflict`), and is refused at
 * the first commit git cannot make (`commitTree`).
 * @template {{sha: string, message: string, name: string}} C
 * @param {string} root @param {C[]} commits @param {string} onto @param {string} ontoName
 * @returns {{tip: string, empty: C[]}}
 */
function replay(root, commits, onto, ontoName) {
  let at = onto;
  let [atTree] = treesOf(root, [onto]);
  const own = treesOf(root, commits.flatMap(({ sha }) => [`${sha}^`, sha]));
  const signed = signs(root);
  /** @type {C[]} */
  const empty = [];
  commits.forEach((commit, i) => {
    const merged = mergeTree(root, `${commit.sha}^`, at, commit.sha);
    if ('conflicts' in merged) throw new Conflict(`land: ${commit.name} conflicts with ${ontoName} at ${merged.conflicts.map(plain).join(', ')}`);
    const { tree } = merged;
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
 * The project's folder in its own checkout, from the code root of any
 * worktree of it.
 * @param {string} root @param {{prefix: string}} [at] where the code root sits in its repository, where read @param {Worktree[]} [trees] the repository's, where read
 */
function projectCheckout(root, at = placeOf(root), trees = worktrees(root)) {
  return folderUnder(at, trees[0].path);
}

/**
 * The worktree of the repository at `root` that has the task's branch
 * checked out, if one has.
 * @param {string} root @param {import('./task-id.cjs').TaskRef} ref
 * @returns {Worktree|undefined}
 */
function taskWorktree(root, ref) {
  return worktrees(root).find(({ branch }) => {
    const task = branch === null ? null : names.taskOfBranch(ref.unit, branch);
    return task !== null && task.phase === ref.phase && task.n === ref.n;
  });
}

/** The repository's main checkout, whichever of its worktrees `root` is. @param {string} root */
function mainCheckoutOf(root) {
  return git(root, ['worktree', 'list', '--porcelain']).split('\n')[0].slice('worktree '.length);
}

/**
 * The repository's worktrees, the main checkout first, each with the branch
 * it has checked out and those a rebase stopped there is rewriting — which
 * leaves the worktree detached, though the rebase holds them.
 * @param {string} root @param {string} [made] where a remedy makes its worktrees
 * @returns {Worktree[]}
 */
function worktrees(root, made = scratchRoot(root)) {
  return git(root, ['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map((block) => {
    const lines = block.split('\n');
    const tree = lines[0].slice('worktree '.length);
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

/** Where a remedy makes the worktrees it rebases in: `ledger/` in the repository's git directory. @param {string} root */
function scratchRoot(root) {
  return path.join(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim(), 'ledger');
}

/** The worktree a remedy makes to rebase a branch, where it makes them. @param {string} made @param {string} branch */
function scratchTree(made, branch) {
  return path.join(made, branch.replace(/\//g, '-'));
}

/** What the folder of a merge into a unit's own branch ends in (`mergingTree`). */
const MERGING = '.merging';

/** The file in such a merge's worktree's own git directory naming the branch and the step that takes it (`mergeBegun`). */
const MERGING_FOR = 'ledger-merging.json';

/**
 * The worktree the default branch's merge into a unit's own branch is begun
 * in where the two conflict (unit-branch.cjs), where a remedy makes its
 * worktrees.
 * @param {string} root @param {string} branch the unit's
 */
const mergingTree = (root, branch) => scratchTree(scratchRoot(root), `${branch}${MERGING}`);

/** The worktree of `trees` a merge into a unit's own branch is held in, at `at`, where any is: one at any such folder where `at` is not given. @param {Worktree[]} trees @param {string} [at] */
const mergingIn = (trees, at) => trees.find((tree) => tree.scratch && (at === undefined ? tree.path.endsWith(MERGING) : samePlace(tree.path, at)));

/**
 * The merge of the default branch into a unit's own branch held in the
 * worktree made for it (`mergingTree`): where it is, its commit, and, while
 * the merge is under way, the paths it still conflicts at — null where none
 * is held, a registration whose folder is gone removed.
 * @param {string} root @param {string} branch the unit's
 * @returns {(Worktree & {head: string, unmerged: string[]|null})|null}
 */
function mergeHeld(root, branch) {
  const held = mergingIn(worktrees(root), mergingTree(root, branch));
  if (held === undefined) return null;
  if (!fs.existsSync(held.path)) {
    removeWorktree(root, held.path);
    return null;
  }
  const unmerged = mergeInProgress(held.path) ? git(held.path, ['diff', '--name-only', '-z', '--diff-filter=U']).split('\0').filter(Boolean) : null;
  return { ...held, head: git(held.path, ['rev-parse', 'HEAD']).trim(), unmerged };
}

/**
 * The merge of `theirs` into `ours` begun in the worktree made for it
 * (`mergingTree`) — added there detached at `ours`, a folder no worktree
 * holds cleared first, where it holds none at `ours` already — under
 * `message`, by the replay's settings (`MERGE_PINS`), committing nothing:
 * its conflicts left in its files for the person to settle. The branch and
 * `then`, the step that takes it, are kept in the worktree's own git
 * directory for every land verb's refusal to name (`scratchBlock`), as
 * soon as the worktree is there, so a merge git stops or a kill cuts short
 * leaves them. Where it is.
 * @param {string} root @param {{branch: string, ours: string, theirs: string, message: string, then: string}} merging the unit's branch
 * @returns {string}
 */
function mergeBegun(root, { branch, ours, theirs, message, then }) {
  const tree = mergingTree(root, branch);
  if (mergeHeld(root, branch)?.head !== ours) {
    if (mergingIn(worktrees(root), tree) !== undefined) git(root, ['worktree', 'remove', '--force', tree]);
    fs.rmSync(tree, { recursive: true, force: true });
    addWorktree(root, tree, null, ours);
  }
  fs.writeFileSync(path.join(gitDirOf(tree), MERGING_FOR), JSON.stringify({ branch, then }));
  const res = gitRun(tree, [...PINNED, 'merge', '--no-ff', '--no-commit', '--no-log', '--no-verify-signatures', '-m', message, theirs]);
  if (res.error || res.status === null || res.status > 1) throw new GitError(`git merge failed: ${(res.error?.message ?? res.stderr).trim()}`);
  return tree;
}

/** The worktree a merge into a unit's own branch was held in (`mergeHeld`) taken apart, once the branch holds what it made. @param {string} root @param {string} tree */
function mergeDone(root, tree) {
  git(root, ['worktree', 'remove', '--force', tree]);
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
 * The way on of a task changed after its landing whose change conflicts
 * with the default branch, `onto`: its branch's commits since its tip at
 * that landing, `landed`, rebased onto it — never the default branch merged
 * in, which reads the branch's work over where it was cut and brings back
 * what it took back of its own work since (task-landed.cjs, `landedTip`).
 * @param {string} branch @param {string} onto @param {string} landed
 */
const rebasedSince = (branch, onto, landed) => `rebase ${plain(branch)}'s commits since its landing onto ${plain(onto)}, settling the conflict in the rebase, with \`git rebase --onto ${quoted(onto)} ${short(landed)} ${quoted(branch)}\``;

/**
 * The way on of a task whose change, laid onto the chain's tip `onto` from
 * `from` (landing.cjs, `laidFrom`), conflicts there: its branch's commits
 * past `from` rebased onto it.
 * @param {string} branch @param {string} onto @param {string} from
 */
const rebasedPast = (branch, onto, from) => `rebase ${plain(branch)}'s commits past ${short(from)} onto ${plain(onto)}, settling the conflict in the rebase, with \`git rebase --onto ${quoted(onto)} ${short(from)} ${quoted(branch)}\``;

/**
 * The way on of a task's branch apart from its landing (task-landed.cjs,
 * `apart`): its work laid on its tip at that landing, `landed`, which the
 * default branch's landing holds.
 * @param {string} branch @param {string} landed
 */
const laidOn = (branch, landed) => `lay ${plain(branch)}'s own work on that commit with \`git rebase ${short(landed)} ${quoted(branch)}\``;

/**
 * The way on of a task's branch merged into past its landing
 * (task-landed.cjs, `mergedPast`): its own commits since, `commits`
 * (`ownLinePast`), made again on the default branch, `onto` — the branch
 * cut again there, then each picked — so neither the merge nor what it
 * brought in is replayed.
 * @param {string} branch @param {string} onto @param {string[]} commits
 */
function madeAgainOn(branch, onto, commits) {
  const switched = `\`git switch --no-track -C ${quoted(branch)} ${quoted(onto)}\``;
  return commits.length === 0
    ? `make ${plain(branch)} again on ${plain(onto)}, leaving out the merge and what it brought in — it holds no commit of its own since that one — with ${switched}`
    : `make ${plain(branch)} again on ${plain(onto)} with its own commits since that one, leaving out the merge and what it brought in, with ${switched} then \`git cherry-pick ${commits.map(short).join(' ')}\``;
}

/**
 * The commits of `branch`'s first-parent line past `from`, oldest first,
 * its merges left out: its own work since, without what a merge brought in.
 * @param {string} root @param {string} from @param {string} branch @returns {string[]}
 */
function ownLinePast(root, from, branch) {
  return git(root, ['rev-list', '--reverse', '--no-merges', '--first-parent', `${from}..${HEADS}${branch}`, '--']).split('\n').filter(Boolean);
}

/**
 * The push of a branch over its copy on a remote, leased on the commit the
 * remote held, `held`, so it replaces nothing moved since.
 * @param {string} remote @param {string} branch @param {string} held
 */
const forcePushed = (remote, branch, held) => `git push --force-with-lease=${quoted(`${HEADS}${branch}:${held}`)} ${quoted(remote)} ${quoted(branch)}`;

/** A repository as a line names it: its folder, or nothing for the project's own. @param {string} repo as answers name it, `.` for the project's own */
const inRepoWords = (repo) => (repo === '.' ? '' : ` in ${plain(repo)}`);

/** A warning of a repository's, as a verb gives it: one in a nested repository naming it. @param {string} repo as answers name it @param {string} warning */
const saidIn = (repo, warning) => (repo === '.' ? warning : `in ${plain(repo)}, ${warning}`);

/** The branch a checkout has out, or null where it is detached, as the repository's facts answer it. @param {string} root */
const branchOut = (root) => repoFacts(root)?.branch ?? null;

/**
 * Whether a worktree is the one the code root is in — the person's own
 * checkout, the project a folder of it or not.
 * @param {string} root @param {string} tree
 */
function ownCheckout(root, tree) {
  return samePlace(placeOf(root).top, tree);
}

/** Git as a remedy runs it in a worktree: plainly in the person's own checkout, by `-C` elsewhere. @param {string} root @param {string} tree */
function gitIn(root, tree) {
  return ownCheckout(root, tree) ? 'git' : `git -C ${quoted(tree)}`;
}

/** The worktree that has a branch checked out, if any — never one a remedy made. @param {string} root @param {string} branch @param {Worktree[]} [trees] */
function holderOf(root, branch, trees = worktrees(root)) {
  return trees.find((tree) => !tree.scratch && tree.branch === branch);
}

/**
 * A branch made at `start` and checked out in a worktree, tracking nothing:
 * made at the worktree's own commit, no file and no index entry changes, so
 * the worktree stays where it is.
 * @param {string} tree @param {string} branch @param {string} start
 */
function branchInPlace(tree, branch, start) {
  git(tree, ['switch', '-q', '--no-track', '-c', branch, start]);
}

/**
 * A worktree of the repository added at `at` on `branch` — made at `start`,
 * tracking nothing, or, `start` null, the branch checked out as it stands —
 * or, `branch` null, detached at `start`, into an empty folder there, as
 * git takes one.
 * @param {string} root @param {string} at @param {string|null} branch @param {string|null} start
 */
function addWorktree(root, at, branch, start) {
  const placed = branch === null ? ['--detach', at, /** @type {string} */ (start)] : start === null ? [at, branch] : ['--no-track', '-b', branch, at, start];
  git(root, ['worktree', 'add', '-q', ...placed]);
}

/** A branch made already checked out in a worktree, its files moved to it. @param {string} tree @param {string} branch */
function switchTo(tree, branch) {
  git(tree, ['switch', '-q', branch]);
}

/** A worktree let go of its branch, detached at its own commit, so no file there moves. @param {string} tree */
function detach(tree) {
  git(tree, ['switch', '-q', '--detach']);
}

/** A worktree of the repository removed, as git removes a clean one — or its registration, where its folder is gone. @param {string} root @param {string} tree */
function removeWorktree(root, tree) {
  git(root, ['worktree', 'remove', tree]);
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

/**
 * The command that removes a worktree, as a remedy names it — its folder
 * there or missing — run in `from`, the repository's folder, where the
 * person runs it from another repository's.
 * @param {Worktree} tree @param {string} [from]
 */
function removing(tree, from) {
  return `\`git ${from === undefined ? '' : `-C ${quoted(from)} `}worktree remove ${quoted(tree.path)}\``;
}

/** Whether a branch is one a remedy kept (`keepStep`). @param {string} name */
const isKept = (name) => name.includes('.kept-');

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
 * The refusal of a task whose branch has moved since it was opened at
 * `was`, to `now` — moved on, or rewritten: the branch kept as it stands,
 * a task of its own, and put back — opening on `said`, and ending on `then`
 * once it is (`remedy`).
 * @param {string} root @param {string} shown @param {string} branch @param {string} was @param {string} now
 * @param {{said?: string, then?: string}} [opts]
 * @returns {string}
 */
function movedSinceOpened(root, shown, branch, was, now, { said = 'land', then } = {}) {
  const [from, to] = [short(was), short(now)];
  const way = remedy(root, branch, moveTo(branch, from, `put ${branch} back`), {
    then,
    note: (kept) => `the change from ${from} to ${to}, on ${kept}, is a task of its own`,
  });
  return `${said}: task ${shown}'s branch ${branch} has moved since it was opened at ${from}, to ${to} — ${way}`;
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

/** The command that finishes a merge settled in a worktree, under the message it was begun with. @param {string} tree */
const mergeContinued = (tree) => `\`git -C ${quoted(tree)} -c core.editor=true merge --continue\``;

/**
 * What a merge into a unit's own branch held in the worktree made for it
 * (`mergingTree`) says, until the step that began it takes it — the branch
 * and that step as `mergeBegun` kept them — or null where none is held; a
 * worktree whose folder is gone holds none.
 * @param {Worktree[]} trees
 * @returns {string|null}
 */
function mergingBlock(trees) {
  const merging = mergingIn(trees.filter((tree) => fs.existsSync(tree.path)));
  if (merging === undefined) return null;
  const { branch, then } = JSON.parse(fs.readFileSync(path.join(gitDirOf(merging.path), MERGING_FOR), 'utf8'));
  return `the merge of the default branch into ${branch} is held at ${merging.path}, so nothing moved — `
    + `settle each conflict there and finish the merge, as ${mergeContinued(merging.path)} does once they are, then ${then}, which takes it onto ${branch}, and land again`;
}

/**
 * What a rebase stopped in a worktree a remedy made says, and the way on —
 * settled or ended there, and the worktree removed — or, where none is, a
 * merge into a unit's own branch held (`mergingBlock`); null where neither
 * is. Every verb asks before anything else.
 * @param {string} root
 * @returns {string|null}
 */
function scratchBlock(root) {
  const trees = worktrees(root);
  const stopped = trees.find((tree) => tree.scratch && tree.rebasing.length > 0);
  if (stopped === undefined) return mergingBlock(trees);
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
 * The tracked changes not committed in a worktree, by path.
 * @param {string} tree the worktree's top
 * @returns {string[]}
 */
function changesAt(tree) {
  return dirtyEntries(tree, '').filter((entry) => entry.status !== '??').map((entry) => entry.path);
}

/** The paths a move from one commit, or tree, to another changes, from the repository's top. @param {string} root @param {string} from @param {string} to @returns {Set<string>} */
function pathsChanged(root, from, to) {
  return new Set(git(root, ['diff', '--name-only', '-z', '--no-renames', '--no-relative', from, to]).split('\0').filter(Boolean));
}

/**
 * The block a worktree's changes not committed put on moving the branch it
 * has out — those to the paths the move changes, which `changed` answers,
 * asked only where there are changes; every one where it answers null —
 * and the way on, or null where there are none.
 * @param {string} root @param {Worktree} holder @param {string} branch @param {() => Set<string>|null} changed
 * @returns {string|null}
 */
function dirtOf(root, holder, branch, changed) {
  const changes = changesAt(holder.path);
  if (changes.length === 0) return null;
  const moving = changed();
  const dirt = changes.filter((file) => moving === null || moving.has(file)).map(plain);
  if (dirt.length === 0) return null;
  const freed = detaching(root, holder, branch, git(root, ['rev-parse', `${HEADS}${branch}`]).trim());
  return `${branch} is checked out at ${holder.path}, with changes not committed: ${dirt.join(', ')}, so nothing moved — commit them, or ${freed.step}, and land again; ${freed.note}`;
}

/**
 * What a worktree's changes not committed put in the way of moving the
 * branch it has out — those to the paths the move changes, which `changed`
 * answers (`pathsChanged`), asked only where there are changes, the rest
 * carried across — or null where nothing does, or no worktree holds it.
 * @param {string} root @param {string} branch @param {() => Set<string>} changed
 * @returns {string|null}
 */
function dirtBlock(root, branch, changed) {
  const holder = holderOf(root, branch, worktrees(root));
  if (holder === undefined || !fs.existsSync(holder.path)) return null;
  return dirtOf(root, holder, branch, changed);
}

/**
 * What stops a branch a worktree holds from moving there, and the way on —
 * a rebase rewriting it, a worktree an earlier remedy left with it out, the
 * worktree that has it out with its folder missing, an operation in
 * progress, tracked changes not committed — for a move given, only to
 * files the move changes, as a fast-forward there would refuse them, the
 * rest carried across — and, for a move given, one that is no fast-forward
 * or would overwrite a file not tracked — or null where nothing does, or no
 * worktree holds it.
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
  const dirty = dirtOf(root, holder, branch, () => (move === undefined ? null : pathsChanged(root, move.from, move.to)));
  if (dirty !== null) return dirty;
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
 * A branch pushed to the remote under its own name, at its tip here, as
 * `pushBranches` pushes it.
 * @param {string} root @param {string} remote @param {string} branch @param {string} then
 */
function pushBranch(root, remote, branch, then) {
  pushBranches(root, remote, [{ branch, commit: `${HEADS}${branch}` }], then);
}

/**
 * Branches pushed to the remote under their own names, each at its
 * `commit`, all or none: each refspec named, no tag following them, nothing
 * signed, and no nested repository pushed with them, so no `push.*` setting
 * changes what goes where — one with a `lease` replacing the remote's branch
 * only while it stands at that commit, or, the lease empty, while the
 * remote has no such branch. Refused in git's words, hints aside, where the
 * remote refuses them or cannot be reached, saying what `then` did not
 * happen.
 * @param {string} root @param {string} remote @param {{branch: string, commit: string, lease?: string}[]} pushed @param {string} then
 */
function pushBranches(root, remote, pushed, then) {
  const atomic = pushed.length > 1 ? ['--atomic'] : [];
  const leases = pushed.flatMap(({ branch, lease }) => (lease === undefined ? [] : [`--force-with-lease=${HEADS}${branch}:${lease}`]));
  try {
    networkGit(root, ['push', '--quiet', '--no-follow-tags', '--no-signed', ...atomic, ...leases, remote, ...pushed.map(({ branch, commit }) => `${commit}:${HEADS}${branch}`)], PUSH_TIMEOUT_MS);
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
    networkGit(root, ['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, `+${HEADS}${branch}:${tracking}`], FETCH_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { failed: gitSaid(err) };
  }
  return { commit: git(root, ['rev-parse', tracking]).trim() };
}

/**
 * Each of `branches` as `remote` holds it, by its name, read in one call,
 * fetching and writing nothing — one it holds not left out, every one
 * where it cannot be read.
 * @param {string} root @param {string} remote @param {string[]} branches
 * @returns {Map<string, string>}
 */
function remoteHeads(root, remote, branches) {
  if (branches.length === 0) return new Map();
  let said;
  try {
    said = networkGit(root, ['ls-remote', remote, ...branches.map((branch) => `${HEADS}${branch}`)], FETCH_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return new Map();
  }
  return new Map(said.split('\n').filter(Boolean).map((line) => {
    const [sha, ref] = line.split('\t');
    return [ref.slice(HEADS.length), sha];
  }));
}

/** The branches a remote holds as last fetched, by their names, fetching nothing. @param {string} root @param {string} remote @returns {string[]} */
const trackedBranches = (root, remote) => git(root, ['for-each-ref', '--format=%(refname:lstrip=3)', `refs/remotes/${remote}/`]).split('\n').filter((name) => name !== '' && name !== 'HEAD');

/** A remote's branch's commit as last fetched, fetching nothing; null where it never has been. @param {string} root @param {string} remote @param {string} branch @returns {string|null} */
const trackedTip = (root, remote, branch) => tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/${branch}^{commit}`])?.trim() ?? null;

/**
 * Whether the repository holds `commit`, fetched where it does not from the
 * remote's ref `ref` that holds it, writing no ref here — false where the
 * fetch fails or brings it not.
 * @param {string} root @param {string} remote @param {string} ref @param {string} commit
 */
function fetchedCommit(root, remote, ref, commit) {
  if (holdsCommit(root, commit)) return true;
  try {
    networkGit(root, ['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', '--refmap=', remote, ref], FETCH_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return false;
  }
  return holdsCommit(root, commit);
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
 * @param {string} root @param {string|null} remote the repository's @param {boolean} [nested] @param {Map<string, string>} [local] its branches, where the caller read them
 * @returns {string}
 */
function defaultBranch(root, remote, nested = false, local = branches(root)) {
  const configured = tryGit(root, ['config', '--get', 'init.defaultBranch'])?.trim() ?? '';
  const named = remoteHead(root, remote) ?? [configured, ...TRUNKS].find((branch) => local.has(branch));
  if (named === undefined) {
    throw new Error(
      'land: no default branch to land on — the remote names none, and the repository has no branch init.defaultBranch names, nor main or master; '
      + `name it with \`git config init.defaultBranch <branch>\` ${nested ? 'there' : 'in the project'}`,
    );
  }
  if (named === STATE_BRANCH) {
    throw new Error(`land: the default branch reads as ${STATE_BRANCH}, Ledger's state branch, which nothing lands on — name ${nested ? 'its' : 'the project\'s'} own with \`git config init.defaultBranch <branch>\``);
  }
  if (!local.has(named)) {
    throw new Error(`land: the default branch is ${named}, and the repository has no local branch of that name — make one with \`git branch ${named} ${remote}/${named}\``);
  }
  return named;
}

/** The default branch each repository of the project lands on, by the read of the project's repositories that gave it (`landingBranch`). @type {WeakMap<Repo, {branch: string}|{refused: unknown}>} */
const LANDS_ON = new WeakMap();

/** The unit's branch each repository of the project holds, by the unit, null where it holds none, by the read of the project's repositories that gave it (`landingBranch`). @type {WeakMap<Repo, Map<string, string|null>>} */
const UNIT_LANDS_ON = new WeakMap();

/** A repository's remote, by its place in the project. @param {string} cwd @param {Repo} repo */
const remoteOf = (cwd, repo) => (repo.dir === '' ? remoteName(cwd) : nestedRemoteName(repo.path));

/**
 * The default branch a repository of the project lands on, by its own
 * remote, refused as `defaultBranch` refuses; read once for each read of
 * the project's repositories (the header's).
 * @param {string} cwd @param {Repo} repo @returns {string}
 */
function repoDefault(cwd, repo) {
  if (!LANDS_ON.has(repo)) {
    try {
      LANDS_ON.set(repo, { branch: defaultBranch(repo.path, remoteOf(cwd, repo), repo.dir !== '') });
    } catch (refused) {
      LANDS_ON.set(repo, { refused });
    }
  }
  const read = /** @type {{branch: string}|{refused: unknown}} */ (LANDS_ON.get(repo));
  if ('refused' in read) throw read.refused;
  return read.branch;
}

/** The branch of its own a unit's manifest records (7.2.35), null where it records none. @param {string} cwd @param {string} unit @returns {string|null} */
function recordedBranch(cwd, unit) {
  const root = stateRoot(cwd);
  if (!fs.existsSync(workUnitManifestPath(root, unit))) return null;
  const branch = readWorkUnitManifest(root, unit).build?.branch;
  return typeof branch === 'string' ? branch : null;
}

/** Whether a repository has a branch here, or as last fetched from its remote. @param {string} cwd @param {Repo} repo @param {string} branch */
function holdsBranch(cwd, repo, branch) {
  const remote = remoteOf(cwd, repo);
  return branches(repo.path).has(branch) || (remote !== null && trackedTip(repo.path, remote, branch) !== null);
}

/**
 * The unit's branch a repository of the project holds (the header's): the
 * project's own, the one its manifest records; a nested one, that branch
 * where it is there or as last fetched — null where it holds none.
 * @param {string} cwd @param {Repo} repo @param {string} unit @returns {string|null}
 */
function unitBranchIn(cwd, repo, unit) {
  const held = UNIT_LANDS_ON.get(repo) ?? new Map();
  UNIT_LANDS_ON.set(repo, held);
  if (!held.has(unit)) {
    const branch = recordedBranch(cwd, unit);
    held.set(unit, branch !== null && (repo.dir === '' || holdsBranch(cwd, repo, branch)) ? branch : null);
  }
  return /** @type {string|null} */ (held.get(unit));
}

/**
 * The branch a repository of the project lands the unit's work on (the
 * header's, 7.2.34): the unit's own where it holds it, else its default
 * branch, refused as `defaultBranch` refuses it.
 * @param {string} cwd @param {Repo} repo @param {string} unit @returns {string}
 */
function landingBranch(cwd, repo, unit) {
  return unitBranchIn(cwd, repo, unit) ?? repoDefault(cwd, repo);
}

/**
 * The revision a read of the unit's landing branch in a repository takes
 * (the header's): the branch here, else the remote's as last fetched —
 * refused where neither is, as a default branch with no local branch is.
 * @param {string} cwd @param {Repo} repo @param {string} unit @returns {string}
 */
function landingRev(cwd, repo, unit) {
  const branch = unitBranchIn(cwd, repo, unit);
  if (branch === null) return `${HEADS}${repoDefault(cwd, repo)}`;
  if (branches(repo.path).has(branch)) return `${HEADS}${branch}`;
  const remote = remoteOf(cwd, repo);
  if (remote !== null && trackedTip(repo.path, remote, branch) !== null) return `refs/remotes/${remote}/${branch}`;
  throw new Error(`land: ${branch}, where the repository lands ${unit}'s work, is neither here nor fetched from its remote`);
}

/** The unit's branch a call made in a repository, which every read after it there takes (`landingBranch`). @param {Repo} repo @param {string} unit @param {string} branch */
function landingMade(repo, unit, branch) {
  const held = UNIT_LANDS_ON.get(repo) ?? new Map();
  held.set(unit, branch);
  UNIT_LANDS_ON.set(repo, held);
}

module.exports = {
  short, readOnce, readAgain, branches, branchesHeldBy, holdsBeyond, holdsWork, holdingBranches, holdingBranch, refsUnder, updateRefs, isAncestor, mergeOf, commitsIn, latestOf, mergeBase, treesOf, firstParentLine, commitAt, lineSince, commitPaths, taskLine, heldIn, commitGraph, stampedPast, committerTime, holdsChange, holdsTaskChange, holdsCopy, holdChanges, mergeTrees, heldMerges, pathsApart, belowOwn, copiesOf, standings, standingsOn, lastStamped, stampedAnywhere, committedAt, stampsUnit, tasksMarkedOn, commitsNamed, namedPast, commitWithTree, treesPast,
  changedAtTop, signs, commitTree, Conflict, mergeTree, replay, ownChangeEmpty, plain, quoted, rebasedSince, rebasedPast, laidOn, madeAgainOn, ownLinePast, forcePushed, inRepoWords, saidIn, branchOut, remedy, moveTo, movedSinceOpened, rewrite, mergeContinued, scratchBlock, rebaseBlock, checkoutBlock, changesAt, pathsChanged, dirtBlock, moveBranch,
  defaultBranch, repoDefault, remoteOf, recordedBranch, unitBranchIn, landingBranch, landingRev, landingMade, remoteUrlOf, pushBranch, pushBranches, gitSaid, fetchBranch, remoteHeads, trackedTip, trackedBranches, fetchedCommit, nothingPast,
  worktrees, taskWorktree, mainCheckoutOf, projectCheckout, holderOf, samePlace, removing, branchInPlace, addWorktree, switchTo, removeWorktree, detach, scratchRoot, mergeHeld, mergeBegun, mergeDone,
};
