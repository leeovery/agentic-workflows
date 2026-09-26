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
// globalThis.fetch working. Throws on every failure but a rate limit, which it
// waits out request by request: the operation-level retry wrapper repeats a
// whole job, re-sending every request already answered.

'use strict';

const MAX_BATCH_SIZE = 2048;

// OpenAI refuses a request whose inputs sum past 300,000 tokens; at the
// densest likely tokenisation, about 2 characters a token, this stays under.
const MAX_BATCH_CHARS = 400000;

// A request the endpoint never answers must not hang the caller — the bulk
// index runs at every start.
const REQUEST_TIMEOUT_MS = 60000;

// HTTP statuses where the endpoint refused the request itself — an input
// over the model's limit, a malformed body.
const INVALID_REQUEST_STATUSES = new Set([400, 413, 422]);

// A rate-limited request is retried after the wait the endpoint names, or
// after these when it names none, each wait capped at a minute.
const RATE_LIMIT_WAITS_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_RATE_LIMIT_WAIT_MS = 60000;

// AuthError — marker class for HTTP 401/403 from the embeddings API.
// Bad/expired keys do not fix themselves between retries, so withRetry
// short-circuits this class instead of burning the backoff budget.
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

// InvalidRequestError — marker class for HTTP 400/413/422 from the
// embeddings API. The same request is refused the same way on every retry.
class InvalidRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

// ConfigError — marker class for a provider configuration the model
// contradicts (a vector of another width than the configured dimensions).
// Only a config change fixes it, never a retry.
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

