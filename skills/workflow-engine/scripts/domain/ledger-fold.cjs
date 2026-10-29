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
// entry; who made it, and who moved whom; the unit and topic it was written
// on; the first entry of its chain; its links; every entry linking back to
// it — the replacements naming it, the merges that took it as a duplicate,
// the confirmations that it still holds, and on the first entry of a
// question's chain, the answers to, the parts of (5.3.11), the merges of and
// the moves of any wording; and where its line sits, so a read shows an
// entry by reading that one line again. It keeps one thing a read shows that
// the entry's line never holds: what the late one-decision check last found
// of a decision that landed unchecked (16.19.8).
//
// Read against liveness, the state answers:
// - Whether an event is live: the unit and topic it was made on are
//   (ledger-units.cjs). A move, made on the topic it moved from, is live
//   while its unit is: it hands the question to the topic it moved to, and
//   setting aside the topic it came from never takes that back. A
//   question's wording is made on the topic the last live move its unit
//   made of the question took it to (5.3.3), or where none is, the topic it
//   was written on.
// - A question's line (5.8.20): the live wordings of its chain, in the
//   ledger's order, read as one line. A wording set aside drops out of it;
//   one whose own predecessor is set aside reads as rewording the nearest
//   live wording before it; of two live rewordings of one wording, the
//   later replaces the earlier. The last is the question's wording, every
//   other live one an earlier wording of it, so a question is one entry
//   however its rewordings forked or were set aside. A wording set aside
//   reads as the nearest live wording it grew from, down its own chain.
// - Where an entry stands: in the unit and on the topic the earliest entry
//   of its chain made in a live place was made on — a question's, the
//   first wording of its line. Normally that is the first entry, however
//   and wherever a later entry of the chain was written; while the first
//   entry's place is set aside, the earliest live replacement stands where
//   it was made, so a current entry is always one a live record shows.
// - Where an entry is placed (5.8.19): where it stands, and where it was
//   made where that differs, so a later unit's replacement of an earlier
//   unit's decision shows in both. Every map, record and copy places an
//   entry by this one rule: its own where it stands, whole with its chain,
//   and another place's current answer where it was made. An answer shows
//   besides on the map of every question it answers; every place an entry
//   shows in is `showsIn`'s, which "since you last looked" reads.
// - Whether an entry is current, by one rule (5.8.17, 5.3.13): it is live,
//   no live entry replaces it — a question's wording read along its line,
//   so its last live wording alone is current — and no merge that holds
//   took it as a duplicate. A merge holds while it is live and the entry
//   it went into, followed down its chain, has a current form (5.5.4,
//   5.5.5). So a replacement or a merge whose topic or unit is set aside
//   counts for nothing while it is, and what it replaced or merged away
//   stands again; the ledger keeps every line. A write's link that must be
//   current and every read decide by this rule alone.
// - Which merges hold, worked out once for the whole ledger, so the answer
//   never turns on which entry is read first. From none holding, the latest
//   live merge that would still lead to a current entry once it held is
//   taken, again and again, until no other would; a merge that sets nothing
//   aside — it names no duplicate, or a live replacement sets its duplicate
//   aside already — then holds where it leads to a current entry. Merges
//   crossing each other, each duplicate the entry another went into, cannot
//   all hold: the later is taken first and holds, as a later replacement
//   wins — it was written while the earlier did not hold, and a reactivate
//   of the earlier never undoes it. Taking a merge never leaves one taken
//   before it leading nowhere.
// - The current form of an entry: the current entries its chain leads to,
//   down every live replacement, and through each merge that holds to the
//   entry the duplicate was merged into; and the live replacements met on
//   the way, which are what changed it, the latest last. A question's
//   wording's, along its line: the question's wording, and the live
//   wordings after the nearest live one it grew from — every live wording
//   where none is.
// - A question's current answer: every current entry naming any wording of
//   it, earlier or later, standing or set aside, so a replaced sibling never
//   touches the others, a rewording keeps its answers (5.3.13), and an
//   answer to a wording set aside answers the one that stands again
//   (5.8.17). What a question's merges resolve to answers it too, a merge
//   of any wording alike.
// - The chain (5.6.5): the entries a current one replaced, newest first,
//   down to the first that is not live, as though it were not there; a
//   question's, the earlier wordings of its line.
// - A topic's map (5.8.5): its questions, where each stands, and the
//   answers to each, its current answer and what its merges resolve to —
//   which the topic's record shows too. A map shows where a question stands
//   now: one moved in, the topic it came from while that is live; one moved
//   away, in its current wording, the topic it stands on now — each only by
//   a live move the map's unit made, while the question is current and
//   stands in that unit. Any other question standing elsewhere that was
//   made on the topic, or that an answer placed on the topic answers, shows
//   as standing elsewhere. A row of a question standing off the topic shows
//   the answers placed on the topic that no question standing on it shows.
//   A current answer placed on the topic that no current question answers
//   — every wording of its question set aside, and no merge that holds
//   leading another question to it — is a row of its own, headed by itself,
//   as the record shows it, saying where it stands where that is another
//   place; so a map shows every current answer placed on its topic, and a
//   question that stands is never shown open while an answer to any of its
//   wordings is current.
// - A record: the current entries standing in a unit or a topic, the moves
//   and merges made there while live, and the current entries standing
//   elsewhere that were made there, that its entries rely on, that its
//   merges that hold went into, or that answer its questions (5.8.4); of an
//   entry's confirmations, the live ones. Its moves are history, each as it
//   was made, so they can differ from what its map shows: the question may
//   stand elsewhere now, or not be current.
//   A unit's own level has a record of its own: the entries standing in the
//   unit on no topic. Every place's record is built in one pass, each id's
//   places worked out once.
// - The product record: the current entries marked product-wide (5.8.6).
// - Whether the ledger names a topic: an event written on it, or a move to
//   it, live or not. The ledger keeps every line (5.3.4), so a topic it
//   names keeps its name for good.
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
 *   by: string|null,
 *   who_moved_whom: string|null,
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
 *   after: string|null,
 *   replaced_by: readonly string[],
 *   merged_by: readonly string[],
 *   answered_by: readonly string[],
 *   merges: readonly string[],
 *   moves: readonly string[],
 *   parts: readonly string[],
 *   holds: readonly string[],
 *   late_check: 'one'|'several'|null,
 * }} IdFacts
 */

