'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover, format, formatScoped } = require('../../skills/workflow-continue-epic/scripts/gateway.cjs');

describe('workflow-continue-epic discovery', () => {
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
      assert.strictEqual(g.can_start_specification, false);
      assert.strictEqual(g.can_start_planning, false);
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

    it('exposes analysis_caches shape on epic detail', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      const r = discover(dir);
      const d = r.epics[0].detail;
      assert.ok(d.analysis_caches);
      assert.ok(d.analysis_caches.research_analysis);
      assert.ok(d.analysis_caches.gap_analysis);
      assert.strictEqual(d.analysis_caches.research_analysis.status, 'absent');
      assert.strictEqual(d.analysis_caches.gap_analysis.status, 'absent');
    });

    it('discovery_map exposes source, summary text, and presence booleans per item for legacy-recovery filter', () => {
      // workflow-continue-epic Step 5 (Backfill) filters discovery_map by
      // (!summary_present || !description_present) — source-agnostic. Any
      // write path that lands an item with missing fields surfaces for
      // review:
      // - migration-seeded items (legacy back-fill)
      // - pre-Phase-14 items with summary but no description
      // - absorption-registered items (no source set, defaults to "discovery"
      //   at render time, summary/description left for backfill)
      // Items already fully populated are excluded.
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              'pristine': { routing: 'research', source: 'discovery', summary: 'Brand-new topic with summary', description: 'Already grounded' },
              'migrated-no-summary': { routing: 'research', source: 'migration-seeded' },
              'migrated-summary-no-description': { routing: 'discussion', source: 'migration-seeded', summary: 'Backfilled before Phase 14' },
              'migrated-fully-populated': { routing: 'discussion', source: 'migration-seeded', summary: 'Both populated', description: 'Backfilled after Phase 14' },
              'migrated-then-resurfaced': { routing: 'discussion', source: 'migration-seeded,research-analysis' },
              'analysis-only': { routing: 'discussion', source: 'research-analysis', summary: 'From analysis', description: 'analysis paragraphs' },
              'absorbed-no-fields': { routing: 'discussion' },
            },
          },
        },
      });
      const r = discover(dir);
      const map = r.epics[0].detail.discovery_map;
      const byName = Object.fromEntries(map.map(t => [t.name, t]));

      assert.strictEqual(byName['pristine'].source, 'discovery');
      assert.strictEqual(byName['pristine'].summary, 'Brand-new topic with summary');
      assert.strictEqual(byName['pristine'].summary_present, true);
      assert.strictEqual(byName['pristine'].description_present, true);

      assert.strictEqual(byName['migrated-no-summary'].source, 'migration-seeded');
      assert.strictEqual(byName['migrated-no-summary'].summary, null);
      assert.strictEqual(byName['migrated-no-summary'].summary_present, false);
      assert.strictEqual(byName['migrated-no-summary'].description_present, false);

      assert.strictEqual(byName['migrated-summary-no-description'].summary, 'Backfilled before Phase 14');
      assert.strictEqual(byName['migrated-summary-no-description'].summary_present, true);
      assert.strictEqual(byName['migrated-summary-no-description'].description_present, false);

      assert.strictEqual(byName['migrated-fully-populated'].summary, 'Both populated');
      assert.strictEqual(byName['migrated-fully-populated'].summary_present, true);
      assert.strictEqual(byName['migrated-fully-populated'].description_present, true);

      assert.strictEqual(byName['migrated-then-resurfaced'].source, 'migration-seeded,research-analysis');
      assert.strictEqual(byName['migrated-then-resurfaced'].summary, null);
      assert.strictEqual(byName['migrated-then-resurfaced'].summary_present, false);
      assert.strictEqual(byName['migrated-then-resurfaced'].description_present, false);

      assert.strictEqual(byName['analysis-only'].source, 'research-analysis');
      assert.strictEqual(byName['analysis-only'].summary_present, true);
      assert.strictEqual(byName['analysis-only'].description_present, true);

      assert.strictEqual(byName['absorbed-no-fields'].source, 'discovery');
      assert.strictEqual(byName['absorbed-no-fields'].summary, null);
      assert.strictEqual(byName['absorbed-no-fields'].summary_present, false);
      assert.strictEqual(byName['absorbed-no-fields'].description_present, false);

      // Filter contract — any item missing summary OR description, regardless of source.
      const toRecover = map.filter(t => !t.summary_present || !t.description_present);
      const recoverNames = toRecover.map(t => t.name).sort();
      assert.deepStrictEqual(
        recoverNames,
        ['absorbed-no-fields', 'migrated-no-summary', 'migrated-summary-no-description', 'migrated-then-resurfaced'],
      );
      // Items already fully populated are excluded
      assert.ok(!recoverNames.includes('migrated-fully-populated'));
      assert.ok(!recoverNames.includes('pristine'));
      assert.ok(!recoverNames.includes('analysis-only'));
    });
  });

  describe('external dependencies', () => {
    it('unresolved dependency blocks the plan', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              billing: {
                status: 'completed',
                external_dependencies: { auth: { description: 'User context', state: 'unresolved' } },
              },
            },
          },
        },
      });
      const plan = discover(dir).epics[0].detail.phases.planning[0];
      assert.strictEqual(plan.deps_satisfied, false);
      assert.deepStrictEqual(plan.deps_blocking, [{ topic: 'auth', reason: 'dependency unresolved' }]);
    });

    it('resolved dependency with task in same-manifest completed_tasks is satisfied', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              auth: { status: 'completed' },
              billing: {
                status: 'completed',
                external_dependencies: { auth: { description: 'User context', state: 'resolved', internal_id: 'auth-1-3' } },
              },
            },
          },
          implementation: {
            items: {
              auth: { status: 'in-progress', completed_tasks: ['auth-1-1', 'auth-1-2', 'auth-1-3'] },
            },
          },
        },
      });
      const plan = discover(dir).epics[0].detail.phases.planning.find(p => p.name === 'billing');
      assert.strictEqual(plan.deps_satisfied, true);
      assert.strictEqual(plan.deps_blocking, undefined);
    });

    it('resolved dependency blocks while the task is incomplete', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              billing: {
                status: 'completed',
                external_dependencies: { auth: { description: 'User context', state: 'resolved', internal_id: 'auth-1-3' } },
              },
            },
          },
          implementation: {
            items: {
              auth: { status: 'in-progress', completed_tasks: ['auth-1-1'] },
            },
          },
        },
      });
      const plan = discover(dir).epics[0].detail.phases.planning[0];
      assert.strictEqual(plan.deps_satisfied, false);
      assert.deepStrictEqual(plan.deps_blocking, [{ topic: 'auth', internal_id: 'auth-1-3', reason: 'task not yet completed' }]);
    });

    it('completed implementation satisfies the dependency even when the task id is absent', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              billing: {
                status: 'completed',
                external_dependencies: { auth: { description: 'User context', state: 'resolved', internal_id: 'auth-9-9' } },
              },
            },
          },
          implementation: {
            items: {
              auth: { status: 'completed', completed_tasks: ['auth-1-1'] },
            },
          },
        },
      });
      const plan = discover(dir).epics[0].detail.phases.planning[0];
      assert.strictEqual(plan.deps_satisfied, true);
    });

    it('resolved dependency blocks when the dep topic has no implementation entry', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              billing: {
                status: 'completed',
                external_dependencies: { auth: { description: 'User context', state: 'resolved', internal_id: 'auth-1-3' } },
              },
            },
          },
        },
      });
      const plan = discover(dir).epics[0].detail.phases.planning[0];
      assert.strictEqual(plan.deps_satisfied, false);
    });

    it('satisfied_externally dependency never blocks', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              billing: {
                status: 'completed',
                external_dependencies: { auth: { description: 'User context', state: 'satisfied_externally' } },
              },
            },
          },
        },
      });
      const plan = discover(dir).epics[0].detail.phases.planning[0];
      assert.strictEqual(plan.deps_satisfied, true);
    });

    it('resolved dependency without internal_id blocks as missing task reference', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              billing: {
                status: 'completed',
                external_dependencies: { auth: { description: 'User context', state: 'resolved' } },
              },
            },
          },
        },
      });
      const plan = discover(dir).epics[0].detail.phases.planning[0];
      assert.strictEqual(plan.deps_satisfied, false);
      assert.deepStrictEqual(plan.deps_blocking, [{ topic: 'auth', reason: 'resolved dependency missing task reference' }]);
    });

    it('next_phase_ready marks start_implementation blocked only while deps are unmet', () => {
      // Three-topic chain: cli-presentation implemented; mint-release-tool
      // depends on its task (met); commit-command depends on both (one unmet).
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          planning: {
            items: {
              'cli-presentation': { status: 'completed' },
              'mint-release-tool': {
                status: 'completed',
                external_dependencies: {
                  'cli-presentation': { description: 'Presentation layer', state: 'resolved', internal_id: 'cli-presentation-1-1' },
                },
              },
              'commit-command': {
                status: 'completed',
                external_dependencies: {
                  'cli-presentation': { description: 'Presentation layer', state: 'resolved', internal_id: 'cli-presentation-3-1' },
                  'mint-release-tool': { description: 'Shared engine', state: 'resolved', internal_id: 'mint-release-tool-2-1' },
                },
              },
            },
          },
          implementation: {
            items: {
              'cli-presentation': { status: 'completed', completed_tasks: ['cli-presentation-1-1', 'cli-presentation-3-1'] },
            },
          },
        },
      });
      const ready = discover(dir).epics[0].detail.next_phase_ready;
      const mint = ready.find(n => n.name === 'mint-release-tool');
      const commit = ready.find(n => n.name === 'commit-command');
      assert.strictEqual(mint.action, 'start_implementation');
      assert.strictEqual(mint.blocked, undefined);
      assert.strictEqual(commit.blocked, true);
      assert.deepStrictEqual(commit.deps_blocking, [
        { topic: 'mint-release-tool', internal_id: 'mint-release-tool-2-1', reason: 'task not yet completed' },
      ]);
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
    it('discovery_map empty and convergence absent when discovery phase has no items', () => {
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
        phases: { discovery: { items: { 'topic-a': { routing: 'research', source: 'discovery' } } } },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 0);
    });

    it('discovery items only render as fresh / ○ tier', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              'kitchen-hardware': { routing: 'research', source: 'discovery' },
              'tenant-onboarding': { routing: 'discussion', source: 'discovery' },
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
          discovery: {
            items: {
              'zeta-fresh': { routing: 'research', source: 'discovery' },
              'alpha-fresh': { routing: 'discussion', source: 'discovery' },
              'ready-topic': { routing: 'research', source: 'discovery' },
              'in-flight': { routing: 'research', source: 'discovery' },
              'decided-topic': { routing: 'discussion', source: 'discovery' },
              'cancelled-topic': { routing: 'research', source: 'discovery' },
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
          discovery: { items: { topic: { routing: 'research', source: 'discovery' } } },
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
          discovery: { items: { topic: { routing: 'discussion', source: 'discovery' } } },
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
          discovery: { items: { topic: { routing: 'research', source: 'discovery' } } },
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
          discovery: { items: { topic: { routing: 'research', source: 'discovery' } } },
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
          discovery: { items: { topic: { routing: 'discussion', source: 'discovery' } } },
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
          discovery: { items: { topic: { routing: 'discussion', source: 'discovery' } } },
          discussion: { items: { topic: { status: 'completed' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'decided');
      assert.strictEqual(t.tier, '✓');
      assert.strictEqual(t.next_action, null);
    });

    it('lifecycle: research cancelled, no discussion → cancelled (all attempted phases cancelled)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { routing: 'research', source: 'discovery' } } },
          research: { items: { topic: { status: 'cancelled' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.lifecycle, 'cancelled');
      assert.strictEqual(t.tier, '⊘');
    });

    it('lifecycle: research cancelled AND discussion cancelled → cancelled, ⊘', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { routing: 'research', source: 'discovery' } } },
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
          discovery: {
            items: {
              a: { routing: 'discussion', source: 'discovery' },
              b: { routing: 'discussion', source: 'discovery' },
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
          discovery: {
            items: {
              a: { routing: 'discussion', source: 'discovery' },
              b: { routing: 'research', source: 'discovery' },
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
          discovery: {
            items: {
              a: { routing: 'discussion', source: 'discovery' },
              b: { routing: 'research', source: 'discovery' },
            },
          },
          discussion: { items: { a: { status: 'completed' } } },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.convergence_state, 'in-progress');
    });

    it('handled row renders ⊙ with no next_action', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { umbrella: { routing: 'research', source: 'discovery', handled: true } } },
          research: { items: { umbrella: { status: 'completed' } } },
        },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.tier, '⊙');
      assert.strictEqual(t.lifecycle, 'handled');
      assert.strictEqual(t.next_action, null);
    });

    it('convergence: handled topic counts as terminal — settled when only handled + decided remain', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              umbrella: { routing: 'research', source: 'discovery', handled: true },
              decided: { routing: 'discussion', source: 'discovery' },
            },
          },
          research: { items: { umbrella: { status: 'completed' } } },
          discussion: { items: { decided: { status: 'completed' } } },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.convergence_state, 'settled');
      assert.strictEqual(d.map_summary.handled, 1);
    });

    it('handled topic is excluded from needs_sequencing like cancelled', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              umbrella: { routing: 'research', source: 'discovery', handled: true, order: null },
              live: { routing: 'discussion', source: 'discovery', order: 1 },
            },
          },
          research: { items: { umbrella: { status: 'completed' } } },
          discussion: { items: { live: { status: 'in-progress' } } },
        },
      });
      const d = discover(dir).epics[0].detail;
      // Only the handled topic lacks an order; it's excluded, so no sequencing needed.
      assert.strictEqual(d.needs_sequencing, false);
    });

    it('source provenance: discovery → null', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'research', source: 'discovery' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, null);
    });

    it('source provenance: research-split:{parent} → from {parent}', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'research', source: 'research-split:kitchen-hardware' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from kitchen-hardware');
    });

    it('source provenance: gap-analysis → from gap-analysis', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'discussion', source: 'gap-analysis' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from gap-analysis');
    });

    it('source provenance: direct-start → from direct-start', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'research', source: 'direct-start' } } } },
      });
      const t = discover(dir).epics[0].detail.discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from direct-start');
    });

    it('map_summary counts omit nothing — all categories present', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              ready: { routing: 'research', source: 'discovery' },
              flight: { routing: 'research', source: 'discovery' },
              done: { routing: 'discussion', source: 'discovery' },
              fresh1: { routing: 'discussion', source: 'discovery' },
              cancelled: { routing: 'research', source: 'discovery' },
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

    it('excludes discovery from phases output (lives in discovery_map only)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { routing: 'research', source: 'discovery' } } },
          discussion: { items: { topic: { status: 'in-progress' } } },
        },
      });
      const d = discover(dir).epics[0].detail;
      assert.strictEqual(d.phases.discovery, undefined);
      assert.ok(d.phases.discussion);
    });

    it('discovery items are not flagged as in-progress / cancelled / completed', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              alpha: { routing: 'research', source: 'discovery' },
              beta: { routing: 'discussion', source: 'discovery' },
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
          discovery: {
            items: {
              topic: {
                routing: 'discussion',
                source: 'discovery',
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

  describe('proposed groupings — menu intelligence', () => {
    it('surfaces a proposed spec as start_specification in next_phase_ready', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { 'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } } } },
        },
      });
      const r = discover(dir);
      const ready = r.epics[0].detail.next_phase_ready;
      const entry = ready.find(n => n.action === 'start_specification' && n.name === 'auth-grouping');
      assert.ok(entry, 'proposed spec surfaced as a start_specification entry');
    });

    it('orders start_specification before start_planning in next_phase_ready', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: {
            items: {
              'done-spec': { status: 'completed' },
              'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } },
            },
          },
        },
      });
      const r = discover(dir);
      const ready = r.epics[0].detail.next_phase_ready;
      const specIdx = ready.findIndex(n => n.action === 'start_specification');
      const planIdx = ready.findIndex(n => n.action === 'start_planning');
      assert.ok(specIdx >= 0 && planIdx >= 0, 'both entries present');
      // Settled-state recommendation reads the first entry in pipeline order;
      // a proposed spec must outrank a completed spec's start_planning.
      assert.ok(specIdx < planIdx, 'start_specification precedes start_planning');
    });

    it('treats a proposed-grouped discussion as accounted — unaccounted = ungrouped only', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' }, payments: { status: 'completed' } } },
          specification: {
            items: {
              'payments-grouping': { status: 'proposed', sources: { payments: { status: 'pending' } } },
            },
          },
        },
      });
      const r = discover(dir);
      // payments is grouped into a proposed spec → accounted. auth is in no
      // spec item at all → ungrouped, the new meaning of unaccounted.
      assert.deepStrictEqual(r.epics[0].detail.unaccounted_discussions, ['auth']);
    });

    it('does not mark an in-progress discussion sourced only by a proposed item as reopened', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'in-progress' } } },
          specification: { items: { 'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } } } },
        },
      });
      const r = discover(dir);
      // Reopened stays materialized-only — a proposed grouping has nothing
      // extracted to revisit.
      assert.deepStrictEqual(r.epics[0].detail.reopened_discussions, []);
    });

    it('keeps can_start_planning false when the only spec is proposed', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { 'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.epics[0].detail.gating.can_start_planning, false);
    });

    it('includes a proposed spec item in phases.specification for display', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { 'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } } } },
        },
      });
      const r = discover(dir);
      const specPhase = r.epics[0].detail.phases.specification;
      assert.ok(specPhase, 'specification phase present');
      const item = specPhase.find(i => i.name === 'auth-grouping');
      assert.strictEqual(item.status, 'proposed');
      assert.ok(item.sources, 'proposed item carries sources for display');
    });
  });
});

