'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the way on once a topic leaves the board — cancelled or
// postponed (`topic cancel`, `topic postpone`). The conversation sitting in
// the topic that left goes back to its epic's menu, naming the phase it left
// and how; from anywhere else — another topic of the epic, its menu — the
// calling flow carries on. Where the conversation sits is its position
// (position.cjs).
// ---------------------------------------------------------------------------

const { handedSession } = require('../kernel/process.cjs');
const { readPosition } = require('./position.cjs');
const { UNIT_PHASES } = require('./derivations.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */

/**
 * The `next` of a topic that left, from the calling conversation's position.
 * @param {string} workUnit
 * @param {'discovery'|'specification'} stage  the unit the topic left as
 * @param {string} topic
 * @param {'cancelled'|'postponed'} outcome
 * @returns {Next}
 */
function leaveNext(workUnit, stage, topic, outcome) {
  const sessionId = handedSession();
  const at = sessionId === null ? null : readPosition(sessionId);
  const sitting = at !== null && at.name === workUnit && at.topic === topic
    && typeof at.phase === 'string' && UNIT_PHASES[stage].includes(at.phase);
  return sitting
    ? { kind: 'handoff', skill: 'leeway-continue-epic', args: [workUnit, /** @type {string} */ (at.phase), outcome] }
    : { kind: 'continue' };
}

module.exports = { leaveNext };
