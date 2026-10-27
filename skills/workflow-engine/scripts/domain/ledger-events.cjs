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

const { isId } = require('./ledger-ids.cjs');

const LEDGER = '.ledger.jsonl';

/** What a field holds, said for a refusal, and the test of it. @typedef {{is: string, test: (value: unknown) => boolean}} Type */

/**
 * A field of an event: its name and type, and, for a field a release after
 * the first added, that version and the default a line written before it
 * takes.
 * @typedef {{name: string, type: Type, added?: {version: number, default: unknown}}} Field
 */

/** An event's fields after the header, and the version that added it. @typedef {{since: number, fields: Field[]}} EventSchema */

/** The ledger's shape: the latest version, and every event. @typedef {{version: number, events: Record<string, EventSchema>}} Schema */

/** @param {string} is @param {(value: unknown) => boolean} test @returns {Type} */
function type(is, test) {
  return { is, test };
}

const TEXT = type('non-empty text', (v) => typeof v === 'string' && v !== '');
const ID = type('an entry id', isId);
const FLAG = type('true or false', (v) => typeof v === 'boolean');
const TIME = type('a UTC time', (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(v) && !Number.isNaN(Date.parse(v)));

/** @param {...string} values @returns {Type} */
function oneOf(...values) {
  return type(`one of ${values.join(', ')}`, (v) => typeof v === 'string' && values.includes(v));
}

/** @param {Type} item @returns {Type} */
function nullable(item) {
  return type(`${item.is}, or null`, (v) => v === null || item.test(v));
}

/** @param {Type} item @returns {Type} */
function listOf(item) {
  return type(`a list of ${item.is}`, (v) => Array.isArray(v) && v.every(item.test));
}

/** @param {string} name @param {Type} fieldType @returns {Field} */
function field(name, fieldType) {
  return { name, type: fieldType };
}

const PEOPLE = ['person', 'claude'];
// 16.11.3's composed kinds.
const KINDS = ['process', 'danger', 'contract', 'scope', 'look', 'words', 'behaviour', 'internals'];
const MOVED = ['none', 'claude-moved-person', 'person-moved-claude'];
const REASONS = ['new-fact', 'other-topic', 'changed-mind', 'was-wrong'];

/** @type {Field[]} */
const HEADER = [
  field('v', type('a schema version', (v) => Number.isInteger(v) && /** @type {number} */ (v) >= 1)),
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

/** The content of each kind of entry a replacement can stand for. @type {Record<string, Field[]>} */
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

/** An event of the first version. @param {Field[]} fields @returns {EventSchema} */
function event(fields) {
  return { since: 1, fields };
}

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
  },
};

const LEDGER_VERSION = SCHEMA.version;

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

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The version that added a field. @param {Field} f */
function addedIn(f) {
  return f.added?.version ?? 1;
}

/**
 * The fields an event holds, in the order its line is written: the header,
 * its own, and for a replacement the content of what it replaces.
 * @param {Record<string, unknown>} value @param {EventSchema} schema
 * @returns {Field[]}
 */
function fieldsOf(value, schema) {
  const content = value.event === 'replaced' && typeof value.of === 'string' && Object.hasOwn(CONTENT, value.of) ? CONTENT[value.of] : [];
  return [...HEADER, ...schema.fields, ...content];
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
  const fields = fieldsOf(value, schema.events[value.event]);
  /** @type {Record<string, unknown>} */
  const event = {};
  for (const f of fields) {
    if (addedIn(f) > v) {
      event[f.name] = structuredClone(f.added?.default);
    } else if (!Object.hasOwn(value, f.name)) {
      throw new LedgerLineError(`the ${value.event} event needs ${f.name}`);
    } else if (!f.type.test(value[f.name])) {
      throw new LedgerLineError(`its ${f.name} is not ${f.type.is}`);
    } else {
      event[f.name] = value[f.name];
    }
  }
  const stray = Object.keys(value).find((key) => !fields.some((f) => f.name === key && addedIn(f) <= v));
  if (stray !== undefined) throw new LedgerLineError(`the ${value.event} event has no field ${stray} at version ${v}`);
  return event;
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

module.exports = { LEDGER, LEDGER_VERSION, SCHEMA, LedgerLineError, LedgerNewer, validEvent, parseEntry };
