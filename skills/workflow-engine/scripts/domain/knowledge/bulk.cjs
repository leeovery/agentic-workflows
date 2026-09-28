'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the bulk index a person runs — `index` with no file, and the
// index setup and rebuild end with: the keyword side brought in line with the
// files, then the vectors the store is owed filled while it waits, and an
// account of both.
// ---------------------------------------------------------------------------

const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { InvalidRequestError } = require('../../kernel/knowledge/providers/openai-engine.cjs');
const { identityKey } = require('./artifacts.cjs');
const { reconcile } = require('./indexing.cjs');
const { fillVectors } = require('./vectors.cjs');

/** @typedef {import('../../kernel/call.cjs').Call} Call */
/** @typedef {import('./indexing.cjs').Settings} Settings */
/** @typedef {import('./vectors.cjs').Unembedded} Unembedded */

/**
 * @typedef {object} IndexSummary
 * @property {number} new
 * @property {number} changed
 * @property {number} removed
 * @property {number} unchanged
 * @property {number} failed  the files that could not be indexed
 * @property {number} awaiting  the chunks left without the vector they await
 * @property {boolean} keyUnresolved  the store's provider key did not resolve, so no vector could land
 */

/**
 * Whether a bulk index fell short — a file it could not index, a chunk it
 * could not embed, or a store whose provider key does not resolve.
 * @param {IndexSummary} summary
 */
function indexFailed(summary) {
  return summary.failed > 0 || summary.awaiting > 0 || summary.keyUnresolved;
}

/**
 * Name each file on stderr, then what its failure leaves.
 * @param {Call} call @param {Unembedded[]} unembedded @param {string} consequence
 */
function reportFailures(call, unembedded, consequence) {
  for (const { file, error } of unembedded) call.err(`Failed to embed ${file}: ${error.message}\n`);
  if (unembedded.length > 0) call.err(`${consequence}\n`);
}

/**
 * The files whose vectors failed, then what that leaves — the files the
 * endpoint refused a chunk of apart from the rest.
 * @param {Call} call @param {Unembedded[]} unembedded
 */
function reportUnembedded(call, unembedded) {
  const refused = (/** @type {Unembedded} */ { error }) => error instanceof InvalidRequestError;
  reportFailures(call, unembedded.filter((u) => !refused(u)), 'Each is searchable by keyword; its vectors come at the next start.');
  reportFailures(call, unembedded.filter(refused), 'Each is searchable by keyword; a chunk the endpoint refused goes without a vector.');
}

/**
 * Bring the store in line with the files, fill the vectors it is owed, and
 * print what it did — each failure, the missing key, each removal, each file
 * indexed, then the summary. An identity retired after it was built reads as
 * removed alone.
 * @param {Call} call @param {string} root @param {Settings} settings @param {string|null} [scope]
 * @returns {Promise<IndexSummary>}
 */
async function indexBulk(call, root, settings, scope = null) {
  const reconciled = reconcile(root, settings, scope);
  const { embedder } = reconciled;
  const vectoring = embedder
    ? await fillVectors(knowledgeFiles(root), settings.cfg, embedder, reconciled.pending, reconciled.snapshot)
    : { unembedded: [], awaiting: 0 };
  const missingKey = embedder && 'missingKey' in embedder ? embedder.missingKey : null;

  const gone = new Set(reconciled.retired.map((e) => identityKey(e.workUnit, e.phase, e.topic)));
  const stays = (/** @type {{workUnit: string, phase: string, topic: string}} */ a) => !gone.has(identityKey(a.workUnit, a.phase, a.topic));
  const indexed = reconciled.built.filter((b) => stays(b.artifact));

  for (const { artifact, error } of reconciled.failures) call.err(`Failed to index ${artifact.file}: ${error.message}\n`);
  reportUnembedded(call, vectoring.unembedded);
  if (missingKey) call.err(`Cannot embed: ${missingKey.message}\n`);
  for (const entry of reconciled.retired) call.out(`Removed ${entry.file} — ${entry.chunks} chunks (${entry.reason})\n`);
  for (const { artifact, docs, state } of indexed) call.out(`Indexed ${artifact.file} — ${docs.length} chunks (${state})\n`);

  /** @type {IndexSummary} */
  const summary = {
    new: indexed.filter((b) => b.state === 'new').length,
    changed: indexed.filter((b) => b.state === 'changed').length,
    removed: reconciled.retired.length,
    unchanged: reconciled.unchanged.filter(stays).length,
    failed: reconciled.failures.length,
    awaiting: vectoring.awaiting,
    keyUnresolved: missingKey !== null,
  };
  const failed = summary.failed > 0 ? `, ${summary.failed} failed` : '';
  const awaiting = summary.awaiting > 0 ? `, ${summary.awaiting} chunks awaiting vectors` : '';
  call.out(`${summary.new} new, ${summary.changed} changed, ${summary.removed} removed, ${summary.unchanged} unchanged${failed}${awaiting}.\n`);
  return summary;
}

module.exports = { indexBulk, indexFailed, reportUnembedded };
