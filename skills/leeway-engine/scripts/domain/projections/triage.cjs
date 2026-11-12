'use strict';

// ---------------------------------------------------------------------------
// Domain ring: triage and the archived items (18.7), each drawn in the
// menus' frame (menus.cjs), which drops the conversation's position as the
// start menu does (20.3.3).
//
// - `render triage [--file <pick.json>]`: "Triage · {Project}", the inbox
//   by kind — IDEAS, BUGS, QUICK-FIXES — each item numbered across the
//   kinds, with its age (inbox-set.cjs, 18.7.3), and a DATA section giving
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
//   to leave first, numbered as triage's are, each "{kind}, archived {day}", "closed by {Unit}" or
//   "closed {day}" (18.7.11, 18.6.10), opening the item; b/back to triage.
// - `render archived-item --path <path>`: the item under the rule, how it
//   left, then u/unarchive (`inbox restore`) and d/delete (its confirm);
//   b/back to the archived items.
// - `render archived-delete-gate --path <path>`: the delete's confirm, a
//   gate: its yes `inbox delete`, its no the item again.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
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

const BACK_TO_TRIAGE = Object.freeze({ label: 'Back to triage', next: engine('render', 'triage') });

/** An item's age, as its row reads it. @param {string} date `YYYY-MM-DD` */
function ageOf(date) {
  const days = daysSince(date);
  if (days === 0) return 'today';
  if (days < 14) return counted(days, 'day');
  if (days < 63) return counted(Math.floor(days / 7), 'week');
  if (days < 365) return counted(Math.floor(days / 30), 'month');
  return counted(Math.floor(days / 365), 'year');
}

/**
 * A list under its heading, each item by its number, with its tag where it
 * has one.
 * @param {string} heading @param {PickupItem[]} items @param {(item: PickupItem) => string|undefined} tagOf
 */
function listUnder(heading, items, tagOf) {
  const tree = renderTree(items.map((item) => ({ title: `${item.n}. ${item.title}`, tag: tagOf(item) })), { width: TREE_WIDTH, wrapTitles: true });
  return [`${heading} (${items.length})`, ...tree.trimEnd().split('\n')];
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

/** What the inbox shows, by kind. @param {{folder: string, items: PickupItem[]}[]} kinds */
const inboxLines = (kinds) => apart(kinds.filter(({ items }) => items.length > 0).map(({ folder, items }) => listUnder(HEADINGS[folder], items, (item) => ageOf(item.date))));

/** What is picked, and what fits with it where Claude names any. @param {Pick} pick */
function pickLines({ picked, fits }) {
  const them = picked.length === 1 ? 'IT' : 'THEM';
  return apart([listUnder('PICKED', picked, () => undefined), ...(fits.length === 0 ? [] : [listUnder(`FITS WITH ${them}, BY MY READ`, fits, () => undefined)])]);
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
 * @param {string} project @param {{folder: string, items: PickupItem[]}[]} kinds @param {boolean} archived @param {Pick|null} pick
 * @returns {MenuScreen}
 */
function triageScreen(project, kinds, archived, pick) {
  const any = kinds.some(({ items }) => items.length > 0);
  const view = archived ? [{ key: 'v', word: 'view', label: 'View the archived items, to restore or delete one', next: engine('render', 'archived') }] : [];
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
  return numbered(items) + drawMenu(cwd, MENUS.triage, { flags: { file } }, triageScreen(projectName(cwd), kinds, archived > 0, pick));
}

/** How an archived item left the inbox, as its row and its statement say it. @param {ArchivedItem} item */
function leftWords({ left: { closed, by, on } }) {
  const day = on === null ? '' : ` ${dayMonth(on)}`;
  if (!closed) return `archived${day}`;
  return by === null ? `closed${day}` : `closed by ${by}`;
}

/** The archived items' screen (the header's). @param {ArchivedItem[]} items @returns {MenuScreen} */
function archivedScreen(items) {
  return {
    title: 'Triage · Archived',
    shows: [],
    ...(items.length === 0 ? { statement: 'Nothing is archived.' } : {}),
    question: 'Which item?',
    rows: items.map((item) => ({ key: item.n, label: { head: escapeMarkdown(item.title), tail: `${item.type}, ${leftWords(item)}` }, next: engine('render', 'archived-item', '--path', item.path) })),
    back: BACK_TO_TRIAGE,
  };
}

/** An archived item's screen (the header's). @param {ArchivedItem} item @returns {MenuScreen} */
function archivedItemScreen(item) {
  return {
    shows: [],
    statement: `Selected: ${escapeMarkdown(item.title)} (${item.type}, ${leftWords(item)})`,
    question: 'What would you like to do with it?',
    rows: [
      { key: 'u', word: 'unarchive', label: 'Restore it to the inbox', next: engine('inbox', 'restore', item.path) },
      { key: 'd', word: 'delete', label: 'Delete it for good — it can\'t be brought back', next: engine('render', 'archived-delete-gate', '--path', item.path) },
    ],
    back: { label: 'Back to the archived items', next: engine('render', 'archived') },
  };
}

/** The archived item a render names, refused where the archive holds none at its path. @param {string} cwd @param {string|undefined} given @param {string} surface */
function archivedNamed(cwd, given, surface) {
  return refusing(`render ${surface}`, () => {
    if (!filled(given)) throw new Error('--path is required — the archived item');
    return archivedItem(cwd, /** @type {string} */ (given));
  });
}

/** `render archived`. @param {string} cwd @returns {string} */
function archivedSurface(cwd) {
  const items = archivedItems(cwd);
  return numbered(items) + drawMenu(cwd, MENUS.archived, {}, archivedScreen(items));
}

/** `render archived-item --path <path>`. @param {string} cwd @param {string|undefined} given @returns {string} */
const archivedItemSurface = (cwd, given) => drawMenu(cwd, MENUS['archived-item'], { flags: { path: given } }, archivedItemScreen(archivedNamed(cwd, given, 'archived-item')));

/**
 * `render archived-delete-gate --path <path>` (the header's).
 * @param {string} cwd @param {string|undefined} given @returns {string}
 */
function archivedDeleteGateSurface(cwd, given) {
  const item = archivedNamed(cwd, given, 'archived-delete-gate');
  return section('MENU: archived delete gate', MENU_INSTRUCTION, menu(`Deleting "${escapeMarkdown(item.title)}" takes it out of the archive for good.`, [
    cmdOption('y', 'yes', 'Delete it for good', { next: engine('inbox', 'delete', item.path) }),
    cmdOption('n', 'no', 'Keep it in the archive', { next: engine('render', 'archived-item', '--path', item.path) }),
  ], { question: 'Delete it?' }));
}

module.exports = { triageScreen, triageSurface, archivedSurface, archivedItemSurface, archivedDeleteGateSurface };
