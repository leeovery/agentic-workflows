'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the learned process gates (3.2.7, 16.20.2) — the gates the
// person's own answers can turn into an automatic step, each by its name with
// the one-line report of each row that may run as one (3.2.9); and whether
// such a gate shows or runs as a step, from its count.
//
// - The list is explicit (P4) and pools nothing (16.14.7): discovery's import
//   prompt (8.8.12); the wait for a topic's running agents, the one gate
//   around a discussion's reviews (9.7.8, 9.8.12); an investigation's plan,
//   check-in and conclude (19.4.19); and the experiment's spawn, now or later
//   (24.1.2). No authority gate is on it (3.2.3, 16.20.4), and neither are
//   the build's gate after a task and its phase merge, which show only in
//   step, where every process gate stops (3.3.3, 7.2.4). Each name is the
//   gate's key in the trust log for good (16.11.9), declared by one MENU, and
//   one with an entry after it, `{name} — {entry}`, is that gate.
// - A row that may run as a step has its report. A typed row — a Comment,
//   paths in the person's words — never runs as one, and neither does the
//   conclude's keep going, which would hold the investigation open with no
//   one to end it.
// - A gate shows while its count asks (trust-counts.cjs): with no answers at
//   all, and until the bound on leaving its usual answer, the row picked
//   most often, falls below the person's threshold; once under, it runs as
//   a step on that row, until the bound rises a quarter above the threshold.
//   It shows besides where its usual answer has no report, and on a blind
//   ask, one showing in twenty (16.21.3), drawn from a hash of the gate's
//   name, its unit, its topic and how many answers it holds (E3) — so a gate
//   drawn again before its next answer draws alike, and the draw is the
//   occurrence's, never the render's.
// - Nothing here reads: the counts, the build's position and the time are the
//   decision point's (decision-point.cjs), and a step drawn in the place of a
//   gate's menu is the surfaces' (projections/surfaces.cjs).
// ---------------------------------------------------------------------------

const crypto = require('crypto');

/** @typedef {import('./trust-counts.cjs').State} State */
/** A learned gate shows, or runs as an automatic step on one of its rows. @typedef {{step: 'show'} | {step: 'automatic', row: string}} GateStep */
/** What a gate's blind ask is drawn from, beside its name. @typedef {{unit: string|null, topic: string|null, answers: number}} Draw */

/** Each learned gate by its name: the report of each row that may run as an automatic step. @type {Readonly<Record<string, Readonly<Record<string, string>>>>} */
const LEARNED = Object.freeze({
  'import reprompt': Object.freeze({
    s: 'Paths that could not be landed skipped [auto]. Carrying on with what landed.',
  }),
  'wait for agents': Object.freeze({
    w: 'Waiting for the running agents [auto]. Taking in what they find first.',
    g: 'Going on without the running agents [auto]. Their reports wait for the next opening.',
  }),
  'plan gate': Object.freeze({
    y: 'Analysis plan approved [auto]. Checking the hypotheses in this order.',
  }),
  'check-in gate': Object.freeze({
    y: 'Check-in approved [auto]. Carrying on with what\'s next.',
  }),
  'conclude gate': Object.freeze({
    y: 'Investigation concluded [auto]. Moving to the specification.',
  }),
  'experiment spawn gate': Object.freeze({
    y: 'Experiment worked now [auto]. Opening the laboratory.',
    l: 'Experiment left for later [auto]. Its question waits for the result.',
  }),
});

// The share of a gate's showings asked blind once it runs as a step (16.20.2).
const BLIND_ASK = 0.05;

// Where a declared gate's name ends and its entry begins, as gate.cjs reads it.
const ENTRY_SEPARATOR = ' — ';

const SHOWS = /** @type {GateStep} */ (Object.freeze({ step: 'show' }));

/**
 * The learned gate a MENU declares, by its name — `{name} — {entry}` is the
 * gate `name` — or null where it declares none.
 * @param {string} declared @returns {string|null}
 */
function learnedGate(declared) {
  const name = declared.split(ENTRY_SEPARATOR)[0];
  return Object.hasOwn(LEARNED, name) ? name : null;
}

/** The report of the learned gate `name`'s row `row`, or null where it never runs as a step. @param {string} name @param {string} row */
function reportOf(name, row) {
  const reports = LEARNED[name];
  return reports !== undefined && Object.hasOwn(reports, row) ? reports[row] : null;
}

/**
 * Whether the gate `name`, at its unit and topic with `answers` answers,
 * draws its blind ask (E3).
 * @param {string} name @param {Draw} draw
 */
function drawnBlind(name, { unit, topic, answers }) {
  const digest = crypto.createHash('sha1').update(JSON.stringify([name, unit, topic, answers])).digest();
  return digest.readUInt32BE(0) / 2 ** 32 < BLIND_ASK;
}

/**
 * Whether the learned gate `name` shows, or runs as an automatic step on its
 * usual row: as its count stands at the person's threshold, the row's report,
 * and its blind ask.
 * @param {string} name @param {State} state @param {Draw} draw
 * @returns {GateStep}
 */
function stepOf(name, { asks, usual }, draw) {
  if (asks || typeof usual !== 'string' || reportOf(name, usual) === null || drawnBlind(name, draw)) return SHOWS;
  return { step: 'automatic', row: usual };
}

module.exports = { LEARNED, BLIND_ASK, SHOWS, learnedGate, reportOf, drawnBlind, stepOf };
