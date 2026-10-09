'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, formatScoped } = require('../../skills/workflow-continue-epic/scripts/gateway.cjs');
const { specificationDiscovery } = require('../../skills/workflow-engine/scripts/domain/specification.cjs');

const GATEWAY = path.join(__dirname, '../../skills/workflow-continue-epic/scripts/gateway.cjs');

describe('workflow-continue-epic discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns null when no epics exist', () => {
    assert.strictEqual(discover(dir, 'v1'), null);
  });

  it('discovers an active epic only — a completed or cancelled epic is never discovered', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    createManifest(dir, 'old', { work_type: 'epic', status: 'completed', phases: { review: { items: { auth: { status: 'completed' } } } } });
    createManifest(dir, 'stopped', { work_type: 'epic', status: 'cancelled' });
    assert.notStrictEqual(discover(dir, 'v1'), null);
    assert.strictEqual(discover(dir, 'old'), null);
    assert.strictEqual(discover(dir, 'stopped'), null);
  });

  it('excludes non-epic work types', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'auth', { work_type: 'feature' });
    assert.notStrictEqual(discover(dir, 'v1'), null);
    assert.strictEqual(discover(dir, 'auth'), null);
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.unaccounted_discussions, ['payments']);
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.reopened_discussions, ['auth']);
    });

    it('computes next-phase-ready: spec completed no plan', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'completed' } } },
        },
      });
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
      assert.strictEqual(d.next_phase_ready[0].action, 'start_implementation');
    });

    it('computes next-phase-ready: impl completed no review', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          implementation: { items: { auth: { status: 'completed' } } },
        },
      });
      const d = discover(dir, 'v1');
      assert.strictEqual(d.next_phase_ready[0].action, 'start_review');
    });

    it('does not show next-phase-ready when next phase already exists', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'completed' } } },
          planning: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const d = discover(dir, 'v1');
      assert.strictEqual(d.next_phase_ready.length, 0);
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
      const g = discover(dir, 'v1').gating;
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
      const g = discover(dir, 'v1').gating;
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
      const spec = discover(dir, 'v1').phases.specification[0];
      assert.strictEqual(spec.sources.length, 2);
      assert.strictEqual(spec.sources[0].topic, 'providers');
    });

    it('handles empty epic (no phases)', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.phases, {});
      assert.strictEqual(d.in_progress.length, 0);
      assert.strictEqual(d.completed.length, 0);
    });

    it('exposes analysis_caches shape on epic detail', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      const d = discover(dir, 'v1');
      assert.ok(d.analysis_caches);
      assert.ok(d.analysis_caches.gap_analysis);
      assert.strictEqual(d.analysis_caches.gap_analysis.status, 'absent');
    });

    it('discovery_map exposes source, summary text, and presence booleans per item for legacy-recovery filter', () => {
      // workflow-continue-epic Step 2 (Backfill) filters discovery_map by
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
      const map = discover(dir, 'v1').discovery_map;
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
      const plan = discover(dir, 'v1').phases.planning[0];
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
      const plan = discover(dir, 'v1').phases.planning.find(p => p.name === 'billing');
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
      const plan = discover(dir, 'v1').phases.planning[0];
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
      const plan = discover(dir, 'v1').phases.planning[0];
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
      const plan = discover(dir, 'v1').phases.planning[0];
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
      const plan = discover(dir, 'v1').phases.planning[0];
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
      const plan = discover(dir, 'v1').phases.planning[0];
      assert.strictEqual(plan.deps_satisfied, false);
      assert.deepStrictEqual(plan.deps_blocking, [{ topic: 'auth', reason: 'resolved dependency missing task reference' }]);
    });

    it('start_planning is blocked while the specification is unsettled, and gating follows it', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: {
            items: {
              auth: { status: 'completed', sources: { talks: { status: 'stale' } } },
              billing: { status: 'completed', sources: { money: { status: 'incorporated' } } },
            },
          },
        },
      });
      const d = discover(dir, 'v1');
      const auth = d.next_phase_ready.find(n => n.name === 'auth');
      const billing = d.next_phase_ready.find(n => n.name === 'billing');
      assert.strictEqual(auth.blocked, true);
      assert.strictEqual(billing.blocked, undefined);
      assert.strictEqual(d.gating.can_start_planning, true, 'one settled specification opens the gate');
    });

    it('an in-progress plan under an unsettled specification is blocked, and gating shuts with no settled spec', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'completed', reconcile_needed: 'discussion' } } },
          planning: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.phases.planning[0].blocked_by, ['specification']);
      assert.strictEqual(d.gating.can_start_planning, false);
    });

    it('a settled specification leaves the plan free of any hold', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { auth: { status: 'completed' } } },
          planning: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const d = discover(dir, 'v1');
      assert.strictEqual(d.phases.planning[0].blocked_by, undefined);
      assert.strictEqual(d.gating.can_start_planning, true);
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
      const ready = discover(dir, 'v1').next_phase_ready;
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.unaccounted_discussions, []);
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.unaccounted_discussions, ['auth']);
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.unaccounted_discussions, ['auth']);
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
      assert.strictEqual(d.unaccounted_discussions.length, 2);
    });

    it('gating flags all false for empty epic', () => {
      createManifest(dir, 'v1', { work_type: 'epic' });
      const g = discover(dir, 'v1').gating;
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
      const spec = discover(dir, 'v1').phases.specification[0];
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.unaccounted_discussions.sort(), ['billing', 'payments']);
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.reopened_discussions, ['auth']);
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
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.reopened_discussions, ['auth']);
      assert.deepStrictEqual(d.unaccounted_discussions, []);
    });
  });

  describe('discovery map', () => {
    it('discovery_map empty and convergence absent when discovery phase has no items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const d = discover(dir, 'v1');
      assert.deepStrictEqual(d.discovery_map, []);
      assert.strictEqual(d.convergence_state, null);
      assert.strictEqual(d.map_summary, null);
    });

    it('discovery_map empty for non-epic work types', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discovery: { items: { 'topic-a': { routing: 'research', source: 'discovery' } } } },
      });
      assert.strictEqual(discover(dir, 'auth'), null);
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
      const d = discover(dir, 'v1');
      assert.strictEqual(d.discovery_map.length, 2);
      assert.ok(d.discovery_map.every(t => t.tier === '○'));
      assert.ok(d.discovery_map.every(t => t.lifecycle === 'fresh'));
      assert.strictEqual(d.map_summary.total, 2);
      assert.strictEqual(d.map_summary.fresh, 2);
      assert.strictEqual(d.convergence_state, 'in-progress');
    });

    it('tier ordering: ✓ → ◐ ○ ⊘ with alphabetical within tier', () => {
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
      const tiers = discover(dir, 'v1').discovery_map.map(t => `${t.tier} ${t.name}`);
      assert.deepStrictEqual(tiers, [
        '✓ decided-topic',
        '→ ready-topic',
        '◐ in-flight',
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
      const t = discover(dir, 'v1').discovery_map[0];
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
      const t = discover(dir, 'v1').discovery_map[0];
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
      const t = discover(dir, 'v1').discovery_map[0];
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
      const t = discover(dir, 'v1').discovery_map[0];
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
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.lifecycle, 'discussing');
      assert.strictEqual(t.tier, '◐');
      assert.strictEqual(t.next_action, 'continue_discussion');
      assert.strictEqual(t.current_phase, 'discussion');
    });

    it('lifecycle: discussion in-progress over outstanding research → discussing, ◐, the research action', () => {
      for (const [status, action] of [['in-progress', 'continue_research'], ['unstarted', 'start_research']]) {
        createManifest(dir, 'v1', {
          work_type: 'epic',
          phases: {
            discovery: { items: { topic: { routing: 'discussion', source: 'discovery' } } },
            research: { items: { topic: { status } } },
            discussion: { items: { topic: { status: 'in-progress' } } },
          },
        });
        const t = discover(dir, 'v1').discovery_map[0];
        assert.strictEqual(t.lifecycle, 'discussing');
        assert.strictEqual(t.next_action, action, status);
        assert.deepStrictEqual(t.waits, [{ kind: 'research', status }]);
      }
    });

    it('lifecycle: discussion completed → decided, ✓, no next_action', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { routing: 'discussion', source: 'discovery' } } },
          discussion: { items: { topic: { status: 'completed' } } },
        },
      });
      const t = discover(dir, 'v1').discovery_map[0];
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
      const t = discover(dir, 'v1').discovery_map[0];
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
      const t = discover(dir, 'v1').discovery_map[0];
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
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
      const t = discover(dir, 'v1').discovery_map[0];
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
      // Only the handled topic lacks an order; it's excluded, so no sequencing needed.
      assert.strictEqual(d.needs_sequencing, false);
    });

    it('source provenance: discovery → null', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'research', source: 'discovery' } } } },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.source_provenance, null);
    });

    it('source provenance: research-split:{parent} → from {parent}', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'research', source: 'research-split:kitchen-hardware' } } } },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from kitchen-hardware');
    });

    it('source provenance: gap-analysis → from gap-analysis', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'discussion', source: 'gap-analysis' } } } },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from gap-analysis');
    });

    it('source provenance: direct-start → from direct-start', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { routing: 'research', source: 'direct-start' } } } },
      });
      const t = discover(dir, 'v1').discovery_map[0];
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
      const s = discover(dir, 'v1').map_summary;
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
      const d = discover(dir, 'v1');
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
      const d = discover(dir, 'v1');
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
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.summary, 'A one-line description');
      assert.strictEqual(t.routing, 'discussion');
    });
  });

  describe('work_unit filtering', () => {
    it('returns the detail of the named epic, never another', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      createManifest(dir, 'v2', {
        work_type: 'epic',
        phases: { discussion: { items: { billing: { status: 'in-progress' } } } },
      });
      assert.deepStrictEqual(discover(dir, 'v1').phases.discussion.map((i) => i.name), ['auth']);
      assert.deepStrictEqual(discover(dir, 'v2').phases.discussion.map((i) => i.name), ['billing']);
    });

    it('returns null when work_unit does not match any epic', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      assert.strictEqual(discover(dir, 'nonexistent'), null);
    });

    it('produces full detail for the named epic', () => {
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
      const d = discover(dir, 'v1');
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
      const ready = discover(dir, 'v1').next_phase_ready;
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
      const ready = discover(dir, 'v1').next_phase_ready;
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
      const d = discover(dir, 'v1');
      // payments is grouped into a proposed spec → accounted. auth is in no
      // spec item at all → ungrouped, the new meaning of unaccounted.
      assert.deepStrictEqual(d.unaccounted_discussions, ['auth']);
    });

    it('a cancelled or superseded specification groups nothing — its sources read unaccounted again', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' }, payments: { status: 'completed' }, roles: { status: 'completed' } } },
          specification: {
            items: {
              auth: { status: 'cancelled', previous_status: 'completed', sources: { auth: { status: 'incorporated' } } },
              old: { status: 'superseded', superseded_by: 'unified', sources: { payments: { status: 'incorporated' } } },
              unified: { status: 'completed', sources: { payments: { status: 'incorporated' } } },
              gone: { status: 'promoted', promoted_to: 'cc', sources: { roles: { status: 'incorporated' } } },
            },
          },
        },
      });
      const d = discover(dir, 'v1');
      // auth's only spec is cancelled → free to regroup; payments rides the
      // superseding spec; roles went with its promoted spec.
      assert.deepStrictEqual(d.unaccounted_discussions, ['auth']);
    });

    it('does not mark an in-progress discussion sourced only by a proposed item as reopened', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'in-progress' } } },
          specification: { items: { 'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } } } },
        },
      });
      const d = discover(dir, 'v1');
      // Reopened stays materialized-only — a proposed grouping has nothing
      // extracted to revisit.
      assert.deepStrictEqual(d.reopened_discussions, []);
    });

    it('keeps can_start_planning false when the only spec is proposed', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { 'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } } } },
        },
      });
      const d = discover(dir, 'v1');
      assert.strictEqual(d.gating.can_start_planning, false);
    });

    it('includes a proposed spec item in phases.specification for display', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { 'auth-grouping': { status: 'proposed', sources: { auth: { status: 'pending' } } } } },
        },
      });
      const specPhase = discover(dir, 'v1').phases.specification;
      assert.ok(specPhase, 'specification phase present');
      const item = specPhase.find(i => i.name === 'auth-grouping');
      assert.strictEqual(item.status, 'proposed');
      assert.ok(item.sources, 'proposed item carries sources for display');
    });
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
      'reconcile_pending: (none)',
      'analysis_caches: gap_analysis=absent',
      'needs_sequencing: true',
      'build_order_needs_sequencing: false',
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
      'reconcile_pending: (none)',
      'analysis_caches: gap_analysis=absent',
      'needs_sequencing: false',
      'build_order_needs_sequencing: false',
      'discovery_map (0):',
      '  (empty)',
      '',
    ].join('\n'));
  });

  it('build_order_needs_sequencing reads the spec items and the stale flag', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: { items: { auth: { status: 'in-progress', order: 1 }, billing: { status: 'proposed' } } },
      },
    });
    let out = formatScoped('v1', discover(dir, 'v1'));
    assert.match(out, /build_order_needs_sequencing: true/, 'unordered live topic flips the flag');

    createManifest(dir, 'v2', {
      work_type: 'epic',
      phases: {
        specification: {
          build_order_stale: true,
          items: { auth: { status: 'completed', order: 1 } },
        },
      },
    });
    out = formatScoped('v2', discover(dir, 'v2'));
    assert.match(out, /build_order_needs_sequencing: true/, 'the stale flag alone flips it');

    createManifest(dir, 'v3', {
      work_type: 'epic',
      phases: {
        specification: { items: { auth: { status: 'completed', order: 1 }, gone: { status: 'cancelled' } } },
      },
    });
    out = formatScoped('v3', discover(dir, 'v3'));
    assert.match(out, /build_order_needs_sequencing: false/, 'ordered live set with terminal residue is quiet');
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

  it('a parked stub carries the mail=waiting cue — parity with the discovery gateway dump', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { parked: { routing: 'discussion', source: 'message:origin' } } },
        discussion: { items: { parked: { status: 'unstarted' } } },
      },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.ok(out.includes('  - ○ parked [fresh] routing=discussion summary=absent description=absent mail=waiting\n'), out);
  });

  it('a waiting discussion carries the awaiting= cue, every kind in the derivation\'s order', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { billing: { routing: 'discussion', source: 'discovery' } } },
        research: { items: { billing: { status: 'in-progress' } } },
        discussion: { items: { billing: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.ok(out.includes('  - ◐ billing [discussing] routing=discussion summary=absent description=absent awaiting=research,E1\n'), out);
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

    it('false while any item carries a live reconcile flag — the terminal gate is never offered past known-stale input', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: {
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: { items: { 'auth-spec': { status: 'completed', reconcile_needed: 'implementation' } } },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('all_done: false'), out);
      assert.ok(out.includes('reconcile_pending: review/auth-spec (implementation)'), out);
    });

    it('false while a message is parked — a stub is undrained work, whatever the review says', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          research: { items: { auth: { status: 'unstarted' } } },
          specification: {
            items: { 'auth-spec': { status: 'completed', sources: [{ topic: 'auth', status: 'incorporated' }] } },
          },
          planning: { items: { 'auth-spec': { status: 'completed' } } },
          implementation: { items: { 'auth-spec': { status: 'completed' } } },
          review: { items: { 'auth-spec': { status: 'completed' } } },
        },
      });
      assert.ok(formatScoped('v1', discover(dir, 'v1')).includes('all_done: false'));
    });

    it('reconcile_pending lists a live discussion the research hop flagged, not only completed items', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { auth: { routing: 'discussion', source: 'discovery' } } },
          research: { items: { auth: { status: 'unstarted' } } },
          discussion: { items: { auth: { status: 'in-progress', reconcile_needed: 'research' } } },
        },
      });
      const out = formatScoped('v1', discover(dir, 'v1'));
      assert.ok(out.includes('reconcile_pending: discussion/auth (research)'), out);
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

    it('false while a live experiment series is open — the gate never offers completion over unfinished evidence', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          experiment: {
            items: { auth: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'running' } } } },
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
      assert.ok(out.includes('all_done: false'), out);
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
    const d = discover(dir, 'v1');
    assert.strictEqual(d.imports_count, 2);
  });

  it('imports_count is zero when the field is missing', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const d = discover(dir, 'v1');
    assert.strictEqual(d.imports_count, 0);
  });

  it('seeds_count reports the length of manifest.seeds[]', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      seeds: [
        { path: 'seeds/2026-04-02-billing-overhaul.md', source: 'inbox:idea', seeded_at: '2026-05-10T10:00:00Z' },
      ],
    });
    const d = discover(dir, 'v1');
    assert.strictEqual(d.seeds_count, 1);
  });

  it('seeds_count is zero when the field is missing', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const d = discover(dir, 'v1');
    assert.strictEqual(d.seeds_count, 0);
  });
});

