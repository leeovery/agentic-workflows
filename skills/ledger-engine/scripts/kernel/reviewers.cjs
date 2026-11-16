'use strict';

// ---------------------------------------------------------------------------
// Kernel: the reviewers' count (13.3.4) — how many reviewer agents review
// each task, each phase and each area of the review phase side by side, two
// as ruled. Two is a measurement of today's review recall, so the model
// pass's re-measure changes this one value (2.4.6). Each reviewer is known
// by a letter, `a` onwards: the layout's report places take one each
// (layout.cjs), a fix round's brief carries each one's report
// (brief-records.cjs), and a phase's close checks every one passed (6.4.9).
// ---------------------------------------------------------------------------

const REVIEWERS = 2;

/** Each reviewer's letter, in order. */
const REVIEWER_LETTERS = Object.freeze(Array.from({ length: REVIEWERS }, (_, at) => String.fromCharCode(0x61 + at)));

module.exports = { REVIEWERS, REVIEWER_LETTERS };
