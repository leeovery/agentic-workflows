'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a topic's close as the person sees it (9.7), drawn from the
// record and Claude's staged payload (decided.cjs):
// - the decided screen (9.7.3): what the person decided, and apart from it
//   what was carried over, never passing as theirs (21.6.5); Claude's calls
//   counted by kind, a call not yet labelled counted as such until the
//   labeller gives it one (16.11), opened to list them, one the person
//   handed over marked so (9.5.4); the proposed product-record lines
//   (8.9.7), one replacing a line the record holds shown with the text it
//   replaces (8.9.2); the new-topic candidates, each with its
//   reason, struck ones marked; and every checklist item skipped, with its
//   reason (6.4.5). Then the first departure on the topic still to be asked
//   its verdict (16.10.2) — the verdict gate, one at a time — and once none
//   is, the decided gate, an authority gate that always stops (3.2.3): its
//   yes covers the lines and every candidate not struck;
// - the pick of the candidate to strike, where more than one stands (P8);
// - the wait for the topic's agents still running (9.7.8), a process gate:
//   its wait draws the gate again once their reports land, its go goes on.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, callout, clipped, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { ROW_MAX, counted } = require('./map.cjs');

/** @typedef {import('./surfaces.cjs').Next} Next */

/**
 * The decided screen as it is drawn.
 * @typedef {{
 *   unit: string, topic: string,
 *   decided: string[], carried: string[], moved: number,
 *   calls: {question: string|null, answer: string, kind: string|null, handed: string|null}[],
 *   listed: boolean,
 *   lines: {text: string, replaces: string|null}[],
 *   candidates: {name: string, reason: string, struck: boolean}[],
 *   skips: {text: string, reason: string}[],
 *   verdict: {entry: string, at: number, of: number, question: string, lean: string|null, yours: string}|null,
 * }} DecidedView
 */

const INDENT = '  ';
const CONTINUED = '    ';

/** A block's heading and its lines, or nothing where it has none to show. @param {string} heading @param {string} body */
function block(heading, body) {
  return `${heading}\n${body.replace(/\n+$/, '')}`;
}

/** The decided gate's address for its next steps. @param {{unit: string, topic: string}} view */
function addressOf({ unit, topic }) {
  return `${unit}.${topic}`;
}

/** What answering a row runs: an engine command, by its argv after `engine`. @param {string[]} argv @returns {{next: Next}} */
function runs(argv) {
  return { next: { kind: 'engine', argv } };
}

/** Alternatives as the person reads them: `a`, `a or b`, `a, b or c`. @param {string[]} words */
function either(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;
}

/** What stands where nothing was the person's decision: what every question was instead. @param {DecidedView} view */
function noneOfYours({ calls, carried, moved }) {
  const was = [...(calls.length > 0 ? ['a call of mine'] : []), ...(carried.length > 0 ? ['carried over'] : []), ...(moved > 0 ? ['moved on'] : [])];
  return was.length === 0 ? 'Nothing of yours — no question was asked' : `Nothing of yours — every question was ${either(was)}`;
}

/** Rows by their question alone, each cut to the map's length. @param {string[]} texts */
function questionTree(texts) {
  return renderTree(texts.map((text) => ({ title: clipped(text, ROW_MAX) })), { width: TREE_WIDTH });
}

/** Claude's calls by kind, most first, the unlabelled last: `2 behaviour · 1 look · 3 unlabelled`. @param {DecidedView['calls']} calls */
function kindCounts(calls) {
  /** @type {Map<string, number>} */
  const kinds = new Map();
  for (const { kind } of calls) if (kind !== null) kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  const unlabelled = calls.filter(({ kind }) => kind === null).length;
  const labelled = [...kinds].sort(([, a], [, b]) => b - a).map(([kind, n]) => `${n} ${kind}`);
  return [...labelled, ...(unlabelled > 0 ? [`${unlabelled} unlabelled — the labeller gives each its kind`] : [])].join(' · ');
}

/** Each of Claude's calls, its question cut to keep its tag on the line — its kind, and how the person handed it over where they did — its answer beneath. @param {DecidedView['calls']} calls */
function callTree(calls) {
  return renderTree(calls.map(({ question, answer, kind, handed }) => ({
    title: `◇ ${clipped(question ?? answer, ROW_MAX)}`,
    tag: [kind ?? 'unlabelled', ...(handed === null ? [] : [handed])].join(' · '),
    body: question === null ? [] : [answer],
  })), { width: TREE_WIDTH });
}

