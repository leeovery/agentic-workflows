'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a knowledge query — every framing embedded in one request or,
// whatever keeps it from a vector the store can compare, none, the query then
// running keyword-only with a note naming why; the framings searched, merged
// by each chunk's best score, dated by the progress clock and re-ranked; and
// the text `query` prints. A query never writes.
// ---------------------------------------------------------------------------

const config = require('../../kernel/knowledge/config.cjs');
const store = require('../../kernel/knowledge/store.cjs');
const { searchFramings, mergeFramings, rerank, explanation } = require('../../kernel/knowledge/ranking.cjs');
const { UserError, isPermanentError, withRetry, DEFAULT_RETRY_BACKOFF } = require('../../kernel/knowledge/retry.cjs');
const { QuotaError, RateLimitError, WaitBudget } = require('../../kernel/knowledge/providers/openai-engine.cjs');
const { keywordOnlyCause } = require('./embedder.cjs');
const { progressClockOf, resolveDecayWeights, resolveStability } = require('./decay.cjs');

/** @typedef {import('../../kernel/knowledge/store.cjs').Store} Store */
/** @typedef {import('../../kernel/knowledge/store.cjs').Metadata} Metadata */
/** @typedef {import('./embedder.cjs').Config} Config */
/** @typedef {import('./embedder.cjs').EmbeddingProvider} EmbeddingProvider */

// A query's patience with its endpoint is seconds, where an index's is
// minutes: keyword-only answers at once, and a phase's opening query must not
// stall.
const QUERY_TIMEOUT_MS = 5000;
const QUERY_RETRY = { maxAttempts: 2, backoff: DEFAULT_RETRY_BACKOFF };
const QUERY_WAIT_BUDGET_MS = 5000;

const DEFAULT_QUERY_LIMIT = 10;

/**
 * The configured provider as a query embeds with it — each request answered
 * within QUERY_TIMEOUT_MS, a transient failure tried once more, a rate limit
 * waited out for QUERY_WAIT_BUDGET_MS in all — or null when none is.
 * @param {Config} cfg
 * @param {import('../../kernel/knowledge/providers/openai-engine.cjs').Patience} [patience]  over the query's own, for a caller that must wait less
 * @returns {EmbeddingProvider|null}
 */
function queryProvider(cfg, patience = {}) {
  const provider = config.resolveProvider(cfg, {
    timeoutMs: QUERY_TIMEOUT_MS,
    waitBudget: new WaitBudget(QUERY_WAIT_BUDGET_MS),
    ...patience,
  });
  return provider && {
    model: () => provider.model(),
    dimensions: () => provider.dimensions(),
    embedBatch: (texts) => withRetry(async () => provider.embedBatch(texts), QUERY_RETRY),
  };
}

// CLI boost field → store field: kebab-case on the command line, as the
// filters are; snake_case in the store.
/** @type {Record<string, string>} */
const BOOST_FIELD_MAP = {
  'work-unit': 'work_unit',
  'work-type': 'work_type',
  'phase': 'phase',
  'topic': 'topic',
  'confidence': 'confidence',
};

/**
 * What is wrong with a --boost directive, or null when it is valid.
 * @param {{field: string, value: string|null}} boost
 * @returns {string|null}
 */
function boostProblem({ field, value }) {
  if (!field || !Object.hasOwn(BOOST_FIELD_MAP, field)) {
    return `Unknown --boost field: "${field}". Valid fields: ${Object.keys(BOOST_FIELD_MAP).join(', ')}`;
  }
  if (value == null || value === '') return `--boost:${field} requires a value`;
  return null;
}

/**
 * The --boost directives by store field. Refuses an unknown field or a
 * missing value, so a template typo never silently no-ops.
 * @param {Array<{field: string, value: string|null}>} boosts
 * @returns {Array<{field: string, value: string}>}
 */
function normaliseBoosts(boosts) {
  return boosts.map((boost) => {
    const problem = boostProblem(boost);
    if (problem) throw new UserError(problem);
    return { field: BOOST_FIELD_MAP[boost.field], value: /** @type {string} */ (boost.value) };
  });
}

