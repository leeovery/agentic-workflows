'use strict';

// ---------------------------------------------------------------------------
// Domain ring: whether a unit's topic can still take work — the one rule the
// entry (enter.cjs), the handoff into a topic (handoff.cjs) and a message
// sent to one (mail.cjs) all hold it to, each refusal naming the way on.
// - The unit: one this project has, in progress — a cancelled unit
//   reactivated first, a completed one closed to new work.
// - Its phase: one its work type's pipeline holds.
// - The topic: a name that is one, a topic the unit holds — an epic's map
//   names them, a single-topic unit's is the unit — and none once the unit
//   has its `spec.md`, from which a change is settled in the spec (4.11.2,
//   10.2.2).
// - What the topic is now: postponed or cancelled on the map, promoted out
//   of the unit, decided, or for a bugfix its investigation concluded, the
//   unit's menu leading past it. A message waits in a postponed topic's
//   mailbox, reopens a decided or concluded one and goes to the inbox for a
//   cancelled one (10.1.6, 10.1.8, 10.2.7), so only a promoted topic
//   refuses it.
// And whether a unit's discovery can still be talked in: an epic's, until
// its spec closes the map (8.6.5, 8.2.11); every other type's ended at
// start this work. The product's conversation never closes.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { PRODUCT, WORK_TYPE_PIPELINES, illegalNameReason, workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { hasTopic, manifestOf } = require('./ledger-units.cjs');
const { computeNextPhase, computeTopicLifecycle, itemOf, postponedStillWaits } = require('./derivations.cjs');

/**
 * Where a topic stands as it is checked: the unit's manifest as it stood on
 * arrival — at the product's conversation, the project manifest, the product
 * having none of its own — and the topic: none at a unit-level place, nor at
 * an epic named at none.
 * @typedef {{cwd: string, phase: string, unit: string, topic?: string, manifest: Record<string, any>}} Standing
 */

/**
 * Refuses a unit not in progress: a cancelled one reactivated first, a
 * completed one closed to new work.
 * @param {Record<string, any>} manifest
 */
function assertInProgress(manifest) {
  if (manifest.status === 'cancelled') throw new Error(`${manifest.name} is cancelled — reactivating it comes first`);
  if (manifest.status !== 'in-progress') throw new Error(`${manifest.name} is ${manifest.status} — new work starts from the start menu`);
}

/**
 * The unit's manifest, refused where this project has no such unit or it
 * is not in progress.
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function unitInProgress(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`there is no work unit "${unit}" — the start menu lists the work in progress`);
  assertInProgress(manifest);
  return manifest;
}

/**
 * Refuses a phase the unit's work type has no place for, naming its phases;
 * never discovery, which every work type opens on.
 * @param {Record<string, any>} manifest @param {string} phase
 */
function assertPhaseHeld(manifest, phase) {
  if (phase === 'discovery') return;
  const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (manifest.work_type)] ?? [];
  if (!pipeline.includes(phase)) throw new Error(`a ${manifest.work_type} has no ${phase} — its phases are ${pipeline.join(', ')}`);
}

/**
 * Whether the unit has its spec — past which no topic exists (4.11.2) and an
 * epic's map is closed (8.6.5).
 * @param {string} cwd @param {string} unit
 */
const hasSpec = (cwd, unit) => fs.existsSync(statePath(cwd, unit, 'spec.md'));

/**
 * Where a decided or set-aside topic of the unit is reopened (8.6.5).
 * @param {Record<string, any>} manifest
 */
function reopenedThrough(manifest) {
  return manifest.work_type === 'epic' ? 'the epic menu\'s discovery row' : 'manage on the start menu';
}

/** Where a unit's topics are named. @param {Record<string, any>} manifest */
function topicsNamed(manifest) {
  return manifest.work_type === 'epic'
    ? 'the epic\'s map holds its topics, and a new one comes through its discovery'
    : `a ${manifest.work_type}'s topic is the unit itself`;
}

/**
 * Whether the unit holds the topic: one its map or phases name, or a
 * single-topic unit's own.
 * @param {Record<string, any>} manifest @param {string} topic
 */
function holdsTopic(manifest, topic) {
  return (topic === manifest.name && manifest.work_type !== 'epic') || hasTopic(manifest, topic);
}

/**
 * Why the topic named cannot take work, whatever the phase: an epic named at
 * none, a name that is not one, the unit past its spec (4.11.2), or a topic
 * the unit lacks; null where it can.
 * @param {Standing} at @returns {string|null}
 */
function topicStanding({ cwd, phase, unit, topic, manifest }) {
  if (topic === undefined) return `an epic enters ${phase} at one of its topics — name the topic: engine enter ${phase} ${unit} <topic>`;
  const illegal = illegalNameReason('topic', topic);
  if (illegal !== null) return `${illegal}; ${topicsNamed(manifest)}`;
  if (hasSpec(cwd, unit)) return `${unit} has its spec — a topic exists only before it, and a change is settled in the spec from here`;
  return holdsTopic(manifest, topic) ? null : `${unit} has no topic "${topic}" — ${topicsNamed(manifest)}`;
}

