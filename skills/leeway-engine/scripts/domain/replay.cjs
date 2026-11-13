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
//   alone, the only questions it reaches (16.4.7). And for the threshold,
//   which the learned gates read too (16.20.2), each showing of a learned
//   gate at the time it came: above the person's own, the showings they
//   answered, each by its first answer, as the gate's count reads it; below
//   it, the gates' automatic steps (decision-point.cjs). Over its period
//   (P14): the last 30 days, or the whole log where those hold fewer than 20
//   questions, its start then the first of what it replays.
// - Each question is decided again by the ask rule (ask-rule.cjs), at the
//   setting proposed and at the person's own, from what its event holds of
//   what the call was decided from — its label and sort, whether it blocked
//   build work, whose the decision it would replace was, Claude's mark and
//   the experiment that measured its question, which a call that went ahead
//   held none of — over the counts as they stood just before it was
//   decided, for the model its call was decided under; with the care
//   entries that stood by then: those the record holds now added by then,
//   and those dropped since that were added by then, each drop the trust
//   log's, paired with the entry it removed by its project, kind and when
//   it was added. A care entry the person took out of the record by hand
//   logged no drop, so the replay reads it as never having stood.
// - Where the rule lets a question go ahead, the blind draw draws it again,
//   by the draw's own function on the question's id its raise logged, at the
//   share the counts gave then (decision-point.cjs `drawsBlind`): one drawn
//   blind is asked, never skipped. A call that went ahead logs no id to
//   draw, and needs none: it went ahead undrawn, or drawn blind on a call
//   cheap to undo mid-build, which goes ahead while its question waits
//   (16.17.6) — alike at either setting, the draw being the same — so only
//   the rule tells the two settings apart on it.
// - Each showing is decided again by its gate's count as it stood just
//   before, for the model of the session it came in, at the threshold
//   proposed and at the person's own, its blind ask drawn again from its
//   gate and its showing (learned-gates.cjs `stepOf`).
// - What it would have changed: asking less, the questions the setting
//   proposed lets go ahead where the person's own asks — skipped — and those
//   among them the person departed on, answered against Claude's lean or
//   reversed since; asking more, the calls it asks where the person's own
//   went ahead, and those among them the person reversed since, or answered
//   otherwise than Claude's call gone ahead on the blind question drawn on
//   it — overruled (trust-evidence.cjs). At the gates, asking less, the
//   showings it runs as steps where the person's own shows them, and those
//   among them the person answered other than the row the step would have
//   run; asking more, the steps it shows.
// - One walk through time: the questions and the showings each in the order
//   decided, the counts read once and each count walked on from one to the
//   next (trust-counts.cjs). The counts are read again only where the person
//   corrected a kind, from that correction on, as a correction moves an
//   answer's kind back to its first count.
//
// No arithmetic of its own: the rule's, the draw's and the counts' functions
// over a past window.
// ---------------------------------------------------------------------------

const { rule } = require('./ask-rule.cjs');
const { countsFrom, gateCount, stateOf } = require('./trust-counts.cjs');
const { evidenceIn } = require('./trust-evidence.cjs');
const { midBuild } = require('./trust-settings.cjs');
const { drawsBlind } = require('./decision-point.cjs');
const { stepOf } = require('./learned-gates.cjs');

/** @typedef {import('./ask-rule.cjs').Context} Context */
/** @typedef {import('./ask-rule.cjs').CareEntry} CareEntry */
/** @typedef {import('./labeller.cjs').Label} Label */
/** @typedef {import('./trust-counts.cjs').Counts} Counts */
/** @typedef {import('./trust-counts.cjs').Count} Count */
/** @typedef {import('./trust-settings.cjs').Settings} Settings */
/** A care entry as the record holds it, with when it was added. @typedef {CareEntry & {added: string}} HeldCare */
/** The counts a question or a showing is decided over, for the model its call was decided under, just before it was decided. @typedef {(model: string|null, until: number) => Counts} CountsAlong */
/** The care entries standing just before a question was decided. @typedef {(until: number) => CareEntry[]} CareAlong */
/** What a question is decided again along: the project, the counts and the care entries as they stood. @typedef {{project: {id: string, name: string}, counts: CountsAlong, care: CareAlong}} Along */

