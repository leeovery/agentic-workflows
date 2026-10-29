'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's events and their schemas (5.3, 5.7). Pure. The
// ledger is `.ledger.jsonl` at the state root: one event a line, JSON,
// ended by LF alone, each carrying its schema version.
//
// Every event opens with the same fields: the version, its id, the event's
// name, its tags — the work unit, the topic (none from the spec on, where
// everything is the unit's), the phase and the session (5.2.3) — and the
// time the engine wrote it (5.2.4). Every event a session writes says who
// made it and who moved whom (5.1.1, 5.3.10). Then its own:
//
// - asked: a question goes on a topic's map — the question, the question
//   whose unsettled part it is (5.3.11), and what it relies on. A review's
//   finding is a question the review asked (5.3.9).
// - found: a fact, how it is known, what it relies on, and whether it is
//   product-wide (5.2.5).
// - decided: an answer to the question it closes (5.5.1): who, why, what it
//   rules out and relies on, whether it is product-wide; beside a person's
//   answer Claude's sealed one, beside Claude's own call its alternatives
//   and evidence (5.1.1), the kind of question (16.11), and whether it
//   landed unchecked by the one-decision check (16.19.8).
// - replaced: what an entry is replaced by (5.6.2) — the entry it replaces,
//   one of the four reasons, the entry that caused the change (5.3.8), what
//   it drops (5.6.6), and the new content, in the shape of what it replaces:
//   a question, a finding or a decision (5.3.6).
// - still-holds: an entry confirmed after a replacement it relied on.
// - moved: a question moved to another topic (5.3.3).
// - merged: a duplicate answer merged where it is found (5.5.5): the
//   question here, the entry already answering it, and the duplicate where
//   one had landed.
// - checked: the one-decision check's late result on an entry that landed
//   unchecked (16.19.8).
// - kept: the person keeping a decision as it stands, where Claude proposed
//   to replace it (raise.cjs, 5.3.10): the person's alone; the entry kept;
//   the reason and the cause the replacement was proposed for; and Claude's
//   proposal, the answer the person's stood over, as its sealed answer. It
//   is no entry and changes nothing current — no replacement, so nothing
//   relying on the entry is affected (5.6.10) — and a departure owed a
//   verdict (16.10.1).
//
// The engine assigns every link; it constrains links and identity, never
// content (5.1.8). Lines are written with their fields in the schema's
// order, each carrying the schema version it was written in, `v`:
//
// - A release that adds a field or an event bumps the version. The field
//   names the version that added it and its default, so a line written
//   before reads with the default (5.7.2); an event names the version that
//   added it. A line is read in the shape of its own version, and in one
//   shape only (5.7.4): a field or an event its version does not hold makes
//   it a broken line.
// - A line whose version is above the schema's was written by a newer
//   release. It is never read: the engine stops, to be updated.
// ---------------------------------------------------------------------------

const { isObject } = require('../kernel/manifest-io.cjs');
const { TEXT, ID, FLAG, TIME, VERSION, KINDS, oneOf, nullable, listOf, field, event, readFields } = require('./event-fields.cjs');

const LEDGER = '.ledger.jsonl';

/** @typedef {import('./event-fields.cjs').Field} Field */
/** @typedef {import('./event-fields.cjs').EventSchema} EventSchema */
/** @typedef {import('./event-fields.cjs').Schema} Schema */

const PEOPLE = ['person', 'claude'];
const MOVED = ['none', 'claude-moved-person', 'person-moved-claude'];
const REASONS = ['new-fact', 'other-topic', 'changed-mind', 'was-wrong'];

/** @type {Field[]} */
const HEADER = [
  field('v', VERSION),
  field('id', ID),
  field('event', TEXT),
  field('unit', TEXT),
  field('topic', nullable(TEXT)),
  field('phase', TEXT),
  field('session', TEXT),
  field('at', TIME),
];

/** Who made the entry, and who moved whom. @param {string[]} makers @returns {Field[]} */
function made(makers) {
  return [field('by', oneOf(...makers)), field('who_moved_whom', oneOf(...MOVED))];
}

/** A kind of entry: what a replacement can stand for. @typedef {'question'|'finding'|'decision'} EntryKind */

/** The content of each kind of entry. @type {Record<EntryKind, Field[]>} */
const CONTENT = {
  question: [
    field('text', TEXT),
    field('part_of', nullable(ID)),
    field('relies_on', listOf(ID)),
  ],
  finding: [
    field('text', TEXT),
    field('how', TEXT),
    field('relies_on', listOf(ID)),
    field('product_wide', FLAG),
  ],
  decision: [
    field('answers', ID),
    field('text', TEXT),
    field('why', TEXT),
    field('rules_out', listOf(TEXT)),
    field('relies_on', listOf(ID)),
    field('product_wide', FLAG),
    field('sealed', nullable(TEXT)),
    field('alternatives', listOf(TEXT)),
    field('evidence', listOf(TEXT)),
    field('kind', nullable(oneOf(...KINDS))),
    field('unchecked', FLAG),
  ],
};

