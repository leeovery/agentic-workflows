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
