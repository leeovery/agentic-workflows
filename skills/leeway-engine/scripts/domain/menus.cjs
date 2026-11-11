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
//   projections/help.cjs) — none until its screen is drawn; and its help:
//   the label of its help row, and, where its help is not the plain one,
//   its heading, its closing line and the rows of its own, each with its
//   next (23.2.3). Help is a gate of its own, `help`, drawn for a menu.
// - The frame: a menu's render draws its TITLE where it has one, what it
//   shows above its question as a text block, and its MENU — the statement
//   it makes under the rule, where it makes one, wrapped to the pane as its
//   rows are, over its question — then leaves the conversation
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
// - A menu is drawn with the unit it is for as its one positional
//   argument, where it is a unit's, and anything else by name, `--{name}
//   {value}` — the archived item's path, triage's pick — so its help draws
//   it again as it was drawn, every argument carried.
// ---------------------------------------------------------------------------

const { wrap } = require('../kernel/render.cjs');
const { displayWidth } = require('../kernel/terminal.cjs');
const { titleSection, section, menuSection, menu, cmdOption, promptOption, emitAs, MENU_INSTRUCTION } = require('./projections/surfaces.cjs');
const { arriveAt, repairSessionLabels } = require('./session-label.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./projections/surfaces.cjs').OptionLabel} OptionLabel */

/** Where drawing a menu leaves the conversation (the header's). @typedef {'none'|'unit'|'roadmap'} Arrival */

/** A row of a menu: its key — a number, or a letter with its word — its label, and what answering it leads to. @typedef {{key: string|number, word?: string, label: OptionLabel, next: Next}} MenuRow */

/**
 * A menu's help as the registry holds it (the header's): its help row's
 * label, and its screen's heading, closing line and rows of its own where
 * they are not the plain help's.
 * @typedef {{label: string, heading?: string, closing?: string, rows?: readonly MenuRow[]}} MenuHelp
 */

/**
 * A menu, as the registry holds it (the header's).
 * @typedef {object} Menu
 * @property {string} id      the name its render takes
 * @property {string} gate    its gate's name
 * @property {string} named   how a sentence names it
 * @property {Arrival} arrival
 * @property {readonly string[]} keys  its rows' keys, `#` for every numbered row, `h` the frame's
 * @property {MenuHelp} help
 */

/** How a menu was drawn (the header's): the unit it is for, and its other arguments by name. @typedef {{arg?: string, flags?: Record<string, string|undefined>}} Drawn */

/**
 * A menu's screen as its projection composes it: its heading where it has
 * one, the lines it shows above its question, the statement under the rule
 * where it makes one, the question, its rows in order, and its back row and
 * prompt row where it has them.
 * @typedef {object} MenuScreen
 * @property {string} [title]
 * @property {string[]} shows
 * @property {string} [statement]
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
 * A menu as the registry holds it, its rows' keys those `keys` names — none
 * until its screen is drawn — its help the plain one but where `help` says.
 * @param {string} id @param {string} gate @param {string} named @param {Arrival} arrival @param {Partial<MenuHelp>} [help] @param {string[]} [keys]
 * @returns {Menu}
 */
const registered = (id, gate, named, arrival, help = {}, keys = []) => Object.freeze({ id, gate, named, arrival, keys: Object.freeze(keys), help: Object.freeze({ label: HELP_LABEL, ...help }) });

/** The start menu's help: "■ Help", the walk through Leeway reached from it, which the start skill carries on into (23.2.3). @type {Partial<MenuHelp>} */
const START_HELP = Object.freeze({
  label: 'How Leeway works',
  heading: 'Help',
  closing: 'Ask about anything else, or walk through the whole thing.',
  rows: Object.freeze([{ key: 'w', word: 'walk', label: 'Walk through how Leeway works', next: Object.freeze({ kind: 'continue' }) }]),
});

