'use strict';

// ---------------------------------------------------------------------------
// The spec's sections (workflow-engine/scripts/domain/spec-sections.cjs):
// how a reference cites sections — runs opened by `§` or `§§`, their numbers
// joined by `,`, `and` or `&`, a range by `–`, `-` or `to`, each cite once in
// the order cited, every number a run holds counted — and where a section
// runs in a spec's text — an area, `## N. Title`, to the next heading at
// level two or above, holding its parts; a part, `### N.M Title`, to the
// next at level three or above; a heading in a fenced block being text —
// the spec refused where a section is numbered twice or a part sits under
// another area or none; and the sections a reference cites drawn from a
// text, a range's at its level in the spec's order, a part whose area is
// drawn left to the area, each refusal naming the reference; and the
// scenarios a spec gives, each a line opening `N.Sk ` outside a fenced block,
// the spec refused where it gives one twice.
//
// Layer: unit. World: none — spec texts as values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { citedSections, specSections, specScenarios, sectionsCited } = require(path.join(__dirname, '../../skills/workflow-engine/scripts/domain/spec-sections.cjs'));

/** @param {string[]} lines */
const text = (lines) => lines.join('\n');

const SPEC = text([
  '# Payments', '',
  '## 1. Cards', 'A card is taken once.', '',
  '### 1.1 The form', 'The number.', '#### Its fields', 'Number and expiry.', '',
  '~~~~', '### 1.9 Not a part', '~~~', '## 3. Still not an area', '~~~~', '',
  '### 1.2 The receipt', 'A receipt.', '',
  '## Open questions', 'None yet.', '',
  '## 2. Refunds', 'A refund names its charge.', '',
  '### 2.1 Partial', 'Part of a charge.', '',
  '### 2.2 Whole', 'All of a charge.', '',
  '## 3. Disputes', 'A dispute holds a charge.', '',
  '# Appendix', 'Glossary.', '',
]);

/** Each section's text, by address. @param {string} spec */
const sectionTexts = (spec) => Object.fromEntries([...specSections(spec)].map(([address, { text: held }]) => [address, held]));

/** The addresses a reference draws from the spec. @param {string} reference */
const drawn = (reference) => sectionsCited(SPEC, reference).map((section) => section.address);

/** A single section's cite. @param {string} address */
const one = (address) => ({ from: address, to: address });

describe('a cite', () => {
  it('cites each section once, in the order cited, whatever words surround it', () => {
    assert.deepStrictEqual(citedSections('§2 (refunds), then §1.1 and §2 again; see §1.'), [one('2'), one('1.1'), one('1')]);
  });

  it('a run goes on over numbers joined by a comma, and or &, after § or §§', () => {
    assert.deepStrictEqual(citedSections('§1.1, 1.2'), [one('1.1'), one('1.2')]);
    assert.deepStrictEqual(citedSections('§1.1 and 2.1'), [one('1.1'), one('2.1')]);
    assert.deepStrictEqual(citedSections('§§1.1 & 1.2, and 3'), [one('1.1'), one('1.2'), one('3')]);
  });

  it('two numbers joined by –, - or to are a range', () => {
    assert.deepStrictEqual(citedSections('§1.1–1.2'), [{ from: '1.1', to: '1.2' }]);
    assert.deepStrictEqual(citedSections('§§11.3-11.5'), [{ from: '11.3', to: '11.5' }]);
    assert.deepStrictEqual(citedSections('§1 to 3, §2.1'), [{ from: '1', to: '3' }, one('2.1')]);
  });

  it('a reference citing none, a number deeper than a part, and a range whose ends differ in level are refused, naming the reference', () => {
    assert.throws(() => citedSections('the card form'), /^Error: the spec reference "the card form" cites no section — a section is cited §N or §N\.M$/);
    assert.throws(() => citedSections('§1, 1.1.2'), /^Error: the spec reference "§1, 1\.1\.2" cites §1\.1\.2, which is no section — a section is cited §N or §N\.M$/);
    assert.throws(() => citedSections('§1.1–2'), /^Error: the spec reference "§1\.1–2" cites §1\.1–2, a range whose ends differ in level$/);
  });
});

