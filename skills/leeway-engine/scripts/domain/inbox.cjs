'use strict';

// ---------------------------------------------------------------------------
// Domain ring: inbox transactions — archive, restore, delete as single
// transactions over one or more inbox items. Every path is validated against
// the exact inbox layout before anything moves; one scoped commit covers the
// whole set, with the message form the inbox history already uses
// (`archive {slug}` for one item, `archive {N} items` for several).
//
// In the state, state-relative:
//   live:     .inbox/{ideas|bugs|quickfixes}/{file}.md
//   archived: .inbox/.archived/{ideas|bugs|quickfixes}/{file}.md
//
// A path given is read from the caller's folder, absolute as the engine
// hands paths out; a path answered is absolute.
//
// `inbox file <unit> --file <item.json>` files an out-of-scope finding of
// the unit's review phase to the inbox (6.1.15, 14.3.5): Claude's item,
// `{kind, text, call}` — its kind, `idea`, `bug` or `quick-fix`; its text,
// markdown opening on its title, `# Title`; and the ledger's file-or-drop
// call that filed it, a current decision of Claude's own at `{unit}.review`
// (14.3.7, review-phase.cjs), so every filing is one engine call away.
// It is written at `.inbox/{folder}/{YYYY-MM-DD}--{slug}.md`, today's date
// and its title's slug, and committed. It refuses, writing nothing, a unit
// whose review phase cannot be entered (review-entry.cjs), a payload of
// another shape, a text with no title, a call that is none of those, and
// an item already there.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { statePath, stateRelative, stateRoot } = require('../kernel/state-root.cjs');
const { filled, shaped, readPayload, refusing } = require('./staged-payload.cjs');
const { todayStamp } = require('./dates.cjs');
const { slugOf } = require('./landing-names.cjs');

const INBOX = '.inbox';
const ARCHIVED = `${INBOX}/.archived`;
const FOLDERS = ['ideas', 'bugs', 'quickfixes'];

/** Where a folder's declined items wait. @param {string} folder @returns {string} state-relative */
function archivedDir(folder) {
  return `${ARCHIVED}/${folder}`;
}

/** @typedef {'idea'|'bug'|'quick-fix'} ItemKind */

// Each folder's kind of item — the one home of the kind vocabulary, which
// the inbox lists and the roadmap's items share.
const FOLDER_KIND = /** @type {Record<string, ItemKind>} */ ({ ideas: 'idea', bugs: 'bug', quickfixes: 'quick-fix' });

/** The `source` tag a landed seed carries, per inbox folder. */
const SEED_SOURCES = /** @type {Record<string, string>} */ ({ ideas: 'inbox:idea', bugs: 'inbox:bug', quickfixes: 'inbox:quickfix' });

/** The `source` tag of a seed copied from a roadmap item's note, before the item's name. */
const ROADMAP_SEED = 'roadmap:';

/**
 * @typedef {object} InboxItem
 * @property {string} rel     the path in the state, state-relative
 * @property {string} folder  ideas | bugs | quickfixes
 * @property {string} file    file name
 * @property {string} slug    file name minus the date prefix and extension
 */

/**
 * Validate one inbox path against the expected layout. Loud on anything
 * outside it — outside the state, the wrong store, an unknown folder,
 * nesting.
 * @param {string} cwd
 * @param {string} given absolute, or from `cwd`
 * @param {{archived: boolean}} opts whether the path must be under `.archived/`
 * @returns {InboxItem}
 */
function parseInboxPath(cwd, given, { archived }) {
  const rel = stateRelative(cwd, given);
  const segs = rel === null ? [] : rel.split('/');
  const root = archived ? ARCHIVED : INBOX;
  const depth = root.split('/').length + 2;
  const ok =
    segs.length === depth &&
    segs.slice(0, depth - 2).join('/') === root &&
    FOLDERS.includes(segs[depth - 2]) &&
    segs[depth - 1].endsWith('.md');
  if (!ok) {
    const expected = statePath(cwd, `${root}/{${FOLDERS.join('|')}}/{file}.md`);
    throw new Error(`not ${archived ? 'an archived' : 'a live'} inbox path (expected ${expected}): "${given}"`);
  }
  const file = segs[depth - 1];
  return {
    rel: segs.join('/'),
    folder: segs[depth - 2],
    file,
    slug: file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}--/, ''),
  };
}

/**
 * Parse and existence-check every path before anything moves.
 * @param {string} cwd @param {string[]} paths @param {{archived: boolean}} opts
 * @returns {InboxItem[]}
 */
