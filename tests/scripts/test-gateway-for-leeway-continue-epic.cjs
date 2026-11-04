'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, formatScoped } = require('../../skills/leeway-continue-epic/scripts/gateway.cjs');

const GATEWAY = path.join(__dirname, '../../skills/leeway-continue-epic/scripts/gateway.cjs');

describe('leeway-continue-epic discovery', () => {
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
      // leeway-continue-epic Step 2 (Backfill) filters discovery_map by
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
              'pristine': { source: 'discovery', summary: 'Brand-new topic with summary', description: 'Already grounded' },
              'migrated-no-summary': { source: 'migration-seeded' },
              'migrated-summary-no-description': { source: 'migration-seeded', summary: 'Backfilled before Phase 14' },
              'migrated-fully-populated': { source: 'migration-seeded', summary: 'Both populated', description: 'Backfilled after Phase 14' },
              'migrated-then-resurfaced': { source: 'migration-seeded,gap-analysis' },
              'analysis-only': { source: 'gap-analysis', summary: 'From analysis', description: 'analysis paragraphs' },
              'absorbed-no-fields': {},
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

      assert.strictEqual(byName['migrated-then-resurfaced'].source, 'migration-seeded,gap-analysis');
      assert.strictEqual(byName['migrated-then-resurfaced'].summary, null);
      assert.strictEqual(byName['migrated-then-resurfaced'].summary_present, false);
      assert.strictEqual(byName['migrated-then-resurfaced'].description_present, false);

      assert.strictEqual(byName['analysis-only'].source, 'gap-analysis');
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

  describe('edge cases', () => {
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
        phases: { discovery: { items: { 'topic-a': { source: 'discovery' } } } },
      });
      assert.strictEqual(discover(dir, 'auth'), null);
    });

    it('discovery items only render as fresh / ○ tier', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              'kitchen-hardware': { source: 'discovery' },
              'tenant-onboarding': { source: 'discovery' },
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

    it('tier ordering: ✓ ◐ ○ ⊘ with alphabetical within tier', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              'zeta-fresh': { source: 'discovery' },
              'alpha-fresh': { source: 'discovery' },
              'in-flight': { source: 'discovery' },
              'decided-topic': { source: 'discovery' },
              'cancelled-topic': { source: 'discovery' },
            },
          },
          discussion: {
            items: {
              'in-flight': { status: 'in-progress' },
              'decided-topic': { status: 'completed' },
              'cancelled-topic': { status: 'cancelled' },
            },
          },
        },
      });
      const tiers = discover(dir, 'v1').discovery_map.map(t => `${t.tier} ${t.name}`);
      assert.deepStrictEqual(tiers, [
        '✓ decided-topic',
        '◐ in-flight',
        '○ alpha-fresh',
        '○ zeta-fresh',
        '⊘ cancelled-topic',
      ]);
    });

    it('lifecycle: no phase items → fresh, next=start_discussion', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { source: 'discovery' } } },
        },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.lifecycle, 'fresh');
      assert.strictEqual(t.next_action, 'start_discussion');
    });

    it('lifecycle: discussion in-progress → discussing, ◐, continue_discussion', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { source: 'discovery' } } },
          discussion: { items: { topic: { status: 'in-progress' } } },
        },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.lifecycle, 'discussing');
      assert.strictEqual(t.tier, '◐');
      assert.strictEqual(t.next_action, 'continue_discussion');
      assert.strictEqual(t.current_phase, 'discussion');
    });

    it('lifecycle: discussion completed → decided, ✓, no next_action', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { source: 'discovery' } } },
          discussion: { items: { topic: { status: 'completed' } } },
        },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.lifecycle, 'decided');
      assert.strictEqual(t.tier, '✓');
      assert.strictEqual(t.next_action, null);
    });

    it('lifecycle: discussion cancelled → cancelled, ⊘', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { source: 'discovery' } } },
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
              a: { source: 'discovery' },
              b: { source: 'discovery' },
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
              a: { source: 'discovery' },
              b: { source: 'discovery' },
            },
          },
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
              a: { source: 'discovery' },
              b: { source: 'discovery' },
            },
          },
          discussion: { items: { a: { status: 'completed' } } },
        },
      });
      const d = discover(dir, 'v1');
      assert.strictEqual(d.convergence_state, 'in-progress');
    });

    it('source provenance: discovery → null', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { source: 'discovery' } } } },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.source_provenance, null);
    });

    it('source provenance: gap-analysis → from gap-analysis', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { source: 'gap-analysis' } } } },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.source_provenance, 'from gap-analysis');
    });

    it('source provenance: direct-start → from direct-start', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: { discovery: { items: { topic: { source: 'direct-start' } } } },
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
              flight: { source: 'discovery' },
              done: { source: 'discovery' },
              fresh1: { source: 'discovery' },
              cancelled: { source: 'discovery' },
            },
          },
          discussion: {
            items: {
              flight: { status: 'in-progress' },
              done: { status: 'completed' },
              cancelled: { status: 'cancelled' },
            },
          },
        },
      });
      const s = discover(dir, 'v1').map_summary;
      assert.strictEqual(s.total, 4);
      assert.strictEqual(s.in_flight, 1);
      assert.strictEqual(s.decided, 1);
      assert.strictEqual(s.fresh, 1);
      assert.strictEqual(s.cancelled, 1);
    });

    it('excludes discovery from phases output (lives in discovery_map only)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: { items: { topic: { source: 'discovery' } } },
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
              alpha: { source: 'discovery' },
              beta: { source: 'discovery' },
            },
          },
        },
      });
      const d = discover(dir, 'v1');
      assert.strictEqual(d.in_progress.length, 0);
      assert.strictEqual(d.completed.length, 0);
      assert.strictEqual(d.cancelled.length, 0);
    });

    it('preserves the summary on map entries, and titles a topic by its title where it has one', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discovery: {
            items: {
              topic: {
                source: 'discovery',
                summary: 'A one-line description',
                title: 'renamed-topic',
              },
            },
          },
        },
      });
      const t = discover(dir, 'v1').discovery_map[0];
      assert.strictEqual(t.summary, 'A one-line description');
      assert.strictEqual(t.title, 'Renamed Topic');
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
      assert.deepStrictEqual(d.completed.map((i) => i.phase), ['discussion'], 'a kept spec item has no session to resume');
      assert.deepStrictEqual(d.phases.discussion.map((i) => i.name), ['auth'], 'the named epic\'s items, never another\'s');
    });
  });
});

