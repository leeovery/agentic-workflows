'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { StubProvider, STUB_MODEL_ID, DEFAULT_STUB_DIMENSIONS } = require('../../src/knowledge/embeddings.js');

describe('StubProvider', () => {
  it('returns a vector of correct length for a single string', () => {
    const p = new StubProvider();
    const v = p.embed('hello');
    assert.ok(Array.isArray(v));
    assert.strictEqual(v.length, p.dimensions());
    assert.strictEqual(v.length, DEFAULT_STUB_DIMENSIONS);
    for (const n of v) assert.strictEqual(typeof n, 'number');
  });

  it('returns identical vectors for identical input (determinism)', () => {
    const p = new StubProvider();
    const a = p.embed('hello world');
    const b = p.embed('hello world');
    assert.deepStrictEqual(a, b);
  });

  it('returns identical vectors across provider instances', () => {
    const a = new StubProvider().embed('stable');
    const b = new StubProvider().embed('stable');
    assert.deepStrictEqual(a, b);
  });

  it('returns different vectors for different input (differentiation)', () => {
    const p = new StubProvider();
    const a = p.embed('hello');
    const b = p.embed('world');
    assert.notDeepStrictEqual(a, b);
  });

  it('handles embedBatch with multiple inputs correctly', () => {
    const p = new StubProvider();
    const vectors = p.embedBatch(['a', 'b', 'c']);
    assert.strictEqual(vectors.length, 3);
    for (const v of vectors) {
      assert.ok(Array.isArray(v));
      assert.strictEqual(v.length, p.dimensions());
    }
    // single-item batch matches direct embed()
    const single = p.embedBatch(['a']);
    assert.strictEqual(single.length, 1);
    assert.deepStrictEqual(single[0], p.embed('a'));
  });

  it('returns empty array for empty batch', () => {
    const p = new StubProvider();
    const out = p.embedBatch([]);
    assert.ok(Array.isArray(out));
    assert.strictEqual(out.length, 0);
  });

  it('respects custom dimensions parameter', () => {
    const p = new StubProvider({ dimensions: 1536 });
    assert.strictEqual(p.dimensions(), 1536);
    assert.strictEqual(p.embed('hello').length, 1536);
  });

  it('returns a stable non-empty model() identifier', () => {
    const p = new StubProvider();
    const m = p.model();
    assert.strictEqual(typeof m, 'string');
    assert.ok(m.length > 0);
    assert.strictEqual(m, STUB_MODEL_ID);
    // stable across instances
    assert.strictEqual(new StubProvider({ dimensions: 512 }).model(), m);
  });

  it('never returns null (explicit assertion)', () => {
    const p = new StubProvider();
    const v = p.embed('anything');
    assert.notStrictEqual(v, null);
    assert.notStrictEqual(v, undefined);
    const batch = p.embedBatch(['a', 'b']);
    assert.notStrictEqual(batch, null);
    for (const item of batch) {
      assert.notStrictEqual(item, null);
      assert.notStrictEqual(item, undefined);
    }
  });

  it('handles empty string input without error', () => {
    const p = new StubProvider();
    const v = p.embed('');
    assert.ok(Array.isArray(v));
    assert.strictEqual(v.length, p.dimensions());
    // determinism holds for empty string
    assert.deepStrictEqual(p.embed(''), p.embed(''));
  });

  it('handles very long string input without error', () => {
    const p = new StubProvider();
    const long = 'x'.repeat(500000);
    const v = p.embed(long);
    assert.strictEqual(v.length, p.dimensions());
  });

  it('handles unicode input', () => {
    const p = new StubProvider();
    const a = p.embed('héllo 世界 🚀');
    const b = p.embed('héllo 世界 🚀');
    assert.deepStrictEqual(a, b);
    assert.notDeepStrictEqual(a, p.embed('hello world'));
  });

  it('rejects invalid dimensions at construction', () => {
    assert.throws(() => new StubProvider({ dimensions: 0 }));
    assert.throws(() => new StubProvider({ dimensions: -1 }));
    assert.throws(() => new StubProvider({ dimensions: 1.5 }));
  });

  it('rejects non-array input to embedBatch', () => {
    const p = new StubProvider();
    assert.throws(() => p.embedBatch('not an array'));
    assert.throws(() => p.embedBatch(null));
  });
});
