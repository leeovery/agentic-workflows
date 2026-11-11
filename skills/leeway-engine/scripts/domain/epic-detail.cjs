'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an epic's detail — what its menu reads of the epic
// (projections/epic-menu.cjs, 18.4.17), from its manifest and the project's.
//
// - Its map's topics in the map's order, with the tally they make
//   (derivations.cjs, `buildDiscoveryMap`).
// - The experiments waiting for each topic: the live top-level records of
//   its series, a split being the laboratory's own method, worked through
//   its parent.
// - The horizon each postponed topic waits under, read from the roadmap
//   item it waits as, while that item still waits; none where it does not.
// - The spec the menu offers (18.4.6): none while a topic is open, nor once
//   ready to build's yes has begun the build, nor on a unit whose building
//   began under the old spec, which keeps its items (29.17); else to start,
//   or to carry on once `spec.md` is written. And whether the map is closed,
//   the unit past its spec (18.4.19).
// - For an epic built under the old plan, the line it shows in place of its
//   build's row while it waits on the migration's cut (P12).
// ---------------------------------------------------------------------------

const { EXPERIMENT_TERMINAL_STATUSES, isParentExperimentId } = require('../kernel/manifest-schema.cjs');
const { loadProjectManifest } = require('./reads.cjs');
const { phaseItems, buildDiscoveryMap, postponedItem, buildBegun, legacyBuild, buildRefusal } = require('./derivations.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { entryRefusal, pastItsSpec } = require('./spec-standing.cjs');

/**
 * A topic on the map, as derivations' `buildDiscoveryMap` reads it.
 * @typedef {object} MapRow
 * @property {string} name
 * @property {string|null} summary
 * @property {string} title  how screens title the topic (derivations' `topicTitle`)
 * @property {number|null} order
 * @property {string} lifecycle  `fresh` | `discussing` | `decided` | `cancelled` | `postponed`
 * @property {string} tier       `◐` | `✓` | `○` | `⊘` | `⊖`
 * @property {boolean} mail_waiting  messages wait in the topic's mailbox
 */

/** @typedef {{total: number, decided: number, in_flight: number, fresh: number, cancelled: number, postponed: number}} MapSummary */

/**
 * @typedef {object} EpicDetail
 * @property {MapRow[]} map            the map's topics, in its order
 * @property {MapSummary} summary      the tally they make
 * @property {Record<string, number>} experiments  the experiments waiting, by topic, for each topic with any
 * @property {Record<string, string|null>} horizons the horizon each postponed topic waits under, by topic
 * @property {'start'|'continue'|null} spec  the spec the menu offers
 * @property {boolean} map_closed      the unit is past its spec
 * @property {string|null} old        the line an epic built under the old plan shows
 */

/** The experiments waiting for each topic with any (the header's). @param {Record<string, any>} manifest @returns {Record<string, number>} */
function experimentsWaiting(manifest) {
  /** @type {Record<string, number>} */
  const waiting = {};
  for (const item of phaseItems(manifest, 'experiment')) {
    if (item.status !== 'in-progress' || item.experiments === null || typeof item.experiments !== 'object') continue;
    const live = Object.entries(item.experiments)
      .filter(([id, record]) => isParentExperimentId(id) && record !== null && typeof record === 'object' && !EXPERIMENT_TERMINAL_STATUSES.includes(record.status));
    if (live.length > 0) waiting[item.name] = live.length;
  }
  return waiting;
}

/** The horizon each postponed topic waits under (the header's). @param {string} cwd @param {string} epic @param {MapRow[]} map @returns {Record<string, string|null>} */
function horizonsOf(cwd, epic, map) {
  const project = loadProjectManifest(cwd);
  return Object.fromEntries(map.filter((row) => row.lifecycle === 'postponed').map((row) => {
    const item = postponedItem(project, epic, row.name);
    return [row.name, item !== null && item.waiting ? item.horizon : null];
  }));
}

/** The spec the menu offers (the header's). @param {string} cwd @param {Record<string, any>} manifest @returns {'start'|'continue'|null} */
function specRow(cwd, manifest) {
  if (phaseItems(manifest, 'specification').length > 0 || buildBegun(manifest) || entryRefusal(manifest) !== null) return null;
  return pastItsSpec(cwd, manifest) ? 'continue' : 'start';
}

/**
 * The epic's detail (the header's), for its manifest.
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {EpicDetail}
 */
function epicDetail(cwd, manifest) {
  const { map, summary } = buildDiscoveryMap(manifest, stateRoot(cwd));
  return {
    map,
    summary,
    experiments: experimentsWaiting(manifest),
    horizons: horizonsOf(cwd, manifest.name, map),
    spec: specRow(cwd, manifest),
    map_closed: pastItsSpec(cwd, manifest),
    old: legacyBuild(manifest) ? buildRefusal(manifest) : null,
  };
}

module.exports = { epicDetail };
