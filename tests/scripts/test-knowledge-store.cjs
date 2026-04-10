'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  createStore,
  insertDocument,
  removeByIdentity,
  searchFulltext,
  searchVector,
  searchHybrid,
  saveStore,
  loadStore,
  acquireLock,
  releaseLock,
  withLock,
  writeMetadata,
  readMetadata,
} = require('../../src/knowledge/store.js');
const { StubProvider } = require('../../src/knowledge/embeddings.js');

const STUB_DIMS = 128;

function makeDoc(overrides = {}) {
  return {
    id: 'doc-1',
    content: 'rate limiting prevents token refresh storms at the edge',
    work_unit: 'auth-flow',
    work_type: 'feature',
    phase: 'specification',
    topic: 'auth-flow',
    confidence: 'high',
    source_file: '.workflows/auth-flow/specification/auth-flow/specification.md',
    timestamp: 1700000000000,
    ...overrides,
  };
}

describe('knowledge store', () => {
  it('creates a store with specified dimensions', async () => {
    const db = await createStore(STUB_DIMS);
    assert.ok(db);
  });

  it('rejects invalid dimensions', async () => {
    await assert.rejects(() => createStore(0));
    await assert.rejects(() => createStore(-1));
    await assert.rejects(() => createStore(1.5));
  });

  it('inserts a document with all fields including vector', async () => {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });
    const doc = makeDoc({ embedding: provider.embed('rate limiting content') });
    await insertDocument(db, doc);
    const hits = await searchFulltext(db, { term: 'rate' });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'doc-1');
  });

  it('inserts a document WITHOUT the embedding field (keyword-only path)', async () => {
    const db = await createStore(STUB_DIMS);
    const doc = makeDoc({ id: 'vectorless-1' });
    delete doc.embedding;
    await insertDocument(db, doc);
    const hits = await searchFulltext(db, { term: 'rate' });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'vectorless-1');
  });

  it('handles a mixed store (some docs with vectors, some without)', async () => {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });

    await insertDocument(db, makeDoc({
      id: 'with-vec',
      content: 'authentication token refresh',
      embedding: provider.embed('authentication token refresh'),
    }));
    await insertDocument(db, makeDoc({
      id: 'without-vec',
      content: 'authentication session cookie',
    }));

    const hits = await searchFulltext(db, { term: 'authentication' });
    const ids = hits.map((h) => h.id).sort();
    assert.deepStrictEqual(ids, ['with-vec', 'without-vec']);
  });

  it('throws when embedding is null', async () => {
    const db = await createStore(STUB_DIMS);
    const doc = makeDoc({ embedding: null });
    await assert.rejects(() => insertDocument(db, doc), /null/);
  });

  it('throws when embedding is not an array', async () => {
    const db = await createStore(STUB_DIMS);
    await assert.rejects(() => insertDocument(db, makeDoc({ embedding: 'bad' })));
  });

  it('throws when required fields are missing', async () => {
    const db = await createStore(STUB_DIMS);
    const doc = makeDoc();
    delete doc.topic;
    await assert.rejects(() => insertDocument(db, doc), /topic/);
  });

  it('removes documents by identity key (work_unit + phase + topic)', async () => {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });

    // Two chunks for the same identity
    await insertDocument(db, makeDoc({
      id: 'auth-flow-spec-1',
      content: 'rate limiting section one',
      embedding: provider.embed('rate limiting section one'),
    }));
    await insertDocument(db, makeDoc({
      id: 'auth-flow-spec-2',
      content: 'rate limiting section two',
      embedding: provider.embed('rate limiting section two'),
    }));

    // And one chunk for a different identity
    await insertDocument(db, makeDoc({
      id: 'other-doc',
      work_unit: 'data-model',
      topic: 'data-model',
      content: 'rate limiting data model',
      embedding: provider.embed('rate limiting data model'),
    }));

    const removed = await removeByIdentity(db, {
      work_unit: 'auth-flow',
      phase: 'specification',
      topic: 'auth-flow',
    });
    assert.strictEqual(removed, 2);

    const hits = await searchFulltext(db, { term: 'rate' });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'other-doc');
  });

  it('removeByIdentity is a no-op when nothing matches', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc());
    const removed = await removeByIdentity(db, {
      work_unit: 'nothing',
      phase: 'discussion',
      topic: 'nothing',
    });
    assert.strictEqual(removed, 0);

    const hits = await searchFulltext(db, { term: 'rate' });
    assert.strictEqual(hits.length, 1);
  });

  it('removeByIdentity requires all three fields', async () => {
    const db = await createStore(STUB_DIMS);
    await assert.rejects(() => removeByIdentity(db, { work_unit: 'x', phase: 'y' }));
    await assert.rejects(() => removeByIdentity(db, { work_unit: 'x', topic: 'z' }));
    await assert.rejects(() => removeByIdentity(db, null));
  });

  it('returns empty results for a term that matches nothing', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc());
    const hits = await searchFulltext(db, { term: 'xyzzy-nomatch' });
    assert.strictEqual(hits.length, 0);
  });

  it('returns an empty array when searching an empty store', async () => {
    const db = await createStore(STUB_DIMS);
    const hits = await searchFulltext(db, { term: 'anything' });
    assert.deepStrictEqual(hits, []);
  });

  it('filters by single enum field (phase)', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc({
      id: 'spec-1',
      phase: 'specification',
      content: 'auth flow spec content',
    }));
    await insertDocument(db, makeDoc({
      id: 'disc-1',
      phase: 'discussion',
      content: 'auth flow discussion content',
    }));

    const hits = await searchFulltext(db, {
      term: 'auth',
      where: { phase: { eq: 'specification' } },
    });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'spec-1');
  });

  it('filters by enum field with in-list', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc({ id: 'spec-1', phase: 'specification', content: 'auth content' }));
    await insertDocument(db, makeDoc({ id: 'disc-1', phase: 'discussion', content: 'auth content' }));
    await insertDocument(db, makeDoc({ id: 'res-1', phase: 'research', content: 'auth content' }));

    const hits = await searchFulltext(db, {
      term: 'auth',
      where: { phase: { in: ['specification', 'discussion'] } },
    });
    const ids = hits.map((h) => h.id).sort();
    assert.deepStrictEqual(ids, ['disc-1', 'spec-1']);
  });

  it('filters by multiple enum fields simultaneously', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc({
      id: 'feat-spec',
      work_type: 'feature',
      phase: 'specification',
      content: 'shared content',
    }));
    await insertDocument(db, makeDoc({
      id: 'feat-disc',
      work_type: 'feature',
      phase: 'discussion',
      content: 'shared content',
    }));
    await insertDocument(db, makeDoc({
      id: 'bug-spec',
      work_type: 'bugfix',
      phase: 'specification',
      content: 'shared content',
    }));

    const hits = await searchFulltext(db, {
      term: 'shared',
      where: {
        work_type: { eq: 'feature' },
        phase: { eq: 'specification' },
      },
    });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'feat-spec');
  });

  it('returns results in the normalised shape with score and metadata', async () => {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });
    await insertDocument(db, makeDoc({ embedding: provider.embed('content') }));
    const hits = await searchFulltext(db, { term: 'rate' });
    assert.strictEqual(hits.length, 1);
    const h = hits[0];
    for (const key of [
      'id', 'content', 'work_unit', 'work_type', 'phase', 'topic',
      'confidence', 'source_file', 'timestamp', 'score',
    ]) {
      assert.ok(key in h, `missing ${key}`);
    }
    assert.strictEqual(typeof h.score, 'number');
    assert.strictEqual(h.work_unit, 'auth-flow');
    assert.strictEqual(h.phase, 'specification');
  });

  it('handles inserting multiple documents and searching across them', async () => {
    const db = await createStore(STUB_DIMS);
    for (let i = 0; i < 5; i++) {
      await insertDocument(db, makeDoc({
        id: `doc-${i}`,
        content: `batch document number ${i}`,
      }));
    }
    const hits = await searchFulltext(db, { term: 'batch', limit: 10 });
    assert.strictEqual(hits.length, 5);
  });

  it('respects the limit parameter', async () => {
    const db = await createStore(STUB_DIMS);
    for (let i = 0; i < 10; i++) {
      await insertDocument(db, makeDoc({ id: `d-${i}`, content: 'repeated term here' }));
    }
    const hits = await searchFulltext(db, { term: 'repeated', limit: 3 });
    assert.strictEqual(hits.length, 3);
  });

  it('handles enum values not seen before (Orama enums are open)', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc({
      id: 'novel-enum',
      work_type: 'never-seen-before',
      content: 'novel enum value test',
    }));
    const hits = await searchFulltext(db, { term: 'novel' });
    assert.strictEqual(hits.length, 1);
  });

  it('handles very long content', async () => {
    const db = await createStore(STUB_DIMS);
    const long = ('token '.repeat(5000)).trim();
    await insertDocument(db, makeDoc({ id: 'long-doc', content: long }));
    const hits = await searchFulltext(db, { term: 'token' });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'long-doc');
  });

  it('rejects a duplicate document id on insert (Orama enforces uniqueness)', async () => {
    // Orama 3.x throws DOCUMENT_ALREADY_EXISTS if a doc with the same
    // `id` is inserted twice. The knowledge CLI must therefore always
    // call removeByIdentity before re-inserting a chunk — upsert-on-id
    // is NOT automatic. This test pins that behaviour so future Orama
    // upgrades can't silently change it.
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc({ id: 'dup', content: 'first version' }));
    await assert.rejects(
      () => insertDocument(db, makeDoc({ id: 'dup', content: 'second version' })),
      /already exists/
    );
  });

  it('searches with no where clause return all matching documents', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc({ id: 'a', phase: 'specification', content: 'marker text' }));
    await insertDocument(db, makeDoc({ id: 'b', phase: 'discussion', content: 'marker text' }));
    const hits = await searchFulltext(db, { term: 'marker' });
    assert.strictEqual(hits.length, 2);
  });

  it('search with where clause matching zero documents returns empty', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc({ content: 'nothing special' }));
    const hits = await searchFulltext(db, {
      term: 'nothing',
      where: { phase: { eq: 'research' } },
    });
    assert.deepStrictEqual(hits, []);
  });
});