/** @type {Readonly<Record<string, (topic: string, through: string) => string>>} */
const SET_ASIDE = Object.freeze({
  cancelled: (topic, through) => `the topic "${topic}" is cancelled — reactivating it goes through ${through}`,
});

/**
 * Why a postponed topic cannot be entered: the way back while its roadmap
 * item still waits, and none once another epic has taken it.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} through
 */
function postponedRefusal(cwd, unit, topic, through) {
  return postponedStillWaits(cwd, unit, topic)
    ? `the topic "${topic}" is postponed to the roadmap — pulling it forward goes through ${through}`
    : `the topic "${topic}" is postponed, and its roadmap item has gone to another epic — it stays postponed here, with no way back`;
}

/**
 * Why a topic takes nothing more, entry or message: promoted out of the
 * unit; null where it can.
 * @param {Standing} at @returns {string|null}
 */
function closedStanding({ topic = '', manifest }) {
  const item = itemOf(manifest, 'discussion', topic);
  return item?.status === 'promoted' ? `the topic "${topic}" was promoted to "${item.promoted_to}" — it carries on there` : null;
}

/**
 * Why a topic takes nothing at all — the topic named, or its closure; null
 * where it takes a message, and an entry where its phase has no rule of its
 * own.
 * @param {Standing} at @returns {string|null}
 */
function topicClosure(at) {
  return topicStanding(at) ?? closedStanding(at);
}

/**
 * Why a discussion's topic cannot be entered: set aside on the map, closed,
 * or decided; null where it can.
 * @param {Standing} at @returns {string|null}
 */
function discussionStanding(at) {
  const { cwd, unit, topic = '', manifest } = at;
  const through = reopenedThrough(manifest);
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (lifecycle === 'postponed') return postponedRefusal(cwd, unit, topic, through);
  if (lifecycle === 'cancelled') return SET_ASIDE.cancelled(topic, through);
  const closed = closedStanding(at);
  if (closed !== null) return closed;
  return itemOf(manifest, 'discussion', topic)?.status === 'completed'
    ? `the topic "${topic}" is decided — it reopens through a message sent to it, or through ${through}`
    : null;
}

/**
 * Why a bugfix's investigation cannot be entered: concluded, the unit's
 * work going on where its menu goes (`computeNextPhase`), or done; null
 * while the menu still leads to the investigation.
 * @param {Standing} at @returns {string|null}
 */
function investigationStanding({ topic = '', manifest }) {
  const next = computeNextPhase(manifest).next_phase;
  if (next === 'investigation') return null;
  const where = next === 'done' ? 'its work is done' : `its work goes on in ${next}, from the start menu`;
  return `the topic "${topic}" is concluded — ${where}, and a message sent to it reopens it`;
}

/**
 * Why a discovery cannot be entered, or null where it can: a unit that is no
 * epic, whose discovery ended at start this work, and an epic past its spec,
 * whose map is closed and whose talk belongs in the product's conversation
 * (8.6.5, 8.2.11). The product's conversation is always open.
 * @param {Standing} at @returns {string|null}
 */
function discoveryStanding({ cwd, unit, manifest }) {
  if (unit === PRODUCT) return null;
  if (manifest.work_type !== 'epic') {
    return `${unit} is a ${manifest.work_type} — its discovery ended at start this work, and reopening its decision goes through manage on the start menu`;
  }
  return hasSpec(cwd, unit)
    ? `${unit} has its spec, so its map is closed — talk about it belongs in the product's conversation, where what comes of it lands as roadmap items: engine enter discovery ${PRODUCT}`
    : null;
}

/**
 * Why each phase that enters at a topic cannot be entered there; a phase
 * with none of its own is held to the topic and its closure alone.
 * @type {Readonly<Record<string, (at: Standing) => string|null>>}
 */
const STANDINGS = Object.freeze({
  discussion: (at) => topicStanding(at) ?? discussionStanding(at),
  investigation: (at) => topicClosure(at) ?? investigationStanding(at),
});

/** @param {string} phase @returns {(at: Standing) => string|null} */
function phaseStanding(phase) {
  return STANDINGS[phase] ?? topicClosure;
}

/**
 * Refuses the topic of a unit in progress that `phase` would be entered at,
 * as the entry refuses it.
 * @param {string} cwd @param {string} phase @param {Record<string, any>} manifest @param {string} topic
 */
function assertEnterable(cwd, phase, manifest, topic) {
  assertPhaseHeld(manifest, phase);
  const refusal = phaseStanding(phase)({ cwd, phase, unit: manifest.name, topic, manifest });
  if (refusal !== null) throw new Error(refusal);
}

module.exports = { assertInProgress, unitInProgress, assertPhaseHeld, holdsTopic, topicClosure, phaseStanding, discoveryStanding, assertEnterable };
