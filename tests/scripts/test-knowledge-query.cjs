'use strict';

// The query pipeline's parts: the settings a store's metadata and the config
// resolve to, the search that ranks, and the render that prints. The engine's
// `knowledge query` composes the three; the eval harness calls them in
// process.

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { embeddingEndpoint, engineKnowledge, withoutBackoff } = require('./knowledge-harness.cjs');

const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { StubProvider } = require('../../skills/workflow-engine/scripts/kernel/knowledge/embeddings.cjs');
const { resolveProvider } = require('../../skills/workflow-engine/scripts/kernel/knowledge/config.cjs');
const { QuotaError, AuthError, RateLimitError } = require('../../skills/workflow-engine/scripts/kernel/knowledge/providers/openai-engine.cjs');
const {
  boostProblem,
  QUERY_TIMEOUT_MS,
  QUERY_WAIT_BUDGET_MS,
  queryProvider,
  querySettings,
  queryStore,
  renderQuery,
} = require('../../skills/workflow-engine/scripts/domain/knowledge/query.cjs');

const DIMS = 128;
const KEYWORD_ONLY = { provider: null, model: null, dimensions: null };
const STUB_BUILT = { provider: 'stub', model: 'stub', dimensions: DIMS };
const OPENAI_BUILT = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 };
const CHOSEN_NOTE = '[keyword-only mode — configure embedding provider for semantic search]';

// A chunk and a query term sharing no word, embedded alike — only the vector
// search can join them.
const PARAPHRASE = { content: 'Receipts reconcile after close.', term: 'when is the ledger balanced' };

/** A chunk of `unit`'s discussion, `n` its ordinal. */
function doc(unit, n, content) {
  return {
    id: `${unit}-discussion-${unit}-${String(n).padStart(3, '0')}`,
    content,
    work_unit: unit,
    work_type: 'feature',
    phase: 'discussion',
    topic: unit,
    confidence: 'medium',
    source_file: `.workflows/${unit}/discussion/${unit}.md`,
    timestamp: new Date(2026, 0, 2).getTime(),
  };
}

/** The ranking settings a keyword-only query runs with by default. */
function keywordSettings() {
  return querySettings(KEYWORD_ONLY, {}, null);
}

/**
 * @param {any} db
 * @param {{terms: string[], options?: object, workUnits?: object[], settings?: object}} request
 */
async function query(db, request) {
  return (await outcomeOf(db, request)).results;
}

/**
 * @param {any} db
 * @param {{terms: string[], options?: object, workUnits?: object[], settings?: object}} request
 */
function outcomeOf(db, { terms, options = {}, workUnits = [], settings = keywordSettings() }) {
  return queryStore(db, settings, { terms, options, workUnits });
}

/** A stub-dimensioned provider whose every embedBatch throws `error`. @param {Error} error */
function failing(error) {
  return { model: () => 'stub', dimensions: () => DIMS, embedBatch: async () => { throw error; } };
}

describe('querySettings', () => {
  it('runs a keyword-only store keyword-only, with the ranking the config defaults to', () => {
    const settings = keywordSettings();
    assert.strictEqual(settings.provider, null);
    assert.strictEqual(settings.note, CHOSEN_NOTE);
    assert.strictEqual(settings.storeEmbedded, false);
    assert.strictEqual(settings.similarity, 0.3);
    assert.strictEqual(settings.stability, 5);
    assert.strictEqual(settings.weights.feature, 1);
  });

  it('runs a keyword-only store keyword-only once a provider is configured, until the next start embeds it', () => {
    const settings = querySettings(KEYWORD_ONLY, { provider: 'stub' }, new StubProvider({ dimensions: DIMS }));
    assert.strictEqual(settings.provider, null);
    assert.strictEqual(settings.note, '[keyword-only mode — the store has no vectors yet; the next start embeds them]');
  });

  it('runs a store built with the configured provider in full', () => {
    const provider = new StubProvider({ dimensions: DIMS });
    const settings = querySettings(STUB_BUILT, { provider: 'stub' }, provider);
    assert.strictEqual(settings.provider, provider);
    assert.strictEqual(settings.note, null);
    assert.strictEqual(settings.storeEmbedded, true);
  });

  it('never throws for want of a vector: each conflict runs keyword-only, its note naming the cause and fix', () => {
    const keyNote = '[keyword-only mode — the openai API key could not be resolved; export OPENAI_API_KEY, or run knowledge setup --key-only]';
    const cases = [
      [OPENAI_BUILT, { provider: 'openai' }, null, keyNote],
      [KEYWORD_ONLY, { provider: 'openai' }, null, keyNote],
      [OPENAI_BUILT, {}, null,
        '[keyword-only mode — the store was embedded with openai (text-embedding-3-small, 1536 dimensions) and the config names no provider; restore it in the config, or run knowledge rebuild]'],
      [OPENAI_BUILT, { provider: 'stub' }, new StubProvider({ dimensions: DIMS }),
        '[keyword-only mode — the store was embedded with openai (text-embedding-3-small, 1536 dimensions) and the config names stub (stub, 128 dimensions); run knowledge rebuild]'],
    ];
    for (const [metadata, cfg, provider, note] of cases) {
      const settings = querySettings(metadata, cfg, provider);
      assert.strictEqual(settings.provider, null, note);
      assert.strictEqual(settings.note, note);
    }
  });
});

