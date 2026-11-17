'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the way on once a topic or a unit leaves from inside its own
// session (18.4.20, 24.1.2), and the one source of every move onto a menu:
// an epic's, `ledger-continue-epic {wu}`, and the start menu, `ledger`. A
// unit's own menu is its epic's for an epic, and the start menu for any
// other unit — where its laboratory left for the menu goes, and its finish
// (24.1.2, 14.6.2), a finished epic's menu its complete variant (18.4.23).
//
// A topic cancelled or postponed (`topic cancel`, `topic postpone`) takes
// the conversation sitting in its discussion to its epic's menu; a unit
// cancelled (`workunit cancel`) takes the conversation sitting in any phase
// of it to the start menu. From anywhere else — another topic of the epic,
// its menu, manage on the start menu — the calling flow carries on. Where
// the conversation sits is its position (position.cjs).
//
// A cancel, or the removal of a topic not yet started, puts each roadmap
// item it took in back on the horizon it came from; one whose horizon was
// removed meanwhile comes back on none, and the horizon is the person's to
// name (18.8.20, 18.8.2). So its way on first leads through the pick of a
// horizon for each item it put back on none, one at a time — `render
// horizon-pick --back <item> --from <what put it back> [--then <items>]`,
// each row moving the item there by `roadmap move … --from … [--then …]`,
// whose answer leads to the next — and past the last, on to where it goes,
// as above. The items still to ask about ride the chain's argv as `--then`,
// comma-joined, so the chain asks about what its own verb put back and
// nothing else; each step asks only about those still on no horizon. What
// put them back is named as the verb named it: the unit, `<wu>`, or the
// topic, `<wu>.discovery.<topic>`. The position is read where the chain
// ends, the conversation still sitting where the verb left it.
// ---------------------------------------------------------------------------

const { handedSession } = require('../kernel/process.cjs');
const { readPosition } = require('./position.cjs');
const { UNIT_PHASES } = require('./derivations.cjs');
const { roadmapState } = require('./roadmap.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** A position in a phase of a unit. @typedef {import('./conversation.cjs').Position & {phase: string}} Seat */

const CONTINUE = Object.freeze({ kind: 'continue' });

/** The way onto the start menu. @type {Next} */
const ONTO_START = Object.freeze({ kind: 'handoff', skill: 'ledger', args: [] });

/** The way onto the epic's menu. @param {string} workUnit @returns {Next} */
const ontoEpic = (workUnit) => ({ kind: 'handoff', skill: 'ledger-continue-epic', args: [workUnit] });

/**
 * The way onto the unit's own menu (the header's): its epic's for an epic,
 * else the start menu.
 * @param {string} workUnit @param {string} workType
 * @returns {Next}
 */
function ontoMenu(workUnit, workType) {
  return workType === 'epic' ? ontoEpic(workUnit) : ONTO_START;
}

/** Where the calling conversation sits, or null where it sits nowhere. */
function sittingAt() {
  const sessionId = handedSession();
  return sessionId === null ? null : readPosition(sessionId);
}

/**
 * Where the calling conversation sits in a phase of the unit — at `topic`
 * where one is named — or null where it sits elsewhere: what a verb acting
 * from more than one place reads to tell whose call it is.
 * @param {string} workUnit @param {string} [topic]
 * @returns {Seat|null}
 */
function seatIn(workUnit, topic) {
  const at = sittingAt();
  if (at === null || at.name !== workUnit || typeof at.phase !== 'string') return null;
  return topic === undefined || at.topic === topic ? /** @type {Seat} */ (at) : null;
}

/**
 * The phase of the unit's topic the calling conversation sits in, or null.
 * @param {string} workUnit @param {string} topic @returns {string|null}
 */
function sittingIn(workUnit, topic) {
  return seatIn(workUnit, topic)?.phase ?? null;
}

/**
 * The `next` of a topic that left, from the calling conversation's position.
 * @param {string} workUnit @param {string} topic
 * @returns {Next}
 */
function leaveNext(workUnit, topic) {
  const phase = sittingIn(workUnit, topic);
  return phase !== null && UNIT_PHASES.discovery.includes(phase) ? ontoEpic(workUnit) : CONTINUE;
}

/**
 * The `next` of a unit cancelled, from the calling conversation's position.
 * @param {string} workUnit
 * @returns {Next}
 */
function unitLeaveNext(workUnit) {
  return seatIn(workUnit) === null ? CONTINUE : ONTO_START;
}

/**
 * What put the items back, read from its name: a unit, or one of its topics
 * at discovery. Refused in any other shape.
 * @param {string} from @returns {{workUnit: string, topic: string|null}}
 */
function putBackBy(from) {
  const [workUnit, phase, topic, ...extra] = from.split('.');
  if (workUnit === '' || extra.length > 0 || (phase !== undefined && (phase !== 'discovery' || !topic))) {
    throw new Error(`--from names what put the item back — <work_unit>, or <work_unit>.discovery.<topic> — got "${from}"`);
  }
  return { workUnit, topic: topic ?? null };
}

/**
 * The items still to ask about, as `--then` carries them; none where it is
 * not given.
 * @param {string|undefined} then @returns {string[]}
 */
function stillToAsk(then) {
  if (then === undefined) return [];
  const names = then.split(',');
  if (names.some((name) => name === '')) throw new Error(`--then names the items still to ask about, comma-joined — got "${then}"`);
  return names;
}

/** `--then` carrying `names`, where any are left. @param {string[]} names @returns {string[]} */
const thenArgs = (names) => (names.length === 0 ? [] : ['--then', names.join(',')]);

/**
 * Where the verb goes once every item it put back has a horizon: a topic's
 * as `leaveNext` says, a unit's as `unitLeaveNext` says.
 * @param {string} from @returns {Next}
 */
function wayOn(from) {
  const { workUnit, topic } = putBackBy(from);
  return topic === null ? unitLeaveNext(workUnit) : leaveNext(workUnit, topic);
}

/**
 * A put-back's `next` (the header's): the horizon pick for the first of
 * `names` still waiting on no horizon, the rest carried on, else where the
 * verb goes.
 * @param {string} cwd @param {string} from @param {string[]} names
 * @returns {Next}
 */
function putBackNext(cwd, from, names) {
  const homeless = new Set(roadmapState(cwd).items.filter((row) => row.horizon === null && row.state === 'waiting').map((row) => row.name));
  const [first, ...rest] = names.filter((name) => homeless.has(name));
  return first === undefined
    ? wayOn(from)
    : { kind: 'engine', argv: ['render', 'horizon-pick', '--back', first, '--from', from, ...thenArgs(rest)] };
}

module.exports = { ontoEpic, ontoMenu, seatIn, sittingIn, leaveNext, putBackNext, putBackBy, stillToAsk, thenArgs };
