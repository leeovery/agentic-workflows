'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  OpenAICompatibleProvider,
  AuthError,
} = require('../../src/knowledge/providers/openai-compatible');
const { resolveProvider } = require('../../src/knowledge/config');
const setup = require('../../src/knowledge/setup');

// ---------------------------------------------------------------------------
// Mock fetch helpers — capture the request so we can assert on URL/headers/body
// ---------------------------------------------------------------------------

function mockFetchCapturing(captured, responseBody) {
  return async (url, init) => {
    captured.url = url;
    captured.init = init;
    captured.body = init && init.body ? JSON.parse(init.body) : null;
    return { ok: true, status: 200, json: async () => responseBody };
  };
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
// Constructor
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider constructor', () => {
  it('constructs with baseUrl, model, dimensions and reports them', () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'http://localhost:1234/v1',
      model: 'nomic-embed-text-v1.5',
      dimensions: 768,
    });
    assert.strictEqual(p.model(), 'nomic-embed-text-v1.5');
    assert.strictEqual(p.dimensions(), 768);
  });

  it('throws when baseUrl is missing', () => {
    assert.throws(
      () => new OpenAICompatibleProvider({ model: 'm', dimensions: 3 }),
      /baseUrl is required/
    );
  });

  it('throws when model is missing', () => {
    assert.throws(
      () => new OpenAICompatibleProvider({ baseUrl: 'http://x/v1', dimensions: 3 }),
      /model is required/
    );
  });

  it('throws when dimensions is not a positive integer', () => {
    assert.throws(
      () => new OpenAICompatibleProvider({ baseUrl: 'http://x/v1', model: 'm' }),
      /dimensions must be a positive integer/
    );
    assert.throws(
      () => new OpenAICompatibleProvider({ baseUrl: 'http://x/v1', model: 'm', dimensions: 0 }),
      /dimensions must be a positive integer/
    );
  });
});

// ---------------------------------------------------------------------------
// Request shaping — dimensions param omitted, baseUrl join, optional auth
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider request shaping (mocked)', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('omits the dimensions param from the request body', async () => {
    const captured = {};
    globalThis.fetch = mockFetchCapturing(captured, { data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] });

    const p = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', model: 'm', dimensions: 3 });
    await p.embed('hello');

    assert.strictEqual(captured.body.model, 'm');
    assert.strictEqual(captured.body.input, 'hello');
    assert.ok(!('dimensions' in captured.body), 'dimensions must not be in the request body');
  });

  it('joins baseUrl + /embeddings and normalises a trailing slash', async () => {
    const captured = {};
    globalThis.fetch = mockFetchCapturing(captured, { data: [{ index: 0, embedding: [0.1] }] });

    const p1 = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', model: 'm', dimensions: 1 });
    await p1.embed('x');
    assert.strictEqual(captured.url, 'http://localhost:1234/v1/embeddings');

    const p2 = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1///', model: 'm', dimensions: 1 });
    await p2.embed('x');
    assert.strictEqual(captured.url, 'http://localhost:1234/v1/embeddings');
  });

  it('omits the Authorization header when no key is present', async () => {
    const captured = {};
    globalThis.fetch = mockFetchCapturing(captured, { data: [{ index: 0, embedding: [0.1] }] });

    const p = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', model: 'm', dimensions: 1 });
    await p.embed('x');
    assert.ok(!('Authorization' in captured.init.headers), 'no Authorization header without a key');
  });

  it('sends the Authorization header when a key is present', async () => {
    const captured = {};
    globalThis.fetch = mockFetchCapturing(captured, { data: [{ index: 0, embedding: [0.1] }] });

    const p = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', model: 'm', dimensions: 1, apiKey: 'local-key' });
    await p.embed('x');
    assert.strictEqual(captured.init.headers['Authorization'], 'Bearer local-key');
  });
});

