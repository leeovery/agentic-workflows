'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover } = require('../../skills/workflow-continue-epic/scripts/gateway.cjs');
const {
  epicDashboard, epicKey, epicMenu, epicInSessionGate, epicCompletedMenu, epicCancelMenu, epicReactivateMenu, epicUnblockMenu,
} = require('../../skills/workflow-engine/scripts/domain/projections/epic.cjs');
const { TREE_WIDTH } = require('../../skills/workflow-engine/scripts/domain/conventions.cjs');

const ADAPTER = path.join(__dirname, '../../skills/workflow-continue-epic/scripts/gateway.cjs');

// Menu label continuations indent with non-breaking spaces (the worklist
// rule) — goldens spell them explicitly.
const NB = (n) => '\u00a0'.repeat(n);

// Golden tests: byte-exact expected strings for the epic dashboard, key, and
// menu projections. Fixtures go through real manifests in temp dirs (the same
// shapes the discovery tests produce), except the gating/blocked menu fixture,
// which hand-builds a detail to reach states a manifest can't (a start entry
// surviving while its gate is closed).

/** Build a detail from a manifest in a temp fixture dir. */
function detailFor(dir, name, manifest) {
  createManifest(dir, name, manifest);
  return discover(dir, name).epics[0].detail;
}

describe('epic projections: dashboard (map branch)', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // A summary containing a token longer than the wrap budget — the renderer
  // must hard-split it rather than let it overflow the gutter.
  const LONG_TOKEN_SUMMARY = 'Receipt printing, KDS handoff, and the fastest-cumulative-time-tiebreak-resolution-policy-and-offline-sync token that cannot break';

  function mapDetail() {
    return detailFor(dir, 'quiz-competition-v1', {
      work_type: 'epic',
      seeds: [{ path: 'seeds/x.md', source: 'inbox:idea' }],
      imports: [{ path: 'imports/a.md' }],
      phases: {
        discovery: {
          items: {
            'kitchen-hardware': { routing: 'research', source: 'discovery', order: 1, summary: LONG_TOKEN_SUMMARY },
            'menu-admin': { routing: 'discussion', source: 'research-split:exploration', order: 2, summary: 'Business-side menu modelling, admin shell (Filament vs custom Vue/Nuxt), JustEat import, staff/roles' },
          },
        },
        research: { items: { 'kitchen-hardware': { status: 'completed' } } },
        specification: { items: { 'roles-and-permissions': { status: 'completed', sources: { 'menu-admin': { status: 'incorporated' }, 'auth-flow': { status: 'pending' } } } } },
        planning: { items: { 'roles-and-permissions': { status: 'completed', format: 'tick' } } },
        implementation: { items: { 'roles-and-permissions': { status: 'in-progress', current_phase: 2, completed_tasks: ['r-1-1', 'r-1-2', 'r-2-1'] } } },
      },
    });
  }

  const EXPECTED_DASHBOARD = [
    '── DISCOVERY ────────────────────────────────────────────────────',
    '',
    'MATERIAL',
    '  · seeded from the inbox',
    '  · 1 import',
    '',
    '  ⚑ 1 new topic(s) added to the map from gap-analysis.',
    '',
    'DISCOVERY MAP (2 topics · 1 ready · 1 fresh)',
    '  ├─ → Kitchen Hardware',
    '  │     Receipt printing, KDS handoff, and the',
    '  │     fastest-cumulative-time-tiebreak-resolution-policy-and-of',
    '  │     fline-sync token that cannot break',
    '  │     ↳ Research complete · ready for discussion',
    '  │',
    '  └─ ○ Menu Admin',
    '        Business-side menu modelling, admin shell (Filament vs',
    '        custom Vue/Nuxt), JustEat import, staff/roles',
    '        ↳ From exploration',
    '        ↳ Fresh · routed to discussion',
    '',
    '── DEFINITION ───────────────────────────────────────────────────',
    '',
    'SPECIFICATION (1 completed)',
    '  └─ Roles And Permissions    [completed]',
    '     ├─ Menu Admin            [incorporated]',
    '     └─ Auth Flow             [pending]',
    '',
    'PLANNING (1 completed)',
    '  └─ Roles And Permissions    [completed · tick]',
    '',
    '── DELIVERY ─────────────────────────────────────────────────────',
    '',
    'IMPLEMENTATION (1 in-progress)',
    '  └─ Roles And Permissions    [in-progress]',
    '     └─ Phase 2, 3 task(s) completed',
    '',
  ].join('\n');

  it('renders the map-branch dashboard byte-for-byte (callouts, stages, trees)', () => {
    const out = epicDashboard('quiz-competition-v1', mapDetail(), {
      newArrivals: { gap_analysis: ['menu-admin'] },
    });
    assert.strictEqual(out, EXPECTED_DASHBOARD);
  });

  it('keeps every body line within TREE_WIDTH and the │ gutter unbroken', () => {
    const out = epicDashboard('quiz-competition-v1', mapDetail(), {
      newArrivals: { gap_analysis: ['menu-admin'] },
    });
    const lines = out.split('\n');
    const start = lines.findIndex((l) => l.startsWith('  ├─ → Kitchen Hardware'));
    const end = lines.indexOf('        ↳ From exploration');
    assert.ok(start > 0 && end > start, 'map tree rows present');
    let underLast = false;
    for (const l of lines.slice(start, end + 1)) {
      const m = l.match(/^ {2}([├└])─ /);
      if (m) { underLast = m[1] === '└'; continue; }
      // body sub-line — within the budget, gutter intact
      assert.ok(l.length <= TREE_WIDTH, `body "${l}" (${l.length}) overruns ${TREE_WIDTH}`);
      if (underLast) {
        assert.ok(!l.includes('│'), `last topic must not carry the bar: "${l}"`);
      } else {
        assert.strictEqual(l[2], '│', `non-last sub-line must carry the bar: "${l}"`);
      }
    }
  });

  it('omits the callout block when no stage-meta applies', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { topic: { routing: 'research', source: 'discovery', order: 1 } } } },
    });
    assert.strictEqual(
      epicDashboard('v1', d),
      [
        '── DISCOVERY ────────────────────────────────────────────────────',
        '',
        'DISCOVERY MAP (1 topic · 1 fresh)',
        '  └─ ○ Topic',
        '        ↳ Fresh · routed to research',
        '',
      ].join('\n')
    );
  });

  it('a flagged completed item carries the input-moved cue on the dashboard, key, and menu', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { 'menu-admin': { routing: 'discussion', source: 'discovery', order: 1 } } },
        discussion: { items: { 'menu-admin': { status: 'completed' } } },
        specification: { items: { 'menu-admin': { status: 'completed', reconcile_needed: 'discussion', sources: { 'menu-admin': { status: 'stale' } } } } },
        planning: { items: { 'other-topic': { status: 'in-progress', reconcile_needed: 'specification' } } },
      },
    });
    const out = epicDashboard('v1', d);
    assert.match(out, /Menu Admin\s+\[completed · input moved\]/, out);
    const key = epicKey(d);
    assert.ok(key.includes('input moved             — an upstream artifact was revised'), key);
    const { keys } = epicMenu('v1', d);
    const start = keys.find((k) => k.action === 'start_planning');
    assert.ok(start, 'start_planning entry present');
    assert.strictEqual(start.label, 'Start planning for "Menu Admin" — *spec completed* · input moved');
    const cont = keys.find((k) => k.action === 'continue_planning');
    assert.ok(cont, 'continue_planning entry present');
    assert.strictEqual(cont.label, 'Continue "Other Topic" — *planning [in-progress]* · input moved');
  });

  it('a flagged decided discussion cues input moved on its map row and the key', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { fees: { routing: 'discussion', source: 'discovery', order: 1 } } },
        discussion: { items: { fees: { status: 'completed', reconcile_needed: 'research' } } },
      },
    });
    const out = epicDashboard('v1', d);
    assert.match(out, /✓ Fees\s+↳ Decided · input moved/, out);
    const key = epicKey(d);
    assert.ok(key.includes('input moved             — an upstream artifact was revised'), key);
  });

  it('the completed-topics picker carries the input-moved cue on flagged rows', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { fees: { status: 'completed' } } },
        specification: { items: { fees: { status: 'completed', reconcile_needed: 'discussion' } } },
      },
    });
    const sub = epicCompletedMenu('v1', d);
    assert.ok(sub.display.includes('Fees [completed · input moved]'), sub.display);
    const entry = sub.keys.find((k) => k.phase === 'specification');
    assert.strictEqual(entry.label, 'Resume "Fees" — *specification* · input moved');
    const clean = sub.keys.find((k) => k.phase === 'discussion');
    assert.strictEqual(clean.label, 'Resume "Fees" — *discussion*');
  });

  it('all-done-but-flagged: the reconcile route (resume completed) is the recommendation, not analyze/regroup', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { fees: { routing: 'discussion', source: 'discovery', order: 1 } } },
        discussion: { items: { fees: { status: 'completed' } } },
        specification: { items: { fees: { status: 'completed', sources: { fees: { status: 'incorporated' } } } } },
        planning: { items: { fees: { status: 'completed' } } },
        implementation: { items: { fees: { status: 'completed' } } },
        review: { items: { fees: { status: 'completed', reconcile_needed: 'implementation' } } },
      },
    });
    const { keys } = epicMenu('v1', d);
    const cOption = keys.find((k) => k.action === 'resume_completed');
    assert.ok(cOption, 'completed option present');
    assert.strictEqual(cOption.recommended, true, 'the reconcile route leads');
    const sOption = keys.find((k) => k.action === 'analyze_discussions');
    assert.notStrictEqual(sOption && sOption.recommended, true, 'analyze is not the recommendation');
  });

  it('an input-moved start entry is never the recommendation', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { fees: { routing: 'discussion', source: 'discovery', order: 1 } } },
        discussion: { items: { fees: { status: 'completed' } } },
        specification: { items: { fees: { status: 'completed', reconcile_needed: 'discussion', sources: { fees: { status: 'stale' } } } } },
      },
    });
    const { keys } = epicMenu('v1', d);
    const start = keys.find((k) => k.action === 'start_planning');
    assert.ok(start, 'start_planning entry present');
    assert.strictEqual(start.input_moved, true);
    assert.notStrictEqual(start.recommended, true, 'flagged-source start never recommended');
  });

  it('a triaged stub renders fresh with the triage waiting cue and counts as fresh', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { parked: { routing: 'research', source: 'reroute:origin-topic', order: 1 } } },
        research: { items: { parked: { status: 'triaged' } } },
      },
    });
    const out = epicDashboard('v1', d);
    assert.ok(out.includes('DISCOVERY MAP (1 topic · 1 fresh)'), out);
    assert.match(out, /  └─ ○ Parked\n[\s\S]*?↳ Fresh · routed to research · triage waiting/, out);
  });
});

