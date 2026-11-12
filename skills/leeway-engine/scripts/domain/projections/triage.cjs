'use strict';

// ---------------------------------------------------------------------------
// Domain ring: triage and the archived items (18.7), each drawn in the
// menus' frame (menus.cjs), which drops the conversation's position as the
// start menu does (20.3.3).
//
// - `render triage [--file <pick.json>]`: "Triage · {Project}", the inbox
//   by kind — IDEAS, BUGS, QUICK-FIXES — each item numbered across the
//   kinds, with its age, the ages one right-aligned column across the
//   kinds (inbox-set.cjs, 18.7.3, 18.7.12), and a DATA section giving
//   each number's path. With nothing picked it asks which items: Pick, a
//   prompt row leading into the conversation, where the person names them
//   by number (18.7.12). Claude's payload, `{picked, fits}`, each a list of
//   live inbox paths, draws what is picked and what Claude names as fitting
//   with it (18.7.4), and the rows that act on what is picked (18.7.10): w
//   into discovery with the items its seeds and no type (18.7.6), r and c
//   into the conversation, where Claude asks the horizon or which items
//   (18.7.7, 18.7.5), a `inbox archive` with no confirm (18.7.13). Then
//   v/view while the archive holds items, and b/back to the start menu,
//   nothing changed. An empty inbox says so, with no pick to make. The
//   payload is refused where it is no such pick: an item not live, or named
//   twice, or nothing picked.
// - `render archived`: "Triage · Archived", the archived items, the latest
//   to leave first, numbered as triage's are, each "{kind}, archived
//   {day}", "closed by {Unit}" or "closed {day}" (18.7.11, 18.6.10),
//   opening the item; b/back to triage. An empty archive says so.
// - `render archived-item --path <path>`: the item under the rule, how it
//   left, then u/unarchive (`inbox restore`) and d/delete (its confirm);
//   b/back to the archived items.
// - `render archived-delete-gate --path <path>`: the delete's confirm, a
//   gate: its yes `inbox delete`, its no the item again.
//
// Each of the three takes `--file <pick.json>`, the pick standing in triage
// when v was chosen, and carries it to the screen each row and back draws,
// so triage drawn again from them shows the pick.
// ---------------------------------------------------------------------------

