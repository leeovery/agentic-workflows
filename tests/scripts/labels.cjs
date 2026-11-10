'use strict';

// ---------------------------------------------------------------------------
// The labeller (leeway-engine/scripts/domain/labeller.cjs) armed in the
// suite's stub binary (claude-stub.cjs), so a world gives a decision's
// question its kind as the engine does: from the label the separate call
// answers. A label's twelve answers compose to the kind asked for, marked
// hard to undo where asked; the arming answers them to the call whose
// input holds the question's wording, and every other call — the
// one-decision check's — with no login, as the unarmed stub does.
// ---------------------------------------------------------------------------

const { ORDER } = require('../../skills/leeway-engine/scripts/domain/labeller.cjs');

/** @typedef {import('../../skills/leeway-engine/scripts/domain/event-fields.cjs').Kind} Kind */

/** The answers yes that compose each kind (16.11.3). @type {Readonly<Record<Kind, string[]>>} */
const SAYS = Object.freeze({
  process: ['process'],
  danger: ['danger'],
  contract: ['contract'],
  scope: ['scope'],
  look: ['user_sees', 'looks'],
  words: ['user_sees', 'words'],
  behaviour: ['user_sees'],
  internals: [],
});

/**
 * The call's answer, by question, composing to `kind`, hard to undo where
 * `hardToUndo`.
 * @param {Kind} kind @param {{hardToUndo?: boolean}} [opts]
 * @returns {Record<string, boolean>}
 */
function labelAnswers(kind, { hardToUndo = false } = {}) {
  const yes = new Set([...SAYS[kind], ...(hardToUndo ? ['hard_to_undo'] : [])]);
  return Object.fromEntries(ORDER.map((key) => [key, yes.has(key)]));
}

/**
 * The environment labelling the question worded `question` as `kind`, every
 * other call answered with no login.
 * @param {string} question @param {Kind} kind @param {{hardToUndo?: boolean}} [opts]
 * @returns {Record<string, string>}
 */
function labelling(question, kind, opts) {
  return { CLAUDE_STUB_ANSWERS: JSON.stringify({ [question]: labelAnswers(kind, opts), '': 'no-login' }) };
}

module.exports = { labelAnswers, labelling };
