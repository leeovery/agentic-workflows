'use strict';

// ---------------------------------------------------------------------------
// Domain ring: specification-entry queries — the specification record read
// from a manifest, scenario derivation, the grouping rows the projections
// render, and what a handoff's confirmation is about to do.
//
// The entry adapter's discover() result is built from discoverySpec(); from
// that result this module derives what the flow needs next: which scenario
// the state is in, the actionable and concluded grouping rows with display
// statuses and verbs, and the single-discussion auto-proceed context. Pure
// derivation — no IO; consult-slice hints (parsed from the analysis doc by
// the adapter, which owns file access) arrive as an input.
// ---------------------------------------------------------------------------

const { OPEN_SOURCE_STATUSES, itemOf, sourceRows, lockingSpecs } = require('./derivations.cjs');

/**
 * @typedef {object} DiscoverySource
 * @property {string} name
 * @property {string} status              raw manifest value: incorporated | pending
 * @property {string} discussion_status   raw manifest value: completed | in-progress | triaged | … | unknown
 */

/**
 * @typedef {object} DiscoverySpec
 * @property {string} name
 * @property {string} status              proposed | in-progress | completed
 * @property {boolean} has_pending_sources
 * @property {DiscoverySource[]} [sources]
 * @property {{name: string, status: string}[]} [consult_references]
 */

/**
 * @typedef {object} DiscoveryResult
 * @property {{name: string, status: string, has_individual_spec: boolean, spec_status?: string}[]} discussions
 * @property {DiscoverySpec[]} specifications
 * @property {{entries: {status: string}[]}} cache
 * @property {{discussion_count: number, completed_count: number, in_progress_count: number,
 *   spec_count: number, proposed_count: number, concluded_count: number,
 *   has_discussions: boolean, has_completed: boolean,
 *   discussions_checksum: string|null}} current_state
 */

/**
 * @typedef {object} ConsultHint
 * @property {string} name  the sibling discussion owing the correction
 * @property {string} hint  the slice/why text from the analysis doc
 */

/**
 * @typedef {object} ConsultRow
 * @property {string} name
 * @property {string} status  pending | addressed
 * @property {string} [hint]
 */

/**
 * @typedef {object} SpecRow
 * @property {string} name
 * @property {string} status              proposed | in-progress | completed
 * @property {{name: string, tag: string}[]} sources  display rows (ready | reopened | extracted | pending | stale | "pending, reopened" | "stale, reopened" | "extracted, reopened")
 * @property {ConsultRow[]} consult
 * @property {number} extracted           X — sources incorporated
 * @property {number} total               Y — sources counted
 * @property {number} pending             sources still pending
 * @property {number} stale               sources extracted but revised since — needing reconciliation
 * @property {number} consult_pending
 * @property {string} verb                Creating | Continuing | Refining
 * @property {string[]} open_sources      sources whose discussion has not concluded — back in-progress, or opened by the gap exit and parked
 * @property {boolean} blocked            any open source — the spec is not enterable until it concludes
 */

/**
 * @typedef {object} SingleContext
 * @property {'no-spec'|'has-spec'|'grouped'} variant
 * @property {string} verb          Creating | Continuing | Refining
 * @property {string} proceed_name  the name the auto-proceed and confirmation use
 * @property {string} discussion    the lone completed discussion
 * @property {SpecRow|null} spec    the covering spec's row (null for no-spec)
 */

/**
 * @typedef {object} SpecConfirmationRows
 * @property {string} verb        the entry row's verb: Creating | Continuing | Refining
 * @property {{name: string, status: string, individual: boolean}[]} sources  the row's sources; individual: a started specification already covers it
 * @property {string[]} supersedes  the started specifications the handoff supersedes
 */

/**
 * @typedef {object} SpecificationDetail
 * @property {string} work_unit
 * @property {'blocked-no-discussions'|'blocked-none-completed'|'blocked-discussions-open'|'single'|'groupings'|'analysis-rerun'|'analyze'|'specs-menu'} scenario
 * @property {'none'|'valid'|'stale'} cache_status
 * @property {DiscoveryResult['current_state']} counts
 * @property {string[]} completed_discussions
 * @property {string[]} in_progress_discussions
 * @property {string[]} unassigned          completed discussions in no spec's sources
 * @property {SpecRow[]} actionable         discovery order (proposed → in-progress → completed-with-pending)
 * @property {SpecRow[]} concluded          completed with no pending sources
 * @property {boolean} has_materialized     any non-proposed spec exists
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

/** @param {SpecRow} row */
function rowVerb(row) {
  if (row.status === 'proposed') return 'Creating';
  if (row.status === 'completed' && row.pending === 0 && row.stale === 0) return 'Refining';
  return 'Continuing';
}

/**
 * One specification item as the entry reads it. A status-less item reads
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
  if (item.consult_references && typeof item.consult_references === 'object') {
    spec.consult_references = Object.entries(item.consult_references).map(([ref, row]) => ({
      name: ref,
      status: (row && typeof row === 'object' && row.status) || 'pending',
    }));
  }
  return spec;
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
 * @param {Record<string, ConsultHint[]>} hints  kebab-name → hints from the analysis doc
 * @returns {SpecRow}
 */