describe('epic projections: dashboard (no-map and brand-new branches)', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('renders the no-map branch with a wrapped ⚑ recommendation', () => {
    const d = detailFor(dir, 'auth-overhaul', {
      work_type: 'epic',
      phases: {
        research: { items: { 'market-analysis': { status: 'in-progress' }, 'competitor-scan': { status: 'completed' } } },
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    assert.strictEqual(
      epicDashboard('auth-overhaul', d),
      [
        '── DISCOVERY ────────────────────────────────────────────────────',
        '',
        'RESEARCH (1 in-progress, 1 completed)',
        '  ├─ Market Analysis    [in-progress]',
        '  └─ Competitor Scan    [completed]',
        '',
        'DISCUSSION (1 completed)',
        '  └─ Auth Flow    [completed]',
        '',
        '  ⚑ Consider completing remaining research before starting',
        '    discussion. Topic analysis works best with all research',
        '    available.',
        '',
      ].join('\n')
    );
  });

  it('appends the plans-not-ready block after the stages', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        planning: { items: { billing: { status: 'completed', external_dependencies: { auth: { description: 'd', state: 'unresolved' } } } } },
      },
    });
    const out = epicDashboard('v1', d);
    assert.ok(out.endsWith([
      '⚑ Plans not ready for implementation:',
      '  These plans have unresolved dependencies that must be addressed',
      '  first.',
      '',
      '  Billing',
      '  └─ Blocked by auth',
      '',
    ].join('\n')));
  });

  it('renders the brand-new-epic branch with the discovery callout', () => {
    const d = detailFor(dir, 'fresh-epic', { work_type: 'epic' });
    assert.strictEqual(
      epicDashboard('fresh-epic', d),
      [
        'No work started yet.',
        '',
        '  ⚑ Run discovery to shape the topic map — research, experiments,',
        '    and discussion start from there.',
        '',
      ].join('\n')
    );
  });
});