// RateLimitError — HTTP 429 from a saturated rate limit, carrying the wait the
// endpoint named (null when it named none). Thrown out of the engine only once
// its own retries are spent.
class RateLimitError extends Error {
  /** @param {string} message @param {number|null} retryAfterMs */
  constructor(message, retryAfterMs) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
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
   *   timeoutMs?: number,
   *   sleep?: (ms: number) => Promise<void>,
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
    this._timeoutMs = policy.timeoutMs || REQUEST_TIMEOUT_MS;
    this._sleep = policy.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this._errorContext = policy.errorContext || {};
  }

  dimensions() {
    return this._dimensions;
  }

  model() {
    return this._model;
  }

  /**
   * Validate a returned embedding is a numeric vector of the CONFIGURED width.
   * The response-length checks in embedBatch only count vectors, not their
   * width — a model whose native output differs from the configured
   * `dimensions` returns the right COUNT of wrong-WIDTH vectors, which then
   * surfaces as a raw Orama insert error mid-index (or, for embed(), silently
   * stores a mis-sized vector). Catch it here with a clean provider-level
   * error naming the mismatch. Skipped only when dimensions is not a positive
   * integer (nothing to validate against).
   * @param {*} vec
   * @param {string} [where] contextual suffix, e.g. "at index 3"
   */
  _assertVectorWidth(vec, where) {
    if (!Number.isInteger(this._dimensions) || this._dimensions <= 0) return;
    if (!Array.isArray(vec) || vec.length !== this._dimensions) {
      const got = Array.isArray(vec) ? `width ${vec.length}` : `a non-array (${typeof vec})`;
      throw new ConfigError(
        `${this._errorContext.label} returned ${got}${where ? ' ' + where : ''}, ` +
          `expected width ${this._dimensions}. The configured \`dimensions\` does not match ` +
          "the model's native output — set dimensions to the model's real width and rebuild."
      );
    }
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
    const vec = res.data[0].embedding;
    this._assertVectorWidth(vec);
    return vec;
  }

  /**
   * Embed a batch of text strings, one request per batch that fits both
   * MAX_BATCH_SIZE inputs and MAX_BATCH_CHARS characters. Vectors come back
   * in input order.
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts) {
    if (!Array.isArray(texts)) {
      throw new Error(`${this._errorContext.label}.embedBatch: texts must be an array`);
    }

    const results = [];
    for (const batch of requestBatches(texts)) {
      const res = await this._fetch(this._body(batch.texts));
      // Validate response length — a short response silently propagates
      // undefined embeddings into Orama and degrades chunks to keyword-only
      // with no warning. Also doubles as a "config dims ≠ model native dims"
      // sanity check for compatible endpoints.
      if (!Array.isArray(res.data) || res.data.length !== batch.texts.length) {
        throw new Error(
          `${this._errorContext.label} embedBatch response length mismatch at offset ${batch.offset}: requested ${batch.texts.length}, received ${res.data ? res.data.length : 0}`
        );
      }
      // OpenAI returns data sorted by index — ensure correct order.
      const sorted = [...res.data].sort((a, b) => a.index - b.index);
      sorted.forEach((d, i) => {
        this._assertVectorWidth(d.embedding, `at index ${batch.offset + i}`);
        results.push(d.embedding);
      });
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
   * Internal: one request, retried while it is rate-limited — after the wait
   * the endpoint names, else the next of RATE_LIMIT_WAITS_MS, each capped at
   * MAX_RATE_LIMIT_WAIT_MS. The RateLimitError propagates once they are spent.
   * @param {string} body JSON-encoded request body
   * @returns {Promise<object>} parsed response JSON
   */
  async _fetch(body) {
    for (let retry = 0; ; retry++) {
      try {
        return await this._request(body);
      } catch (err) {
        if (!(err instanceof RateLimitError) || retry === RATE_LIMIT_WAITS_MS.length) throw err;
        await this._sleep(Math.min(err.retryAfterMs ?? RATE_LIMIT_WAITS_MS[retry], MAX_RATE_LIMIT_WAIT_MS));
      }
    }
  }

  /**
   * Internal: POST to the embeddings endpoint and parse the response.
   * Throws on any failure with a descriptive message built from the policy
   * error context.
   * @param {string} body JSON-encoded request body
   * @returns {Promise<object>} parsed response JSON
   */
  async _request(body) {
    const ctx = this._errorContext;
    const headers = { 'Content-Type': 'application/json' };
    // Send Authorization only when a key is present — local servers omit it.
    if (this._apiKey) {
      headers['Authorization'] = `Bearer ${this._apiKey}`;
    }

    let res;
    try {
      res = await fetch(this._endpoint(), {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(this._timeoutMs),
      });
    } catch (err) {
      if (err && err.name === 'TimeoutError') {
        throw new Error(
          `${ctx.label} embedding request timed out after ${this._timeoutMs / 1000}s (network error): the endpoint did not answer`
        );
      }
      // Node's fetch (undici) reports low-level failures as a generic
      // "fetch failed" message and stashes the real errno (ECONNREFUSED,
      // ENOTFOUND, ETIMEDOUT, ...) on err.cause. Surface it so the setup
      // error-describer can map a refused connection to the right remedy.
      const cause = err && err.cause ? (err.cause.code || err.cause.message) : '';
      const detail = cause ? `${err.message} (${cause})` : err.message;
      throw new Error(`${ctx.label} embedding request failed (network error): ${detail}`);
    }

    if (!res.ok) {
      let text = '';
      try {
        text = await res.text();
      } catch (_) {
        // ignore body read failures
      }
      // Upstream bodies are untrusted and may reflect request headers —
      // including the Authorization bearer. Redact any credential-shaped
      // material and cap the length before it can reach an error message.
      const detail = text
        .replace(/Bearer\s+[^\s"'\\]+/gi, 'Bearer [redacted]')
        .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted-key]')
        .slice(0, 300);

      if (res.status === 401) {
        throw new AuthError(`${ctx.label} request was rejected (HTTP 401). ${ctx.authHint}`.trim());
      }
      if (res.status === 403) {
        throw new AuthError(`${ctx.label} request lacks permission (HTTP 403). ${ctx.permissionHint} ${detail}`.trim());
      }
      if (res.status === 429) {
        const limited = `${ctx.label} rate limit exceeded (HTTP 429). ${detail}`.trim();
        // An account out of quota answers 429 too, and no wait restores it.
        if (quotaExhausted(text)) throw new Error(limited);
        throw new RateLimitError(limited, namedWait(res.headers, text));
      }
      const failed = `${ctx.label} embedding request failed (HTTP ${res.status}): ${detail}`;
      throw INVALID_REQUEST_STATUSES.has(res.status) ? new InvalidRequestError(failed) : new Error(failed);
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

/**
 * Whether a 429 body says the account is out of quota.
 * @param {string} text
 */
function quotaExhausted(text) {
  try {
    const { error } = JSON.parse(text);
    return Boolean(error) && (error.code === 'insufficient_quota' || error.type === 'insufficient_quota');
  } catch (_) {
    return false;
  }
}

/**
 * The wait a 429 names, in whole milliseconds — the `retry-after-ms` header,
 * else `retry-after` in seconds, else the message's "try again in 6.007s" —
 * or null when it names none.
 * @param {Headers} headers @param {string} text
 * @returns {number|null}
 */
function namedWait(headers, text) {
  const header = (/** @type {string} */ name) => {
    const value = headers.get(name);
    return value === null || value.trim() === '' ? NaN : Number(value);
  };
  const ms = header('retry-after-ms');
  if (ms >= 0) return Math.ceil(ms);
  const seconds = header('retry-after');
  if (seconds >= 0) return Math.ceil(seconds * 1000);
  const said = /try again in (\d+(?:\.\d+)?)(ms|s)\b/i.exec(text);
  if (said) return Math.ceil(Number(said[1]) * (said[2].toLowerCase() === 'ms' ? 1 : 1000));
  return null;
}

/**
 * Split inputs into consecutive request batches: a batch closes when the next
 * input would take it past MAX_BATCH_SIZE inputs or MAX_BATCH_CHARS
 * characters. An input over the character budget on its own still gets a
 * batch of its own.
 * @param {string[]} texts
 * @returns {Array<{offset: number, texts: string[]}>}
 */
function requestBatches(texts) {
  const batches = [];
  let current = null;
  let chars = 0;
  texts.forEach((text, i) => {
    const fits = current !== null &&
      current.texts.length < MAX_BATCH_SIZE &&
      chars + text.length <= MAX_BATCH_CHARS;
    if (!fits) {
      current = { offset: i, texts: [] };
      batches.push(current);
      chars = 0;
    }
    current.texts.push(text);
    chars += text.length;
  });
  return batches;
}

module.exports = {
  OpenAIEmbeddingsEngine,
  AuthError,
  InvalidRequestError,
  ConfigError,
  RateLimitError,
  MAX_BATCH_SIZE,
  MAX_BATCH_CHARS,
  REQUEST_TIMEOUT_MS,
  RATE_LIMIT_WAITS_MS,
  MAX_RATE_LIMIT_WAIT_MS,
};
