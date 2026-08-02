'use strict';

// ---------------------------------------------------------------------------
// Kernel: scoped git operations — stage a pathspec, commit, report the sha.
//
// Mechanism only: it knows nothing about work units or the inbox. Every call
// spawns `git` with an explicit cwd (the project root). Failures throw loud
// with git's own stderr; a clean index is not a failure — `commitScoped`
// reports it as `null` so callers can treat an empty pause as fine.
//
// Index-mutating operations (add, commit, rm) retry on `index.lock`
// contention — another process (a concurrent session, the user) holding
// git's own lock is transient, not fatal. The retry budget is short; a
// holder that outlives it surfaces git's original error.
// ---------------------------------------------------------------------------

const { spawnSync } = require('child_process');

const INDEX_RETRY_MS = 100;
const INDEX_BUDGET_MS = 5000;

// Block the thread for `ms` without burning CPU (Atomics.wait on a
// throwaway buffer is never notified, so it sleeps the full timeout).
/** @param {number} ms */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Test hook: WORKFLOWS_GIT_LOCK_BUDGET_MS overrides the retry budget.
function indexBudgetMs() {
  const env = Number(process.env.WORKFLOWS_GIT_LOCK_BUDGET_MS);
  return Number.isFinite(env) && env > 0 ? env : INDEX_BUDGET_MS;
}

/**
 * Run git and return stdout. Throws with git's stderr on a non-zero exit.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.error) throw new Error(`git ${args[0]} failed: ${res.error.message}`);
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || `exit ${res.status}`).trim();
    throw new Error(`git ${args[0]} failed: ${detail}`);
  }
  return res.stdout;
}

/** @param {string} message */
function isIndexLockError(message) {
  return message.includes('index.lock') &&
    /file exists|unable to create/i.test(message);
}

/**
 * Run an index-mutating git operation, retrying while another process holds
 * `.git/index.lock`.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function gitIndexed(cwd, args) {
  const deadline = Date.now() + indexBudgetMs();
  while (true) {
    try {
      return git(cwd, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isIndexLockError(message) || Date.now() >= deadline) throw err;
      sleepSync(INDEX_RETRY_MS);
    }
  }
}

/**
 * Whether the index holds staged changes against HEAD.
 * @param {string} cwd
 * @returns {boolean}
 */
function hasStagedChanges(cwd) {
  const res = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd, encoding: 'utf8' });
  if (res.error) throw new Error(`git diff failed: ${res.error.message}`);
  if (res.status === 0) return false;
  if (res.status === 1) return true;
  throw new Error(`git diff failed: ${(res.stderr || `exit ${res.status}`).trim()}`);
}

/**
 * Whether the given pathspecs differ from HEAD (worktree or index).
 * @param {string} cwd
 * @param {string[]} specs
 * @returns {boolean}
 */
function hasChangesInPaths(cwd, specs) {
  return git(cwd, ['status', '--porcelain', '--', ...specs]).trim() !== '';
}

/**
 * Stage one or more pathspecs and commit with the given message. The commit
 * itself takes the whole index — anything another process staged rides
 * along. Use `commitPathspec` when the commit must be confined to the named
 * paths.
 * @param {string} cwd      project root
 * @param {string|string[]} pathspec e.g. `.workflows/{wu}` or `.workflows/.inbox`
 * @param {string} message
 * @returns {string|null} the short commit sha, or null when nothing was staged
 */
function commitScoped(cwd, pathspec, message) {
  const specs = Array.isArray(pathspec) ? pathspec : [pathspec];
  gitIndexed(cwd, ['add', '--', ...specs]);
  if (!hasStagedChanges(cwd)) return null;
  gitIndexed(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
}

/**
 * Commit exactly the named pathspecs — `git commit -- <paths>` builds a
 * temporary index from HEAD plus the worktree content of those paths, so
 * other processes' dirty or staged files are ignored and left untouched.
 * The `add` catches untracked files among the paths. Every pathspec must
 * exist on disk or hold index entries — `git add` refuses a pathspec that
 * matches nothing; callers exists-guard.
 * @param {string} cwd      project root
 * @param {string|string[]} pathspec
 * @param {string} message
 * @returns {string|null} the short commit sha, or null when the paths are clean
 */
function commitPathspec(cwd, pathspec, message) {
  const specs = Array.isArray(pathspec) ? pathspec : [pathspec];
  gitIndexed(cwd, ['add', '--', ...specs]);
  if (!hasChangesInPaths(cwd, specs)) return null;
  gitIndexed(cwd, ['commit', '-m', message, '--', ...specs]);
  return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
}

/**
 * `git rm` the given files (stages the deletions). One call — git validates
 * every pathspec before removing anything.
 * @param {string} cwd
 * @param {string[]} paths
 */
function removeFiles(cwd, paths) {
  gitIndexed(cwd, ['rm', '-q', '--', ...paths]);
}

module.exports = { git, commitScoped, commitPathspec, hasStagedChanges, removeFiles };