// ---------------------------------------------------------------------------
// Error context — local remedies, not OpenAI; response-length mismatch
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider error context (mocked)', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('throws AuthError on 401 without OpenAI-specific text', async () => {
    globalThis.fetch = mockFetchError(401, 'Unauthorized');
    const p = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', model: 'm', dimensions: 1 });
    await assert.rejects(
      () => p.embed('x'),
      (err) => err instanceof AuthError && /401/.test(err.message) && !/platform\.openai\.com/.test(err.message)
    );
  });

  it('surfaces ECONNREFUSED as a network error', async () => {
    globalThis.fetch = mockFetchNetworkError('connect ECONNREFUSED 127.0.0.1:1234');
    const p = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', model: 'm', dimensions: 1 });
    await assert.rejects(() => p.embed('x'), /network error.*ECONNREFUSED/i);
  });

  it('surfaces the errno from err.cause (real undici "fetch failed" shape)', async () => {
    // Node's fetch throws TypeError("fetch failed") with the real errno on
    // .cause — the mock above put ECONNREFUSED in .message, which is NOT how
    // the runtime behaves. This reproduces the real shape.
    globalThis.fetch = async () => {
      const err = new TypeError('fetch failed');
      err.cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:59999'), { code: 'ECONNREFUSED' });
      throw err;
    };
    const p = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:59999/v1', model: 'm', dimensions: 1 });
    await assert.rejects(() => p.embed('x'), /network error.*ECONNREFUSED/);
  });

  it('throws on a response-length mismatch (dims ≠ model native output guard)', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ index: 0, embedding: [0.1, 0.2] }] }),
    });
    const p = new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', model: 'm', dimensions: 2 });
    await assert.rejects(
      () => p.embedBatch(['a', 'b', 'c']),
      /response length mismatch.*requested 3, received 1/
    );
  });
});

// ---------------------------------------------------------------------------
// resolveProvider — compat builds without a key; missing base_url throws
// ---------------------------------------------------------------------------