describe('leeway-continue-epic formatScoped (state dump)', () => {
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
            'auth-flow': { status: 'in-progress', source: 'discovery', summary: 'OAuth vs sessions', description: 'Longer context.', order: 1 },
            'billing': { status: 'in-progress', source: 'gap-analysis' },
          },
        },
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.strictEqual(out, [
      '=== EPIC: v1 ===',
      'reconcile_pending: (none)',
      'analysis_caches: gap_analysis=absent',
      'needs_sequencing: true',
      'discovery_map (2):',
      '  - ◐ auth-flow [discussing] summary=present description=present — OAuth vs sessions',
      '  - ○ billing [fresh] summary=absent description=absent',
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
      'reconcile_pending: (none)',
      'analysis_caches: gap_analysis=absent',
      'needs_sequencing: false',
      'discovery_map (0):',
      '  (empty)',
      '',
    ].join('\n'));
  });

  it('rows omit the summary tail when the field is absent', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { a: { status: 'in-progress', source: 'discovery' } } } },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.ok(out.includes('  - ○ a [fresh] summary=absent description=absent\n'));
    assert.ok(!out.includes(' — '));
  });

  it('a parked stub carries the mail=waiting cue — parity with the discovery gateway dump', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { parked: { source: 'message:origin' } } },
        discussion: { items: { parked: { status: 'unstarted' } } },
      },
    });
    createFile(dir, '.leeway/v1/topics/parked/mail/001-question.md', '### question\n');
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.ok(out.includes('  - ○ parked [fresh] summary=absent description=absent mail=waiting\n'), out);
  });

  it('a waiting discussion carries the awaiting= cue', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { billing: { source: 'discovery' } } },
        discussion: { items: { billing: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      },
    });
    const out = formatScoped('v1', discover(dir, 'v1'));
    assert.ok(out.includes('  - ◐ billing [discussing] summary=absent description=absent awaiting=E1\n'), out);
  });

});

