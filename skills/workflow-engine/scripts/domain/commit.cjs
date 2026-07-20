'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's commit door. Every engine-made commit routes
// through here so the knowledge store rides along: transactions mutate the
// store (index/remove) as a side effect of manifest writes, and a commit
// that staged only the work unit would leave `.workflows/.knowledge` dirty
// for some later, unrelated commit to sweep up. The pathspec is appended
// exists-guarded — staging a nonexistent path is a git error (the
// conditional-inbox lesson), and keyword-less projects may have no store.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { commitScoped } = require('../kernel/git.cjs');

const KB_DIR = '.workflows/.knowledge';

/**
 * `commitScoped` with the knowledge store staged alongside the caller's
 * pathspec whenever it exists on disk. Same contract: short sha, or null
 * when nothing was staged.
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
  return commitScoped(cwd, specs, message);
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

module.exports = { commitScopedWithKb, noteIfNothingCommitted, KB_DIR };
