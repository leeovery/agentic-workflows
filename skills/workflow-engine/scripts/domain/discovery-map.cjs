'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the discovery map — the epic's manifest-backed topic map at
// `phases.discovery.items`. Sequencing records a suggested execution order
// across its topics as a single transaction: manifest write, scoped git
// commit. Judgment decides, code records: choosing the order is the caller's
// call; this validates and writes it. All errors throw loud and specific.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { commitScoped } = require('../kernel/git.cjs');

/**
 * @typedef {object} SequenceResult
 * @property {Record<string, number>} ordered  topic → order, as applied
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]          set when committed is null
 */

/**
 * Record a suggested execution order across discovery-map topics: set each
 * topic's `order`, commit scoped to the work unit. Judgment (choosing the
 * order) is the caller's; this validates and writes it. Every topic must
 * exist under `phases.discovery.items` and every order must be a positive
 * integer — checked before anything is written.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {Record<string, number>} orders  topic → order
 * @returns {SequenceResult}
 */
function sequenceMap(cwd, workUnit, orders) {
  const manifest = loadWorkUnitManifest(cwd, workUnit);
  const discovery = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases.discovery : undefined;
  const items = discovery && typeof discovery === 'object' ? discovery.items : undefined;
  if (!items || typeof items !== 'object') {
    throw new Error('no discovery items in the manifest (phases.discovery.items)');
  }
  const entries = Object.entries(orders);
  if (entries.length === 0) {
    throw new Error('no {topic}={order} assignments given');
  }
  for (const [topic, order] of entries) {
    if (!items[topic] || typeof items[topic] !== 'object') {
      throw new Error(`no discovery item "${topic}" in the manifest (phases.discovery.items)`);
    }
    if (!Number.isInteger(order) || order < 1) {
      throw new Error(`order for "${topic}" must be a positive integer (got ${JSON.stringify(order)})`);
    }
  }
  for (const [topic, order] of entries) {
    items[topic].order = order;
  }

  saveWorkUnitManifest(cwd, workUnit, manifest);

  const committed = commitScoped(cwd, `.workflows/${workUnit}`, `discovery(${workUnit}): sequence topic map`);
  /** @type {SequenceResult} */
  const result = { ordered: orders, committed };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

module.exports = { sequenceMap };
