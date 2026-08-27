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
const { git } = require('../kernel/git.cjs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { collectAnalysisInputs } = require('./derivations.cjs');
const { filesChecksum } = require('./reads.cjs');
const { knowledge } = require('./kb.cjs');

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
    emptyError: 'nothing to stamp: no completed research or discussion files',
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
    const inputs = collectAnalysisInputs(manifest, path.join(cwd, '.workflows'), kind);
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
  knowledge(cwd, ['index', `.workflows/${workUnit}/.state/${cfg.cacheFile}`], `knowledge index (.state/${cfg.cacheFile})`, warnings);

  return { ...stamped, warnings };
}

/**
 * Remove the work unit's scratch cache (`.workflows/.cache/{wu}`) at
 * lifecycle close. Caches are rebuildable per-phase scratch — reactivation
 * regenerates them on demand — but analysis flows commit tracking files
 * there, so when the index holds entries the caller must include the
 * returned pathspec in its transaction commit to stage the deletions.
 * A purely-untracked dir purges disk-only (returns null; `git add` on a
 * pathspec matching nothing is fatal).
 * @param {string} cwd project root
 * @param {string} workUnit
 * @returns {string|null} pathspec for the caller's commit, or null
 */
function purgeWorkUnitCache(cwd, workUnit) {
  const rel = `.workflows/.cache/${workUnit}`;
  const tracked = git(cwd, ['ls-files', '--', rel]).trim() !== '';
  fs.rmSync(path.join(cwd, rel), { recursive: true, force: true });
  return tracked ? rel : null;
}

module.exports = { stampAnalysisCache, purgeWorkUnitCache };