/** A list of the ids linking back to an id. @typedef {'replaced_by'|'merged_by'|'answered_by'|'merges'|'moves'|'parts'|'holds'} BackLinks */

/** Why an entry of a unit and topic is not live, null where it is (ledger-units.cjs). @typedef {(unit: string, topic: string|null) => string|null} Liveness */

/** The folded ledger read against liveness. @typedef {{facts: Map<string, IdFacts>, live: Liveness}} Folded */

/** Where an entry stands, or was made: a unit, and a topic or none at the unit's level. @typedef {{unit: string, topic: string|null}} Standing */

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
 * The first entry of the chain of the entry `id` names: a question's, the
 * question every wording of it is, standing or set aside.
 * @param {Map<string, IdFacts>} facts @param {unknown} id @returns {string}
 */
function chainRoot(facts, id) {
  return named(facts, id).root;
}

/**
 * `id` linked back from the id `to` names, appended to its list `back`; a
 * list still the shared empty one taking a list of its own.
 * @param {Map<string, IdFacts>} facts @param {unknown} to @param {BackLinks} back @param {string} id
 */
function linkBack(facts, to, back, id) {
  const linked = named(facts, to);
  if (linked[back] === NONE) linked[back] = [id];
  else /** @type {string[]} */ (linked[back]).push(id);
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
      by: typeof event.by === 'string' ? event.by : null,
      who_moved_whom: typeof event.who_moved_whom === 'string' ? event.who_moved_whom : null,
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
      after: idOrNull(event.after),
      replaced_by: NONE,
      merged_by: NONE,
      answered_by: NONE,
      merges: NONE,
      moves: NONE,
      parts: NONE,
      holds: NONE,
      late_check: null,
    });
    if (kind === 'decision') linkBack(facts, chainRoot(facts, event.answers), 'answered_by', id);
    if (kind === 'question' && event.part_of !== null) linkBack(facts, chainRoot(facts, event.part_of), 'parts', id);
    if (event.event === 'replaced') linkBack(facts, event.replaces, 'replaced_by', id);
    if (event.event === 'still-holds') linkBack(facts, event.entry, 'holds', id);
    if (event.event === 'moved') linkBack(facts, chainRoot(facts, event.question), 'moves', id);
    if (event.event === 'merged') {
      linkBack(facts, chainRoot(facts, event.question), 'merges', id);
      if (event.duplicate !== null) linkBack(facts, event.duplicate, 'merged_by', id);
    }
    if (event.event === 'checked') named(facts, event.entry).late_check = /** @type {'one'|'several'} */ (event.rules);
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

/**
 * Whether an event of the ledger names `topic` of `unit`: one written on
 * it, or a move to it.
 * @param {string} root @param {string} unit @param {string} topic
 * @param {string[]} notes what a landing the read's check finished said, pushed to
 */
