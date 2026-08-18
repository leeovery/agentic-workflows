'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's commit door. Every engine-made commit routes
// through here, for two guarantees:
//
// - The knowledge store rides along: transactions mutate the store
//   (index/remove) as a side effect of manifest writes, and a commit that
//   staged only the work unit would leave `.workflows/.knowledge` dirty for
//   some later, unrelated commit to sweep up. The pathspec is appended
//   exists-guarded — staging a nonexistent path is a git error (the
//   conditional-inbox lesson), and keyword-less projects may have no store.
//
// - Commits are serialised: a process-wide lock (`.git/workflows-commit.lock`,
//   same discipline as the manifest lock, on a longer clock) holds each
//   add+commit sequence alone, so concurrent sessions never interleave on
//   git's shared index.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, commitScoped, commitPathspec } = require('../kernel/git.cjs');
const { acquireLockFile, releaseLockFile } = require('../kernel/manifest-io.cjs');

const KB_DIR = '.workflows/.knowledge';
const PROJECT_MANIFEST_SPEC = '.workflows/manifest.json';

/**
 * The commit lock lives in the `.git` dir (like git's own transient locks) —
 * a lock inside `.workflows` would be staged by the very commit it guards.
 * `--git-path` resolves linked worktrees to their per-worktree dir, which is
 * the right scope: the index being serialised is per-worktree too.
 * @param {string} cwd project root
 */
function commitLockPath(cwd) {
  const rel = git(cwd, ['rev-parse', '--git-path', 'workflows-commit.lock']).trim();
  return path.isAbsolute(rel) ? rel : path.join(cwd, rel);
}

/**
 * Run `fn` holding the commit lock.
 * @template T
 * @param {string} cwd project root
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
  const lockFile = commitLockPath(cwd);
  acquireLockFile(lockFile, 'Timed out waiting for the commit lock', COMMIT_LOCK_TIMEOUT_MS, COMMIT_LOCK_STALE_MS);
  try {
    return fn();
  } finally {
    releaseLockFile(lockFile);
  }
}

/**
 * `commitScoped` under the commit lock, with the knowledge store staged
 * alongside the caller's pathspec whenever it exists on disk. Same contract:
 * short sha, or null when nothing was staged.
 * @param {string} cwd      project root
 * @param {string|string[]} pathspec
 * @param {string} message
 * @returns {string|null}
 */
function commitScopedWithKb(cwd, pathspec, message) {
  const specs = Array.isArray(pathspec) ? [...pathspec] : [pathspec];
  if (!specs.includes(KB_DIR) && fs.existsSync(path.join(cwd, KB_DIR))) {
    specs.push(KB_DIR);
  }
  return withCommitLock(cwd, () => commitScoped(cwd, specs, message));
}

/**
 * `commitScoped` under the commit lock, the caller's pathspec only — boot's
 * config and store commits, which must not drag the KB dir in implicitly.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @returns {string|null}
 */
function commitScopedLocked(cwd, pathspec, message) {
  return withCommitLock(cwd, () => commitScoped(cwd, pathspec, message));
}

/**
 * `commitPathspec` under the commit lock: commit exactly the named paths,
 * leaving every other process's dirty or staged files untouched. The KB dir
 * never rides implicitly — an action-scoped commit names what its action
 * wrote, and no KB-touching verb precedes it.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @returns {string|null}
 */
function commitPathspecScoped(cwd, pathspec, message) {
  return withCommitLock(cwd, () => commitPathspec(cwd, pathspec, message));
}

/**
 * Stamp a transaction result when nothing was staged. `commitScopedWithKb`
 * returns null on a clean tree; `nothing to commit` is the one note every
 * engine transaction shares for that outcome. Mutates the result in place.
 * @param {{note?: string}} result @param {string|null} committed
 */
function noteIfNothingCommitted(result, committed) {
  if (committed === null) result.note = 'nothing to commit';
}

/**
 * Transaction-tail commit: the state write has already landed, so a git
 * failure here (index.lock contention from a concurrent session, a hook)
 * degrades to a warning and a pending note — it never fails the verb.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @param {string[]} warnings
 * @param {() => void} [beforeInLock] index-mutating prep (e.g. git rm) that
 *   must run inside the same commit-lock hold as the commit that lands it
 * @returns {{committed: string|null, failed: boolean}}
 */
function commitTailWithKb(cwd, pathspec, message, warnings, beforeInLock) {
  try {
    const specs = Array.isArray(pathspec) ? [...pathspec] : [pathspec];
    if (!specs.includes(KB_DIR) && fs.existsSync(path.join(cwd, KB_DIR))) {
      specs.push(KB_DIR);
    }
    const committed = withCommitLock(cwd, () => {
      if (beforeInLock) beforeInLock();
      return commitScoped(cwd, specs, message);
    });
    return { committed, failed: false };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    warnings.push(`commit failed: ${detail}`);
    return { committed: null, failed: true };
  }
}

/**
 * `commitTailWithKb`'s pathspec-confined sibling: commit exactly the named
 * paths at a transaction tail, degrading a git failure to a warning.
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
 * Stamp a transaction result from a tail-commit outcome: a failure notes the
 * pending commit (the state is saved — only the commit is owed), a clean
 * tree notes `nothing to commit`. Mutates the result in place.
 * @param {{note?: string}} result
 * @param {{committed: string|null, failed: boolean}} outcome
 */
function noteCommitOutcome(result, outcome) {
  if (outcome.failed) {
    result.note = 'commit pending — state saved; retry with engine commit';
  } else {
    noteIfNothingCommitted(result, outcome.committed);
  }
}

module.exports = {
  commitScopedWithKb,
  commitScopedLocked,
  commitPathspecScoped,
  commitTailWithKb,
  commitTailPathspec,
  noteCommitOutcome,
  noteIfNothingCommitted,
  withCommitLock,
  KB_DIR,
  PROJECT_MANIFEST_SPEC,
};
