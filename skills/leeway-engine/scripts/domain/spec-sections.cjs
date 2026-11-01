'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's sections and lines — how a unit's `spec.md` is
// addressed and read, the one reading every verb that names a section, a
// scenario or a statement shares (a brief's spec sections, the phase cut's,
// the land's trace). The spec is written by area (11.3.2): an area is a
// numbered heading at level two, `## N. Title`, and a part of it one at
// level three, `### N.M Title`. A section runs from its heading to the next
// heading at its level or above, so an area holds its parts. Headings inside
// a fenced block are text. A spec that numbers one section twice, or a part
// under another area's number, is refused: its sections cannot be addressed.
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
// The spec's lines (11.4.5, 11.11.3) are read as its review page reads them
// (`specStatements`), so the page, the trace and the cut agree on each, its
// rows split at `\n`, `\r\n` or `\r`. The spec opens with its title,
// `# Title`, and what comes before its first area — a contents section,
// `## Contents`, among it — is its introduction. The rest is read in blocks
// split on blank lines, a fenced block — opened and closed by a line opening
// ``` — kept whole:
// - A block opening with a number and a space starts a line: `N.M.K `, a
//   statement, in the part `### N.M`; or `N.Sk `, a scenario, in its area's
//   block of scenarios, `## N-S. …`, after the area.
// - A block opening `Screen…:` after a line starts a screen of it, numbered
//   `<line>-scr<k>` for the k-th.
// - A line owns every block after it up to the next line, screen or heading:
//   paragraphs, lists, fenced blocks.
// - A statement's or a screen's source bracket is the trailing `[...]` of
//   its last block that is not fenced, found without reading its wording:
//   `[Ab12Cd, Ef34Gh]`, the ledger entries it cites by short id;
//   `[builder: Ab12Cd]`, the builder's, citing the "don't care" entry it
//   rests on; or `[builder]` alone, a call the builder was left with no entry
//   (11.4.4). One with none cites nothing. A scenario's source is the
//   statements it draws on, closing its last block that is not fenced in
//   parentheses, `(1.1.1, 1.2.3)`.
// - A line's wording is its blocks, its number and its bracket aside, each
//   block not fenced on one line.
// A spec is refused, naming every fault: one with no title, no area or no
// statement; one its sections refuse; a heading not standing alone, or a
// second title; a heading at level two that is neither an area nor its
// scenarios; a block of scenarios after another area; a statement outside
// its part or a scenario outside its area's block; a line numbered twice; a
// note, a block after a heading opening no line; a screen straight after a
// heading; a block reading as a line — ending in a source bracket, or for a
// scenario's number in its statements — that opens with a number the
// grammar does not read, `1.1.1.` or `- 1.1.1`, where one ending otherwise
// is the text of the line it follows; a line opening straight after
// another's source, a blank line left out; a bracket that is not one of the
// three, or one closing an earlier block than the line's last; a bracket on
// a scenario, or a scenario closing on no statements; a scenario drawing on
// a statement the spec lacks; and a fence left open.
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

