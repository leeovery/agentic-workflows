'use strict';

// ---------------------------------------------------------------------------
// Manifest schema vocabulary — the single source of the legal work types,
// phases, and per-phase status sets.
//
// Consumed by BOTH write paths (the field commands' validators and the
// engine's transitions), so the two enforcers can never drift: a status the
// field surface refuses is refused by the transitions identically. Pure
// constants — no IO, no side effects, safe to require from anywhere.
// ---------------------------------------------------------------------------

const VALID_WORK_TYPES = ['epic', 'feature', 'bugfix', 'cross-cutting', 'quick-fix'];

const VALID_PHASES = [
  'discovery', 'research', 'discussion', 'investigation', 'scoping',
  'specification', 'planning', 'implementation',
  'review'
];

// Per-work-type pipeline order — the phases a unit of that type moves through
// after discovery (the universal first phase; a map, not a pipeline phase, so
// it never appears here). The one home for pipeline order: detail builders,
// dashboards, gateways, and the simulation all read these arrays, never a
// local copy.
const WORK_TYPE_PIPELINES = {
  epic:            ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'],
  feature:         ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'],
  bugfix:          ['investigation', 'specification', 'planning', 'implementation', 'review'],
  'quick-fix':     ['scoping', 'implementation', 'review'],
  'cross-cutting': ['research', 'discussion', 'specification'],
};

const VALID_PHASE_STATUSES = {
  // Empty on purpose, never removed: discovery items are map items with NO
  // status field (lifecycle is computed at render time), and an empty
  // vocabulary makes every status write refusable. Deleting the key instead
  // would turn validators' `VALID_PHASE_STATUSES[phase]` lookups into
  // undefined — the silent permissive path this table exists to prevent.
  discovery:      /** @type {string[]} */ ([]),
  research:       ['triaged', 'in-progress', 'completed', 'superseded', 'cancelled'],
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

const VALID_GATE_MODES = ['gated', 'auto'];

const VALID_WORK_UNIT_STATUSES = ['in-progress', 'completed', 'cancelled'];

// Names a work unit can never take: `project` routes dot-path commands to the
// project manifest; `baseline` is the knowledge base's pseudo-identity for the
// project-level baseline docs (.workflows/.baseline/).
const RESERVED_WORK_UNIT_NAMES = ['project', 'baseline'];

module.exports = {
  VALID_WORK_TYPES,
  VALID_PHASES,
  WORK_TYPE_PIPELINES,
  VALID_PHASE_STATUSES,
  VALID_ROUTINGS,
  VALID_GATE_MODES,
  VALID_WORK_UNIT_STATUSES,
  RESERVED_WORK_UNIT_NAMES,
};