function specRow(spec, hints) {
  const proposed = spec.status === 'proposed';
  const kept = liveSources(spec);

  /** @type {ConsultRow[]} */
  let consult;
  const hinted = hints[spec.name] || [];
  if (proposed) {
    // A proposed grouping has no manifest consult rows yet — the analysis
    // doc's hints are the pending set.
    consult = hinted.map((h) => ({ name: h.name, status: 'pending', hint: h.hint }));
  } else {
    consult = (spec.consult_references || []).map((c) => {
      const h = hinted.find((x) => x.name === c.name);
      return h ? { ...c, hint: h.hint } : { ...c };
    });
  }

  const open = kept.filter((s) => OPEN_SOURCE_STATUSES.includes(s.discussion_status)).map((s) => s.name);
  const row = {
    name: spec.name,
    status: spec.status,
    sources: kept.map((s) => ({
      name: s.name,
      tag: proposed ? (s.discussion_status === 'in-progress' ? 'reopened' : 'ready') : sourceTag(s),
    })),
    consult,
    extracted: proposed ? 0 : kept.filter((s) => s.status === 'incorporated').length,
    total: kept.length,
    pending: kept.filter((s) => s.status === 'pending').length,
    stale: kept.filter((s) => s.status === 'stale').length,
    consult_pending: consult.filter((c) => c.status === 'pending').length,
    verb: '',
    open_sources: open,
    blocked: open.length > 0,
  };
  row.verb = rowVerb(row);
  return row;
}

/**
 * The single-discussion auto-proceed context. Coverage counts materialized
 * specs only — a proposed grouping has no file, so it never covers.
 * @param {string} workUnit
 * @param {string} discussion
 * @param {DiscoveryResult} result
 * @param {Record<string, ConsultHint[]>} hints
 * @returns {SingleContext}
 */
function singleContext(workUnit, discussion, result, hints) {
  const covering = result.specifications.find((s) => s.status !== 'proposed'
    && ((s.sources || []).some((src) => src.name === discussion) || s.name === discussion));
  if (!covering) {
    return { variant: 'no-spec', verb: 'Creating', proceed_name: workUnit, discussion, spec: null };
  }
  const row = specRow(covering, hints);
  const grouped = row.total > 1;
  return {
    variant: grouped ? 'grouped' : 'has-spec',
    verb: row.verb,
    proceed_name: grouped ? row.name : workUnit,
    discussion,
    spec: row,
  };
}

/**
 * What a handoff over one specification is about to do: the verb its entry
 * row reads, and its sources with their extraction state. A fresh
 * specification marks each source a started specification already covers
 * and supersedes those specifications; a started one has already taken its
 * sources.
 * @param {object} manifest
 * @param {DiscoverySpec} spec
 * @returns {SpecConfirmationRows}
 */
function specConfirmation(manifest, spec) {
  const fresh = spec.status === 'proposed';
  const rows = liveSources(spec).map((source) => ({ source, covering: fresh ? lockingSpecs(manifest, source.name) : [] }));
  return {
    verb: specRow(spec, {}).verb,
    sources: rows.map(({ source, covering }) => ({ name: source.name, status: source.status, individual: covering.length > 0 })),
    supersedes: [...new Set(rows.flatMap((r) => r.covering))],
  };
}

/** @param {DiscoveryResult} result @returns {'none'|'valid'|'stale'} */
function cacheStatus(result) {
  const entry = result.cache.entries[0];
  if (!entry) return 'none';
  return entry.status === 'valid' ? 'valid' : 'stale';
}

/**
 * Derive the entry flow's scenario and rows from one scoped discover() result.
 * Scenario precedence mirrors the entry flow: prerequisites, then the
 * single-discussion fast path, then groupings / analysis / specs-menu.
 * @param {string} workUnit
 * @param {DiscoveryResult} result
 * @param {{consultHints?: Record<string, ConsultHint[]>}} [opts]
 * @returns {SpecificationDetail}
 */
function specificationDetail(workUnit, result, opts = {}) {
  const hints = opts.consultHints || {};
  const cs = result.current_state;
  const cache = cacheStatus(result);

  const completed = result.discussions.filter((d) => d.status === 'completed').map((d) => d.name);
  const inProgress = result.discussions.filter((d) => d.status === 'in-progress').map((d) => d.name);

  const sourced = new Set();
  for (const s of result.specifications) {
    for (const src of s.sources || []) sourced.add(src.name);
  }
  const unassigned = completed.filter((d) => !sourced.has(d));

  const rows = result.specifications.map((s) => specRow(s, hints));
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
    single = singleContext(workUnit, completed[0], result, hints);
  } else if (cs.proposed_count > 0) scenario = 'groupings';
  else if (cache === 'valid' && cs.spec_count === 0) scenario = 'analysis-rerun';
  else if (cs.spec_count === 0) scenario = 'analyze';
  else scenario = 'specs-menu';

  // Specification reads the settled record. While any discussion is open, the
  // scenarios that would build new structure from it — the analysis paths and
  // the single fast-path into a fresh or itself-blocked spec — hard-block.
  // Existing specs stay reachable through their menus, where a blocked row is
  // unselectable until its sources re-conclude.
  if (inProgress.length > 0) {
    if (scenario === 'analyze' || scenario === 'analysis-rerun') scenario = 'blocked-discussions-open';
    else if (scenario === 'single' && single
      && (single.variant === 'no-spec' || (single.spec !== null && single.spec.blocked))) {
      scenario = 'blocked-discussions-open';
      single = null;
    } else if ((scenario === 'specs-menu' || scenario === 'groupings')
      && actionable.length > 0 && actionable.every((r) => r.blocked) && concluded.length === 0) {
      // Every row refused and nothing else selectable — the menu would be a
      // corridor of refusals; the terminal block owns this state.
      scenario = 'blocked-discussions-open';
    }
  }

  return {
    work_unit: workUnit,
    scenario,
    cache_status: cache,
    counts: cs,
    completed_discussions: completed,
    in_progress_discussions: inProgress,
    unassigned,
    actionable,
    concluded,
    has_materialized: result.specifications.some((s) => s.status !== 'proposed'),
    record_open: inProgress.length > 0,
    single,
  };
}

module.exports = { specificationDetail, sourceTag, discoverySpec, specConfirmation };
