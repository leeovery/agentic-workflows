'use strict';

// ---------------------------------------------------------------------------
// A review round's report read (leeway-engine/scripts/domain/review-report.cjs):
// an area pair's or the test reader's, its verdict and findings by the
// reviewers' grammar (round-report.cjs) and its notes for later counted —
// each an item under a notes heading of level two or three, or a line
// holding its label alone, bold or plain — `Notes for later` or `Note for
// later`, in any case, emphasised, a parenthesis after it, a colon after it
// or none — anywhere, after the findings too, never in a fenced block; a
// lead-in above the first allowed, as is a sole `None`; the section running
// to the next heading at its level or above, or the next notes section, and
// ending the finding above it. Anything else under it refuses the report,
// naming its line, as does a line opening on the label that is no heading
// of the notes, so its reader is briefed again (14.3.1, 14.3.5).
//
// Layer: unit. World: none — a report is its text.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readReviewReport } = require('../../skills/leeway-engine/scripts/domain/review-report.cjs');

/** A report's text, `notes` before its findings and `after` past them. @param {string} notes @param {string} [after] */
const report = (notes, after = '') => `Read whole.\n\n${notes}## Findings\n\n- nit: a stray comment.\n  Scenario: a reader meets it.\n\n${after}Verdict: pass\n`;

/** The one finding `report` writes. */
const FINDING = { call: 'nit', text: 'a stray comment.\nScenario: a reader meets it.', scenario: 'a reader meets it.' };

describe('a review round\'s report: its notes for later counted, its findings read by the reviewers\' grammar (14.3.1)', () => {
  it('counts each item under a notes heading — level two or three, numbered or not, any case, emphasised, a colon after it — a line beneath an item its own, a lead-in above them allowed', () => {
    assert.deepStrictEqual(readReviewReport(report('## Notes for later\n\nTwo things beyond the change:\n\n- the export skips refunds,\n  at src/export.js\n* nit: the README is stale, at README.md\n\n')), {
      verdict: 'pass', findings: [FINDING], notes: 2,
    });
    for (const heading of [
      '## Notes For Later', '## Notes for later:', '### Notes for later', '## **Notes for later**', '## **Notes for later:**', '**Notes for later**', '__Notes for later:__',
      '## Note for later', '## Notes for later (beyond the change)', '**Notes for later (none urgent):**', 'Notes for later:', '## 2. Notes for later', '### 3) Notes for later',
    ]) {
      assert.strictEqual(readReviewReport(report(`${heading}\n\n- the export skips refunds\n\n## Asides\n\nA stray thought.\n\n`)).notes, 1, heading);
    }
  });

  it('counts none where its section says `None`, it has no section, or the heading is another', () => {
    for (const notes of ['## Notes for later\n\nNone.\n\n', '', '## Asides\n\n- a stray thought\n\n']) assert.strictEqual(readReviewReport(report(notes)).notes, 0, notes);
  });

  it('a notes section after the findings is read, and ends the finding above it', () => {
    for (const heading of ['### Notes for later', '## Notes for later', '**Notes for later**']) {
      assert.deepStrictEqual(readReviewReport(report('', `${heading}\n\n- the export skips refunds\n\n`)), { verdict: 'pass', findings: [FINDING], notes: 1 }, heading);
    }
  });

  it('a `###` notes section ends at the next `###` heading, what follows it no note', () => {
    const text = 'Read whole.\n\n### Notes for later\n\n- the export skips refunds\n\n### Context\n\n- read against the spec\n\n## Findings\n\nNone.\n\nVerdict: pass\n';

    assert.deepStrictEqual(readReviewReport(text), { verdict: 'pass', findings: [], notes: 1 });
  });

  it('a `##` notes section and a `###` one after it are two sections, each note counted once', () => {
    assert.strictEqual(readReviewReport(report('## Notes for later\n\n- the export skips refunds\n\n### Notes for later\n\n- the README is stale\n\n')).notes, 2);
  });

  it('a label inside a fenced block is no heading, and nothing it holds is a note', () => {
    assert.deepStrictEqual(readReviewReport(report('Read as written:\n\n```md\n**Notes for later**\n\n- the export skips refunds\n```\n\n')), { verdict: 'pass', findings: [FINDING], notes: 0 });
  });

  it('anything under a notes heading but its items or `None` refuses the report, naming the line — `None` then prose naming the prose — so its reader is briefed again', () => {
    assert.throws(() => readReviewReport(report('## Notes for later\n\nThe export skips refunds, at src/export.js.\n\n')),
      /^Error: "The export skips refunds, at src\/export\.js\." under ## Notes for later is no note — each note is an item, `- …`, or all the section holds is `None\.`$/);
    assert.throws(() => readReviewReport(report('## Notes for later\n\nNone.\n\nThe export skips refunds, at src/export.js.\n\n')),
      /^Error: "The export skips refunds, at src\/export\.js\." under ## Notes for later is no note/);
  });

  it('a line naming the notes for later that is no heading of them — the label with its note on the line, a heading at another level, reworded, italic or quoted — refuses the report, naming it', () => {
    for (const line of [
      '**Notes for later:** the export skips refunds, at src/export.js', 'Notes for later: the export skips refunds', '#### Notes for later', '- Notes for later: the export skips refunds',
      '## Notes (for later)', '## Notes, for later', '*Notes for later*', '> **Notes for later**', '2. Notes for later',
    ]) {
      assert.throws(() => readReviewReport(report(`${line}\n\n`)), (err) => err instanceof Error && err.message.startsWith(`"${line}" names the notes for later but is no heading of them`), line);
    }
  });
});
