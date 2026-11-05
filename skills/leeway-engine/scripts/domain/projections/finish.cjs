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
//
// A quick-fix's close, its finish gate (19.5.13), is drawn the same but for
// its title, `{Title} — ready to close`; what running the product proved,
// under its title — PROVEN BY RUNNING {PRODUCT}, each fix's scenario a line,
// ✓ where proven, else its standing — or one line saying the project has
// no way to run it (P9); each departure asked its verdict at the verdict
// point `close` (16.10.4); and its gate, `Close it?`: the yes, merging the
// pull requests of its fixes still to land, or saying they have landed, a
// review asked for, and questions about the change. Its rows and words are
// Claude's in the spec (18.10.8).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, callout, treeList, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { block, verdictBlock, verdictGate } = require('./closing.cjs');
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

/** The blocks under the screen's title, each that has something to show. @param {FinishView} view @returns {string[]} */
function finishBlocks({
  skips, verdict, warnings, aside,
}) {
  const blocks = [];
  if (warnings.length > 0) blocks.push(warnings.map((warning) => callout(warning, { width: TREE_WIDTH })).join('\n'));
  if (skips.length > 0) blocks.push(skips.map(({ checklist, text, reason }) => callout(`Skipped at ${skippedAt(checklist)}: ${text} — ${reason}`, { width: TREE_WIDTH })).join('\n'));
  blocks.push(...asideBlock(aside));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  return blocks;
}

/** The screen's display: its title, then each block that has something to show. @param {FinishView} view */
const finishDisplay = (view) => [`${view.title} — finish`, ...finishBlocks(view)].join('\n\n');

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

/**
 * A quick-fix's close as it is drawn: finish's, with the product's name,
 * what running it proved of each fix's scenarios — null where the project
 * has no way to run it — how many fixes are done, and how many of them are
 * still to land.
 * @typedef {FinishView & {product: string, proven: import('./build.cjs').Ran[]|null, fixes: number, landing: number}} CloseView
 */

/** A scenario's line under what was proven: its glyph, and its standing where short of proven. @param {import('./build.cjs').Ran} ran */
const provenLine = ({ criterion, standing }) => (standing === 'proven' ? `✓ ${criterion}` : `△ ${standing === 'not proven' ? 'Not proven' : 'Named, not run'}: ${criterion}`);

/** What running the product proved, or the one line saying the project has no way to run it (P9). @param {CloseView} view */
function provenBlock({ product, proven }) {
  if (proven === null) return `Nothing was proven by running ${product} — the project has no way to run it`;
  const lines = proven.length === 0 ? '  No fix names a scenario to run.' : treeList(proven.map(provenLine), { indent: '  ', width: TREE_WIDTH });
  return block(`PROVEN BY RUNNING ${product.toUpperCase()}`, lines);
}

/** The close's display: its title and what was proven, then each block of finish's that has something to show. @param {CloseView} view */
const closeDisplay = (view) => [`${view.title} — ready to close`, provenBlock(view), ...finishBlocks(view)].join('\n\n');

/**
 * What the yes does: merge the pull request of each fix done still to land,
 * or, where every one has landed, say so — and mark it complete.
 * @param {CloseView} view
 */
function closeWords({ fixes, landing }) {
  if (landing > 0) return `Close it — merge its ${landing === 1 ? 'pull request' : 'pull requests'} and mark it complete`;
  if (fixes === 0) return 'Close it — mark it complete';
  return `Close it — ${fixes === 1 ? 'its fix has' : 'its fixes have'} landed, so mark it complete`;
}

/** The close's gate: the yes, a review asked for, and questions about the change. @param {CloseView} view */
function closeGate(view) {
  return section('MENU: finish', MENU_INSTRUCTION, menu('', [
    cmdOption('y', 'yes', closeWords(view), { next: { kind: 'engine', argv: ['finish', 'yes', view.unit] } }),
    cmdOption('r', 'review', 'Have it reviewed before it closes'),
    promptOption('Ask', 'Ask about the change before it closes'),
  ], { question: 'Close it?' }));
}

/**
 * A quick-fix's close (19.5.13): its display, then the verdict gate while a
 * departure waits to be asked, else its own gate.
 * @param {CloseView} view
 * @returns {string}
 */
function closeScreen(view) {
  const display = section('DISPLAY: finish', CONTINUE_INSTRUCTION, closeDisplay(view));
  return display + (view.verdict === null ? closeGate(view) : verdictGate(view.verdict, 'close'));
}

module.exports = { finishScreen, closeScreen };