/** A line of the product record, its continuations hung under its text, and beneath it the line it replaces. @param {DecidedView['lines'][number]} line */
function recordLine({ text, replaces }) {
  const shown = wrapWithPrefix(`· ${text}`, { width: TREE_WIDTH, prefix: INDENT, hang: 2 });
  if (replaces !== null) shown.push(...wrapWithPrefix(`↳ Replaces: ${replaces}`, { width: TREE_WIDTH, prefix: `${INDENT}  `, hang: 2 }));
  return shown.join('\n');
}

/** The candidates, each with its reason beneath, a struck one marked. @param {DecidedView['candidates']} candidates */
function candidateTree(candidates) {
  return renderTree(candidates.map(({ name, reason, struck }) => ({
    title: struck ? `⊘ ${titlecase(name)}` : `○ ${titlecase(name)}`,
    ...(struck ? { tag: 'struck' } : {}),
    body: [reason],
  })), { width: TREE_WIDTH });
}

/** The verdict asked of one departure: the question, Claude's answer and the person's. @param {NonNullable<DecidedView['verdict']>} verdict */
function verdictBlock({ at, of, question, lean, yours }) {
  return block(`YOUR VERDICT (${at} of ${counted(of, 'call')} you changed)`, renderTree([{
    title: question,
    body: [...(lean === null ? [] : [`My answer: ${lean}`]), `Yours: ${yours}`],
  }], { width: TREE_WIDTH }));
}

/**
 * The decided screen's display: each block that has something to show.
 * @param {DecidedView} view
 */
function decidedDisplay(view) {
  const { topic, decided, carried, calls, listed, lines, candidates, skips, verdict } = view;
  const blocks = [`${titlecase(topic)} — decided`];
  blocks.push(block(`WHAT YOU DECIDED (${decided.length})`, decided.length === 0 ? `${INDENT}${noneOfYours(view)}` : questionTree(decided)));
  if (carried.length > 0) blocks.push(block(`CARRIED OVER (${carried.length})`, questionTree(carried)));
  if (calls.length > 0) blocks.push(block(`CLAUDE'S CALLS (${calls.length})`, `${INDENT}${kindCounts(calls)}${listed ? `\n${callTree(calls)}` : ''}`));
  if (lines.length > 0) blocks.push(block(`FOR THE PRODUCT RECORD (${counted(lines.length, 'line')})`, lines.map(recordLine).join('\n')));
  if (candidates.length > 0) blocks.push(block(`NEW-TOPIC CANDIDATES (${candidates.length})`, candidateTree(candidates)));
  if (skips.length > 0) blocks.push(skips.map(({ text, reason }) => callout(`Skipped: ${text} — ${reason}`, { width: TREE_WIDTH })).join('\n'));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  return blocks.join('\n\n');
}

/** What the person's yes covers, said on the gate: the lines and the candidates not struck. @param {DecidedView} view */
function yesCovers({ topic, lines, candidates }) {
  const standing = candidates.filter(({ struck }) => !struck).length;
  const covers = [
    ...(lines.length === 1 ? ['the product-record line'] : lines.length > 1 ? [`the ${lines.length} product-record lines`] : []),
    ...(standing === 1 ? ['the candidate'] : standing > 1 ? [`the ${standing} candidates`] : []),
  ];
  return `Your yes marks ${titlecase(topic)} decided${covers.length === 0 ? '' : `, with ${covers.join(' and ')}`}.`;
}

/** The verdict gate over the departure the screen asks about: each verdict given at decided. @param {NonNullable<DecidedView['verdict']>} verdict */
function verdictGate({ entry }) {
  const give = (/** @type {string} */ verdict) => runs(['verdict', 'give', entry, verdict, '--at', 'decided']);
  return section('MENU: verdict', MENU_INSTRUCTION, menu('', [
    cmdOption('n', 'nothing', 'Nothing — mine would have served as well', give('nothing')),
    cmdOption('f', 'fix', 'A fix later', give('fix')),
    cmdOption('l', 'loss', 'A real loss', give('loss')),
    cmdOption('s', 'skip', 'Skip — I can\'t call it yet; it waits in the verdict queue', give('skip')),
  ], { question: 'What would my answer have cost the product?' }));
}

