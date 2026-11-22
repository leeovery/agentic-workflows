'use strict';

// ---------------------------------------------------------------------------
// Domain ring: finish as the person sees it (14.5.1), drawn from the unit's
// checklists and the ledger (finish.cjs): the title; every inbox item the
// unit closed, under CLOSED IN THE INBOX, each with its kind, and that one
// closed wrongly comes back on the person's word (18.6.7); what its reads
// warned of, each a callout, so nothing they took off the checklist goes
// unsaid — never a checklist item skipped, Ledger's own bookkeeping (6.4.5);
// what the review's put backs set aside, where they set aside anything,
// which stays until the person removes it (review-tree.cjs); then the first
// departure the person made in the build and the review phase still to be
// asked its verdict, under the verdict gate at the point `finish` — one at a
// time, as ready to build asks its own, the screen drawn whole once and each
// later verdict alone (16.10.3, 16.10.14, closing.cjs); and once none is,
// finish's gate, an authority gate
// that always stops: an invitation to ask about what was built, answered
// before finishing, then yes and a comment. No measure adds a line to it
// (17.2.2).
//
// A quick-fix's close, its finish gate (19.5.13), is drawn the same but for
// its title, `{Title} — ready to close`; each fix done with its review's
// verdict, under REVIEWED, the round its reviewers passed it in or the
// orchestrator settled it, or, ○, that no reviewer read it, a one-line
// fix, with why; what running the product proved,
// under its title — PROVEN BY RUNNING {PRODUCT}, each fix's scenario a line,
// ✓ where proven, else its standing — or one line saying the project has
// no way to run it (P9); what its notes for later sent to the inbox, under
// WENT TO THE INBOX, as a round's report lists it (19.5.26, review-phase.cjs);
// each fix's work a question's park set aside and
// none put back, a ⚑ line naming where it is kept and the calls that show
// it and bring it into the checkout (R26); each departure asked its verdict at the verdict
// point `close` (16.10.4); and its gate, `Close it?`: the yes, merging its
// pull request where a fix done is still to land — landing its commits
// where the driver opens none — or saying its fixes have landed; a review asked for, `review ask`, until one has been; and
// questions about the change. Its rows and words are Claude's in the spec
// (18.10.8).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, callout, treeList, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { block, verdictBlock, verdictPoint } = require('./closing.cjs');
const { asideBlock, filedBlock } = require('./review-phase.cjs');

/**
 * Finish as it is drawn: the unit and its title, the inbox items it closed,
 * the verdict asked, null where none waits, what its reads warned of, what
 * put back set aside, null where it set aside nothing, the unit's own
 * branch and the default branch it lands on, null for a unit with no branch
 * of its own (14.5.2), and whether it is drawn alone after a verdict.
 * @typedef {{
 *   unit: string, title: string, lands: {branch: string, into: string}|null,
 *   closed: {title: string, kind: string}[],
 *   verdict: import('../ledger-verdicts.cjs').AskedVerdict|null,
 *   warnings: string[],
 *   aside: import('../review-phase.cjs').SetAside|null,
 *   alone: boolean,
 * }} FinishView
 */

/** Every inbox item the unit closed, and that one closed wrongly comes back on the person's word (18.6.7); none where it closed none. @param {FinishView} view @returns {string[]} */
function closedBlock({ title, closed }) {
  if (closed.length === 0) return [];
  const items = renderTree(closed.map((item) => ({ title: item.title, tag: item.kind })), { width: TREE_WIDTH }).replace(/\n$/, '');
  const note = `${closed.length === 1 ? 'It is' : 'Each is'} archived as closed by ${title}. Closed wrongly? Ask me to bring it back.`;
  return [block(`CLOSED IN THE INBOX (${closed.length})`, [items, ...wrapWithPrefix(`↳ ${note}`, { width: TREE_WIDTH, prefix: '  ', hang: 2 })].join('\n'))];
}

/** The blocks under the screen's title, each that has something to show. @param {FinishView} view @returns {string[]} */
function finishBlocks(view) {
  const { verdict, warnings, aside } = view;
  const blocks = [...closedBlock(view)];
  if (warnings.length > 0) blocks.push(warnings.map((warning) => callout(warning, { width: TREE_WIDTH })).join('\n'));
  blocks.push(...asideBlock(aside));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  return blocks;
}

