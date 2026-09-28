'use strict';

// Loaded by --require ahead of the knowledge CLI's entry, so every provider
// the CLI resolves embeds through the cache its environment names.

const config = require('../../src/knowledge/config');
const { DIR_ENV, cachingProvider, embeddingCache, providerIdentity } = require('./knowledge-eval-embeddings.cjs');

const dir = /** @type {string} */ (process.env[DIR_ENV]);
const resolveProvider = config.resolveProvider;

config.resolveProvider = (cfg) => {
  const provider = resolveProvider(cfg);
  return provider && cachingProvider(provider, embeddingCache(dir, providerIdentity(cfg, provider)));
};
