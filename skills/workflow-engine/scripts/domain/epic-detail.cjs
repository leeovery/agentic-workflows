'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the epic detail — the one structured object every epic
// projection and reasoning surface derives from.
//
// Reads the work unit's manifest (already loaded by the caller) and computes
// per-phase items, lifecycle joins, gating, next-phase readiness, and the
// discovery map. Pure over its inputs: same manifest, same answer. Shared
// manifest semantics come from domain/derivations — never
// duplicated here.
// ---------------------------------------------------------------------------

const path = require('path');
const { WORK_TYPE_PIPELINES, DERIVED_PHASES, TERMINAL_STATUSES, EXPERIMENT_TERMINAL_STATUSES, isParentExperimentId, compareExperimentIds } = require('../kernel/manifest-schema.cjs');
const {
  phaseItems,
  computeAnalysisCacheStatus,
  buildDiscoveryMap,
} = require('./derivations.cjs');
const { computeBuildOrderNeedsSequencing, sortItemsByBuildOrder } = require('./build-order.cjs');

// Every phase the epic detail iterates and the epic dashboard / thin dump
// surface — discovery (the map, not a pipeline phase) first, then the epic
// pipeline from the schema's one home for pipeline order.
const EPIC_DETAIL_PHASES = ['discovery', ...WORK_TYPE_PIPELINES.epic];

/**
 * @typedef {object} SpecSource
 * @property {string} [topic]  source discussion name (object-format sources)
 * @property {string} [name]   source discussion name (legacy array format)
 * @property {string} [status] `incorporated` | `pending`
 */

/**
 * @typedef {object} DepBlocking
 * @property {string} topic          the plan this dependency points at
 * @property {string} [internal_id]  cross-plan task reference
 * @property {string} reason         why the dependency blocks
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
 * @property {string|boolean} [reconcile_needed]  a live reconcile flag — the upstream phase that
 *                                             moved, or `true` for a brief flag
 * @property {ExperimentRow[]} [experiments]   experiment items — the live (non-terminal)
 *                                             top-level records, id order; the menu's
 *                                             topic-grain entry reads them for its tail
 * @property {SpecSource[]} [sources]          specification items
 * @property {string[]} [blocked_by]           specification items whose source is back in-progress
 * @property {string} [format]                 planning items
 * @property {boolean} [deps_satisfied]        planning items
 * @property {DepBlocking[]} [deps_blocking]   planning items with unmet deps
 * @property {string|number} [current_phase]   implementation items
 * @property {string} [current_task]           implementation items — the task in flight
 * @property {string[]} [completed_phases]     implementation items
 * @property {string[]} [completed_tasks]      implementation items
 */

/**
 * @typedef {object} ItemRef
 * @property {string} name
 * @property {string} phase
 * @property {string|boolean} [reconcile_needed]  completed items only — a live reconcile flag
 * @property {string|null} [previous_status]   cancelled items only
 */

/**
 * @typedef {object} NextPhaseEntry
 * @property {string} name
 * @property {string} action  `start_specification` | `start_planning` | `start_implementation` | `start_review`
 * @property {string} label
 * @property {boolean} [blocked]
 * @property {DepBlocking[]} [deps_blocking]
 */

/**
 * @typedef {object} MapRow
 * @property {string} name
 * @property {boolean} summary_present
 * @property {string|null} summary
 * @property {boolean} description_present
 * @property {string|null} routing
 * @property {string} source
 * @property {string|null} source_provenance
 * @property {number|null} order
 * @property {string} lifecycle  `fresh` | `researching` | `ready_for_discussion` | `discussing` | `decided` | `handled` | `cancelled`
 * @property {string} tier       `→` | `◐` | `✓` | `○` | `⊙` | `⊘`
 * @property {string|null} current_phase
 * @property {string|null} research_state  the research item's raw status, null when none exists
 * @property {string|null} discussion_state  the discussion item's raw status, null when none exists
 * @property {boolean} triage_parked  a `triaged` stub (parked rerouted concerns) exists in either phase
 * @property {boolean} reconcile_pending  a phase item beneath the row carries a live reconcile flag
 * @property {import('./derivations.cjs').Wait[]} waits  the live waits of the topic's in-progress research and discussion items (empty when none)
 * @property {string|null} next_action
 */

/**
 * @typedef {object} MapSummary
 * @property {number} total
 * @property {number} decided
 * @property {number} in_flight
 * @property {number} ready
 * @property {number} fresh
 * @property {number} handled
 * @property {number} cancelled
 */

/**
 * @typedef {object} AnalysisCache
 * @property {string} status  `valid` | `stale` | `absent`
 * @property {string|null} generated
 * @property {string[]} files
 * @property {string} [reason]
 */