describe('workflow-continue-epic format (index dump)', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('empty project pins the full dump byte-exactly', () => {
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== EPICS (0) ===',
      '=== COMPLETED (0) ===',
      '=== CANCELLED (0) ===',
      '',
    ].join('\n'));
  });

  it('active, completed, and cancelled epics pin the full dump byte-exactly', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { items: { exploration: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'v2', { work_type: 'epic' });
    createManifest(dir, 'shipped', { work_type: 'epic', status: 'completed', phases: { review: { items: { a: { status: 'completed' } } } } });
    createManifest(dir, 'abandoned', { work_type: 'epic', status: 'cancelled', phases: { research: { items: { a: { status: 'completed' } } } } });
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== EPICS (2) ===',
      '  v1: research, discussion',
      '  v2: (no phases)',
      '=== COMPLETED (1) ===',
      '  shipped (last phase: review)',
      '=== CANCELLED (1) ===',
      '  abandoned (last phase: research)',
      '=== DISPLAY: selection (emit verbatim as a code block only at the select step) ===',
      '2 epic(s) in progress:',
      '',
      '  1. V1',
      '     └─ Research, Discussion',
      '',
      '  2. V2',
      '     └─ (no phases)',
      '',
      '1 completed, 1 cancelled.',
      '',
      "=== MENU: selection (emit verbatim as markdown only at the select step, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Which epic would you like to continue?',
      '',
      '- **`1`** — Continue "V1"',
      '- **`2`** — Continue "V2"',
      '',
      '- **`3`** — View completed & cancelled epics',
      "- **`m`/`manage`** — Manage an epic's lifecycle",
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
      '',
    ].join('\n'));
  });

  it('carries no per-epic detail — the scoped dump and view verb own it', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      imports: [{ path: 'imports/seed.md', imported_at: '2026-05-10T10:00:00Z' }],
      seeds: [{ path: 'seeds/2026-04-02-x.md', source: 'inbox:idea', seeded_at: '2026-05-10T10:00:00Z' }],
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: {
          items: {
            'auth-spec': { status: 'in-progress', sources: [{ topic: 'auth', status: 'incorporated' }] },
          },
        },
      },
    });
    const out = format(discover(dir));
    assert.ok(!out.includes('sources'));
    assert.ok(!out.includes('in-progress:'));
    assert.ok(!out.includes('next-phase-ready'));
    assert.ok(!out.includes('unaccounted'));
    assert.ok(!out.includes('analysis_caches'));
    assert.ok(!out.includes('imports_count'));
    assert.ok(!out.includes('seeds_count'));
    assert.ok(!out.includes('discovery_map'));
    assert.ok(!out.includes('summary:'));
  });
});

