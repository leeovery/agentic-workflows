'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a spec review's report read (11.7.1) — the one grammar by
// which the agent store takes a pass's report in (agent-state.cjs).
//
// A line inside a fenced block — opened by a run of three or more backticks
// or tildes, the text after a backtick run holding no backtick, as in
// markdown, and closed by a bare run of the same at least as long within
// the block quote or list item it opened in — is text, its markers among
// them. A fence never closed does not read, nor one whose block quote or
// list item ends first, nor a line inside one that reads as a finding's
// heading, so a fence opened where none was meant never hides a finding.
// Of the lines outside one, the first `## Findings` opens the report's
// Findings section, which runs to the report's end: the reviewer's template
// places nothing after it. It reads `None identified.` alone, or holds its
// findings, each opening `### F{n}: {label}`, numbered F1, F2, … in order,
// the next line its lane, `**Lane:** rewrite`, `gap` or `fact`, the bare
// word, then its text. Anything else does not read: a report with no
// `## Findings`, an empty one, a line before the first finding, a finding
// numbered out of order or with its lane missing or written otherwise, a
// lane on any other line, a finding's heading before the section, and
// within it any other line markdown may read as a heading, in a block
// quote or a list item among them — never the section's end.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');

/** @typedef {{id: string, lane: string}} ReportFinding */
/** A line of a report: its text, its end trimmed, its number, and whether a fence holds it. @typedef {{line: string, number: number, fenced: boolean}} ReportLine */
/** The block quotes a fence opened in, and the indent its list item's lines take within them. @typedef {{quotes: number, indent: number}} Container */
/** A fence open: the run that opened it, its line, and the container it opened in, null where none. @typedef {{run: string, number: number, container: Container|null}} Fence */

const NO_FINDING = 'None identified.';
const SECTION = '## Findings';
const FINDING = /^### (F\d+)(?::\s.*)?$/;
const LANE = /^\*\*Lane:\*\* (rewrite|gap|fact)$/;
const LANE_LINE = /^\*\*Lane:\*\*/;
/** What may open a line before its heading or its fence: a block quote's marker, a list item's, and spaces. */
const CONTAINERS = /^(?:\s*(?:>|[-*+](?=\s)|\d{1,9}[.)](?=\s)))*\s*/;
const HEADING = /^#+(?:\s|$)/;
const FINDING_HEADING = /^#+\s+F\d/;
const FENCE = /^(`{3,}(?=[^`]*$)|~{3,})(.*)$/;
const QUOTE = /^\s*> ?/;
const LIST_MARKER = /[-*+]|\d[.)]/;

/** A line bare of what may open it. @param {string} line */
const bare = (line) => line.replace(CONTAINERS, '');

/**
 * The block quote or list item a line opens inside, null where it opens in
 * none: spaces alone are no container.
 * @param {string} line @returns {Container|null}
 */
function containerOf(line) {
  const prefix = line.slice(0, line.length - bare(line).length);
  const quotes = prefix.split('>').length - 1;
  const after = prefix.slice(prefix.lastIndexOf('>') + 1);
  const item = quotes === 0 ? after : after.replace(/^ /, '');
  const listed = LIST_MARKER.test(item);
  return quotes === 0 && !listed ? null : { quotes, indent: listed ? item.length : 0 };
}

/** The fence a line opens, null where it opens none. @param {string} line @param {number} number @returns {Fence|null} */
function opening(line, number) {
  const run = FENCE.exec(bare(line))?.[1];
  return run === undefined ? null : { run, number, container: containerOf(line) };
}

/**
 * A line inside a container, bare of it; null where the line ends it — a
 * block quote's marker missing, or a list item's indent short on a line
 * not blank.
 * @param {string} line @param {Container} container @returns {string|null}
 */
function within(line, { quotes, indent }) {
  let rest = line;
  for (let depth = 0; depth < quotes; depth += 1) {
    const quote = QUOTE.exec(rest);
    if (quote === null) return null;
    rest = rest.slice(quote[0].length);
  }
  if (rest.trim() === '') return '';
  return rest.length - rest.trimStart().length >= indent ? rest.slice(indent) : null;
}

/**
 * The fence still open after a line inside it, null where the line closes
 * it; refused where the line ends the container it opened in, or reads as
 * a finding's heading.
 * @param {Fence} fence @param {string} line @param {number} number @returns {Fence|null}
 */
