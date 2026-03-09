'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover } = require('../../skills/workflow-start/scripts/discovery');

describe('workflow-start discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty state when no work units exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, false);
    assert.strictEqual(r.state.epic_count, 0);
    assert.strictEqual(r.state.feature_count, 0);
    assert.strictEqual(r.state.bugfix_count, 0);
  });

  it('groups work units by type', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'dark-mode', { work_type: 'feature' });
    createManifest(dir, 'login-crash', { work_type: 'bugfix' });
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, true);
    assert.strictEqual(r.state.epic_count, 1);
    assert.strictEqual(r.state.feature_count, 1);
    assert.strictEqual(r.state.bugfix_count, 1);
    assert.strictEqual(r.epics.work_units[0].name, 'v1');
    assert.strictEqual(r.features.work_units[0].name, 'dark-mode');
    assert.strictEqual(r.bugfixes.work_units[0].name, 'login-crash');
  });

  it('computes next_phase for feature pipeline', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.features.work_units[0].next_phase, 'specification');
    assert.strictEqual(r.features.work_units[0].phase_label, 'ready for specification');
  });

  it('computes next_phase for bugfix pipeline', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'in-progress' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.bugfixes.work_units[0].next_phase, 'investigation');
    assert.strictEqual(r.bugfixes.work_units[0].phase_label, 'investigation (in-progress)');
  });

  it('filters out done work units', () => {
    createManifest(dir, 'done-feature', {
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
    assert.strictEqual(r.state.has_any_work, false);
    assert.strictEqual(r.features.count, 0);
  });

  it('skips archived work units', () => {
    createManifest(dir, 'old', { work_type: 'feature', status: 'concluded' });
    createManifest(dir, 'active', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.state.feature_count, 1);
    assert.strictEqual(r.features.work_units[0].name, 'active');
  });

  it('handles multiple features', () => {
    createManifest(dir, 'a', { work_type: 'feature', phases: { discussion: { status: 'in-progress' } } });
    createManifest(dir, 'b', { work_type: 'feature', phases: { specification: { status: 'concluded' } } });
    const r = discover(dir);
    assert.strictEqual(r.state.feature_count, 2);
    assert.strictEqual(r.features.work_units.length, 2);
  });

  it('epic includes active_phases', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { items: { exploration: { status: 'concluded' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.epics.work_units[0].active_phases, ['research', 'discussion', 'specification']);
  });

  it('epic with no phases has empty active_phases', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const r = discover(dir);
    assert.deepStrictEqual(r.epics.work_units[0].active_phases, []);
  });

  it('feature/bugfix units include phase_label', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'in-progress' } },
    });
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'concluded' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.features.work_units[0].phase_label, 'discussion (in-progress)');
    assert.strictEqual(r.bugfixes.work_units[0].phase_label, 'ready for specification');
  });

  it('mixed active and done in same type only shows active', () => {
    createManifest(dir, 'active-feat', {
      work_type: 'feature',
      phases: { discussion: { status: 'in-progress' } },
    });
    createManifest(dir, 'done-feat', {
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
    assert.strictEqual(r.features.count, 1);
    assert.strictEqual(r.features.work_units[0].name, 'active-feat');
  });

  it('has_any_work is false when only concluded and done exist', () => {
    createManifest(dir, 'archived', { work_type: 'feature', status: 'concluded' });
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
    assert.strictEqual(r.state.has_any_work, false);
  });

  it('epic active_phases detects phase with flat status but no items', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { status: 'in-progress' } },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.epics.work_units[0].active_phases, ['research']);
  });

  it('feature in review (in-progress) is not filtered out', () => {
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
    assert.strictEqual(r.features.count, 1);
    assert.strictEqual(r.features.work_units[0].next_phase, 'review');
  });
});