describe('queryStore', () => {
  const stub = new StubProvider({ dimensions: DIMS });
  let db;

  before(() => {
    db = store.createStore();
    for (const d of [
      doc('old', 1, 'Token refresh follows the rate window.'),
      doc('new', 1, 'Token refresh follows the rate window.'),
      doc('billing', 1, 'Invoices are issued monthly.'),
      doc('billing', 2, 'Refunds reverse the invoice.'),
    ]) {
      store.insertDocument(db, { ...d, embedding: stub.embed(d.content) });
    }
    store.insertDocument(db, { ...doc('accounts', 1, PARAPHRASE.content), embedding: stub.embed(PARAPHRASE.term) });
  });

  it('merges every term, each chunk once, and cuts to the limit', async () => {
    const terms = ['token', 'refresh', 'refunds'];
    const merged = await query(db, { terms });
    assert.deepStrictEqual(merged.map((r) => r.id).sort(), [
      'billing-discussion-billing-002',
      'new-discussion-new-001',
      'old-discussion-old-001',
    ]);
    assert.strictEqual((await query(db, { terms, options: { limit: 2 } })).length, 2);
  });

  it('filters by a comma list of values', async () => {
    const results = await query(db, { terms: ['token', 'invoice'], options: { workUnit: 'old,billing' } });
    assert.deepStrictEqual([...new Set(results.map((r) => r.work_unit))].sort(), ['billing', 'old']);
  });

  it('decays a unit the progress clock has moved past, and adds boosts undimmed', async () => {
    const workUnits = [
      { name: 'old', status: 'completed', completed_at: '2026-01-01', work_type: 'feature' },
      { name: 'new', status: 'completed', completed_at: '2026-06-01', work_type: 'feature' },
    ];
    const decayed = await query(db, { terms: ['token'], workUnits });
    assert.deepStrictEqual(decayed.map((r) => [r.work_unit, r.progressElapsed]), [['new', 0], ['old', 1]]);

    const boosted = await query(db, { terms: ['token'], workUnits, options: { boosts: [{ field: 'work-unit', value: 'old' }] } });
    assert.strictEqual(boosted[0].work_unit, 'old');
  });

  it('never decays a specification, however far the clock has moved past its unit', async () => {
    const specDb = store.createStore();
    for (const d of [doc('old', 1, 'Token refresh follows the rate window.'), doc('new', 1, 'Token refresh follows the rate window.')]) {
      store.insertDocument(specDb, { ...d, embedding: stub.embed(d.content) });
    }
    const spec = { ...doc('old', 2, 'Token refresh follows the rate window.'), id: 'old-specification-old-001', phase: 'specification' };
    store.insertDocument(specDb, { ...spec, embedding: stub.embed(spec.content) });
    const workUnits = [
      { name: 'old', status: 'completed', completed_at: '2026-01-01', work_type: 'feature' },
      { name: 'new', status: 'completed', completed_at: '2026-06-01', work_type: 'feature' },
    ];
    const results = await query(specDb, { terms: ['token'], workUnits });
    assert.deepStrictEqual(results.map((r) => [r.work_unit, r.phase, r.scoring.decay === 1]).sort(), [
      ['new', 'discussion', true], ['old', 'discussion', false], ['old', 'specification', true],
    ]);
  });

  it('refuses an invalid boost with a UserError', async () => {
    await assert.rejects(
      query(db, { terms: ['token'], options: { boosts: [{ field: 'bogus', value: 'x' }] } }),
      { name: 'UserError', message: /^Unknown --boost field: "bogus"/ },
    );
  });

  it('embeds every framing in one embedBatch request, and searches hybrid', async () => {
    const requests = [];
    const provider = {
      model: () => stub.model(),
      dimensions: () => stub.dimensions(),
      embedBatch: async (texts) => {
        requests.push(texts);
        return stub.embedBatch(texts);
      },
    };
    const settings = querySettings(STUB_BUILT, { provider: 'stub' }, provider);
    const outcome = await outcomeOf(db, { terms: ['token refresh', 'refunds', PARAPHRASE.term], settings });
    assert.deepStrictEqual(requests, [['token refresh', 'refunds', PARAPHRASE.term]]);
    assert.ok(outcome.results.some((r) => r.id === 'accounts-discussion-accounts-001'), 'the paraphrase found by its vector');
    assert.deepStrictEqual(outcome.notes, []);
  });

  it('runs keyword-only whatever keeps the framings from their vectors, its note naming the cause and fix', async () => {
    const terms = ['token', 'refunds'];
    const keyword = await query(db, { terms });
    const cases = [
      [new Error('Embeddings endpoint embedding request failed (network error): fetch failed (ECONNREFUSED)'),
        '[keyword-only mode — the query could not be embedded: Embeddings endpoint embedding request failed (network error): fetch failed (ECONNREFUSED); retry once the provider answers]'],
      [new RateLimitError('OpenAI rate limit exceeded (HTTP 429).', 120000),
        "[keyword-only mode — the embedding provider's rate limit outlasted this command's wait; retry shortly]"],
      [new QuotaError('OpenAI request refused: the account is out of quota (HTTP 429).'),
        '[keyword-only mode — the embedding account is out of quota; add credit to it]'],
      [new AuthError('OpenAI request was rejected (HTTP 401). The API key is invalid or expired.\n  Run `knowledge setup` to fix.'),
        '[keyword-only mode — the query could not be embedded: OpenAI request was rejected (HTTP 401). The API key is invalid or expired. Run `knowledge setup` to fix.]'],
    ];
    for (const [error, note] of cases) {
      const settings = querySettings(STUB_BUILT, { provider: 'stub' }, failing(error));
      const outcome = await outcomeOf(db, { terms, settings });
      assert.deepStrictEqual(outcome.notes, [note]);
      assert.deepStrictEqual(outcome.results.map((r) => [r.id, r.score]), keyword.map((r) => [r.id, r.score]), error.name);
    }
  });

  it('says how many chunks await their vectors, over a store whose identity names a provider', async () => {
    const awaiting = store.createStore();
    store.insertDocument(awaiting, { ...doc('ledger', 1, 'Receipts reconcile nightly.'), embedding: stub.embed('receipts') });
    store.insertDocument(awaiting, doc('ledger', 2, 'Receipts arrive late.'));
    const full = querySettings(STUB_BUILT, { provider: 'stub' }, stub);
    assert.deepStrictEqual((await outcomeOf(awaiting, { terms: ['receipts'], settings: full })).notes,
      ['[1 chunks await vectors — searched by keyword alone; each start retries them]']);
    assert.deepStrictEqual((await outcomeOf(awaiting, { terms: ['receipts'] })).notes, [CHOSEN_NOTE],
      'a keyword-only store awaits nothing');
  });

  it('blends in full mode: each search\'s scores over its best, 0.4 keyword and 0.6 vector', async () => {
    const blended = store.createStore();
    store.insertDocument(blended, { ...doc('both', 1, 'Receipts reconcile nightly.'), embedding: [1, 0] });
    store.insertDocument(blended, { ...doc('vector', 1, 'Ledgers balance at close.'), embedding: [0.6, 0.8] });
    store.insertDocument(blended, { ...doc('keyword', 1, 'Receipts arrive late.'), embedding: [0, 1] });
    const axis = { model: () => 'axis', dimensions: () => 2, embedBatch: async (texts) => texts.map(() => [2, 0]) };
    const settings = querySettings({ provider: 'axis', model: 'axis', dimensions: 2 }, { provider: 'axis' }, axis);
    const keyword = Object.fromEntries(store.searchKeyword(blended, { term: 'receipts' }).map((h) => [h.work_unit, h.score]));
    const best = Math.max(...Object.values(keyword));
    const confidence = 0.03;
    const results = Object.fromEntries((await query(blended, { terms: ['receipts'], settings })).map((r) => [r.work_unit, r.score]));
    assert.deepStrictEqual(Object.keys(results), ['both', 'keyword', 'vector']);
    assert.strictEqual(results.both, 0.4 * (keyword.both / best) + 0.6 + confidence);
    assert.strictEqual(results.keyword, 0.4 * (keyword.keyword / best) + confidence);
    assert.ok(Math.abs(results.vector - (0.6 * 0.6 + confidence)) < 1e-6, 'a vector hit alone, its cosine over the best');
  });

  it('finds by meaning in full mode a chunk sharing no word with the query', async () => {
    const accounts = 'accounts-discussion-accounts-001';
    const full = querySettings(STUB_BUILT, { provider: 'stub' }, stub);
    assert.ok((await query(db, { terms: [PARAPHRASE.term], settings: full })).some((r) => r.id === accounts));
    assert.ok(!(await query(db, { terms: [PARAPHRASE.term] })).some((r) => r.id === accounts));
  });
});

