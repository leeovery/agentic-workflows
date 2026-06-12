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
const { commitScoped, removeFiles } = require('../kernel/git.cjs');

const INBOX = '.workflows/.inbox';
const FOLDERS = ['ideas', 'bugs', 'quickfixes'];

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
  const expected = archived
    ? `${INBOX}/.archived/{${FOLDERS.join('|')}}/{file}.md`
    : `${INBOX}/{${FOLDERS.join('|')}}/{file}.md`;
  const depth = archived ? 5 : 4;
  const ok =
    segs.length === depth &&
    segs[0] === '.workflows' &&
    segs[1] === '.inbox' &&
    (!archived || segs[2] === '.archived') &&
    FOLDERS.includes(segs[depth - 2]) &&
    segs[depth - 1].endsWith('.md');
  if (!ok) {
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
function parseAll(cwd, paths, opts) {
  const items = paths.map((p) => parseInboxPath(p, opts));
  for (const item of items) {
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
 * Move every item to its destination (collision-checked first), then commit
 * the whole set scoped to the inbox.
 * @param {string} cwd @param {InboxItem[]} items
 * @param {(item: InboxItem) => string} destDir relative destination directory per item
 * @param {string} verb commit-message verb
 * @returns {{moved: string[], committed: string|null}}
 */
function moveAndCommit(cwd, items, destDir, verb) {
  const moves = items.map((item) => ({ item, dest: `${destDir(item)}/${item.file}` }));
  for (const { dest } of moves) {
    if (fs.existsSync(path.join(cwd, dest))) {
      throw new Error(`destination already exists: "${dest}"`);
    }
  }
  const moved = [];
  for (const { item, dest } of moves) {
    fs.mkdirSync(path.dirname(path.join(cwd, dest)), { recursive: true });
    fs.renameSync(path.join(cwd, item.given), path.join(cwd, dest));
    moved.push(dest);
  }
  return { moved, committed: commitScoped(cwd, INBOX, commitMessage(verb, items)) };
}

/**
 * Archive live inbox items into `.archived/{folder}/`. One commit for the set.
 * @param {string} cwd project root
 * @param {string[]} paths live inbox paths
 * @returns {{archived: string[], committed: string|null}}
 */
function archiveItems(cwd, paths) {
  const items = parseAll(cwd, paths, { archived: false });
  const { moved, committed } = moveAndCommit(cwd, items, (i) => `${INBOX}/.archived/${i.folder}`, 'archive');
  return { archived: moved, committed };
}

/**
 * Restore archived items back to their live folders. One commit for the set.
 * @param {string} cwd project root
 * @param {string[]} paths archived inbox paths
 * @returns {{restored: string[], committed: string|null}}
 */
function restoreItems(cwd, paths) {
  const items = parseAll(cwd, paths, { archived: true });
  const { moved, committed } = moveAndCommit(cwd, items, (i) => `${INBOX}/${i.folder}`, 'restore');
  return { restored: moved, committed };
}

/**
 * Permanently delete archived items (`git rm`). One commit for the set.
 * Live-folder paths are rejected — delete only operates on `.archived/`.
 * @param {string} cwd project root
 * @param {string[]} paths archived inbox paths
 * @returns {{deleted: string[], committed: string|null}}
 */
function deleteItems(cwd, paths) {
  const items = parseAll(cwd, paths, { archived: true });
  removeFiles(cwd, items.map((i) => i.given));
  return {
    deleted: items.map((i) => i.given),
    committed: commitScoped(cwd, INBOX, commitMessage('delete', items)),
  };
}

module.exports = { archiveItems, restoreItems, deleteItems };
