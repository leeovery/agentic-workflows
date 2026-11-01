'use strict';

// ---------------------------------------------------------------------------
// A spec review's report read (leeway-engine/scripts/domain/spec-report.cjs),
// the one grammar the agent store takes a pass's report in by: its
// `## Findings` section, to the next heading of its level or above, reads
// `None identified.` alone, or holds its findings, each opening
// `### F{n}: {label}`, numbered F1, F2, … in order, its first line its lane,
// `**Lane:** rewrite`, `gap` or `fact`, the bare word. Everything else is
// refused, naming what does not read and where: no such section, an empty
// one, a line before the first finding, a finding under another heading or a
// heading in its text, one numbered out of order, and a lane missing, written
// in backticks or another case, with its colon outside the bold, or after a
// line of its own.
//
// Layer: unit. World: none — reports as values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { reportFindings, reportFault } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/spec-report.cjs'));

/** A report: its title, summary, and the Findings section's lines. @param {string[]} findings */
const report = (findings) => ['# Spec Review — spec-review-001', '', '## Summary', '', 'Read it all.', '', '## Findings', '', ...findings].join('\n');

/** A finding's lines: its heading, its lane line, its text. @param {string} id @param {string} lane */
const finding = (id, lane) => [`### ${id}: a label`, '', lane, '', 'What the product meets.', ''];

describe('a spec review\'s report read (11.7.1)', () => {
  it('reads its findings, each with its lane, in order — none where it reads None identified. — the section ending at the next heading of its level', () => {
    const three = report([...finding('F1', '**Lane:** gap'), ...finding('F2', '**Lane:** fact'), ...finding('F3', '**Lane:** rewrite'), '## Notes', '', '#### Not a finding']);

    assert.deepStrictEqual(reportFindings(three), [{ id: 'F1', lane: 'gap' }, { id: 'F2', lane: 'fact' }, { id: 'F3', lane: 'rewrite' }]);
    assert.deepStrictEqual(reportFindings(report(['None identified.'])), []);
    assert.deepStrictEqual(reportFindings(report(['### F1', '**Lane:** gap'])), [{ id: 'F1', lane: 'gap' }]);
  });

  it('refuses a report outside the grammar, naming what does not read and where', () => {
    const lane = (/** @type {string} */ id) => `${id}'s next line is its lane, \`**Lane:** rewrite\`, \`gap\` or \`fact\`, the bare word`;
    const faults = [
      ['# Spec Review\n\nNothing found.', 'it has no `## Findings` section'],
      [report([]), 'its `## Findings` section is empty — with no finding it reads `None identified.`'],
      [report(finding('F1', '**Lane:** `gap`')), `line 9: ${lane('F1')}`],
      [report(finding('F1', '**Lane:** Gap')), `line 9: ${lane('F1')}`],
      [report(finding('F1', '**Lane**: gap')), `line 9: ${lane('F1')}`],
      [report(['### F1: a label', '', 'The lane comes next.', '', '**Lane:** gap']), `line 9: ${lane('F1')}`],
      [report(['### F1: a label', '', 'No lane at all.']), `line 9: ${lane('F1')}`],
      [report(finding('F1', '**Lane:** blocker')), `line 9: ${lane('F1')}`],
      [report(['#### F1: a label', '', '**Lane:** gap']), 'line 9, `#### F1: a label`: a finding opens `### F{n}: {label}`'],
      [report(['## F1: a label', '', '**Lane:** gap']), 'line 9, `## F1: a label`: a finding opens `### F{n}: {label}`'],
      [report(['### F1 — a label', '', '**Lane:** gap']), 'line 9, `### F1 — a label`: a finding opens `### F{n}: {label}`'],
      [report([...finding('F1', '**Lane:** gap'), '#### Detail']), 'line 15, `#### Detail`: a finding opens `### F{n}: {label}`'],
      [report([...finding('F1', '**Lane:** gap'), ...finding('F3', '**Lane:** fact')]), 'line 15: F3 where F2 comes next — findings are numbered F1, F2, … in order'],
      [report(['These need a look.', '', ...finding('F1', '**Lane:** gap')]), 'line 9: the `## Findings` section holds findings, each opening `### F{n}: {label}`, or reads `None identified.` alone'],
      [report(['None identified.', '', ...finding('F1', '**Lane:** gap')]), 'line 9: the `## Findings` section holds findings, each opening `### F{n}: {label}`, or reads `None identified.` alone'],
    ];

    assert.deepStrictEqual(faults.map(([text]) => reportFault(text)), faults.map(([, fault]) => fault));
    assert.strictEqual(reportFault(report(['None identified.'])), null);
  });
});
