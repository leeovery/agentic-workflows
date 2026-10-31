'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's read verbs (5.8.3, 6.1.4) — a record, a topic's
// map, the product record, what a replacement affects (ledger-affected.cjs)
// and Claude's calls since the person last looked (ledger-since.cjs) — each
// a projection of the ledger worked out when read, never kept (5.8.2),
// answered as JSON; what the person sees of them is drawn later. The
// verdict queue is read the same way (verdict.cjs).
//
// - Each read folds the ledger in one streamed pass (ledger-fold.cjs) and
//   reads again the lines of the entries it shows alone, from the file the
//   pass opened, so its cost in memory is the fold's plus what it shows.
// - Current entries only, by the one rule (5.8.17), so a session in any unit
//   reads any unit's entries directly (5.1.5, 5.8.11): `ledger record` reads
//   the entries standing in a unit, or one topic — each where the earliest
//   entry of its chain in a live place was made, a question's wording on
//   the topic its unit's last live move took it to — each current entry
//   with the live entries it replaced folded beneath it, newest first, the
//   live confirmations that it still holds (5.6.5), the person's live
//   keeps of it against a replacement Claude proposed, and the files
//   linked from it, each with its latest live status and lift
//   (9.10.5–9.10.7, 9.10.16); its findings in a section of their own, each
//   saying how and when it is known (9.2.12), and its decisions who decided
//   them, by `by` and `given` (9.2.14); the moves made there, as history,
//   which the map can differ from; the merges made there, each with the
//   duplicate it named and whether it holds; and, read from their own
//   current entries, never copied, the entries standing elsewhere that were
//   made there, that it relies on, that its merges that hold went into, or
//   that answer its questions (5.8.4, 5.8.19). `ledger
//   map` reads a topic's questions as they stand now, each answered as its
//   record shows it, those standing elsewhere that it shows for what was
//   made on it, and each current answer placed on it that no current
//   question answers, a row headed by the answer as a row shows one; an
//   open question one of the unit's experiments measures is marked waiting
//   on it, running or concluded, until the discussion writes the result;
//   an abandoned one leaves it open (9.1.11). A unit or topic that is not
//   live has no current entry to show.
// - Every id is shown in its short form (5.2.1), and an entry shows its line
//   as written but its schema version; a decision the late one-decision
//   check judged shows beside it what the check found, `late_check`, one
//   rule or several — several is the flag (16.19.8).
// - A read takes no lock of its own, but for `ledger shown`, which takes
//   the last-looked mark's lock once its fold is done (ledger-since.cjs).
//   What a landing its check finished said rides the answer, and a refusal,
//   as warnings.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { linkFields } = require('./ledger-events.cjs');
const { shortIds } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, factsOf, isLive, mergeHolds, holdsOf, keptOf, assetsOf, foldedBeneath, mapOf, recordOf, productOf } = require('./ledger-fold.cjs');
const { hasTopic, manifestOf, experimentWaits, liveness } = require('./ledger-units.cjs');
const { answerAffected } = require('./ledger-affected.cjs');
const { answerSince, answerShown } = require('./ledger-since.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').MapRow} MapRow */
/** @typedef {Record<string, unknown>} Shown */

/**
 * A read's place: the unit, or none for the product record, and the topic,
 * or none for every entry of the unit.
 * @typedef {{unit: string|null, topic: string|null}} Place
 */

/**
 * A file linked from an entry as a read shows it: its path, the status its
 * latest live status link gives it, and where its latest live lift took it
 * into the project — each null where none gives one.
 * @typedef {{path: string, status: string|null, into: string|null}} AssetRow
 */

/**
 * The folded ledger as a read shows it: the fold read against liveness, an
 * entry's line shown, the files linked from an entry, and an id in its
 * short form.
 * @typedef {{folded: Folded, show: (id: string) => Shown, assets: (id: string) => AssetRow[], short: (id: string) => string}} Shower
 */

/**
 * A read verb: its usage, how many places it names, and its answer, given
 * the project's state root, what it says on the way pushed to `warnings`.
 * @typedef {{
 *   usage: string,
 *   names: number[],
 *   answer: (shower: Shower, place: Place, root: string, warnings: string[]) => Record<string, unknown>,
 * }} Read
 */

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
  const assets = (/** @type {string} */ id) => assetsOf(folded, id).map(({ path, status, lift }) => ({
    path,
    status: status === null ? null : /** @type {string} */ (show(status).status),
    into: lift === null ? null : /** @type {string} */ (show(lift).into),
  }));
  return { folded, show, assets, short };
}

/**
 * An entry with the live confirmations that it still holds, the person's
 * live keeps of it against a replacement Claude proposed, and the files
 * linked from it.
 * @param {Shower} shower @param {string} id @returns {Shown}
 */