/** @param {string} cause */
function keywordOnlyNote(cause) {
  return `[keyword-only mode — ${cause}]`;
}

/**
 * Why embedding a query's framings failed, and its fix: the failure's own
 * words, which name the fix where no retry can change them.
 * @param {Error} err
 */
function embedFailureCause(err) {
  if (err instanceof RateLimitError) return "the embedding provider's rate limit outlasted this command's wait; retry shortly";
  if (err instanceof QuotaError) return 'the embedding account is out of quota; add credit to it';
  const said = `the query could not be embedded: ${err.message.replace(/\s+/g, ' ').trim()}`;
  return isPermanentError(err) ? said : `${said}; retry once the provider answers`;
}

/**
 * @typedef {object} QuerySettings
 * @property {EmbeddingProvider|null} provider  embeds the framings — null when the query runs keyword-only
 * @property {string|null} note  why the query runs keyword-only, when it does
 * @property {boolean} storeEmbedded  whether the store's identity names a provider — a chunk without a vector then awaits one
 * @property {string|null} fillFailure  why the last vector fill fell short
 * @property {number} similarity  the vector leg's cosine floor
 * @property {number} stability  S0 for the decay curve
 * @property {Record<string, number>} weights  the progress clock's significance weights
 */

/**
 * The similarity floor the config sets. `??`, not `||`: an explicit 0 accepts
 * every vector match.
 * @param {Config} cfg @returns {number}
 */
function resolveSimilarityThreshold(cfg) {
  const similarity = cfg.similarity_threshold ?? config.DEFAULTS.similarity_threshold;
  if (typeof similarity !== 'number' || !Number.isFinite(similarity) || similarity < 0 || similarity > 1) {
    throw new UserError(
      `Invalid similarity_threshold: ${JSON.stringify(similarity)}. Expected a number in [0, 1].`
    );
  }
  return similarity;
}

/**
 * What a query over a store runs with: the provider the store's metadata and
 * the config leave it, and the ranking settings the config holds.
 * @param {Metadata} metadata @param {Config} cfg @param {EmbeddingProvider|null} provider
 * @returns {QuerySettings}
 */
function querySettings(metadata, cfg, provider) {
  const cause = keywordOnlyCause(metadata, cfg, provider);
  return {
    provider: cause ? null : provider,
    note: cause ? keywordOnlyNote(cause) : null,
    storeEmbedded: Boolean(metadata.provider),
    fillFailure: metadata.fill_failure || null,
    similarity: resolveSimilarityThreshold(cfg),
    stability: resolveStability(cfg),
    weights: resolveDecayWeights(cfg),
  };
}

/**
 * Every framing's vector, from one embed call, and the note a query run
 * without them carries — the settings' own when they name no provider, else
 * why the embedding failed.
 * @param {QuerySettings} settings @param {string[]} terms
 * @returns {Promise<{vectors: Array<ArrayLike<number>>|null, note: string|null}>}
 */
async function framingVectors({ provider, note }, terms) {
  if (!provider) return { vectors: null, note };
  try {
    return { vectors: await provider.embedBatch(terms), note: null };
  } catch (err) {
    return { vectors: null, note: keywordOnlyNote(embedFailureCause(/** @type {Error} */ (err))) };
  }
}

/**
 * The lines that say what the store's vectors lack: how many chunks await
 * them — where the store was embedded — and why the last fill fell short.
 * None while no chunk awaits a vector.
 * @param {Store} db @param {QuerySettings} settings
 * @returns {string[]}
 */
function vectorNotes(db, { storeEmbedded, fillFailure }) {
  const awaiting = store.chunksWithoutVector(db).length;
  if (awaiting === 0) return [];
  return [
    ...(storeEmbedded ? [`[${awaiting} chunks await vectors — searched by keyword alone; each start retries them]`] : []),
    ...(fillFailure ? [`[the last vector fill fell short — ${fillFailure}]`] : []),
  ];
}

/**
 * A filter value as a where term: one value, or a comma-separated list.
 * @param {string} value
 * @returns {{eq: string} | {in: string[]}}
 */