const { renderTree, TAG_GAP } = require('../../kernel/render.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { dayMonth, daysSince } = require('../dates.cjs');
const { projectName } = require('../state-checks.cjs');
const { filled, shaped, listed, readPayload, refusing } = require('../staged-payload.cjs');
const { inboxByKind, storeItem, archivedItems, archivedItem } = require('../inbox-set.cjs');
const { MENUS, drawMenu } = require('../menus.cjs');
const { counted } = require('./map.cjs');
const { escapeMarkdown } = require('./worklist.cjs');
const { section, dataSection, menu, cmdOption, MENU_INSTRUCTION } = require('./surfaces.cjs');

/** @typedef {import('../inbox-set.cjs').PickupItem} PickupItem */
/** @typedef {import('../inbox-set.cjs').ArchivedItem} ArchivedItem */
/** @typedef {import('../menus.cjs').MenuRow} MenuRow */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */

/** What is picked, and what Claude names as fitting with it. @typedef {{picked: PickupItem[], fits: PickupItem[]}} Pick */

/** Each kind's heading, by its folder. @type {Readonly<Record<string, string>>} */
const HEADINGS = Object.freeze({ ideas: 'IDEAS', bugs: 'BUGS', quickfixes: 'QUICK-FIXES' });

/** A row leading into the conversation. @type {Next} */
const CARRY_ON = Object.freeze({ kind: 'continue' });

/** @param {...string} argv @returns {Next} */
const engine = (...argv) => ({ kind: 'engine', argv });

/** The pick standing in triage, carried down the archived items' screens so each back finds it. @param {string|undefined} file @returns {string[]} */
const carried = (file) => (file === undefined ? [] : ['--file', file]);

/** An item's age, as its row reads it: the months never reaching twelve before the year turns. @param {string} date `YYYY-MM-DD` */
function ageOf(date) {
  const days = daysSince(date);
  if (days === 0) return 'today';
  if (days < 14) return counted(days, 'day');
  if (days < 63) return counted(Math.floor(days / 7), 'week');
  if (days < 365) return counted(Math.min(11, Math.floor(days / 30)), 'month');
  return counted(Math.floor(days / 365), 'year');
}

/** A tree's row that opens an item, rather than carrying its title on. */
const OPENS_ITEM = /^\s*[├└]─ /;

/** Items by number as a tree, their titles wrapped to `width`. @param {PickupItem[]} items @param {number} width */
const treeLines = (items, width) => renderTree(items.map((item) => ({ title: `${item.n}. ${item.title}` })), { width, wrapTitles: true }).trimEnd().split('\n');

/** A list under its heading, each item by its number. @param {string} heading @param {PickupItem[]} items */
const listUnder = (heading, items) => [`${heading} (${items.length})`, ...treeLines(items, TREE_WIDTH)];

/**
 * Each kind's list under its heading, the items' ages one right-aligned
 * column across every list (18.7.12).
 * @param {{folder: string, items: PickupItem[]}[]} kinds
 */
function inboxLines(kinds) {
  const shown = kinds.filter(({ items }) => items.length > 0);
  if (shown.length === 0) return [];
  /** @param {PickupItem} item */
  const ageTag = (item) => `[${ageOf(item.date)}]`;
  const reserve = TAG_GAP + Math.max(...shown.flatMap(({ items }) => items.map((item) => ageTag(item).length)));
  const lists = shown.map(({ folder, items }) => {
    let opened = 0;
    const rows = treeLines(items, TREE_WIDTH - reserve).map((text) => ({ text, age: OPENS_ITEM.test(text) ? ageTag(items[opened++]) : '' }));
    return { heading: `${HEADINGS[folder]} (${items.length})`, rows };
  });
  const end = Math.max(...lists.flatMap(({ rows }) => rows.filter(({ age }) => age !== '').map(({ text, age }) => text.length + TAG_GAP + age.length)));
  return apart(lists.map(({ heading, rows }) => [heading, ...rows.map(({ text, age }) => (age === '' ? text : text.padEnd(end - age.length) + age))]));
}

/** Each listed item's number and path, as a DATA section, where any is listed. @param {PickupItem[]} items */
const numbered = (items) => (items.length === 0 ? '' : dataSection(items.map((item) => `item ${item.n}: ${item.path}`)));

/** Lists, a blank line between each. @param {string[][]} lists */
const apart = (lists) => lists.flatMap((lines, i) => (i === 0 ? lines : ['', ...lines]));

/**
 * The pick in Claude's payload, read against the inbox (the header's).
 * @param {string} cwd @param {string} file @param {PickupItem[]} items
 * @returns {Pick}
 */
function pickOf(cwd, file, items) {
  return refusing('render triage', () => {
    const payload = shaped(readPayload(cwd, file), 'the pick', ['picked', 'fits']);
    /** @param {string} what */
    const named = (what) => listed(payload[what], what).map((given) => {
      if (!filled(given)) throw new Error(`${what} holds inbox paths, not ${JSON.stringify(given)}`);
      return storeItem(cwd, items, given, false);
    });
    const [picked, fits] = [named('picked'), named('fits')];
    if (picked.length === 0) throw new Error('nothing is picked — picked names an item at least');
    const twice = [...picked, ...fits].find((item, i, all) => all.indexOf(item) !== i);
    if (twice !== undefined) throw new Error(`item ${twice.n} is named twice — each item is picked, fits with what is, or neither`);
    /** @param {PickupItem[]} list */
    const inOrder = (list) => [...list].sort((a, b) => a.n - b.n);
    return { picked: inOrder(picked), fits: inOrder(fits) };
  });
}

/** What is picked, and what fits with it where Claude names any. @param {Pick} pick */
function pickLines({ picked, fits }) {
  const them = picked.length === 1 ? 'IT' : 'THEM';
  return apart([listUnder('PICKED', picked), ...(fits.length === 0 ? [] : [listUnder(`FITS WITH ${them}, BY MY READ`, fits)])]);
}

/**
 * The rows that act on what is picked (the header's).
 * @param {PickupItem[]} picked @returns {MenuRow[]}
 */
function pickedRows(picked) {
  const one = picked.length === 1;
  const them = one ? 'it' : 'them';
  const paths = picked.map((item) => item.path);
  return [
    { key: 'w', word: 'work', label: `Work on ${them} now${one ? '' : ', as one piece of work'} — discovery finds what kind of work it is`, next: { kind: 'handoff', skill: 'leeway-discovery', args: ['start', 'none', paths.join(',')] } },
    { key: 'r', word: 'roadmap', label: `Put ${them} on the roadmap, on a horizon you name`, next: CARRY_ON },
    { key: 'a', word: 'archive', label: `Archive ${them}`, next: engine('inbox', 'archive', ...paths) },
    { key: 'c', word: 'change', label: 'Change what\'s picked — I\'ll ask which items', next: CARRY_ON },
  ];
}

/**
 * Triage's screen (the header's).
 * @param {string} project @param {{folder: string, items: PickupItem[]}[]} kinds @param {boolean} archived
 * @param {Pick|null} pick @param {string|undefined} [file] the pick's payload
 * @returns {MenuScreen}
 */
function triageScreen(project, kinds, archived, pick, file) {
  const any = kinds.some(({ items }) => items.length > 0);
  const view = archived ? [{ key: 'v', word: 'view', label: 'View the archived items, to restore or delete one', next: engine('render', 'archived', ...carried(file)) }] : [];
  const back = { label: 'Back to the start menu, nothing changed', next: engine('render', 'start-menu') };
  const title = `Triage · ${project}`;
  if (pick !== null) {
    return { title, shows: apart([inboxLines(kinds), pickLines(pick)]), question: 'What would you like to do with what\'s picked?', rows: [...pickedRows(pick.picked), ...view], back };
  }
  if (!any) return { title, shows: [], statement: 'Nothing is in the inbox.', rows: view, back };
  return { title, shows: inboxLines(kinds), question: 'Which items?', rows: view, back, prompt: { label: 'Pick', description: 'Name the items by number', next: CARRY_ON } };
}

/**
 * `render triage [--file <pick.json>]` (the header's).
 * @param {string} cwd @param {string|undefined} file @returns {string}
 */
function triageSurface(cwd, file) {
  const { kinds, archived } = inboxByKind(cwd);
  const items = kinds.flatMap((kind) => kind.items);
  const pick = file === undefined ? null : pickOf(cwd, file, items);
  return numbered(items) + drawMenu(cwd, MENUS.triage, { flags: { file } }, triageScreen(projectName(cwd), kinds, archived > 0, pick, file));
}

/** How an archived item left the inbox, as its row and its statement say it. @param {ArchivedItem} item */
function leftWords({ left: { closed, by, on } }) {
  const day = on === null ? '' : ` ${dayMonth(on)}`;
  if (!closed) return `archived${day}`;
  return by === null ? `closed${day}` : `closed by ${by}`;
}

/** The archived items' screen (the header's). @param {ArchivedItem[]} items @param {string|undefined} file @returns {MenuScreen} */
function archivedScreen(items, file) {
  return {
    title: 'Triage · Archived',
    shows: [],
    ...(items.length === 0 ? { statement: 'Nothing is archived.' } : { question: 'Which item?' }),
    rows: items.map((item) => ({ key: item.n, label: { head: escapeMarkdown(item.title), tail: `${item.type}, ${leftWords(item)}` }, next: engine('render', 'archived-item', '--path', item.path, ...carried(file)) })),
    back: { label: 'Back to triage', next: engine('render', 'triage', ...carried(file)) },
  };
}

/** An archived item's screen (the header's). @param {ArchivedItem} item @param {string|undefined} file @returns {MenuScreen} */
function archivedItemScreen(item, file) {
  return {
    shows: [],
    statement: `Selected: ${escapeMarkdown(item.title)} (${item.type}, ${leftWords(item)})`,
    question: 'What would you like to do with it?',
    rows: [
      { key: 'u', word: 'unarchive', label: 'Restore it to the inbox', next: engine('inbox', 'restore', item.path) },
      { key: 'd', word: 'delete', label: 'Delete it for good — it can\'t be brought back', next: engine('render', 'archived-delete-gate', '--path', item.path, ...carried(file)) },
    ],
    back: { label: 'Back to the archived items', next: engine('render', 'archived', ...carried(file)) },
  };
}

/** The archived item a render names, refused where the archive holds none at its path. @param {string} cwd @param {string|undefined} given @param {string} surface */
function archivedNamed(cwd, given, surface) {
  return refusing(`render ${surface}`, () => {
    if (!filled(given)) throw new Error('--path is required — the archived item');
    return archivedItem(cwd, /** @type {string} */ (given));
  });
}

/** `render archived [--file <pick.json>]`. @param {string} cwd @param {string|undefined} file @returns {string} */
function archivedSurface(cwd, file) {
  const items = archivedItems(cwd);
  return numbered(items) + drawMenu(cwd, MENUS.archived, { flags: { file } }, archivedScreen(items, file));
}

/** `render archived-item --path <path> [--file <pick.json>]`. @param {string} cwd @param {string|undefined} given @param {string|undefined} file @returns {string} */
const archivedItemSurface = (cwd, given, file) => drawMenu(cwd, MENUS['archived-item'], { flags: { path: given, file } }, archivedItemScreen(archivedNamed(cwd, given, 'archived-item'), file));

/**
 * `render archived-delete-gate --path <path> [--file <pick.json>]` (the header's).
 * @param {string} cwd @param {string|undefined} given @param {string|undefined} file @returns {string}
 */
function archivedDeleteGateSurface(cwd, given, file) {
  const item = archivedNamed(cwd, given, 'archived-delete-gate');
  return section('MENU: archived delete gate', MENU_INSTRUCTION, menu(`Deleting "${escapeMarkdown(item.title)}" takes it out of the archive for good.`, [
    cmdOption('y', 'yes', 'Delete it for good', { next: engine('inbox', 'delete', item.path) }),
    cmdOption('n', 'no', 'Keep it in the archive', { next: engine('render', 'archived-item', '--path', item.path, ...carried(file)) }),
  ], { question: 'Delete it?' }));
}

module.exports = { triageScreen, triageSurface, archivedSurface, archivedItemSurface, archivedDeleteGateSurface };
