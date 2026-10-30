'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the topic's map (9.5.6), drawn as the conversation shows it
// (topic-map.cjs): the person's questions, Claude's calls and the rows
// carried over, one line each, each marked with where it stands — open,
// decided, or gone on to another topic or the roadmap — its tag in one
// column across the sections; and above them Claude's calls since the
// person last looked (9.5.5), each under the question it answers.
// ---------------------------------------------------------------------------

const { section, CONTINUE_INSTRUCTION, clipped } = require('./surfaces.cjs');
const { renderTree, TAG_GAP } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');

/** How long a row's question runs before it is cut, so its tag stays on the line. */
const ROW_MAX = 40;

/**
 * A row of the map as it is drawn: its glyph, its question, its tag and the
 * lines beneath it.
 * @typedef {{glyph: string, text: string, tag: string, notes: string[]}} DrawnRow
 */

/**
 * The map as it is drawn: the topic, how many of the person's questions are
 * decided, open and gone on, how many calls Claude made and rows were
 * carried over, the calls since the person last looked, and the rows of
 * each section.
 * @typedef {{
 *   topic: string,
 *   counts: {yours: number, decided: number, open: number, moved: number, calls: number, carried: number},
 *   since: {question: string, answer: string|null}[],
 *   open: DrawnRow[], decided: DrawnRow[], moved: DrawnRow[],
 * }} MapView
 */

/** `n` of a word, the word plural but for one. @param {number} n @param {string} one @param {string} [many] */
function counted(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** A row's glyph and question, cut to keep its tag on the line. @param {DrawnRow} row */
function rowHead({ glyph, text }) {
  return `${glyph} ${clipped(text, ROW_MAX)}`;
}

/** A section's rows as a tree, each tag at the column shared by every section. @param {DrawnRow[]} rows @param {number} column */
function rowTree(rows, column) {
  return renderTree(rows.map((row) => ({ title: `${rowHead(row).padEnd(column)}[${row.tag}]`, body: row.notes })), { width: TREE_WIDTH });
}

/** Claude's calls, and the rows carried over where there are any. @param {MapView['counts']} counts */
function besides({ calls, carried }) {
  return `${counted(calls, 'call')} by Claude${carried > 0 ? ` · ${carried} carried over` : ''}`;
}

/** The map's opening line: the person's questions by where they stand, then the rest. @param {MapView['counts']} counts */
function summary(counts) {
  const { yours, decided, open, moved } = counts;
  const stands = [`${decided} decided`, `${open} open`, ...(moved > 0 ? [`${moved} moved on`] : [])];
  return `${yours} of yours: ${stands.join(', ')} · ${besides(counts)}`;
}

/** Claude's calls since the person last looked, each answer beneath its question. @param {MapView['since']} since */
function sinceTree(since) {
  return renderTree(since.map(({ question, answer }) => ({ title: `◇ ${question}`, body: answer === null ? [] : [answer] })), { width: TREE_WIDTH });
}

/**
 * The map screen.
 * @param {MapView} view
 * @returns {string}
 */
function mapScreen({ topic, counts, since, open, decided, moved }) {
  const blocks = [`Map — ${titlecase(topic)}`];
  const column = Math.max(0, ...[...open, ...decided, ...moved].map((row) => rowHead(row).length)) + TAG_GAP;
  if (counts.yours + counts.calls + counts.carried === 0) {
    blocks[0] += '\nNothing on the map yet: no question asked and no call made.';
  } else {
    blocks[0] += `\n${summary(counts)}`;
  }
  if (since.length > 0) blocks.push(`SINCE YOU LAST LOOKED (${counted(since.length, 'call')} by Claude)\n${sinceTree(since)}`);
  if (open.length > 0) blocks.push(`OPEN (${open.length} of yours)\n${rowTree(open, column)}`);
  if (decided.length > 0) blocks.push(`DECIDED (${counts.decided} of yours · ${besides(counts)})\n${rowTree(decided, column)}`);
  if (moved.length > 0) blocks.push(`MOVED ON (${moved.length} of yours)\n${rowTree(moved, column)}`);
  return section('DISPLAY: map', CONTINUE_INSTRUCTION, blocks.map((block) => block.replace(/\n+$/, '')).join('\n\n'));
}

module.exports = { ROW_MAX, counted, mapScreen };