function csv(value) {
  const parts = value.split(',').map((s) => s.trim());
  return parts.length === 1 ? { eq: parts[0] } : { in: parts };
}

/**
 * @typedef {object} QueryOptions  a query's hard filters (each a value or a
 *   comma list), its limit, and its --boost directives by CLI field name
 * @property {string|null} [phase]
 * @property {string|null} [workType]
 * @property {string|null} [workUnit]
 * @property {string|null} [topic]
 * @property {number|null} [limit]
 * @property {Array<{field: string, value: string|null}>} [boosts]
 */

/**
 * The where clause a query's hard filters make — undefined when it has none.
 * @param {QueryOptions} options
 * @returns {import('../../kernel/knowledge/store.cjs').Where|undefined}
 */
function queryWhere({ phase, workType, workUnit, topic }) {
  /** @type {import('../../kernel/knowledge/store.cjs').Where} */
  const where = {};
  if (phase) where.phase = csv(phase);
  if (workType) where.work_type = csv(workType);
  if (workUnit) where.work_unit = csv(workUnit);
  if (topic) where.topic = csv(topic);
  return Object.keys(where).length > 0 ? where : undefined;
}

/**
 * @typedef {object} QueryRequest
 * @property {string[]} terms
 * @property {QueryOptions} options
 * @property {Array<Record<string, any>>} workUnits  the manifests the progress clock is built from
 */

/**
 * @typedef {object} QueryOutcome
 * @property {Array<import('../../kernel/knowledge/ranking.cjs').Ranked>} results  ranked, cut to the limit
 * @property {string[]} notes  the lines above the count
 */

/** @type {QueryOutcome} */
const NO_RESULTS = { results: [], notes: [] };

/**
 * A query's ranked results, each carrying the scoring `--explain` prints.
 * @param {Store} db @param {QuerySettings} settings @param {QueryRequest} request
 * @returns {Promise<QueryOutcome>}
 */
async function queryStore(db, settings, { terms, options, workUnits }) {
  const boosts = normaliseBoosts(options.boosts || []);
  const limit = options.limit || DEFAULT_QUERY_LIMIT;
  const { vectors, note } = await framingVectors(settings, terms);
  const { cut, framings } = searchFramings(db, terms, { where: queryWhere(options), limit, similarity: settings.similarity, vectors });
  const clock = progressClockOf(workUnits, settings.weights);
  const dated = mergeFramings(framings, cut).map((r) => ({ ...r, progressElapsed: clock.get(r.work_unit) || 0 }));
  return {
    results: rerank(dated, boosts, settings.stability).slice(0, limit),
    notes: [...(note ? [note] : []), ...vectorNotes(db, settings)],
  };
}

// C0 control characters but \t and \n: an indexed file carrying ANSI escapes
// or a NUL would otherwise reach the reader's terminal through `query`.
const CONTROL_CHARS_RE = /[\x00-\x08\x0b-\x1f]/g;

/**
 * An epoch-ms time as YYYY-MM-DD.
 * @param {number} ts
 */
function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The text `query` prints: its notes, the count, then each result's header
 * (dated by its source document), content and source — and, explained, how
 * it ranked. Control characters are stripped from the whole, never from the
 * store.
 * @param {QueryOutcome} outcome @param {{explain?: boolean}} [rendering]
 * @returns {string}
 */
function renderQuery({ results, notes }, { explain = false } = {}) {
  const out = [...notes, `[${results.length} results]`];
  for (const r of results) {
    out.push(
      '',
      `[${r.phase} | ${r.work_unit}/${r.topic} | ${r.confidence} | ${formatDate(r.timestamp)}]`,
      r.content,
      `Source: ${r.source_file}`,
    );
    if (explain) out.push(...explanation(r));
  }
  return out.join('\n').replace(CONTROL_CHARS_RE, '') + '\n';
}

module.exports = {
  QUERY_TIMEOUT_MS,
  QUERY_WAIT_BUDGET_MS,
  NO_RESULTS,
  queryProvider,
  boostProblem,
  resolveSimilarityThreshold,
  querySettings,
  queryStore,
  renderQuery,
};
