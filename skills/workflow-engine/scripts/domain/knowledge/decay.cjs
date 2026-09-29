'use strict';

// ---------------------------------------------------------------------------
// Domain ring: progress decay — a logical clock that advances on completed
// work, not wall-clock time. For a work unit, `progressElapsed` is the summed
// significance weight (topics × weight[work_type]) of the units completed
// strictly after it: a dormant gap completes nothing, so the clock stands
// still — decay tracks how far the project has moved past a unit, not how
// many months have passed. Ranking turns it into a retrievability
// R = 0.9^(progressElapsed / S) that down-ranks a chunk; compact prunes a
// unit's non-spec chunks once R falls below `decay_prune_below`. Derived
// entirely from the manifests' completion state.
// ---------------------------------------------------------------------------

const { DEFAULTS } = require('../../kernel/knowledge/config.cjs');
const { retrievability } = require('../../kernel/knowledge/ranking.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');

/**
 * Parse a date-only "YYYY-MM-DD" as local midnight, anything else by the Date
 * parser — `new Date("YYYY-MM-DD")` would read UTC, shifting the date in a
 * non-UTC timezone. Null on invalid input.
 * @param {unknown} str @returns {Date|null}
 */
function parseLocalDate(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

/**
 * A work unit's `completed_at` in epoch ms — an epoch number, an ISO time, or
 * a "YYYY-MM-DD" date — or null when it cannot be placed on the clock.
 * @param {unknown} value @returns {number|null}
 */
function parseCompletionTime(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).trim();
  if (str === '' || str === 'null') return null;
  const d = parseLocalDate(str);
  return d && !isNaN(d.getTime()) ? d.getTime() : null;
}

/**
 * The topics a work unit spans: an epic's distinct topic names across its
 * phases (at least 1); every other type is one topic.
 * @param {Record<string, any>} unit @returns {number}
 */
function topicCount(unit) {
  if (!unit || unit.work_type !== 'epic') return 1;
  const phases = unit.phases || {};
  const topics = new Set();
  for (const phase of Object.keys(phases)) {
    const items = phases[phase] && phases[phase].items;
    if (items) for (const t of Object.keys(items)) topics.add(t);
  }
  return topics.size > 0 ? topics.size : 1;
}

/**
 * The weight a completed unit adds to the clock: topics × weight[work_type],
 * a per-topic factor of 1 for a type the weights do not name.
 * @param {Record<string, any>} unit @param {Record<string, number>} weights
 */
function unitWeight(unit, weights) {
  const w = weights && weights[unit.work_type];
  const factor = typeof w === 'number' && w >= 0 ? w : 1.0;
  return topicCount(unit) * factor;
}

/**
 * The progress clock over completed work units: each dated unit's
 * progressElapsed, the summed weight of the units completed strictly later.
 * An undateable unit is left out — a consumer reads an absent unit as 0, the
 * frontier — and ties do not count one another.
 * @param {Array<Record<string, any>>} units @param {Record<string, number>} [weights]  work_type → per-topic weight
 * @returns {Map<string, number>}
 */
function buildProgressClock(units, weights) {
  const dated = [];
  for (const u of Array.isArray(units) ? units : []) {
    if (!u || !u.name) continue;
    const t = parseCompletionTime(u.completed_at);
    if (t === null) continue;
    dated.push({ name: u.name, t, weight: unitWeight(u, weights || {}) });
  }
  const clock = new Map();
  for (const a of dated) {
    let elapsed = 0;
    for (const b of dated) {
      if (b.t > a.t) elapsed += b.weight;
    }
    clock.set(a.name, elapsed);
  }
  return clock;
}

/**
 * The configured decay weights over the defaults — the config merge replaces
 * the whole object, so the types a config leaves out are refilled.
 * @param {Record<string, any>|null} cfg @returns {Record<string, number>}
 */
function resolveDecayWeights(cfg) {
  const override = cfg && cfg.decay_weights;
  if (override && typeof override === 'object' && !Array.isArray(override)) {
    return Object.assign({}, DEFAULTS.decay_weights, override);
  }
  return Object.assign({}, DEFAULTS.decay_weights);
}

/**
 * The progress clock over a manifest list — its completed units alone count.
 * @param {Array<Record<string, any>>} workUnits @param {Record<string, number>} [weights]
 */
function progressClockOf(workUnits, weights) {
  const completed = workUnits
    .filter((u) => u && u.name && u.status === 'completed')
    .map((u) => ({ name: u.name, completed_at: u.completed_at, work_type: u.work_type, phases: u.phases }));
  return buildProgressClock(completed, weights);
}

/**
 * How far the clock has moved past a chunk, by its unit and phase: the
 * unit's progressElapsed — 0 for a unit the clock has not moved past — and
 * 0 always for a specification, which never decays.
 * @param {Array<Record<string, any>>} workUnits  the manifest list the clock is built from
 * @param {Record<string, number>} weights
 * @returns {(workUnit: string, phase: string) => number}
 */
function progressElapsed(workUnits, weights) {
  const clock = progressClockOf(workUnits, weights);
  return (workUnit, phase) => (phase === 'specification' ? 0 : clock.get(workUnit) || 0);
}

/** @param {Record<string, any>|null} cfg @returns {number} */
function resolveStability(cfg) {
  return cfg && Number.isFinite(cfg.decay_base_stability)
    ? cfg.decay_base_stability
    : DEFAULTS.decay_base_stability;
}

/**
 * @typedef {object} Pruning
 * @property {number} floor
 * @property {(workUnit: string, phase: string) => boolean} prunes
 */

/**
 * Compact's prune test: a unit's non-spec chunks are pruned once its
 * retrievability has decayed below `decay_prune_below`. A unit the clock has
 * not moved past — in progress, undateable, the frontier — never is, and
 * specifications never decay. Null when `decay_prune_below` is false.
 * @param {Record<string, any>|null} cfg
 * @param {Array<Record<string, any>>} workUnits  the manifest list the clock is built from
 * @returns {Pruning|null}
 */
function pruneTest(cfg, workUnits) {
  const floor = cfg && cfg.decay_prune_below !== undefined ? cfg.decay_prune_below : DEFAULTS.decay_prune_below;
  if (floor === false) return null;
  if (typeof floor !== 'number' || !Number.isFinite(floor) || floor < 0 || floor > 1) {
    throw new UserError(`Invalid decay_prune_below: ${JSON.stringify(floor)}. Expected false or a number in [0, 1].`);
  }
  const stability = resolveStability(cfg);
  const elapsedOf = progressElapsed(workUnits, resolveDecayWeights(cfg));
  return {
    floor,
    prunes: (workUnit, phase) => {
      const elapsed = elapsedOf(workUnit, phase);
      return elapsed > 0 && retrievability(elapsed, stability) < floor;
    },
  };
}

/**
 * Compact's prune test as an index skips by: an invalid `decay_prune_below`
 * prunes nothing here — compact alone refuses it.
 * @param {Record<string, any>|null} cfg @param {Array<Record<string, any>>} workUnits
 * @returns {Pruning|null}
 */
function indexPruning(cfg, workUnits) {
  try {
    return pruneTest(cfg, workUnits);
  } catch (err) {
    if (err instanceof UserError) return null;
    throw err;
  }
}

module.exports = {
  buildProgressClock,
  progressElapsed,
  resolveDecayWeights,
  resolveStability,
  pruneTest,
  indexPruning,
};
