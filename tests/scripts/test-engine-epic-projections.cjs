'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const { setupFixture, cleanupFixture, createManifest, readManifest } = require('./discovery-test-utils.cjs');
const { ok } = require('./engine-harness.cjs');
const { epicDetail } = require('../../skills/leeway-engine/scripts/domain/epic-detail.cjs');
const { discover } = require('../../skills/leeway-continue-epic/scripts/gateway.cjs');
const {
  epicDashboard, epicKey, epicMenu, epicInSessionGate, epicCompletedMenu, epicCancelMenu, epicReactivateMenu, epicPostponeMenu, epicPullForwardMenu,
} = require('../../skills/leeway-engine/scripts/domain/projections/epic.cjs');
const { TREE_WIDTH } = require('../../skills/leeway-engine/scripts/domain/conventions.cjs');
const { drawLabel } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');

const ADAPTER = path.join(__dirname, '../../skills/leeway-continue-epic/scripts/gateway.cjs');

// Menu label continuations indent with non-breaking spaces (the worklist
// rule) — goldens spell them explicitly.
const NB = (n) => '\u00a0'.repeat(n);

// Golden tests: byte-exact expected strings for the epic dashboard, key, and
// menu projections. Fixtures go through real manifests in temp dirs (the same
// shapes the discovery tests produce), except the gating/blocked menu fixture,
// which hand-builds a detail to reach states a manifest can't (a start entry
// surviving while its gate is closed).

// A send never parks a stub without its message: the fixture lays one in the
// mailbox of every topic with an `unstarted` item, and takes it back when a
// later manifest in the same test drops the stub.
const STUB_MESSAGE = '000-parked.md';

/** A cut of two phases, the second relying on the first. */
const TWO_PHASES = Object.freeze({
  phases: [{ name: 'Cards', scenarios: [], sections: ['1'], relies_on: [] }, { name: 'Refunds', scenarios: [], sections: ['2'], relies_on: [1] }],
});

/** A topic's mailbox. @param {string} dir @param {string} name @param {string} topic */
const mailboxOf = (dir, name, topic) => path.join(dir, '.leeway', name, 'topics', topic, 'mail');

/** @param {string} dir @param {string} name @param {any} manifest */
function layStubMessages(dir, name, manifest) {
  const topics = path.join(dir, '.leeway', name, 'topics');
  for (const topic of fs.existsSync(topics) ? fs.readdirSync(topics) : []) {
    fs.rmSync(path.join(mailboxOf(dir, name, topic), STUB_MESSAGE), { force: true });
  }
  const items = (manifest.phases && manifest.phases.discussion && manifest.phases.discussion.items) || {};
  for (const [topic, item] of Object.entries(items)) {
    if (item.status !== 'unstarted') continue;
    fs.mkdirSync(mailboxOf(dir, name, topic), { recursive: true });
    fs.writeFileSync(path.join(mailboxOf(dir, name, topic), STUB_MESSAGE), 'Parked\n');
  }
}

