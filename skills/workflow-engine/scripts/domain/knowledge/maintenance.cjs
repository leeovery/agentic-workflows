'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the store's upkeep — removing an identity's chunks, and
// compaction: a pure storage backstop that prunes a unit's non-spec chunks
// once their retrievability has decayed below `decay_prune_below`, by which
// point ranking no longer reaches them.
// ---------------------------------------------------------------------------

const fs = require('fs');
const store = require('../../kernel/knowledge/store.cjs');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { pruneTest } = require('./decay.cjs');

/** @typedef {import('./embedder.cjs').Config} Config */

/**
 * @typedef {object} Scope  whose chunks — a work unit, narrowed by phase and topic
 * @property {string} workUnit
 * @property {string|null} [phase]
 * @property {string|null} [topic]
 */

/**
 * The where clause a scope names.
 * @param {Scope} scope
 * @returns {import('../../kernel/knowledge/store.cjs').Where}
 */
function scopeFilter({ workUnit, phase, topic }) {
  /** @type {import('../../kernel/knowledge/store.cjs').Where} */
  const where = { work_unit: { eq: workUnit } };
  if (phase) where.phase = { eq: phase };
  if (topic) where.topic = { eq: topic };
  return where;
}

/**
 * How many chunks a scope names — 0 without a store.
 * @param {string} root @param {Scope} scope
 */
function countChunks(root, scope) {
  const files = knowledgeFiles(root);
  return fs.existsSync(files.store) ? store.countByFilter(store.loadStore(files.store), scopeFilter(scope)) : 0;
}

/**
 * Remove every chunk a scope names, under the lock — 0 without a store.
 * @param {string} root @param {Scope} scope
 * @returns {number} how many were removed
 */
function removeChunks(root, scope) {
  const files = knowledgeFiles(root);
  if (!fs.existsSync(files.store)) return 0;
  return store.withLock(files.lock, () => {
    const db = store.loadStore(files.store);
    const removed = store.removeByFilter(db, scopeFilter(scope));
    store.saveStore(db, files.store);
    return removed;
  });
}

/**
 * @typedef {object} Compaction
 * @property {number} floor  the retrievability the pruned units fell below
 * @property {Array<{workUnit: string, count: number, phases: string[]}>} removals  by work unit
 * @property {number} chunks  how many in all
 * @property {Array<{work_unit: string, phase: string, topic: string}>} identities  each pruned identity once
 */

/**
 * What compaction prunes from the store — null when `decay_prune_below` is
 * false. Throws UserError on an invalid floor.
 * @param {string} root @param {Config} cfg @param {Array<Record<string, any>>} workUnits
 * @returns {Compaction|null}
 */
function planCompaction(root, cfg, workUnits) {
  const pruning = pruneTest(cfg, workUnits);
  if (!pruning) return null;
  const files = knowledgeFiles(root);
  const chunks = fs.existsSync(files.store) ? store.allChunks(store.loadStore(files.store)) : [];
  /** @type {Map<string, {workUnit: string, count: number, phases: Set<string>}>} */
  const byUnit = new Map();
  /** @type {Map<string, {work_unit: string, phase: string, topic: string}>} */
  const identities = new Map();
  for (const { work_unit, phase, topic } of chunks) {
    if (!pruning.prunes(work_unit, phase)) continue;
    let removal = byUnit.get(work_unit);
    if (!removal) {
      removal = { workUnit: work_unit, count: 0, phases: new Set() };
      byUnit.set(work_unit, removal);
    }
    removal.count += 1;
    removal.phases.add(phase);
    identities.set(`${work_unit}|${phase}|${topic}`, { work_unit, phase, topic });
  }
  const removals = [...byUnit.values()].map(({ workUnit, count, phases }) => ({ workUnit, count, phases: [...phases] }));
  return { floor: pruning.floor, removals, chunks: removals.reduce((sum, r) => sum + r.count, 0), identities: [...identities.values()] };
}

/**
 * Prune what compaction plans — each pruned identity removed under the lock
 * from a fresh load.
 * @param {string} root @param {Compaction} plan
 */
function compact(root, plan) {
  if (plan.chunks === 0) return;
  const files = knowledgeFiles(root);
  store.withLock(files.lock, () => {
    const db = store.loadStore(files.store);
    for (const identity of plan.identities) store.removeByIdentity(db, identity);
    store.saveStore(db, files.store);
  });
}

module.exports = { countChunks, removeChunks, planCompaction, compact };
