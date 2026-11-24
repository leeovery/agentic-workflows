'use strict';

// ---------------------------------------------------------------------------
// Domain ring: decisions from before Ledger — the decisions the migration
// brought across from a project's documents from before Ledger, each line
// the migration's (`CARRIED_SESSION`) whoever those documents say made it,
// and never checked against the code (21.6.16).
//
// Where the work holds a current one — its unit's own, standing there or
// made there, or one product-wide in any live unit — an entry into a phase
// whose work reads the code against the record's decisions (discussion,
// investigation, specification, the build, a quick-fix's among it, and
// review) names the shared reference on them in its DATA, with what it
// covers and when to load it (enter.cjs), and so does that phase's note
// after a compaction (position.cjs). None where the work holds none. Each
// current decision of the work is read again for its session alone, the
// first found ending the read.
// ---------------------------------------------------------------------------

const path = require('path');
const { stateRoot } = require('../kernel/state-root.cjs');
const { ID_FACTS, readFolded, isCurrent, standingOf } = require('./ledger-fold.cjs');
const { liveness } = require('./ledger-units.cjs');
const { CARRIED_SESSION } = require('./ledger-events.cjs');

/** The shared reference, where it is installed beside the engine. */
const REFERENCE = path.resolve(__dirname, '..', '..', '..', 'ledger-shared', 'references', 'decisions-from-before.md');

/** The phases whose work reads the code against the record's decisions; a quick-fix's enters through the build's. */
const READS_THE_CODE = Object.freeze(['discussion', 'investigation', 'specification', 'implementation', 'review']);

/**
 * Whether the work of `unit` holds a current decision from before Ledger
 * (the header's).
 * @param {string} cwd @param {string} unit @param {string[]} warnings what a landing the read's check finished said, pushed to
 * @returns {boolean}
 */
function holdsFromBefore(cwd, unit, warnings) {
  const root = stateRoot(cwd);
  const live = liveness(root);
  return readFolded(root, ID_FACTS, warnings, (facts, entryAt) => {
    const folded = { facts, live };
    for (const [id, { kind, unit: made, product_wide: wide, place }] of facts) {
      if (kind !== 'decision' || !isCurrent(folded, id)) continue;
      const its = wide === true || made === unit || standingOf(folded, id).unit === unit;
      if (its && entryAt(place).session === CARRIED_SESSION) return true;
    }
    return false;
  });
}

/**
 * The line naming the reference, `[key, value]`, at a place in `phase` of
 * `unit` where the work holds a decision from before Ledger; none
 * elsewhere.
 * @param {string} cwd @param {string} phase @param {string} unit @param {string[]} warnings what the ledger's read said, pushed to
 * @returns {[string, string][]}
 */
function fromBeforeLines(cwd, phase, unit, warnings) {
  if (!READS_THE_CODE.includes(phase) || !holdsFromBefore(cwd, unit, warnings)) return [];
  return [['decisions from before', `${REFERENCE} — how to settle code built otherwise than a decision from before Ledger, which the migration never checked against the code; load it when the work meets code one of the record's decisions from before bears on`]];
}

module.exports = { fromBeforeLines };
