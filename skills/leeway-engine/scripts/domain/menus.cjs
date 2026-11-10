'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the menus (18.9, 23.2) — every menu the engine draws, named
// once, and the frame each is drawn in (E1).
//
// - The registry: each menu by the name its render takes, with its gate's
//   name — the trust log's key for good (16.11.9); how a sentence names it;
//   where drawing it leaves the conversation (20.3.3): at no position — the
//   start menu and the project's menus reached from it, so the board shows
//   All work — at the unit it is drawn for, the epic's menu, or at the
//   roadmap; and the keys of its rows, `#` standing for every numbered row,
//   each told by its help file beside its projection (23.2.4,
//   projections/help.cjs) — none until its screen is drawn. Help is a gate
//   of its own, `help`, drawn for a menu.
// - The frame: a menu's render draws its TITLE, what it shows above its
//   question as a text block, and its MENU, then leaves the conversation
//   where the registry says — its position dropped and its tmux label put
//   back as `session repair` does, or arrived at as `session label` arrives,
//   with no writer lock either way: what it writes is the conversation's
//   own. Every row carries what answering it leads to, recorded with the
//   gate shown as drawn and never worked out again at `gate`, so a pick
//   after the state moved meets the refusal of the verb its next names. To
//   every menu the frame adds `h/help`, its next the menu's help as drawn
//   (18.9.4, 23.2.1); then the back row, where the menu has one; then its
//   prompt row. It refuses a row with no next, a key the menu does not
//   register, and `h` or `b` among the rows, which are the frame's own.
// - A menu takes one argument at most, positional — the unit an epic's menu
//   is for — so its help can draw it again.
// ---------------------------------------------------------------------------

const { titleSection, section, menuSection, menu, cmdOption, promptOption, emitAs, MENU_INSTRUCTION } = require('./projections/surfaces.cjs');
const { arriveAt, repairSessionLabels } = require('./session-label.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./projections/surfaces.cjs').OptionLabel} OptionLabel */

/** Where drawing a menu leaves the conversation (the header's). @typedef {'none'|'unit'|'roadmap'} Arrival */

/**
 * A menu, as the registry holds it (the header's).
 * @typedef {object} Menu
 * @property {string} id      the name its render takes
 * @property {string} gate    its gate's name
 * @property {string} named   how a sentence names it
 * @property {Arrival} arrival
 * @property {readonly string[]} keys  its rows' keys, `#` for every numbered row, `h` the frame's
 * @property {string} help    its help row's label
 */

/** A row of a menu: its key — a number, or a letter with its word — its label, and what answering it leads to. @typedef {{key: string|number, word?: string, label: OptionLabel, next: Next}} MenuRow */

/**
 * A menu's screen as its projection composes it: its heading, the lines it
 * shows above its question, the question, its rows in order, and its back
 * row and prompt row where it has them.
 * @typedef {object} MenuScreen
 * @property {string} title
 * @property {string[]} shows
 * @property {string} [question]
 * @property {MenuRow[]} rows
 * @property {{label: OptionLabel, next: Next}} [back]
 * @property {{label: string, description: string, next: Next}} [prompt]
 */

const NUMBERED = '#';
const HELP = 'h';
const BACK = 'b';
const HELP_GATE = 'help';
const QUESTION = 'What would you like to do?';
const HELP_LABEL = 'What this menu is for, row by row';

/**
 * A menu as the registry holds it, none of its rows drawn yet.
 * @param {string} id @param {string} gate @param {string} named @param {Arrival} arrival @param {string} [help]
 * @returns {Menu}
 */
const registered = (id, gate, named, arrival, help = HELP_LABEL) => Object.freeze({ id, gate, named, arrival, keys: Object.freeze([]), help });

/** Every menu, by the name its render takes (the header's). @type {Readonly<Record<string, Menu>>} */
const MENUS = Object.freeze({
  'start-menu': registered('start-menu', 'start menu', 'the start menu', 'none', 'How Leeway works'),
  'epic-menu': registered('epic-menu', 'epic menu', 'the epic menu', 'unit'),
  triage: registered('triage', 'triage', 'triage', 'none'),
  archived: registered('archived', 'archived items', 'the archived items', 'none'),
  'archived-item': registered('archived-item', 'archived item', 'the archived item', 'none'),
  roadmap: registered('roadmap', 'roadmap', 'the roadmap', 'roadmap'),
  manage: registered('manage', 'manage', 'manage', 'none'),
  'manage-unit': registered('manage-unit', 'manage unit', 'managing the unit', 'none'),
  closed: registered('closed', 'closed units', 'the closed units', 'none'),
  verdicts: registered('verdicts', 'verdicts', 'the verdict queue', 'none'),
});

