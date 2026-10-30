'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the topic's map (9.5.6), drawn as the conversation shows it
// (topic-map.cjs): the person's questions and Claude's calls, one line each,
// each marked with where it stands — open, decided, or gone on to another
// topic or the roadmap — and above them Claude's calls since the person
// last looked (9.5.5), each under the question it answers.
// ---------------------------------------------------------------------------

const { section, CONTINUE_INSTRUCTION, clipped } = require('./surfaces.cjs');
const { renderTree } = require('../../kernel/render.cjs');
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
 * decided, open and gone on, how many calls Claude made, the calls since
 * the person last looked, and the rows of each section.
 * @typedef {{
 *   topic: string,
 *   counts: {yours: number, decided: number, open: number, moved: number, calls: number},
 *   since: {question: string, answer: string|null}[],
 *   open: DrawnRow[], decided: DrawnRow[], moved: DrawnRow[],
 * }} MapView
 */

/** `n` of a word, the word plural but for one. @param {number} n @param {string} one @param {string} [many] */
function counted(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** A section's rows as a tree, each question cut to keep its tag on the line. @param {DrawnRow[]} rows */
function rowTree(rows) {
  return renderTree(rows.map(({ glyph, text, tag, notes }) => ({ title: `${glyph} ${clipped(text, ROW_MAX)}`, tag, body: notes })), { width: TREE_WIDTH });
}

/** The map's opening line: the person's questions by where they stand, and Claude's calls. @param {MapView['counts']} counts */
function summary({ yours, decided, open, moved, calls }) {
  const stands = [`${decided} decided`, `${open} open`, ...(moved > 0 ? [`${moved} moved on`] : [])];
  return `${yours} of yours: ${stands.join(', ')} · ${counted(calls, 'call')} by Claude`;
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
  if (counts.yours + counts.calls === 0) {
    blocks[0] += '\nNothing on the map yet: no question asked and no call made.';
  } else {
    blocks[0] += `\n${summary(counts)}`;
  }
  if (since.length > 0) blocks.push(`SINCE YOU LAST LOOKED (${counted(since.length, 'call')} by Claude)\n${sinceTree(since)}`);
  if (open.length > 0) blocks.push(`OPEN (${open.length} of yours)\n${rowTree(open)}`);
  if (decided.length > 0) blocks.push(`DECIDED (${counts.decided} of yours · ${counted(counts.calls, 'call')} by Claude)\n${rowTree(decided)}`);
  if (moved.length > 0) blocks.push(`MOVED ON (${moved.length} of yours)\n${rowTree(moved)}`);
  return section('DISPLAY: map', CONTINUE_INSTRUCTION, blocks.map((block) => block.replace(/\n+$/, '')).join('\n\n'));
}

module.exports = { ROW_MAX, counted, mapScreen };
