'use strict';

// ---------------------------------------------------------------------------
// Kernel: failures by whether repeating the operation could change them, and
// the operation-level retry for the ones it could — the embedding provider's
// transient failures.
// ---------------------------------------------------------------------------

const { AuthError, InvalidRequestError, ConfigError, QuotaError, RateLimitError } = require('./providers/openai-engine.cjs');

/** A failure whose message is advice for the user — a bad path, a refused configuration. */
class UserError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

// Failures that repeat identically on every attempt: input validation, a
// provider refusing the key or the request, an account out of quota, a
// provider configuration the model contradicts, and programming errors.
const PERMANENT_ERRORS = [
  UserError,
  AuthError,
  InvalidRequestError,
  QuotaError,
  ConfigError,
  TypeError,
  ReferenceError,
  SyntaxError,
  RangeError,
];

/** @param {unknown} err */
function isPermanentError(err) {
  return PERMANENT_ERRORS.some((type) => err instanceof type);
}

/**
 * Whether repeating the whole operation could change a failure's outcome —
 * never for a permanent failure, nor for a rate limit, which the provider
 * waits on request by request as far as its budget allows.
 * @param {unknown} err
 */
function isRetryable(err) {
  return !isPermanentError(err) && !(err instanceof RateLimitError);
}

const DEFAULT_RETRY_BACKOFF = [1000, 2000, 4000];

/**
 * @typedef {object} RetryPolicy
 * @property {number} [maxAttempts]
 * @property {number[]} [backoff]  the wait before each retry, the last repeating
 */

/** @type {Required<RetryPolicy>} */
const RETRY = { maxAttempts: 3, backoff: DEFAULT_RETRY_BACKOFF };

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with backoff while its failure is retryable.
 * @template T
 * @param {() => Promise<T>} fn @param {RetryPolicy} [policy]
 * @returns {Promise<T>}
 */
async function withRetry(fn, policy = {}) {
  const maxAttempts = policy.maxAttempts || RETRY.maxAttempts;
  const backoff = policy.backoff || DEFAULT_RETRY_BACKOFF;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err)) throw err;
      lastErr = err;
      if (attempt < maxAttempts - 1) await sleep(backoff[attempt] || backoff[backoff.length - 1]);
    }
  }
  throw lastErr;
}

module.exports = { UserError, isPermanentError, withRetry, RETRY, DEFAULT_RETRY_BACKOFF };