describe('queryProvider', () => {
  const STAND_IN = { provider: 'openai-compatible', model: 'stand-in', dimensions: 8 };
  let endpoint;
  let db;

  /** The one-chunk store's query through the provider the query builds. @param {object} provider */
  function queryThrough(provider) {
    return outcomeOf(db, { terms: ['receipts'], settings: querySettings(STAND_IN, endpoint.config, provider) });
  }

  before(async () => {
    endpoint = await embeddingEndpoint(8);
    db = store.createStore();
    store.insertDocument(db, { ...doc('ledger', 1, 'Receipts reconcile nightly.'), embedding: new StubProvider({ dimensions: 8 }).embed('receipts') });
  });

  after(() => endpoint.close());

  beforeEach(() => {
    endpoint.requests.length = 0;
  });

  it("waits out a rate limit for seconds, never the index's minute, then runs keyword-only", async () => {
    endpoint.mode = 'rate-limited';
    const waits = [];
    const outcome = await queryThrough(queryProvider(endpoint.config, { sleep: async (ms) => { waits.push(ms); } }));
    assert.deepStrictEqual(endpoint.requests, [['receipts']]);
    assert.deepStrictEqual(waits, [], 'the 20 s wait the endpoint names never fits the query\'s budget');
    assert.deepStrictEqual(outcome.notes, ["[keyword-only mode — the embedding provider's rate limit outlasted this command's wait; retry shortly]"]);
    assert.deepStrictEqual(outcome.results.map((r) => r.id), ['ledger-discussion-ledger-001']);
  });

  it('gives an endpoint that never answers two tries of its timeout, then runs keyword-only', async () => {
    endpoint.mode = 'silent';
    const timeoutMs = 50;
    const backoffMs = 1000;
    const started = performance.now();
    const outcome = await queryThrough(queryProvider(endpoint.config, { timeoutMs }));
    const elapsed = performance.now() - started;
    assert.deepStrictEqual(endpoint.requests, [['receipts'], ['receipts']], 'two tries');
    assert.ok(elapsed < 2 * timeoutMs + backoffMs + 1000, `keyword-only within the bound, after ${Math.round(elapsed)} ms`);
    assert.deepStrictEqual(outcome.notes, [
      '[keyword-only mode — the query could not be embedded: Embeddings endpoint embedding request timed out after 0.05s (network error): the endpoint did not answer; retry once the provider answers]',
    ]);
    assert.deepStrictEqual(outcome.results.map((r) => r.id), ['ledger-discussion-ledger-001']);
  });

  it('gives each request 5 seconds to answer, and a rate limit 5 seconds of waiting in all', () => {
    assert.strictEqual(QUERY_TIMEOUT_MS, 5000);
    assert.strictEqual(QUERY_WAIT_BUDGET_MS, 5000);
  });
});

