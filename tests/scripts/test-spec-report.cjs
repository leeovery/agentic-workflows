'use strict';

// ---------------------------------------------------------------------------
// A spec review's report read (leeway-engine/scripts/domain/spec-report.cjs),
// the one grammar the agent store takes a pass's report in by: a line inside
// a fenced block is text, and a backtick run with a backtick after it opens
// none, as in markdown; a fence never closed does not read, nor one whose
// block quote or list item ends first, nor a line inside one reading as a
// finding's heading. The report's `## Findings` section runs to its end and
// reads `None identified.` alone, or holds its findings, each opening
// `### F{n}: {label}`, numbered F1, F2, … in order, its first line its lane,
// `**Lane:** rewrite`, `gap` or `fact`, the bare word, the label kept with
// it; a finding's text is what follows its lane, up to the next finding,
// a finding inside a fenced block none. Everything else is
// refused, naming what does not read and where: no such section, an empty
// one, a line before the first finding, a finding's heading before the
// section, any other heading within it — a finding after a heading among
// them, and one indented, in a block quote or in a list item — one numbered
// out of order, a lane missing, written in backticks or another case, with
// its colon outside the bold, or after a line of its own, and a lane under
// a heading markdown does not read as one.
//
// Layer: unit. World: none — reports as values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { reportFindings, readReport, findingText } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/spec-report.cjs'));

/** A report: its title, summary, and the Findings section's lines. @param {string[]} findings */
const report = (findings) => ['# Spec Review — spec-review-001', '', '## Summary', '', 'Read it all.', '', '## Findings', '', ...findings].join('\n');

/** A finding's lines: its heading, its lane line, its text. @param {string} id @param {string} lane */
const finding = (id, lane) => [`### ${id}: a label`, '', lane, '', 'What the product meets.', ''];