/**
 * @typedef {object} EpicDetail
 * @property {Record<string, PhaseEntry[]>} phases  build phases with items (discovery excluded)
 * @property {ItemRef[]} in_progress
 * @property {ItemRef[]} completed
 * @property {ItemRef[]} cancelled
 * @property {NextPhaseEntry[]} next_phase_ready
 * @property {string[]} unaccounted_discussions
 * @property {string[]} reopened_discussions
 * @property {{name: string, by: string[]}[]} spec_blocked  live spec items whose source discussion is back in-progress
 * @property {MapRow[]} discovery_map
 * @property {string|null} active_session  in-progress discovery session number, or null
 * @property {string|null} convergence_state  `in-progress` | `settled` | null (no map)
 * @property {boolean} needs_sequencing
 * @property {boolean} build_order_needs_sequencing  the live set's orders are not a contiguous 1..N permutation (missing, duplicate, or hole), or completion flagged them stale
 * @property {MapSummary|null} map_summary
 * @property {number} imports_count
 * @property {number} seeds_count
 * @property {{gap_analysis: AnalysisCache}} analysis_caches
 * @property {{can_start_specification: boolean, can_start_planning: boolean, can_start_implementation: boolean, can_start_review: boolean}} gating
 */

/**
 * Resolve a planning item's external dependencies against this manifest's
 * implementation items.
 * @param {object} manifest
 * @param {PhaseEntry & {external_dependencies?: object}} planItem
 * @returns {{deps_satisfied: boolean, deps_blocking: DepBlocking[]}}
 */
function resolveDeps(manifest, planItem) {
  const externalDepsObj = (planItem.external_dependencies && typeof planItem.external_dependencies === 'object' && !Array.isArray(planItem.external_dependencies))
    ? planItem.external_dependencies
    : {};

  const externalDeps = Object.entries(externalDepsObj).map(([depTopic, d]) => ({ topic: depTopic, ...d }));
  let depsSatisfied = true;
  const depsBlocking = [];

  for (const dep of externalDeps) {
    if (dep.state === 'satisfied_externally') continue;
    if (dep.state === 'unresolved') {
      depsSatisfied = false;
      depsBlocking.push({ topic: dep.topic, reason: 'dependency unresolved' });
    } else if (dep.state === 'resolved' && dep.internal_id) {
      // Dep topics live in the same work unit — read the implementation item
      // from this manifest. A completed implementation satisfies the dep even
      // if the referenced task was skipped or its ID is stale.
      const depImpl = phaseItems(manifest, 'implementation').find(i => i.name === dep.topic) || {};
      const completedTasks = Array.isArray(depImpl.completed_tasks) ? depImpl.completed_tasks : [];
      if (depImpl.status !== 'completed' && !completedTasks.includes(dep.internal_id)) {
        depsSatisfied = false;
        depsBlocking.push({ topic: dep.topic, internal_id: dep.internal_id, reason: 'task not yet completed' });
      }
    } else if (dep.state === 'resolved' && !dep.internal_id) {
      depsSatisfied = false;
      depsBlocking.push({ topic: dep.topic, reason: 'resolved dependency missing task reference' });
    }
  }

  return { deps_satisfied: depsSatisfied, deps_blocking: depsBlocking };
}

/**
 * @param {string} cwd
 * @param {object} manifest
 * @returns {{gap_analysis: AnalysisCache}}
 */
function buildAnalysisCaches(cwd, manifest) {
  const workflowsDir = path.join(cwd, '.workflows');
  return {
    gap_analysis: computeAnalysisCacheStatus(manifest, workflowsDir, 'gap-analysis'),
  };
}

/**
 * Build the full epic detail for one work unit's manifest.
 * @param {string} cwd       project root (the directory containing `.workflows/`)
 * @param {object} manifest  the work unit's parsed manifest.json
 * @returns {EpicDetail}
 */
