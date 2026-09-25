'use strict';

// The bulk index's write: one store load and one save per run, embedding
// batched across files with a per-file fallback, and the run's view of the
// manifests and the store refreshed under the lock before it saves.

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { cmdIndexBulk, store, StubProvider, InvalidRequestError } = require('../../src/knowledge/index');

const { loadStore, saveStore } = store;
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
 * network outage does.
 */
function spyProvider({ refuse = () => false, during = async () => {}, unreachable = false } = {}) {
  const stub = new StubProvider({ dimensions: CFG.dimensions });
  const batches = [];
  return {
    batches,
    model: () => stub.model(),
    dimensions: () => stub.dimensions(),
    embed: (text) => stub.embed(text),
    async embedBatch(texts) {
      batches.push(texts);
      await during();
      if (unreachable) throw new Error('embedding request failed (network error): fetch failed');
      if (texts.some(refuse)) throw new InvalidRequestError('HTTP 400: input refused');
      return stub.embedBatch(texts);
    },
  };
}

async function chunksFor(root, topic) {
  const db = await loadStore(path.join(root, '.workflows', '.knowledge', 'store.msp'));
  return (await store.searchAllFulltext(db)).filter((c) => c.topic === topic);
}

describe('knowledge bulk index — one write per run', () => {
  let root;
  let cwd0;
  let output;
  let restore;

  beforeEach(() => {
    root = buildProject();
    cwd0 = process.cwd();
    process.chdir(root);
    output = { stdout: '', stderr: '', loads: 0, saves: 0 };
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
    store.loadStore = async (...args) => { output.loads += 1; return loadStore(...args); };
    store.saveStore = async (...args) => { output.saves += 1; return saveStore(...args); };
    restore = () => {
      process.stdout.write = writes.stdout;
      process.stderr.write = writes.stderr;
      store.loadStore = loadStore;
      store.saveStore = saveStore;
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

  it('loads the store once and saves it once, however many files changed', async () => {
    await indexThenEditAll();
    const summary = await cmdIndexBulk({}, CFG, spyProvider());
    assert.deepStrictEqual(summary, { new: 0, changed: 3, removed: 0, unchanged: 0, failed: 0 });
    assert.strictEqual(output.loads, 1);
    assert.strictEqual(output.saves, 1);
  });

  it('embeds every new and changed file in one batch', async () => {
    const provider = spyProvider();
    await cmdIndexBulk({}, CFG, provider);
    assert.strictEqual(provider.batches.length, 1);
    for (const topic of TOPICS) {
      assert.ok(provider.batches[0].some((text) => text.includes(`The ${topic} decision.`)), topic);
    }
  });

  it('falls back to file by file when the endpoint refuses an input, so the refused file fails alone', async () => {
    const provider = spyProvider({ refuse: (text) => text.includes('beta') });
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 2, changed: 0, removed: 0, unchanged: 0, failed: 1 });
    assert.strictEqual(provider.batches.length, 1 + TOPICS.length);
    assert.match(output.stderr, /^Failed to index \.workflows\/payments\/discussion\/beta\.md: HTTP 400: input refused$/m);
    assert.strictEqual((await chunksFor(root, 'alpha')).length, 1);
    assert.strictEqual((await chunksFor(root, 'beta')).length, 0);
    assert.strictEqual(output.saves, 1);
  });

  it('fails every file in a batch that failed transiently, with no per-file calls, and still retires', async () => {
    await indexThenEditAll();
    fs.rmSync(discussionPath(root, 'gamma'));
    const provider = spyProvider({ unreachable: true });
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 1, unchanged: 0, failed: 2 });
    assert.strictEqual(provider.batches.length, 3, 'the one batch, retried — never file by file');
    for (const batch of provider.batches) assert.strictEqual(batch.length, 2);
    for (const topic of ['alpha', 'beta']) {
      assert.match(output.stderr, new RegExp(`^Failed to index \\.workflows/payments/discussion/${topic}\\.md: embedding request failed \\(network error\\): fetch failed$`, 'm'));
      assert.doesNotMatch((await chunksFor(root, topic))[0].content, /revised/, `${topic} keeps its indexed content`);
    }
    assert.match(output.stdout, /^Removed \.workflows\/payments\/discussion\/gamma\.md — 1 chunks \(source deleted\)$/m);
    assert.strictEqual((await chunksFor(root, 'gamma')).length, 0);
    assert.strictEqual(output.saves, 1);
  });

  it("reloads under the lock when a peer wrote the store mid-run, keeping the peer's write", async () => {
    await indexThenEditAll();
    const sp = path.join(root, '.workflows', '.knowledge', 'store.msp');
    const peerWrite = async () => {
      writeDiscussion(root, 'peer', 'A peer indexed this.');
      setItemStatus(root, 'peer', 'completed');
      const db = await loadStore(sp);
      await store.insertDocument(db, {
        id: 'payments-discussion-peer-001', content: 'A peer indexed this.', work_unit: 'payments', work_type: 'epic',
        phase: 'discussion', topic: 'peer', confidence: 'medium', source_file: '.workflows/payments/discussion/peer.md',
        timestamp: Date.now(), embedding: new StubProvider({ dimensions: CFG.dimensions }).embed('peer'),
      });
      await saveStore(db, sp);
    };
    const summary = await cmdIndexBulk({}, CFG, spyProvider({ during: peerWrite }));
    assert.strictEqual(summary.changed, 3);
    assert.strictEqual(output.loads, 2, 'the plan read, then the reload under the lock');
    assert.strictEqual((await chunksFor(root, 'peer')).length, 1);
    assert.ok((await chunksFor(root, 'alpha'))[0].content.includes('revised'));
  });

  it('removes a topic retired while the run embedded, in the same run', async () => {
    await indexThenEditAll();
    const summary = await cmdIndexBulk({}, CFG, spyProvider({ during: async () => setItemStatus(root, 'beta', 'cancelled') }));
    assert.deepStrictEqual(summary, { new: 0, changed: 2, removed: 1, unchanged: 0, failed: 0 });
    assert.match(output.stdout, /^Removed \.workflows\/payments\/discussion\/beta\.md — 1 chunks \(discussion cancelled\)$/m);
    assert.doesNotMatch(output.stdout, /^Indexed \.workflows\/payments\/discussion\/beta\.md/m);
    assert.strictEqual((await chunksFor(root, 'beta')).length, 0);
  });

  it('touches nothing when the store is already in line', async () => {
    await cmdIndexBulk({}, CFG, spyProvider());
    output.loads = 0;
    output.saves = 0;
    const provider = spyProvider();
    const summary = await cmdIndexBulk({}, CFG, provider);
    assert.deepStrictEqual(summary, { new: 0, changed: 0, removed: 0, unchanged: 3, failed: 0 });
    assert.strictEqual(provider.batches.length, 0);
    assert.strictEqual(output.saves, 0);
  });
});
