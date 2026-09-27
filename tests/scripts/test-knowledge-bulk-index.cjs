'use strict';

// The bulk index's write: the keyword side of everything new and changed in
// one save, then the chunks without a vector embedded batch by batch — across
// files, with a per-file fallback, only the text the store lacks sent to the
// provider — each batch saved as it lands; and the run's view of the
// manifests and the store refreshed under the lock before each save.

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { cmdIndexBulk, indexSingleFile, store, StubProvider, InvalidRequestError, QuotaError } = require('../../src/knowledge/index');
const { embeddingEndpoint, knowledgeCli, withoutBackoff } = require('./knowledge-harness.cjs');

const { loadStore, saveStore, withLock } = store;
const CFG = { provider: 'stub', dimensions: 128 };
const TOPICS = ['alpha', 'beta', 'gamma'];

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function discussionPath(root, topic) {
  return path.join(root, '.workflows', 'payments', 'discussion', `${topic}.md`);
}

function writeDiscussion(root, topic, body) {
  fs.mkdirSync(path.dirname(discussionPath(root, topic)), { recursive: true });
  fs.writeFileSync(discussionPath(root, topic), `# ${topic}\n\n${body}\n`);
}

function setItemStatus(root, topic, status) {
  const file = path.join(root, '.workflows', 'payments', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.phases.discussion.items[topic] = { status };
  writeJson(file, manifest);
}

/** An epic whose three completed discussions are on disk, no store yet. */
function buildProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-bulk-')));
  writeJson(path.join(root, '.workflows', 'manifest.json'), { work_units: { payments: { work_type: 'epic' } } });
  writeJson(path.join(root, '.workflows', 'payments', 'manifest.json'), {
    name: 'payments', work_type: 'epic', status: 'in-progress', created: '2026-01-01',
    phases: { discussion: { items: Object.fromEntries(TOPICS.map((t) => [t, { status: 'completed' }])) } },
  });
  for (const topic of TOPICS) writeDiscussion(root, topic, `The ${topic} decision.`);
  fs.mkdirSync(path.join(root, '.workflows', '.knowledge'), { recursive: true });
  return root;
}

/**
 * The stub provider, recording every embedBatch call. `during` runs inside
 * each call — a peer acting mid-run; a text `refuse` matches is refused the
 * way an endpoint refuses an input; `unreachable` fails every call the way a
 * network outage does; `answers` calls succeed before every later one fails
 * the way an account out of quota does. It answers to `model`.
 */
function spyProvider({ refuse = () => false, during = async () => {}, unreachable = false, answers = Infinity, model = 'stub' } = {}) {
  const stub = new StubProvider({ dimensions: CFG.dimensions });
  const batches = [];
  return {
    batches,
    model: () => model,
    dimensions: () => stub.dimensions(),
    embed: (text) => stub.embed(text),
    async embedBatch(texts) {
      batches.push(texts);
      await during();
      if (unreachable) throw new Error('embedding request failed (network error): fetch failed');
      if (batches.length > answers) throw new QuotaError('request refused: the account is out of quota (HTTP 429)');
      if (texts.some(refuse)) throw new InvalidRequestError('HTTP 400: input refused');
      return stub.embedBatch(texts);
    },
  };
}

function storeFile(root) {
  return path.join(root, '.workflows', '.knowledge', store.STORE_FILE);
}

function chunksFor(root, topic) {
  return store.allChunks(loadStore(storeFile(root))).filter((c) => c.topic === topic);
}

/** A discussion long enough to chunk by its sections, one chunk per body. */
function sectioned(bodies) {
  const filler = Array.from({ length: 20 }, (_, i) => `Line ${i} of the reasoning.`).join('\n');
  return bodies.map((body, i) => `## Section ${i + 1}\n\n${body}\n\n${filler}`).join('\n\n');
}

/**
 * Hold what the CLI writes, and a restore that ends the hold.
 * @returns {{output: {stdout: string, stderr: string}, restore: () => void}}
 */
function captureOutput() {
  const output = { stdout: '', stderr: '' };
  const writes = { stdout: process.stdout.write, stderr: process.stderr.write };
  // The CLI writes strings; the test runner's own frames are buffers and
  // pass through, or a run that waits on a retry's backoff would eat them.
  for (const stream of ['stdout', 'stderr']) {
    process[stream].write = (chunk, ...rest) => {
      if (typeof chunk !== 'string') return writes[stream].call(process[stream], chunk, ...rest);
      output[stream] += chunk;
      return true;
    };
  }
  return {
    output,
    restore: () => {
      process.stdout.write = writes.stdout;
      process.stderr.write = writes.stderr;
    },
  };
}

