'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  OpenAIProvider,
  AuthError,
  DEFAULT_MODEL,
  DEFAULT_DIMENSIONS,
} = require('../../src/knowledge/providers/openai');
const {
  OpenAIEmbeddingsEngine,
  InvalidRequestError,
  ConfigError,
  RateLimitError,
  MAX_BATCH_SIZE,
  MAX_BATCH_CHARS,
  REQUEST_TIMEOUT_MS,
  RATE_LIMIT_WAITS_MS,
  MAX_RATE_LIMIT_WAIT_MS,
} = require('../../src/knowledge/providers/openai-engine');
const { isPermanentError } = require('../../src/knowledge/index');

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('OpenAIProvider constructor', () => {
  it('constructs with correct defaults', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    assert.strictEqual(p.model(), DEFAULT_MODEL);
    assert.strictEqual(p.dimensions(), DEFAULT_DIMENSIONS);
  });

  it('constructs with custom model and dimensions', () => {
    const p = new OpenAIProvider({
      apiKey: 'sk-test',
      model: 'text-embedding-3-large',
      dimensions: 3072,
    });
    assert.strictEqual(p.model(), 'text-embedding-3-large');
    assert.strictEqual(p.dimensions(), 3072);
  });

  it('reports correct dimensions()', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 512 });
    assert.strictEqual(p.dimensions(), 512);
  });

  it('throws when apiKey is missing', () => {
    assert.throws(() => new OpenAIProvider({}), /apiKey is required/);
    assert.throws(() => new OpenAIProvider(), /apiKey is required/);
  });
});

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(responseBody) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => responseBody,
  });
}

function mockFetchError(status, body) {
  return async () => ({
    ok: false,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

function mockFetchNetworkError(message) {
  return async () => { throw new Error(message); };
}

// ---------------------------------------------------------------------------
// embed (mocked fetch)
// ---------------------------------------------------------------------------

describe('OpenAIProvider embed (mocked)', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('parses a successful embed response correctly', async () => {
    const fakeVector = [0.1, 0.2, 0.3];
    globalThis.fetch = mockFetchSuccess({
      data: [{ index: 0, embedding: fakeVector }],
    });

    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 3 });
    const result = await p.embed('hello');
    assert.deepStrictEqual(result, fakeVector);
  });

  it('throws AuthError on 401 with descriptive message and recovery hint', async () => {
    globalThis.fetch = mockFetchError(401, 'Unauthorized');
    const p = new OpenAIProvider({ apiKey: 'sk-bad' });

    await assert.rejects(
      () => p.embed('hello'),
      (err) =>
        err instanceof AuthError &&
        /invalid or expired/.test(err.message) &&
        /knowledge setup/.test(err.message)
    );
  });

  it('throws AuthError on 403 with recovery hint', async () => {
    globalThis.fetch = mockFetchError(403, 'Forbidden');
    const p = new OpenAIProvider({ apiKey: 'sk-test' });

    await assert.rejects(
      () => p.embed('hello'),
      (err) =>
        err instanceof AuthError && /403/.test(err.message) && /knowledge setup/.test(err.message)
    );
  });

  for (const status of [400, 413, 422]) {
    it(`throws InvalidRequestError on ${status} — the request itself is refused`, async () => {
      globalThis.fetch = mockFetchError(status, 'input too long');
      const p = new OpenAIProvider({ apiKey: 'sk-test' });

      await assert.rejects(
        () => p.embedBatch(['hello']),
        (err) =>
          err instanceof InvalidRequestError &&
          err.name === 'InvalidRequestError' &&
          new RegExp(`embedding request failed \\(HTTP ${status}\\): input too long`).test(err.message)
      );
    });
  }

  for (const status of [500, 503]) {
    it(`throws a plain Error on ${status} — a transient failure a retry may clear`, async () => {
      globalThis.fetch = mockFetchError(status, 'try again');
      const p = new OpenAIProvider({ apiKey: 'sk-test' });

      await assert.rejects(
        () => p.embed('hello'),
        (err) => err.constructor === Error && new RegExp(String(status)).test(err.message)
      );
    });
  }

  it('bounds every request with a 60-second timeout signal', async () => {
    let signal;
    globalThis.fetch = async (_url, init) => {
      signal = init.signal;
      return { ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: [0.1, 0.2] }] }) };
    };
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    await p.embed('hello');
    assert.strictEqual(REQUEST_TIMEOUT_MS, 60000);
    assert.ok(signal instanceof AbortSignal, 'the request carries an abort signal');
    assert.strictEqual(signal.aborted, false);
  });

  it('a request the endpoint never answers times out as a transient error', async () => {
    // Never settles on its own — only the request's signal ends it, as with a
    // real fetch to an endpoint that accepted the connection and went silent.
    globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });
    const engine = new OpenAIEmbeddingsEngine({
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-test',
      model: 'm',
      dimensions: 2,
      sendDimensionsParam: false,
      timeoutMs: 50,
      errorContext: { label: 'OpenAI' },
    });

    await assert.rejects(
      () => engine.embedBatch(['hello']),
      (err) =>
        err.constructor === Error &&
        /^OpenAI embedding request timed out after 0\.05s \(network error\): the endpoint did not answer$/.test(err.message) &&
        isPermanentError(err) === false
    );
  });

  it('throws on network error with descriptive message', async () => {
    globalThis.fetch = mockFetchNetworkError('ECONNREFUSED');
    const p = new OpenAIProvider({ apiKey: 'sk-test' });

    await assert.rejects(
      () => p.embed('hello'),
      /network error.*ECONNREFUSED/i
    );
  });

  it('throws on other HTTP errors with status and body', async () => {
    globalThis.fetch = mockFetchError(500, 'Internal Server Error');
    const p = new OpenAIProvider({ apiKey: 'sk-test' });

    await assert.rejects(
      () => p.embed('hello'),
      /HTTP 500/
    );
  });
});

