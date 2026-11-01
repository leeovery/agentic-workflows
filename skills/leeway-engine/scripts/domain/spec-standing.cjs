'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a work unit stands with its one spec, and whether it
// may enter it — read by the spec's entry (spec-entry.cjs), the
// ready-to-build checklist's topics-settled (checklist.cjs), the move after
// a topic is decided (decided.cjs), the recovery note (position.cjs) and the
// rule that holds a unit's topics closed past its spec (topic-standing.cjs).
// It reads no ledger, so each of those can require it.
//
// - The spec's standing is derived, never kept (P7): `concluded` once ready
//   to build's yes began the build, `build` on the unit's manifest;
//   `written` once `{unit}/spec.md` exists; else `none`.
// - The topics are settled once every live topic is decided — a cancelled
//   or postponed topic is not live — and a bugfix's one topic once its
//   investigation has concluded (11.2.1, 18.5.1).
// - The spec is entered once the topics are settled, each refusal naming
//   the way on: an epic's topics still open are worked from its menu or
//   postponed to the roadmap (18.5.2). A quick-fix writes no spec (11.1.6),
//   nor does a cross-cutting concern, whose type goes (19.6.1).
// - What carries the spec on, named alike by its entry and its recovery
//   note: each live topic's record, by its engine call, and its log — a
//   bugfix's its investigation; once the spec is written, the spec; and the
//   cut, by its call, once the manifest holds one.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { ENGINE_COMMAND } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { manifestOf, liveTopics } = require('./ledger-units.cjs');
const { buildBegun, computeTopicLifecycle, itemOf, topicTitles, goesBy } = require('./derivations.cjs');
const { specPath } = require('./spec-sections.cjs');
const { topicLog, recordCall } = require('./topic-log.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');

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

/** The unit's live topics not yet settled, none once the spec can be written. @param {Record<string, any>} manifest @returns {string[]} */
function unsettledTopics(manifest) {
  return specTopics(manifest).filter((topic) => !settled(manifest, topic));
}

/** @type {Readonly<Record<string, (unit: string) => string>>} */
const NO_SPEC = Object.freeze({
  'quick-fix': (unit) => `${unit} is a quick-fix, which writes no spec — its scoping is its spec and its plan in one`,
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
 * Why the unit cannot enter its spec, or null where it can: a quick-fix or
 * a cross-cutting concern, which write none, or a topic not yet settled.
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function entryRefusal(manifest) {
  const unit = manifest.name;
  const none = NO_SPEC[manifest.work_type];
  if (none !== undefined) return none(unit);
  const open = unsettledTopics(manifest);
  if (open.length === 0) return null;
  if (manifest.work_type !== 'epic') return OPEN_TOPIC[manifest.work_type](unit);
  const titles = topicTitles(manifest);
  const names = open.map((topic) => `"${goesBy(titles, topic)}"`).join(', ');
  return `${unit}'s spec waits until every topic is decided, cancelled or postponed — still open: ${names}; work them from the epic's menu, or postpone them to the roadmap`;
}

/**
 * Why `enter specification` refuses the unit, with its way on, or null
 * where it may enter.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function specEntryRefusal(cwd, unit) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest === null ? `there is no work unit "${unit}"` : entryRefusal(manifest);
}

/**
 * What carries the spec on: each live topic's record call and its log on
 * disk, absolute; the spec, once written; and the cut's call, once the
 * manifest holds a cut.
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {{records: string[], logs: string[], spec: string[], cut: string[]}}
 */
function specSources(cwd, manifest) {
  const unit = manifest.name;
  const topics = specTopics(manifest);
  const logOf = manifest.work_type === 'bugfix' ? INDEXED_ARTIFACTS.investigation : topicLog;
  return {
    records: topics.map((topic) => recordCall(unit, topic)),
    logs: topics.map((topic) => statePath(cwd, logOf(unit, topic))).filter((log) => fs.existsSync(log)),
    spec: [specPath(cwd, unit)].filter((spec) => fs.existsSync(spec)),
    cut: isObject(manifest.cut) ? [`${ENGINE_COMMAND} manifest get ${unit} cut`] : [],
  };
}

module.exports = { specStanding, specEntryRefusal, entryRefusal, unsettledTopics, specSources };
