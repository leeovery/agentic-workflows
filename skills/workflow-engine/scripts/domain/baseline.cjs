'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project baseline — the one home for reading the project
// manifest's `baseline` object. Boot's status field, the start menus'
// resume/manage rows, and the render surfaces all derive from this state, so
// the vocabulary and the remaining-count exist exactly once.
// ---------------------------------------------------------------------------

const { readProjectManifest } = require('../kernel/manifest.cjs');

/**
 * @typedef {object} BaselineState
 * @property {'none'|'in-progress'|'completed'|'skipped'} status
 * @property {{name: string, status: string}[]} areas  registration order
 * @property {number} remaining  areas not yet completed (0 unless in-progress)
 */

/**
 * Read the project baseline state. Anything other than a recognised
 * lifecycle status — including a missing or corrupt project manifest, or a
 * malformed field shape — reads `none` with no areas: the never-started
 * state the one-time offer keys on. Corruption surfaces loudly at the first
 * manifest write, not here — boot and the menus must stay usable.
 * @param {string} cwd
 * @returns {BaselineState}
 */
function baselineState(cwd) {
  /** @type {Record<string, any>} */
  let manifest = {};
  try {
    manifest = readProjectManifest(cwd);
  } catch (_) {
    return { status: 'none', areas: [], remaining: 0 };
  }
  const b = manifest && manifest.baseline;
  const status = b && typeof b === 'object' && !Array.isArray(b) && typeof b.status === 'string' ? b.status : 'none';
  if (status !== 'in-progress' && status !== 'completed' && status !== 'skipped') {
    return { status: 'none', areas: [], remaining: 0 };
  }
  const areasObj = b.areas && typeof b.areas === 'object' && !Array.isArray(b.areas) ? b.areas : {};
  const areas = Object.entries(areasObj)
    .filter(([, s]) => typeof s === 'string')
    .map(([name, s]) => ({ name, status: /** @type {string} */ (s) }));
  const remaining = status === 'in-progress' ? areas.filter((a) => a.status !== 'completed').length : 0;
  return { status, areas, remaining };
}

module.exports = { baselineState };