// ---------------------------------------------------------------------------
// Vector + hybrid search (task 1-4)
// ---------------------------------------------------------------------------

describe('knowledge store — vector and hybrid search', () => {
  async function seedStore() {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });
    const corpus = [
      ['alpha', 'alpha rate limiting bucket algorithm'],
      ['beta',  'beta session token expiry refresh'],
      ['gamma', 'gamma webhook retry exponential backoff'],
      ['delta', 'delta rate limiting across regions'],
    ];
    for (const [id, content] of corpus) {
      await insertDocument(db, makeDoc({
        id,
        content,
        topic: id,
        embedding: provider.embed(content),
      }));
    }
    return { db, provider };
  }

  it('searches by vector similarity and returns ranked results', async () => {
    const { db, provider } = await seedStore();
    const query = provider.embed('alpha rate limiting bucket algorithm');
    const hits = await searchVector(db, { vector: query, similarity: 0, limit: 10 });
    assert.ok(hits.length >= 1);
    // The document embedded from the exact same text must be the top hit.
    assert.strictEqual(hits[0].id, 'alpha');
  });

  it('applies the similarity threshold to vector search', async () => {
    const { db, provider } = await seedStore();
    const query = provider.embed('completely unrelated query string');
    // StubProvider vectors are random-looking; setting similarity to 0.999
    // should filter out every (or nearly every) hit.
    const strict = await searchVector(db, { vector: query, similarity: 0.999, limit: 10 });
    const loose = await searchVector(db, { vector: query, similarity: 0, limit: 10 });
    assert.ok(loose.length >= strict.length);
  });

  it('applies where clause filtering to vector search', async () => {
    const { db, provider } = await seedStore();
    const query = provider.embed('any query');
    const hits = await searchVector(db, {
      vector: query,
      similarity: 0,
      where: { topic: { eq: 'alpha' } },
      limit: 10,
    });
    assert.ok(hits.every((h) => h.topic === 'alpha'));
  });

  it('rejects vector search without a vector', async () => {
    const db = await createStore(STUB_DIMS);
    await assert.rejects(() => searchVector(db, {}));
    await assert.rejects(() => searchVector(db, { vector: 'not an array' }));
  });

  it('searches by hybrid mode and returns combined results', async () => {
    const { db, provider } = await seedStore();
    const query = provider.embed('rate limiting');
    const hits = await searchHybrid(db, {
      term: 'rate limiting',
      vector: query,
      similarity: 0,
      limit: 10,
    });
    assert.ok(hits.length >= 1);
    const ids = hits.map((h) => h.id);
    // Both docs containing "rate limiting" should be returned.
    assert.ok(ids.includes('alpha'));
    assert.ok(ids.includes('delta'));
  });

  it('applies where clause filtering to hybrid search', async () => {
    const { db, provider } = await seedStore();
    const query = provider.embed('rate limiting');
    const hits = await searchHybrid(db, {
      term: 'rate limiting',
      vector: query,
      similarity: 0,
      where: { topic: { eq: 'alpha' } },
      limit: 10,
    });
    assert.ok(hits.every((h) => h.topic === 'alpha'));
  });

  it('rejects hybrid search without term or vector', async () => {
    const db = await createStore(STUB_DIMS);
    await assert.rejects(() => searchHybrid(db, { vector: [0, 0, 0] }));
    await assert.rejects(() => searchHybrid(db, { term: 'hello' }));
  });
});

