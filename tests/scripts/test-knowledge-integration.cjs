'use strict';

// End-to-end integration test for Phase 1 of the knowledge base.
//
// This test imports from the BUILT bundle (not the source files) so it
// validates that esbuild bundling preserves all functionality — catching
// issues the source-level unit tests miss (e.g. tree-shaking dropping a
// code path, CJS interop breakage, Float32Array→plain array conversion
// not surviving MsgPack round-trip).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const bundle = require('../../skills/workflow-knowledge/scripts/knowledge.cjs');
const { StubProvider, store } = bundle;
const {
  createStore,
  insertDocument,
  removeByIdentity,
  searchFulltext,
  searchVector,
  searchHybrid,
  saveStore,
  loadStore,
  writeMetadata,
  readMetadata,
} = store;

const STUB_DIMS = 128;
const SCORE_TOLERANCE = 1e-6;

// Realistic document corpus spanning 2 work units, 3 phases, 2 work
// types, and every confidence level. Content strings deliberately share
// some terms to exercise BM25 ranking and distinguish vector behaviour.
const FIXTURE_DOCS = [
  {
    id: 'auth-discussion-1',
    content: 'Token refresh intervals should mirror the upstream rate limiting window.',
    work_unit: 'auth-flow',
    work_type: 'feature',
    phase: 'discussion',
    topic: 'auth-flow',
    confidence: 'medium',
    source_file: '.workflows/auth-flow/discussion/auth-flow.md',
    timestamp: 1700000000000,
  },
  {
    id: 'auth-spec-1',
    content: 'User identity uses UUID v7.',
    work_unit: 'auth-flow',
    work_type: 'feature',
    phase: 'specification',
    topic: 'auth-flow',
    confidence: 'high',
    source_file: '.workflows/auth-flow/specification/auth-flow/specification.md',
    timestamp: 1700000010000,
  },
  {
    id: 'auth-spec-2',
    content: '[test] Brackets at the start must survive verbatim through the store.',
    work_unit: 'auth-flow',
    work_type: 'feature',
    phase: 'specification',
    topic: 'auth-flow',
    confidence: 'high',
    source_file: '.workflows/auth-flow/specification/auth-flow/specification.md',
    timestamp: 1700000020000,
  },
  {
    id: 'data-research-1',
    content: 'Postgres partitioning strategies reviewed: range, list, hash.',
    work_unit: 'data-model',
    work_type: 'epic',
    phase: 'research',
    topic: 'data-model',
    confidence: 'low-medium',
    source_file: '.workflows/data-model/research/partitioning.md',
    timestamp: 1700000030000,
  },
  {
    id: 'data-disc-1',
    content: 'Rate limiting decision deferred to the edge gateway layer.',
    work_unit: 'data-model',
    work_type: 'epic',
    phase: 'discussion',
    topic: 'data-model',
    confidence: 'low',
    source_file: '.workflows/data-model/discussion/data-model.md',
    timestamp: 1700000040000,
  },
  {
    id: 'data-spec-1',
    content: 'Persist rate limiting counters in Redis with per-tenant prefixes.',
    work_unit: 'data-model',
    work_type: 'epic',
    phase: 'specification',
    topic: 'data-model',
    confidence: 'high',
    source_file: '.workflows/data-model/specification/data-model/specification.md',
    timestamp: 1700000050000,
  },
  {
    id: 'data-analysis-1',
    content: 'Analysis surfaced caching layer as a recurring theme across discussions.',
    work_unit: 'data-model',
    work_type: 'epic',
    phase: 'analysis',
    topic: 'gap-analysis',
    confidence: 'low',
    source_file: '.workflows/data-model/.state/discovery-gap-analysis.md',
    timestamp: 1700000060000,
  },
];

async function seedStore(db, provider) {
  for (const doc of FIXTURE_DOCS) {
    await insertDocument(db, {
      ...doc,
      embedding: provider.embed(doc.content),
    });
  }
}

function stripForCompare(hits) {
  // Deterministic comparison: preserve id order, round scores to the
  // tolerance, drop everything else that might drift.
  return hits.map((h) => ({
    id: h.id,
    score: Math.round(h.score / SCORE_TOLERANCE) * SCORE_TOLERANCE,
  }));
}

