'use strict';

// ---------------------------------------------------------------------------
// Kernel: a markdown file's outline, as a query places a chunk in it — the
// lines the chunk's text sits on in the file as it stands, and the headings
// enclosing any line. A chunk is a verbatim slice of its file (chunker.cjs),
// found at the first line that starts with its text; the headings are the
// body's, never the frontmatter's.
// ---------------------------------------------------------------------------

const { sourceLines, scanStructure, lineStarts, lineHolding } = require('./chunker.cjs');

/**
 * @typedef {object} Lines  a stretch of a file's lines, counted from 1 with its frontmatter
 * @property {number} first
 * @property {number} last
 */

/**
 * @typedef {object} Outline
 * @property {(content: string) => Lines|null} locate  a chunk's lines — null where no line of the file starts with its text
 * @property {(line: number) => string[]} headingsAt  the headings enclosing a line, outermost first
 */

/**
 * The first offset at which `content` starts a line of `text` — -1 where it starts none.
 * @param {string} text @param {string} content
 */
function lineStartOf(text, content) {
  let at = text.indexOf(content);
  while (at > 0 && text[at - 1] !== '\n') at = text.indexOf(content, at + 1);
  return at;
}

/**
 * @param {string} markdown  the file as it stands
 * @returns {Outline}
 */
function outline(markdown) {
  const { lines, bodyStart } = sourceLines(markdown);
  const text = lines.join('\n');
  const starts = lineStarts(lines);
  const headings = scanStructure(lines.slice(bodyStart)).headings.map((heading) => ({ ...heading, line: bodyStart + heading.line + 1 }));
  return {
    locate(content) {
      const at = lineStartOf(text, content);
      if (at === -1) return null;
      return { first: lineHolding(starts, at) + 1, last: lineHolding(starts, at + content.length - 1) + 1 };
    },
    headingsAt(line) {
      /** @type {typeof headings} */
      const enclosing = [];
      for (const heading of headings) {
        if (heading.line > line) break;
        while (enclosing.length > 0 && enclosing[enclosing.length - 1].level >= heading.level) enclosing.pop();
        enclosing.push(heading);
      }
      return enclosing.map((heading) => heading.text);
    },
  };
}

module.exports = { outline };
