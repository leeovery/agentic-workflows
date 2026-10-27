'use strict';

// ---------------------------------------------------------------------------
// Domain ring: inbox pickup collation — the combined, date-ordered item list
// the pickup and archived sub-views number, the working-set detail (the
// selection the pickup carries toward discovery), and one archived item by
// its store path (the gates the archived sub-view fetches over it), and the
// receipts' items after a restore or a delete. Pure over the state's inbox
// plus the caller-held paths — and the state branch's history, for an item
// deleted out of the tree: same files, same paths, same answer. Path
// validation comes from domain/inbox — the same layout rules the inbox
// transactions enforce.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { stateRoot, statePath, insideState } = require('../kernel/state-root.cjs');
const { discoverInbox, titleOf } = require('./start.cjs');
const { parseInboxPath, ARCHIVED, FOLDER_KIND } = require('./inbox.cjs');

/**
 * @typedef {object} PickupItem
 * @property {number} n       1-based position in its list
 * @property {string} type    idea | bug | quick-fix
 * @property {string} folder  ideas | bugs | quickfixes
 * @property {string} date
 * @property {string} slug
 * @property {string} title
 * @property {string} path    absolute
 */

/**
 * @typedef {object} WorkingSetDetail
 * @property {PickupItem[]} items    the set, in the caller's order
 * @property {number} count
 * @property {'none'|'bugfix'|'quick-fix'} set_type  the work-type pre-seed the set carries into discovery (see setType)
 * @property {PickupItem[]} addable  live inbox items not in the set, pickup order
 */

/**
 * One folder's scan rows as pickup items (unnumbered; combine() numbers).
 * @param {import('./start.cjs').InboxScan} scan
 * @param {'ideas'|'bugs'|'quickfixes'} folder
 * @returns {PickupItem[]}
 */
function folderItems(scan, folder) {
  const rows = folder === 'ideas' ? scan.ideas : folder === 'bugs' ? scan.bugs : scan.quickfixes;
  return rows.map((r) => ({
    n: 0,
    type: FOLDER_KIND[folder],
    folder,
    date: r.date,
    slug: r.slug,
    title: r.title,
    path: r.path,
  }));
}

/**
 * The combined pickup list over one inbox scan, live or archived: all three
 * folders, sorted by date (oldest first) then slug, numbered 1..N.
 * @param {import('./start.cjs').InboxScan} scan
 * @returns {PickupItem[]}
 */
function combinedInbox(scan) {
  const items = [
    ...folderItems(scan, 'ideas'),
    ...folderItems(scan, 'bugs'),
    ...folderItems(scan, 'quickfixes'),
  ];
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  items.forEach((item, i) => { item.n = i + 1; });
  return items;
}

/**
 * The work-type pre-seed for a set: work takes the largest shape in it, and
 * bugs and quick-fixes never add size — any idea leaves the type to
 * discovery (`none`), no idea and any bug is a bugfix, quick-fixes alone a
 * quick-fix.
 * @param {PickupItem[]} items
 * @returns {'none'|'bugfix'|'quick-fix'}
 */
function setType(items) {
  if (items.some((item) => item.type === 'idea')) return 'none';
  if (items.some((item) => item.type === 'bug')) return 'bugfix';
  return 'quick-fix';
}

/**
 * Build the working-set detail for a held selection of live inbox paths.
 * Loud on anything outside the live inbox — the set can only hold items that
 * are still there to act on.
 * @param {string} cwd
 * @param {string[]} paths  live inbox paths, caller's order
 * @returns {WorkingSetDetail}
 */
function workingSetDetail(cwd, paths) {
  if (paths.length === 0) throw new Error('working set is empty — pass at least one inbox path');
  const live = combinedInbox(discoverInbox(cwd));

  /** @type {PickupItem[]} */
  const items = paths.map((given, i) => ({ ...storeItem(cwd, live, given, false), n: i + 1 }));

  const inSet = new Set(items.map((item) => item.path));
  const addable = live.filter((item) => !inSet.has(item.path)).map((item, i) => ({ ...item, n: i + 1 }));

  return {
    items,
    count: items.length,
    set_type: setType(items),
    addable,
  };
}

