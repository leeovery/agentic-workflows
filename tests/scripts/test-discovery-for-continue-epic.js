'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover } = require('../../skills/continue-epic/scripts/discovery');

describe('continue-epic discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no epics exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.epics.length, 0);
    assert.strictEqual(r.summary, 'no active epics');
  });

  it('lists active epics only', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    createManifest(dir, 'old', { work_type: 'epic', status: 'concluded' });
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

  it('returns summary with count', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'v2', { work_type: 'epic' });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active epic(s)');
  });

  describe('epic detail', () => {
    it('includes phase items in detail', () => {
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
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.phases.discussion.length, 2);
    });

    it('tracks in-progress items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'in-progress' } } },
          specification: { items: { billing: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.in_progress.length, 2);
      assert.strictEqual(d.in_progress[0].name, 'auth');
      assert.strictEqual(d.in_progress[0].phase, 'discussion');
    });

    it('tracks concluded items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.concluded.length, 1);
      assert.strictEqual(d.concluded[0].name, 'auth');
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
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.unaccounted_discussions, ['payments']);
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
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.reopened_discussions, ['auth']);
    });

    it('computes next-phase-ready: spec concluded no plan', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'concluded' } } },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.next_phase_ready.length, 1);
      assert.strictEqual(d.next_phase_ready[0].action, 'start_planning');
    });

    it('computes next-phase-ready: plan concluded no impl', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: { items: { auth: { status: 'concluded' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.next_phase_ready[0].action, 'start_implementation');
    });

    it('computes next-phase-ready: impl completed no review', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          implementation: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.next_phase_ready[0].action, 'start_review');
    });

    it('does not show next-phase-ready when next phase already exists', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'concluded' } } },
          planning: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.next_phase_ready.length, 0);
    });

    it('sets gating flags correctly', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          research: { items: { 'market-analysis': { status: 'concluded' } } },
          discussion: { items: { auth: { status: 'concluded' } } },
          specification: { items: { auth: { status: 'concluded' } } },
          planning: { items: { auth: { status: 'concluded' } } },
          implementation: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      const g = r.epics[0].detail.gating;
      assert.strictEqual(g.has_research, true);
      assert.strictEqual(g.can_start_discussion, true);
      assert.strictEqual(g.can_start_specification, true);
      assert.strictEqual(g.can_start_planning, true);
      assert.strictEqual(g.can_start_implementation, true);
      assert.strictEqual(g.can_start_review, true);
    });

    it('gating is false when no concluded items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          research: { items: { 'market-analysis': { status: 'in-progress' } } },
          discussion: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      const g = r.epics[0].detail.gating;
      assert.strictEqual(g.has_research, true);
      assert.strictEqual(g.can_start_discussion, false);
      assert.strictEqual(g.can_start_specification, false);
      assert.strictEqual(g.can_start_planning, false);
    });

    it('has_research is false when no research items exist', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
        },
      });
      const r = discover(dir);
      const g = r.epics[0].detail.gating;
      assert.strictEqual(g.has_research, false);
      assert.strictEqual(g.can_start_discussion, false);
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
      const r = discover(dir);
      const spec = r.epics[0].detail.phases.specification[0];
      assert.strictEqual(spec.sources.length, 2);
      assert.strictEqual(spec.sources[0].topic, 'providers');
    });

    it('handles empty epic (no phases)', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.deepStrictEqual(d.phases, {});
      assert.strictEqual(d.in_progress.length, 0);
      assert.strictEqual(d.concluded.length, 0);
    });
  });

  describe('edge cases', () => {
    it('sources using name field instead of topic', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
          specification: {
            items: {
              'auth-spec': {
                status: 'in-progress',
                sources: [{ name: 'auth', status: 'incorporated' }],
              },
            },
          },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.unaccounted_discussions, []);
    });

    it('spec with empty sources array', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
          specification: {
            items: {
              'auth-spec': { status: 'in-progress', sources: [] },
            },
          },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.unaccounted_discussions, ['auth']);
    });

    it('spec with no sources field', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
          specification: {
            items: {
              'auth-spec': { status: 'in-progress' },
            },
          },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.unaccounted_discussions, ['auth']);
    });

    it('multiple items ready simultaneously', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: {
            items: {
              auth: { status: 'concluded' },
              billing: { status: 'concluded' },
            },
          },
          planning: {
            items: {
              payments: { status: 'concluded' },
            },
          },
          implementation: {
            items: {
              core: { status: 'completed' },
            },
          },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.next_phase_ready.length, 4);
      const actions = d.next_phase_ready.map(n => n.action).sort();
      assert.deepStrictEqual(actions, ['start_implementation', 'start_planning', 'start_planning', 'start_review']);
    });

    it('unaccounted discussions when spec has no sources field at all', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              auth: { status: 'concluded' },
              billing: { status: 'concluded' },
            },
          },
          specification: {
            items: {
              'combined-spec': { status: 'in-progress' },
            },
          },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.unaccounted_discussions.length, 2);
    });

    it('gating flags all false for empty epic', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      const r = discover(dir);
      const g = r.epics[0].detail.gating;
      assert.strictEqual(g.has_research, false);
      assert.strictEqual(g.can_start_discussion, false);
      assert.strictEqual(g.can_start_specification, false);
      assert.strictEqual(g.can_start_planning, false);
      assert.strictEqual(g.can_start_implementation, false);
      assert.strictEqual(g.can_start_review, false);
    });

    it('concluded discussion that is in-progress is not both reopened and unaccounted', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'in-progress' } } },
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
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.reopened_discussions, ['auth']);
      assert.deepStrictEqual(r.epics[0].detail.unaccounted_discussions, []);
    });
  });

  describe('work_unit filtering', () => {
    it('returns only the specified epic when work_unit provided', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      createManifest(dir, 'v2', {
        work_type: 'epic',
        phases: { discussion: { items: { billing: { status: 'in-progress' } } } },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.epics[0].name, 'v1');
    });

    it('returns all epics when work_unit not provided', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      createManifest(dir, 'v2', {
        work_type: 'epic',
        phases: { discussion: { items: { billing: { status: 'in-progress' } } } },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 2);
    });

    it('returns empty when work_unit does not match any epic', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const r = discover(dir, 'nonexistent');
      assert.strictEqual(r.count, 0);
    });

    it('filters by work_unit and still excludes non-epic types', () => {
      createManifest(dir, 'auth', { work_type: 'feature' });
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const r = discover(dir, 'auth');
      assert.strictEqual(r.count, 0);
    });

    it('produces full detail for filtered epic', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'concluded' } } },
          specification: { items: { auth: { status: 'concluded' } } },
        },
      });
      createManifest(dir, 'v2', {
        work_type: 'epic',
        phases: { discussion: { items: { billing: { status: 'in-progress' } } } },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.count, 1);
      const d = r.epics[0].detail;
      assert.strictEqual(d.concluded.length, 2);
      assert.strictEqual(d.gating.can_start_specification, true);
      assert.strictEqual(d.gating.can_start_planning, true);
    });
  });
});