/** Build a detail from a manifest in a temp fixture dir. */
function detailFor(dir, name, manifest) {
  layStubMessages(dir, name, manifest);
  createManifest(dir, name, manifest);
  return discover(dir, name);
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
      phases: {
        discovery: {
          items: {
            'kitchen-hardware': { source: 'discovery', order: 1, summary: LONG_TOKEN_SUMMARY },
            'menu-admin': { source: 'message:exploration', order: 2, summary: 'Business-side menu modelling, admin shell (Filament vs custom Vue/Nuxt), JustEat import, staff/roles' },
          },
        },
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
    '',
    '  ⚑ 1 new topic(s) added to the map from gap-analysis.',
    '',
    'DISCUSSION (2 topics · 2 fresh)',
    '  ├─ ○ Kitchen Hardware',
    '  │     Receipt printing, KDS handoff, and the',
    '  │     fastest-cumulative-time-tiebreak-resolution-policy-and-of',
    '  │     fline-sync token that cannot break',
    '  │     ↳ Fresh',
    '  │',
    '  └─ ○ Menu Admin',
    '        Business-side menu modelling, admin shell (Filament vs',
    '        custom Vue/Nuxt), JustEat import, staff/roles',
    '        ↳ From exploration',
    '        ↳ Fresh',
    '',
    '── DEFINITION ───────────────────────────────────────────────────',
    '',
    'SPECIFICATION (1 completed)',
    '  └─ Roles And Permissions    [completed]',
    '     ├─ Menu Admin            [incorporated]',
    '     └─ Auth Flow             [pending]',
    '',
    '── DELIVERY ─────────────────────────────────────────────────────',
    '',
    'IMPLEMENTATION (1 in-progress)',
    '  └─ Roles And Permissions    [in-progress]',
    '     └─ Phase 2, 3 task(s) completed',
    '',
  ].join('\n');

  it('a topic whose discussion left with its specification reads decided, naming the unit it moved to', () => {
    const detail = detailFor(dir, 'pay', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          fees: { source: 'discovery', order: 1, summary: 'Fee rules' },
          refunds: { source: 'discovery', order: 2, summary: 'Refund rules' },
        } },
        discussion: { items: { fees: { status: 'promoted', promoted_to: 'fees-cc' }, refunds: { status: 'completed' } } },
        specification: { items: { fees: { status: 'promoted', promoted_to: 'fees-cc', sources: { fees: { status: 'incorporated' } } } } },
      },
    });
    const out = epicDashboard('pay', detail);
    assert.match(out, /DISCUSSION \(2 topics · all decided\)/, out);
    assert.match(out, /✓ Fees\n  │     Fee rules\n  │     ↳ Decided · promoted to fees-cc\n/, out);
    assert.match(out, /✓ Refunds\n        Refund rules\n        ↳ Decided\n/, out);
  });

  it('a postponed topic drops out of the tree and its counts, named with its horizon on one line beneath', () => {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next', 'later'], items: {
        'data-export': { horizon: 'next', summary: 's', origin: 'postpone:pv1', postponed_from: { work_unit: 'pv1', topic: 'data-export' } },
        reporting: { horizon: 'later', summary: 's', origin: 'postpone:pv1', postponed_from: { work_unit: 'pv1', topic: 'reporting' } },
      } },
    }, null, 2));
    const detail = detailFor(dir, 'pv1', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          auth: { source: 'discovery', order: 1, summary: 'Auth flow' },
          'data-export': { source: 'discovery', postponed: true, previous_order: 2 },
          reporting: { source: 'discovery', postponed: true, previous_order: 3 },
        } },
        discussion: { items: { auth: { status: 'in-progress' }, reporting: { status: 'postponed', previous_status: 'completed' } } },
      },
    });
    assert.strictEqual(epicDashboard('pv1', detail), [
      '── DISCOVERY ────────────────────────────────────────────────────',
      '',
      'DISCUSSION (1 topic · 1 in flight)',
      '  └─ ◐ Auth',
      '        Auth flow',
      '        ↳ Discussing',
      '',
      '  postponed: Data Export → next · Reporting → later',
      '',
    ].join('\n'));
    assert.deepStrictEqual(detail.postponed, [
      { name: 'data-export', horizon: 'next', item: 'data-export', waiting: true },
      { name: 'reporting', horizon: 'later', item: 'reporting', waiting: true },
    ]);
    // Convergence never waits on a topic that has left the epic.
    assert.strictEqual(detail.convergence_state, 'in-progress');
    assert.strictEqual(detail.map_summary.postponed, 2);
  });

  it('a map whose every row is postponed draws an empty tree and never claims all decided', () => {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next'], items: {
        'data-export': { horizon: 'next', summary: 's', origin: 'postpone:pv2', postponed_from: { work_unit: 'pv2', topic: 'data-export' } },
      } },
    }, null, 2));
    const detail = detailFor(dir, 'pv2', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { source: 'discovery', postponed: true } } } },
    });
    assert.strictEqual(detail.convergence_state, 'settled');
    assert.strictEqual(epicDashboard('pv2', detail), [
      '── DISCOVERY ────────────────────────────────────────────────────',
      '',
      'DISCUSSION (0 topics)',
      '  (empty)',
      '',
      '  postponed: Data Export → next',
      '',
    ].join('\n'));
  });

  it('a postponed row whose roadmap item is gone says so rather than naming a horizon it lost', () => {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({ work_units: {} }, null, 2));
    const detail = detailFor(dir, 'pv3', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { source: 'discovery', postponed: true } } } },
    });
    assert.deepStrictEqual(detail.postponed, [{ name: 'data-export', horizon: null, item: null, waiting: false }]);
    assert.ok(epicDashboard('pv3', detail).includes('  postponed: Data Export → no roadmap item'));
  });

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
    const start = lines.findIndex((l) => l.startsWith('  ├─ ○ Kitchen Hardware'));
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
      phases: { discovery: { items: { topic: { source: 'discovery', order: 1 } } } },
    });
    assert.strictEqual(
      epicDashboard('v1', d),
      [
        '── DISCOVERY ────────────────────────────────────────────────────',
        '',
        'DISCUSSION (1 topic · 1 fresh)',
        '  └─ ○ Topic',
        '        ↳ Fresh',
        '',
      ].join('\n')
    );
  });

  it('an unstarted stub renders fresh with the mail waiting cue and counts as fresh', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { parked: { source: 'message:origin-topic', order: 1 } } },
        discussion: { items: { parked: { status: 'unstarted' } } },
      },
    });
    const out = epicDashboard('v1', d);
    assert.ok(out.includes('DISCUSSION (1 topic · 1 fresh)'), out);
    assert.match(out, /  └─ ○ Parked\n[\s\S]*?↳ Fresh · mail waiting/, out);
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
        discussion: { items: { 'auth-flow': { status: 'in-progress' }, 'session-model': { status: 'completed' } } },
      },
    });
    assert.strictEqual(
      epicDashboard('auth-overhaul', d),
      [
        '── DISCOVERY ────────────────────────────────────────────────────',
        '',
        'DISCUSSION (1 in-progress, 1 completed)',
        '  ├─ Auth Flow        [in-progress]',
        '  └─ Session Model    [completed]',
        '',
        '  ⚑ Conclude the remaining discussions — the spec is written once',
        '    every topic is decided.',
        '',
      ].join('\n')
    );
  });

  it('a promoted discussion shows promoted, as its promoted specification does — and is no topic to resume', () => {
    const d = detailFor(dir, 'pay', {
      work_type: 'epic',
      phases: {
        discussion: { items: { fees: { status: 'promoted', promoted_to: 'fees-cc' }, refunds: { status: 'completed' } } },
        specification: { items: { fees: { status: 'promoted', promoted_to: 'fees-cc', sources: { fees: { status: 'incorporated' } } } } },
      },
    });
    const out = epicDashboard('pay', d);
    assert.match(out, /DISCUSSION \(1 completed, 1 promoted\)\n  ├─ Fees +\[promoted\]\n  └─ Refunds +\[completed\]/, out);
    assert.match(out, /SPECIFICATION \(1 promoted\)\n  └─ Fees +\[promoted\]/, out);
    assert.deepStrictEqual(d.completed.map((c) => `${c.phase}/${c.name}`), ['discussion/refunds']);
  });

  it('renders the brand-new-epic branch with the discovery callout', () => {
    const d = detailFor(dir, 'fresh-epic', { work_type: 'epic' });
    assert.strictEqual(
      epicDashboard('fresh-epic', d),
      [
        'No work started yet.',
        '',
        '  ⚑ Run discovery to shape the topic map — discussion starts from',
        '    there.',
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
    '    unstarted   — mail waiting, topic not started',
    '    in-progress — work is ongoing',
    '    completed   — phase or implementation done',
    '    cancelled   — topic removed from active work',
    '    promoted    — moved to its own cross-cutting work unit',
  ].join('\n');

  it('map with no build items produces no key (the ↳ state lines carry the words)', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { topic: { source: 'discovery', order: 1 } } } },
    });
    assert.strictEqual(epicKey(d), '');
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

  // A settled map on a unit whose building began under the old spec, its
  // spec, planning and implementation items kept — a plan blocked on
  // another, an implementation done — so it draws no spec row.
  const OLD_ITEMS = {
    discovery: { items: { 'menu-admin': { source: 'discovery', order: 1, summary: 'x', description: 'x' } } },
    discussion: { items: { 'menu-admin': { status: 'completed' } } },
    specification: { items: { billing: { status: 'completed' }, reporting: { status: 'completed' }, 'user-profiles': { status: 'completed' } } },
    planning: { items: { reporting: { status: 'completed', external_dependencies: { 'core-features': { description: 'd', state: 'unresolved' } } } } },
    implementation: { items: { billing: { status: 'completed' } } },
  };

  it('a unit in the old shape says it waits on the migration\'s cut in place of its plan rows, and offers no way into its build (P12, 18.4.11, 12.6.1)', () => {
    const menu = epicMenu('quiz-competition-v1', detailFor(dir, 'quiz-competition-v1', { work_type: 'epic', phases: OLD_ITEMS }));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'quiz-competition-v1 was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it',
      '',
      '**`◆ What would you like to do?`**',
      '',
      '**`d/discuss`**   → Start a discussion on a new topic',
      '**`i/discovery`** → Continue discovery',
      '**`c/completed`** → Resume a completed topic',
      '**`a/cancel`**    → Cancel a topic',
      '**`p/postpone`**  → Postpone a topic to the roadmap',
      '**`b/back`**      → Return to the start menu',
    ].join('\n'));
  });

  it('in-progress map recommends the top discovery row; ✓/⊘ rows get no entry', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            ready: { source: 'discovery', order: 1 },
            decided: { source: 'discovery', order: 2 },
            dropped: { source: 'discovery' },
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
      [['1', 'start_discussion', 'ready']]
    );
    assert.strictEqual(numbered[0].recommended, true);
    assert.ok(/\*\*`1`\*\* +→ Start discussion for "Ready" \(recommended\)/.test(rendered), rendered);
    assert.ok(/\*\*`e\/reactivate`\*\* +→ Reactivate a cancelled topic/.test(rendered), 'cancelled items exist');
    assert.ok(!rendered.includes('Dropped'), 'cancelled row has no menu entry');
  });

  it('a decided row floating to the top of the map changes no menu numbering', () => {
    // Same actionable rows either side; the only difference is a decided topic
    // present on the map, which now sorts above them all.
    const actionable = {
      inflight: { source: 'discovery', order: 1 },
      fresh: { source: 'discovery', order: 2 },
    };

    const without = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { discovery: { items: { ...actionable } }, discussion: { items: { inflight: { status: 'in-progress' } } } },
    });
    const with_ = detailFor(dir, 'v2', {
      work_type: 'epic',
      phases: {
        discovery: { items: { ...actionable, settled: { source: 'discovery', order: 3 } } },
        discussion: { items: { inflight: { status: 'in-progress' }, settled: { status: 'completed' } } },
      },
    });

    assert.strictEqual(with_.discovery_map[0].name, 'settled', 'the decided row leads the map');
    assert.strictEqual(with_.discovery_map[0].tier, '✓');

    const numbered = (d, wu) => epicMenu(wu, d).keys
      .filter((k) => /^\d+$/.test(k.key))
      .map((k) => [k.key, k.action, k.topic]);
    assert.deepStrictEqual(numbered(with_, 'v2'), numbered(without, 'v1'));
    assert.deepStrictEqual(numbered(with_, 'v2'), [
      ['1', 'continue_discussion', 'inflight'],
      ['2', 'start_discussion', 'fresh'],
    ]);
  });

  it('an unstarted stub is offered as Start with the mail waiting suffix — never Continue', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { parked: { source: 'message:origin-topic', order: 1 } } },
        discussion: { items: { parked: { status: 'unstarted' } } },
      },
    });
    const { keys, rendered } = epicMenu('v1', d);
    const entry = keys.find((k) => k.topic === 'parked');
    assert.strictEqual(entry.action, 'start_discussion');
    assert.strictEqual(drawLabel(entry.label), 'Start discussion for "Parked" — *mail waiting*');
    assert.ok(!rendered.includes('Continue "Parked"'), 'a stub must never be offered as a resume');
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
    assert.deepStrictEqual(keys.map((k) => k.key), ['i', 'd', 'b']);
    assert.strictEqual(rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ What would you like to do?`**',
      '',
      '**`i/discovery`** → Run discovery — shape the topic map (recommended)',
      '**`d/discuss`**   → Start new discussion',
      '**`b/back`**      → Return to the start menu',
    ].join('\n'));
  });
});

describe('epic projections: the spec row (18.4.6)', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** An epic whose topics are decided, cancelled and postponed, `more` laid over it. @param {Record<string, any>} [discussion] @param {Record<string, any>} [more] */
  const settled = (discussion = {}, more = {}) => detailFor(dir, 'v1', {
    work_type: 'epic',
    phases: {
      discovery: { items: {
        decided: { source: 'discovery', order: 1 },
        dropped: { source: 'discovery', cancelled: true },
        later: { source: 'discovery', postponed: true },
      } },
      discussion: { items: {
        decided: { status: 'completed' },
        dropped: { status: 'cancelled', previous_status: 'in-progress' },
        later: { status: 'postponed', previous_status: 'in-progress' },
        ...discussion,
      } },
    },
    ...more,
  });

  /** The menu's spec row, as its key, route, label and recommendation. @param {Record<string, any>} detail */
  const specRow = (detail) => epicMenu('v1', detail).keys
    .filter((k) => k.action === 'enter_specification')
    .map((k) => ({ key: k.key, route: k.route, label: k.label, recommended: k.recommended === true }));

  it('shows once every topic is settled — decided, cancelled or postponed — entered at the unit, starting the spec, recommended', () => {
    assert.deepStrictEqual(specRow(settled()), [{ key: 's', route: '/leeway-specification-process epic v1', label: 'Start the specification', recommended: true }]);
  });

  it('never shows while a topic is still open', () => {
    const open = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { decided: { source: 'discovery', order: 1 }, talking: { source: 'discovery', order: 2 } } },
        discussion: { items: { decided: { status: 'completed' }, talking: { status: 'in-progress' } } },
      },
    });
    assert.deepStrictEqual(specRow(open), []);
  });

  it('carries on the spec once spec.md is written', () => {
    fs.mkdirSync(path.join(dir, '.leeway', 'v1'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway', 'v1', 'spec.md'), '# V1\n');
    assert.deepStrictEqual(specRow(settled()).map((row) => [row.label, row.recommended]), [['Continue the specification', true]]);
  });

  it('is gone once the build has begun', () => {
    assert.deepStrictEqual(specRow(settled({}, { build: { position: 'auto' }, cut: TWO_PHASES })), []);
  });

  it('leaves the closed map\'s rows off the menu once spec.md is written — no discovery, new topic, cancel, postpone, reactivate or pull forward — the spec and completed rows standing (18.4.19)', () => {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next', 'later'], items: { later: { horizon: 'later', summary: 's', origin: 'postpone:v1', postponed_from: { work_unit: 'v1', topic: 'later' } } } },
    }, null, 2));
    const keys = () => epicMenu('v1', settled()).keys.map((k) => k.key);
    const before = keys();
    fs.mkdirSync(path.join(dir, '.leeway', 'v1'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway', 'v1', 'spec.md'), '# V1\n');

    assert.deepStrictEqual([before, keys()], [['s', 'd', 'i', 'c', 'a', 'p', 'e', 'f', 'b'], ['s', 'c', 'b']]);
  });
});

describe('epic projections: the build\'s row (18.4.6, 12.15.3)', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  const CLOSED = Object.freeze({ items: {}, closed: '2026-11-01T00:00:00.000Z' });

  /** An epic built by its cut, decided whole, `more` laid over it. @param {Record<string, any>} [more] */
  const built = (more = {}) => ({
    work_type: 'epic', build: { position: 'auto' }, cut: TWO_PHASES,
    phases: { discovery: { items: { cards: { source: 'discovery', order: 1 } } }, discussion: { items: { cards: { status: 'completed' } } } },
    ...more,
  });

  /** The menu's numbered rows, as key, action, topic, route, label and recommendation. @param {any} detail */
  const rows = (detail) => epicMenu('v1', detail).keys.filter((k) => /^\d+$/.test(k.key))
    .map((k) => [k.key, k.action, k.topic, k.route, drawLabel(k.label), k.recommended === true]);

  it('offers the build at the phase it is in, of its cut\'s, entered at the unit and recommended, in place of the plan rows', () => {
    assert.deepStrictEqual(rows(detailFor(dir, 'v1', built())), [['1', 'enter_implementation', 'v1', '/leeway-implementation-process epic v1', 'Build — *phase 1 of 2*', true]]);
  });

  it('names the first phase of the cut not closed, as the build reads where it stands', () => {
    createManifest(dir, 'v1', built());
    ok(dir, ['task', 'phase', 'v1', '1', '--title', 'Cards']);
    const d = detailFor(dir, 'v1', built({ checklists: { 'phase-1-close': CLOSED } }));
    assert.deepStrictEqual(rows(d).map((row) => row[4]), ['Build — *phase 2 of 2*']);
  });

  it('offers the review phase once every phase of the cut has closed, and nothing once finish has completed the unit (24.1.6, 14.5)', () => {
    const through = built({ checklists: { 'phase-1-close': CLOSED, 'phase-2-close': CLOSED } });
    assert.deepStrictEqual(rows(detailFor(dir, 'v1', through)), [['1', 'enter_review', 'v1', '/leeway-review-process epic v1', 'Review', true]]);
    createManifest(dir, 'v1', { ...through, status: 'completed' });
    assert.strictEqual(epicDetail(dir, readManifest(dir, 'v1')).build, null);
  });

  it('the review phase\'s row, as the build\'s, is struck by a code session elsewhere, never then recommended (12.7.8)', () => {
    const d = detailFor(dir, 'v1', built({ checklists: { 'phase-1-close': CLOSED, 'phase-2-close': CLOSED } }));
    const codeRow = { work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow', age_seconds: 300, held: true, session_id: 'peer' };
    const review = epicMenu('v1', d, { presence: [], codeHeld: [codeRow] }).keys.find((k) => k.action === 'enter_review');
    assert.deepStrictEqual([review?.in_session, review?.code_session, review?.recommended === true], [true, true, false]);
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
            'topic-a': { source: 'discovery', order: 1 },
            'topic-b': { source: 'discovery', order: 2 },
          },
        },
        discussion: { items: { 'topic-a': { status: 'in-progress' } } },
      },
    });
  }

  const heldRow = { phase: 'discussion', topic: 'topic-a', age_seconds: 120, held: true, session_id: 's1' };

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
    const dead = { ...heldRow, held: false };
    const wrongPhase = { phase: 'planning', topic: 'topic-a', age_seconds: 10, held: true, session_id: 's2' };
    const { keys } = epicMenu('v1', twoTopicDetail(), { presence: [dead, wrongPhase] });
    assert.ok(!keys.some((k) => k.in_session), 'no entry marked');
    assert.strictEqual(keys.find((k) => k.topic === 'topic-a').recommended, true);
  });

  it('renders the in-session confirm gate as a labelled MENU section, byte-for-byte', () => {
    const { keys } = epicMenu('v1', twoTopicDetail(), { presence: [heldRow] });
    const marked = keys.find((k) => k.in_session);
    assert.strictEqual(epicInSessionGate('v1', marked, {}), [
      '=== MENU: in-session gate — 1 (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '"Topic A" is open in another session — last active 2m ago. Proceeding starts a second concurrent session on the same discussion; its work could conflict with that session\'s. Only proceed if you know that session is no longer working; if it is wedged but alive, release its hold with `node .claude/skills/leeway-engine/scripts/engine.cjs presence clear v1 discussion topic-a`.',
      '',
      '**`◆ Proceed anyway?`**',
      '',
      '**`b/back`** → Return to menu (recommended)',
      '**`y/yes`**  → Proceed anyway',
      '',
    ].join('\n'));
  });

  // A build begun — the state a code entry needs on the menu.
  function readyToImplementDetail() {
    return detailFor(dir, 'v1', {
      work_type: 'epic', build: { position: 'auto' }, cut: TWO_PHASES,
      phases: {
        discovery: { items: { 'topic-a': { source: 'discovery', order: 1 } } },
        discussion: { items: { 'topic-a': { status: 'completed' } } },
      },
    });
  }

  it('a held code row anywhere in the project marks every code entry, naming the holder', () => {
    const d = readyToImplementDetail();
    // A code session holding a different work unit's topic — one slot, one
    // checkout.
    const codeRow = { work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow', age_seconds: 300, held: true, session_id: 'peer' };
    const { keys, rendered } = epicMenu('v1', d, { presence: [], codeHeld: [codeRow] });
    const code = keys.find((k) => k.action === 'enter_implementation');
    assert.ok(code, 'the build\'s entry is on the menu');
    assert.strictEqual(code.in_session, true, 'the code entry is marked though the holder is elsewhere');
    assert.deepStrictEqual(code.session_holder, { work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow' });
    assert.match(rendered.replace(/\n\u00a0+/g, ' '), /~~[^~]*~~ · code session in ship\/checkout-flow \(last active 5m ago\)/,
      `the struck row names the holder:\n${rendered}`);
    assert.ok(!code.recommended, 'a struck row is never the recommendation');
    assert.strictEqual(code.code_session, true, 'the marker says the slot, so this menu never gates it');
    assert.ok(!keys.some((k) => k.action !== 'enter_implementation' && k.in_session),
      'doc entries are untouched by the code slot');
  });

  it('a code entry is marked by its own unit\'s build held too, and still carries the slot marker', () => {
    const d = readyToImplementDetail();
    const ownRow = { phase: 'implementation', topic: 'v1', age_seconds: 30, held: true, session_id: 'peer' };
    const { keys, rendered } = epicMenu('v1', d, { presence: [ownRow], codeHeld: [] });
    const code = keys.find((k) => k.action === 'enter_implementation');
    assert.strictEqual(code.in_session, true);
    assert.strictEqual(code.code_session, true, 'own-topic or elsewhere, a code hold is the one slot');
    // The word names what holds the row, and it is the slot either way. Only
    // the holder's address is conditional — a hold on this very unit's build
    // needs none.
    assert.match(rendered.replace(/\n +/g, ' '), /~~[^~]*~~ · code session \(last active 30s ago\)/,
      `the struck row says code session without an address:\n${rendered}`);
  });

  it('a no-map epic never recommends a row the code slot has struck through', () => {
    const d = detailFor(dir, 'v2', {
      work_type: 'epic', build: { position: 'auto' }, cut: TWO_PHASES,
      phases: { discussion: { items: { 'topic-a': { status: 'completed' } } } },
    });
    const codeRow = { work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow', age_seconds: 300, held: true, session_id: 'peer' };

    const free = epicMenu('v2', d, { presence: [], codeHeld: [] });
    assert.strictEqual(free.keys.find((k) => k.action === 'enter_implementation').recommended, true,
      'with the slot free it is the obvious next move');

    const { keys } = epicMenu('v2', d, { presence: [], codeHeld: [codeRow] });
    const code = keys.find((k) => k.action === 'enter_implementation');
    assert.strictEqual(code.in_session, true, 'the slot is held elsewhere');
    assert.ok(!code.recommended, 'so the menu does not point at it');
  });

  it('the in-session gate speaks for document phases alone — a code entry never reaches it', () => {
    const d = twoTopicDetail();
    const { keys } = epicMenu('v1', d, { presence: [heldRow] });
    const gate = epicInSessionGate('v1', keys.find((k) => k.in_session), {});
    assert.match(gate, /second concurrent session on the same discussion/, 'the doc consequence is the only one left');
    assert.doesNotMatch(gate, /Code phases run one at a time/, 'the code wording belongs to the code gate the build\'s entry draws');
  });

  it('the dashboard cues held map rows on their ↳ state lines, with the session\'s last-active age', () => {
    const d = twoTopicDetail();
    const out = epicDashboard('v1', d, { presence: [heldRow] });
    assert.match(out, /◐ Topic A\n\s*│\s*↳ Discussing · in session \(last active 2m ago\)\n/, out);
    assert.doesNotMatch(out, /↳ Fresh · in session/, out);
    assert.strictEqual(epicKey(d), '', 'the ↳ state line carries the words — no session legend');
  });

  it('a hold idle for hours is still a hold — struck, gated, and cued with its age', () => {
    const idle = { ...heldRow, age_seconds: 10800 };
    const d = twoTopicDetail();
    const { keys, rendered } = epicMenu('v1', d, { presence: [idle] });
    const marked = keys.find((k) => k.in_session);
    assert.strictEqual(marked.topic, 'topic-a');
    assert.notStrictEqual(marked.recommended, true, 'never recommended, however long idle');
    assert.ok(/~~Continue "Topic A" — \*discussion\*~~ · in session \(last\n +active 3h ago\)/.test(rendered), rendered);
    assert.match(epicInSessionGate('v1', marked, {}), /"Topic A" is open in another session — last active 3h ago\./);
    assert.match(epicDashboard('v1', d, { presence: [idle] }), /↳ Discussing · in session \(last active 3h ago\)/);
  });

  it('the map cue reads discussion holds alone — a planning session\'s age never lands on the row', () => {
    const planning = { phase: 'planning', topic: 'topic-a', age_seconds: 45, held: true, session_id: 's3' };
    const alone = epicDashboard('v1', twoTopicDetail(), { presence: [planning] });
    assert.doesNotMatch(alone, /in session/, `a planning-only hold cues nothing on the map: ${alone}`);
    const both = epicDashboard('v1', twoTopicDetail(), { presence: [planning, { ...heldRow, age_seconds: 259200 }] });
    assert.match(both, /↳ Discussing · in session \(last active 3d ago\)/, both);
    assert.doesNotMatch(both, /45s ago/, both);
  });
});

describe('epic projections: selection sub-views', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // Three topics in one phase, one in another, a cancelled item with a
  // stashed previous_status, and a promoted item — exercises the grouping,
  // continuous numbering, and status-filter rules together.
  function richDetail() {
    return detailFor(dir, 'quiz-competition-v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' }, 'kitchen-hardware': { status: 'completed' }, 'menu-admin': { status: 'in-progress' }, 'session-storage': { status: 'completed' }, 'stale-topic': { status: 'cancelled', previous_status: 'in-progress' } } },
        specification: { items: { 'roles-and-permissions': { status: 'completed' }, billing: { status: 'promoted' } } },
        planning: { items: { 'roles-and-permissions': { status: 'completed' } } },
        implementation: { items: { 'roles-and-permissions': { status: 'in-progress' } } },
      },
    });
  }

  it('completed-menu: numbered tree rows grouped by phase, routes per entry', () => {
    const view = epicCompletedMenu('quiz-competition-v1', richDetail());
    assert.strictEqual(view.title, 'Completed Topics');
    assert.strictEqual(view.display, [
      'Discussion',
      '  ├─ 1. Auth Flow [completed]',
      '  ├─ 2. Kitchen Hardware [completed]',
      '  └─ 3. Session Storage [completed]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to resume?`**',
      '',
      '**`1`**      → Resume "Auth Flow" — *discussion*',
      '**`2`**      → Resume "Kitchen Hardware" — *discussion*',
      '**`3`**      → Resume "Session Storage" — *discussion*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'resume', 'auth-flow', 'discussion', '/leeway-discussion-process epic quiz-competition-v1 auth-flow'],
        ['2', 'resume', 'kitchen-hardware', 'discussion', '/leeway-discussion-process epic quiz-competition-v1 kitchen-hardware'],
        ['3', 'resume', 'session-storage', 'discussion', '/leeway-discussion-process epic quiz-competition-v1 session-storage'],
        ['b', 'back', null, null, null],
      ]
    );
  });

  it('cancel-menu: one row per topic — topics off the map by name, terminal ones absent', () => {
    const view = epicCancelMenu(richDetail());
    assert.strictEqual(view.title, 'Cancellable Topics');
    assert.strictEqual(view.display, [
      'Topics',
      '  ├─ 1. Auth Flow [decided]',
      '  ├─ 2. Kitchen Hardware [decided]',
      '  ├─ 3. Menu Admin [discussing]',
      '  └─ 4. Session Storage [decided]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to cancel?`**',
      '',
      '**`1`**      → Cancel "Auth Flow" — *decided*',
      '**`2`**      → Cancel "Kitchen Hardware" — *decided*',
      '**`3`**      → Cancel "Menu Admin" — *discussing*',
      '**`4`**      → Cancel "Session Storage" — *decided*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    // No routes — the flow continues to its confirmation gate. The
    // cancelled topic is no unit the cancel can take.
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'cancel', 'auth-flow', 'discovery', null],
        ['2', 'cancel', 'kitchen-hardware', 'discovery', null],
        ['3', 'cancel', 'menu-admin', 'discovery', null],
        ['4', 'cancel', 'session-storage', 'discovery', null],
        ['b', 'back', null, null, null],
      ]
    );
  });

  // Every unit shape the cancel menu meets on a mapped epic: a decided
  // topic, a held one, a never-started one, and cancelled ones (absent).
  function unitDetail() {
    return detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          'data-export': { source: 'discovery', order: 3 },
          auth: { source: 'discovery', order: 1 },
          billing: { source: 'discovery', order: 2 },
          gone: { source: 'discovery', cancelled: true, previous_order: 4 },
        } },
        discussion: { items: { auth: { status: 'completed' }, billing: { status: 'in-progress', awaiting_experiments: ['E1'] }, legacy: { status: 'cancelled', previous_status: 'completed' } } },
      },
    });
  }

  it('cancel-menu: map order, keys continuous over the rows, a held unit cued', () => {
    const presence = [
      { phase: 'discussion', topic: 'billing', age_seconds: 120, held: true, session_id: 's1' },
      { phase: 'experiment', topic: 'billing', age_seconds: 30, held: true, session_id: 's2' },
      { phase: 'discussion', topic: 'auth', age_seconds: 10, held: false, session_id: 's5' },
    ];
    const view = epicCancelMenu(unitDetail(), { presence });
    assert.strictEqual(view.display, [
      'Topics',
      '  ├─ 1. Auth [decided]',
      '  ├─ 2. Billing [discussing · awaiting E1] · in session (last',
      '        active 30s ago)',
      '  └─ 3. Data Export [fresh]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to cancel?`**',
      '',
      '**`1`**      → Cancel "Auth" — *decided*',
      '**`2`**      → Cancel "Billing" — *discussing · awaiting E1* · in session',
      `${NB(9)}(last active 30s ago)`,
      '**`3`**      → Cancel "Data Export" — *fresh*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'cancel', 'auth', 'discovery', null],
        ['2', 'cancel', 'billing', 'discovery', null],
        ['3', 'cancel', 'data-export', 'discovery', null],
        ['b', 'back', null, null, null],
      ]
    );
    assert.strictEqual(epicCancelMenu(unitDetail()).display.includes('in session'), false, 'no presence, no cue');
  });

  it('postpone-menu: every Discovery unit, locked rows keyless with their reason, a held unit cued; cancelled and postponed rows absent', () => {
    const presence = [{ phase: 'discussion', topic: 'billing', age_seconds: 30, held: true, session_id: 's1' }];
    const detail = detailFor(dir, 'p1', {
      work_type: 'epic',
      phases: {
        discovery: { items: {
          auth: { source: 'discovery', order: 1 },
          billing: { source: 'discovery', order: 2 },
          'data-export': { source: 'discovery', order: 3 },
          gone: { source: 'discovery', cancelled: true },
          away: { source: 'discovery', postponed: true },
        } },
        discussion: { items: { auth: { status: 'completed' }, billing: { status: 'in-progress' } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'running' } } } } },
      },
    });
    const view = epicPostponeMenu(detail, { presence });
    assert.strictEqual(view.title, 'Postponable Topics');
    assert.strictEqual(view.display, [
      'Topics',
      '  ├─ Auth [decided] · postponing "auth" is refused while an',
      '     experiment is live (E1) — conclude or abandon it first; a',
      '     laboratory cannot run under a topic that has left the epic',
      '  ├─ 1. Billing [discussing] · in session (last active 30s',
      '        ago)',
      '  └─ 2. Data Export [fresh]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to postpone?`**',
      '',
      '**`1`**      → Postpone "Billing" — *discussing* · in session (last',
      `${NB(9)}active 30s ago)`,
      '**`2`**      → Postpone "Data Export" — *fresh*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'postpone', 'billing', 'discovery', null],
        ['2', 'postpone', 'data-export', 'discovery', null],
        ['b', 'back', null, null, null],
      ]
    );
  });

  it('postpone-menu: the empty state, and a set where every row is locked opens on a statement and asks what next over back alone', () => {
    const bare = detailFor(dir, 'p2', { work_type: 'epic', phases: { planning: { items: { orphan: { status: 'completed' } } } } });
    assert.strictEqual(epicPostponeMenu(bare).display, 'No postponable topics.\n');
    const locked = detailFor(dir, 'p3', {
      work_type: 'epic',
      build: { position: 'auto' },
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
      },
    });
    assert.strictEqual(epicPostponeMenu(locked).rendered, [
      '· · · · · · · · · · · ·',
      'Nothing can be postponed right now — each row names what holds it.',
      '',
      '**`◆ What next?`**',
      '',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(epicPostponeMenu(locked).keys.map((k) => k.key), ['b'], 'locked rows take no key');
  });

  // The roadmap the pull-forward rows read: `away` waits under next as an
  // item of another name (the topic was pulled once and renamed at the
  // harvest), `gone-again` waits under later, and `taken` was pulled into
  // another epic after it was postponed — it no longer waits.
  function projectRoadmap(dir) {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      work_units: {},
      roadmap: { horizons: ['next', 'later'], items: {
        'export-suite': { horizon: 'next', summary: 's', origin: 'harvest', postponed_from: { work_unit: 'pf1', topic: 'away' } },
        'gone-again': { horizon: 'later', summary: 's', origin: 'postpone:pf1', postponed_from: { work_unit: 'pf1', topic: 'gone-again' } },
        taken: { horizon: 'later', summary: 's', origin: 'postpone:pf1', postponed_from: { work_unit: 'pf1', topic: 'taken' }, pulled_to: { work_unit: 'other-epic', topic: 'taken' } },
      } },
    }, null, 2));
  }

  const postponedEpic = {
    work_type: 'epic',
    phases: {
      discovery: { items: {
        billing: { source: 'discovery', order: 1 },
        away: { source: 'roadmap', postponed: true, previous_order: 2 },
        'gone-again': { source: 'discovery', postponed: true },
        taken: { source: 'discovery', postponed: true },
      } },
      discussion: { items: { away: { status: 'postponed', previous_status: 'completed' } } },
    },
  };

  it('pull-forward-menu: one row per waiting item, its horizon on the row, the item name on the key', () => {
    projectRoadmap(dir);
    const view = epicPullForwardMenu(detailFor(dir, 'pf1', postponedEpic));
    assert.strictEqual(view.title, 'Postponed Topics');
    assert.strictEqual(view.display, [
      'Topics',
      '  ├─ 1. Away [postponed] — next',
      '  └─ 2. Gone Again [postponed] — later',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to pull forward?`**',
      '',
      '**`1`**      → Pull "Away" forward — *waiting under next*',
      '**`2`**      → Pull "Gone Again" forward — *waiting under later*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    // The item the pull forward addresses is the roadmap's own name, which
    // a harvest rename can have moved away from the topic's.
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.item]),
      [
        ['1', 'pull-forward', 'away', 'discovery', 'export-suite'],
        ['2', 'pull-forward', 'gone-again', 'discovery', 'gone-again'],
        ['b', 'back', null, null, undefined],
      ]
    );
  });

  it('f/forward shows only while a postponed item still waits', () => {
    projectRoadmap(dir);
    const options = (d) => epicMenu('pf1', d).keys.filter((k) => k.action === 'pull_forward_topic').map((k) => k.label);
    assert.deepStrictEqual(options(detailFor(dir, 'pf1', postponedEpic)), ['Pull a postponed topic back from the roadmap']);
    // Nothing postponed, and a postponed topic whose item another epic has
    // taken, both leave the menu without the row — and the sub-view empty.
    const none = detailFor(dir, 'pf2', {
      work_type: 'epic',
      phases: { discovery: { items: { billing: { source: 'discovery' } } } },
    });
    assert.deepStrictEqual(options(none), []);
    const onlyTaken = detailFor(dir, 'pf3', {
      work_type: 'epic',
      phases: { discovery: { items: { taken: { source: 'discovery', postponed: true } } } },
    });
    assert.deepStrictEqual(options(onlyTaken), []);
    assert.strictEqual(epicPullForwardMenu(onlyTaken).display, 'No postponed topics waiting.\n');
  });

  it('reactivate-menu: every cancelled unit, each row naming what returns', () => {
    const view = epicReactivateMenu(unitDetail());
    assert.strictEqual(view.title, 'Cancelled Topics');
    assert.strictEqual(view.display, [
      'Topics',
      '  ├─ 1. Gone [cancelled] — never started',
      '  └─ 2. Legacy [cancelled] — discussion [was completed]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to reactivate?`**',
      '',
      '**`1`**      → Reactivate "Gone" — *never started*',
      '**`2`**      → Reactivate "Legacy" — *discussion [was completed]*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'reactivate', 'gone', 'discovery', null],
        ['2', 'reactivate', 'legacy', 'discovery', null],
        ['b', 'back', null, null, null],
      ]
    );
  });

  it('a/cancel shows whenever a unit exists, withdrawing with none; e/reactivate follows the cancelled units', () => {
    const options = (d) => epicMenu('v1', d).keys.filter((k) => ['cancel_topic', 'reactivate_topic'].includes(k.action)).map((k) => drawLabel(k.label));
    assert.deepStrictEqual(options(unitDetail()), ['Cancel a topic', 'Reactivate a cancelled topic']);
    // Zero units keep the empty-state line; the option withdraws only then.
    const bare = detailFor(dir, 'v3', { work_type: 'epic', phases: { planning: { items: { orphan: { status: 'completed' } } } } });
    assert.deepStrictEqual(options(bare), []);
    assert.strictEqual(epicCancelMenu(bare).display, 'No cancellable topics.\n');
  });

  it('p/postpone shows whenever a Discovery unit exists, locked ones included, and withdraws when every topic has left', () => {
    const options = (d) => epicMenu('v1', d).keys.filter((k) => k.action === 'postpone_topic').map((k) => k.label);
    assert.deepStrictEqual(options(unitDetail()), ['Postpone a topic to the roadmap']);
    // A locked unit keeps the option: the reason rides its row, and
    // withdrawing the option would hide the reason with it.
    const locked = detailFor(dir, 'v2', {
      work_type: 'epic',
      phases: {
        discussion: { items: { auth: { status: 'in-progress' } } },
        experiment: { items: { auth: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'running' } } } } },
      },
    });
    assert.ok(locked.postponable[0].locked, 'its live experiment locks the topic');
    assert.deepStrictEqual(options(locked), ['Postpone a topic to the roadmap']);
    // A map whose every row has gone to the roadmap has nothing left to
    // postpone — the empty state, and no option.
    const away = detailFor(dir, 'v3', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { source: 'discovery', postponed: true } } } },
    });
    assert.deepStrictEqual(options(away), []);
    assert.strictEqual(epicPostponeMenu(away).display, 'No postponable topics.\n');
  });

  it('cancel-menu: a topic off the map cues the messages waiting beneath its started item, as a map row does', () => {
    const mailbox = mailboxOf(dir, 'quiz-competition-v1', 'menu-admin');
    fs.mkdirSync(mailbox, { recursive: true });
    fs.writeFileSync(path.join(mailbox, '001-cost-model.md'), '### cost model\n');
    const view = epicCancelMenu(detailFor(dir, 'quiz-competition-v1', {
      work_type: 'epic',
      phases: { discussion: { items: { 'menu-admin': { status: 'in-progress' } } } },
    }));
    assert.ok(view.display.includes('  └─ 1. Menu Admin [discussing · mail waiting]'), view.display);
  });

  it('cancel-menu: an unstarted stub is cancellable with the topic, cued as parked', () => {
    const view = epicCancelMenu(detailFor(dir, 'quiz-competition-v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { 'parked-topic': { status: 'unstarted' }, 'menu-admin': { status: 'in-progress' } } },
      },
    }));
    assert.ok(view.display.includes('  ├─ 1. Menu Admin [discussing]'), view.display);
    assert.ok(view.display.includes('  └─ 2. Parked Topic [fresh · mail waiting]'), view.display);
    assert.ok(/\*\*`2`\*\* +→ Cancel "Parked Topic" — \*fresh · mail waiting\*/.test(view.rendered), view.rendered);
  });

  it('reactivate-menu: a topic cancelled per phase names the item that returns', () => {
    const view = epicReactivateMenu(richDetail());
    assert.strictEqual(view.title, 'Cancelled Topics');
    assert.strictEqual(view.display, [
      'Topics',
      '  └─ 1. Stale Topic [cancelled] — discussion [was in-progress]',
      '',
    ].join('\n'));
    assert.strictEqual(view.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to reactivate?`**',
      '',
      '**`1`**      → Reactivate "Stale Topic" — *discussion [was in-progress]*',
      '**`b/back`** → Return to menu',
    ].join('\n'));
    assert.deepStrictEqual(
      view.keys.map((k) => [k.key, k.action, k.topic, k.phase, k.route]),
      [
        ['1', 'reactivate', 'stale-topic', 'discovery', null],
        ['b', 'back', null, null, null],
      ]
    );
  });

  it('reactivate-menu: a missing previous_status reads as never started — the item returns to never-attempted', () => {
    const d = detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { dropped: { status: 'cancelled' } } } },
    });
    const view = epicReactivateMenu(d);
    assert.strictEqual(view.display, [
      'Topics',
      '  └─ 1. Dropped [cancelled] — discussion (never started)',
      '',
    ].join('\n'));
  });

  it('the laboratory\'s hold cues its topic\'s cancel row', () => {
    const d = detailFor(dir, 'v4', {
      work_type: 'epic',
      phases: {
        discovery: { items: { synonyms: { source: 'discovery', cancelled: true }, lab: { source: 'discovery' } } },
        discussion: { items: { synonyms: { status: 'cancelled', previous_status: 'completed' }, lab: { status: 'in-progress' } } },
        experiment: { items: { lab: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'running' } } } } },
      },
    });
    const presence = [{ phase: 'experiment', topic: 'lab', age_seconds: 45, held: true, session_id: 's1' }];
    assert.deepStrictEqual(epicReactivateMenu(d, { presence }).keys.map((k) => [k.key, k.topic, k.phase]), [['1', 'synonyms', 'discovery'], ['b', null, null]]);
    assert.ok(epicCancelMenu(d, { presence }).display.replace(/\n {5,}/g, ' ').includes('Lab [discussing] · in session (last active 45s ago)'),
      "the laboratory's hold cues its topic's cancel row");
  });

  it('an off-map topic whose discussion is cancelled is no cancellable unit; it reads cancelled and offers its return', () => {
    const d = detailFor(dir, 'v8', {
      work_type: 'epic',
      phases: {
        discussion: { items: { legacy: { status: 'cancelled', previous_status: 'completed' } } },
      },
    });
    assert.deepStrictEqual(d.cancellable.map((u) => u.name), [], 'nothing live under its name');
    assert.deepStrictEqual(d.cancelled, [{ name: 'legacy', stage: 'discovery', restores: [{ phase: 'discussion', previous_status: 'completed' }] }]);
    assert.strictEqual(epicReactivateMenu(d).display, 'Topics\n  └─ 1. Legacy [cancelled] — discussion [was completed]\n');
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
        discussion: { items: { 'auth-flow': { status: 'completed' }, 'kitchen-hardware': { status: 'completed' } } },
      },
    });
    const out = execFileSync('node', [ADAPTER, 'completed-menu', 'quiz-competition-v1'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out, [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'work_unit: quiz-competition-v1',
      'ACTIONS (key  word  action  topic  phase  → route):',
      '  1  —  resume  auth-flow  discussion  → /leeway-discussion-process epic quiz-competition-v1 auth-flow',
      '  2  —  resume  kitchen-hardware  discussion  → /leeway-discussion-process epic quiz-competition-v1 kitchen-hardware',
      '  b  back  back  —  —  → (internal)',
      '',
      '=== TITLE (emit verbatim as markdown (not a code block) — the view\'s chrome heading) ===',
      '# **`■ Completed Topics`**',
      '',
      '=== DISPLAY (emit verbatim as a text code block (```text fence)) ===',
      'Discussion',
      '  ├─ 1. Auth Flow [completed]',
      '  └─ 2. Kitchen Hardware [completed]',
      '',
      '=== MENU: resume pick (emit verbatim as markdown (not a code block)) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Which topic would you like to resume?`**',
      '',
      '**`1`**      → Resume "Auth Flow" — *discussion*',
      '**`2`**      → Resume "Kitchen Hardware" — *discussion*',
      '**`b/back`** → Return to menu',
      '',
    ].join('\n'));
  });
});