describe('workflow-continue-epic formatScoped (state dump)', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('reports an unknown epic loudly', () => {
    const out = formatScoped('ghost', discover(dir, 'ghost'));
    assert.strictEqual(out, '=== EPIC: ghost ===\nerror: no active epic with this name\n');
  });

  it('mid-flight epic pins the full dump byte-exactly', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'auth-flow': { status: 'in-progress', routing: 'research', source: 'discovery', summary: 'OAuth vs sessions', description: 'Longer context.', order: 1 },
            'billing': { status: 'in-progress', routing: 'discussion', source: 'gap-analysis' },
          },
        },
        research: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.strictEqual(out, [
      '=== EPIC: v1 ===',
      'all_done: false',
      'analysis_caches: research_analysis=absent, gap_analysis=absent',
      'needs_sequencing: true',
      'discovery_map (2):',
      '  - ◐ auth-flow [researching] routing=research summary=present description=present — OAuth vs sessions',
      '  - ○ billing [fresh] routing=discussion summary=absent description=absent',
      '',
    ].join('\n'));
  });

  it('epic with no discovery items pins the empty-map shape byte-exactly', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.strictEqual(out, [
      '=== EPIC: v1 ===',
      'all_done: false',
      'analysis_caches: research_analysis=absent, gap_analysis=absent',
      'needs_sequencing: false',
      'discovery_map (0):',
      '  (empty)',
      '',
    ].join('\n'));
  });

  it('rows omit the summary tail when the field is absent', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { a: { status: 'in-progress', routing: 'research', source: 'discovery' } } } },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.ok(out.includes('  - ○ a [fresh] routing=research summary=absent description=absent\n'));
    assert.ok(!out.includes(' — '));
  });

  it('rows show routing=none for a legacy item with no routing', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { a: { status: 'in-progress', source: 'discovery' } } } },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.ok(out.includes('routing=none'));
  });

  describe('all_done', () => {
    it('true when every non-cancelled review item is completed and nothing else is open', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: {
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: {
            items: {
              'auth-spec': { status: 'completed' },
              'old-topic': { status: 'cancelled', previous_status: 'in-progress' },
            },
          },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: true'));
    });

    it('false when every review item is cancelled — vacuous completion never counts', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: {
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: {
            items: {
              'auth-spec': { status: 'cancelled', previous_status: 'in-progress' },
              'old-topic': { status: 'cancelled', previous_status: 'in-progress' },
            },
          },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: false'));
    });

    it('false while a review item is in progress', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: {
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: { items: { 'auth-spec': { status: 'in-progress' } } },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: false'));
    });

    it('false when no review items exist', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: false'));
    });

    it('false while a completed discussion is unaccounted', () => {
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
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: { items: { 'auth-spec': { status: 'completed' } } },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: false'));
    });

    it('false while the discovery map has not settled', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              auth: { status: 'in-progress', routing: 'discussion', source: 'discovery', summary: 's', description: 'd', order: 1 },
              'open-thread': { status: 'in-progress', routing: 'research', source: 'discovery', summary: 's', description: 'd', order: 2 },
            },
          },
          discussion: { items: { auth: { status: 'completed' } } },
          specification: {
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: { items: { 'auth-spec': { status: 'completed' } } },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: false'));
    });

    it('a settled map does not hold all_done open', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { auth: { status: 'in-progress', routing: 'discussion', source: 'discovery', summary: 's', description: 'd', order: 1 } } },
          discussion: { items: { auth: { status: 'completed' } } },
          specification: {
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: { items: { 'auth-spec': { status: 'completed' } } },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: true'));
    });
  });
});

