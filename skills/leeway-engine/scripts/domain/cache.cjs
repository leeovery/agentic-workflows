'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a work unit's scratch cache (`.cache/{wu}` in the state),
// removed at its lifecycle close.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');

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

module.exports = { purgeWorkUnitCache };
