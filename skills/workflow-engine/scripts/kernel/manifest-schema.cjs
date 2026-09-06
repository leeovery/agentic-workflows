'use strict';

// ---------------------------------------------------------------------------
// Manifest schema vocabulary — the single source of the legal work types,
// phases, and per-phase status sets.
//
// Consumed by BOTH write paths (the field commands' validators and the
// engine's transitions), so the two enforcers can never drift: a status the
// field surface refuses is refused by the transitions identically. Pure
// constants and grammar helpers — no IO.
// ---------------------------------------------------------------------------

const VALID_WORK_TYPES = ['epic', 'feature', 'bugfix', 'cross-cutting', 'quick-fix'];

const VALID_PHASES = [
  'discovery', 'research', 'experiment', 'discussion', 'investigation', 'scoping',
  'specification', 'planning', 'implementation',
  'review'
];

// Per-work-type pipeline order — the phases a unit of that type moves through
// after discovery (the universal first phase; a map, not a pipeline phase, so
// it never appears here). The one home for pipeline order: detail builders,
// dashboards, gateways, and the simulation all read these arrays, never a
// local copy.
const WORK_TYPE_PIPELINES = {
  epic:            ['research', 'experiment', 'discussion', 'specification', 'planning', 'implementation', 'review'],
  feature:         ['research', 'experiment', 'discussion', 'specification', 'planning', 'implementation', 'review'],
  bugfix:          ['investigation', 'specification', 'planning', 'implementation', 'review'],
  'quick-fix':     ['scoping', 'implementation', 'review'],
  'cross-cutting': ['research', 'experiment', 'discussion', 'specification'],
};

// Derived-bookkeeping phases: the item is computed over its own records — no
// hand lifecycle, no entry-flow reconcile, no resume or reactivate; the
// phase's own verbs maintain the item.
const DERIVED_PHASES = ['experiment'];

const VALID_PHASE_STATUSES = {
  // Empty on purpose, never removed: discovery items are map items with NO
  // status field (lifecycle is computed at render time), and an empty
  // vocabulary makes every status write refusable. Deleting the key instead
  // would turn validators' `VALID_PHASE_STATUSES[phase]` lookups into
  // undefined — the silent permissive path this table exists to prevent.
  discovery:      /** @type {string[]} */ ([]),
  research:       ['triaged', 'in-progress', 'completed', 'superseded', 'cancelled'],
  // Derived bookkeeping over the topic's experiment records: the spawn opens
  // the item, the last record's terminal transition closes it — the user
  // never starts or completes it by hand.
  experiment:     ['in-progress', 'completed', 'cancelled'],
  discussion:     ['triaged', 'in-progress', 'completed', 'cancelled'],
  investigation:  ['triaged', 'in-progress', 'completed', 'cancelled'],
  scoping:        ['in-progress', 'completed', 'cancelled'],
  specification:  ['proposed', 'in-progress', 'completed', 'superseded', 'promoted', 'cancelled'],
  planning:       ['in-progress', 'completed', 'cancelled'],
  implementation: ['in-progress', 'completed', 'cancelled'],
  review:         ['in-progress', 'completed', 'cancelled'],
};

// Where a discovery-map item routes when work starts on it. Also the legal
// `--phase` choices when a topic spawn seeds its first phase item — the
// routable phases ARE the routing vocabulary.
const VALID_ROUTINGS = ['research', 'discussion'];

// One experiment record in a topic's series
// (`phases.experiment.items.{topic}.experiments.{id}.status`): the
// design-before-data lifecycle. `approved` is the freeze — the user-confirmed
// briefing; `concluded` and `abandoned` are terminal (verdict and reason
// recorded beside the status). Consumed by the field surface's validators and
// the experiment domain ops, so the two enforcers can never drift.
const VALID_EXPERIMENT_STATUSES = ['conceived', 'designed', 'approved', 'running', 'concluded', 'abandoned'];

// The record statuses that end an experiment's life: nothing advances past
// them, and a top-level record reaching either releases the evidence wait
// pointing at it.
const EXPERIMENT_TERMINAL_STATUSES = ['concluded', 'abandoned'];

