'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what an authority gate closing work shows of the record, drawn
// alike by a topic's decided screen (projections/decided.cjs) and ready to
// build (projections/ready-to-build.cjs), a feature's of which carries its
// topic's close (9.7.6):
// - Claude's calls, counted by the kind each carries, a call the labeller
//   gave no label counted as unlabelled (16.11), and opened to list them,
//   one the person handed over marked so (9.5.4);
// - a topic's close (9.7.3): what the person decided, and apart from it what
//   was carried over, never passing as theirs (21.6.5); the proposed
//   product-record lines (8.9.7), one replacing a line the record holds
//   shown with the text it replaces, and the record's lines withdrawn with
//   the text each withdraws (8.9.2); the new-topic candidates, each with its
//   reason, struck ones marked — in a unit with one topic, the items its yes
//   parks on the roadmap, each with its horizon (8.10.2); what the yes
//   covers, their counts in words; and the strike where a candidate stands
//   (P8);
// - the first departure still to be asked its verdict — what it decides,
//   Claude's answer and the person's — and the verdict gate over it, each
//   verdict given at the gate's own point (16.10.2, 16.10.11); the
//   departure's tree and the three verdicts the verdict queue draws alike
//   (projections/verdict-page.cjs).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, clipped, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { ROW_MAX, counted } = require('./map.cjs');

/** A call of Claude's as a gate shows it: the question it answers, its answer, its kind and how the person handed it over. @typedef {{question: string|null, answer: string, kind: string|null, handed: string|null}} ShownCall */
/** @typedef {import('../ledger-verdicts.cjs').AskedVerdict} AskedVerdict */
/** @typedef {import('./surfaces.cjs').Next} Next */

/**
 * A topic's close as a gate draws it: the topic; what the person decided,
 * what was carried over, how many rows went on, and how many of Claude's
 * calls it holds; the product-record lines and withdrawals; whether its
 * candidates park on the roadmap; and the candidates.
 * @typedef {{
 *   unit: string, topic: string,
 *   decided: string[], carried: string[], moved: number, called: number,
 *   lines: {text: string, replaces: string|null}[],
 *   withdrawals: {text: string, why: string}[],
 *   parks: boolean,
 *   candidates: {name: string, reason: string, struck: boolean, horizon: string|null}[],
 * }} TopicClose
 */

const INDENT = '  ';

/** What answering a row runs: an engine command, by its argv after `engine`. @param {string[]} argv @returns {{next: Next}} */
function runs(argv) {
  return { next: { kind: 'engine', argv } };
}

/** A block's heading and its lines. @param {string} heading @param {string} body */
function block(heading, body) {
  return `${heading}\n${body.replace(/\n+$/, '')}`;
}

/** Words as the person reads them, `last` before the last: `a`, `a or b`, `a, b or c`. @param {string[]} words @param {string} last */
function series(words, last) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`;
}

/** Calls counted by the kind each carries, most first, the unlabelled last: `2 behaviour · 1 look · 3 unlabelled`. @param {(string|null)[]} kinds */
function kindCounts(kinds) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const kind of kinds) if (kind !== null) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const unlabelled = kinds.filter((kind) => kind === null).length;
  const labelled = [...counts].sort(([, a], [, b]) => b - a).map(([kind, n]) => `${n} ${kind}`);
  return [...labelled, ...(unlabelled > 0 ? [`${unlabelled} unlabelled`] : [])].join(' · ');
}

/** Each of Claude's calls, its question cut to keep its tag on the line — its kind, and how the person handed it over where they did — its answer beneath. @param {ShownCall[]} calls */
function callTree(calls) {
  return renderTree(calls.map(({ question, answer, kind, handed }) => ({
    title: `◇ ${clipped(question ?? answer, ROW_MAX)}`,
    tag: [kind ?? 'unlabelled', ...(handed === null ? [] : [handed])].join(' · '),
    body: question === null ? [] : [answer],
  })), { width: TREE_WIDTH });
}

/** The calls block: their count by kind, listed beneath where `listed`. @param {ShownCall[]} calls @param {boolean} listed */
function callsBlock(calls, listed) {
  return block(`CLAUDE'S CALLS (${calls.length})`, `  ${kindCounts(calls.map(({ kind }) => kind))}${listed ? `\n${callTree(calls)}` : ''}`);
}

/** What stands where nothing was the person's decision: what every question was instead. @param {TopicClose} close */
function noneOfYours({ called, carried, moved }) {
  const was = [...(called > 0 ? ['a call of mine'] : []), ...(carried.length > 0 ? ['carried over'] : []), ...(moved > 0 ? ['moved on'] : [])];
  return was.length === 0 ? 'Nothing of yours — no question was asked' : `Nothing of yours — every question was ${series(was, 'or')}`;
}

/** Rows by their question alone, each cut to the map's length. @param {string[]} texts */
function questionTree(texts) {
  return renderTree(texts.map((text) => ({ title: clipped(text, ROW_MAX) })), { width: TREE_WIDTH });
}

/** What the person decided, and apart from it what was carried over, where any was. @param {TopicClose} close */
function decidedBlocks(close) {
  const { decided, carried } = close;
  return [
    block(`WHAT YOU DECIDED (${decided.length})`, decided.length === 0 ? `${INDENT}${noneOfYours(close)}` : questionTree(decided)),
    ...(carried.length > 0 ? [block(`CARRIED OVER (${carried.length})`, questionTree(carried))] : []),
  ];
}

/** A row of the product-record block, its continuations hung under its text, and beneath it what it changes in the record. @param {string} text @param {string|null} beneath */
function recordRow(text, beneath) {
  const shown = wrapWithPrefix(`· ${text}`, { width: TREE_WIDTH, prefix: INDENT, hang: 2 });
  if (beneath !== null) shown.push(...wrapWithPrefix(beneath, { width: TREE_WIDTH, prefix: `${INDENT}  `, hang: 2 }));
  return shown.join('\n');
}

