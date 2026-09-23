'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's commit door. Every engine-made commit routes
// through here, for two guarantees:
//
// - Commits are confined: each one names the paths its action wrote and
//   commits `-- <paths>` (an untracking, from a scratch index — see
//   `commitUntrack`), so a peer session's dirty or staged files are never
//   swept up under someone else's message. No engine commit can reach outside
//   its declared scope.
//
// - Commits are serialised: a process-wide lock (`.git/workflows-commit.lock`,
//   same discipline as the manifest lock, on a longer clock) holds each
//   add+commit sequence alone, so concurrent sessions never interleave on
//   git's shared index.
// ---------------------------------------------------------------------------

const path = require('path');
const { git, commitPathspec, commitUntrack } = require('../kernel/git.cjs');
const { acquireLockFile, releaseLockFile } = require('../kernel/manifest-io.cjs');

const PROJECT_MANIFEST_SPEC = '.workflows/manifest.json';

/**
 * The discovery scope — what a discovery session writes: its session logs,
 * the briefs it synthesises at the harvest, and the work-unit manifest (the
 * map lives there). Shared by `commit --discovery` and the discovery
 * transaction tails so the session's every commit slices the same paths.
 * @param {string} workUnit
 * @returns {string[]}
 */
function discoveryScope(workUnit) {
  return [
    `.workflows/${workUnit}/discovery/sessions`,
    `.workflows/${workUnit}/discovery/briefs`,
    `.workflows/${workUnit}/manifest.json`,
  ];
}

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
 * `commitPathspec` under the commit lock: commit exactly the named paths,
 * leaving every other process's dirty or staged files untouched.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @param {() => void} [beforeInLock] index-mutating prep (e.g. git rm) that
 *   must run inside the same commit-lock hold as the commit that lands it
 * @returns {string|null}
 */
function commitPathspecScoped(cwd, pathspec, message, beforeInLock) {
  return withCommitLock(cwd, () => {
    if (beforeInLock) beforeInLock();
    return commitPathspec(cwd, pathspec, message);
  });
}

/**
 * `commitUntrack` under the commit lock: stop tracking the named paths, the
 * files left on disk, in one commit that carries nothing else.
 * @param {string} cwd @param {string[]} paths @param {string} message
 * @returns {string|null}
 */
function commitUntrackScoped(cwd, paths, message) {
  return withCommitLock(cwd, () => commitUntrack(cwd, paths, message));
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
 * Transaction-tail commit: the state write has already landed, so a git
 * failure here (index.lock contention from a concurrent session, a hook)
 * degrades to a warning and a pending note — it never fails the verb.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @param {string[]} warnings
 * @param {() => void} [beforeInLock] index-mutating prep (e.g. git rm) that
 *   must run inside the same commit-lock hold as the commit that lands it
 * @returns {{committed: string|null, failed: boolean}}
 */
function commitTailPathspec(cwd, pathspec, message, warnings, beforeInLock) {
  try {
    return { committed: commitPathspecScoped(cwd, pathspec, message, beforeInLock), failed: false };
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
  commitPathspecScoped,
  commitTailPathspec,
  commitUntrackScoped,
  noteCommitOutcome,
  noteIfNothingCommitted,
  withCommitLock,
  discoveryScope,
  PROJECT_MANIFEST_SPEC,
};
