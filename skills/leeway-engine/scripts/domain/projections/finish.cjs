'use strict';

// ---------------------------------------------------------------------------
// Domain ring: finish as the person sees it (14.5.1), drawn from the unit's
// checklists and the ledger (finish.cjs): the title; what its reads warned
// of, each a callout, so nothing they took off the checklist goes unsaid;
// every checklist item skipped on the way — each phase's start and close,
// then finish's own — with where it was skipped and its reason (6.4.5);
// what the review's put backs set aside, where they set aside anything,
// which stays until the person removes it (review-tree.cjs); then the first
// departure the person made in the build and the review phase still to be
// asked its verdict, under the verdict gate at the point `finish` — one at
// a time, as ready to build asks its own (16.10.3, closing.cjs); and once
// none is, finish's gate, an authority gate that always stops: an
// invitation to ask about what was built, answered before finishing, then
// yes and a comment. No measure adds a line to it (17.2.2).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, callout, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { verdictBlock, verdictGate } = require('./closing.cjs');
const { asideBlock } = require('./review-phase.cjs');

/**
 * Finish as it is drawn: the unit and its title, the skips it shows, the
 * verdict asked, null where none waits, what its reads warned of, and what
 * put back set aside, null where it set aside nothing.
 * @typedef {{
 *   unit: string, title: string,
 *   skips: {checklist: string, text: string, reason: string}[],
 *   verdict: import('../ledger-verdicts.cjs').AskedVerdict|null,
 *   warnings: string[],
 *   aside: import('../review-phase.cjs').SetAside|null,
 * }} FinishView
 */

/** Where an item was skipped, as a line says it: `phase 2's start`, or `finish`. @param {string} checklist */
function skippedAt(checklist) {
  const phase = /^phase-(\d+)-(start|close)$/.exec(checklist);
  return phase === null ? checklist : `phase ${phase[1]}'s ${phase[2]}`;
}

/** The screen's display: each block that has something to show. @param {FinishView} view */
function finishDisplay({
  title, skips, verdict, warnings, aside,
}) {
  const blocks = [`${title} — finish`];
  if (warnings.length > 0) blocks.push(warnings.map((warning) => callout(warning, { width: TREE_WIDTH })).join('\n'));
  if (skips.length > 0) blocks.push(skips.map(({ checklist, text, reason }) => callout(`Skipped at ${skippedAt(checklist)}: ${text} — ${reason}`, { width: TREE_WIDTH })).join('\n'));
  blocks.push(...asideBlock(aside));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  return blocks.join('\n\n');
}

/** Finish's gate: questions about what was built invited, then the yes and a comment. @param {FinishView} view */
function finishGate({ unit }) {
  return section('MENU: finish', MENU_INSTRUCTION, menu('Ask me anything about what was built first — I answer it before we finish.', [
    cmdOption('y', 'yes', 'Land what still stands, and complete the work', { next: { kind: 'engine', argv: ['finish', 'yes', unit] } }),
    promptOption('Comment', 'Ask about what was built, or tell me what to change'),
  ], { question: 'Finish the work?' }));
}

/**
 * Finish: its display, then the verdict gate while a departure waits to be
 * asked, else finish's gate.
 * @param {FinishView} view
 * @returns {string}
 */
function finishScreen(view) {
  const display = section('DISPLAY: finish', CONTINUE_INSTRUCTION, finishDisplay(view));
  return display + (view.verdict === null ? finishGate(view) : verdictGate(view.verdict, 'finish'));
}

module.exports = { finishScreen };
