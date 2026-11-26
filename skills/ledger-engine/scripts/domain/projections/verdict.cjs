'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the verdict question (16.10.2), drawn on a departure at the
// moment the person makes it, from what `render verdict` read (verdict.cjs):
// - its DISPLAY, the departure as a tree: the question it answers, Claude's
//   answer where it held one, and the person's;
// - its MENU, under the gate `verdict`: what Claude's answer would have
//   cost the product — nothing, a fix later or a real loss — or that the
//   person can't call it yet, each row giving that verdict as asked
//   (`verdict give`). Whichever they pick is the departure's verdict for
//   good.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, clipped, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { ROW_MAX } = require('./map.cjs');
const { runs } = require('./closing.cjs');

/** @typedef {import('../ledger-verdicts.cjs').Departure} Departure */

/** The verdicts a departure is given, each by its key, its word and its label. */
const VERDICT_ROWS = Object.freeze([
  Object.freeze({ key: 'n', verdict: 'nothing', label: 'Nothing — mine would have served as well' }),
  Object.freeze({ key: 'f', verdict: 'fix', label: 'A fix later' }),
  Object.freeze({ key: 'l', verdict: 'loss', label: 'A real loss' }),
  Object.freeze({ key: 's', verdict: 'skip', label: 'I can\'t call it yet' }),
]);

/** The departure as a tree: the question it answers, Claude's answer and the person's. @param {Departure} departure */
function departureTree({ question, lean, yours }) {
  return renderTree([{
    title: clipped(question, ROW_MAX),
    body: [...(lean === null ? [] : [`My answer: ${lean}`]), `Yours: ${yours}`],
  }], { width: TREE_WIDTH });
}

/**
 * The verdict question on `departure` (the header's).
 * @param {Departure} departure
 * @returns {string}
 */
function verdictQuestion(departure) {
  const rows = VERDICT_ROWS.map(({ key, verdict, label }) => cmdOption(key, verdict, label, runs(['verdict', 'give', departure.entry, verdict])));
  return section('DISPLAY: verdict', CONTINUE_INSTRUCTION, `YOUR VERDICT\n${departureTree(departure).replace(/\n+$/, '')}`)
    + section('MENU: verdict', MENU_INSTRUCTION, menu('', rows, { question: 'What would my answer have cost the product?' }));
}

module.exports = { verdictQuestion };
