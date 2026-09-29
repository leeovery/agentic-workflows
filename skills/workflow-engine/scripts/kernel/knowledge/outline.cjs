'use strict';

// ---------------------------------------------------------------------------
// Kernel: a markdown file's outline, as a query places a chunk in it — the
// lines the chunk's text sits on in the file as it stands, and the headings
// enclosing any line. A chunk is a verbatim slice of its file's body
// (chunker.cjs), so finding its text there finds the chunk.
// ---------------------------------------------------------------------------

const { sourceLines, scanStructure } = require('./chunker.cjs');

/**
 * @typedef {object} Lines  a stretch of a file's lines, counted from 1 with its frontmatter
 * @property {number} first
 * @property {number} last
 */

/**
 * @typedef {object} Outline
 * @property {(content: string) => Lines|null} locate  a chunk's lines — null where the file no longer holds its text
 * @property {(line: number) => string[]} headingsAt  the headings enclosing a line, outermost first
 */

/** @param {string} text */
function lineBreaks(text) {
  return text.split('\n').length - 1;
}

/**
 * @param {string} markdown  the file as it stands
 * @returns {Outline}
 */
function outline(markdown) {
  const { lines, bodyStart } = sourceLines(markdown);
  const bodyLines = lines.slice(bodyStart);
  const body = bodyLines.join('\n');
  const headings = scanStructure(bodyLines).headings.map((heading) => ({ ...heading, line: bodyStart + heading.line + 1 }));
  return {
    locate(content) {
      const at = body.indexOf(content);
      if (at === -1) return null;
      const first = bodyStart + lineBreaks(body.slice(0, at)) + 1;
      return { first, last: first + lineBreaks(content) };
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
