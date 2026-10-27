'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's folds (5.8.1, 5.8.2). What is read from the
// ledger is worked out from it in one streamed pass: the ledger checked and
// read a line at a time (ledger.cjs), never held whole (5.7.6, 5.7.8), each
// event folded in order into a state that answers what its reader asks.
//
// The facts of each id the ledger holds: the event that wrote it; the kind
// of entry it is, a replacement taking the kind it stands for, or none for
// an event that is no entry; the question a decision answers, and the one a
// question is part of; and the first replacement naming it, null while none
// does — an entry is current only while none does (5.3.13).
// ---------------------------------------------------------------------------

const { readLedger } = require('./ledger.cjs');
const { entryKind } = require('./ledger-events.cjs');

/**
 * A fold over the ledger: the state it starts from, and how each event, in
 * the ledger's order, moves it on.
 * @template S @typedef {{start: () => S, step: (state: S, event: Record<string, unknown>) => void}} Fold
 */

/**
 * What the ledger says of one id.
 * @typedef {{
 *   event: string,
 *   kind: import('./ledger-events.cjs').EntryKind|null,
 *   answers: string|null,
 *   part_of: string|null,
 *   replaced_by: string|null,
 * }} IdFacts
 */

/** @param {unknown} value @returns {string|null} */
function idOrNull(value) {
  return typeof value === 'string' ? value : null;
}

/** The facts of every id, by id. @type {Fold<Map<string, IdFacts>>} */
const ID_FACTS = {
  start: () => new Map(),
  step: (facts, event) => {
    facts.set(/** @type {string} */ (event.id), {
      event: /** @type {string} */ (event.event),
      kind: entryKind(event),
      answers: idOrNull(event.answers),
      part_of: idOrNull(event.part_of),
      replaced_by: null,
    });
    if (event.event !== 'replaced') return;
    const replaced = /** @type {IdFacts} */ (facts.get(/** @type {string} */ (event.replaces)));
    replaced.replaced_by ??= /** @type {string} */ (event.id);
  },
};

/**
 * The ledger folded by `fold`, in one streamed pass.
 * @template S
 * @param {string} root @param {Fold<S>} fold
 * @param {string[]} notes what a landing the read's check finished said, pushed to
 * @returns {S}
 */
function foldLedger(root, fold, notes) {
  const state = fold.start();
  for (const event of readLedger(root, notes)) fold.step(state, event);
  return state;
}

module.exports = { ID_FACTS, foldLedger };
