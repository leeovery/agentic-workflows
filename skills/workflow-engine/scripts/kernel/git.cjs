'use strict';

// ---------------------------------------------------------------------------
// Kernel: scoped git operations — stage a pathspec, commit, report the sha.
//
// Mechanism only: it knows nothing about work units or the inbox. Every call
// spawns `git` with an explicit cwd (the project root). Failures throw loud
// with git's own stderr; a clean index is not a failure — `commitScoped`
// reports it as `null` so callers can treat an empty pause as fine.
// ---------------------------------------------------------------------------

const { spawnSync } = require('child_process');

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
 * Stage one or more pathspecs and commit with the given message.
 * @param {string} cwd      project root
 * @param {string|string[]} pathspec e.g. `.workflows/{wu}` or `.workflows/.inbox`
 * @param {string} message
 * @returns {string|null} the short commit sha, or null when nothing was staged
 */
function commitScoped(cwd, pathspec, message) {
  const specs = Array.isArray(pathspec) ? pathspec : [pathspec];
  git(cwd, ['add', '--', ...specs]);
  if (!hasStagedChanges(cwd)) return null;
  git(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
}

/**
 * `git rm` the given files (stages the deletions). One call — git validates
 * every pathspec before removing anything.
 * @param {string} cwd
 * @param {string[]} paths
 */
function removeFiles(cwd, paths) {
  git(cwd, ['rm', '-q', '--', ...paths]);
}

module.exports = { git, commitScoped, hasStagedChanges, removeFiles };
