'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the way on once a topic or a unit leaves from inside its own
// session (18.4.20, 24.1.2). A topic cancelled or postponed (`topic cancel`,
// `topic postpone`) takes the conversation sitting in its discussion to its
// epic's menu; a unit cancelled (`workunit cancel`) takes the conversation
// sitting in any phase of it to the start menu. From anywhere else — another
// topic of the epic, its menu, manage on the start menu — the calling flow
// carries on. Where the conversation sits is its position (position.cjs).
// A unit's laboratory left for the menu — its record picker's back, its
// next experiment's gate's menu row — goes onto the epic's menu for an epic,
// and the start menu for any other unit (render.cjs).
//
// A cancel puts each roadmap item it took in back on the horizon it came
// from; one whose horizon was removed meanwhile comes back on none, and the
// horizon is the person's to name (18.8.20, 18.8.2). So a cancel's way on
// first leads through the pick of a horizon for each item on none, one at
// a time — `render horizon-pick --back <item> --from <what was cancelled>`,
// each row moving the item there by `roadmap move … --from`, whose answer
// leads to the next such item, and past the last, on to where the cancel
// goes, as above. What was cancelled is named as the cancel named it: the
// unit, `<wu>`, or the topic, `<wu>.discovery.<topic>`. The position is
// read where the chain ends, the conversation still sitting where the
// cancel left it.
// ---------------------------------------------------------------------------

const { handedSession } = require('../kernel/process.cjs');
const { readPosition } = require('./position.cjs');
const { UNIT_PHASES } = require('./derivations.cjs');
const { roadmapState } = require('./roadmap.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */

const CONTINUE = Object.freeze({ kind: 'continue' });
const ONTO_START = Object.freeze({ kind: 'handoff', skill: 'leeway', args: [] });

/** The way onto the epic's menu. @param {string} workUnit @returns {Next} */
const ontoEpic = (workUnit) => ({ kind: 'handoff', skill: 'leeway-continue-epic', args: [workUnit] });

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
  return sitting ? ontoEpic(workUnit) : CONTINUE;
}

/**
 * The `next` of a unit cancelled, from the calling conversation's position.
 * @param {string} workUnit
 * @returns {Next}
 */
function unitLeaveNext(workUnit) {
  const at = sittingAt();
  const sitting = at !== null && at.name === workUnit && typeof at.phase === 'string';
  return sitting ? ONTO_START : CONTINUE;
}

/**
 * The `next` of a unit's laboratory left for the menu (the header's).
 * @param {string} workUnit @param {string} workType
 * @returns {Next}
 */
function labLeaveNext(workUnit, workType) {
  return workType === 'epic' ? ontoEpic(workUnit) : ONTO_START;
}

/**
 * What was cancelled, read from its name: a unit, or one of its topics at
 * discovery. Refused in any other shape.
 * @param {string} from @returns {{workUnit: string, topic: string|null}}
 */
function cancelledFrom(from) {
  const [workUnit, phase, topic, ...extra] = from.split('.');
  if (workUnit === '' || extra.length > 0 || (phase !== undefined && (phase !== 'discovery' || !topic))) {
    throw new Error(`--from names what was cancelled — <work_unit>, or <work_unit>.discovery.<topic> — got "${from}"`);
  }
  return { workUnit, topic: topic ?? null };
}

/**
 * Where a cancel goes once every item it put back has a horizon: a topic's
 * as `leaveNext` says, a unit's as `unitLeaveNext` says.
 * @param {string} from @returns {Next}
 */
function cancelWayOn(from) {
  const { workUnit, topic } = cancelledFrom(from);
  return topic === null ? unitLeaveNext(workUnit) : leaveNext(workUnit, topic);
}

/**
 * A cancel's `next` (the header's): the horizon pick for the first roadmap
 * item waiting on no horizon, else where the cancel goes.
 * @param {string} cwd @param {string} from @returns {Next}
 */
function cancelNext(cwd, from) {
  const homeless = roadmapState(cwd).items.find((row) => row.horizon === null && row.state === 'waiting');
  return homeless === undefined
    ? cancelWayOn(from)
    : { kind: 'engine', argv: ['render', 'horizon-pick', '--back', homeless.name, '--from', from] };
}

module.exports = { leaveNext, unitLeaveNext, labLeaveNext, cancelNext, cancelledFrom };
