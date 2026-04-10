// Embedding provider interface and StubProvider implementation.
//
// KnowledgeProvider interface contract — every concrete provider must
// implement all four members:
//
//   embed(text)         -> number[]   vector of length dimensions()
//   embedBatch(texts)   -> number[][] one vector per input, in order
//   dimensions()        -> number     vector dimensionality
//   model()             -> string     stable, non-empty model identifier
//
// Providers MUST never return null/undefined from embed/embedBatch. Orama
// crashes when a vector field is null. Production keyword-only mode
// (design doc "stub mode") is a DIFFERENT concept, triggered by the
// absence of any configured provider — it is handled at the calling
// layer by omitting the vector field from documents, and is NOT a
// provider implementation.
//
// StubProvider below is a first-class provider used in tests only. It
// returns deterministic fake vectors derived from a hash of the input
// text. Same text in, same vector out. Different text in, different
// vectors out. Never null. Never an API call.

'use strict';

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
