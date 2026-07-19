'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the single-topic work-unit detail — one builder behind the four
// navigation skills (feature / bugfix / quick-fix / cross-cutting). The types
// share one shape (topic = work unit, linear pipeline); everything that varies
// between them — pipeline phases, labels, dump headers — is data in
// WORK_UNIT_TYPES, never a copied code path.
//
// Pure over the project's `.workflows/` tree: same files, same answer. Shared
// manifest semantics come from domain/reads and domain/derivations — never
// duplicated here.
// ---------------------------------------------------------------------------

const { loadActiveManifests, loadAllManifests } = require('./reads.cjs');
const {
  phaseStatus,
  computeNextPhase,
} = require('./derivations.cjs');

/**
 * @typedef {object} WorkUnitTypeConfig
 * @property {string} workType     manifest `work_type` value; also the `$0` work_type argument in phase entry routes
 * @property {string} resultKey    detail field holding the active units array (legacy per-type key)
 * @property {string} header       `=== {header} (N) ===` line of the labelled dump
 * @property {string} nounPlural   summary noun, empty case (`no active {nounPlural}`)
 * @property {string} nounCounted  summary noun, counted case (`{N} active {nounCounted}`)
 * @property {string[]} pipeline   the type's phases in pipeline order
 * @property {boolean} surfacesSeeds  collate + surface seeds/imports counts (feature only)
 */

/** @type {Record<string, WorkUnitTypeConfig>} */
const WORK_UNIT_TYPES = {
  feature: {
    workType: 'feature',
    resultKey: 'features',
    header: 'FEATURES',
    nounPlural: 'features',
    nounCounted: 'feature(s)',
    pipeline: ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'],
    surfacesSeeds: true,
  },
  bugfix: {
    workType: 'bugfix',
    resultKey: 'bugfixes',
    header: 'BUGFIXES',
    nounPlural: 'bugfixes',
    nounCounted: 'bugfix(es)',
    pipeline: ['investigation', 'specification', 'planning', 'implementation', 'review'],
    surfacesSeeds: false,
  },
  'quick-fix': {
    workType: 'quick-fix',
    resultKey: 'quick_fixes',
    header: 'QUICK-FIXES',
    nounPlural: 'quick-fixes',
    nounCounted: 'quick-fix(es)',
    pipeline: ['scoping', 'implementation', 'review'],
    surfacesSeeds: false,
  },
  'cross-cutting': {
    workType: 'cross-cutting',
    resultKey: 'cross_cutting',
    header: 'CROSS-CUTTING',
    nounPlural: 'cross-cutting concerns',
    nounCounted: 'cross-cutting concern(s)',
    pipeline: ['research', 'discussion', 'specification'],
    surfacesSeeds: false,
  },
};

/**
 * @typedef {object} WorkUnitEntry
 * @property {string} name
 * @property {string} next_phase
 * @property {string} phase_label
 * @property {string[]} completed_phases
 * @property {number} [imports_count]  types with surfacesSeeds only
 * @property {number} [seeds_count]    types with surfacesSeeds only
 */

/**
 * @typedef {object} ClosedWorkUnit
 * @property {string} name
 * @property {string} status
 * @property {string|null} last_phase
 */

/**
 * @typedef {object} WorkUnitDetailBase
 * @property {number} count
 * @property {ClosedWorkUnit[]} completed
 * @property {ClosedWorkUnit[]} cancelled
 * @property {number} completed_count
 * @property {number} cancelled_count
 * @property {string} summary
 */

/**
 * The active units array sits under the type's legacy `resultKey`
 * (`features` / `bugfixes` / `quick_fixes` / `cross_cutting`).
 * @typedef {WorkUnitDetailBase & {[key: string]: any}} WorkUnitDetail
 */