describe('epic projections: key', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  const STATUS = [
    '  Status:',
    '    proposed    — analyzed grouping, not yet started',
    '    triaged     — rerouted concerns parked, topic not started',
    '    in-progress — work is ongoing',
    '    completed   — phase or implementation done',
    '    cancelled   — topic removed from active work',
    '    promoted    — moved to its own cross-cutting work unit',
  ].join('\n');
  const BLOCKING = [
    '  Blocking reason:',
    "    blocked by {plan}:{task} — depends on another plan's task",
    '    blocked by {plan}        — dependency unresolved',
  ].join('\n');

  it('map with no build items produces no key (the ↳ state lines carry the words)', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { topic: { routing: 'research', source: 'discovery', order: 1 } } } },
    });
    assert.strictEqual(epicKey(d), '');
  });

  it('map + build items + blocked plan shows the Status and Blocking categories', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { topic: { routing: 'research', source: 'discovery', order: 1 } } },
        planning: { items: { billing: { status: 'completed', external_dependencies: { auth: { description: 'd', state: 'unresolved' } } } } },
      },
    });
    assert.strictEqual(epicKey(d), 'Key:\n' + STATUS
      + '\n\n  Cue:\n    blocked (planning)      — implementation waits on another plan;\n                              the \u2691 list names the dependency,\n                              u/unblock is the override'
      + '\n\n' + BLOCKING);
  });

  it('no-map branch shows the Status block', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    assert.strictEqual(epicKey(d), 'Key:\n' + STATUS);
  });

  it('brand-new epic produces no key (section B is skipped on that branch)', () => {
    const d = detailFor(dir, 'fresh', { work_type: 'epic' });
    assert.strictEqual(epicKey(d), '');
  });
});

