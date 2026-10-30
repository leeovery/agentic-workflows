'use strict';

// ---------------------------------------------------------------------------
// Domain ring: date stamps — the shared clock helper, so a stamped date is
// spelled one way across every transaction.
// ---------------------------------------------------------------------------

/** The work unit's date stamp for today (UTC), matching the manifest `created` field. */
function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

/** ISO-8601 UTC to the second (`2026-07-15T09:30:00Z`). */
function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = { todayStamp, isoNow };