function namesTopic(root, unit, topic, notes) {
  return foldLedger(root, {
    start: () => ({ named: false }),
    step: (state, event) => {
      state.named ||= event.unit === unit && (event.topic === topic || event.to === topic);
    },
  }, notes).named;
}

/** What the folded ledger says of an id it holds. @param {Folded} folded @param {string} id @returns {IdFacts} */
function factsOf({ facts }, id) {
  return named(facts, id);
}

/**
 * The live moves `unit` made of the question whose chain starts at `root`,
 * in the ledger's order.
 * @param {Folded} folded @param {string} root @param {string} unit
 */
function liveMovesBy(folded, root, unit) {
  return factsOf(folded, root).moves.filter((move) => factsOf(folded, move).unit === unit && isLive(folded, move));
}

/**
 * The unit and topic `id` was made on: the ones it was written on, but a
 * question's wording, made on the topic the last live move its unit made of
 * the question took it to, where there is one (5.3.3).
 * @param {Folded} folded @param {string} id
 * @returns {Standing}
 */
function madeOn(folded, id) {
  const { unit, topic, root } = factsOf(folded, id);
  const move = liveMovesBy(folded, root, unit).at(-1);
  return { unit, topic: move === undefined ? topic : factsOf(folded, move).to };
}

/**
 * Why `id` is not live — the unit or topic it was made on set aside, of a
 * move its unit alone — or null where it is.
 * @param {Folded} folded @param {string} id
 */
function whyDead(folded, id) {
  const facts = factsOf(folded, id);
  if (facts.event === 'moved') return folded.live(facts.unit, null);
  const { unit, topic } = madeOn(folded, id);
  return folded.live(unit, topic);
}

/** Whether `id` is live. @param {Folded} folded @param {string} id */
function isLive(folded, id) {
  return whyDead(folded, id) === null;
}

/** Whether `id` is a question's wording, read along its line. @param {Folded} folded @param {string} id */
function isWording(folded, id) {
  return factsOf(folded, id).kind === 'question';
}

/**
 * Each question's line, by the first wording of its chain, as worked out
 * for one folded ledger.
 * @type {WeakMap<Folded, Map<string, string[]>>}
 */
const LINES = new WeakMap();

/**
 * The line of the question `id` is a wording of (5.8.20): the live
 * wordings of its chain, in the ledger's order — none where every one is
 * set aside. Every read of a question's wordings goes by it.
 * @param {Folded} folded @param {string} id
 * @returns {readonly string[]}
 */
function lineOf(folded, id) {
  let known = LINES.get(folded);
  if (known === undefined) {
    known = new Map();
    for (const [entry, facts] of folded.facts) {
      if (facts.kind !== 'question' || !isLive(folded, entry)) continue;
      const line = known.get(facts.root);
      if (line === undefined) known.set(facts.root, [entry]);
      else line.push(entry);
    }
    LINES.set(folded, known);
  }
  return known.get(factsOf(folded, id).root) ?? NONE;
}

/**
 * A question's wording: the last live wording of its line, or null where
 * every one is set aside.
 * @param {Folded} folded @param {string} id any wording of it
 * @returns {string|null}
 */
function wordingOf(folded, id) {
  return lineOf(folded, id).at(-1) ?? null;
}

/**
 * The live wordings of `id`'s line after the nearest live wording it grew
 * from, down its own chain — itself while live — in the ledger's order;
 * every live wording where none is.
 * @param {Folded} folded @param {string} id
 * @returns {string[]}
 */
function wordingsAfter(folded, id) {
  let from = /** @type {string|null} */ (id);
  while (from !== null && !isLive(folded, from)) from = factsOf(folded, from).replaces;
  const line = lineOf(folded, id);
  if (from === null) return [...line];
  const at = factsOf(folded, from).place.number;
  return line.filter((wording) => factsOf(folded, wording).place.number > at);
}

/**
 * Where each id stands, as worked out for one folded ledger.
 * @type {WeakMap<Folded, Map<string, Standing>>}
 */
const STANDINGS = new WeakMap();

/**
 * The earliest entry of `id`'s chain made in a live place — a question's,
 * the first wording of its line — or, where none is, its first.
 * @param {Folded} folded @param {string} id
 * @returns {string}
 */
function earliestLive(folded, id) {
  const { root } = factsOf(folded, id);
  if (isWording(folded, id)) return lineOf(folded, id)[0] ?? root;
  let earliest = root;
  for (let at = /** @type {string|null} */ (id); at !== null; at = factsOf(folded, at).replaces) if (isLive(folded, at)) earliest = at;
  return earliest;
}

