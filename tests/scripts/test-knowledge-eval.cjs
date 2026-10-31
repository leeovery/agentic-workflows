'use strict';

// The knowledge base's retrieval, measured: the judged cases validate against
// the frozen corpus, and the keyword mode's measurements match the pinned
// baseline exactly. A move in either direction fails; a deliberate one is
// re-pinned by `node tests/scripts/knowledge-eval.cjs --pin`. The hybrid
// mode runs by hand, and its embedding cache is held here: a text it has
// cached never reaches the provider again.

require('./hermetic-env.cjs');

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const store = require('../../skills/leeway-engine/scripts/kernel/knowledge/store.cjs');
const { StubProvider } = require('../../skills/leeway-engine/scripts/kernel/knowledge/embeddings.cjs');
const { knowledgeFiles } = require('../../skills/leeway-engine/scripts/kernel/knowledge/files.cjs');
const { setupFixtureAt, statePath } = require('./engine-harness.cjs');
const knowledgeEval = require('./knowledge-eval.cjs');
const embeddings = require('./knowledge-eval-embeddings.cjs');

const SOURCE = 'cache-schema-versioning/investigation/cache-schema-versioning.md';
const ANCHOR = 'Deterministic failure — not intermittent';
const OTHER = 'same-second-tasks-sort-by-id/investigation/same-second-tasks-sort-by-id.md';
const OTHER_ANCHOR = 'the batch shares a second';

/** A sound tick case, with `overrides` laid over it. */
function tickCase(overrides = {}) {
  return {
    id: 'probe',
    project: 'tick',
    origin: 'written',
    asked: '2026-09-15',
    need: 'why every cache query fails',
    terms: ['stale cache schema'],
    options: {},
    relevant: [{ source: SOURCE, anchor: ANCHOR, grade: 'primary', framing: 0 }],
    ...overrides,
  };
}

/** A sound negative asked in fumi, with `overrides` laid over it. */
function negativeCase(overrides = {}) {
  return tickCase({ origin: 'negative', from: 'fumi', relevant: [], ...overrides });
}

/** A sound near-miss negative, with `overrides` laid over it. */
function nearMissCase(overrides = {}) {
  return tickCase({ origin: 'near-miss', relevant: [], ...overrides });
}

