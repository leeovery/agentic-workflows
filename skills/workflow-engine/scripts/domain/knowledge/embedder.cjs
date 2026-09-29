'use strict';

// ---------------------------------------------------------------------------
// Domain ring: which embedding provider a checkout's store takes — the one it
// was built with, the one a new store would be built with, or none — and why
// a search runs without one. A store records its provider, model and
// dimensions once; a keyword-only store takes whichever is configured.
// ---------------------------------------------------------------------------

const fs = require('fs');
const config = require('../../kernel/knowledge/config.cjs');
const store = require('../../kernel/knowledge/store.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');

/** @typedef {import('../../kernel/knowledge/embeddings.cjs').EmbeddingProvider} EmbeddingProvider */
/** @typedef {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} KnowledgeFiles */
/** @typedef {import('../../kernel/knowledge/store.cjs').Metadata} Metadata */
/** @typedef {Record<string, any>} Config  the merged knowledge config */

/**
 * The store's provider while its key cannot be resolved: it answers to the
 * store's model and dimensions, and every embed fails naming the key's fix.
 * @typedef {EmbeddingProvider & {missingKey: UserError}} KeylessProvider
 */

/**
 * @typedef {object} EmbedderIdentity  what a store records of the provider its vectors came from
 * @property {string|null} provider
 * @property {string|null} model
 * @property {number|null} dimensions
 */

/**
 * The knowledge config and the provider it names, for a checkout's files.
 * @param {KnowledgeFiles} files
 * @returns {{cfg: Config, provider: EmbeddingProvider|null}}
 */
function loadSettings(files) {
  const cfg = config.loadConfig({ projectPath: files.config });
  return { cfg, provider: config.resolveProvider(cfg) };
}

/**
 * Whether a keyed provider is configured whose key cannot be resolved — as
 * against no provider configured, which leaves resolveProvider null too.
 * @param {Config} cfg
 */
function providerKeyUnresolved(cfg) {
  return Boolean(cfg && cfg.provider && /** @type {Record<string, string>} */ (config.PROVIDER_ENV_VARS)[cfg.provider]);
}

const KEY_UNRESOLVED_NO_STORE = 'no store is created without it.\n';

/**
 * The refusal where nothing can go on without the configured provider's key.
 * @param {Config} cfg
 * @param {string} consequence  what going without the key costs, one line ending in a newline
 */
function keyUnresolvedError(cfg, consequence) {
  const envVar = /** @type {Record<string, string>} */ (config.PROVIDER_ENV_VARS)[cfg.provider];
  const keySource = envVar ? `export ${envVar}=...` : 'set the provider API key';
  return new UserError(
    `Embedding provider "${cfg.provider}" is configured, but its API key could not be resolved — ` +
      consequence +
      '  Provide the key and retry:\n' +
      `    • ${keySource}            (session or CI), or\n` +
      '    • knowledge setup --key-only   (saves it to credentials.json)'
  );
}

/**
 * The one-line account of a configured provider's unresolved key, and the
 * key's two homes.
 * @param {Config} cfg
 */
function keyCause(cfg) {
  return `the ${cfg.provider} API key could not be resolved; ` +
    `export ${/** @type {Record<string, string>} */ (config.PROVIDER_ENV_VARS)[cfg.provider]}, or run knowledge setup --key-only`;
}

const NO_BUILD_CHOICE_MSG =
  'No knowledge store here, and no configuration says how to build one — no embedding provider ' +
  'is configured and keyword-only was never chosen.\n' +
  '  Run `knowledge setup` to choose, or `knowledge setup --keyword-only` for keyword-only search.';

/**
 * Whether keyword-only was chosen outright: the project config unsets the
 * provider, or a system config holds knowledge settings naming none. Asked
 * once no provider is configured at either level.
 * @param {KnowledgeFiles} files
 */
function keywordOnlyChosen(files) {
  const project = config.readConfigFile(files.config);
  if (project && project.provider === null) return true;
  return config.readConfigFile(config.systemConfigPath(), { sharedFile: true }) !== null;
}

/**
 * The embedder a store created now is built with — the provider, or null for
 * keyword-only — when this machine's config says how: a provider that
 * resolves, or keyword-only chosen outright. Anything else refuses, so no
 * path creates a store the configuration never asked for.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider|null} provider
 * @returns {EmbeddingProvider|null}
 */
