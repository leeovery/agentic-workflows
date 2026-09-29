'use strict';

// The bulk index's write: the keyword side of everything new and changed in
// one save, then the chunks without a vector embedded batch by batch — across
// files, falling back per file and then per text, only the text the store
// lacks sent to the provider — each batch saved as it lands; and the run's
// view of the manifests and the store refreshed under the lock before each
// save. A single-file index writes the keyword side alone, the vectors left to
// the fill it launches.

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { CHUNKER_VERSION } = require('../../skills/workflow-engine/scripts/kernel/knowledge/chunker.cjs');
const { StubProvider } = require('../../skills/workflow-engine/scripts/kernel/knowledge/embeddings.cjs');
const { InvalidRequestError, QuotaError } = require('../../skills/workflow-engine/scripts/kernel/knowledge/providers/openai-engine.cjs');
const { indexBulk } = require('../../skills/workflow-engine/scripts/domain/knowledge/bulk.cjs');
const { indexPath } = require('../../skills/workflow-engine/scripts/domain/knowledge/indexing.cjs');
const { embeddingEndpoint, engineKnowledge, heldCall, recordLaunches, withoutBackoff } = require('./knowledge-harness.cjs');

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

/**
 * A feature beside the epic, registered, its discussion completed and on disk.
 * @param {string} root @param {string} name @param {Record<string, any>} [unit]  over the manifest's own fields
 */
function addFeature(root, name, unit = {}) {
  const registry = path.join(root, '.workflows', 'manifest.json');
  const project = JSON.parse(fs.readFileSync(registry, 'utf8'));
  project.work_units[name] = { work_type: 'feature' };
  writeJson(registry, project);
  writeJson(path.join(root, '.workflows', name, 'manifest.json'), {
    name, work_type: 'feature', status: 'in-progress', created: '2026-01-01', ...unit,
    phases: { discussion: { items: { [name]: { status: 'completed' } } } },
  });
  const file = path.join(root, '.workflows', name, 'discussion', `${name}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# ${name}\n\nThe ${name} decision.\n`);
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
  return path.join(root, '.workflows', '.knowledge', 'store.bin');
}

function chunksFor(root, topic) {
  return store.allChunks(loadStore(storeFile(root))).filter((c) => c.topic === topic);
}

/** The topics of the chunks awaiting a vector, in store order. */
function awaitingTopics(root) {
  return store.chunksWithoutVector(loadStore(storeFile(root))).map((chunk) => chunk.topic);
}

/** A discussion long enough to chunk by its sections, one chunk per body. */
function sectioned(bodies) {
  const filler = Array.from({ length: 20 }, (_, i) => `Line ${i} of the reasoning.`).join('\n');
  return bodies.map((body, i) => `## Section ${i + 1}\n\n${body}\n\n${filler}`).join('\n\n');
}

/**
 * The bulk index over `root`, its output gathered into `output`.
 * @param {string} root @param {{stdout: string, stderr: string}} output
 * @param {Record<string, any>} cfg @param {object|null} provider @param {string|null} [scope]
 */
function bulk(root, output, cfg, provider, scope = null) {
  const { call, output: held } = heldCall(root);
  return indexBulk(call, root, { cfg, provider }, scope).finally(() => {
    output.stdout += held.stdout;
    output.stderr += held.stderr;
  });
}

/** The single-file index of one of the epic's discussions. @param {string} root @param {string} topic */
function indexOne(root, topic, cfg = CFG, provider = null) {
  return indexPath(root, `.workflows/payments/discussion/${topic}.md`, { cfg, provider });
}