/** A heading's level, in its marks. */
const HEADING = /^(#{1,6})(?: |$)/;

/** A line of the spec that opens or closes a fenced block. */
const SPEC_FENCE = /^```/;

/** Where the spec's areas begin: its first heading at level two but its contents. */
const BODY = /^## (?!Contents\b)/;

/** A heading at level two, read as an area's, `## N. Title`, or its scenarios', `## N-S. …`. */
const AREA = /^## (\d+)(-S)?\. (.*)/;

/** A block that starts a line: its number, a statement's or a scenario's, and a space. */
const LINE = /^(\d+\.\d+\.\d+|\d+\.S\d+) /;

/** A block that starts a screen: its caption. */
const SCREEN = /^Screen\b[^\n.]*:/;

/** A block opening with a number the grammar does not read as a line's. */
const NEAR_MISS = /^[-*\s]*\**\d+\.(?:\d+\.\d+|S\d+)\S*/;

/** A heading standing alone in its block, as the page reads one. */
const LONE_HEADING = /^#{2,3} /;

/** A line's source bracket: its last block's trailing `[...]`. */
const SOURCE = /\s*\[([^[\]]*)\]\s*$/;

const CITE = '[0-9A-Za-z]+';

/** A bracket citing entries. */
const CITES = new RegExp(`^${CITE}(?:\\s*,\\s*${CITE})*$`);

/** A bracket marking the builder's, citing the "don't care" entry or none. */
const BUILDER = new RegExp(`^builder(?:\\s*:\\s*(${CITE}))?$`);

const STATEMENT_NUMBER = '[1-9][0-9]*\\.[1-9][0-9]*\\.[1-9][0-9]*';

/** The statements a scenario draws on, its last thing. */
const DRAWS_ON = new RegExp(`\\(\\s*(${STATEMENT_NUMBER}(?:\\s*,\\s*${STATEMENT_NUMBER})*)\\s*\\)\\s*$`);

/** @typedef {{address: string, level: number, text: string}} Section */
/** A section cited, or a range of them: one section where both ends are it. @typedef {{from: string, to: string}} Cite */
/** A block of a line: a fenced one as written, any other as text. @typedef {{kind: 'text'|'fence', text: string}} Part */
/**
 * A line of the spec: a statement, a scenario, a screen, or a note, a block
 * after a heading that opens none, which refuses the spec. Its number — a
 * screen's `<line>-scr<k>`, a note's `<line or area>-note<k>` — the line of
 * the text it opens on, from 1, its wording, and its bracket's contents as
 * written, null where it has none; the entries its bracket cites by short
 * id and whether it is the builder's; the line a screen or a note follows,
 * null for the others; and the statements a scenario draws on.
 * @typedef {{
 *   kind: 'statement'|'scenario'|'screen'|'note', number: string, line: number, wording: string, bracket: string|null,
 *   cites: string[], builder: boolean, of: string|null, drawsOn: string[],
 * }} Line
 */
/** A spec's lines in its order, and the faults that refuse it. @typedef {{lines: Line[], faults: string[]}} SpecReading */

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

/** Whether each line is in a fenced block, its fences among them. @param {string[]} lines @returns {boolean[]} */
function fencedLines(lines) {
  /** @type {{mark: string, length: number}|null} */
  let fence = null;
  return lines.map((line) => {
    const opens = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence !== null) {
      if (opens !== null && opens[1][0] === fence.mark && opens[1].length >= fence.length && line.trim() === opens[1]) fence = null;
      return true;
    }
    if (opens !== null) fence = { mark: opens[1][0], length: opens[1].length };
    return opens !== null;
  });
}

/**
 * Whether each line of a spec is in a fenced block as the spec's page reads
 * one, opened and closed by a line opening ```, its fences among them.
 * @param {string[]} lines @returns {boolean[]}
 */
function specFencedLines(lines) {
  let open = false;
  return lines.map((line) => {
    const fence = SPEC_FENCE.test(line);
    const inside = open || fence;
    if (fence) open = !open;
    return inside;
  });
}

/** A spec's rows, split at each newline as its page reads one: `\n`, `\r\n` or `\r`. @param {string} text */
const rowsOf = (text) => text.split(/\r\n?|\n/);

/** A line's heading level, 0 for a line that is no heading. @param {string} line */
const levelOf = (line) => HEADING.exec(line)?.[1].length ?? 0;

/** Each line's heading level, 0 for one that is no heading or is `fenced`. @param {string[]} lines @param {boolean[]} fenced */
const levelsOf = (lines, fenced) => lines.map((line, at) => (fenced[at] ? 0 : levelOf(line)));

/**
 * Each line's heading level, 0 for a line that is no heading — a line in a
 * fenced block among them.
 * @param {string[]} lines @returns {number[]}
 */
function headingLevels(lines) {
  return levelsOf(lines, fencedLines(lines));
}

/** Where the section a heading at `level` opens on line `at` ends: at the next heading at its level or above. @param {number[]} levels @param {number} at @param {number} level */
function sectionEnd(levels, at, level) {
  let end = at + 1;
  while (end < levels.length && (levels[end] === 0 || levels[end] > level)) end += 1;
  return end;
}

/**
 * Every section a spec's text numbers, by address: its level and its text,
 * from its heading to the next heading at its level or above, the blank
 * lines before that heading left out. Refuses a section numbered twice, and
 * a part numbered under another area than the one it sits in.
 * @param {string} text @returns {Map<string, Section>}
 */