// ---------------------------------------------------------------------------
// Rate limits (mocked fetch)
// ---------------------------------------------------------------------------

describe('OpenAIEmbeddingsEngine rate limits (mocked)', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  const VECTOR = [0.1, 0.2];

  /** An engine whose waits are recorded, not slept. */
  function engineRecording(waits) {
    return new OpenAIEmbeddingsEngine({
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-test',
      model: 'm',
      dimensions: 2,
      sendDimensionsParam: false,
      errorContext: { label: 'OpenAI' },
      sleep: async (ms) => { waits.push(ms); },
    });
  }

  function limited(headers = {}, body = 'Rate limit reached') {
    return { ok: false, status: 429, headers: new Headers(headers), text: async () => body };
  }

  function answered(count = 1) {
    const data = Array.from({ length: count }, (_, index) => ({ index, embedding: VECTOR }));
    return { ok: true, status: 200, json: async () => ({ data }) };
  }

  /** Answer each request with the next response; the last one repeats. */
  function respondInTurn(responses, bodies = []) {
    return async (_url, init) => {
      bodies.push(init.body);
      return responses[Math.min(bodies.length, responses.length) - 1];
    };
  }

  it('waits the retry-after-ms the endpoint names, then retries the request', async () => {
    const waits = [];
    const bodies = [];
    globalThis.fetch = respondInTurn([limited({ 'retry-after-ms': '250' }), answered()], bodies);

    assert.deepStrictEqual(await engineRecording(waits).embed('hello'), VECTOR);
    assert.deepStrictEqual(waits, [250]);
    assert.strictEqual(bodies.length, 2);
  });

  it('reads retry-after in seconds', async () => {
    const waits = [];
    globalThis.fetch = respondInTurn([limited({ 'retry-after': '2' }), answered()]);

    await engineRecording(waits).embed('hello');
    assert.deepStrictEqual(waits, [2000]);
  });

  it('reads the wait from the message when no header names it', async () => {
    const waits = [];
    const body = JSON.stringify({ error: { message: 'Rate limit reached for text-embedding-3-small on tokens per min (TPM): Limit 1000000. Please try again in 6.007s.', type: 'tokens', code: 'rate_limit_exceeded' } });
    globalThis.fetch = respondInTurn([limited({}, body), answered()]);

    await engineRecording(waits).embed('hello');
    assert.deepStrictEqual(waits, [6007]);
  });

  it('caps a named wait at a minute', async () => {
    const waits = [];
    globalThis.fetch = respondInTurn([limited({ 'retry-after': '300' }), answered()]);

    await engineRecording(waits).embed('hello');
    assert.deepStrictEqual(waits, [MAX_RATE_LIMIT_WAIT_MS]);
  });

  it('falls back to growing waits when none is named, then throws RateLimitError', async () => {
    const waits = [];
    const bodies = [];
    globalThis.fetch = respondInTurn([limited()], bodies);

    await assert.rejects(
      () => engineRecording(waits).embed('hello'),
      (err) =>
        err instanceof RateLimitError &&
        /^OpenAI rate limit exceeded \(HTTP 429\)\. Rate limit reached$/.test(err.message) &&
        isPermanentError(err) === false
    );
    assert.deepStrictEqual(waits, RATE_LIMIT_WAITS_MS);
    assert.strictEqual(bodies.length, RATE_LIMIT_WAITS_MS.length + 1);
  });

  it('an account out of quota fails at once — no wait restores it', async () => {
    const waits = [];
    const bodies = [];
    const body = JSON.stringify({ error: { message: 'You exceeded your current quota.', type: 'insufficient_quota', code: 'insufficient_quota' } });
    globalThis.fetch = respondInTurn([limited({ 'retry-after': '1' }, body)], bodies);

    await assert.rejects(
      () => engineRecording(waits).embed('hello'),
      (err) => err.constructor === Error && /rate limit exceeded \(HTTP 429\)/.test(err.message)
    );
    assert.deepStrictEqual(waits, []);
    assert.strictEqual(bodies.length, 1);
  });

  it('a rate-limited batch retries only the request refused, not those answered', async () => {
    const waits = [];
    const bodies = [];
    const first = 'a'.repeat(MAX_BATCH_CHARS);
    const second = 'b'.repeat(MAX_BATCH_CHARS);
    globalThis.fetch = respondInTurn([answered(), limited({ 'retry-after-ms': '5' }), answered()], bodies);

    const vectors = await engineRecording(waits).embedBatch([first, second]);
    assert.deepStrictEqual(vectors, [VECTOR, VECTOR]);
    assert.deepStrictEqual(waits, [5]);
    assert.deepStrictEqual(bodies.map((b) => JSON.parse(b).input[0][0]), ['a', 'b', 'b']);
  });
});