describe('resolveProvider with openai-compatible', () => {
  it('builds the provider without an API key', () => {
    const p = resolveProvider({
      provider: 'openai-compatible',
      base_url: 'http://localhost:1234/v1',
      model: 'nomic-embed-text-v1.5',
      dimensions: 768,
      _api_key: null,
    });
    assert.ok(p instanceof OpenAICompatibleProvider);
    assert.strictEqual(p.model(), 'nomic-embed-text-v1.5');
    assert.strictEqual(p.dimensions(), 768);
  });

  it('passes a stored key through when present', () => {
    const captured = {};
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetchCapturing(captured, { data: [{ index: 0, embedding: [0.1] }] });
    try {
      const p = resolveProvider({
        provider: 'openai-compatible',
        base_url: 'http://localhost:1234/v1',
        model: 'm',
        dimensions: 1,
        _api_key: 'stored-key',
      });
      assert.ok(p instanceof OpenAICompatibleProvider);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('throws (never silent keyword-only) when base_url is missing', () => {
    assert.throws(
      () => resolveProvider({ provider: 'openai-compatible', model: 'm', dimensions: 3, _api_key: null }),
      /requires a "base_url"/
    );
  });

  it('openai with no key still degrades to keyword-only (null)', () => {
    const p = resolveProvider({ provider: 'openai', _api_key: null });
    assert.strictEqual(p, null);
  });
});

// ---------------------------------------------------------------------------
// Config merge carries base_url
// ---------------------------------------------------------------------------

describe('config merge carries base_url', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { loadConfig } = require('../../src/knowledge/config');

  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-compat-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('merges base_url from the system config through to the merged config', () => {
    const sysPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(sysPath, JSON.stringify({
      knowledge: {
        provider: 'openai-compatible',
        base_url: 'http://localhost:1234/v1',
        model: 'nomic-embed-text-v1.5',
        dimensions: 768,
      },
    }));
    const merged = loadConfig({
      systemPath: sysPath,
      projectPath: path.join(tmpDir, 'missing.json'),
      credentialsPath: path.join(tmpDir, 'creds.json'),
    });
    assert.strictEqual(merged.base_url, 'http://localhost:1234/v1');
    assert.strictEqual(merged.provider, 'openai-compatible');
  });
});

// ---------------------------------------------------------------------------
// Setup unit coverage — builders, ECONNREFUSED branch, compat collect()
// ---------------------------------------------------------------------------

describe('buildSystemConfigCompatible', () => {
  it('produces a knowledge block with provider, base_url, model, dimensions', () => {
    const cfg = setup.buildSystemConfigCompatible({
      baseUrl: 'http://localhost:1234/v1',
      model: 'nomic-embed-text-v1.5',
      dimensions: 768,
    });
    assert.strictEqual(cfg.knowledge.provider, 'openai-compatible');
    assert.strictEqual(cfg.knowledge.base_url, 'http://localhost:1234/v1');
    assert.strictEqual(cfg.knowledge.model, 'nomic-embed-text-v1.5');
    assert.strictEqual(cfg.knowledge.dimensions, 768);
    assert.ok(typeof cfg.knowledge.similarity_threshold === 'number');
    assert.ok(typeof cfg.knowledge.decay_months === 'number');
  });
});

describe('describeValidationError ECONNREFUSED branch', () => {
  it('maps ECONNREFUSED to a connection-refused message with the driver remedy', () => {
    const { message, hint } = setup.describeValidationError(
      new Error('Embeddings endpoint embedding request failed (network error): connect ECONNREFUSED 127.0.0.1:1234'),
      { connRefused: 'No server is listening at http://localhost:1234/v1.' }
    );
    assert.match(message, /connection refused/i);
    assert.match(hint, /No server is listening at http:\/\/localhost:1234\/v1/);
  });
});

describe('openai-compatible collect() against a fake prompter', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  // Build a fake toolkit that scripts answers and records output.
  function fakeToolkit({ answers, secret, yesNo }) {
    const askQueue = answers.slice();
    const yesNoQueue = (yesNo || []).slice();
    const out = [];
    return {
      tk: {
        ask: async () => askQueue.shift(),
        askYesNo: async () => yesNoQueue.shift(),
        askSecret: async () => secret,
        askDimensions: async () => parseInt(askQueue.shift(), 10),
        out: (s) => out.push(s),
        fail: (s) => { throw new Error('fail: ' + s); },
        validate: setup.validateProvider,
        describeError: setup.describeValidationError,
        buildSystemConfig: setup.buildSystemConfig,
        envVarName: () => undefined,
        envKey: () => null,
        storedKey: () => null,
      },
      out,
    };
  }

  it('collects base_url, model, dimensions and a key, validating via a test embed', async () => {
    const { SETUP_DESCRIPTOR } = require('../../src/knowledge/providers/openai-compatible');
    const captured = {};
    globalThis.fetch = mockFetchCapturing(captured, {
      data: [{ index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }],
    });

    // answers feed ask() in order: base_url, model, then askDimensions reads next.
    const { tk } = fakeToolkit({
      answers: ['http://localhost:1234/v1', 'nomic-embed-text-v1.5', '4'],
      secret: '', // empty → no key
    });
    const result = await SETUP_DESCRIPTOR.collect(tk);

    assert.strictEqual(result.key, null);
    assert.strictEqual(result.knowledgeConfig.knowledge.provider, 'openai-compatible');
    assert.strictEqual(result.knowledgeConfig.knowledge.base_url, 'http://localhost:1234/v1');
    assert.strictEqual(result.knowledgeConfig.knowledge.dimensions, 4);
    // No dimensions param in the validation request body.
    assert.ok(!('dimensions' in captured.body));
  });

  it('returns { stub: true } when validation fails and the user declines retry', async () => {
    const { SETUP_DESCRIPTOR } = require('../../src/knowledge/providers/openai-compatible');
    globalThis.fetch = mockFetchNetworkError('connect ECONNREFUSED 127.0.0.1:1234');

    const { tk } = fakeToolkit({
      answers: ['http://localhost:1234/v1', 'm', '4'],
      secret: '',
      yesNo: [false], // decline "try again?"
    });
    const result = await SETUP_DESCRIPTOR.collect(tk);
    assert.strictEqual(result.stub, true);
  });
});
