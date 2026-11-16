'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a work unit's scratch cache (`.cache/{wu}` in the state),
// removed at its lifecycle close, and a topic's places in it, removed as
// the topic leaves the unit.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');
const { TOPIC_PHASES } = require('../kernel/manifest-schema.cjs');

/**
 * Remove the work unit's scratch cache (`.cache/{wu}` in the state) at
 * lifecycle close. Caches are rebuildable per-phase scratch — reactivation
 * regenerates them on demand — and the state ignores the cache, so there is
 * nothing to commit.
 * @param {string} cwd project root
 * @param {string} workUnit
 */
function purgeWorkUnitCache(cwd, workUnit) {
  fs.rmSync(statePath(cwd, '.cache', workUnit), { recursive: true, force: true });
}

/**
 * Remove a topic's places in its unit's scratch cache
 * (`.cache/{wu}/{phase}/{topic}` in the state), every phase's, as it leaves
 * the unit: what a conversation held there was held in the unit it left.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 */
function purgeTopicCache(cwd, workUnit, topic) {
  for (const phase of TOPIC_PHASES) fs.rmSync(statePath(cwd, '.cache', workUnit, phase, topic), { recursive: true, force: true });
}

module.exports = { purgeWorkUnitCache, purgeTopicCache };
