'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's folds (5.8.1, 5.8.2). What is read from the
// ledger is worked out from it in one streamed pass: the ledger checked and
// read a line at a time (ledger.cjs), never held whole (5.7.6, 5.7.8), each
// event folded in order into a state that answers what its reader asks.
//
// The fold keeps, of each id the ledger holds, what the reads decide by and
// never what they show: the event that wrote it; the kind of entry it is, a
// replacement taking the kind it stands for, or none for an event that is no
// entry; its unit, and its topic — for a question, the topic it was last
// moved to (5.3.3); its links; every entry linking back to it — the
// replacements naming it, the merge that took it as a duplicate, the entries
// answering it, the merges and moves of it, the questions part of it
// (5.3.11), the confirmations that it still holds; what the late
// one-decision check last found of a decision that landed unchecked
// (16.19.8); and where its line sits, so a read shows an entry by reading
// that one line again.
//
// Read against liveness, the state answers:
// - Whether an entry is current, by one rule (5.8.17, 5.3.13): nothing has
//   replaced it, no merge took it as a duplicate (5.5.4: the same decision
//   is one entry, never a second), and its topic and unit are live
//   (ledger-units.cjs). A write's link that must be current and every read
//   decide by it alone.
// - A question's current answer (5.3.13): every entry naming it that is
//   current, so a replaced sibling never touches the others.
// - The current form of an entry: the current entries its chain leads to,
//   down every replacement, and through a merge to the entry the duplicate
//   was merged into.
// - The chain (5.6.5): the entries a replacement replaced, newest first.
// - A topic's map (5.8.5): its questions and where each stands.
// - A record: the current entries of a unit or a topic, its moves and its
//   merges, and the other topics' current entries it relies on (5.8.4).
// - The product record: the current entries marked product-wide (5.8.6).
// ---------------------------------------------------------------------------

const { withLedger } = require('./ledger.cjs');
const { entryKind } = require('./ledger-events.cjs');

/** @typedef {import('./ledger.cjs').EntryPlace} EntryPlace */
/** @typedef {import('./ledger-events.cjs').EntryKind} EntryKind */

/**
 * A fold over the ledger: the state it starts from, and how each event, in
 * the ledger's order, moves it on, given where its line sits.
 * @template S @typedef {{start: () => S, step: (state: S, event: Record<string, unknown>, place: EntryPlace) => void}} Fold
 */

/**
 * What the ledger says of one id.
 * @typedef {{
 *   event: string,
 *   kind: EntryKind|null,
 *   unit: string,
 *   topic: string|null,
 *   place: EntryPlace,
 *   answers: string|null,
 *   part_of: string|null,
 *   relies_on: readonly string[],
 *   replaces: string|null,
 *   product_wide: boolean|null,
 *   question: string|null,
 *   to: string|null,
 *   into: string|null,
 *   duplicate: string|null,
 *   entry: string|null,
 *   replaced_by: readonly string[],
 *   merged_by: string|null,
 *   answered_by: readonly string[],
 *   merges: readonly string[],
 *   moves: readonly string[],
 *   parts: readonly string[],
 *   holds: readonly string[],
 *   late_check: 'one'|'several'|null,
 * }} IdFacts
 */

/** A list of the ids linking back to an id. @typedef {'replaced_by'|'answered_by'|'merges'|'moves'|'parts'|'holds'} BackLinks */

/** Why an entry of a unit and topic is not live, null where it is (ledger-units.cjs). @typedef {(unit: string, topic: string|null) => string|null} Liveness */

/** The folded ledger read against liveness. @typedef {{facts: Map<string, IdFacts>, live: Liveness}} Folded */

/**
 * Why an entry is not current: the first replacement naming it, the merge
 * that took it as a duplicate, or why its topic or unit is not live.
 * @typedef {{replaced_by: string}|{merged_by: string}|{dead: string}} NotCurrent
 */