describe('epic projections: menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // Hand-built detail: a settled map plus a next_phase_ready set that includes
  // a gated-out start_planning and a blocked start_implementation. Mirrors the
  // discovery detail shape exactly; built by hand because a real manifest
  // can't hold a start_planning entry while its gate is closed.
  function settledDetail() {
    return {
      phases: {
        specification: [
          { name: 'auth-spec', status: 'in-progress' },
          { name: 'billing-grouping', status: 'proposed', sources: [{ topic: 'menu-admin', status: 'pending' }] },
        ],
        planning: [
          { name: 'reporting', status: 'completed', deps_satisfied: false, deps_blocking: [{ topic: 'core-features', internal_id: 'core-2-3', reason: 'task not yet completed' }] },
        ],
      },
      in_progress: [{ name: 'auth-spec', phase: 'specification' }],
      completed: [{ name: 'reporting', phase: 'planning' }],
      cancelled: [],
      next_phase_ready: [
        { name: 'billing-grouping', action: 'start_specification', label: 'grouping ready' },
        { name: 'user-profiles', action: 'start_planning', label: 'spec completed' },
        {
          name: 'reporting', action: 'start_implementation', label: 'plan completed',
          blocked: true, deps_blocking: [{ topic: 'core-features', internal_id: 'core-2-3', reason: 'task not yet completed' }],
        },
      ],
      unaccounted_discussions: ['payments', 'menu-admin'],
      reopened_discussions: [],
      discovery_map: [
        { name: 'menu-admin', summary_present: true, summary: 'x', description_present: true, routing: 'discussion', source: 'discovery', source_provenance: null, order: 1, lifecycle: 'decided', tier: '✓', current_phase: 'discussion', next_action: null },
      ],
      convergence_state: 'settled',
      needs_sequencing: false,
      map_summary: { total: 1, decided: 1, in_flight: 0, ready: 0, fresh: 0, handled: 0, cancelled: 0 },
      imports_count: 0,
      seeds_count: 0,
      analysis_caches: {
        gap_analysis: { status: 'absent', generated: null, files: [] },
      },
      gating: {
        can_start_specification: true,
        can_start_planning: false, // gates the user-profiles start_planning out
        can_start_implementation: true,
        can_start_review: true,
      },
    };
  }

  it('orders the recommendation first, filters gated starts, and carries no row for a blocked start', () => {
    const menu = epicMenu('quiz-competition-v1', settledDetail());
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ What would you like to do?`**',
      '',
      '**`1`**            → Start specification for "Billing Grouping" —',
      `${NB(15)}*grouping ready* (recommended)`,
      '**`2`**            → Continue "Auth Spec" — *specification [in-progress]*',
      '**`s/spec`**       → Analyze / regroup discussions — *2 discussion(s)*',
      `${NB(15)}*not yet grouped*`,
      '**`d/discuss`**    → Start a discussion on a new topic',
      '**`r/research`**   → Start research on a new topic',
      '**`x/experiment`** → Start experiments on a new topic',
      '**`i/discovery`**  → Continue discovery',
      '**`c/completed`**  → Resume a completed topic',
      '**`a/cancel`**     → Cancel a topic (phase work)',
      '**`u/unblock`**    → Unblock a plan — mark a dependency as satisfied',
      `${NB(15)}externally`,
      '**`o/order`**      → Re-sequence the build order',
    ].join('\n'));
  });

  it('keys carry actions, topics, and routes; a blocked start never surfaces', () => {
    const { keys } = epicMenu('quiz-competition-v1', settledDetail());
    assert.deepStrictEqual(
      keys.map((k) => [k.key, k.action, k.topic, k.route]),
      [
        ['1', 'start_specification', 'billing-grouping', '/workflow-specification-entry epic quiz-competition-v1 billing-grouping'],
        ['2', 'continue_specification', 'auth-spec', '/workflow-specification-entry epic quiz-competition-v1 auth-spec'],
        ['s', 'analyze_discussions', null, '/workflow-specification-entry epic quiz-competition-v1'],
        ['d', 'new_discussion', null, '/workflow-discussion-entry epic quiz-competition-v1'],
        ['r', 'new_research', null, '/workflow-research-entry epic quiz-competition-v1'],
        ['x', 'new_experiment', null, '/workflow-experiment-entry epic quiz-competition-v1'],
        ['i', 'continue_discovery', null, '/workflow-discovery epic quiz-competition-v1'],
        ['c', 'resume_completed', null, null],
        ['a', 'cancel_topic', null, null],
        ['u', 'unblock_plan', null, null],
        ['o', 'resequence_build_order', null, null],
      ]
    );
    assert.strictEqual(keys[0].recommended, true);
    // A dep-blocked implementation start carries no menu row — the ⚑ block
    // and the u/unblock option carry the state instead.
    assert.ok(!keys.some((k) => k.action === 'start_implementation'), 'blocked start never surfaces');
    assert.ok(!keys.some((k) => k.action === 'start_planning'), 'gated start_planning never surfaces');
  });

  it('in-progress map recommends the top discovery row; ✓/⊙/⊘ rows get no entry', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            ready: { routing: 'research', source: 'discovery', order: 1 },
            decided: { routing: 'discussion', source: 'discovery', order: 2 },
            'dead-lead': { routing: 'research', source: 'discovery', handled: true },
            dropped: { routing: 'research', source: 'discovery' },
          },
        },
        research: {
          items: {
            ready: { status: 'completed' },
            'dead-lead': { status: 'completed' },
            dropped: { status: 'cancelled' },
          },
        },
        discussion: {
          items: {
            decided: { status: 'completed' },
            dropped: { status: 'cancelled' },
          },
        },
      },
    });
    const { keys, rendered } = epicMenu('v1', d);
    const numbered = keys.filter((k) => /^\d+$/.test(k.key));
    assert.deepStrictEqual(
      numbered.map((k) => [k.key, k.action, k.topic]),
      [['1', 'start_discussion_after_research', 'ready']]
    );
    assert.strictEqual(numbered[0].recommended, true);
    assert.ok(/\*\*`1`\*\* +→ Start discussion for "Ready" — \*research completed\*\n\u00a0+\(recommended\)/.test(rendered));
    assert.ok(/\*\*`e\/reactivate`\*\* +→ Reactivate a cancelled topic/.test(rendered), 'cancelled items exist');
    assert.ok(!rendered.includes('Dead Lead'), 'handled row has no menu entry');
    assert.ok(!rendered.includes('Dropped'), 'cancelled row has no menu entry');
  });

  it('a decided row floating to the top of the map changes no menu numbering', () => {
    // Same actionable rows either side; the only difference is a decided topic
    // present on the map, which now sorts above them all.
    const actionable = {
      ready: { routing: 'research', source: 'discovery', order: 1 },
      inflight: { routing: 'research', source: 'discovery', order: 2 },
      fresh: { routing: 'discussion', source: 'discovery', order: 3 },
    };
    const research = { ready: { status: 'completed' }, inflight: { status: 'in-progress' } };

    const without = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { ...actionable } }, research: { items: { ...research } } },
    });
    const with_ = detailFor(dir, 'v2', {
      work_type: 'epic',
      phases: {
        discovery: { items: { ...actionable, settled: { routing: 'discussion', source: 'discovery', order: 4 } } },
        research: { items: { ...research } },
        discussion: { items: { settled: { status: 'completed' } } },
      },
    });

    assert.strictEqual(with_.discovery_map[0].name, 'settled', 'the decided row leads the map');
    assert.strictEqual(with_.discovery_map[0].tier, '✓');

    const numbered = (d, wu) => epicMenu(wu, d).keys
      .filter((k) => /^\d+$/.test(k.key))
      .map((k) => [k.key, k.action, k.topic]);
    assert.deepStrictEqual(numbered(with_, 'v2'), numbered(without, 'v1'));
    assert.deepStrictEqual(numbered(with_, 'v2'), [
      ['1', 'start_discussion_after_research', 'ready'],
      ['2', 'continue_research', 'inflight'],
      ['3', 'start_discussion', 'fresh'],
    ]);
  });

  it('superseded research renders as superseded in the discussion entry label, never as completed', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            handoff: { routing: 'research', source: 'discovery', order: 1 },
          },
        },
        research: { items: { handoff: { status: 'superseded', superseded_by: 'split-child' } } },
      },
    });
    const { keys, rendered } = epicMenu('v1', d);
    const entry = keys.find((k) => k.action === 'start_discussion_after_research');
    assert.ok(entry, 'superseded research with no discussion still offers the discussion path');
    assert.strictEqual(entry.label, 'Start discussion for "Handoff" — *research superseded*');
    assert.ok(!rendered.includes('research completed'), 'superseded research must not be named completed');
  });

  it('implementation continue label names the task in flight, not the completed count', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { roles: { status: 'completed' } } },
        specification: { items: { roles: { status: 'completed', sources: { roles: { status: 'incorporated' } } } } },
        planning: { items: { roles: { status: 'completed' } } },
        implementation: { items: { roles: { status: 'in-progress', current_phase: 2, current_task: 'r-2-2', completed_tasks: ['r-1-1', 'r-1-2', 'r-2-1'] } } },
      },
    });
    const { rendered } = epicMenu('v1', d);
    assert.ok(rendered.includes(`→ Continue "Roles" — *implementation (Phase 2, Task*\n${NB(15)}*r-2-2)*`), rendered);
    assert.ok(!rendered.includes('Task 3'), 'completed count must not masquerade as a task position');
  });

  it('implementation continue label falls back to the completed count when no task is in flight', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { roles: { status: 'completed' } } },
        specification: { items: { roles: { status: 'completed', sources: { roles: { status: 'incorporated' } } } } },
        planning: { items: { roles: { status: 'completed' } } },
        implementation: { items: { roles: { status: 'in-progress', current_phase: 2, current_task: null, completed_tasks: ['r-1-1', 'r-1-2', 'r-2-1'] } } },
      },
    });
    const { rendered } = epicMenu('v1', d);
    assert.ok(rendered.includes(`→ Continue "Roles" — *implementation (Phase 2, 3*\n${NB(15)}*task(s) completed)*`), rendered);
  });

  it('a triaged stub is offered as Start with the triage waiting suffix — never Continue', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { parked: { routing: 'research', source: 'reroute:origin-topic', order: 1 } } },
        research: { items: { parked: { status: 'triaged' } } },
      },
    });
    const { keys, rendered } = epicMenu('v1', d);
    const entry = keys.find((k) => k.topic === 'parked');
    assert.strictEqual(entry.action, 'start_research');
    assert.strictEqual(entry.label, 'Start research for "Parked" — *triage waiting*');
    assert.strictEqual(entry.route, '/workflow-research-entry epic v1 parked');
    assert.ok(!rendered.includes('Continue "Parked"'), 'a stub must never be offered as a resume');
  });

  it('a discussion-routed stub gets the same Start suffix — the symmetric branch', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { parked: { routing: 'discussion', source: 'reroute:origin-topic', order: 1 } } },
        discussion: { items: { parked: { status: 'triaged' } } },
      },
    });
    const { keys } = epicMenu('v1', d);
    const entry = keys.find((k) => k.topic === 'parked');
    assert.strictEqual(entry.action, 'start_discussion');
    assert.strictEqual(entry.label, 'Start discussion for "Parked" — *triage waiting*');
  });

  it('an open discovery session leads the menu as resume, regardless of map state', () => {
    const d = detailFor(dir, 'resumable', { work_type: 'epic' });
    d.active_session = '001';
    const { keys, rendered } = epicMenu('resumable', d);
    assert.strictEqual(keys[0].key, 'i');
    assert.ok(/\*\*`i\/discovery`\*\* +→ Resume the in-progress discovery session\n\u00a0+\(session-001\) \(recommended\)/.test(rendered));
  });

  it('brand-new epic menu leads with recommended discovery', () => {
    const d = detailFor(dir, 'fresh', { work_type: 'epic' });
    const { keys, rendered } = epicMenu('fresh', d);
    assert.deepStrictEqual(keys.map((k) => k.key), ['i', 'd', 'r', 'x']);
    assert.strictEqual(rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ What would you like to do?`**',
      '',
      '**`i/discovery`**  → Run discovery — shape the topic map (recommended)',
      '**`d/discuss`**    → Start new discussion',
      '**`r/research`**   → Start new research',
      '**`x/experiment`** → Start new experiments',
    ].join('\n'));
  });
});