describe('workflow-continue-epic CLI dispatch', () => {
  const USAGE = 'Usage: gateway.cjs {work_unit} | gateway.cjs view {work_unit} [new_arrivals_json] | gateway.cjs (completed-menu|cancel-menu|reactivate-menu|postpone-menu|pull-forward-menu|unblock-menu|spec-scenario|spec-view|spec-completed-menu) {work_unit} | gateway.cjs in-session-gate {work_unit} {key}\n';

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

  it('unblock-menu emits the dep column in DATA byte-exactly', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        planning: { items: { tmpl: { status: 'completed', external_dependencies: { auth: { description: 'd', state: 'resolved', internal_id: 'auth-1-4' } } } } },
      },
    });
    const out = run(['unblock-menu', 'v1']).stdout;
    assert.ok(out.includes('  1  —  unblock  tmpl  planning  → (internal)  (dep: auth)'), out.split('===')[1] || out);
  });

  it('pull-forward-menu emits the roadmap item on the key, in DATA, byte-exactly', () => {
    const fs = require('fs');
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next'], items: {
        'export-suite': { horizon: 'next', summary: 's', origin: 'harvest', postponed_from: { work_unit: 'v1', topic: 'away' } },
      } },
    }, null, 2));
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { away: { routing: 'discussion', source: 'roadmap', postponed: true } } },
        discussion: { items: { away: { status: 'postponed', previous_status: 'completed' } } },
      },
    });
    const out = run(['pull-forward-menu', 'v1']).stdout;
    assert.ok(out.includes('  1  —  pull-forward  away  discovery  → (internal)  (item: export-suite)'), out.split('===')[1] || out);
  });

  it('the view snapshot carries the build-order flag line', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const out = run(['view', 'v1']).stdout;
    assert.ok(out.includes('build_order_needs_sequencing: true'), out.split('===')[1] || out);
  });

  it('the bare call errors with usage — the epic is always named', () => {
    epicFixture();
    for (const args of [[], ['index'], ['index', 'extra']]) {
      const res = run(args);
      assert.strictEqual(res.status, 1, args.join(' '));
      assert.strictEqual(res.stdout, '', args.join(' '));
      assert.strictEqual(res.stderr, 'gateway: a work unit is required\n' + USAGE, args.join(' '));
    }
  });

  it('view for an unknown name answers the not-found terminal display, no gate', () => {
    const res = run(['view', 'ghost']);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /error: no active epic with this name/);
    assert.match(res.stdout, /=== DISPLAY: not found [^\n]*\nNo active epic named "ghost" found\./);
    assert.doesNotMatch(res.stdout, /^=== MENU/m);
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
    for (const args of [['view', 'v1'], ['view', 'v1', '{"gap_analysis":[]}']]) {
      const res = run(args);
      assert.strictEqual(res.status, 0, res.stderr);
      assert.ok(res.stdout.includes('=== DATA'));
      assert.ok(res.stdout.includes('=== DISPLAY'));
      assert.ok(res.stdout.includes('=== MENU'));
      assert.ok(res.stdout.includes('sessions_in_progress: (none)'));
    }
  });

  it('view joins a held session across DATA, the menu strike-through, and the ACTIONS marker', () => {
    const fs = require('fs');
    epicFixture();
    const p = path.join(dir, '.workflows/.cache/v1/discussion/auth/presence');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    // pid alive (this test process), no start time — the aliveness fallback.
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'sess-view' }) + '\n');
    const past = new Date(Date.now() - 120 * 1000);
    fs.utimesSync(p, past, past);

    const res = run(['view', 'v1']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes('sessions_in_progress: discussion/auth (last active 2m ago)'), res.stdout);
    assert.ok(res.stdout.includes('(in session: last active 2m ago)'), res.stdout);
    assert.ok(/\*\*`1`\*\* +→ ~~Continue "Auth" — \*discussion \[in-progress\]\*~~ · in\n\u00a0+session \(last active 2m ago\)/.test(res.stdout), res.stdout);
    assert.ok(!res.stdout.includes('MENU: in-session gate'), 'the snapshot carries no gate sections');
    const gate = run(['in-session-gate', 'v1', '1']);
    assert.strictEqual(gate.status, 0, gate.stderr);
    assert.ok(gate.stdout.includes(
      "=== MENU: in-session gate — 1 (emit verbatim as markdown (not a code block), then STOP for the user's response) ==="
    ), gate.stdout);
    const gateText = gate.stdout.replace(/\n\u00a0+/g, ' ');
    assert.ok(gateText.includes('"Auth" is open in another session — last active 2m ago. Proceeding starts a second concurrent session on the same discussion; its work could conflict with that session\'s. Only proceed if you know that session is no longer working; if it is wedged but alive, release its hold with `node .claude/skills/workflow-engine/scripts/engine.cjs presence clear v1 discussion auth`.'), gateText);
    assert.ok(gateText.indexOf('`b/back`') < gateText.indexOf('`y/yes`'), 'back leads the family\'s options');
    const unheld = run(['in-session-gate', 'v1', 'r']);
    assert.ok(unheld.stdout.includes('is not held by another session'), unheld.stdout);

    // A dead owner reads free: same record, unheld pid identity.
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: 'Thu Jan  1 00:00:00 1970', session_id: 'sess-view' }) + '\n');
    const freed = run(['view', 'v1']);
    assert.ok(freed.stdout.includes('sessions_in_progress: (none)'), freed.stdout);
    assert.ok(!freed.stdout.includes('in session'), freed.stdout);
  });

  it('a discussion held for its research keeps its struck row beneath the research row while a session sits in it, and its gate names the research', () => {
    const fs = require('fs');
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { auth: { routing: 'discussion', source: 'discovery', order: 1 } } },
        research: { items: { auth: { status: 'in-progress' } } },
        discussion: { items: { auth: { status: 'in-progress', reconcile_needed: 'research' } } },
      },
    });
    const p = path.join(dir, '.workflows/.cache/v1/discussion/auth/presence');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');
    const past = new Date(Date.now() - 240 * 1000);
    fs.utimesSync(p, past, past);

    const res = run(['view', 'v1']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes('  1  —  continue_research  auth  → /workflow-research-process epic v1 auth  (recommended)'), res.stdout);
    assert.ok(res.stdout.includes('  2  —  continue_discussion  auth  → /workflow-discussion-process epic v1 auth  (in session: last active 4m ago)'), res.stdout);
    assert.match(res.stdout.replace(/\n +/g, ' '), /~~Continue "Auth" — \*discussion\*~~ · in session \(last active 4m ago\)/, res.stdout);
    const gate = run(['in-session-gate', 'v1', '2']);
    assert.strictEqual(gate.status, 0, gate.stderr);
    assert.ok(gate.stdout.replace(/\n +/g, ' ').includes(
      'Its entry is also held shut — research on "Auth" is outstanding — so proceeding meets that gate next.'), gate.stdout);

    // The same heartbeat with a dead owner: the row goes, and the topic is
    // its research row alone again.
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: 'Thu Jan  1 00:00:00 1970', session_id: 'peer' }) + '\n');
    const freed = run(['view', 'v1']);
    assert.ok(!freed.stdout.includes('continue_discussion'), freed.stdout);
    assert.ok(freed.stdout.includes('  1  —  continue_research  auth'), freed.stdout);
  });

  it('a code session anywhere in the project marks this epic\'s code entries', () => {
    const fs = require('fs');
    epicFixture();
    // A ready-to-implement plan in this epic, and a peer session holding the
    // code slot in a different work unit entirely.
    const mpath = path.join(dir, '.workflows/v1/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(mpath, 'utf8'));
    manifest.phases.specification = { items: { auth: { status: 'completed', order: 1, sources: { auth: { status: 'incorporated' } } } } };
    manifest.phases.planning = { items: { auth: { status: 'completed', format: 'local-markdown' } } };
    manifest.phases.discussion.items.auth.status = 'completed';
    fs.writeFileSync(mpath, JSON.stringify(manifest, null, 2));
    fs.mkdirSync(path.join(dir, '.workflows/ship'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows/ship/manifest.json'), JSON.stringify({
      name: 'ship', work_type: 'feature', status: 'in-progress', phases: {},
    }, null, 2));
    const peer = path.join(dir, '.workflows/.cache/ship/implementation/checkout-flow/presence');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');

    const res = run(['view', 'v1']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes('(code session: ship/checkout-flow, last active'),
      `the ACTIONS marker names the slot and its holder:\n${res.stdout}`);
    assert.match(res.stdout.replace(/\n\u00a0+/g, ' '), /~~[^~]*~~ · code session in ship\/checkout-flow/, res.stdout);

    // One gate per attempt: the marker is the menu's awareness signal, and the
    // stop belongs to the phase's own code gate — asking here refuses.
    assert.ok(!res.stdout.includes('(in session:'), `a code row never wears the doc marker:\n${res.stdout}`);
    const key = res.stdout.split('\n').find((l) => l.includes('start_implementation')).trim().split(/\s+/)[0];
    const gate = run(['in-session-gate', 'v1', key]);
    assert.strictEqual(gate.status, 0, gate.stderr);
    assert.ok(!gate.stdout.includes('MENU: in-session gate'), `no gate section for a code entry:\n${gate.stdout}`);
    assert.ok(gate.stdout.includes('the code slot is gated where the phase starts'), gate.stdout);
  });

  it('the caller\'s own hold marks nothing — a session never strikes through itself', () => {
    const fs = require('fs');
    epicFixture();
    const p = path.join(dir, '.workflows/.cache/v1/discussion/auth/presence');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'mine' }) + '\n');

    // From the holding session — stepping back to the menu mid-discussion.
    const own = spawnSync('node', [GATEWAY, 'view', 'v1'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'mine' },
    });
    assert.strictEqual(own.status, 0, own.stderr);
    assert.ok(own.stdout.includes('sessions_in_progress: (none)'), own.stdout);
    assert.ok(!own.stdout.includes('in session'), `its own topic reads free:\n${own.stdout}`);
    const ownGate = spawnSync('node', [GATEWAY, 'in-session-gate', 'v1', '1'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'mine' },
    });
    assert.ok(ownGate.stdout.includes('is not held by another session'), ownGate.stdout);

    // From anywhere else, the same row is a peer's hold.
    const peer = spawnSync('node', [GATEWAY, 'view', 'v1'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'someone-else', CLAUDE_PID: '' },
    });
    assert.ok(peer.stdout.includes('sessions_in_progress: discussion/auth'), peer.stdout);
    assert.ok(peer.stdout.includes('(in session:'), peer.stdout);
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
    for (const verb of ['completed-menu', 'cancel-menu', 'reactivate-menu', 'postpone-menu', 'unblock-menu']) {
      const res = run([verb]);
      assert.strictEqual(res.status, 1, verb);
      assert.strictEqual(res.stdout, '', verb);
      assert.strictEqual(res.stderr, `gateway: ${verb} takes exactly one work unit\n` + USAGE, verb);
    }
  });

  it("cancel-menu carries a held unit's in-session age from the presence scan — never the caller's own hold", () => {
    const fs = require('fs');
    epicFixture();
    const p = path.join(dir, '.workflows/.cache/v1/discussion/auth/presence');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');
    const past = new Date(Date.now() - 120 * 1000);
    fs.utimesSync(p, past, past);

    const res = run(['cancel-menu', 'v1']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes('  └─ 1. Auth [discussing] · in session (last active 2m ago)'), res.stdout);
    assert.ok(/Cancel "Auth" — \*discussing\* · in session \(last active 2m ago\)/.test(res.stdout.replace(/\n\u00a0+/g, ' ')), res.stdout);
    assert.ok(res.stdout.includes('  1  —  cancel  auth  discovery  → (internal)'), 'the cue never locks — the row keeps its key');

    const own = spawnSync('node', [GATEWAY, 'cancel-menu', 'v1'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'peer' },
    });
    assert.ok(!own.stdout.includes('in session'), `its own topic reads free:\n${own.stdout}`);
  });

  it("postpone-menu carries a held unit's in-session age from the presence scan — never the caller's own hold", () => {
    const fs = require('fs');
    epicFixture();
    const p = path.join(dir, '.workflows/.cache/v1/discussion/auth/presence');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');
    const past = new Date(Date.now() - 120 * 1000);
    fs.utimesSync(p, past, past);

    const res = run(['postpone-menu', 'v1']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes('  └─ 1. Auth [discussing] · in session (last active 2m ago)'), res.stdout);
    assert.ok(/Postpone "Auth" — \*discussing\* · in session \(last active 2m ago\)/.test(res.stdout.replace(/\n +/g, ' ')), res.stdout);
    assert.ok(res.stdout.includes('  1  —  postpone  auth  discovery  → (internal)'), 'the cue never locks — the row keeps its key');

    const own = spawnSync('node', [GATEWAY, 'postpone-menu', 'v1'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'peer' },
    });
    assert.ok(!own.stdout.includes('in session'), `its own topic reads free:\n${own.stdout}`);
  });

  it("reactivate-menu carries a held unit's in-session age from the presence scan — the laboratory's hold counted with its topic", () => {
    const fs = require('fs');
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { auth: { routing: 'discussion', source: 'discovery', cancelled: true } } },
        discussion: { items: { auth: { status: 'cancelled', previous_status: 'in-progress' } } },
      },
    });
    const p = path.join(dir, '.workflows/.cache/v1/experiment/auth/presence');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');
    const past = new Date(Date.now() - 120 * 1000);
    fs.utimesSync(p, past, past);

    const res = run(['reactivate-menu', 'v1']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.match(res.stdout.replace(/\n {8}/g, ' '), /1\. Auth \[cancelled\] — discussion \[was in-progress\] · in session \(last active 2m ago\)/, res.stdout);
    assert.ok(res.stdout.includes('  1  —  reactivate  auth  discovery  → (internal)'), 'the cue never locks — the row keeps its key');
  });

  it('each sub-view verb errors on excess positionals', () => {
    epicFixture();
    for (const verb of ['completed-menu', 'cancel-menu', 'reactivate-menu', 'postpone-menu', 'unblock-menu']) {
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
});

// An epic with a cancelled specification over two sources, a legacy
// array-form cancelled one, and a bare cancelled one — none of them groups.
function cancelledSpecsManifest() {
  return {
    work_type: 'epic',
    phases: {
      discussion: { items: { auth: { status: 'completed' }, billing: { status: 'completed' } } },
      specification: {
        items: {
          unified: { status: 'cancelled', previous_status: 'completed', sources: { auth: { status: 'incorporated' }, billing: { status: 'incorporated' } } },
          legacy: { status: 'cancelled', sources: [{ name: 'billing', status: 'incorporated' }] },
          bare: { status: 'cancelled' },
        },
      },
    },
  };
}

describe('workflow-continue-epic specification discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('refuses a name with no active epic behind it — unknown, closed, or another work type', () => {
    createManifest(dir, 'shipped', { work_type: 'epic', status: 'completed' });
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'completed' } } } } });
    for (const name of ['ghost', 'shipped', 'auth']) {
      assert.throws(() => specificationDiscovery(dir, name), new RegExp(`no active epic "${name}"`));
    }
  });

  it('reads an epic with nothing discussed as empty', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const r = specificationDiscovery(dir, 'v1');
    assert.strictEqual(r.current_state.has_discussions, false);
    assert.strictEqual(r.current_state.spec_count, 0);
    assert.strictEqual(r.discussions.length, 0);
    assert.strictEqual(r.specifications.length, 0);
  });

  it('reads only the named epic', () => {
    createManifest(dir, 'v1', { work_type: 'epic', phases: { discussion: { items: { a: { status: 'completed' } } } } });
    createManifest(dir, 'v2', { work_type: 'epic', phases: { discussion: { items: { b: { status: 'completed' }, c: { status: 'completed' } } } } });
    assert.deepStrictEqual(specificationDiscovery(dir, 'v1').discussions.map((d) => d.name), ['a']);
  });

  it('finds discussions with spec status', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress', sources: { auth: { status: 'extracted' } } } } },
      },
    });
    const r = specificationDiscovery(dir, 'v1');
    assert.strictEqual(r.discussions.length, 1);
    assert.strictEqual(r.discussions[0].has_individual_spec, true);
    assert.strictEqual(r.discussions[0].spec_status, 'in-progress');
    assert.strictEqual(r.current_state.completed_count, 1);
  });

  it('detects discussion items with spec cross-reference', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          status: 'in-progress',
          items: {
            'auth-design': { status: 'completed' },
            'data-model': { status: 'in-progress' },
          },
        },
        specification: {
          items: {
            'auth-spec': {
              status: 'in-progress',
              sources: { 'auth-design': { status: 'extracted' } },
            },
          },
        },
      },
    });
    const r = specificationDiscovery(dir, 'v1');
    assert.strictEqual(r.discussions.length, 2);
    const auth = r.discussions.find(d => d.name === 'auth-design');
    assert.strictEqual(auth.has_individual_spec, true);
    const data = r.discussions.find(d => d.name === 'data-model');
    assert.strictEqual(data.has_individual_spec, false);
  });

  it('finds specification items with sources', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: {
            'auth-design': { status: 'completed' },
            'data-model': { status: 'completed' },
          },
        },
        specification: {
          items: {
            'auth-spec': {
              status: 'completed',
              type: 'feature',
              sources: { 'auth-design': { status: 'incorporated' } },
            },
            'data-spec': {
              status: 'in-progress',
              sources: { 'data-model': { status: 'extracted' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/auth-spec/specification.md', '# Auth Spec');
    createFile(dir, '.workflows/v1/specification/data-spec/specification.md', '# Data Spec');
    const r = specificationDiscovery(dir, 'v1');
    assert.strictEqual(r.specifications.length, 2);
    const authSpec = r.specifications.find(s => s.name === 'auth-spec');
    assert.strictEqual(authSpec.status, 'completed');
    assert.strictEqual(authSpec.sources.length, 1);
    assert.strictEqual(authSpec.sources[0].name, 'auth-design');
    assert.strictEqual(authSpec.sources[0].discussion_status, 'completed');
    const dataSpec = r.specifications.find(s => s.name === 'data-spec');
    assert.strictEqual(dataSpec.status, 'in-progress');
  });

  it('a started specification counts once its file is on disk', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' } } },
        specification: { items: { 'a-spec': { status: 'in-progress', sources: { a: { status: 'pending' } } } } },
      },
    });
    assert.strictEqual(specificationDiscovery(dir, 'v1').specifications.length, 0);
    createFile(dir, '.workflows/v1/specification/a-spec/specification.md', '# A');
    assert.strictEqual(specificationDiscovery(dir, 'v1').current_state.spec_count, 1);
  });

  it('skips superseded specification items', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: {
          items: {
            'old-spec': { status: 'superseded', superseded_by: 'new-spec' },
            'new-spec': { status: 'in-progress' },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/old-spec/specification.md', '# Old');
    createFile(dir, '.workflows/v1/specification/new-spec/specification.md', '# New');
    const r = specificationDiscovery(dir, 'v1');
    assert.strictEqual(r.specifications.length, 1);
    assert.strictEqual(r.specifications[0].name, 'new-spec');
  });

  it('computes discussion counts correctly', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { a: { status: 'completed' }, b: { status: 'in-progress' }, c: { status: 'completed' } } } },
    });
    const r = specificationDiscovery(dir, 'v1');
    assert.strictEqual(r.current_state.discussion_count, 3);
    assert.strictEqual(r.current_state.completed_count, 2);
    assert.strictEqual(r.current_state.in_progress_count, 1);
  });

  it('an unstarted stub is not a discussion — excluded from counts, list, and has_discussions', () => {
    createManifest(dir, 'overhaul', {
      work_type: 'epic',
      phases: { discussion: { items: { parked: { status: 'unstarted' } } } },
    });
    createFile(dir, '.workflows/overhaul/discussion/parked.md', '# Discussion: Parked\n\n## Triage\n\n### Message\nBody.\n');
    const r = specificationDiscovery(dir, 'overhaul');
    assert.strictEqual(r.current_state.discussion_count, 0);
    assert.strictEqual(r.current_state.has_discussions, false, 'a stub must not flip the blocked scenario to "still in progress"');
    assert.deepStrictEqual(r.discussions, []);
  });

  it('a lone postponed discussion is no discussion at all — the menu reads blocked-no-discussions', () => {
    createManifest(dir, 'mvp', {
      work_type: 'epic',
      phases: {
        discovery: { items: { away: { routing: 'discussion', source: 'discovery', postponed: true } } },
        discussion: { items: { away: { status: 'postponed', previous_status: 'completed' } } },
      },
    });
    createFile(dir, '.workflows/mvp/discussion/away.md', '# Discussion: Away\n');
    const r = specificationDiscovery(dir, 'mvp');
    assert.strictEqual(r.current_state.discussion_count, 0);
    assert.strictEqual(r.current_state.has_discussions, false, 'a topic that left for the roadmap must not read as one still in progress');
    assert.deepStrictEqual(r.discussions, []);
    const view = spawnSync('node', [GATEWAY, 'spec-view', 'mvp'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(view.status, 0, view.stderr);
    assert.ok(view.stdout.includes('scenario: blocked-no-discussions'), view.stdout);
  });

  it('a postponed discussion drops out of the counts and the list beside a live one', () => {
    createManifest(dir, 'mvp', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          away: { routing: 'discussion', source: 'discovery', postponed: true },
          billing: { routing: 'discussion', source: 'discovery' },
        } },
        discussion: { items: {
          away: { status: 'postponed', previous_status: 'completed' },
          billing: { status: 'completed' },
        } },
      },
    });
    createFile(dir, '.workflows/mvp/discussion/away.md', '# Discussion: Away\n');
    createFile(dir, '.workflows/mvp/discussion/billing.md', '# Discussion: Billing\n');
    const r = specificationDiscovery(dir, 'mvp');
    assert.strictEqual(r.current_state.discussion_count, 1);
    assert.strictEqual(r.current_state.completed_count, 1);
    assert.deepStrictEqual(r.discussions.map((d) => d.name), ['billing']);
  });

  it('reads the grouping analysis cache against the discussion files: none, valid, stale', () => {
    const crypto = require('crypto');
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    createFile(dir, '.workflows/v1/discussion/auth.md', '# Auth');
    assert.strictEqual(specificationDiscovery(dir, 'v1').cache, 'none');

    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          analysis_cache: { checksum: crypto.createHash('md5').update('# Auth').digest('hex'), generated: '2026-01-01' },
          items: { auth: { status: 'completed' } },
        },
      },
    });
    assert.strictEqual(specificationDiscovery(dir, 'v1').cache, 'valid');

    createFile(dir, '.workflows/v1/discussion/auth.md', '# Auth updated');
    assert.strictEqual(specificationDiscovery(dir, 'v1').cache, 'stale');
  });

  it('a cache over no discussion files reads stale', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          analysis_cache: { checksum: 'any', generated: '2026-01-01' },
          items: { auth: { status: 'completed' } },
        },
      },
    });
    assert.strictEqual(specificationDiscovery(dir, 'v1').cache, 'stale');
  });

  it('computes the discussions checksum, and null with no discussion files', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    assert.strictEqual(specificationDiscovery(dir, 'v1').current_state.discussions_checksum, null);
    createFile(dir, '.workflows/v1/discussion/auth.md', '# Auth discussion');
    assert.ok(specificationDiscovery(dir, 'v1').current_state.discussions_checksum);
  });

  it('a cancelled or superseded specification is no individual spec — its source is free to be regrouped', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' }, billing: { status: 'completed' } } },
        specification: {
          items: {
            auth: { status: 'cancelled', previous_status: 'completed', sources: { auth: { status: 'incorporated' } } },
            old: { status: 'superseded', superseded_by: 'unified', sources: { billing: { status: 'incorporated' } } },
            unified: { status: 'in-progress', sources: { billing: { status: 'incorporated' } } },
          },
        },
      },
    });
    const r = specificationDiscovery(dir, 'pay');
    assert.strictEqual(r.discussions.find((d) => d.name === 'auth').has_individual_spec, false);
    assert.strictEqual(r.discussions.find((d) => d.name === 'billing').spec_status, 'in-progress', 'the superseding spec, not the superseded one');
  });

  it('a cancelled specification lands in cancelled_specifications with its sources — never in specifications, never an individual spec', () => {
    createManifest(dir, 'pay', cancelledSpecsManifest());
    const r = specificationDiscovery(dir, 'pay');
    assert.deepStrictEqual(r.cancelled_specifications, [
      { name: 'unified', sources: ['auth', 'billing'] },
      { name: 'legacy', sources: ['billing'] },
      { name: 'bare', sources: [] },
    ]);
    assert.deepStrictEqual(r.specifications, []);
    assert.deepStrictEqual(r.discussions.map((d) => d.has_individual_spec), [false, false]);
  });

  it('a promoted or status-less specification is no individual spec — only a started one is incorporated — yet both still group their sources', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' }, billing: { status: 'completed' } } },
        specification: { items: {
          auth: { status: 'promoted', promoted_to: 'auth-cc', sources: { auth: { status: 'incorporated' } } },
          billing: { sources: { billing: { status: 'pending' } } },
        } },
      },
    });
    createFile(dir, '.workflows/pay/specification/billing/specification.md', '# Billing');
    const r = specificationDiscovery(dir, 'pay');
    assert.deepStrictEqual(r.discussions.map((d) => [d.name, d.has_individual_spec]), [['auth', false], ['billing', false]]);
    assert.deepStrictEqual(r.specifications.map((s) => s.name).sort(), ['auth', 'billing'],
      'the promotion took the file to the cross-cutting unit — the item still groups its source');
    assert.strictEqual(r.current_state.spec_count, 1, 'a promoted specification counts nowhere');
    assert.deepStrictEqual(r.cancelled_specifications, []);
  });

  it('the view DATA lists every cancelled specification with its sources, or (none)', () => {
    createManifest(dir, 'pay', cancelledSpecsManifest());
    const cancelled = spawnSync('node', [GATEWAY, 'spec-view', 'pay'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(cancelled.status, 0, cancelled.stderr);
    assert.ok(cancelled.stdout.includes([
      'specifications:',
      '  (none)',
      'cancelled_specifications:',
      '  unified: sources auth, billing',
      '  legacy: sources billing',
      '  bare: sources (none)',
      'unassigned_discussions: auth, billing',
    ].join('\n')), cancelled.stdout);
    createManifest(dir, 'clean', { work_type: 'epic', phases: { discussion: { items: { clean: { status: 'completed' } } } } });
    const none = spawnSync('node', [GATEWAY, 'spec-view', 'clean'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(none.status, 0, none.stderr);
    assert.ok(none.stdout.includes('cancelled_specifications:\n  (none)\nunassigned_discussions: clean'), none.stdout);
  });

  it('a discussion with no specification has no individual spec', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    assert.strictEqual(specificationDiscovery(dir, 'v1').discussions[0].has_individual_spec, false);
  });

  it('spec with no sources has no sources field', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    createFile(dir, '.workflows/v1/specification/auth/specification.md', '# Spec');
    const r = specificationDiscovery(dir, 'v1');
    assert.strictEqual(r.specifications.length, 1);
    assert.strictEqual(r.specifications[0].sources, undefined);
  });

  it('defaults source status to pending when object-shaped without status; a row that is not an object is no source, as the completion gate reads it', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: {
          items: {
            auth: {
              status: 'completed',
              sources: { auth: {}, design: 'not-an-object' },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/auth/specification.md', '# Spec');
    const spec = specificationDiscovery(dir, 'v1').specifications[0];
    assert.deepStrictEqual(spec.sources, [{ name: 'auth', status: 'pending', discussion_status: 'completed' }]);
    assert.strictEqual(spec.has_pending_sources, true);
  });

  it('reads legacy array-form sources by name, for the spec and for the discussion it covers', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'completed' }, billing: { status: 'completed' } } },
        specification: {
          items: {
            core: { status: 'in-progress', sources: [{ name: 'auth', status: 'incorporated' }, { name: 'billing' }] },
          },
        },
      },
    });
    createFile(dir, '.workflows/pay/specification/core/specification.md', '# Spec');
    const r = specificationDiscovery(dir, 'pay');
    assert.deepStrictEqual(r.specifications[0].sources, [
      { name: 'auth', status: 'incorporated', discussion_status: 'completed' },
      { name: 'billing', status: 'pending', discussion_status: 'completed' },
    ]);
    assert.deepStrictEqual(r.discussions.map((d) => [d.name, d.has_individual_spec, d.spec_status]),
      [['auth', true, 'in-progress'], ['billing', true, 'in-progress']]);
  });
});

