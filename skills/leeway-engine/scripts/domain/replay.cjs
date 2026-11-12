'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the replay (16.15.2, 16.15.3) — the trust log replayed
// against a setting the person proposes, so the threshold is set from
// evidence, not feel. Pure, the clock passed in, over the person's events on
// the machine, every project's, as the counts read them (trust-counts.cjs).
//
// - What it replays: the questions asked in the project — each raise the
//   person followed, its answer landed; for a raise of the threshold
//   mid-build, those that blocked build work alone, the only questions it
//   reaches (16.4.7) — over its period (P14): the last 30 days, or the
//   whole log where those hold fewer than 20.
// - Each is decided again by the ask rule (ask-rule.cjs), from what its
//   raise sealed of what its call was decided from — its label and sort,
//   whether it blocked build work, whose the decision it would replace was,
//   Claude's mark — over the counts as they stood just before it, for the
//   model its call was made under, so every walk runs again at the proposed
//   setting; with the person's settings as proposed, and the care entries
//   the record holds that stood by then. A care entry dropped since is gone
//   from the record, so the replay cannot read it.
// - Skipped: those asked that the rule, so set, lets proceed. Overruled:
//   those among them the person departed on — answered against Claude's
//   lean, or reversed since (trust-evidence.cjs).
//
// No arithmetic of its own: the rule's and the counts' functions over a
// past window.
// ---------------------------------------------------------------------------

const { rule } = require('./ask-rule.cjs');
const { countsFrom } = require('./trust-counts.cjs');
const { evidenceIn } = require('./trust-evidence.cjs');

/** @typedef {import('./ask-rule.cjs').Context} Context */
/** @typedef {import('./ask-rule.cjs').CareEntry} CareEntry */
/** @typedef {import('./trust-settings.cjs').Settings} Settings */
/** A care entry as the record holds it, with when it was added. @typedef {CareEntry & {added: string}} HeldCare */

/** The period's days (P14). */
const PERIOD_DAYS = 30;
/** The questions the period must hold, else the whole log is replayed (P14). */
const PERIOD_FLOOR = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What a replay found: when its period starts and whether it is the whole
 * log; how many questions were asked in it, how many of those the proposed
 * setting would skip, and how many of those the person overruled.
 * @typedef {{since: number|null, whole: boolean, asked: number, skipped: number, overruled: number}} Replayed
 */

/** An event's time. @param {Record<string, unknown>} event */
const timeOf = (event) => Date.parse(/** @type {string} */ (event.at));

/**
 * The questions asked in the project, in time order, up to `now`: those
 * that blocked build work alone, where `blocking`.
 * @param {Record<string, unknown>[]} events @param {string} project @param {number} now @param {boolean} blocking
 */
function askedIn(events, project, now, blocking) {
  return events
    .filter((event) => event.type === 'raise' && event.project === project && event.entry !== null && timeOf(event) <= now && (!blocking || event.blocks_build))
    .sort((a, b) => timeOf(a) - timeOf(b));
}

/**
 * The period's questions (the header's).
 * @param {Record<string, unknown>[]} asked in time order @param {number} now
 * @returns {{since: number|null, whole: boolean, questions: Record<string, unknown>[]}}
 */
function periodOf(asked, now) {
  const since = now - PERIOD_DAYS * DAY_MS;
  const recent = asked.filter((event) => timeOf(event) >= since);
  if (recent.length >= PERIOD_FLOOR) return { since, whole: false, questions: recent };
  return { since: asked.length === 0 ? null : timeOf(asked[0]), whole: true, questions: asked };
}

/**
 * The rule's decision on the question a raise asked, decided again as the
 * header says.
 * @param {Record<string, unknown>[]} events @param {Record<string, unknown>} raise
 * @param {{project: {id: string, name: string}, settings: Settings, care: HeldCare[]}} at
 */
function decidedAgain(events, raise, { project, settings, care }) {
  const before = timeOf(raise) - 1;
  // The rule reads no place, and a raise's event keeps none.
  const context = /** @type {Context} */ (/** @type {unknown} */ ({
    label: raise.label,
    blocks_build: raise.blocks_build,
    replaced_by: raise.replaced_by,
    always: raise.always,
    checked: false,
    project,
    counts: countsFrom(events, { project: project.id, model: /** @type {string|null} */ (raise.model), now: before }),
    settings,
    care: care.filter(({ added }) => Date.parse(added) <= before),
  }));
  return rule({ sort: raise.sort === 'one' ? 'one' : 'several' }, context).decision;
}

/**
 * The trust log's `events` replayed for the project `project` as of `now`
 * against `settings`, the person's as proposed (the header's): the
 * questions that blocked build work alone, where `blocking`.
 * @param {Record<string, unknown>[]} events every project's on the machine
 * @param {{project: {id: string, name: string}, settings: Settings, care: HeldCare[], now: number, blocking: boolean}} at
 * @returns {Replayed}
 */
function replay(events, { project, settings, care, now, blocking }) {
  const { since, whole, questions } = periodOf(askedIn(events, project.id, now, blocking), now);
  const departed = new Set(evidenceIn(events.filter((event) => timeOf(event) <= now)).answers
    .filter(({ standing, cancelled_by: cancelledBy }) => standing === 'departure' || cancelledBy !== null)
    .map(({ event }) => event.id));
  const skipped = questions.filter((raise) => decidedAgain(events, raise, { project, settings, care }) === 'proceed');
  return { since, whole, asked: questions.length, skipped: skipped.length, overruled: skipped.filter(({ id }) => departed.has(id)).length };
}

module.exports = { PERIOD_DAYS, PERIOD_FLOOR, replay };
