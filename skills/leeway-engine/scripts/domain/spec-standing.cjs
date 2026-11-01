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
//   take one in. Each door reads this one predicate.
// - The topics are settled once a live topic is decided and every live
//   topic is — a cancelled or postponed topic is not live — and a bugfix's
//   one topic once its investigation has concluded (11.2.1, 18.5.1).
// - The spec is entered once the topics are settled, each refusal naming
//   the way on: an epic's topics still open are worked from its menu or
//   postponed to the roadmap (18.5.2), and an epic with none live has its
//   map shaped in its discovery or a topic pulled forward from the roadmap.
//   A cross-cutting concern writes no spec, its type going (19.6.1); a
//   quick-fix's pipeline holds none (11.1.6, topic-standing.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { manifestOf, liveTopics } = require('./ledger-units.cjs');
const { buildBegun, computeTopicLifecycle, itemOf, topicTitles, goesBy } = require('./derivations.cjs');
const { specPath } = require('./spec-sections.cjs');

/** @typedef {'none'|'written'|'concluded'} SpecStanding */

/**
 * Where the unit stands with its spec: concluded once its build has begun,
 * written once its `spec.md` exists, else none.
 * @param {string} cwd @param {string} unit
 * @returns {SpecStanding}
 */
function specStanding(cwd, unit) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest !== null && buildBegun(manifest)) return 'concluded';
  return fs.existsSync(specPath(cwd, unit)) ? 'written' : 'none';
}

/**
 * Whether the unit is past its spec, written or concluded — the one rule
 * every door the spec closes reads.
 * @param {string} cwd @param {string} unit
 */
function pastItsSpec(cwd, unit) {
  return specStanding(cwd, unit) !== 'none';
}

/**
 * Why no topic of the unit can be made, changed or reached any more — the
 * unit past its spec — or null where it can.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function pastSpecRefusal(cwd, unit) {
  return pastItsSpec(cwd, unit) ? `${unit} has its spec — a topic exists only before it, and a change is settled in the spec from here` : null;
}

/** Refuses a unit past its spec. @param {string} cwd @param {string} unit */
function assertBeforeSpec(cwd, unit) {
  const refusal = pastSpecRefusal(cwd, unit);
  if (refusal !== null) throw new Error(refusal);
}

/** The topics the spec is written from: an epic's live topics, a single-topic unit's own. @param {Record<string, any>} manifest @returns {string[]} */
function specTopics(manifest) {
  return manifest.work_type === 'epic' ? liveTopics(manifest.name, manifest) : [manifest.name];
}

/** Whether a topic is settled: decided, a bugfix's once its investigation has concluded. @param {Record<string, any>} manifest @param {string} topic */
function settled(manifest, topic) {
  return manifest.work_type === 'bugfix'
    ? itemOf(manifest, 'investigation', topic)?.status === 'completed'
    : computeTopicLifecycle(manifest, topic).lifecycle === 'decided';
}

/** Whether the unit's topics are settled, so its spec can be written. @param {Record<string, any>} manifest */
function topicsSettled(manifest) {
  const topics = specTopics(manifest);
  return topics.length > 0 && topics.every((topic) => settled(manifest, topic));
}

/** @type {Readonly<Record<string, (unit: string) => string>>} */
const NO_SPEC = Object.freeze({
  'cross-cutting': (unit) => `${unit} is a cross-cutting concern, which writes no spec — cancel it through manage on the start menu; its decisions stay in the ledger`,
});

/**
 * Why a single-topic unit's topic holds its spec back.
 * @type {Readonly<Record<string, (unit: string) => string>>}
 */
const OPEN_TOPIC = Object.freeze({
  feature: (unit) => `${unit}'s spec waits until its topic is decided — its discussion carries on: engine enter discussion ${unit}`,
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
 * it, or null where it can: a cross-cutting concern, which writes none, or
 * its topics not yet settled.
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function entryRefusal(manifest) {
  const none = NO_SPEC[manifest.work_type];
  if (none !== undefined) return none(manifest.name);
  if (topicsSettled(manifest)) return null;
  return manifest.work_type === 'epic' ? epicOpen(manifest) : OPEN_TOPIC[manifest.work_type](manifest.name);
}

module.exports = { specStanding, pastItsSpec, pastSpecRefusal, assertBeforeSpec, specTopics, topicsSettled, entryRefusal };
