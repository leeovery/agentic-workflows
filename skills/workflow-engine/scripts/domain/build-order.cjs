'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the build order — one soft execution sequence over an epic's
// specification topics, read by specification, planning, and implementation
// (planning and implementation join on the topic name). The spec-side twin of
// discovery-map sequencing, with one deliberate difference: this verb
// enforces the wholesale renumber the map's verb leaves to prose discipline —
// an assignment must cover the whole live set with a contiguous 1..N
// permutation, so a partial write can never leave the order half-renumbered.
//
// Judgment decides, code records: the sequencing reference proposes the
// order; this validates and writes it in one transaction (manifest write,
// scoped git commit) and clears `phases.specification.build_order_stale` —
// the flag topic completion sets so declared dependencies can sharpen an
// order first assigned at grouping. The order is advisory everywhere: it
// sorts and recommends, it never blocks. All errors throw loud and specific,
// before anything is written. Every load→mutate→save runs under the work
// unit's manifest lock.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { commitTailPathspec, noteCommitOutcome } = require('./commit.cjs');
const { phaseItems } = require('./derivations.cjs');
const { TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');

/**
 * Whether a specification item is in the build order's live set. Terminal
 * items (cancelled, superseded, promoted) leave the set; completed items
 * stay — they keep their number, so the queue never reshuffles just because
 * a spec finished.
 * @param {{status?: string}} item
 * @returns {boolean}
 */
function buildOrderLive(item) {
  return !TERMINAL_STATUSES.includes(item.status || '');
}

/**
 * @typedef {object} BuildOrderSequenceResult
 * @property {Record<string, number>} ordered  topic → order, as applied
 * @property {string|null} committed
 * @property {string[]} [warnings]
 * @property {string} [note]
 */

/**
 * Record the build order across an epic's specification topics: set each
 * topic's `order`, clear the staleness flag, commit the manifest write.
 * The assignment must be the whole live set — every non-terminal
 * specification topic exactly once, orders a contiguous permutation of 1..N.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {Record<string, number>} orders  topic → order
 * @returns {BuildOrderSequenceResult}
 */
function sequenceBuildOrder(cwd, workUnit, orders) {
  withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.work_type !== 'epic') {
      throw new Error(`build order is epic-only — "${workUnit}" is a ${manifest.work_type}`);
    }
    const specData = (manifest.phases && manifest.phases.specification) || {};
    const items = specData.items || {};
    const live = Object.entries(items)
      .filter(([, item]) => item && typeof item === 'object' && buildOrderLive(item))
      .map(([name]) => name);
    if (live.length === 0) {
      throw new Error('no live specification topics to sequence');
    }

    const entries = Object.entries(orders);
    if (entries.length === 0) {
      throw new Error('no {topic}={order} assignments given');
    }
    for (const [topic, order] of entries) {
      if (!items[topic] || typeof items[topic] !== 'object') {
        throw new Error(`no specification item "${topic}" in the manifest (phases.specification.items)`);
      }
      if (!buildOrderLive(items[topic])) {
        throw new Error(`"${topic}" is ${items[topic].status} — terminal topics carry no build order`);
      }
      if (!Number.isInteger(order) || order < 1) {
        throw new Error(`order for "${topic}" must be a positive integer (got ${JSON.stringify(order)})`);
      }
    }

    // Wholesale renumber, engine-enforced: the whole live set, contiguous
    // 1..N. A partial assignment is refused naming what it missed.
    const missing = live.filter((name) => !(name in orders));
    if (missing.length > 0) {
      throw new Error(`assignment must cover every live specification topic — missing: ${missing.join(', ')}`);
    }
    const values = entries.map(([, order]) => order).sort((a, b) => a - b);
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== i + 1) {
        throw new Error(`orders must be a contiguous 1..${entries.length} permutation (got ${values.join(', ')})`);
      }
    }

    for (const [topic, order] of entries) {
      items[topic].order = order;
    }
    delete specData.build_order_stale;

    saveWorkUnitManifest(cwd, workUnit, manifest);
  });

  /** @type {string[]} */
  const warnings = [];
  // The sequencing pass runs from the epic entry, beside whatever sessions
  // hold the unit's topics: it wrote the manifest and nothing else, so that
  // is all it commits.
  const outcome = commitTailPathspec(cwd, `.workflows/${workUnit}/manifest.json`, `specification(${workUnit}): sequence build order`, warnings);
  /** @type {BuildOrderSequenceResult} */
  const result = { ordered: orders, committed: outcome.committed };
  if (outcome.failed) result.warnings = warnings;
  // The manifest-only scope the work unit's `--state` form covers.
  noteCommitOutcome(result, outcome, `${workUnit} --state`);
  return result;
}

/**
 * Derive the epic's need for a build-order sequencing pass: true when the
 * live set's orders are not exactly a contiguous 1..N permutation — a topic
 * lacking an order, a duplicate, or a hole (a cancel stashes its number;
 * birth writes ride `manifest apply`, which validates nothing) — or when
 * topic completion has flagged the order stale. The same invariant the
 * sequence verb enforces on write, read back. No specification topics at
 * all → false (there is nothing to order yet — the grouping analysis
 * assigns at birth).
 * @param {object} manifest
 * @returns {boolean}
 */
function computeBuildOrderNeedsSequencing(manifest) {
  const specData = (manifest.phases && manifest.phases.specification) || {};
  const live = phaseItems(manifest, 'specification').filter(buildOrderLive);
  if (live.length === 0) return false;
  if (specData.build_order_stale === true) return true;
  const orders = live.map((item) => item.order);
  if (orders.some((o) => !Number.isInteger(o))) return true;
  const sorted = [...orders].sort((a, b) => a - b);
  return sorted.some((o, i) => o !== i + 1);
}

/**
 * Sort phase items by build order — a stable tiebreak, never a regrouping:
 * ordered items lead by their number, unordered items keep insertion order
 * behind them. Planning and implementation items join on the topic name to
 * the specification item's `order`; specification items read their own.
 * @template {{name: string, order?: number}} T
 * @param {T[]} items
 * @param {object} manifest
 * @param {string} phase
 * @returns {T[]}
 */
function sortItemsByBuildOrder(items, manifest, phase) {
  const specOrder = new Map(phaseItems(manifest, 'specification')
    .filter((s) => buildOrderLive(s) && Number.isInteger(s.order))
    .map((s) => [s.name, s.order]));
  const orderOf = (it) => {
    // Terminal items trail everywhere: a superseded spec's inert number must
    // not seat it among the live rows any more than it may seat a live plan.
    const o = phase === 'specification'
      ? (buildOrderLive(it) ? it.order : undefined)
      : specOrder.get(it.name);
    return Number.isInteger(o) ? o : Infinity;
  };
  return items.map((it, i) => ({ it, i }))
    .sort((a, b) => (orderOf(a.it) - orderOf(b.it)) || (a.i - b.i))
    .map((x) => x.it);
}

module.exports = { sequenceBuildOrder, computeBuildOrderNeedsSequencing, buildOrderLive, sortItemsByBuildOrder };
