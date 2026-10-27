'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's commit door — two doors, one per side.
//
// - The state: every path under `.leeway/` is committed in the state
//   worktree on `leeway-state` (domain/state-worktree), under the writer
//   lock, then pushed; a push that fails is a warning, never a stop. Paths
//   are state-relative.
// - The code tree: the files the workflows own outside the state
//   (`OWNED_PATHS`) and declared code paths are committed in the code root's
//   own tree (kernel/code-root), on the branch checked out, and never on the
//   state branch. A process-wide lock (`.git/workflows-commit.lock`, on a long
//   clock) holds each add+commit sequence alone, so concurrent sessions never
//   interleave on git's shared index. The code commit lands in each repo that
//   owns one of its paths (kernel/repos), deepest first, under that repo's
//   own lock.
//
// Every commit is confined: it commits exactly the paths its action wrote,
// so a peer session's dirty or staged files are never swept up under someone
// else's message. The migration commit takes the paths the workflows own as
// the index records them on the code side, a removal a migration staged
// included (`commitStaged`, built in a scratch index), and one commit on each
// side that changed.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, gitPath, tryGit, commitPathspec, commitStaged, operationInProgress } = require('../kernel/git.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { repoName } = require('../kernel/repos.cjs');
const { acquireLockFile, releaseLockFile } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { STATE_BRANCH, withStateLock, commitState } = require('./state-worktree.cjs');
const { SETTINGS_SPEC } = require('./settings.cjs');

/** The project manifest, state-relative. */
const PROJECT_MANIFEST_SPEC = 'manifest.json';

/** The file Claude Code reads to copy ignored files into a new worktree, from the project root. */
const WORKTREE_INCLUDE = '.worktreeinclude';

/**
 * The files the workflows own in the code tree (6.3.15), named from the code
 * root: the project's Claude Code settings and its `.gitignore`, which boot
 * keeps, and the worktree include, which only a migration writes. The code
 * side of the migration commit; its state side is the whole state worktree.
 * @type {readonly string[]}
 */
const OWNED_PATHS = Object.freeze([SETTINGS_SPEC, WORKTREE_INCLUDE, '.gitignore']);

/**
 * The discovery scope — what a discovery session writes: its session logs,
 * the briefs it synthesises at the harvest, and the work-unit manifest (the
 * map lives there), state-relative. Shared by `commit --discovery` and the
 * discovery transaction tails so the session's every commit slices the same
 * paths.
 * @param {string} workUnit
 * @returns {string[]}
 */
function discoveryScope(workUnit) {
  return [
    `${workUnit}/discovery/sessions`,
    `${workUnit}/discovery/briefs`,
    `${workUnit}/manifest.json`,
  ];
}

/**
 * The state commit: exactly `paths` in the state worktree on
 * `leeway-state`, under the writer lock, then pushed. A push that fails
 * comes back as a warning; the commit stands. The sha is short, as the code
 * tree's commits answer it.
 * @param {string} cwd @param {string|string[]} paths state-relative, or absolute
 * @param {string} message
 * @returns {{committed: string|null, warnings: string[]}}
 */
function commitStateScoped(cwd, paths, message) {
  const root = stateRoot(cwd);
  const { commit, warnings } = withStateLock(root, () => commitState(root, Array.isArray(paths) ? paths : [paths], message));
  return { committed: commit === null ? null : isolatedGit(root).run(['rev-parse', '--short', commit]).trim(), warnings };
}

/**
 * Transaction-tail state commit: the state write has already landed, so a
 * commit git refuses degrades to a warning and a pending note — it never
 * fails the verb. A push that fails is a warning beside it.
 * @param {string} cwd @param {string|string[]} paths state-relative
 * @param {string} message @param {string[]} warnings
 * @returns {{committed: string|null, failed: boolean}}
 */
function commitStateTail(cwd, paths, message, warnings) {
  try {
    const out = commitStateScoped(cwd, paths, message);
    warnings.push(...out.warnings);
    return { committed: out.committed, failed: false };
  } catch (err) {
    warnings.push(`commit failed: ${err instanceof Error ? err.message : String(err)}`);
    return { committed: null, failed: true };
  }
}

/**
 * The code-tree commit lock lives in the `.git` dir (like git's own
 * transient locks). A linked worktree's lock is its own, which is the right
 * scope: the index being serialised is per-worktree too — and so is a nested
 * repo's.
 * @param {string} cwd project root, or a nested repo's
 */