/**
 * Where `id` stands: where the earliest entry of its chain made in a live
 * place was made; where none is, where the first was.
 * @param {Folded} folded @param {string} id
 * @returns {Standing}
 */
function standingOf(folded, id) {
  let known = STANDINGS.get(folded);
  if (known === undefined) STANDINGS.set(folded, known = new Map());
  let standing = known.get(id);
  if (standing === undefined) known.set(id, standing = madeOn(folded, earliestLive(folded, id)));
  return standing;
}

/** @param {Standing} a @param {Standing} b */
function samePlace(a, b) {
  return a.unit === b.unit && a.topic === b.topic;
}

/**
 * The places an entry is placed in (5.8.19): where it stands, and where it
 * was made where that differs.
 * @param {Folded} folded @param {string} id
 * @returns {Standing[]}
 */
function placesOf(folded, id) {
  const standing = standingOf(folded, id);
  const made = madeOn(folded, id);
  return samePlace(standing, made) ? [standing] : [standing, made];
}

/**
 * Whether a place is in a unit and, given one, on a topic: a read naming
 * no topic reads the whole unit.
 * @param {Standing} place @param {string} unit @param {string|null} topic
 */
function inPlace(place, unit, topic) {
  return place.unit === unit && (topic === null || place.topic === topic);
}

/** The live replacements naming `id`. @param {Folded} folded @param {string} id */
function liveReplacers(folded, id) {
  return factsOf(folded, id).replaced_by.filter((r) => isLive(folded, r));
}

/** The entry a merge went into. @param {Folded} folded @param {string} merge */
function intoOf(folded, merge) {
  return /** @type {string} */ (factsOf(folded, merge).into);
}

/**
 * Where `id`'s chain goes one step on while the merges `holding` hold: every
 * live replacement naming it, or, while none does, the entry each holding
 * merge that took it as a duplicate went into.
 * @param {Folded} folded @param {ReadonlySet<string>} holding @param {string} id
 * @returns {string[]}
 */
function nextOf(folded, holding, id) {
  const replacers = liveReplacers(folded, id);
  return replacers.length > 0 ? replacers : factsOf(folded, id).merged_by.filter((m) => holding.has(m)).map((m) => intoOf(folded, m));
}

/**
 * The current entries `id` leads to while the merges `holding` hold: itself
 * where it is a live entry nothing sets aside; else those of every live
 * replacement naming it, or, while none does, of the entry each holding
 * merge that took it as a duplicate went into; none where it leads nowhere
 * current. An entry met twice adds nothing, so a cycle leads nowhere.
 * @param {Folded} folded @param {ReadonlySet<string>} holding @param {string} id @param {Set<string>} seen
 * @returns {string[]}
 */
function leadsTo(folded, holding, id, seen) {
  if (seen.has(id)) return [];
  seen.add(id);
  const next = nextOf(folded, holding, id);
  if (next.length === 0) return factsOf(folded, id).kind !== null && isLive(folded, id) ? [id] : [];
  return [...new Set(next.flatMap((n) => leadsTo(folded, holding, n, seen)))];
}

/** Whether the entry `merge` went into leads to a current one while `holding` hold. @param {Folded} folded @param {ReadonlySet<string>} holding @param {string} merge */
function leadsSomewhere(folded, holding, merge) {
  return leadsTo(folded, holding, intoOf(folded, merge), new Set()).length > 0;
}

/**
 * The merges that hold, as worked out for one folded ledger, all at once.
 * @type {WeakMap<Folded, ReadonlySet<string>>}
 */
const HOLDING = new WeakMap();

/**
 * The merges that hold. Of the live merges whose duplicate nothing else sets
 * aside, one is taken at a time — the latest that leads to a current entry
 * once it holds — until no other would; each other live merge then holds
 * where it leads to a current entry.
 * @param {Folded} folded
 * @returns {ReadonlySet<string>}
 */
function holdingMerges(folded) {
  const known = HOLDING.get(folded);
  if (known !== undefined) return known;
  /** @type {string[]} */
  const live = [];
  for (const [id, facts] of folded.facts) if (facts.event === 'merged' && isLive(folded, id)) live.push(id);
  live.reverse();
  const settingAside = new Set(live.filter((m) => {
    const duplicate = factsOf(folded, m).duplicate;
    return duplicate !== null && liveReplacers(folded, duplicate).length === 0;
  }));
  /** @type {Set<string>} */
  const holding = new Set();
  const takes = (/** @type {string} */ m) => {
    holding.add(m);
    if (leadsSomewhere(folded, holding, m)) return true;
    holding.delete(m);
    return false;
  };
  let tookOne = true;
  while (tookOne) tookOne = [...settingAside].some((m) => !holding.has(m) && takes(m));
  for (const m of live) if (!settingAside.has(m) && leadsSomewhere(folded, holding, m)) holding.add(m);
  HOLDING.set(folded, holding);
  return holding;
}

