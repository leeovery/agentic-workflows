'use strict';

// Roadmap projections — the pure gateway views over derived roadmap state
// (projections/roadmap.cjs): the pull working set and the harvest proposal
// overlay. The map view and gates are covered through their render surfaces
// (test-engine-render-surfaces.cjs).

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  roadmapMapView,
  roadmapProposalView,
  roadmapPullSetView,
} = require('../../skills/workflow-engine/scripts/domain/projections/roadmap.cjs');

/** A derived-state fixture — the shape roadmapState returns. */
function state(items, horizons = ['mvp', 'v1']) {
  const totals = { items: items.length, waiting: 0, in_flight: 0, shipped: 0, orphaned: 0 };
  for (const i of items) {
    if (i.state === 'waiting') totals.waiting++;
    else if (i.state === 'in-flight') totals.in_flight++;
    else if (i.state === 'shipped') totals.shipped++;
    else totals.orphaned++;
  }
  return {
    exists: true, horizons, items, totals,
    active_session: null, session_logs: [], next_session_number: 1, imports: [],
  };
}

const ROWS = [
  { name: 'ordering', horizon: 'mvp', summary: 'customers order', origin: 'harvest', sources: [], state: 'in-flight', work_unit: 'mvp' },
  { name: 'menus', horizon: 'mvp', summary: 'operators maintain', origin: 'harvest', sources: [], state: 'waiting' },
  { name: 'kds', horizon: 'mvp', summary: 'orders reach the kitchen', origin: 'harvest', sources: [], state: 'waiting' },
  { name: 'loyalty', horizon: 'v1', summary: 'rewards', origin: 'park:mvp', sources: [], state: 'waiting' },
];

describe('roadmap projections: pull working set', () => {
  it('numbers waiting items horizon-major, with the DATA table resolving them', () => {
    const view = roadmapPullSetView(state(ROWS));
    assert.deepStrictEqual(view.rows, [
      { n: 1, name: 'menus', horizon: 'mvp' },
      { n: 2, name: 'kds', horizon: 'mvp' },
      { n: 3, name: 'loyalty', horizon: 'v1' },
    ]);
    assert.match(view.data, /waiting_count: 3/);
    assert.match(view.data, /  2  kds  mvp/);
    assert.match(view.display, /Mvp\n  ├─ 1\. Menus — operators maintain\n  └─ 2\. Kds — orders reach the kitchen/);
    assert.match(view.display, /V1\n  └─ 3\. Loyalty — rewards/);
    assert.ok(!view.display.includes('Ordering'), 'joined items never offer themselves for a pull');
    assert.match(view.menu, /`1–3`/);
    assert.match(view.menu, /`b\/back`/);
  });

  it('a single waiting item takes the bare `1` option; none refuses', () => {
    const one = roadmapPullSetView(state([ROWS[1]]));
    assert.match(one.menu, /`1`/);
    assert.ok(!one.menu.includes('1–'));
    assert.throws(() => roadmapPullSetView(state([ROWS[0]])), /no waiting items/);
  });
});

describe('roadmap projections: harvest proposal', () => {
  it('groups proposed items by horizon — JIT horizons after the existing list — with the map below', () => {
    const out = roadmapProposalView(state(ROWS), [
      { name: 'gift-cards', horizon: 'v1', summary: 'stored value' },
      { name: 'white-label', horizon: 'someday', summary: 'resell the platform' },
    ]);
    assert.match(out, /^Proposed Roadmap\n/);
    assert.match(out, /New this session \(2\)/);
    const v1 = out.indexOf('V1\n', out.indexOf('New this session'));
    const someday = out.indexOf('Someday\n');
    assert.ok(v1 !== -1 && someday !== -1 && v1 < someday, 'existing horizons order first, JIT ones after');
    assert.match(out, /Already on the roadmap \(4\)/);
    assert.match(out, /placement\s+is\s+my\s+read/);
  });

  it('a first harvest (empty roadmap) renders proposed items alone', () => {
    const out = roadmapProposalView(state([], []), [
      { name: 'ordering', horizon: 'mvp', summary: 'customers order' },
    ]);
    assert.match(out, /Proposed items \(1\)/);
    assert.ok(!out.includes('Already on the roadmap'));
    assert.throws(() => roadmapProposalView(state([]), []), /proposed set is empty/);
  });
});

describe('roadmap projections: map view', () => {
  it('renders the empty-born state and the breakdown header', () => {
    assert.match(roadmapMapView(state([])), /Roadmap \(0 items\)\n  \(empty\)\n/);
    assert.match(roadmapMapView(state(ROWS)), /Roadmap \(4 items — 1 in flight · 3 waiting\)/);
  });
});