function newStoreEmbedder(files, cfg, provider) {
  if (provider) return provider;
  if (cfg.provider) throw keyUnresolvedError(cfg, KEY_UNRESOLVED_NO_STORE);
  if (keywordOnlyChosen(files)) return null;
  throw new UserError(NO_BUILD_CHOICE_MSG);
}

/**
 * Whether this machine can build the store a checkout lacks — the question
 * newStoreEmbedder answers, asked without building anything.
 * @param {KnowledgeFiles} files
 */
function storeBuildable(files) {
  try {
    const { cfg, provider } = loadSettings(files);
    newStoreEmbedder(files, cfg, provider);
    return true;
  } catch {
    return false;
  }
}

/**
 * The identity a store built with `provider` records — nulls for keyword-only.
 * @param {Config} cfg @param {EmbeddingProvider|null} provider
 * @returns {EmbedderIdentity}
 */
function embedderIdentity(cfg, provider) {
  return {
    provider: provider ? cfg.provider : null,
    model: provider ? provider.model() : null,
    dimensions: provider ? provider.dimensions() : null,
  };
}

/**
 * The metadata of the store this checkout has, or null when it has none —
 * metadata left without its store describes nothing, and the store created
 * next replaces it.
 * @param {KnowledgeFiles} files
 * @returns {Metadata|null}
 */
function storeMetadata(files) {
  return fs.existsSync(files.store) && fs.existsSync(files.metadata) ? store.readMetadata(files.metadata) : null;
}

/**
 * Whether the checkout's store has lost its metadata — the partial state a
 * query refuses and setup never papers over: fresh metadata against the
 * store would hide a provider or dimensions mismatch, so rebuild is the way
 * out.
 * @param {KnowledgeFiles} files
 */
function metadataMissing(files) {
  return fs.existsSync(files.store) && !fs.existsSync(files.metadata);
}

/** @type {Array<keyof EmbedderIdentity>} */
const IDENTITY_FIELDS = ['provider', 'model', 'dimensions'];

/**
 * Whether a store's recorded embedder is the one named.
 * @param {Metadata} metadata @param {EmbedderIdentity} identity
 */
function sameEmbedder(metadata, identity) {
  return IDENTITY_FIELDS.every((field) => metadata[field] === identity[field]);
}

/**
 * Refuse to write vectors from an embedder the store no longer records — a
 * concurrent rebuild can change its provider, model or width between the
 * embedding and the lock. Checked under the lock.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider|null} embedder
 */
function assertStoreEmbedder(files, cfg, embedder) {
  const metadata = storeMetadata(files);
  if (!embedder || !metadata || !metadata.provider) return;
  const produced = embedderIdentity(cfg, embedder);
  if (sameEmbedder(metadata, produced)) return;
  throw new Error(
    "The store's embedder changed during index (concurrent rebuild). " +
      `Embeddings produced by ${embedderName(produced)}, store now built with ${embedderName(metadata)}.`
  );
}

/**
 * What keeps the configured provider from embedding into the store, or null
 * when nothing does — a keyword-only store takes any provider, or none, and
 * a store built with a provider takes its own alone. `key`: a keyed provider
 * is configured whose key cannot be resolved; `dropped`: the config names no
 * provider; `mismatch`: another provider, model or dimensions.
 * @param {Metadata} metadata @param {Config} cfg @param {EmbeddingProvider|null} provider
 * @returns {'key'|'dropped'|'mismatch'|null}
 */
function providerConflict(metadata, cfg, provider) {
  if (!metadata.provider) return null;
  if (!provider) return providerKeyUnresolved(cfg) ? 'key' : 'dropped';
  return sameEmbedder(metadata, embedderIdentity(cfg, provider)) ? null : 'mismatch';
}

const REBUILD_MISMATCH_MSG =
  'Provider/model changed since last index. Run `knowledge rebuild` to reindex.\n';

/**
 * Why an index refuses the store it would write into, by conflict — each
 * naming its fix. A key that does not resolve is no refusal (see
 * keylessProvider).
 * @type {Record<'dropped'|'mismatch', (metadata: Metadata, cfg: Config, provider: EmbeddingProvider|null) => Error>}
 */
const CONFLICT_ERRORS = {
  dropped: (metadata) => new UserError(
    REBUILD_MISMATCH_MSG +
      `  Store was indexed with: provider=${metadata.provider}, model=${metadata.model}\n` +
      '  Current config has no provider configured.'
  ),
  mismatch: (metadata, cfg, provider) => {
    const configured = embedderIdentity(cfg, provider);
    return new UserError(
      REBUILD_MISMATCH_MSG +
        `  Store: provider=${metadata.provider}, model=${metadata.model}, dimensions=${metadata.dimensions}\n` +
        `  Config: provider=${configured.provider}, model=${configured.model}, dimensions=${configured.dimensions}`
    );
  },
};