/** @type {Schema} */
const SCHEMA = {
  version: 1,
  events: {
    asked: event([...made([...PEOPLE, 'review']), ...CONTENT.question]),
    found: event([...made(PEOPLE), ...CONTENT.finding]),
    decided: event([...made(PEOPLE), ...CONTENT.decision]),
    replaced: event([
      ...made(PEOPLE),
      field('replaces', ID),
      field('reason', oneOf(...REASONS)),
      field('cause', nullable(ID)),
      field('drops', listOf(TEXT)),
      field('of', oneOf(...Object.keys(CONTENT))),
    ]),
    'still-holds': event([...made(PEOPLE), field('entry', ID), field('after', ID)]),
    moved: event([...made(PEOPLE), field('question', ID), field('to', TEXT)]),
    merged: event([...made(PEOPLE), field('question', ID), field('into', ID), field('duplicate', nullable(ID))]),
    checked: event([field('entry', ID), field('rules', oneOf('one', 'several'))]),
    kept: event([...made(['person']), field('entry', ID), field('reason', oneOf(...REASONS)), field('cause', nullable(ID)), field('sealed', TEXT)]),
  },
};

const LEDGER_VERSION = SCHEMA.version;

/** The kind of entry each event that writes one makes; a replacement makes the kind it stands for. @type {Readonly<Record<string, EntryKind>>} */
const ENTRY_EVENTS = Object.freeze({ asked: 'question', found: 'finding', decided: 'decision' });

/**
 * The kind of entry an event is, or null for an event that is no entry: a
 * confirmation, a move, a merge, a check or a keep.
 * @param {Record<string, unknown>} event
 * @returns {EntryKind|null}
 */
function entryKind(event) {
  if (event.event === 'replaced') return /** @type {EntryKind} */ (event.of);
  return Object.hasOwn(ENTRY_EVENTS, /** @type {string} */ (event.event)) ? ENTRY_EVENTS[/** @type {string} */ (event.event)] : null;
}

/**
 * The fields an event holds after the header, in its schema's order: its
 * own, and for a replacement the content of the kind it stands for.
 * @param {EventSchema} schema @param {EntryKind|null} of
 * @returns {Field[]}
 */
function ownFields(schema, of) {
  return of === null ? schema.fields : [...schema.fields, ...CONTENT[of]];
}

/**
 * The fields event `name` of the current shape holds after the header.
 * @param {string} name @param {EntryKind|null} [of] the kind a replacement stands for
 * @returns {Field[]}
 */
function eventFields(name, of = null) {
  return ownFields(SCHEMA.events[name], of);
}

/** A line the ledger cannot hold: not an event of the shape its version names. */
class LedgerLineError extends Error {}

/** A line a newer release wrote, its version above the schema's: the engine stops, to be updated (`render ledger-stop`). */
class LedgerNewer extends Error {
  /** @param {number} version the line's @param {number} reads the schema's */
  constructor(version, reads) {
    super(`${LEDGER} holds entries a newer Leeway wrote, at schema version ${version}, and the workflows here read up to version ${reads} — `
      + 'update the workflows on this machine (pull the project\'s code) and start again');
    this.version = version;
    this.reads = reads;
    this.payload = { stop: 'ledger' };
  }
}

/**
 * The fields an event holds, in the order its line is written: the header,
 * its own, and for a replacement the content of what it replaces.
 * @param {Record<string, unknown>} value @param {EventSchema} schema
 * @returns {Field[]}
 */
function fieldsOf(value, schema) {
  const of = value.event === 'replaced' && typeof value.of === 'string' && Object.hasOwn(CONTENT, value.of) ? /** @type {EntryKind} */ (value.of) : null;
  return [...HEADER, ...ownFields(schema, of)];
}

/**
 * The fields of `event`, an event of the current shape, that name entries,
 * in its line's order: its id, and each link.
 * @param {Record<string, unknown>} event
 * @returns {Field[]}
 */
function linkFields(event) {
  return fieldsOf(event, SCHEMA.events[/** @type {string} */ (event.event)]).filter((f) => f.type.names !== undefined);
}

/**
 * `value` as an event of the shape its version names: every field that
 * version holds, in the schema's order, and each field a later version added
 * at its default. Refuses anything else, saying why; and a version above the
 * schema's, as a newer release's.
 * @param {unknown} value @param {Schema} [schema]
 * @returns {Record<string, unknown>}
 */
function validEvent(value, schema = SCHEMA) {
  if (!isObject(value)) throw new LedgerLineError('it is not a JSON object');
  const { v } = value;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new LedgerLineError(`its v, ${JSON.stringify(v)}, is not a schema version`);
  if (v > schema.version) throw new LedgerNewer(v, schema.version);
  const known = Object.keys(schema.events).filter((name) => schema.events[name].since <= v);
  if (typeof value.event !== 'string' || !known.includes(value.event)) {
    throw new LedgerLineError(`its event ${JSON.stringify(value.event)} is none of version ${v}'s: ${known.join(', ')}`);
  }
  const read = readFields(value, fieldsOf(value, schema.events[value.event]), v, value.event);
  if ('not' in read) throw new LedgerLineError(read.not);
  return read.event;
}

/**
 * Line `number` of the ledger read as an event of the shape its version
 * names. Refuses a line that is not one, naming it; a newer release's line
 * stops the read as it is.
 * @param {string} line @param {number} number @param {Schema} [schema]
 * @returns {Record<string, unknown>}
 */
function parseEntry(line, number, schema = SCHEMA) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    throw new LedgerLineError(`line ${number} of the ledger is not JSON: ${line.slice(0, 80)}`);
  }
  try {
    return validEvent(value, schema);
  } catch (err) {
    if (!(err instanceof LedgerLineError)) throw err;
    throw new LedgerLineError(`line ${number} of the ledger is no ledger entry: ${err.message}`);
  }
}

module.exports = {
  LEDGER, LEDGER_VERSION, SCHEMA, HEADER, REASONS, LedgerLineError, LedgerNewer, entryKind, eventFields, linkFields, validEvent, parseEntry,
};