describe('provider patience', () => {
  const OPENAI = { provider: 'openai', _api_key: 'sk-test', model: 'text-embedding-3-small', dimensions: 2 };
  let fetch0;

  beforeEach(() => {
    fetch0 = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetch0;
  });

  /**
   * An endpoint that answers the first request with a 429 naming a 20 s wait,
   * and every later one with a vector per input.
   * @param {string[]} requests  each request's body, in order
   */
  function limitedOnce(requests) {
    return async (/** @type {string} */ _url, /** @type {any} */ init) => {
      requests.push(init.body);
      if (requests.length === 1) {
        return { ok: false, status: 429, headers: new Headers({ 'retry-after': '20' }), text: async () => 'Rate limit reached' };
      }
      const { input } = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ data: input.map((_, index) => ({ index, embedding: [0.6, 0.8] })) }) };
    };
  }

  it("gives an index the provider's own patience: a 20 s rate limit is waited out", async (t) => {
    const requests = [];
    globalThis.fetch = limitedOnce(requests);
    const vectors = await withoutBackoff(t, () => resolveProvider(OPENAI).embedBatch(['x']));
    assert.deepStrictEqual(vectors, [[0.6, 0.8]]);
    assert.strictEqual(requests.length, 2);
  });

  it('gives a query its own: a 20 s rate limit is never waited', async () => {
    const requests = [];
    globalThis.fetch = limitedOnce(requests);
    await assert.rejects(queryProvider(OPENAI).embedBatch(['x']), RateLimitError);
    assert.strictEqual(requests.length, 1);
  });
});

