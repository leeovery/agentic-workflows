'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's folds (5.8.1, 5.8.2). What is read from the
// ledger is worked out from it in one streamed pass: the ledger checked and
// read a line at a time (ledger.cjs), never held whole (5.7.6, 5.7.8), each
// event folded in order into a state that answers what its reader asks.
//
// The facts of each id the ledger holds: the event that wrote it; the kind
// of entry it is, a replacement taking the kind it stands for, or none for
// an event that is no entry; its unit, and its topic — for a question, the
// topic it was last moved to (5.3.3); the question a decision answers, the
// one a question is part of, what it relies on, and what it replaces;
// whether it is product-wide, null where its kind is never marked; and the
// first replacement naming it, null while none does — an entry is current
// only while none does (5.3.13).
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
 *   unit: string,
 *   topic: string|null,
 *   answers: string|null,
 *   part_of: string|null,
 *   relies_on: string[],
 *   replaces: string|null,
 *   product_wide: boolean|null,
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
      unit: /** @type {string} */ (event.unit),
      topic: idOrNull(event.topic),
      answers: idOrNull(event.answers),
      part_of: idOrNull(event.part_of),
      relies_on: Array.isArray(event.relies_on) ? event.relies_on : [],
      replaces: idOrNull(event.replaces),
      product_wide: typeof event.product_wide === 'boolean' ? event.product_wide : null,
      replaced_by: null,
    });
    if (event.event === 'moved') {
      /** @type {IdFacts} */ (facts.get(/** @type {string} */ (event.question))).topic = /** @type {string} */ (event.to);
    }
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
