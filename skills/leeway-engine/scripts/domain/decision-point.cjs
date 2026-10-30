'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the decision point (16.1, 16.2) — whether a call Claude has a
// lean on goes to the person. One function, reached by every raise
// (raise.cjs): Claude supplies the question and its lean, never the
// decision. It answers ask, proceed (the call lands as Claude's) or ask
// blind, and the reason the person is shown for it.
//
// Until the ask rule is built (29.19), every call asks (29.5.2), with the
// rule's own reason; 29.19 replaces the body with the arithmetic over the
// trust log's counts (16.4).
// ---------------------------------------------------------------------------

/** @typedef {'ask'|'proceed'|'blind'} Decision */

const EVERY_CALL_ASKS = 'Every call comes to you for now: the counts that would let me decide aren\'t built yet.';

/**
 * Whether the call goes to the person, and why.
 * @param {import('./raise.cjs').Call} _call
 * @returns {{decision: Decision, reason: string}}
 */
function decide(_call) {
  return { decision: 'ask', reason: EVERY_CALL_ASKS };
}

module.exports = { decide };
