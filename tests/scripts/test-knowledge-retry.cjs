'use strict';

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  withRetry,
  isPermanentError,
  UserError,
  AuthError,
  InvalidRequestError,
  QuotaError,
  ConfigError,
} = require('../../src/knowledge/index');
const { RateLimitError } = require('../../src/knowledge/providers/openai-engine');

describe('withRetry', () => {
  it('succeeds on first attempt', async () => {
    let calls = 0;
    const result = await withRetry(async () => { calls++; return 'ok'; }, { backoff: [1, 1, 1] });
    assert.strictEqual(result, 'ok');
    assert.strictEqual(calls, 1);
  });

  it('succeeds on second attempt if first fails', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
      return 'ok';
    }, { maxAttempts: 3, backoff: [1, 1, 1] });
    assert.strictEqual(result, 'ok');
    assert.strictEqual(calls, 2);
  });

  it('throws after maxAttempts failures', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new Error('fail'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      /fail/
    );
    assert.strictEqual(calls, 3);
  });

  it('retries up to 3 times with backoff', async () => {
    const timestamps = [];
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => {
        calls++;
        timestamps.push(Date.now());
        throw new Error('fail');
      }, { maxAttempts: 3, backoff: [10, 20, 40] }),
      /fail/
    );
    assert.strictEqual(calls, 3);
    // Verify delays are at least approximately right (> 5ms each).
    if (timestamps.length >= 2) {
      assert.ok(timestamps[1] - timestamps[0] >= 5, 'first backoff delay');
    }
    if (timestamps.length >= 3) {
      assert.ok(timestamps[2] - timestamps[1] >= 10, 'second backoff delay');
    }
  });

  it('does not compound retry attempts (exactly maxAttempts max)', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new Error('fail'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      /fail/
    );
    assert.strictEqual(calls, 3, 'exactly 3 attempts, not 9 (no compounding)');
  });

  it('does not repeat an operation after a rate limit the provider already waited out', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new RateLimitError('rate limit exceeded (HTTP 429)', null); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      RateLimitError
    );
    assert.strictEqual(calls, 1);
  });

  it('uses defaults when opts are minimal', async () => {
    let calls = 0;
    const result = await withRetry(async () => { calls++; return 42; });
    assert.strictEqual(result, 42);
    assert.strictEqual(calls, 1);
  });

  // Permanent-failure short-circuit: programming errors and UserError surface
  // immediately on the first attempt rather than burning the retry budget.
  // Each test asserts exactly one call (no retries) and that the original
  // error class survives.

  it('does not retry TypeError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new TypeError('typo'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof TypeError && /typo/.test(err.message)
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry ReferenceError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new ReferenceError('missing'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof ReferenceError
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry SyntaxError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new SyntaxError('bad'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof SyntaxError
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry RangeError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new RangeError('out'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof RangeError
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry UserError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new UserError('bad input'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof UserError && /bad input/.test(err.message)
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry AuthError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new AuthError('bad key'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof AuthError && /bad key/.test(err.message)
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry InvalidRequestError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new InvalidRequestError('HTTP 400'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof InvalidRequestError
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry QuotaError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new QuotaError('out of quota (HTTP 429)'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof QuotaError
    );
    assert.strictEqual(calls, 1);
  });

  it('does not retry ConfigError', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(async () => { calls++; throw new ConfigError('expected width 2'); }, { maxAttempts: 3, backoff: [1, 1, 1] }),
      (err) => err instanceof ConfigError
    );
    assert.strictEqual(calls, 1);
  });
});

describe('isPermanentError', () => {
  it('reads validation, key, request, quota, config, and programming errors as permanent', () => {
    for (const err of [
      new UserError('bad input'),
      new AuthError('bad key'),
      new InvalidRequestError('HTTP 413'),
      new QuotaError('out of quota (HTTP 429)'),
      new ConfigError('expected width 2'),
      new TypeError('typo'),
      new ReferenceError('missing'),
      new SyntaxError('bad'),
      new RangeError('out'),
    ]) {
      assert.strictEqual(isPermanentError(err), true, err.name);
    }
  });

  it('reads a plain Error — a server error, a network failure — as transient', () => {
    for (const message of ['embedding request failed (HTTP 503)', 'network error: ECONNRESET']) {
      assert.strictEqual(isPermanentError(new Error(message)), false, message);
    }
    assert.strictEqual(isPermanentError(undefined), false);
  });
});