describe('leeway-continue-epic detail counts (imports/seeds)', () => {
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

describe('leeway-continue-epic CLI dispatch', () => {
  const USAGE = 'Usage: gateway.cjs {work_unit} | gateway.cjs view {work_unit} [new_arrivals_json] | gateway.cjs (completed-menu|cancel-menu|reactivate-menu|postpone-menu|pull-forward-menu) {work_unit} | gateway.cjs in-session-gate {work_unit} {key}\n';

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

  it('pull-forward-menu emits the roadmap item on the key, in DATA, byte-exactly', () => {
    const fs = require('fs');
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next'], items: {
        'export-suite': { horizon: 'next', summary: 's', origin: 'harvest', postponed_from: { work_unit: 'v1', topic: 'away' } },
      } },
    }, null, 2));
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { away: { source: 'roadmap', postponed: true } } },
        discussion: { items: { away: { status: 'postponed', previous_status: 'completed' } } },
      },
    });
    const out = run(['pull-forward-menu', 'v1']).stdout;
    assert.ok(out.includes('  1  —  pull-forward  away  discovery  → (internal)  (item: export-suite)'), out.split('===')[1] || out);
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
    const p = path.join(dir, '.leeway/.cache/v1/discussion/auth/presence');
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
    assert.ok(gateText.includes('"Auth" is open in another session — last active 2m ago. Proceeding starts a second concurrent session on the same discussion; its work could conflict with that session\'s. Only proceed if you know that session is no longer working; if it is wedged but alive, release its hold with `node .claude/skills/leeway-engine/scripts/engine.cjs presence clear v1 discussion auth`.'), gateText);
    assert.ok(gateText.indexOf('`b/back`') < gateText.indexOf('`y/yes`'), 'back leads the family\'s options');
    const unheld = run(['in-session-gate', 'v1', 'd']);
    assert.ok(unheld.stdout.includes('is not held by another session'), unheld.stdout);

    // A dead owner reads free: same record, unheld pid identity.
    fs.writeFileSync(p, JSON.stringify({ pid: process.pid, pid_start: 'Thu Jan  1 00:00:00 1970', session_id: 'sess-view' }) + '\n');
    const freed = run(['view', 'v1']);
    assert.ok(freed.stdout.includes('sessions_in_progress: (none)'), freed.stdout);
    assert.ok(!freed.stdout.includes('in session'), freed.stdout);
  });

  it('a code session anywhere in the project marks this epic\'s code entries', () => {
    const fs = require('fs');
    epicFixture();
    // This epic's build begun, and a peer session holding the code slot in a
    // different work unit entirely.
    const mpath = path.join(dir, '.leeway/v1/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(mpath, 'utf8'));
    Object.assign(manifest, { build: { position: 'auto' }, cut: { phases: [{ name: 'Auth', scenarios: [], sections: ['1'], relies_on: [] }] } });
    manifest.phases.discussion.items.auth.status = 'completed';
    fs.writeFileSync(mpath, JSON.stringify(manifest, null, 2));
    fs.mkdirSync(path.join(dir, '.leeway/ship'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway/ship/manifest.json'), JSON.stringify({
      name: 'ship', work_type: 'feature', status: 'in-progress', phases: {},
    }, null, 2));
    const peer = path.join(dir, '.leeway/.cache/ship/implementation/checkout-flow/presence');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer', checkout: dir }) + '\n');

    const res = run(['view', 'v1']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes('(code session: ship/checkout-flow, last active'),
      `the ACTIONS marker names the slot and its holder:\n${res.stdout}`);
    assert.match(res.stdout.replace(/\n\u00a0+/g, ' '), /~~[^~]*~~ · code session in ship\/checkout-flow/, res.stdout);

    // One gate per attempt: the marker is the menu's awareness signal, and the
    // stop belongs to the phase's own code gate — asking here refuses.
    assert.ok(!res.stdout.includes('(in session:'), `a code row never wears the doc marker:\n${res.stdout}`);
    const key = res.stdout.split('\n').find((l) => l.includes('enter_implementation')).trim().split(/\s+/)[0];
    const gate = run(['in-session-gate', 'v1', key]);
    assert.strictEqual(gate.status, 0, gate.stderr);
    assert.ok(!gate.stdout.includes('MENU: in-session gate'), `no gate section for a code entry:\n${gate.stdout}`);
    assert.ok(gate.stdout.includes('the code slot is gated where the build is entered (enter implementation|review)'), gate.stdout);
  });

  it('the caller\'s own hold marks nothing — a session never strikes through itself', () => {
    const fs = require('fs');
    epicFixture();
    const p = path.join(dir, '.leeway/.cache/v1/discussion/auth/presence');
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
    for (const verb of ['completed-menu', 'cancel-menu', 'reactivate-menu', 'postpone-menu', 'pull-forward-menu']) {
      const res = run([verb]);
      assert.strictEqual(res.status, 1, verb);
      assert.strictEqual(res.stdout, '', verb);
      assert.strictEqual(res.stderr, `gateway: ${verb} takes exactly one work unit\n` + USAGE, verb);
    }
  });

  it("cancel-menu carries a held unit's in-session age from the presence scan — never the caller's own hold", () => {
    const fs = require('fs');
    epicFixture();
    const p = path.join(dir, '.leeway/.cache/v1/discussion/auth/presence');
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
    const p = path.join(dir, '.leeway/.cache/v1/discussion/auth/presence');
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
        discovery: { items: { auth: { source: 'discovery', cancelled: true } } },
        discussion: { items: { auth: { status: 'cancelled', previous_status: 'in-progress' } } },
      },
    });
    const p = path.join(dir, '.leeway/.cache/v1/experiment/auth/presence');
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
    for (const verb of ['completed-menu', 'cancel-menu', 'reactivate-menu', 'postpone-menu', 'pull-forward-menu']) {
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
