'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a unit's entries — the current entries of the ledger placed
// in a work unit (5.8.17, 5.8.19), by id: those standing on each of its live
// topics or at its own level, `{unit}.specification` among it, and those
// made there that stand elsewhere, as a replacement made in the unit of
// another unit's entry does. A current entry stands, and was made, in a live
// place, so none is on a topic or unit set aside. What the spec is drawn
// from and held to: its trace (spec-trace.cjs), and the records the spec's
// writer, its reviewer, the sweep, the cut and the person's review page read.
//
// Each entry carries its short id, its kind, where it stands — a unit, and
// a topic or none at the unit's level — and its line as written but its
// schema version, every id in it whole. The ledger is folded once, in one
// streamed pass, and each entry's line read again from the file it opened;
// a read drawing several units takes every unit's from that one fold
// (`everyUnitEntries`).
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { shortIds } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, isCurrent, standingOf, madeOn } = require('./ledger-fold.cjs');
const { liveness } = require('./ledger-units.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').Standing} Standing */
/** @typedef {import('./ledger-events.cjs').EntryKind} EntryKind */

/** @typedef {{short: string, kind: EntryKind, stands: Standing, line: Record<string, unknown>}} UnitEntry */

/**
 * The ledger folded, read against liveness, a unit's entries drawn from it,
 * and every id's short form.
 * @typedef {{folded: Folded, entries: Map<string, UnitEntry>, short: (id: string) => string}} UnitView
 */

/**
 * `answer`, given the unit's entries with the folded ledger they were drawn
 * from; what a landing the read's check finished said pushed to `warnings`.
 * @template T
 * @param {string} cwd @param {string} unit @param {string[]} warnings @param {(view: UnitView) => T} answer
 * @returns {T}
 */
function withUnitEntries(cwd, unit, warnings, answer) {
  return withEntriesOf(cwd, warnings, (held) => held === unit, (viewOf) => answer(viewOf(unit)));
}

/**
 * Every unit's entries from one fold of the ledger, for a read that draws
 * several units in one call: each unit's as `withUnitEntries` gives it.
 * @param {string} cwd @param {string[]} warnings
 * @returns {(unit: string) => UnitView}
 */
function everyUnitEntries(cwd, warnings) {
  return withEntriesOf(cwd, warnings, (held) => typeof held === 'string', (viewOf) => viewOf);
}

/**
 * `answer`, given each wanted unit's entries from one fold of the ledger:
 * an entry is a unit's where it stands in the unit or was made there.
 * @template T
 * @param {string} cwd @param {string[]} warnings @param {(unit: string|null) => boolean} wanted @param {(viewOf: (unit: string) => UnitView) => T} answer
 * @returns {T}
 */
function withEntriesOf(cwd, warnings, wanted, answer) {
  const root = stateRoot(cwd);
  const live = liveness(root);
  return readFolded(root, ID_FACTS, warnings, (facts, entryAt) => {
    const folded = { facts, live };
    const shorts = shortIds(facts.keys());
    const short = (/** @type {string} */ id) => /** @type {string} */ (shorts.get(id));
    /** @type {Map<string, Map<string, UnitEntry>>} */
    const byUnit = new Map();
    for (const [id, { kind, place }] of facts) {
      if (kind === null || !isCurrent(folded, id)) continue;
      const stands = standingOf(folded, id);
      const units = [...new Set([stands.unit, madeOn(folded, id).unit])].filter(wanted);
      if (units.length === 0) continue;
      const { v, ...line } = entryAt(place);
      for (const unit of /** @type {string[]} */ (units)) {
        if (!byUnit.has(unit)) byUnit.set(unit, new Map());
        /** @type {Map<string, UnitEntry>} */ (byUnit.get(unit)).set(id, { short: short(id), kind, stands, line });
      }
    }
    return answer((unit) => ({ folded, entries: byUnit.get(unit) ?? new Map(), short }));
  });
}

/**
 * The current entries placed in the unit, by id, in the ledger's order.
 * @param {string} cwd @param {string} unit @param {string[]} [warnings] what a landing the read's check finished said, pushed to
 * @returns {Map<string, UnitEntry>}
 */
function unitEntries(cwd, unit, warnings = []) {
  return withUnitEntries(cwd, unit, warnings, ({ entries }) => entries);
}

module.exports = { withUnitEntries, everyUnitEntries, unitEntries };
