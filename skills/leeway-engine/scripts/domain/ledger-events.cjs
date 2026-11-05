'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's events and their schemas (5.3, 5.7). Pure. The
// ledger is `.ledger.jsonl` at the state root: one event a line, JSON,
// ended by LF alone, each carrying its schema version.
//
// Every event opens with the same fields: the version, its id, the event's
// name, its tags — the work unit, the topic (none from the spec on, where
// everything is the unit's), the phase and the session (5.2.3) — and the
// time the engine wrote it (5.2.4). A finding about the product as a whole,
// which no unit holds, is tagged with the product's place: the unit
// `product`, a name no work unit takes, in discovery, on no topic (8.12.9).
// Every event a session writes but an asset link says who made it and who
// moved whom (5.1.1, 5.3.10). Then its own:
//
// - asked: a question goes on a topic's map — the question, the question
//   whose unsettled part it is (5.3.11), and what it relies on. A review's
//   finding is a question the review asked (5.3.9).
// - found: a fact, how it is known, what it relies on, and whether it is
//   product-wide (5.2.5). How it is known is said in words, `how`, and
//   by its kind, `known` (9.2.12): measured, or exploratory — measured in
//   the conversation without an experiment — each by running something,
//   whose command and result are recorded so the closing pass can run it
//   again (9.9.7); documented; seen in a spike; or read; null where the
//   words alone say it.
// - decided: an answer to the question it closes (5.5.1): who, why, what it
//   rules out and relies on, whether it is product-wide; beside a person's
//   answer Claude's sealed one, beside Claude's own call its alternatives
//   and evidence (5.1.1), the kind of question (16.11), and whether it
//   landed unchecked by the one-decision check (16.19.8); and how the
//   answer was given, `given` (9.2.14, 9.2.16, 21.6.5): its
//   maker's own; "your call", the person handing it to Claude; "don't
//   care", the builder's; or carried over by the migration, its log not
//   showing who made it. `by` stays the person or Claude, so the
//   departure rule reads an answer handed over as Claude's call
//   (ledger-verdicts.cjs); one carried over is no call of Claude's
//   (`claudesCall`).
// - replaced: what an entry is replaced by (5.6.2) — the entry it replaces,
//   one of the four reasons, the entry that caused the change (5.3.8), what
//   it drops (5.6.6), and the new content, in the shape of what it replaces:
//   a question, a finding or a decision (5.3.6).
// - still-holds: an entry confirmed after a replacement it relied on.
// - moved: a question moved to another topic (5.3.3), or to the roadmap
//   as later, `roadmap:{item}` (9.5.4).
// - merged: a duplicate answer merged where it is found (5.5.5): the
//   question here, the entry already answering it, and the duplicate where
//   one had landed.
// - checked: the one-decision check's late result on an entry that landed
//   unchecked (16.19.8).
// - kept: the person keeping a decision as it stands, where Claude proposed
//   to replace it (raise.cjs, 5.3.10): the person's alone, standing over
//   Claude's proposal; the entry kept; the reason and the cause the
//   replacement was proposed for; why, Claude's account of the person's
//   reason, as every answer of the person's carries; and Claude's proposal,
//   the answer the person's stood over, as its sealed answer. It is no entry
//   and changes nothing current — no replacement, so nothing relying on the
//   entry is affected (5.6.10), and against its cause it confirms the entry
//   still holds (ledger-affected.cjs) — and a departure owed a verdict
//   (16.10.1).
// - asset: a file linked from an entry (9.10.5–9.10.7, 9.10.16):
//   the entry and the file's path from the state root; the status the link
//   gives it, canonical or reference; and the lift, the path in the project
//   the file was lifted into — each, or both, but never neither. The first
//   link of an entry and a path gives its status, which the asset verb
//   holds. It is no entry and is never replaced: for an entry and a path,
//   the latest live status stands, and apart from it the latest live lift,
//   which no status after it undoes (ledger-fold.cjs).
// - parked: a question the build needs the person for, parked with the
//   task it holds (12.13.4; raise.cjs): what it is about — the question it
//   answers, or the decision a replacement would replace with the reason and
//   the cause — and what its answer relies on; the task it parks, as screens
//   show it, null where a call made in the build outside any task asks — the
//   task writer's, the consolidation agent's or the phase review's — parking
//   none; its number in its unit, `Q{number}`, the engine's, minted as it
//   parks and never reused, or, for a task joining a question already
//   waiting, that question's (questions.cjs); and the call sealed, so it is
//   raised as it was put whenever the person is ready, in whatever
//   conversation: Claude's call as the raise took it, the rows the
//   one-decision check judged one rule, and why it asks, the decision point's
//   reason. A fact only the person holds (16.3.8) parks in the same shape, as
//   the ledger holds a fact's answer, with no lean: its call's lean, why and
//   sort null, its rows any number. It names no maker, is no entry and is
//   never replaced: it waits while what it is about stands open
//   (questions.cjs).
// - unparked: a task closed in the build, taken off the questions of its
//   unit that parked it (task-parks.cjs, questions.cjs): the task, as
//   screens show it, and the parks naming it that it is taken off, by id —
//   those alone, so the task reopened and parked again parks again. It
//   names no maker and is no entry; a question it leaves parking nothing
//   still waits.
// - rehomed: the lines made at the places a unit gives up, carried to the
//   place this line is made at, listed by id (5.8.18, 18.3.5): an absorbed
//   feature's — its unit's level, its discussion and its experiments — at
//   the epic's topic it became; and `files`, each file those lines name
//   that the move took elsewhere, `[from, to]`. Every read takes a line it
//   lists as made here from then on, live while this place is, however the
//   unit it came from stands, and naming each such file where it went
//   (ledger-rehomed.cjs). It names no maker and is no entry.
//
// Every entry may cite where it came from (21.6.3, 21.6.4): sections of
// files — a topic's log, a spec — each by its path from the state root and
// its heading. Every path is written plain, so one file is one path:
// relative, no part of it empty, `.` or `..`. Every entry names the task it
// was made for, where it was made in the build (12.12.5), as screens show
// it, `{phase}.{n}`; null where it was made for none.
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
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { type, TEXT, ID, FLAG, TIME, VERSION, COUNT, LINE, KEY, KINDS, oneOf, nullable, listOf, shaped, field, event, readFields } = require('./event-fields.cjs');
const { isShownTask } = require('./task-id.cjs');

