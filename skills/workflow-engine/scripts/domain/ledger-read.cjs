'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's read verbs (5.8.3, 6.1.4) — a record, a topic's
// map and the product record — each a projection of the ledger worked out
// when read, never kept (5.8.2), answered as JSON; what the person sees of
// them is drawn later.
//
// - Each read folds the ledger in one streamed pass (ledger-fold.cjs) and
//   reads again the lines of the entries it shows alone, from the file the
//   pass opened, so its cost in memory is the fold's plus what it shows.
// - Current entries only, by the one rule (5.8.17), so a session in any unit
//   reads any unit's entries directly (5.1.5, 5.8.11): `ledger record` reads
//   the entries standing in a unit, or one topic — each where the earliest
//   entry of its chain in a live place was made, a question's wording on
//   the topic its unit's last live move took it to — each current entry
//   with the live entries it replaced folded beneath it, newest first, and
//   the live confirmations that it still holds (5.6.5); the moves made
//   there, as history, which the map can differ from; the merges made
//   there, each with the duplicate it named and whether it holds; and, read
//   from their own current entries, never copied, the entries standing
//   elsewhere that it relies on, that its merges that hold went into, or
//   that answer its questions (5.8.4). `ledger map` reads a topic's
//   questions as they stand now, each answered as its record shows it. A
//   unit or topic that is not live has no current entry to show.
// - Every id is shown in its short form (5.2.1), and an entry shows its line
//   as written but its schema version; a decision the late one-decision
//   check judged shows beside it what the check found, `late_check`, one
//   rule or several — several is the flag (16.19.8).
// - A read takes no lock. What a landing its check finished said rides the
//   answer, and a refusal, as warnings.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { linkFields } = require('./ledger-events.cjs');
const { shortIds } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, factsOf, isLive, mergeHolds, holdsOf, foldedBeneath, mapOf, recordOf, productOf } = require('./ledger-fold.cjs');
const { hasTopic, manifestOf, liveness } = require('./ledger-units.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {Record<string, unknown>} Shown */

/**
 * A read's place: the unit, or none for the product record, and the topic,
 * or none for every entry of the unit.
 * @typedef {{unit: string|null, topic: string|null}} Place
 */

/**
 * The folded ledger as a read shows it: the fold read against liveness, an
 * entry's line shown, and an id in its short form.
 * @typedef {{folded: Folded, show: (id: string) => Shown, short: (id: string) => string}} Shower
 */

/** A read verb: its usage, how many places it names, and its answer. @typedef {{usage: string, names: number[], answer: (shower: Shower, place: Place) => Record<string, unknown>}} Read */

/**
 * An entry's line as a read shows it: as written, but its schema version,
 * each id it holds in its short form.
 * @param {Record<string, unknown>} event @param {(id: string) => string} short
 * @returns {Shown}
 */
function shownLine(event, short) {
  const links = new Map(linkFields(event).map((f) => [f.name, f.type.names]));
  /** @type {Shown} */
  const shown = {};
  for (const [field, value] of Object.entries(event)) {
    if (field === 'v') continue;
    const names = links.get(field);
    if (names === 'many') shown[field] = /** @type {string[]} */ (value).map(short);
    else if (names === 'one' && value !== null) shown[field] = short(/** @type {string} */ (value));
    else shown[field] = value;
  }
  return shown;
}

/**
 * The shower over a folded ledger, the entry at a place read again from it,
 * with what the late one-decision check found of it, where it found anything.
 * @param {Folded} folded @param {(place: import('./ledger.cjs').EntryPlace) => Record<string, unknown>} entryAt
 * @returns {Shower}
 */
function showerOf(folded, entryAt) {
  const shorts = shortIds(folded.facts.keys());
  const short = (/** @type {string} */ id) => /** @type {string} */ (shorts.get(id));
  const show = (/** @type {string} */ id) => {
    const facts = factsOf(folded, id);
    const shown = shownLine(entryAt(facts.place), short);
    return facts.late_check === null ? shown : { ...shown, late_check: facts.late_check };
  };
  return { folded, show, short };
}

/** An entry with the live confirmations that it still holds. @param {Shower} shower @param {string} id @returns {Shown} */
function held({ folded, show }, id) {
  return { ...show(id), holds: holdsOf(folded, id).map(show) };
}

/** A current entry with its chain folded beneath it, newest first (5.6.5). @param {Shower} shower @param {string} id @returns {Shown} */
function chained(shower, id) {
  return { ...held(shower, id), replaced: foldedBeneath(shower.folded, id).map((old) => held(shower, old)) };
}

/** A move, with the text of the question it moved. @param {Shower} shower @param {string} id @returns {Shown} */
function movedRow({ folded, show }, id) {
  const question = /** @type {string} */ (factsOf(folded, id).question);
  return { ...show(id), text: show(question).text };
}

/**
 * A merge, with the line of the duplicate it named, or null for none or one
 * that is not live, and whether it holds.
 * @param {Shower} shower @param {string} id @returns {Shown}
 */
function mergedRow({ folded, show }, id) {
  const { duplicate } = factsOf(folded, id);
  return { ...show(id), duplicate_entry: duplicate === null || !isLive(folded, duplicate) ? null : show(duplicate), holds: mergeHolds(folded, id) };
}

/**
 * `ledger record`: a unit's or a topic's current entries by kind, each with
 * its chain and its confirmations; its moves, and its merges each with its
 * duplicate and whether it holds; and the current entries standing
 * elsewhere it relies on, merged into by a merge that holds, or that answer
 * its questions.
 * @param {Shower} shower @param {Place} place
 */
function answerRecord(shower, { unit, topic }) {
  const ids = recordOf(shower.folded, /** @type {string} */ (unit), topic);
  return {
    unit,
    topic,
    live: shower.folded.live(/** @type {string} */ (unit), topic) === null,
    questions: ids.questions.map((id) => chained(shower, id)),
    findings: ids.findings.map((id) => chained(shower, id)),
    decisions: ids.decisions.map((id) => chained(shower, id)),
    moved: ids.moved.map((id) => movedRow(shower, id)),
    merged: ids.merged.map((id) => mergedRow(shower, id)),
    other_topics: ids.other_topics.map(({ id, named }) => ({ ...shower.show(id), named: named.map(shower.short) })),
  };
}

/**
 * A question's answer as its map row shows it: whose, where, and what, and
 * what the late one-decision check found of it, where it found anything.
 * @param {Shower} shower @param {string} answer
 */
function rowAnswer({ show }, answer) {
  const { id, unit, topic, by, text, late_check: lateCheck } = show(answer);
  return { id, unit, topic, by, text, ...(lateCheck === undefined ? {} : { late_check: lateCheck }) };
}

/**
 * `ledger map`: a topic's questions, each with where it stands and its
 * current answers.
 * @param {Shower} shower @param {Place} place
 */
function answerMap(shower, { unit, topic }) {
  const rows = mapOf(shower.folded, /** @type {string} */ (unit), /** @type {string} */ (topic));
  return {
    unit,
    topic,
    live: shower.folded.live(/** @type {string} */ (unit), topic) === null,
    questions: rows.map((row) => {
      const { id, text, by, at } = shower.show(row.id);
      return {
        id, text, by, at,
        stands: row.stands,
        moved_from: row.moved_from,
        moved_to: row.moved_to,
        part_of: row.part_of === null ? null : shower.short(row.part_of),
        parts: row.parts.map(shower.short),
        answers: row.answers.map((answer) => rowAnswer(shower, answer)),
      };
    }),
  };
}

/** `ledger product`: the product record, each entry with its chain and its confirmations. @param {Shower} shower */
function answerProduct(shower) {
  const ids = productOf(shower.folded);
  return {
    findings: ids.findings.map((id) => chained(shower, id)),
    decisions: ids.decisions.map((id) => chained(shower, id)),
  };
}

/** @type {Readonly<Record<string, Read>>} */
const READS = Object.freeze({
  record: { usage: 'ledger record <work-unit> [<topic>]', names: [1, 2], answer: answerRecord },
  map: { usage: 'ledger map <work-unit> <topic>', names: [2], answer: answerMap },
  product: { usage: 'ledger product', names: [0], answer: answerProduct },
});

/** The read verbs' usage, a line each. */
const LEDGER_READ_USAGE = Object.values(READS).map((read) => read.usage).join('\n');

/**
 * The place a read names, checked: the unit exists and, named, the topic is
 * one of the unit's.
 * @param {string} root @param {string} verb @param {string[]} args
 * @returns {Place}
 */
function namedPlace(root, verb, args) {
  const read = READS[verb];
  if (!read.names.includes(args.length) || args.some((arg) => arg.startsWith('-'))) throw new Error(`Usage: engine ${read.usage}`);
  const [unit = null, topic = null] = args;
  if (unit === null) return { unit, topic };
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`ledger ${verb}: there is no work unit "${unit}"`);
  if (topic !== null && !hasTopic(manifest, topic)) throw new Error(`ledger ${verb}: ${unit} has no topic "${topic}"`);
  return { unit, topic };
}

/**
 * `ledger <record|map|product>`: the projection read, as JSON, and as
 * warnings what a landing its check finished said.
 * @param {string} cwd @param {string} verb @param {string[]} args
 * @returns {Record<string, unknown>}
 */
function readLedgerVerb(cwd, verb, args) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    const place = namedPlace(root, verb, args);
    const live = liveness(root);
    const answer = readFolded(root, ID_FACTS, warnings, (facts, entryAt) => READS[verb].answer(showerOf({ facts, live }, entryAt), place));
    return warnings.length > 0 ? { ...answer, warnings } : answer;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { LEDGER_READ_USAGE, READ_VERBS: Object.keys(READS), readLedgerVerb, showerOf };
