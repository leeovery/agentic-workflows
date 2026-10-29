'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the layout hook — Claude Code's hook before Write, Edit and
// NotebookEdit, which refuses Claude's own write to a file the engine alone
// writes (5.4.2, 6.2, 16.13.2). Boot installs it in the project's settings
// beside the session hooks (domain/session-label), so it holds with or
// without the mod.
//
// What it refuses is `REFUSALS`, read against the target as a path in the
// state of the project the target itself is in — whatever project the
// conversation sits in — the target landing where Claude Code's tool would
// write it (kernel/state-root, `resolvedPath`): its `..` read from the text,
// its links followed, a code worktree's path into the main checkout's state
// among them. At user level it refuses, in the system config directory,
// every file whose bytes reach the trust log — the log and its lock, and
// each conversation's file of events waiting for it and that file's lock;
// each conversation's two files a gate event is built from, the gate shown
// and the gate mod's last press, which the mod writes by no tool of
// Claude's (gate.cjs); each conversation's sealed raises, which hold
// Claude's lean before the person answers (raise.cjs); the settings file and
// the record of the person; and
// in each project folder of Claude Code's projects directory, the files of
// its own the trust log reads the model from (conversation.cjs): a conversation's transcript,
// and a subagent's transcript and its record. Those it judges by the names
// the target is written with, below the nearest folder above it that is the
// guarded directory, read with its `..` from the text as the engine joins
// names to it: the same folder on disk, however it is named — through a
// link, a firmlink or in another case — or, before the directory is made,
// one that would be made where it would. No other folder is read. A write
// named through a link below the directory — a conversation's folder that
// is one among them — is refused by its names. A write that reaches a
// refused file under other names — at the place such a link leads, through
// a link from outside that leads in, or through a link below the directory
// that leads back to it, where the names start again — is not seen, as a
// write by Bash is not, and passes. Every other write is allowed — the rest
// of Claude Code's project folders, their memory among it — and so is every
// write in a project with no state but those at user level. Where the
// filesystem the target lands on ignores case, names are compared in lower
// case (`toLowerCase`), so a refused file's name in another case is refused
// as it is; a name that filesystem folds to a refused one some other way —
// `ſ` for `s` on APFS — is not seen, as a write by Bash is not, and passes.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { findStateRoot, stateRelative, resolvedPath, ignoresCase } = require('../kernel/state-root.cjs');
const { systemConfigDir } = require('../kernel/system-config.cjs');
const { systemConfigPath } = require('../kernel/knowledge/config.cjs');
const { LEDGER } = require('./ledger-events.cjs');
const { TRUST_LOG, PENDING } = require('./trust-log.cjs');
const { SHOWN, PRESSED, RAISE_SHOWN } = require('./gate.cjs');
const { claudeProjectsDir, conversationsRoot } = require('./conversation.cjs');

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
 * Each file at user level the hook refuses: its name, the folder it sits
 * below and how many names reach it from there — one in the system config
 * directory, two in a conversation's folder of the conversations directory
 * — and what it is, for the reason Claude is given.
 * @returns {{name: string, below: string, depth: number, what: string}[]}
 */
function userFiles() {
  const configFile = (/** @type {string} */ name, /** @type {string} */ what) => ({ name, below: systemConfigDir(), depth: 1, what });
  const conversationFile = (/** @type {string} */ name, /** @type {string} */ what) => ({ name, below: conversationsRoot(), depth: 2, what });
  return [
    configFile(TRUST_LOG, 'the trust log'),
    configFile(`${TRUST_LOG}.lock`, 'the trust log\'s lock'),
    conversationFile(PENDING, 'a conversation\'s file of events waiting for the trust log'),
    conversationFile(`${PENDING}.lock`, 'the lock on a conversation\'s events waiting for the trust log'),
    conversationFile(SHOWN, 'the record of the gate a conversation was shown'),
    conversationFile(PRESSED, 'the gate mod\'s record of a conversation\'s last press'),
    conversationFile(RAISE_SHOWN, 'a conversation\'s sealed raises'),
    configFile(path.basename(systemConfigPath()), 'the settings file'),
    configFile('person.md', 'the record of the person'),
  ];
}

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
 * How names are spelled on the filesystem the existing `folder` is on: in
 * lower case where it ignores case.
 * @param {string} folder @returns {(name: string) => string}
 */
function folding(folder) {
  return ignoresCase(folder) ? (name) => name.toLowerCase() : (name) => name;
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
 * Why the hook refuses a write to `file` at user level, or null where it is
 * none of the files the engine alone writes there.
 * @param {string} file as written @param {(name: string) => string} fold
 * @returns {string|null}
 */
function userRefusal(file, fold) {
  const name = fold(path.basename(file));
  const refused = userFiles().find((user) => fold(user.name) === name && namesBelow(file, user.below, fold).length === user.depth);
  return refused ? `${refused.what} (${refused.name}) changes only through the engine's commands` : null;
}

/**
 * Why the hook refuses a write to `file` among Claude Code's own files the
 * trust log reads the model from — in a project folder of its projects
 * directory, a conversation's transcript, or in a conversation's
 * `subagents/` a subagent's transcript or its record — or null where it is
 * none of them.
 * @param {string} file as written @param {(name: string) => string} fold
 * @returns {string|null}
 */
function claudeRefusal(file, fold) {
  const name = fold(path.basename(file));
  const transcript = name.endsWith('.jsonl');
  if (!transcript && !name.endsWith('.meta.json')) return null;
  const names = namesBelow(file, claudeProjectsDir(), fold);
  const what = names.length === 2 && transcript ? 'a conversation\'s transcript'
    : names.length === 4 && names[2] === 'subagents' ? `a subagent's ${transcript ? 'transcript' : 'record'}` : null;
  return what === null ? null : `${what} (${path.basename(file)}) is Claude Code's own: the trust log reads the model from it`;
}

/**
 * Why the hook refuses a write to `file` in a project's state, or null
 * where it allows it: a write outside any state, one in a state no refusal
 * takes, or any write in a project with no state.
 * @param {string} file resolved
 * @returns {string|null}
 */
function stateRefusal(file) {
  const from = nearestFolder(file);
  const root = findStateRoot(from);
  if (root === null) return null;
  const fold = folding(root);
  const rel = stateRelative(from, file);
  if (rel === null) return null;
  const refusal = REFUSALS.find(({ refuses }) => refuses(fold(rel), fold));
  return refusal ? refusal.reason : null;
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
  return userRefusal(written, fold) ?? claudeRefusal(written, fold) ?? stateRefusal(landed);
}

module.exports = { LAYOUT_HOOK_TOOLS, layoutRefusal };
