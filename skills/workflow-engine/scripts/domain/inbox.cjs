'use strict';

// ---------------------------------------------------------------------------
// Domain ring: inbox transactions — archive, restore, delete as single
// transactions over one or more inbox items. Every path is validated against
// the exact inbox layout before anything moves; one scoped commit covers the
// whole set, with the message form the inbox history already uses
// (`archive {slug}` for one item, `archive {N} items` for several).
//
//   live:     .workflows/.inbox/{ideas|bugs|quickfixes}/{file}.md
//   archived: .workflows/.inbox/.archived/{ideas|bugs|quickfixes}/{file}.md
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { removeFiles } = require('../kernel/git.cjs');
const { commitTailPathspec, noteCommitOutcome } = require('./commit.cjs');

const INBOX = '.workflows/.inbox';
const ARCHIVED = `${INBOX}/.archived`;
const FOLDERS = ['ideas', 'bugs', 'quickfixes'];

/** Where a folder's declined items wait. @param {string} folder @returns {string} project-relative */
function archivedDir(folder) {
  return `${ARCHIVED}/${folder}`;
}

/** @typedef {'idea'|'bug'|'quick-fix'} ItemKind */

// Each folder's kind of item — the one home of the kind vocabulary, which
// the inbox lists and the roadmap's items share.
const FOLDER_KIND = /** @type {Record<string, ItemKind>} */ ({ ideas: 'idea', bugs: 'bug', quickfixes: 'quick-fix' });

/** The `source` tag a landed seed carries, per inbox folder. */
const SEED_SOURCES = /** @type {Record<string, string>} */ ({ ideas: 'inbox:idea', bugs: 'inbox:bug', quickfixes: 'inbox:quickfix' });

/**
 * The kind of item a landed seed was, read off its `source` tag.
 * @param {string} source @returns {ItemKind}
 */
function seedKind(source) {
  const folder = Object.keys(SEED_SOURCES).find((f) => SEED_SOURCES[f] === source);
  if (!folder) throw new Error(`unknown seed source ${JSON.stringify(source)} — one of: ${Object.values(SEED_SOURCES).join(', ')}`);
  return FOLDER_KIND[folder];
}

/**
 * @typedef {object} InboxItem
 * @property {string} given   the path as passed (normalised)
 * @property {string} folder  ideas | bugs | quickfixes
 * @property {string} file    file name
 * @property {string} slug    file name minus the date prefix and extension
 */

/**
 * Validate one inbox path against the expected layout. Loud on anything
 * outside it — wrong root, unknown folder, nesting, traversal.
 * @param {string} given
 * @param {{archived: boolean}} opts whether the path must be under `.archived/`
 * @returns {InboxItem}
 */
function parseInboxPath(given, { archived }) {
  const norm = path.normalize(given);
  if (path.isAbsolute(norm) || norm.split(path.sep).includes('..')) {
    throw new Error(`inbox paths must be project-relative without "..": "${given}"`);
  }
  const segs = norm.split(path.sep);
  const root = archived ? ARCHIVED : INBOX;
  const depth = root.split('/').length + 2;
  const ok =
    segs.length === depth &&
    segs.slice(0, depth - 2).join('/') === root &&
    FOLDERS.includes(segs[depth - 2]) &&
    segs[depth - 1].endsWith('.md');
  if (!ok) {
    const expected = `${root}/{${FOLDERS.join('|')}}/{file}.md`;
    throw new Error(`not ${archived ? 'an archived' : 'a live'} inbox path (expected ${expected}): "${given}"`);
  }
  const file = segs[depth - 1];
  return {
    given: segs.join('/'),
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
  const items = paths.map((p) => parseInboxPath(p, opts));
  // Refuse duplicates here, before anything moves: two paths naming the same
  // file both pass existence, then the second `renameSync` hits ENOENT after
  // the first move already applied — a half-done, uncommitted transaction.
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.given)) {
      throw new Error(`duplicate inbox path: "${item.given}"`);
    }
    seen.add(item.given);
    if (!fs.existsSync(path.join(cwd, item.given))) {
      throw new Error(`inbox file not found: "${item.given}"`);
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
 * @param {string} cwd @param {{from: string, to: string}[]} moves project-relative
 */
function refuseTakenDestinations(cwd, moves) {
  for (const { to } of moves) {
    if (fs.existsSync(path.join(cwd, to))) {
      throw new Error(`destination already exists: "${to}"`);
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
 * @param {string} cwd @param {{from: string, to: string}[]} moves project-relative
 */
function moveFiles(cwd, moves) {
  /** @type {{from: string, to: string}[]} */
  const done = [];
  try {
    for (const move of moves) {
      fs.mkdirSync(path.dirname(path.join(cwd, move.to)), { recursive: true });
      fs.renameSync(path.join(cwd, move.from), path.join(cwd, move.to));
      done.push(move);
    }
  } catch (err) {
    throw undoMoves(cwd, done, err);
  }
}

/**
 * Put moved files back where they were, last moved first, every reversal
 * attempted. Any that fail ride `err` as `stranded` and are named in its
 * message, so the first failure is never lost. Returns `err`.
 * @param {string} cwd @param {{from: string, to: string}[]} done project-relative, as moved
 * @param {unknown} err the failure that called for the undo
 * @returns {unknown}
 */
function undoMoves(cwd, done, err) {
  /** @type {StrandedMove[]} */
  const stranded = [];
  for (const move of [...done].reverse()) {
    try {
      fs.renameSync(path.join(cwd, move.to), path.join(cwd, move.from));
    } catch (error) {
      stranded.push({ ...move, error });
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
  const moves = items.map((item) => ({ from: item.given, to: `${destDir(item)}/${item.file}` }));
  refuseTakenDestinations(cwd, moves);
  moveFiles(cwd, moves);
  const moved = moves.map((m) => m.to);
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitTailPathspec(cwd, INBOX, commitMessage(verb, items), warnings);
  /** @type {{moved: string[], committed: string|null, note?: string, warnings?: string[]}} */
  const result = { moved, committed: outcome.committed };
  if (outcome.failed) {
    result.warnings = warnings;
    noteCommitOutcome(result, outcome);
  }
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
 * Permanently delete archived items (`git rm`). One commit for the set.
 * Live-folder paths are rejected — delete only operates on `.archived/`.
 * @param {string} cwd project root
 * @param {string[]} paths archived inbox paths
 * @returns {{deleted: string[], committed: string|null}}
 */
function deleteItems(cwd, paths) {
  const items = parseInboxPaths(cwd, paths, { archived: true });
  /** @type {string[]} */
  const warnings = [];
  // The git rm stages index changes, so it belongs inside the same commit
  // lock as the commit that lands them — no peer's add+commit sequence may
  // interleave between the two.
  const outcome = commitTailPathspec(cwd, INBOX, commitMessage('delete', items), warnings, () => {
    removeFiles(cwd, items.map((i) => i.given));
  });
  /** @type {{deleted: string[], committed: string|null, note?: string, warnings?: string[]}} */
  const result = { deleted: items.map((i) => i.given), committed: outcome.committed };
  if (outcome.failed) {
    result.warnings = warnings;
    noteCommitOutcome(result, outcome);
  }
  return result;
}

module.exports = {
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
  seedKind,
};