describe('knowledge bulk index — keywords in one write, then vectors batch by batch', () => {
  let root;
  let cwd0;
  let output;
  let restore;

  beforeEach(() => {
    root = buildProject();
    cwd0 = process.cwd();
    process.chdir(root);
    const captured = captureOutput();
    output = Object.assign(captured.output, { loads: 0, saves: 0 });
    store.loadStore = (...args) => { output.loads += 1; return loadStore(...args); };
    store.saveStore = (...args) => { output.saves += 1; return saveStore(...args); };
    restore = () => {
      captured.restore();
      store.loadStore = loadStore;
      store.saveStore = saveStore;
      store.withLock = withLock;
    };
  });

  afterEach(() => {
    restore();
    process.chdir(cwd0);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /** Index every topic once, then edit each so the next run finds all three changed. */
  async function indexThenEditAll() {
    await cmdIndexBulk({}, CFG, spyProvider());
    for (const topic of TOPICS) writeDiscussion(root, topic, `The ${topic} decision, revised.`);
    output.stdout = '';
    output.loads = 0;
    output.saves = 0;
  }

  it('loads the store once, saves the keyword side once, then once per batch of vectors', async () => {
    await indexThenEditAll();
    const summary = await cmdIndexBulk({}, CFG, spyProvider());
    assert.deepStrictEqual(summary, { new: 0, changed: 3, removed: 0, unchanged: 0, failed: 0, awaiting: 0 });
    assert.strictEqual(output.loads, 1);
    assert.strictEqual(output.saves, 2);
  });

  it('embeds every new and changed file in one batch', async () => {
    const provider = spyProvider();
    await cmdIndexBulk({}, CFG, provider);
    assert.strictEqual(provider.batches.length, 1);
    for (const topic of TOPICS) {
      assert.ok(provider.batches[0].some((text) => text.includes(`The ${topic} decision.`)), topic);
    }
  });

  it('writes the keyword side before any embed: a provider failing its first call leaves every new file searchable by keyword', async () => {
    const summary = await cmdIndexBulk({}, CFG, spyProvider({ answers: 0 }));
    assert.deepStrictEqual(summary, { new: 3, changed: 0, removed: 0, unchanged: 0, failed: 0, awaiting: 3 });
    const db = loadStore(storeFile(root));
    for (const topic of TOPICS) {
      assert.deepStrictEqual(store.searchKeyword(db, { term: topic }).map((hit) => hit.topic), [topic]);
      assert.match(output.stderr, new RegExp(`^Failed to embed \\.workflows/payments/discussion/${topic}\\.md: request refused: the account is out of quota \\(HTTP 429\\)$`, 'm'));
    }
    assert.strictEqual(store.chunksWithoutVector(db).length, 3);
    assert.match(output.stderr, /^Each is searchable by keyword; its vectors come at the next start\.$/m);
    assert.match(output.stdout, /^3 new, 0 changed, 0 removed, 0 unchanged, 3 chunks awaiting vectors\.$/m);
    assert.strictEqual(output.saves, 1, 'the keyword side alone');
  });

  it('embeds, at the next bulk index, only the chunks awaiting vectors', async () => {
    await cmdIndexBulk({}, CFG, spyProvider());
    writeDiscussion(root, 'alpha', 'The alpha decision, revised.');
    await cmdIndexBulk({}, CFG, spyProvider({ answers: 0 }));
    const provider = spyProvider();
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0 });
    assert.strictEqual(provider.batches.length, 1);
    assert.strictEqual(provider.batches[0].length, 1);
    assert.match(provider.batches[0][0], /The alpha decision, revised\./);
    assert.strictEqual(store.chunksWithoutVector(loadStore(storeFile(root))).length, 0);
  });

  it('keeps every vector that landed when a later batch fails', async () => {
    writeDiscussion(root, 'alpha', sectioned(Array.from({ length: 101 }, (_, i) => `Ruling ${i}.`)));
    const provider = spyProvider({ answers: 1 });
    const summary = await cmdIndexBulk({}, CFG, provider);
    const alpha = chunksFor(root, 'alpha');
    assert.deepStrictEqual(provider.batches.map((batch) => batch.length), [alpha.length, 2], 'alpha alone past a batch, then beta and gamma');
    assert.strictEqual(summary.awaiting, 2);
    const db = loadStore(storeFile(root));
    const vectors = store.vectorsByContentHash(db);
    for (const chunk of alpha) assert.ok(vectors.has(chunk.content_hash), chunk.id);
    assert.deepStrictEqual(store.chunksWithoutVector(db).map((chunk) => chunk.topic), ['beta', 'gamma']);
  });

  it('falls back to file by file when the endpoint refuses an input, so the refused file awaits its vectors alone', async () => {
    const provider = spyProvider({ refuse: (text) => text.includes('beta') });
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 3, changed: 0, removed: 0, unchanged: 0, failed: 0, awaiting: 1 });
    assert.strictEqual(provider.batches.length, 1 + TOPICS.length);
    assert.match(output.stderr, /^Failed to embed \.workflows\/payments\/discussion\/beta\.md: HTTP 400: input refused$/m);
    assert.strictEqual(chunksFor(root, 'beta').length, 1, 'written by keyword');
    assert.deepStrictEqual(store.chunksWithoutVector(loadStore(storeFile(root))).map((chunk) => chunk.topic), ['beta']);
    assert.strictEqual(output.saves, 2);
  });

  it('fails every file in a batch that failed transiently, with no per-file calls, and still retires', async (t) => {
    await indexThenEditAll();
    fs.rmSync(discussionPath(root, 'gamma'));
    const provider = spyProvider({ unreachable: true });
    const summary = await withoutBackoff(t, () => cmdIndexBulk({}, CFG, provider));
    assert.deepStrictEqual(summary, { new: 0, changed: 2, removed: 1, unchanged: 0, failed: 0, awaiting: 2 });
    assert.strictEqual(provider.batches.length, 3, 'the one batch, retried — never file by file');
    for (const batch of provider.batches) assert.strictEqual(batch.length, 2);
    for (const topic of ['alpha', 'beta']) {
      assert.match(output.stderr, new RegExp(`^Failed to embed \\.workflows/payments/discussion/${topic}\\.md: embedding request failed \\(network error\\): fetch failed$`, 'm'));
      assert.match(chunksFor(root, topic)[0].content, /revised/, `${topic}'s edit is searchable by keyword`);
    }
    assert.match(output.stdout, /^Removed \.workflows\/payments\/discussion\/gamma\.md — 1 chunks \(source deleted\)$/m);
    assert.strictEqual(chunksFor(root, 'gamma').length, 0);
    assert.strictEqual(output.saves, 1, 'the keyword side, and no vectors to save');
  });

  it("reloads under the lock when a peer wrote the store mid-run, keeping the peer's write", async () => {
    await indexThenEditAll();
    const peerWrite = async () => {
      writeDiscussion(root, 'peer', 'A peer indexed this.');
      setItemStatus(root, 'peer', 'completed');
      const db = loadStore(storeFile(root));
      store.insertDocument(db, {
        id: 'payments-discussion-peer-001', content: 'A peer indexed this.', work_unit: 'payments', work_type: 'epic',
        phase: 'discussion', topic: 'peer', confidence: 'medium', source_file: '.workflows/payments/discussion/peer.md',
        timestamp: Date.now(), embedding: new StubProvider({ dimensions: CFG.dimensions }).embed('peer'),
      });
      saveStore(db, storeFile(root));
    };
    const summary = await cmdIndexBulk({}, CFG, spyProvider({ during: peerWrite }));
    assert.strictEqual(summary.changed, 3);
    assert.strictEqual(output.loads, 2, 'the plan read, then the reload under the lock the vectors are saved under');
    assert.strictEqual(chunksFor(root, 'peer').length, 1);
    assert.ok(chunksFor(root, 'alpha')[0].content.includes('revised'));
    assert.strictEqual(store.chunksWithoutVector(loadStore(storeFile(root))).length, 0);
  });

  it('removes a topic retired before the write took the lock, in the same run', async () => {
    await indexThenEditAll();
    let retiring = true;
    store.withLock = (lockPath, fn) => {
      if (retiring) setItemStatus(root, 'beta', 'cancelled');
      retiring = false;
      return withLock(lockPath, fn);
    };
    const summary = await cmdIndexBulk({}, CFG, spyProvider());
    assert.deepStrictEqual(summary, { new: 0, changed: 2, removed: 1, unchanged: 0, failed: 0, awaiting: 0 });
    assert.match(output.stdout, /^Removed \.workflows\/payments\/discussion\/beta\.md — 1 chunks \(discussion cancelled\)$/m);
    assert.doesNotMatch(output.stdout, /^Indexed \.workflows\/payments\/discussion\/beta\.md/m);
    assert.strictEqual(chunksFor(root, 'beta').length, 0);
  });

  it('touches nothing when the store is already in line', async () => {
    await cmdIndexBulk({}, CFG, spyProvider());
    output.loads = 0;
    output.saves = 0;
    const provider = spyProvider();
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0 });
    assert.strictEqual(provider.batches.length, 0);
    assert.strictEqual(output.saves, 0);
  });

  it('takes a configured provider into a keyword-only store, and embeds every chunk', async () => {
    fs.writeFileSync(path.join(root, '.workflows', '.knowledge', 'config.json'), '{ "knowledge": { "provider": null } }\n');
    await cmdIndexBulk({}, { provider: null }, null);
    const metadata = () => JSON.parse(fs.readFileSync(path.join(root, '.workflows', '.knowledge', 'metadata.json'), 'utf8'));
    assert.strictEqual(metadata().provider, null);
    const provider = spyProvider();
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0 });
    assert.deepStrictEqual(provider.batches.map((batch) => batch.length), [3]);
    const { provider: name, model, dimensions } = metadata();
    assert.deepStrictEqual({ name, model, dimensions }, { name: 'stub', model: 'stub', dimensions: CFG.dimensions });
    assert.strictEqual(store.chunksWithoutVector(loadStore(storeFile(root))).length, 0);
  });
});

