'use strict';

// ---------------------------------------------------------------------------
// Manifest schema vocabulary — the single source of the legal work types,
// phases, and per-phase status sets.
//
// Consumed by BOTH write paths (the manifest CLI's validators and the
// engine's transitions), so the two enforcers can never drift: a status the
// CLI refuses is refused by the engine identically. Pure constants — no IO,
// no side effects, safe to require from anywhere.
// ---------------------------------------------------------------------------

const VALID_WORK_TYPES = ['epic', 'feature', 'bugfix', 'cross-cutting', 'quick-fix'];

const VALID_PHASES = [
  'discovery', 'research', 'discussion', 'investigation', 'scoping',
  'specification', 'planning', 'implementation',
  'review'
];

const VALID_PHASE_STATUSES = {
  discovery:      ['in-progress'],
  research:       ['in-progress', 'completed', 'superseded', 'cancelled'],
  discussion:     ['in-progress', 'completed', 'cancelled'],
  investigation:  ['in-progress', 'completed', 'cancelled'],
  scoping:        ['in-progress', 'completed', 'cancelled'],
  specification:  ['proposed', 'in-progress', 'completed', 'superseded', 'promoted', 'cancelled'],
  planning:       ['in-progress', 'completed', 'cancelled'],
  implementation: ['in-progress', 'completed', 'cancelled'],
  review:         ['in-progress', 'completed', 'cancelled'],
};

const VALID_GATE_MODES = ['gated', 'auto'];

const VALID_WORK_UNIT_STATUSES = ['in-progress', 'completed', 'cancelled'];

module.exports = {
  VALID_WORK_TYPES,
  VALID_PHASES,
  VALID_PHASE_STATUSES,
  VALID_GATE_MODES,
  VALID_WORK_UNIT_STATUSES,
};
