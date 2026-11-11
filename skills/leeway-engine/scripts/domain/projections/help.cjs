'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a menu's help (18.9.5, 23.2.1, 23.2.2) — `render help <menu>
// [<arg>] [--<name> <value> …]`, the screen a menu's `h/help` row opens
// (menus.cjs), the menu's arguments as it was drawn: "■ Help · {Menu}", what
// the menu is for and what each row does, "Ask about anything else.", and
// its gate, `help` — `b/back`, drawing the menu again as it was drawn, every
// argument carried, and Ask, leading into the conversation. A menu whose
// help is not the plain one says so in the registry: its heading, its
// closing line, and its rows drawn before `b/back`, each with its next — the
// start menu's, "■ Help", with the walkthrough a row of it (23.2.3). It
// leaves the conversation where it was.
//
// - A menu's help is a content file beside the projection that draws the
//   menu, `{menu}.help.md`, so a menu and its help change together (23.2.4):
//   a paragraph or more on what the menu is for; a line a row,
//   `{key} → {what it does}`, `#` for the numbered rows; and the Ask row's
//   label, `Ask → {label}`. Its rows' keys are the menu's, as the registry
//   holds them — `h` is help itself, never among them, and a row of the
//   help's own is the help's, never the menu's — and a menu whose rows are
//   drawn has one (`menuDrift`, `menusDrift`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { wrap } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { titleSection, section, menu, cmdOption, promptOption, emitAs, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { MENUS, HELP_GATE, QUESTION, menuNamed, titleOf, menuAgain, rowOf } = require('../menus.cjs');

/** @typedef {import('../menus.cjs').Menu} Menu */
/** @typedef {import('../menus.cjs').Drawn} Drawn */
/** A help file as read: its paragraphs, its rows in order, and the Ask row's label. @typedef {{paragraphs: string[], rows: {key: string, text: string}[], ask: string}} Help */

const ROW = /^(\S+) → (.+)$/;
const ASK = 'Ask';
const INVITATION = 'Ask about anything else.';
const BULLET = '  · ';
const HANGING = '    ';

/** Where a menu's help file sits: beside its projection. @param {Menu} m */
const helpFile = (m) => path.join(__dirname, `${m.id}.help.md`);

/**
 * A help file's text read as its parts (the header's): lines joined into
 * paragraphs at each blank, every row line and the Ask line apart.
 * @param {string} text @param {string} file @returns {Help}
 */
function parseHelp(text, file) {
  /** @type {string[][]} */
  const paragraphs = [[]];
  /** @type {Help['rows']} */
  const rows = [];
  /** @type {string|null} */
  let ask = null;
  for (const line of text.split('\n').map((l) => l.trim())) {
    const row = ROW.exec(line);
    if (row === null && line !== '') paragraphs[paragraphs.length - 1].push(line);
    else if (row === null) paragraphs.push([]);
    else if (row[1] === ASK) ask = row[2];
    else rows.push({ key: row[1], text: row[2] });
  }
  if (ask === null) throw new Error(`${file} names no Ask row — its label goes on a line of its own, "${ASK} → {label}"`);
  return { paragraphs: paragraphs.filter((p) => p.length > 0).map((p) => p.join(' ')), rows, ask };
}

/** A menu's help, read from its file; refused where the menu has none yet. @param {Menu} m @returns {Help} */
function readHelp(m) {
  const file = helpFile(m);
  if (!fs.existsSync(file)) throw new Error(`there is no help for ${m.named} yet — its help is ${path.basename(file)}, beside its projection`);
  return parseHelp(fs.readFileSync(file, 'utf8'), file);
}

/**
 * Where a menu and its help part (23.2.4), its help null where it has none:
 * help for a menu whose rows are not drawn yet, rows drawn with no help,
 * each key the menu registers that its help does not tell, and each its
 * help tells that the menu does not register, the help's own rows apart —
 * none where they agree, a menu with neither rows nor help among them.
 * @param {Menu} m @param {Help|null} help @returns {string[]}
 */
function menuDrift(m, help) {
  if (help === null) return m.keys.length === 0 ? [] : [`${m.id}: its rows have no help — ${path.basename(helpFile(m))}, beside its projection`];
  if (m.keys.length === 0) return [`${m.id}: its help is written, and the menu registers no rows`];
  const own = (m.help.rows ?? []).map(({ key }) => String(key));
  const told = help.rows.map(({ key }) => key);
  return [
    ...m.keys.filter((key) => !told.includes(key)).map((key) => `${m.id}: row ${key} has no help`),
    ...told.filter((key) => !m.keys.includes(key) && !own.includes(key)).map((key) => `${m.id}: its help tells of a row ${key} the menu does not register`),
  ];
}

/** Where any menu of the registry and its help file part (`menuDrift`). @returns {string[]} */
const menusDrift = () => Object.values(MENUS).flatMap((m) => menuDrift(m, fs.existsSync(helpFile(m)) ? readHelp(m) : null));

/** The help's display: its paragraphs, a bullet a row, then its closing line, wrapped to the pane. @param {Help} help @param {string} closing */
function helpLines({ paragraphs, rows }, closing) {
  const width = displayWidth();
  return [
    ...paragraphs.flatMap((p) => wrap(p, width)),
    ...rows.flatMap(({ text }) => wrap(text, width - BULLET.length).map((seg, i) => `${i === 0 ? BULLET : HANGING}${seg}`)),
    ...wrap(closing, width),
  ];
}

/**
 * The help screen for the menu `m` as it was drawn (the header's).
 * @param {Menu} m @param {Drawn} drawn @param {Help} help
 * @returns {string}
 */
function helpScreen(m, drawn, help) {
  const { heading = `Help · ${titleOf(m)}`, closing = INVITATION, rows = [] } = m.help;
  const lines = [
    ...rows.map(rowOf),
    cmdOption('b', 'back', `Back to ${m.named}`, { next: menuAgain(m, drawn) }),
    promptOption(ASK, help.ask, { next: { kind: 'continue' } }),
  ];
  return titleSection(heading)
    + section('DISPLAY: help', emitAs('text'), helpLines(help, closing).join('\n'))
    + section(`MENU: ${HELP_GATE}`, MENU_INSTRUCTION, menu('', lines, { question: QUESTION }));
}

/**
 * `render help <menu> [<arg>] [--<name> <value> …]`: the menu's help, for
 * the menu as it was drawn.
 * @param {string|undefined} id @param {Drawn} drawn
 * @returns {string}
 */
function helpSurface(id, drawn) {
  const m = menuNamed(id);
  return helpScreen(m, drawn, readHelp(m));
}

module.exports = { parseHelp, menuDrift, menusDrift, helpScreen, helpSurface };
