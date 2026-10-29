'use strict';

// ---------------------------------------------------------------------------
// The spec's sections (workflow-engine/scripts/domain/spec-sections.cjs):
// how a section is cited — `§N` or `§N.M`, in the order cited, each once —
// and where it runs in a spec's text — an area, `## N. Title`, to the next
// heading at level two or above, holding its parts; a part, `### N.M Title`,
// to the next at level three or above; a heading in a fenced block being
// text — the spec refused where a section is numbered twice or a part sits
// under another area; and the sections a reference cites drawn from a text,
// a part cited beside its area left to the area, every section the spec
// lacks named.
//
// Layer: unit. World: none — spec texts as values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { citedSections, specSections, sectionsCited } = require(path.join(__dirname, '../../skills/workflow-engine/scripts/domain/spec-sections.cjs'));

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
]);

/** Each section's text, by address. @param {string} spec */
const sectionTexts = (spec) => Object.fromEntries([...specSections(spec)].map(([address, { text: held }]) => [address, held]));

describe('a cite', () => {
  it('cites each section once, in the order cited, whatever words surround it', () => {
    assert.deepStrictEqual(citedSections('§2 (refunds), then §1.1 and §2 again; see §1.'), ['2', '1.1', '1']);
  });

  it('a reference citing none, and a cite deeper than a part, are refused', () => {
    assert.throws(() => citedSections('the card form'), /^Error: the spec reference "the card form" cites no section — a section is cited §N or §N\.M$/);
    assert.throws(() => citedSections('§1.1.2'), /^Error: §1\.1\.2 is no section — a section is cited §N or §N\.M$/);
  });
});

describe('a spec\'s sections', () => {
  it('an area runs to the next heading at its level or above, holding its parts; a part to the next at its own; a deeper heading and a fenced block stay inside', () => {
    assert.deepStrictEqual(sectionTexts(SPEC), {
      1: text(['## 1. Cards', 'A card is taken once.', '', '### 1.1 The form', 'The number.', '#### Its fields', 'Number and expiry.', '',
        '~~~~', '### 1.9 Not a part', '~~~', '## 3. Still not an area', '~~~~', '', '### 1.2 The receipt', 'A receipt.']),
      1.1: text(['### 1.1 The form', 'The number.', '#### Its fields', 'Number and expiry.', '', '~~~~', '### 1.9 Not a part', '~~~', '## 3. Still not an area', '~~~~']),
      1.2: text(['### 1.2 The receipt', 'A receipt.']),
      2: text(['## 2. Refunds', 'A refund names its charge.']),
    });
  });

  it('a section numbered twice, and a part under another area or none, are refused', () => {
    assert.throws(() => specSections(text(['## 1. Cards', '## 1. Again'])), /^Error: the spec numbers §1 twice$/);
    assert.throws(() => specSections(text(['## 1. Cards', '### 2.1 Refunds'])), /^Error: §2\.1 sits under §1$/);
    assert.throws(() => specSections(text(['## Open questions', '### 1.1 The form'])), /^Error: §1\.1 sits under no area$/);
  });
});

describe('the sections a reference cites', () => {
  it('drawn verbatim in the order cited, a part cited beside its own area left to the area', () => {
    const drawn = sectionsCited(SPEC, '§2, §1.2, §1').map((section) => section.address);

    assert.deepStrictEqual(drawn, ['2', '1']);
  });

  it('refused naming every section the spec lacks', () => {
    assert.throws(() => sectionsCited(SPEC, '§1, §4, §1.7'), /^Error: the spec has no §4, §1\.7$/);
  });
});