const LEDGER = '.ledger.jsonl';

/** @typedef {import('./event-fields.cjs').Field} Field */
/** @typedef {import('./event-fields.cjs').EventSchema} EventSchema */
/** @typedef {import('./event-fields.cjs').Schema} Schema */

const PEOPLE = ['person', 'claude'];
const MOVED = ['none', 'claude-moved-person', 'person-moved-claude'];
const REASONS = ['new-fact', 'other-topic', 'changed-mind', 'was-wrong'];
const GIVEN = ['own', 'your-call', 'dont-care', 'carried'];
const KNOWN = ['measured', 'exploratory', 'documented', 'spike', 'read'];
const ASSET_STATUSES = ['canonical', 'reference'];

/** Whether `v` is a path written plain: relative, no part of it empty, `.` or `..`. @param {unknown} v */
function isPlainPath(v) {
  return typeof v === 'string' && v.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

const PATH = type('a path from the state root, written plain: no part of it empty, . or ..', isPlainPath);
const CODE_PATH = type('a path in the project from its root, written plain: no part of it empty, . or ..', isPlainPath);
const CITE = type('a citation, {path, section}: a path from the state root and a heading', (v) => isObject(v)
  && Object.keys(v).length === 2 && PATH.test(v.path) && TEXT.test(v.section));
const MOVED_FILE = type('a file moved, [from, to]: two paths from the state root', (v) => Array.isArray(v)
  && v.length === 2 && PATH.test(v[0]) && PATH.test(v[1]) && v[0] !== v[1]);

/** What an entry cites (21.6.3). */
const CITES = field('cites', listOf(CITE));

const TASK = type('a task, as screens show it: {phase}.{n}', isShownTask);

/** The task an entry was made for, in the build (12.12.5). */
const FOR_TASK = field('task', nullable(TASK));

/** What a raise's row holds (raise.cjs). */
const ROW_FIELDS = Object.freeze({ key: KEY, name: LINE, text: LINE, notice: LINE });

/** What Claude's call holds, as a raise takes it (raise.cjs). */
const CALL_FIELDS = Object.freeze({
  question: LINE,
  rows: listOf(shaped(`a row, {${Object.keys(ROW_FIELDS).join(', ')}}`, ROW_FIELDS)),
  lean: KEY,
  why: LINE,
  sort: oneOf('one', 'several'),
  mechanism: TEXT,
  product_wide: FLAG,
});

/** What opens a move's `to` that names an item of the roadmap, not a topic (9.5.4). */
const ROADMAP = 'roadmap:';

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

/**
 * Who made the line, and who moved whom — any way, unless `moves` names the
 * ways it can.
 * @param {string[]} makers @param {string[]} [moves]
 * @returns {Field[]}
 */
function made(makers, moves = MOVED) {
  return [field('by', oneOf(...makers)), field('who_moved_whom', oneOf(...moves))];
}

/** A kind of entry: what a replacement can stand for. @typedef {'question'|'finding'|'decision'} EntryKind */

/** The content of each kind of entry. @type {Record<EntryKind, Field[]>} */
const CONTENT = {
  question: [
    field('text', TEXT),
    field('part_of', nullable(ID)),
    field('relies_on', listOf(ID)),
    CITES,
    FOR_TASK,
  ],
  finding: [
    field('text', TEXT),
    field('how', TEXT),
    field('relies_on', listOf(ID)),
    field('product_wide', FLAG),
    field('known', nullable(oneOf(...KNOWN))),
    field('command', nullable(TEXT)),
    field('result', nullable(TEXT)),
    CITES,
    FOR_TASK,
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
    field('given', oneOf(...GIVEN)),
    CITES,
    FOR_TASK,
  ],
};

/**
 * What a parked question's call holds: Claude's call, or a fact only the
 * person holds, its lean, why and sort null.
 */
const PARKED_CALL_FIELDS = Object.freeze({ ...CALL_FIELDS, lean: nullable(KEY), why: nullable(LINE), sort: nullable(oneOf('one', 'several')) });

/**
 * Why a parked question's fields disagree, or null where they keep together:
 * it answers a question or proposes a replacement, one and not both; the
 * reason and the cause are a replacement's alone, its reason given; a fact
 * answers a question, and has no lean, why or sort, while a call has all
 * three and leans to a row it holds.
 * @param {Record<string, any>} parked
 * @returns {string|null}
 */
function parkHolds({ question, replaces, reason, cause, call }) {
  if ((question === null) === (replaces === null)) return 'a parked question answers a question or proposes a replacement, one and not both';
  if ((replaces === null) !== (reason === null)) return 'a replacement proposed gives its reason, and only a replacement does';
  if (cause !== null && replaces === null) return 'only a replacement proposed has a cause';
  const leans = [call.lean, call.why, call.sort].filter((given) => given !== null).length;
  if (leans === 0) return replaces === null ? null : 'a fact parked answers a question, never proposes a replacement';
  if (leans < 3) return 'its call has a lean, a why and a sort, or, a fact, none of them';
  return call.rows.some((/** @type {{key: string}} */ row) => row.key === call.lean) ? null : `its call leans to ${call.lean}, a row it does not hold`;
}

/** Why a task taken off its questions names none of them, or null. @param {Record<string, any>} unparked */
function unparkHolds({ parks }) {
  return parks.length === 0 ? 'a task taken off its questions names the parks it is taken off' : null;
}

/** Why a carry lists no line, or a file twice, or null. @param {Record<string, any>} rehomed */
function rehomeHolds({ lines, files }) {
  if (lines.length === 0) return 'a carry lists the lines it carries';
  return new Set(files.map((/** @type {string[]} */ [from]) => from)).size === files.length ? null : 'a carry names each file it moved once';
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
    kept: event([
      ...made(['person'], ['person-moved-claude']),
      field('entry', ID),
      field('reason', oneOf(...REASONS)),
      field('cause', nullable(ID)),
      field('why', TEXT),
      field('sealed', TEXT),
    ]),
    asset: event(
      [field('entry', ID), field('path', PATH), field('status', nullable(oneOf(...ASSET_STATUSES))), field('into', nullable(CODE_PATH))],
      1,
      ({ status, into }) => (status === null && into === null ? 'an asset link gives a status, a lift into the project, or both' : null),
    ),
    parked: event([
      field('question', nullable(ID)),
      field('replaces', nullable(ID)),
      field('reason', nullable(oneOf(...REASONS))),
      field('cause', nullable(ID)),
      field('relies_on', listOf(ID)),
      field('task', nullable(TASK)),
      field('number', COUNT),
      field('call', shaped(`a call, {${Object.keys(PARKED_CALL_FIELDS).join(', ')}}`, PARKED_CALL_FIELDS)),
      field('rows_judged', listOf(KEY)),
      field('why_asking', LINE),
    ], 1, parkHolds),
    unparked: event([field('task', TASK), field('parks', listOf(ID))], 1, unparkHolds),
    rehomed: event([field('lines', listOf(ID)), field('files', listOf(MOVED_FILE))], 1, rehomeHolds),
  },
};