function parseInboxPaths(cwd, paths, opts) {
  const items = paths.map((p) => parseInboxPath(cwd, p, opts));
  // Refuse duplicates here, before anything moves: two paths naming the same
  // file both pass existence, then the second `renameSync` hits ENOENT after
  // the first move already applied — a half-done, uncommitted transaction.
  const seen = new Set();
  for (const item of items) {
    const at = statePath(cwd, item.rel);
    if (seen.has(item.rel)) {
      throw new Error(`duplicate inbox path: "${at}"`);
    }
    seen.add(item.rel);
    if (!fs.existsSync(at)) {
      throw new Error(`inbox file not found: "${at}"`);
    }
  }
  return items;
}

/** `archive {slug}` for one item, `archive {N} items` for several. @param {string} verb @param {InboxItem[]} items */
function commitMessage(verb, items) {
  const what = items.length === 1 ? items[0].slug : `${items.length} items`;
  return `workflow(inbox): ${verb} ${what}`;
}

/**
 * Refuse any move whose destination is already taken — run before the first
 * file moves, so a refusal leaves every file where it was.
 * @param {string} cwd @param {{from: string, to: string}[]} moves state-relative
 */
function refuseTakenDestinations(cwd, moves) {
  for (const { to } of moves) {
    if (fs.existsSync(statePath(cwd, to))) {
      throw new Error(`destination already exists: "${statePath(cwd, to)}"`);
    }
  }
}

/**
 * @typedef {object} StrandedMove
 * @property {string} from  where the file belongs
 * @property {string} to    where it was left
 * @property {unknown} error  why it could not be put back
 */

/**
 * Move each file to its destination, creating the destination's directory.
 * All or nothing: a move that throws puts every file already moved back
 * (`undoMoves`), then rethrows that move's error.
 * @param {string} cwd @param {{from: string, to: string}[]} moves state-relative
 */
function moveFiles(cwd, moves) {
  /** @type {{from: string, to: string}[]} */
  const done = [];
  try {
    for (const move of moves) {
      fs.mkdirSync(path.dirname(statePath(cwd, move.to)), { recursive: true });
      fs.renameSync(statePath(cwd, move.from), statePath(cwd, move.to));
      done.push(move);
    }
  } catch (err) {
    throw undoMoves(cwd, done, err);
  }
}

/**
 * Put moved files back where they were, last moved first, every reversal
 * attempted. Any that fail ride `err` as `stranded`, absolute, and are named
 * in its message, so the first failure is never lost. Returns `err`.
 * @param {string} cwd @param {{from: string, to: string}[]} done state-relative, as moved
 * @param {unknown} err the failure that called for the undo
 * @returns {unknown}
 */
function undoMoves(cwd, done, err) {
  /** @type {StrandedMove[]} */
  const stranded = [];
  for (const move of [...done].reverse()) {
    try {
      fs.renameSync(statePath(cwd, move.to), statePath(cwd, move.from));
    } catch (error) {
      stranded.push({ from: statePath(cwd, move.from), to: statePath(cwd, move.to), error });
    }
  }
  if (stranded.length > 0 && err instanceof Error) attachStranded(err, stranded);
  return err;
}

/** @param {Error & {stranded?: StrandedMove[]}} err @param {StrandedMove[]} stranded */
function attachStranded(err, stranded) {
  const named = stranded.map((s) => `"${s.to}" (belongs at "${s.from}")`).join(', ');
  err.message += ` — and ${stranded.length === 1 ? 'a file' : `${stranded.length} files`} could not be put back: ${named}`;
  err.stranded = stranded;
}

/**
 * Move every item to its destination (collision-checked first), then commit
 * the whole set scoped to the inbox.
 * @param {string} cwd @param {InboxItem[]} items
 * @param {(item: InboxItem) => string} destDir relative destination directory per item
 * @param {string} verb commit-message verb
 * @returns {{moved: string[], committed: string|null}}
 */
function moveAndCommit(cwd, items, destDir, verb) {
  const moves = items.map((item) => ({ from: item.rel, to: `${destDir(item)}/${item.file}` }));
  refuseTakenDestinations(cwd, moves);
  moveFiles(cwd, moves);
  const moved = moves.map((m) => statePath(cwd, m.to));
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, INBOX, commitMessage(verb, items), warnings);
  return committedResult({ moved, committed: outcome.committed }, outcome, warnings);
}

/**
 * A transaction's result with its commit's outcome: the warnings where there
 * are any, and the note a failed commit leaves.
 * @template {{committed: string|null, note?: string, warnings?: string[]}} R
 * @param {R} result @param {{committed: string|null, failed: boolean}} outcome @param {string[]} warnings
 * @returns {R}
 */
function committedResult(result, outcome, warnings) {
  if (warnings.length > 0) result.warnings = warnings;
  if (outcome.failed) noteCommitOutcome(result, outcome);
  return result;
}

/**
 * Archive live inbox items into `.archived/{folder}/`. One commit for the set.
 * @param {string} cwd project root
 * @param {string[]} paths live inbox paths
 * @returns {{archived: string[], committed: string|null}}
 */