/** The menu a render names, refused where none is. @param {string|undefined} id @returns {Menu} */
function menuNamed(id) {
  if (id === undefined || !Object.hasOwn(MENUS, id)) throw new Error(`there is no menu "${id ?? ''}" — the menus: ${Object.keys(MENUS).join(', ')}`);
  return MENUS[id];
}

/** A menu's title, as its help's heading names it: its name with no article, capitalised. @param {Menu} m */
function titleOf(m) {
  const bare = m.named.replace(/^the /, '');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/** The key a row registers under: a number's `#`, any other its own. @param {string|number} key */
const registeredKey = (key) => (/^\d+$/.test(String(key)) ? NUMBERED : String(key));

/** The menu as drawn, by its render's argv after `render`. @param {Menu} m @param {string} [arg] */
const menuArgv = (m, arg) => [m.id, ...(arg === undefined ? [] : [arg])];

/** What the help row leads to: the menu's help, for the menu as drawn. @param {Menu} m @param {string} [arg] @returns {Next} */
const helpNext = (m, arg) => ({ kind: 'engine', argv: ['render', 'help', ...menuArgv(m, arg)] });

/** What a menu's help's back row leads to: the menu drawn again as it was. @param {Menu} m @param {string} [arg] @returns {Next} */
const menuAgain = (m, arg) => ({ kind: 'engine', argv: ['render', ...menuArgv(m, arg)] });

/**
 * Refuse a row the frame cannot draw (the header's).
 * @param {Menu} m @param {MenuRow} row
 */
function checkRow(m, { key, next }) {
  const at = `${m.id}: row ${key}`;
  if (next === undefined || next === null) throw new Error(`${at} leads nowhere — every row of a menu carries its next`);
  if (key === HELP || key === BACK) throw new Error(`${at} is the frame's own — h/help is added to every menu, and b/back is the screen's back`);
  if (!m.keys.includes(registeredKey(key))) throw new Error(`${at} is not among the keys ${m.id} registers: ${m.keys.join(', ') || 'none'}`);
}

/**
 * The menu's MENU section: its question over its rows, then help, the back
 * row and the prompt row.
 * @param {Menu} m @param {string|undefined} arg @param {MenuScreen} screen
 */
function menuOf(m, arg, { question = QUESTION, rows, back, prompt }) {
  for (const row of rows) checkRow(m, row);
  if (back !== undefined && !m.keys.includes(BACK)) throw new Error(`${m.id} registers no back row`);
  const lines = [
    ...rows.map(({ key, word, label, next }) => cmdOption(String(key), word, label, { next })),
    cmdOption(HELP, 'help', m.help, { next: helpNext(m, arg) }),
    ...(back === undefined ? [] : [cmdOption(BACK, 'back', back.label, { next: back.next })]),
    ...(prompt === undefined ? [] : [promptOption(prompt.label, prompt.description, { next: prompt.next })]),
  ];
  return menuSection(m.gate, MENU_INSTRUCTION, menu('', lines, { question }));
}

/**
 * Leave the conversation where drawing the menu does (the header's).
 * @param {string} cwd @param {Menu} m @param {string} [arg]
 */
function arrive(cwd, m, arg) {
  if (m.arrival === 'none') {
    repairSessionLabels(cwd);
    return;
  }
  const place = m.arrival === 'roadmap' ? 'roadmap' : arg;
  if (place === undefined) throw new Error(`${m.id} is drawn for a unit, and none was named`);
  arriveAt(cwd, place);
}

/**
 * A menu drawn in the frame (the header's): its sections, the conversation
 * left where the menu leaves it once they are composed.
 * @param {string} cwd @param {Menu} m @param {string|undefined} arg @param {MenuScreen} screen
 * @returns {string}
 */
function drawMenu(cwd, m, arg, screen) {
  const shown = screen.shows.length === 0 ? '' : section(`DISPLAY: ${m.id}`, emitAs('text'), screen.shows.join('\n'));
  const out = titleSection(screen.title) + shown + menuOf(m, arg, screen);
  arrive(cwd, m, arg);
  return out;
}

module.exports = { MENUS, NUMBERED, HELP_GATE, menuNamed, titleOf, menuAgain, drawMenu };
