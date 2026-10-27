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
// entry; its unit and topic — a question's every wording taking the topic it
// was last moved to (5.3.3); the first entry of its chain; its links; every
// entry linking back to it — the replacements naming it, the merges that
// took it as a duplicate, the entries answering it, the merges of it, the
// questions part of it (5.3.11), the confirmations that it still holds, and
// on the first entry of a question's chain, the moves of any wording; and
// where its line sits, so a read shows an entry by reading that one line
// again.
//
// Read against liveness, the state answers:
// - Whether an entry is live: its own unit and topic are (ledger-units.cjs).
// - Whether an entry is current, by one rule (5.8.17, 5.3.13): it is live,
//   no live entry replaces it, and no merge that holds took it as a
//   duplicate. A merge holds while it is live and the entry it went into,
//   followed down its chain, has a current form (5.5.4, 5.5.5). So a
//   replacement or a merge whose topic or unit is set aside counts for
//   nothing while it is, and what it replaced or merged away stands again;
//   the ledger keeps every line. A write's link that must be current and
//   every read decide by this rule alone.
// - The current form of an entry: the current entries its chain leads to,
//   down every live replacement, and through a merge that holds to the entry
//   the duplicate was merged into.
// - Where an entry stands: where the first entry of its chain stood, as a
//   question stands where it was last moved, however and wherever a later
//   entry of the chain was written.
// - A question's current answer: every current entry naming it or any
//   earlier wording of it, so a replaced sibling never touches the others
//   and a rewording keeps its answers (5.3.13).
// - The chain (5.6.5): the entries a current one replaced, newest first,
//   down to the first that is not live, as though it were not there.
// - A topic's map (5.8.5): its questions, where each stands, and the
//   answers to each, its current answer and what its merges resolve to —
//   which the topic's record shows too.
// - A record: the current entries standing in a unit or a topic, the moves
//   and merges made there while live, and the current entries standing
//   elsewhere that its entries rely on, its merges went into, or that answer
//   its questions (5.8.4).
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
 *   root: string,
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
 *   merged_by: readonly string[],
 *   answered_by: readonly string[],
 *   merges: readonly string[],
 *   moves: readonly string[],
 *   parts: readonly string[],
 *   holds: readonly string[],
 * }} IdFacts
 */

/** A list of the ids linking back to an id. @typedef {'replaced_by'|'merged_by'|'answered_by'|'merges'|'moves'|'parts'|'holds'} BackLinks */

/** Why an entry of a unit and topic is not live, null where it is (ledger-units.cjs). @typedef {(unit: string, topic: string|null) => string|null} Liveness */

/** The folded ledger read against liveness. @typedef {{facts: Map<string, IdFacts>, live: Liveness}} Folded */

/** Where an entry stands: a unit, and a topic or none at the unit's level. @typedef {{unit: string, topic: string|null}} Standing */

/**
 * Why an entry is not current: a live replacement naming it, a merge that
 * holds and took it as a duplicate, or why its topic or unit is not live.
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

/** @param {Map<string, IdFacts>} facts @param {unknown} id @returns {IdFacts} */
function named(facts, id) {
  return /** @type {IdFacts} */ (facts.get(/** @type {string} */ (id)));
}

/**
 * `id` linked back from the id `to` names, on its list `back`.
 * @param {Map<string, IdFacts>} facts @param {unknown} to @param {BackLinks} back @param {string} id
 */
function linkBack(facts, to, back, id) {
  const linked = named(facts, to);
  linked[back] = [...linked[back], id];
}

/**
 * A move: the moved question's every wording back down its chain, its unit's
 * own, now standing on the topic it moved to; the move kept on the chain's
 * first entry.
 * @param {Map<string, IdFacts>} facts @param {Record<string, unknown>} event
 */