describe('knowledge index — vectors keyed by their text', () => {
  let root;
  let cwd0;
  let restore;

  beforeEach(async () => {
    root = buildProject();
    cwd0 = process.cwd();
    process.chdir(root);
    restore = captureOutput().restore;
    writeDiscussion(root, 'alpha', sectioned(['The first ruling.', 'The second ruling.', 'The third ruling.']));
    await cmdIndexBulk({}, CFG, spyProvider());
    writeDiscussion(root, 'alpha', sectioned(['The first ruling.', 'The second ruling, revised.', 'The third ruling.']));
  });

  afterEach(() => {
    restore();
    process.chdir(cwd0);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /** Every alpha chunk carries the vector of its own text. */
  function assertAlphaVectored() {
    const vectors = store.vectorsByContentHash(loadStore(storeFile(root)));
    const alpha = chunksFor(root, 'alpha');
    assert.ok(alpha.length >= 3);
    for (const chunk of alpha) assert.ok(vectors.has(chunk.content_hash), chunk.id);
  }

  it('the bulk index embeds only the chunk whose text changed', async () => {
    const provider = spyProvider();
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 1, removed: 0, unchanged: 2, failed: 0, awaiting: 0 });
    assert.strictEqual(provider.batches.length, 1);
    assert.strictEqual(provider.batches[0].length, 1);
    assert.match(provider.batches[0][0], /The second ruling, revised\./);
    assertAlphaVectored();
  });

  it('the single-file index embeds only the chunk whose text changed', async () => {
    const provider = spyProvider();
    const identity = { workUnit: 'payments', phase: 'discussion', topic: 'alpha' };
    await indexSingleFile('.workflows/payments/discussion/alpha.md', identity, CFG, provider);
    assert.strictEqual(provider.batches.length, 1);
    assert.strictEqual(provider.batches[0].length, 1);
    assert.match(provider.batches[0][0], /The second ruling, revised\./);
    assertAlphaVectored();
  });

  it('a new file whose text the store already holds reaches no provider', async () => {
    fs.copyFileSync(discussionPath(root, 'beta'), discussionPath(root, 'delta'));
    setItemStatus(root, 'delta', 'completed');
    writeDiscussion(root, 'alpha', sectioned(['The first ruling.', 'The second ruling.', 'The third ruling.']));
    const provider = spyProvider();
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 1, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0 });
    assert.strictEqual(provider.batches.length, 0);
    const [delta] = chunksFor(root, 'delta');
    assert.ok(store.vectorsByContentHash(loadStore(storeFile(root))).has(delta.content_hash));
  });

  it('the single-file index writes a chunk whose embed fails by keyword, and names the failure', async () => {
    const identity = { workUnit: 'payments', phase: 'discussion', topic: 'alpha' };
    const indexed = await indexSingleFile('.workflows/payments/discussion/alpha.md', identity, CFG, spyProvider({ answers: 0 }));
    assert.deepStrictEqual(indexed.unembedded.map(({ file, error }) => [file, error.name]), [['.workflows/payments/discussion/alpha.md', 'QuotaError']]);
    assert.strictEqual(indexed.chunks, chunksFor(root, 'alpha').length);
    const db = loadStore(storeFile(root));
    const awaiting = store.chunksWithoutVector(db);
    assert.strictEqual(awaiting.length, 1);
    assert.match(awaiting[0].content, /The second ruling, revised\./);
    assert.ok(store.searchKeyword(db, { term: 'revised' }).some((hit) => hit.topic === 'alpha'), 'searchable by keyword at once');
  });
});