describe('a spec\'s sections', () => {
  it('an area runs to the next heading at its level or above, holding its parts; a part to the next at its own; a deeper heading and a fenced block stay inside', () => {
    assert.deepStrictEqual(sectionTexts(SPEC), {
      1: text(['## 1. Cards', 'A card is taken once.', '', '### 1.1 The form', 'The number.', '#### Its fields', 'Number and expiry.', '',
        '~~~~', '### 1.9 Not a part', '~~~', '## 3. Still not an area', '~~~~', '', '### 1.2 The receipt', 'A receipt.']),
      1.1: text(['### 1.1 The form', 'The number.', '#### Its fields', 'Number and expiry.', '', '~~~~', '### 1.9 Not a part', '~~~', '## 3. Still not an area', '~~~~']),
      1.2: text(['### 1.2 The receipt', 'A receipt.']),
      2: text(['## 2. Refunds', 'A refund names its charge.', '', '### 2.1 Partial', 'Part of a charge.', '', '### 2.2 Whole', 'All of a charge.']),
      2.1: text(['### 2.1 Partial', 'Part of a charge.']),
      2.2: text(['### 2.2 Whole', 'All of a charge.']),
      3: text(['## 3. Disputes', 'A dispute holds a charge.']),
    });
  });

  it('a section numbered twice, and a part under another area or none, are refused', () => {
    assert.throws(() => specSections(text(['## 1. Cards', '## 1. Again'])), /^Error: the spec numbers §1 twice$/);
    assert.throws(() => specSections(text(['## 1. Cards', '### 2.1 Refunds'])), /^Error: §2\.1 sits under §1$/);
    assert.throws(() => specSections(text(['## Open questions', '### 1.1 The form'])), /^Error: §1\.1 sits under no area$/);
    assert.throws(() => specSections(text(['## 1. A', '## Notes', '### 1.3 X'])), /^Error: §1\.3 sits under no area$/);
    assert.throws(() => specSections(text(['## 1. A', '# Appendix', '### 1.3 X'])), /^Error: §1\.3 sits under no area$/);
  });
});

describe('the sections a reference cites', () => {
  it('drawn in the order cited, a part cited beside its own area left to the area', () => {
    assert.deepStrictEqual(drawn('§2, §1.2, §1'), ['2', '1']);
  });

  it('a range draws every section at its level from the first to the last, in the spec\'s order, across areas', () => {
    assert.deepStrictEqual(drawn('§1.2–2.2'), ['1.2', '2.1', '2.2']);
    assert.deepStrictEqual(drawn('§2.1, §1 to 2'), ['1', '2']);
  });

  it('refused, naming the reference, for every section the spec lacks, a range\'s end among them, and a range run backwards', () => {
    assert.throws(() => drawn('§1, 4, §1.7'), /^Error: the spec reference "§1, 4, §1\.7" cites §4, §1\.7, which the spec lacks$/);
    assert.throws(() => drawn('§1.1–1.9'), /^Error: the spec reference "§1\.1–1\.9" cites §1\.9, which the spec lacks$/);
    assert.throws(() => drawn('§2.2–1.1'), /^Error: the spec reference "§2\.2–1\.1" cites §2\.2–1\.1, a range run backwards$/);
  });
});

describe('a spec\'s scenarios', () => {
  it('each line opening N.Sk outside a fenced block, in the spec\'s order, wherever it sits', () => {
    const spec = text([
      '3.S2 Given a spec, when it opens, then this is a scenario.',
      '## 1. Cards', 'Cards are covered by 1.S7 below.', '  1.S8 indented is text.', '1.S9 Given a card, when it is taken, then it is checked.',
      '```', '1.S3 Given a fence, then this is text.', '```',
      '~~~~', '1.S4 Given a fence of tildes, then this is text.', '~~~', '1.S5 Still inside, the fence closed by its own length or longer.', '~~~~',
      '### 1.1 The form', '1.S1 Given a form, when it is sent, then a receipt shows.',
      '1.S6', '1.Sx Given no number, then this is text.',
    ]);
    assert.deepStrictEqual(specScenarios(spec), ['3.S2', '1.S9', '1.S1']);
  });

  it('a scenario given twice is refused, naming both its lines; one in a fenced block is no second', () => {
    assert.throws(() => specScenarios(text(['3.S1 Given one.', '## 3. Refunds', '3.S1 Given another.'])), /^Error: the spec gives scenario 3\.S1 twice, on lines 1 and 3$/);
    assert.deepStrictEqual(specScenarios(text(['3.S1 Given one.', '```md', '3.S1 Given an example.', '```'])), ['3.S1']);
  });
});