describe('a spec review\'s report read (11.7.1)', () => {
  it('reads its findings, each with its lane, in order — none where it reads None identified.', () => {
    const three = report([...finding('F1', '**Lane:** gap'), ...finding('F2', '**Lane:** fact'), ...finding('F3', '**Lane:** rewrite')]);

    assert.deepStrictEqual(reportFindings(three), [{ id: 'F1', lane: 'gap', label: 'a label' }, { id: 'F2', lane: 'fact', label: 'a label' }, { id: 'F3', lane: 'rewrite', label: 'a label' }]);
    assert.deepStrictEqual(reportFindings(report(['None identified.'])), []);
    assert.deepStrictEqual(reportFindings(report(['### F1', '**Lane:** gap'])), [{ id: 'F1', lane: 'gap', label: '' }]);
  });

  it('a finding\'s text is what follows its lane, its paragraphs kept, up to the next finding — a heading in a fenced block among it — and none for a finding the report lacks', () => {
    const two = report([
      '### F1: is a refund split?', '', '**Lane:** gap', '', 'No entry decides it.', '', 'The spec reads:', '', '```', '### the heading', '```', '',
      '### F2: a charge is slower', '', '**Lane:** fact', '', 'The bench gives 450 ms.',
    ]);

    assert.deepStrictEqual([findingText(two, 'F1'), findingText(two, 'F2'), findingText(two, 'F3')], [
      'No entry decides it.\n\nThe spec reads:\n\n```\n### the heading\n```', 'The bench gives 450 ms.', '',
    ]);
  });

  it('a line inside a fenced block is text — a #, ## or ### line, a lane, a shorter run of its marker, a run of the other or one in a block quote, the Findings heading quoted before the section — and a block quote or list item holds a fence closed within it', () => {
    const quoted = [
      '# Spec Review — spec-review-001', '', '## Summary', '', 'The template asks for:', '', '~~~', '## Findings', '', '```', '**Lane:** gap', '~~~', '', '## Findings', '',
      '### F1: the tables are miscounted', '', '**Lane:** fact', '', 'Re-run:', '', '```sh', '# count the tables', 'ls tables | wc -l', '> ```', '## the count', '```', '',
      'The spec reads:', '', '````markdown', '## 2. Refunds', '', '### 2.1 Where', '', '```', '````', '',
      '> ```sh', '> # the count', '>', '> ```', '', '- ```sh', '  # the count', '', '  ```', '', '> - ```sh', '>   # the count', '>   ```', '',
      '### F2: is a refund split?', '', '**Lane:** gap', '', 'No entry decides it.',
    ].join('\n');

    assert.deepStrictEqual(reportFindings(quoted).map(({ id, lane }) => ({ id, lane })), [{ id: 'F1', lane: 'fact' }, { id: 'F2', lane: 'gap' }]);
  });

  it('a backtick run with a backtick in the text after it opens no fence, as in markdown — inline code on a line of its own, or opening one', () => {
    const inline = report([
      '### F1: the tests are not run', '', '**Lane:** fact', '', '```npm test```', '', '```ls``` is run', '',
      '### F2: a refund is split', '', '**Lane:** gap', '', '```bash', 'npm test', '```',
    ]);

    assert.deepStrictEqual(reportFindings(inline).map(({ id, lane }) => ({ id, lane })), [{ id: 'F1', lane: 'fact' }, { id: 'F2', lane: 'gap' }]);
  });

  it('refuses a report outside the grammar, naming what does not read and where', () => {
    const lane = (/** @type {string} */ id) => `${id}'s next line is its lane, \`**Lane:** rewrite\`, \`gap\` or \`fact\`, the bare word`;
    const heading = (/** @type {number} */ number, /** @type {string} */ line) => `line ${number}, \`${line}\`: the \`## Findings\` section runs to the report's end, and a heading in it opens a finding, \`### F{n}: {label}\` — a heading its text quotes sits in a fenced block`;
    const hidden = (/** @type {number} */ number, /** @type {string} */ line, /** @type {number} */ opened) => `line ${number}, \`${line}\`: a finding's heading inside the fenced block line ${opened} opens — a fenced block never holds one`;
    const ended = (/** @type {number} */ number, /** @type {number} */ opened) => `line ${number} ends the block quote or list item line ${opened} opens a fenced block in, the block never closed`;
    const stray = (/** @type {number} */ number) => `line ${number}, \`**Lane:** gap\`: a lane is the line after its finding's heading, \`### F{n}: {label}\`, and no other`;
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
      [report([...finding('F1', '**Lane:** gap'), '```sh', '# count the tables']), 'line 15 opens a fenced block that is never closed'],
      [report([...finding('F1', '**Lane:** gap'), '```sh', '# count the tables', '```text', '', ...finding('F2', '**Lane:** gap')]), hidden(19, '### F2: a label', 15)],
      [report([...finding('F1', '**Lane:** gap'), '````', '```', '', ...finding('F2', '**Lane:** gap')]), hidden(18, '### F2: a label', 15)],
      [report([...finding('F1', '**Lane:** gap'), '```sh', 'ls', '', ...finding('F2', '**Lane:** gap'), '```']), hidden(18, '### F2: a label', 15)],
      [report([...finding('F1', '**Lane:** gap'), '```markdown', '### F2: quoted from the last pass', '```']), hidden(16, '### F2: quoted from the last pass', 15)],
      [report([...finding('F1', '**Lane:** gap'), '```', '> ### F2: a label', '```']), hidden(16, '> ### F2: a label', 15)],
      [['# Spec Review', '', '~~~', '### F1: a label', '~~~', '', '## Findings', '', 'None identified.'].join('\n'), hidden(4, '### F1: a label', 3)],
      [report([...finding('F1', '**Lane:** fact'), '> ```sh', '> npm test', '', ...finding('F2', '**Lane:** gap'), '```sh', 'ls', '```']), ended(17, 15)],
      [report([...finding('F1', '**Lane:** fact'), '1. ```sh', '   npm test', '### F2: a label', '**Lane:** gap']), ended(17, 15)],
      [report([...finding('F1', '**Lane:** fact'), '  - ```sh', '   npm test', '    ```']), ended(16, 15)],
      [report([...finding('F1', '**Lane:** gap'), '**F2: a label**', '', '**Lane:** gap']), stray(17)],
      [report([...finding('F1', '**Lane:** gap'), '###F2: a label', '', '**Lane:** gap']), stray(17)],
      [['# Spec Review', '', '### F1: a label', '', '**Lane:** gap', '', '## Findings', '', 'None identified.'].join('\n'), 'line 3, `### F1: a label`: a finding stands in the `## Findings` section'],
      [report([...finding('F1', '**Lane:** gap'), ...finding('F3', '**Lane:** fact')]), 'line 15: F3 where F2 comes next — findings are numbered F1, F2, … in order'],
      [report(['These need a look.', '', ...finding('F1', '**Lane:** gap')]), 'line 9: the `## Findings` section holds findings, each opening `### F{n}: {label}`, or reads `None identified.` alone'],
      [report(['None identified.', '', ...finding('F1', '**Lane:** gap')]), 'line 9: the `## Findings` section holds findings, each opening `### F{n}: {label}`, or reads `None identified.` alone'],
    ];

    assert.deepStrictEqual(faults.map(([text]) => readReport(text)), faults.map(([, fault]) => ({ fault })));
    assert.deepStrictEqual(readReport(report(['None identified.'])), { findings: [] });
  });
});