function commitLockPath(cwd) {
  return gitPath(cwd, 'workflows-commit.lock');
}

/**
 * Refuse a code commit in a tree that has the state branch checked out.
 * @param {string} cwd the tree the commit would land in
 */
function refuseStateBranch(cwd) {
  const head = tryGit(cwd, ['symbolic-ref', '-q', 'HEAD']);
  if (head !== null && head.trim() === `refs/heads/${STATE_BRANCH}`) {
    throw new Error(`refusing a code commit in ${cwd}: it has the state branch ${STATE_BRANCH} checked out — the state commits through its own door`);
  }
}

/**
 * Run `fn` holding the commit lock, in a tree that is not the state's.
 * @template T
 * @param {string} cwd the code root, or a nested repo's
 * @param {() => T} fn
 * @returns {T}
 */
// A commit can run the project's hooks, so the commit lock lives on a longer
// clock than the manifest lock: a holder is stale only after five minutes
// (breaking a live holder mid-`git commit` would recreate the interleaving
// the lock exists to prevent), and contenders wait up to a minute.
const COMMIT_LOCK_STALE_MS = 300000;
const COMMIT_LOCK_TIMEOUT_MS = 60000;

function withCommitLock(cwd, fn) {
  refuseStateBranch(cwd);
  const lockFile = commitLockPath(cwd);
  acquireLockFile(lockFile, 'Timed out waiting for the commit lock', COMMIT_LOCK_TIMEOUT_MS, COMMIT_LOCK_STALE_MS);
  try {
    return fn();
  } finally {
    releaseLockFile(lockFile);
  }
}

/**
 * The code-tree commit: `commitPathspec` in the code root under the commit
 * lock, committing exactly the named paths and leaving every other process's
 * dirty or staged files untouched.
 * @param {string} cwd @param {string|string[]} pathspec as the code root names them @param {string} message
 * @returns {string|null}
 */
function commitPathspecScoped(cwd, pathspec, message) {
  const root = codeRoot(cwd);
  return withCommitLock(root, () => commitPathspec(root, pathspec, message));
}

/**
 * The code commit across the project's repos: each repo's share of the paths
 * — its `commitGroups` group, in their order, deepest first — committed
 * under that repo's own commit lock, with the same message, its `heldOut`
 * folders held out — a parent never commits a nested repo's folder, and
 * records a submodule's new pointer only where the call reached into that
 * submodule. A repo whose commit fails fails the call, naming itself and the
 * commits already made; re-running it is the retry, as those repos have
 * nothing left in the paths and a moved pointer is recorded whatever moved
 * it.
 * @param {{repo: import('../kernel/repos.cjs').Repo, paths: string[]}[]} groups
 * @param {string} message
 * @returns {{repo: string, sha: string}[]} the commits made, `.` naming the root
 */
function commitAcrossRepos(groups, message) {
  /** @type {{repo: string, sha: string}[]} */
  const committed = [];
  for (const { repo, paths } of groups) {
    const sha = commitInRepo(repo, paths, message, committed);
    if (sha !== null) committed.push({ repo: repoName(repo), sha });
  }
  return committed;
}

/**
 * One repo's share of the code commit, under its own lock.
 * @param {import('../kernel/repos.cjs').Repo} repo
 * @param {string[]} paths as the repo names them
 * @param {string} message
 * @param {{repo: string, sha: string}[]} committed the commits the call made before this one
 * @returns {string|null}
 */
function commitInRepo(repo, paths, message, committed) {
  try {
    return withCommitLock(repo.path, () => commitPathspec(repo.path, paths, message, repo.heldOut));
  } catch (err) {
    const made = committed.map((c) => `${c.repo} committed ${c.sha}`).join(', ');
    const after = made === '' ? '' : ` after ${made} — re-running the same call commits the rest`;
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`the commit in ${repoName(repo)} failed${after}: ${detail}`);
  }
}

/**
 * `commitStaged` in the code root under the commit lock: stage everything
 * under the pathspecs and commit exactly them as the index records them.
 * @param {string} cwd @param {readonly string[]} specs as the code root names them @param {string} message
 * @returns {string|null}
 */
function commitStagedScoped(cwd, specs, message) {
  const root = codeRoot(cwd);
  return withCommitLock(root, () => commitStaged(root, [...specs], message));
}

