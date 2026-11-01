'use strict';

// ---------------------------------------------------------------------------
// The review page's model (leeway-engine/scripts/domain/spec-page-model.cjs):
// a spec as the person's review page draws it — every statement, scenario
// and screen a line, its id its number dashed, its fingerprint the first 12
// hex digits of the SHA-256 of its wording, the source bracket left out, its
// blocks, its bracket and its flags; the lines grouped by area with the
// headings of its parts and its scenarios; the title and the introduction
// but its contents. The values are those the page's own scripts compute
// (`spec_model.py`), so a mark the page left hangs on the same line here
// (11.11.3, 11.11.6, 11.11.12). Claude's ticks, drawn from the ledger, are
// test-engine-spec-review-record.cjs's.
//
// Layer: unit. No world: the model is read from a spec's text.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { specReading } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { pageOf, lineId, fingerprint } = require(path.join(SCRIPTS, 'domain/spec-page-model.cjs'));

const SPEC = [
  '# Payments', '', 'What the spec covers.', '', '## Contents', '', '- §1 Cards', '',
  '## 1. Cards', '', '### 1.1 The form', '',
  '1.1.1 The number is checked   as it is typed,', 'as it is entered. [Ab12Cd, Ef34Gh]', '',
  '1.1.2 The form shows:', '', '- the number;', '- the expiry.', '', '```text', 'Card number  ____', '```', '',
  'Its fields keep their order. [builder: Gh56Ij]', '',
  'Screen: the form, filled. [builder]', '', '```text', 'Card number  4242', '```', '',
  '### 1.2 The receipt', '', '1.2.1 A receipt names its charge. [builder]', '',
  '## 1-S. Scenarios for §1', '', '1.S1 Given a form, when the number is typed, then it is checked. (1.1.1, 1.1.2)', '',
  '## 2. Refunds', '', '### 2.1 Whole', '', '2.1.1 A refund goes back to the card. [Ab12Cd]', '',
].join('\n');

/** The page a spec's text draws, its lines flagged as `drawn` gives. @param {string} text @param {{calls: Set<string>, builders: Set<string>}} [drawn] */
const page = (text, drawn) => pageOf(text, specReading(text), drawn);

/** A spec of one statement, written as given. @param {string[]} rows */
const oneLine = (rows) => ['# P', '', '## 1. A', '', '### 1.1 B', '', ...rows, ''].join('\n');

/** The fingerprint of a spec of one statement. @param {string[]} rows */
const hOf = (rows) => page(oneLine(rows)).lines[0].h;

describe('the review page\'s model of a spec (11.11.2, 11.11.3)', () => {
  it('draws every statement, scenario and screen as a line — its id, number, kind, blocks, bracket and fingerprint as the page\'s own scripts compute them — grouped by area with its parts\' and its scenarios\' headings, and the title and introduction but the contents', () => {
    const { h1, intro, sections } = page(SPEC);

    assert.deepStrictEqual({ h1, intro, sections }, {
      h1: 'Payments',
      intro: '\n\nWhat the spec covers.\n\n',
      sections: [
        {
          num: 1, title: 'Cards', items: [
            { k: 'h3', t: '1.1 The form' },
            {
              k: 'line', id: '1-1-1', num: '1.1.1', kind: 'statement', parts: [['text', 'The number is checked   as it is typed,\nas it is entered.']], src: 'Ab12Cd, Ef34Gh', flags: [], h: '3410449dea7e',
            },
            {
              k: 'line', id: '1-1-2', num: '1.1.2', kind: 'statement',
              parts: [['text', 'The form shows:'], ['text', '- the number;\n- the expiry.'], ['fence', '```text\nCard number  ____\n```'], ['text', 'Its fields keep their order.']],
              src: 'builder: Gh56Ij', flags: ['builder', 'screen'], h: '2e0d9b63f690',
            },
            {
              k: 'line', id: '1-1-2-scr1', num: 'screen', kind: 'screen', after: '1.1.2', parts: [['text', 'Screen: the form, filled.'], ['fence', '```text\nCard number  4242\n```']], src: 'builder', flags: ['builder', 'screen'], h: 'd5f3ad4a699b',
            },
            { k: 'h3', t: '1.2 The receipt' },
            {
              k: 'line', id: '1-2-1', num: '1.2.1', kind: 'statement', parts: [['text', 'A receipt names its charge.']], src: 'builder', flags: ['builder'], h: 'fcdaee6839bc',
            },
            { k: 'h2s', t: 'Scenarios for §1' },
            {
              k: 'line', id: '1-S1', num: '1.S1', kind: 'scenario', parts: [['text', 'Given a form, when the number is typed, then it is checked. (1.1.1, 1.1.2)']], src: '', flags: [], h: 'ba9d701705dd',
            },
          ],
        },
        {
          num: 2, title: 'Refunds', items: [
            { k: 'h3', t: '2.1 Whole' },
            {
              k: 'line', id: '2-1-1', num: '2.1.1', kind: 'statement', parts: [['text', 'A refund goes back to the card.']], src: 'Ab12Cd', flags: [], h: '5e1e94d45e79',
            },
          ],
        },
      ],
    });
  });

  it('keeps each line beside its id, its area and its fingerprint, in the spec\'s order', () => {
    assert.deepStrictEqual(page(SPEC).lines.map(({ id, section, h, line }) => [id, section, h, line.number]), [
      ['1-1-1', 1, '3410449dea7e', '1.1.1'], ['1-1-2', 1, '2e0d9b63f690', '1.1.2'], ['1-1-2-scr1', 1, 'd5f3ad4a699b', '1.1.2-scr1'],
      ['1-2-1', 1, 'fcdaee6839bc', '1.2.1'], ['1-S1', 1, 'ba9d701705dd', '1.S1'], ['2-1-1', 2, '5e1e94d45e79', '2.1.1'],
    ]);
    assert.deepStrictEqual([lineId('16.3.7'), lineId('16.S69'), lineId('3.2.1-scr2')], ['16-3-7', '16-S69', '3-2-1-scr2']);
  });

  it('flags a line as the ledger draws it — resting on a call of Claude\'s first, then left to the builder — before a screen', () => {
    const drawn = { calls: new Set(['1.1.1', '1.1.2']), builders: new Set(['2.1.1']) };
    const items = page(SPEC, drawn).sections.flatMap(({ items: area }) => area).flatMap((item) => (item.k === 'line' ? [[item.id, item.flags]] : []));

    assert.deepStrictEqual([items[0], items[1], items.at(-1)], [['1-1-1', ['claude']], ['1-1-2', ['claude', 'builder', 'screen']], ['2-1-1', ['builder']]]);
  });

  it('a line\'s fingerprint holds its wording: a change to its sources alone or to how it wraps keeps it, a change of wording does not (11.11.6, 11.S28)', () => {
    const was = hOf(['1.1.1 The form shows the card. [Ab12Cd]']);

    assert.strictEqual(was, fingerprint('The form shows the card.'));
    assert.strictEqual(hOf(['1.1.1 The form shows the card. [Ef34Gh, Ij56Kl]']), was);
    assert.strictEqual(hOf(['1.1.1 The form shows', 'the   card. [builder]']), was);
    assert.notStrictEqual(hOf(['1.1.1 The form shows the cards. [Ab12Cd]']), was);
  });
});
