'use strict';

// ---------------------------------------------------------------------------
// Kernel: where the code is — the one module that decides the folder a
// call's code side works in: the project's Claude Code settings, its repos,
// their dirt and history, and every code commit. It is the folder the call
// runs in — a project nested in a larger repository is its own folder, never
// the repository's top — but for the state worktree, which is never code:
// from anywhere inside it the answer is the main checkout the state sits in.
// ---------------------------------------------------------------------------

const path = require('path');
const { findStateRoot, insideState } = require('./state-root.cjs');

/**
 * The code root for a folder: the folder itself, absolute, or the main
 * checkout where the folder is the state worktree or inside it.
 * @param {string} cwd
 * @returns {string}
 */
function codeRoot(cwd) {
  const from = path.resolve(cwd);
  const state = findStateRoot(from);
  return state !== null && insideState(from, from) ? path.dirname(state) : from;
}

module.exports = { codeRoot };