describe('knowledge query — `engine knowledge query`', () => {
  let root;

  /** @param {string} name @param {string} completedAt */
  function completedFeature(name, completedAt) {
    const unit = path.join(root, '.workflows', name);
    fs.mkdirSync(path.join(unit, 'discussion'), { recursive: true });
    fs.writeFileSync(path.join(unit, 'manifest.json'), JSON.stringify({
      name, work_type: 'feature', status: 'completed', created: '2026-01-01', completed_at: completedAt,
      phases: { discussion: { items: { [name]: { status: 'completed' } } } },
    }));
    fs.writeFileSync(path.join(unit, 'discussion', `${name}.md`), '# Discussion\n\nToken refresh follows the rate window.\n');
  }

  /** @param {...string} args */
  async function knowledge(...args) {
    const answer = await engineKnowledge(root, args);
    assert.strictEqual(answer.code, 0, answer.stderr);
    return answer.stdout;
  }

  before(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-query-'));
    fs.mkdirSync(path.join(root, '.workflows', '.knowledge'), { recursive: true });
    fs.writeFileSync(path.join(root, '.workflows', '.knowledge', 'config.json'), '{ "knowledge": { "provider": null } }');
    fs.writeFileSync(path.join(root, '.workflows', 'manifest.json'),
      JSON.stringify({ work_units: { alpha: { work_type: 'feature' }, beta: { work_type: 'feature' } } }));
    completedFeature('alpha', '2026-01-01');
    completedFeature('beta', '2026-06-01');
    await knowledge('index', '.workflows/alpha/discussion/alpha.md');
    await knowledge('index', '.workflows/beta/discussion/beta.md');
  });

  after(() => fs.rmSync(root, { recursive: true, force: true }));

  it('ranks a chunk the progress clock has moved past below its equal', async () => {
    const units = [...(await knowledge('query', 'token refresh')).matchAll(/^\[discussion \| (\w+)\//gm)].map((m) => m[1]);
    assert.deepStrictEqual(units, ['beta', 'alpha']);
  });

  it('explains beneath each source line how the result ranked, and prints nothing else differently', async () => {
    const explained = await knowledge('query', 'token refresh', 'rate window', '--explain');
    const score = String.raw`\d+\.\d{4}`;
    for (const [unit, decay] of [['beta', '1\\.0000'], ['alpha', '0\\.9791']]) {
      assert.match(explained, new RegExp([
        `^Source: \\.workflows/${unit}/discussion/${unit}\\.md`,
        `Framing 1: keyword ${score}`,
        `Framing 2: keyword ${score}`,
        `Score: kept framing 1's ${score} × ${decay} decay \\+ 0\\.0000 boost \\+ 0\\.0200 tier = ${score}$`,
      ].join('\n'), 'm'));
    }
    assert.strictEqual(explained.replace(/^(?:Framing \d+|Score): .*\n/gm, ''), await knowledge('query', 'token refresh', 'rate window'));
  });

  it('never reads the term after --explain as its value', async () => {
    assert.strictEqual(await knowledge('query', '--explain', 'token refresh'), await knowledge('query', 'token refresh', '--explain'));
  });
});

describe('knowledge query — `engine knowledge query`, without a vector', () => {
  const RESULT = /^\[1 results\]\n\n\[discussion \| alpha\/alpha \|/m;
  let endpoint;
  let root;

  /** @param {Record<string, any>} knowledge */
  function configure(knowledge) {
    fs.writeFileSync(path.join(root, '.workflows', '.knowledge', 'config.json'), JSON.stringify({ knowledge }));
  }

  /** @param {Record<string, any>} fields */
  function rewriteMetadata(fields) {
    const file = path.join(root, '.workflows', '.knowledge', 'metadata.json');
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), ...fields }));
  }

  before(async () => {
    endpoint = await embeddingEndpoint(8);
  });

  after(() => endpoint.close());

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-query-cli-'));
    const unit = path.join(root, '.workflows', 'alpha');
    fs.mkdirSync(path.join(unit, 'discussion'), { recursive: true });
    fs.mkdirSync(path.join(root, '.workflows', '.knowledge'), { recursive: true });
    fs.writeFileSync(path.join(root, '.workflows', 'manifest.json'), JSON.stringify({ work_units: { alpha: { work_type: 'feature' } } }));
    fs.writeFileSync(path.join(unit, 'manifest.json'), JSON.stringify({
      name: 'alpha', work_type: 'feature', status: 'in-progress', created: '2026-01-01',
      phases: { discussion: { items: { alpha: { status: 'completed' } } } },
    }));
    fs.writeFileSync(path.join(unit, 'discussion', 'alpha.md'), '# Discussion\n\nToken refresh follows the rate window.\n');
    configure(endpoint.config);
    endpoint.mode = 'ok';
    assert.strictEqual((await engineKnowledge(root, ['index'])).code, 0);
    endpoint.requests.length = 0;
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('embeds every framing in one request, and prints no note', async () => {
    const { code, stdout } = await engineKnowledge(root, ['query', 'token refresh', 'rate window']);
    assert.strictEqual(code, 0);
    assert.deepStrictEqual(endpoint.requests, [['token refresh', 'rate window']]);
    assert.match(stdout, /^\[1 results\]\n/);
  });

  it('exits 0 keyword-only when the provider is down, naming the failure', async () => {
    endpoint.mode = 'down';
    const { code, stdout } = await engineKnowledge(root, ['query', 'token refresh']);
    assert.strictEqual(code, 0);
    assert.match(stdout, /^\[keyword-only mode — the query could not be embedded: Embeddings endpoint embedding request failed \(HTTP 503\): .*; retry once the provider answers\]\n/);
    assert.match(stdout, RESULT);
  });

  it('exits 0 keyword-only on a rate limit, without waiting it out', { timeout: 10000 }, async () => {
    endpoint.mode = 'rate-limited';
    const { code, stdout } = await engineKnowledge(root, ['query', 'token refresh']);
    assert.strictEqual(code, 0);
    assert.match(stdout, /^\[keyword-only mode — the embedding provider's rate limit outlasted this command's wait; retry shortly\]\n/);
    assert.match(stdout, RESULT);
  });

  it('exits 0 keyword-only when the account is out of quota', async () => {
    endpoint.mode = 'quota';
    const { code, stdout } = await engineKnowledge(root, ['query', 'token refresh']);
    assert.strictEqual(code, 0);
    assert.match(stdout, /^\[keyword-only mode — the embedding account is out of quota; add credit to it\]\n/);
    assert.match(stdout, RESULT);
  });

  it('exits 0 keyword-only when no key resolves, naming the key', async () => {
    rewriteMetadata({ provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 });
    configure({ provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 });
    const { code, stdout } = await engineKnowledge(root, ['query', 'token refresh']);
    assert.strictEqual(code, 0);
    assert.match(stdout, /^\[keyword-only mode — the openai API key could not be resolved; export OPENAI_API_KEY, or run knowledge setup --key-only\]\n/);
    assert.match(stdout, RESULT);
  });

  it('exits 0 keyword-only over a store built with another model, and asks for a rebuild', async () => {
    configure({ ...endpoint.config, model: 'another' });
    const { code, stdout } = await engineKnowledge(root, ['query', 'token refresh']);
    assert.strictEqual(code, 0);
    assert.match(stdout, /^\[keyword-only mode — the store was embedded with openai-compatible \(stand-in, 8 dimensions\) and the config names openai-compatible \(another, 8 dimensions\); run knowledge rebuild\]\n/);
    assert.match(stdout, RESULT);
    assert.deepStrictEqual(endpoint.requests, [], 'nothing embedded for a store it cannot compare');
  });

  it("status says the mode a query runs in, naming why it runs keyword-only in the query's own words", async () => {
    const modeAndNote = async () => [
      (await engineKnowledge(root, ['status'])).stdout.match(/^Mode: (.*)$/m)[1],
      (await engineKnowledge(root, ['query', 'token refresh'])).stdout.split('\n')[0],
    ];
    const keywordOnly = (cause) => [`Keyword-only — ${cause}`, `[keyword-only mode — ${cause}]`];
    assert.deepStrictEqual(await modeAndNote(), ['Full (hybrid search)', '[1 results]']);

    configure({ ...endpoint.config, model: 'another' });
    assert.deepStrictEqual(await modeAndNote(), keywordOnly(
      'the store was embedded with openai-compatible (stand-in, 8 dimensions) and the config names openai-compatible (another, 8 dimensions); run knowledge rebuild'));

    configure({});
    assert.deepStrictEqual(await modeAndNote(), keywordOnly(
      'the store was embedded with openai-compatible (stand-in, 8 dimensions) and the config names no provider; restore it in the config, or run knowledge rebuild'));

    rewriteMetadata({ provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 });
    configure({ provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 });
    assert.deepStrictEqual(await modeAndNote(), keywordOnly(
      'the openai API key could not be resolved; export OPENAI_API_KEY, or run knowledge setup --key-only'));
  });

  it('status names a knowledge config it cannot load, where a query fails', async () => {
    fs.writeFileSync(path.join(root, '.workflows', '.knowledge', 'config.json'), '{ not json');
    const status = await engineKnowledge(root, ['status']);
    assert.strictEqual(status.code, 0);
    assert.match(status.stdout, /^Mode: none — a query fails until the knowledge config loads$/m);
    assert.match(status.stdout, /^WARNING: Invalid JSON in config file at .*config\.json: /m);
    assert.strictEqual((await engineKnowledge(root, ['query', 'token refresh'])).code, 1);
  });

  it('exits non-zero when the store cannot be read, or its metadata is missing', async () => {
    const knowledgeDir = path.join(root, '.workflows', '.knowledge');
    fs.rmSync(path.join(knowledgeDir, 'metadata.json'));
    const missing = await engineKnowledge(root, ['query', 'token refresh']);
    assert.strictEqual(missing.code, 1);
    assert.match(missing.stderr, /^metadata\.json missing but store exists/);

    fs.writeFileSync(path.join(knowledgeDir, 'store.bin'), 'not a store');
    const corrupt = await engineKnowledge(root, ['query', 'token refresh']);
    assert.strictEqual(corrupt.code, 1);
    assert.match(corrupt.stderr, /^Error: loadStore: corrupted store file at /);
  });
});