const LEDGER_VERSION = SCHEMA.version;

/** The kind of entry each event that writes one makes; a replacement makes the kind it stands for. @type {Readonly<Record<string, EntryKind>>} */
const ENTRY_EVENTS = Object.freeze({ asked: 'question', found: 'finding', decided: 'decision' });

/**
 * The kind of entry an event is, or null for an event that is no entry: a
 * confirmation, a move, a merge, a check, a keep, an asset, a park, a task
 * taken off its questions or a carry.
 * @param {Record<string, unknown>} event
 * @returns {EntryKind|null}
 */
function entryKind(event) {
  if (event.event === 'replaced') return /** @type {EntryKind} */ (event.of);
  return Object.hasOwn(ENTRY_EVENTS, /** @type {string} */ (event.event)) ? ENTRY_EVENTS[/** @type {string} */ (event.event)] : null;
}

/** Who decided an answer, in the five forms a record shows them. @typedef {'person'|'claude'|'your-call'|'dont-care'|'carried'} DecidedBy */

/**
 * Who decided an answer (9.2.14, 9.2.16, 21.6.5): its maker, where it was
 * their own; else how it was given — Claude's by the person's "your call",
 * the builder's by their "don't care", or carried over.
 * @param {Record<string, unknown>} decision a decision's line, or a replacement standing for one
 * @returns {DecidedBy}
 */
