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

/** A day, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The time a day before the date a stamp names, in full: where a search of
 * what came after that date starts, whatever the clocks between; null
 * where the stamp names none.
 * @param {unknown} stamp @returns {string|null}
 */
function dayBefore(stamp) {
  const at = typeof stamp === 'string' ? Date.parse(stamp) : Number.NaN;
  return Number.isNaN(at) ? null : new Date(at - DAY_MS).toISOString();
}

/** Whole days from the date a stamp names to today (UTC), none for a date to come. @param {string} stamp `YYYY-MM-DD` @returns {number} */
function daysSince(stamp) {
  return Math.max(0, Math.round((Date.parse(todayStamp()) - Date.parse(stamp)) / DAY_MS));
}

const MONTHS =['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A date stamp as a screen shows it: `2026-10-16` as `16 Oct`. @param {string} stamp `YYYY-MM-DD` */
function dayMonth(stamp) {
  const [, month, day] = stamp.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

module.exports = { todayStamp, isoNow, dayBefore, daysSince, dayMonth };
