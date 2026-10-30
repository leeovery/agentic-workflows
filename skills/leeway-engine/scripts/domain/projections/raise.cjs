'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a raise's screen (16.9.2) — one MENU, drawn from the raise's
// seal alone (raise.cjs), read cold and product first: where the question
// stands, the question, Claude's lean, what the person would notice with
// each row, why it asks, and, with the toggle on, the mechanism; then the
// rows, the lean recommended, the toggle, "I don't follow" and a comment.
// A raise on a replacement draws Claude's proposals, then the row its seal
// holds for keeping the entry as it stands, never recommended. A fact draws
// no lean and recommends no row, asks for the answer, and draws what the
// person would notice only where it has rows; its comment takes the answer
// in the person's own words.
// Every line above the rows is the menu's statement, so a surface drawing
// the gate payload draws it all. Claude's words are escaped, so they read
// as written, never as markup; the mechanism keeps its lines, each drawn
// from its first word: a leading indent in a menu is a row's continuation.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');
const { titlecase } = require('../conventions.cjs');

/** @typedef {import('../raise.cjs').Seal} Seal */
/** @typedef {import('./surfaces.cjs').Next} Next */

/** An engine command a row leads to. @param {string[]} argv @returns {Next} */
function engine(argv) {
  return { kind: 'engine', argv };
}

/** The mechanism's lines as written, each escaped, from its first word. @param {string} mechanism */
function mechanismLines(mechanism) {
  return mechanism.split(/\r?\n/).map((line) => escapeMarkdown(line.trimStart()));
}

/**
 * The rows a raise draws: Claude's, then, on a replacement, keeping the
 * entry as it stands.
 * @param {Seal} seal
 * @returns {import('../raise.cjs').Row[]}
 */
function drawnRows({ call, replaces }) {
  return replaces === null ? call.rows : [...call.rows, replaces.keep];
}

/** The lean's key, null on a fact. @param {Seal} seal @returns {string|null} */
function leanOf(seal) {
  return seal.fact ? null : seal.call.lean;
}

/**
 * What the screen asks, and its prompt row's label: a fact's answer comes
 * in the person's own words.
 * @param {Seal} seal
 */
function asking({ fact }) {
  return fact
    ? { question: 'What\'s the answer?', prompt: 'Tell me in your own words, or ask about it' }
    : { question: 'Which way?', prompt: 'Ask about it, or tell me what I\'ve missed' };
}

/** Where the question stands: its unit, and its topic where it has one of its own. @param {Seal['place']} place */
function header({ unit, topic }) {
  return [unit, ...(topic === null || topic === unit ? [] : [topic])].map(titlecase).join(' · ');
}

/**
 * The lines above the rows, each block apart: the header, the question, the
 * lean, what the person would notice, why it asks, and the mechanism where
 * it is shown.
 * @param {Seal} seal @param {boolean} technical
 * @returns {string[]}
 */
function statement(seal, technical) {
  const { place, call, reason } = seal;
  const lean = call.rows.find((row) => row.key === leanOf(seal));
  const rows = drawnRows(seal);
  return [
    header(place),
    '',
    escapeMarkdown(call.question),
    '',
    ...(lean === undefined ? [] : [`I lean: ${escapeMarkdown(lean.text)}`, '']),
    ...(rows.length === 0 ? [] : [
      'WHAT YOU\'D NOTICE',
      '',
      ...rows.map((row) => `- ${escapeMarkdown(row.name)}: ${escapeMarkdown(row.notice)}`),
      '',
    ]),
    'WHY I\'M ASKING',
    '',
    escapeMarkdown(reason),
    ...(technical ? ['', 'THE MECHANISM', '', ...mechanismLines(call.mechanism)] : []),
  ];
}

/**
 * The raise's MENU, declared as its seal names it.
 * @param {Seal} seal @param {{technical?: boolean}} [opts]
 * @returns {string}
 */
function raiseScreen(seal, { technical = false } = {}) {
  const { id } = seal;
  const { question, prompt } = asking(seal);
  const rows = [
    ...drawnRows(seal).map((row) => cmdOption(row.key, null, { head: escapeMarkdown(row.text), recommended: row.key === leanOf(seal) }, { next: engine(['raise', 'answer', id, '--pick', row.key]) })),
    cmdOption('t', 'technical', technical ? 'Hide the mechanism' : 'Show the mechanism', { next: engine(['raise', 'show', id, ...(technical ? [] : ['--technical'])]) }),
    cmdOption('e', 'explain', 'I don\'t follow — explain it again', { next: engine(['raise', 'answer', id, '--didnt-follow']) }),
    promptOption('Comment', prompt),
  ];
  return section(`MENU: ${seal.menu}`, MENU_INSTRUCTION, menu(statement(seal, technical).join('\n'), rows, { question }));
}

module.exports = { drawnRows, raiseScreen };
