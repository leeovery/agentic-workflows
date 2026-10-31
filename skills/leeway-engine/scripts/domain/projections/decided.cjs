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
//   replaces, and the record's lines withdrawn with the text each withdraws
//   (8.9.2); the new-topic candidates, each with its
//   reason, struck ones marked — in a unit with one topic, the items its yes
//   parks on the roadmap, each with its horizon (8.10.2); and every
//   checklist item skipped, with its
//   reason (6.4.5). Then the first departure on the topic still to be asked
//   its verdict (16.10.2) — the verdict gate, one at a time — and once none
//   is, the decided gate, an authority gate that always stops (3.2.3): its
//   yes covers the lines, the withdrawals and every candidate not struck,
//   their counts in words;
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
 * The decided screen as it is drawn, `title` the topic as screens title it.
 * @typedef {{
 *   unit: string, topic: string, title: string,
 *   decided: string[], carried: string[], moved: number,
 *   calls: {question: string|null, answer: string, kind: string|null, handed: string|null}[],
 *   listed: boolean,
 *   lines: {text: string, replaces: string|null}[],
 *   withdrawals: {text: string, why: string}[],
 *   parks: boolean,
 *   candidates: {name: string, reason: string, struck: boolean, horizon: string|null}[],
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

/** Words as the person reads them, `last` before the last: `a`, `a or b`, `a, b or c`. @param {string[]} words @param {string} last */
function series(words, last) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`;
}

/** What stands where nothing was the person's decision: what every question was instead. @param {DecidedView} view */
function noneOfYours({ calls, carried, moved }) {
  const was = [...(calls.length > 0 ? ['a call of mine'] : []), ...(carried.length > 0 ? ['carried over'] : []), ...(moved > 0 ? ['moved on'] : [])];
  return was.length === 0 ? 'Nothing of yours — no question was asked' : `Nothing of yours — every question was ${series(was, 'or')}`;
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

/** A row of the product-record block, its continuations hung under its text, and beneath it what it changes in the record. @param {string} text @param {string|null} beneath */
function recordRow(text, beneath) {
  const shown = wrapWithPrefix(`· ${text}`, { width: TREE_WIDTH, prefix: INDENT, hang: 2 });
  if (beneath !== null) shown.push(...wrapWithPrefix(beneath, { width: TREE_WIDTH, prefix: `${INDENT}  `, hang: 2 }));
  return shown.join('\n');
}

/** The product-record block: each line, the line it replaces beneath; then each line withdrawn, by why, its text beneath. @param {DecidedView} view */
function recordBlock({ lines, withdrawals }) {
  const counts = [...(lines.length > 0 ? [counted(lines.length, 'line')] : []), ...(withdrawals.length > 0 ? [`${withdrawals.length} withdrawn`] : [])];
  return block(`FOR THE PRODUCT RECORD (${counts.join(' · ')})`, [
    ...lines.map(({ text, replaces }) => recordRow(text, replaces === null ? null : `↳ Replaces: ${replaces}`)),
    ...withdrawals.map(({ text, why }) => recordRow(why, `↳ Withdraws: ${text}`)),
  ].join('\n'));
}

/**
 * How the screen speaks of the candidates: as topics for an epic's map, or
 * as items a one-topic unit parks on the roadmap (8.10.2).
 */
const CANDIDATE_WORDS = Object.freeze({
  map: { heading: 'NEW-TOPIC CANDIDATES', one: 'candidate', many: 'candidates', off: 'it doesn\'t become a topic', ask: 'Which candidate should not become a topic?' },
  roadmap: { heading: 'TO THE ROADMAP', one: 'roadmap item', many: 'roadmap items', off: 'it doesn\'t go on the roadmap', ask: 'Which candidate should stay off the roadmap?' },
});

/** The words for the candidates of a unit that parks them or one that maps them. @param {boolean} parks */
function candidateWords(parks) {
  return CANDIDATE_WORDS[parks ? 'roadmap' : 'map'];
}

/** The candidates, each with its reason beneath, a struck one marked, one parking tagged with its horizon. @param {DecidedView['candidates']} candidates */
function candidateTree(candidates) {
  return renderTree(candidates.map(({ name, reason, struck, horizon }) => {
    const tag = struck ? 'struck' : horizon;
    return {
      title: struck ? `⊘ ${titlecase(name)}` : `○ ${titlecase(name)}`,
      ...(tag === null ? {} : { tag }),
      body: [reason],
    };
  }), { width: TREE_WIDTH });
}

/** The verdict asked of one departure: the question, Claude's answer and the person's. @param {NonNullable<DecidedView['verdict']>} verdict */
function verdictBlock({ at, of, question, lean, yours }) {
  return block(`YOUR VERDICT (${at} of ${counted(of, 'call')} you changed)`, renderTree([{
    title: clipped(question, ROW_MAX),
    body: [...(lean === null ? [] : [`My answer: ${lean}`]), `Yours: ${yours}`],
  }], { width: TREE_WIDTH }));
}

/**
 * The decided screen's display: each block that has something to show.
 * @param {DecidedView} view
 */
function decidedDisplay(view) {
  const { title, decided, carried, calls, listed, lines, withdrawals, parks, candidates, skips, verdict } = view;
  const blocks = [`${title} — decided`];
  blocks.push(block(`WHAT YOU DECIDED (${decided.length})`, decided.length === 0 ? `${INDENT}${noneOfYours(view)}` : questionTree(decided)));
  if (carried.length > 0) blocks.push(block(`CARRIED OVER (${carried.length})`, questionTree(carried)));
  if (calls.length > 0) blocks.push(block(`CLAUDE'S CALLS (${calls.length})`, `${INDENT}${kindCounts(calls)}${listed ? `\n${callTree(calls)}` : ''}`));
  if (lines.length + withdrawals.length > 0) blocks.push(recordBlock(view));
  if (candidates.length > 0) blocks.push(block(`${candidateWords(parks).heading} (${candidates.length})`, candidateTree(candidates)));
  if (skips.length > 0) blocks.push(skips.map(({ text, reason }) => callout(`Skipped: ${text} — ${reason}`, { width: TREE_WIDTH })).join('\n'));
  if (verdict !== null) blocks.push(verdictBlock(verdict));
  return blocks.join('\n\n');
}

/** The numbers the gate says in words. */
const IN_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** `n` of a thing as the gate says it: `the line`, `the two lines`, `the 12 lines`; nothing for none. @param {number} n @param {string} one @param {string} many */
function theCount(n, one, many) {
  if (n === 0) return [];
  return [n === 1 ? `the ${one}` : `the ${IN_WORDS[n] ?? n} ${many}`];
}

/** What the person's yes covers, said on the gate: the lines, the withdrawals and the candidates not struck. @param {DecidedView} view */
function yesCovers({ title, lines, withdrawals, parks, candidates }) {
  const words = candidateWords(parks);
  const covers = [
    ...theCount(lines.length, 'product-record line', 'product-record lines'),
    ...theCount(withdrawals.length, 'withdrawal', 'withdrawals'),
    ...theCount(candidates.filter(({ struck }) => !struck).length, words.one, words.many),
  ];
  return `Your yes marks ${title} decided${covers.length === 0 ? '' : `, with ${series(covers, 'and')}`}.`;
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
  const { unit, topic, calls, listed, parks, candidates } = view;
  const { off } = candidateWords(parks);
  const standing = candidates.flatMap(({ struck }, at) => (struck ? [] : [at + 1]));
  const rows = [cmdOption('y', 'yes', 'Mark it decided', runs(['decided', 'yes', unit, topic]))];
  if (calls.length > 0 && !listed) rows.push(cmdOption('c', 'calls', `See Claude's ${counted(calls.length, 'call')}`, runs(['render', 'decided', addressOf(view), '--calls'])));
  if (standing.length === 1) rows.push(cmdOption('s', 'strike', `Strike the candidate — ${off}`, runs(['decided', 'strike', unit, topic, String(standing[0])])));
  if (standing.length > 1) rows.push(cmdOption('s', 'strike', `Strike a candidate — ${off}`, runs(['render', 'decided-strike', addressOf(view)])));
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
 * @param {{unit: string, topic: string, parks: boolean, candidates: {name: string, struck: boolean}[]}} view
 * @returns {string}
 */
function strikePick(view) {
  const { unit, topic, parks, candidates } = view;
  const rows = candidates.flatMap(({ name, struck }, at) => (struck ? [] : [
    cmdOption(String(at + 1), null, { head: titlecase(name) }, runs(['decided', 'strike', unit, topic, String(at + 1)])),
  ]));
  rows.push(cmdOption('b', 'back', 'Back to the decided screen — nothing struck', runs(['render', 'decided', addressOf(view)])));
  return section('MENU: decided strike', MENU_INSTRUCTION, menu('', rows, { question: candidateWords(parks).ask }));
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
 * @param {string} unit @param {string} topic @param {string} title the topic as screens title it @param {string[]} kinds the kind of each agent running, in dispatch order
 * @returns {string}
 */
function waitAgents(unit, topic, title, kinds) {
  /** @type {Map<string, number>} */
  const byKind = new Map();
  for (const kind of kinds) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  const running = [...byKind].map(([kind, n]) => agentsOfKind(n, kind)).join(', ');
  return section('MENU: wait for agents', MENU_INSTRUCTION, menu(`Still running on ${title}: ${running}.`, [
    cmdOption('w', 'wait', 'Wait — take in what they find first', runs(['render', 'wait-agents', `${unit}.${topic}`])),
    cmdOption('g', 'go', 'Go on — their reports wait for the next opening', { next: { kind: 'continue' } }),
  ], { question: 'Wait for them?' }));
}

module.exports = { decidedScreen, strikePick, waitAgents };
