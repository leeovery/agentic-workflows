'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the work units and topics the ledger's entries are tagged
// with, as today's manifests say them. The ledger reads a manifest here
// alone, so a later phase that reshapes the manifests changes the ledger in
// this one place.
//
// - A topic exists only before the spec (4.11.2): it is an item of its unit
//   in one of the phases before it.
// - Liveness (5.8.17): an entry is current only while its topic and unit are
//   live. A unit is live while its manifest is there and its status is not
//   cancelled. A topic is live while its lifecycle reads neither cancelled
//   nor postponed: the map row's own mark, which a cancel or a postpone sets
//   and a reactivate, or the pull back into its own epic, clears. An entry
//   made at the unit's level carries no topic, and its unit alone decides.
// - A unit is finished once its status reads completed; until then it is
//   still under way.
// - What is live, marked unit by unit: a value two reads of a unit's
//   manifest answer alike exactly when they set the same of its topics, or
//   the unit, aside, so a change to what is live is seen however it was
//   made. Which units a command may have changed is told by their
//   manifests' stamps — a stat each, no read — so the marks are worked out
//   for those alone.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { isObject, workUnitManifestPath, readWorkUnitManifest, workUnitNames, listWorkUnitManifests } = require('../kernel/manifest-io.cjs');
const { computeTopicLifecycle } = require('./derivations.cjs');

/** The phases a topic exists in: those before the spec (4.11.2). */
const TOPIC_PHASES = Object.freeze(['discovery', 'research', 'experiment', 'discussion', 'investigation']);

/** The topic lifecycles that are not live. */
const SET_ASIDE = Object.freeze(['cancelled', 'postponed']);

/**
 * Whether a unit's manifest holds an item named `topic` in `phase`.
 * @param {Record<string, any>} manifest @param {string} phase @param {string} topic
 */
function hasItem(manifest, phase, topic) {
  const items = manifest.phases?.[phase]?.items;
  return isObject(items) && Object.hasOwn(items, topic) && isObject(items[topic]);
}

/** Whether a unit's manifest holds a topic of that name. @param {Record<string, any>} manifest @param {string} topic */
function hasTopic(manifest, topic) {
  return TOPIC_PHASES.some((phase) => hasItem(manifest, phase, topic));
}

/** A unit's manifest, or null where the unit has none. @param {string} root @param {string} unit @returns {Record<string, any>|null} */
function manifestOf(root, unit) {
  return fs.existsSync(workUnitManifestPath(root, unit)) ? readWorkUnitManifest(root, unit) : null;
}

/**
 * Why an entry of `unit` on `topic` — null at the unit's level — is not
 * live, or null where it is.
 * @param {string} unit @param {string|null} topic @param {Record<string, any>|null} manifest the unit's
 * @returns {string|null}
 */
function deadReason(unit, topic, manifest) {
  if (manifest === null) return `there is no work unit "${unit}"`;
  if (manifest.status === 'cancelled') return `${unit} is cancelled`;
  if (topic === null) return null;
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  return SET_ASIDE.includes(lifecycle) ? `its topic, ${topic}, is ${lifecycle}` : null;
}

/**
 * Liveness as the project's manifests say it now (5.8.17): a reader of why
 * an entry of a unit and topic is not live — null where it is — each
 * manifest read once, however many entries ask.
 * @param {string} root the project's state root
 * @returns {(unit: string, topic: string|null) => string|null}
 */
function liveness(root) {
  /** @type {Map<string, Record<string, any>|null>} */
  const manifests = new Map();
  /** @type {Map<string, string|null>} */
  const reasons = new Map();
  return (unit, topic) => {
    const key = `${unit}\0${topic ?? ''}`;
    if (!reasons.has(key)) {
      if (!manifests.has(unit)) manifests.set(unit, manifestOf(root, unit));
      reasons.set(key, deadReason(unit, topic, /** @type {Record<string, any>|null} */ (manifests.get(unit))));
    }
    return /** @type {string|null} */ (reasons.get(key));
  };
}

/**
 * Whether a unit is finished as the project's manifests say it now: a reader
 * of a unit's name, each manifest read once, however many entries ask.
 * @param {string} root the project's state root
 * @returns {(unit: string) => boolean}
 */
function finishedUnits(root) {
  /** @type {Map<string, boolean>} */
  const finished = new Map();
  return (unit) => {
    if (!finished.has(unit)) finished.set(unit, manifestOf(root, unit)?.status === 'completed');
    return /** @type {boolean} */ (finished.get(unit));
  };
}

/** The topics a unit's manifest names, once each, sorted. @param {Record<string, any>} manifest @returns {string[]} */
function topicsOf(manifest) {
  return [...new Set(TOPIC_PHASES.flatMap((phase) => {
    const items = manifest.phases?.[phase]?.items;
    return isObject(items) ? Object.keys(items) : [];
  }))].sort();
}

/**
 * What is live of a unit, marked: why it and each topic it names is not
 * live where one is not; null where it has no manifest.
 * @param {string} unit @param {Record<string, any>|null} manifest
 * @returns {string|null}
 */
function unitMark(unit, manifest) {
  if (manifest === null) return null;
  return JSON.stringify([deadReason(unit, null, manifest), topicsOf(manifest).map((topic) => [topic, deadReason(unit, topic, manifest)])]);
}

/**
 * What is live across the project, marked unit by unit: each unit whose
 * manifest reads, by its name.
 * @param {string} root the project's state root
 * @returns {Record<string, string>}
 */
function livenessMarks(root) {
  /** @type {Record<string, string>} */
  const marks = {};
  for (const manifest of listWorkUnitManifests(root)) {
    if (typeof manifest.name === 'string') marks[manifest.name] = /** @type {string} */ (unitMark(manifest.name, manifest));
  }
  return marks;
}

/**
 * Each unit's manifest as it stands on disk, by a stat alone: its file's
 * identity, size and time, empty where there is none. Units are the
 * registered ones, or the state's folders where the project manifest does
 * not read — never a throw, as a command runs between two stampings.
 * @param {string} root the project's state root
 * @returns {Map<string, string>}
 */
function manifestStamps(root) {
  /** @type {string[]} */
  let units;
  try {
    units = workUnitNames(root);
  } catch {
    units = workUnitNames(root, {});
  }
  /** @type {Map<string, string>} */
  const stamps = new Map();
  for (const unit of units) {
    const stat = fs.statSync(workUnitManifestPath(root, unit), { bigint: true, throwIfNoEntry: false });
    stamps.set(unit, stat ? `${stat.ino}:${stat.size}:${stat.mtimeNs}` : '');
  }
  return stamps;
}

/**
 * The units whose manifests differ from `before`'s stamps — one added,
 * removed or rewritten.
 * @param {string} root @param {Map<string, string>} before
 * @returns {string[]}
 */
function changedUnits(root, before) {
  const after = manifestStamps(root);
  return [...new Set([...before.keys(), ...after.keys()])].filter((unit) => (before.get(unit) ?? '') !== (after.get(unit) ?? ''));
}

module.exports = { TOPIC_PHASES, hasItem, hasTopic, manifestOf, liveness, finishedUnits, unitMark, livenessMarks, manifestStamps, changedUnits };
