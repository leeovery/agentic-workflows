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

const knowledge = require('../../src/knowledge/index');
const knowledgeEval = require('./knowledge-eval.cjs');
const embeddings = require('./knowledge-eval-embeddings.cjs');

const SOURCE = '.workflows/fumi/discussion/search-and-retrieval.md';
const ANCHOR = 'A switch on the main search area';

/** A sound fumi case, with `overrides` laid over it. */
function fumiCase(overrides = {}) {
  return {
    id: 'probe',
    project: 'fumi',
    origin: 'written',
    asked: '2026-09-15',
    need: 'whether history is searchable',
    terms: ['version history search'],
    options: {},
    relevant: [{ source: SOURCE, anchor: ANCHOR, grade: 'primary', framing: 0 }],
    ...overrides,
  };
}

/** A sound negative asked in tick, with `overrides` laid over it. */
function negativeCase(overrides = {}) {
  return fumiCase({ origin: 'negative', from: 'tick', relevant: [], ...overrides });
}

describe('knowledge eval — keyword mode', () => {
  it('the judged cases validate against the corpus', () => {
    assert.deepStrictEqual(knowledgeEval.validateCases(knowledgeEval.loadCases()), []);
  });

  it('validation names every broken case, option and judgment', () => {
    const problems = knowledgeEval.validateCases([
      fumiCase(),
      fumiCase(),
      negativeCase({ id: 'sound-negative', options: { limit: 3 } }),
      fumiCase({ id: 'bad-shape', origin: 'found', asked: '2026-02-30', extra: true }),
      negativeCase({ id: 'negative-from-itself', from: 'fumi' }),
      fumiCase({ id: 'no-terms', terms: [] }),
      fumiCase({
        id: 'bad-options',
        options: { boosts: [{ field: 'bogus', value: 'x' }, { field: 'phase', value: null }], limit: 0, filter: 'x', phase: '' },
      }),
      fumiCase({ id: 'boosts-not-a-list', options: { boosts: 'work-unit' } }),
      negativeCase({ id: 'negative-filtered', options: { 'work-type': 'epic' } }),
      fumiCase({
        id: 'names-absent',
        options: { 'work-unit': 'fumi, nowhere', boosts: [{ field: 'phase', value: 'specification' }, { field: 'topic', value: 'note-model' }] },
      }),
      negativeCase({ id: 'negative-judged', relevant: fumiCase().relevant }),
      fumiCase({ id: 'relevant-not-a-list', relevant: {} }),
      fumiCase({
        id: 'bad-judgments',
        relevant: [
          { source: '.workflows/fumi/nowhere.md', anchor: 'x', grade: 'primary', framing: 0 },
          { source: SOURCE, anchor: 'not a phrase in the file', grade: 'supporting', framing: 3 },
          { source: SOURCE, anchor: ANCHOR, grade: 'key', framing: 0 },
          { source: SOURCE, anchor: 'FTS5', grade: 'supporting', framing: 0 },
          { source: SOURCE, anchor: ANCHOR, grade: 'supporting', framing: 0 },
        ],
      }),
      fumiCase({ id: 'no-primary', relevant: [{ ...fumiCase().relevant[0], grade: 'supporting' }] }),
      fumiCase({
        id: 'primary-filtered-out',
        options: { topic: 'engine-architecture' },
        relevant: [
          { source: SOURCE, anchor: ANCHOR, grade: 'primary', framing: 0 },
          { source: SOURCE, anchor: 'Spotlight', grade: 'supporting', framing: 0 },
          { source: '.workflows/fumi/discussion/engine-architecture.md', anchor: '## Process Model', grade: 'primary', framing: 0 },
        ],
      }),
    ]);
    assert.deepStrictEqual(problems, [
      'probe: the id is not unique',
      'bad-shape: unknown key "extra"',
      'bad-shape: origin must be one of harvested, written, negative',
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
      'names-absent: no work-unit "nowhere" in the fumi fixture',
      'names-absent: no phase "specification" in the fumi fixture',
      'negative-judged: a negative case judges nothing relevant',
      'relevant-not-a-list: relevant must be a list',
      'bad-judgments: relevant[0]: .workflows/fumi/nowhere.md is not in the fumi fixture',
      'bad-judgments: relevant[1]: framing must index a term',
      `bad-judgments: relevant[1]: the anchor is not in ${SOURCE}`,
      'bad-judgments: relevant[2]: grade must be one of primary, supporting',
      `bad-judgments: relevant[3]: the anchor occurs 6 times in ${SOURCE}`,
      'bad-judgments: relevant[4]: judges a passage already judged',
      'no-primary: no primary judgment',
      'primary-filtered-out: relevant[0]: a primary passage outside the hard filters is unreachable',
    ]);
  });

  it('a judgment no chunk of the built store carries is named', () => {
    const chunks = [
      { source_file: SOURCE, content: `Before. ${ANCHOR} — include history. After.` },
      { source_file: '.workflows/fumi/discussion/note-model.md', content: 'A switch on the main search area, restated.' },
    ];
    const split = { source: SOURCE, anchor: 'include history — widens the query', grade: 'primary', framing: 0 };
    const elsewhere = { source: '.workflows/fumi/discussion/note-window.md', anchor: ANCHOR, grade: 'supporting', framing: 0 };
    const cases = [fumiCase(), fumiCase({ id: 'unmatched', relevant: [...fumiCase().relevant, split, elsewhere] }), negativeCase()];
    assert.deepStrictEqual(knowledgeEval.unmatchedJudgments(cases, chunks), [
      `unmatched: relevant[1]: no indexed chunk of ${SOURCE} carries the anchor`,
      'unmatched: relevant[2]: no indexed chunk of .workflows/fumi/discussion/note-window.md carries the anchor',
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
  const stub = new knowledge.StubProvider({ dimensions: STUB_IDENTITY.dimensions });
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
  return new knowledge.StubProvider({ dimensions: STUB_IDENTITY.dimensions }).embed(text).map(Math.fround);
}

/**
 * An OpenAI-compatible embeddings endpoint on this machine, recording every
 * text it is asked to embed.
 * @param {number} dimensions
 */
async function fakeEndpoint(dimensions) {
  const stub = new knowledge.StubProvider({ dimensions });
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
 * A feature with two completed discussions, in a fresh directory under
 * `parent`, configured to embed with the provider `identity` names.
 * @param {string} parent @param {Record<string, any>} identity
 */
function discussedProject(parent, identity) {
  const root = fs.mkdtempSync(path.join(parent, 'project-'));
  const topics = ['refresh', 'revocation'];
  writeJson(path.join(root, '.workflows', 'manifest.json'), { work_units: { auth: { work_type: 'feature' } } });
  writeJson(path.join(root, '.workflows', 'auth', 'manifest.json'), {
    name: 'auth', work_type: 'feature', status: 'in-progress', created: '2026-01-01',
    phases: { discussion: { items: Object.fromEntries(topics.map((topic) => [topic, { status: 'completed' }])) } },
  });
  for (const topic of topics) {
    writeFile(path.join(root, '.workflows', 'auth', 'discussion', `${topic}.md`), `# ${topic}\n\nThe ${topic} decision.\n`);
  }
  writeJson(knowledge.config.projectConfigPath(root), { knowledge: identity });
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

  it('the knowledge CLI embeds through the cache, and a warm cache reaches no provider', async () => {
    const endpoint = await fakeEndpoint(8);
    const cache = embeddings.embeddingCache(cacheDir, endpoint.identity);
    try {
      await knowledgeEval.runKnowledge(discussedProject(scratch, endpoint.identity), ['index'], cacheDir);
      assert.strictEqual(endpoint.texts.length, 2);
      assert.ok(endpoint.texts.every((text) => cache.read(text) !== null), 'every text embedded is cached');

      const rebuilt = discussedProject(scratch, endpoint.identity);
      await knowledgeEval.runKnowledge(rebuilt, ['index'], cacheDir);
      assert.strictEqual(endpoint.texts.length, 2, 'the rebuild sent the endpoint nothing');
      assert.strictEqual(knowledge.store.readMetadata(knowledge.metadataPath(rebuilt)).provider, 'openai-compatible');
      assert.strictEqual(cache.size(), 2);
    } finally {
      await endpoint.close();
    }
  });
});
