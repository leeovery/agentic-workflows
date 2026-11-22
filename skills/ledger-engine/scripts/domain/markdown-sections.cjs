'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a document Claude writes, read by its level-two headings for
// the board's pages — a topic's brief (20.11.2), an experiment's design
// (20.13.1). What stands before the first heading, its title aside, is the
// lead, headed by none; then each heading with the text under it to the
// next, trimmed. A line in a fenced block is never a heading, and a section
// with nothing in it is left out.
// ---------------------------------------------------------------------------

const { fencedLines } = require('./spec-sections.cjs');

/** A section of a document: its heading, null for the lead, and its text. @typedef {{heading: string|null, text: string}} HeadedSection */

/** The document's sections in its order (the header's). @param {string} text @returns {HeadedSection[]} */
function headedSections(text) {
  const lines = text.split(/\r\n?|\n/);
  const fenced = fencedLines(lines);
  /** @type {{heading: string|null, lines: string[]}[]} */
  const sections = [{ heading: null, lines: [] }];
  lines.forEach((line, at) => {
    const heading = fenced[at] ? null : /^## +(.+?)\s*$/.exec(line);
    if (heading !== null) sections.push({ heading: heading[1], lines: [] });
    else if (sections.length > 1 || fenced[at] || !/^# /.test(line)) sections[sections.length - 1].lines.push(line);
  });
  return sections.map(({ heading, lines: held }) => ({ heading, text: held.join('\n').trim() })).filter(({ text: held }) => held !== '');
}

module.exports = { headedSections };