function specSections(text) {
  const lines = rowsOf(text);
  const levels = levelsOf(lines, specFencedLines(lines));
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
    sections.set(address, { address, level: numbered.level, text: lines.slice(at, sectionEnd(levels, at, numbered.level)).join('\n').trimEnd() });
  });
  return sections;
}

/**
 * Each area's block of scenarios in a spec's text, by the area's number:
 * from its heading, `## N-S. …`, to the next heading at level two or above.
 * @param {string} text @returns {Map<string, string>}
 */
function scenarioBlocks(text) {
  const lines = rowsOf(text);
  const levels = levelsOf(lines, specFencedLines(lines));
  /** @type {Map<string, string>} */
  const blocks = new Map();
  lines.forEach((line, at) => {
    const area = levels[at] === 2 ? AREA.exec(line) : null;
    if (area === null || area[2] === undefined) return;
    const block = lines.slice(at, sectionEnd(levels, at, 2)).join('\n').trimEnd();
    blocks.set(area[1], blocks.has(area[1]) ? `${blocks.get(area[1])}\n${block}` : block);
  });
  return blocks;
}

/**
 * A block of a spec's body, between line indexes `at` and `end`, `end` past
 * its last: a fenced block, from its opening fence to its closing one, or to
 * the text's end where it is never `closed`; or a run of lines up to a blank
 * line or a fence.
 * @typedef {{kind: 'fence'|'text', at: number, end: number, closed: boolean}} Block
 */

/** A spec's body, from line `from`, as its blocks, in order. @param {string[]} lines @param {number} from @returns {Block[]} */
function blocksOf(lines, from) {
  /** @type {Block[]} */
  const blocks = [];
  /** @type {Pick<Block, 'kind'|'at'>|null} */
  let open = null;
  const close = (/** @type {number} */ end, closed = open?.kind === 'text') => {
    if (open !== null) blocks.push({ ...open, end, closed });
    open = null;
  };
  for (let at = from; at < lines.length; at += 1) {
    const fence = SPEC_FENCE.test(lines[at]);
    if (open?.kind === 'fence') {
      if (fence) close(at + 1, true);
    } else if (fence) {
      close(at);
      open = { kind: 'fence', at };
    } else if (lines[at].trim() === '') {
      close(at);
    } else if (open === null) {
      open = { kind: 'text', at };
    }
  }
  close(lines.length);
  return blocks;
}

/** A line as it is read: its blocks gathered, its bracket not yet taken off. @typedef {Omit<Line, 'wording'|'bracket'|'cites'|'builder'|'drawsOn'> & {parts: Part[]}} Opened */

/**
 * A spec's body as it is read: its text's lines; where the reading stands —
 * the area, the part, the area whose scenarios it is in, the last statement
 * or scenario, which a screen follows, and the line whose blocks it is
 * gathering; the lines opened; each statement's and scenario's text line by
 * its number; each line's screens and each place's notes counted; and the
 * faults found.
 * @typedef {{
 *   lines: string[], area: string|null, part: string|null, scenariosOf: string|null, last: string|null, open: Opened|null,
 *   opened: Opened[], given: Map<string, number>, counted: Map<string, number>, faults: string[],
 * }} Reading
 */

/** The next of a kind numbered after `of`: `<of>-<kind><k>`. @param {Reading} reading @param {string} of @param {'scr'|'note'} kind */
function nextNumber(reading, of, kind) {
  const key = `${of}-${kind}`;
  const k = (reading.counted.get(key) ?? 0) + 1;
  reading.counted.set(key, k);
  return `${key}${k}`;
}

/** A line opened, gathering the blocks after it. @param {Reading} reading @param {Opened} line */
function openLine(reading, line) {
  reading.open = line;
  reading.opened.push(line);
}

/**
 * The faults of a block's headings: one at level one is a second title, and
 * one at level two or three stands alone in its block, `##` or `###` and its
 * title, or the page reads it as text.
 * @param {Reading} reading @param {Block} block
 */
function headingFaults({ lines, faults }, { at, end }) {
  for (let row = at; row < end; row += 1) {
    const level = levelOf(lines[row]);
    if (level === 1) faults.push(`line ${row + 1} is a second title — the spec has one, # Title, its first line`);
    else if (level > 0 && level < 4 && !(end - at === 1 && LONE_HEADING.test(lines[row]))) faults.push(`the heading on line ${row + 1} does not stand alone — a heading is ## or ### and its title, between blank lines`);
  }
}

