'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's sections and scenarios — how a unit's `spec.md` is
// addressed, the one reading every verb that names a section or a scenario
// shares (a brief's spec sections, the phase cut's). The spec is written by
// area (11.3.2): an area is a numbered heading at level two, `## N. Title`,
// and a part of it one at level three, `### N.M Title`. A section runs from
// its heading to the next heading at its level or above, so an area holds
// its parts. Headings inside a fenced block are text. A spec that numbers
// one section twice, or a part under another area's number, is refused: its
// sections cannot be addressed. A scenario is a line opening with its id,
// `N.Sk `, anywhere in the spec but inside a fenced block; a spec giving one
// id twice is refused, as its scenarios cannot be placed.
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
//
// The lines of a spec (11.4.5, 11.11.3), one grammar for every reader of
// them (`specStatements`):
// - A statement is a paragraph opening with its number and a space, `N.M.K `,
//   in the part `### N.M`, running to the next blank line, heading or fence.
//   Its source bracket is its last thing, found from its end without reading
//   its wording: `[Ab12Cd, Ef34Gh]`, the ledger entries it cites by short id;
//   `[builder: Ab12Cd]`, the builder's, citing the "don't care" entry it
//   rests on; or `[builder]` alone, a call the builder was left with no
//   entry (11.4.4). Its wording is what lies between its number and its
//   bracket. A statement with no bracket cites nothing.
// - A scenario, `N.Sk `, is a paragraph in its area's block of scenarios,
//   under the heading `## N-S. …` that follows the area; the statements it
//   draws on close it in parentheses, `(1.1.1, 1.2.3)`, as its source.
// - A screen is a fenced block following a statement or a scenario in its
//   section, numbered by that line, `<number>-scr<k>` for the k-th; a
//   paragraph with no number may stand between them.
// - Any other paragraph is prose, and a number inside a fenced block or
//   inline code opens no line.
// A spec is refused, naming every fault: one with no area; one its sections
// refuse; a statement outside its part or a scenario outside its area's
// block; a statement or scenario numbered twice; a line opening one inside
// another paragraph, where a blank line was left out; a bracket that is not
// one of the three; a scenario drawing on a statement the spec lacks; a
// block of scenarios for an area the spec lacks; a fenced block following
// no numbered line in its section; and a fence left open.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');

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

/** A scenario's line, opening with its id. */
const SCENARIO = /^([1-9][0-9]*\.S[1-9][0-9]*) /;

