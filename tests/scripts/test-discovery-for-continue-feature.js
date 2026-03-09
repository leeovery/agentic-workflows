'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover } = require('../../skills/continue-feature/scripts/discovery');

describe('continue-feature discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no features exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.features.length, 0);
    assert.strictEqual(r.summary, 'no active features');
  });

  it('lists active features only', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { status: 'in-progress' } } });
    createManifest(dir, 'old', { work_type: 'feature', status: 'concluded' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.features[0].name, 'auth');
  });

  it('excludes non-feature work types', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { status: 'in-progress' } } });
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { status: 'in-progress' } } });
    createManifest(dir, 'v1', { work_type: 'epic' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.features[0].name, 'auth');
  });

  it('excludes done features', () => {
    createManifest(dir, 'done', {
      work_type: 'feature',
      phases: {
        discussion: { status: 'concluded' },
        specification: { status: 'concluded' },
        planning: { status: 'concluded' },
        implementation: { status: 'completed' },
        review: { status: 'completed' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
  });

  it('includes phase_label and concluded_phases', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { status: 'concluded' },
        specification: { status: 'in-progress' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.features[0].phase_label, 'specification (in-progress)');
    assert.deepStrictEqual(r.features[0].concluded_phases, ['discussion']);
  });

  it('returns multiple concluded phases', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        research: { status: 'concluded' },
        discussion: { status: 'concluded' },
        specification: { status: 'concluded' },
        planning: { status: 'in-progress' },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.features[0].concluded_phases, ['research', 'discussion', 'specification']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { status: 'in-progress' } } });
    createManifest(dir, 'billing', { work_type: 'feature', phases: { planning: { status: 'in-progress' } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active feature(s)');
  });

  describe('edge cases', () => {
    it('recognizes completed as concluded in concluded_phases', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: {
          discussion: { status: 'concluded' },
          specification: { status: 'concluded' },
          planning: { status: 'concluded' },
          implementation: { status: 'completed' },
          review: { status: 'in-progress' },
        },
      });
      const r = discover(dir);
      assert.ok(r.features[0].concluded_phases.includes('implementation'));
    });

    it('feature in review in-progress is listed (not filtered as done)', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: {
          discussion: { status: 'concluded' },
          specification: { status: 'concluded' },
          planning: { status: 'concluded' },
          implementation: { status: 'completed' },
          review: { status: 'in-progress' },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.features[0].next_phase, 'review');
    });

    it('feature with only research concluded has it in concluded_phases', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { research: { status: 'concluded' } },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.features[0].concluded_phases, ['research']);
    });
  });
});
