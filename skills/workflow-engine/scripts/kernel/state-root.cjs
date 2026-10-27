'use strict';

// ---------------------------------------------------------------------------
// Kernel: where the workflows' state lives — the one module that decides it.
//
// The state is `.leeway/` in the repository's main checkout, found through
// git's common directory from any folder in the repository or any of its
// worktrees, so every session writes the one copy and no code worktree holds
// one. The answer is memoised per folder for the life of the process.
//
// A path into the state takes one of two forms, by what it is for:
// - absolute (`statePath`), for reading and writing a file and for every
//   path the engine hands out in a response;
// - state-relative (`stateSpec`), named from the state root with no prefix,
//   for a git pathspec in the state worktree and for an identity the
//   knowledge base stores, which must not move when the checkout does.
//
// One world is read with no repository to find it through: the walkthrough's
// sample worlds, shipped inside the skills, whose own state is pinned to
// their folder (`pinStateRoot`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { mainCheckout } = require('./isolated-git.cjs');

const STATE_DIR_NAME = '.leeway';

/** @type {Map<string, string>} */
const roots = new Map();

/**
 * The state root for a folder: `.leeway/` in the main checkout of the
 * repository the folder is in — absolute, symbolic links resolved — whether
 * or not the state worktree exists there yet. Throws where there is no state
 * to find: the folder in no git repository, git not runnable, or a
 * repository with no main checkout. A read meets a missing state worktree as
 * no state; a write meets it at the writer lock, which refuses.
 * @param {string} cwd
 * @returns {string}
 */
function stateRoot(cwd) {
  const from = path.resolve(cwd);
  const known = roots.get(from);
  if (known !== undefined) return known;
  let main;
  try {
    main = mainCheckout(from);
  } catch (err) {
    throw new Error(`no workflows state for ${from}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const root = path.join(main, STATE_DIR_NAME);
  roots.set(from, root);
  return root;
}

/**
 * Answer `root` as the state root for the folder `cwd` for the life of the
 * process — a world shipped as files, read where no repository holds it.
 * @param {string} cwd @param {string} root absolute
 */
function pinStateRoot(cwd, root) {
  roots.set(path.resolve(cwd), root);
}

/**
 * The state root where the state worktree is in place, else null — never
 * throwing: the folder in no repository, or a repository whose state does
 * not exist yet, has none.
 * @param {string} cwd
 * @returns {string|null}
 */
function findStateRoot(cwd) {
  try {
    const root = stateRoot(cwd);
    return fs.existsSync(root) ? root : null;
  } catch {
    return null;
  }
}

/**
 * An absolute path in the state: the state root joined with the segments.
 * No segments names the root itself.
 * @param {string} cwd @param {...string} segments
 * @returns {string}
 */
function statePath(cwd, ...segments) {
  return path.join(stateRoot(cwd), ...segments);
}

/**
 * A state-relative path: the segments joined with `/`, as given, never
 * normalised — the form a state commit's pathspec and a stored identity
 * take. No segments names the root, `.`.
 * @param {...string} segments
 * @returns {string}
 */
function stateSpec(...segments) {
  return segments.length === 0 ? '.' : segments.join('/');
}

/**
 * An absolute path with the symbolic links in the part of it that exists
 * resolved, as the state root's are.
 * @param {string} abs
 * @returns {string}
 */
function resolvedPath(abs) {
  /** @type {string[]} */
  const missing = [];
  let at = abs;
  while (!fs.existsSync(at)) {
    const parent = path.dirname(at);
    if (parent === at) return abs;
    missing.unshift(path.basename(at));
    at = parent;
  }
  return path.join(fs.realpathSync(at), ...missing);
}

/**
 * A path given to the engine — absolute, or read from `cwd` — as the
 * state-relative path it names, `.` for the root; null where it lies outside
 * the state, a sibling whose name only begins with the state directory's
 * among them.
 * @param {string} cwd @param {string} given
 * @returns {string|null}
 */
function stateRelative(cwd, given) {
  const rel = path.relative(stateRoot(cwd), resolvedPath(path.resolve(cwd, given)));
  if (rel === '') return '.';
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

/**
 * Whether a path given to the engine is the state root — or, with segments,
 * that folder in the state — or lies inside it.
 * @param {string} cwd @param {string} given @param {...string} segments
 * @returns {boolean}
 */
function insideState(cwd, given, ...segments) {
  const rel = stateRelative(cwd, given);
  if (rel === null) return false;
  const folder = stateSpec(...segments);
  return folder === '.' || rel === folder || rel.startsWith(`${folder}/`);
}

module.exports = {
  STATE_DIR_NAME, stateRoot, pinStateRoot, findStateRoot, statePath, stateSpec, stateRelative, insideState,
};
