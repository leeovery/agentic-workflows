'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a replacement affects (5.6.10, 5.6.11, 5.8.8) — a fold of
// the ledger, worked out when read and never kept (5.8.2), and its read verb,
// `ledger affected`.
//
// - An entry is affected, while it is current, by each entry it is held
//   against — each it relies on, and for an answer the question it answers,
//   which a rewording leaves it answering (5.3.13) — whose way to its
//   current form passes a live replacement it never saw, past each merge
//   that holds, a merge or a move itself changing nothing (5.5.5); until a
//   live confirmation that it still holds names the latest replacement on
//   that way, each entry it is held against cleared on its own; a later
//   replacement flags it again. A question, a finding and a decision alike
//   (5.6.11). An entry relies only on what is current as it is written, so
//   every live replacement on the way of one it relies on is one it never
//   saw: written after it, or set aside while it was written — wherever a
//   merge has laid it in the ledger. A question's way is its line
//   (ledger-fold.cjs): an answer, which records the question's wording as
//   it is written (ledger-write.cjs), and an entry relying on a wording, are
//   held against the live wordings later on the line than that one — or,
//   where it is set aside since, than the nearest live wording it grew
//   from: rewordings written after it, and rewordings set aside while it
//   was written and back since. Its own replacement takes an entry off the
//   list. The confirmation's write is held to the same ways (`heldAgainst`).
// - What relies on an affected entry is not affected by it: only once that
//   entry is replaced.
// - Where an affected entry waits (5.6.12, 5.6.13): in a unit still under
//   way, on the topic it stands on, or at the unit's level, however closed
//   that topic is; in a finished unit never there, but in the work that made
//   each latest replacement — the unit and topic it was made on — which
//   confirms or replaces it, the finished unit left finished.
// ---------------------------------------------------------------------------

const { factsOf, standingOf, madeOn, isCurrent, holdsOf, replacementsOf } = require('./ledger-fold.cjs');
const { finishedUnits } = require('./ledger-units.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').Standing} Standing */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./ledger-read.cjs').Place} Place */

/**
 * An entry another is held against — one it relies on, or the question it
 * answers — and the live replacements on its way to its current form that
 * the other never saw, in the ledger's order, the latest last.
 * @typedef {{held_against: string, replacements: string[]}} Change
 */

/**
 * What an entry is held against (5.6.10): each entry it relies on, and for
 * an answer the question it answers, in the wording it records, each with
 * its way, changed or not.
 * @param {Folded} folded @param {string} id
 * @returns {Change[]}
 */
function heldAgainst(folded, id) {
  const facts = factsOf(folded, id);
  const held = facts.kind === 'decision' ? [...facts.relies_on, /** @type {string} */ (facts.answers)] : facts.relies_on;
  return held.map((against) => ({ held_against: against, replacements: replacementsOf(folded, against) }));
}

/**
 * An affected entry waiting in the unit read: the entry, where it stands,
 * the unit's topics it waits on — null for the unit's level — and what
 * changed under it.
 * @typedef {{id: string, standing: Standing, waits: (string|null)[], changes: Change[]}} Affected
 */

/**
 * What changed under a current entry: each entry it is held against whose
 * way a live replacement changed, where no live confirmation that it still
 * holds names the latest.
 * @param {Folded} folded @param {string} id
 * @returns {Change[]}
 */
function changesUnder(folded, id) {
  const confirmed = new Set(holdsOf(folded, id).map((hold) => factsOf(folded, hold).after));
  return heldAgainst(folded, id).filter(({ replacements }) => replacements.length > 0 && !confirmed.has(/** @type {string} */ (replacements.at(-1))));
}

/**
 * Where an affected entry waits: where it stands, in a unit still under
 * way; in a finished unit, where the latest replacement of each change was
 * made.
 * @param {Folded} folded @param {(unit: string) => boolean} finished @param {Standing} standing @param {Change[]} changes
 * @returns {Standing[]}
 */
function waitsAt(folded, finished, standing, changes) {
  if (!finished(standing.unit)) return [standing];
  const made = changes.map((change) => madeOn(folded, /** @type {string} */ (change.replacements.at(-1))));
  return [...new Map(made.map((at) => [`${at.unit}\0${at.topic ?? ''}`, at])).values()];
}

/**
 * Every affected entry waiting in `unit` and, given one, on `topic`, in the
 * ledger's order. None on a unit or topic that is not live.
 * @param {Folded} folded @param {(unit: string) => boolean} finished @param {string} unit @param {string|null} topic
 * @returns {Affected[]}
 */
function affectedIn(folded, finished, unit, topic) {
  if (folded.live(unit, topic) !== null) return [];
  /** @type {Affected[]} */
  const rows = [];
  for (const id of folded.facts.keys()) {
    if (!isCurrent(folded, id)) continue;
    const changes = changesUnder(folded, id);
    if (changes.length === 0) continue;
    const standing = standingOf(folded, id);
    const waits = waitsAt(folded, finished, standing, changes).filter((at) => at.unit === unit && (topic === null || at.topic === topic));
    if (waits.length > 0) rows.push({ id, standing, waits: waits.map((at) => at.topic), changes });
  }
  return rows;
}

/**
 * `ledger affected`: the affected entries waiting in a unit or on a topic,
 * each with where it stands, the topics it waits on, and what changed under
 * it — the entry it is held against, and each replacement on its way, the
 * latest, which a confirmation names, last; and the topics among them that
 * wait on the person until they answer (5.6.12).
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerAffected({ folded, show, short }, { unit, topic }, root) {
  const rows = affectedIn(folded, finishedUnits(root), /** @type {string} */ (unit), topic);
  return {
    unit,
    topic,
    live: folded.live(/** @type {string} */ (unit), topic) === null,
    waiting: [...new Set(rows.flatMap((row) => row.waits))],
    affected: rows.map((row) => ({
      ...show(row.id),
      standing: row.standing,
      waits: row.waits,
      changed: row.changes.map((change) => ({ held_against: short(change.held_against), replacements: change.replacements.map(show) })),
    })),
  };
}

module.exports = { heldAgainst, answerAffected };