/** A fenced block's opening fence, or its closing one. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** A heading's level, in its marks. */
const HEADING = /^(#{1,6})(?: |$)/;

const WHOLE = '[1-9][0-9]*';
const STATEMENT_NUMBER = `${WHOLE}\\.${WHOLE}\\.${WHOLE}`;

/** A statement's opening: its part, `N.M`, then its own number, and a space. */
const STATEMENT = new RegExp(`^(${WHOLE}\\.${WHOLE})\\.(${WHOLE}) `);

/** The heading of an area's block of scenarios, `## N-S. …`. */
const SCENARIOS_HEADING = new RegExp(`^## +(${WHOLE})-S\\. +\\S`);

/** A statement's source bracket, its last thing. */
const BRACKET = /\[([^[\]]*)\]\s*$/;

const CITE = '[0-9A-Za-z]+';

/** A bracket citing entries. */
const CITES = new RegExp(`^${CITE}(?:\\s*,\\s*${CITE})*$`);

/** A bracket marking the builder's, citing the "don't care" entry or none. */
const BUILDER = new RegExp(`^builder(?:\\s*:\\s*(${CITE}))?$`);

/** The statements a scenario draws on, its last thing. */
const DRAWS_ON = new RegExp(`\\(\\s*(${STATEMENT_NUMBER}(?:\\s*,\\s*${STATEMENT_NUMBER})*)\\s*\\)\\s*$`);

/** @typedef {{address: string, level: number, text: string}} Section */
/**
 * A statement: its number, the line it opens on, from 1, its wording, the
 * entries its bracket cites by short id, and whether it is the builder's.
 * @typedef {{number: string, line: number, wording: string, cites: string[], builder: boolean}} Statement
 */
/** A scenario: its id, its line, its wording, and the statements it draws on. @typedef {{id: string, line: number, wording: string, statements: string[]}} Scenario */
/** A screen: its number, the line it follows, its own opening line, and its block as written, fences and all. @typedef {{number: string, of: string, line: number, text: string}} Screen */
/** @typedef {{statements: Statement[], scenarios: Scenario[], screens: Screen[]}} SpecLines */
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

/** @typedef {{mark: string, length: number}} Fence */

/** The fence a line opens, or null. @param {string} line @returns {Fence|null} */
function fenceOpened(line) {
  const opens = FENCE.exec(line);
  return opens === null ? null : { mark: opens[1][0], length: opens[1].length };
}

/** Whether a line closes the fence `fence`: its own mark, as long or longer, and nothing else. @param {Fence} fence @param {string} line */
function closes(fence, line) {
  const closing = FENCE.exec(line);
  return closing !== null && closing[1][0] === fence.mark && closing[1].length >= fence.length && line.trim() === closing[1];
}

/** Whether each line is in a fenced block, its fences among them. @param {string[]} lines @returns {boolean[]} */
function fencedLines(lines) {
  /** @type {Fence|null} */
  let fence = null;
  return lines.map((line) => {
    if (fence !== null) {
      if (closes(fence, line)) fence = null;
      return true;
    }
    fence = fenceOpened(line);
    return fence !== null;
  });
}

/** A line's heading level, 0 for a line that is no heading. @param {string} line */
const levelOf = (line) => HEADING.exec(line)?.[1].length ?? 0;

/**
 * Each line's heading level, 0 for a line that is no heading — a line in a
 * fenced block among them.
 * @param {string[]} lines @returns {number[]}
 */
function headingLevels(lines) {
  const fenced = fencedLines(lines);
  return lines.map((line, at) => (fenced[at] ? 0 : levelOf(line)));
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
 * Every scenario a spec's text gives, by id, in the spec's order: each line
 * outside a fenced block opening `N.Sk `. Refuses an id given twice, naming
 * both its lines.
 * @param {string} text @returns {string[]}
 */
function specScenarios(text) {
  const lines = text.split('\n');
  const fenced = fencedLines(lines);
  /** @type {Map<string, number>} each id by the line that gives it, from 1 */
  const given = new Map();
  lines.forEach((line, at) => {
    const id = fenced[at] ? undefined : SCENARIO.exec(line)?.[1];
    if (id === undefined) return;
    if (given.has(id)) throw new Error(`the spec gives scenario ${id} twice, on lines ${given.get(id)} and ${at + 1}`);
    given.set(id, at + 1);
  });
  return [...given.keys()];
}

/**
 * A block of a spec's text, between line indexes `at` and `end`, `end` past
 * its last: a heading outside a fenced block, of its `level`; a fenced block,
 * from its opening fence to its closing one, or to the text's end where it
 * is never `closed`; or a paragraph.
 * @typedef {{kind: 'heading'|'fence'|'paragraph', at: number, end: number, level: number, closed: boolean}} Block
 */

/**
 * The block opening at line `at`, or null for a blank line. A paragraph runs
 * to a blank line, a heading or a fence.
 * @param {string[]} lines @param {number} at @returns {Block|null}
 */
function blockAt(lines, at) {
  const fence = fenceOpened(lines[at]);
  if (fence !== null) {
    let close = at + 1;
    while (close < lines.length && !closes(fence, lines[close])) close += 1;
    return { kind: 'fence', at, end: Math.min(close + 1, lines.length), level: 0, closed: close < lines.length };
  }
  const level = levelOf(lines[at]);
  if (level > 0) return { kind: 'heading', at, end: at + 1, level, closed: true };
  if (lines[at].trim() === '') return null;
  let end = at + 1;
  while (end < lines.length && lines[end].trim() !== '' && levelOf(lines[end]) === 0 && fenceOpened(lines[end]) === null) end += 1;
  return { kind: 'paragraph', at, end, level: 0, closed: true };
}

/** A spec's text as its blocks, in order. @param {string[]} lines @returns {Block[]} */
function blocksOf(lines) {
  /** @type {Block[]} */
  const blocks = [];
  for (let at = 0; at < lines.length;) {
    const block = blockAt(lines, at);
    if (block !== null) blocks.push(block);
    at = block === null ? at + 1 : block.end;
  }
  return blocks;
}

/**
 * A spec's lines as they are read: its text's lines; where the reading
 * stands — the areas met, the part and the area whose scenarios it is in,
 * and the last statement or scenario of its section, which a screen
 * follows; what it has read; each statement's and scenario's line by its
 * number; each line's screens counted; the blocks of scenarios met; and the
 * faults found.
 * @typedef {{
 *   lines: string[], areas: Set<string>, part: string|null, scenariosOf: string|null, last: string|null,
 *   read: SpecLines, given: Map<string, number>, screens: Map<string, number>, blocks: {area: string, line: number}[], faults: string[],
 * }} Reading
 */

/**
 * A heading met: at its level or above it closes the part and the last line,
 * at an area's level the block of scenarios, and it opens what it numbers.
 * @param {Reading} reading @param {Block} block
 */
function readHeading(reading, { at, level }) {
  const line = reading.lines[at];
  if (level <= 3) Object.assign(reading, { part: null, last: null });
  if (level <= 2) reading.scenariosOf = null;
  if (level === 3) reading.part = NUMBERED[1].pattern.exec(line)?.[1] ?? null;
  if (level !== 2) return;
  const area = NUMBERED[0].pattern.exec(line)?.[1];
  if (area !== undefined) reading.areas.add(area);
  const scenariosOf = SCENARIOS_HEADING.exec(line)?.[1];
  if (scenariosOf === undefined) return;
  reading.scenariosOf = scenariosOf;
  reading.blocks.push({ area: scenariosOf, line: at + 1 });
}

/** A fenced block met: the next screen of the last line of its section. @param {Reading} reading @param {Block} block */
function readFence(reading, { at, end, closed }) {
  const { last } = reading;
  if (!closed) {
    reading.faults.push(`the fenced block opened on line ${at + 1} is never closed`);
  } else if (last === null) {
    reading.faults.push(`the fenced block on line ${at + 1} follows no statement or scenario in its section — a screen follows the line it shows`);
  } else {
    const k = (reading.screens.get(last) ?? 0) + 1;
    reading.screens.set(last, k);
    reading.read.screens.push({ number: `${last}-scr${k}`, of: last, line: at + 1, text: reading.lines.slice(at, end).join('\n') });
  }
}

/** A statement's or scenario's number recorded, a second giving of it a fault. @param {Reading} reading @param {string} kind @param {string} number @param {number} line */
function givenOnce(reading, kind, number, line) {
  const first = reading.given.get(number);
  if (first === undefined) reading.given.set(number, line);
  else reading.faults.push(`the spec gives ${kind} ${number} twice, on lines ${first} and ${line}`);
}

/**
 * What a source bracket's contents cite, and whether they mark the line the
 * builder's; null where they are none of the three forms.
 * @param {string} contents @returns {{cites: string[], builder: boolean}|null}
 */
function sourceOf(contents) {
  const said = contents.trim();
  const builder = BUILDER.exec(said);
  if (builder !== null) return { cites: builder[1] === undefined ? [] : [builder[1]], builder: true };
  return CITES.test(said) ? { cites: said.split(',').map((cite) => cite.trim()), builder: false } : null;
}

/** A statement read from its paragraph. @param {Reading} reading @param {number} at @param {string} text @param {RegExpExecArray} opening */
function readStatement(reading, at, text, [opened, part, own]) {
  const [number, line] = [`${part}.${own}`, at + 1];
  if (reading.part !== part) reading.faults.push(`statement ${number} on line ${line} sits under ${reading.part === null ? 'no part' : `§${reading.part}`} — a statement N.M.K sits under ### N.M`);
  givenOnce(reading, 'statement', number, line);
  const body = text.slice(opened.length);
  const bracket = BRACKET.exec(body);
  const source = bracket === null ? { cites: [], builder: false } : sourceOf(bracket[1]);
  if (bracket !== null && source === null) {
    reading.faults.push(`statement ${number} on line ${line} ends in [${bracket[1]}], which is no source bracket — [id, id, …], [builder: id] or [builder]`);
  }
  const wording = (bracket === null ? body : body.slice(0, bracket.index)).trim();
  reading.read.statements.push({ number, line, wording, ...(source ?? { cites: [], builder: false }) });
  reading.last = number;
}

/** A scenario read from its paragraph. @param {Reading} reading @param {number} at @param {string} text @param {string} id */
function readScenario(reading, at, text, id) {
  const line = at + 1;
  const { scenariosOf } = reading;
  if (scenariosOf !== id.split('.')[0]) {
    reading.faults.push(`scenario ${id} on line ${line} sits ${scenariosOf === null ? 'in no block of scenarios' : `among §${scenariosOf}'s scenarios`} — a scenario N.Sk sits under ## N-S., after its area`);
  }
  givenOnce(reading, 'scenario', id, line);
  const body = text.slice(id.length + 1);
  const drawsOn = DRAWS_ON.exec(body);
  const wording = (drawsOn === null ? body : body.slice(0, drawsOn.index)).trim();
  reading.read.scenarios.push({ id, line, wording, statements: drawsOn === null ? [] : drawsOn[1].split(',').map((number) => number.trim()) });
  reading.last = id;
}

/** Whether a line opens a statement or a scenario. @param {string} line */
const opensNumbered = (line) => STATEMENT.test(line) || SCENARIO.test(line);

/**
 * A paragraph met: a statement, a scenario, or prose. A line inside it that
 * opens a numbered line is a fault: each is a paragraph of its own.
 * @param {Reading} reading @param {Block} block
 */
function readParagraph(reading, { at, end }) {
  for (let inside = at + 1; inside < end; inside += 1) {
    if (opensNumbered(reading.lines[inside])) reading.faults.push(`line ${inside + 1} opens a numbered line inside the paragraph of line ${at + 1} — each statement and scenario is a paragraph of its own, after a blank line`);
  }
  const text = reading.lines.slice(at, end).join('\n');
  const statement = STATEMENT.exec(text);
  if (statement !== null) return readStatement(reading, at, text, statement);
  const scenario = SCENARIO.exec(text);
  if (scenario !== null) readScenario(reading, at, text, scenario[1]);
}

/** How each kind of block is read. @type {Readonly<Record<Block['kind'], (reading: Reading, block: Block) => void>>} */
const READERS = Object.freeze({ heading: readHeading, fence: readFence, paragraph: readParagraph });

/**
 * The faults a spec read whole shows: no area; a block of scenarios for an
 * area it lacks; a scenario drawing on a statement it lacks.
 * @param {Reading} reading @returns {string[]}
 */
function wholeFaults({ areas, blocks, read }) {
  const numbers = new Set(read.statements.map(({ number }) => number));
  return [
    ...(areas.size === 0 ? ['the spec has no area — an area is a heading ## N. Title'] : []),
    ...blocks.filter(({ area }) => !areas.has(area)).map(({ area, line }) => `the scenarios on line ${line} are §${area}'s, an area the spec lacks`),
    ...read.scenarios.flatMap(({ id, statements }) => statements.filter((number) => !numbers.has(number)).map((number) => `scenario ${id} draws on statement ${number}, which the spec lacks`)),
  ];
}

/**
 * A spec's statements, scenarios and screens, each in the spec's order.
 * Refuses, naming every fault, a spec the grammar cannot read.
 * @param {string} text @returns {SpecLines}
 */
function specStatements(text) {
  /** @type {Reading} */
  const reading = {
    lines: text.split('\n'), areas: new Set(), part: null, scenariosOf: null, last: null,
    read: { statements: [], scenarios: [], screens: [] }, given: new Map(), screens: new Map(), blocks: [], faults: [],
  };
  try {
    specSections(text);
  } catch (err) {
    reading.faults.push(messageOf(err));
  }
  for (const block of blocksOf(reading.lines)) READERS[block.kind](reading, block);
  reading.faults.push(...wholeFaults(reading));
  if (reading.faults.length > 0) throw new Error(reading.faults.join('; '));
  return reading.read;
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

/** A unit's spec's text, refused where the unit has none. @param {string} cwd @param {string} unit */
function readSpec(cwd, unit) {
  const file = specPath(cwd, unit);
  if (!fs.existsSync(file)) throw new Error(`${unit} has no spec — its folder holds no ${SPEC_FILE}`);
  return fs.readFileSync(file, 'utf8');
}

/**
 * The sections a reference cites from a unit's spec (`sectionsCited`),
 * refused where the unit has no spec.
 * @param {string} cwd @param {string} unit @param {string} reference
 * @returns {Section[]}
 */
function readCitedSections(cwd, unit, reference) {
  return sectionsCited(readSpec(cwd, unit), reference);
}

module.exports = { SPEC_FILE, specPath, readSpec, headingLevels, citedSections, specSections, specScenarios, specStatements, sectionsCited, readCitedSections };