describe('workflow-continue-epic detail counts (imports/seeds)', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('imports_count reports the length of manifest.imports[]', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      imports: [
        { path: 'imports/seed-conversation.md', imported_at: '2026-05-10T10:00:00Z' },
        { path: 'imports/early-thoughts.md', imported_at: '2026-05-10T10:01:00Z' },
      ],
    });
    const d = discover(dir).epics[0].detail;
    assert.strictEqual(d.imports_count, 2);
  });

  it('imports_count is zero when the field is missing', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const d = discover(dir).epics[0].detail;
    assert.strictEqual(d.imports_count, 0);
  });

  it('seeds_count reports the length of manifest.seeds[]', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      seeds: [
        { path: 'seeds/2026-04-02-billing-overhaul.md', source: 'inbox:idea', seeded_at: '2026-05-10T10:00:00Z' },
      ],
    });
    const d = discover(dir).epics[0].detail;
    assert.strictEqual(d.seeds_count, 1);
  });

  it('seeds_count is zero when the field is missing', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const d = discover(dir).epics[0].detail;
    assert.strictEqual(d.seeds_count, 0);
  });
});

describe('workflow-continue-epic CLI dispatch', () => {
  const path = require('path');
  const { spawnSync } = require('child_process');
  const GATEWAY = path.join(__dirname, '../../skills/workflow-continue-epic/scripts/gateway.cjs');
  const USAGE = 'Usage: gateway.cjs | gateway.cjs {work_unit} | gateway.cjs view {work_unit} [new_arrivals_json] | gateway.cjs (completed-menu|cancel-menu|reactivate-menu) {work_unit}\n';

  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function epicFixture() {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
  }

  /** @param {string[]} args */
  function run(args) {
    return spawnSync('node', [GATEWAY, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('bare call still renders the index byte-identically', () => {
    epicFixture();
    const res = run([]);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout, format(discover(dir)));
  });

  it('bare positional still renders the scoped dump byte-identically', () => {
    epicFixture();
    const res = run(['v1']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout, formatScoped('v1', discover(dir, 'v1')));
  });

  it('bare positional for an unknown epic keeps the in-band error dump', () => {
    const res = run(['ghost']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stdout, '=== EPIC: ghost ===\nerror: no active epic with this name\n');
  });

  it('view {work_unit} still answers the sectioned snapshot, with and without new arrivals', () => {
    epicFixture();
    for (const args of [['view', 'v1'], ['view', 'v1', '{"research_analysis":[],"gap_analysis":[]}']]) {
      const res = run(args);
      assert.strictEqual(res.status, 0, res.stderr);
      assert.ok(res.stdout.includes('=== DATA'));
      assert.ok(res.stdout.includes('=== DISPLAY'));
      assert.ok(res.stdout.includes('=== MENU'));
    }
  });

  it('view without a work unit errors instead of rendering the first epic', () => {
    epicFixture();
    const res = run(['view']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: view takes a work unit and an optional new-arrivals JSON\n' + USAGE);
  });

  it('view with excess positionals errors with usage', () => {
    epicFixture();
    const res = run(['view', 'v1', '{}', 'extra']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: view takes a work unit and an optional new-arrivals JSON\n' + USAGE);
  });

  it('each sub-view verb errors without its work unit instead of rendering the first epic', () => {
    epicFixture();
    for (const verb of ['completed-menu', 'cancel-menu', 'reactivate-menu']) {
      const res = run([verb]);
      assert.strictEqual(res.status, 1, verb);
      assert.strictEqual(res.stdout, '', verb);
      assert.strictEqual(res.stderr, `gateway: ${verb} takes exactly one work unit\n` + USAGE, verb);
    }
  });

  it('each sub-view verb errors on excess positionals', () => {
    epicFixture();
    for (const verb of ['completed-menu', 'cancel-menu', 'reactivate-menu']) {
      const res = run([verb, 'v1', 'extra']);
      assert.strictEqual(res.status, 1, verb);
      assert.strictEqual(res.stdout, '', verb);
      assert.strictEqual(res.stderr, `gateway: ${verb} takes exactly one work unit\n` + USAGE, verb);
    }
  });

  it('an unknown verb with arguments errors instead of falling to the scoped dump', () => {
    epicFixture();
    const res = run(['veiw', 'v1']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "veiw"\n' + USAGE);
  });

  it('index with excess positionals errors with usage', () => {
    const res = run(['index', 'extra']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: index takes no arguments\n' + USAGE);
  });
});
