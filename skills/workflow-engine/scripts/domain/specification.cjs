'use strict';

// ---------------------------------------------------------------------------
// Domain ring: specification-entry queries — scenario derivation and the
// grouping rows the projections render.
//
// Input is the entry adapter's discover() result (the library surface —
// unchanged by the dump thinning). This module derives what the flow needs next: which
// scenario the state is in, the actionable and concluded grouping rows with
// display statuses and verbs, and the single-discussion auto-proceed context.
// Pure derivation — no IO; consult-slice hints (parsed from the analysis doc
// by the adapter, which owns file access) arrive as an input.
// ---------------------------------------------------------------------------

/**
 * @typedef {object} DiscoverySource
 * @property {string} name
 * @property {string} status              raw manifest value: incorporated | pending
 * @property {string} discussion_status   completed | in-progress | unknown
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
 * @property {{name: string, tag: string}[]} sources  display rows (ready | extracted | pending | "extracted, reopened")
 * @property {ConsultRow[]} consult
 * @property {number} extracted           X — sources incorporated
 * @property {number} total               Y — sources counted
 * @property {number} pending             sources still pending
 * @property {number} consult_pending
 * @property {string} verb                Creating | Continuing | Refining
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
 * @typedef {object} SpecificationDetail
 * @property {string} work_unit
 * @property {'blocked-no-discussions'|'blocked-none-completed'|'single'|'groupings'|'analysis-rerun'|'analyze'|'specs-menu'} scenario
 * @property {'none'|'valid'|'stale'} cache_status
 * @property {DiscoveryResult['current_state']} counts
 * @property {string[]} completed_discussions
 * @property {string[]} in_progress_discussions
 * @property {string[]} unassigned          completed discussions in no spec's sources
 * @property {SpecRow[]} actionable         discovery order (proposed → in-progress → completed-with-pending)
 * @property {SpecRow[]} concluded          completed with no pending sources
 * @property {boolean} has_materialized     any non-proposed spec exists
 * @property {SingleContext|null} single    set for the single scenario only
 */

/** Display tag for one materialized source. @param {DiscoverySource} src */
function sourceTag(src) {
  if (src.status === 'pending') return 'pending';
  if (src.discussion_status === 'completed' || src.discussion_status === 'unknown') return 'extracted';
  return 'extracted, reopened';
}

/** @param {SpecRow} row */
function rowVerb(row) {
  if (row.status === 'proposed') return 'Creating';
  if (row.status === 'completed' && row.pending === 0) return 'Refining';
  return 'Continuing';
}

/**
 * One display/menu row from a discovery spec. Sources whose discussion item
 * no longer exists (`discussion_status: unknown` on a materialized spec) are
 * silently skipped — deleted discussions are not work.
 * @param {DiscoverySpec} spec
 * @param {Record<string, ConsultHint[]>} hints  kebab-name → hints from the analysis doc
 * @returns {SpecRow}
 */
function specRow(spec, hints) {
  const proposed = spec.status === 'proposed';
  const kept = (spec.sources || []).filter((s) => proposed || s.discussion_status !== 'unknown');

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

  const row = {
    name: spec.name,
    status: spec.status,
    sources: kept.map((s) => ({ name: s.name, tag: proposed ? 'ready' : sourceTag(s) })),
    consult,
    extracted: proposed ? 0 : kept.filter((s) => s.status === 'incorporated').length,
    total: kept.length,
    pending: kept.filter((s) => s.status === 'pending').length,
    consult_pending: consult.filter((c) => c.status === 'pending').length,
    verb: '',
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
  const concluded = rows.filter((r) => r.status === 'completed' && r.pending === 0);
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
    single,
  };
}

module.exports = { specificationDetail };
