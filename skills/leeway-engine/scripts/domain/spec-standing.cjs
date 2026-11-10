'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a work unit stands with its one spec, and whether it
// may enter it — read by the spec's entry (spec-entry.cjs), the
// ready-to-build checklist's topics-settled (checklist.cjs), the move after
// a topic is decided (decided.cjs), and every door the spec closes. It reads
// no ledger, so each of those can require it.
//
// - The spec's standing is derived, never kept (P7): `concluded` once ready
//   to build's yes began the build, `build` on the unit's manifest;
//   `written` once `{unit}/spec.md` exists; else `none`.
// - Past its spec — written or concluded — no topic exists (4.11.2), and an
//   epic's map is closed (18.4.19, P3): no topic is added, cancelled,
//   reactivated, reopened or pulled forward, nor sent a message, nor talked
//   over in the epic's discovery, and the unit is not absorbed, nor does it
//   take one in. Each door reads this one predicate, its refusal naming the
//   way on from what the person was doing there.
// - The topics are settled once a live topic is decided and every live
//   topic is — a cancelled or postponed topic is not live — and a bugfix's
//   one topic once its investigation has concluded (11.2.1, 18.5.1). A
//   feature's one topic is settled for its spec once nothing of the person's
//   is open on it and its closing pass has run, before it is decided: its
//   decided checklist closed and its close standing, so a message delivered
//   to it since unsettles it (11.2.1, 9.7.9); the one screen, decided and
//   ready to build, marks it decided (11.8.5).
// - The spec is entered once the topics are settled, each refusal naming
//   the way on: an epic's topics still open are worked from its menu or
//   postponed to the roadmap (18.5.2), and an epic with none live has its
//   map shaped in its discovery or a topic pulled forward from the roadmap.
//   A quick-fix's pipeline holds none (11.1.6, topic-standing.cjs).
// - The spec is begun once its topics are settled or it is written, and
//   under way from then until the build begins: what waits on the person
//   there is read only then (board-standing.cjs, waits.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { manifestOf, liveTopics } = require('./ledger-units.cjs');
const { buildBegun, closedIntoSpec, computeTopicLifecycle, itemOf, topicTitles, goesBy } = require('./derivations.cjs');
const { specPath } = require('./spec-sections.cjs');

/** @typedef {'none'|'written'|'concluded'} SpecStanding */

/**
 * Where the unit stands with its spec, its manifest read: concluded once its
 * build has begun, written once its `spec.md` exists, else none.
 * @param {string} cwd @param {string} unit @param {Record<string, any>|null} manifest
 * @returns {SpecStanding}
 */
function standingOf(cwd, unit, manifest) {
  if (manifest !== null && buildBegun(manifest)) return 'concluded';
  return fs.existsSync(specPath(cwd, unit)) ? 'written' : 'none';
}

/**
 * Where the unit stands with its spec: concluded once its build has begun,
 * written once its `spec.md` exists, else none.
 * @param {string} cwd @param {string} unit
 * @returns {SpecStanding}
 */
function specStanding(cwd, unit) {
  return standingOf(cwd, unit, manifestOf(stateRoot(cwd), unit));
}

/**
 * Whether the unit is past its spec, written or concluded — the one rule
 * every door the spec closes reads, its caller holding the manifest.
 * @param {string} cwd @param {Record<string, any>} manifest
 */
function pastItsSpec(cwd, manifest) {
  return standingOf(cwd, manifest.name, manifest) !== 'none';
}

/** @typedef {'change'|'newWork'|'pull'|'absorbInto'|'ownWork'|'cancel'|'sweep'} SpecDoor */

/**
 * The refusal past the spec at each door, naming the way on from what the
 * person was doing there (18.4.19): a change to a topic is settled in the
 * spec; new work lands on the roadmap from the product's conversation; a
 * roadmap item, or a feature, goes into an epic still before its spec, or on
 * as work of its own; a cancel settles its decision in the phase the epic
 * is in (12.15.4), or cancels the unit (18.3.4); and what a sweep would find
 * is settled in the spec (8.10.3).
 * @type {Readonly<Record<SpecDoor, (unit: string) => string>>}
 */
