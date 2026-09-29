'use strict';

// The `engine knowledge` the eval runs is a child process, so it reaches this
// cache through a --require preload (knowledge-eval-embeddings-preload.cjs).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Names the cache directory to a process the preload runs in. */
const DIR_ENV = 'KNOWLEDGE_EVAL_EMBEDDINGS';
const PRELOAD = path.join(__dirname, 'knowledge-eval-embeddings-preload.cjs');
const FLOAT_BYTES = 4;
const VECTOR_SUFFIX = '.f32';

/**
 * @typedef {object} ProviderIdentity  what decides the vectors a provider makes
 * @property {string} provider
 * @property {string} model
 * @property {number} dimensions
 * @property {string|null} base_url
 */

/**
 * @typedef {object} EmbeddingProvider  the engine's embedding provider interface
 * @property {() => string} model
 * @property {() => number} dimensions
 * @property {(text: string) => Promise<number[]>} embed
 * @property {(texts: string[]) => Promise<number[][]>} embedBatch
 */

/**
 * @param {Record<string, any>} cfg  the config the provider was resolved from
 * @param {EmbeddingProvider} provider
 * @returns {ProviderIdentity}
 */
function providerIdentity(cfg, provider) {
  return { provider: cfg.provider, model: provider.model(), dimensions: provider.dimensions(), base_url: cfg.base_url ?? null };
}

/** @param {string} value */
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** @param {number[]} vector */
function encode(vector) {
  const bytes = Buffer.alloc(vector.length * FLOAT_BYTES);
  vector.forEach((value, i) => bytes.writeFloatLE(value, i * FLOAT_BYTES));
  return bytes;
}

/** @param {Buffer} bytes @returns {number[]} */
function decode(bytes) {
  return Array.from({ length: bytes.length / FLOAT_BYTES }, (_, i) => bytes.readFloatLE(i * FLOAT_BYTES));
}

/**
 * One provider's vectors, cached under `dir`.
 * @param {string} dir @param {ProviderIdentity} identity
 */
function embeddingCache(dir, identity) {
  const root = path.join(dir, sha256(JSON.stringify(identity)).slice(0, 16));
  /** @param {string} text */
  const fileOf = (text) => path.join(root, `${sha256(text)}${VECTOR_SUFFIX}`);
  return {
    /**
     * The text's vector, or null when none is cached.
     * @param {string} text @returns {number[]|null}
     */
    read(text) {
      const file = fileOf(text);
      return fs.existsSync(file) ? decode(fs.readFileSync(file)) : null;
    },
    /**
     * Cache the text's vector, and answer it as a read will.
     * @param {string} text @param {number[]} vector @returns {number[]}
     */
    write(text, vector) {
      const file = fileOf(text);
      const bytes = encode(vector);
      fs.mkdirSync(root, { recursive: true });
      const staging = path.join(root, `.${path.basename(file)}.${process.pid}.tmp`);
      fs.writeFileSync(staging, bytes);
      fs.renameSync(staging, file);
      return decode(bytes);
    },
    /** How many vectors are cached. */
    size() {
      return fs.existsSync(root) ? fs.readdirSync(root).filter((name) => name.endsWith(VECTOR_SUFFIX)).length : 0;
    },
  };
}

/** @typedef {ReturnType<typeof embeddingCache>} EmbeddingCache */

/**
 * The provider, embedding through the cache: a text the cache holds is
 * answered from it, and only the texts it lacks reach the provider, once
 * each. Every vector is answered as the cache holds it, so a first run and
 * its reruns embed alike.
 * @param {EmbeddingProvider} provider @param {EmbeddingCache} cache
 * @returns {EmbeddingProvider}
 */
function cachingProvider(provider, cache) {
  /**
   * @param {string[]} texts
   * @param {(missing: string[]) => Promise<number[][]>} embedMissing
   * @returns {Promise<number[][]>}
   */
  async function vectorsOf(texts, embedMissing) {
    const vectors = new Map([...new Set(texts)].map((text) => [text, cache.read(text)]));
    const missing = [...vectors.keys()].filter((text) => vectors.get(text) === null);
    if (missing.length > 0) {
      const embedded = await embedMissing(missing);
      missing.forEach((text, i) => vectors.set(text, cache.write(text, embedded[i])));
    }
    return texts.map((text) => /** @type {number[]} */ (vectors.get(text)));
  }
  return {
    model: () => provider.model(),
    dimensions: () => provider.dimensions(),
    async embed(text) {
      const [vector] = await vectorsOf([text], async ([missing]) => [await provider.embed(missing)]);
      return vector;
    },
    embedBatch: (texts) => vectorsOf(texts, (missing) => provider.embedBatch(missing)),
  };
}

/**
 * How to start a node process whose `engine knowledge` embeds through the cache
 * under `dir`: the preload, and the environment naming the directory.
 * @param {string} dir
 */
function preloadFor(dir) {
  return { execArgv: ['--require', PRELOAD], env: { [DIR_ENV]: dir } };
}

module.exports = {
  DIR_ENV,
  providerIdentity,
  embeddingCache,
  cachingProvider,
  preloadFor,
};