/** The period's days (P14). */
const PERIOD_DAYS = 30;
/** What the period must hold, else the whole log is replayed (P14). */
const PERIOD_FLOOR = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What a replay found at the learned gates: how many showings it replayed,
 * how many of those the setting would have changed, and how many of those
 * the person answered other than the step would have run.
 * @typedef {{showings: number, changed: number, overruled: number}} GatesReplayed
 */
/**
 * What a replay found: when its period starts and whether it is the whole
 * log; whether the setting proposed asks more than the person's own; how
 * many questions it replayed, how many of those the setting would have
 * changed, and how many of those the person overruled; and the gates'.
 * @typedef {{since: number|null, whole: boolean, more: boolean, questions: number, changed: number, overruled: number, gates: GatesReplayed}} Replayed
 */

/** An event's time. @param {Record<string, unknown>} event */
const timeOf = (event) => Date.parse(/** @type {string} */ (event.at));

/** When the rule decided the question an event is about, or its gate's step (the header's). @param {Record<string, unknown>} event */
const decidedAt = (event) => Date.parse(/** @type {string} */ (event.type === 'raise' ? event.raised : event.at));

/** The line `settings` draw where the replay reads: mid-build, or elsewhere. @param {Settings} settings @param {boolean} blocking */
const lineOf = (settings, blocking) => (blocking ? midBuild(settings) : settings.threshold);

/** `events` in the order decided. @param {Record<string, unknown>[]} events */
const inOrder = (events) => events.sort((a, b) => decidedAt(a) - decidedAt(b));

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
  return inOrder(happened.filter((event) => event.project === project && reads(event) && (!blocking || event.blocks_build === true)));
}

/**
 * The learned gates' showings the replay decides again in the project (the
 * header's), in the order they came: the steps where it asks `more`, else
 * the showings answered.
 * @param {Record<string, unknown>[]} happened @param {string} project @param {boolean} more
 */
function showingsOf(happened, project, more) {
  const reads = more
    ? (/** @type {Record<string, unknown>} */ event) => event.type === 'step'
    : (/** @type {Record<string, unknown>} */ event) => event.type === 'gate' && event.showing !== null;
  return inOrder(happened.filter((event) => event.project === project && reads(event)));
}

/**
 * The period's questions and showings (the header's).
 * @param {Record<string, unknown>[]} questions in the order decided @param {Record<string, unknown>[]} showings in the order they came @param {number} now
 * @returns {{since: number|null, whole: boolean, questions: Record<string, unknown>[], showings: Record<string, unknown>[]}}
 */
function periodOf(questions, showings, now) {
  const since = now - PERIOD_DAYS * DAY_MS;
  const recent = questions.filter((event) => decidedAt(event) >= since);
  if (recent.length >= PERIOD_FLOOR) return { since, whole: false, questions: recent, showings: showings.filter((event) => decidedAt(event) >= since) };
  const firsts = [questions[0], showings[0]].filter((event) => event !== undefined).map(decidedAt);
  return { since: firsts.length === 0 ? null : Math.min(...firsts), whole: true, questions, showings };
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
    return {
      kinds: /** @type {Counts['kinds']} */ (Object.fromEntries(Object.entries(counts.kinds).map(([kind, count]) => [kind, upTo(count)]))),
      one: upTo(counts.one),
      gates: new Map([...counts.gates].map(([name, count]) => [name, upTo(count)])),
    };
  };
}

/**
 * The care entries along the walk (the header's): each entry the record
 * holds `held`, standing from when it was added on, and each the trust log
 * `happened` holds dropped, from when it was added until its drop.
 * @param {HeldCare[]} held @param {Record<string, unknown>[]} happened
 * @returns {CareAlong}
 */
function careAlong(held, happened) {
  const stood = [
    ...held.map(({ project, kind, added }) => ({ project, kind, from: Date.parse(added), to: Infinity })),
    ...happened.filter((event) => event.type === 'care-drop').map((event) => ({
      project: /** @type {string} */ (event.project), kind: /** @type {CareEntry['kind']} */ (event.kind), from: Date.parse(/** @type {string} */ (event.added)), to: timeOf(event),
    })),
  ];
  return (until) => stood.filter(({ from, to }) => from <= until && to > until).map(({ project, kind }) => ({ project, kind }));
}

/**
 * Whether the rule, at `settings`, asks the question `event` is about,
 * decided again as the header says: asked, or drawn blind where it would
 * go ahead.
 * @param {Record<string, unknown>} event @param {Settings} settings @param {Along} along
 */