const PAST_SPEC = Object.freeze({
  change: (unit) => `${unit} has its spec — a topic exists only before it, and a change is settled in the spec from here`,
  newWork: (unit) => `${unit} has its spec, so its map is closed — talk about it belongs in the product's conversation, where what comes of it lands as roadmap items: engine enter discovery ${PRODUCT}`,
  pull: (unit) => `${unit} has its spec, so its map is closed — the item stays on the roadmap: pull it into an epic still before its spec, or start it as work of its own`,
  absorbInto: (unit) => `${unit} has its spec, so its map is closed — absorb the feature into an epic still before its spec, or keep it as work of its own`,
  ownWork: (unit) => `${unit} has its spec — it carries on as work of its own`,
  cancel: (unit) => `${unit} has its spec — a decision that must change is settled in the phase the epic is in, and abandoning the work is the unit's cancel, through manage on the start menu`,
  sweep: (unit) => `${unit} has its spec, so its map is closed — the sweep runs before the spec is written, and what it would find now is settled in the spec`,
});

/**
 * Why the door is shut — the unit past its spec — with the way on from it,
 * or null where it is open.
 * @param {string} cwd @param {Record<string, any>} manifest @param {SpecDoor} door @returns {string|null}
 */
function pastSpecRefusal(cwd, manifest, door) {
  return pastItsSpec(cwd, manifest) ? PAST_SPEC[door](manifest.name) : null;
}

/** Refuses the door for a unit past its spec. @param {string} cwd @param {Record<string, any>} manifest @param {SpecDoor} door */
function assertBeforeSpec(cwd, manifest, door) {
  const refusal = pastSpecRefusal(cwd, manifest, door);
  if (refusal !== null) throw new Error(refusal);
}

/** The topics the spec is written from: an epic's live topics, a single-topic unit's own. @param {Record<string, any>} manifest @returns {string[]} */
function specTopics(manifest) {
  return manifest.work_type === 'epic' ? liveTopics(manifest.name, manifest) : [manifest.name];
}

/**
 * Whether a topic is settled: decided, a bugfix's once its investigation has
 * concluded, a feature's once it has closed into its spec.
 * @param {Record<string, any>} manifest @param {string} topic
 */
function settled(manifest, topic) {
  if (manifest.work_type === 'bugfix') return itemOf(manifest, 'investigation', topic)?.status === 'completed';
  return computeTopicLifecycle(manifest, topic).lifecycle === 'decided' || closedIntoSpec(manifest);
}

/** Whether the unit's topics are settled, so its spec can be written. @param {Record<string, any>} manifest */
function topicsSettled(manifest) {
  const topics = specTopics(manifest);
  return topics.length > 0 && topics.every((topic) => settled(manifest, topic));
}

/**
 * Why a single-topic unit's topic holds its spec back.
 * @type {Readonly<Record<string, (unit: string) => string>>}
 */
const OPEN_TOPIC = Object.freeze({
  feature: (unit) => `${unit}'s spec waits until its discussion closes, nothing of the person's open and its closing pass run — its discussion carries on: engine enter discussion ${unit}`,
  bugfix: (unit) => `${unit}'s spec waits until its investigation concludes — the investigation carries on, from the start menu`,
});

/**
 * Why an epic's topics hold its spec back: those still open, each by the
 * name it goes by, or none live at all.
 * @param {Record<string, any>} manifest @returns {string}
 */
function epicOpen(manifest) {
  const unit = manifest.name;
  const open = specTopics(manifest).filter((topic) => !settled(manifest, topic));
  if (open.length === 0) {
    return `${unit}'s spec waits until a topic is decided — none on its map is live: shape the map in its discovery, or pull a topic forward from the roadmap`;
  }
  const titles = topicTitles(manifest);
  const names = open.map((topic) => `"${goesBy(titles, topic)}"`).join(', ');
  return `${unit}'s spec waits until every topic is decided, cancelled or postponed — still open: ${names}; work them from the epic's menu, or postpone them to the roadmap`;
}

/**
 * Why the unit, in progress and its pipeline holding the spec, cannot enter
 * it, or null where it can: its topics not yet settled.
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function entryRefusal(manifest) {
  if (topicsSettled(manifest)) return null;
  return manifest.work_type === 'epic' ? epicOpen(manifest) : OPEN_TOPIC[manifest.work_type](manifest.name);
}

/** Whether the unit's spec is begun: its topics settled, or it written (the header's). @param {string} cwd @param {Record<string, any>} manifest */
const specBegun = (cwd, manifest) => topicsSettled(manifest) || pastItsSpec(cwd, manifest);

/** Whether the unit's spec is under way: begun, the build not (the header's). @param {string} cwd @param {Record<string, any>} manifest */
const specUnderWay = (cwd, manifest) => !buildBegun(manifest) && specBegun(cwd, manifest);

module.exports = { specStanding, pastItsSpec, pastSpecRefusal, assertBeforeSpec, specTopics, topicsSettled, specBegun, specUnderWay, entryRefusal };
