'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's rendered copies (5.8.12, 5.8.13) — pure markdown
// renderers over what a record or the product record shows. A record's copy
// is for search alone: its current answers only, each under a heading a
// query can land on — the question it answers, a finding, or an entry from
// elsewhere the record rests on — with its why and what it rules out. The
// product record's file is for a CLAUDE.md line to point at.
// ---------------------------------------------------------------------------

const { entryKind } = require('../ledger-events.cjs');

/** @typedef {import('../ledger-fold.cjs').Standing} Standing */

/**
 * An entry's line as a read shows it, and where it stands where that is
 * outside the copy.
 * @typedef {{line: Record<string, any>, from: Standing|null}} Placed
 */

/**
 * A question, its text as its heading: its own line where it stands in the
 * copy, and its current answers.
 * @typedef {{text: string, question: Placed|null, answers: Placed[]}} Asked
 */

/**
 * What a record's copy shows: its place; its questions, each with its
 * answers — an open one with none — and the questions elsewhere its own
 * decisions answer; its findings; and the entries elsewhere it rests on.
 * @typedef {{unit: string, topic: string|null, asked: Asked[], findings: Placed[], elsewhere: Placed[]}} RecordView
 */

/** What the product record's file shows. @typedef {{asked: Asked[], findings: Placed[]}} ProductView */

/**
 * Text as a body's lines: a line that would open a heading or a fence —
 * cutting the copy's sections where the text says, not where its entries do
 * — escaped to read as text.
 * @param {string} text
 */
function body(text) {
  return text.replace(/^([ \t]*)(#|```|~~~)/gm, '$1\\$2');
}

/** Text as one heading's line. @param {string} text */
function heading(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** @param {Standing} standing */
function placeName({ unit, topic }) {
  return topic === null ? `${unit}, at the unit's level` : `${unit} / ${topic}`;
}

/** Who made an entry, by its `by`. @type {Readonly<Record<string, string>>} */
const MAKERS = Object.freeze({ person: 'the person', claude: 'Claude', review: 'the review' });

/** The line closing an entry: who made it, and how, where, and which entry it is. @param {Placed} placed @param {string} made */
function provenance({ line, from }, made) {
  const marks = [`${made} by ${MAKERS[line.by]}`, ...(line.product_wide === true ? ['product-wide'] : []), ...(from === null ? [] : [`in ${placeName(from)}`])];
  return `${marks.join(', ')}. Entry ${line.id}.`;
}

/** A decision's body: what it decides, why, what it rules out. @param {Placed} placed @returns {string[]} */
function decisionBody(placed) {
  const { text, why, rules_out: rulesOut } = placed.line;
  return [
    body(text), '', `Why: ${body(why)}`,
    ...(rulesOut.length === 0 ? [] : ['', 'Rules out:', ...rulesOut.map((/** @type {string} */ ruled) => `- ${body(ruled)}`)]),
    '', provenance(placed, 'Decided'),
  ];
}

/** A finding's body: the fact and how it is known. @param {Placed} placed @returns {string[]} */
function findingBody(placed) {
  return [body(placed.line.text), '', `How it is known: ${body(placed.line.how)}`, '', provenance(placed, 'Found')];
}

/** A question's body, where it stands as an entry of its own. @param {Placed} placed @returns {string[]} */
function questionBody(placed) {
  return [body(placed.line.text), '', provenance(placed, 'Asked')];
}

/** @type {Record<import('../ledger-events.cjs').EntryKind, (placed: Placed) => string[]>} */
const BODIES = { decision: decisionBody, finding: findingBody, question: questionBody };

/** A section: its heading and its paragraphs. @param {string} title @param {string[][]} blocks */
function section(title, blocks) {
  return [`## ${heading(title)}`, '', ...blocks.flatMap((block) => [...block, ''])];
}

/** A question with who asked it where it stands in the copy, and its answers, or none yet. @param {Asked} asked */
function askedSection({ text, question, answers }) {
  return section(text, [
    ...(question === null ? [] : [[provenance(question, 'Asked')]]),
    ...(answers.length === 0 ? [['Not decided yet.']] : answers.map(decisionBody)),
  ]);
}

/** @param {Placed} placed */
function findingSection(placed) {
  return section(`Finding: ${placed.line.text}`, [findingBody(placed)]);
}

/** An entry elsewhere the record rests on. @param {Placed} placed */
function elsewhereSection(placed) {
  const from = /** @type {Standing} */ (placed.from);
  const kind = /** @type {import('../ledger-events.cjs').EntryKind} */ (entryKind(placed.line));
  return section(`From ${placeName(from)}: ${placed.line.text}`, [BODIES[kind](placed)]);
}

/** Lines joined as a file's text. @param {string[]} lines */
function fileText(lines) {
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * A record's copy, in markdown.
 * @param {RecordView} view
 * @returns {string}
 */
function recordCopy({ unit, topic, asked, findings, elsewhere }) {
  return fileText([
    `# ${topic === null ? `${unit}, at the unit's level` : `${unit} / ${topic}`}`, '',
    ...asked.flatMap(askedSection),
    ...findings.flatMap(findingSection),
    ...elsewhere.flatMap(elsewhereSection),
  ]);
}

/**
 * The product record's file, in markdown.
 * @param {ProductView} view
 * @returns {string}
 */
function productCopy({ asked, findings }) {
  const empty = asked.length === 0 && findings.length === 0;
  return fileText([
    '# The product record', '',
    'What this project has decided for the product as a whole: its product-wide findings and decisions, current only, rendered from its ledger.', '',
    ...(empty ? ['Nothing is marked product-wide yet.'] : [...asked.flatMap(askedSection), ...findings.flatMap(findingSection)]),
  ]);
}

module.exports = { recordCopy, productCopy };
