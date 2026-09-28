'use strict';

// The background vector fill: the keyword side's writers — a single-file
// index, a transaction's changes, boot — launch it through one launcher, and
// only where a provider that can embed is configured and chunks await
// vectors; one fill works at a time; it saves each vector into the chunks
// whose text it embeds, again over whatever came to await one while it
// worked; and it records why it fell short where the next search reads it,
// clearing that once a fill lands everything.

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { StubProvider } = require('../../skills/workflow-engine/scripts/kernel/knowledge/embeddings.cjs');
const { knowledgeFiles } = require('../../skills/workflow-engine/scripts/kernel/knowledge/files.cjs');
const { processStartTime } = require('../../skills/workflow-engine/scripts/kernel/process.cjs');
const { launcher, fillVectors, fill } = require('../../skills/workflow-engine/scripts/domain/knowledge/vectors.cjs');
const { indexPath } = require('../../skills/workflow-engine/scripts/domain/knowledge/indexing.cjs');
const { loadSettings } = require('../../skills/workflow-engine/scripts/domain/knowledge/embedder.cjs');
const { syncKnowledge } = require('../../skills/workflow-engine/scripts/domain/knowledge/sync.cjs');
const { embeddingEndpoint, knowledgeCli, recordLaunches } = require('./knowledge-harness.cjs');

const STUB = { provider: 'stub', dimensions: 8 };
const ENGINE_CJS = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

/**
 * A feature whose completed discussions are on disk, its knowledge
 * configured as `knowledge` says, no store yet.
 * @param {Record<string, any>} knowledge @param {string[]} [topics]
 */
function buildProject(knowledge, topics = ['alpha']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-fill-')));
  writeJson(path.join(root, '.workflows', 'manifest.json'), { work_units: { pay: { work_type: 'feature' } } });
  writeJson(path.join(root, '.workflows', 'pay', 'manifest.json'), {
    name: 'pay', work_type: 'feature', status: 'in-progress',
    phases: { discussion: { items: Object.fromEntries(topics.map((t) => [t, { status: 'completed' }])) } },
  });
  for (const topic of topics) writeDiscussion(root, topic, `The ${topic} decision.`);
  writeJson(knowledgeFiles(root).config, { knowledge });
  return root;
}

/** @param {string} root @param {string} topic @param {string} body */
function writeDiscussion(root, topic, body) {
  const file = path.join(root, '.workflows', 'pay', 'discussion', `${topic}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# ${topic}\n\n${body}\n`);
}

/** @param {string} topic */
const discussion = (topic) => `.workflows/pay/discussion/${topic}.md`;

/** One discussion's keyword side written as its project's config says. @param {string} root @param {string} topic */
const indexOne = (root, topic) => indexPath(root, discussion(topic), loadSettings(knowledgeFiles(root)));

/** @param {string} root */
const loaded = (root) => store.loadStore(knowledgeFiles(root).store);

/** @param {string} root */
const metadata = (root) => store.readMetadata(knowledgeFiles(root).metadata);

/** @param {string} root */
const awaiting = (root) => store.chunksWithoutVector(loaded(root)).map((chunk) => chunk.topic);

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

describe('the launch — only a provider that can embed, only while chunks await', () => {
  let root;
  afterEach(() => cleanup(root));

  it('a single-file index over a provider that can embed launches the fill for its project', async (t) => {
    const launched = recordLaunches(t);
    root = buildProject(STUB);
    const res = await knowledgeCli(root, ['index', discussion('alpha')]);
    assert.strictEqual(res.code, 0, res.stderr);
    assert.deepStrictEqual(launched, [root]);
    assert.deepStrictEqual(awaiting(root), ['alpha'], 'the keyword side alone was written');
  });

  it('a keyword-only store never launches one', async (t) => {
    const launched = recordLaunches(t);
    root = buildProject({ provider: null });
    assert.strictEqual((await knowledgeCli(root, ['index', discussion('alpha')])).code, 0);
    assert.deepStrictEqual(launched, []);
  });

  it('a provider whose key does not resolve launches none — its vectors wait for the key', async (t) => {
    const launched = recordLaunches(t);
    const openai = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 8 };
    root = buildProject(openai);
    store.saveStore(store.createStore(), knowledgeFiles(root).store);
    store.writeMetadata(knowledgeFiles(root).metadata, { ...openai, last_indexed: null });
    assert.strictEqual((await knowledgeCli(root, ['index', discussion('alpha')])).code, 0);
    assert.deepStrictEqual(awaiting(root), ['alpha']);
    assert.deepStrictEqual(launched, []);
  });

  it('a write that leaves nothing awaiting launches none', async (t) => {
    root = buildProject(STUB);
    const launched = recordLaunches(t);
    await knowledgeCli(root, ['index']);
    launched.length = 0;
    assert.strictEqual((await knowledgeCli(root, ['index', discussion('alpha')])).code, 0);
    assert.deepStrictEqual(awaiting(root), [], 'the re-index reused the vector its text already had');
    assert.deepStrictEqual(launched, []);
  });

  it('a transaction launches one fill for all its writes', (t) => {
    const launched = recordLaunches(t);
    root = buildProject(STUB, ['alpha', 'beta']);
    /** @type {string[]} */
    const warnings = [];
    syncKnowledge(root, [{ index: discussion('alpha') }, { index: discussion('beta') }], warnings);
    assert.deepStrictEqual(warnings, []);
    assert.deepStrictEqual(awaiting(root).sort(), ['alpha', 'beta']);
    assert.deepStrictEqual(launched, [root]);
  });

  it('launches `engine knowledge fill` detached, its output ignored, never waited on', (t) => {
    /** @type {any[]} */
    const spawned = [];
    /** @type {string[]} */
    const handled = [];
    let unrefed = false;
    t.mock.method(childProcess, 'spawn', (...args) => {
      spawned.push(args);
      return { on: (/** @type {string} */ event) => { handled.push(event); }, unref: () => { unrefed = true; } };
    });
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-launch-'));
    launcher.launch(root);
    assert.deepStrictEqual(spawned, [[process.execPath, [ENGINE_CJS, 'knowledge', 'fill'], { cwd: root, detached: true, stdio: 'ignore' }]]);
    assert.ok(unrefed);
    assert.deepStrictEqual(handled, ['error'], 'a fill that cannot start never throws in its launcher');
  });
});