describe('knowledge index — a key that does not resolve', () => {
  const OPENAI = { provider: 'openai', model: 'text-embedding-3-small', dimensions: CFG.dimensions };
  const KEY_FIX = 'the openai API key could not be resolved; export OPENAI_API_KEY, or run knowledge setup --key-only';
  const keyed = () => spyProvider({ model: OPENAI.model });
  let root;
  let cwd0;
  let output;
  let restore;

  beforeEach(async () => {
    root = buildProject();
    cwd0 = process.cwd();
    process.chdir(root);
    ({ output, restore } = captureOutput());
    await cmdIndexBulk({}, OPENAI, keyed());
    output.stderr = '';
  });

  afterEach(() => {
    restore();
    process.chdir(cwd0);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('writes a changed file by keyword at a single-file index, naming the key', async () => {
    writeDiscussion(root, 'alpha', 'The alpha decision, revised.');
    const identity = { workUnit: 'payments', phase: 'discussion', topic: 'alpha' };
    const indexed = await indexSingleFile('.workflows/payments/discussion/alpha.md', identity, OPENAI, null);
    assert.deepStrictEqual(indexed.unembedded.map(({ file, error }) => [file, error.message]), [['.workflows/payments/discussion/alpha.md', KEY_FIX]]);
    const db = loadStore(storeFile(root));
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'revised' }).map((hit) => hit.topic), ['alpha']);
    assert.deepStrictEqual(store.chunksWithoutVector(db).map((chunk) => chunk.topic), ['alpha']);
  });

  it('writes every changed file by keyword at a bulk index, and the next with the key fills their vectors', async () => {
    for (const topic of ['alpha', 'beta']) writeDiscussion(root, topic, `The ${topic} decision, revised.`);
    const keyless = await cmdIndexBulk({}, OPENAI, null);
    assert.deepStrictEqual(keyless, { new: 0, changed: 2, removed: 0, unchanged: 1, failed: 0, awaiting: 2 });
    for (const topic of ['alpha', 'beta']) {
      assert.ok(output.stderr.includes(`Failed to embed .workflows/payments/discussion/${topic}.md: ${KEY_FIX}\n`), topic);
    }
    assert.deepStrictEqual(store.searchKeyword(loadStore(storeFile(root)), { term: 'revised' }).map((hit) => hit.topic).sort(), ['alpha', 'beta']);

    const provider = keyed();
    const filled = await cmdIndexBulk({}, OPENAI, provider);
    assert.deepStrictEqual(filled, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0 });
    assert.deepStrictEqual(provider.batches.map((batch) => batch.length), [2]);
  });

  it('still refuses a store built with another model, and a config that dropped its provider', async () => {
    const large = { ...OPENAI, model: 'text-embedding-3-large' };
    await assert.rejects(cmdIndexBulk({}, large, spyProvider({ model: large.model })), /^UserError: Provider\/model changed since last index/);
    await assert.rejects(cmdIndexBulk({}, {}, null), /Current config has no provider configured/);
  });
});

