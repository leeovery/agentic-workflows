'use strict';

// ---------------------------------------------------------------------------
// The spec's sections and lines (leeway-engine/scripts/domain/spec-sections.cjs):
// how a reference cites sections — runs opened by `§` or `§§`, their numbers
// joined by `,`, `and` or `&`, a range by `–`, `-` or `to`, each cite once in
// the order cited, every number a run holds counted — and where a section
// runs in a spec's text — an area, `## N. Title`, to the next heading at
// level two or above, holding its parts; a part, `### N.M Title`, to the
// next at level three or above; a heading in a fenced block, opened and
// closed by a line opening ```, being text — the spec refused where a
// section is numbered twice or a part sits under another area or none; an
// area's block of scenarios; the sections a reference cites drawn from a
// text, a range's at its level in the spec's order, a part whose area is
// drawn left to the area, each refusal naming the reference; and a spec's
// lines (11.4.5, 11.11.3, P2) as its review page reads them — blocks split
// on blank lines, a fenced block whole; a block opening `N.M.K ` or `N.Sk `
// starting a statement or a scenario, a `Screen…:` caption after one a
// screen of it, `<line>-scr<k>`, each owning the blocks after it to the next
// line, screen or heading; a statement's or a screen's bracket the trailing
// `[...]` of its last block not fenced, citing entries or the builder's; a
// scenario's last block not fenced closing on the statements it draws on;
// the introduction unread; `\r\n` and `\r` read as newlines — the spec
// refused, naming every fault at once, one per line; and its scenarios read
// through its lines. That the reading is the page's own,
// line for line, was proven over a whole release spec against the page's
// model; the cases here pin each rule.
//
// Layer: unit. World: none — spec texts as values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const {
  citedSections, specSections, scenarioBlocks, specReading, specStatements, specScenarios, sectionsCited,
} = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/spec-sections.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/spec-sections.cjs').Line} Line */

/** @param {string[]} lines */
const text = (lines) => lines.join('\n');

