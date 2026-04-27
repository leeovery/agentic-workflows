'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  OpenAIProvider,
  AuthError,
  DEFAULT_MODEL,
  DEFAULT_DIMENSIONS,
} = require('../../src/knowledge/providers/openai');

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

  it('throws on 429 with rate limit message (no internal retry)', async () => {
    globalThis.fetch = mockFetchError(429, 'Rate limit exceeded');
    const p = new OpenAIProvider({ apiKey: 'sk-test' });

    await assert.rejects(
      () => p.embed('hello'),
      /rate limit exceeded/i
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