function held(shower, id) {
  const { folded, show, assets } = shower;
  return { ...show(id), holds: holdsOf(folded, id).map(show), kept: keptOf(folded, id).map(show), assets: assets(id) };
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
 * its chain, its confirmations and its keeps; its moves, and its merges
 * each with its duplicate and whether it holds; and the current entries
 * standing elsewhere it relies on, merged into by a merge that holds, or
 * that answer its questions.
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
 * A question's answer as its map row shows it: whose and how given, where,
 * and what, and what the late one-decision check found of it, where it
 * found anything.
 * @param {Shower} shower @param {string} answer
 */
function rowAnswer({ show }, answer) {
  const { id, unit, topic, by, given, text, late_check: lateCheck } = show(answer);
  return { id, unit, topic, by, given, text, ...(lateCheck === undefined ? {} : { late_check: lateCheck }) };
}

/**
 * A map row's head: its question's id, text, whose and when; on the row of
 * an answer no current question answers, the answer as a row shows one,
 * and when.
 * @param {Shower} shower @param {MapRow} row
 */
function rowHead(shower, row) {
  const { id, text, by, at } = shower.show(row.id);
  return row.stands === 'question-set-aside' ? { ...rowAnswer(shower, row.id), at } : { id, text, by, at };
}

/**
 * The questions the unit's experiments measure, none abandoned, by the
 * first entry of each question's chain, with the experiment's id and
 * whether it still runs: a question the ledger lacks is passed over.
 * @param {Folded} folded @param {string} root @param {string} unit
 * @returns {Map<string, {experiment: string, running: boolean}>}
 */
function waitingOn(folded, root, unit) {
  const manifest = /** @type {Record<string, any>} */ (manifestOf(root, unit));
  return new Map(experimentWaits(manifest).filter(({ question }) => folded.facts.has(question))
    .map(({ experiment, question, running }) => [factsOf(folded, question).root, { experiment, running }]));
}

/**
 * `ledger map`: a topic's questions, each with where it stands and its
 * current answers, and an open one an experiment measures marked waiting
 * on it.
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerMap(shower, { unit, topic }, root) {
  const rows = mapOf(shower.folded, /** @type {string} */ (unit), /** @type {string} */ (topic));
  const waiting = waitingOn(shower.folded, root, /** @type {string} */ (unit));
  return {
    unit,
    topic,
    live: shower.folded.live(/** @type {string} */ (unit), topic) === null,
    questions: rows.map((row) => ({
      ...rowHead(shower, row),
      stands: row.stands,
      moved_from: row.moved_from,
      moved_to: row.moved_to,
      stands_in: row.stands_in,
      part_of: row.part_of === null ? null : shower.short(row.part_of),
      parts: row.parts.map(shower.short),
      answers: row.answers.map((answer) => rowAnswer(shower, answer)),
      waiting_on: row.stands === 'open' ? waiting.get(factsOf(shower.folded, row.id).root) ?? null : null,
    })),
  };
}

/** `ledger product`: the product record, each entry with its chain, its confirmations and its keeps. @param {Shower} shower */
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
  affected: { usage: 'ledger affected <work-unit> [<topic>]', names: [1, 2], answer: answerAffected },
  since: { usage: 'ledger since <work-unit> [<topic>]', names: [1, 2], answer: answerSince },
  shown: { usage: 'ledger shown <work-unit> [<topic>]', names: [1, 2], answer: answerShown },
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
 * `answer`, given the shower over the ledger at `root`, folded in one
 * streamed pass and read against liveness; what a landing its check
 * finished said pushed to `warnings`.
 * @template T
 * @param {string} root @param {string[]} warnings @param {(shower: Shower) => T} answer
 * @returns {T}
 */
function readShown(root, warnings, answer) {
  const live = liveness(root);
  return readFolded(root, ID_FACTS, warnings, (facts, entryAt) => answer(showerOf({ facts, live }, entryAt)));
}

/**
 * `ledger <record|map|product|affected|since|shown>`: the projection read,
 * as JSON, and as warnings what a landing its check finished said, and what
 * the read said on the way.
 * @param {string} cwd @param {string} verb @param {string[]} args
 * @returns {Record<string, unknown>}
 */
function readLedgerVerb(cwd, verb, args) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const root = stateRoot(cwd);
    const place = namedPlace(root, verb, args);
    const answer = readShown(root, warnings, (shower) => READS[verb].answer(shower, place, root, warnings));
    return warnings.length > 0 ? { ...answer, warnings } : answer;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { LEDGER_READ_USAGE, READ_VERBS: Object.keys(READS), readLedgerVerb, readShown, answerMap };