function decidedBy({ by, given }) {
  return /** @type {DecidedBy} */ (given === 'own' ? by : given);
}

/**
 * Whether an entry is Claude's call: Claude made it, and no migration
 * carried it over without its maker (21.1.5, 21.6.5).
 * @param {{by?: unknown, given?: unknown}} entry
 */
function claudesCall({ by, given }) {
  return by === 'claude' && given !== 'carried';
}

/** The roadmap item a move's `to` names, or null where it names a topic (9.5.4). @param {string} to */
function roadmapItemOf(to) {
  return to.startsWith(ROADMAP) ? to.slice(ROADMAP.length) : null;
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
 * at its default, keeping any rule its fields keep together. Refuses
 * anything else, saying why; and a version above the schema's, as a newer
 * release's.
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
  const shape = schema.events[value.event];
  const read = readFields(value, fieldsOf(value, shape), v, value.event);
  if ('not' in read) throw new LedgerLineError(read.not);
  const broken = shape.holds?.(read.event) ?? null;
  if (broken !== null) throw new LedgerLineError(broken);
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
  LEDGER, LEDGER_VERSION, SCHEMA, HEADER, REASONS, ROADMAP, PRODUCT, ASSET_STATUSES, ROW_FIELDS, CALL_FIELDS, isPlainPath, LedgerLineError, LedgerNewer, entryKind, decidedBy, claudesCall, roadmapItemOf, eventFields, linkFields, validEvent, parseEntry,
};