/** The screen's display: its title, then each block that has something to show. @param {FinishView} view */
const finishDisplay = (view) => [`${view.title} — finish`, ...finishBlocks(view)].join('\n\n');

/**
 * Finish's gate: questions about what was built invited, then the yes —
 * saying it lands the unit's own branch on the default branch, where it has
 * one (14.5.2) — and a comment.
 * @param {FinishView} view
 */
function finishGate({ unit, lands }) {
  const yes = lands === null ? 'Land what still stands, and complete the work' : `Land ${lands.branch} on ${lands.into}, and complete the work`;
  return section('MENU: finish', MENU_INSTRUCTION, menu('Ask me anything about what was built first — I answer it before we finish.', [
    cmdOption('y', 'yes', yes, { next: { kind: 'engine', argv: ['finish', 'yes', unit] } }),
    promptOption('Comment', 'Ask about what was built, or tell me what to change'),
  ], { question: 'Finish the work?' }));
}

/**
 * Finish: its display, then the verdict gate while a departure waits to be
 * asked, else finish's gate — drawn alone after a verdict.
 * @param {FinishView} view
 * @returns {string}
 */
function finishScreen(view) {
  return verdictPoint({ name: 'finish', display: () => finishDisplay(view), verdict: view.verdict, point: 'finish', gate: () => finishGate(view), alone: view.alone });
}

/**
 * A fix done as the close shows its review's verdict: its task and title,
 * the round its review ended in, whether the orchestrator settled it, and
 * why no reviewer read it, where none did.
 * @typedef {{task: string, title: string, round: number, settled: boolean, why: string|null}} PairVerdict
 */

/**
 * A quick-fix's close as it is drawn: finish's, with each fix done and its
 * pair's verdict, the product's name, what running it proved of each fix's
 * scenarios — null where the project has no way to run it — what its
 * notes for later sent to the inbox, how many fixes are done, what the yes
 * still lands — null where every fix done has landed — whether its review
 * was asked for, and each fix's work kept set aside, in its words.
 * @typedef {FinishView & {pair: PairVerdict[], product: string, proven: import('./build.cjs').Ran[]|null, filed: {title: string, kind: string}[], fixes: number, landing: Lands|null, reviewed: boolean, kept: string[]}} CloseView
 */

/** What a quick-fix's yes lands: its pull request, or its commits where the driver opens none. @typedef {'pull request'|'commits'} Lands */

/** The yes's words for what it lands. @type {Readonly<Record<Lands, string>>} */
const LANDS = Object.freeze({ 'pull request': 'merge its pull request', commits: 'land its commits' });

/** A fix's line under its review's verdicts: round 0 is no reviewer's, as recorded, with why. @param {PairVerdict} verdict */
const pairLine = ({ task, title, round, settled, why }) => (round === 0 ? `○ ${task} ${title} · not reviewed: ${why}` : `✓ ${task} ${title} · ${settled ? 'settled' : 'passed'} in round ${round}`);

/** Each fix done with its review's verdict (19.5.13). @param {CloseView} view */
function pairBlock({ pair }) {
  const lines = pair.length === 0 ? '  No fix was done.' : treeList(pair.map(pairLine), { indent: '  ', width: TREE_WIDTH });
  return block('REVIEWED', lines);
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

/** The close's display: its title, the pair's verdicts, what was proven, what went to the inbox and the work kept set aside, then each block of finish's that has something to show. @param {CloseView} view */
const closeDisplay = (view) => [`${view.title} — ready to close`, pairBlock(view), provenBlock(view), ...filedBlock(view.filed), ...keptBlock(view), ...finishBlocks(view)].join('\n\n');

/**
 * What the yes does: land what a fix done still holds, or, where every one
 * has landed, say so — and mark it complete.
 * @param {CloseView} view
 */
function closeWords({ fixes, landing }) {
  if (landing !== null) return `Close it — ${LANDS[landing]} and mark it complete`;
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
 * departure waits to be asked, else its own gate — drawn alone after a
 * verdict.
 * @param {CloseView} view
 * @returns {string}
 */
function closeScreen(view) {
  return verdictPoint({ name: 'finish', display: () => closeDisplay(view), verdict: view.verdict, point: 'close', gate: () => closeGate(view), alone: view.alone });
}

module.exports = { finishScreen, closeScreen };
