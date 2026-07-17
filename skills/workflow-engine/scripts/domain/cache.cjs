'use strict';

// ---------------------------------------------------------------------------
// Domain ring: analysis-cache stamping — record that an analysis ran over the
// current set of completed inputs.
//
// The input collection and checksum come from the same shared discovery-utils
// logic the read side (computeAnalysisCacheStatus) uses, so a fresh stamp is
// `valid` by construction and the two sides can never drift. No git commit —
// the calling flow's commit cadence picks the manifest change up.
// ---------------------------------------------------------------------------

const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { collectAnalysisInputs, filesChecksum } = require('../../../workflow-shared/scripts/discovery-utils.cjs');

const KINDS = ['research-analysis', 'gap-analysis'];

/**
 * @typedef {object} CacheStampResult
 * @property {string} kind      `research-analysis` | `gap-analysis`
 * @property {string} checksum
 * @property {number} files     how many input files the checksum covers
 */

/**
 * Ensure `manifest.phases[phase]` exists and return it.
 * @param {{phases?: Record<string, object>}} manifest @param {string} phase
 * @returns {Record<string, unknown>}
 */
function phaseObject(manifest, phase) {
  if (!manifest.phases || typeof manifest.phases !== 'object') manifest.phases = {};
  const existing = manifest.phases[phase];
  if (!existing || typeof existing !== 'object') manifest.phases[phase] = {};
  return manifest.phases[phase];
}

/**
 * Stamp one analysis cache: checksum the current completed inputs (exactly as
 * the read side collects them), write the cache object to its manifest home —
 * `phases.research.analysis_cache` (`files`) for research-analysis,
 * `phases.discovery.gap_analysis_cache` (`input_files`) for gap-analysis.
 * Throws when there is nothing to stamp — the analyses' preconditions skip
 * the stamp when no qualifying inputs exist.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} kind  `research-analysis` | `gap-analysis`
 * @returns {CacheStampResult}
 */
function stampAnalysisCache(cwd, workUnit, kind) {
  if (!KINDS.includes(kind)) {
    throw new Error(`unknown cache kind "${kind}" (${KINDS.join('|')})`);
  }
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const inputs = collectAnalysisInputs(manifest, path.join(cwd, '.workflows'), kind);
    if (inputs.length === 0) {
      throw new Error(kind === 'research-analysis'
        ? 'nothing to stamp: no completed research files'
        : 'nothing to stamp: no completed research or discussion files');
    }

    const checksum = /** @type {string} */ (filesChecksum(inputs));
    const generated = new Date().toISOString();
    const names = inputs.map((p) => path.basename(p));

    if (kind === 'research-analysis') {
      phaseObject(manifest, 'research').analysis_cache = { checksum, generated, files: names };
    } else {
      phaseObject(manifest, 'discovery').gap_analysis_cache = { checksum, generated, input_files: names };
    }

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { kind, checksum, files: inputs.length };
  });
}

module.exports = { stampAnalysisCache };