/** The section of a record each kind of entry is shown in. @type {Readonly<Record<EntryKind, 'questions'|'findings'|'decisions'>>} */
const SECTIONS = Object.freeze({ question: 'questions', finding: 'findings', decision: 'decisions' });

/** No ids: the one list every id's links start from, since most stay empty. @type {readonly string[]} */
const NONE = Object.freeze([]);

/** @param {unknown} value @returns {string|null} */
function idOrNull(value) {
  return typeof value === 'string' ? value : null;
}

/**
 * `id` linked back from the id `event[field]` names, on its list `back`.
 * @param {Map<string, IdFacts>} facts @param {Record<string, unknown>} event @param {string} field
 * @param {BackLinks} back @param {string} id
 */
function linkBack(facts, event, field, back, id) {
  const named = /** @type {IdFacts} */ (facts.get(/** @type {string} */ (event[field])));
  named[back] = [...named[back], id];
}

/** The facts of every id, by id, in the ledger's order. @type {Fold<Map<string, IdFacts>>} */
const ID_FACTS = {
  start: () => new Map(),
  step: (facts, event, place) => {
    const id = /** @type {string} */ (event.id);
    const kind = entryKind(event);
    facts.set(id, {
      event: /** @type {string} */ (event.event),
      kind,
      unit: /** @type {string} */ (event.unit),
      topic: idOrNull(event.topic),
      place,
      answers: idOrNull(event.answers),
      part_of: idOrNull(event.part_of),
      relies_on: Array.isArray(event.relies_on) && event.relies_on.length > 0 ? event.relies_on : NONE,
      replaces: idOrNull(event.replaces),
      product_wide: typeof event.product_wide === 'boolean' ? event.product_wide : null,
      question: idOrNull(event.question),
      to: idOrNull(event.to),
      into: idOrNull(event.into),
      duplicate: idOrNull(event.duplicate),
      entry: idOrNull(event.entry),
      replaced_by: NONE,
      merged_by: null,
      answered_by: NONE,
      merges: NONE,
      moves: NONE,
      parts: NONE,
      holds: NONE,
      late_check: null,
    });
    if (kind === 'decision') linkBack(facts, event, 'answers', 'answered_by', id);
    if (kind === 'question' && event.part_of !== null) linkBack(facts, event, 'part_of', 'parts', id);
    if (event.event === 'replaced') linkBack(facts, event, 'replaces', 'replaced_by', id);
    if (event.event === 'still-holds') linkBack(facts, event, 'entry', 'holds', id);
    if (event.event === 'moved') {
      linkBack(facts, event, 'question', 'moves', id);
      /** @type {IdFacts} */ (facts.get(/** @type {string} */ (event.question))).topic = /** @type {string} */ (event.to);
    }
    if (event.event === 'merged') {
      linkBack(facts, event, 'question', 'merges', id);
      if (event.duplicate !== null) /** @type {IdFacts} */ (facts.get(/** @type {string} */ (event.duplicate))).merged_by ??= id;
    }
    if (event.event === 'checked') {
      /** @type {IdFacts} */ (facts.get(/** @type {string} */ (event.entry))).late_check = /** @type {'one'|'several'} */ (event.rules);
    }
  },
};

/**
 * `answer` given the ledger folded by `fold` in one streamed pass, and the
 * entry at any place read again, the file held open between.
 * @template S, T
 * @param {string} root @param {Fold<S>} fold
 * @param {string[]} notes what a landing the read's check finished said, pushed to
 * @param {(state: S, entryAt: (place: EntryPlace) => Record<string, unknown>) => T} answer
 * @returns {T}
 */
function readFolded(root, fold, notes, answer) {
  return withLedger(root, notes, (ledger) => {
    const state = fold.start();
    for (const { event, place } of ledger.entries()) fold.step(state, event, place);
    return answer(state, ledger.entryAt);
  });
}

/**
 * The ledger folded by `fold`, in one streamed pass.
 * @template S
 * @param {string} root @param {Fold<S>} fold
 * @param {string[]} notes what a landing the read's check finished said, pushed to
 * @returns {S}
 */
