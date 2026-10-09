'use strict';

// Roadmap projections — the pure gateway views over derived roadmap state
// (projections/roadmap.cjs): the pull working set and the harvest proposal
// overlay, a bug or a quick-fix row marked with its kind and an idea row
// unmarked. The map view and gates are covered through their render surfaces
// (test-engine-render-surfaces.cjs).

require('./hermetic-env.cjs');

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
  { name: 'ordering', horizon: 'mvp', summary: 'customers order', kind: 'idea', origin: 'harvest', sources: [], state: 'in-flight', work_unit: 'mvp' },
  { name: 'menus', horizon: 'mvp', summary: 'operators maintain', kind: 'idea', origin: 'harvest', sources: [], state: 'waiting' },
  { name: 'kds', horizon: 'mvp', summary: 'orders reach the kitchen', kind: 'idea', origin: 'harvest', sources: [], state: 'waiting' },
  { name: 'loyalty', horizon: 'v1', summary: 'rewards', kind: 'idea', origin: 'park:mvp', sources: [], state: 'waiting' },
];

const FIXES = [
  { name: 'login-crash', horizon: 'mvp', summary: 'sign-in crashes', kind: 'bug', origin: 'inbox:2026-03-01--login-crash', sources: [], state: 'waiting' },
  { name: 'typo', horizon: 'mvp', summary: 'the footer typo', kind: 'quick-fix', origin: 'park:mvp', sources: [], state: 'in-flight', work_unit: 'typo' },
];

describe('roadmap projections: pull working set', () => {
  it('numbers waiting items horizon-major, with the DATA table resolving them', () => {
    const view = roadmapPullSetView(state(ROWS));
    assert.deepStrictEqual(view.rows, [
      { n: 1, name: 'menus', horizon: 'mvp', kind: 'idea' },
      { n: 2, name: 'kds', horizon: 'mvp', kind: 'idea' },
      { n: 3, name: 'loyalty', horizon: 'v1', kind: 'idea' },
    ]);
    assert.match(view.data, /waiting_count: 3/);
    assert.match(view.data, /ITEMS \(n {2}name {2}horizon {2}kind\):/);
    assert.match(view.data, /  2  kds  mvp  idea/);
    assert.match(view.display, /mvp\n  ├─ 1\. Menus — operators maintain\n  └─ 2\. Kds — orders reach the kitchen/);
    assert.match(view.display, /v1\n  └─ 3\. Loyalty — rewards/);
    assert.ok(!view.display.includes('Ordering'), 'joined items never offer themselves for a pull');
    assert.match(view.menu, /`1–3`/);
    assert.match(view.menu, /`b\/back`/);
  });

  it('a bug row carries its kind as a [term] and in the DATA table; an idea row stays unmarked', () => {
    const view = roadmapPullSetView(state([ROWS[1], FIXES[0]]));
    assert.match(view.display, /├─ 1\. Menus — operators maintain\n  └─ 2\. Login Crash \[bug\] — sign-in crashes/);
    assert.match(view.data, /  2  login-crash  mvp  bug/);
    assert.deepStrictEqual(view.rows[1], { n: 2, name: 'login-crash', horizon: 'mvp', kind: 'bug' });
  });

  it('wraps a long row at the display width, continuations under its text — the number and the kind mark kept', () => {
    const long = {
      name: 'export-timeout', horizon: 'v1', kind: 'bug', origin: 'harvest', sources: [], state: 'waiting',
      summary: 'large exports of a whole year of orders time out before the file is ready to download',
    };
    assert.strictEqual(roadmapPullSetView(state([ROWS[1], long])).display, [
      'mvp',
      '  └─ 1. Menus — operators maintain',
      '',
      'v1',
      '  └─ 2. Export Timeout [bug] — large exports of a whole year',
      '        of orders time out before the file is ready to download',
      '',
    ].join('\n'));
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
    const v1 = out.indexOf('v1\n', out.indexOf('New this session'));
    const someday = out.indexOf('someday\n');
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

  it('names a bug or a quick-fix row\'s kind in its ↳ note, ahead of the state; an idea row\'s note is its state alone', () => {
    const out = roadmapMapView(state([ROWS[1], ...FIXES]));
    assert.match(out, /Login Crash\n.*sign-in crashes\n.*↳ Bug · waiting/);
    assert.match(out, /Typo\n.*↳ Quick-fix · in flight: typo/);
    assert.match(out, /Menus\n.*operators maintain\n.*↳ Waiting/);
  });

  it('marks an existing bug row beneath a harvest proposal; the proposed rows are ideas', () => {
    const out = roadmapProposalView(state([FIXES[0]]), [{ name: 'gift-cards', horizon: 'v1', summary: 'stored value' }]);
    assert.match(out, /↳ Bug · waiting/);
    assert.strictEqual((out.match(/↳ Bug/g) || []).length, 1);
  });
});