describe('knowledge store — end-to-end integration (via built bundle)', () => {
  let tmpDir;
  let storePath;
  let metaPath;
  let provider;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-integration-'));
    storePath = path.join(tmpDir, 'store.msp');
    metaPath = path.join(tmpDir, 'metadata.json');
    provider = new StubProvider({ dimensions: STUB_DIMS });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exposes the expected surface on the built bundle', () => {
    assert.strictEqual(typeof StubProvider, 'function');
    assert.strictEqual(typeof createStore, 'function');
    assert.strictEqual(typeof insertDocument, 'function');
    assert.strictEqual(typeof removeByIdentity, 'function');
    assert.strictEqual(typeof searchFulltext, 'function');
    assert.strictEqual(typeof searchVector, 'function');
    assert.strictEqual(typeof searchHybrid, 'function');
    assert.strictEqual(typeof saveStore, 'function');
    assert.strictEqual(typeof loadStore, 'function');
    assert.strictEqual(typeof writeMetadata, 'function');
    assert.strictEqual(typeof readMetadata, 'function');
  });

  it('inserts multiple documents with vectors from StubProvider', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);
    const hits = await searchFulltext(db, { term: 'rate', limit: 20 });
    // Three documents contain "rate": auth-discussion-1, data-disc-1, data-spec-1.
    const ids = new Set(hits.map((h) => h.id));
    assert.ok(ids.has('auth-discussion-1'));
    assert.ok(ids.has('data-disc-1'));
    assert.ok(ids.has('data-spec-1'));
    assert.strictEqual(hits.length, 3);
  });

  it('returns correct fulltext search results', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);
    const hits = await searchFulltext(db, { term: 'partitioning' });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'data-research-1');
  });

  it('returns correct vector search results', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);
    // Embed the exact same content as data-spec-1 — that doc must be top.
    const query = provider.embed('Persist rate limiting counters in Redis with per-tenant prefixes.');
    const hits = await searchVector(db, { vector: query, similarity: 0, limit: 10 });
    assert.ok(hits.length >= 1);
    assert.strictEqual(hits[0].id, 'data-spec-1');
  });

  it('returns correct hybrid search results', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);
    const query = provider.embed('rate limiting');
    const hits = await searchHybrid(db, {
      term: 'rate limiting',
      vector: query,
      similarity: 0,
      limit: 10,
    });
    const ids = hits.map((h) => h.id);
    assert.ok(ids.includes('auth-discussion-1'));
    assert.ok(ids.includes('data-disc-1'));
    assert.ok(ids.includes('data-spec-1'));
  });

  it('filters results by metadata enum fields', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);
    const hits = await searchFulltext(db, {
      term: 'rate',
      where: { phase: { eq: 'specification' } },
    });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].id, 'data-spec-1');

    const multi = await searchFulltext(db, {
      term: 'rate',
      where: { work_type: { eq: 'epic' } },
    });
    const multiIds = multi.map((h) => h.id).sort();
    assert.deepStrictEqual(multiIds, ['data-disc-1', 'data-spec-1']);
  });

  it('surfaces analysis-phase documents in queries with correct provenance', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);

    const hits = await searchFulltext(db, { term: 'caching' });
    assert.strictEqual(hits.length, 1);
    const hit = hits[0];
    assert.strictEqual(hit.id, 'data-analysis-1');
    assert.strictEqual(hit.phase, 'analysis');
    assert.strictEqual(hit.topic, 'gap-analysis');
    assert.strictEqual(hit.work_unit, 'data-model');
    assert.strictEqual(hit.confidence, 'low');

    const filtered = await searchFulltext(db, {
      term: 'caching',
      where: { phase: { eq: 'analysis' } },
    });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 'data-analysis-1');
  });

  it('removes analysis-phase documents by identity', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);

    const removed = await removeByIdentity(db, {
      work_unit: 'data-model',
      phase: 'analysis',
      topic: 'gap-analysis',
    });
    assert.strictEqual(removed, 1);

    const gone = await searchFulltext(db, { term: 'caching' });
    assert.strictEqual(gone.length, 0);
  });

  it('returns an empty array for queries with zero matches', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);
    const hits = await searchFulltext(db, { term: 'zzz-definitely-not-present' });
    assert.deepStrictEqual(hits, []);
  });

  it('stores content verbatim with no metadata prefix added', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);

    // Fetch every doc we inserted and compare content byte-for-byte.
    for (const original of FIXTURE_DOCS) {
      const hits = await searchFulltext(db, {
        term: original.content.split(' ')[0],
        where: { topic: { eq: original.topic }, phase: { eq: original.phase } },
        limit: 50,
      });
      const found = hits.find((h) => h.id === original.id);
      assert.ok(found, `expected to find doc ${original.id}`);
      assert.strictEqual(
        found.content,
        original.content,
        `content mismatch for ${original.id} — metadata prefix may have been added`
      );
    }

    // Spot-check the bracket case via fulltext search and inspect content.
    const bracketHits = await searchFulltext(db, { term: 'brackets' });
    assert.strictEqual(bracketHits.length, 1);
    assert.strictEqual(
      bracketHits[0].content,
      '[test] Brackets at the start must survive verbatim through the store.'
    );
  });

  it('removes documents by identity key and leaves others intact', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);

    // auth-flow/specification/auth-flow has 2 chunks (auth-spec-1, auth-spec-2).
    const removed = await removeByIdentity(db, {
      work_unit: 'auth-flow',
      phase: 'specification',
      topic: 'auth-flow',
    });
    assert.strictEqual(removed, 2);

    // Both removed docs are gone.
    const gone = await searchFulltext(db, { term: 'UUID' });
    assert.strictEqual(gone.length, 0);
    const gone2 = await searchFulltext(db, { term: 'Brackets' });
    assert.strictEqual(gone2.length, 0);

    // Surviving docs are untouched.
    const survivors = await searchFulltext(db, { term: 'rate', limit: 20 });
    const ids = survivors.map((h) => h.id).sort();
    assert.deepStrictEqual(ids, ['auth-discussion-1', 'data-disc-1', 'data-spec-1']);
  });

  it('persists store to MsgPack and reloads with identical results across all modes', async () => {
    const db = await createStore(STUB_DIMS);
    await seedStore(db, provider);

    // Capture results across all three modes + a filtered search +
    // an empty-result search. All must round-trip identically.
    const termQuery = 'rate';
    const vectorQuery = provider.embed('rate limiting at the edge');

    const beforeFull = await searchFulltext(db, { term: termQuery, limit: 20 });
    const beforeVector = await searchVector(db, { vector: vectorQuery, similarity: 0, limit: 20 });
    const beforeHybrid = await searchHybrid(db, {
      term: termQuery, vector: vectorQuery, similarity: 0, limit: 20,
    });
    const beforeFiltered = await searchFulltext(db, {
      term: termQuery,
      where: { work_type: { eq: 'epic' } },
    });
    const beforeEmpty = await searchFulltext(db, { term: 'absent-token-xyzzy' });

    await saveStore(db, storePath);
    assert.ok(fs.existsSync(storePath));
    assert.ok(fs.statSync(storePath).size > 0);

    // Write metadata alongside.
    writeMetadata(metaPath, {
      provider: provider.model(),
      model: provider.model(),
      dimensions: provider.dimensions(),
      last_indexed: '2026-04-10T12:00:00.000Z',
      pending: [],
    });

    const loaded = await loadStore(storePath);

    const afterFull = await searchFulltext(loaded, { term: termQuery, limit: 20 });
    const afterVector = await searchVector(loaded, { vector: vectorQuery, similarity: 0, limit: 20 });
    const afterHybrid = await searchHybrid(loaded, {
      term: termQuery, vector: vectorQuery, similarity: 0, limit: 20,
    });
    const afterFiltered = await searchFulltext(loaded, {
      term: termQuery,
      where: { work_type: { eq: 'epic' } },
    });
    const afterEmpty = await searchFulltext(loaded, { term: 'absent-token-xyzzy' });

    assert.deepStrictEqual(stripForCompare(afterFull), stripForCompare(beforeFull));
    assert.deepStrictEqual(stripForCompare(afterVector), stripForCompare(beforeVector));
    assert.deepStrictEqual(stripForCompare(afterHybrid), stripForCompare(beforeHybrid));
    assert.deepStrictEqual(stripForCompare(afterFiltered), stripForCompare(beforeFiltered));
    assert.deepStrictEqual(afterEmpty, beforeEmpty);
    assert.strictEqual(afterEmpty.length, 0);

    // Document counts must match.
    assert.strictEqual(afterFull.length, beforeFull.length);
    assert.strictEqual(afterVector.length, beforeVector.length);
    assert.strictEqual(afterHybrid.length, beforeHybrid.length);

    // Content is preserved exactly — guards against the no-prefix invariant
    // being broken somewhere in save/load.
    const specHit = afterFull.find((h) => h.id === 'data-spec-1');
    assert.ok(specHit);
    assert.strictEqual(
      specHit.content,
      'Persist rate limiting counters in Redis with per-tenant prefixes.'
    );
  });

  it('reads metadata.json back with accurate provider/model/dimensions/last_indexed', () => {
    const meta = readMetadata(metaPath);
    assert.strictEqual(meta.provider, provider.model());
    assert.strictEqual(meta.model, provider.model());
    assert.strictEqual(meta.dimensions, provider.dimensions());
    assert.strictEqual(meta.last_indexed, '2026-04-10T12:00:00.000Z');
    assert.deepStrictEqual(meta.pending, []);
  });
});