describe('workflow-continue-epic specification ordering and counts', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  describe('spec menu reorder', () => {
    // Builds an epic with four spec items in shuffled insertion order:
    // concluded, completed-with-pending, proposed, in-progress. Files exist for
    // every materialized (non-proposed) spec so they pass the fileExists gate.
    function reorderFixture() {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'd-concluded': { status: 'completed' },
              'd-pending-a': { status: 'completed' },
              'd-pending-b': { status: 'completed' },
              'd-proposed': { status: 'completed' },
              'd-wip': { status: 'completed' },
            },
          },
          specification: {
            items: {
              'concluded-spec': {
                status: 'completed',
                sources: { 'd-concluded': { status: 'incorporated' } },
              },
              'pending-spec': {
                status: 'completed',
                sources: {
                  'd-pending-a': { status: 'incorporated' },
                  'd-pending-b': { status: 'pending' },
                },
              },
              'proposed-grp': {
                status: 'proposed',
                sources: { 'd-proposed': { status: 'pending' } },
              },
              'wip-spec': {
                status: 'in-progress',
                sources: { 'd-wip': { status: 'extracted' } },
              },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/concluded-spec/specification.md', '# Concluded');
      createFile(dir, '.workflows/v1/specification/pending-spec/specification.md', '# Pending');
      createFile(dir, '.workflows/v1/specification/wip-spec/specification.md', '# Wip');
    }

    it('has_pending_sources false when all sources incorporated', () => {
      reorderFixture();
      const spec = specificationDiscovery(dir, 'v1').specifications.find(s => s.name === 'concluded-spec');
      assert.strictEqual(spec.has_pending_sources, false);
    });

    it('has_pending_sources true when a source is pending', () => {
      reorderFixture();
      const spec = specificationDiscovery(dir, 'v1').specifications.find(s => s.name === 'pending-spec');
      assert.strictEqual(spec.has_pending_sources, true);
    });

    it('has_pending_sources true for a proposed grouping', () => {
      reorderFixture();
      const spec = specificationDiscovery(dir, 'v1').specifications.find(s => s.name === 'proposed-grp');
      assert.strictEqual(spec.has_pending_sources, true);
    });

    it('has_pending_sources true when a source is stale — reconciliation is open work', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'd-one': { status: 'completed' } } },
          specification: {
            items: {
              'staled-spec': {
                status: 'completed',
                sources: { 'd-one': { status: 'stale' } },
              },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/staled-spec/specification.md', '# Staled');
      const spec = specificationDiscovery(dir, 'v1').specifications.find(s => s.name === 'staled-spec');
      assert.strictEqual(spec.has_pending_sources, true);
      assert.strictEqual(spec.sources[0].status, 'stale');
    });

    it('has_pending_sources false for a spec with no sources', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: { items: { auth: { status: 'in-progress' } } },
        },
      });
      createFile(dir, '.workflows/v1/specification/auth/specification.md', '# Spec');
      assert.strictEqual(specificationDiscovery(dir, 'v1').specifications[0].has_pending_sources, false);
    });

    it('sorts specifications actionable-first (proposed, in-progress, completed+pending, concluded)', () => {
      reorderFixture();
      const order = specificationDiscovery(dir, 'v1').specifications.map(s => s.name);
      assert.deepStrictEqual(order, ['proposed-grp', 'wip-spec', 'pending-spec', 'concluded-spec']);
    });

    it('the build order breaks ties within a rank tier; unordered specs trail', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { d1: { status: 'completed' }, d2: { status: 'completed' }, d3: { status: 'completed' } } },
          specification: {
            items: {
              zeta: { status: 'in-progress', order: 2, sources: { d1: { status: 'pending' } } },
              auth: { status: 'in-progress', order: 1, sources: { d2: { status: 'pending' } } },
              stray: { status: 'in-progress', sources: { d3: { status: 'pending' } } },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/zeta/specification.md', '# Z');
      createFile(dir, '.workflows/v1/specification/auth/specification.md', '# A');
      createFile(dir, '.workflows/v1/specification/stray/specification.md', '# S');
      assert.deepStrictEqual(specificationDiscovery(dir, 'v1').specifications.map(s => s.name), ['auth', 'zeta', 'stray']);
    });

    it('two unordered specs in one tier keep insertion order via an explicit tie', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { d1: { status: 'completed' }, d2: { status: 'completed' } } },
          specification: {
            items: {
              zeta: { status: 'in-progress', sources: { d1: { status: 'pending' } } },
              alpha: { status: 'in-progress', sources: { d2: { status: 'pending' } } },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/zeta/specification.md', '# Z');
      createFile(dir, '.workflows/v1/specification/alpha/specification.md', '# A');
      assert.deepStrictEqual(specificationDiscovery(dir, 'v1').specifications.map(s => s.name), ['zeta', 'alpha']);
    });

    it('concluded_count counts only completed specs with no pending sources', () => {
      reorderFixture();
      assert.strictEqual(specificationDiscovery(dir, 'v1').current_state.concluded_count, 1);
    });

    it('concluded_count is zero when no spec is concluded', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'd-prop': { status: 'completed' }, 'd-wip': { status: 'completed' } } },
          specification: {
            items: {
              'prop': { status: 'proposed', sources: { 'd-prop': { status: 'pending' } } },
              'wip': { status: 'in-progress', sources: { 'd-wip': { status: 'extracted' } } },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/wip/specification.md', '# Wip');
      assert.strictEqual(specificationDiscovery(dir, 'v1').current_state.concluded_count, 0);
    });
  });

  describe('proposed groupings', () => {
    it('counts a proposed spec item (no file) in proposed_count, not spec_count', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth-design': { status: 'completed' }, 'data-model': { status: 'completed' } } },
          specification: {
            items: {
              'auth-grouping': {
                status: 'proposed',
                sources: { 'auth-design': { status: 'pending' } },
              },
            },
          },
        },
      });
      // No spec file on disk for the proposed item — must still be counted.
      const r = specificationDiscovery(dir, 'v1');
      assert.strictEqual(r.current_state.proposed_count, 1);
      assert.strictEqual(r.current_state.spec_count, 0);
      const spec = r.specifications.find(s => s.name === 'auth-grouping');
      assert.ok(spec, 'proposed item present in specifications[]');
      assert.strictEqual(spec.status, 'proposed');
      assert.strictEqual(spec.sources.length, 1);
      assert.strictEqual(spec.sources[0].name, 'auth-design');
      assert.strictEqual(spec.sources[0].status, 'pending');
    });

    it('a proposed source does not set has_individual_spec, a single completed discussion included', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth-design': { status: 'completed' } } },
          specification: {
            items: {
              'auth-grouping': { status: 'proposed', sources: { 'auth-design': { status: 'pending' } } },
            },
          },
        },
      });
      const r = specificationDiscovery(dir, 'v1');
      assert.strictEqual(r.current_state.completed_count, 1);
      assert.strictEqual(r.discussions[0].has_individual_spec, false);
      assert.strictEqual(r.current_state.proposed_count, 1);
      assert.strictEqual(r.current_state.spec_count, 0);
    });

    it('mixed proposed and materialized specs count separately', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth-design': { status: 'completed' }, 'data-model': { status: 'completed' } } },
          specification: {
            items: {
              'auth-spec': { status: 'in-progress', sources: { 'auth-design': { status: 'extracted' } } },
              'data-grouping': { status: 'proposed', sources: { 'data-model': { status: 'pending' } } },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/auth-spec/specification.md', '# Auth Spec');
      const r = specificationDiscovery(dir, 'v1');
      assert.strictEqual(r.current_state.spec_count, 1);
      assert.strictEqual(r.current_state.proposed_count, 1);
      assert.strictEqual(r.specifications.length, 2);
    });

    it('proposed item is included even without a spec file (file not required)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { grp: { status: 'proposed', sources: { d: { status: 'pending' } } } } },
        },
      });
      const r = specificationDiscovery(dir, 'v1');
      assert.strictEqual(r.specifications.length, 1);
      assert.strictEqual(r.specifications[0].status, 'proposed');
      assert.strictEqual(r.current_state.spec_count, 0);
      assert.strictEqual(r.current_state.proposed_count, 1);
    });
  });
});
