'use strict';

// ---------------------------------------------------------------------------
// A spec review's report read (leeway-engine/scripts/domain/spec-report.cjs),
// the one grammar the agent store takes a pass's report in by: a line inside
// a fenced block is text, whatever it holds, and a fence never closed does
// not read; the report's `## Findings` section runs to its end and reads
// `None identified.` alone, or holds its findings, each opening
// `### F{n}: {label}`, numbered F1, F2, … in order, its first line its lane,
// `**Lane:** rewrite`, `gap` or `fact`, the bare word. Everything else is
// refused, naming what does not read and where: no such section, an empty
// one, a line before the first finding, a finding's heading before the
// section, any other heading within it — a finding after a heading among
// them, and one indented, in a block quote or in a list item — one numbered
// out of order, and a lane missing, written in backticks or another case,
// with its colon outside the bold, or after a line of its own.
//
// Layer: unit. World: none — reports as values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { reportFindings, readReport } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/spec-report.cjs'));

/** A report: its title, summary, and the Findings section's lines. @param {string[]} findings */
const report = (findings) => ['# Spec Review — spec-review-001', '', '## Summary', '', 'Read it all.', '', '## Findings', '', ...findings].join('\n');

/** A finding's lines: its heading, its lane line, its text. @param {string} id @param {string} lane */
const finding = (id, lane) => [`### ${id}: a label`, '', lane, '', 'What the product meets.', ''];

describe('a spec review\'s report read (11.7.1)', () => {
  it('reads its findings, each with its lane, in order — none where it reads None identified.', () => {
    const three = report([...finding('F1', '**Lane:** gap'), ...finding('F2', '**Lane:** fact'), ...finding('F3', '**Lane:** rewrite')]);

    assert.deepStrictEqual(reportFindings(three), [{ id: 'F1', lane: 'gap' }, { id: 'F2', lane: 'fact' }, { id: 'F3', lane: 'rewrite' }]);
    assert.deepStrictEqual(reportFindings(report(['None identified.'])), []);
    assert.deepStrictEqual(reportFindings(report(['### F1', '**Lane:** gap'])), [{ id: 'F1', lane: 'gap' }]);
  });

  it('a line inside a fenced block is text, whatever it holds — a #, ## or ### line, a finding\'s heading, a shorter run of its marker or a run of the other, the Findings heading quoted before the section', () => {
    const quoted = [
      '# Spec Review — spec-review-001', '', '## Summary', '', 'The template asks for:', '', '~~~', '## Findings', '', '```', '### F1: a label', '~~~', '', '## Findings', '',
      '### F1: the tables are miscounted', '', '**Lane:** fact', '', 'Re-run:', '', '```sh', '# count the tables', 'ls tables | wc -l', '```', '',
      'The spec reads:', '', '````markdown', '## 2. Refunds', '', '### 2.1 Where', '', '```', '### F2: quoted from the last pass', '````', '',
      '### F2: is a refund split?', '', '**Lane:** gap', '', 'No entry decides it.',
    ].join('\n');

    assert.deepStrictEqual(reportFindings(quoted), [{ id: 'F1', lane: 'fact' }, { id: 'F2', lane: 'gap' }]);
  });

  it('refuses a report outside the grammar, naming what does not read and where', () => {
    const lane = (/** @type {string} */ id) => `${id}'s next line is its lane, \`**Lane:** rewrite\`, \`gap\` or \`fact\`, the bare word`;
    const heading = (/** @type {number} */ number, /** @type {string} */ line) => `line ${number}, \`${line}\`: the \`## Findings\` section runs to the report's end, and a heading in it opens a finding, \`### F{n}: {label}\` — a heading its text quotes sits in a fenced block`;
    const faults = [
      ['# Spec Review\n\nNothing found.', 'it has no `## Findings` section'],
      [report([]), 'its `## Findings` section is empty — with no finding it reads `None identified.`'],
      [report(finding('F1', '**Lane:** `gap`')), `line 9: ${lane('F1')}`],
      [report(finding('F1', '**Lane:** Gap')), `line 9: ${lane('F1')}`],
      [report(finding('F1', '**Lane**: gap')), `line 9: ${lane('F1')}`],
      [report(['### F1: a label', '', 'The lane comes next.', '', '**Lane:** gap']), `line 9: ${lane('F1')}`],
      [report(['### F1: a label', '', 'No lane at all.']), `line 9: ${lane('F1')}`],
      [report(finding('F1', '**Lane:** blocker')), `line 9: ${lane('F1')}`],
      [report(['#### F1: a label', '', '**Lane:** gap']), heading(9, '#### F1: a label')],
      [report(['## F1: a label', '', '**Lane:** gap']), heading(9, '## F1: a label')],
      [report(['### F1 — a label', '', '**Lane:** gap']), heading(9, '### F1 — a label')],
      [report([...finding('F1', '**Lane:** gap'), '#### Detail']), heading(15, '#### Detail')],
      [report([...finding('F1', '**Lane:** gap'), '## Notes', '', ...finding('F2', '**Lane:** gap')]), heading(15, '## Notes')],
      [report([...finding('F1', '**Lane:** gap'), '# count the tables']), heading(15, '# count the tables')],
      [report([...finding('F1', '**Lane:** gap'), '  ### F2: a label', '', '**Lane:** gap']), heading(15, '  ### F2: a label')],
      [report([...finding('F1', '**Lane:** gap'), '> ## 2. Refunds']), heading(15, '> ## 2. Refunds')],
      [report([...finding('F1', '**Lane:** gap'), '- ### F2: a label']), heading(15, '- ### F2: a label')],
      [report([...finding('F1', '**Lane:** gap'), '```sh', '# count the tables', '```text', '', ...finding('F2', '**Lane:** gap')]), 'line 15 opens a fenced block that is never closed'],
      [report([...finding('F1', '**Lane:** gap'), '````', '```', '', ...finding('F2', '**Lane:** gap')]), 'line 15 opens a fenced block that is never closed'],
      [['# Spec Review', '', '### F1: a label', '', '**Lane:** gap', '', '## Findings', '', 'None identified.'].join('\n'), 'line 3, `### F1: a label`: a finding stands in the `## Findings` section'],
      [report([...finding('F1', '**Lane:** gap'), ...finding('F3', '**Lane:** fact')]), 'line 15: F3 where F2 comes next — findings are numbered F1, F2, … in order'],
      [report(['These need a look.', '', ...finding('F1', '**Lane:** gap')]), 'line 9: the `## Findings` section holds findings, each opening `### F{n}: {label}`, or reads `None identified.` alone'],
      [report(['None identified.', '', ...finding('F1', '**Lane:** gap')]), 'line 9: the `## Findings` section holds findings, each opening `### F{n}: {label}`, or reads `None identified.` alone'],
    ];

    assert.deepStrictEqual(faults.map(([text]) => readReport(text)), faults.map(([, fault]) => ({ fault })));
    assert.deepStrictEqual(readReport(report(['None identified.'])), { findings: [] });
  });
});