describe('the fill — each vector into the chunks whose text it embeds', () => {
  let root;
  beforeEach(() => {
    root = buildProject(STUB, ['alpha', 'beta']);
    for (const topic of ['alpha', 'beta']) indexOne(root, topic);
  });
  afterEach(() => cleanup(root));

  /**
   * The stub provider, recording every text it is asked for; `during` runs
   * inside the first call — a peer writing mid-fill.
   * @param {() => void} [during]
   */
  function spy(during = () => {}) {
    const stub = new StubProvider({ dimensions: STUB.dimensions });
    /** @type {string[][]} */
    const batches = [];
    return {
      batches,
      model: () => stub.model(),
      dimensions: () => stub.dimensions(),
      async embedBatch(/** @type {string[]} */ texts) {
        if (batches.length === 0) during();
        batches.push(texts);
        return stub.embedBatch(texts);
      },
    };
  }

  it('embeds every chunk awaiting a vector, and records that the fill fell short of nothing', async () => {
    const provider = spy();
    const vectoring = await fillVectors(knowledgeFiles(root), STUB, provider, () => true);
    assert.deepStrictEqual(vectoring, { unembedded: [], awaiting: 0 });
    assert.deepStrictEqual(awaiting(root), []);
    assert.strictEqual(metadata(root).fill_failure, null);
  });

  it('a chunk re-cut while its text was embedded takes no stale vector — and its new text is embedded in turn', async () => {
    const provider = spy(() => {
      writeDiscussion(root, 'alpha', 'The alpha decision, revised.');
      indexOne(root, 'alpha');
    });
    const vectoring = await fillVectors(knowledgeFiles(root), STUB, provider, () => true);
    assert.deepStrictEqual(vectoring, { unembedded: [], awaiting: 0 });
    assert.strictEqual(provider.batches.length, 2, 'the first round, then the text that came to await one meanwhile');
    const [alpha] = store.allChunks(loaded(root)).filter((chunk) => chunk.topic === 'alpha');
    assert.match(alpha.content, /revised/);
    const vector = store.vectorsByContentHash(loaded(root)).get(alpha.content_hash);
    assert.deepStrictEqual([...vector], new StubProvider({ dimensions: STUB.dimensions }).embed(alpha.content).map(Math.fround),
      'the vector of its own text');
  });

  it('stops when the store is rebuilt with another model of the same width while it embeds — no vector of the old model lands', async () => {
    const provider = spy(() => {
      store.writeMetadata(knowledgeFiles(root).metadata, { ...metadata(root), model: 'another' });
    });
    await assert.rejects(fillVectors(knowledgeFiles(root), STUB, provider, () => true), /The store's embedder changed during index/);
    assert.deepStrictEqual(awaiting(root).sort(), ['alpha', 'beta']);
  });

  it('never tries a text twice in one fill — a refused text waits for the next', async () => {
    const stub = new StubProvider({ dimensions: STUB.dimensions });
    let calls = 0;
    const refusing = {
      model: () => 'stub',
      dimensions: () => STUB.dimensions,
      async embedBatch(/** @type {string[]} */ texts) {
        calls += 1;
        if (texts.some((text) => text.includes('beta'))) {
          const { InvalidRequestError } = require('../../skills/workflow-engine/scripts/kernel/knowledge/providers/openai-engine.cjs');
          throw new InvalidRequestError('HTTP 400: input refused');
        }
        return stub.embedBatch(texts);
      },
    };
    const vectoring = await fillVectors(knowledgeFiles(root), STUB, refusing, () => true);
    assert.deepStrictEqual(vectoring.unembedded.map(({ file }) => file), [discussion('beta')]);
    assert.strictEqual(vectoring.awaiting, 1);
    assert.strictEqual(calls, 3, 'the batch, then file by file — and no second round for the refused text');
  });
});

describe('the fill — one at a time, its shortfall recorded and cleared', () => {
  let endpoint;
  let root;

  before(async () => {
    endpoint = await embeddingEndpoint(8);
  });
  after(() => endpoint.close());

  beforeEach(() => {
    root = buildProject(endpoint.config);
    indexOne(root, 'alpha');
    endpoint.mode = 'ok';
    endpoint.requests.length = 0;
  });
  afterEach(() => cleanup(root));

  it('a second fill finds a live fill\'s claim and ends at once, embedding nothing', async () => {
    fs.writeFileSync(knowledgeFiles(root).fill, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
    assert.strictEqual(await fill(root), null);
    assert.deepStrictEqual(endpoint.requests, []);
    assert.deepStrictEqual(awaiting(root), ['alpha']);
    assert.ok(fs.existsSync(knowledgeFiles(root).fill), 'the live claim is left alone');
  });

  it('takes over the claim of a fill no longer running, and releases its own', async () => {
    fs.writeFileSync(knowledgeFiles(root).fill, JSON.stringify({ pid: 2147483646, pid_start: null }));
    assert.deepStrictEqual(await fill(root), { unembedded: [], awaiting: 0 });
    assert.deepStrictEqual(awaiting(root), []);
    assert.ok(!fs.existsSync(knowledgeFiles(root).fill));
  });

  it('records why it fell short, the next search says so, and a fill that lands everything clears it', async () => {
    endpoint.mode = 'quota';
    const short = await fill(root);
    assert.strictEqual(short && short.awaiting, 1);
    assert.match(String(metadata(root).fill_failure),
      /^\.workflows\/pay\/discussion\/alpha\.md: Embeddings endpoint request refused: the account is out of quota \(HTTP 429\)\./);
    assert.ok(!fs.existsSync(knowledgeFiles(root).fill), 'the claim is released whatever the outcome');

    endpoint.mode = 'ok';
    const searched = await knowledgeCli(root, ['query', 'the alpha decision']);
    assert.match(searched.stdout, /^\[1 chunks await vectors — searched by keyword alone; each start retries them\]\n\[the last vector fill fell short — \.workflows\/pay\/discussion\/alpha\.md: /);
    assert.match((await knowledgeCli(root, ['status'])).stdout, /^Last vector fill fell short: \.workflows\/pay\/discussion\/alpha\.md: /m);

    assert.deepStrictEqual(await fill(root), { unembedded: [], awaiting: 0 });
    assert.strictEqual(metadata(root).fill_failure, null);
    assert.doesNotMatch((await knowledgeCli(root, ['query', 'the alpha decision'])).stdout, /fell short/);
  });

  it('a shortfall survives the keyword writes after it — only a fill clears it', async () => {
    endpoint.mode = 'quota';
    await fill(root);
    const recorded = metadata(root).fill_failure;
    assert.ok(recorded);
    writeDiscussion(root, 'alpha', 'The alpha decision, revised.');
    indexOne(root, 'alpha');
    assert.strictEqual(metadata(root).fill_failure, recorded);
  });

  it('a keyword-only store is never filled', async () => {
    writeJson(knowledgeFiles(root).config, { knowledge: { provider: null } });
    fs.rmSync(knowledgeFiles(root).store);
    fs.rmSync(knowledgeFiles(root).metadata);
    indexOne(root, 'alpha');
    assert.strictEqual(await fill(root), null);
    assert.deepStrictEqual(endpoint.requests, []);
  });

  it('the fill verb is silent when it lands everything, and says what fell short otherwise', async () => {
    assert.deepStrictEqual(await knowledgeCli(root, ['fill']), { code: 0, stdout: '', stderr: '' });
    writeDiscussion(root, 'alpha', 'The alpha decision, revised.');
    indexOne(root, 'alpha');
    endpoint.mode = 'quota';
    const short = await knowledgeCli(root, ['fill']);
    assert.strictEqual(short.code, 1);
    assert.match(short.stderr, /^Failed to embed \.workflows\/pay\/discussion\/alpha\.md: .*out of quota.*\nEach is searchable by keyword; its vectors come at the next start\.\n$/);
  });
});
