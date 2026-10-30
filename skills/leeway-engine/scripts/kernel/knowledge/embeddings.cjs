'use strict';

// ---------------------------------------------------------------------------
// Kernel: the embedding provider interface, and StubProvider — a first-class
// provider for tests alone: deterministic vectors from a hash of the text,
// same text same vector, never null, never a request.
// ---------------------------------------------------------------------------

/**
 * @typedef {object} EmbeddingProvider  what every provider implements. It
 *   never answers null or undefined for a text: the store refuses a null
 *   vector, and keeps a chunk given undefined without one.
 * @property {(text: string) => number[]|Promise<number[]>} [embed]  one text's vector
 * @property {(texts: string[]) => number[][]|Promise<number[][]>} embedBatch  one vector per text, in order
 * @property {() => number} dimensions  the vectors' width
 * @property {() => string} model  a stable, non-empty model identifier
 */

const DEFAULT_DIMENSIONS = 128;
const STUB_MODEL_ID = 'stub';

function fnv1a32(str) {
  // 32-bit FNV-1a. Fast, deterministic, and sufficient for producing
  // distinguishable fake vectors — cryptographic strength is not needed.
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  // Deterministic PRNG seeded from the input hash. Produces a stable
  // sequence of floats in [0, 1).
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class StubProvider {
  /**
   * @param {{ dimensions?: number }} [options]
   */
  constructor(options) {
    const dims = options && typeof options.dimensions === 'number'
      ? options.dimensions
      : DEFAULT_DIMENSIONS;
    if (!Number.isInteger(dims) || dims <= 0) {
      throw new Error(`StubProvider: dimensions must be a positive integer, got ${dims}`);
    }
    this._dimensions = dims;
  }

  /**
   * Deterministically produces a vector of length dimensions() for the
   * given input text. Always returns a real array — never null.
   *
   * @param {string} text
   * @returns {number[]}
   */
  embed(text) {
    const input = typeof text === 'string' ? text : String(text == null ? '' : text);
    const seed = fnv1a32(input) || 1; // avoid all-zero seed for empty string
    const rng = mulberry32(seed);
    const vec = new Array(this._dimensions);
    for (let i = 0; i < this._dimensions; i++) {
      // Map [0, 1) to [-1, 1) so vectors cover the unit interval space.
      vec[i] = rng() * 2 - 1;
    }
    return vec;
  }

  /**
   * Maps embed() over each input. No real batching — this is a test
   * provider. Returns an empty array for an empty input.
   *
   * @param {string[]} texts
   * @returns {number[][]}
   */
  embedBatch(texts) {
    if (!Array.isArray(texts)) {
      throw new Error('StubProvider.embedBatch: texts must be an array');
    }
    const out = new Array(texts.length);
    for (let i = 0; i < texts.length; i++) {
      out[i] = this.embed(texts[i]);
    }
    return out;
  }

  dimensions() {
    return this._dimensions;
  }

  model() {
    return STUB_MODEL_ID;
  }
}

module.exports = {
  StubProvider,
  STUB_MODEL_ID,
  DEFAULT_STUB_DIMENSIONS: DEFAULT_DIMENSIONS,
};