/**
 * The store's own provider while its key cannot be resolved: every embed
 * fails with `missingKey`, naming the key's fix — so an index writes its
 * chunks by keyword and their vectors wait for a start with the key.
 * @param {Metadata} metadata @param {Config} cfg
 * @returns {KeylessProvider}
 */
function keylessProvider(metadata, cfg) {
  const missingKey = new UserError(keyCause(cfg));
  return {
    model: () => /** @type {string} */ (metadata.model),
    dimensions: () => /** @type {number} */ (metadata.dimensions),
    embedBatch: async () => {
      throw missingKey;
    },
    missingKey,
  };
}

/**
 * The provider new documents are embedded with — null when they go in
 * keyword-only. Over a store built with a provider: that provider, or its
 * keyless stand-in while its key cannot be resolved. Over a keyword-only
 * store: whichever the config names, recorded at the next write. Without a
 * store: the one a store created now is built with. Throws on any other
 * conflict with the store's own, and where no store may be created.
 * @param {KnowledgeFiles} files @param {Config} cfg @param {EmbeddingProvider|null} provider
 * @returns {EmbeddingProvider|KeylessProvider|null}
 */
function indexProvider(files, cfg, provider) {
  const metadata = storeMetadata(files);
  if (!metadata) return newStoreEmbedder(files, cfg, provider);
  const conflict = providerConflict(metadata, cfg, provider);
  if (conflict === 'key') return keylessProvider(metadata, cfg);
  if (conflict) throw CONFLICT_ERRORS[conflict](metadata, cfg, provider);
  return provider;
}

/**
 * Whether an embedder can embed at all — a keyless stand-in cannot.
 * @param {EmbeddingProvider|KeylessProvider|null} embedder
 * @returns {embedder is EmbeddingProvider}
 */
function canEmbed(embedder) {
  return embedder !== null && !('missingKey' in embedder);
}

// ---------------------------------------------------------------------------
// Why a search runs keyword-only
// ---------------------------------------------------------------------------

const CHOSEN_KEYWORD_ONLY = 'configure embedding provider for semantic search';
const NO_VECTORS_YET = 'the store has no vectors yet; the next start embeds them';

/**
 * A store's embedder named, as a note words it.
 * @param {EmbedderIdentity} identity
 */
function embedderName({ provider, model, dimensions }) {
  return `${provider} (${model}, ${dimensions} dimensions)`;
}

/**
 * Why a query runs keyword-only, by conflict (see providerConflict).
 * @type {Record<'key'|'dropped'|'mismatch', (metadata: Metadata, cfg: Config, provider: EmbeddingProvider|null) => string>}
 */
const CONFLICT_CAUSES = {
  key: (_metadata, cfg) => keyCause(cfg),
  dropped: (metadata) =>
    `the store was embedded with ${embedderName(metadata)} and the config names no provider; ` +
    'restore it in the config, or run knowledge rebuild',
  mismatch: (metadata, cfg, provider) =>
    `the store was embedded with ${embedderName(metadata)} and the config names ` +
    `${embedderName(embedderIdentity(cfg, provider))}; run knowledge rebuild`,
};

/**
 * Why a query over the store runs keyword-only, and its fix — null when it
 * embeds its framings. A store built with a provider takes its own alone; a
 * keyword-only store has no vector to compare one with.
 * @param {Metadata} metadata @param {Config} cfg @param {EmbeddingProvider|null} provider
 * @returns {string|null}
 */
function keywordOnlyCause(metadata, cfg, provider) {
  const conflict = providerConflict(metadata, cfg, provider);
  if (conflict) return CONFLICT_CAUSES[conflict](metadata, cfg, provider);
  if (metadata.provider) return null;
  if (provider) return NO_VECTORS_YET;
  return providerKeyUnresolved(cfg) ? keyCause(cfg) : CHOSEN_KEYWORD_ONLY;
}

module.exports = {
  loadSettings,
  keyUnresolvedError,
  keyCause,
  newStoreEmbedder,
  storeBuildable,
  embedderIdentity,
  storeMetadata,
  metadataMissing,
  assertStoreEmbedder,
  indexProvider,
  canEmbed,
  keywordOnlyCause,
};