/**
 * One item of a store list by its given path — the one lookup both stores
 * share. Loud on a path outside the store, or one nothing sits at.
 * @param {string} cwd
 * @param {PickupItem[]} list  the store's combined list
 * @param {string} given  inbox path
 * @param {boolean} archived
 * @returns {PickupItem}
 */
function storeItem(cwd, list, given, archived) {
  const at = statePath(cwd, parseInboxPath(cwd, given, { archived }).rel);
  const found = list.find((item) => item.path === at);
  if (!found) throw new Error(`not in the ${archived ? 'archived store' : 'live inbox'}: "${given}"`);
  return found;
}

/**
 * One archived item by its store path — the selection the archived sub-view
 * holds while it acts on it. `n` is the item's place in the combined store
 * list; the sub-view numbers group-major, so a surface showing a number
 * renumbers over the view's order, never over this.
 * @param {string} cwd
 * @param {string} given  archived inbox path
 * @returns {PickupItem}
 */
function archivedItem(cwd, given) {
  return storeItem(cwd, combinedInbox(discoverInbox(cwd).archived), given, true);
}

/**
 * One live inbox item by its path — what `inbox restore` put back.
 * @param {string} cwd
 * @param {string} given  live inbox path
 * @returns {PickupItem}
 */
function liveItem(cwd, given) {
  return storeItem(cwd, combinedInbox(discoverInbox(cwd)), given, false);
}

/**
 * The content the state branch last held at a path the state no longer has:
 * HEAD's while the deletion is uncommitted, else the parent of the commit
 * that deleted it — read in the state worktree.
 * @param {string} cwd @param {string} rel state-relative @returns {string|null}
 */
function deletedContent(cwd, rel) {
  const git = isolatedGit(stateRoot(cwd));
  const uncommitted = git.tryRun(['show', `HEAD:${rel}`]);
  if (uncommitted !== null) return uncommitted;
  const deletion = (git.tryRun(['log', '-1', '--format=%H', '--diff-filter=D', '--', rel]) || '').trim();
  return deletion ? git.tryRun(['show', `${deletion}^:${rel}`]) : null;
}

/**
 * The title of an archived item `inbox delete` removed — the file is gone,
 * so git's last copy of it is read. Loud on a path the archive still holds,
 * or one git holds no copy of.
 * @param {string} cwd
 * @param {string} given  archived inbox path
 * @returns {string}
 */
function deletedItemTitle(cwd, given) {
  const parsed = parseInboxPath(cwd, given, { archived: true });
  if (fs.existsSync(statePath(cwd, parsed.rel))) throw new Error(`still in the archived store, so nothing was deleted: "${given}"`);
  const content = deletedContent(cwd, parsed.rel);
  if (content === null) throw new Error(`git holds no deleted file at "${given}"`);
  return titleOf(content) || parsed.slug;
}

/**
 * Inbox items by their paths, live or archived — each path read for the
 * store it names, in the order given. Loud on a path outside both stores, or
 * one nothing sits at.
 * @param {string} cwd
 * @param {string[]} paths  inbox paths
 * @returns {PickupItem[]}
 */
function inboxItems(cwd, paths) {
  const scan = discoverInbox(cwd);
  const stores = { live: combinedInbox(scan), archived: combinedInbox(scan.archived) };
  return paths.map((given) => {
    const archived = insideState(cwd, given, ARCHIVED);
    return storeItem(cwd, archived ? stores.archived : stores.live, given, archived);
  });
}

module.exports = { combinedInbox, workingSetDetail, archivedItem, liveItem, deletedItemTitle, inboxItems };
