'use strict';

// Loaded by --require ahead of the engine's entry, so every provider
// `engine knowledge` resolves embeds through the cache its environment names.

const config = require('../../skills/workflow-engine/scripts/kernel/knowledge/config.cjs');
const { DIR_ENV, cachingProvider, embeddingCache, providerIdentity } = require('./knowledge-eval-embeddings.cjs');

const dir = /** @type {string} */ (process.env[DIR_ENV]);
const resolveProvider = config.resolveProvider;

config.resolveProvider = (cfg, patience) => {
  const provider = resolveProvider(cfg, patience);
  return provider && cachingProvider(provider, embeddingCache(dir, providerIdentity(cfg, provider)));
};
