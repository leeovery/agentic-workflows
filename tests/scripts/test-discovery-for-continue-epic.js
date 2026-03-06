'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover } = require('../../skills/continue-epic/scripts/discovery');

describe('continue-epic discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  describe('list mode', () => {
    it('returns empty when no epics exist', () => {
      const r = discover(dir);
      assert.strictEqual(r.mode, 'list');
      assert.strictEqual(r.count, 0);
    });

    it('lists active epics only', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      createManifest(dir, 'old', { work_type: 'epic', status: 'archived' });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.epics[0].name, 'v1');
    });

    it('excludes non-epic work types', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      createManifest(dir, 'auth', { work_type: 'feature' });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
    });

    it('includes active phases', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          research: { items: { exploration: { status: 'concluded' } } },
          discussion: { items: { auth: { status: 'in-progress' } } },
          specification: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].active_phases, ['research', 'discussion', 'specification']);
    });
  });

  describe('detail mode', () => {
    it('returns error for missing work unit', () => {
      const r = discover(dir, 'nonexistent');
      assert.strictEqual(r.error, 'not_found');
    });

    it('returns error for wrong type', () => {
      createManifest(dir, 'auth', { work_type: 'feature' });
      const r = discover(dir, 'auth');
      assert.strictEqual(r.error, 'wrong_type');
    });

    it('returns phase items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              auth: { status: 'concluded' },
              payments: { status: 'in-progress' },
            },
          },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.mode, 'detail');
      assert.strictEqual(r.phases.discussion.length, 2);
    });

    it('tracks in-progress items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'in-progress' } } },
          specification: { items: { billing: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.in_progress.length, 2);
      assert.strictEqual(r.in_progress[0].name, 'auth');
      assert.strictEqual(r.in_progress[0].phase, 'discussion');
    });

    it('tracks concluded items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.concluded.length, 1);
      assert.strictEqual(r.concluded[0].name, 'auth');
    });

    it('detects unaccounted discussions', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              auth: { status: 'concluded' },
              payments: { status: 'concluded' },
            },
          },
          specification: {
            items: {
              'auth-spec': {
                status: 'in-progress',
                sources: [{ topic: 'auth', status: 'incorporated' }],
              },
            },
          },
        },
      });
      const r = discover(dir, 'v1');
      assert.deepStrictEqual(r.unaccounted_discussions, ['payments']);
    });

    it('detects reopened discussions', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              auth: { status: 'in-progress' },
            },
          },
          specification: {
            items: {
              'auth-spec': {
                status: 'in-progress',
                sources: [{ topic: 'auth', status: 'incorporated' }],
              },
            },
          },
        },
      });
      const r = discover(dir, 'v1');
      assert.deepStrictEqual(r.reopened_discussions, ['auth']);
    });

    it('computes next-phase-ready: spec concluded no plan', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'concluded' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.next_phase_ready.length, 1);
      assert.strictEqual(r.next_phase_ready[0].action, 'start_planning');
    });

    it('computes next-phase-ready: plan concluded no impl', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: { items: { auth: { status: 'concluded' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.next_phase_ready.length, 1);
      assert.strictEqual(r.next_phase_ready[0].action, 'start_implementation');
    });

    it('computes next-phase-ready: impl completed no review', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          implementation: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.next_phase_ready.length, 1);
      assert.strictEqual(r.next_phase_ready[0].action, 'start_review');
    });

    it('does not show next-phase-ready when next phase already exists', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'concluded' } } },
          planning: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.next_phase_ready.length, 0);
    });

    it('sets gating flags correctly', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
          specification: { items: { auth: { status: 'concluded' } } },
          planning: { items: { auth: { status: 'concluded' } } },
          implementation: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.gating.can_start_specification, true);
      assert.strictEqual(r.gating.can_start_planning, true);
      assert.strictEqual(r.gating.can_start_implementation, true);
      assert.strictEqual(r.gating.can_start_review, true);
    });

    it('gating is false when no concluded items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.gating.can_start_specification, false);
      assert.strictEqual(r.gating.can_start_planning, false);
    });

    it('includes spec sources in phase items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: {
            items: {
              'payment-processing': {
                status: 'in-progress',
                sources: [
                  { topic: 'providers', status: 'incorporated' },
                  { topic: 'transactions', status: 'pending' },
                ],
              },
            },
          },
        },
      });
      const r = discover(dir, 'v1');
      const spec = r.phases.specification[0];
      assert.strictEqual(spec.sources.length, 2);
      assert.strictEqual(spec.sources[0].topic, 'providers');
      assert.strictEqual(spec.sources[0].status, 'incorporated');
    });

    it('handles empty epic (no phases)', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.mode, 'detail');
      assert.deepStrictEqual(r.phases, {});
      assert.strictEqual(r.in_progress.length, 0);
      assert.strictEqual(r.concluded.length, 0);
    });
  });
});
