'use strict';

// ---------------------------------------------------------------------------
// Domain ring: specification queries — the specification record read from a
// manifest, the epic specification menu's discovery and scenario, the
// grouping rows the projections render, and what a specification's start
// incorporates.
//
// The epic menu's specification read is one discovery over an epic's
// manifest and files (specificationDiscovery), each specification read
// through discoverySpec(); from it this module derives what the menu needs
// next: which scenario the state is in, the actionable and concluded grouping
// rows with display statuses, and the single-discussion auto-proceed
// context. Everything past the discovery is pure derivation.
// ---------------------------------------------------------------------------

const path = require('path');
const { TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');
const { loadActiveManifests, fileExists, filesChecksum } = require('./reads.cjs');
const {
  OPEN_SOURCE_STATUSES, itemOf, phaseItems, sourceRows, specGroupsSources, lockingSpecs, specIncorporations,
  collectAnalysisInputs, computeAnalysisCacheStatus,
} = require('./derivations.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');

// Discussion statuses the menu never counts: cancelled is closed, postponed
// has left for the roadmap, promoted has left with its specification for a
// cross-cutting unit, and triaged is a stub of parked rerouted concerns that
// was never discussed.
const UNCOUNTED_DISCUSSIONS = ['cancelled', 'postponed', 'promoted', 'triaged'];

/**
 * @typedef {object} DiscoverySource
 * @property {string} name
 * @property {string} status              raw manifest value: incorporated | pending
 * @property {string} discussion_status   raw manifest value: completed | in-progress | triaged | … | unknown
 */

/**
 * @typedef {object} DiscoverySpec
 * @property {string} name
 * @property {string} status              proposed | in-progress | completed | promoted
 * @property {boolean} has_pending_sources
 * @property {DiscoverySource[]} [sources]
 * @property {number} [order]             its place in the build order, once sequenced
 */

/**
 * @typedef {object} DiscoveryResult
 * @property {{name: string, status: string, has_individual_spec: boolean, spec_status?: string}[]} discussions
 * @property {DiscoverySpec[]} specifications  those grouping their sources — a started one once its file is on disk — actionable first, the build order breaking ties
 * @property {{name: string, sources: string[]}[]} cancelled_specifications  each cancelled specification's reserved key and the sources it grouped
 * @property {'none'|'valid'|'stale'} cache  the grouping analysis's cache against the discussion files — none when no analysis was written
 * @property {{discussion_count: number, completed_count: number, in_progress_count: number,
 *   spec_count: number, proposed_count: number, concluded_count: number,
 *   has_discussions: boolean, has_completed: boolean,
 *   discussions_checksum: string|null}} current_state  discussions_checksum: what the grouping analysis stamps
 */

/**
 * @typedef {object} SpecRow
 * @property {string} name
 * @property {string} status              proposed | in-progress | completed
 * @property {{name: string, tag: string}[]} sources  display rows (ready | reopened | extracted | pending | stale | "pending, reopened" | "stale, reopened" | "extracted, reopened")
 * @property {number} extracted           X — sources incorporated
 * @property {number} total               Y — sources counted
 * @property {number} pending             sources still pending
 * @property {number} stale               sources extracted but revised since — needing reconciliation
 * @property {string[]} open_sources      sources whose discussion has not concluded — back in-progress, or opened by the gap exit and parked
 * @property {boolean} blocked            any open source — the spec is not enterable until it concludes
 */

/**
 * @typedef {object} SingleContext
 * @property {'no-spec'|'has-spec'|'grouped'} variant
 * @property {string} proceed_name  the specification the auto-proceed hands off — the covering one, or the work unit's name for a new one
 * @property {string} discussion    the lone completed discussion
 * @property {SpecRow|null} spec    the covering spec's row (null for no-spec)
 */

/**
 * @typedef {object} SpecConfirmationRows
 * @property {'create'|'continue'|'refine'|'unify'} variant  unify for the proposed grouping the groupings menu's unify wrote, create for any other proposed grouping, refine for a completed specification with nothing left to extract, continue otherwise
 * @property {{name: string, status: string, individual: boolean}[]} sources  the specification's sources — status: pending | stale | incorporated; individual: another started specification already covers it
 * @property {string[]} supersedes  the started specifications it incorporates, which its completion supersedes
 */

/**
 * @typedef {object} Incorporation
 * @property {string} topic     the incorporated specification
 * @property {string} path      its document, project-relative
 * @property {string[]} covers  the discussions it sources among the incorporating specification's sources
 */

/**
 * @typedef {object} SpecificationDetail
 * @property {string} work_unit
 * @property {'blocked-no-discussions'|'blocked-none-completed'|'blocked-discussions-open'|'single'|'groupings'|'analyze'|'specs-menu'} scenario
 * @property {'none'|'valid'|'stale'} cache_status
 * @property {DiscoveryResult['current_state']} counts
 * @property {string[]} completed_discussions
 * @property {string[]} in_progress_discussions
 * @property {string[]} unassigned          completed discussions in no spec's sources
 * @property {SpecRow[]} actionable         discovery order (proposed → in-progress → completed-with-pending); a promoted spec is never a row
 * @property {SpecRow[]} concluded          completed with no pending sources
 * @property {boolean} has_materialized     any live non-proposed spec exists
 * @property {boolean} record_open          any discussion in-progress — the analysis actions are withheld
 * @property {SingleContext|null} single    set for the single scenario only
 */

/** Display tag for one materialized source. @param {DiscoverySource} src */
function sourceTag(src) {
  // "reopened" means back in-progress — a stale row's reconcile waits for the
  // re-decision; a pending or extracted row's spec is blocked until it
  // re-concludes.
  const reopened = src.discussion_status === 'in-progress';
  if (src.status === 'pending') return reopened ? 'pending, reopened' : 'pending';
  if (src.status === 'stale') return reopened ? 'stale, reopened' : 'stale';
  return reopened ? 'extracted, reopened' : 'extracted';
}

/**
 * One specification item as the menu reads it. A status-less item reads
 * in-progress; a status-less source row reads pending, so an unmarked source
 * never reads as extracted; a source whose discussion item is gone reads
 * `unknown`. Stale counts as pending work: an extraction the source moved out
 * from under still blocks conclusion.
 * @param {object} manifest
 * @param {string} name
 * @param {Record<string, any>} item
 * @returns {DiscoverySpec}
 */
function discoverySpec(manifest, name, item) {
  /** @type {DiscoverySpec} */
  const spec = { name, status: item.status || 'in-progress', has_pending_sources: false };
  if (item.sources && typeof item.sources === 'object') {
    spec.sources = sourceRows(item.sources).map(([source, row]) => ({
      name: source,
      status: row.status || 'pending',
      discussion_status: (itemOf(manifest, 'discussion', source) || {}).status || 'unknown',
    }));
    spec.has_pending_sources = spec.sources.some((s) => s.status === 'pending' || s.status === 'stale');
  }
  return spec;
}

// Actionable-first rank for the menu. Lower sorts earlier: proposed →
// in-progress → completed-with-pending → concluded → promoted.
/** @param {DiscoverySpec} spec */
function specSortRank(spec) {
  if (spec.status === 'proposed') return 0;
  if (spec.status === 'in-progress') return 1;
  if (spec.status === 'completed') return spec.has_pending_sources ? 2 : 3;
  return 4;
}

/**
 * The specification menu's discovery over one active epic: its discussions,
 * its specification items, and the grouping analysis's cache read against
 * the discussion files. Refuses a name with no active epic behind it.
 * @param {string} cwd  project root (the directory containing `.workflows/`)
 * @param {string} workUnit
 * @returns {DiscoveryResult}
 */
function specificationDiscovery(cwd, workUnit) {
  const manifest = loadActiveManifests(cwd).find((m) => m.name === workUnit && m.work_type === 'epic');
  if (!manifest) throw new Error(`no active epic "${workUnit}"`);
  const workflowsDir = path.join(cwd, '.workflows');
  const specItems = phaseItems(manifest, 'specification');

  /** @type {DiscoveryResult['discussions']} */
  const discussions = [];
  for (const item of phaseItems(manifest, 'discussion')) {
    if (UNCOUNTED_DISCUSSIONS.includes(item.status)) continue;
    // The discussion's individual spec — the first started specification
    // sourcing it; a proposed grouping is never one.
    const [covering] = lockingSpecs(manifest, item.name);
    const individual = covering && specItems.find((s) => s.name === covering);
    discussions.push({
      name: item.name, status: item.status || 'unknown', has_individual_spec: Boolean(individual),
      ...(individual && { spec_status: individual.status }),
    });
  }

  // Proposed groupings live only in the manifest and count as proposed; a
  // started specification counts once its file is on disk. A promoted one
  // continues in its cross-cutting unit, its file with it — it still groups
  // its sources and counts nowhere. A cancelled one groups nothing — its key
  // stays reserved, its sources name what it grouped.
  /** @type {DiscoverySpec[]} */
  const specifications = [];
  /** @type {DiscoveryResult['cancelled_specifications']} */
  const cancelledSpecifications = [];
  let specCount = 0;
  let proposedCount = 0;
  for (const item of specItems) {
    if (item.status === 'cancelled') {
      cancelledSpecifications.push({ name: item.name, sources: sourceRows(item.sources).map(([name]) => name) });
    }
    if (!specGroupsSources(item)) continue;
    const spec = discoverySpec(manifest, item.name, item);
    if (spec.status === 'proposed') proposedCount++;
    else if (spec.status !== 'promoted') {
      if (!fileExists(path.join(cwd, INDEXED_ARTIFACTS.specification(workUnit, item.name)))) continue;
      specCount++;
    }
    if (Number.isInteger(item.order)) spec.order = item.order;
    specifications.push(spec);
  }

  // Actionable specs first, concluded specs last. The build order breaks
  // ties within each tier; unordered specs keep insertion order behind the
  // ordered ones, so the menu reads work-first, then build-first.
  const orderOf = (/** @type {DiscoverySpec} */ spec) => spec.order ?? Infinity;
  specifications.sort((a, b) => (specSortRank(a) - specSortRank(b))
    || (orderOf(a) === orderOf(b) ? 0 : orderOf(a) - orderOf(b)));

  const analysis = computeAnalysisCacheStatus(manifest, workflowsDir, 'grouping-analysis');
  const completedCount = discussions.filter((d) => d.status === 'completed').length;

  return {
    discussions,
    specifications,
    cancelled_specifications: cancelledSpecifications,
    cache: !analysis.stamped ? 'none' : (analysis.status === 'valid' ? 'valid' : 'stale'),
    current_state: {
      discussions_checksum: filesChecksum(collectAnalysisInputs(manifest, workflowsDir, 'grouping-analysis')),
      discussion_count: discussions.length,
      completed_count: completedCount,
      in_progress_count: discussions.filter((d) => d.status === 'in-progress').length,
      spec_count: specCount,
      proposed_count: proposedCount,
      concluded_count: specifications.filter((s) => s.status === 'completed' && !s.has_pending_sources).length,
      has_discussions: discussions.length > 0,
      has_completed: completedCount > 0,
    },
  };
}

/**
 * The sources a specification's row counts. A started specification skips
 * a source whose discussion item no longer exists — deleted discussions are
 * not work; a proposed grouping keeps every source it names.
 * @param {DiscoverySpec} spec
 * @returns {DiscoverySource[]}
 */
function liveSources(spec) {
  return (spec.sources || []).filter((s) => spec.status === 'proposed' || s.discussion_status !== 'unknown');
}

/**
 * One display/menu row from a discovery spec.
 * @param {DiscoverySpec} spec
 * @returns {SpecRow}
 */
function specRow(spec) {
  const proposed = spec.status === 'proposed';
  const kept = liveSources(spec);
  const open = kept.filter((s) => OPEN_SOURCE_STATUSES.includes(s.discussion_status)).map((s) => s.name);
  return {
    name: spec.name,
    status: spec.status,
    sources: kept.map((s) => ({
      name: s.name,
      tag: proposed ? (s.discussion_status === 'in-progress' ? 'reopened' : 'ready') : sourceTag(s),
    })),
    extracted: proposed ? 0 : kept.filter((s) => s.status === 'incorporated').length,
    total: kept.length,
    pending: kept.filter((s) => s.status === 'pending').length,
    stale: kept.filter((s) => s.status === 'stale').length,
    open_sources: open,
    blocked: open.length > 0,
  };
}

/**
 * The single-discussion auto-proceed context. Coverage counts live
 * materialized specs only — a proposed grouping has no file, and a promoted
 * one continues in its cross-cutting unit.
 * @param {string} workUnit
 * @param {string} discussion
 * @param {DiscoveryResult} result
 * @returns {SingleContext}
 */
function singleContext(workUnit, discussion, result) {
  const covering = result.specifications.find((s) => s.status !== 'proposed' && !TERMINAL_STATUSES.includes(s.status)
    && ((s.sources || []).some((src) => src.name === discussion) || s.name === discussion));
  if (!covering) {
    return { variant: 'no-spec', proceed_name: workUnit, discussion, spec: null };
  }
  const row = specRow(covering);
  return { variant: row.total > 1 ? 'grouped' : 'has-spec', proceed_name: row.name, discussion, spec: row };
}

/**
 * What a specification's entry does and takes in: which start it is, its
 * sources, each marked where another started specification already covers
 * it, and the started specifications it incorporates (specIncorporations).
 * @param {object} manifest
 * @param {DiscoverySpec} spec
 * @param {{unify?: boolean}} [selection]  unify: the groupings menu's unify made the selection
 * @returns {SpecConfirmationRows}
 */
function specConfirmation(manifest, spec, { unify = false } = {}) {
  const row = specRow(spec);
  /** @type {SpecConfirmationRows['variant']} */
  let variant = 'continue';
  if (spec.status === 'proposed') variant = unify ? 'unify' : 'create';
  else if (row.status === 'completed' && row.pending === 0 && row.stale === 0) variant = 'refine';
  return {
    variant,
    sources: liveSources(spec).map((source) => ({
      name: source.name,
      status: source.status,
      individual: lockingSpecs(manifest, source.name).some((name) => name !== spec.name),
    })),
    supersedes: specIncorporations(manifest, spec.name),
  };
}

/**
 * The specifications a specification incorporates, as its session reads
 * them: each one's document, and the discussions it covers among this
 * specification's sources.
 * @param {object} manifest
 * @param {string} workUnit
 * @param {string} topic
 * @returns {Incorporation[]}
 */
function incorporations(manifest, workUnit, topic) {
  const item = itemOf(manifest, 'specification', topic);
  if (!item) throw new Error(`no specification "${topic}" in "${workUnit}"`);
  const own = new Set(sourceRows(item.sources).map(([name]) => name));
  return specIncorporations(manifest, topic).map((name) => ({
    topic: name,
    path: INDEXED_ARTIFACTS.specification(workUnit, name),
    covers: sourceRows(/** @type {Record<string, any>} */ (itemOf(manifest, 'specification', name)).sources)
      .map(([source]) => source)
      .filter((source) => own.has(source)),
  }));
}

/**
 * Derive the menu's scenario and rows from one specificationDiscovery()
 * result. Scenario precedence: the blocked states, then the
 * single-discussion fast path, then groupings / analysis / specs-menu.
 * @param {string} workUnit
 * @param {DiscoveryResult} result
 * @returns {SpecificationDetail}
 */
function specificationDetail(workUnit, result) {
  const cs = result.current_state;

  const completed = result.discussions.filter((d) => d.status === 'completed').map((d) => d.name);
  const inProgress = result.discussions.filter((d) => d.status === 'in-progress').map((d) => d.name);

  const sourced = new Set();
  for (const s of result.specifications) {
    for (const src of s.sources || []) sourced.add(src.name);
  }
  const unassigned = completed.filter((d) => !sourced.has(d));

  const rows = result.specifications.filter((s) => !TERMINAL_STATUSES.includes(s.status)).map((s) => specRow(s));
  const concluded = rows.filter((r) => r.status === 'completed' && r.pending === 0 && r.stale === 0);
  const actionable = rows.filter((r) => !concluded.includes(r));

  /** @type {SpecificationDetail['scenario']} */
  let scenario;
  /** @type {SingleContext|null} */
  let single = null;
  if (!cs.has_discussions) scenario = 'blocked-no-discussions';
  else if (!cs.has_completed) scenario = 'blocked-none-completed';
  else if (cs.completed_count === 1) {
    scenario = 'single';
    single = singleContext(workUnit, completed[0], result);
  } else if (cs.proposed_count > 0) scenario = 'groupings';
  else if (cs.spec_count === 0) scenario = 'analyze';
  else scenario = 'specs-menu';

  // Specification reads the settled record. While any discussion is open, the
  // scenarios that would build new structure from it — the analysis paths and
  // the single fast-path into a fresh or itself-blocked spec — hard-block.
  // Existing specs stay reachable through their menus, where a blocked row is
  // unselectable until its sources re-conclude.
  if (inProgress.length > 0) {
    if (scenario === 'analyze') scenario = 'blocked-discussions-open';
    else if (scenario === 'single' && single
      && (single.variant === 'no-spec' || (single.spec !== null && single.spec.blocked))) {
      scenario = 'blocked-discussions-open';
      single = null;
    } else if ((scenario === 'specs-menu' || scenario === 'groupings')
      && actionable.length > 0 && actionable.every((r) => r.blocked) && concluded.length === 0) {
      // Every row refused and nothing else selectable — the menu would be a
      // corridor of refusals; the block owns this state.
      scenario = 'blocked-discussions-open';
    }
  }

  return {
    work_unit: workUnit,
    scenario,
    cache_status: result.cache,
    counts: cs,
    completed_discussions: completed,
    in_progress_discussions: inProgress,
    unassigned,
    actionable,
    concluded,
    has_materialized: rows.some((r) => r.status !== 'proposed'),
    record_open: inProgress.length > 0,
    single,
  };
}

module.exports = { specificationDiscovery, specificationDetail, sourceTag, discoverySpec, specConfirmation, incorporations };
