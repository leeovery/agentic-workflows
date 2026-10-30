'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's rendered copies (5.8.12, 5.8.13) — pure markdown
// renderers over what a record or the product record shows. A record's copy
// is for search alone: its current answers only, each under a heading a
// query can land on — the question it answers, a finding, or an entry from
// elsewhere made in the record's place or that the record rests on — with
// its why and what it rules out; a finding with how it is known and when
// (9.2.12); every entry with what it cites, the files linked from it with
// their status and any lift, never a file's own words (9.2.2), and who
// made it, a decision who decided it (9.2.14); and a question with no
// answer, open or moved to the roadmap as later (9.5.4). The product
// record's file is for a CLAUDE.md line to point at.
// ---------------------------------------------------------------------------

const { entryKind, decidedBy } = require('../ledger-events.cjs');

/** @typedef {import('../ledger-fold.cjs').Standing} Standing */

/** A file linked from an entry: its path, its status, and where it was lifted into the project. @typedef {{path: string, status: string|null, into: string|null}} Asset */

/**
 * An entry's line as a read shows it, the files linked from it, and where
 * it stands where that is outside the copy.
 * @typedef {{line: Record<string, any>, assets: Asset[], from: Standing|null}} Placed
 */

/**
 * A question, its text as its heading: its own line where it stands in the
 * copy, its current answers, and the roadmap it moved to as later, where
 * it did.
 * @typedef {{text: string, question: Placed|null, answers: Placed[], later: string|null}} Asked
 */

/**
 * What a record's copy shows: its place; its questions, each with its
 * answers — an open one with none — and the questions elsewhere its own
 * decisions answer; its findings; and the entries elsewhere made there or
 * that it rests on.
 * @typedef {{unit: string, topic: string|null, asked: Asked[], findings: Placed[], elsewhere: Placed[]}} RecordView
 */

/** What the product record's file shows. @typedef {{asked: Asked[], findings: Placed[]}} ProductView */

/**
 * Text as a body's lines, broken where the chunker breaks them: a line that
 * would open a heading or a fence — cutting the copy's sections where the
 * text says, not where its entries do — escaped to read as text, past any
 * leading space the chunker's own match passes over (kernel/knowledge/chunker.cjs).
 * @param {string} text
 */
function body(text) {
  return text.replace(/\r\n?/g, '\n').replace(/^([^\S\n]*)(#|```|~~~)/gm, '$1\\$2');
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

/** Who decided an answer, in its five forms. @type {Readonly<Record<import('../ledger-events.cjs').DecidedBy, string>>} */
const DECIDED = Object.freeze({
  person: 'Decided by the person',
  claude: 'Decided by Claude',
  'your-call': 'Decided by Claude, the person\'s "your call"',
  'dont-care': 'Left to the builder, the person\'s "don\'t care"',
  carried: 'Carried over, who decided it unrecorded',
});

/** How a finding is known, by its kind. @type {Readonly<Record<string, string>>} */
const KNOWN = Object.freeze({
  measured: 'measured', exploratory: 'measured in the conversation, exploratory', documented: 'documented', spike: 'seen in a spike', read: 'read',
});

/**
 * The line closing an entry: who made it — a decision, who decided it —
 * and how, where, and which entry it is; a finding, when it was found.
 * @param {Placed} placed @param {string} made
 */
function provenance({ line, from }, made) {
  const kind = entryKind(line);
  const by = kind === 'decision' ? DECIDED[decidedBy(line)] : `${made} by ${MAKERS[line.by]}${kind === 'finding' ? ` on ${line.at.slice(0, 10)}` : ''}`;
  const marks = [by, ...(line.product_wide === true ? ['product-wide'] : []), ...(from === null ? [] : [`in ${placeName(from)}`])];
  return `${marks.join(', ')}. Entry ${line.id}.`;
}

/** Paragraphs as a body's lines, a blank line between each. @param {string[][]} paragraphs @returns {string[]} */
function joined(paragraphs) {
  return paragraphs.flatMap((paragraph, i) => (i === 0 ? paragraph : ['', ...paragraph]));
}

/** A list under its label as a paragraph, none where it is empty. @param {string} label @param {string[]} items @returns {string[][]} */
function listed(label, items) {
  return items.length === 0 ? [] : [[`${label}:`, ...items.map((item) => `- ${item}`)]];
}

/** What an entry cites, and the files linked from it with their status, as paragraphs. @param {Placed} placed @returns {string[][]} */
function sources({ line, assets }) {
  return [
    ...listed('Cites', line.cites.map((/** @type {{path: string, section: string}} */ cite) => `${cite.path}: ${heading(cite.section)}`)),
    ...listed('Assets', assets.map(({ path, status, into }) => [path, ...(status === null ? [] : [status]), ...(into === null ? [] : [`lifted into ${into}`])].join(', '))),
  ];
}

/** A decision's body: what it decides, why, what it rules out. @param {Placed} placed @returns {string[]} */
function decisionBody(placed) {
  const { text, why, rules_out: rulesOut } = placed.line;
  return joined([
    [body(text)], [`Why: ${body(why)}`],
    ...listed('Rules out', rulesOut.map((/** @type {string} */ ruled) => body(ruled))),
    ...sources(placed),
    [provenance(placed, 'Decided')],
  ]);
}

/** A finding's body: the fact, how it is known, and a measurement's command and result. @param {Placed} placed @returns {string[]} */
function findingBody(placed) {
  const { text, how, known, command, result } = placed.line;
  return joined([
    [body(text)], [`How it is known: ${known === null ? '' : `${KNOWN[known]}, `}${body(how)}`],
    ...(command === null ? [] : [[`Command: ${body(command)}`, `Result: ${body(result)}`]]),
    ...sources(placed),
    [provenance(placed, 'Found')],
  ]);
}

/** A question's body, where it stands as an entry of its own. @param {Placed} placed @returns {string[]} */
function questionBody(placed) {
  return joined([[body(placed.line.text)], ...sources(placed), [provenance(placed, 'Asked')]]);
}

/** @type {Record<import('../ledger-events.cjs').EntryKind, (placed: Placed) => string[]>} */
const BODIES = { decision: decisionBody, finding: findingBody, question: questionBody };

/** A section: its heading and its paragraphs. @param {string} title @param {string[][]} blocks */
function section(title, blocks) {
  return [`## ${heading(title)}`, '', ...blocks.flatMap((block) => [...block, ''])];
}

/**
 * A question with who asked it where it stands in the copy, and its
 * answers, or none yet: open, or later on the roadmap.
 * @param {Asked} asked
 */
function askedSection({ text, question, answers, later }) {
  const none = later === null ? 'Not decided yet.' : `Later: moved to the roadmap, ${later}.`;
  return section(text, [
    ...(question === null ? [] : [joined([...sources(question), [provenance(question, 'Asked')]])]),
    ...(answers.length === 0 ? [[none]] : answers.map(decisionBody)),
  ]);
}

/** @param {Placed} placed */
function findingSection(placed) {
  return section(`Finding: ${placed.line.text}`, [findingBody(placed)]);
}

/** An entry elsewhere made in the record's place or that the record rests on. @param {Placed} placed */
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