describe('knowledge bulk index — keywords in one write, then vectors batch by batch', () => {
  let root;
  let output;

  beforeEach(() => {
    root = buildProject();
    output = { stdout: '', stderr: '', loads: 0, saves: 0 };
    store.loadStore = (...args) => { output.loads += 1; return loadStore(...args); };
    store.saveStore = (...args) => { output.saves += 1; return saveStore(...args); };
  });

  afterEach(() => {
    store.loadStore = loadStore;
    store.saveStore = saveStore;
    store.withLock = withLock;
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /** Index every topic once, then edit each so the next run finds all three changed. */
  async function indexThenEditAll() {
    await bulk(root, output, CFG, spyProvider());
    for (const topic of TOPICS) writeDiscussion(root, topic, `The ${topic} decision, revised.`);
    output.stdout = '';
    output.loads = 0;
    output.saves = 0;
  }

  it('loads the store once, saves the keyword side once, then once per batch of vectors', async () => {
    await indexThenEditAll();
    const summary = await bulk(root, output, CFG, spyProvider());
    assert.deepStrictEqual(summary, { new: 0, changed: 3, removed: 0, unchanged: 0, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.strictEqual(output.loads, 1);
    assert.strictEqual(output.saves, 2);
  });

  it('embeds every new and changed file in one batch', async () => {
    const provider = spyProvider();
    await bulk(root, output, CFG, provider);
    assert.strictEqual(provider.batches.length, 1);
    for (const topic of TOPICS) {
      assert.ok(provider.batches[0].some((text) => text.includes(`The ${topic} decision.`)), topic);
    }
  });

  it('reads each manifest once to plan and once to retire — never once per artifact', async (t) => {
    const reads = new Map();
    const readFileSync = fs.readFileSync;
    t.mock.method(fs, 'readFileSync', (file, ...rest) => {
      if (String(file).endsWith('manifest.json')) reads.set(path.relative(root, String(file)), (reads.get(path.relative(root, String(file))) || 0) + 1);
      return readFileSync(file, ...rest);
    });
    await bulk(root, output, CFG, spyProvider());
    t.mock.restoreAll();
    assert.deepStrictEqual(Object.fromEntries(reads), { '.workflows/manifest.json': 2, '.workflows/payments/manifest.json': 2 });
  });

  it('writes the keyword side before any embed: a provider failing its first call leaves every new file searchable by keyword', async () => {
    const summary = await bulk(root, output, CFG, spyProvider({ answers: 0 }));
    assert.deepStrictEqual(summary, { new: 3, changed: 0, removed: 0, unchanged: 0, failed: 0, awaiting: 3, keyUnresolved: false });
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
    await bulk(root, output, CFG, spyProvider());
    writeDiscussion(root, 'alpha', 'The alpha decision, revised.');
    await bulk(root, output, CFG, spyProvider({ answers: 0 }));
    const provider = spyProvider();
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.strictEqual(provider.batches.length, 1);
    assert.strictEqual(provider.batches[0].length, 1);
    assert.match(provider.batches[0][0], /The alpha decision, revised\./);
    assert.strictEqual(store.chunksWithoutVector(loadStore(storeFile(root))).length, 0);
  });

  it('keeps every vector that landed when a later batch fails', async () => {
    writeDiscussion(root, 'alpha', sectioned(Array.from({ length: 101 }, (_, i) => `Ruling ${i}.`)));
    const provider = spyProvider({ answers: 1 });
    const summary = await bulk(root, output, CFG, provider);
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
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 3, changed: 0, removed: 0, unchanged: 0, failed: 0, awaiting: 1, keyUnresolved: false });
    assert.strictEqual(provider.batches.length, 1 + TOPICS.length);
    assert.match(output.stderr, /^Failed to embed \.workflows\/payments\/discussion\/beta\.md: HTTP 400: input refused$/m);
    assert.strictEqual(chunksFor(root, 'beta').length, 1, 'written by keyword');
    assert.deepStrictEqual(store.chunksWithoutVector(loadStore(storeFile(root))).map((chunk) => chunk.topic), ['beta']);
    assert.strictEqual(output.saves, 2);
  });

  it('falls back to text by text within a file the endpoint refused, so its other chunks get their vectors', async () => {
    writeDiscussion(root, 'alpha', sectioned(['The first ruling.', 'The second ruling.', 'The third ruling.']));
    const summary = await bulk(root, output, CFG, spyProvider({ refuse: (text) => text.includes('The second ruling.') }));
    assert.deepStrictEqual(summary, { new: 3, changed: 0, removed: 0, unchanged: 0, failed: 0, awaiting: 1, keyUnresolved: false });
    const [refused] = store.chunksWithoutVector(loadStore(storeFile(root)));
    assert.match(refused.content, /The second ruling\./);
    assert.strictEqual(chunksFor(root, 'alpha').length, 3);
    assert.strictEqual(output.stderr, [
      'Failed to embed .workflows/payments/discussion/alpha.md: HTTP 400: input refused',
      'Each is searchable by keyword; a chunk the endpoint refused goes without a vector.',
    ].join('\n') + '\n');
  });

  it('embeds the batches after one whose input the endpoint refused', async () => {
    writeDiscussion(root, 'alpha', sectioned(Array.from({ length: 101 }, (_, i) => `Ruling ${i}.`)));
    const summary = await bulk(root, output, CFG, spyProvider({ refuse: (text) => text.includes('Ruling 50.') }));
    assert.strictEqual(summary.awaiting, 1);
    assert.deepStrictEqual(awaitingTopics(root), ['alpha']);
    for (const topic of ['beta', 'gamma']) {
      assert.ok(store.vectorsByContentHash(loadStore(storeFile(root))).has(chunksFor(root, topic)[0].content_hash), topic);
    }
  });

  it('re-indexes a file the chunker now cuts otherwise while a chunk of it awaits its vector', async () => {
    await bulk(root, output, CFG, spyProvider({ refuse: (text) => text.includes('beta') }));
    const db = loadStore(storeFile(root));
    const [beta] = chunksFor(root, 'beta');
    store.removeByIdentity(db, beta);
    store.insertDocument(db, { ...beta, content: 'An earlier cut of the beta decision.' });
    saveStore(db, storeFile(root));
    output.stdout = '';

    const summary = await bulk(root, output, CFG, spyProvider());
    assert.deepStrictEqual(summary, { new: 0, changed: 1, removed: 0, unchanged: 2, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.match(output.stdout, /^Indexed \.workflows\/payments\/discussion\/beta\.md — 1 chunks \(changed\)$/m);
    assert.match(chunksFor(root, 'beta')[0].content, /The beta decision\./);
  });

  it('leaves unchanged a file the endpoint refused a chunk of, while the chunker cuts it the same', async () => {
    const refusing = () => spyProvider({ refuse: (text) => text.includes('beta') });
    await bulk(root, output, CFG, refusing());
    output.stdout = '';
    output.saves = 0;
    const summary = await bulk(root, output, CFG, refusing());
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 1, keyUnresolved: false });
    assert.doesNotMatch(output.stdout, /^Indexed /m);
    assert.strictEqual(output.saves, 0);
  });

  it('embeds a text two files share once, though the files land in different batches', async () => {
    writeDiscussion(root, 'alpha', sectioned(Array.from({ length: 101 }, (_, i) => `Ruling ${i}.`)));
    fs.copyFileSync(discussionPath(root, 'alpha'), discussionPath(root, 'delta'));
    setItemStatus(root, 'delta', 'completed');
    const provider = spyProvider();
    await bulk(root, output, CFG, provider);
    const sent = provider.batches.flat();
    assert.strictEqual(sent.length, new Set(sent).size);
    assert.deepStrictEqual(awaitingTopics(root), []);
  });

  it("embeds a scoped bulk index's own work unit alone", async () => {
    addFeature(root, 'billing');
    await bulk(root, output, CFG, spyProvider({ answers: 0 }));
    const provider = spyProvider();
    await bulk(root, output, CFG, provider, 'billing');
    assert.deepStrictEqual(provider.batches, [[chunksFor(root, 'billing')[0].content]]);
    assert.deepStrictEqual(awaitingTopics(root), TOPICS);
  });

  it('a single-file index writes the keyword side alone, reaching no provider', () => {
    const provider = spyProvider();
    const written = indexOne(root, 'alpha', CFG, provider);
    assert.strictEqual(written.chunks, 1);
    assert.deepStrictEqual(provider.batches, []);
    assert.deepStrictEqual(awaitingTopics(root), ['alpha']);
    assert.deepStrictEqual(store.searchKeyword(loadStore(storeFile(root)), { term: 'alpha' }).map((hit) => hit.topic), ['alpha']);
  });

  it('never embeds the chunks of a unit compact prunes', async () => {
    addFeature(root, 'old', { status: 'completed', completed_at: '2026-01-01' });
    addFeature(root, 'new', { status: 'completed', completed_at: '2026-06-01' });
    await bulk(root, output, CFG, spyProvider({ answers: 0 }));
    const provider = spyProvider();
    await bulk(root, output, { ...CFG, decay_prune_below: 0.99 }, provider);
    assert.deepStrictEqual(awaitingTopics(root), ['old']);
    assert.ok(!provider.batches.flat().some((text) => text.includes('The old decision.')));
  });

  /** A rebuild landing mid-run: the store's recorded embedder rewritten. @param {Record<string, any>} identity */
  const rebuiltAs = (identity) => async () => {
    const file = path.join(root, '.workflows', '.knowledge', 'metadata.json');
    writeJson(file, { ...JSON.parse(fs.readFileSync(file, 'utf8')), ...identity });
  };

  it('refuses to save vectors into a store rebuilt at another width while they were embedded', async () => {
    await assert.rejects(bulk(root, output, CFG, spyProvider({ during: rebuiltAs({ dimensions: 64 }) })),
      /^Error: The store's embedder changed during index \(concurrent rebuild\)\. Embeddings produced by stub \(stub, 128 dimensions\), store now built with stub \(stub, 64 dimensions\)\.$/);
    assert.deepStrictEqual(awaitingTopics(root), TOPICS);
  });

  it('refuses to save vectors into a store rebuilt with another model of the same width', async () => {
    await assert.rejects(bulk(root, output, CFG, spyProvider({ during: rebuiltAs({ model: 'another' }) })),
      /^Error: The store's embedder changed during index \(concurrent rebuild\)\. Embeddings produced by stub \(stub, 128 dimensions\), store now built with stub \(another, 128 dimensions\)\.$/);
    assert.deepStrictEqual(awaitingTopics(root), TOPICS);
  });

  it('fails every file in a batch that failed transiently, with no per-file calls, and still retires', async (t) => {
    await indexThenEditAll();
    fs.rmSync(discussionPath(root, 'gamma'));
    const provider = spyProvider({ unreachable: true });
    const summary = await withoutBackoff(t, () => bulk(root, output, CFG, provider));
    assert.deepStrictEqual(summary, { new: 0, changed: 2, removed: 1, unchanged: 0, failed: 0, awaiting: 2, keyUnresolved: false });
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
        id: 'payments-discussion-peer-001', content: 'A peer indexed this.', heading_path: 'peer', work_unit: 'payments', work_type: 'epic',
        phase: 'discussion', topic: 'peer', confidence: 'medium', source_file: '.workflows/payments/discussion/peer.md',
        timestamp: Date.now(), embedding: new StubProvider({ dimensions: CFG.dimensions }).embed('peer'),
      });
      saveStore(db, storeFile(root));
    };
    const summary = await bulk(root, output, CFG, spyProvider({ during: peerWrite }));
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
    const summary = await bulk(root, output, CFG, spyProvider());
    assert.deepStrictEqual(summary, { new: 0, changed: 2, removed: 1, unchanged: 0, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.match(output.stdout, /^Removed \.workflows\/payments\/discussion\/beta\.md — 1 chunks \(discussion cancelled\)$/m);
    assert.doesNotMatch(output.stdout, /^Indexed \.workflows\/payments\/discussion\/beta\.md/m);
    assert.strictEqual(chunksFor(root, 'beta').length, 0);
  });

  it('touches nothing when the store is already in line', async () => {
    await bulk(root, output, CFG, spyProvider());
    output.loads = 0;
    output.saves = 0;
    const provider = spyProvider();
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.strictEqual(provider.batches.length, 0);
    assert.strictEqual(output.saves, 0);
  });

  it('saves a retokenized store with nothing to index, and embeds nothing', async () => {
    await bulk(root, output, CFG, spyProvider());
    const counting = store.loadStore;
    store.loadStore = (...args) => Object.assign(counting(...args), { retokenized: true });
    output.saves = 0;
    const provider = spyProvider();
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.strictEqual(provider.batches.length, 0);
    assert.strictEqual(output.saves, 1);
  });

  it('takes a configured provider into a keyword-only store, and embeds every chunk', async () => {
    fs.writeFileSync(path.join(root, '.workflows', '.knowledge', 'config.json'), '{ "knowledge": { "provider": null } }\n');
    await bulk(root, output, { provider: null }, null);
    const metadata = () => JSON.parse(fs.readFileSync(path.join(root, '.workflows', '.knowledge', 'metadata.json'), 'utf8'));
    assert.strictEqual(metadata().provider, null);
    const provider = spyProvider();
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.deepStrictEqual(provider.batches.map((batch) => batch.length), [3]);
    const { provider: name, model, dimensions } = metadata();
    assert.deepStrictEqual({ name, model, dimensions }, { name: 'stub', model: 'stub', dimensions: CFG.dimensions });
    assert.strictEqual(store.chunksWithoutVector(loadStore(storeFile(root))).length, 0);
  });
});

describe('knowledge index — vectors keyed by their text', () => {
  let root;
  let output;

  beforeEach(async () => {
    root = buildProject();
    output = { stdout: '', stderr: '' };
    writeDiscussion(root, 'alpha', sectioned(['The first ruling.', 'The second ruling.', 'The third ruling.']));
    await bulk(root, output, CFG, spyProvider());
    writeDiscussion(root, 'alpha', sectioned(['The first ruling.', 'The second ruling, revised.', 'The third ruling.']));
  });

  afterEach(() => {
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
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 1, removed: 0, unchanged: 2, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.strictEqual(provider.batches.length, 1);
    assert.strictEqual(provider.batches[0].length, 1);
    assert.match(provider.batches[0][0], /The second ruling, revised\./);
    assertAlphaVectored();
  });

  it('the single-file index keeps the vector of every text the store holds — the changed chunk alone awaits one', () => {
    const provider = spyProvider();
    indexOne(root, 'alpha', CFG, provider);
    assert.deepStrictEqual(provider.batches, []);
    const awaiting = store.chunksWithoutVector(loadStore(storeFile(root)));
    assert.strictEqual(awaiting.length, 1);
    assert.match(awaiting[0].content, /The second ruling, revised\./);
    assert.ok(store.searchKeyword(loadStore(storeFile(root)), { term: 'revised' }).some((hit) => hit.topic === 'alpha'), 'searchable by keyword at once');
  });

  it('a new file whose text the store already holds reaches no provider', async () => {
    fs.copyFileSync(discussionPath(root, 'beta'), discussionPath(root, 'delta'));
    setItemStatus(root, 'delta', 'completed');
    writeDiscussion(root, 'alpha', sectioned(['The first ruling.', 'The second ruling.', 'The third ruling.']));
    const provider = spyProvider();
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 1, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.strictEqual(provider.batches.length, 0);
    const [delta] = chunksFor(root, 'delta');
    assert.ok(store.vectorsByContentHash(loadStore(storeFile(root))).has(delta.content_hash));
  });
});

describe('knowledge index — chunks another chunker version cut', () => {
  const OPENAI = { provider: 'openai', model: 'text-embedding-3-small', dimensions: CFG.dimensions };
  let root;
  let output;
  let vectors;

  /**
   * Index the epic's discussions under `cfg`, then leave every chunk recording
   * chunker `version` — none where undefined — and no heading path, so a
   * re-cut shows in what the chunk records.
   * @param {number|undefined} version
   */
  async function cutBy(version, cfg = CFG, provider = spyProvider()) {
    await bulk(root, output, cfg, provider);
    const db = loadStore(storeFile(root));
    vectors = store.vectorsByContentHash(db);
    for (const { chunk } of db.entries) {
      chunk.chunker_version = version;
      chunk.heading_path = undefined;
    }
    saveStore(db, storeFile(root));
  }

  /** What each chunk of a topic records of its cut: its chunker version and its heading path. @param {string} topic */
  function cutOf(topic) {
    return chunksFor(root, topic).map((chunk) => [chunk.chunker_version, chunk.heading_path]);
  }

  /** Every chunk records this chunker's version and its heading path, and carries the vector it had. */
  function assertCutByThisChunker() {
    const db = loadStore(storeFile(root));
    for (const chunk of store.allChunks(db)) {
      assert.strictEqual(chunk.chunker_version, CHUNKER_VERSION, chunk.id);
      assert.match(chunk.heading_path, new RegExp(`^${chunk.topic} › Section \\d$`), chunk.id);
    }
    assert.deepStrictEqual(store.chunksWithoutVector(db), []);
    assert.deepStrictEqual(store.vectorsByContentHash(db), vectors);
  }

  beforeEach(() => {
    root = buildProject();
    output = { stdout: '', stderr: '' };
    for (const topic of TOPICS) writeDiscussion(root, topic, sectioned([`The ${topic} ruling.`, `The ${topic} caveat.`, `The ${topic} follow-up.`]));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  for (const [recorded, version] of [['none', undefined], ['another', CHUNKER_VERSION + 1]]) {
    it(`the next keyword pass re-cuts every file whose chunks record ${recorded}, and embeds nothing`, async () => {
      await cutBy(version);
      const provider = spyProvider();
      const summary = await bulk(root, output, CFG, provider);
      assert.deepStrictEqual(summary, { new: 0, changed: 3, removed: 0, unchanged: 0, failed: 0, awaiting: 0, keyUnresolved: false });
      assert.deepStrictEqual(provider.batches, []);
      assertCutByThisChunker();
    });
  }

  it('a single-file index before the pass re-cuts its own file, and leaves every other to the pass', async () => {
    await cutBy(undefined);
    const provider = spyProvider();
    indexOne(root, 'alpha', CFG, provider);
    assert.deepStrictEqual(cutOf('beta'), [[undefined, undefined], [undefined, undefined], [undefined, undefined]]);
    const summary = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 2, removed: 0, unchanged: 1, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.deepStrictEqual(provider.batches, []);
    assertCutByThisChunker();
  });

  it('re-cuts every file under a key that does not resolve, every vector kept and none awaiting', async () => {
    await cutBy(undefined, OPENAI, spyProvider({ model: OPENAI.model }));
    const summary = await bulk(root, output, OPENAI, null);
    assert.deepStrictEqual(summary, { new: 0, changed: 3, removed: 0, unchanged: 0, failed: 0, awaiting: 0, keyUnresolved: true });
    assertCutByThisChunker();
  });

  it('leaves a topic in progress again as it is, and re-cuts it once it concludes', async () => {
    await cutBy(undefined);
    setItemStatus(root, 'alpha', 'in-progress');
    const provider = spyProvider();
    const reopened = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(reopened, { new: 0, changed: 2, removed: 0, unchanged: 0, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.deepStrictEqual(cutOf('alpha'), [[undefined, undefined], [undefined, undefined], [undefined, undefined]]);

    setItemStatus(root, 'alpha', 'completed');
    const concluded = await bulk(root, output, CFG, provider);
    assert.deepStrictEqual(concluded, { new: 0, changed: 1, removed: 0, unchanged: 2, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.deepStrictEqual(provider.batches, []);
    assertCutByThisChunker();
  });
});

describe('knowledge index — a key that does not resolve', () => {
  const OPENAI = { provider: 'openai', model: 'text-embedding-3-small', dimensions: CFG.dimensions };
  const KEY_FIX = 'the openai API key could not be resolved; export OPENAI_API_KEY, or run node .claude/skills/workflow-engine/scripts/engine.cjs knowledge setup --key-only';
  const keyed = () => spyProvider({ model: OPENAI.model });
  let root;
  let output;

  beforeEach(async () => {
    root = buildProject();
    output = { stdout: '', stderr: '' };
    await bulk(root, output, OPENAI, keyed());
    output.stderr = '';
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('writes a changed file by keyword at a single-file index, its store keeping the provider whose key waits', () => {
    writeDiscussion(root, 'alpha', 'The alpha decision, revised.');
    const written = indexOne(root, 'alpha', OPENAI, null);
    assert.strictEqual(written.embedder.missingKey.message, KEY_FIX);
    const db = loadStore(storeFile(root));
    assert.deepStrictEqual(store.searchKeyword(db, { term: 'revised' }).map((hit) => hit.topic), ['alpha']);
    assert.deepStrictEqual(store.chunksWithoutVector(db).map((chunk) => chunk.topic), ['alpha']);
  });

  it('writes every changed file by keyword at a bulk index, and the next with the key fills their vectors', async () => {
    for (const topic of ['alpha', 'beta']) writeDiscussion(root, topic, `The ${topic} decision, revised.`);
    const keyless = await bulk(root, output, OPENAI, null);
    assert.deepStrictEqual(keyless, { new: 0, changed: 2, removed: 0, unchanged: 1, failed: 0, awaiting: 2, keyUnresolved: true });
    for (const topic of ['alpha', 'beta']) {
      assert.ok(output.stderr.includes(`Failed to embed .workflows/payments/discussion/${topic}.md: ${KEY_FIX}\n`), topic);
    }
    assert.deepStrictEqual(store.searchKeyword(loadStore(storeFile(root)), { term: 'revised' }).map((hit) => hit.topic).sort(), ['alpha', 'beta']);

    const provider = keyed();
    const filled = await bulk(root, output, OPENAI, provider);
    assert.deepStrictEqual(filled, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0, awaiting: 0, keyUnresolved: false });
    assert.deepStrictEqual(provider.batches.map((batch) => batch.length), [2]);
  });

  it('still refuses a store built with another model, and a config that dropped its provider', async () => {
    const large = { ...OPENAI, model: 'text-embedding-3-large' };
    await assert.rejects(bulk(root, output, large, spyProvider({ model: large.model })), /^UserError: Provider\/model changed since last index/);
    await assert.rejects(bulk(root, output, {}, null), /Current config has no provider configured/);
  });
});

describe('knowledge index — `engine knowledge index`, without a vector', () => {
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
  const cli = (...args) => engineKnowledge(root, args);

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

  it('a single-file index writes by keyword and launches the fill; a fill that falls short exits non-zero, and a search says why until one lands', async (t) => {
    const launched = recordLaunches(t);
    const indexed = await cli('index', '.workflows/payments/discussion/alpha.md');
    assert.deepStrictEqual(indexed, { code: 0, stdout: 'Indexed 1 chunks from .workflows/payments/discussion/alpha.md\n', stderr: '' });
    assert.deepStrictEqual(launched, [root]);
    assert.deepStrictEqual(endpoint.requests, [], 'the index itself embeds nothing');

    endpoint.mode = 'quota';
    const short = await cli('fill');
    assert.strictEqual(short.code, 1);
    assert.match(short.stderr, /^Failed to embed \.workflows\/payments\/discussion\/alpha\.md: Embeddings endpoint request refused: the account is out of quota \(HTTP 429\)\. .*\nEach is searchable by keyword; its vectors come at the next start\.\n$/);

    endpoint.mode = 'ok';
    const queried = await cli('query', 'the alpha decision');
    assert.strictEqual(queried.code, 0);
    assert.match(queried.stdout, /^\[1 chunks await vectors — searched by keyword alone; each start retries them\]\n\[the last vector fill fell short — \.workflows\/payments\/discussion\/alpha\.md: Embeddings endpoint request refused: the account is out of quota \(HTTP 429\)\. .*\]\n\[1 results\]\n/);
    assert.match((await cli('status')).stdout, /^Chunks awaiting vectors: 1$/m);

    assert.deepStrictEqual(await cli('fill'), { code: 0, stdout: '', stderr: '' });
    assert.strictEqual(metadata().fill_failure, null);
    assert.match((await cli('query', 'the alpha decision')).stdout, /^\[1 results\]\n/);
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

  it('a bulk index over a store whose provider key does not resolve exits non-zero naming the key, with nothing awaiting, and check stays ready', async () => {
    assert.strictEqual((await cli('index')).code, 0);
    const openai = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 8 };
    writeJson(path.join(root, '.workflows', '.knowledge', 'metadata.json'), { ...metadata(), ...openai });
    configure(openai);
    const indexed = await cli('index');
    assert.strictEqual(indexed.code, 1);
    assert.strictEqual(indexed.stdout, '0 new, 0 changed, 0 removed, 3 unchanged.\n');
    assert.strictEqual(indexed.stderr,
      'Cannot embed: the openai API key could not be resolved; export OPENAI_API_KEY, or run node .claude/skills/workflow-engine/scripts/engine.cjs knowledge setup --key-only\n');
    assert.strictEqual((await cli('check')).stdout, 'ready\n');
  });

  it('a rebuild that leaves chunks awaiting vectors exits non-zero', async () => {
    endpoint.mode = 'quota';
    const rebuilt = await engineKnowledge(root, ['rebuild'], {}, 'rebuild\n');
    assert.strictEqual(rebuilt.code, 1);
    assert.match(rebuilt.stdout, /^3 new, 0 changed, 0 removed, 0 unchanged, 3 chunks awaiting vectors\.$/m);
    assert.match((await cli('status')).stdout, /^Chunks awaiting vectors: 3$/m);
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
      assert.strictEqual((await engineKnowledge(root, ['setup', '--keyword-only'], env)).code, 0);
      assert.strictEqual((await engineKnowledge(root, ['index'], env)).code, 0);
      assert.strictEqual(metadata().provider, null);
      assert.deepStrictEqual(endpoint.requests, []);
      assert.match((await engineKnowledge(root, ['query', 'the alpha decision'], env)).stdout,
        /^\[keyword-only mode — configure embedding provider for semantic search\]\n/);
    } finally {
      fs.rmSync(system, { recursive: true, force: true });
    }
  });
});
