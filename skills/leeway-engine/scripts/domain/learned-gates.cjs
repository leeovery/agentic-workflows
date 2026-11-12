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
//   paths in the person's words — never runs as one; nor does the conclude's
//   keep going, which would hold the investigation open with no one to end
//   it; nor the wait's wait, whose next draws the wait again while the agents
//   run, so as a step it would never stop.
// - A showing is one occurrence of a gate: drawn, then waiting, set aside
//   by free text and shown again, until a pick answers it or it runs as a
//   step. A row whose next shows the gate again at its place leaves it open
//   — the Comment at the investigation's gates, the wait's wait — and any
//   other pick answers it, the reprompt's paths in the person's words among
//   them. Its digest (`showingOf`) hashes the gate's place — unit, phase and
//   topic — with the key its surface draws it from out of its own state, the
//   same on every redraw of one showing and different between showings. Its
//   answer logs it (trust-events.cjs), so a replay draws a past showing
//   again as it was drawn: `drawnBlind(gate, showing)`.
// - A gate shows while its count asks (trust-counts.cjs): with no answers at
//   all, and until the bound on leaving its usual answer, the row picked
//   most often, falls below the person's threshold; once under, it runs as
//   a step on that row, until the bound rises a quarter above the threshold.
//   It shows besides where its usual answer has no report, and on a blind
//   ask, one showing in twenty (16.21.3), drawn from a hash of the gate's
//   name and its showing (E3) — so a redraw draws alike, and the draw is the
//   showing's, never the render's.
// - Nothing here reads: the counts, the build's position, the showing held at
//   the gate's place (showing-hold.cjs) and the time are the decision point's
//   (decision-point.cjs), and a step drawn in the place of a gate's menu is
//   the surfaces' (projections/surfaces.cjs).
// ---------------------------------------------------------------------------

const crypto = require('crypto');

/** @typedef {import('./trust-counts.cjs').State} State */
/** Where a gate comes: its unit, phase and topic, each null where it comes at none. @typedef {{unit: string|null, phase: string|null, topic: string|null}} Place */
/** A showing held at its gate's place (showing-hold.cjs): the place, and when it opened. @typedef {{place: Place, opened: string}} Hold */
/**
 * A gate's step: shown, or run as an automatic step on one of its rows —
 * each for the gate it was drawn for, on the showing it was drawn on, none
 * for a gate off the list; shown, with the showing's hold, none where the
 * decision point holds none.
 * @typedef {{step: 'show', gate: string, showing: string|null, hold: Hold|null} | {step: 'automatic', gate: string, row: string, showing: string}} GateStep
 */

/** Each learned gate by its name: the report of each row that may run as an automatic step. @type {Readonly<Record<string, Readonly<Record<string, string>>>>} */
const LEARNED = Object.freeze({
  'import reprompt': Object.freeze({
    s: 'Paths that could not be landed skipped [auto]. Landing the rest.',
  }),
  'wait for agents': Object.freeze({
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

// Each learned gate's rows whose next shows the gate again at its place, so
// a pick of one leaves its showing open; any other pick answers the gate.
/** @type {Readonly<Record<string, readonly string[]>>} */
const KEEPING = Object.freeze({
  'wait for agents': Object.freeze(['w']),
  'plan gate': Object.freeze(['comment']),
  'check-in gate': Object.freeze(['comment']),
  'conclude gate': Object.freeze(['comment']),
});

// A showing's digest, in hex digits.
const SHOWING_DIGITS = 16;

// Where a declared gate's name ends and its entry begins.
const ENTRY_SEPARATOR = ' — ';

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

/** Whether a pick of the gate `name`'s row `row` leaves its showing open. @param {string} name @param {string} row */
function keepsShowing(name, row) {
  return KEEPING[name]?.includes(row) ?? false;
}

/** The SHA-1 of `value` as JSON. @param {unknown} value */
const digest = (value) => crypto.createHash('sha1').update(JSON.stringify(value)).digest();

/**
 * The showing of a gate at `place` that its surface draws from `key`, its
 * own state: a digest, the same for the same place and key.
 * @param {Place} place @param {unknown} key @returns {string}
 */
function showingOf({ unit, phase, topic }, key) {
  return digest([unit, phase, topic, key]).toString('hex').slice(0, SHOWING_DIGITS);
}

/** Whether the gate `name`'s showing `showing` draws its blind ask (E3). @param {string} name @param {string} showing */
function drawnBlind(name, showing) {
  return digest([name, showing]).readUInt32BE(0) / 2 ** 32 < BLIND_ASK;
}

/** The gate `gate` shown on its showing `showing`, held by `hold`. @param {string} gate @param {string|null} showing @param {Hold|null} [hold] @returns {GateStep} */
const shows = (gate, showing, hold = null) => ({ step: 'show', gate, showing, hold });

/**
 * Whether the learned gate `name`, on its showing `showing`, shows or runs
 * as an automatic step on its usual row: as its count stands at the person's
 * threshold, the row's report, and its blind ask.
 * @param {string} name @param {State} state @param {string} showing
 * @returns {GateStep}
 */
function stepOf(name, { asks, usual }, showing) {
  if (asks || typeof usual !== 'string' || reportOf(name, usual) === null || drawnBlind(name, showing)) return shows(name, showing);
  return { step: 'automatic', gate: name, row: usual, showing };
}

module.exports = { LEARNED, BLIND_ASK, ENTRY_SEPARATOR, learnedGate, reportOf, keepsShowing, showingOf, drawnBlind, shows, stepOf };
