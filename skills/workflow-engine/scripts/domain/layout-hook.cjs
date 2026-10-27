'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the layout hook — Claude Code's hook before Write, Edit and
// NotebookEdit, which refuses Claude's own write to a file in the state that
// the engine alone writes (5.4.2, 6.2). Boot installs it in the project's
// settings beside the session hooks (domain/session-label), so it holds with
// or without the mod.
//
// What it refuses is `REFUSALS`, read against the target as a path in the
// state; everything else is allowed, and so is everything in a project with
// no state. The target is resolved the way the filesystem takes it — from a
// code worktree, through symbolic links and `..` (kernel/state-root,
// `stateRelative`) — so no route to a refused file gets past.
// ---------------------------------------------------------------------------

const { findStateRoot, stateRelative } = require('../kernel/state-root.cjs');
const { LEDGER } = require('./state-merge-rules.cjs');

/** The tools the hook stands before, as the settings' matcher names them. */
const LAYOUT_HOOK_TOOLS = ['Write', 'Edit', 'NotebookEdit'];

/**
 * Each refusal: whether it takes a path in the state, named from the state
 * root, and the reason Claude is given.
 * @type {readonly {refuses: (rel: string) => boolean, reason: string}[]}
 */
const REFUSALS = Object.freeze([
  { refuses: (rel) => rel === LEDGER, reason: `the ledger (${LEDGER}) changes only through the engine's commands` },
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

/**
 * Why the hook refuses the tool call `input` describes, read from `cwd` —
 * the conversation's folder — or null where it allows it: a write outside
 * the state, one in the state no refusal takes, or any write in a project
 * with no state.
 * @param {string} cwd @param {Record<string, unknown>} input the hook's stdin JSON
 * @returns {string|null}
 */
function layoutRefusal(cwd, input) {
  const target = targetOf(input);
  if (target === null || findStateRoot(cwd) === null) return null;
  const rel = stateRelative(cwd, target);
  if (rel === null) return null;
  const refusal = REFUSALS.find(({ refuses }) => refuses(rel));
  return refusal ? refusal.reason : null;
}

module.exports = { LAYOUT_HOOK_TOOLS, layoutRefusal };
