'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/continue-epic/scripts/discovery.cjs');

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
    createManifest(dir, 'old', { work_type: 'epic', status: 'completed' });
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
        research: { items: { exploration: { status: 'completed' } } },
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

  it('includes completed epics in list mode', () => {
    createManifest(dir, 'done', { work_type: 'epic', status: 'completed', phases: { review: { items: { auth: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'epic', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'review');
  });

  it('includes cancelled epics in list mode', () => {
    createManifest(dir, 'stopped', { work_type: 'epic', status: 'cancelled', phases: { discussion: { items: { auth: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
  });

  it('does not include completed/cancelled in detail mode', () => {
    createManifest(dir, 'done', { work_type: 'epic', status: 'completed' });
    const r = discover(dir, 'done');
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.completed.length, 0);
  });

  describe('epic detail', () => {
    it('includes phase items in detail', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              auth: { status: 'completed' },
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

    it('tracks completed items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.completed.length, 1);
      assert.strictEqual(d.completed[0].name, 'auth');
    });

    it('detects unaccounted discussions', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              auth: { status: 'completed' },
              payments: { status: 'completed' },
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

    it('computes next-phase-ready: spec completed no plan', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.next_phase_ready.length, 1);
      assert.strictEqual(d.next_phase_ready[0].action, 'start_planning');
    });

    it('computes next-phase-ready: plan completed no impl', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: { items: { auth: { status: 'completed' } } },
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
          specification: { items: { auth: { status: 'completed' } } },
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
          research: { items: { 'market-analysis': { status: 'completed' } } },
          discussion: { items: { auth: { status: 'completed' } } },
          specification: { items: { auth: { status: 'completed' } } },
          planning: { items: { auth: { status: 'completed' } } },
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

    it('gating is false when no completed items', () => {
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
          discussion: { items: { auth: { status: 'completed' } } },
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
      assert.strictEqual(d.completed.length, 0);
    });

    it('computes pending_from_research from surfaced_topics diff', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          research: { surfaced_topics: ['auth', 'billing', 'data-model'] },
          discussion: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.pending_from_research.length, 2);
      assert.deepStrictEqual(d.pending_from_research.map(p => p.name), ['billing', 'data-model']);
      assert.strictEqual(d.pending_from_research[0].phase, 'discussion');
    });

    it('has_pending_discussions true when undiscussed surfaced topics exist', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          research: { surfaced_topics: ['auth', 'billing'] },
          discussion: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.gating.has_pending_discussions, true);
    });

    it('has_pending_discussions false when all surfaced topics are discussed', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          research: { surfaced_topics: ['auth'] },
          discussion: { items: { auth: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.gating.has_pending_discussions, false);
    });

    it('pending_from_research empty when no surfaced_topics', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          research: { items: { explore: { status: 'completed' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.pending_from_research.length, 0);
      assert.strictEqual(r.epics[0].detail.gating.has_pending_discussions, false);
    });
  });

  describe('edge cases', () => {
    it('sources using name field instead of topic', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
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
          discussion: { items: { auth: { status: 'completed' } } },
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
          discussion: { items: { auth: { status: 'completed' } } },
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
              auth: { status: 'completed' },
              billing: { status: 'completed' },
            },
          },
          planning: {
            items: {
              payments: { status: 'completed' },
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
              auth: { status: 'completed' },
              billing: { status: 'completed' },
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
      assert.strictEqual(g.has_pending_discussions, false);
      assert.strictEqual(g.can_start_discussion, false);
      assert.strictEqual(g.can_start_specification, false);
      assert.strictEqual(g.can_start_planning, false);
      assert.strictEqual(g.can_start_implementation, false);
      assert.strictEqual(g.can_start_review, false);
    });

    it('normalizes object-format sources to array', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: {
            items: {
              'core-system': {
                status: 'in-progress',
                sources: {
                  'core-architecture': { status: 'incorporated' },
                  'cli-commands-ux': { status: 'incorporated' },
                },
              },
            },
          },
        },
      });
      const r = discover(dir);
      const spec = r.epics[0].detail.phases.specification[0];
      assert.strictEqual(Array.isArray(spec.sources), true);
      assert.strictEqual(spec.sources.length, 2);
      assert.strictEqual(spec.sources[0].topic, 'core-architecture');
      assert.strictEqual(spec.sources[0].status, 'incorporated');
      assert.strictEqual(spec.sources[1].topic, 'cli-commands-ux');
    });

    it('object-format sources track unaccounted discussions correctly', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              auth: { status: 'completed' },
              payments: { status: 'completed' },
              billing: { status: 'completed' },
            },
          },
          specification: {
            items: {
              'core-system': {
                status: 'in-progress',
                sources: {
                  auth: { status: 'incorporated' },
                },
              },
            },
          },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.unaccounted_discussions.sort(), ['billing', 'payments']);
    });

    it('object-format sources detect reopened discussions', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'in-progress' } } },
          specification: {
            items: {
              'core-system': {
                status: 'in-progress',
                sources: {
                  auth: { status: 'incorporated' },
                },
              },
            },
          },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.epics[0].detail.reopened_discussions, ['auth']);
    });

    it('completed discussion that is in-progress is not both reopened and unaccounted', () => {
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

  describe('discovery map', () => {
    it('discovery_map empty and convergence absent when inception phase has no items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.deepStrictEqual(d.discovery_map, []);
      assert.strictEqual(d.convergence_state, null);
      assert.strictEqual(d.map_summary, null);
    });

    it('discovery_map empty for non-epic work types', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { inception: { items: { 'topic-a': { routing: 'research', source: 'inception' } } } },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 0);
    });

    it('inception items only render as fresh / ○ tier', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              'kitchen-hardware': { routing: 'research', source: 'inception' },
              'tenant-onboarding': { routing: 'discussion', source: 'inception' },
            },
          },
        },
      });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.strictEqual(d.discovery_map.length, 2);
      assert.ok(d.discovery_map.every(t => t.tier === '○'));
      assert.ok(d.discovery_map.every(t => t.lifecycle === 'fresh'));
      assert.strictEqual(d.map_summary.total, 2);
      assert.strictEqual(d.map_summary.fresh, 2);
      assert.strictEqual(d.convergence_state, 'in-progress');
    });

    it('tier ordering: → ◐ ✓ ○ ⊘ with alphabetical within tier', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              'zeta-fresh': { routing: 'research', source: 'inception' },
              'alpha-fresh': { routing: 'discussion', source: 'inception' },
              'ready-topic': { routing: 'research', source: 'inception' },
              'in-flight': { routing: 'research', source: 'inception' },
              'decided-topic': { routing: 'discussion', source: 'inception' },
              'cancelled-topic': { routing: 'research', source: 'inception' },
            },
          },
          research: {
            items: {
              'ready-topic': { status: 'completed' },
              'in-flight': { status: 'in-progress' },
              'cancelled-topic': { status: 'cancelled' },
            },
          },
          discussion: {
            items: {
              'decided-topic': { status: 'completed' },
              'cancelled-topic': { status: 'cancelled' },
            },
          },
        },
      });
      const r = discover(dir);
      const tiers = r.epics[0].detail.discovery_map.map(t => `${t.tier} ${t.name}`);
      assert.deepStrictEqual(tiers, [
        '→ ready-topic',
        '◐ in-flight',
        '✓ decided-topic',
        '○ alpha-fresh',
        '○ zeta-fresh',
        '⊘ cancelled-topic',
      ]);
    });

    it('lifecycle: routing=research no phase items → fresh', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'research', source: 'inception' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'fresh');
      assert.strictEqual(t.tier, '○');
      assert.strictEqual(t.next_action, 'start_research');
    });

    it('lifecycle: routing=discussion no phase items → fresh, next=start_discussion', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'discussion', source: 'inception' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'fresh');
      assert.strictEqual(t.next_action, 'start_discussion');
    });

    it('lifecycle: research in-progress → researching, ◐, continue_research', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'research', source: 'inception' } } },
          research: { items: { topic: { status: 'in-progress' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'researching');
      assert.strictEqual(t.tier, '◐');
      assert.strictEqual(t.next_action, 'continue_research');
      assert.strictEqual(t.current_phase, 'research');
    });

    it('lifecycle: research completed, no discussion → ready_for_discussion, →', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'research', source: 'inception' } } },
          research: { items: { topic: { status: 'completed' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'ready_for_discussion');
      assert.strictEqual(t.tier, '→');
      assert.strictEqual(t.next_action, 'start_discussion_after_research');
    });

    it('lifecycle: discussion in-progress → discussing, ◐, continue_discussion', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'discussion', source: 'inception' } } },
          discussion: { items: { topic: { status: 'in-progress' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'discussing');
      assert.strictEqual(t.tier, '◐');
      assert.strictEqual(t.next_action, 'continue_discussion');
      assert.strictEqual(t.current_phase, 'discussion');
    });

    it('lifecycle: discussion completed → decided, ✓, no next_action', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'discussion', source: 'inception' } } },
          discussion: { items: { topic: { status: 'completed' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'decided');
      assert.strictEqual(t.tier, '✓');
      assert.strictEqual(t.next_action, null);
    });

    it('lifecycle: research cancelled, no discussion → fresh (single-cancelled)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'research', source: 'inception' } } },
          research: { items: { topic: { status: 'cancelled' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'fresh');
      assert.strictEqual(t.tier, '○');
    });

    it('lifecycle: research cancelled AND discussion cancelled → cancelled, ⊘', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'research', source: 'inception' } } },
          research: { items: { topic: { status: 'cancelled' } } },
          discussion: { items: { topic: { status: 'cancelled' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'cancelled');
      assert.strictEqual(t.tier, '⊘');
      assert.strictEqual(t.next_action, null);
    });

    it('convergence: all decided → settled', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              a: { routing: 'discussion', source: 'inception' },
              b: { routing: 'discussion', source: 'inception' },
            },
          },
          discussion: {
            items: {
              a: { status: 'completed' },
              b: { status: 'completed' },
            },
          },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.convergence_state, 'settled');
    });

    it('convergence: all decided or cancelled → settled', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              a: { routing: 'discussion', source: 'inception' },
              b: { routing: 'research', source: 'inception' },
            },
          },
          research: { items: { b: { status: 'cancelled' } } },
          discussion: {
            items: {
              a: { status: 'completed' },
              b: { status: 'cancelled' },
            },
          },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.convergence_state, 'settled');
    });

    it('convergence: any non-decided → in-progress', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              a: { routing: 'discussion', source: 'inception' },
              b: { routing: 'research', source: 'inception' },
            },
          },
          discussion: { items: { a: { status: 'completed' } } },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.convergence_state, 'in-progress');
    });

    it('source provenance: inception → null', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { inception: { items: { topic: { routing: 'research', source: 'inception' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, null);
    });

    it('source provenance: research-split:{parent} → from {parent}', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { inception: { items: { topic: { routing: 'research', source: 'research-split:kitchen-hardware' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from kitchen-hardware');
    });

    it('source provenance: gap-analysis → from gap-analysis', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { inception: { items: { topic: { routing: 'discussion', source: 'gap-analysis' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from gap-analysis');
    });

    it('source provenance: direct-start → from direct-start', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { inception: { items: { topic: { routing: 'research', source: 'direct-start' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from direct-start');
    });

    it('map_summary counts omit nothing — all categories present', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              ready: { routing: 'research', source: 'inception' },
              flight: { routing: 'research', source: 'inception' },
              done: { routing: 'discussion', source: 'inception' },
              fresh1: { routing: 'discussion', source: 'inception' },
              cancelled: { routing: 'research', source: 'inception' },
            },
          },
          research: {
            items: {
              ready: { status: 'completed' },
              flight: { status: 'in-progress' },
              cancelled: { status: 'cancelled' },
            },
          },
          discussion: {
            items: {
              done: { status: 'completed' },
              cancelled: { status: 'cancelled' },
            },
          },
        },
      });
      const s = discover(dir).epics[0].detail.map_summary;
      assert.strictEqual(s.total, 5);
      assert.strictEqual(s.ready, 1);
      assert.strictEqual(s.in_flight, 1);
      assert.strictEqual(s.decided, 1);
      assert.strictEqual(s.fresh, 1);
      assert.strictEqual(s.cancelled, 1);
    });

    it('excludes inception from phases output (lives in discovery_map only)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: { items: { topic: { routing: 'research', source: 'inception' } } },
          discussion: { items: { topic: { status: 'in-progress' } } },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.phases.inception, undefined);
      assert.ok(d.phases.discussion);
    });

    it('inception items are not flagged as in-progress / cancelled / completed', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              alpha: { routing: 'research', source: 'inception' },
              beta: { routing: 'discussion', source: 'inception' },
            },
          },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.in_progress.length, 0);
      assert.strictEqual(d.completed.length, 0);
      assert.strictEqual(d.cancelled.length, 0);
    });

    it('preserves summary and routing fields on map entries', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          inception: {
            items: {
              topic: {
                routing: 'discussion',
                source: 'inception',
                summary: 'A one-line description',
              },
            },
          },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.summary, 'A one-line description');
      assert.strictEqual(t.routing, 'discussion');
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
          discussion: { items: { auth: { status: 'completed' } } },
          specification: { items: { auth: { status: 'completed' } } },
        },
      });
      createManifest(dir, 'v2', {
        work_type: 'epic',
        phases: { discussion: { items: { billing: { status: 'in-progress' } } } },
      });
      const r = discover(dir, 'v1');
      assert.strictEqual(r.count, 1);
      const d = r.epics[0].detail;
      assert.strictEqual(d.completed.length, 2);
      assert.strictEqual(d.gating.can_start_specification, true);
      assert.strictEqual(d.gating.can_start_planning, true);
    });
  });
});