/**
 * The decided gate: the yes, Claude's calls opened where they are not
 * listed, the strike where a candidate stands — at once where one does,
 * through a pick where more do — and a comment.
 * @param {DecidedView} view
 */
function decidedGate(view) {
  const { unit, topic, calls, listed, candidates } = view;
  const standing = candidates.flatMap(({ struck }, at) => (struck ? [] : [at + 1]));
  const rows = [cmdOption('y', 'yes', 'Mark it decided', runs(['decided', 'yes', unit, topic]))];
  if (calls.length > 0 && !listed) rows.push(cmdOption('c', 'calls', `See Claude's ${counted(calls.length, 'call')}`, runs(['render', 'decided', addressOf(view), '--calls'])));
  if (standing.length === 1) rows.push(cmdOption('s', 'strike', 'Strike the candidate — it doesn\'t become a topic', runs(['decided', 'strike', unit, topic, String(standing[0])])));
  if (standing.length > 1) rows.push(cmdOption('s', 'strike', 'Strike a candidate — it doesn\'t become a topic', runs(['render', 'decided-strike', addressOf(view)])));
  rows.push(promptOption('Comment', 'Tell me what to change — a product-record line included'));
  return section('MENU: decided', MENU_INSTRUCTION, menu(yesCovers(view), rows, { question: 'Mark it decided?' }));
}

/**
 * The decided screen: its display, then the verdict gate while a departure
 * waits to be asked, else the decided gate.
 * @param {DecidedView} view
 * @returns {string}
 */
function decidedScreen(view) {
  const display = section('DISPLAY: decided', CONTINUE_INSTRUCTION, decidedDisplay(view));
  return display + (view.verdict === null ? decidedGate(view) : verdictGate(view.verdict));
}

/**
 * The pick of the candidate to strike: each standing candidate by its
 * number on the screen, and back to the screen as it was.
 * @param {{unit: string, topic: string, candidates: DecidedView['candidates']}} view
 * @returns {string}
 */
function strikePick(view) {
  const { unit, topic, candidates } = view;
  const rows = candidates.flatMap(({ name, struck }, at) => (struck ? [] : [
    cmdOption(String(at + 1), null, { head: titlecase(name) }, runs(['decided', 'strike', unit, topic, String(at + 1)])),
  ]));
  rows.push(cmdOption('b', 'back', 'Back to the decided screen — nothing struck', runs(['render', 'decided', addressOf(view)])));
  return section('MENU: decided strike', MENU_INSTRUCTION, menu('', rows, { question: 'Which candidate should not become a topic?' }));
}

/** The kinds of agent whose plural is not their name and an s. @type {Readonly<Record<string, string>>} */
const PLURAL_KINDS = Object.freeze({ synthesis: 'syntheses', 'closing-pass': 'closing passes' });

/** `n` agents of a kind, as the person reads them: `1 deep dive`, `2 closing passes`. @param {number} n @param {string} kind */
function agentsOfKind(n, kind) {
  return counted(n, kind.replaceAll('-', ' '), PLURAL_KINDS[kind] ?? `${kind.replaceAll('-', ' ')}s`);
}

/**
 * The wait for the topic's agents still running (9.7.8): which are, by kind,
 * and whether to wait for what they find — the gate drawn again once their
 * reports land, empty when none still runs — or go on to the close, a report
 * landing later taken in when the topic next opens.
 * @param {string} unit @param {string} topic @param {string[]} kinds the kind of each agent running, in dispatch order
 * @returns {string}
 */
function waitAgents(unit, topic, kinds) {
  /** @type {Map<string, number>} */
  const byKind = new Map();
  for (const kind of kinds) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  const running = [...byKind].map(([kind, n]) => agentsOfKind(n, kind)).join(', ');
  return section('MENU: wait for agents', MENU_INSTRUCTION, menu(`Still running on ${titlecase(topic)}: ${running}.`, [
    cmdOption('w', 'wait', 'Wait — take in what they find first', runs(['render', 'wait-agents', `${unit}.${topic}`])),
    cmdOption('g', 'go', 'Go on — their reports wait for the next opening', { next: { kind: 'continue' } }),
  ], { question: 'Wait for them?' }));
}

module.exports = { decidedScreen, strikePick, waitAgents };
