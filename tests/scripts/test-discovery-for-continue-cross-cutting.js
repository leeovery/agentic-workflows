'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover, format } = require('../../skills/continue-cross-cutting/scripts/discovery');

describe('continue-cross-cutting discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no cross-cutting concerns exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.cross_cutting.length, 0);
    assert.strictEqual(r.summary, 'no active cross-cutting concerns');
  });

  it('lists active cross-cutting concerns only', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'old', { work_type: 'cross-cutting', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.cross_cutting[0].name, 'caching');
  });

  it('excludes non-cross-cutting work types', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'v1', { work_type: 'epic' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.cross_cutting[0].name, 'caching');
  });

  it('excludes done cross-cutting concerns', () => {
    createManifest(dir, 'done-cc', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { 'done-cc': { status: 'completed' } } },
        specification: { items: { 'done-cc': { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
  });

  it('includes phase_label and completed_phases', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.cross_cutting[0].phase_label, 'specification (in-progress)');
    assert.deepStrictEqual(r.cross_cutting[0].completed_phases, ['discussion']);
  });

  it('returns multiple completed phases', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        research: { items: { caching: { status: 'completed' } } },
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.cross_cutting[0].completed_phases, ['research', 'discussion']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'error-handling', { work_type: 'cross-cutting', phases: { specification: { items: { 'error-handling': { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active cross-cutting concern(s)');
  });

  it('includes completed cross-cutting concerns in separate array', () => {
    createManifest(dir, 'done', { work_type: 'cross-cutting', status: 'completed', phases: { specification: { items: { done: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'cross-cutting', phases: { discussion: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'specification');
  });

  it('includes cancelled cross-cutting concerns in separate array', () => {
    createManifest(dir, 'stopped', { work_type: 'cross-cutting', status: 'cancelled', phases: { discussion: { items: { stopped: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
    assert.strictEqual(r.cancelled[0].last_phase, 'discussion');
  });

  it('excludes non-cross-cutting completed work units', () => {
    createManifest(dir, 'done-feat', { work_type: 'feature', status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.completed_count, 0);
  });
});

describe('continue-cross-cutting format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('includes header with count', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('=== CROSS-CUTTING (0) ==='));
  });

  it('includes summary', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('summary: no active cross-cutting concerns'));
  });

  it('includes cross-cutting concern with phase_label and completed_phases', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  caching: specification (in-progress) [completed: discussion]'));
  });

  it('shows none for empty completed_phases', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: { discussion: { items: { caching: { status: 'in-progress' } } } },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('[completed: none]'));
  });
});
