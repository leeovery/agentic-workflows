'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the trust log's events and their schemas (16.13.4). Pure. The
// trust log (trust-log.cjs) holds one event a line, JSON, ended by LF alone:
// what the ask rule's counts need, and no decision's content, which stays in
// the project's ledger (16.13.3).
//
// Every event opens with the same fields: the version of its line's shape,
// its id, the time the engine wrote it, its type, the project it happened
// in — the project's id (16.13.5) and its name, its main checkout's folder,
// both null for an event before the project has state — the model the
// conversation ran on (16.4.4), by its id, null where none could be read,
// and the conversation's session, by Claude Code's id for it, null where
// none was handed over. Then its own:
//
// - gate: an answer at a gate, by the gate's name (16.11.9), and the row
//   the engine recommended, null where it recommended none; then the
//   answer, as a raise's is.
// - raise: a question raised to the person (16.9) — the ledger entry the
//   answer landed as, the question's kind (16.11) and the label it was
//   composed from, Claude's sort of it as a call with one defensible answer
//   or several (16.3.7), and the row of Claude's sealed answer; then the
//   answer, and whether the person didn't follow, which leaves no answer,
//   no reading and no entry (16.9.3, 16.12.3). A raise followed has its
//   entry: the command that writes the entry records the event (16.13.3).
// - call: a call Claude made (16.3.7), by its ledger entry, with its kind,
//   its label and its sort.
// - verdict: a departure's verdict (16.10.9), by its ledger entry — nothing,
//   a fix later, a real loss, or a skip — and the point it was given at.
// - blind-draw: a call drawn as a blind question (16.17.5), by its entry,
//   with its kind.
// - reversal: the person's later reversal (16.12.1), by its entry, pointing
//   back at the entry it reverses.
// - position-switch: a build's position switched (3.3.7), by its unit, to
//   auto or step.
// - convergence: a topic's convergence offer accepted (16.8.6), by its unit
//   and topic.
// - correction: the person's correction of a question's kind or of a
//   departure's verdict (16.15.4), by its entry: what they corrected it to,
//   the other null.
//
// An answer, at a gate or to a raise, is how it came — `via`, pressed with
// a click or typed at the keyboard (6.6.4): the mod says which, and with
// the mod off every answer is typed — and what it is: a row's key, which a
// typed answer can be too (6.S18), or free text (`with_text`), which only
// the keyboard gives. A row's key names its row, and nothing is read from
// it; free text names none and is never kept (16.13.3) — the row it reads
// as is null until the separate call reads it (16.19.1).
//
// No field carries words: a row is named by its key, a gate by its name,
// a unit and a topic by their slugs, a model and a session by their ids —
// only the project's name is its checkout folder's, as it is — so the log
// keeps a decision's content out (16.13.3). A label is the labeller's twelve
// answers, true or false in 16.11.2's order, with the labeller that wrote
// them, by the id of the model its call ran on (16.11.5, 16.19.6,
// 16.19.11). The kind, the label and the sort are null until the labeller
// and the decision point fill them (29.5, 29.19). An event whose fields
// contradict each other is no event: free text pressed or naming a row,
// read as a row though it is no free text, or a row's key answer naming
// none; a raise followed with no entry, or not followed with an answer, a
// reading or an entry; an entry reversing itself; and a correction of both
// or of neither.
//
// One file serves every project on the machine, and each project runs the
// engine its own copy of the workflows installs, so engines of several
// releases read and write it at once. Its format is never changed in place:
//
// - A release that changes an event's shape, or adds an event, bumps the
//   version, and a line carries the version its own event's shape was last
//   changed in — so a release that changes one event leaves every other
//   readable by the engines before it. A field a later version added reads
//   at its default from a line written before it (event-fields.cjs).
// - A line no event of this engine's schema — a newer release's, at a
//   version above the schema's or of a type it does not know, or one that is
//   no event at all — is skipped, never a stop and never rewritten.
// ---------------------------------------------------------------------------

const {
  type, TEXT, ID, FLAG, TIME, VERSION, KINDS, oneOf, nullable, field, event, addedIn, readFields,
} = require('./event-fields.cjs');
const { KEBAB_SLUG_PATTERN } = require('../kernel/manifest-schema.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');

/** @typedef {import('./event-fields.cjs').Field} Field */
/** @typedef {import('./event-fields.cjs').Schema} Schema */