/**
 * A line opening straight after another's source, with no blank line
 * between: a fault for each row of a block after its first that opens a
 * numbered line where the row before ends in a bracket, or in the
 * statements a scenario draws on. A row opening with a number after a
 * wrapped row is the line's own text.
 * @param {Reading} reading @param {Block} block
 */
function blankLineFaults({ lines, faults }, { at, end }) {
  for (let row = at + 1; row < end; row += 1) {
    if (LINE.test(lines[row]) && (SOURCE.test(lines[row - 1]) || DRAWS_ON.test(lines[row - 1]))) {
      faults.push(`line ${row + 1} opens a numbered line straight after the source of line ${row} — each line is a block of its own, after a blank line`);
    }
  }
}

/**
 * A heading at level two: an area's, which closes the part, the scenarios
 * and the last line; or its scenarios', which must follow it.
 * @param {Reading} reading @param {number} at @param {string} text
 */
function readArea(reading, at, text) {
  Object.assign(reading, { open: null, part: null });
  const heading = AREA.exec(text);
  if (heading === null) {
    reading.faults.push(`the heading on line ${at + 1} is neither an area, ## N. Title, nor its scenarios, ## N-S. Scenarios for §N`);
    return;
  }
  const [, number, scenarios] = heading;
  if (scenarios === undefined) {
    Object.assign(reading, { area: number, scenariosOf: null, last: null });
    return;
  }
  const { area } = reading;
  if (number !== area) reading.faults.push(`the scenarios on line ${at + 1} are §${number}'s, but follow ${area === null ? 'no area' : `§${area}`} — an area's scenarios follow it, under ## N-S.`);
  reading.scenariosOf = number;
}

/** A heading at level three: a part's, or a heading with no number. @param {Reading} reading @param {string} text */
function readPart(reading, text) {
  Object.assign(reading, { open: null, part: NUMBERED[1].pattern.exec(text)?.[1] ?? null });
}

