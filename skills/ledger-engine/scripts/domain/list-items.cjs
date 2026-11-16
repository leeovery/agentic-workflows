'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a list in an agent's report — a reviewer's findings
// (round-report.cjs), an account's differences (task-account.cjs), a
// consolidation's notes (notes.cjs) — read as a careful writer writes one,
// and never losing or misreading what it holds: what is shaped like an item
// but cannot be read is refused, naming the line.
//
// An item opens on a line at the margin, outside a fenced block, its marker
// `-`, `*`, `+`, `N.` or `N)`, and holds every line to the next item's,
// whatever they are: indented or not, a fence, a heading below level two.
// Lines before the first item are a lead-in, which no reader reads, and a
// thematic break, `---`, is a line of neither. Each reader names the lines,
// outside a fenced block, that open no item but are shaped like one
// (`listItems`' `faultOf`), and the list refuses each. A list says there is
// nothing where its one line that is neither blank nor a break begins, an
// item or not, with the word `None`, emphasis allowed (`saysNone`).
// ---------------------------------------------------------------------------

const { fencedLines } = require('./spec-sections.cjs');

/** An item's marker and the space after it, opening its line, for an item's pattern. */
const BULLET = '(?:[-*+]|[0-9]+[.)])[ \\t]+';

/** Text that begins with the word `None`, emphasis allowed. */
const NONE = /^[*_]*none(?![\w-])/i;

/** A thematic break: three or more of one of `-`, `*` or `_`, spaces between them allowed. */
const BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

/** @typedef {{opened: RegExpExecArray, beneath: {line: string, fenced: boolean}[]}} Item */

/**
 * The items of a list — each the match of the line that opens it, and the
 * lines beneath it, with whether each is in a fenced block — and the fault
 * of each line outside a fenced block that opens none but is shaped like
 * one, as the reader's `faultOf` names it.
 * @param {string[]} lines @param {RegExp} opens the pattern an item's first line matches
 * @param {(line: string, first: boolean) => string|null} [faultOf] a line's fault, given whether no item has opened before it
 * @returns {{items: Item[], faults: string[]}}
 */
function listItems(lines, opens, faultOf = () => null) {
  const fenced = fencedLines(lines);
  /** @type {Item[]} */
  const items = [];
  /** @type {string[]} */
  const faults = [];
  lines.forEach((line, at) => {
    const read = !fenced[at] && !BREAK.test(line);
    const opened = read ? opens.exec(line) : null;
    if (opened !== null) {
      items.push({ opened, beneath: [] });
      return;
    }
    const fault = read ? faultOf(line, items.length === 0) : null;
    if (fault !== null) faults.push(fault);
    items.at(-1)?.beneath.push({ line, fenced: fenced[at] });
  });
  return { items, faults };
}

/** Whether an item's text, or a line's, begins with the word `None`. @param {string} text */
function saysNoneIn(text) {
  return NONE.test(text.trim());
}

/** Whether a list says there is nothing: its one line that is neither blank nor a break, an item or not, begins with the word `None`. @param {string[]} lines */
function saysNone(lines) {
  const held = lines.filter((line) => line.trim() !== '' && !BREAK.test(line));
  return held.length === 1 && saysNoneIn(held[0].trim().replace(new RegExp(`^${BULLET}`), ''));
}

module.exports = { BULLET, listItems, saysNone, saysNoneIn };
