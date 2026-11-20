'use strict';

// ---------------------------------------------------------------------------
// Kernel: where the code is — the one module that decides the folder a
// call's code side works in: the project's Claude Code settings, its repos,
// their dirt and history, and every code commit. It is the folder the call
// runs in — a project nested in a larger repository is its own folder, never
// the repository's top — but for the state worktree, which is never code:
// from anywhere inside it the answer is the main checkout the state sits in.
//
// The engine lays its own worktrees out beside Claude Code's isolation
// worktrees, in `.claude/worktrees/` of the main checkout, each named
// `ledger-…` (domain/project-layout). A call made from inside one stands for
// the same folder of the project's own checkout (`outsideLayouts`), the
// layout's part of its path taken out, so a verb that takes the layout apart
// never carries on in the folder it took away (engine.cjs).
// ---------------------------------------------------------------------------

const path = require('path');
const { findStateRoot, insideState } = require('./state-root.cjs');

/** Where Claude Code lays out its isolation worktrees in the main checkout, and the engine its own beside them. */
const LAYOUTS = '.claude/worktrees';

/** How each of the engine's own layouts there is named, before its name. */
const LAYOUT = 'ledger-';

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

/**
 * Where a folder's path enters one of the engine's own layouts: the index of
 * its `.claude` part, followed by `worktrees` and a `ledger-…` folder; -1
 * where it enters none.
 * @param {string[]} parts a path's parts, split on the separator
 */
function layoutAt(parts) {
  const [claude, worktrees] = LAYOUTS.split('/');
  return parts.findIndex((part, at) => part === claude && parts[at + 1] === worktrees && (parts[at + 2] ?? '').startsWith(LAYOUT));
}

/**
 * The folder a call made from `cwd` stands for (the header's): inside one of
 * the engine's own layouts, the same folder of the project's own checkout;
 * else `cwd` itself, absolute.
 * @param {string} cwd
 * @returns {string}
 */
function outsideLayouts(cwd) {
  const parts = path.resolve(cwd).split(path.sep);
  const at = layoutAt(parts);
  return at < 0 ? parts.join(path.sep) : path.join(parts.slice(0, at).join(path.sep) || path.sep, ...parts.slice(at + 3));
}

module.exports = { LAYOUTS, LAYOUT, codeRoot, outsideLayouts };
