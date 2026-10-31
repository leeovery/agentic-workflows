'use strict';

// ---------------------------------------------------------------------------
// Domain ring: analysis-cache stamping — record that an analysis ran over the
// current set of completed inputs.
//
// The input collection and checksum come from the same shared derivations
// logic the read side (computeAnalysisCacheStatus) uses, so a fresh stamp is
// `valid` by construction and the two sides can never drift. The stamp also
// indexes the kind's on-disk cache file into the knowledge base — the same
// moment, one call — warn-don't-block like every engine KB sync. No git
// commit — the calling flow's commit cadence picks the manifest change up.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { collectAnalysisInputs } = require('./derivations.cjs');
const { filesChecksum } = require('./reads.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');

// Per-kind config: the model-authored cache file under `.state/` (the
// analysis output the stamp checksums the inputs of, and the artifact the KB
// index covers), the cache object's manifest home (`phases.{phase}.{field}`),
// the field naming the checksummed inputs, and the nothing-to-stamp error.
const KIND_CONFIG = {
  'gap-analysis': {
    cacheFile: 'discovery-gap-analysis.md',
    phase: 'discovery',
    field: 'gap_analysis_cache',
    filesField: 'input_files',
    emptyError: 'nothing to stamp: no decided discussion records',
  },
};

const KINDS = Object.keys(KIND_CONFIG);

/**
 * @typedef {object} CacheStampResult
 * @property {string} kind      `gap-analysis`
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
 * `phases.discovery.gap_analysis_cache` (`input_files`) for gap-analysis —
 * then index the kind's `.state/` cache file into the knowledge base
 * (warn-don't-block). Throws when there is nothing to stamp — the analysis'
 * preconditions skip the stamp when no qualifying inputs exist.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} kind  `gap-analysis`
 * @returns {CacheStampResult}
 */
function stampAnalysisCache(cwd, workUnit, kind) {
  if (!Object.hasOwn(KIND_CONFIG, kind)) {
    throw new Error(`unknown cache kind "${kind}" (${KINDS.join('|')})`);
  }
  const cfg = KIND_CONFIG[/** @type {keyof typeof KIND_CONFIG} */ (kind)];
  const stamped = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const inputs = collectAnalysisInputs(manifest, stateRoot(cwd), kind);
    if (inputs.length === 0) {
      throw new Error(cfg.emptyError);
    }

    const checksum = /** @type {string} */ (filesChecksum(inputs));
    const generated = new Date().toISOString();
    const names = inputs.map((p) => path.basename(p));

    phaseObject(manifest, cfg.phase)[cfg.field] = { checksum, generated, [cfg.filesField]: names };

    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { kind, checksum, files: inputs.length };
  });

  /** @type {string[]} */
  const warnings = [];
  syncKnowledge(cwd, [{ index: `${workUnit}/.state/${cfg.cacheFile}`, label: `knowledge index (.state/${cfg.cacheFile})` }], warnings);

  return { ...stamped, warnings };
}

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

module.exports = { stampAnalysisCache, purgeWorkUnitCache };