/** A statement or a scenario opened, its place and its number checked. @param {Reading} reading @param {number} at @param {string} text @param {string} number */
function readNumbered(reading, at, text, number) {
  const line = at + 1;
  const kind = number.includes('.S') ? 'scenario' : 'statement';
  const [area, part] = [number.split('.')[0], number.split('.').slice(0, 2).join('.')];
  if (kind === 'statement' && reading.part !== part) {
    reading.faults.push(`statement ${number} on line ${line} sits under ${reading.part === null ? 'no part' : `§${reading.part}`} — a statement N.M.K sits under ### N.M`);
  }
  if (kind === 'scenario' && reading.scenariosOf !== area) {
    reading.faults.push(`scenario ${number} on line ${line} sits ${reading.scenariosOf === null ? 'in no block of scenarios' : `among §${reading.scenariosOf}'s scenarios`} — a scenario N.Sk sits under ## N-S., after its area`);
  }
  const first = reading.given.get(number);
  if (first === undefined) reading.given.set(number, line);
  else reading.faults.push(`the spec gives ${kind} ${number} twice, on lines ${first} and ${line}`);
  reading.last = number;
  openLine(reading, { kind, number, line, of: null, parts: [{ kind: 'text', text: text.slice(number.length + 1) }] });
}

/** A screen of the last line opened, refused straight after a heading. @param {Reading} reading @param {number} at @param {string} text */
function readScreen(reading, at, text) {
  const of = /** @type {string} */ (reading.last);
  if (reading.open === null) reading.faults.push(`the screen on line ${at + 1} follows a heading — a screen follows the line it shows`);
  openLine(reading, { kind: 'screen', number: nextNumber(reading, of, 'scr'), line: at + 1, of, parts: [{ kind: 'text', text }] });
}

/** A block after a heading that opens no line: a note, refused, gathering the blocks after it. @param {Reading} reading @param {number} at @param {Part} part */
function readNote(reading, at, part) {
  reading.faults.push(`line ${at + 1} opens a note, a block with no number after a heading — every requirement is a numbered line, N.M.K or N.Sk`);
  openLine(reading, { kind: 'note', number: nextNumber(reading, reading.last ?? reading.area ?? '0', 'note'), line: at + 1, of: reading.last, parts: [part] });
}

/**
 * Whether a block opening with a number the grammar does not read, `miss`,
 * reads as a line: it ends in a source bracket, or, for a scenario's number,
 * in the statements a scenario draws on.
 * @param {string} text @param {string} miss
 */
const readsAsLine = (text, miss) => SOURCE.test(text) || (/\d\.S\d/.test(miss) && DRAWS_ON.test(text));

/**
 * A block that is neither a heading nor opens a line or a screen: the open
 * line's, or a note; a fault where it reads as a line opening with a number
 * the grammar does not read.
 * @param {Reading} reading @param {Block} block @param {Part} part
 */
function readOwned(reading, { at, closed }, part) {
  const miss = part.kind === 'text' ? NEAR_MISS.exec(part.text) : null;
  if (miss !== null && readsAsLine(part.text, miss[0])) reading.faults.push(`line ${at + 1} opens "${miss[0].trim()}", a number the spec does not read — a numbered line opens N.M.K or N.Sk and a space`);
  if (!closed) reading.faults.push(`the fenced block opened on line ${at + 1} is never closed`);
  if (reading.open === null) readNote(reading, at, part);
  else reading.open.parts.push(part);
}

/** A block of the body read: a heading, a line opened, a screen, or a block the open line owns. @param {Reading} reading @param {Block} block */
function readBlock(reading, block) {
  const text = reading.lines.slice(block.at, block.end).join('\n');
  if (block.kind === 'fence') return readOwned(reading, block, { kind: 'fence', text });
  headingFaults(reading, block);
  blankLineFaults(reading, block);
  if (text.startsWith('## ')) return readArea(reading, block.at, text);
  if (text.startsWith('### ')) return readPart(reading, text);
  const numbered = LINE.exec(text);
  if (numbered !== null) return readNumbered(reading, block.at, text, numbered[1]);
  if (SCREEN.test(text) && reading.last !== null) return readScreen(reading, block.at, text);
  return readOwned(reading, block, { kind: 'text', text });
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

/** Where a line's last block that is not fenced stands among its blocks, -1 where none is. @param {Part[]} parts */
function lastText(parts) {
  let at = parts.length - 1;
  while (at >= 0 && parts[at].kind !== 'text') at -= 1;
  return at;
}

/** A block's text on one line. @param {string} text */
const oneLine = (text) => text.split(/\s+/).filter((word) => word !== '').join(' ');

/**
 * A line's blocks with its bracket taken off its last block that is not
 * fenced — that block dropped where nothing else is left of it — and the
 * bracket's contents, null where it has none.
 * @param {Part[]} parts @returns {{parts: Part[], bracket: string|null}}
 */
function bracketOff(parts) {
  const last = lastText(parts);
  const source = last === -1 ? null : SOURCE.exec(parts[last].text);
  if (source === null) return { parts, bracket: null };
  const rest = parts[last].text.slice(0, source.index);
  return { parts: parts.flatMap((part, at) => (at !== last ? [part] : rest.trim() === '' ? [] : [{ kind: 'text', text: rest }])), bracket: source[1] };
}

/** A source citing nothing and drawing on nothing, fresh lists for each line. @returns {Pick<Line, 'cites'|'builder'|'drawsOn'>} */
const noSource = () => ({ cites: [], builder: false, drawsOn: [] });

/**
 * A scenario's source: the statements its last block that is not fenced
 * closes on, in parentheses; a fault where it carries a bracket, or closes
 * on none.
 * @param {Reading} reading @param {Opened} line @param {Part[]} parts @param {string|null} bracket
 * @returns {Pick<Line, 'cites'|'builder'|'drawsOn'>}
 */
function scenarioSource(reading, { number, line }, parts, bracket) {
  if (bracket !== null) reading.faults.push(`scenario ${number} on line ${line} ends in [${bracket}] — a scenario's source is the statements it draws on, in parentheses`);
  const drawsOn = DRAWS_ON.exec(parts[lastText(parts)]?.text ?? '');
  if (drawsOn === null) {
    reading.faults.push(`scenario ${number} on line ${line} closes on no statements — a scenario ends in the statements it draws on, (N.M.K, …)`);
    return noSource();
  }
  return { ...noSource(), drawsOn: drawsOn[1].split(',').map((drawn) => drawn.trim()) };
}

/**
 * A statement's or a screen's source: what its bracket cites; a fault for a
 * bracket of none of the three forms, or, where its last block that is not
 * fenced has none, for one closing an earlier block.
 * @param {Reading} reading @param {Opened} line @param {Part[]} parts @param {string|null} bracket
 * @returns {Pick<Line, 'cites'|'builder'|'drawsOn'>}
 */
function citedSource(reading, { kind, number, line }, parts, bracket) {
  if (bracket === null) {
    if (parts.slice(0, lastText(parts)).some((part) => part.kind === 'text' && SOURCE.test(part.text))) {
      reading.faults.push(`${kind} ${number} on line ${line}: its bracket closes an earlier block — the bracket closes the line's last text block`);
    }
    return noSource();
  }
  const source = sourceOf(bracket);
  if (source !== null) return { ...noSource(), ...source };
  reading.faults.push(`${kind} ${number} on line ${line} ends in [${bracket}], which is no source bracket — [id, id, …], [builder: id] or [builder]`);
  return noSource();
}

/** How each kind of line's source is read. @type {Readonly<Record<Line['kind'], (reading: Reading, line: Opened, parts: Part[], bracket: string|null) => Pick<Line, 'cites'|'builder'|'drawsOn'>>>} */
const SOURCES = Object.freeze({ statement: citedSource, screen: citedSource, scenario: scenarioSource, note: noSource });

/** A line read whole: its wording and its source. @param {Reading} reading @param {Opened} opened @returns {Line} */
function finished(reading, opened) {
  const { parts: gathered, ...line } = opened;
  const { parts, bracket } = bracketOff(gathered);
  const wording = parts.map(({ kind, text }) => (kind === 'text' ? oneLine(text) : text)).join('\n');
  return { ...line, wording, bracket, ...SOURCES[opened.kind](reading, opened, parts, bracket) };
}

/**
 * The faults a spec read whole shows: no statement; a scenario drawing on a
 * statement it lacks.
 * @param {Line[]} lines @returns {string[]}
 */
function wholeFaults(lines) {
  const numbers = new Set(lines.filter(({ kind }) => kind === 'statement').map(({ number }) => number));
  return [
    ...(numbers.size === 0 ? ['the spec has no statement — a statement is a block opening N.M.K, in its part'] : []),
    ...lines.flatMap(({ kind, number, drawsOn }) => (kind === 'scenario' ? drawsOn.filter((drawn) => !numbers.has(drawn)).map((drawn) => `scenario ${number} draws on statement ${drawn}, which the spec lacks`) : [])),
  ];
}

/**
 * A spec's lines, in its order, as its page reads them, and every fault
 * that refuses it.
 * @param {string} text @returns {SpecReading}
 */
function specReading(text) {
  const lines = rowsOf(text);
  /** @type {Reading} */
  const reading = {
    lines, area: null, part: null, scenariosOf: null, last: null, open: null, opened: [], given: new Map(), counted: new Map(), faults: [],
  };
  if (!lines[0].startsWith('# ')) reading.faults.push('the spec does not open with its title — its first line is # Title');
  try {
    specSections(text);
  } catch (err) {
    reading.faults.push(messageOf(err));
  }
  const body = lines.findIndex((line) => BODY.test(line));
  if (body === -1) reading.faults.push('the spec has no area — an area is a heading ## N. Title');
  else for (const block of blocksOf(lines, body)) readBlock(reading, block);
  const read = reading.opened.map((opened) => finished(reading, opened));
  return { lines: read, faults: [...reading.faults, ...wholeFaults(read)] };
}

/**
 * A spec's statements, scenarios and screens, in its order. Refuses, naming
 * every fault, one per line, a spec the grammar cannot read.
 * @param {string} text @returns {Line[]}
 */
function specStatements(text) {
  const { lines, faults } = specReading(text);
  if (faults.length > 0) throw new Error(faults.join('\n'));
  return lines;
}

/**
 * Every scenario a spec's text gives, by id, in the spec's order. Refuses
 * what `specStatements` does.
 * @param {string} text @returns {string[]}
 */
function specScenarios(text) {
  return specStatements(text).filter(({ kind }) => kind === 'scenario').map(({ number }) => number);
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

module.exports = {
  SPEC_FILE, specPath, readSpec, headingLevels, citedSections, specSections, scenarioBlocks, specReading, specStatements, specScenarios, sectionsCited, readCitedSections,
};
