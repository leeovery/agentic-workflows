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
const { loadProjectManifest } = require('./reads.cjs');
const {
  phaseItems,
  outstandingResearch,
  computeAnalysisCacheStatus,
  buildDiscoveryMap,
  computeTopicLifecycle,
  UNIT_PHASES,
  unitItems,
  liveUnitItems,
  specIsStarted,
  specGroupsSources,
  lockingSpecs,
  CLOSED_LIFECYCLES,
  postponePlan,
  postponedItem,
  specReactivateLocks,
  reactivateLockPhrases,
  deliveryStarted,
  specUnsettled,
  OPEN_SOURCE_STATUSES,
} = require('./derivations.cjs');
const { computeBuildOrderNeedsSequencing, sortItemsByBuildOrder } = require('./build-order.cjs');
const { discoveryLifecycleLabel, titlecase } = require('./conventions.cjs');

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
 * @property {string[]} [blocked_by]           what holds the item's entry shut — a specification's
 *                                             source discussions still open, `['research']`
 *                                             on a discussion whose research is outstanding, or
 *                                             `['specification']` on a plan whose spec is unsettled
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
 * @property {string[]} [blocked_by]           completed items only — what holds the item's entry
 *                                             shut (the phase entry's `blocked_by`); no resume row
 */

/** @typedef {'discovery'|'specification'} UnitStage */

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
 * @property {string} [locked] why the unit cannot be reactivated — a source topic cancelled, or a
 *                             source another started specification has taken
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
 * @property {string} state    the unit's state tag — the map lifecycle label for a topic, the
 *                             specification's status for a specification
 * @property {string} [locked] why the unit cannot be cancelled — the later stage holding it
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
 * @property {string} lifecycle  `fresh` | `researching` | `ready_for_discussion` | `discussing` | `decided` | `handled` | `cancelled` | `postponed`
 * @property {string} tier       `→` | `◐` | `✓` | `○` | `⊙` | `⊘` | `⊖`
 * @property {string|null} current_phase
 * @property {string|null} research_state  the research item's raw status, null when none exists
 * @property {string|null} discussion_state  the discussion item's raw status, null when none exists
 * @property {boolean} triage_parked  rerouted concerns wait on the topic — a `triaged` stub in either phase, or queue files on disk beneath a started or reopened item
 * @property {{research: number, discussion: number}} triage_queued  the topic's queue depth per phase, counted from disk
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
 * @property {number} postponed
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
 * @property {CancellableUnit[]} cancellable  every unit the cancel menu lists, locked ones included — topics in map order, then specifications in build order
 * @property {CancelledUnit[]} cancelled      every unit reading cancelled, the same order
 * @property {CancellableUnit[]} postponable  every Discovery unit the postpone menu lists, locked ones included — map order
 * @property {PostponedTopic[]} postponed     the topics that left for the roadmap, map order
 * @property {NextPhaseEntry[]} next_phase_ready
 * @property {string[]} unaccounted_discussions
 * @property {string[]} reopened_discussions
 * @property {{name: string, by: string[]}[]} spec_blocked  live spec items whose source discussion has not concluded
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

/** What a reactivate returns for a unit — its cancelled items with their stashes. @param {object} manifest @param {UnitStage} stage @param {string} name @returns {RestoreRef[]} */
function unitRestores(manifest, stage, name) {
  return unitItems(manifest, stage, name)
    .filter(({ item }) => item.status === 'cancelled')
    .map(({ phase, item }) => ({ phase, previous_status: item.previous_status || null }));
}

/** The menu's lock reason for a Discovery unit, or undefined when it is free. @param {object} manifest @param {string} topic */
function discoveryLockReason(manifest, topic) {
  const specs = lockingSpecs(manifest, topic);
  if (specs.length === 0) return undefined;
  const named = specs.map((n) => `"${titlecase(n)}"`).join(', ');
  return specs.length === 1
    ? `locked by specification ${named} — cancel it first`
    : `locked by specifications ${named} — cancel them first`;
}

/** The menu's lock reason for a cancelled specification, or undefined when it can return. @param {object} manifest @param {string} spec */
function specificationLockReason(manifest, spec) {
  const locks = specReactivateLocks(manifest, spec);
  if (locks.length === 0) return undefined;
  const { holds, recovery } = reactivateLockPhrases(locks, titlecase, { now: true });
  return `locked — ${holds}; ${recovery}`;
}

/**
 * The Discovery-stage units, in map order — every map row, then the topics
 * a legacy manifest carries only as research or discussion items (name
 * order), whose unit is the name alone.
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

/** The state tag a topic's cancel row carries — the map's own lifecycle label. @param {object} manifest @param {string} name @param {MapRow|undefined} row */
function topicState(manifest, name, row) {
  if (row) return discoveryLifecycleLabel(row.lifecycle, row.routing, row.research_state, row.triage_parked, row.reconcile_pending, row.waits);
  const { lifecycle, research_state, triage_parked, reconcile_pending } = computeTopicLifecycle(manifest, name);
  return discoveryLifecycleLabel(lifecycle, null, research_state, triage_parked, reconcile_pending);
}

/**
 * The cancel units: every Discovery unit not reading cancelled, then every
 * started, non-terminal specification in build order — locked ones listed
 * with their reason, never omitted. A topic off the map with nothing live
 * beneath it has nothing a cancel could take and is left out.
 * @param {object} manifest @param {MapRow[]} discoveryMap @param {Record<string, any>[]} specItems  build-ordered
 * @returns {CancellableUnit[]}
 */
function cancellableUnits(manifest, discoveryMap, specItems) {
  /** @type {CancellableUnit[]} */
  const units = [];
  for (const { name, row } of discoveryUnits(manifest, discoveryMap)) {
    const lifecycle = row ? row.lifecycle : computeTopicLifecycle(manifest, name).lifecycle;
    // A postponed unit is the roadmap's, not this menu's: its own remove is
    // the door to "actually never".
    if (lifecycle === 'cancelled' || lifecycle === 'postponed') continue;
    if (!row && liveUnitItems(manifest, 'discovery', name).length === 0) continue;
    const locked = discoveryLockReason(manifest, name);
    units.push({ name, stage: 'discovery', state: topicState(manifest, name, row), ...(locked ? { locked } : {}) });
  }
  for (const s of specItems) {
    if (!specIsStarted(s)) continue;
    const locked = deliveryStarted(manifest, s.name) ? 'implementation started — fix forward' : undefined;
    units.push({ name: s.name, stage: 'specification', state: s.status, ...(locked ? { locked } : {}) });
  }
  return units;
}

/**
 * The cancelled units — every Discovery unit reading cancelled (its marker,
 * or the legacy every-item reading), then every cancelled specification —
 * each carrying what a reactivate returns, a specification whose sources
 * are unavailable carrying its lock reason.
 * @param {object} manifest @param {MapRow[]} discoveryMap @param {Record<string, any>[]} specItems  build-ordered
 * @returns {CancelledUnit[]}
 */
function cancelledUnits(manifest, discoveryMap, specItems) {
  /** @type {CancelledUnit[]} */
  const units = [];
  for (const { name, row } of discoveryUnits(manifest, discoveryMap)) {
    const lifecycle = row ? row.lifecycle : computeTopicLifecycle(manifest, name).lifecycle;
    if (lifecycle !== 'cancelled') continue;
    units.push({ name, stage: 'discovery', restores: unitRestores(manifest, 'discovery', name) });
  }
  for (const s of specItems) {
    if (s.status !== 'cancelled') continue;
    const locked = specificationLockReason(manifest, s.name);
    units.push({ name: s.name, stage: 'specification', restores: unitRestores(manifest, 'specification', s.name), ...(locked ? { locked } : {}) });
  }
  return units;
}

/**
 * The postpone units: every Discovery unit not already postponed or
 * cancelled, in map order — locked ones carrying the plan's first lock,
 * never omitted. The Discovery stage alone postpones: a topic past
 * specification is past "not yet".
 * @param {object} manifest @param {MapRow[]} discoveryMap @param {object|null} project
 * @returns {CancellableUnit[]}
 */
function postponableUnits(manifest, discoveryMap, project) {
  /** @type {CancellableUnit[]} */
  const units = [];
  for (const { name, row } of discoveryUnits(manifest, discoveryMap)) {
    const lifecycle = row ? row.lifecycle : computeTopicLifecycle(manifest, name).lifecycle;
    if (lifecycle === 'cancelled' || lifecycle === 'postponed') continue;
    if (!row && liveUnitItems(manifest, 'discovery', name).length === 0) continue;
    const [lock] = postponePlan(manifest, name, project).locks;
    units.push({ name, stage: 'discovery', state: topicState(manifest, name, row), ...(lock ? { locked: lock.reason } : {}) });
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
  /** @type {ItemRef[]} */
  const completedItems = [];
  const inProgressItems = [];
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
        // groupedDiscussions tracks every grouping spec item's sources
        // (proposed included) — a discussion in any such item is "grouped",
        // which is what unaccounted_discussions measures; a cancelled or
        // superseded specification groups nothing, the same reading the
        // spec-entry gateway makes.
        if (specGroupsSources(item)) {
          for (const src of sourcesArr) {
            groupedDiscussions.add(src.topic || src.name);
          }
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
      // nothing to resume (a new spawn reopens it), so it never joins the
      // resume candidates.
      if (item.status === 'completed' && !DERIVED_PHASES.includes(phase)) {
        completedItems.push({
          name: item.name, phase,
          ...(item.reconcile_needed !== undefined ? { reconcile_needed: item.reconcile_needed } : {}),
        });
      }
    }

    phases[phase] = phaseEntries;
  }

  const discussionItems = phaseItems(manifest, 'discussion');

  // Research feeds discussion: a discussion whose research is still
  // outstanding is held at entry until it lands — the menu carries no row
  // for it (the research row is the way in) unless a live session holds it,
  // when its continue row stands struck through; a map row carries the
  // research it awaits, and without a map the display tree tags it blocked.
  for (const e of phases.discussion || []) {
    if (!TERMINAL_STATUSES.includes(e.status) && outstandingResearch(manifest, e.name)) e.blocked_by = ['research'];
  }

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

  // A spec item (proposed included) whose source discussion has not
  // concluded — back in-progress, or opened by the gap exit and parked — is
  // blocked from entry until it does; the epic menu hard-blocks the route.
  const discussionStatus = new Map(discussionItems.map((d) => [d.name, d.status]));
  /** @type {{name: string, by: string[]}[]} */
  const specBlocked = [];
  for (const s of specItems) {
    if (TERMINAL_STATUSES.includes(s.status || '')) continue;
    const srcs = Array.isArray(s.sources)
      ? s.sources
      : Object.entries(s.sources || {}).map(([topic, data]) => ({ topic, ...(typeof data === 'object' ? data : {}) }));
    const open = srcs.map((src) => src.topic || src.name)
      .filter((n) => n && OPEN_SOURCE_STATUSES.includes(discussionStatus.get(n)));
    if (open.length > 0) specBlocked.push({ name: s.name, by: open });
  }
  // The display tree shows the blocked state; the menu withholds a blocked
  // item (a held one excepted), so the entries carry the fact for the
  // projections.
  for (const e of phases.specification || []) {
    const b = specBlocked.find((x) => x.name === e.name);
    if (b) e.blocked_by = b.by;
  }
  // A plan stands on its specification: while that record is unsettled the
  // plan's entry, birth, reopen, and conclusion are all held engine-side, so
  // the menu withholds its row (a live session's hold excepted) and the tree
  // tags it blocked. The specification's own row is the way in.
  for (const e of phases.planning || []) {
    if (!TERMINAL_STATUSES.includes(e.status) && specUnsettled(manifest, e.name)) e.blocked_by = ['specification'];
  }
  // A completed item held at entry is no resume candidate either — the
  // completed list carries its entry's blocked state, so the resume menu
  // and the `c` option read the one fact the tree and the main menu read.
  for (const c of completedItems) {
    const e = (phases[c.phase] || []).find((x) => x.name === c.name);
    if (e && e.blocked_by !== undefined) c.blocked_by = e.blocked_by;
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

  const live = (/** @type {{status?: string}} */ i) => !TERMINAL_STATUSES.includes(i.status || '');
  const planTopics = new Set(planItems.filter(live).map(i => i.name));
  for (const s of specItems) {
    if (s.status === 'completed' && !planTopics.has(s.name)) {
      nextPhaseReady.push({
        name: s.name, action: 'start_planning', label: 'spec completed',
        ...(specUnsettled(manifest, s.name) ? { blocked: true } : {}),
      });
    }
  }

  const implTopics = new Set(implItems.filter(live).map(i => i.name));
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
  const reviewTopics = new Set(reviewItems.filter(live).map(i => i.name));
  for (const i of implItems) {
    if (i.status === 'completed' && !reviewTopics.has(i.name)) {
      nextPhaseReady.push({ name: i.name, action: 'start_review', label: 'implementation completed' });
    }
  }

  // Planning opens on a settled record: a completed specification still
  // holding an open source row, or carrying a flag, gates nothing open.
  const hasSettledSpec = specItems.some(s => s.status === 'completed' && !specUnsettled(manifest, s.name));
  const hasCompletedPlan = planItems.some(p => p.status === 'completed');
  const hasCompletedDiscussion = discussionItems.some(d => d.status === 'completed');
  const hasCompletedImpl = implItems.some(i => i.status === 'completed');

  // The map rows, summary, and sequencing flag come from the shared builder —
  // the same rows the discovery-session gateway reads. map_summary stays null
  // (not the zero-count shape) when the map is empty, the epic dashboard's cue
  // that there is no map to render.
  const builtMap = buildDiscoveryMap(manifest, path.join(cwd, '.workflows'));
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

  const importsCount = Array.isArray(manifest.imports) ? manifest.imports.length : 0;
  const seedsCount = Array.isArray(manifest.seeds) ? manifest.seeds.length : 0;

  return {
    phases,
    in_progress: inProgressItems,
    completed: completedItems,
    cancellable: cancellableUnits(manifest, discoveryMap, specItems),
    cancelled: cancelledUnits(manifest, discoveryMap, specItems),
    postponable: postponableUnits(manifest, discoveryMap, project),
    postponed: postponedTopics(manifest, discoveryMap, project),
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
      can_start_planning: hasSettledSpec,
      can_start_implementation: hasCompletedPlan,
      can_start_review: hasCompletedImpl,
    },
  };
}

module.exports = { EPIC_DETAIL_PHASES, epicDetail };