describe('knowledge index — the CLI, without a vector', () => {
  let endpoint;
  let root;

  /** @param {Record<string, any>} knowledge */
  function configure(knowledge) {
    writeJson(path.join(root, '.workflows', '.knowledge', 'config.json'), { knowledge });
  }

  function metadata() {
    return JSON.parse(fs.readFileSync(path.join(root, '.workflows', '.knowledge', 'metadata.json'), 'utf8'));
  }

  /** @param {...string} args */
  const cli = (...args) => knowledgeCli(root, args);

  before(async () => {
    endpoint = await embeddingEndpoint(8);
  });

  after(() => endpoint.close());

  beforeEach(() => {
    root = buildProject();
    configure(endpoint.config);
    endpoint.mode = 'ok';
    endpoint.requests.length = 0;
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('a file whose embed fails is written by keyword, and the index exits non-zero saying so', async () => {
    endpoint.mode = 'quota';
    const indexed = await cli('index', '.workflows/payments/discussion/alpha.md');
    assert.strictEqual(indexed.code, 1);
    assert.strictEqual(indexed.stdout, 'Indexed 1 chunks from .workflows/payments/discussion/alpha.md\n');
    assert.match(indexed.stderr, /^Failed to embed \.workflows\/payments\/discussion\/alpha\.md: Embeddings endpoint request refused: the account is out of quota \(HTTP 429\)\. .*\nThe file is searchable by keyword; its vectors come at the next start\.\n$/);

    endpoint.mode = 'ok';
    const queried = await cli('query', 'the alpha decision');
    assert.strictEqual(queried.code, 0);
    assert.match(queried.stdout, /^\[1 chunks await vectors — searched by keyword alone until the next start embeds them\]\n\[1 results\]\n/);
    assert.match(queried.stdout, /^\[discussion \| payments\/alpha \|/m);
    assert.match((await cli('status')).stdout, /^Chunks awaiting vectors: 1$/m);
  });

  it('a bulk index that cannot embed exits non-zero, and the next embeds only what awaits', async () => {
    endpoint.mode = 'quota';
    const failed = await cli('index');
    assert.strictEqual(failed.code, 1);
    assert.match(failed.stdout, /^3 new, 0 changed, 0 removed, 0 unchanged, 3 chunks awaiting vectors\.$/m);
    assert.match(failed.stderr, /^Each is searchable by keyword; its vectors come at the next start\.$/m);
    assert.match((await cli('status')).stdout, /^Chunks awaiting vectors: 3$/m);

    endpoint.mode = 'ok';
    endpoint.requests.length = 0;
    const filled = await cli('index');
    assert.strictEqual(filled.code, 0);
    assert.strictEqual(filled.stdout, '0 new, 0 changed, 0 removed, 3 unchanged.\n');
    assert.deepStrictEqual(endpoint.requests.map((texts) => texts.length), [3]);
    assert.match((await cli('status')).stdout, /^Chunks awaiting vectors: 0$/m);
  });

  it('a keyword-only store takes the provider configured over it at the next bulk index, and fills in', async () => {
    configure({ provider: null });
    assert.strictEqual((await cli('index')).code, 0);
    assert.strictEqual(metadata().provider, null);
    assert.deepStrictEqual(endpoint.requests, []);

    configure(endpoint.config);
    const filled = await cli('index');
    assert.strictEqual(filled.code, 0);
    assert.deepStrictEqual(endpoint.requests.map((texts) => texts.length), [3]);
    const { provider, model, dimensions } = metadata();
    assert.deepStrictEqual({ provider, model, dimensions }, { provider: 'openai-compatible', model: 'stand-in', dimensions: 8 });
    const status = (await cli('status')).stdout;
    assert.match(status, /^Chunks awaiting vectors: 0$/m);
    assert.doesNotMatch(status, /rebuild/);
    assert.match((await cli('query', 'the alpha decision')).stdout, /^\[3 results\]\n/);
  });

  it('a project setup --keyword-only pins never takes the provider the machine names', async () => {
    const system = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-system-'));
    writeJson(path.join(system, 'config.json'), { knowledge: endpoint.config });
    fs.rmSync(path.join(root, '.workflows', '.knowledge'), { recursive: true, force: true });
    try {
      const env = { WORKFLOWS_CONFIG_DIR: system };
      assert.strictEqual((await knowledgeCli(root, ['setup', '--keyword-only'], env)).code, 0);
      assert.strictEqual((await knowledgeCli(root, ['index'], env)).code, 0);
      assert.strictEqual(metadata().provider, null);
      assert.deepStrictEqual(endpoint.requests, []);
      assert.match((await knowledgeCli(root, ['query', 'the alpha decision'], env)).stdout,
        /^\[keyword-only mode — configure embedding provider for semantic search\]\n/);
    } finally {
      fs.rmSync(system, { recursive: true, force: true });
    }
  });
});
