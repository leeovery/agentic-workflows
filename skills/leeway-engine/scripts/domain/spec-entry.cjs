'use strict';

// ---------------------------------------------------------------------------
// Domain ring: specification's row of the entry (enter.cjs) — `enter
// specification <unit>`, at the work unit, whose one spec it is (11.3.1).
// Whether the unit can enter it is spec-standing.cjs's: once its topics are
// settled, and never for a cross-cutting concern. The entry asks nothing
// first, starts nothing and keeps no log, so it writes nothing but where the
// conversation is working.
//
// What carries the spec on, read alike by its entry and its recovery note
// (position.cjs): each live topic's record, by its engine call, and its log
// — a bugfix's its investigation; the files the unit's current entries link
// as canonical, which the spec links (11.6.3); once the spec is written, the
// spec; the cut, by its call, once the manifest holds one; and while the
// person's review page is open, its address and the file its marks are read
// back to (spec-review.cjs). The entry adds the reports of the agents the
// spec was left with, landed since, and those lost with a process that no
// longer runs (9.7.8).
//
// The spec's standing and its refusal are answered here too, for every verb
// that holds the spec to them; the refusal holds the unit first to the rule
// every entry does (topic-standing.cjs) — one this project has, in progress,
// its pipeline holding the spec.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { ENGINE_COMMAND } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { specStanding, specTopics, entryRefusal } = require('./spec-standing.cjs');
const { specPath } = require('./spec-sections.cjs');
const { knownUnit, noUnit, unitClosure, phaseHeldRefusal } = require('./topic-standing.cjs');
const { topicLog, recordCall } = require('./topic-log.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');
const { canonicalAssets } = require('./ledger-read.cjs');
const { agentsLeft } = require('./agent-state.cjs');
const { openPage } = require('./spec-review.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */

/**
 * What carries the spec on, each source absolute or an engine call, and the
 * review page while it is open.
 * @typedef {{records: string[], logs: string[], assets: string[], spec: string[], cut: string[], page: {url: string, readBack: string}|null}} SpecSources
 */

const PHASE = 'specification';

/**
 * What carries the unit's spec on: each live topic's record call and its log
 * on disk; the files its current entries link as canonical; the spec, once
 * written; the cut's call, once the manifest holds a cut; and the review
 * page, while it is open. What a read of the ledger said on the way is
 * pushed to `warnings`.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string[]} warnings
 * @returns {SpecSources}
 */
function specSources(cwd, manifest, warnings) {
  const unit = manifest.name;
  const topics = specTopics(manifest);
  const logOf = manifest.work_type === 'bugfix' ? INDEXED_ARTIFACTS.investigation : topicLog;
  return {
    records: topics.map((topic) => recordCall(unit, topic)),
    logs: topics.map((topic) => statePath(cwd, logOf(unit, topic))).filter((log) => fs.existsSync(log)),
    assets: canonicalAssets(stateRoot(cwd), unit, warnings).map((asset) => statePath(cwd, asset)),
    spec: [specPath(cwd, unit)].filter((spec) => fs.existsSync(spec)),
    cut: isObject(manifest.cut) ? [`${ENGINE_COMMAND} manifest get ${unit} cut`] : [],
    page: openPage(cwd, unit),
  };
}

/** @param {string} key @returns {(value: string) => Line} */
const as = (key) => (value) => [key, value];

/** @param {string} key @returns {(call: string) => Line} */
const asCall = (key) => (call) => [key, `\`${call}\``];

/** What the spec reads at its entry. @param {Entering} at @returns {Line[]} */
function specReads({ cwd, unit, manifest, notes }) {
  const { records, logs, assets, spec, cut, page } = specSources(cwd, manifest, notes);
  const agents = agentsLeft(cwd, unit, PHASE, unit);
  return [
    ...records.map(asCall('record')),
    ...logs.map(as('topic log')),
    ...assets.map(as('asset')),
    ...spec.map(as('spec')),
    ...cut.map(asCall('cut')),
    ...(page === null ? [] : [as('review page')(page.url), as('read back')(page.readBack)]),
    ...agents.landed.map(({ file }) => as('landed')(file)),
    ...agents.lost.map(as('lost')),
  ];
}

/** @type {Entry} */
const SPECIFICATION = Object.freeze({
  level: /** @type {const} */ ('unit'),
  standing: ({ manifest }) => entryRefusal(manifest),
  unstarted: () => false,
  start: () => {},
  questions: () => [],
  reads: specReads,
});

/**
 * Why the unit cannot enter its spec, with its way on, or null where it
 * may — refused as its entry refuses it: a unit this project lacks, one not
 * in progress, one whose pipeline holds no spec, then the spec's own
 * refusal.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function specEntryRefusal(cwd, unit) {
  const manifest = knownUnit(cwd, unit);
  if (manifest === null) return noUnit(unit);
  return unitClosure(manifest) ?? phaseHeldRefusal(manifest, PHASE) ?? entryRefusal(manifest);
}

module.exports = { SPECIFICATION, specStanding, specEntryRefusal, specSources };
