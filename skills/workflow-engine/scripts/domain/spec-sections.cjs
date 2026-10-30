'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's sections — how a unit's `spec.md` is addressed, the
// one reading every verb that names a section shares (a brief's spec
// sections, the phase cut's). The spec is written by area (11.3.2): an
// area is a numbered heading at level two, `## N. Title`, and a part of it
// one at level three, `### N.M Title`. A section runs from its heading to
// the next heading at its level or above, so an area holds its parts.
// Headings inside a fenced block are text. A spec that numbers one section
// twice, or a part under another area's number, is refused: its sections
// cannot be addressed.
//
// A reference cites sections in runs. A run opens at `§` or `§§` and goes
// on over numbers joined by `,`, `and` or `&` — `§1.1, 1.2`, `§1.1 and 2.1`,
// `§§1.1 & 1.2` — each number an area, `N`, or a part, `N.M`. Two numbers
// joined by `–`, `-` or `to` are a range — `§1.1–1.3`, `§1.1-1.3`, `§1 to 3`
// — drawing every section at their level from the first to the last, in the
// spec's order, both included. Every number a run holds is cited: a reference
// citing none, a number deeper than a part, a range whose ends differ in
// level or that runs backwards, and a section the spec lacks are refused,
// naming the reference. The sections are drawn in the order cited, each
// once, a part whose own area is drawn left to the area, which holds it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');

/** The spec's file in a unit's folder. */
const SPEC_FILE = 'spec.md';

const NUMBER = String.raw`\d+(?:\.\d+)*`;
const RANGE = String.raw`–|-|\bto\b`;
const JOIN = String.raw`\s*(?:,\s*(?:(?:and|&)\s*)?|&|\band\b|${RANGE})\s*`;

/** A run of cites in free text. */
const RUN = new RegExp(String.raw`§§?\s*${NUMBER}(?:${JOIN}${NUMBER})*`, 'g');

/** A number in a run, or the mark of a range. */
const TOKEN = new RegExp(String.raw`(${NUMBER})|(${RANGE})`, 'g');

/** An area's or a part's heading. */
const NUMBERED = [
  { level: 2, pattern: /^## +([1-9][0-9]*)\. +\S/ },
  { level: 3, pattern: /^### +([1-9][0-9]*\.[1-9][0-9]*) +\S/ },
];

/** @typedef {{address: string, level: number, text: string}} Section */
/** A section cited, or a range of them: one section where both ends are it. @typedef {{from: string, to: string}} Cite */

/** A unit's spec. @param {string} cwd @param {string} unit */
function specPath(cwd, unit) {
  return statePath(cwd, unit, SPEC_FILE);
}

/** A cite as a reference writes it. @param {Cite} cite */
function shown({ from, to }) {
  return from === to ? `§${from}` : `§${from}–${to}`;
}

/** How deep an address is: 1 for an area, 2 for a part. @param {string} address */
const depth = (address) => address.split('.').length;

/** The cites one run holds, in order. @param {string} run @returns {Cite[]} */
function citesOf(run) {
  /** @type {Cite[]} */
  const cites = [];
  let ranging = false;
  for (const [, number, range] of run.matchAll(TOKEN)) {
    if (range !== undefined) ranging = true;
    else if (ranging) cites[cites.length - 1].to = number;
    else cites.push({ from: number, to: number });
    if (number !== undefined) ranging = false;
  }
  return cites;
}

/**
 * Each section or range a reference cites, in the order it cites them, each
 * once. Refuses, naming the reference, one that cites none, a number deeper
 * than a part, and a range whose ends differ in level.
 * @param {string} reference @returns {Cite[]}
 */
function citedSections(reference) {
  const said = `the spec reference "${reference}"`;
  const all = [...reference.matchAll(RUN)].flatMap(([run]) => citesOf(run));
  const cites = [...new Map(all.map((cite) => [shown(cite), cite])).values()];
  if (cites.length === 0) throw new Error(`${said} cites no section — a section is cited §N or §N.M`);
  const deeper = cites.flatMap(({ from, to }) => [from, to]).find((address) => depth(address) > 2);
  if (deeper !== undefined) throw new Error(`${said} cites §${deeper}, which is no section — a section is cited §N or §N.M`);
  const uneven = cites.find(({ from, to }) => depth(from) !== depth(to));
  if (uneven !== undefined) throw new Error(`${said} cites ${shown(uneven)}, a range whose ends differ in level`);
  return cites;
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
 * order cited, each once — a range's in the spec's order, a part whose own
 * area is drawn left out. Refuses, naming the reference, what
 * `citedSections` does, a section the spec lacks, and a range run backwards.
 * @param {string} text @param {string} reference @returns {Section[]}
 */
function sectionsCited(text, reference) {
  const cites = citedSections(reference);
  const sections = specSections(text);
  const missing = [...new Set(cites.flatMap(({ from, to }) => [from, to]))].filter((address) => !sections.has(address));
  if (missing.length > 0) throw new Error(`the spec reference "${reference}" cites ${missing.map((address) => `§${address}`).join(', ')}, which the spec lacks`);
  const order = [...sections.keys()];
  const drawn = [...new Set(cites.flatMap((cite) => {
    const level = order.filter((address) => depth(address) === depth(cite.from));
    const [first, last] = [level.indexOf(cite.from), level.indexOf(cite.to)];
    if (first > last) throw new Error(`the spec reference "${reference}" cites ${shown(cite)}, a range run backwards`);
    return level.slice(first, last + 1);
  }))];
  return drawn
    .filter((address) => depth(address) === 1 || !drawn.includes(address.split('.')[0]))
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

module.exports = { SPEC_FILE, specPath, headingLevels, citedSections, specSections, sectionsCited, readCitedSections };
