'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the layout hook — Claude Code's hook before Write, Edit and
// NotebookEdit, which refuses Claude's own write under `.leeway/` outside the
// layout, and to a file the engine alone writes (5.4.2, 6.2, 16.13.2). Boot
// installs it in the project's settings beside the session hooks
// (domain/session-label), so it holds with or without the mod.
//
// In the state it refuses a path the layout has no place for, and a file
// only the engine writes, naming the verb that writes it where one does
// (layout.cjs). It reads the target as a path in the state of the project
// the target itself is in — whatever project the conversation sits in —
// landing where Claude Code's tool would write it (kernel/state-root,
// `resolvedPath`): its `..` read from the text, its links followed, a code
// worktree's path into the main checkout's state among them. At user level
// it refuses the files only the engine writes, as the hook before Bash does
// (user-files.cjs, `userLevelRefusal`): the trust log and every file whose
// bytes reach it, the gate's records, the sealed raises, a conversation's
// briefs, the settings file and the record of the person, and Claude Code's
// own transcripts and records the trust log reads the model from. Those it
// judges by the names the target is written with, below the nearest folder
// above it that is the guarded directory, read with its `..` from the text
// as the engine joins names to it: the same folder on disk, however it is
// named — through a link, a firmlink or in another case — or, before the
// directory is made, one that would be made where it would. No other folder
// is read. A write named through a link below the directory —
// a conversation's folder that is one among them — is refused by its names.
// A write that reaches a refused file under other names — at the place such
// a link leads, through a link from outside that leads in, or through a
// link below the directory that leads back to it, where the names start
// again — is not seen, as a write by Bash is not, and passes. Every other
// write outside the state is allowed — the rest of Claude Code's project
// folders, their memory among it — and so is every write in a project with
// no state but those at user level. Where the filesystem the target lands
// on ignores case, names are compared in lower case (`toLowerCase`), so a
// refused file's name in another case is refused as it is, and a place in
// the layout named in another case is that place; a name that filesystem
// folds to a refused one some other way — `ſ` for `s` on APFS — is not
// seen, as a write by Bash is not, and passes.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { STATE_DIR_NAME, findStateRoot, stateRelative, resolvedPath } = require('../kernel/state-root.cjs');
const { userLevelRefusal } = require('./user-files.cjs');
const { folding, layoutPlace, engineRefusal } = require('./layout.cjs');

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

/** The folder or file at `at` on disk, by device and inode; null where none is. @param {string} at */
function onDisk(at) {
  try {
    const { dev, ino } = fs.statSync(at);
    return `${dev}:${ino}`;
  } catch {
    return null;
  }
}

/**
 * Where a folder not made yet would be made: the nearest folder above where
 * it lands that is made, on disk, and the names below it, spelled by `fold`.
 * @param {string} at @param {(name: string) => string} fold
 */
function unmadePlace(at, fold) {
  const landed = resolvedPath(process.cwd(), at);
  const made = nearestFolder(landed);
  return `${onDisk(made)}/${fold(path.relative(made, landed))}`;
}

/**
 * Whether a folder is the folder `root`, its `..` read from the text: the
 * same on disk, or where `root` is not made yet, one not made either that
 * would be made where it would.
 * @param {string} root @param {(name: string) => string} fold
 * @returns {(at: string) => boolean}
 */
function isFolder(root, fold) {
  const made = onDisk(path.resolve(root));
  if (made !== null) return (at) => onDisk(at) === made;
  const place = unmadePlace(root, fold);
  return (at) => onDisk(at) === null && unmadePlace(at, fold) === place;
}

/**
 * The names that reach `file` from the folder `root`, as `file` is written
 * below the nearest folder above it that is `root`, spelled by `fold`; none
 * where no folder above it is.
 * @param {string} file absolute @param {string} root @param {(name: string) => string} fold
 * @returns {string[]}
 */
function namesBelow(file, root, fold) {
  const isRoot = isFolder(root, fold);
  for (let at = path.dirname(file); ; at = path.dirname(at)) {
    if (isRoot(at)) return fold(path.relative(at, file)).split(path.sep);
    if (path.dirname(at) === at) return [];
  }
}

/**
 * Why the hook refuses a write to the state-relative `rel`, or null where
 * the layout has a place for it that is not the engine's alone.
 * @param {string} rel @param {(name: string) => string} fold
 * @returns {string|null}
 */
function placeRefusal(rel, fold) {
  const at = layoutPlace(rel, fold);
  if (at === null) return `${STATE_DIR_NAME}/${rel} is outside the workflows' layout — the state holds only the places the workflows keep; scratch goes in ${STATE_DIR_NAME}/.cache/`;
  return engineRefusal(at, rel);
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
  return rel === null ? null : placeRefusal(rel, folding(root));
}

/**
 * Why the hook refuses the tool call `input` describes, or null where it
 * allows it. A relative target is read from `cwd`, the conversation's
 * folder; its names are spelled as the filesystem it lands on reads them.
 * @param {string} cwd @param {Record<string, unknown>} input the hook's stdin JSON
 * @returns {string|null}
 */
function layoutRefusal(cwd, input) {
  const target = targetOf(input);
  if (target === null) return null;
  const [written, landed] = [path.resolve(cwd, target), resolvedPath(cwd, target)];
  const fold = folding(nearestFolder(landed));
  return userLevelRefusal(written, fold, (file, root) => namesBelow(file, root, fold)) ?? stateRefusal(landed);
}

module.exports = { LAYOUT_HOOK_TOOLS, layoutRefusal };
