'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the lists a log holds under fixed headings of its own, which
// only a verb writes and a reader takes back — an epic's discovery logs'
// (discovery-log.cjs) and an investigation's topic log (investigation-log.cjs).
// The conversation writes the rest of the log, in sections under headings of
// its own.
//
// - An entry is a line under a fixed heading, at the margin outside a fenced
//   block, opening on a list's bullet; its body, the lines indented beneath
//   it, up to the first that is not. Prose under the heading, and a line
//   indented beneath no entry, is passed over.
// - A heading written again adds to its list.
// - Writing puts an entry after the last entry under the last of its heading
//   outside a fenced block and the lines indented beneath it, as the first
//   where none is, or under the heading added at the log's end where the log
//   has none. A body goes beneath its entry, each line indented by
//   `BODY_INDENT`, deeper than a fence or a heading opens, so no line of a
//   body is ever read as either.
// ---------------------------------------------------------------------------

const { fencedLines } = require('./spec-sections.cjs');
const { BULLET } = require('./list-items.cjs');

const ITEM = new RegExp(`^${BULLET}(.*)$`);

/** A line indented beneath an entry. */
const INDENTED = /^\s+\S/;

/** A level-two heading, as headedSections reads one. */
const HEADING = /^## +(.+?)\s*$/;

/** How deep a body's lines sit beneath their entry. */
const BODY_INDENT = '    ';

/**
 * A log's lines read: whether each is in a fenced block, and the fixed
 * heading of `headings` each stands under, its heading's own line among
 * them, else null.
 * @typedef {{fenced: boolean[], under: (string|null)[]}} Read
 */

/** @param {string[]} lines @param {readonly string[]} headings @returns {Read} */
function linesUnder(lines, headings) {
  const fenced = fencedLines(lines);
  /** @type {string|null} */
  let under = null;
  return {
    fenced,
    under: lines.map((line, at) => {
      const heading = fenced[at] ? null : HEADING.exec(line);
      if (heading !== null) under = headings.includes(heading[1]) ? heading[1] : null;
      return under;
    }),
  };
}

/** Whether a log's line is an entry under a fixed heading: at the margin, outside a fence. @param {Read} read @param {string[]} lines @param {number} at */
const isEntry = ({ fenced, under }, lines, at) => under[at] !== null && !fenced[at] && ITEM.test(lines[at]);

/** An entry as a reader takes it back: its heading, its words past the bullet, and its body. @typedef {{heading: string, entry: string, body: string[]}} Listed */

/**
 * Every entry the text holds under one of `headings`, in order, each with
 * its body, its indent taken off.
 * @param {string} text @param {readonly string[]} headings @returns {Listed[]}
 */
function listedIn(text, headings) {
  const lines = text.split(/\r\n?|\n/);
  const read = linesUnder(lines, headings);
  /** @type {Listed[]} */
  const listed = [];
  lines.forEach((line, at) => {
    if (!isEntry(read, lines, at)) return;
    const body = [];
    for (let next = at + 1; next < lines.length && read.under[next] !== null && INDENTED.test(lines[next]); next += 1) {
      body.push(lines[next].slice(lines[next].startsWith(BODY_INDENT) ? BODY_INDENT.length : lines[next].search(/\S/)));
    }
    listed.push({ heading: /** @type {string} */ (read.under[at]), entry: /** @type {RegExpExecArray} */ (ITEM.exec(line))[1].trim(), body });
  });
  return listed;
}

/** A log's lines outside its fixed lists, their headings left out with them. @param {string[]} lines @param {readonly string[]} headings */
function beyondListsOf(lines, headings) {
  const { under } = linesUnder(lines, headings);
  return lines.filter((_, at) => under[at] === null);
}

/**
 * `text` with `line` put as an entry under the last `## {heading}` outside a
 * fenced block — after its last entry and the lines indented beneath it, or
 * as its first — else under the heading added at the end; `body` beneath
 * it, each line indented by `BODY_INDENT`.
 * @param {string} text @param {readonly string[]} headings @param {string} heading @param {string} line @param {string[]} [body]
 */
function withEntry(text, headings, heading, line, body = []) {
  const written = [`- ${line}`, ...body.map((said) => `${BODY_INDENT}${said}`)];
  const lines = text.split('\n');
  const read = linesUnder(lines, headings);
  let at = -1;
  lines.forEach((held, i) => { if (!read.fenced[i] && HEADING.exec(held)?.[1] === heading) at = i; });
  if (at === -1) {
    const gap = text === '' || text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
    return `${text}${gap}## ${heading}\n\n${written.join('\n')}\n`;
  }
  let section = at + 1;
  while (section < lines.length && read.under[section] === heading) section += 1;
  let last = -1;
  for (let i = at + 1; i < section; i += 1) if (isEntry(read, lines, i)) last = i;
  if (last === -1) {
    let first = at + 1;
    while (first < lines.length && lines[first].trim() === '') first += 1;
    lines.splice(at + 1, first - at - 1, '', ...written, '');
    return lines.join('\n');
  }
  let after = last + 1;
  while (after < section && INDENTED.test(lines[after])) after += 1;
  lines.splice(after, 0, ...written);
  return lines.join('\n');
}

module.exports = { listedIn, beyondListsOf, withEntry };
