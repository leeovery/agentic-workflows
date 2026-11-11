'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the verdict page (16.10.6, 16.10.7) — the verdict queue as
// the menus' frame draws it (menus.cjs), from the view `render verdicts`
// reads (verdict.cjs).
//
// - Its title counts the departures waiting, the first of them shown: where
//   it stands — the project, and its topic, or its unit where it has no
//   topic of its own — and when: the point it was skipped at and the day,
//   or, never asked, the day it was made; then the departure's tree as a
//   verdict point draws it (closing.cjs).
// - Its rows are the three verdicts, each given at the queue, and `b/back`
//   to the start menu, the rest waiting (P7: no skip row). The frame adds
//   `h/help`.
// - Once a verdict is given at the queue, the page draws again while one
//   still waits, else the start menu (`afterVerdict`).
// ---------------------------------------------------------------------------

const { dayMonth } = require('../dates.cjs');
const { departureTree, VERDICT_QUESTION, VERDICT_ROWS } = require('./closing.cjs');

/** @typedef {import('../ledger-verdicts.cjs').Departure} Departure */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */

/**
 * What the page shows: the project's name; the name of the place the first
 * departure was made in; the departure; when it was made; the skip it waits
 * after, where one was given, by its point and time; and how many wait.
 * @typedef {{project: string, place: string, departure: Departure, made: string, skipped: {point: string, at: string}|null, waiting: number}} VerdictPage
 */

/** @type {Next} */
const START_MENU = Object.freeze({ kind: 'engine', argv: ['render', 'start-menu'] });
/** @type {Next} */
const THE_PAGE = Object.freeze({ kind: 'engine', argv: ['render', 'verdicts'] });

/** A time as the page shows its day: `21 Oct`. @param {string} at ISO-8601 */
const dayOf = (at) => dayMonth(at.slice(0, 10));

/** When the departure came to wait: skipped at its point, or made. @param {VerdictPage} view */
function since({ made, skipped }) {
  return skipped === null ? `changed ${dayOf(made)}` : `skipped at ${skipped.point.replaceAll('-', ' ')}, ${dayOf(skipped.at)}`;
}

/**
 * The page's screen, for the frame to draw (the header's).
 * @param {VerdictPage} view
 * @returns {MenuScreen}
 */
function verdictPage(view) {
  const { departure } = view;
  return {
    title: `Verdicts · 1 of ${view.waiting} waiting`,
    shows: [`${view.project} · ${view.place} · ${since(view)}`, ...departureTree(departure).replace(/\n+$/, '').split('\n')],
    question: VERDICT_QUESTION,
    rows: VERDICT_ROWS.map(({ key, verdict, label }) => ({
      key, word: verdict, label, next: { kind: 'engine', argv: ['verdict', 'give', departure.entry, verdict, '--at', 'queue'] },
    })),
    back: { label: 'Back to the start menu — the rest keep waiting', next: START_MENU },
  };
}

/** Where a verdict given at the queue leads: the page again while `waiting` departures still wait, else the start menu. @param {number} waiting @returns {Next} */
const afterVerdict = (waiting) => (waiting > 0 ? THE_PAGE : START_MENU);

module.exports = { verdictPage, afterVerdict };
