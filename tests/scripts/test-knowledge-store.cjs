'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  createStore,
  insertDocument,
  removeByIdentity,
  searchFulltext,
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
