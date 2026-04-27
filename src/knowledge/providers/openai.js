// OpenAI embedding provider — production embedding via the /v1/embeddings API.
//
// Uses Node's built-in fetch (Node 18+). Node 18 emits an
// ExperimentalWarning to stderr for fetch — cosmetic, not functional.
//
// This provider throws on ALL failures. It does NOT retry internally.
// The operation-level retry wrapper (Task 4-4) is the single source of
// retry logic. This avoids retry compounding.

'use strict';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
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

class OpenAIProvider {
  /**
   * @param {{ apiKey: string, model?: string, dimensions?: number }} options
   */
  constructor(options) {
    if (!options || !options.apiKey) {
      throw new Error('OpenAIProvider: apiKey is required');
    }
    this._apiKey = options.apiKey;
    this._model = options.model || DEFAULT_MODEL;
    this._dimensions = typeof options.dimensions === 'number'
      ? options.dimensions
      : DEFAULT_DIMENSIONS;
  }

  /**
   * Embed a single text string.
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embed(text) {
    const body = JSON.stringify({
      model: this._model,
      input: typeof text === 'string' ? text : String(text == null ? '' : text),
      dimensions: this._dimensions,
    });

    const res = await this._fetch(body);
    if (!res.data || res.data.length === 0) {
      throw new Error('OpenAI embed returned no data (empty response)');
    }
    return res.data[0].embedding;
  }

  /**
   * Embed a batch of text strings. OpenAI natively accepts arrays.
   * Chunks into multiple requests if the array exceeds 2048 items.
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts) {
    if (!Array.isArray(texts)) {
      throw new Error('OpenAIProvider.embedBatch: texts must be an array');
    }
    if (texts.length === 0) return [];

    if (texts.length <= MAX_BATCH_SIZE) {
      const body = JSON.stringify({ model: this._model, input: texts, dimensions: this._dimensions });
      const res = await this._fetch(body);
      // Validate response length — a short response silently propagates
      // undefined embeddings into Orama and degrades chunks to keyword-only
      // with no warning. Rare (OpenAI usually 400s on empty input) but
      // cheap to guard.
      if (!Array.isArray(res.data) || res.data.length !== texts.length) {
        throw new Error(
          `OpenAI embedBatch response length mismatch: requested ${texts.length}, received ${res.data ? res.data.length : 0}`
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
      const body = JSON.stringify({ model: this._model, input: slice, dimensions: this._dimensions });
      const res = await this._fetch(body);
      if (!Array.isArray(res.data) || res.data.length !== slice.length) {
        throw new Error(
          `OpenAI embedBatch response length mismatch on chunk offset=${offset}: requested ${slice.length}, received ${res.data ? res.data.length : 0}`
        );
      }
      const sorted = [...res.data].sort((a, b) => a.index - b.index);
      for (let i = 0; i < sorted.length; i++) {
        results[offset + i] = sorted[i].embedding;
      }
    }
    return results;
  }

  dimensions() {
    return this._dimensions;
  }

  model() {
    return this._model;
  }

  /**
   * Internal: POST to the OpenAI embeddings endpoint and parse the response.
   * Throws on any failure with a descriptive message.
   * @param {string} body JSON-encoded request body
   * @returns {Promise<object>} parsed response JSON
   */
  async _fetch(body) {
    let res;
    try {
      res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (err) {
      throw new Error(`OpenAI embedding request failed (network error): ${err.message}`);
    }

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (_) {
        // ignore body read failures
      }

      if (res.status === 401) {
        throw new AuthError(
          'OpenAI API key is invalid or expired. Run `knowledge setup` to fix.'
        );
      }
      if (res.status === 403) {
        throw new AuthError(
          `OpenAI API key lacks permission for this request (HTTP 403). Run \`knowledge setup\` to fix. ${detail}`
        );
      }
      if (res.status === 429) {
        throw new Error(
          `OpenAI rate limit exceeded (HTTP 429). ${detail}`
        );
      }
      throw new Error(
        `OpenAI embedding request failed (HTTP ${res.status}): ${detail}`
      );
    }

    let json;
    try {
      json = await res.json();
    } catch (err) {
      throw new Error(`OpenAI embedding response parse error: ${err.message}`);
    }

    return json;
  }
}

module.exports = {
  OpenAIProvider,
  AuthError,
  DEFAULT_MODEL,
  DEFAULT_DIMENSIONS,
  MAX_BATCH_SIZE,
  OPENAI_EMBEDDINGS_URL,
};