describe('epic projections: presence join', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function twoTopicDetail() {
    return detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'topic-a': { routing: 'discussion', source: 'discovery', order: 1 },
            'topic-b': { routing: 'discussion', source: 'discovery', order: 2 },
          },
        },
        discussion: { items: { 'topic-a': { status: 'in-progress' } } },
      },
    });
  }

  const heldRow = { phase: 'discussion', topic: 'topic-a', age_seconds: 120, held: true, live: true, session_id: 's1' };

  it('a held topic keeps its position struck through; the recommendation skips to the next row in place', () => {
    const { keys, rendered } = epicMenu('v1', twoTopicDetail(), { presence: [heldRow] });
    const numbered = keys.filter((k) => /^\d+$/.test(k.key));
    assert.deepStrictEqual(
      numbered.map((k) => [k.key, k.action, k.topic, k.in_session === true, k.recommended === true]),
      [
        ['1', 'continue_discussion', 'topic-a', true, false],
        ['2', 'start_discussion', 'topic-b', false, true],
      ]
    );
    assert.strictEqual(numbered[0].session_age, 120);
    assert.ok(/\*\*`1`\*\* +→ ~~Continue "Topic A" — \*discussion\*~~ · in session \(last\n\u00a0+active 2m ago\)/.test(rendered), rendered);
    assert.ok(/\*\*`2`\*\* +→ Start discussion for "Topic B" \(recommended\)/.test(rendered), rendered);
  });

  it('without presence the same detail recommends the held topic as before', () => {
    const { keys } = epicMenu('v1', twoTopicDetail());
    const numbered = keys.filter((k) => /^\d+$/.test(k.key));
    assert.deepStrictEqual(
      numbered.map((k) => [k.key, k.action, k.topic, k.recommended === true]),
      [
        ['1', 'continue_discussion', 'topic-a', true],
        ['2', 'start_discussion', 'topic-b', false],
      ]
    );
  });

  it('an unheld or phase-mismatched presence row marks nothing', () => {
    const stale = { ...heldRow, held: false, live: false };
    const wrongPhase = { phase: 'research', topic: 'topic-a', age_seconds: 10, held: true, live: true, session_id: 's2' };
    const { keys } = epicMenu('v1', twoTopicDetail(), { presence: [stale, wrongPhase] });
    assert.ok(!keys.some((k) => k.in_session), 'no entry marked');
    assert.strictEqual(keys.find((k) => k.topic === 'topic-a').recommended, true);
  });

  it('renders the in-session confirm gate as a labelled MENU section, byte-for-byte', () => {
    const { keys } = epicMenu('v1', twoTopicDetail(), { presence: [heldRow] });
    const marked = keys.find((k) => k.in_session);
    assert.strictEqual(epicInSessionGate('v1', marked), [
      '=== MENU: in-session gate — 1 (emit verbatim as markdown, then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '"Topic A" is open in another session — last active 2m ago. Proceeding starts a second concurrent session on the same discussion; its work could conflict with that session\'s. Only proceed if you know that session is no longer working; if it is wedged but alive, release its hold with `node .claude/skills/workflow-engine/scripts/engine.cjs presence clear v1 discussion topic-a`.',
      '',
      '**`◆ Proceed anyway?`**',
      '',
      '**`b/back`**    → Return to menu (recommended)',
      '**`p/proceed`** → Proceed anyway',
      '',
    ].join('\n'));
  });

  // A plan ready to implement — the state a code entry needs on the menu.
  function readyToImplementDetail() {
    return detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { 'topic-a': { routing: 'discussion', source: 'discovery', order: 1 } } },
        discussion: { items: { 'topic-a': { status: 'completed' } } },
        specification: { items: { 'topic-a': { status: 'completed', order: 1, sources: { 'topic-a': { status: 'incorporated' } } } } },
        planning: { items: { 'topic-a': { status: 'completed', format: 'local-markdown' } } },
      },
    });
  }

  it('a held code row anywhere in the project marks every code entry, naming the holder', () => {
    const d = readyToImplementDetail();
    // A code session holding a different work unit's topic — one slot, one
    // checkout.
    const codeRow = { work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow', age_seconds: 300, held: true, live: true, session_id: 'peer' };
    const { keys, rendered } = epicMenu('v1', d, { presence: [], codeHeld: [codeRow] });
    const code = keys.find((k) => k.action === 'start_implementation');
    assert.ok(code, 'the implementation entry is on the menu');
    assert.strictEqual(code.in_session, true, 'the code entry is marked though the holder is elsewhere');
    assert.deepStrictEqual(code.session_holder, { work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow' });
    assert.match(rendered.replace(/\n\u00a0+/g, ' '), /~~[^~]*~~ · code session in ship\/checkout-flow \(last active 5m ago\)/,
      `the struck row names the holder:\n${rendered}`);
    assert.ok(!code.recommended, 'a struck row is never the recommendation');
    assert.strictEqual(code.code_session, true, 'the marker says the slot, so this menu never gates it');
    assert.ok(!keys.some((k) => k.action !== 'start_implementation' && k.in_session),
      'doc entries are untouched by the code slot');
  });

  it('a code entry is marked by its own held topic too, and still carries the slot marker', () => {
    const d = readyToImplementDetail();
    const ownRow = { phase: 'implementation', topic: 'topic-a', age_seconds: 30, held: true, live: true, session_id: 'peer' };
    const { keys, rendered } = epicMenu('v1', d, { presence: [ownRow], codeHeld: [] });
    const code = keys.find((k) => k.action === 'start_implementation');
    assert.strictEqual(code.in_session, true);
    assert.strictEqual(code.code_session, true, 'own-topic or elsewhere, a code hold is the one slot');
    // The word names what holds the row, and it is the slot either way. Only
    // the holder's address is conditional — a hold on this very topic needs
    // none.
    assert.match(rendered.replace(/\n +/g, ' '), /~~[^~]*~~ · code session \(last active 30s ago\)/,
      `the struck row says code session without an address:\n${rendered}`);
  });

  it('a no-map epic never recommends a row the code slot has struck through', () => {
    // The map branch has skipped held rows since the gate family landed; the
    // no-map branch picks by phase-completion state and had no such guard, so
    // it recommended the very entry it drew struck.
    const d = detailFor(dir, 'v2', {
      work_type: 'epic',
      phases: {
        discussion: { items: { 'topic-a': { status: 'completed' } } },
        specification: { items: { 'topic-a': { status: 'completed', sources: { 'topic-a': { status: 'incorporated' } } } } },
        planning: { items: { 'topic-a': { status: 'completed', format: 'local-markdown' } } },
      },
    });
    const codeRow = { work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow', age_seconds: 300, held: true, live: true, session_id: 'peer' };

    const free = epicMenu('v2', d, { presence: [], codeHeld: [] });
    assert.strictEqual(free.keys.find((k) => k.action === 'start_implementation').recommended, true,
      'with the slot free it is the obvious next move');

    const { keys } = epicMenu('v2', d, { presence: [], codeHeld: [codeRow] });
    const code = keys.find((k) => k.action === 'start_implementation');
    assert.strictEqual(code.in_session, true, 'the slot is held elsewhere');
    assert.ok(!code.recommended, 'so the menu does not point at it');
  });

  it('the in-session gate speaks for document phases alone — a code entry never reaches it', () => {
    const d = twoTopicDetail();
    const { keys } = epicMenu('v1', d, { presence: [heldRow] });
    const gate = epicInSessionGate('v1', keys.find((k) => k.in_session));
    assert.match(gate, /second concurrent session on the same discussion/, 'the doc consequence is the only one left');
    assert.doesNotMatch(gate, /Code phases run one at a time/, 'the code wording belongs to the code-gate surface');
  });

  it('the dashboard cues held map rows on their ↳ state lines (no key legend needed)', () => {
    const d = twoTopicDetail();
    const out = epicDashboard('v1', d, { presence: [heldRow] });
    assert.match(out, /◐ Topic A\n\s*│\s*↳ Discussing · in session/, out);
    assert.doesNotMatch(out, /↳ Fresh · routed to discussion · in session/, out);
    assert.strictEqual(epicKey(d), '', 'the ↳ state line carries the words — no session legend');
  });
});

describe('epic projections: selection sub-views', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // Two topics per one phase, one topic in others, a cancelled item with a
  // stashed previous_status, and a promoted item — exercises the grouping,
  // continuous numbering, and status-filter rules together.
  function richDetail() {
    return detailFor(dir, 'quiz-competition-v1', {
      work_type: 'epic',
      phases: {
        research: { items: { 'kitchen-hardware': { status: 'completed' }, 'menu-admin': { status: 'in-progress' } } },
        discussion: { items: { 'auth-flow': { status: 'completed' }, 'session-storage': { status: 'completed' }, 'stale-topic': { status: 'cancelled', previous_status: 'in-progress' } } },
        specification: { items: { 'roles-and-permissions': { status: 'completed' }, billing: { status: 'promoted' } } },
        implementation: { items: { 'roles-and-permissions': { status: 'in-progress' } } },
      },
    });
  }

  it('completed-menu: numbered tree rows grouped by phase, routes per entry', () => {
    const view = epicCompletedMenu('quiz-competition-v1', richDetail());
    assert.strictEqual(view.title, 'Completed Topics');
    assert.strictEqual(view.display, [
      'Research',
      '  └─ 1. Kitchen Hardware [completed]',
      '',
      'Discussion',
      '  ├─ 2. Auth Flow [completed]',
      '  └─ 3. Session Storage [completed]',
      '',
      'Specification',
      '  └─ 4. Roles And Permissions [completed]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to resume?`**',
      '',
      '**`1`**      → Resume "Kitchen Hardware" — *research*',
      '**`2`**      → Resume "Auth Flow" — *discussion*',
      '**`3`**      → Resume "Session Storage" — *discussion*',
      '**`4`**      → Resume "Roles And Permissions" — *specification*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'resume', 'kitchen-hardware', 'research', '/workflow-research-entry epic quiz-competition-v1 kitchen-hardware'],
        ['2', 'resume', 'auth-flow', 'discussion', '/workflow-discussion-entry epic quiz-competition-v1 auth-flow'],
        ['3', 'resume', 'session-storage', 'discussion', '/workflow-discussion-entry epic quiz-competition-v1 session-storage'],
        ['4', 'resume', 'roles-and-permissions', 'specification', '/workflow-specification-entry epic quiz-competition-v1 roles-and-permissions'],
        ['b', 'back', null, null, null],
      ]
    );
  });

  it('cancel-menu: numbered rows, continuous across phases, cancelled/promoted excluded', () => {
    const view = epicCancelMenu(richDetail());
    assert.strictEqual(view.title, 'Cancellable Topics');
    assert.strictEqual(view.display, [
      'Research',
      '  ├─ 1. Kitchen Hardware [completed]',
      '  └─ 2. Menu Admin [in-progress]',
      '',
      'Discussion',
      '  ├─ 3. Auth Flow [completed]',
      '  └─ 4. Session Storage [completed]',
      '',
      'Specification',
      '  └─ 5. Roles And Permissions [completed]',
      '',
      'Implementation',
      '  └─ 6. Roles And Permissions [in-progress]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to cancel?`**',
      '',
      '**`1`**      → Cancel "Kitchen Hardware" — *research [completed]*',
      '**`2`**      → Cancel "Menu Admin" — *research [in-progress]*',
      '**`3`**      → Cancel "Auth Flow" — *discussion [completed]*',
      '**`4`**      → Cancel "Session Storage" — *discussion [completed]*',
      '**`5`**      → Cancel "Roles And Permissions" — *specification*',
      `${NB(9)}*[completed]*`,
      '**`6`**      → Cancel "Roles And Permissions" — *implementation*',
      `${NB(9)}*[in-progress]*`,
      '**`b/back`** → Return to menu',
    ].join('\n'));
    // No routes — the flow continues to its confirmation gate.
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'cancel', 'kitchen-hardware', 'research', null],
        ['2', 'cancel', 'menu-admin', 'research', null],
        ['3', 'cancel', 'auth-flow', 'discussion', null],
        ['4', 'cancel', 'session-storage', 'discussion', null],
        ['5', 'cancel', 'roles-and-permissions', 'specification', null],
        ['6', 'cancel', 'roles-and-permissions', 'implementation', null],
        ['b', 'back', null, null, null],
      ]
    );
  });

  it('cancel-menu: a triaged stub stays cancellable with the informative [triaged] tag', () => {
    const view = epicCancelMenu(detailFor(dir, 'quiz-competition-v1', {
      work_type: 'epic',
      phases: {
        research: { items: { 'parked-topic': { status: 'triaged' }, 'menu-admin': { status: 'in-progress' } } },
      },
    }));
    assert.ok(view.display.includes('  ├─ 1. Parked Topic [triaged]'), view.display);
    assert.ok(view.display.includes('  └─ 2. Menu Admin [in-progress]'), view.display);
    assert.ok(/\*\*`1`\*\* +→ Cancel "Parked Topic" — \*research \[triaged\]\*/.test(view.rendered), view.rendered);
  });

  it('unblock-menu: one row per blocking dependency, dep carried on the key', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        planning: {
          items: {
            reporting: {
              status: 'completed',
              external_dependencies: {
                'core-features': { description: 'd', state: 'resolved', internal_id: 'core-2-3' },
                'auth': { description: 'd', state: 'unresolved' },
              },
            },
            clean: { status: 'completed' },
          },
        },
      },
    });
    const view = epicUnblockMenu(d);
    assert.strictEqual(view.title, 'Blocked Plans');
    assert.strictEqual(view.display, [
      'Planning',
      '  ├─ 1. Reporting — blocked by core-features:core-2-3 (task',
      '        not yet completed)',
      '  └─ 2. Reporting — blocked by auth (dependency unresolved)',
      '',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.dep ?? null]),
      [
        ['1', 'unblock', 'reporting', 'core-features'],
        ['2', 'unblock', 'reporting', 'auth'],
        ['b', 'back', null, null],
      ]
    );
    assert.ok(/Which dependency has been satisfied\?/.test(view.rendered), view.rendered);
  });

  it('a dep-blocked planning row carries the blocked cue; a clean one does not; a cancelled one never does', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { blocked: { status: 'completed' }, clean: { status: 'completed' } } },
        planning: {
          items: {
            blocked: { status: 'completed', external_dependencies: { upstream: { description: 'd', state: 'unresolved' } } },
            clean: { status: 'completed' },
            dead: { status: 'cancelled', previous_status: 'completed', external_dependencies: { upstream: { description: 'd', state: 'unresolved' } } },
          },
        },
      },
    });
    const out = epicDashboard('v1', d);
    assert.match(out, /Blocked    \[completed · blocked\]/);
    assert.match(out, /Clean      \[completed\]/);
    assert.match(out, /Dead       \[cancelled\]/);
    // The terminal item carries no deps at all — no ⚑ row, no unblock offer.
    assert.ok(!out.includes('Dead\n  └─ Blocked'), out);
    const menu = epicMenu('v1', d);
    const unblock = menu.keys.find((k) => k.action === 'unblock_plan');
    assert.ok(unblock, 'unblock option present for the live blocked plan');
    const { epicUnblockMenu: unblockMenu } = require('../../skills/workflow-engine/scripts/domain/projections/epic.cjs');
    const rows = unblockMenu(d).keys.filter((k) => k.action === 'unblock');
    assert.deepStrictEqual(rows.map((r) => r.topic), ['blocked'], 'the cancelled plan takes no row');
  });

  it('two different blocked plans list in build order', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: { items: {
          zeta: { status: 'completed', order: 1 }, alpha: { status: 'completed', order: 2 },
        } },
        planning: {
          items: {
            alpha: { status: 'completed', external_dependencies: { up: { description: 'd', state: 'unresolved' } } },
            zeta: { status: 'completed', external_dependencies: { up: { description: 'd', state: 'unresolved' } } },
          },
        },
      },
    });
    const { epicUnblockMenu: unblockMenu } = require('../../skills/workflow-engine/scripts/domain/projections/epic.cjs');
    const rows = unblockMenu(d).keys.filter((k) => k.action === 'unblock');
    assert.deepStrictEqual(rows.map((r) => r.topic), ['zeta', 'alpha']);
  });

  it('o/order withdraws when no live spec topic exists', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: { items: { gone: { status: 'cancelled', previous_status: 'in-progress' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const { keys } = epicMenu('v1', d);
    assert.ok(!keys.some((k) => k.action === 'resequence_build_order'), 'no live spec — no re-sequence');
  });

  it('both blocked kinds render two qualified legend lines', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { src: { status: 'in-progress' } } },
        specification: { items: { spec: { status: 'completed', sources: { src: { status: 'stale' } } } } },
        planning: { items: { spec: { status: 'completed', external_dependencies: { up: { description: 'd', state: 'unresolved' } } } } },
      },
    });
    const key = epicKey(d);
    assert.ok(key.includes('blocked (specification) —'), key);
    assert.ok(key.includes('blocked (planning)      —'), key);
  });

  it('unblock-menu: empty state when no plan is blocked', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { planning: { items: { clean: { status: 'completed' } } } },
    });
    const view = epicUnblockMenu(d);
    assert.strictEqual(view.display, 'No blocked plans.\n');
  });

  it('reactivate-menu: numbered rows with (was: previous_status)', () => {
    const view = epicReactivateMenu(richDetail());
    assert.strictEqual(view.title, 'Cancelled Topics');
    assert.strictEqual(view.display, [
      'Discussion',
      '  └─ 1. Stale Topic [cancelled] (was: in-progress)',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to reactivate?`**',
      '',
      '**`1`**      → Reactivate "Stale Topic" — *discussion (was: in-progress)*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'reactivate', 'stale-topic', 'discussion', null],
        ['b', 'back', null, null, null],
      ]
    );
  });

  it('reactivate-menu: a missing previous_status renders as unknown', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { items: { dropped: { status: 'cancelled' } } } },
    });
    const view = epicReactivateMenu(d);
    assert.strictEqual(view.display, [
      'Research',
      '  └─ 1. Dropped [cancelled] (was: unknown)',
      '',
    ].join('\n'));
  });

  it('empty sub-view: the empty-state line stands in for the list, menu offers only back', () => {
    const d = detailFor(dir, 'fresh', { work_type: 'epic' });
    const view = epicCompletedMenu('fresh', d);
    assert.strictEqual(view.title, 'Completed Topics');
    assert.strictEqual(view.display, 'No completed topics.\n');
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to resume?`**',
      '',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(view.keys.map((k) => k.key), ['b']);
  });

  it('adapter emits the DATA keys table plus TITLE, DISPLAY and MENU for a sub-view verb', () => {
    createManifest(dir, 'quiz-competition-v1', {
      work_type: 'epic',
      phases: {
        research: { items: { 'kitchen-hardware': { status: 'completed' } } },
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    const out = execFileSync('node', [ADAPTER, 'completed-menu', 'quiz-competition-v1'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out, [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'work_unit: quiz-competition-v1',
      'ACTIONS (key  action  topic  phase  → route):',
      '  1  resume  kitchen-hardware  research  → /workflow-research-entry epic quiz-competition-v1 kitchen-hardware',
      '  2  resume  auth-flow  discussion  → /workflow-discussion-entry epic quiz-competition-v1 auth-flow',
      '  b  back  —  —  → (internal)',
      '',
      '=== TITLE (emit verbatim as markdown — the view\'s chrome heading) ===',
      '# **`■ Completed Topics`**',
      '',
      '=== DISPLAY (emit verbatim as a code block) ===',
      'Research',
      '  └─ 1. Kitchen Hardware [completed]',
      '',
      'Discussion',
      '  └─ 2. Auth Flow [completed]',
      '',
      '=== MENU (emit verbatim as markdown) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to resume?`**',
      '',
      '**`1`**      → Resume "Kitchen Hardware" — *research*',
      '**`2`**      → Resume "Auth Flow" — *discussion*',
      '**`b/back`** → Return to menu',
      '',
    ].join('\n'));
  });
});

describe('epic projections: experiment phase', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function labDetail() {
    return detailFor(dir, 'lab', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            timing: { routing: 'experiment', source: 'discovery', order: 1, summary: 'Timing behaviour' },
            probe: { routing: 'experiment', source: 'discovery', order: 2, summary: 'Probe accuracy' },
            policy: { routing: 'discussion', source: 'discovery', order: 3, summary: 'Policy call' },
            spark: { routing: 'experiment', source: 'discovery', order: 4, summary: 'Spark idea' },
          },
        },
        experiment: {
          items: {
            timing: { status: 'in-progress', experiments: { E1: { slug: 'window-placement', status: 'running' } } },
            probe: { status: 'completed', experiments: { E1: { slug: 'sensor-drift', status: 'concluded', verdict: 'adopt' } } },
            policy: { status: 'in-progress', experiments: { E1: { slug: 'ab-check', status: 'running' } } },
          },
        },
        discussion: { items: { policy: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      },
    });
  }

  it('map rows carry the experiment lifecycles and the awaiting cue', () => {
    const out = epicDashboard('lab', labDetail());
    assert.ok(out.includes('DISCOVERY MAP (4 topics'), out);
    assert.match(out, /→ Probe\n[\s\S]*?↳ Evidence ready · ready for discussion/, out);
    assert.match(out, /◐ Timing\n[\s\S]*?↳ Experimenting/, out);
    assert.match(out, /◐ Policy\n[\s\S]*?↳ Discussing · awaiting E1/, out);
    assert.match(out, /○ Spark\n[\s\S]*?↳ Fresh · routed to experiment/, out);
  });

  it('menu entries route the experiment actions with their own labels; evidence-ready leads', () => {
    const { keys } = epicMenu('lab', labDetail());
    const byAction = (a) => keys.find((k) => k.action === a);
    const probe = byAction('start_discussion_after_experiment');
    assert.strictEqual(probe.topic, 'probe');
    assert.strictEqual(probe.label, 'Start discussion for "Probe" — *evidence ready*');
    assert.strictEqual(probe.route, '/workflow-discussion-entry epic lab probe');
    assert.strictEqual(probe.recommended, true, 'the actionable map top is the recommendation');
    const timing = byAction('continue_experiment');
    assert.strictEqual(timing.label, 'Continue "Timing" — *experiment*');
    assert.strictEqual(timing.route, '/workflow-experiment-entry epic lab timing');
    const spark = byAction('start_experiment');
    assert.strictEqual(spark.label, 'Start experiments for "Spark"');
    assert.strictEqual(spark.route, '/workflow-experiment-entry epic lab spark');
  });

  it('a flagged experiment item cues input moved on its map row — the reconcile rider generalises', () => {
    const d = detailFor(dir, 'flg', {
      work_type: 'epic',
      phases: {
        discovery: { items: { probe: { routing: 'experiment', source: 'discovery', order: 1 } } },
        experiment: { items: { probe: { status: 'completed', reconcile_needed: 'research' } } },
      },
    });
    assert.match(epicDashboard('flg', d), /→ Probe\n[\s\S]*?↳ Evidence ready · ready for discussion · input moved/);
  });

  it('no-map: the waiting discussion tags its row, the key earns the awaiting legend, the experiment block renders', () => {
    const d = detailFor(dir, 'nm', {
      work_type: 'epic',
      phases: {
        experiment: { items: { metrics: { status: 'in-progress' } } },
        discussion: { items: { metrics: { status: 'in-progress', awaiting_experiments: ['E1', 'E2'] } } },
      },
    });
    const out = epicDashboard('nm', d);
    assert.match(out, /EXPERIMENT \(1 in-progress\)/, out);
    assert.match(out, /Metrics\s+\[in-progress · awaiting E1, E2\]/, out);
    const key = epicKey(d);
    assert.ok(key.includes('awaiting E{n}'), key);
    // With a map the cue's words live on the row's ↳ state line — no legend.
    assert.ok(!epicKey(labDetail()).includes('awaiting E{n}'));
  });
});