/** Whether a merge holds. @param {Folded} folded @param {string} merge */
function mergeHolds(folded, merge) {
  return holdingMerges(folded).has(merge);
}

/**
 * Why the entry `id` is not current, or null where it is (5.8.17, 5.3.13):
 * a question's wording replaced by the next on its line.
 * @param {Folded} folded @param {string} id
 * @returns {NotCurrent|null}
 */
function notCurrent(folded, id) {
  const [replacer] = isWording(folded, id) ? wordingsAfter(folded, id) : liveReplacers(folded, id);
  if (replacer !== undefined) return { replaced_by: replacer };
  const merge = factsOf(folded, id).merged_by.find((m) => mergeHolds(folded, m));
  if (merge !== undefined) return { merged_by: merge };
  const dead = whyDead(folded, id);
  return dead === null ? null : { dead };
}

/** Whether `id` is a current entry. @param {Folded} folded @param {string} id */
function isCurrent(folded, id) {
  return factsOf(folded, id).kind !== null && notCurrent(folded, id) === null;
}

/**
 * The current entries `id`'s chain leads to: itself while current; else
 * those of every live replacement naming it, or, while none does, of the
 * entry each merge that holds took it into as a duplicate; none where it
 * leads nowhere current. A question's wording's: the question's wording.
 * @param {Folded} folded @param {string} id
 * @returns {string[]}
 */
function currentsOf(folded, id) {
  if (!isWording(folded, id)) return leadsTo(folded, holdingMerges(folded), id, new Set());
  const wording = wordingOf(folded, id);
  return wording === null ? [] : [wording];
}

/**
 * The live replacements `id`'s chain meets while the merges `holding` hold,
 * on its way to its current forms. An entry met twice adds nothing.
 * @param {Folded} folded @param {ReadonlySet<string>} holding @param {string} id @param {Set<string>} seen
 * @returns {string[]}
 */
function replacementsDown(folded, holding, id, seen) {
  if (seen.has(id)) return [];
  seen.add(id);
  return [...liveReplacers(folded, id), ...nextOf(folded, holding, id).flatMap((next) => replacementsDown(folded, holding, next, seen))];
}

/**
 * What changed `id`: the live replacements on its way to its current forms,
 * past each merge that holds, a merge changing nothing — a duplicate gives
 * the same answer (5.5.5) — in the ledger's order, the latest last. A
 * question's wording's are the wordings on its line after it, or, while it
 * is set aside, after the nearest live wording it grew from down its own
 * chain; the whole line where nothing it grew from is live (5.8.20). None
 * while it is current.
 * @param {Folded} folded @param {string} id
 * @returns {string[]}
 */
function replacementsOf(folded, id) {
  if (isWording(folded, id)) return wordingsAfter(folded, id);
  return inLedgerOrder(folded, replacementsDown(folded, holdingMerges(folded), id, new Set()));
}

/** The confirmations that `id` still holds, made where it is live. @param {Folded} folded @param {string} id */
function holdsOf(folded, id) {
  return factsOf(folded, id).holds.filter((hold) => isLive(folded, hold));
}

/**
 * The chain folded beneath a current entry (5.6.5): the entries it
 * replaced, newest first, down to the first that is not live, as though
 * that one were not there — what it replaced stands again on its own. A
 * question's wording's: the wordings before it on its line, newest first.
 * @param {Folded} folded @param {string} id
 * @returns {string[]}
 */
function foldedBeneath(folded, id) {
  if (isWording(folded, id)) {
    const at = factsOf(folded, id).place.number;
    return lineOf(folded, id).filter((wording) => factsOf(folded, wording).place.number < at).reverse();
  }
  const replaced = factsOf(folded, id).replaces;
  return replaced === null || !isLive(folded, replaced) ? [] : [replaced, ...foldedBeneath(folded, replaced)];
}

/** @param {Folded} folded @param {Iterable<string>} ids the ids, in the ledger's order and once each */
function inLedgerOrder(folded, ids) {
  return [...new Set(ids)].sort((a, b) => factsOf(folded, a).place.number - factsOf(folded, b).place.number);
}

/**
 * A question's current answer (5.3.13): every current entry answering any
 * wording of it, standing or set aside, in the ledger's order.
 * @param {Folded} folded @param {string} question
 */