function moveQuestion(facts, event) {
  for (let id = idOrNull(event.question); id !== null; id = named(facts, id).replaces) {
    const wording = named(facts, id);
    if (wording.unit === event.unit) wording.topic = /** @type {string} */ (event.to);
  }
  linkBack(facts, named(facts, event.question).root, 'moves', /** @type {string} */ (event.id));
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
      root: event.event === 'replaced' ? named(facts, event.replaces).root : id,
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
      merged_by: NONE,
      answered_by: NONE,
      merges: NONE,
      moves: NONE,
      parts: NONE,
      holds: NONE,
    });
    if (kind === 'decision') linkBack(facts, event.answers, 'answered_by', id);
    if (kind === 'question' && event.part_of !== null) linkBack(facts, event.part_of, 'parts', id);
    if (event.event === 'replaced') linkBack(facts, event.replaces, 'replaced_by', id);
    if (event.event === 'still-holds') linkBack(facts, event.entry, 'holds', id);
    if (event.event === 'moved') moveQuestion(facts, event);
    if (event.event === 'merged') {
      linkBack(facts, event.question, 'merges', id);
      if (event.duplicate !== null) linkBack(facts, event.duplicate, 'merged_by', id);
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
  return named(facts, id);
}

/** Where `id` stands: where the first entry of its chain stands. @param {Folded} folded @param {string} id @returns {Standing} */
function standingOf(folded, id) {
  const first = factsOf(folded, factsOf(folded, id).root);
  return { unit: first.unit, topic: first.topic };
}

/** Whether `id`'s own unit and topic are live. @param {Folded} folded @param {string} id */
function isLive(folded, id) {
  const facts = factsOf(folded, id);
  return folded.live(facts.unit, facts.topic) === null;
}

/**
 * Whether each merge holds, as worked out for one folded ledger. A merge
 * asked after while its own answer is still being worked out reads as not
 * holding, so merges crossing each other end.
 * @type {WeakMap<Folded, Map<string, boolean>>}
 */
const MERGES_HOLDING = new WeakMap();

/**
 * Whether a merge holds: it is live, and the entry it went into, followed
 * down its chain, has a current form.
 * @param {Folded} folded @param {string} merge
 */
function mergeHolds(folded, merge) {
  let known = MERGES_HOLDING.get(folded);
  if (known === undefined) MERGES_HOLDING.set(folded, (known = new Map()));
  const answer = known.get(merge);
  if (answer !== undefined) return answer;
  known.set(merge, false);
  const holds = isLive(folded, merge) && currentsOf(folded, /** @type {string} */ (factsOf(folded, merge).into)).length > 0;
  known.set(merge, holds);
  return holds;
}

/**
 * Why the entry `id` is not current, or null where it is (5.8.17, 5.3.13).
 * @param {Folded} folded @param {string} id
 * @returns {NotCurrent|null}
 */
function notCurrent(folded, id) {
  const facts = factsOf(folded, id);
  const replacer = facts.replaced_by.find((r) => isLive(folded, r));
  if (replacer !== undefined) return { replaced_by: replacer };
  const merge = facts.merged_by.find((m) => mergeHolds(folded, m));
  if (merge !== undefined) return { merged_by: merge };
  const dead = folded.live(facts.unit, facts.topic);
  return dead === null ? null : { dead };
}

/** Whether `id` is a current entry. @param {Folded} folded @param {string} id */
function isCurrent(folded, id) {
  return factsOf(folded, id).kind !== null && notCurrent(folded, id) === null;
}

/**
 * The current entries `id`'s chain leads to: itself while current; else
 * those of every live replacement naming it, or, while none does, of the
 * entry a merge that holds took it into as a duplicate; none where it leads
 * nowhere current.
 * @param {Folded} folded @param {string} id @param {Set<string>} [seen]
 * @returns {string[]}
 */
