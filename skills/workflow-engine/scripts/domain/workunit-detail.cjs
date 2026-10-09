'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the single-topic work-unit detail — the one entry behind the
// linear continue menu (feature / bugfix / quick-fix / cross-cutting). The
// types share one shape (topic = work unit — a promoted unit's moved
// discussions excepted, see phaseTargets — linear pipeline); everything that
// varies between them — pipeline phases, the seeds and imports they surface —
// is data in WORK_UNIT_TYPES, never a copied code path.
//
// Pure over the project's `.workflows/` tree: same files, same answer. Shared
// manifest semantics come from domain/reads and domain/derivations — never
// duplicated here.
// ---------------------------------------------------------------------------

const path = require('path');
const { loadManifest } = require('./reads.cjs');
const { WORK_TYPE_PIPELINES, DERIVED_PHASES, TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');
const {
  phaseStatus,
  phaseItems,
  computeUnitPhaseState,
  mailPhases,
  ownNamedItems,
  inputMoved,
  movedFrom,
} = require('./derivations.cjs');

/**
 * @typedef {object} WorkUnitTypeConfig
 * @property {string} workType     manifest `work_type` value; also the `$0` work_type argument in phase routes
 * @property {string[]} pipeline   the type's phases in pipeline order
 * @property {boolean} surfacesSeeds  collate + surface seeds/imports counts (feature only)
 */

/** @type {Record<string, WorkUnitTypeConfig>} */
const WORK_UNIT_TYPES = {
  feature: {
    workType: 'feature',
    pipeline: WORK_TYPE_PIPELINES.feature,
    surfacesSeeds: true,
  },
  bugfix: {
    workType: 'bugfix',
    pipeline: WORK_TYPE_PIPELINES.bugfix,
    surfacesSeeds: false,
  },
  'quick-fix': {
    workType: 'quick-fix',
    pipeline: WORK_TYPE_PIPELINES['quick-fix'],
    surfacesSeeds: false,
  },
  'cross-cutting': {
    workType: 'cross-cutting',
    pipeline: WORK_TYPE_PIPELINES['cross-cutting'],
    surfacesSeeds: false,
  },
};

/**
 * Where a route into a single-topic unit enters: a phase, and the item the
 * route names — null where it names the unit alone.
 * @typedef {object} PhaseTarget
 * @property {string} phase
 * @property {string|null} topic
 */

/**
 * @typedef {object} WorkUnitEntry
 * @property {string} name
 * @property {string} next_phase
 * @property {string|null} next_topic  the item the route into next_phase names, null for the unit alone (see phaseTargets)
 * @property {PhaseTarget[]} revisit   the revisit candidates, in pipeline order (see phaseTargets)
 * @property {string} phase_label
 * @property {boolean} finalising      pipeline finished (`next_phase: done`), no phase in
 *                                     flight, but the unit is still in-progress — `workunit
 *                                     complete` never ran
 * @property {string[]} completed_phases
 * @property {string[]} in_progress_phases  pipeline phases in flight (a reopened phase mid-revisit)
 * @property {{phase: string, from: string|boolean}[]} [reconcile_phases]  completed phases whose item carries
 *                                     a reconcile flag — `from` is the flag value (the upstream
 *                                     phase that moved, or `true` for a brief flag)
 * @property {string[]} [mail_phases]  phases whose mailbox holds messages for the unit's
 *                                     topics — the pipeline row's and menu's `mail waiting` cue
 * @property {number} [imports_count]  types with surfacesSeeds only
 * @property {number} [seeds_count]    types with surfacesSeeds only
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

/**
 * Live pipeline phases whose input has moved, in pipeline order — the
 * stored flag, or a completed specification the flag never reached (its
 * source rows no longer incorporated). The same reading `computeNextPhase`
 * routes on, so the dashboard never calls settled a phase the bridge routes
 * back to; a derived one names no revised upstream, so it carries `true` —
 * the "reconcile at next entry" voice the brief flag already uses.
 * @param {WorkUnitTypeConfig} cfg @param {object} manifest @returns {{phase: string, from: string|boolean}[]}
 */
function reconcilePhases(cfg, manifest) {
  /** @type {{phase: string, from: string|boolean}[]} */
  const out = [];
  for (const phase of cfg.pipeline) {
    const moved = phaseItems(manifest, phase)
      .find((i) => !TERMINAL_STATUSES.includes(i.status)
        && (i.reconcile_needed !== undefined || inputMoved(manifest, phase, i)));
    if (moved) out.push({ phase, from: /** @type {string|boolean} */ (movedFrom(moved)) });
  }
  return out;
}

/**
 * Where a single-topic unit's routes enter from `nextPhase`. The next route
 * enters the phase, naming the item in flight — else a parked stub its
 * session starts, else the one whose input moved — where the phase's items
 * carry names of their own. The revisit candidates are the completed phases
 * before `nextPhase` in the pipeline (every completed phase where it sits
 * outside — the finalising case), one per completed item where a phase's
 * items carry names of their own; never the derived phase, since a concluded
 * verdict stands and a new spawn is what reopens the series. A unit whose
 * items all carry its name routes to the unit alone.
 * @param {object} manifest @param {string} nextPhase
 * @returns {{next: PhaseTarget, revisit: PhaseTarget[]}}
 */
function phaseTargets(manifest, nextPhase) {
  const cfg = typeConfig(manifest.work_type);
  const nextIdx = cfg.pipeline.indexOf(nextPhase);
  const own = ownNamedItems(manifest, nextPhase);
  const entered = own.find((i) => i.status === 'in-progress')
    ?? own.find((i) => i.status === 'unstarted')
    ?? own.find((i) => inputMoved(manifest, nextPhase, i));
  return {
    next: { phase: nextPhase, topic: entered ? entered.name : null },
    revisit: completedPhases(cfg, manifest)
      .filter((phase) => !DERIVED_PHASES.includes(phase) && (nextIdx === -1 || cfg.pipeline.indexOf(phase) < nextIdx))
      .flatMap((phase) => {
        const completed = ownNamedItems(manifest, phase).filter((i) => i.status === 'completed');
        /** @type {PhaseTarget[]} */
        const targets = completed.length > 0 ? completed.map((i) => ({ phase, topic: i.name })) : [{ phase, topic: null }];
        return targets;
      }),
  };
}

/**
 * One single-topic unit in progress, by name: its type, read from its
 * manifest, and its entry with next-phase state — null where no feature,
 * bugfix, quick-fix or cross-cutting concern by that name is in progress.
 * @param {string} cwd  project root (the directory containing `.workflows/`)
 * @param {string} name
 * @returns {{type: string, unit: WorkUnitEntry}|null}
 */
function activeWorkUnit(cwd, name) {
  const m = loadManifest(cwd, name);
  if (!m || m.status !== 'in-progress' || !Object.hasOwn(WORK_UNIT_TYPES, m.work_type)) return null;
  const cfg = WORK_UNIT_TYPES[m.work_type];
  const state = computeUnitPhaseState(m, cfg.pipeline);
  const targets = phaseTargets(m, state.next_phase);
  /** @type {WorkUnitEntry} */
  const unit = {
    name: m.name,
    next_phase: state.next_phase,
    next_topic: targets.next.topic,
    revisit: targets.revisit,
    phase_label: state.phase_label,
    finalising: state.finalising,
    completed_phases: completedPhases(cfg, m),
    in_progress_phases: state.in_progress_phases,
  };
  const flagged = reconcilePhases(cfg, m);
  if (flagged.length > 0) unit.reconcile_phases = flagged;
  const waiting = mailPhases(path.join(cwd, '.workflows'), m);
  if (waiting.length > 0) unit.mail_phases = waiting;
  if (cfg.surfacesSeeds) {
    unit.imports_count = Array.isArray(m.imports) ? m.imports.length : 0;
    unit.seeds_count = Array.isArray(m.seeds) ? m.seeds.length : 0;
  }
  return { type: m.work_type, unit };
}

module.exports = { WORK_UNIT_TYPES, typeConfig, phaseTargets, activeWorkUnit };
