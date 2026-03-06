'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover } = require('../../skills/continue-feature/scripts/discovery');

describe('continue-feature discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  describe('list mode', () => {
    it('returns empty when no features exist', () => {
      const r = discover(dir);
      assert.strictEqual(r.mode, 'list');
      assert.strictEqual(r.count, 0);
      assert.strictEqual(r.features.length, 0);
    });

    it('lists active features only', () => {
      createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { status: 'in-progress' } } });
      createManifest(dir, 'old', { work_type: 'feature', status: 'archived' });
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
  });

  describe('single mode', () => {
    it('returns error for missing work unit', () => {
      const r = discover(dir, 'nonexistent');
      assert.strictEqual(r.error, 'not_found');
    });

    it('returns error for wrong type', () => {
      createManifest(dir, 'crash', { work_type: 'bugfix' });
      const r = discover(dir, 'crash');
      assert.strictEqual(r.error, 'wrong_type');
      assert.strictEqual(r.work_type, 'bugfix');
    });

    it('returns error for done feature', () => {
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
      const r = discover(dir, 'done');
      assert.strictEqual(r.error, 'done');
    });

    it('returns single feature data', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: {
          discussion: { status: 'concluded' },
          specification: { status: 'in-progress' },
        },
      });
      const r = discover(dir, 'auth');
      assert.strictEqual(r.mode, 'single');
      assert.strictEqual(r.feature.name, 'auth');
      assert.strictEqual(r.feature.next_phase, 'specification');
      assert.deepStrictEqual(r.feature.concluded_phases, ['discussion']);
    });
  });
});
