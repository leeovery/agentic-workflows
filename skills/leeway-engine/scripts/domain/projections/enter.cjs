'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the entry's answer (enter.cjs) — any question first, each in
// the section it is drawn in, then the DATA naming what to read and the log
// the conversation keeps, one `key: value` line each: the question comes
// before the reading (2.10.3). Where another live session holds the place,
// the question is the whole answer: the held-topic gate, worded as the epic
// menu's in-session gate words it (18.4.21) — the one home of that wording.
// ---------------------------------------------------------------------------

const { section, dataSection, menu, cmdOption, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { fmtAge } = require('../presence.cjs');
const { ENGINE_COMMAND } = require('../../kernel/call.cjs');

/**
 * @param {string[]} questions each a section, drawn whole
 * @param {[string, string][]} lines
 * @returns {string}
 */
function entrySections(questions, lines) {
  return [...questions, dataSection(lines.map(([key, value]) => `${key}: ${value}`))].join('');
}

/**
 * A place another session holds: the unit, the phase, the place — a topic,
 * or the unit — how screens title it, and how long ago that session was
 * last active.
 * @typedef {{unit: string, phase: string, place: string, title: string, ageSeconds: number}} HeldPlace
 */

/**
 * How a place another session holds is put to the person: that session's
 * last activity, what proceeding means, `hold` — any clause on the entry's
 * own hold — and how to release a wedged session's hold.
 * @param {HeldPlace} held @param {string} [hold]
 * @returns {string}
 */
function heldStatement({ unit, phase, place, title, ageSeconds }, hold = '') {
  const fact = `"${title}" is open in another session — last active ${fmtAge(ageSeconds)} ago.`;
  const consequence = `Proceeding starts a second concurrent session on the same ${phase}; its work could conflict with that session's.`;
  const release = `${ENGINE_COMMAND} presence clear ${unit} ${phase} ${place}`;
  return `${fact} ${consequence}${hold} Only proceed if you know that session is no longer working; if it is wedged but alive, release its hold with \`${release}\`.`;
}

/**
 * The entry's question where another live session holds the place: leave
 * it to that session — back to the epic's menu where there is one, else
 * carrying on, which ends the turn — or proceed, taking it over through
 * `take`.
 * @param {HeldPlace & {take: string[], menu: {skill: string, args: string[]}|null}} held
 * @returns {string}
 */
function heldGate({ take, menu: back, ...held }) {
  const leave = back === null
    ? cmdOption('n', 'no', { head: 'Leave it to that session', recommended: true }, { next: { kind: 'continue' } })
    : cmdOption('n', 'no', { head: 'Leave it to that session', tail: 'back to the epic menu', recommended: true }, { next: { kind: 'handoff', ...back } });
  return section('MENU: held topic gate', MENU_INSTRUCTION, menu(
    heldStatement(held),
    [leave, cmdOption('y', 'yes', 'Proceed anyway', { next: { kind: 'engine', argv: take } })],
    { question: 'Proceed anyway?' },
  ));
}

module.exports = { entrySections, heldStatement, heldGate };