const KIND = nullable(oneOf(...KINDS));
// A row's or an option's key: a letter, a number or a word, never a sentence.
const KEY = type('a key: letters, digits, - and _, up to 24 of them', (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/.test(v));
// A gate's name, as the engine's menus name their gates: a few lowercase words.
const GATE = type('a gate\'s name: up to five lowercase words, 40 characters at most', (v) => typeof v === 'string' && v.length <= 40
  && /^[a-z0-9]+(?:-[a-z0-9]+)*(?: [a-z0-9]+(?:-[a-z0-9]+)*){0,4}$/.test(v));
// A work unit's or a topic's name.
const SLUG = type('a slug', (v) => typeof v === 'string' && KEBAB_SLUG_PATTERN.test(v));
// A Claude model's id, as the API names it — never an alias, never words.
const MODEL = type('a model id', (v) => typeof v === 'string' && v.length <= 64 && /^claude-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v));
// A Claude Code session's id.
const SESSION = type('a session id', (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v));
// Claude's sort of a call (16.3.7).
const SORT = nullable(oneOf('one', 'several'));
const QUESTIONS = 12;
const LABEL = nullable(type(
  `a label: the labeller's model id, and its ${QUESTIONS} answers, true or false`,
  (v) => isObject(v) && Object.keys(v).length === 2 && MODEL.test(v.labeller)
    && Array.isArray(v.answers) && v.answers.length === QUESTIONS && v.answers.every((a) => typeof a === 'boolean'),
));
const JUDGED = ['nothing', 'fix', 'loss'];
const VERDICTS = [...JUDGED, 'skip'];
// Where a verdict is given: a topic's decided screen, ready to build, an
// investigation's conclusion, the finish gate, a quick-fix's close
// (16.10.10), and the verdict queue (16.10.7).
const VERDICT_POINTS = ['decided', 'ready-to-build', 'conclusion', 'finish', 'close', 'queue'];

/** @type {Field[]} */
const HEADER = [
  field('v', VERSION),
  field('id', ID),
  field('at', TIME),
  field('type', TEXT),
  field('project', nullable(ID)),
  field('project_name', nullable(TEXT)),
  field('model', nullable(MODEL)),
  field('session', nullable(SESSION)),
];

// How an answer came, whether it was free text, and the row that reads as.
const HOW_ANSWERED = [
  field('via', oneOf('pressed', 'typed')),
  field('with_text', FLAG),
  field('reading', nullable(KEY)),
];

/** @type {Schema} */
const SCHEMA = {
  version: 1,
  events: {
    gate: event([
      field('gate', GATE),
      field('recommended', nullable(KEY)),
      field('picked', nullable(KEY)),
      ...HOW_ANSWERED,
    ]),
    raise: event([
      field('entry', nullable(ID)),
      field('kind', KIND),
      field('label', LABEL),
      field('sort', SORT),
      field('sealed', KEY),
      field('answer', nullable(KEY)),
      ...HOW_ANSWERED,
      field('didnt_follow', FLAG),
    ]),
    call: event([field('entry', ID), field('kind', KIND), field('label', LABEL), field('sort', SORT)]),
    verdict: event([field('entry', ID), field('verdict', oneOf(...VERDICTS)), field('point', oneOf(...VERDICT_POINTS))]),
    'blind-draw': event([field('entry', ID), field('kind', KIND)]),
    reversal: event([field('entry', ID), field('reverses', ID)]),
    'position-switch': event([field('unit', SLUG), field('to', oneOf('auto', 'step'))]),
    convergence: event([field('unit', SLUG), field('topic', SLUG)]),
    correction: event([field('entry', ID), field('kind', KIND), field('verdict', nullable(oneOf(...JUDGED)))]),
  },
};

const KEYBOARD = 'free text comes only from the keyboard';

/**
 * Where an answer naming `row` contradicts how it came: free text pressed,
 * or naming a row; read as a row though it is no free text; a row's key
 * naming none. Null where they agree.
 * @param {unknown} row @param {Record<string, unknown>} event
 * @returns {string|null}
 */
function answerContradiction(row, { via, with_text: withText, reading }) {
  if (withText) {
    if (via !== 'typed') return KEYBOARD;
    return row === null ? null : 'free text names no row: the separate call reads one from it';
  }
  if (reading !== null) return 'only free text is read as a row';
  return row === null ? 'an answer that is no free text names its row' : null;
}

