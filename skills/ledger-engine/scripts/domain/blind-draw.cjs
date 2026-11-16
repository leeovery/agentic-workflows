'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the blind draw (16.17.3, 16.17.4, 16.17.9) — whether a call
// the ask rule lets proceed, on a question, is asked blind. Pure, the counts
// passed in. The question's id turned into a number, the first 32 bits of
// its SHA-1 as a fraction, as the measured replay drew
// (trust/replay_rule.py), drawing blind under the share — the wider share
// while the call's count holds few answers of the project's own at the
// session's model (trust-settings.cjs) — so the same question draws the same
// way however often it is raised, and no tally is kept (16.17.4). A call on
// no question, a replacement's, is never drawn. The decision point draws a
// call as it is raised (decision-point.cjs), the replay a past question
// again by the id its raise logged (replay.cjs).
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { kindOf } = require('./labeller.cjs');
const { ownOf } = require('./trust-counts.cjs');
const { BLIND_SHARE, WIDE_BLIND_SHARE, WIDE_UNTIL } = require('./trust-settings.cjs');

/** @typedef {import('./trust-counts.cjs').Counts} Counts */

// The draw reads the first 32 bits of the id's SHA-1: 8 hex digits.
const DRAW_DIGITS = 8;
const DRAW_RANGE = 2 ** 32;

/** The question's id as a number from 0 up to 1 (16.17.4). @param {string} question */
function drawOf(question) {
  return parseInt(crypto.createHash('sha1').update(question).digest('hex').slice(0, DRAW_DIGITS), 16) / DRAW_RANGE;
}

/**
 * The share of the call's kind's calls — of the one-answer calls, for a
 * call sorted `one` — drawn blind: the wide share while its count holds
 * fewer than WIDE_UNTIL answers of the project's own at the session's
 * model.
 * @param {{sort: 'one'|'several'}} call @param {import('./labeller.cjs').Label} label @param {Counts} counts
 */
function blindShare({ sort }, label, counts) {
  const count = sort === 'one' ? counts.one : counts.kinds[/** @type {import('./event-fields.cjs').Kind} */ (kindOf(label))];
  return ownOf(count) < WIDE_UNTIL ? WIDE_BLIND_SHARE : BLIND_SHARE;
}

/**
 * Whether a call the rule lets proceed, on the question whose id is
 * `chain`, is drawn blind over `counts`: never one on no question, `chain`
 * null.
 * @param {{sort: 'one'|'several'}} call @param {import('./labeller.cjs').Label} label @param {Counts} counts @param {string|null} chain
 */
function drawsBlind(call, label, counts, chain) {
  return chain !== null && drawOf(chain) < blindShare(call, label, counts);
}

module.exports = { drawsBlind };