/** Every menu, by the name its render takes (the header's). @type {Readonly<Record<string, Menu>>} */
const MENUS = Object.freeze({
  'start-menu': registered('start-menu', 'start menu', 'the start menu', 'none', START_HELP, [NUMBERED, 'p', 's', 't', 'r', 'e', 'v', 'm']),
  'epic-menu': registered('epic-menu', 'epic menu', 'the epic menu', 'unit', {}, [NUMBERED, 'e', 's', 'd', BACK]),
  triage: registered('triage', 'triage', 'triage', 'none'),
  archived: registered('archived', 'archived items', 'the archived items', 'none'),
  'archived-item': registered('archived-item', 'archived item', 'the archived item', 'none'),
  roadmap: registered('roadmap', 'roadmap', 'the roadmap', 'roadmap'),
  manage: registered('manage', 'manage', 'manage', 'none'),
  'manage-unit': registered('manage-unit', 'manage unit', 'managing the unit', 'none'),
  closed: registered('closed', 'closed units', 'the closed units', 'none'),
  verdicts: registered('verdicts', 'verdicts', 'the verdict queue', 'none', { label: 'What this screen is for, row by row' }, ['n', 'f', 'l', 'b']),
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

/** The menu as drawn, by its render's argv after `render` (the header's). @param {Menu} m @param {Drawn} drawn */
const menuArgv = (m, { arg, flags = {} }) => [
  m.id, ...(arg === undefined ? [] : [arg]), ...Object.entries(flags).flatMap(([name, value]) => (value === undefined ? [] : [`--${name}`, value])),
];

/** What the help row leads to: the menu's help, for the menu as drawn. @param {Menu} m @param {Drawn} drawn @returns {Next} */
const helpNext = (m, drawn) => ({ kind: 'engine', argv: ['render', 'help', ...menuArgv(m, drawn)] });

/** What a menu's help's back row leads to: the menu drawn again as it was. @param {Menu} m @param {Drawn} drawn @returns {Next} */
const menuAgain = (m, drawn) => ({ kind: 'engine', argv: ['render', ...menuArgv(m, drawn)] });

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

/** A row drawn as a menu's rows are, its next recorded. @param {MenuRow} row */
const rowOf = ({ key, word, label, next }) => cmdOption(String(key), word, label, { next });

/**
 * The menu as its MENU section holds it: its statement and its question
 * over its rows, then help, the back row and the prompt row.
 * @param {Menu} m @param {Drawn} drawn @param {MenuScreen} screen
 */
function menuBody(m, drawn, { statement, question = QUESTION, rows, back, prompt }) {
  for (const row of rows) checkRow(m, row);
  if (back !== undefined && !m.keys.includes(BACK)) throw new Error(`${m.id} registers no back row`);
  const lines = [
    ...rows.map(rowOf),
    cmdOption(HELP, 'help', m.help.label, { next: helpNext(m, drawn) }),
    ...(back === undefined ? [] : [cmdOption(BACK, 'back', back.label, { next: back.next })]),
    ...(prompt === undefined ? [] : [promptOption(prompt.label, prompt.description, { next: prompt.next })]),
  ];
  return menu(statement === undefined ? '' : wrap(statement, displayWidth()).join('\n'), lines, { question });
}

/** The menu's MENU section, under its gate. @param {Menu} m @param {Drawn} drawn @param {MenuScreen} screen */
const menuOf = (m, drawn, screen) => menuSection(m.gate, MENU_INSTRUCTION, menuBody(m, drawn, screen));

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
 * A menu drawn in the frame (the header's), as `drawn`: its sections, the
 * conversation left where the menu leaves it once they are composed.
 * @param {string} cwd @param {Menu} m @param {Drawn} drawn @param {MenuScreen} screen
 * @returns {string}
 */
function drawMenu(cwd, m, drawn, screen) {
  const title = screen.title === undefined ? '' : titleSection(screen.title);
  const shown = screen.shows.length === 0 ? '' : section(`DISPLAY: ${m.id}`, emitAs('text'), screen.shows.join('\n'));
  const out = title + shown + menuOf(m, drawn, screen);
  arrive(cwd, m, drawn.arg);
  return out;
}

module.exports = { MENUS, NUMBERED, HELP_GATE, QUESTION, menuNamed, titleOf, menuAgain, rowOf, menuBody, drawMenu };
