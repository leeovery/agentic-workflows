'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover } = require('../../skills/continue-bugfix/scripts/discovery');

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
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { status: 'in-progress' } } });
    createManifest(dir, 'old', { work_type: 'bugfix', status: 'archived' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.bugfixes[0].name, 'crash');
  });

  it('excludes non-bugfix work types', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { status: 'in-progress' } } });
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
  });

  it('excludes done bugfixes', () => {
    createManifest(dir, 'done', {
      work_type: 'bugfix',
      phases: {
        investigation: { status: 'concluded' },
        specification: { status: 'concluded' },
        planning: { status: 'concluded' },
        implementation: { status: 'completed' },
        review: { status: 'completed' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
  });

  it('includes concluded_phases', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: {
        investigation: { status: 'concluded' },
        specification: { status: 'in-progress' },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.bugfixes[0].concluded_phases, ['investigation']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { status: 'in-progress' } } });
    createManifest(dir, 'leak', { work_type: 'bugfix', phases: { specification: { status: 'in-progress' } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active bugfix(es)');
  });

  describe('edge cases', () => {
    it('recognizes completed as concluded in concluded_phases', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          investigation: { status: 'concluded' },
          specification: { status: 'concluded' },
          planning: { status: 'concluded' },
          implementation: { status: 'completed' },
          review: { status: 'in-progress' },
        },
      });
      const r = discover(dir);
      assert.ok(r.bugfixes[0].concluded_phases.includes('implementation'));
    });

    it('bugfix in review in-progress is listed (not filtered as done)', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          investigation: { status: 'concluded' },
          specification: { status: 'concluded' },
          planning: { status: 'concluded' },
          implementation: { status: 'completed' },
          review: { status: 'in-progress' },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.bugfixes[0].next_phase, 'review');
    });

    it('research is not in bugfix concluded_phases even if present', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          research: { status: 'concluded' },
          investigation: { status: 'in-progress' },
        },
      });
      const r = discover(dir);
      assert.ok(!r.bugfixes[0].concluded_phases.includes('research'));
    });
  });
});