function held(fence, line, number) {
  const rest = fence.container === null ? line : within(line, fence.container);
  if (rest === null) throw new Error(`line ${number} ends the block quote or list item line ${fence.number} opens a fenced block in, the block never closed`);
  const marker = FENCE.exec(rest.trimStart());
  if (marker !== null && marker[1][0] === fence.run[0] && marker[1].length >= fence.run.length && marker[2] === '') return null;
  if (FINDING.test(bare(line))) throw new Error(`line ${number}, \`${line}\`: a finding's heading inside the fenced block line ${fence.number} opens — a fenced block never holds one`);
  return fence;
}

/**
 * Each line of a report, with its number and whether a fence holds it;
 * refused where a fence does not read.
 * @param {string} text @returns {ReportLine[]}
 */
function reportLines(text) {
  /** @type {ReportLine[]} */
  const lines = [];
  /** @type {Fence|null} */
  let fence = null;
  for (const [at, raw] of text.split('\n').entries()) {
    const line = raw.trimEnd();
    const number = at + 1;
    const opened = fence === null ? opening(line, number) : null;
    lines.push({ line, number, fenced: fence !== null || opened !== null });
    fence = opened ?? (fence === null ? null : held(fence, line, number));
  }
  if (fence !== null) throw new Error(`line ${fence.number} opens a fenced block that is never closed`);
  return lines;
}

/**
 * The lines of a report's Findings section, blank lines dropped; refused
 * where the report has none, or a finding's heading stands before it.
 * @param {ReportLine[]} lines @returns {ReportLine[]}
 */
function findingsSection(lines) {
  const at = lines.findIndex(({ line, fenced }) => !fenced && line === SECTION);
  if (at === -1) throw new Error(`it has no \`${SECTION}\` section`);
  const early = lines.slice(0, at).find(({ line, fenced }) => !fenced && FINDING_HEADING.test(bare(line)));
  if (early !== undefined) throw new Error(`line ${early.number}, \`${early.line}\`: a finding stands in the \`${SECTION}\` section`);
  return lines.slice(at + 1).filter(({ line }) => line !== '');
}

/**
 * Refused where a line of the Findings section opening no finding is no
 * finding's text: a heading, a lane on any line but its finding's next, or
 * a line before the first finding.
 * @param {ReportLine} at @param {ReportLine|undefined} previous @param {number} found
 */
function requireText({ line, number, fenced }, previous, found) {
  if (!fenced && HEADING.test(bare(line))) throw new Error(`line ${number}, \`${line}\`: the \`${SECTION}\` section runs to the report's end, and a heading in it opens a finding, \`### F{n}: {label}\` — a heading its text quotes sits in a fenced block`);
  if (!fenced && LANE_LINE.test(bare(line)) && !FINDING.test(previous?.line ?? '')) throw new Error(`line ${number}, \`${line}\`: a lane is the line after its finding's heading, \`### F{n}: {label}\`, and no other`);
  if (found === 0) throw new Error(`line ${number}: the \`${SECTION}\` section holds findings, each opening \`### F{n}: {label}\`, or reads \`${NO_FINDING}\` alone`);
}

/**
 * Each finding of a spec review's report, with its lane, in order; none
 * where it reads `None identified.`. Refused, with what does not read and
 * where, for a report outside the grammar.
 * @param {string} text @returns {ReportFinding[]}
 */
function reportFindings(text) {
  const section = findingsSection(reportLines(text));
  if (section.length === 0) throw new Error(`its \`${SECTION}\` section is empty — with no finding it reads \`${NO_FINDING}\``);
  if (section.length === 1 && section[0].line === NO_FINDING) return [];
  /** @type {ReportFinding[]} */
  const findings = [];
  section.forEach((at, i) => {
    const heading = at.fenced ? null : FINDING.exec(at.line);
    if (heading === null) {
      requireText(at, section[i - 1], findings.length);
      return;
    }
    const { number } = at;
    const id = `F${findings.length + 1}`;
    if (heading[1] !== id) throw new Error(`line ${number}: ${heading[1]} where ${id} comes next — findings are numbered F1, F2, … in order`);
    const lane = LANE.exec(section[i + 1]?.line ?? '');
    if (lane === null) throw new Error(`line ${number}: ${id}'s next line is its lane, \`**Lane:** rewrite\`, \`gap\` or \`fact\`, the bare word`);
    findings.push({ id, lane: lane[1] });
  });
  return findings;
}

/**
 * A report's findings as `reportFindings` reads them, or what does not read.
 * @param {string} text @returns {{findings: ReportFinding[]}|{fault: string}}
 */
function readReport(text) {
  try {
    return { findings: reportFindings(text) };
  } catch (err) {
    return { fault: messageOf(err) };
  }
}

module.exports = { reportFindings, readReport };