describe('epic projections: the topic-grain experiment entry', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function labDetail(overrides = {}) {
    return detailFor(dir, 'lab', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            timing: { source: 'discovery', order: 1, summary: 'Timing behaviour' },
            layout: { source: 'discovery', order: 2, summary: 'Layout rules' },
          },
        },
        discussion: { items: { timing: { status: 'in-progress', awaiting_experiments: ['E1'] }, layout: { status: 'in-progress' } } },
        experiment: {
          items: {
            timing: {
              status: 'in-progress',
              experiments: {
                E1: { slug: 'window-placement', status: 'running' },
                'E1.1': { slug: 'single-monitor', status: 'conceived' },
                E2: { slug: 'multi-monitor', status: 'concluded', verdict: 'held' },
              },
            },
          },
        },
        ...overrides,
      },
    });
  }

  it('a topic with live records renders one entry, leading the menu and recommended first', () => {
    const { keys, rendered } = epicMenu('lab', labDetail());
    const first = keys[0];
    assert.strictEqual(first.key, '1');
    assert.strictEqual(first.action, 'continue_experiment');
    assert.strictEqual(first.topic, 'timing');
    assert.strictEqual(first.route, '/leeway-experiment-process epic lab timing');
    // 1 queued: the concluded E2 and the sub-experiment E1.1 stay out of the
    // count — terminal rows have retired and a split is worked through its
    // parent.
    assert.strictEqual(drawLabel(first.label), 'Enter the laboratory for "Timing" — *1 experiment queued*');
    assert.strictEqual(first.recommended, true, 'a live experiment outranks every other recommendation');
    assert.strictEqual(keys.filter((k) => k.action === 'continue_experiment').length, 1,
      'one row per topic — which record to work resolves inside the phase');
    // The italic tail wraps at the pinned width; the span closes at the
    // break and reopens on the continuation, so the flattened line carries
    // the tail as two spans.
    assert.ok(rendered.replace(/\n +/g, ' ').includes('**`1`**           → Enter the laboratory for "Timing" — *1 experiment* *queued* (recommended)'),
      `entry renders with the recommendation marker:\n${rendered}`);
  });

  it('the tail counts the live top-level records', () => {
    const detail = labDetail({
      experiment: {
        items: {
          timing: {
            status: 'in-progress',
            experiments: {
              E1: { slug: 'window-placement', status: 'running' },
              'E1.1': { slug: 'single-monitor', status: 'conceived' },
              E2: { slug: 'multi-monitor', status: 'conceived' },
              E3: { slug: 'stacking-order', status: 'concluded', verdict: 'held' },
            },
          },
        },
      },
    });
    const entry = epicMenu('lab', detail).keys.find((k) => k.action === 'continue_experiment');
    assert.strictEqual(drawLabel(entry.label), 'Enter the laboratory for "Timing" — *2 experiments queued*');
  });

  it('the map row cues the waiting conversation beneath its lifecycle', () => {
    const dash = epicDashboard('lab', labDetail());
    assert.match(dash, /↳ Discussing · awaiting E1/);
  });

  it('a live series lands in the detail\'s in-progress set — completion is never offered over open evidence', () => {
    const detail = labDetail();
    assert.ok(detail.in_progress.some((i) => i.phase === 'experiment' && i.name === 'timing'),
      'the in-progress scan sees the derived item like any other open work');
  });

  it('a settled series retires its entry and the recommendation falls through', () => {
    const detail = labDetail({
      discussion: { items: { timing: { status: 'in-progress' } } },
      experiment: {
        items: {
          timing: {
            status: 'completed',
            experiments: { E1: { slug: 'window-placement', status: 'abandoned', reason: 'moot' } },
          },
        },
      },
    });
    const { keys } = epicMenu('lab', detail);
    assert.ok(!keys.some((k) => k.action === 'continue_experiment'), 'no live record — the entry retires');
    const rec = keys.find((k) => k.recommended);
    assert.notStrictEqual(rec && rec.action, 'continue_experiment');
  });

  it('the series joins neither the resume nor the reactivate candidates — nothing above the records concludes or revives by hand', () => {
    const done = labDetail({
      discussion: { items: { timing: { status: 'in-progress' } } },
      experiment: {
        items: {
          timing: {
            status: 'completed',
            experiments: { E1: { slug: 'window-placement', status: 'concluded', verdict: 'held' } },
          },
        },
      },
    });
    assert.ok(!done.completed.some((i) => i.phase === 'experiment'),
      'a completed series has nothing to resume — a new spawn reopens it');
    assert.deepStrictEqual(done.cancelled, [], 'a settled series is no unit — the topic reads live');
    assert.ok(done.cancellable.some((u) => u.stage === 'discovery' && u.name === 'timing'), 'the topic itself stays cancellable');
  });

  it('an interrupted discovery session still outranks the laboratory — the map itself is mid-shape', () => {
    const detail = labDetail();
    detail.active_session = '002';
    const { keys } = epicMenu('lab', detail);
    const experiment = keys.find((k) => k.action === 'continue_experiment');
    assert.ok(experiment, 'the laboratory entry still renders');
    assert.strictEqual(experiment.recommended, undefined, 'the resume gate is waiting — the laboratory ranks among the topic entries');
    const discoveryOpt = keys.find((k) => k.action === 'continue_discovery');
    assert.strictEqual(discoveryOpt.recommended, true, 'the discovery resume wins');
  });

  it('a held laboratory session strikes the entry and hands the recommendation onward', () => {
    const { keys } = epicMenu('lab', labDetail(), {
      presence: [{ phase: 'experiment', topic: 'timing', age_seconds: 60, held: true, session_id: 'peer', pid: null }],
    });
    const entry = keys.find((k) => k.action === 'continue_experiment');
    assert.strictEqual(entry.in_session, true);
    assert.strictEqual(entry.recommended, undefined, 'a struck row is never the recommendation');
  });
});