function currentAnswer(folded, question) {
  return factsOf(folded, factsOf(folded, question).root).answered_by.filter((id) => isCurrent(folded, id));
}

/**
 * What the merges of a question resolve to: the current form of each entry
 * a merge that holds took any wording of it into (5.5.5).
 * @param {Folded} folded @param {string} question
 */
function mergedAnswer(folded, question) {
  const merges = factsOf(folded, factsOf(folded, question).root).merges.filter((m) => mergeHolds(folded, m));
  return [...new Set(merges.flatMap((m) => currentsOf(folded, intoOf(folded, m))))];
}

/**
 * Each question's answers, as worked out for one folded ledger.
 * @type {WeakMap<Folded, Map<string, string[]>>}
 */
const ANSWERS = new WeakMap();

/**
 * A question's answers, as its map row and every record show them alike:
 * its current answer, then what its merges resolve to.
 * @param {Folded} folded @param {string} question
 * @returns {string[]}
 */
function answersOf(folded, question) {
  let known = ANSWERS.get(folded);
  if (known === undefined) ANSWERS.set(folded, known = new Map());
  let answers = known.get(question);
  if (answers === undefined) known.set(question, answers = [...new Set([...currentAnswer(folded, question), ...mergedAnswer(folded, question)])]);
  return answers;
}

/**
 * Every place each current entry shows in, as worked out for one folded
 * ledger.
 * @type {WeakMap<Folded, Map<string, Standing[]>>}
 */
const SHOWN_IN = new WeakMap();

/**
 * Where a current question stands on its own topic's map: merged, answered,
 * or open.
 * @param {Folded} folded @param {string} question
 * @returns {'open'|'answered'|'merged'}
 */
function questionStands(folded, question) {
  if (mergedAnswer(folded, question).length > 0) return 'merged';
  return answersOf(folded, question).length > 0 ? 'answered' : 'open';
}

/**
 * Every place an entry shows in (5.8.19): those it is placed in, and, for
 * an answer, where each current question it answers stands, on whose map it
 * shows as that question's answer; none while it is not current. Worked out
 * for the whole ledger at once.
 * @param {Folded} folded @param {string} id
 * @returns {Standing[]}
 */
function showsIn(folded, id) {
  let known = SHOWN_IN.get(folded);
  if (known === undefined) {
    /** @type {Map<string, Standing[]>} */
    const shown = new Map();
    const add = (/** @type {string} */ entry, /** @type {Standing} */ place) => {
      const places = shown.get(entry) ?? [];
      if (!places.some((p) => samePlace(p, place))) places.push(place);
      shown.set(entry, places);
    };
    for (const [entry, facts] of folded.facts) {
      if (facts.kind === null || !isCurrent(folded, entry)) continue;
      for (const place of placesOf(folded, entry)) add(entry, place);
      if (facts.kind === 'question') for (const answer of answersOf(folded, entry)) add(answer, standingOf(folded, entry));
    }
    SHOWN_IN.set(folded, known = shown);
  }
  return known.get(id) ?? [];
}

/**
 * Where a question stands on its map: open, answered, merged — answered by
 * the entry another topic holds, which a merge took it into (5.5.5) — moved
 * away to another topic, or standing elsewhere, shown for what was placed on
 * the topic (5.8.19); or, on the row of an answer no current question
 * answers, its question set aside.
 * @typedef {'open'|'answered'|'merged'|'moved-away'|'elsewhere'|'question-set-aside'} Stands
 */

/**
 * A row of a topic's map: the question; where it stands; for one moved
 * away, the topic it moved to, for one moved in, the topic it came from, and
 * for one standing elsewhere, where; its current answers, its own and those
 * a merge resolves to — on the row of a question standing off the topic,
 * those placed on the topic; and the question it is part of, in its current
 * wording, and the current questions part of any wording of it (5.3.11).
 * @typedef {{
 *   id: string, stands: Stands, moved_from: string|null, moved_to: string|null, stands_in: Standing|null,
 *   answers: string[], part_of: string|null, parts: string[],
 * }} MapRow
 */

/** The topic a move was made from: the topic it was written on. @param {Folded} folded @param {string} move */
function movedFrom(folded, move) {
  return /** @type {string} */ (factsOf(folded, move).topic);
}

/** The question a part is part of, by any wording, in its wording: the last of its line, or the wording named where none is live. @param {Folded} folded @param {string|null} whole */
function wholeOf(folded, whole) {
  return whole === null ? null : wordingOf(folded, whole) ?? whole;
}

