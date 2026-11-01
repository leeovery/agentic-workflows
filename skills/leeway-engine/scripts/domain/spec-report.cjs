'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a spec review's report read (11.7.1) — the one grammar by
// which the agent store takes a pass's report in (agent-state.cjs) and the
// spec's loop reads its findings (spec-passes.cjs).
//
// The report's `## Findings` section, to the next heading of its level or
// above, either reads `None identified.` alone or holds its findings, each
// opening `### F{n}: {label}`, numbered F1, F2, … in order, the next line
// its lane, `**Lane:** rewrite`, `gap` or `fact`, the bare word, then its
// text. Anything else does not read: a report with no `## Findings`, an
// empty one, a line before the first finding, a finding under another
// heading, numbered out of order, or with its lane missing or written
// otherwise.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');

/** @typedef {{id: string, lane: string}} ReportFinding */

const NO_FINDING = 'None identified.';
const SECTION = '## Findings';
const ENDS_SECTION = /^#{1,2} (?!F\d)/;
const HEADING = /^#+ /;
const FINDING = /^### (F\d+)(?::\s.*)?$/;
const LANE = /^\*\*Lane:\*\* (rewrite|gap|fact)$/;

/**
 * The lines of a report's Findings section, each with its line number in the
 * report, blank lines dropped; refused where the report has none.
 * @param {string} text @returns {{line: string, number: number}[]}
 */
function findingsSection(text) {
  const lines = text.split('\n').map((line) => line.trimEnd());
  const at = lines.indexOf(SECTION);
  if (at === -1) throw new Error(`it has no \`${SECTION}\` section`);
  const after = lines.slice(at + 1);
  const end = after.findIndex((line) => ENDS_SECTION.test(line));
  return (end === -1 ? after : after.slice(0, end))
    .map((line, i) => ({ line, number: at + i + 2 }))
    .filter(({ line }) => line !== '');
}

/**
 * Each finding of a spec review's report, with its lane, in order; none
 * where it reads `None identified.`. Refused, with what does not read and
 * where, for a report outside the grammar.
 * @param {string} text @returns {ReportFinding[]}
 */
function reportFindings(text) {
  const section = findingsSection(text);
  if (section.length === 0) throw new Error(`its \`${SECTION}\` section is empty — with no finding it reads \`${NO_FINDING}\``);
  if (section.length === 1 && section[0].line === NO_FINDING) return [];
  /** @type {ReportFinding[]} */
  const findings = [];
  section.forEach(({ line, number }, i) => {
    const heading = FINDING.exec(line);
    if (heading === null) {
      if (HEADING.test(line)) throw new Error(`line ${number}, \`${line}\`: a finding opens \`### F{n}: {label}\``);
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

/** What does not read in a report, null where it reads. @param {string} text @returns {string|null} */
function reportFault(text) {
  try {
    reportFindings(text);
    return null;
  } catch (err) {
    return messageOf(err);
  }
}

module.exports = { reportFindings, reportFault };