/** The product-record block: each line, the line it replaces beneath; then each line withdrawn, by why, its text beneath. @param {TopicClose} close */
function recordBlock({ lines, withdrawals }) {
  const counts = [...(lines.length > 0 ? [counted(lines.length, 'line')] : []), ...(withdrawals.length > 0 ? [`${withdrawals.length} withdrawn`] : [])];
  return block(`FOR THE PRODUCT RECORD (${counts.join(' · ')})`, [
    ...lines.map(({ text, replaces }) => recordRow(text, replaces === null ? null : `↳ Replaces: ${replaces}`)),
    ...withdrawals.map(({ text, why }) => recordRow(why, `↳ Withdraws: ${text}`)),
  ].join('\n'));
}

/**
 * How a screen speaks of the candidates: as topics for an epic's map, or
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

/** The candidates, each with its reason beneath, a struck one marked, one parking tagged with its horizon. @param {TopicClose['candidates']} candidates */
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

/** The product-record block and the candidates, where each has something to show. @param {TopicClose} close */
function recordBlocks(close) {
  const { lines, withdrawals, parks, candidates } = close;
  return [
    ...(lines.length + withdrawals.length > 0 ? [recordBlock(close)] : []),
    ...(candidates.length > 0 ? [block(`${candidateWords(parks).heading} (${candidates.length})`, candidateTree(candidates))] : []),
  ];
}

/** The numbers a gate says in words. */
const IN_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** `n` of a thing as a gate says it: `the line`, `the two lines`, `the 12 lines`; nothing for none. @param {number} n @param {string} one @param {string} many */
function theCount(n, one, many) {
  if (n === 0) return [];
  return [n === 1 ? `the ${one}` : `the ${IN_WORDS[n] ?? n} ${many}`];
}

/** What a yes marking the topic decided covers, said on its gate: `marks {title} decided`, with the lines, the withdrawals and the candidates not struck. @param {TopicClose} close @param {string} title */
function marksDecided({ lines, withdrawals, parks, candidates }, title) {
  const words = candidateWords(parks);
  const covers = [
    ...theCount(lines.length, 'product-record line', 'product-record lines'),
    ...theCount(withdrawals.length, 'withdrawal', 'withdrawals'),
    ...theCount(candidates.filter(({ struck }) => !struck).length, words.one, words.many),
  ];
  return `marks ${title} decided${covers.length === 0 ? '' : `, with ${series(covers, 'and')}`}`;
}

/**
 * The strike where a candidate stands — at once where one does, through the
 * pick where more do — on `key`, `flags` carried into what it runs.
 * @param {TopicClose} close @param {string} key @param {string[]} [flags]
 */
function strikeRows({ unit, topic, parks, candidates }, key, flags = []) {
  const { off } = candidateWords(parks);
  const standing = candidates.flatMap(({ struck }, at) => (struck ? [] : [at + 1]));
  if (standing.length === 1) return [cmdOption(key, 'strike', `Strike the candidate — ${off}`, runs(['decided', 'strike', unit, topic, String(standing[0]), ...flags]))];
  if (standing.length > 1) return [cmdOption(key, 'strike', `Strike a candidate — ${off}`, runs(['render', 'decided-strike', `${unit}.${topic}`, ...flags]))];
  return [];
}

/** The departure a verdict judges, as a tree: the question it answers, Claude's answer and the person's. @param {Pick<AskedVerdict, 'question'|'lean'|'yours'>} departure */
function departureTree({ question, lean, yours }) {
  return renderTree([{
    title: clipped(question, ROW_MAX),
    body: [...(lean === null ? [] : [`My answer: ${lean}`]), `Yours: ${yours}`],
  }], { width: TREE_WIDTH });
}

/** The verdict asked of one departure: the question, Claude's answer and the person's. @param {AskedVerdict} verdict */
function verdictBlock(verdict) {
  return block(`YOUR VERDICT (${verdict.at} of ${counted(verdict.of, 'call')} you changed)`, departureTree(verdict));
}

/** The question every verdict is asked by. */
const VERDICT_QUESTION = 'What would my answer have cost the product?';

/** The three verdicts a departure is given, each by its key, its word and its label, as every verdict point and the queue draw them (16.10.2, 16.10.7). */
const VERDICT_ROWS = Object.freeze([
  Object.freeze({ key: 'n', verdict: 'nothing', label: 'Nothing — mine would have served as well' }),
  Object.freeze({ key: 'f', verdict: 'fix', label: 'A fix later' }),
  Object.freeze({ key: 'l', verdict: 'loss', label: 'A real loss' }),
]);

/**
 * The verdict gate over the departure a screen asks about: each verdict
 * given at `point`, the verdict point the screen is.
 * @param {AskedVerdict} verdict @param {string} point
 */
function verdictGate({ entry }, point) {
  /** @param {string} verdict */
  const give = (verdict) => runs(['verdict', 'give', entry, verdict, '--at', point]);
  return section('MENU: verdict', MENU_INSTRUCTION, menu('', [
    ...VERDICT_ROWS.map(({ key, verdict, label }) => cmdOption(key, verdict, label, give(verdict))),
    cmdOption('s', 'skip', 'Skip — I can\'t call it yet; it waits in the verdict queue', give('skip')),
  ], { question: VERDICT_QUESTION }));
}

module.exports = { runs, block, series, kindCounts, callsBlock, decidedBlocks, recordBlocks, candidateWords, marksDecided, strikeRows, departureTree, verdictBlock, VERDICT_QUESTION, VERDICT_ROWS, verdictGate };