describe('knowledge eval — keyword mode', () => {
  it('the judged cases validate against the corpus', () => {
    assert.deepStrictEqual(knowledgeEval.validateCases(knowledgeEval.loadCases()), []);
  });

  it('validation names every broken case, option and judgment', () => {
    const problems = knowledgeEval.validateCases([
      tickCase(),
      tickCase(),
      negativeCase({ id: 'sound-negative', options: { limit: 3 } }),
      nearMissCase({ id: 'sound-near-miss', options: { limit: 3 } }),
      tickCase({ id: 'bad-shape', origin: 'found', asked: '2026-02-30', extra: true }),
      negativeCase({ id: 'negative-from-itself', from: 'tick' }),
      tickCase({ id: 'no-terms', terms: [] }),
      tickCase({
        id: 'bad-options',
        options: { boosts: [{ field: 'bogus', value: 'x' }, { field: 'phase', value: null }], limit: 0, filter: 'x', phase: '' },
      }),
      tickCase({ id: 'boosts-not-a-list', options: { boosts: 'work-unit' } }),
      negativeCase({ id: 'negative-filtered', options: { 'work-type': 'epic' } }),
      nearMissCase({ id: 'near-miss-filtered', options: { phase: 'investigation' } }),
      tickCase({
        id: 'names-absent',
        options: { 'work-unit': 'cache-schema-versioning, nowhere', boosts: [{ field: 'phase', value: 'analysis' }, { field: 'topic', value: 'same-second-tasks-sort-by-id' }] },
      }),
      negativeCase({ id: 'negative-judged', relevant: tickCase().relevant }),
      nearMissCase({ id: 'near-miss-judged', relevant: tickCase().relevant }),
      tickCase({ id: 'relevant-not-a-list', relevant: {} }),
      tickCase({
        id: 'bad-judgments',
        relevant: [
          { source: 'cache-schema-versioning/nowhere.md', anchor: 'x', grade: 'primary', framing: 0 },
          { source: SOURCE, anchor: 'not a phrase in the file', grade: 'supporting', framing: 3 },
          { source: SOURCE, anchor: ANCHOR, grade: 'key', framing: 0 },
          { source: SOURCE, anchor: 'SQLite', grade: 'supporting', framing: 0 },
          { source: SOURCE, anchor: ANCHOR, grade: 'supporting', framing: 0 },
        ],
      }),
      tickCase({ id: 'no-primary', relevant: [{ ...tickCase().relevant[0], grade: 'supporting' }] }),
      tickCase({
        id: 'primary-filtered-out',
        options: { topic: 'same-second-tasks-sort-by-id' },
        relevant: [
          { source: SOURCE, anchor: ANCHOR, grade: 'primary', framing: 0 },
          { source: SOURCE, anchor: 'stale cache.db', grade: 'supporting', framing: 0 },
          { source: OTHER, anchor: OTHER_ANCHOR, grade: 'primary', framing: 0 },
        ],
      }),
    ]);
    assert.deepStrictEqual(problems, [
      'probe: the id is not unique',
      'bad-shape: unknown key "extra"',
      'bad-shape: origin must be one of harvested, written, negative, near-miss',
      'bad-shape: asked must be a YYYY-MM-DD date',
      'negative-from-itself: from must name another project',
      'no-terms: terms must be a non-empty list of non-empty strings',
      'no-terms: relevant[0]: framing must index a term',
      'bad-options: unknown option "filter"',
      'bad-options: phase must be a non-empty string',
      'bad-options: limit must be a positive integer',
      'bad-options: Unknown --boost field: "bogus". Valid fields: work-unit, work-type, phase, topic, confidence',
      'bad-options: --boost:phase requires a value',
      'boosts-not-a-list: boosts must be a list',
      'negative-filtered: a negative case carries no hard filter',
      'near-miss-filtered: a negative case carries no hard filter',
      'names-absent: no work-unit "nowhere" in the tick fixture',
      'names-absent: no phase "analysis" in the tick fixture',
      'negative-judged: a negative case judges nothing relevant',
      'near-miss-judged: a negative case judges nothing relevant',
      'relevant-not-a-list: relevant must be a list',
      'bad-judgments: relevant[0]: cache-schema-versioning/nowhere.md is not in the tick fixture',
      'bad-judgments: relevant[1]: framing must index a term',
      `bad-judgments: relevant[1]: the anchor is not in ${SOURCE}`,
      'bad-judgments: relevant[2]: grade must be one of primary, supporting',
      `bad-judgments: relevant[3]: the anchor occurs 5 times in ${SOURCE}`,
      'bad-judgments: relevant[4]: judges a passage already judged',
      'no-primary: no primary judgment',
      'primary-filtered-out: relevant[0]: a primary passage outside the hard filters is unreachable',
    ]);
  });

  it('a judgment no chunk of the built store carries is named', () => {
    const chunks = [
      { source_file: SOURCE, content: `Before. ${ANCHOR} — on every query. After.` },
      { source_file: OTHER, content: 'A deterministic failure, never intermittent, restated.' },
    ];
    const split = { source: SOURCE, anchor: 'on every query — and the next', grade: 'primary', framing: 0 };
    const elsewhere = { source: OTHER, anchor: ANCHOR, grade: 'supporting', framing: 0 };
    const cases = [tickCase(), tickCase({ id: 'unmatched', relevant: [...tickCase().relevant, split, elsewhere] }), negativeCase()];
    assert.deepStrictEqual(knowledgeEval.unmatchedJudgments(cases, chunks), [
      `unmatched: relevant[1]: no indexed chunk of ${SOURCE} carries the anchor`,
      `unmatched: relevant[2]: no indexed chunk of ${OTHER} carries the anchor`,
    ]);
  });

  it('a move names each metric and case that moved, and how to re-pin', () => {
    const pinned = {
      metrics: { overall: { 'hit@5': 0.5, bytes: 100 } },
      cases: { a: { first: 3, bytes: 100 }, gone: { first: 1, bytes: 10 } },
    };
    const run = {
      metrics: { overall: { 'hit@5': 0.75, bytes: 100 } },
      cases: { a: { first: 1, bytes: 90 }, added: { first: null, bytes: 5 } },
    };
    const moves = knowledgeEval.baselineMoves(pinned, run, true);
    assert.deepStrictEqual(moves, [
      'overall hit@5: 0.5 → 0.75',
      'case a: first 3 → 1, bytes 100 → 90',
      'case gone: pinned, no longer run',
      'case added: not pinned',
    ]);
    assert.match(knowledgeEval.movesMessage(moves, 'keyword'), /re-pin .*: node tests\/scripts\/knowledge-eval\.cjs --pin$/);
    assert.match(knowledgeEval.movesMessage(moves, 'hybrid'), /re-pin .*: node tests\/scripts\/knowledge-eval\.cjs --pin --hybrid$/);
  });

  it('a run embedded with another provider than the baseline refuses to compare', () => {
    const openai = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536, base_url: null };
    const stub = { provider: 'stub', model: 'stub', dimensions: 128, base_url: null };
    const summary = { metrics: { overall: { 'hit@5': 1 } }, cases: {} };
    assert.throws(
      () => knowledgeEval.baselineMoves({ provider: openai, ...summary }, { provider: stub, ...summary }, true),
      { message: 'the baseline was pinned with provider=openai model=text-embedding-3-small dimensions=1536, and this '
        + 'run embeds with provider=stub model=stub dimensions=128 — run under the pinned provider, or re-pin under '
        + 'this one: node tests/scripts/knowledge-eval.cjs --pin --hybrid' },
    );
    assert.deepStrictEqual(knowledgeEval.baselineMoves({ provider: openai, ...summary }, { provider: openai, ...summary }, true), []);
  });

  it('the keyword mode matches the pinned baseline exactly', async () => {
    const { summary } = await knowledgeEval.evaluate();
    const moves = knowledgeEval.baselineMoves(knowledgeEval.readBaseline('keyword'), summary, true);
    assert.deepStrictEqual(moves, [], knowledgeEval.movesMessage(moves, 'keyword'));
  });
});

