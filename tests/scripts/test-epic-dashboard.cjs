'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  renderEpicDashboard,
  lifecycleLabel,
  statusSuffix,
  countSummary,
  sourceRow,
  implProgress,
} = require('../../skills/workflow-continue-epic/scripts/epic-dashboard.cjs');

// A realistic discover() epic entry (the shape buildEpicDetail produces).
const EPIC = {
  name: 'quiz-competition-v1',
  detail: {
    discovery_map: [
      { name: 'game-and-content-engine', tier: '◐', lifecycle: 'researching', routing: null,
        summary: 'Quiz content pipeline, AI-assisted question generation, media handling, difficulty calibration across rounds',
        source_provenance: 'from exploration' },
      { name: 'synchronous-round-engine', tier: '→', lifecycle: 'ready_for_discussion', routing: null,
        summary: 'Real-time round orchestration, fastest-cumulative-time scoring, reconnection handling',
        source_provenance: 'from research-analysis' },
      { name: 'leaderboards', tier: '○', lifecycle: 'fresh', routing: 'research',
        summary: 'Per-competition and global ranking surfaces', source_provenance: null },
    ],
    map_summary: { total: 3, decided: 0, in_flight: 1, ready: 1, fresh: 1, handled: 0, cancelled: 0 },
    convergence_state: 'in-progress',
    phases: {
      specification: [
        { name: 'user-authentication', status: 'completed',
          sources: [{ topic: 'auth-flows', status: 'incorporated' }, { topic: 'session-management', status: 'pending' }] },
        { name: 'admin-panel', status: 'completed' },
      ],
      implementation: [
        { name: 'core-gameplay', status: 'in-progress', current_phase: 2, completed_tasks: ['t1', 't2', 't3', 't4'] },
        { name: 'reporting', status: 'completed', completed_tasks: ['a', 'b', 'c', 'd', 'e', 'f'] },
      ],
    },
  },
};

describe('epic-dashboard: composition helpers', () => {
  it('lifecycleLabel maps each lifecycle (routing only on fresh)', () => {
    assert.strictEqual(lifecycleLabel('ready_for_discussion'), 'research complete · ready for discussion');
    assert.strictEqual(lifecycleLabel('researching'), 'researching');
    assert.strictEqual(lifecycleLabel('decided'), 'decided');
    assert.strictEqual(lifecycleLabel('handled'), 'handled · research fanned out');
    assert.strictEqual(lifecycleLabel('fresh', 'research'), 'fresh · routed to research');
    assert.strictEqual(lifecycleLabel('fresh', null), 'fresh');
  });

  it('statusSuffix builds the count tail, omitting zeros / collapsing when settled', () => {
    assert.strictEqual(statusSuffix(EPIC.detail), ' · 1 in flight · 1 ready · 1 fresh');
    assert.strictEqual(statusSuffix({ convergence_state: 'settled' }), ' · all decided');
  });

  it('countSummary omits zero counts, completed first', () => {
    assert.strictEqual(countSummary(EPIC.detail.phases.specification), '(2 completed)');
    assert.strictEqual(countSummary(EPIC.detail.phases.implementation), '(1 completed, 1 in-progress)');
  });

  it('sourceRow and implProgress compose the sub-rows', () => {
    assert.strictEqual(sourceRow({ topic: 'auth-flows', status: 'incorporated' }), '← Auth Flows [incorporated]');
    assert.strictEqual(implProgress({ current_phase: 2, completed_tasks: ['a', 'b'] }), 'Phase 2, 2 task(s) completed');
    assert.strictEqual(implProgress({ completed_tasks: ['a', 'b', 'c'] }), '3 task(s) completed');
    assert.strictEqual(implProgress({ completed_tasks: [] }), null);
  });
});

describe('epic-dashboard: full render', () => {
  const out = renderEpicDashboard(EPIC, { width: 72 });

  it('renders the box title (titlecased)', () => {
    assert.ok(out.includes('  Quiz Competition V1'));
  });

  it('renders the three stage dividers at 49 chars', () => {
    for (const stage of ['DISCOVERY', 'DEFINITION', 'DELIVERY']) {
      const line = out.split('\n').find((l) => l.startsWith(`── ${stage} `));
      assert.ok(line, `${stage} divider present`);
      assert.strictEqual([...line].length, 49, `${stage} divider is 49 wide`);
    }
  });

  it('renders the discovery header with status suffix and topic rows', () => {
    assert.ok(out.includes('  RESEARCH & DISCUSSION (3 topics · 1 in flight · 1 ready · 1 fresh)'));
    assert.ok(out.includes('  ├─ ◐ Game And Content Engine [researching]'));
    assert.ok(out.includes('  └─ ○ Leaderboards [fresh · routed to research]'));
    assert.ok(out.includes('     ↳ From research-analysis') || out.includes('↳ From research-analysis'));
  });

  it('renders build phases with sub-headers, source rows and progress rows', () => {
    assert.ok(out.includes('  SPECIFICATION (2 completed)'));
    assert.ok(out.includes('  │  ├─ ← Auth Flows [incorporated]'));
    assert.ok(out.includes('  IMPLEMENTATION (1 completed, 1 in-progress)'));
    assert.ok(out.includes('  │  └─ Phase 2, 4 task(s) completed'));
  });

  it('never emits ┌─', () => {
    assert.ok(!out.includes('┌─'));
  });
});
