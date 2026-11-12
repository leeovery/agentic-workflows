'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what triage reads (projections/triage.cjs) — the inbox's
// items by kind, and the archived items, each with how it left the inbox;
// one item by its store path, live or archived, for the screens over it and
// the receipts after a restore or a delete. Pure over the state's inbox and
// the project manifest's record of closures, and the state branch's history
// for when an item was archived and for an item deleted out of the tree.
// Path validation is domain/inbox's, the rules the inbox's verbs keep.
//
// - The live items by kind — ideas, bugs, quick-fixes — the newest first
//   within each, numbered across the kinds in that order (18.7.3). An
//   item's date is its file name's, never the file's time, which a clone
//   resets.
// - The archived items, the latest to leave first (18.7.11): one an
//   `inbox close` recorded, closed by the unit whose work resolved it,
//   named by its title — its name where the unit is gone — or closed with
//   no unit (18.6.10), on the day it closed; any other archived on the day
//   the state branch took it into the archive, a day unknown while that is
//   uncommitted.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { titlecase } = require('./conventions.cjs');
const { discoverInbox, titleOf } = require('./start.cjs');
const { parseInboxPath, closures, ARCHIVED, FOLDER_KIND } = require('./inbox.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { topicTitle } = require('./derivations.cjs');

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
 * How an archived item left the inbox (the header's): closed by a unit,
 * named by its title, or by none; else archived. `on` is the day it left,
 * null where it is not known.
 * @typedef {{closed: boolean, by: string|null, on: string|null}} Left
 */

/** @typedef {PickupItem & {left: Left}} ArchivedItem */

/** The kinds of item in the order triage lists them, by folder. */
const KIND_ORDER = Object.freeze(['ideas', 'bugs', 'quickfixes']);

/**
 * One folder's scan rows as pickup items, unnumbered.
 * @param {import('./start.cjs').InboxScan} scan
 * @param {string} folder
 * @returns {PickupItem[]}
 */
function folderItems(scan, folder) {
  const rows = folder === 'ideas' ? scan.ideas : folder === 'bugs' ? scan.bugs : scan.quickfixes;
  return rows.map((r) => ({ n: 0, type: FOLDER_KIND[folder], folder, date: r.date, slug: r.slug, title: r.title, path: r.path }));
}

/** Two items by date, then by slug. @param {PickupItem} a @param {PickupItem} b */
const byDate = (a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug);

/**
 * One inbox scan, live or archived, as one list: every folder's items,
 * oldest first, then by slug, numbered 1..N.
 * @param {import('./start.cjs').InboxScan} scan
 * @returns {PickupItem[]}
 */
function combinedInbox(scan) {
  return KIND_ORDER.flatMap((folder) => folderItems(scan, folder)).sort(byDate).map((item, i) => ({ ...item, n: i + 1 }));
}

/**
 * The live inbox by kind (the header's): each kind with its items, the
 * newest first, numbered across the kinds; and how many items the archive
 * holds.
 * @param {string} cwd
 * @returns {{kinds: {folder: string, items: PickupItem[]}[], archived: number}}
 */
function inboxByKind(cwd) {
  const scan = discoverInbox(cwd);
  let n = 0;
  const kinds = KIND_ORDER.map((folder) => ({
    folder,
    items: folderItems(scan, folder).sort((a, b) => byDate(b, a)).map((item) => ({ ...item, n: (n += 1) })),
  }));
  return { kinds, archived: scan.archived.total_count };
}

/**
 * One item of a store's list by its given path — the one lookup both stores
 * share. Loud on a path outside the store, or one nothing sits at.
 * @template {PickupItem} T
 * @param {string} cwd
 * @param {T[]} list  the store's items
 * @param {string} given  inbox path
 * @param {boolean} archived
 * @returns {T}
 */
function storeItem(cwd, list, given, archived) {
  const at = statePath(cwd, parseInboxPath(cwd, given, { archived }).rel);
  const found = list.find((item) => item.path === at);
  if (!found) throw new Error(`not in the ${archived ? 'archived store' : 'live inbox'}: "${given}"`);
  return found;
}

/**
 * The day the state branch last took each archived file in, by its path in
 * the state; none for one it holds no commit of.
 * @param {string} cwd @returns {Map<string, string>}
 */
function archiveDays(cwd) {
  const log = isolatedGit(stateRoot(cwd)).tryRun(['log', '--no-renames', '--diff-filter=A', '--relative', '--format=@%cs', '--name-only', '--', ARCHIVED]) ?? '';
  /** @type {Map<string, string>} */
  const days = new Map();
  let day = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) day = line.slice(1);
    else if (line !== '' && !days.has(line)) days.set(line, day);
  }
  return days;
}

/** A unit's title, read from its manifest; its name where the unit is gone. @param {string} cwd @param {string} unit */
function unitTitle(cwd, unit) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest === null ? titlecase(unit) : topicTitle(manifest, unit);
}

/** An archived item's place in the state, as the record and git name it. @param {PickupItem} item */
const archivedRel = ({ folder, path: file }) => `${folder}/${path.basename(file)}`;

/**
 * The archived items, each with how it left the inbox (the header's), the
 * latest to leave first. Git is asked only where an item was archived
 * rather than closed.
 * @param {string} cwd @returns {ArchivedItem[]}
 */
function archivedItems(cwd) {
  const items = combinedInbox(discoverInbox(cwd).archived);
  const record = closures(cwd);
  const days = items.every((item) => Object.hasOwn(record, archivedRel(item))) ? new Map() : archiveDays(cwd);
  /** @param {PickupItem} item @returns {Left} */
  const leftOf = (item) => {
    const closure = record[archivedRel(item)];
    if (closure === undefined) return { closed: false, by: null, on: days.get(`${ARCHIVED}/${archivedRel(item)}`) ?? null };
    return { closed: true, by: closure.unit === null ? null : unitTitle(cwd, closure.unit), on: closure.at.slice(0, 10) };
  };
  return items
    .map((item) => ({ ...item, left: leftOf(item) }))
    .sort((a, b) => (b.left.on ?? '').localeCompare(a.left.on ?? '') || a.n - b.n)
    .map((item, i) => ({ ...item, n: i + 1 }));
}

/**
 * One archived item by its store path, with how it left the inbox.
 * @param {string} cwd
 * @param {string} given  archived inbox path
 * @returns {ArchivedItem}
 */
function archivedItem(cwd, given) {
  return storeItem(cwd, archivedItems(cwd), given, true);
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

module.exports = { combinedInbox, inboxByKind, storeItem, archivedItems, archivedItem, liveItem, deletedItemTitle };
