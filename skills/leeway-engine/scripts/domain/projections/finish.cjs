'use strict';

// ---------------------------------------------------------------------------
// Domain ring: finish as the person sees it (14.5.1), drawn from the unit's
// checklists and the ledger (finish.cjs): the title; every inbox item the
// unit closed, under CLOSED IN THE INBOX, each with its kind, and how one
// closed wrongly comes back (18.6.7); what its reads warned
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
// its title, `{Title} — ready to close`; each fix done with its pair's
// verdict, under REVIEWED BY THE PAIR, the round its pair passed it in or
// the orchestrator settled it; what running the product proved,
// under its title — PROVEN BY RUNNING {PRODUCT}, each fix's scenario a line,
// ✓ where proven, else its standing — or one line saying the project has
// no way to run it (P9); each fix's work a question's park set aside and
// none put back, a ⚑ line naming where it is kept and the calls that show
// it and bring it into the checkout (R26); each departure asked its verdict at the verdict
// point `close` (16.10.4); and its gate, `Close it?`: the yes, merging its
// pull request where a fix done is still to land, or saying its fixes have
// landed; a review asked for, `review ask`, until one has been; and
// questions about the change. Its rows and words are Claude's in the spec
// (18.10.8).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, callout, treeList, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { block, verdictBlock, verdictGate } = require('./closing.cjs');
const { asideBlock } = require('./review-phase.cjs');

/**
 * Finish as it is drawn: the unit and its title, the inbox items it closed,
 * the skips it shows, the verdict asked, null where none waits, what its
 * reads warned of, and what put back set aside, null where it set aside
 * nothing.
 * @typedef {{
 *   unit: string, title: string,
 *   closed: {title: string, kind: string}[],
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

/** Every inbox item the unit closed, and how one closed wrongly comes back (18.6.7); none where it closed none. @param {FinishView} view @returns {string[]} */
function closedBlock({ title, closed }) {
  if (closed.length === 0) return [];
  const items = renderTree(closed.map((item) => ({ title: item.title, tag: item.kind })), { width: TREE_WIDTH }).replace(/\n$/, '');
  const note = closed.length === 1
    ? `It is archived as closed by ${title}. Closed wrongly, it comes back from the archived items in triage, or ask me to bring it back.`
    : `Each is archived as closed by ${title}. One closed wrongly comes back from the archived items in triage, or ask me to bring it back.`;
  return [block(`CLOSED IN THE INBOX (${closed.length})`, [items, ...wrapWithPrefix(`↳ ${note}`, { width: TREE_WIDTH, prefix: '  ', hang: 2 })].join('\n'))];
}

/** The blocks under the screen's title, each that has something to show. @param {FinishView} view @returns {string[]} */
function finishBlocks(view) {
  const { skips, verdict, warnings, aside } = view;
  const blocks = [...closedBlock(view)];
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
 * A fix done as the close shows its pair's verdict: its task and title, the
 * round its review ended in, and whether the orchestrator settled it.
 * @typedef {{task: string, title: string, round: number, settled: boolean}} PairVerdict
 */

/**
 * A quick-fix's close as it is drawn: finish's, with each fix done and its
 * pair's verdict, the product's name, what running it proved of each fix's
 * scenarios — null where the project has no way to run it — how many fixes
 * are done, whether its pull request still holds one to land, whether
 * its review was asked for, and each fix's work kept set aside, in its words.
 * @typedef {FinishView & {pair: PairVerdict[], product: string, proven: import('./build.cjs').Ran[]|null, fixes: number, landing: boolean, reviewed: boolean, kept: string[]}} CloseView
 */

/** A fix's line under its pair's verdicts. @param {PairVerdict} verdict */
const pairLine = ({ task, title, round, settled }) => `✓ ${task} ${title} · ${settled ? 'settled' : 'passed'} in round ${round}`;

/** Each fix done with its pair's verdict (19.5.13). @param {CloseView} view */
function pairBlock({ pair }) {
  const lines = pair.length === 0 ? '  No fix was done.' : treeList(pair.map(pairLine), { indent: '  ', width: TREE_WIDTH });
  return block('REVIEWED BY THE PAIR', lines);
}

/** A scenario's line under what was proven: its glyph, and its standing where short of proven. @param {import('./build.cjs').Ran} ran */
const provenLine = ({ criterion, standing }) => (standing === 'proven' ? `✓ ${criterion}` : `△ ${standing === 'not proven' ? 'Not proven' : 'Named, not run'}: ${criterion}`);

/** What running the product proved, or the one line saying the project has no way to run it (P9). @param {CloseView} view */
function provenBlock({ product, proven }) {
  if (proven === null) return `Nothing was proven by running ${product} — the project has no way to run it`;
  const lines = proven.length === 0 ? '  No fix names a scenario to run.' : treeList(proven.map(provenLine), { indent: '  ', width: TREE_WIDTH });
  return block(`PROVEN BY RUNNING ${product.toUpperCase()}`, lines);
}

/** Each fix's work kept set aside, a ⚑ line each, where any is (R26). @param {CloseView} view */
const keptBlock = ({ kept }) => (kept.length === 0 ? [] : [kept.map((words) => callout(words, { width: TREE_WIDTH })).join('\n')]);

/** The close's display: its title, the pair's verdicts, what was proven and the work kept set aside, then each block of finish's that has something to show. @param {CloseView} view */
const closeDisplay = (view) => [`${view.title} — ready to close`, pairBlock(view), provenBlock(view), ...keptBlock(view), ...finishBlocks(view)].join('\n\n');

/**
 * What the yes does: merge its pull request, where a fix done is still to
 * land, or, where every one has landed, say so — and mark it complete.
 * @param {CloseView} view
 */
function closeWords({ fixes, landing }) {
  if (landing) return 'Close it — merge its pull request and mark it complete';
  if (fixes === 0) return 'Close it — mark it complete';
  return `Close it — ${fixes === 1 ? 'its fix has' : 'its fixes have'} landed, so mark it complete`;
}

/** The close's gate: the yes, a review asked for until one has been (19.5.13), and questions about the change. @param {CloseView} view */
function closeGate(view) {
  return section('MENU: finish', MENU_INSTRUCTION, menu('', [
    cmdOption('y', 'yes', closeWords(view), { next: { kind: 'engine', argv: ['finish', 'yes', view.unit] } }),
    ...(view.reviewed ? [] : [cmdOption('r', 'review', 'Have the whole change reviewed before it closes', { next: { kind: 'engine', argv: ['review', 'ask', view.unit] } })]),
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