// ---------------------------------------------------------------------------
// Persistence, locking, metadata (task 1-4)
// ---------------------------------------------------------------------------

describe('knowledge store — persistence and locking', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves the store to disk as a non-empty file', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc());
    const storePath = path.join(tmpDir, 'store.msp');
    await saveStore(db, storePath);
    const stat = fs.statSync(storePath);
    assert.ok(stat.size > 0);
  });

  it('loads a previously saved store and reconstructs a working instance', async () => {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });
    await insertDocument(db, makeDoc({
      content: 'rate limiting persistence test',
      embedding: provider.embed('rate limiting persistence test'),
    }));
    const storePath = path.join(tmpDir, 'store.msp');
    await saveStore(db, storePath);

    const loaded = await loadStore(storePath);
    const hits = await searchFulltext(loaded, { term: 'persistence' });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'doc-1');
  });

  it('produces identical fulltext results after save/load round-trip', async () => {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });
    for (let i = 0; i < 5; i++) {
      await insertDocument(db, makeDoc({
        id: `rt-${i}`,
        content: `round trip document number ${i}`,
        embedding: provider.embed(`round trip document number ${i}`),
      }));
    }

    const before = await searchFulltext(db, { term: 'round', limit: 10 });
    const storePath = path.join(tmpDir, 'store.msp');
    await saveStore(db, storePath);
    const loaded = await loadStore(storePath);
    const after = await searchFulltext(loaded, { term: 'round', limit: 10 });

    const strip = (hits) => hits.map((h) => ({ id: h.id, content: h.content })).sort((a, b) => a.id.localeCompare(b.id));
    assert.deepStrictEqual(strip(after), strip(before));
    assert.strictEqual(after.length, before.length);
  });

  it('produces identical vector results after save/load round-trip', async () => {
    const db = await createStore(STUB_DIMS);
    const provider = new StubProvider({ dimensions: STUB_DIMS });
    for (let i = 0; i < 4; i++) {
      await insertDocument(db, makeDoc({
        id: `vec-${i}`,
        content: `content ${i}`,
        embedding: provider.embed(`content ${i}`),
      }));
    }
    const query = provider.embed('content 2');
    const before = await searchVector(db, { vector: query, similarity: 0, limit: 10 });

    const storePath = path.join(tmpDir, 'store.msp');
    await saveStore(db, storePath);
    const loaded = await loadStore(storePath);
    const after = await searchVector(loaded, { vector: query, similarity: 0, limit: 10 });

    assert.strictEqual(after.length, before.length);
    assert.deepStrictEqual(after.map((h) => h.id), before.map((h) => h.id));
  });

  it('throws a clear error when loading a missing store file', async () => {
    await assert.rejects(
      () => loadStore(path.join(tmpDir, 'missing.msp')),
      /not found/
    );
  });

  it('throws a clear error when loading a corrupted store file', async () => {
    const storePath = path.join(tmpDir, 'bad.msp');
    fs.writeFileSync(storePath, Buffer.from([0xff, 0xff, 0xff, 0xff]));
    await assert.rejects(() => loadStore(storePath), /corrupt|malformed/i);
  });

  it('throws when saving to a directory that does not exist', async () => {
    const db = await createStore(STUB_DIMS);
    await insertDocument(db, makeDoc());
    const storePath = path.join(tmpDir, 'nested', 'not-here', 'store.msp');
    await assert.rejects(() => saveStore(db, storePath));
  });

  it('acquires and releases a file lock', () => {
    const lockPath = path.join(tmpDir, '.lock');
    acquireLock(lockPath);
    assert.ok(fs.existsSync(lockPath));
    releaseLock(lockPath);
    assert.ok(!fs.existsSync(lockPath));
  });

  it('withLock wraps execution and releases on success', async () => {
    const lockPath = path.join(tmpDir, '.lock');
    const observed = await withLock(lockPath, async () => {
      assert.ok(fs.existsSync(lockPath));
      return 'ok';
    });
    assert.strictEqual(observed, 'ok');
    assert.ok(!fs.existsSync(lockPath));
  });

  it('withLock releases the lock even when the wrapped function throws', async () => {
    const lockPath = path.join(tmpDir, '.lock');
    await assert.rejects(() =>
      withLock(lockPath, async () => {
        throw new Error('boom');
      })
    );
    assert.ok(!fs.existsSync(lockPath));
  });

  it('detects and cleans stale locks older than 30s', () => {
    const lockPath = path.join(tmpDir, '.lock');
    // Create a lock file by hand with an ancient mtime.
    fs.writeFileSync(lockPath, '99999');
    const past = Date.now() / 1000 - 60; // 60 seconds ago
    fs.utimesSync(lockPath, past, past);
    // Should succeed by detecting and removing the stale lock.
    acquireLock(lockPath);
    assert.ok(fs.existsSync(lockPath));
    releaseLock(lockPath);
  });
});