/**
 * A current question standing on the map of a topic of `unit`, as its row:
 * moved in from the topic the last live move `unit` made of it was made on,
 * while that topic is live.
 * @param {Folded} folded @param {string} id @param {string} unit
 * @returns {MapRow}
 */
function standingRow(folded, id, unit) {
  const answers = answersOf(folded, id);
  const lastMove = liveMovesBy(folded, factsOf(folded, id).root, unit).at(-1);
  const from = lastMove === undefined ? null : movedFrom(folded, lastMove);
  const parts = factsOf(folded, factsOf(folded, id).root).parts.filter((part) => isCurrent(folded, part));
  return {
    id,
    stands: questionStands(folded, id),
    moved_from: from === null || folded.live(unit, from) !== null ? null : from,
    moved_to: null,
    stands_in: null,
    answers,
    part_of: wholeOf(folded, factsOf(folded, id).part_of),
    parts,
  };
}

/**
 * A current question standing off a map's topic, as its row there where it
 * has one, showing `answers`: moved away, where the map's unit moved it from
 * the topic by a live move and it stands on another topic of that unit;
 * else standing elsewhere, where it was made on the topic or `answers`
 * holds any. None where neither.
 * @param {Folded} folded @param {string} id @param {Standing} map the map's unit and topic
 * @param {string[]} answers its answers placed on the topic that no question standing there shows
 * @returns {MapRow|null}
 */
function awayRow(folded, id, map, answers) {
  const standing = standingOf(folded, id);
  const row = { id, moved_from: null, answers, part_of: wholeOf(folded, factsOf(folded, id).part_of), parts: [] };
  const topic = /** @type {string} */ (map.topic);
  if (standing.unit === map.unit && liveMovesBy(folded, factsOf(folded, id).root, map.unit).some((m) => movedFrom(folded, m) === topic)) {
    return { ...row, stands: 'moved-away', moved_to: standing.topic, stands_in: null };
  }
  const shows = answers.length > 0 || placesOf(folded, id).some((place) => samePlace(place, map));
  return shows ? { ...row, stands: 'elsewhere', moved_to: null, stands_in: standing } : null;
}

/**
 * A current answer placed on a map's topic that no current question
 * answers, as a row of its own, headed by itself: where it stands, where
 * that is not the map's topic.
 * @param {Folded} folded @param {string} id @param {Standing} map the map's unit and topic
 * @returns {MapRow}
 */
function aloneRow(folded, id, map) {
  const standing = standingOf(folded, id);
  return { id, stands: 'question-set-aside', moved_from: null, moved_to: null, stands_in: samePlace(standing, map) ? null : standing, answers: [], part_of: null, parts: [] };
}

/** Whether `id` stands at `unit` and, given one, `topic`. @param {Folded} folded @param {string} id @param {string} unit @param {string|null} topic */
function standsAt(folded, id, unit, topic) {
  return inPlace(standingOf(folded, id), unit, topic);
}

/**
 * A topic's map (5.8.5), in the ledger's order: every current question
 * standing on it; every current question standing on another topic of its
 * unit that the unit moved away from it by a live move; every other
 * current question standing elsewhere that was made on it, or that an
 * answer placed on it and shown by no question standing there answers
 * (5.8.19); and every current answer placed on it that no question's row
 * shows, as no current question answers it. None on a topic that is not
 * live.
 * @param {Folded} folded @param {string} unit @param {string} topic
 * @returns {MapRow[]}
 */
function mapOf(folded, unit, topic) {
  if (folded.live(unit, topic) !== null) return [];
  const map = { unit, topic };
  const questions = [...folded.facts.keys()].filter((id) => factsOf(folded, id).kind === 'question' && isCurrent(folded, id));
  const standing = new Map(questions.filter((id) => samePlace(standingOf(folded, id), map)).map((id) => [id, standingRow(folded, id, unit)]));
  const shown = new Set([...standing.values()].flatMap((row) => row.answers));
  const unshownHere = (/** @type {string} */ id) => !shown.has(id) && placesOf(folded, id).some((place) => samePlace(place, map));
  /** @type {MapRow[]} */
  const rows = [];
  for (const id of questions) {
    const row = standing.get(id) ?? awayRow(folded, id, map, answersOf(folded, id).filter(unshownHere));
    if (row !== null) rows.push(row);
  }
  const onRows = new Set(rows.flatMap((row) => row.answers));
  for (const [id, facts] of folded.facts) {
    if (facts.kind === 'decision' && !onRows.has(id) && isCurrent(folded, id) && placesOf(folded, id).some((place) => samePlace(place, map))) rows.push(aloneRow(folded, id, map));
  }
  return rows.sort((a, b) => factsOf(folded, a.id).place.number - factsOf(folded, b.id).place.number);
}