function foldLedger(root, fold, notes) {
  return readFolded(root, fold, notes, (state) => state);
}

/** What the folded ledger says of an id it holds. @param {Folded} folded @param {string} id @returns {IdFacts} */
function factsOf({ facts }, id) {
  return /** @type {IdFacts} */ (facts.get(id));
}

/**
 * Why the entry `id` is not current, or null where it is (5.8.17, 5.3.13).
 * @param {Folded} folded @param {string} id
 * @returns {NotCurrent|null}
 */
function notCurrent(folded, id) {
  const facts = factsOf(folded, id);
  if (facts.replaced_by.length > 0) return { replaced_by: facts.replaced_by[0] };
  if (facts.merged_by !== null) return { merged_by: facts.merged_by };
  const dead = folded.live(facts.unit, facts.topic);
  return dead === null ? null : { dead };
}

/** Whether `id` is a current entry. @param {Folded} folded @param {string} id */
function isCurrent(folded, id) {
  return factsOf(folded, id).kind !== null && notCurrent(folded, id) === null;
}

/**
 * The current entries `id`'s chain leads to: itself while current; else
 * those of every replacement naming it, or of the entry a merge took it into
 * as a duplicate; none where it leads nowhere current.
 * @param {Folded} folded @param {string} id @param {Set<string>} [seen]
 * @returns {string[]}
 */
function currentsOf(folded, id, seen = new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  if (isCurrent(folded, id)) return [id];
  const facts = factsOf(folded, id);
  const next = facts.replaced_by.length > 0 ? facts.replaced_by : facts.merged_by === null ? [] : [/** @type {string} */ (factsOf(folded, facts.merged_by).into)];
  return [...new Set(next.flatMap((n) => currentsOf(folded, n, seen)))];
}

/**
 * The entries a replacement replaced: the one it names, then each that one
 * replaced, back down its chain — newest first, oldest last.
 * @param {Folded} folded @param {string} id
 * @returns {string[]}
 */
function replacedChain(folded, id) {
  const replaced = factsOf(folded, id).replaces;
  return replaced === null ? [] : [replaced, ...replacedChain(folded, replaced)];
}

/** A question's current answer: every entry naming it that is current (5.3.13). @param {Folded} folded @param {string} question */
function currentAnswer(folded, question) {
  return factsOf(folded, question).answered_by.filter((id) => isCurrent(folded, id));
}

/**
 * Where a question stands on its map: open, answered, merged — answered by
 * the entry another topic holds, which a merge took it into (5.5.5) — or
 * moved away to another topic.
 * @typedef {'open'|'answered'|'merged'|'moved-away'} Stands
 */

/**
 * A row of a topic's map: the question; where it stands; for one moved
 * away, the topic it moved to, and for one moved in, the topic it came from;
 * its current answers, its own and those a merge resolves to; and the
 * question it is part of and the current questions part of it (5.3.11).
 * @typedef {{id: string, stands: Stands, moved_from: string|null, moved_to: string|null, answers: string[], part_of: string|null, parts: string[]}} MapRow
 */

/** The topic a move was made from: the topic it was written on. @param {Folded} folded @param {string} move */
function movedFrom(folded, move) {
  return /** @type {string} */ (factsOf(folded, move).topic);
}

/**
 * A question standing on the map, as its row.
 * @param {Folded} folded @param {string} id
 * @returns {MapRow}
 */
function standingRow(folded, id) {
  const facts = factsOf(folded, id);
  const own = currentAnswer(folded, id);
  const merged = [...new Set(facts.merges.flatMap((m) => currentsOf(folded, /** @type {string} */ (factsOf(folded, m).into))))];
  const lastMove = facts.moves.at(-1);
  return {
    id,
    stands: merged.length > 0 ? 'merged' : own.length > 0 ? 'answered' : 'open',
    moved_from: lastMove === undefined ? null : movedFrom(folded, lastMove),
    moved_to: null,
    answers: [...new Set([...own, ...merged])],
    part_of: facts.part_of,
    parts: facts.parts.filter((part) => isCurrent(folded, part)),
  };
}