// The one home for the experiment id shape: `E{n}` for a series record,
// `E{n}.{m}` for a sub-experiment under it. An evidence wait
// (`awaiting_experiments`) only ever holds the parent form — a split is the
// laboratory's internal method and never leaks into the spawning phase's
// state.
const EXPERIMENT_ID_PATTERN = /^E[1-9][0-9]*(\.[1-9][0-9]*)?$/;

/** A top-level series id — never a sub-experiment's. @param {string} id */
function isParentExperimentId(id) {
  return !id.includes('.');
}

/**
 * Series order over legal ids: parents by number, each parent's
 * sub-experiments beneath it in their own order — the register's reading
 * order, shared by every surface that sorts a series.
 * @param {string} a @param {string} b
 */
function compareExperimentIds(a, b) {
  const [an, am] = a.slice(1).split('.').map(Number);
  const [bn, bm] = b.slice(1).split('.').map(Number);
  if (an !== bn) return an - bn;
  return (am ?? 0) - (bm ?? 0);
}

// The two conversation phases — the ones whose sessions spawn experiments
// (each spawn locks the spawning phase's own item, `awaiting_experiments`,
// research and discussion identically) and the ones that hold waits.
const EXPERIMENT_SPAWN_PHASES = ['research', 'discussion'];

// Gate modes. `auto` runs to the end of the session — the entry reset
// returns every gate to `gated`; `bounded` is auto with an end the gate
// declares in GATE_FIELDS, and the domain ring owning that bound returns the
// gate to `gated` at the bound's close.
const VALID_GATE_MODES = ['gated', 'auto', 'bounded'];

// The gate-mode fields each phase's items carry, keyed by phase, each naming
// its bound or `null` for none. The one home for which gate lives where and
// which gates `bounded` can reach: the field surface accepts a `*_gate_mode`
// write only where this table places it and `bounded` only where the entry
// names a bound, and the domain ring owning a bound reads the same entries
// to know what its close resets (`plan-phase`: domain/tasks.cjs, at `task
// complete --phase-complete`). A walk's nested gate (`staging.<key>.gate_mode`,
// `analysis_staging.<name>.gate_mode`) is the walk's own and takes no bound.
/** @type {Record<string, Record<string, string | null>>} */
const GATE_FIELDS = {
  planning:       { task_list_gate_mode: null, author_gate_mode: null, finding_gate_mode: null },
  specification:  { construction_gate_mode: null, finding_gate_mode: null },
  implementation: { task_gate_mode: 'plan-phase', fix_gate_mode: 'plan-phase', analysis_gate_mode: null, consolidation_gate_mode: null },
};

const VALID_WORK_UNIT_STATUSES = ['in-progress', 'completed', 'cancelled'];

// Phase-item statuses that end a topic's life in its phase — excluded from
// aggregation, never flagged, never reverted. One vocabulary for every
// consumer (transitions, derivations, the roadmap's cross-join flag).
const TERMINAL_STATUSES = ['cancelled', 'superseded', 'promoted'];

// Names a work unit can never take: `project` routes dot-path commands to the
// project manifest; `baseline` is the knowledge base's pseudo-identity for the
// project-level baseline docs (.workflows/.baseline/); `roadmap` is the
// product-roadmap layer's identity (the project manifest's `roadmap` node and
// the project-level sessions under .workflows/.roadmap/).
const RESERVED_WORK_UNIT_NAMES = ['project', 'baseline', 'roadmap'];

module.exports = {
  VALID_WORK_TYPES,
  VALID_PHASES,
  WORK_TYPE_PIPELINES,
  DERIVED_PHASES,
  VALID_PHASE_STATUSES,
  VALID_ROUTINGS,
  VALID_EXPERIMENT_STATUSES,
  EXPERIMENT_TERMINAL_STATUSES,
  EXPERIMENT_ID_PATTERN,
  isParentExperimentId,
  compareExperimentIds,
  EXPERIMENT_SPAWN_PHASES,
  VALID_GATE_MODES,
  GATE_FIELDS,
  VALID_WORK_UNIT_STATUSES,
  TERMINAL_STATUSES,
  RESERVED_WORK_UNIT_NAMES,
};
