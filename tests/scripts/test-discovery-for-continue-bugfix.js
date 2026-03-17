'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover, format } = require('../../skills/continue-bugfix/scripts/discovery');

describe('continue-bugfix discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no bugfixes exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.bugfixes.length, 0);
    assert.strictEqual(r.summary, 'no active bugfixes');
  });

  it('lists active bugfixes only', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'old', { work_type: 'bugfix', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.bugfixes[0].name, 'crash');
  });

  it('excludes non-bugfix work types', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
  });

  it('excludes done bugfixes', () => {
    createManifest(dir, 'done', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { done: { status: 'completed' } } },
        specification: { items: { done: { status: 'completed' } } },
        planning: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
  });

  it('includes completed_phases', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { crash: { status: 'completed' } } },
        specification: { items: { crash: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.bugfixes[0].completed_phases, ['investigation']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'leak', { work_type: 'bugfix', phases: { specification: { items: { leak: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active bugfix(es)');
  });

  it('includes completed bugfixes in separate array', () => {
    createManifest(dir, 'done', { work_type: 'bugfix', status: 'completed', phases: { review: { items: { done: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'bugfix', phases: { investigation: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'review');
  });

  it('includes cancelled bugfixes in separate array', () => {
    createManifest(dir, 'stopped', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { stopped: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
    assert.strictEqual(r.cancelled[0].last_phase, 'investigation');
  });

  describe('edge cases', () => {
    it('recognizes completed as completed in completed_phases', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          investigation: { items: { crash: { status: 'completed' } } },
          specification: { items: { crash: { status: 'completed' } } },
          planning: { items: { crash: { status: 'completed' } } },
          implementation: { items: { crash: { status: 'completed' } } },
          review: { items: { crash: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.ok(r.bugfixes[0].completed_phases.includes('implementation'));
    });

    it('bugfix in review in-progress is listed (not filtered as done)', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          investigation: { items: { crash: { status: 'completed' } } },
          specification: { items: { crash: { status: 'completed' } } },
          planning: { items: { crash: { status: 'completed' } } },
          implementation: { items: { crash: { status: 'completed' } } },
          review: { items: { crash: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.bugfixes[0].next_phase, 'review');
    });

    it('research is not in bugfix completed_phases even if present', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          research: { items: { crash: { status: 'completed' } } },
          investigation: { items: { crash: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.ok(!r.bugfixes[0].completed_phases.includes('research'));
    });
  });
});

describe('continue-bugfix format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('includes header with count', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('=== BUGFIXES (0) ==='));
  });

  it('includes summary', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('summary: no active bugfixes'));
  });

  it('includes bugfix with phase_label and completed_phases', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { crash: { status: 'completed' } } },
        specification: { items: { crash: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  crash: specification (in-progress) [completed: investigation]'));
  });

  it('shows none for empty completed_phases', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { crash: { status: 'in-progress' } } } },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('[completed: none]'));
  });
});
