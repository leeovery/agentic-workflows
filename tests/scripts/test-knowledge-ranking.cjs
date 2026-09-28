'use strict';

// A query's ranking: each framing's searches blended, each chunk keeping its
// best framing's score — and the explanation `query --explain` prints beneath
// a result.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const store = require('../../src/knowledge/store.js');
const { searchFramings, mergeFramings, rerank, explanation } = require('../../src/knowledge/ranking.js');

/** A feature's discussion chunk, `n` its ordinal, embedded as `embedding`. */
function doc(n, content, embedding) {
  return {
    id: `unit-discussion-unit-${String(n).padStart(3, '0')}`,
    content,
    work_unit: 'unit',
    work_type: 'feature',
    phase: 'discussion',
    topic: 'unit',
    confidence: 'medium',
    source_file: '.workflows/unit/discussion/unit.md',
    timestamp: new Date(2026, 0, 2).getTime(),
    embedding,
  };
}

/** A store of `count` chunks, every one found by keyword and by vector. */
function storeOf(count) {
  const db = store.createStore();
  for (let n = 1; n <= count; n++) store.insertDocument(db, doc(n, `Token ${'refresh '.repeat(n)}`, [1, n / count]));
  return db;
}

/**
 * Three chunks on two axes: one both searches find, one only the vector
 * search reaches, one the vector search turns away.
 */
function axisStore() {
  const db = store.createStore();
  store.insertDocument(db, doc(1, 'Receipts reconcile nightly.', [1, 0]));
  store.insertDocument(db, doc(2, 'Ledgers balance at close.', [0.6, 0.8]));
  store.insertDocument(db, doc(3, 'Receipts arrive late.', [0, 1]));
  return db;
}

const axis = async () => [2, 0];
const BOTH = 'unit-discussion-unit-001';
const VECTOR = 'unit-discussion-unit-002';
const KEYWORD = 'unit-discussion-unit-003';

describe('searchFramings', () => {
  it("keyword-only, keeps each framing's raw keyword scores, cut to twice the limit", async () => {
    const db = storeOf(30);
    const { framings: [framing] } = await searchFramings(db, ['token'], { limit: 10, similarity: 0.3, embed: null });
    const raw = store.searchKeyword(db, { term: 'token', limit: 20 });
    assert.deepStrictEqual(framing.map((h) => [h.id, h.score]), raw.map((h) => [h.id, h.score]));
    assert.deepStrictEqual(framing[0].parts, [{ search: 'keyword', raw: raw[0].score }]);
  });

  it('in full mode, blends each framing — each search over its best, 0.4 keyword and 0.6 vector', async () => {
    const db = axisStore();
    const embedded = [];
    const embed = async (term) => {
      embedded.push(term);
      return axis();
    };
    const { framings: [receipts] } = await searchFramings(db, ['receipts', 'ledgers'], { limit: 10, similarity: 0.3, embed });
    assert.deepStrictEqual(embedded, ['receipts', 'ledgers']);
    const keyword = Object.fromEntries(store.searchKeyword(db, { term: 'receipts' }).map((h) => [h.id, h.score]));
    const best = Math.max(...Object.values(keyword));
    const scores = Object.fromEntries(receipts.map((h) => [h.id, h.score]));
    assert.deepStrictEqual(receipts.map((h) => h.id), [BOTH, KEYWORD, VECTOR]);
    assert.strictEqual(scores[BOTH], 0.4 * (keyword[BOTH] / best) + 0.6);
    assert.strictEqual(scores[KEYWORD], 0.4 * (keyword[KEYWORD] / best));
    assert.ok(Math.abs(scores[VECTOR] - 0.6 * 0.6) < 1e-6, 'a vector hit alone, its cosine over the best');
    assert.deepStrictEqual(receipts.find((h) => h.id === KEYWORD).parts, [
      { search: 'keyword', raw: keyword[KEYWORD], normalised: keyword[KEYWORD] / best },
      { search: 'vector', raw: null },
    ], 'the vector search turned it away, under the similarity minimum');
  });

  it('cuts each blended framing to twice the limit, and returns the cut', async () => {
    const { cut, framings } = await searchFramings(storeOf(30), ['token', 'refresh'], { limit: 5, similarity: 0.3, embed: axis });
    assert.strictEqual(cut, 10);
    assert.deepStrictEqual(framings.map((hits) => hits.length), [10, 10]);
  });
});

