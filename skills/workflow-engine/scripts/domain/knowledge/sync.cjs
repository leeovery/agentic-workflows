'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's own calls into the knowledge base — a
// transaction's changes, and boot's pass. The knowledge base is a derived
// index: each writes the keyword side and returns at once, the vectors left
// to the fill it launches, and a failure is a warning on the caller's result,
// never a throw.
// ---------------------------------------------------------------------------

const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { listWorkUnitManifests } = require('../../kernel/manifest.cjs');
const { loadSettings, keyCause, storeMetadata } = require('./embedder.cjs');
const { indexPath, reconcile, readStore } = require('./indexing.cjs');
const { launchFillIfAwaiting } = require('./vectors.cjs');
const { removeChunks, planCompaction, compact } = require('./maintenance.cjs');
const { readiness } = require('./status.cjs');

/** @typedef {import('./indexing.cjs').KeywordWrite} KeywordWrite */
/** @typedef {import('./maintenance.cjs').Scope} Scope */

/**
 * @typedef {({index: string} | {remove: Scope} | {reindex: string}) & {label?: string}} Change
 *   one artifact indexed by its project-relative path, a scope's chunks
 *   removed, or a work unit's artifacts brought back in line — `label`
 *   naming it in a warning
 */

/** @param {unknown} err */
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Bring the knowledge base in line with what a transaction changed: each
 * change in turn, a failure a warning, then the vector fill launched once
 * where the writes left chunks awaiting vectors.
 * @param {string} cwd  the project root @param {Change[]} changes @param {string[]} warnings
 */
function syncKnowledge(cwd, changes, warnings) {
  /** @type {import('./indexing.cjs').Settings|null} */
  let settings = null;
  /** @type {KeywordWrite|null} */
  let written = null;
  for (const change of changes) {
    const label = change.label || ('remove' in change ? 'knowledge remove' : 'knowledge index');
    try {
      if ('remove' in change) {
        removeChunks(cwd, change.remove);
        continue;
      }
      settings = settings || loadSettings(knowledgeFiles(cwd));
      if ('index' in change) {
        written = indexPath(cwd, change.index, settings);
      } else {
        const reconciled = reconcile(cwd, settings, change.reindex);
        for (const { artifact, error } of reconciled.failures) warnings.push(`${label} failed: Failed to index ${artifact.file}: ${error.message}`);
        written = reconciled;
      }
    } catch (err) {
      warnings.push(`${label} failed: ${messageOf(err)}`);
    }
  }
  if (written) launchFillIfAwaiting(cwd, written);
}

/**
 * @typedef {object} BootKnowledge
 * @property {'ready'|'not-ready'} knowledge
 * @property {boolean} indexed  the keyword side came in line with every file
 * @property {boolean} compacted
 */

/**
 * Boot's pass over a set-up checkout: the keyword side brought in line with
 * the files — the store built where the checkout has none and the config
 * says how — then compacted, the provider's key checked, the last fill's
 * shortfall said, and the vector fill launched where chunks await. A
 * checkout not set up is left alone: setting it up is the person's choice.
 * @param {string} cwd  the project root @param {string[]} warnings
 * @returns {BootKnowledge}
 */
function bootKnowledge(cwd, warnings) {
  const state = checkedReadiness(cwd);
  if (state === 'not-ready') return { knowledge: 'not-ready', indexed: false, compacted: false };

  const files = knowledgeFiles(cwd);
  /** @type {import('./indexing.cjs').Settings|null} */
  let settings = null;
  /** @type {import('./indexing.cjs').Reconciled|null} */
  let reconciled = null;
  try {
    settings = loadSettings(files);
    reconciled = reconcile(cwd, settings);
    for (const { artifact, error } of reconciled.failures) warnings.push(`knowledge index failed: Failed to index ${artifact.file}: ${error.message}`);
  } catch (err) {
    warnings.push(`knowledge index failed: ${messageOf(err)}`);
  }
  const indexed = reconciled !== null && reconciled.failures.length === 0;

  const knowledge = state === 'ready' || checkedReadiness(cwd) === 'ready' ? 'ready' : 'not-ready';
  if (knowledge === 'not-ready' || !settings) return { knowledge, indexed, compacted: false };

  let compacted = false;
  try {
    const plan = planCompaction(cwd, settings.cfg, listWorkUnitManifests(cwd));
    if (plan) compact(cwd, plan);
    compacted = true;
  } catch (err) {
    warnings.push(`knowledge compact failed: ${messageOf(err)}`);
  }
  if (!settings.provider && settings.cfg.provider) warnings.push(`knowledge vectors wait: ${keyCause(settings.cfg)}`);
  const metadata = storeMetadata(files);
  if (metadata && metadata.fill_failure) warnings.push(`knowledge vector fill fell short: ${metadata.fill_failure}`);
  if (reconciled) launchFillIfAwaiting(cwd, { embedder: reconciled.embedder, snapshot: readStore(files) });
  return { knowledge, indexed, compacted };
}

/**
 * The checkout's readiness; a check that cannot run reads not-ready.
 * @param {string} cwd @returns {import('./status.cjs').Readiness}
 */
function checkedReadiness(cwd) {
  try {
    return readiness(cwd, () => {});
  } catch {
    return 'not-ready';
  }
}

module.exports = { syncKnowledge, bootKnowledge };
