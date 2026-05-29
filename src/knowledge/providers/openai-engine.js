// OpenAI embeddings engine — shared wire logic for the /v1/embeddings API.
//
// This is the INNER engine. It holds the domain logic (request shaping,
// response-length validation, batch chunking, error mapping) that is
// identical across the public OpenAI cloud entry and any OpenAI-compatible
// local endpoint (LM Studio, Ollama's OpenAI shim, vLLM, LiteLLM, ...).
//
// Outer drivers (OpenAIProvider, OpenAICompatibleProvider) own their config
// and variations and wrap one engine instance — composition, not
// inheritance. The three real forks are captured by the policy object:
//
//   sendDimensionsParam — OpenAI's text-embedding-3-* accept a `dimensions`
//     request param; most local models ignore or reject it. Omitted from the
//     body when false. Response-length validation stays either way (doubles
//     as a "config dims ≠ model native dims" check).
//   apiKey — cloud requires a key (Authorization always sent); compat key is
//     optional (header omitted when absent/empty).
//   errorContext — drives error message text and remedy hints, so a local
//     401 doesn't suggest platform.openai.com and ECONNREFUSED reads as
//     "server not running".
//
// Uses Node's built-in fetch (Node 18+) — keeps existing test mocks of
// globalThis.fetch working. Throws on ALL failures; never retries internally
// (the operation-level retry wrapper is the single source of retry logic).

'use strict';

const MAX_BATCH_SIZE = 2048;

// AuthError — marker class for HTTP 401/403 from the embeddings API.
// Bad/expired keys do not fix themselves between retries, so withRetry
// short-circuits this class instead of burning the backoff budget.
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

class OpenAIEmbeddingsEngine {
  /**
   * @param {{
   *   baseUrl: string,
   *   apiKey?: string|null,
   *   model: string,
   *   dimensions: number,
   *   sendDimensionsParam: boolean,
   *   errorContext: {
   *     label: string,
   *     authHint: string,
   *     permissionHint: string,
   *   },
   * }} policy
   */
  constructor(policy) {
    if (!policy || typeof policy !== 'object') {
      throw new Error('OpenAIEmbeddingsEngine: policy is required');
    }
    if (!policy.baseUrl) {
      throw new Error('OpenAIEmbeddingsEngine: policy.baseUrl is required');
    }
    this._baseUrl = policy.baseUrl;
    this._apiKey = policy.apiKey || null;
    this._model = policy.model;
    this._dimensions = policy.dimensions;
    this._sendDimensionsParam = policy.sendDimensionsParam === true;
    this._errorContext = policy.errorContext || {};
  }

  dimensions() {
    return this._dimensions;
  }

  model() {
    return this._model;
  }

  /**
   * Build the request body, including `dimensions` only when the policy
   * allows it.
   * @param {string|string[]} input
   * @returns {string}
   */
  _body(input) {
    const payload = { model: this._model, input };
    if (this._sendDimensionsParam) {
      payload.dimensions = this._dimensions;
    }
    return JSON.stringify(payload);
  }

  /**
   * Embed a single text string.
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embed(text) {
    const input = typeof text === 'string' ? text : String(text == null ? '' : text);
    const res = await this._fetch(this._body(input));
    if (!res.data || res.data.length === 0) {
      throw new Error(`${this._errorContext.label} embed returned no data (empty response)`);
    }
    return res.data[0].embedding;
  }

  /**
   * Embed a batch of text strings. OpenAI natively accepts arrays.
   * Chunks into multiple requests if the array exceeds MAX_BATCH_SIZE.
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts) {
    if (!Array.isArray(texts)) {
      throw new Error(`${this._errorContext.label}.embedBatch: texts must be an array`);
    }
    if (texts.length === 0) return [];

    if (texts.length <= MAX_BATCH_SIZE) {
      const res = await this._fetch(this._body(texts));
      // Validate response length — a short response silently propagates
      // undefined embeddings into Orama and degrades chunks to keyword-only
      // with no warning. Also doubles as a "config dims ≠ model native dims"
      // sanity check for compatible endpoints.
      if (!Array.isArray(res.data) || res.data.length !== texts.length) {
        throw new Error(
          `${this._errorContext.label} embedBatch response length mismatch: requested ${texts.length}, received ${res.data ? res.data.length : 0}`
        );
      }
      // OpenAI returns data sorted by index — ensure correct order.
      const sorted = [...res.data].sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    }

    // Chunk into batches of MAX_BATCH_SIZE.
    const results = new Array(texts.length);
    for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
      const slice = texts.slice(offset, offset + MAX_BATCH_SIZE);
      const res = await this._fetch(this._body(slice));
      if (!Array.isArray(res.data) || res.data.length !== slice.length) {
        throw new Error(
          `${this._errorContext.label} embedBatch response length mismatch on chunk offset=${offset}: requested ${slice.length}, received ${res.data ? res.data.length : 0}`
        );
      }
      const sorted = [...res.data].sort((a, b) => a.index - b.index);
      for (let i = 0; i < sorted.length; i++) {
        results[offset + i] = sorted[i].embedding;
      }
    }
    return results;
  }

  /**
   * Build the embeddings endpoint URL from the policy base URL, normalising
   * a trailing slash so `http://host/v1` and `http://host/v1/` both work.
   * @returns {string}
   */
  _endpoint() {
    return `${this._baseUrl.replace(/\/+$/, '')}/embeddings`;
  }

  /**
   * Internal: POST to the embeddings endpoint and parse the response.
   * Throws on any failure with a descriptive message built from the policy
   * error context.
   * @param {string} body JSON-encoded request body
   * @returns {Promise<object>} parsed response JSON
   */
  async _fetch(body) {
    const ctx = this._errorContext;
    const headers = { 'Content-Type': 'application/json' };
    // Send Authorization only when a key is present — local servers omit it.
    if (this._apiKey) {
      headers['Authorization'] = `Bearer ${this._apiKey}`;
    }

    let res;
    try {
      res = await fetch(this._endpoint(), { method: 'POST', headers, body });
    } catch (err) {
      // Node's fetch (undici) reports low-level failures as a generic
      // "fetch failed" message and stashes the real errno (ECONNREFUSED,
      // ENOTFOUND, ETIMEDOUT, ...) on err.cause. Surface it so the setup
      // error-describer can map a refused connection to the right remedy.
      const cause = err && err.cause ? (err.cause.code || err.cause.message) : '';
      const detail = cause ? `${err.message} (${cause})` : err.message;
      throw new Error(`${ctx.label} embedding request failed (network error): ${detail}`);
    }

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (_) {
        // ignore body read failures
      }

      if (res.status === 401) {
        throw new AuthError(`${ctx.label} request was rejected (HTTP 401). ${ctx.authHint}`.trim());
      }
      if (res.status === 403) {
        throw new AuthError(`${ctx.label} request lacks permission (HTTP 403). ${ctx.permissionHint} ${detail}`.trim());
      }
      if (res.status === 429) {
        throw new Error(`${ctx.label} rate limit exceeded (HTTP 429). ${detail}`.trim());
      }
      throw new Error(`${ctx.label} embedding request failed (HTTP ${res.status}): ${detail}`);
    }

    let json;
    try {
      json = await res.json();
    } catch (err) {
      throw new Error(`${ctx.label} embedding response parse error: ${err.message}`);
    }

    return json;
  }
}

module.exports = {
  OpenAIEmbeddingsEngine,
  AuthError,
  MAX_BATCH_SIZE,
};
