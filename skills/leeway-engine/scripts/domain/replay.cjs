'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the replay (16.15.2, 16.15.3) — the trust log replayed
// against a setting the person proposes, so the threshold is set from
// evidence, not feel. Pure, the clock passed in, over the person's events on
// the machine, every project's, as the counts read them (trust-counts.cjs).
//
// - What it replays, in the project, each question at the time the rule
//   decided it — a raise's as its raise sealed it, which its answer may
//   follow long after; a call's as it landed (trust-events.cjs):
//   - a setting above the person's own: the questions they were asked,
//     each raise followed, its answer landed; it can only ask them less;
//   - one below it: Claude's calls that went ahead, each one a raise
//     decided; it can only ask them more.
//   For a raise of the threshold mid-build, those that blocked build work
//   alone, the only questions it reaches (16.4.7). Over its period (P14):
//   the last 30 days, or the whole log where those hold fewer than 20 of
//   what it replays.
// - Each is decided again by the ask rule (ask-rule.cjs), at the setting
//   proposed and at the person's own, from what its event holds of what the
//   call was decided from — its label and sort, whether it blocked build
//   work, whose the decision it would replace was and Claude's mark, which a
//   call that went ahead held none of — over the counts as they stood just
//   before it was decided, for the model its call was decided under; with
//   the care entries the record holds that stood by then. A care entry
//   dropped since is gone from the record, so the replay cannot read it;
//   nor does an event hold the experiment that measured its question, so
//   the replay reads none.
// - What it would have changed: asking less, the questions the setting
//   proposed lets go ahead where the person's own asks — skipped — and those
//   among them the person departed on, answered against Claude's lean or
//   reversed since; asking more, the calls it asks where the person's own
//   went ahead, and those among them the person reversed since — overruled
//   (trust-evidence.cjs).
// - One walk through time: the questions in the order decided, the counts
//   read once and each count walked on from one question to the next
//   (trust-counts.cjs). The counts are read again only where the person
//   corrected a kind, from that correction on, as a correction moves an
//   answer's kind back to its first count.
//
// No arithmetic of its own: the rule's and the counts' functions over a
// past window.
// ---------------------------------------------------------------------------

const { rule } = require('./ask-rule.cjs');
const { countsFrom } = require('./trust-counts.cjs');
const { evidenceIn } = require('./trust-evidence.cjs');
const { midBuild } = require('./trust-settings.cjs');

/** @typedef {import('./ask-rule.cjs').Context} Context */
/** @typedef {import('./ask-rule.cjs').CareEntry} CareEntry */
/** @typedef {import('./trust-counts.cjs').Counts} Counts */
/** @typedef {import('./trust-counts.cjs').Count} Count */
/** @typedef {import('./trust-settings.cjs').Settings} Settings */
/** A care entry as the record holds it, with when it was added. @typedef {CareEntry & {added: string}} HeldCare */
/** The counts a question is decided over, for the model its call was decided under, just before it was decided. @typedef {(model: string|null, until: number) => Counts} CountsAlong */

/** The period's days (P14). */
const PERIOD_DAYS = 30;
/** What the period must hold, else the whole log is replayed (P14). */
const PERIOD_FLOOR = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What a replay found: when its period starts and whether it is the whole
 * log; whether the setting proposed asks more than the person's own; how
 * many questions it replayed, how many of those the setting would have
 * changed, and how many of those the person overruled.
 * @typedef {{since: number|null, whole: boolean, more: boolean, questions: number, changed: number, overruled: number}} Replayed
 */

/** An event's time. @param {Record<string, unknown>} event */
const timeOf = (event) => Date.parse(/** @type {string} */ (event.at));

/** When the rule decided the question an event is about (the header's). @param {Record<string, unknown>} event */
const decidedAt = (event) => Date.parse(/** @type {string} */ (event.type === 'raise' ? event.raised : event.at));

/** The line `settings` draw where the replay reads: mid-build, or elsewhere. @param {Settings} settings @param {boolean} blocking */
const lineOf = (settings, blocking) => (blocking ? midBuild(settings) : settings.threshold);

/**
 * What the replay decides again in the project (the header's), in the order
 * decided: Claude's calls that went ahead where it asks `more`, else the
 * questions asked; those that blocked build work alone, where `blocking`.
 * @param {Record<string, unknown>[]} happened @param {string} project @param {boolean} more @param {boolean} blocking
 */
