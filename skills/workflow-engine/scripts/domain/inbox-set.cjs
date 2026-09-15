'use strict';

// ---------------------------------------------------------------------------
// Domain ring: inbox pickup collation — the combined, date-ordered item list
// the pickup and archived sub-views number, the working-set detail (the
// selection the pickup carries toward discovery), and one archived item by
// its store path (the gates the archived sub-view fetches over it). Pure over
// the project's `.workflows/.inbox/` tree plus the caller-held paths: same
// files, same paths, same answer. Path validation comes from domain/inbox —
// the same layout rules the inbox transactions enforce.
// ---------------------------------------------------------------------------

const { discoverInbox } = require('./start.cjs');
const { parseInboxPath } = require('./inbox.cjs');

// Folder → display type (the index dump's vocabulary) and → the work-type
// pre-seed a uniform set carries into discovery.
const FOLDER_TYPE = { ideas: 'idea', bugs: 'bug', quickfixes: 'quick-fix' };
const FOLDER_PRE_SEED = { ideas: 'none', bugs: 'bugfix', quickfixes: 'quick-fix' };

/**
 * @typedef {object} PickupItem
 * @property {number} n       1-based position in its list
 * @property {string} type    idea | bug | quick-fix
 * @property {string} folder  ideas | bugs | quickfixes
 * @property {string} date
 * @property {string} slug
 * @property {string} title
 * @property {string} path    project-relative inbox path
 */

/**
 * @typedef {object} WorkingSetDetail
 * @property {PickupItem[]} items    the set, in the caller's order
 * @property {number} count
 * @property {boolean} uniform       every item shares one folder
 * @property {string} set_type      uniform → the folder's pre-seed (`bugfix` | `quick-fix` | `none`); otherwise `mixed`
 * @property {PickupItem[]} addable  live inbox items not in the set, pickup order
 */

/**
 * One folder's scan rows as pickup items (unnumbered; combine() numbers).
 * @param {import('./start.cjs').InboxScan} scan
 * @param {'ideas'|'bugs'|'quickfixes'} folder
 * @param {boolean} archived
 * @returns {PickupItem[]}
 */
function folderItems(scan, folder, archived) {
  const rows = folder === 'ideas' ? scan.ideas : folder === 'bugs' ? scan.bugs : scan.quickfixes;
  const base = archived ? '.workflows/.inbox/.archived' : '.workflows/.inbox';
  return rows.map((r) => ({
    n: 0,
    type: FOLDER_TYPE[folder],
    folder,
    date: r.date,
    slug: r.slug,
    title: r.title,
    path: `${base}/${folder}/${r.file}`,
  }));
}

/**
 * The combined pickup list over one inbox scan: all three folders, sorted by
 * date (oldest first) then slug, numbered 1..N.
 * @param {import('./start.cjs').InboxScan} scan
 * @param {{archived?: boolean}} [opts]
 * @returns {PickupItem[]}
 */
function combinedInbox(scan, opts = {}) {
  const archived = opts.archived === true;
  const items = [
    ...folderItems(scan, 'ideas', archived),
    ...folderItems(scan, 'bugs', archived),
    ...folderItems(scan, 'quickfixes', archived),
  ];
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  items.forEach((item, i) => { item.n = i + 1; });
  return items;
}

/**
 * Build the working-set detail for a held selection of live inbox paths.
 * Loud on anything outside the live inbox — the set can only hold items that
 * are still there to act on.
 * @param {string} cwd
 * @param {string[]} paths  project-relative live inbox paths, caller's order
 * @returns {WorkingSetDetail}
 */
function workingSetDetail(cwd, paths) {
  if (paths.length === 0) throw new Error('working set is empty — pass at least one inbox path');
  const live = combinedInbox(discoverInbox(cwd));

  /** @type {PickupItem[]} */
  const items = paths.map((given, i) => ({ ...storeItem(live, given, false), n: i + 1 }));

  const folders = new Set(items.map((item) => item.folder));
  const uniform = folders.size === 1;
  const inSet = new Set(items.map((item) => item.path));
  const addable = live.filter((item) => !inSet.has(item.path)).map((item, i) => ({ ...item, n: i + 1 }));

  return {
    items,
    count: items.length,
    uniform,
    set_type: uniform ? FOLDER_PRE_SEED[items[0].folder] : 'mixed',
    addable,
  };
}

/**
 * One item of a store list by its given path — the one lookup both stores
 * share. Loud on a path outside the store, or one nothing sits at.
 * @param {PickupItem[]} list  the store's combined list
 * @param {string} given  project-relative inbox path
 * @param {boolean} archived
 * @returns {PickupItem}
 */
function storeItem(list, given, archived) {
  const parsed = parseInboxPath(given, { archived });
  const found = list.find((item) => item.path === parsed.given);
  if (!found) throw new Error(`not in the ${archived ? 'archived store' : 'live inbox'}: "${given}"`);
  return found;
}

/**
 * One archived item by its store path — the selection the archived sub-view
 * holds while it acts on it. `n` is the item's place in the combined store
 * list; the sub-view numbers group-major, so a surface showing a number
 * renumbers over the view's order, never over this.
 * @param {string} cwd
 * @param {string} given  project-relative archived inbox path
 * @returns {PickupItem}
 */
function archivedItem(cwd, given) {
  return storeItem(combinedInbox(discoverInbox(cwd).archived, { archived: true }), given, true);
}

module.exports = { combinedInbox, workingSetDetail, archivedItem };
