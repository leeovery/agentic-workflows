'use strict';

// ---------------------------------------------------------------------------
// Domain ring: date stamps — the shared clock helper, so a stamped date is
// spelled one way across every transaction.
// ---------------------------------------------------------------------------

/** The work unit's date stamp for today (UTC), matching the manifest `created` field. */
function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { todayStamp };