function currentsOf(folded, id, seen = new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  if (isCurrent(folded, id)) return [id];
  const facts = factsOf(folded, id);
  const replacers = facts.replaced_by.filter((r) => isLive(folded, r));
  const merge = facts.merged_by.find((m) => mergeHolds(folded, m));
  const next = replacers.length > 0 ? replacers : merge === undefined ? [] : [/** @type {string} */ (factsOf(folded, merge).into)];
  return [...new Set(next.flatMap((n) => currentsOf(folded, n, seen)))];
}

/**
 * The entries a replacement replaced, as its line names them: the one it
 * names, then each that one replaced, back down its chain — newest first,
 * oldest last.
 * @param {Folded} folded @param {string} id
 * @returns {string[]}
 */
function replacedChain(folded, id) {
  const replaced = factsOf(folded, id).replaces;
  return replaced === null ? [] : [replaced, ...replacedChain(folded, replaced)];
}

/**
 * The chain folded beneath a current entry (5.6.5): the entries it
 * replaced, newest first, down to the first that is not live, as though
 * that one were not there — what it replaced stands again on its own.
 * @param {Folded} folded @param {string} id
 * @returns {string[]}
 */
function foldedBeneath(folded, id) {
  const replaced = factsOf(folded, id).replaces;
  return replaced === null || !isLive(folded, replaced) ? [] : [replaced, ...foldedBeneath(folded, replaced)];
}

/** A question and its every earlier wording. @param {Folded} folded @param {string} question */
function wordingsOf(folded, question) {
  return [question, ...replacedChain(folded, question)];
}

/** @param {Folded} folded @param {Iterable<string>} ids the ids, in the ledger's order and once each */
function inLedgerOrder(folded, ids) {
  return [...new Set(ids)].sort((a, b) => factsOf(folded, a).place.number - factsOf(folded, b).place.number);
}

/**
 * A question's current answer (5.3.13): every current entry naming it or any
 * earlier wording of it.
 * @param {Folded} folded @param {string} question
 */
function currentAnswer(folded, question) {
  return inLedgerOrder(folded, wordingsOf(folded, question).flatMap((w) => factsOf(folded, w).answered_by).filter((id) => isCurrent(folded, id)));
}

/**
 * What the merges of a question resolve to: the current form of each entry
 * a merge that holds took it, or an earlier wording of it, into (5.5.5).
 * @param {Folded} folded @param {string} question
 */
function mergedAnswer(folded, question) {
  const merges = wordingsOf(folded, question).flatMap((w) => factsOf(folded, w).merges).filter((m) => mergeHolds(folded, m));
  return [...new Set(merges.flatMap((m) => currentsOf(folded, /** @type {string} */ (factsOf(folded, m).into))))];
}

/**
 * A question's answers, as its map row and every record show them alike:
 * its current answer, then what its merges resolve to.
 * @param {Folded} folded @param {string} question
 */