describe('epic projections: held entries and the topic\'s cues', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function billing(discussion) {
    return detailFor(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { billing: { source: 'discovery', order: 1 } } },
        ...(discussion ? { discussion: { items: { billing: discussion } } } : {}),
      },
    });
  }
  const numbered = (d) => epicMenu('v1', d).keys.filter((k) => /^\d+$/.test(k.key)).map((k) => [k.key, k.action, k.topic]);

  it('the mail tail speaks for the topic, its one mailbox — a parked stub\'s start row carries it', () => {
    assert.strictEqual(drawLabel(epicMenu('v1', billing({ status: 'unstarted' })).keys[0].label), 'Start discussion for "Billing" — *mail waiting*');
  });

  it('the map row cues the waiting discussion — awaiting each experiment', () => {
    const cue = (d) => epicDashboard('v1', d).match(/↳ [^\n]*/)[0];
    assert.strictEqual(cue(billing({ status: 'in-progress' })), '↳ Discussing');
    assert.strictEqual(cue(billing({ status: 'in-progress', awaiting_experiments: ['E1'] })), '↳ Discussing · awaiting E1');
  });

  // The cue reads the mailbox, not the status: a landing on a concluded topic
  // reopens it to in-progress and leaves no stub behind, so the message files
  // themselves are the signal — and their drain retires it.
  const deliver = (...files) => {
    const mailbox = mailboxOf(dir, 'v1', 'billing');
    fs.mkdirSync(mailbox, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(mailbox, f), `### ${f}\n`);
    return mailbox;
  };
  // A long cue wraps onto continuation lines indented past the ↳ — join them.
  const cueOf = (d, presence) => epicDashboard('v1', d, { presence }).match(/( *)↳ [^\n]*(?:\n\1 +[^\n]*)*/)[0].trim().replace(/\n\s+/g, ' ');

  it('a reopened discussion with messages waiting: its continue row and map row carry the cue', () => {
    deliver('001-escalation-path.md');
    const d = billing({ status: 'in-progress' });
    assert.deepStrictEqual(numbered(d), [['1', 'continue_discussion', 'billing']]);
    assert.strictEqual(drawLabel(epicMenu('v1', d).keys[0].label), 'Continue "Billing" — *discussion* · mail waiting');
    assert.strictEqual(cueOf(d), '↳ Discussing · mail waiting');
    assert.strictEqual(d.discovery_map[0].mail_queued, 1);
  });

  it('the drain retires the cue — an empty mailbox directory is no wait', () => {
    const mailbox = deliver('001-escalation-path.md');
    fs.rmSync(path.join(mailbox, '001-escalation-path.md'));
    const d = billing({ status: 'in-progress' });
    assert.strictEqual(drawLabel(epicMenu('v1', d).keys[0].label), 'Continue "Billing" — *discussion*');
    assert.strictEqual(cueOf(d), '↳ Discussing');
    assert.strictEqual(d.discovery_map[0].mail_waiting, false);
    assert.strictEqual(d.discovery_map[0].mail_queued, 0);
  });
});
