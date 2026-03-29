'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/continue-quickfix/scripts/discovery.cjs');

describe('continue-quickfix discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no quick-fixes exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.quick_fixes.length, 0);
    assert.strictEqual(r.summary, 'no active quick-fixes');
  });

  it('lists active quick-fixes only', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'old', { work_type: 'quick-fix', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.quick_fixes[0].name, 'rename-api');
  });

  it('excludes non-quick-fix work types', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
  });

  it('excludes done quick-fixes', () => {
    createManifest(dir, 'done', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
  });

  it('includes completed_phases', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.quick_fixes[0].completed_phases, ['scoping']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'update-deps', { work_type: 'quick-fix', phases: { implementation: { items: { 'update-deps': { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active quick-fix(es)');
  });

  it('includes completed quick-fixes in separate array', () => {
    createManifest(dir, 'done', { work_type: 'quick-fix', status: 'completed', phases: { review: { items: { done: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'quick-fix', phases: { scoping: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'review');
  });

  it('includes cancelled quick-fixes in separate array', () => {
    createManifest(dir, 'stopped', { work_type: 'quick-fix', status: 'cancelled', phases: { scoping: { items: { stopped: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
    assert.strictEqual(r.cancelled[0].last_phase, 'scoping');
  });

  describe('edge cases', () => {
    it('completed_phases includes all three pipeline phases when completed', () => {
      createManifest(dir, 'qf', {
        work_type: 'quick-fix',
        phases: {
          scoping: { items: { qf: { status: 'completed' } } },
          implementation: { items: { qf: { status: 'completed' } } },
          review: { items: { qf: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.quick_fixes[0].completed_phases, ['scoping', 'implementation']);
    });

    it('quick-fix in review in-progress is listed (not filtered as done)', () => {
      createManifest(dir, 'qf', {
        work_type: 'quick-fix',
        phases: {
          scoping: { items: { qf: { status: 'completed' } } },
          implementation: { items: { qf: { status: 'completed' } } },
          review: { items: { qf: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.quick_fixes[0].next_phase, 'review');
    });

    it('discussion is not in quick-fix completed_phases even if present', () => {
      createManifest(dir, 'qf', {
        work_type: 'quick-fix',
        phases: {
          discussion: { items: { qf: { status: 'completed' } } },
          scoping: { items: { qf: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.ok(!r.quick_fixes[0].completed_phases.includes('discussion'));
    });
  });
});

describe('continue-quickfix format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('includes header with count', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('=== QUICK-FIXES (0) ==='));
  });

  it('includes summary', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('summary: no active quick-fixes'));
  });

  it('includes quick-fix with phase_label and completed_phases', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  rename-api: implementation (in-progress) [completed: scoping]'));
  });

  it('shows none for empty completed_phases', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('[completed: none]'));
  });
});
