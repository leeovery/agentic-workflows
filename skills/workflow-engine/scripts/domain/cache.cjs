'use strict';

// ---------------------------------------------------------------------------
// Domain ring: analysis-cache stamping — record that an analysis ran over the
// current set of completed inputs.
//
// The input collection and checksum come from the same shared discovery-utils
// logic the read side (computeAnalysisCacheStatus) uses, so a fresh stamp is
// `valid` by construction and the two sides can never drift. The stamp also
// indexes the kind's on-disk cache file into the knowledge base — the same
// moment, one call — warn-don't-block like every engine KB sync. No git
// commit — the calling flow's commit cadence picks the manifest change up.
// ---------------------------------------------------------------------------

const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { collectAnalysisInputs, filesChecksum } = require('./discovery-utils.cjs');
const { knowledge } = require('./kb.cjs');

const KINDS = ['research-analysis', 'gap-analysis'];

// The kind's model-authored cache file under `.state/` — the analysis output
// the stamp checksums the inputs of, and the artifact the KB index covers.
const CACHE_FILES = {
  'research-analysis': 'research-analysis.md',
  'gap-analysis': 'discovery-gap-analysis.md',
};

/**
 * @typedef {object} CacheStampResult
 * @property {string} kind      `research-analysis` | `gap-analysis`
 * @property {string} checksum
 * @property {number} files     how many input files the checksum covers
 * @property {string[]} warnings non-blocking failures (knowledge-base index)
 */

/**
 * Ensure `manifest.phases[phase]` exists and return it.
 * @param {{phases?: Record<string, object>}} manifest @param {string} phase
 * @returns {Record<string, unknown>}
 */
function phaseObject(manifest, phase) {
  return ensureContainer(ensureContainer(manifest, 'phases', 'phases'), phase, `phases.${phase}`);
}

/**
 * Stamp one analysis cache: checksum the current completed inputs (exactly as
 * the read side collects them), write the cache object to its manifest home —
 * `phases.research.analysis_cache` (`files`) for research-analysis,
 * `phases.discovery.gap_analysis_cache` (`input_files`) for gap-analysis —
 * then index the kind's `.state/` cache file into the knowledge base
 * (warn-don't-block). Throws when there is nothing to stamp — the analyses'
 * preconditions skip the stamp when no qualifying inputs exist.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} kind  `research-analysis` | `gap-analysis`
 * @returns {CacheStampResult}
 */
function stampAnalysisCache(cwd, workUnit, kind) {
  if (!KINDS.includes(kind)) {
    throw new Error(`unknown cache kind "${kind}" (${KINDS.join('|')})`);
  }
  const stamped = withWorkUnitLock(cwd, workUnit, () => {
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

  /** @type {string[]} */
  const warnings = [];
  const cacheFile = CACHE_FILES[/** @type {keyof typeof CACHE_FILES} */ (kind)];
  knowledge(cwd, ['index', `.workflows/${workUnit}/.state/${cacheFile}`], `knowledge index (.state/${cacheFile})`, warnings);

  return { ...stamped, warnings };
}

module.exports = { stampAnalysisCache };