/**
 * A topic's map (5.8.5): every current question standing on it, and every
 * question moved away from it, where it went, in the ledger's order. None on
 * a topic that is not live.
 * @param {Folded} folded @param {string} unit @param {string} topic
 * @returns {MapRow[]}
 */
function mapOf(folded, unit, topic) {
  if (folded.live(unit, topic) !== null) return [];
  /** @type {MapRow[]} */
  const rows = [];
  for (const [id, facts] of folded.facts) {
    if (facts.kind !== 'question' || facts.unit !== unit) continue;
    if (facts.topic === topic) {
      if (isCurrent(folded, id)) rows.push(standingRow(folded, id));
      continue;
    }
    const away = facts.moves.filter((m) => movedFrom(folded, m) === topic).at(-1);
    if (away !== undefined) {
      rows.push({ id, stands: 'moved-away', moved_from: null, moved_to: factsOf(folded, away).to, answers: [], part_of: facts.part_of, parts: [] });
    }
  }
  return rows;
}

/**
 * What a record shows, by id: its current questions, findings and
 * decisions; the moves and merges made on it; and the current entries
 * outside it that its entries rely on or its merges went into (5.8.4), each
 * with the ids it was named by.
 * @typedef {{
 *   questions: string[], findings: string[], decisions: string[],
 *   moved: string[], merged: string[],
 *   other_topics: {id: string, named: string[]}[],
 * }} RecordIds
 */

/**
 * The record of a unit, or of one of its topics: what it shows, by id.
 * Nothing on a unit or topic that is not live.
 * @param {Folded} folded @param {string} unit @param {string|null} topic null for every entry of the unit
 * @returns {RecordIds}
 */
function recordOf(folded, unit, topic) {
  /** @type {RecordIds} */
  const record = { questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [] };
  if (folded.live(unit, topic) !== null) return record;
  const within = (/** @type {IdFacts} */ facts) => facts.unit === unit && (topic === null || facts.topic === topic);
  /** @type {Map<string, string[]>} */
  const outside = new Map();
  const refer = (/** @type {string} */ named) => {
    for (const id of currentsOf(folded, named)) {
      if (within(factsOf(folded, id))) continue;
      const names = outside.get(id) ?? [];
      if (!names.includes(named)) names.push(named);
      outside.set(id, names);
    }
  };
  for (const [id, facts] of folded.facts) {
    if (!within(facts)) continue;
    if (facts.event === 'moved') record.moved.push(id);
    if (facts.event === 'merged') {
      record.merged.push(id);
      refer(/** @type {string} */ (facts.into));
    }
    if (facts.kind === null || !isCurrent(folded, id)) continue;
    record[SECTIONS[facts.kind]].push(id);
    for (const relied of facts.relies_on) refer(relied);
  }
  record.other_topics = [...outside].map(([id, named]) => ({ id, named }));
  return record;
}

/**
 * The product record (5.8.6): every current entry marked product-wide, its
 * findings and its decisions, by id.
 * @param {Folded} folded
 * @returns {{findings: string[], decisions: string[]}}
 */
function productOf(folded) {
  /** @type {{findings: string[], decisions: string[]}} */
  const product = { findings: [], decisions: [] };
  for (const [id, facts] of folded.facts) {
    if (facts.product_wide !== true || !isCurrent(folded, id)) continue;
    if (facts.kind === 'finding') product.findings.push(id);
    if (facts.kind === 'decision') product.decisions.push(id);
  }
  return product;
}

module.exports = {
  ID_FACTS, readFolded, foldLedger, factsOf, notCurrent, isCurrent, currentsOf, replacedChain, currentAnswer, mapOf, recordOf, productOf,
};
