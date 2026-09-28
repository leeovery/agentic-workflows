'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the knowledge base's state — whether a checkout is ready, and
// the report `status` prints: the store's contents, the embedder it records,
// what a query over it runs in, and what the next bulk index would do.
// ---------------------------------------------------------------------------

const fs = require('fs');
const config = require('../../kernel/knowledge/config.cjs');
const store = require('../../kernel/knowledge/store.cjs');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { readManifests } = require('./artifacts.cjs');
const { loadSettings, storeBuildable, keywordOnlyCause } = require('./embedder.cjs');
const { planIndex } = require('./indexing.cjs');
const { fillShortfall } = require('./vectors.cjs');
const { pruneTest } = require('./decay.cjs');

/** @typedef {'ready'|'buildable'|'not-ready'} Readiness */

/**
 * `ready` — set up, and the store loads with its metadata; `buildable` — set
 * up, no store on this checkout, and this machine's config says how to build
 * one; `not-ready` — anything else. A config that does not read is said on
 * `warn`: it would otherwise surface only later, as the parse error of an
 * index or a query.
 * @param {string} root @param {(text: string) => void} warn
 * @returns {Readiness}
 */
function readiness(root, warn) {
  const files = knowledgeFiles(root);
  if (!fs.existsSync(files.config)) return 'not-ready';
  try {
    config.readConfigFile(files.config);
  } catch (err) {
    warn(`config error: ${messageOf(err)}\n`);
    return 'not-ready';
  }
  if (!fs.existsSync(files.store)) return storeBuildable(files) ? 'buildable' : 'not-ready';
  try {
    store.loadStore(files.store);
  } catch {
    return 'not-ready';
  }
  // A store without its metadata is the partial state a query refuses.
  return fs.existsSync(files.metadata) ? 'ready' : 'not-ready';
}

/**
 * The config and provider a report reads, or the error that fails them.
 * @param {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} files
 * @returns {{cfg: Record<string, any>|null, provider: import('./embedder.cjs').EmbeddingProvider|null, error: Error|null}}
 */
function reportSettings(files) {
  try {
    return { ...loadSettings(files), error: null };
  } catch (error) {
    return { cfg: null, provider: null, error: /** @type {Error} */ (error) };
  }
}

/**
 * The count lines of one grouping, under its label — none when empty.
 * @param {string} label @param {Record<string, number>} counts
 * @returns {string[]}
 */
function countLines(label, counts) {
  const rows = Object.entries(counts);
  return rows.length === 0 ? [] : ['', `${label}:`, ...rows.map(([name, count]) => `  ${name}: ${count}`)];
}

/**
 * The report `status` prints.
 * @param {string} root
 * @returns {string}
 */
function statusReport(root) {
  const files = knowledgeFiles(root);
  const out = ['=== Knowledge Base Status ===', ''];
  if (!fs.existsSync(files.store)) {
    out.push('Store: not initialized', 'Run `knowledge index` to build the index.');
    return out.join('\n') + '\n';
  }

  const db = store.loadStore(files.store);
  const chunks = store.allChunks(db);
  out.push(`Total chunks: ${chunks.length}`);
  /** @type {Record<string, Record<string, number>>} */
  const by = { work_unit: {}, phase: {}, work_type: {} };
  for (const c of chunks) {
    for (const field of /** @type {Array<'work_unit'|'phase'|'work_type'>} */ (['work_unit', 'phase', 'work_type'])) {
      by[field][c[field]] = (by[field][c[field]] || 0) + 1;
    }
  }
  out.push(...countLines('By work unit', by.work_unit), ...countLines('By phase', by.phase), ...countLines('By work type', by.work_type));

  out.push('', `Store size: ${(fs.statSync(files.store).size / 1024).toFixed(1)} KB`);
  const warn = (/** @type {unknown} */ err) => out.push('', `WARNING: ${messageOf(err)}`);
  const settings = reportSettings(files);
  if (fs.existsSync(files.metadata)) {
    const metadata = store.readMetadata(files.metadata);
    out.push(`Last indexed: ${metadata.last_indexed || 'unknown'}`);
    out.push(metadata.provider ? `Provider: ${metadata.provider} (model: ${metadata.model}, dimensions: ${metadata.dimensions})` : 'Provider: none');
    const cause = settings.cfg ? keywordOnlyCause(metadata, settings.cfg, settings.provider) : null;
    out.push(`Mode: ${settings.error ? 'none — a query fails until the knowledge config loads' : cause ? `Keyword-only — ${cause}` : 'Full (hybrid search)'}`);
    if (metadata.provider) out.push(`Chunks awaiting vectors: ${store.chunksWithoutVector(db).length}`);
    const shortfall = fillShortfall(metadata.fill_failure, db);
    if (shortfall) out.push(`Last vector fill fell short: ${shortfall}`);
  } else {
    out.push('Metadata: missing (run `knowledge rebuild` to fix)');
  }
  if (settings.error) warn(settings.error);

  // What the next bulk index does: the artifacts it indexes — never indexed,
  // or changed since — those compact prunes, which it skips, and the indexed
  // identities it retires.
  let manifests = null;
  try {
    manifests = readManifests(root);
  } catch (err) {
    warn(err);
  }
  if (manifests) {
    let pruning = null;
    try {
      pruning = pruneTest(settings.cfg, manifests.workUnits);
    } catch (err) {
      warn(err);
    }
    const plan = planIndex(root, chunks, manifests, { scope: null, pruning });
    for (const [label, rows] of /** @type {Array<[string, string[]]>} */ ([
      ['Unindexed completed artifacts', plan.fresh.map((a) => a.file)],
      ['Changed since indexing', plan.changed.map((a) => a.file)],
      ['Pruned below the decay floor', plan.pruned.map((a) => a.file)],
      ['Retired since indexing', plan.retired.map((e) => `${e.file} (${e.reason})`)],
    ])) {
      if (rows.length > 0) out.push('', `${label}: ${rows.length}`, ...rows.map((row) => `  ${row}`));
    }
  }
  return out.join('\n') + '\n';
}

module.exports = { readiness, statusReport };