function asks(event, settings, { project, counts, care }) {
  const before = decidedAt(event) - 1;
  const call = { sort: /** @type {'one'|'several'} */ (event.sort === 'one' ? 'one' : 'several') };
  const label = /** @type {Label|null} */ (event.label);
  const stood = counts(/** @type {string|null} */ (event.model), before);
  // The rule reads no place, and an event keeps none.
  const context = /** @type {Context} */ (/** @type {unknown} */ ({
    label,
    blocks_build: event.blocks_build === true,
    replaced_by: event.replaced_by ?? null,
    always: event.always ?? null,
    measured: event.measured ?? null,
    checked: false,
    project,
    counts: stood,
    settings,
    care: care(before),
  }));
  if (rule(call, context).decision !== 'proceed') return true;
  return drawsBlind(call, /** @type {Label} */ (label), stood, /** @type {string|null} */ (event.chain ?? null));
}

/**
 * The row the showing `event` came on would have run as a step at
 * `threshold`, decided again as the header says; null where it would show.
 * @param {Record<string, unknown>} event @param {number} threshold @param {CountsAlong} counts
 */
function stepRow(event, threshold, counts) {
  const gate = /** @type {string} */ (event.gate);
  const count = gateCount(counts(/** @type {string|null} */ (event.model), decidedAt(event) - 1), gate);
  const step = stepOf(gate, stateOf(count, threshold), /** @type {string} */ (event.showing));
  return step.step === 'automatic' ? step.row : null;
}

/**
 * The questions among those `happened` holds that the person overruled
 * (the header's), each event by its id.
 * @param {Record<string, unknown>[]} happened
 * @returns {(event: Record<string, unknown>) => boolean}
 */
function overruledIn(happened) {
  const { answers } = evidenceIn(happened);
  const overruled = new Set(answers.filter(({ standing, cancelled_by: cancelledBy }) => standing === 'departure' || cancelledBy !== null).map(({ event }) => event.id));
  const wentAhead = new Set(answers.filter(({ standing, event }) => standing === 'departure' && event.type === 'raise' && event.blind && event.replaces !== null).map(({ event }) => event.replaces));
  return (event) => overruled.has(event.id) || (event.type === 'call' && wentAhead.has(event.entry));
}

/**
 * The showings `showings` replayed (the header's): those the setting
 * `going` runs as steps where `asking` shows them, and, where they are the
 * person's answers, those among them answered other than the step's row.
 * @param {Record<string, unknown>[]} showings @param {number} asking @param {number} going @param {CountsAlong} counts
 * @returns {GatesReplayed}
 */
function gatesReplayed(showings, asking, going, counts) {
  let changed = 0;
  let overruled = 0;
  for (const event of showings) {
    const ran = stepRow(event, going, counts);
    if (ran === null || stepRow(event, asking, counts) !== null) continue;
    changed += 1;
    if (event.type === 'gate' && (event.picked ?? event.reading) !== ran) overruled += 1;
  }
  return { showings: showings.length, changed, overruled };
}

/**
 * The trust log's `events` replayed for the project `project` as of `now`
 * against `proposed`, in place of the person's `settings` (the header's):
 * the questions that blocked build work alone, and no gate, where
 * `blocking`.
 * @param {Record<string, unknown>[]} events every project's on the machine
 * @param {{project: {id: string, name: string}, settings: Settings, proposed: Settings, care: HeldCare[], now: number, blocking: boolean}} at
 * @returns {Replayed}
 */
function replay(events, { project, settings, proposed, care, now, blocking }) {
  const happened = events.filter((event) => timeOf(event) <= now);
  const more = lineOf(proposed, blocking) < lineOf(settings, blocking);
  const { since, whole, questions, showings } = periodOf(replayed(happened, project.id, more, blocking), blocking ? [] : showingsOf(happened, project.id, more), now);
  const along = { project, counts: countsAlong(happened, project.id, now), care: careAlong(care, happened) };
  const [asking, going] = more ? [proposed, settings] : [settings, proposed];
  const changed = questions.filter((event) => asks(event, asking, along) && !asks(event, going, along));
  const overrules = overruledIn(happened);
  return {
    since,
    whole,
    more,
    questions: questions.length,
    changed: changed.length,
    overruled: changed.filter(overrules).length,
    gates: gatesReplayed(showings, asking.threshold, going.threshold, along.counts),
  };
}

module.exports = { PERIOD_DAYS, PERIOD_FLOOR, replay };