/** A framing's hit: `id` scored `score`. */
function hit(id, score) {
  return { id, score, parts: [{ search: 'keyword', raw: score }] };
}

describe('mergeFramings', () => {
  it("keeps each chunk once, in the order the framings first found it, with its best framing's score", () => {
    const merged = mergeFramings([[hit('a', 5), hit('b', 4)], [hit('b', 9), hit('c', 3)]], 2);
    assert.deepStrictEqual(merged.map((r) => [r.id, r.score, r.scoring.kept, r.scoring.cut]), [['a', 5, 1, 2], ['b', 9, 2, 2], ['c', 3, 2, 2]]);
    assert.deepStrictEqual(merged[1].scoring.framings.map((f) => f.score), [4, 9]);
    assert.strictEqual(merged[2].scoring.framings[0], null);
    assert.ok(!('parts' in merged[0]));
  });

  it('keeps the earliest framing where framings tie', () => {
    assert.strictEqual(mergeFramings([[hit('a', 5)], [hit('a', 5)]], 2)[0].scoring.kept, 1);
  });
});

describe('explanation', () => {
  it("prints each framing's scores, then the framing kept, worked through decay, boost and tier", async () => {
    const db = axisStore();
    const { cut, framings } = await searchFramings(db, ['receipts', 'ledgers'], { limit: 10, similarity: 0.3, embed: axis });
    const dated = mergeFramings(framings, cut).map((r) => ({ ...r, progressElapsed: 3 }));
    const results = rerank(dated, [{ field: 'work_unit', value: 'unit' }], 3);
    const receipts = store.searchKeyword(db, { term: 'receipts' })[0].score.toFixed(4);
    const ledgers = store.searchKeyword(db, { term: 'ledgers' })[0].score.toFixed(4);
    assert.deepStrictEqual(explanation(results.find((r) => r.id === VECTOR)), [
      'Framing 1: keyword absent, vector 0.6000 → 0.6000, blended 0.3600',
      `Framing 2: keyword ${ledgers} → 1.0000, vector 0.6000 → 0.6000, blended 0.7600`,
      "Score: kept framing 2's 0.7600 × 0.9000 decay + 0.1000 boost + 0.0300 tier = 0.8140",
    ]);
    assert.deepStrictEqual(explanation(results.find((r) => r.id === BOTH)), [
      `Framing 1: keyword ${receipts} → 1.0000, vector 1.0000 → 1.0000, blended 1.0000`,
      'Framing 2: keyword absent, vector 1.0000 → 1.0000, blended 0.6000',
      "Score: kept framing 1's 1.0000 × 0.9000 decay + 0.1000 boost + 0.0300 tier = 1.0300",
    ]);
  });

  it('keyword-only, prints the raw keyword score, and a framing whose hits lack the chunk as not in its top N', async () => {
    const db = axisStore();
    const { cut, framings } = await searchFramings(db, ['receipts', 'ledgers'], { limit: 10, similarity: 0.3, embed: null });
    const both = rerank(mergeFramings(framings, cut), [], 3).find((r) => r.id === BOTH);
    const raw = store.searchKeyword(db, { term: 'receipts' })[0].score;
    assert.deepStrictEqual(explanation(both), [
      `Framing 1: keyword ${raw.toFixed(4)}`,
      'Framing 2: not in its top 20',
      `Score: kept framing 1's ${raw.toFixed(4)} × 1.0000 decay + 0.0000 boost + 0.0300 tier = ${(raw + 0.03).toFixed(4)}`,
    ]);
  });

  it('never claims a framing missed a chunk it matched and ranked below the cut, in either mode', async () => {
    const db = storeOf(30);
    const shortest = 'unit-discussion-unit-001';
    assert.ok(store.searchKeyword(db, { term: 'refresh' }).some((h) => h.id === shortest), 'the term matches it');
    const embed = async (term) => (term === 'token' ? [1, 0] : [0, 1]);
    for (const mode of [null, embed]) {
      const { cut, framings } = await searchFramings(db, ['token', 'refresh'], { limit: 5, similarity: 0.3, embed: mode });
      const [result] = rerank(mergeFramings(framings, cut).filter((r) => r.id === shortest), [], 3);
      assert.strictEqual(explanation(result)[1], 'Framing 2: not in its top 10');
    }
  });
});
