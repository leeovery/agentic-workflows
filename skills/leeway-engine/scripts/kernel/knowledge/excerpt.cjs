'use strict';

// ---------------------------------------------------------------------------
// Kernel: an excerpt — the passage of a chunk a query prints in its place.
// The lines sharing the most of the query's words win, rarer words weighing
// more, widened by the lines around them while the budget holds; heading
// lines are never excerpt material. A chunk no line of which shares a word
// shows its opening lines, and a line over the budget on its own is cut at
// word boundaries around its matching stretch, each cut marked.
// ---------------------------------------------------------------------------

const { tokenize } = require('./keyword.cjs');
const { scanStructure } = require('./chunker.cjs');

const CUT = '…';

/**
 * @typedef {object} Unit  a line of a chunk, or a word of an over-long line
 * @property {number} start  its offset in the chunk
 * @property {number} end
 * @property {number} line  the chunk line it is on, from 0
 * @property {string[]} shared  the query's words it holds
 */

/**
 * @typedef {object} Window  a run's units `from` to `to`
 * @property {Unit[]} run  units an excerpt may join
 * @property {number} from
 * @property {number} to
 */

/**
 * @typedef {object} Excerpt
 * @property {string} text
 * @property {number} line  the chunk line the text starts on, from 0
 */

/**
 * @param {string} text @param {Set<string>} words
 * @returns {string[]} the query's words the text holds
 */
function sharedWords(text, words) {
  return [...new Set(tokenize(text))].filter((word) => words.has(word));
}

/**
 * The chunk's lines an excerpt may show, in runs a heading line ends. A
 * blank line is no unit, but a window spans it.
 * @param {string} content @param {Set<string>} words
 * @returns {Unit[][]}
 */
function lineRuns(content, words) {
  const lines = content.split('\n');
  const headings = new Set(scanStructure(lines).headings.map((heading) => heading.line));
  /** @type {Unit[][]} */
  const runs = [[]];
  let start = 0;
  lines.forEach((text, line) => {
    if (headings.has(line)) runs.push([]);
    else if (text.trim() !== '') runs[runs.length - 1].push({ start, end: start + text.length, line, shared: sharedWords(text, words) });
    start += text.length + 1;
  });
  return runs.filter((run) => run.length > 0);
}

/**
 * The words of one line, as a run.
 * @param {string} content @param {Unit} line @param {Set<string>} words
 * @returns {Unit[]}
 */
function wordRun(content, line, words) {
  return [...content.slice(line.start, line.end).matchAll(/\S+/g)].map((match) => {
    const start = line.start + /** @type {number} */ (match.index);
    return { start, end: start + match[0].length, line: line.line, shared: sharedWords(match[0], words) };
  });
}

/** @param {Set<string>} shared @param {(word: string) => number} rarity */
function weightOf(shared, rarity) {
  let weight = 0;
  for (const word of shared) weight += rarity(word);
  return weight;
}

/**
 * The window within the budget whose units share the query's words of most
 * weight — the earliest of equals, from its first sharing unit to the one
 * that completed it; else the first run's opening unit. Null for no units.
 * A unit over the budget on its own is a window of one.
 * @param {Unit[][]} runs @param {(word: string) => number} rarity @param {number} budget
 * @returns {Window|null}
 */
function bestStretch(runs, rarity, budget) {
  /** @type {Window|null} */
  let best = null;
  let most = 0;
  for (const run of runs) {
    run.forEach((first, from) => {
      if (first.shared.length === 0) return;
      const shared = new Set();
      for (let to = from; to < run.length && (to === from || run[to].end - first.start <= budget); to += 1) {
        for (const word of run[to].shared) shared.add(word);
        const weight = weightOf(shared, rarity);
        if (weight > most) {
          best = { run, from, to };
          most = weight;
        }
      }
    });
  }
  return best || (runs.length > 0 ? { run: runs[0], from: 0, to: 0 } : null);
}

/**
 * The window grown a unit at a time, before it and after it, while it fits
 * the budget.
 * @param {Window} window @param {number} budget
 * @returns {Window}
 */
function widened({ run, from, to }, budget) {
  /** @param {number} a @param {number} b */
  const fits = (a, b) => run[b].end - run[a].start <= budget;
  for (let grew = true; grew;) {
    const before = from > 0 && fits(from - 1, to);
    if (before) from -= 1;
    const after = to < run.length - 1 && fits(from, to + 1);
    if (after) to += 1;
    grew = before || after;
  }
  return { run, from, to };
}

/**
 * A line over the budget, cut at word boundaries around its matching
 * stretch, a mark where each cut falls. A single word over the budget is
 * cut within itself.
 * @param {string} content @param {Unit} line @param {Set<string>} words
 * @param {(word: string) => number} rarity @param {number} budget
 */
function cutLine(content, line, words, rarity, budget) {
  const room = budget - 2 * CUT.length;
  const run = wordRun(content, line, words);
  const { from, to } = widened(/** @type {Window} */ (bestStretch([run], rarity, room)), room);
  const text = content.slice(run[from].start, run[to].end);
  const kept = text.slice(0, room);
  return `${from > 0 ? CUT : ''}${kept}${to < run.length - 1 || kept.length < text.length ? CUT : ''}`;
}

/**
 * The passage of a chunk that best matches a query's words, at most
 * `budget` characters — empty for a chunk of nothing but headings.
 * @param {string} content  the chunk's text
 * @param {Set<string>} words  the query's words, as the search tokenizes them
 * @param {(word: string) => number} rarity  each word's weight
 * @param {number} budget
 * @returns {Excerpt}
 */
function excerpt(content, words, rarity, budget) {
  const stretch = bestStretch(lineRuns(content, words), rarity, budget);
  if (!stretch) return { text: '', line: 0 };
  const { run, from, to } = widened(stretch, budget);
  const text = content.slice(run[from].start, run[to].end);
  return {
    text: text.length <= budget ? text : cutLine(content, run[from], words, rarity, budget),
    line: run[from].line,
  };
}

module.exports = { excerpt };
