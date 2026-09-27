'use strict';

// Unit tests for progress-driven soft down-rank (idea #33, PR3).
// Imports the built bundle to validate the shipped surface.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { retrievability, rerank } = require('../../skills/workflow-knowledge/scripts/knowledge.cjs');

const EPS = 1e-9;
const close = (a, b) => Math.abs(a - b) < EPS;

describe('retrievability', () => {
  it('is 1 at the frontier (progressElapsed 0) for any stability', () => {
    assert.strictEqual(retrievability(0, 3), 1);
    assert.strictEqual(retrievability(0, 50), 1);
  });

  it('treats negative/garbage progressElapsed as 0 → 1', () => {
    assert.strictEqual(retrievability(-5, 3), 1);
  });

  it('is exactly 0.9 when progressElapsed equals stability', () => {
    assert.ok(close(retrievability(3, 3), 0.9));
    assert.ok(close(retrievability(10, 10), 0.9));
  });

  it('decreases monotonically as progressElapsed grows', () => {
    let prev = Infinity;
    for (let pe = 0; pe <= 40; pe++) {
      const r = retrievability(pe, 3);
      assert.ok(r <= prev);
      prev = r;
    }
  });

  it('decays slower with larger stability (same progressElapsed)', () => {
    assert.ok(retrievability(10, 6) > retrievability(10, 3));
  });
});

describe('rerank — soft down-rank', () => {
  it('multiplies the base score by R (no boosts/confidence)', () => {
    const out = rerank([{ id: 'a', score: 1.0, phase: 'discussion', progressElapsed: 3 }], [], 3);
    assert.ok(close(out[0].score, 0.9)); // 1.0 * 0.9^(3/3)
  });

  it('leaves a frontier chunk (progressElapsed 0) undecayed', () => {
    const out = rerank([{ id: 'a', score: 0.8, phase: 'discussion', progressElapsed: 0 }], [], 3);
    assert.ok(close(out[0].score, 0.8));
  });

  it('never decays specifications, regardless of progressElapsed', () => {
    const spec = rerank([{ id: 's', score: 0.8, phase: 'specification', progressElapsed: 50 }], [], 3);
    assert.ok(close(spec[0].score, 0.8)); // R forced to 1
    const disc = rerank([{ id: 'd', score: 0.8, phase: 'discussion', progressElapsed: 50 }], [], 3);
    assert.ok(disc[0].score < 0.2); // heavily decayed for comparison
  });

  it('sinks a high-similarity but heavily-decayed chunk below a fresh weaker one', () => {
    const out = rerank(
      [
        { id: 'stale', score: 0.95, phase: 'discussion', progressElapsed: 20 }, // 0.95*~0.495 ≈ 0.47
        { id: 'fresh', score: 0.80, phase: 'discussion', progressElapsed: 0 },  // 0.80
      ],
      [],
      3
    );
    assert.strictEqual(out[0].id, 'fresh');
    assert.strictEqual(out[1].id, 'stale');
  });

  it('adds user boosts on top, undimmed by decay', () => {
    const out = rerank(
      [{ id: 'a', score: 0.5, phase: 'discussion', work_unit: 'x', progressElapsed: 3 }],
      [{ field: 'work_unit', value: 'x' }],
      3
    );
    // base*R + boost = 0.5*0.9 + 0.1
    assert.ok(close(out[0].score, 0.55));
  });

  it('respects stability — larger S0 means less decay', () => {
    const tight = rerank([{ id: 'a', score: 1.0, phase: 'discussion', progressElapsed: 10 }], [], 3);
    const loose = rerank([{ id: 'a', score: 1.0, phase: 'discussion', progressElapsed: 10 }], [], 12);
    assert.ok(loose[0].score > tight[0].score);
  });

  it('adds the confidence tier, 0.01 per step, undimmed by decay', () => {
    const tiers = ['high', 'medium', 'low-medium', 'low', 'unknown'].map((confidence) =>
      rerank([{ id: confidence, score: 0.5, phase: 'discussion', confidence, progressElapsed: 3 }], [], 3)[0].score);
    const expected = [0.04, 0.03, 0.02, 0.01, 0].map((tier) => 0.5 * 0.9 + tier);
    tiers.forEach((score, i) => assert.ok(close(score, expected[i])));
  });

  it('records the decay, boost and tier each result received beside its scoring', () => {
    const [out] = rerank(
      [{ id: 'a', score: 0.5, phase: 'discussion', work_unit: 'x', confidence: 'low', progressElapsed: 3, scoring: { kept: 2 } }],
      [{ field: 'work_unit', value: 'x' }, { field: 'phase', value: 'discussion' }],
      3
    );
    assert.strictEqual(out.scoring.kept, 2);
    assert.ok(close(out.scoring.decay, 0.9));
    assert.ok(close(out.scoring.boost, 0.2));
    assert.ok(close(out.scoring.tier, 0.01));
    assert.ok(close(out.score, 0.5 * 0.9 + 0.2 + 0.01));
  });

  it('keeps results that score alike in the order they came', () => {
    const out = rerank(['b', 'a', 'c'].map((id) => ({ id, score: 0.5, phase: 'discussion' })), [], 3);
    assert.deepStrictEqual(out.map((r) => r.id), ['b', 'a', 'c']);
  });

  it('returns an empty array unchanged', () => {
    assert.deepStrictEqual(rerank([], [], 3), []);
  });
});