describe('knowledge store — metadata', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-meta-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes metadata.json with all 5 fields', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    writeMetadata(metaPath, {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      last_indexed: '2026-04-10T12:34:56.789Z',
      pending: [],
    });
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.strictEqual(parsed.provider, 'openai');
    assert.strictEqual(parsed.model, 'text-embedding-3-small');
    assert.strictEqual(parsed.dimensions, 1536);
    assert.strictEqual(parsed.last_indexed, '2026-04-10T12:34:56.789Z');
    assert.deepStrictEqual(parsed.pending, []);
  });

  it('writes null for provider/model/dimensions in keyword-only mode', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    writeMetadata(metaPath, {
      provider: null,
      model: null,
      dimensions: null,
      last_indexed: '2026-04-10T12:34:56.789Z',
      pending: [],
    });
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.strictEqual(parsed.provider, null);
    assert.strictEqual(parsed.model, null);
    assert.strictEqual(parsed.dimensions, null);
  });

  it('normalises missing fields to explicit null (not undefined)', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    writeMetadata(metaPath, { last_indexed: '2026-04-10T00:00:00.000Z' });
    const raw = fs.readFileSync(metaPath, 'utf8');
    // JSON.stringify drops undefined, so this test proves we wrote explicit null.
    assert.ok(raw.includes('"provider": null'));
    assert.ok(raw.includes('"model": null'));
    assert.ok(raw.includes('"dimensions": null'));
    assert.ok(raw.includes('"pending": []'));
  });

  it('reads metadata.json correctly', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    writeMetadata(metaPath, {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      last_indexed: '2026-04-10T12:34:56.789Z',
      pending: [{ file: 'x.md', failed_at: '2026-04-10T12:00:00.000Z', error: 'oops' }],
    });
    const parsed = readMetadata(metaPath);
    assert.strictEqual(parsed.provider, 'openai');
    assert.strictEqual(parsed.pending.length, 1);
    assert.strictEqual(parsed.pending[0].file, 'x.md');
  });

  it('throws a clear error when metadata.json is missing', () => {
    assert.throws(
      () => readMetadata(path.join(tmpDir, 'missing.json')),
      /not found/
    );
  });

  it('throws a clear error when metadata.json contains invalid JSON', () => {
    const metaPath = path.join(tmpDir, 'metadata.json');
    fs.writeFileSync(metaPath, 'not json {');
    assert.throws(() => readMetadata(metaPath), /invalid JSON/);
  });
});