/**
 * Where a raise the person didn't follow contradicts itself: it has no
 * answer, no reading and no entry, and free text came from the keyboard.
 * @param {Record<string, unknown>} event @returns {string|null}
 */
function notFollowedContradiction({ entry, answer, reading, via, with_text: withText }) {
  if (entry !== null || answer !== null || reading !== null) return 'a raise not followed has no answer, no reading and no entry';
  return withText && via !== 'typed' ? KEYBOARD : null;
}

/**
 * Where a raise the person followed contradicts itself: it has its entry,
 * and its answer agrees with how it came.
 * @param {Record<string, unknown>} event @returns {string|null}
 */
function followedContradiction(event) {
  return event.entry === null ? 'a raise answered has the ledger entry its answer landed as' : answerContradiction(event.answer, event);
}

/**
 * What each event's fields must agree on: the contradiction, where they do
 * not, else null.
 * @type {Record<string, (event: Record<string, unknown>) => string|null>}
 */
const AGREEMENT = {
  gate: (event) => answerContradiction(event.picked, event),
  raise: (event) => (event.didnt_follow ? notFollowedContradiction(event) : followedContradiction(event)),
  reversal: ({ entry, reverses }) => (entry === reverses ? 'an entry cannot reverse itself' : null),
  correction: ({ kind, verdict }) => ((kind === null) === (verdict === null) ? 'a correction changes a kind or a verdict, one and not both' : null),
};

/**
 * The version a line of event `type` carries: the one its shape was last
 * changed in.
 * @param {string} type
 */
function lineVersion(type) {
  const { since, fields } = SCHEMA.events[type];
  return Math.max(since, ...[...HEADER, ...fields].map(addedIn));
}

/**
 * `value` read as an event of the shape its version names, every field in
 * the schema's order; or why this engine cannot read it: no JSON object, no
 * version, a newer release's version — `later`, for an engine that will —
 * or a type its version does not hold, a field missing, of the wrong type,
 * or one the type does not hold, or fields that contradict each other.
 * @param {unknown} value
 * @returns {{event: Record<string, unknown>} | {not: string, later?: true}}
 */
function readTrustEvent(value) {
  if (!isObject(value)) return { not: 'it is not a JSON object' };
  const { v, type } = value;
  if (!VERSION.test(v)) return { not: `its v, ${JSON.stringify(v)}, is not a schema version` };
  const version = /** @type {number} */ (v);
  if (version > SCHEMA.version) return { not: `a newer Leeway wrote it, at version ${version}; this one reads up to ${SCHEMA.version}`, later: true };
  const known = Object.keys(SCHEMA.events).filter((name) => SCHEMA.events[name].since <= version);
  if (typeof type !== 'string' || !known.includes(type)) return { not: `its type ${JSON.stringify(type)} is none of version ${version}'s: ${known.join(', ')}` };
  const read = readFields(value, [...HEADER, ...SCHEMA.events[type].fields], version, type);
  const contradiction = 'event' in read ? AGREEMENT[type]?.(read.event) ?? null : null;
  return contradiction === null ? read : { not: `its fields disagree: ${contradiction}` };
}

/**
 * Event `type` as its line is written: `header`, the fields the engine
 * sets, and the type's own `fields`, in the schema's order. Refuses a type
 * the schema does not hold, a header field among `fields`, and fields that
 * are not the type's own, saying why.
 * @param {string} type @param {Record<string, unknown>} header @param {Record<string, unknown>} fields
 * @returns {Record<string, unknown>}
 */
function trustEvent(type, header, fields) {
  if (!Object.hasOwn(SCHEMA.events, type)) throw new Error(`the trust log holds no ${type} event: ${Object.keys(SCHEMA.events).join(', ')}`);
  const set = Object.keys(fields).find((key) => HEADER.some((f) => f.name === key));
  if (set !== undefined) throw new Error(`a ${type} event's own fields cannot set ${set}: the engine sets it`);
  const read = readTrustEvent({ ...header, ...fields, v: lineVersion(type), type });
  if ('not' in read) throw new Error(`a ${type} event cannot be recorded: ${read.not}`);
  return read.event;
}

module.exports = { SCHEMA, HEADER, MODEL, SESSION, readTrustEvent, trustEvent };
