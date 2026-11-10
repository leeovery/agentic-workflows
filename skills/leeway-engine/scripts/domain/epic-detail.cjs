'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the epic detail — the one structured object every epic
// projection and reasoning surface derives from.
//
// Reads the work unit's manifest (already loaded by the caller) and computes
// per-phase items, lifecycle joins, the build's row and the discovery map. Pure over its inputs: same manifest, same answer. Shared
// manifest semantics come from domain/derivations — never
// duplicated here.
// ---------------------------------------------------------------------------

const { EPIC_PHASES, LEGACY_PHASES, DERIVED_PHASES, EXPERIMENT_TERMINAL_STATUSES, isParentExperimentId, compareExperimentIds } = require('../kernel/manifest-schema.cjs');
const { loadProjectManifest } = require('./reads.cjs');
const {
  phaseItems,
  computeAnalysisCacheStatus,
  buildDiscoveryMap,
  computeTopicLifecycle,
  mailboxDepth,
  UNIT_PHASES,
  unitItems,
  liveUnitItems,
  CLOSED_LIFECYCLES,
  postponePlan,
  postponedItem,
  buildBegun,
  buildByCut,
  buildPlaceStatus,
  legacyBuild,
  buildRefusal,
  topicTitles,
} = require('./derivations.cjs');
const { discoveryLifecycleLabel } = require('./conventions.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { entryRefusal, pastItsSpec } = require('./spec-standing.cjs');
const { buildStanding } = require('./build-entry.cjs');

/**
 * @typedef {object} SpecSource
 * @property {string} [topic]  source discussion name (object-format sources)
 * @property {string} [name]   source discussion name (legacy array format)
 * @property {string} [status] `incorporated` | `pending`
 */

/**
 * @typedef {object} ExperimentRow
 * @property {string} id      `E1`, `E2`, …
 * @property {string} slug
 * @property {string} status  one of the experiment record vocabulary
 */

/**
 * @typedef {object} PhaseEntry
 * @property {string} name
 * @property {string} status
 * @property {ExperimentRow[]} [experiments]   experiment items — the live (non-terminal)
 *                                             top-level records, id order; the menu's
 *                                             topic-grain entry reads them for its tail
 * @property {SpecSource[]} [sources]          specification items
 * @property {string|number} [current_phase]   implementation items
 * @property {string[]} [completed_tasks]      implementation items
 */

/**
 * @typedef {object} ItemRef
 * @property {string} name
 * @property {string} phase
 */

/** @typedef {'discovery'} UnitStage */

/**
 * @typedef {object} RestoreRef
 * @property {string} phase
 * @property {string|null} previous_status  the status a reactivate returns the item to
 */

/**
 * @typedef {object} CancelledUnit
 * @property {string} name
 * @property {UnitStage} stage
 * @property {RestoreRef[]} restores  what a reactivate returns — empty for a never-started topic
 */

/**
 * @typedef {object} PostponedTopic
 * @property {string} name
 * @property {string|null} horizon  the roadmap bucket it waits in — null when no item joins it
 * @property {string|null} item     the roadmap item's own name — the pull forward's argument
 * @property {boolean} waiting      the item is waiting, so the topic can be pulled back
 */

/**
 * @typedef {object} CancellableUnit
 * @property {string} name
 * @property {UnitStage} stage
 * @property {string} state    the unit's state tag — the topic's map lifecycle label
 * @property {string} [locked] why the unit cannot be moved — the postpone's first lock
 */

/**
 * @typedef {object} MapRow
 * @property {string} name
 * @property {boolean} summary_present
 * @property {string|null} summary
 * @property {boolean} description_present
 * @property {string} title  how screens title the topic (derivations' `topicTitle`)
 * @property {string} goes_by  the name the topic goes by — its title, else its key
 * @property {string} source
 * @property {string|null} source_provenance
 * @property {number|null} order
 * @property {string} lifecycle  `fresh` | `discussing` | `decided` | `cancelled` | `postponed`
 * @property {string} tier       `◐` | `✓` | `○` | `⊘` | `⊖`
 * @property {string|null} current_phase
 * @property {string|null} discussion_state  the discussion item's raw status, null when none exists
 * @property {string|null} promoted_to  the cross-cutting unit a promoted discussion moved to, null otherwise
 * @property {boolean} mail_waiting  messages wait in the topic's mailbox, whatever its items' status
 * @property {number} mail_queued  how many messages wait in the topic's mailbox, counted from disk
 * @property {import('./derivations.cjs').Wait[]} waits  the live waits of the topic's in-progress discussion (empty when none)
 * @property {string|null} next_action
 */

/**
 * @typedef {object} MapSummary
 * @property {number} total
 * @property {number} decided
 * @property {number} in_flight
 * @property {number} fresh
 * @property {number} cancelled
 * @property {number} postponed
 */

/**
 * @typedef {object} AnalysisCache
 * @property {string} status  `valid` | `stale` | `absent`
 * @property {boolean} stamped  an analysis has stamped the cache
 * @property {string|null} generated
 * @property {string[]} files
 * @property {string} [reason]
 */

/** @typedef {import('./build-entry.cjs').BuildStanding} BuildStanding */

/**
 * Where the epic's build stands as its menu offers it (18.4.6): building,
 * with where its build stands; in its review phase; or built under the old
 * plan, the line it shows while it waits on the migration's cut (P12).
 * @typedef {{state: 'building', standing: BuildStanding}|{state: 'reviewing'}|{state: 'old', line: string}} BuildRow
 */

/**
 * @typedef {object} EpicDetail
 * @property {Record<string, PhaseEntry[]>} phases  build phases with items (discovery excluded)
 * @property {ItemRef[]} in_progress
 * @property {ItemRef[]} completed
 * @property {CancellableUnit[]} cancellable  every topic the cancel menu lists, map order
 * @property {CancelledUnit[]} cancelled      every unit reading cancelled, the same order
 * @property {CancellableUnit[]} postponable  every Discovery unit the postpone menu lists, locked ones included — map order
 * @property {PostponedTopic[]} postponed     the topics that left for the roadmap, map order
 * @property {'start'|'continue'|null} spec_row  the spec the menu offers — to start, or to carry on once written; null
 *                             while a topic is open, once the build has begun, and on a unit keeping the old spec's items
 * @property {boolean} map_closed  the unit is past its spec, so its map is closed (18.4.19): no topic is added, cancelled,
 *                             postponed, pulled forward or reactivated, nor the map talked over in discovery
 * @property {BuildRow|null} build  the build the menu offers in place of the plan rows; null before ready to build's yes, and
 *                             once finish has completed the unit
 * @property {MapRow[]} discovery_map
 * @property {Record<string, string>} titles  the titles a rename gave started topics, by key (derivations' `topicTitles`)
 * @property {string|null} active_session  in-progress discovery session number, or null
 * @property {string|null} convergence_state  `in-progress` | `settled` | null (no map)
 * @property {boolean} needs_sequencing
 * @property {MapSummary|null} map_summary
 * @property {number} seeds_count
 * @property {{gap_analysis: AnalysisCache}} analysis_caches
 */

/** What a reactivate returns for a topic — its cancelled items with their stashes. @param {object} manifest @param {string} name @returns {RestoreRef[]} */
function unitRestores(manifest, name) {
  return unitItems(manifest, 'discovery', name)
    .filter(({ item }) => item.status === 'cancelled')
    .map(({ phase, item }) => ({ phase, previous_status: item.previous_status || null }));
}

/**
 * The Discovery-stage units, in map order — every map row, then the topics
 * a manifest carries only as discussion items (name order), whose unit is
 * the name alone.
 * @param {object} manifest @param {MapRow[]} discoveryMap
 * @returns {{name: string, row: MapRow|undefined}[]}
 */
function discoveryUnits(manifest, discoveryMap) {
  const onMap = new Set(discoveryMap.map((r) => r.name));
  const offMap = new Set();
  for (const phase of UNIT_PHASES.discovery) {
    for (const it of phaseItems(manifest, phase)) {
      if (!onMap.has(it.name)) offMap.add(it.name);
    }
  }
  return [
    ...discoveryMap.map((row) => ({ name: row.name, row })),
    ...[...offMap].sort().map((name) => ({ name, row: undefined })),
  ];
}

/** The state tag a topic's cancel row carries — the map's own lifecycle label. @param {string} cwd @param {object} manifest @param {string} name @param {MapRow|undefined} row */
function topicState(cwd, manifest, name, row) {
  if (row) return discoveryLifecycleLabel(row.lifecycle, row.mail_waiting, row.waits, row.promoted_to);
  const { lifecycle } = computeTopicLifecycle(manifest, name);
  return discoveryLifecycleLabel(lifecycle, mailboxDepth(stateRoot(cwd), manifest.name, name) > 0);
}

/**
 * The cancel units: every Discovery unit not reading cancelled or
 * postponed. A topic off the map with nothing live beneath it has nothing a
 * cancel could take and is left out.
 * @param {string} cwd @param {object} manifest @param {MapRow[]} discoveryMap
 * @returns {CancellableUnit[]}
 */
function cancellableUnits(cwd, manifest, discoveryMap) {
  /** @type {CancellableUnit[]} */
  const units = [];
  for (const { name, row } of discoveryUnits(manifest, discoveryMap)) {
    const lifecycle = row ? row.lifecycle : computeTopicLifecycle(manifest, name).lifecycle;
    // A postponed unit is the roadmap's, not this menu's: its own remove is
    // the door to "actually never".
    if (lifecycle === 'cancelled' || lifecycle === 'postponed') continue;
    if (!row && liveUnitItems(manifest, 'discovery', name).length === 0) continue;
    units.push({ name, stage: 'discovery', state: topicState(cwd, manifest, name, row) });
  }
  return units;
}

/**
 * The cancelled units — every Discovery unit reading cancelled (its marker,
 * or the legacy every-item reading) — each carrying what a reactivate
 * returns.
 * @param {object} manifest @param {MapRow[]} discoveryMap
 * @returns {CancelledUnit[]}
 */
function cancelledUnits(manifest, discoveryMap) {
  /** @type {CancelledUnit[]} */
  const units = [];
  for (const { name, row } of discoveryUnits(manifest, discoveryMap)) {
    const lifecycle = row ? row.lifecycle : computeTopicLifecycle(manifest, name).lifecycle;
    if (lifecycle !== 'cancelled') continue;
    units.push({ name, stage: 'discovery', restores: unitRestores(manifest, name) });
  }
  return units;
}

/**
 * The postpone units: every Discovery unit not already postponed or
 * cancelled, in map order — locked ones carrying the plan's first lock,
 * never omitted.
 * @param {string} cwd @param {object} manifest @param {MapRow[]} discoveryMap @param {object|null} project
 * @returns {CancellableUnit[]}
 */
function postponableUnits(cwd, manifest, discoveryMap, project) {
  /** @type {CancellableUnit[]} */
  const units = [];
  for (const { name, row } of discoveryUnits(manifest, discoveryMap)) {
    const lifecycle = row ? row.lifecycle : computeTopicLifecycle(manifest, name).lifecycle;
    if (lifecycle === 'cancelled' || lifecycle === 'postponed') continue;
    if (!row && liveUnitItems(manifest, 'discovery', name).length === 0) continue;
    const [lock] = postponePlan(manifest, name, project).locks;
    units.push({ name, stage: 'discovery', state: topicState(cwd, manifest, name, row), ...(lock ? { locked: lock.reason } : {}) });
  }
  return units;
}

/**
 * The postponed topics with the roadmap item each waits as — joined by
 * `postponed_from`, so the dashboard's compact line names where the topic
 * went rather than only that it left, and the pull-forward row knows which
 * item brings it back. An item pulled into another epic since is no longer
 * waiting: its topic stays postponed here with no way back.
 * @param {object} manifest @param {MapRow[]} discoveryMap @param {object|null} project
 * @returns {PostponedTopic[]}
 */
function postponedTopics(manifest, discoveryMap, project) {
  return discoveryUnits(manifest, discoveryMap)
    .filter(({ name, row }) => (row ? row.lifecycle : computeTopicLifecycle(manifest, name).lifecycle) === 'postponed')
    .map(({ name }) => {
      const item = postponedItem(project, manifest.name, name);
      return {
        name,
        horizon: item ? item.horizon : null,
        item: item ? item.name : null,
        waiting: item !== null && item.waiting,
      };
    });
}

/**
 * The spec the epic's menu offers (18.4.6): none while a topic is open, nor
 * once ready to build's yes has begun the build, nor on a unit whose
 * building began under the old spec, which keeps its items (29.17); else to
 * start, or to carry on once `spec.md` is written.
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {'start'|'continue'|null}
 */
function specRow(cwd, manifest) {
  if (phaseItems(manifest, 'specification').length > 0 || buildBegun(manifest) || entryRefusal(manifest) !== null) return null;
  return pastItsSpec(cwd, manifest) ? 'continue' : 'start';
}

/**
 * The build the menu offers (the typedef's): one in the old shape names the
 * migration's cut as the build's entry refuses it; one by its cut is in its
 * review phase or building, its standing read for the phase it is at.
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {BuildRow|null}
 */
function buildRow(cwd, manifest) {
  if (legacyBuild(manifest)) return { state: 'old', line: /** @type {string} */ (buildRefusal(manifest)) };
  if (!buildByCut(manifest)) return null;
  const review = buildPlaceStatus(manifest, 'review');
  if (review === 'completed') return null;
  return review === 'in-progress' ? { state: 'reviewing' } : { state: 'building', standing: buildStanding(cwd, manifest.name, []) };
}

/**
 * @param {string} cwd
 * @param {object} manifest
 * @returns {{gap_analysis: AnalysisCache}}
 */
function buildAnalysisCaches(cwd, manifest) {
  const stateDir = stateRoot(cwd);
  return {
    gap_analysis: computeAnalysisCacheStatus(manifest, stateDir, 'gap-analysis'),
  };
}

/** The phases an old unit keeps items in past its discussions (P12). */
const PAST_THE_TOPICS = ['specification', ...LEGACY_PHASES, 'implementation', 'review'];

/**
 * Build the full epic detail for one work unit's manifest.
 * @param {string} cwd       project root
 * @param {object} manifest  the work unit's parsed manifest.json
 * @returns {EpicDetail}
 */
function epicDetail(cwd, manifest) {
  /** @type {Record<string, PhaseEntry[]>} */
  const phases = {};
  /** @type {ItemRef[]} */
  const completedItems = [];
  const inProgressItems = [];

  for (const phase of EPIC_PHASES) {
    if (phase === 'discovery') continue;
    const items = phaseItems(manifest, phase);
    if (items.length === 0) continue;

    const phaseEntries = [];
    for (const item of items) {
      /** @type {PhaseEntry} */
      const entry = { name: item.name, status: item.status || 'unknown' };

      // A live series' open experiments ride the entry — the topic's menu
      // row counts them, appearing at the first spawn and retiring when no
      // live record remains. Top-level records only: a split is the
      // laboratory's internal method, worked through its parent.
      if (DERIVED_PHASES.includes(phase) && item.status === 'in-progress'
          && item.experiments && typeof item.experiments === 'object') {
        const live = Object.entries(item.experiments)
          .filter(([id, r]) => isParentExperimentId(id) && r && typeof r === 'object'
            && !EXPERIMENT_TERMINAL_STATUSES.includes(r.status))
          .map(([id, r]) => ({ id, slug: r.slug, status: r.status }))
          .sort((a, b) => compareExperimentIds(a.id, b.id));
        if (live.length > 0) entry.experiments = live;
      }

      if (phase === 'specification' && item.sources) {
        entry.sources = Array.isArray(item.sources)
          ? item.sources
          : Object.entries(item.sources).map(([topic, data]) => ({ topic, ...data }));
      }

      // An old implementation's item shows its progress in the tree (P12).
      if (phase === 'implementation') {
        if (item.current_phase != null && item.current_phase !== '~') entry.current_phase = item.current_phase;
        if (Array.isArray(item.completed_tasks) && item.completed_tasks.length > 0) entry.completed_tasks = item.completed_tasks;
      }

      phaseEntries.push(entry);

      if (item.status === 'in-progress') {
        inProgressItems.push({ name: item.name, phase });
      }
      // A derived item has no session of its own: a completed series has
      // nothing to resume (a new spawn reopens it). Nor has an item an old
      // unit kept past its discussions: the spec is entered at the unit, and
      // the old plan's build waits on the migration's cut (P12). None joins
      // the resume candidates.
      if (item.status === 'completed' && !DERIVED_PHASES.includes(phase) && !PAST_THE_TOPICS.includes(phase)) {
        completedItems.push({ name: item.name, phase });
      }
    }

    phases[phase] = phaseEntries;
  }

  // The map rows, summary, and sequencing flag come from the shared builder —
  // the same rows the discovery-session gateway reads. map_summary stays null
  // (not the zero-count shape) when the map is empty, the epic dashboard's cue
  // that there is no map to render.
  const builtMap = buildDiscoveryMap(manifest, stateRoot(cwd));
  // The postpone's other half lives on the project manifest: the roadmap
  // item joined by `postponed_from` carries the horizon the topic waits in.
  const project = loadProjectManifest(cwd);
  /** @type {MapRow[]} */
  const discoveryMap = builtMap.map;
  const mapSummary = discoveryMap.length > 0 ? builtMap.summary : null;
  let convergenceState = null;
  if (discoveryMap.length > 0) {
    const allSettled = discoveryMap.every(t =>
      t.lifecycle === 'decided' || CLOSED_LIFECYCLES.includes(t.lifecycle));
    convergenceState = allSettled ? 'settled' : 'in-progress';
  }

  const seedsCount = Array.isArray(manifest.seeds) ? manifest.seeds.length : 0;

  return {
    phases,
    in_progress: inProgressItems,
    completed: completedItems,
    cancellable: cancellableUnits(cwd, manifest, discoveryMap),
    cancelled: cancelledUnits(manifest, discoveryMap),
    postponable: postponableUnits(cwd, manifest, discoveryMap, project),
    postponed: postponedTopics(manifest, discoveryMap, project),
    spec_row: specRow(cwd, manifest),
    map_closed: pastItsSpec(cwd, manifest),
    build: buildRow(cwd, manifest),
    discovery_map: discoveryMap,
    titles: topicTitles(manifest),
    active_session: (manifest.phases && manifest.phases.discovery && typeof manifest.phases.discovery.active_session === 'string')
      ? manifest.phases.discovery.active_session : null,
    convergence_state: convergenceState,
    needs_sequencing: builtMap.needs_sequencing,
    map_summary: mapSummary,
    seeds_count: seedsCount,
    analysis_caches: buildAnalysisCaches(cwd, manifest),
  };
}

module.exports = { epicDetail };
