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
// worktrees, in `.claude/worktrees/` of the main checkout, each by a name
// only the engine gives (domain/project-layout): `ledger-{unit}` or
// `ledger-{unit}-{phase}.{n}` for a unit the state holds, read with one stat
// and no git, or `ledger-{kind}.{name}` for one of `LAYOUT_KINDS` — so a
// worktree of the person's own by a name like it is none of the engine's
// (`inLayout`). A call made from inside one stands for the same folder of
// the project's own checkout, the layout's part of its path taken out, or,
// where the checkout lacks that folder or holds a file there, the nearest
// folder up it holds (`outsideLayouts`), so a verb that takes the layout
// apart never carries on in the folder it took away (engine.cjs); a file
// there has its copy in the checkout at the same place (`checkoutPath`),
// the engine's own among them (kernel/call.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { STATE_DIR_NAME, findStateRoot, insideState } = require('./state-root.cjs');

/** Where Claude Code lays out its isolation worktrees in the main checkout, and the engine its own beside them. */
const LAYOUTS = '.claude/worktrees';

/** How each of the engine's own layouts there is named, before its name. */
const LAYOUT = 'ledger-';

/** The kinds of the engine's own layouts but a unit's, each named for its kind and a dot (the header's). */
const LAYOUT_KINDS = Object.freeze(/** @type {const} */ (['scratch', 'unfixed', 'mutants']));

/** @typedef {typeof LAYOUT_KINDS[number]} LayoutKind */

/** A one-line task's layout's name, its unit's name before `-{phase}.{n}`. */
const ONE_LINE = /^(.+)-[1-9][0-9]*\.[1-9][0-9]*$/;

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
 * Whether `name` is one the engine gives a layout of its own in the main
 * checkout `checkout` (the header's): its kind's and a dot, else a unit's —
 * a quick-fix's, or a one-line task's — the unit one the state holds.
 * @param {string} checkout @param {string} name
 */
function engineNamed(checkout, name) {
  const dot = name.indexOf('.');
  if (dot > 0 && /** @type {readonly string[]} */ (LAYOUT_KINDS).includes(name.slice(0, dot))) return true;
  const unit = ONE_LINE.exec(name)?.[1] ?? name;
  return fs.existsSync(path.join(checkout, STATE_DIR_NAME, unit, 'manifest.json'));
}

/**
 * Where an absolute path enters one of the engine's own layouts (the
 * header's): the main checkout the layout sits in, and the path's parts
 * below the layout; null where it enters none.
 * @param {string} abs
 * @returns {{checkout: string, below: string[]}|null}
 */
function inLayout(abs) {
  const parts = abs.split(path.sep);
  const [claude, worktrees] = LAYOUTS.split('/');
  const at = parts.findIndex((part, i) => part === claude && parts[i + 1] === worktrees && (parts[i + 2] ?? '').startsWith(LAYOUT));
  if (at < 0) return null;
  const checkout = parts.slice(0, at).join(path.sep) || path.sep;
  return engineNamed(checkout, parts[at + 2].slice(LAYOUT.length)) ? { checkout, below: parts.slice(at + 3) } : null;
}

/**
 * The folder a call made from `cwd` stands for (the header's): inside one of
 * the engine's own layouts, the same folder of the project's own checkout,
 * else — the checkout lacking it, or holding a file there — the nearest
 * folder up it holds, its top at most; else `cwd` itself, absolute.
 * @param {string} cwd
 * @returns {string}
 */
function outsideLayouts(cwd) {
  const from = path.resolve(cwd);
  const layout = inLayout(from);
  if (layout === null) return from;
  let folder = path.join(layout.checkout, ...layout.below);
  while (folder !== layout.checkout && !isFolder(folder)) folder = path.dirname(folder);
  return folder;
}

/** Whether a folder stands at `at`. @param {string} at */
const isFolder = (at) => fs.statSync(at, { throwIfNoEntry: false })?.isDirectory() === true;

/**
 * A file inside one of the engine's own layouts at the same place in the
 * project's own checkout (the header's), there or not; null for a file
 * inside none.
 * @param {string} file
 * @returns {string|null}
 */
function checkoutPath(file) {
  const layout = inLayout(path.resolve(file));
  return layout === null ? null : path.join(layout.checkout, ...layout.below);
}

module.exports = { LAYOUTS, LAYOUT, LAYOUT_KINDS, codeRoot, outsideLayouts, checkoutPath };
