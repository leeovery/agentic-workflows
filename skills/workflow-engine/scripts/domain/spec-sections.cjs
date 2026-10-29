'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's sections — how a unit's `spec.md` is addressed, the
// one reading every verb that names a section shares (a brief's spec
// sections, the phase cut's). The spec is written by area (11.3.2): an
// area is a numbered heading at level two, `## N. Title`, and a part of it
// one at level three, `### N.M Title`. A section is cited `§N` or `§N.M`,
// and runs from its heading to the next heading at its level or above, so
// an area holds its parts. Headings inside a fenced block are text. A spec
// that numbers one section twice, or a part under another area's number, is
// refused: its sections cannot be addressed.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');

/** The spec's file in a unit's folder. */
const SPEC_FILE = 'spec.md';

/** A cite of a section in free text: `§` and its number. */
const CITE = /§(\d+(?:\.\d+)*)/g;

/** An area's or a part's heading. */
const NUMBERED = [
  { level: 2, pattern: /^## +([1-9][0-9]*)\. +\S/ },
  { level: 3, pattern: /^### +([1-9][0-9]*\.[1-9][0-9]*) +\S/ },
];

/** @typedef {{address: string, level: number, text: string}} Section */

/** A unit's spec. @param {string} cwd @param {string} unit */
function specPath(cwd, unit) {
  return statePath(cwd, unit, SPEC_FILE);
}

/**
 * Each section a reference cites, by address, in the order it cites them,
 * each once. Refuses a reference that cites none, and a cite deeper than a
 * part.
 * @param {string} reference @returns {string[]}
 */
function citedSections(reference) {
  const cited = [...new Set([...reference.matchAll(CITE)].map((match) => match[1]))];
  if (cited.length === 0) throw new Error(`the spec reference "${reference}" cites no section — a section is cited §N or §N.M`);
  const deeper = cited.find((address) => address.split('.').length > 2);
  if (deeper !== undefined) throw new Error(`§${deeper} is no section — a section is cited §N or §N.M`);
  return cited;
}

/**
 * Each line's heading level, 0 for a line that is no heading — a line in a
 * fenced block among them.
 * @param {string[]} lines @returns {number[]}
 */
function headingLevels(lines) {
  /** @type {{mark: string, length: number}|null} */
  let fence = null;
  return lines.map((line) => {
    const opens = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence !== null) {
      if (opens !== null && opens[1][0] === fence.mark && opens[1].length >= fence.length && line.trim() === opens[1]) fence = null;
      return 0;
    }
    if (opens !== null) {
      fence = { mark: opens[1][0], length: opens[1].length };
      return 0;
    }
    return /^(#{1,6})(?: |$)/.exec(line)?.[1].length ?? 0;
  });
}

/**
 * Every section a spec's text numbers, by address: its level and its text,
 * from its heading to the next heading at its level or above, the blank
 * lines before that heading left out. Refuses a section numbered twice, and
 * a part numbered under another area than the one it sits in.
 * @param {string} text @returns {Map<string, Section>}
 */
function specSections(text) {
  const lines = text.split('\n');
  const levels = headingLevels(lines);
  /** @type {Map<string, Section>} */
  const sections = new Map();
  /** @type {string|null} */
  let area = null;
  lines.forEach((line, at) => {
    if (levels[at] === 1 || levels[at] === 2) area = null;
    const numbered = NUMBERED.find(({ level, pattern }) => levels[at] === level && pattern.test(line));
    if (numbered === undefined) return;
    const address = /** @type {RegExpExecArray} */ (numbered.pattern.exec(line))[1];
    if (sections.has(address)) throw new Error(`the spec numbers §${address} twice`);
    if (numbered.level === 2) area = address;
    else if (address.split('.')[0] !== area) throw new Error(`§${address} sits under ${area === null ? 'no area' : `§${area}`}`);
    let end = at + 1;
    while (end < lines.length && (levels[end] === 0 || levels[end] > numbered.level)) end += 1;
    sections.set(address, { address, level: numbered.level, text: lines.slice(at, end).join('\n').trimEnd() });
  });
  return sections;
}

/**
 * The sections a reference cites, each verbatim from a spec's text, in the
 * order cited — a part cited beside its area, which holds it, left out.
 * Refuses a reference citing none, and a section the spec lacks.
 * @param {string} text @param {string} reference @returns {Section[]}
 */
function sectionsCited(text, reference) {
  const cited = citedSections(reference);
  const sections = specSections(text);
  const missing = cited.filter((address) => !sections.has(address));
  if (missing.length > 0) throw new Error(`the spec has no ${missing.map((address) => `§${address}`).join(', ')}`);
  return cited
    .filter((address) => !address.includes('.') || !cited.includes(address.split('.')[0]))
    .map((address) => /** @type {Section} */ (sections.get(address)));
}

/**
 * The sections a reference cites from a unit's spec (`sectionsCited`),
 * refused where the unit has no spec.
 * @param {string} cwd @param {string} unit @param {string} reference
 * @returns {Section[]}
 */
function readCitedSections(cwd, unit, reference) {
  const file = specPath(cwd, unit);
  if (!fs.existsSync(file)) throw new Error(`${unit} has no spec — its folder holds no ${SPEC_FILE}`);
  return sectionsCited(fs.readFileSync(file, 'utf8'), reference);
}

module.exports = { SPEC_FILE, specPath, citedSections, specSections, sectionsCited, readCitedSections };