const SPEC = text([
  '# Payments', '',
  '## 1. Cards', 'A card is taken once.', '',
  '### 1.1 The form', 'The number.', '#### Its fields', 'Number and expiry.', '',
  '```', '### 1.9 Not a part', '## 3. Still not an area', '```', '',
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
        '```', '### 1.9 Not a part', '## 3. Still not an area', '```', '', '### 1.2 The receipt', 'A receipt.']),
      1.1: text(['### 1.1 The form', 'The number.', '#### Its fields', 'Number and expiry.', '', '```', '### 1.9 Not a part', '## 3. Still not an area', '```']),
      1.2: text(['### 1.2 The receipt', 'A receipt.']),
      2: text(['## 2. Refunds', 'A refund names its charge.', '', '### 2.1 Partial', 'Part of a charge.', '', '### 2.2 Whole', 'All of a charge.']),
      2.1: text(['### 2.1 Partial', 'Part of a charge.']),
      2.2: text(['### 2.2 Whole', 'All of a charge.']),
      3: text(['## 3. Disputes', 'A dispute holds a charge.']),
    });
  });

  it('a section numbered twice, and a part under another area or none, are refused — a run of tildes being no fence in a spec, as its page reads one', () => {
    assert.throws(() => specSections(text(['## 1. Cards', '## 1. Again'])), /^Error: the spec numbers §1 twice$/);
    assert.throws(() => specSections(text(['## 1. Cards', '~~~', '## 1. Again', '~~~'])), /^Error: the spec numbers §1 twice$/);
    assert.throws(() => specSections(text(['## 1. Cards', '### 2.1 Refunds'])), /^Error: §2\.1 sits under §1$/);
    assert.throws(() => specSections(text(['## Open questions', '### 1.1 The form'])), /^Error: §1\.1 sits under no area$/);
    assert.throws(() => specSections(text(['## 1. A', '## Notes', '### 1.3 X'])), /^Error: §1\.3 sits under no area$/);
    assert.throws(() => specSections(text(['## 1. A', '# Appendix', '### 1.3 X'])), /^Error: §1\.3 sits under no area$/);
  });

  it('an area\'s block of scenarios runs from its heading, ## N-S., to the next heading at level two or above', () => {
    const spec = text(['## 1. Cards', '', '## 1-S. Scenarios for §1', '', '1.S1 Given one.', '```', '## 2. Not an area', '```', '', '## 2. Refunds', '', '## 2-S. Scenarios for §2', '2.S1 Given two.', '', '# Appendix']);

    assert.deepStrictEqual(Object.fromEntries(scenarioBlocks(spec)), {
      1: text(['## 1-S. Scenarios for §1', '', '1.S1 Given one.', '```', '## 2. Not an area', '```']),
      2: text(['## 2-S. Scenarios for §2', '2.S1 Given two.']),
    });
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

/** A line as read but its blocks, its fields as given and the rest a statement's with no source. @param {Partial<Line>} line @returns {Omit<Line, 'parts'>} */
const lineOf = (line) => ({
  kind: 'statement', number: '', line: 0, wording: '', bracket: null, cites: [], builder: false, of: null, drawsOn: [], ...line,
});

/** The lines of a kind a spec gives, but their blocks. @param {string} spec @param {Line['kind']} kind */
const linesOf = (spec, kind) => specStatements(spec).filter((line) => line.kind === kind).map(({ parts, ...line }) => line);

describe('a spec\'s lines, read as its page reads them (11.4.5, 11.11.3)', () => {
  const LINES = text([
    '# Payments', '',
    'What the spec covers; 1.1.1 is prose here.', '',
    '## Contents', '', '- §1 Cards', '',
    '## 1. Cards', '',
    '### 1.1 The form', '',
    '1.1.1 The number is checked as it is typed, as', '1.2.1 and 7.2.13 allow. [Ab12Cd, Ef34Gh]', '',
    '1.1.2 Expiry reads [MM/YY] as `month[0]`. [ Ab12Cd ,Ef34 ]', '',
    '1.1.3 The form shows:', '', '- the number;', '- the expiry.', '', '```text', '1.1.9 Card number', '```', '',
    'Its fields keep their order. [builder: Gh56Ij]', '',
    'Screen, drawn by Claude: the form, empty. [builder]', '', '```text', 'Card number  ____', '```', '',
    '1.1.4 The card\'s brand shows. [Ab12Cd].', '',
    '`1.1.5 inline` opens no line, so this block is 1.1.4\'s.', '',
    '### 1.2 The receipt', '',
    '1.2.1 A receipt names its charge.', '', '```text', 'Charge 42', '```', '',
    '## 1-S. Scenarios for §1', '',
    '1.S1 Given a form, when the number is typed,', 'then it is checked. (1.1.1, 1.1.2)', '',
    '1.S2 Given a receipt, then it names the charge (once). (1.2.1)', '',
  ]);

  it('a block opening N.M.K starts a statement, owning every block after it — paragraphs, lists, fenced blocks — to the next line, screen or heading; its bracket the trailing [...] of its last block not fenced, citing entries, the builder\'s with its cite or alone, or nothing where it has none; its wording each block on one line; the introduction unread', () => {
    assert.deepStrictEqual(linesOf(LINES, 'statement'), [
      lineOf({ number: '1.1.1', line: 13, wording: 'The number is checked as it is typed, as 1.2.1 and 7.2.13 allow.', bracket: 'Ab12Cd, Ef34Gh', cites: ['Ab12Cd', 'Ef34Gh'] }),
      lineOf({ number: '1.1.2', line: 16, wording: 'Expiry reads [MM/YY] as `month[0]`.', bracket: ' Ab12Cd ,Ef34 ', cites: ['Ab12Cd', 'Ef34'] }),
      lineOf({
        number: '1.1.3', line: 18, wording: 'The form shows:\n- the number; - the expiry.\n```text\n1.1.9 Card number\n```\nIts fields keep their order.', bracket: 'builder: Gh56Ij', cites: ['Gh56Ij'], builder: true,
      }),
      lineOf({ number: '1.1.4', line: 35, wording: 'The card\'s brand shows. [Ab12Cd].\n`1.1.5 inline` opens no line, so this block is 1.1.4\'s.' }),
      lineOf({ number: '1.2.1', line: 41, wording: 'A receipt names its charge.\n```text\nCharge 42\n```' }),
    ]);
  });

  it('a block opening N.Sk starts a scenario, closing on the statements it draws on in parentheses, its wording keeping them', () => {
    assert.deepStrictEqual(linesOf(LINES, 'scenario'), [
      lineOf({ kind: 'scenario', number: '1.S1', line: 49, wording: 'Given a form, when the number is typed, then it is checked. (1.1.1, 1.1.2)', drawsOn: ['1.1.1', '1.1.2'] }),
      lineOf({ kind: 'scenario', number: '1.S2', line: 52, wording: 'Given a receipt, then it names the charge (once). (1.2.1)', drawsOn: ['1.2.1'] }),
    ]);
  });

  it('refuses a scenario whose last block not fenced closes on anything but its statements in parentheses', () => {
    /** @param {string[]} blocks */
    const scenario = (blocks) => specReading(text([
      '# Payments', '', '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 The form. [builder]', '', '## 1-S. Scenarios for §1', '', ...blocks,
    ])).faults;
    const closings = ['(1.1.1).', '(1.1.1-1.1.3)', '(1.1.1, 1.S2)', '(1.1.1 and 1.1.2)', 'and nothing else.'];

    assert.deepStrictEqual(closings.map((closing) => scenario([`1.S1 Given the form, then it shows ${closing}`])), closings.map(() => [
      'scenario 1.S1 on line 11 closes on no statements — a scenario ends in the statements it draws on, (N.M.K, …)',
    ]));
    assert.deepStrictEqual(scenario(['1.S1 Given the form, then it shows. (1.1.1)', '', 'A block it owns, closing on nothing.']), [
      'scenario 1.S1 on line 11 closes on no statements — a scenario ends in the statements it draws on, (N.M.K, …)',
    ]);
    assert.deepStrictEqual(scenario(['1.S1 Given the form, then it shows:', '', '```text', 'Card number', '```', '', 'as it opens. (1.1.1)', '', '```text', 'shown', '```']), []);
  });

  it('refuses a statement or a screen whose bracket closes an earlier block than its last, which carries none', () => {
    const spec = text([
      '# Payments', '', '## 1. Cards', '', '### 1.1 The form', '',
      '1.1.1 The form. [builder]', '', 'Then a block carrying none.', '',
      '1.1.2 The receipt. [builder]', '', 'Screen: the receipt. [builder]', '', '```text', 'Charge 42', '```', '', 'Then a block carrying none.', '',
    ]);

    assert.deepStrictEqual(specReading(spec).faults, [
      'statement 1.1.1 on line 7: its bracket closes an earlier block — the bracket closes the line\'s last text block',
      'screen 1.1.2-scr1 on line 13: its bracket closes an earlier block — the bracket closes the line\'s last text block',
    ]);
  });

  it('a Screen…: caption after a line starts a screen of it, <line>-scr<k>, with its own bracket and the blocks after it; a bare fenced block is its line\'s', () => {
    const spec = text([
      '# Payments', '', '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 The form. [builder]', '',
      'Screen: the form, empty. [builder: Ab12Cd]', '', '```text', 'Card number  ____', '```', '',
      'Screen: the form, filled.', '', '```text', 'Card number  4242', '```', '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given the form, then it shows. (1.1.1)', '', 'Screen: shown. [Ef34Gh]', '',
    ]);

    assert.deepStrictEqual(linesOf(spec, 'screen'), [
      lineOf({ kind: 'screen', number: '1.1.1-scr1', line: 9, of: '1.1.1', wording: 'Screen: the form, empty.\n```text\nCard number  ____\n```', bracket: 'builder: Ab12Cd', cites: ['Ab12Cd'], builder: true }),
      lineOf({ kind: 'screen', number: '1.1.1-scr2', line: 15, of: '1.1.1', wording: 'Screen: the form, filled.\n```text\nCard number  4242\n```' }),
      lineOf({ kind: 'screen', number: '1.S1-scr1', line: 25, of: '1.S1', wording: 'Screen: shown.', bracket: 'Ef34Gh', cites: ['Ef34Gh'] }),
    ]);
    assert.deepStrictEqual(linesOf(LINES, 'screen').map(({ number, line, of, bracket }) => [number, line, of, bracket]), [['1.1.3-scr1', 29, '1.1.3', 'builder']]);
  });

  it('keeps each line\'s blocks as written, its number and its bracket taken off, a block left empty by the bracket dropped; and the headings in the spec\'s order, numbered or not', () => {
    const { lines, headings } = specReading(LINES);
    const parts = Object.fromEntries(lines.map(({ number, parts: blocks }) => [number, blocks]));

    assert.deepStrictEqual([parts['1.1.1'], parts['1.1.3'], parts['1.1.3-scr1']], [
      [{ kind: 'text', text: 'The number is checked as it is typed, as\n1.2.1 and 7.2.13 allow.' }],
      [
        { kind: 'text', text: 'The form shows:' }, { kind: 'text', text: '- the number;\n- the expiry.' }, { kind: 'fence', text: '```text\n1.1.9 Card number\n```' },
        { kind: 'text', text: 'Its fields keep their order.' },
      ],
      [{ kind: 'text', text: 'Screen, drawn by Claude: the form, empty.' }, { kind: 'fence', text: '```text\nCard number  ____\n```' }],
    ]);
    assert.deepStrictEqual(specReading(text(['# P', '', '## 1. A', '', '### 1.1 B', '', '1.1.1 Shown.', '', '[builder]'])).lines[0].parts, [{ kind: 'text', text: 'Shown.' }]);
    assert.deepStrictEqual(headings, [
      { kind: 'area', number: '1', title: 'Cards', line: 9 },
      { kind: 'part', number: '1.1', title: '1.1 The form', line: 11 },
      { kind: 'part', number: '1.2', title: '1.2 The receipt', line: 39 },
      { kind: 'scenarios', number: '1', title: 'Scenarios for §1', line: 47 },
    ]);
    assert.deepStrictEqual(specReading(text(['# P', '', '## 1. A', '', '### Unnumbered', ''])).headings[1], { kind: 'part', number: null, title: 'Unnumbered', line: 5 });
  });

  it('refuses, naming every fault at once, one per line: no title; a section the sections refuse; a note; a heading not standing alone, a second title, and one neither an area nor its scenarios; scenarios after another area; a line outside its part or its block; one numbered twice; one opening straight after another\'s source or a scenario\'s statements; a number the grammar does not read; a screen straight after a heading; a bracket of no form, or one on a scenario; a scenario drawing on a statement the spec lacks; and a fence left open', () => {
    const spec = text([
      'Payments', '',
      '## 1. Cards', '',
      'A note before any line.', '',
      '### 1.1 The form', 'Runs on from the heading.', '',
      '### 3.1 Elsewhere', '',
      '### 1.2 The receipt', '',
      '1.2.1 Typed. [builder]', '1.2.2 Straight after its source. [builder]', '',
      '2.1.1 Another part\'s. [builder]', '',
      '1.2.3. Near a number. [builder]', '',
      '- 1.2.4 Listed. [builder]', '',
      '# Appendix', '',
      '1.2.1 Again. [see below]', '',
      '1.S1 Not in a block. (1.2.1)', '',
      '## 2-S. Scenarios for §2', '',
      'Screen: straight after a heading.', '',
      '1.S1 Again. (1.9.9) [Ab12]', '',
      '1.S2 Given one. (1.2.1)', '1.S3 Straight after its statements. (1.2.1)', '',
      '## Open questions', '',
      '```text', 'never closed',
    ]);

    assert.deepStrictEqual(specReading(spec).faults, [
      'the spec does not open with its title — its first line is # Title',
      '§3.1 sits under §1',
      'line 5 opens a note, a block with no number after a heading — every requirement is a numbered line, N.M.K or N.Sk',
      'the heading on line 7 does not stand alone — a heading is ## or ### and its title, between blank lines',
      'line 15 opens a numbered line straight after the source of line 14 — each line is a block of its own, after a blank line',
      'statement 2.1.1 on line 17 sits under §1.2 — a statement N.M.K sits under ### N.M',
      'line 19 opens "1.2.3.", a number the spec does not read — a numbered line opens N.M.K or N.Sk and a space',
      'line 21 opens "- 1.2.4", a number the spec does not read — a numbered line opens N.M.K or N.Sk and a space',
      'line 23 is a second title — the spec has one, # Title, its first line',
      'the spec gives statement 1.2.1 twice, on lines 14 and 25',
      'scenario 1.S1 on line 27 sits in no block of scenarios — a scenario N.Sk sits under ## N-S., after its area',
      'the scenarios on line 29 are §2\'s, but follow §1 — an area\'s scenarios follow it, under ## N-S.',
      'the screen on line 31 follows a heading — a screen follows the line it shows',
      'scenario 1.S1 on line 33 sits among §2\'s scenarios — a scenario N.Sk sits under ## N-S., after its area',
      'the spec gives scenario 1.S1 twice, on lines 27 and 33',
      'line 36 opens a numbered line straight after the source of line 35 — each line is a block of its own, after a blank line',
      'scenario 1.S2 on line 35 sits among §2\'s scenarios — a scenario N.Sk sits under ## N-S., after its area',
      'the heading on line 38 is neither an area, ## N. Title, nor its scenarios, ## N-S. Scenarios for §N',
      'the fenced block opened on line 40 is never closed',
      'line 40 opens a note, a block with no number after a heading — every requirement is a numbered line, N.M.K or N.Sk',
      'statement 2.1.1 on line 17: its bracket closes an earlier block — the bracket closes the line\'s last text block',
      'statement 1.2.1 on line 25 ends in [see below], which is no source bracket — [id, id, …], [builder: id] or [builder]',
      'scenario 1.S1 on line 33 ends in [Ab12] — a scenario\'s source is the statements it draws on, in parentheses',
      'scenario 1.S1 draws on statement 1.9.9, which the spec lacks',
    ]);
    assert.throws(() => specStatements(spec), (err) => /** @type {Error} */ (err).message === specReading(spec).faults.join('\n'));
  });

  it('refuses a block reading as a line — ending in a source bracket, or for a scenario\'s number in its statements — that opens with a number the grammar does not read; one ending otherwise, and a wrapped row opening with one, are the line\'s text', () => {
    /** @param {string} block */
    const after = (block) => specReading(text(['# Payments', '', '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 The form,', '', block, '', 'and its fields. [builder]'])).faults;
    const misses = ['1.1.2. More. [builder]', '1.1.2: More. [builder]', '**1.1.2** More. [builder]', '- 1.1.2 More. [builder]', '1.1.2\tTabbed. [builder]', '* 1.S1 Given more. (1.1.1)'];

    assert.deepStrictEqual(misses.map(after), ['1.1.2.', '1.1.2:', '**1.1.2**', '- 1.1.2', '1.1.2', '* 1.S1'].map((said) => [`line 9 opens "${said}", a number the spec does not read — a numbered line opens N.M.K or N.Sk and a space`]));
    assert.deepStrictEqual(['- 1.1.2\'s limit applies first.', '4.2.1\'s rule holds here too.', '1.1.2. More.', '1.S1\'s case (see above).', 'Held, as\n1.2.1 and 7.2.13 allow.'].map(after), [[], [], [], [], []]);
  });

  it('reads a spec written with \\r\\n or \\r newlines as its page does, line for line', () => {
    assert.deepStrictEqual(specStatements(LINES.replaceAll('\n', '\r\n')), specStatements(LINES));
    assert.deepStrictEqual(specStatements(LINES.replaceAll('\n', '\r')), specStatements(LINES));
    assert.deepStrictEqual(sectionTexts(SPEC.replaceAll('\n', '\r\n')), sectionTexts(SPEC));
  });

  it('refuses a spec with no area, and one with no statement, so an empty spec never reads traced', () => {
    assert.throws(() => specStatements(text(['# Payments', '', 'Nothing numbered.'])), /^Error: the spec has no area — an area is a heading ## N\. Title\nthe spec has no statement — a statement is a block opening N\.M\.K, in its part$/);
    assert.throws(() => specStatements(text(['# Payments', '', '## 1. Cards', '', '### 1.1 The form', ''])), /^Error: the spec has no statement — a statement is a block opening N\.M\.K, in its part$/);
  });
});

describe('a spec\'s scenarios', () => {
  it('each scenario its lines give, by id, in the spec\'s order, refused where its lines are', () => {
    const spec = text([
      '# Payments', '', '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 The form. [builder]', '', '```text', '1.S3 Given a fence, then this is text.', '```', '',
      '## 1-S. Scenarios for §1', '', '1.S2 Given the form, then it shows. (1.1.1)', '', '1.S1 Given a card, then it is taken. (1.1.1)', '',
    ]);

    assert.deepStrictEqual(specScenarios(spec), ['1.S2', '1.S1']);
    assert.throws(() => specScenarios(`${spec}\n1.S2 Given it again. (1.1.1)\n`), /^Error: the spec gives scenario 1\.S2 twice, on lines 15 and 19$/);
  });
});