function answersOf(folded, question) {
  return [...new Set([...currentAnswer(folded, question), ...mergedAnswer(folded, question)])];
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
 * question it is part of, in its current wording, and the current questions
 * part of it (5.3.11).
 * @typedef {{id: string, stands: Stands, moved_from: string|null, moved_to: string|null, answers: string[], part_of: string|null, parts: string[]}} MapRow
 */

/** The topic a move was made from: the topic it was written on. @param {Folded} folded @param {string} move */
function movedFrom(folded, move) {
  return /** @type {string} */ (factsOf(folded, move).topic);
}

/**
 * The question a part is part of, in its current wording: the first current
 * form of the question it names, or that question where it has none.
 * @param {Folded} folded @param {string|null} whole
 */
function wholeOf(folded, whole) {
  return whole === null ? null : currentsOf(folded, whole)[0] ?? whole;
}

/**
 * A question standing on the map, as its row.
 * @param {Folded} folded @param {string} id
 * @returns {MapRow}
 */
function standingRow(folded, id) {
  const answers = answersOf(folded, id);
  const lastMove = factsOf(folded, factsOf(folded, id).root).moves.at(-1);
  const parts = wordingsOf(folded, id).flatMap((w) => factsOf(folded, w).parts).filter((part) => isCurrent(folded, part));
  return {
    id,
    stands: mergedAnswer(folded, id).length > 0 ? 'merged' : answers.length > 0 ? 'answered' : 'open',
    moved_from: lastMove === undefined ? null : movedFrom(folded, lastMove),
    moved_to: null,
    answers,
    part_of: wholeOf(folded, factsOf(folded, id).part_of),
    parts: inLedgerOrder(folded, parts),
  };
}

/** Whether `id` stands at `unit` and, given one, `topic`. @param {Folded} folded @param {string} id @param {string} unit @param {string|null} topic */
function standsAt(folded, id, unit, topic) {
  const standing = standingOf(folded, id);
  return standing.unit === unit && (topic === null || standing.topic === topic);
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
    if (facts.kind !== 'question') continue;
    if (standsAt(folded, id, unit, topic)) {
      if (isCurrent(folded, id)) rows.push(standingRow(folded, id));
      continue;
    }
    const away = facts.root === id ? facts.moves.filter((m) => factsOf(folded, m).unit === unit && movedFrom(folded, m) === topic).at(-1) : undefined;
    if (away !== undefined) {
      const moved = /** @type {string} */ (factsOf(folded, away).question);
      rows.push({ id: moved, stands: 'moved-away', moved_from: null, moved_to: factsOf(folded, away).to, answers: [], part_of: wholeOf(folded, factsOf(folded, moved).part_of), parts: [] });
    }
  }
  return rows;
}

/**
 * What a record shows, by id: its current questions, findings and
 * decisions; the moves and merges made on it; and the current entries
 * standing outside it that its entries rely on, its merges went into, or
 * that answer its questions (5.8.4), each with the ids of the record they
 * are tied to.
 * @typedef {{
 *   questions: string[], findings: string[], decisions: string[],
 *   moved: string[], merged: string[],
 *   other_topics: {id: string, named: string[]}[],
 * }} RecordIds
 */

/**
 * The record of a unit, or of one of its topics: what it shows, by id.
 * Nothing on a unit or topic that is not live, nor a move or merge made on
 * one.
 * @param {Folded} folded @param {string} unit @param {string|null} topic null for every entry of the unit
 * @returns {RecordIds}
 */
function recordOf(folded, unit, topic) {
  /** @type {RecordIds} */
  const record = { questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [] };
  if (folded.live(unit, topic) !== null) return record;
  /** @type {Map<string, string[]>} */
  const outside = new Map();
  const show = (/** @type {string[]} */ ids, /** @type {string} */ tie) => {
    for (const id of ids) {
      if (standsAt(folded, id, unit, topic)) continue;
      const ties = outside.get(id) ?? [];
      if (!ties.includes(tie)) ties.push(tie);
      outside.set(id, ties);
    }
  };
  for (const [id, facts] of folded.facts) {
    if (!standsAt(folded, id, unit, topic) || !isLive(folded, id)) continue;
    if (facts.event === 'moved') record.moved.push(id);
    if (facts.event === 'merged') {
      record.merged.push(id);
      show(currentsOf(folded, /** @type {string} */ (facts.into)), /** @type {string} */ (facts.into));
    }
    if (facts.kind === null || !isCurrent(folded, id)) continue;
    record[SECTIONS[facts.kind]].push(id);
    for (const relied of facts.relies_on) show(currentsOf(folded, relied), relied);
    if (facts.kind === 'question') show(answersOf(folded, id), id);
  }
  record.other_topics = [...outside].map(([id, named_]) => ({ id, named: named_ }));
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
  ID_FACTS, readFolded, foldLedger, factsOf, standingOf, isLive, notCurrent, isCurrent, currentsOf, replacedChain, foldedBeneath,
  currentAnswer, answersOf, mapOf, recordOf, productOf,
};