describe('renderQuery', () => {
  const result = doc('auth', 1, 'Tokens refresh hourly.');
  const awaiting = '[2 chunks await vectors — searched by keyword alone; each start retries them]';

  it("opens with the query's notes, then each result's header, content and source", () => {
    assert.strictEqual(renderQuery({ results: [result], notes: [CHOSEN_NOTE, awaiting] }), [
      CHOSEN_NOTE,
      awaiting,
      '[1 results]',
      '',
      '[discussion | auth/auth | medium | 2026-01-02]',
      'Tokens refresh hourly.',
      'Source: .workflows/auth/discussion/auth.md',
    ].join('\n') + '\n');
  });

  it('prints no note where there is none, and a bare count where there are no results', () => {
    assert.match(renderQuery({ results: [result], notes: [] }), /^\[1 results\]\n/);
    assert.strictEqual(renderQuery({ results: [], notes: [] }), '[0 results]\n');
  });

  it('strips control characters, keeping newlines and tabs', () => {
    const text = renderQuery({ results: [{ ...result, content: 'a\x1b[31mred\x00\tb\nc' }], notes: [] });
    assert.ok(text.includes('a[31mred\tb\nc'));
  });
});

describe('boostProblem', () => {
  it('names an unknown field and a missing value, and passes a valid directive', () => {
    assert.match(boostProblem({ field: 'bogus', value: 'x' }), /^Unknown --boost field: "bogus"\. Valid fields: /);
    assert.strictEqual(boostProblem({ field: 'phase', value: null }), '--boost:phase requires a value');
    assert.strictEqual(boostProblem({ field: 'phase', value: 'spec' }), null);
  });
});
