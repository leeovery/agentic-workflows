'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the layout hook — Claude Code's hook before Write, Edit and
// NotebookEdit, which refuses Claude's own write to a file in the state that
// the engine alone writes (5.4.2, 6.2). Boot installs it in the project's
// settings beside the session hooks (domain/session-label), so it holds with
// or without the mod.
//
// What it refuses is `REFUSALS`, read against the target as a path in the
// state of the project the target itself is in — whatever project the
// conversation sits in; everything else is allowed, and so is everything in
// a project with no state. The target lands where Claude Code's tool would
// write it (kernel/state-root, `resolvedPath`): its `..` read from the text,
// its links followed, a code worktree's path into the main checkout's state
// among them, so no route to a refused file gets past. On a filesystem that
// ignores case, neither does a spelling of it in another case.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { findStateRoot, stateRelative, resolvedPath, ignoresCase } = require('../kernel/state-root.cjs');
const { LEDGER } = require('./ledger-events.cjs');

/** The tools the hook stands before, as the settings' matcher names them. */
const LAYOUT_HOOK_TOOLS = ['Write', 'Edit', 'NotebookEdit'];

/**
 * Each refusal: whether it takes a path in the state, named from the state
 * root, and the reason Claude is given. `fold` spells a name as the target's
 * path is spelled — in lower case where the filesystem ignores case.
 * @type {readonly {refuses: (rel: string, fold: (name: string) => string) => boolean, reason: string}[]}
 */
const REFUSALS = Object.freeze([
  { refuses: (rel, fold) => rel === fold(LEDGER), reason: `the ledger (${LEDGER}) changes only through the engine's commands` },
]);

/**
 * The file a tool call writes, from the hook's input: Write's and Edit's
 * `file_path`, NotebookEdit's `notebook_path`. Null where neither is there.
 * @param {Record<string, unknown>} input
 * @returns {string|null}
 */
function targetOf(input) {
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return null;
  const { file_path: file, notebook_path: notebook } = /** @type {Record<string, unknown>} */ (toolInput);
  const target = typeof file === 'string' ? file : notebook;
  return typeof target === 'string' && target !== '' ? target : null;
}

/** The nearest folder above a path that exists. @param {string} abs */
function nearestFolder(abs) {
  let at = path.dirname(abs);
  while (!fs.existsSync(at) && path.dirname(at) !== at) at = path.dirname(at);
  return at;
}

/**
 * Why the hook refuses the tool call `input` describes, or null where it
 * allows it: a write outside any state, one in a state no refusal takes, or
 * any write in a project with no state. A relative target is read from
 * `cwd`, the conversation's folder.
 * @param {string} cwd @param {Record<string, unknown>} input the hook's stdin JSON
 * @returns {string|null}
 */
function layoutRefusal(cwd, input) {
  const target = targetOf(input);
  if (target === null) return null;
  const file = resolvedPath(cwd, target);
  const from = nearestFolder(file);
  const root = findStateRoot(from);
  if (root === null) return null;
  const fold = ignoresCase(root) ? (/** @type {string} */ name) => name.toLowerCase() : (/** @type {string} */ name) => name;
  const rel = stateRelative(from, file);
  if (rel === null) return null;
  const refusal = REFUSALS.find(({ refuses }) => refuses(fold(rel), fold));
  return refusal ? refusal.reason : null;
}

module.exports = { LAYOUT_HOOK_TOOLS, layoutRefusal };