/**
 * What a record shows, by id: its current questions, findings and
 * decisions; the moves and merges made on it, the moves as history; and the
 * current entries standing outside it that were made on it, that its
 * entries rely on, that its merges that hold went into, or that answer its
 * questions (5.8.4), each with the ids its entries name it by — none for
 * one shown for having been made there alone.
 * @typedef {{
 *   questions: string[], findings: string[], decisions: string[],
 *   moved: string[], merged: string[],
 *   other_topics: {id: string, named: string[]}[],
 * }} RecordIds
 */

/**
 * The record of the entries among `ids` that `here` names in `unit`: what
 * it shows, by id, the current entries `placed` names that `here` does not
 * shown as another place's. Nothing on a unit or topic that is not live,
 * nor a move or merge made on one.
 * @param {Folded} folded @param {string} unit @param {string|null} topic the place whose liveness decides
 * @param {Iterable<string>} ids the ids it may hold, in the ledger's order
 * @param {(id: string) => boolean} here whether `id` stands in the record
 * @param {(id: string) => boolean} placed whether `id` is placed in the record (5.8.19)
 * @returns {RecordIds}
 */
function recordFrom(folded, unit, topic, ids, here, placed) {
  /** @type {RecordIds} */
  const record = { questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [] };
  if (folded.live(unit, topic) !== null) return record;
  /** @type {Map<string, string[]>} */
  const outside = new Map();
  const show = (/** @type {string[]} */ shown, /** @type {string|null} */ tie) => {
    for (const id of shown) {
      if (here(id)) continue;
      const ties = outside.get(id) ?? [];
      if (tie !== null && !ties.includes(tie)) ties.push(tie);
      outside.set(id, ties);
    }
  };
  for (const id of ids) {
    const facts = factsOf(folded, id);
    if (!here(id)) {
      if (facts.kind !== null && placed(id) && isCurrent(folded, id)) show([id], null);
      continue;
    }
    if (!isLive(folded, id)) continue;
    if (facts.event === 'moved') record.moved.push(id);
    if (facts.event === 'merged') {
      record.merged.push(id);
      if (mergeHolds(folded, id)) show(currentsOf(folded, intoOf(folded, id)), intoOf(folded, id));
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
 * The record of a unit, or of one of its topics: what it shows, by id.
 * @param {Folded} folded @param {string} unit @param {string|null} topic null for every entry of the unit
 * @returns {RecordIds}
 */
function recordOf(folded, unit, topic) {
  const here = (/** @type {string} */ id) => standsAt(folded, id, unit, topic);
  const placed = (/** @type {string} */ id) => placesOf(folded, id).some((place) => inPlace(place, unit, topic));
  return recordFrom(folded, unit, topic, folded.facts.keys(), here, placed);
}

/**
 * Every place a live event stands in, or a current entry is placed in — a
 * unit, and a topic or none at its own level — with its record, in the
 * ledger's order: each id's places worked out once, and each record built
 * from the ids placed in it alone.
 * @param {Folded} folded
 * @returns {{unit: string, topic: string|null, record: RecordIds}[]}
 */
function placeRecords(folded) {
  /** @type {Map<string, {place: Standing, ids: string[]}>} */
  const places = new Map();
  for (const id of folded.facts.keys()) {
    if (!isLive(folded, id)) continue;
    const entry = factsOf(folded, id).kind !== null && isCurrent(folded, id);
    for (const place of entry ? placesOf(folded, id) : [standingOf(folded, id)]) {
      const key = `${place.unit}\0${place.topic ?? ''}`;
      const held = places.get(key) ?? { place, ids: [] };
      held.ids.push(id);
      places.set(key, held);
    }
  }
  return [...places.values()].map(({ place, ids }) => {
    const here = (/** @type {string} */ id) => samePlace(standingOf(folded, id), place);
    const placed = (/** @type {string} */ id) => placesOf(folded, id).some((p) => samePlace(p, place));
    return { unit: place.unit, topic: place.topic, record: recordFrom(folded, place.unit, place.topic, ids, here, placed) };
  });
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
  ID_FACTS, readFolded, foldLedger, namesTopic, factsOf, madeOn, standingOf, inPlace, whyDead, isLive, mergeHolds, notCurrent, isCurrent, currentsOf, replacementsOf, holdsOf,
  foldedBeneath, wordingOf, answersOf, questionStands, showsIn, mapOf, recordOf, placeRecords, productOf,
};