/**
 * Stamp a transaction result when nothing was committed. The commit doors
 * return null on a clean scope; `nothing to commit` is the one note every
 * engine transaction shares for that outcome. Mutates the result in place.
 * @param {{note?: string}} result @param {string|null} committed
 */
function noteIfNothingCommitted(result, committed) {
  if (committed === null) result.note = 'nothing to commit';
}

/**
 * Transaction-tail code-tree commit: the write has already landed, so a git
 * failure here (index.lock contention from a concurrent session, a hook)
 * degrades to a warning and a pending note — it never fails the verb.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @param {string[]} warnings
 * @returns {{committed: string|null, failed: boolean}}
 */
function commitTailPathspec(cwd, pathspec, message, warnings) {
  try {
    return { committed: commitPathspecScoped(cwd, pathspec, message), failed: false };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    warnings.push(`commit failed: ${detail}`);
    return { committed: null, failed: true };
  }
}

/**
 * Commit the workflows' own change to a file they own in the code tree,
 * confined to it — the write this call made, or one an earlier call could not
 * commit, which this one retries — where the file's whole difference from
 * the branch checked out is that change. `ours` makes the file's committed
 * content, null where the branch lacks it, into what the workflows want it
 * to read; null where it already does. The file is compared as git would
 * stage it, through the checkout's own conversions. A file that also holds
 * the person's own changes is theirs to commit, and a warning says so; a
 * commit git refuses is a warning led by `failure`. Nothing is committed
 * while git is in the middle of an operation there — the next boot commits
 * it — nor where git ignores the file there: the person keeps it out of git.
 * @param {string} cwd @param {string} spec as the code root names it
 * @param {(committed: string|null) => string|null} ours
 * @param {string} message @param {string} failure @param {string[]} warnings
 */
function commitOwnChange(cwd, spec, ours, message, failure, warnings) {
  const root = codeRoot(cwd);
  if (operationInProgress(root) !== null || tryGit(root, ['check-ignore', '-q', '--', spec]) !== null) return;
  const committedId = tryGit(root, ['rev-parse', '--verify', '-q', `HEAD:./${spec}`])?.trim() ?? null;
  const wanted = ours(committedId === null ? null : git(root, ['cat-file', 'blob', committedId]));
  if (wanted === null) return;
  const onDisk = fs.existsSync(path.join(root, spec)) ? git(root, ['hash-object', '--', spec]).trim() : null;
  if (onDisk === git(root, ['hash-object', '--no-filters', '--stdin'], undefined, wanted).trim()) {
    try {
      commitPathspecScoped(root, spec, message);
    } catch (err) {
      warnings.push(`${failure}, and the next boot tries again: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (onDisk !== committedId) {
    warnings.push(
      `${spec} holds changes of yours not yet committed, so the workflows' own change to it was not committed either — ` +
      'commit yours, and the next boot commits theirs',
    );
  }
}

/**
 * Stamp a transaction result from a tail-commit outcome: a failure notes the
 * pending commit (the state is saved — only the commit is owed), a clean
 * tree notes `nothing to commit`. Mutates the result in place.
 *
 * A note is contract surface — a session runs the command it prescribes
 * verbatim — so a transaction whose commit was narrower than the work unit
 * passes `retry`: the scope arguments the retry needs, everything between
 * `engine commit` and `-m`. Without it the note stays generic, which is the
 * honest answer for a genuinely work-unit-wide tail.
 * @param {{note?: string}} result
 * @param {{committed: string|null, failed: boolean}} outcome
 * @param {string} [retry] the retry's scope arguments, e.g. `payments --discovery`
 */
function noteCommitOutcome(result, outcome, retry) {
  if (outcome.failed) {
    result.note = retry
      ? `commit pending — state saved; retry with: engine commit ${retry} -m "<message>"`
      : 'commit pending — state saved; retry with engine commit';
  } else {
    noteIfNothingCommitted(result, outcome.committed);
  }
}

module.exports = {
  commitStateScoped,
  commitStateTail,
  commitPathspecScoped,
  commitAcrossRepos,
  commitStagedScoped,
  commitTailPathspec,
  commitOwnChange,
  noteCommitOutcome,
  noteIfNothingCommitted,
  withCommitLock,
  discoveryScope,
  OWNED_PATHS,
  PROJECT_MANIFEST_SPEC,
};
