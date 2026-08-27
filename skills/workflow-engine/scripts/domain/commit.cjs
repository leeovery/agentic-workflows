'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's commit door. Every engine-made commit routes
// through here, for three guarantees:
//
// - Commits are confined: each one names the paths its action wrote and
//   commits `-- <paths>`, so a peer session's dirty or staged files are never
//   swept up under someone else's message. No engine commit can reach outside
//   its declared scope.
//
// - The knowledge store rides along where the action touched it: transactions
//   mutate the store (index/remove) as a side effect of manifest writes, and
//   their commit must carry that dirt. The pathspec is appended
//   exists-guarded — keyword-less projects may have no store. Transactions
//   that never call the store take the rider-less siblings; sweeping store
//   dirt an action did not create is the theft the confinement removes.
//
// - Commits are serialised: a process-wide lock (`.git/workflows-commit.lock`,
//   same discipline as the manifest lock, on a longer clock) holds each
//   add+commit sequence alone, so concurrent sessions never interleave on
//   git's shared index.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, commitPathspec } = require('../kernel/git.cjs');
const { acquireLockFile, releaseLockFile } = require('../kernel/manifest-io.cjs');

const KB_DIR = '.workflows/.knowledge';
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
 * The caller's pathspec with the knowledge store appended when it exists on
 * disk — for the transactions whose own action dirtied the store.
 * @param {string} cwd @param {string|string[]} pathspec
 * @returns {string[]}
 */
function withKbSpec(cwd, pathspec) {
  const specs = Array.isArray(pathspec) ? [...pathspec] : [pathspec];
  if (!specs.includes(KB_DIR) && fs.existsSync(path.join(cwd, KB_DIR))) {
    specs.push(KB_DIR);
  }
  return specs;
}

/**
 * `commitPathspec` under the commit lock: commit exactly the named paths,
 * leaving every other process's dirty or staged files untouched. The KB dir
 * never rides — this is the door for actions that never touched the store.
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
 * `commitPathspecScoped` with the knowledge store staged alongside the
 * caller's pathspec — the door for actions that indexed or removed chunks.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @param {() => void} [beforeInLock]
 * @returns {string|null}
 */
function commitPathspecWithKb(cwd, pathspec, message, beforeInLock) {
  return commitPathspecScoped(cwd, withKbSpec(cwd, pathspec), message, beforeInLock);
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
 * `commitTailPathspec` for a transaction that touched the knowledge store —
 * the store's dirt commits with the write that produced it.
 * @param {string} cwd @param {string|string[]} pathspec @param {string} message
 * @param {string[]} warnings
 * @param {() => void} [beforeInLock]
 * @returns {{committed: string|null, failed: boolean}}
 */
function commitTailWithKb(cwd, pathspec, message, warnings, beforeInLock) {
  try {
    return { committed: commitPathspecWithKb(cwd, pathspec, message, beforeInLock), failed: false };
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
  commitPathspecWithKb,
  commitTailPathspec,
  commitTailWithKb,
  noteCommitOutcome,
  noteIfNothingCommitted,
  withCommitLock,
  discoveryScope,
  KB_DIR,
  PROJECT_MANIFEST_SPEC,
};
