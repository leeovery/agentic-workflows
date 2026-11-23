'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the layout hook — Claude Code's hook before Write, Edit and
// NotebookEdit, which refuses Claude's own write under `.ledger/` outside the
// layout, to the ledger or a manifest, and to a concluded spec (6.2). Boot
// installs it in the project's settings beside the session hooks
// (domain/session-label), so it holds with or without the mod.
//
// In the state it refuses a path the layout has no place for — a `file`
// place's `.txt` staging beside it passing as the place (layout.cjs,
// `stagedPlace`) — the ledger and the manifests, which only the engine
// writes, naming the verb that writes each (layout.cjs); and a unit's
// `spec.md` once its spec is concluded, never corrected after (11.9.1,
// spec-standing.cjs). It reads the target as a path in the state of the
// project the target itself is in — whatever project the conversation sits
// in — landing where Claude Code's tool would write it (kernel/state-root,
// `resolvedPath`): its `..` read from the text, its links followed, a code
// worktree's path into the main checkout's state among them. Every write
// outside the state is allowed, and so is every write in a project with no
// state. Where the filesystem the state is on ignores case, names are
// compared in lower case, so a place in the layout named in another case is
// that place.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { STATE_DIR_NAME, findStateRoot, stateRelative, resolvedPath } = require('../kernel/state-root.cjs');
const {
  SPEC_PLACE, folding, layoutPlace, stagedPlace, engineRefusal,
} = require('./layout.cjs');

/** The tools the hook stands before, as the settings' matcher names them. */
const LAYOUT_HOOK_TOOLS = ['Write', 'Edit', 'NotebookEdit'];

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
 * Why the hook refuses a write to the state-relative `rel` as a concluded
 * unit's spec, or null where it is no unit's spec or one not concluded. The
 * state is read from `from`, a folder in it.
 * @param {string} from @param {string} rel
 * @returns {string|null}
 */
function concludedRefusal(from, rel) {
  const unit = rel.split('/')[0];
  // Loaded for a write to a spec alone: the hook runs before every write.
  const { specStanding } = require('./spec-standing.cjs');
  if (specStanding(from, unit) !== 'concluded') return null;
  return `${STATE_DIR_NAME}/${rel} is ${unit}'s concluded spec, never corrected — a later change replaces its entry on the ledger`;
}

/**
 * Why the hook refuses a write to the state-relative `rel`, or null where
 * the layout has a place for it that is not the engine's alone, nor a
 * concluded spec. The state is read from `from`, a folder in it.
 * @param {string} from @param {string} rel @param {(name: string) => string} fold
 * @returns {string|null}
 */
function placeRefusal(from, rel, fold) {
  const at = layoutPlace(rel, fold) ?? stagedPlace(rel, fold);
  if (at === null) return `${STATE_DIR_NAME}/${rel} is outside Ledger's layout — the state holds only the places Ledger keeps; scratch goes in ${STATE_DIR_NAME}/.cache/`;
  return at.path === SPEC_PLACE ? concludedRefusal(from, rel) : engineRefusal(at, rel);
}

/**
 * Why the hook refuses a write to `file` in a project's state, or null
 * where it allows it: a write outside any state, one to a place in the
 * layout that is not the engine's alone, or any write in a project with no
 * state.
 * @param {string} file resolved
 * @returns {string|null}
 */
function stateRefusal(file) {
  const from = nearestFolder(file);
  const root = findStateRoot(from);
  if (root === null) return null;
  const rel = stateRelative(from, file);
  return rel === null ? null : placeRefusal(from, rel, folding(root));
}

/**
 * Why the hook refuses the tool call `input` describes, or null where it
 * allows it. A relative target is read from `cwd`, the conversation's
 * folder.
 * @param {string} cwd @param {Record<string, unknown>} input the hook's stdin JSON
 * @returns {string|null}
 */
function layoutRefusal(cwd, input) {
  const target = targetOf(input);
  return target === null ? null : stateRefusal(resolvedPath(cwd, target));
}

module.exports = { LAYOUT_HOOK_TOOLS, layoutRefusal };