const STUB_IDENTITY = { provider: 'stub', model: 'stub', dimensions: 4, base_url: null };

/** @param {string} file @param {string} text */
function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** @param {string} file @param {unknown} value */
function writeJson(file, value) {
  writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

/** The stub provider, recording each call it takes. */
function recordingProvider() {
  const stub = new StubProvider({ dimensions: STUB_IDENTITY.dimensions });
  const calls = [];
  return {
    calls,
    model: () => stub.model(),
    dimensions: () => stub.dimensions(),
    /** @param {string} text */
    embed: async (text) => {
      calls.push({ embed: text });
      return stub.embed(text);
    },
    /** @param {string[]} texts */
    embedBatch: async (texts) => {
      calls.push({ embedBatch: texts });
      return stub.embedBatch(texts);
    },
  };
}

/** The stub's vector for a text, as the cache keeps it. @param {string} text */
function kept(text) {
  return new StubProvider({ dimensions: STUB_IDENTITY.dimensions }).embed(text).map(Math.fround);
}

/**
 * An OpenAI-compatible embeddings endpoint on this machine, recording every
 * text it is asked to embed.
 * @param {number} dimensions
 */
async function fakeEndpoint(dimensions) {
  const stub = new StubProvider({ dimensions });
  /** @type {string[]} */
  const texts = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (part) => { body += part; });
    req.on('end', () => {
      const { input } = JSON.parse(body);
      const inputs = Array.isArray(input) ? input : [input];
      texts.push(...inputs);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data: inputs.map((text, index) => ({ index, embedding: stub.embed(text) })) }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const { port } = /** @type {import('net').AddressInfo} */ (server.address());
  return {
    texts,
    identity: { provider: 'openai-compatible', model: 'fake', dimensions, base_url: `http://127.0.0.1:${port}/v1` },
    close: () => new Promise((resolve) => server.close(() => resolve(undefined))),
  };
}

/**
 * A feature with two completed specifications, in a fresh directory under
 * `parent`, configured to embed with the provider `identity` names.
 * @param {string} parent @param {Record<string, any>} identity
 */
function specifiedProject(parent, identity) {
  const root = setupFixtureAt(fs.mkdtempSync(path.join(parent, 'project-')));
  const topics = ['refresh', 'revocation'];
  writeJson(statePath(root, 'manifest.json'), { work_units: { auth: { work_type: 'feature' } } });
  writeJson(statePath(root, 'auth', 'manifest.json'), {
    name: 'auth', work_type: 'feature', status: 'in-progress', created: '2026-01-01',
    phases: { specification: { items: Object.fromEntries(topics.map((topic) => [topic, { status: 'completed' }])) } },
  });
  for (const topic of topics) {
    writeFile(statePath(root, 'auth', 'specification', topic, 'specification.md'), `# ${topic}\n\nThe ${topic} decision.\n`);
  }
  writeJson(knowledgeFiles(statePath(root)).config, { knowledge: identity });
  return root;
}

describe('knowledge eval — the embedding cache', () => {
  let scratch;
  let cacheDir;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-embeddings-'));
    cacheDir = path.join(scratch, 'cache');
  });

  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('keeps a vector by provider identity and exact text, as float32', () => {
    const cache = embeddings.embeddingCache(cacheDir, STUB_IDENTITY);
    const vector = [0.1, -0.2, 1 / 3, 2];
    assert.deepStrictEqual(cache.write('the refresh decision', vector), vector.map(Math.fround));
    assert.deepStrictEqual(cache.read('the refresh decision'), vector.map(Math.fround));
    assert.strictEqual(cache.read('the refresh decision '), null);
    assert.strictEqual(embeddings.embeddingCache(cacheDir, { ...STUB_IDENTITY, dimensions: 8 }).read('the refresh decision'), null);
    assert.strictEqual(cache.size(), 1);
  });

  it('a write cut short before it lands leaves the text uncached', () => {
    const cache = embeddings.embeddingCache(cacheDir, STUB_IDENTITY);
    const rename = fs.renameSync;
    fs.renameSync = () => {
      throw new Error('interrupted');
    };
    try {
      assert.throws(() => cache.write('the refresh decision', [1, 2, 3, 4]), /interrupted/);
    } finally {
      fs.renameSync = rename;
    }
    assert.strictEqual(cache.read('the refresh decision'), null);
    assert.strictEqual(cache.size(), 0);
  });

  it('the provider embeds only the texts the cache lacks, once each', async () => {
    const provider = recordingProvider();
    const cached = embeddings.cachingProvider(provider, embeddings.embeddingCache(cacheDir, STUB_IDENTITY));
    assert.deepStrictEqual(await cached.embedBatch(['a', 'b', 'a']), ['a', 'b', 'a'].map(kept));
    assert.deepStrictEqual(await cached.embedBatch(['b', 'c']), ['b', 'c'].map(kept));
    assert.deepStrictEqual(await cached.embed('a'), kept('a'));
    assert.deepStrictEqual(await cached.embed('d'), kept('d'));
    assert.deepStrictEqual(provider.calls, [{ embedBatch: ['a', 'b'] }, { embedBatch: ['c'] }, { embed: 'd' }]);
    assert.deepStrictEqual([cached.model(), cached.dimensions()], ['stub', STUB_IDENTITY.dimensions]);
  });

  it('`engine knowledge` embeds through the cache, and a warm cache reaches no provider', async () => {
    const endpoint = await fakeEndpoint(8);
    const cache = embeddings.embeddingCache(cacheDir, endpoint.identity);
    try {
      await knowledgeEval.runKnowledge(specifiedProject(scratch, endpoint.identity), ['index'], cacheDir);
      assert.strictEqual(endpoint.texts.length, 2);
      assert.ok(endpoint.texts.every((text) => cache.read(text) !== null), 'every text embedded is cached');

      const rebuilt = specifiedProject(scratch, endpoint.identity);
      await knowledgeEval.runKnowledge(rebuilt, ['index'], cacheDir);
      assert.strictEqual(endpoint.texts.length, 2, 'the rebuild sent the endpoint nothing');
      assert.strictEqual(store.readMetadata(knowledgeFiles(statePath(rebuilt)).metadata).provider, 'openai-compatible');
      assert.strictEqual(cache.size(), 2);
    } finally {
      await endpoint.close();
    }
  });
});
