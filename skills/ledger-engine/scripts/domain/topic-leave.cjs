'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the way on once a topic or a unit leaves from inside its own
// session (18.4.20, 24.1.2), and the one source of every move onto a menu:
// an epic's, `ledger-continue-epic {wu}`, and the start menu, `ledger`. A
// unit's own menu is its epic's for an epic, and the start menu for any
// other unit — where its laboratory left for the menu goes.
//
// A unit's finish and its cancel carry on in the conversation, with no menu
// drawn (18.4.20, 19.5.1, 24.1.5): the conversation leaves the unit's place
// where it is there, its tasks in flight with it, so nothing holds the
// conversation afterwards (`leftUnit`; `leaveUnit`, position.cjs), and its
// session's own label comes back (session-label.cjs). A quick-fix's start
// made at a project-level place — the product's conversation or the
// roadmap — keeps it (start-this-work.cjs, `keepCameFrom`), and its close
// and its cancel, leaving the unit while the conversation is still at it,
// put the conversation back there: its
// position and label, the product's presence row beaten again, and the
// place's own entry as the way on, so its skill and its log are read again
// and a product's session closed meanwhile opens again by that entry
// (`returnTo`). Left with nowhere to go back to, the conversation's row in
// the product's conversation is dropped, so the product's session is never
// held open by a window no longer in it.
// Its move starts the new type as any start does (workunit-move.cjs).
//
// A topic cancelled or postponed (`topic cancel`, `topic postpone`) takes
// the conversation sitting in its discussion to its epic's menu. From
// anywhere else — another topic of the epic, its menu, manage on the start
// menu — the calling flow carries on. Where the conversation sits is its
// position (position.cjs).
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
const { readPosition, leaveUnit, takeCameFrom } = require('./position.cjs');
const { clearOwnQuietly, beatQuietly } = require('./presence.cjs');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { repairTerminalLabel, arriveAt } = require('./session-label.cjs');
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

/** Each project-level place's own entry, the way back into it. @type {Readonly<Record<string, Next>>} */
const ENTRIES = Object.freeze({
  [PRODUCT]: Object.freeze({ kind: 'invoke', skill: 'ledger-discovery', args: ['none', 'none'] }),
  roadmap: Object.freeze({ kind: 'invoke', skill: 'ledger-roadmap', args: [] }),
});

/**
 * A unit finished or cancelled (the header's): where the calling
 * conversation sat in it, its place and the unit's tasks in flight left,
 * then, where it is still at the unit, the conversation back where it
 * started a quick-fix from, else its
 * own row in the product's conversation dropped and its session's own
 * label put back. Whether it left, and the place it went back to with that
 * place's entry, null where it went back nowhere.
 * @param {string} cwd @param {string} workUnit @returns {{left: boolean, back: {place: string, entry: Next}|null}}
 */
function leftUnit(cwd, workUnit) {
  const sessionId = handedSession();
  const taken = takeCameFrom(workUnit);
  const place = sessionId !== null && readPosition(sessionId)?.name === workUnit ? taken : null;
  if (!leaveUnit(sessionId, workUnit)) return { left: false, back: null };
  if (place !== null) return { left: true, back: { place, entry: returnTo(cwd, place) } };
  clearOwnQuietly(cwd, PRODUCT, 'discovery', PRODUCT);
  repairTerminalLabel(cwd);
  return { left: true, back: null };
}

/**
 * The conversation arrived back at the project-level place `name`: its
 * position and label, the product's presence row beaten again. Answers the
 * place's entry.
 * @param {string} cwd @param {string} name @returns {Next}
 */
function returnTo(cwd, name) {
  arriveAt(cwd, name);
  if (name === PRODUCT) beatQuietly(cwd, PRODUCT, 'discovery', PRODUCT);
  return ENTRIES[name];
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
 * as `leaveNext` says; a unit's on in the conversation, which its cancel
 * left (the header's).
 * @param {string} from @returns {Next}
 */
function wayOn(from) {
  const { workUnit, topic } = putBackBy(from);
  return topic === null ? CONTINUE : leaveNext(workUnit, topic);
}

/**
 * A put-back's `next` (the header's): the horizon pick for the first of
 * `names` still waiting on no horizon, the rest carried on, else where the
 * verb goes — `back`, the entry of the place a quick-fix's cancel went back
 * to, where it went back to one.
 * @param {string} cwd @param {string} from @param {string[]} names @param {Next|null} [back]
 * @returns {Next}
 */
function putBackNext(cwd, from, names, back = null) {
  const homeless = new Set(roadmapState(cwd).items.filter((row) => row.horizon === null && row.state === 'waiting').map((row) => row.name));
  const [first, ...rest] = names.filter((name) => homeless.has(name));
  return first === undefined
    ? back ?? wayOn(from)
    : { kind: 'engine', argv: ['render', 'horizon-pick', '--back', first, '--from', from, ...thenArgs(rest)] };
}

module.exports = { ontoEpic, ontoMenu, leftUnit, seatIn, sittingIn, leaveNext, putBackNext, putBackBy, stillToAsk, thenArgs };
