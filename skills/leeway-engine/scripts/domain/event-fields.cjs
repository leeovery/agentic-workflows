'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a field of an event holds, for the two streams of
// events the engine writes a line at a time — the ledger (ledger-events.cjs)
// and the trust log (trust-events.cjs). Pure. Each field has a type, said
// for a refusal, and the test of it; a field a release after a stream's
// first added names that version and the default a line written before it
// takes. An event's line is read against the fields its version holds, in
// their order, and nothing else. The kinds of question (16.11.3), a row's
// key, a model's id and the labeller's label (16.11.5) are named here too,
// since both streams carry them.
// ---------------------------------------------------------------------------

const { isObject } = require('../kernel/manifest-io.cjs');
const { isId } = require('./ledger-ids.cjs');

/**
 * What a field holds, said for a refusal, and the test of it; and for a
 * field that names entries, whether it names one or a list.
 * @typedef {{is: string, test: (value: unknown) => boolean, names?: 'one'|'many'}} Type
 */

/**
 * A field of an event: its name and type, and, for a field a release after
 * the first added, that version and the default a line written before it
 * takes.
 * @typedef {{name: string, type: Type, added?: {version: number, default: unknown}}} Field
 */

/**
 * An event's fields after the header, the version that added it, and any
 * rule its fields keep together: why a line breaks it, or null.
 * @typedef {{since: number, fields: Field[], holds?: (event: Record<string, unknown>) => string|null}} EventSchema
 */

/** A stream's shape: the latest version, and every event. @typedef {{version: number, events: Record<string, EventSchema>}} Schema */

/** @param {string} is @param {(value: unknown) => boolean} test @returns {Type} */
function type(is, test) {
  return { is, test };
}

const TEXT = type('non-empty text', (v) => typeof v === 'string' && v !== '');
const ID = { ...type('an entry id', isId), names: /** @type {const} */ ('one') };
const FLAG = type('true or false', (v) => typeof v === 'boolean');
const TIME = type('a UTC time', (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(v) && !Number.isNaN(Date.parse(v)));
const VERSION = type('a schema version', (v) => Number.isInteger(v) && /** @type {number} */ (v) >= 1);
const COUNT = type('a whole number from 1', (v) => Number.isInteger(v) && /** @type {number} */ (v) >= 1);
const LINE = type('one line of text', (v) => TEXT.test(v) && !/[\r\n]/.test(/** @type {string} */ (v)));
// A row's or an option's key: a letter, a number or a word, never a sentence.
const KEY = type('a key: letters, digits, - and _, up to 24 of them', (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/.test(v));

/** @param {...string} values @returns {Type} */
function oneOf(...values) {
  return type(`one of ${values.join(', ')}`, (v) => typeof v === 'string' && values.includes(v));
}

/** @param {Type} item @returns {Type} */
function nullable(item) {
  return { ...type(`${item.is}, or null`, (v) => v === null || item.test(v)), ...(item.names === undefined ? {} : { names: item.names }) };
}

/** @param {Type} item @returns {Type} */
function listOf(item) {
  return { ...type(`a list of ${item.is}`, (v) => Array.isArray(v) && v.every(item.test)), ...(item.names === undefined ? {} : { names: 'many' }) };
}

/**
 * An object holding `fields` and nothing else, each of its type.
 * @param {string} is @param {Readonly<Record<string, Type>>} fields
 * @returns {Type}
 */
function shaped(is, fields) {
  const names = Object.keys(fields);
  return type(is, (v) => isObject(v) && Object.keys(v).length === names.length
    && names.every((name) => Object.hasOwn(v, name) && fields[name].test(v[name])));
}

/**
 * A field; one a release after the stream's first added names that version
 * and the default a line written before it takes.
 * @param {string} name @param {Type} fieldType @param {{version: number, default: unknown}} [added]
 * @returns {Field}
 */
function field(name, fieldType, added) {
  return added === undefined ? { name, type: fieldType } : { name, type: fieldType, added };
}

/**
 * An event, of the first version unless `since` names a later, and the rule
 * its fields keep together, where there is one.
 * @param {Field[]} fields @param {number} [since] @param {EventSchema['holds']} [holds]
 * @returns {EventSchema}
 */
function event(fields, since = 1, holds = undefined) {
  return holds === undefined ? { since, fields } : { since, fields, holds };
}

// 16.11.3's composed kinds.
const KINDS = Object.freeze(['process', 'danger', 'contract', 'scope', 'look', 'words', 'behaviour', 'internals']);

/** A kind of question (16.11.3). @typedef {'process'|'danger'|'contract'|'scope'|'look'|'words'|'behaviour'|'internals'} Kind */

// A Claude model's id, as the API names it — never an alias, never words.
const MODEL = type('a model id', (v) => typeof v === 'string' && v.length <= 64 && /^claude-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v));

// The labeller's twelve questions (16.11.2).
const QUESTIONS = 12;

// A label (16.11.5): the labeller's model id, and its twelve answers, true or false.
const LABEL = type(
  `a label: the labeller's model id, and its ${QUESTIONS} answers, true or false`,
  (v) => isObject(v) && Object.keys(v).length === 2 && MODEL.test(v.labeller)
    && Array.isArray(v.answers) && v.answers.length === QUESTIONS && v.answers.every((a) => typeof a === 'boolean'),
);

/** The version that added a field. @param {Field} f */
function addedIn(f) {
  return f.added?.version ?? 1;
}

/**
 * `value` read as event `name` of version `v`, whose line holds `fields`:
 * each field that version holds, in their order, and each a later version
 * added at its default. Or why it is no such event: a field missing, one of
 * the wrong type, or one version `v` does not hold.
 * @param {Record<string, unknown>} value @param {Field[]} fields @param {number} v @param {string} name
 * @returns {{event: Record<string, unknown>} | {not: string}}
 */
function readFields(value, fields, v, name) {
  /** @type {Record<string, unknown>} */
  const event = {};
  for (const f of fields) {
    if (addedIn(f) > v) {
      event[f.name] = structuredClone(f.added?.default);
    } else if (!Object.hasOwn(value, f.name)) {
      return { not: `the ${name} event needs ${f.name}` };
    } else if (!f.type.test(value[f.name])) {
      return { not: `its ${f.name} is not ${f.type.is}` };
    } else {
      event[f.name] = value[f.name];
    }
  }
  const stray = Object.keys(value).find((key) => !fields.some((f) => f.name === key && addedIn(f) <= v));
  if (stray !== undefined) return { not: `the ${name} event has no field ${stray} at version ${v}` };
  return { event };
}

module.exports = { type, TEXT, ID, FLAG, TIME, VERSION, COUNT, LINE, KEY, KINDS, MODEL, LABEL, oneOf, nullable, listOf, shaped, field, event, addedIn, readFields };