describe('continue-epic format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('includes header with count and summary', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('=== EPICS (0) ==='));
    assert.ok(out.includes('summary: no active epics'));
  });

  it('includes epic name with active phases', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { items: { exploration: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  v1: research, discussion'));
  });

  it('shows (no phases) for empty epic', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const out = format(discover(dir));
    assert.ok(out.includes('  v1: (no phases)'));
  });

  it('includes phase items with status', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('    discussion:'));
    assert.ok(out.includes('      - auth (in-progress)'));
  });

  it('includes sources in item output', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
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
    const out = format(discover(dir));
    assert.ok(out.includes('[sources: auth:incorporated]'));
  });

  it('includes in-progress section', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('    in-progress:'));
    assert.ok(out.includes('      - auth (discussion)'));
  });

  it('includes next-phase-ready section', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: { items: { auth: { status: 'completed' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('    next-phase-ready:'));
    assert.ok(out.includes('start_planning'));
  });

  it('includes completed section', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('    completed:'));
    assert.ok(out.includes('      - auth (discussion)'));
  });

  it('includes pending_from_research in format output', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { surfaced_topics: ['auth', 'billing'] },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('    pending_from_research: auth, billing'));
  });

  it('formats object-format sources correctly', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: {
          items: {
            'core-system': {
              status: 'in-progress',
              sources: {
                auth: { status: 'incorporated' },
                billing: { status: 'pending' },
              },
            },
          },
        },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('[sources: auth:incorporated, billing:pending]'));
  });

  it('includes unaccounted_discussions', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: {
            auth: { status: 'completed' },
            payments: { status: 'completed' },
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
    const out = format(discover(dir));
    assert.ok(out.includes('    unaccounted_discussions: payments'));
  });
});
