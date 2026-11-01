'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a spec review's report read (11.7.1) — the one grammar by
// which the agent store takes a pass's report in (agent-state.cjs).
//
// A line inside a fenced block — opened by a run of three or more backticks
// or tildes, closed by a bare run of the same at least as long — is text,
// whatever it holds, its markers among them; a fence never closed does not
// read. Of the lines outside one, the first `## Findings` opens the report's
// Findings section, which runs to the report's end: the reviewer's template
// places nothing after it. It reads `None identified.` alone, or holds its
// findings, each opening `### F{n}: {label}`, numbered F1, F2, … in order,
// the next line its lane, `**Lane:** rewrite`, `gap` or `fact`, the bare
// word, then its text. Anything else does not read: a report with no
// `## Findings`, an empty one, a line before the first finding, a finding
// numbered out of order or with its lane missing or written otherwise, a
// finding's heading before the section, and within it any other line
// markdown may read as a heading, in a block quote or a list item among
// them — never the section's end.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');

/** @typedef {{id: string, lane: string}} ReportFinding */
/** A line of a report: its text, its end trimmed, its number, and whether a fence holds it. @typedef {{line: string, number: number, fenced: boolean}} ReportLine */

const NO_FINDING = 'None identified.';
const SECTION = '## Findings';
const FINDING = /^### (F\d+)(?::\s.*)?$/;
const LANE = /^\*\*Lane:\*\* (rewrite|gap|fact)$/;
/** What may open a line before its heading or its fence: a block quote's marker, a list item's, and spaces. */
const CONTAINERS = /^(?:\s*(?:>|[-*+](?=\s)|\d{1,9}[.)](?=\s)))*\s*/;
const HEADING = /^#+(?:\s|$)/;
const FINDING_HEADING = /^#+\s+F\d/;
const FENCE = /^(`{3,}|~{3,})(.*)$/;

/** A line bare of what may open it. @param {string} line */
const bare = (line) => line.replace(CONTAINERS, '');

/** The run of backticks or tildes a line opens a fence with, null where it opens none. @param {string} line @returns {string|null} */
const fenceOpened = (line) => FENCE.exec(bare(line))?.[1] ?? null;

/** Whether a line closes the fence `run` opened. @param {string} line @param {string} run */
function fenceCloses(line, run) {
  const marker = FENCE.exec(bare(line));
  return marker !== null && marker[1][0] === run[0] && marker[1].length >= run.length && marker[2] === '';
}

/**
 * Each line of a report, with its number and whether a fence holds it;
 * refused where a fence is never closed.
 * @param {string} text @returns {ReportLine[]}
 */
function reportLines(text) {
  /** @type {ReportLine[]} */
  const lines = [];
  /** @type {{run: string, number: number}|null} */
  let fence = null;
  for (const [at, raw] of text.split('\n').entries()) {
    const line = raw.trimEnd();
    const opened = fence === null ? fenceOpened(line) : null;
    lines.push({ line, number: at + 1, fenced: fence !== null || opened !== null });
    if (opened !== null) fence = { run: opened, number: at + 1 };
    else if (fence !== null && fenceCloses(line, fence.run)) fence = null;
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
  section.forEach(({ line, number, fenced }, i) => {
    const heading = fenced ? null : FINDING.exec(line);
    if (heading === null) {
      if (!fenced && HEADING.test(bare(line))) throw new Error(`line ${number}, \`${line}\`: the \`${SECTION}\` section runs to the report's end, and a heading in it opens a finding, \`### F{n}: {label}\` — a heading its text quotes sits in a fenced block`);
      if (findings.length === 0) throw new Error(`line ${number}: the \`${SECTION}\` section holds findings, each opening \`### F{n}: {label}\`, or reads \`${NO_FINDING}\` alone`);
      return;
    }
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
