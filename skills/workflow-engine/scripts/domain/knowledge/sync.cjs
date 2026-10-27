'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's own calls into the knowledge base — a
// transaction's changes, and boot's pass. The knowledge base is a derived
// index: each writes the keyword side and returns at once, the vectors left
// to the fill it launches, and a failure is a warning on the caller's result,
// never a throw. Its root is the state root, found from the caller's folder.
// ---------------------------------------------------------------------------

const path = require('path');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { listWorkUnitManifests } = require('../../kernel/manifest-io.cjs');
const { stateRoot } = require('../../kernel/state-root.cjs');
const { loadSettings, keyCause, storeMetadata } = require('./embedder.cjs');
const { indexPath, reconcile, readStore } = require('./indexing.cjs');
const { launchFillIfAwaiting, fillShortfall } = require('./vectors.cjs');
const { removeChunks, planCompaction, compact } = require('./maintenance.cjs');
const { readiness } = require('./status.cjs');

/** @typedef {import('./indexing.cjs').KeywordWrite} KeywordWrite */
/** @typedef {import('./maintenance.cjs').Scope} Scope */

/**
 * @typedef {({index: string} | {remove: Scope} | {reindex: string}) & {label?: string}} Change
 *   one artifact indexed by its state-relative path, a scope's chunks
 *   removed, or a work unit's artifacts brought back in line — `label`
 *   naming it in a warning
 */

/**
 * `fn`'s answer, or null where it throws — the failure a warning under `label`.
 * @template T
 * @param {string[]} warnings @param {string} label @param {() => T} fn
 * @returns {T|null}
 */
function attempt(warnings, label, fn) {
  try {
    return fn();
  } catch (err) {
    warnings.push(`${label} failed: ${messageOf(err)}`);
    return null;
  }
}

/**
 * Bring the knowledge base in line with what a transaction changed: each
 * change in turn, a failure a warning, then the vector fill launched once
 * where the writes left chunks awaiting vectors.
 * @param {string} cwd @param {Change[]} changes @param {string[]} warnings
 */
function syncKnowledge(cwd, changes, warnings) {
  const root = stateRoot(cwd);
  /** @type {import('./indexing.cjs').Settings|null} */
  let settings = null;
  /** @type {KeywordWrite|null} */
  let written = null;
  for (const change of changes) {
    const label = change.label || ('remove' in change ? 'knowledge remove' : 'knowledge index');
    attempt(warnings, label, () => {
      if ('remove' in change) {
        removeChunks(root, change.remove);
        return;
      }
      settings = settings || loadSettings(knowledgeFiles(root));
      if ('index' in change) {
        written = indexPath(root, change.index, settings);
        return;
      }
      const reconciled = reconcile(root, settings, change.reindex);
      for (const { artifact, error } of reconciled.failures) warnings.push(`${label} failed: Failed to index ${path.join(root, artifact.file)}: ${error.message}`);
      written = reconciled;
    });
  }
  if (written) launchFillIfAwaiting(root, written);
}

/**
 * @typedef {object} BootKnowledge
 * @property {'ready'|'not-ready'} knowledge
 * @property {boolean} indexed  the keyword side came in line with every file
 * @property {boolean} compacted
 */

/**
 * Boot's pass over a set-up checkout: the config settings loading ignores
 * named, the keyword side brought in line with the files — the store built
 * where the checkout has none and the config says how — then compacted, the
 * provider's key checked, the last fill's shortfall said, and the vector fill
 * launched where chunks await. A checkout not set up is left alone: setting
 * it up is the person's choice.
 * @param {string} cwd @param {string[]} warnings
 * @returns {BootKnowledge}
 */
function bootKnowledge(cwd, warnings) {
  const root = stateRoot(cwd);
  const state = readiness(root, () => {});
  if (state === 'not-ready') return { knowledge: 'not-ready', indexed: false, compacted: false };

  const files = knowledgeFiles(root);
  const settings = attempt(warnings, 'knowledge index', () => loadSettings(files));
  for (const line of settings ? settings.cfg._ignored : []) warnings.push(`knowledge config: ${line}`);
  const reconciled = settings && attempt(warnings, 'knowledge index', () => reconcile(root, settings));
  for (const { artifact, error } of reconciled ? reconciled.failures : []) {
    warnings.push(`knowledge index failed: Failed to index ${path.join(root, artifact.file)}: ${error.message}`);
  }
  const indexed = reconciled !== null && reconciled.failures.length === 0;

  const knowledge = state === 'ready' || readiness(root, () => {}) === 'ready' ? 'ready' : 'not-ready';
  if (knowledge === 'not-ready' || !settings) return { knowledge, indexed, compacted: false };

  const compacted = attempt(warnings, 'knowledge compact', () => {
    const plan = planCompaction(root, settings.cfg, listWorkUnitManifests(root));
    if (plan) compact(root, plan);
    return true;
  }) === true;
  if (!settings.provider && settings.cfg.provider) warnings.push(`knowledge vectors wait: ${keyCause(settings.cfg)}`);
  attempt(warnings, 'knowledge vectors', () => {
    const snapshot = readStore(files);
    const metadata = storeMetadata(files);
    const shortfall = metadata && snapshot.db ? fillShortfall(metadata.fill_failure, snapshot.db) : null;
    if (shortfall) warnings.push(`knowledge vector fill fell short: ${shortfall}`);
    if (reconciled) launchFillIfAwaiting(root, { embedder: reconciled.embedder, snapshot });
  });
  return { knowledge, indexed, compacted };
}

module.exports = { syncKnowledge, bootKnowledge };
