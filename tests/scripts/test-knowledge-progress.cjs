'use strict';

// Unit tests for the progress clock (idea #33, PR2).
//
// Imports from the BUILT bundle so we validate the shipped surface. Covers the
// pure buildProgressClock() — the watermark that advances on completed work,
// not wall-clock time. getProgressClock() (the manifest IO wrapper) is thin
// glue exercised end-to-end by the CLI tests, not here.

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { buildProgressClock } = require('../../skills/workflow-knowledge/scripts/knowledge.cjs');

describe('buildProgressClock', () => {
  it('returns an empty map for empty / non-array input', () => {
    assert.strictEqual(buildProgressClock([]).size, 0);
    assert.strictEqual(buildProgressClock(undefined).size, 0);
    assert.strictEqual(buildProgressClock(null).size, 0);
  });

  it('gives a lone completed unit progressElapsed 0', () => {
    const clock = buildProgressClock([{ name: 'a', completed_at: '2024-01-01' }]);
    assert.strictEqual(clock.get('a'), 0);
    assert.strictEqual(clock.size, 1);
  });

  it('counts units completed strictly after each one', () => {
    const clock = buildProgressClock([
      { name: 'oldest', completed_at: '2024-01-01' },
      { name: 'middle', completed_at: '2024-06-01' },
      { name: 'newest', completed_at: '2024-12-01' },
    ]);
    assert.strictEqual(clock.get('oldest'), 2); // two completed after it
    assert.strictEqual(clock.get('middle'), 1);
    assert.strictEqual(clock.get('newest'), 0); // frontier
  });

  it('is independent of input ordering', () => {
    const shuffled = buildProgressClock([
      { name: 'newest', completed_at: '2024-12-01' },
      { name: 'oldest', completed_at: '2024-01-01' },
      { name: 'middle', completed_at: '2024-06-01' },
    ]);
    assert.strictEqual(shuffled.get('oldest'), 2);
    assert.strictEqual(shuffled.get('middle'), 1);
    assert.strictEqual(shuffled.get('newest'), 0);
  });

  it('does not count ties (equal completed_at) against one another', () => {
    const clock = buildProgressClock([
      { name: 'a', completed_at: '2024-05-01' },
      { name: 'b', completed_at: '2024-05-01' },
      { name: 'c', completed_at: '2024-09-01' },
    ]);
    // a and b tie; only c is strictly after both.
    assert.strictEqual(clock.get('a'), 1);
    assert.strictEqual(clock.get('b'), 1);
    assert.strictEqual(clock.get('c'), 0);
  });

  it('omits units with missing / blank / unparseable completed_at', () => {
    const clock = buildProgressClock([
      { name: 'dated', completed_at: '2024-01-01' },
      { name: 'missing' },
      { name: 'blank', completed_at: '' },
      { name: 'null-str', completed_at: 'null' },
      { name: 'garbage', completed_at: 'not-a-date' },
    ]);
    assert.strictEqual(clock.has('dated'), true);
    assert.strictEqual(clock.has('missing'), false);
    assert.strictEqual(clock.has('blank'), false);
    assert.strictEqual(clock.has('null-str'), false);
    assert.strictEqual(clock.has('garbage'), false);
    // The only placeable unit is the frontier.
    assert.strictEqual(clock.get('dated'), 0);
  });

  it('skips entries without a name', () => {
    const clock = buildProgressClock([
      { completed_at: '2024-01-01' },
      { name: 'a', completed_at: '2024-02-01' },
    ]);
    assert.strictEqual(clock.size, 1);
    assert.strictEqual(clock.get('a'), 0);
  });

  it('orders mixed date formats (epoch ms, ISO datetime, YYYY-MM-DD) consistently', () => {
    const clock = buildProgressClock([
      { name: 'date-only', completed_at: '2022-01-01' },
      { name: 'iso', completed_at: '2023-06-15T09:30:00Z' },
      { name: 'epoch', completed_at: new Date('2024-01-01T00:00:00Z').getTime() },
    ]);
    assert.strictEqual(clock.get('date-only'), 2);
    assert.strictEqual(clock.get('iso'), 1);
    assert.strictEqual(clock.get('epoch'), 0);
  });
});

describe('buildProgressClock — significance weighting', () => {
  const W = { 'quick-fix': 0.25, 'bugfix': 0.5, 'feature': 1.0, 'cross-cutting': 1.0, 'epic': 1.0 };
  const epic = (name, date, topics) => ({
    name,
    completed_at: date,
    work_type: 'epic',
    phases: { discussion: { items: Object.fromEntries(Array.from({ length: topics }, (_, i) => ['t' + i, {}])) } },
  });

  it('weighs later quick-fixes at 0.25 each', () => {
    const units = [
      { name: 'target', completed_at: '2024-01-01', work_type: 'feature' },
      { name: 'q1', completed_at: '2024-02-01', work_type: 'quick-fix' },
      { name: 'q2', completed_at: '2024-03-01', work_type: 'quick-fix' },
      { name: 'q3', completed_at: '2024-04-01', work_type: 'quick-fix' },
      { name: 'q4', completed_at: '2024-05-01', work_type: 'quick-fix' },
    ];
    assert.strictEqual(buildProgressClock(units, W).get('target'), 1.0); // 4 × 0.25
  });

  it('weighs an epic by its topic count', () => {
    const units = [
      { name: 'target', completed_at: '2024-01-01', work_type: 'feature' },
      epic('big', '2024-06-01', 4),
    ];
    assert.strictEqual(buildProgressClock(units, W).get('target'), 4); // 4 topics × 1.0
  });

  it('sums a mixed bag by significance', () => {
    const units = [
      { name: 'target', completed_at: '2024-01-01', work_type: 'feature' },
      { name: 'q', completed_at: '2024-02-01', work_type: 'quick-fix' }, // 0.25
      { name: 'b', completed_at: '2024-03-01', work_type: 'bugfix' },    // 0.5
      { name: 'f', completed_at: '2024-04-01', work_type: 'feature' },   // 1.0
      epic('e', '2024-05-01', 2),                                        // 2.0
    ];
    assert.ok(Math.abs(buildProgressClock(units, W).get('target') - 3.75) < 1e-9);
  });

  it('falls back to per-topic factor 1.0 with no weights — epics still weigh topics', () => {
    const units = [
      { name: 'target', completed_at: '2024-01-01', work_type: 'feature' },
      { name: 'q', completed_at: '2024-02-01', work_type: 'quick-fix' }, // 1 (no weight)
      epic('e', '2024-03-01', 3),                                        // 3 topics
    ];
    assert.strictEqual(buildProgressClock(units).get('target'), 4); // 1 + 3
  });

  it('treats an unknown work type as factor 1.0', () => {
    const units = [
      { name: 'target', completed_at: '2024-01-01', work_type: 'feature' },
      { name: 'weird', completed_at: '2024-02-01', work_type: 'made-up' },
    ];
    assert.strictEqual(buildProgressClock(units, W).get('target'), 1.0);
  });
});
