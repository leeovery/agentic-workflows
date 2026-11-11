'use strict';

// ---------------------------------------------------------------------------
// The labeller (leeway-engine/scripts/domain/labeller.cjs) armed in the
// suite's stub binary (claude-stub.cjs), so a world gives a decision's
// question its kind as the engine does: from the label the separate call
// answers. A label's twelve answers compose to the kind asked for, marked
// hard to undo where asked, any other answer said yes besides; the arming
// answers them to the call whose input holds the question's wording, and
// every other call — the one-decision check's — with no login, as the
// unarmed stub does. And a label as the labeller gives it, for a suite that
// builds the trust log's events or the ask rule's inputs itself.
// ---------------------------------------------------------------------------

const { ORDER } = require('../../skills/leeway-engine/scripts/domain/labeller.cjs');

/** @typedef {import('../../skills/leeway-engine/scripts/domain/event-fields.cjs').Kind} Kind */
/** @typedef {import('../../skills/leeway-engine/scripts/domain/labeller.cjs').Label} Label */
/** How a label is marked beside its kind: hard to undo, and the other answers said yes. @typedef {{hardToUndo?: boolean, yes?: string[]}} Marks */

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

/** The labeller a label built here names. */
const LABELLER = 'claude-sonnet-5';

/**
 * The call's answer, by question, composing to `kind`, hard to undo where
 * `hardToUndo`, and each answer `yes` names said yes besides.
 * @param {Kind} kind @param {Marks} [marks]
 * @returns {Record<string, boolean>}
 */
function labelAnswers(kind, { hardToUndo = false, yes = [] } = {}) {
  const said = new Set([...SAYS[kind], ...(hardToUndo ? ['hard_to_undo'] : []), ...yes]);
  return Object.fromEntries(ORDER.map((key) => [key, said.has(key)]));
}

/**
 * A label as the labeller gives it, its answers as `labelAnswers` gives
 * them, in 16.11.2's order.
 * @param {Kind} kind @param {Marks} [marks]
 * @returns {Label}
 */
function labelled(kind, marks) {
  const answers = labelAnswers(kind, marks);
  return { labeller: LABELLER, answers: ORDER.map((key) => answers[key]) };
}

/**
 * The environment labelling the question worded `question` as `kind`, every
 * other call answered with no login.
 * @param {string} question @param {Kind} kind @param {Marks} [marks]
 * @returns {Record<string, string>}
 */
function labelling(question, kind, marks) {
  return { CLAUDE_STUB_ANSWERS: JSON.stringify({ [question]: labelAnswers(kind, marks), '': 'no-login' }) };
}

module.exports = { labelAnswers, labelled, labelling };
