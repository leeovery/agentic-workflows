'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the way on once a topic or a unit leaves from inside its own
// session (18.4.20, 24.1.2). A topic cancelled or postponed (`topic cancel`,
// `topic postpone`) takes the conversation sitting in its discussion to its
// epic's menu; a unit cancelled (`workunit cancel`) takes the conversation
// sitting in any phase of it to the start menu. From anywhere else — another
// topic of the epic, its menu, manage on the start menu — the calling flow
// carries on. Where the conversation sits is its position (position.cjs).
// ---------------------------------------------------------------------------

const { handedSession } = require('../kernel/process.cjs');
const { readPosition } = require('./position.cjs');
const { UNIT_PHASES } = require('./derivations.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */

const CONTINUE = Object.freeze({ kind: 'continue' });

/** Where the calling conversation sits, or null where it sits nowhere. */
function sittingAt() {
  const sessionId = handedSession();
  return sessionId === null ? null : readPosition(sessionId);
}

/**
 * The `next` of a topic that left, from the calling conversation's position.
 * @param {string} workUnit @param {string} topic
 * @returns {Next}
 */
function leaveNext(workUnit, topic) {
  const at = sittingAt();
  const sitting = at !== null && at.name === workUnit && at.topic === topic
    && typeof at.phase === 'string' && UNIT_PHASES.discovery.includes(at.phase);
  return sitting ? { kind: 'handoff', skill: 'leeway-continue-epic', args: [workUnit] } : CONTINUE;
}

/**
 * The `next` of a unit cancelled, from the calling conversation's position.
 * @param {string} workUnit
 * @returns {Next}
 */
function unitLeaveNext(workUnit) {
  const at = sittingAt();
  const sitting = at !== null && at.name === workUnit && typeof at.phase === 'string';
  return sitting ? { kind: 'handoff', skill: 'leeway', args: [] } : CONTINUE;
}

module.exports = { leaveNext, unitLeaveNext };