// ---------------------------------------------------------------------------
// embedBatch (mocked fetch)
// ---------------------------------------------------------------------------

describe('OpenAIProvider embedBatch (mocked)', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('parses a successful batch response correctly', async () => {
    const vec1 = [0.1, 0.2];
    const vec2 = [0.3, 0.4];
    globalThis.fetch = mockFetchSuccess({
      data: [
        { index: 0, embedding: vec1 },
        { index: 1, embedding: vec2 },
      ],
    });

    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    const result = await p.embedBatch(['hello', 'world']);
    assert.deepStrictEqual(result, [vec1, vec2]);
  });

  it('returns results in correct order even if API returns out of order', async () => {
    const vec1 = [0.1, 0.2];
    const vec2 = [0.3, 0.4];
    globalThis.fetch = mockFetchSuccess({
      data: [
        { index: 1, embedding: vec2 },
        { index: 0, embedding: vec1 },
      ],
    });

    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    const result = await p.embedBatch(['hello', 'world']);
    assert.deepStrictEqual(result, [vec1, vec2]);
  });

  it('returns empty array for empty input (no API call)', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; };

    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    const result = await p.embedBatch([]);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(fetchCalled, false);
  });

  it('throws when texts is not an array', async () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    await assert.rejects(
      () => p.embedBatch('not-an-array'),
      /texts must be an array/
    );
  });

  it('works with single item array', async () => {
    const vec = [0.5, 0.6];
    globalThis.fetch = mockFetchSuccess({
      data: [{ index: 0, embedding: vec }],
    });

    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    const result = await p.embedBatch(['single']);
    assert.deepStrictEqual(result, [vec]);
  });

  it('throws on short response (fewer rows than requested)', async () => {
    // API returned 2 rows for a 3-item request. Previously: results[2]
    // stayed undefined and propagated silently into the store.
    globalThis.fetch = mockFetchSuccess({
      data: [
        { index: 0, embedding: [0.1, 0.2] },
        { index: 1, embedding: [0.3, 0.4] },
      ],
    });
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    await assert.rejects(
      () => p.embedBatch(['a', 'b', 'c']),
      /response length mismatch.*requested 3, received 2/
    );
  });

  it('throws on missing data array', async () => {
    globalThis.fetch = mockFetchSuccess({ data: null });
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    await assert.rejects(
      () => p.embedBatch(['a']),
      /response length mismatch/
    );
  });

  // Each input is tagged `t{n} …`; the stub answers every request with the
  // vector [n, 0] per input, rows in reverse order, and records the inputs
  // each request carried.
  function recordingFetch(requests) {
    return async (_url, init) => {
      const { input } = JSON.parse(init.body);
      requests.push(input);
      const data = input.map((text, index) => ({ index, embedding: [Number(/^t(\d+)/.exec(text)[1]), 0] }));
      return { ok: true, status: 200, json: async () => ({ data: data.reverse() }) };
    };
  }

  it('splits inputs past the character budget across requests, results in input order', async () => {
    const requests = [];
    globalThis.fetch = recordingFetch(requests);
    const size = 150000;
    const texts = Array.from({ length: 5 }, (_, i) => `t${i} `.padEnd(size, 'x'));
    assert.ok(texts.length * size > MAX_BATCH_CHARS);

    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    const vectors = await p.embedBatch(texts);

    assert.deepStrictEqual(requests.map((r) => r.length), [2, 2, 1]);
    for (const request of requests) {
      assert.ok(request.reduce((sum, t) => sum + t.length, 0) <= MAX_BATCH_CHARS);
    }
    assert.deepStrictEqual(vectors.map((v) => v[0]), [0, 1, 2, 3, 4]);
  });

  it('still caps a request at the input count', async () => {
    const requests = [];
    globalThis.fetch = recordingFetch(requests);
    const texts = Array.from({ length: MAX_BATCH_SIZE + 3 }, (_, i) => `t${i}`);

    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    const vectors = await p.embedBatch(texts);

    assert.deepStrictEqual(requests.map((r) => r.length), [MAX_BATCH_SIZE, 3]);
    assert.deepStrictEqual(vectors.map((v) => v[0]), texts.map((_, i) => i));
  });

  it('sends nothing for an empty batch', async () => {
    const requests = [];
    globalThis.fetch = recordingFetch(requests);
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    assert.deepStrictEqual(await p.embedBatch([]), []);
    assert.strictEqual(requests.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Per-vector width validation — a model whose native output differs from the
// configured dimensions returns the right COUNT of wrong-WIDTH vectors. The
// count check does not catch it; the width check does, with a clean
// provider-level error rather than a raw Orama insert failure mid-index.
// ---------------------------------------------------------------------------

describe('OpenAIProvider vector-width validation', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('embed rejects a wrong-width vector', async () => {
    globalThis.fetch = mockFetchSuccess({
      data: [{ index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }], // width 4
    });
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    await assert.rejects(
      () => p.embed('hello'),
      (err) => err instanceof ConfigError && /expected width 2/.test(err.message)
    );
  });

  it('embed accepts a correct-width vector', async () => {
    const vec = [0.1, 0.2];
    globalThis.fetch = mockFetchSuccess({ data: [{ index: 0, embedding: vec }] });
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    assert.deepStrictEqual(await p.embed('hello'), vec);
  });

  it('embedBatch rejects a wrong-width vector and names the index', async () => {
    globalThis.fetch = mockFetchSuccess({
      data: [
        { index: 0, embedding: [0.1, 0.2] },        // ok
        { index: 1, embedding: [0.3, 0.4, 0.5] },   // width 3 — wrong
      ],
    });
    const p = new OpenAIProvider({ apiKey: 'sk-test', dimensions: 2 });
    await assert.rejects(
      () => p.embedBatch(['a', 'b']),
      (err) => err instanceof ConfigError && /expected width 2/.test(err.message) && /index 1/.test(err.message)
    );
  });
});

// ---------------------------------------------------------------------------
// Config integration — resolveProvider creates OpenAIProvider
// ---------------------------------------------------------------------------

describe('resolveProvider with openai', () => {
  const { resolveProvider } = require('../../src/knowledge/config');

  it('creates OpenAIProvider when provider is openai and key is present', () => {
    const provider = resolveProvider({
      provider: 'openai',
      _api_key: 'sk-test-key',
    });
    assert.ok(provider instanceof OpenAIProvider);
    assert.strictEqual(provider.model(), DEFAULT_MODEL);
    assert.strictEqual(provider.dimensions(), DEFAULT_DIMENSIONS);
  });

  it('creates OpenAIProvider with custom model and dimensions', () => {
    const provider = resolveProvider({
      provider: 'openai',
      _api_key: 'sk-test-key',
      model: 'text-embedding-3-large',
      dimensions: 3072,
    });
    assert.ok(provider instanceof OpenAIProvider);
    assert.strictEqual(provider.model(), 'text-embedding-3-large');
    assert.strictEqual(provider.dimensions(), 3072);
  });

  it('returns null when provider is openai but key is missing (keyword-only)', () => {
    const provider = resolveProvider({
      provider: 'openai',
      _api_key: null,
    });
    assert.strictEqual(provider, null);
  });
});
