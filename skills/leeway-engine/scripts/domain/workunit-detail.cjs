'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the single-topic work units' routes — where a feature, bugfix
// or quick-fix's phases are entered (and a migrated unit of a type the
// reshape retires, entered nowhere while it waits on the migration's cut).
// The types share one shape (topic = work unit — a promoted unit's moved
// discussions excepted, see phaseTargets — linear pipeline); everything that
// varies between them — the pipeline's phases — is data in WORK_UNIT_TYPES,
// never a copied code path.
//
// Pure over the project's state: same files, same answer. Shared
// manifest semantics come from domain/reads and domain/derivations — never
// duplicated here.
// ---------------------------------------------------------------------------

const { WORK_TYPE_PIPELINES, LEGACY_WORK_TYPES, DERIVED_PHASES, TOPIC_PHASES } = require('../kernel/manifest-schema.cjs');
const { pastItsSpec } = require('./spec-standing.cjs');
const {
  phaseStatus,
  ownNamedItems,
  buildByCut,
  awaitsCut,
} = require('./derivations.cjs');

/**
 * @typedef {object} WorkUnitTypeConfig
 * @property {string} workType     manifest `work_type` value; also the `$0` work_type argument in phase routes
 * @property {string[]} pipeline   the type's phases in pipeline order
 */

/** @type {Record<string, WorkUnitTypeConfig>} */
const WORK_UNIT_TYPES = {
  feature: {
    workType: 'feature',
    pipeline: WORK_TYPE_PIPELINES.feature,
  },
  bugfix: {
    workType: 'bugfix',
    pipeline: WORK_TYPE_PIPELINES.bugfix,
  },
  'quick-fix': {
    workType: 'quick-fix',
    pipeline: WORK_TYPE_PIPELINES['quick-fix'],
  },
  ...Object.fromEntries(Object.entries(LEGACY_WORK_TYPES).map(([workType, pipeline]) => [workType, { workType, pipeline }])),
};

/**
 * Where a route into a single-topic unit enters: a phase, and the item the
 * route names — null where it names the unit alone.
 * @typedef {object} PhaseTarget
 * @property {string} phase
 * @property {string|null} topic
 */

/** Resolve a type id to its config, loudly. @param {string} type @returns {WorkUnitTypeConfig} */
function typeConfig(type) {
  const cfg = WORK_UNIT_TYPES[type];
  if (!cfg) {
    throw new Error(`workunit: unknown work type "${type}" (${Object.keys(WORK_UNIT_TYPES).join(' | ')})`);
  }
  return cfg;
}

/** All completed pipeline phases, in pipeline order. @param {WorkUnitTypeConfig} cfg @param {object} manifest @returns {string[]} */
function completedPhases(cfg, manifest) {
  return cfg.pipeline.filter((phase) => phaseStatus(manifest, phase) === 'completed');
}

/** The phases a revisit never enters. */
const UNREVISITABLE = [...DERIVED_PHASES, 'discussion', 'specification'];

/**
 * Where a single-topic unit's routes enter from `nextPhase`. The next route
 * enters the phase, naming the item in flight — else a parked stub its
 * session starts — where the phase's items
 * carry names of their own (a promoted unit's moved discussions); a unit
 * whose items all carry its name routes to the unit alone. The revisit
 * candidates are the completed phases before `nextPhase` in the pipeline
 * (every completed phase where it sits outside), each entered by the unit alone; never the derived phase, since a concluded
 * verdict stands and a new spawn is what reopens the series, nor a decided
 * discussion, which reopens through a message sent to it, nor the spec, which
 * is never corrected once concluded (11.9.1), nor, once the unit is past its
 * spec, a phase entered at a topic — the spec closes every topic (4.11.2) —
 * nor a build by its cut, which runs straight into its review (24.1.6). A
 * unit waiting on the migration's cut is entered nowhere (P12).
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} nextPhase
 * @returns {{next: PhaseTarget|null, revisit: string[]}}
 */
function phaseTargets(cwd, manifest, nextPhase) {
  if (awaitsCut(manifest)) return { next: null, revisit: [] };
  const cfg = typeConfig(manifest.work_type);
  const nextIdx = cfg.pipeline.indexOf(nextPhase);
  const own = ownNamedItems(manifest, nextPhase);
  const entered = own.find((i) => i.status === 'in-progress')
    ?? own.find((i) => i.status === 'unstarted');
  const closed = [...UNREVISITABLE, ...(pastItsSpec(cwd, manifest) ? TOPIC_PHASES : []), ...(buildByCut(manifest) ? ['implementation'] : [])];
  return {
    next: { phase: nextPhase, topic: entered ? entered.name : null },
    revisit: completedPhases(cfg, manifest)
      .filter((phase) => !closed.includes(phase) && (nextIdx === -1 || cfg.pipeline.indexOf(phase) < nextIdx)),
  };
}

module.exports = { WORK_UNIT_TYPES, phaseTargets };
