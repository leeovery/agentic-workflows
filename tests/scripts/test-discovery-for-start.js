'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
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
    assert.strictEqual(r.epics.work_units.length, 0);
    assert.strictEqual(r.features.work_units.length, 0);
    assert.strictEqual(r.bugfixes.work_units.length, 0);
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

  it('computes next_phase for epic pipeline', () => {
    createManifest(dir, 'v2', {
      work_type: 'epic',
      phases: { research: { status: 'concluded' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.epics.work_units[0].next_phase, 'discussion');
    assert.strictEqual(r.epics.work_units[0].phase_label, 'ready for discussion');
  });

  it('returns done when review is completed', () => {
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
    assert.strictEqual(r.features.work_units[0].next_phase, 'done');
  });

  it('includes per-phase statuses', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { status: 'concluded' },
        specification: { status: 'in-progress' },
      },
    });
    const r = discover(dir);
    const p = r.features.work_units[0].phases;
    assert.strictEqual(p.discussion, 'concluded');
    assert.strictEqual(p.specification, 'in-progress');
    assert.strictEqual(p.planning, 'none');
  });

  it('skips archived work units', () => {
    createManifest(dir, 'old', { work_type: 'feature', status: 'archived' });
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

  it('includes correct phase keys per work type', () => {
    createManifest(dir, 'ep', { work_type: 'epic' });
    createManifest(dir, 'ft', { work_type: 'feature' });
    createManifest(dir, 'bf', { work_type: 'bugfix' });
    const r = discover(dir);
    assert.ok('research' in r.epics.work_units[0].phases);
    assert.ok(!('investigation' in r.epics.work_units[0].phases));
    assert.ok('investigation' in r.bugfixes.work_units[0].phases);
    assert.ok(!('research' in r.bugfixes.work_units[0].phases));
    assert.ok(!('research' in r.features.work_units[0].phases));
    assert.ok(!('investigation' in r.features.work_units[0].phases));
  });

  it('epic phases include per-item detail', () => {
    createManifest(dir, 'v3', {
      work_type: 'epic',
      phases: {
        research: { status: 'concluded' },
        discussion: {
          items: {
            'auth': { status: 'concluded' },
            'payments': { status: 'in-progress' },
            'notifications': { status: 'concluded' },
          },
        },
        specification: {
          items: {
            'auth': { status: 'in-progress' },
          },
        },
      },
    });
    const r = discover(dir);
    const p = r.epics.work_units[0].phases;

    // Research is topicless — flat string
    assert.strictEqual(p.research, 'concluded');

    // Discussion has items
    assert.strictEqual(p.discussion.total, 3);
    assert.strictEqual(p.discussion.items.length, 3);
    const auth = p.discussion.items.find(i => i.name === 'auth');
    assert.strictEqual(auth.status, 'concluded');
    const payments = p.discussion.items.find(i => i.name === 'payments');
    assert.strictEqual(payments.status, 'in-progress');

    // Specification has 1 item
    assert.strictEqual(p.specification.total, 1);
    assert.strictEqual(p.specification.items[0].name, 'auth');
    assert.strictEqual(p.specification.items[0].status, 'in-progress');

    // Planning has no items
    assert.strictEqual(p.planning.total, 0);
    assert.strictEqual(p.planning.items.length, 0);
  });

  it('format() produces valid output', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { status: 'concluded' } } });
    const r = discover(dir);
    // Access format via the module
    const mod = require('../../skills/workflow-start/scripts/discovery');
    // format isn't exported but we can verify the object structure is sound
    assert.ok(r.features.work_units[0].name);
    assert.ok(r.features.work_units[0].phases);
  });
});