function archiveItems(cwd, paths) {
  const items = parseInboxPaths(cwd, paths, { archived: false });
  const { moved, ...rest } = moveAndCommit(cwd, items, (i) => archivedDir(i.folder), 'archive');
  return { archived: moved, ...rest };
}

/**
 * Restore archived items back to their live folders. One commit for the set.
 * @param {string} cwd project root
 * @param {string[]} paths archived inbox paths
 * @returns {{restored: string[], committed: string|null}}
 */
function restoreItems(cwd, paths) {
  const items = parseInboxPaths(cwd, paths, { archived: true });
  const { moved, ...rest } = moveAndCommit(cwd, items, (i) => `${INBOX}/${i.folder}`, 'restore');
  return { restored: moved, ...rest };
}

/**
 * Permanently delete archived items. One commit for the set. Live-folder
 * paths are rejected — delete only operates on `.archived/`.
 * @param {string} cwd project root
 * @param {string[]} paths archived inbox paths
 * @returns {{deleted: string[], committed: string|null}}
 */
function deleteItems(cwd, paths) {
  const items = parseInboxPaths(cwd, paths, { archived: true });
  const deleted = items.map((i) => statePath(cwd, i.rel));
  for (const file of deleted) fs.rmSync(file);
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, INBOX, commitMessage('delete', items), warnings);
  return committedResult({ deleted, committed: outcome.committed }, outcome, warnings);
}

/** Each kind of item by the folder it is filed in. */
const KIND_FOLDER = Object.freeze(Object.fromEntries(Object.entries(FOLDER_KIND).map(([folder, kind]) => [kind, folder])));

/**
 * `inbox file`: an out-of-scope finding of the unit's review phase filed
 * to the inbox, and committed (the header's).
 * @param {string} cwd @param {string} unit @param {string} file
 * @returns {{filed: string, committed: string|null}}
 */
function fileItem(cwd, unit, file) {
  // Required here: the ledger's and the review phase's modules reach this
  // one through the handoff, and the start's reads it.
  const { reviewRefusal } = require('./review-entry.cjs');
  const { titleOf } = require('./start.cjs');
  const { reviewCallFault } = require('./review-phase.cjs');
  const { readShown } = require('./ledger-read.cjs');
  const { unitInProgress } = require('./topic-standing.cjs');
  const { reading } = require('./phase-checks.cjs');
  const said = 'inbox file';
  const refused = refusing(said, () => reviewRefusal(reading(cwd, unit, unitInProgress(cwd, unit))));
  if (refused !== null) throw new Error(`${said}: ${refused}`);
  const item = refusing(said, () => shaped(readPayload(cwd, file), 'the item', ['kind', 'text', 'call']));
  const { kind, text, call } = item;
  /** @type {string[]} */
  const faults = [];
  if (typeof kind !== 'string' || !Object.hasOwn(KIND_FOLDER, kind)) faults.push(`its kind is one of ${Object.keys(KIND_FOLDER).join(', ')}, not ${JSON.stringify(kind)}`);
  const title = filled(text) ? titleOf(text) : null;
  if (title === null) faults.push('its text holds its title, `# Title`');
  /** @type {string[]} */
  const warnings = [];
  const fault = filled(call) ? readShown(stateRoot(cwd), warnings, (shower) => reviewCallFault(shower, unit, call)) : 'its call names the ledger\'s file-or-drop call';
  if (fault !== null) faults.push(fault);
  if (faults.length > 0) throw new Error(`${said}: ${faults.join('; ')}`);
  const rel = `${INBOX}/${KIND_FOLDER[/** @type {string} */ (kind)]}/${todayStamp()}--${slugOf(/** @type {string} */ (title))}.md`;
  if (fs.existsSync(statePath(cwd, rel))) throw new Error(`${said}: ${statePath(cwd, rel)} is filed already — group this finding with it, or title it apart`);
  fs.mkdirSync(path.dirname(statePath(cwd, rel)), { recursive: true });
  fs.writeFileSync(statePath(cwd, rel), `${String(text).replace(/\n*$/, '')}\n`);
  const outcome = commitStateTail(cwd, [rel], `workflow(inbox): file ${path.posix.basename(rel, '.md').replace(/^\d{4}-\d{2}-\d{2}--/, '')} from ${unit}'s review`, warnings);
  return committedResult({ filed: statePath(cwd, rel), committed: outcome.committed }, outcome, warnings);
}

module.exports = {
  fileItem,
  archiveItems,
  restoreItems,
  deleteItems,
  parseInboxPath,
  parseInboxPaths,
  refuseTakenDestinations,
  moveFiles,
  undoMoves,
  archivedDir,
  INBOX,
  ARCHIVED,
  FOLDER_KIND,
  SEED_SOURCES,
  ROADMAP_SEED,
};