/** Resolve a type id to its config, loudly. @param {string} type @returns {WorkUnitTypeConfig} */
function typeConfig(type) {
  const cfg = WORK_UNIT_TYPES[type];
  if (!cfg) {
    throw new Error(`workunit: unknown work type "${type}" (${Object.keys(WORK_UNIT_TYPES).join(' | ')})`);
  }
  return cfg;
}

/** The active units array of one detail. @param {WorkUnitTypeConfig} cfg @param {WorkUnitDetail} detail @returns {WorkUnitEntry[]} */
function unitsOf(cfg, detail) {
  return detail[cfg.resultKey] || [];
}

/** Last pipeline phase with completed aggregate status, or null. @param {WorkUnitTypeConfig} cfg @param {object} manifest */
function lastCompletedPhase(cfg, manifest) {
  let last = null;
  for (const phase of cfg.pipeline) {
    if (phaseStatus(manifest, phase) === 'completed') last = phase;
  }
  return last;
}

/** All completed pipeline phases, in pipeline order. @param {WorkUnitTypeConfig} cfg @param {object} manifest @returns {string[]} */
function completedPhases(cfg, manifest) {
  return cfg.pipeline.filter((phase) => phaseStatus(manifest, phase) === 'completed');
}

/**
 * Build the work-unit detail for one single-topic type: active units with
 * next-phase state, plus the completed/cancelled sets.
 * @param {string} cwd  project root (the directory containing `.workflows/`)
 * @param {string} type  a WORK_UNIT_TYPES key
 * @returns {WorkUnitDetail}
 */
function workUnitDetail(cwd, type) {
  const cfg = typeConfig(type);

  /** @type {WorkUnitEntry[]} */
  const units = [];
  for (const m of loadActiveManifests(cwd)) {
    if (m.work_type !== cfg.workType) continue;
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;
    /** @type {WorkUnitEntry} */
    const unit = {
      name: m.name,
      next_phase: state.next_phase,
      phase_label: state.phase_label,
      completed_phases: completedPhases(cfg, m),
    };
    if (cfg.surfacesSeeds) {
      unit.imports_count = Array.isArray(m.imports) ? m.imports.length : 0;
      unit.seeds_count = Array.isArray(m.seeds) ? m.seeds.length : 0;
    }
    units.push(unit);
  }

  /** @type {ClosedWorkUnit[]} */
  const completed = [];
  /** @type {ClosedWorkUnit[]} */
  const cancelled = [];
  for (const m of loadAllManifests(cwd)) {
    if (m.work_type !== cfg.workType) continue;
    if (m.status === 'completed') {
      completed.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(cfg, m) });
    } else if (m.status === 'cancelled') {
      cancelled.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(cfg, m) });
    }
  }

  return {
    [cfg.resultKey]: units,
    count: units.length,
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    summary: units.length === 0
      ? `no active ${cfg.nounPlural}`
      : `${units.length} active ${cfg.nounCounted}`,
  };
}

/**
 * The labelled dump for the head-of-skill insert — the thin reasoning surface:
 * active units with phase labels, plus the closed sets the select and
 * view-completed flows read. Everything richer (completed phases, revisit
 * routes, seeds/imports) comes from the `view` verb.
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {WorkUnitDetail} detail
 * @returns {string}
 */
function workUnitIndex(type, detail) {
  const cfg = typeConfig(type);
  const lines = [];
  lines.push(`=== ${cfg.header} (${detail.count}) ===`);
  for (const u of unitsOf(cfg, detail)) {
    lines.push(`  ${u.name}: ${u.phase_label}`);
  }
  lines.push(`=== COMPLETED (${detail.completed_count}) ===`);
  for (const u of detail.completed) {
    lines.push(`  ${u.name} (last phase: ${u.last_phase || 'none'})`);
  }
  lines.push(`=== CANCELLED (${detail.cancelled_count}) ===`);
  for (const u of detail.cancelled) {
    lines.push(`  ${u.name} (last phase: ${u.last_phase || 'none'})`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { WORK_UNIT_TYPES, typeConfig, unitsOf, workUnitDetail, workUnitIndex };