function replayed(happened, project, more, blocking) {
  const reads = more
    ? (/** @type {Record<string, unknown>} */ event) => event.type === 'call' && event.sort !== null
    : (/** @type {Record<string, unknown>} */ event) => event.type === 'raise' && event.entry !== null;
  return happened
    .filter((event) => event.project === project && reads(event) && (!blocking || event.blocks_build === true))
    .sort((a, b) => decidedAt(a) - decidedAt(b));
}

/**
 * The period's questions (the header's).
 * @param {Record<string, unknown>[]} questions in the order decided @param {number} now
 * @returns {{since: number|null, whole: boolean, questions: Record<string, unknown>[]}}
 */
function periodOf(questions, now) {
  const since = now - PERIOD_DAYS * DAY_MS;
  const recent = questions.filter((event) => decidedAt(event) >= since);
  if (recent.length >= PERIOD_FLOOR) return { since, whole: false, questions: recent };
  return { since: questions.length === 0 ? null : decidedAt(questions[0]), whole: true, questions };
}

/**
 * The counts along the walk (the header's): read once for each model and
 * each stretch between the person's corrections of a kind, each count read
 * up to the time asked for.
 * @param {Record<string, unknown>[]} happened @param {string} project @param {number} now
 * @returns {CountsAlong}
 */
function countsAlong(happened, project, now) {
  const corrected = happened.filter((event) => event.type === 'correction' && event.kind !== null).map(timeOf).sort((a, b) => a - b);
  /** @type {Map<string, Counts>} */
  const read = new Map();
  return (model, until) => {
    const stretch = corrected.filter((at) => at <= until).length;
    const key = `${stretch} ${model}`;
    let counts = read.get(key);
    if (counts === undefined) read.set(key, counts = countsFrom(happened, { project, model, now: stretch < corrected.length ? corrected[stretch] - 1 : now }));
    const upTo = (/** @type {Count} */ count) => ({ ...count, until });
    return { kinds: /** @type {Counts['kinds']} */ (Object.fromEntries(Object.entries(counts.kinds).map(([kind, count]) => [kind, upTo(count)]))), one: upTo(counts.one), gates: counts.gates };
  };
}

/**
 * Whether the rule, at `settings`, lets the question `event` is about go
 * ahead, decided again as the header says.
 * @param {Record<string, unknown>} event @param {Settings} settings
 * @param {{project: {id: string, name: string}, counts: CountsAlong, care: HeldCare[]}} along
 */
function goesAhead(event, settings, { project, counts, care }) {
  const before = decidedAt(event) - 1;
  // The rule reads no place, and an event keeps none, nor the experiment
  // that measured its question.
  const context = /** @type {Context} */ (/** @type {unknown} */ ({
    label: event.label,
    blocks_build: event.blocks_build === true,
    replaced_by: event.replaced_by ?? null,
    always: event.always ?? null,
    measured: null,
    checked: false,
    project,
    counts: counts(/** @type {string|null} */ (event.model), before),
    settings,
    care: care.filter(({ added }) => Date.parse(added) <= before),
  }));
  return rule({ sort: event.sort === 'one' ? 'one' : 'several' }, context).decision === 'proceed';
}

/**
 * The trust log's `events` replayed for the project `project` as of `now`
 * against `proposed`, in place of the person's `settings` (the header's):
 * the questions that blocked build work alone, where `blocking`.
 * @param {Record<string, unknown>[]} events every project's on the machine
 * @param {{project: {id: string, name: string}, settings: Settings, proposed: Settings, care: HeldCare[], now: number, blocking: boolean}} at
 * @returns {Replayed}
 */
function replay(events, { project, settings, proposed, care, now, blocking }) {
  const happened = events.filter((event) => timeOf(event) <= now);
  const more = lineOf(proposed, blocking) < lineOf(settings, blocking);
  const { since, whole, questions } = periodOf(replayed(happened, project.id, more, blocking), now);
  const along = { project, counts: countsAlong(happened, project.id, now), care };
  const [asks, goes] = more ? [proposed, settings] : [settings, proposed];
  const changed = questions.filter((event) => goesAhead(event, goes, along) && !goesAhead(event, asks, along));
  const overruled = new Set(evidenceIn(happened).answers
    .filter(({ standing, cancelled_by: cancelledBy }) => standing === 'departure' || cancelledBy !== null)
    .map(({ event }) => event.id));
  return { since, whole, more, questions: questions.length, changed: changed.length, overruled: changed.filter(({ id }) => overruled.has(id)).length };
}

module.exports = { PERIOD_DAYS, PERIOD_FLOOR, replay };