function epicDetail(cwd, manifest) {
  /** @type {Record<string, PhaseEntry[]>} */
  const phases = {};
  const allSourcedDiscussions = new Set();
  const groupedDiscussions = new Set();
  const completedItems = [];
  const inProgressItems = [];
  const cancelledItems = [];
  /** @type {NextPhaseEntry[]} */
  const nextPhaseReady = [];

  const BUILD_ORDER_PHASES = ['specification', 'planning', 'implementation'];
  for (const phase of EPIC_DETAIL_PHASES) {
    if (phase === 'discovery') continue;
    let items = phaseItems(manifest, phase);
    if (items.length === 0) continue;
    // The build order sorts the three build phases everywhere the detail
    // feeds — dashboard trees, menu entries, recommendation scans — as a
    // stable tiebreak within whatever grouping a surface applies on top.
    if (BUILD_ORDER_PHASES.includes(phase)) {
      items = sortItemsByBuildOrder(items, manifest, phase);
    }

    const phaseEntries = [];
    for (const item of items) {
      /** @type {PhaseEntry} */
      const entry = { name: item.name, status: item.status || 'unknown' };
      if (item.reconcile_needed !== undefined) entry.reconcile_needed = item.reconcile_needed;

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
        const sourcesArr = Array.isArray(item.sources)
          ? item.sources
          : Object.entries(item.sources).map(([topic, data]) => ({ topic, ...data }));
        entry.sources = sourcesArr;
        // groupedDiscussions tracks every spec item's sources (proposed
        // included) — a discussion in any spec item is "grouped", which is
        // what unaccounted_discussions now measures.
        for (const src of sourcesArr) {
          groupedDiscussions.add(src.topic || src.name);
        }
        // allSourcedDiscussions tracks only materialized items' sources —
        // a proposed grouping has nothing extracted, so its sources can't
        // be "reopened". Reopened detection reads this set.
        if (item.status !== 'proposed') {
          for (const src of sourcesArr) {
            allSourcedDiscussions.add(src.topic || src.name);
          }
        }
      }

      // Enrich planning items with format and dependency data. Terminal
      // items get no dep computation — a cancelled plan must never carry
      // the blocked cue, surface in the ⚑ list, or take an unblock write.
      if (phase === 'planning') {
        if (item.format) entry.format = item.format;
        if (!TERMINAL_STATUSES.includes(item.status || '')) {
          const { deps_satisfied, deps_blocking } = resolveDeps(manifest, item);
          entry.deps_satisfied = deps_satisfied;
          if (deps_blocking.length > 0) entry.deps_blocking = deps_blocking;
        }
      }

      // Enrich implementation items with progress data
      if (phase === 'implementation') {
        if (item.current_phase != null && item.current_phase !== '~') entry.current_phase = item.current_phase;
        if (typeof item.current_task === 'string' && item.current_task) entry.current_task = item.current_task;
        if (Array.isArray(item.completed_phases) && item.completed_phases.length > 0) entry.completed_phases = item.completed_phases;
        if (Array.isArray(item.completed_tasks) && item.completed_tasks.length > 0) entry.completed_tasks = item.completed_tasks;
      }

      phaseEntries.push(entry);

      if (item.status === 'in-progress') {
        inProgressItems.push({ name: item.name, phase });
      }
      // A derived item has no session of its own: a completed series has
      // nothing to resume (a new spawn reopens it) and a cancelled one
      // nothing to reactivate (its rows stand; the next spawn revives it) —
      // so neither joins the resume or reactivate candidates.
      if (item.status === 'completed' && !DERIVED_PHASES.includes(phase)) {
        completedItems.push({
          name: item.name, phase,
          ...(item.reconcile_needed !== undefined ? { reconcile_needed: item.reconcile_needed } : {}),
        });
      }
      if (item.status === 'cancelled' && !DERIVED_PHASES.includes(phase)) {
        cancelledItems.push({ name: item.name, phase, previous_status: item.previous_status || null });
      }
    }

    phases[phase] = phaseEntries;
  }

  const discussionItems = phaseItems(manifest, 'discussion');
  const unaccountedDiscussions = [];
  for (const d of discussionItems) {
    if (d.status === 'completed' && !groupedDiscussions.has(d.name)) {
      unaccountedDiscussions.push(d.name);
    }
  }

  const reopenedDiscussions = [];
  for (const d of discussionItems) {
    if (d.status === 'in-progress' && allSourcedDiscussions.has(d.name)) {
      reopenedDiscussions.push(d.name);
    }
  }

  const specItems = sortItemsByBuildOrder(phaseItems(manifest, 'specification'), manifest, 'specification');
  const planItems = sortItemsByBuildOrder(phaseItems(manifest, 'planning'), manifest, 'planning');
  const implItems = sortItemsByBuildOrder(phaseItems(manifest, 'implementation'), manifest, 'implementation');

  // A spec item (proposed included) whose source discussion is back
  // in-progress is blocked from entry until it re-concludes — the epic menu
  // hard-blocks the route.
  const discussionStatus = new Map(discussionItems.map((d) => [d.name, d.status]));
  /** @type {{name: string, by: string[]}[]} */
  const specBlocked = [];
  for (const s of specItems) {
    if (TERMINAL_STATUSES.includes(s.status || '')) continue;
    const srcs = Array.isArray(s.sources)
      ? s.sources
      : Object.entries(s.sources || {}).map(([topic, data]) => ({ topic, ...(typeof data === 'object' ? data : {}) }));
    const open = srcs.map((src) => src.topic || src.name).filter((n) => n && discussionStatus.get(n) === 'in-progress');
    if (open.length > 0) specBlocked.push({ name: s.name, by: open });
  }
  // The display tree shows the blocked state; the menu never offers a
  // blocked item, so the entries carry the fact for the projections.
  for (const e of phases.specification || []) {
    const b = specBlocked.find((x) => x.name === e.name);
    if (b) e.blocked_by = b.by;
  }

  // Proposed groupings are actionable from the epic menu — surface them as
  // start_specification. Pushed before start_planning so they precede it in
  // pipeline order (spec → planning), which the settled-state recommendation
  // reads. A blocked grouping is not actionable: it stays out of the menu
  // and shows its blocked state on the display tree instead.
  for (const s of specItems) {
    if (s.status === 'proposed' && !specBlocked.some((b) => b.name === s.name)) {
      nextPhaseReady.push({ name: s.name, action: 'start_specification', label: 'grouping ready' });
    }
  }

  const planTopics = new Set(planItems.filter(i => i.status !== 'cancelled').map(i => i.name));
  for (const s of specItems) {
    if (s.status === 'completed' && !planTopics.has(s.name)) {
      nextPhaseReady.push({ name: s.name, action: 'start_planning', label: 'spec completed' });
    }
  }

  const implTopics = new Set(implItems.filter(i => i.status !== 'cancelled').map(i => i.name));
  for (const p of planItems) {
    if (p.status === 'completed' && !implTopics.has(p.name)) {
      // Check deps before marking as ready for implementation
      const { deps_satisfied, deps_blocking } = resolveDeps(manifest, p);
      if (deps_satisfied) {
        nextPhaseReady.push({ name: p.name, action: 'start_implementation', label: 'plan completed' });
      } else {
        nextPhaseReady.push({
          name: p.name, action: 'start_implementation', label: 'plan completed',
          blocked: true, deps_blocking,
        });
      }
    }
  }

  const reviewItems = phaseItems(manifest, 'review');
  const reviewTopics = new Set(reviewItems.filter(i => i.status !== 'cancelled').map(i => i.name));
  for (const i of implItems) {
    if (i.status === 'completed' && !reviewTopics.has(i.name)) {
      nextPhaseReady.push({ name: i.name, action: 'start_review', label: 'implementation completed' });
    }
  }

  const hasCompletedSpec = specItems.some(s => s.status === 'completed');
  const hasCompletedPlan = planItems.some(p => p.status === 'completed');
  const hasCompletedDiscussion = discussionItems.some(d => d.status === 'completed');
  const hasCompletedImpl = implItems.some(i => i.status === 'completed');

  // The map rows, summary, and sequencing flag come from the shared builder —
  // the same rows the discovery-session gateway reads. map_summary stays null
  // (not the zero-count shape) when the map is empty, the epic dashboard's cue
  // that there is no map to render.
  const builtMap = buildDiscoveryMap(manifest);
  /** @type {MapRow[]} */
  const discoveryMap = builtMap.map;
  const mapSummary = discoveryMap.length > 0 ? builtMap.summary : null;
  let convergenceState = null;
  if (discoveryMap.length > 0) {
    const allSettled = discoveryMap.every(t =>
      t.lifecycle === 'decided' || t.lifecycle === 'cancelled' || t.lifecycle === 'handled');
    convergenceState = allSettled ? 'settled' : 'in-progress';
  }

  const importsCount = Array.isArray(manifest.imports) ? manifest.imports.length : 0;
  const seedsCount = Array.isArray(manifest.seeds) ? manifest.seeds.length : 0;

  return {
    phases,
    in_progress: inProgressItems,
    completed: completedItems,
    cancelled: cancelledItems,
    next_phase_ready: nextPhaseReady,
    unaccounted_discussions: unaccountedDiscussions,
    reopened_discussions: reopenedDiscussions,
    spec_blocked: specBlocked,
    discovery_map: discoveryMap,
    active_session: (manifest.phases && manifest.phases.discovery && typeof manifest.phases.discovery.active_session === 'string')
      ? manifest.phases.discovery.active_session : null,
    convergence_state: convergenceState,
    needs_sequencing: builtMap.needs_sequencing,
    build_order_needs_sequencing: computeBuildOrderNeedsSequencing(manifest),
    map_summary: mapSummary,
    imports_count: importsCount,
    seeds_count: seedsCount,
    analysis_caches: buildAnalysisCaches(cwd, manifest),
    gating: {
      can_start_specification: hasCompletedDiscussion,
      can_start_planning: hasCompletedSpec,
      can_start_implementation: hasCompletedPlan,
      can_start_review: hasCompletedImpl,
    },
  };
}

module.exports = { EPIC_DETAIL_PHASES, epicDetail };
