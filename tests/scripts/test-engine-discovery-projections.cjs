'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/leeway-discovery/scripts/gateway.cjs');
const { discoveryMapView, discoverySynthesisView } = require('../../skills/leeway-engine/scripts/domain/projections/discovery-map.cjs');

const ADAPTER = path.resolve(__dirname, '../../skills/leeway-discovery/scripts/gateway.cjs');

// Golden tests: byte-exact expected strings for the discovery-session map
// renders. Fixtures go through real manifests in temp dirs and the adapter's
// own discover(), so the goldens cover the full derivation path (manifest →
// discovery result → projection). Long wrapped summaries are the point — the
// hand-drawn render this projection replaced wrapped raggedly.

/** All five tiers, plural rows, so glyphs, labels, and the breakdown all show; a started topic renamed, by its title. */
function richFixture(dir) {
  createManifest(dir, 'payments', {
    work_type: 'epic',
    phases: {
      discovery: {
        items: {
          'kitchen-hardware': { source: 'discovery', summary: 'printers and tills', title: 'kitchen-kit' },
          'menu-management': { source: 'discovery', summary: 'menus', postponed: true },
          'ordering-flow': { source: 'discovery', summary: 'order lifecycle' },
          'loyalty': { source: 'discovery', summary: 'points and rewards' },
          'operator-analytics': { source: 'discovery', summary: 'dashboards' },
          'legacy-import': { source: 'discovery' },
        },
        dismissed: ['old-idea'],
      },
      discussion: {
        items: {
          'kitchen-hardware': { status: 'in-progress' },
          'ordering-flow': { status: 'completed' },
          'legacy-import': { status: 'cancelled' },
        },
      },
    },
  });
}

function mapOf(dir, workUnit) {
  const result = discover(dir, workUnit);
  assert.strictEqual(result.error, undefined);
  return { rows: result.discovery_map, summary: result.map_summary };
}

describe('discoveryMapView', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('renders the header, the tier breakdown, and one state-noted row per topic in tier order, each by its title (P2)', () => {
    richFixture(dir);
    assert.strictEqual(discoveryMapView('payments', mapOf(dir, 'payments')), [
      'Discovery Map (6 topics — 1 decided · 1 in flight · 2 fresh · 1',
      'cancelled · 1 postponed)',
      '  ├─ ✓ Ordering Flow',
      '  │     ↳ Decided',
      '  │',
      '  ├─ ◐ Kitchen Kit',
      '  │     ↳ Discussing',
      '  │',
      '  ├─ ○ Loyalty',
      '  │     ↳ Fresh',
      '  │',
      '  ├─ ○ Operator Analytics',
      '  │     ↳ Fresh',
      '  │',
      '  ├─ ⊘ Legacy Import',
      '  │     ↳ Cancelled',
      '  │',
      '  └─ ⊖ Menu Management',
      '        ↳ Postponed',
      '',
    ].join('\n'));
  });

  it('omits the breakdown when only one tier bucket is non-zero', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'alpha': { source: 'discovery' },
            'beta': { source: 'discovery' },
          },
        },
      },
    });
    assert.strictEqual(discoveryMapView('v1', mapOf(dir, 'v1')), [
      'Discovery Map (2 topics)',
      '  ├─ ○ Alpha',
      '  │     ↳ Fresh',
      '  │',
      '  └─ ○ Beta',
      '        ↳ Fresh',
      '',
    ].join('\n'));
  });

  it('a live evidence wait cues the map row — the conversation is blocked on the laboratory', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: { items: { alpha: { source: 'discovery' } } },
        discussion: { items: { alpha: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
        experiment: { items: { alpha: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'running' } } } } },
      },
    });
    assert.strictEqual(discoveryMapView('v1', mapOf(dir, 'v1')), [
      'Discovery Map (1 topic)',
      '  └─ ◐ Alpha',
      '        ↳ Discussing · awaiting E1',
      '',
    ].join('\n'));
  });

  it('renders (empty) for a map with no items', () => {
    createManifest(dir, 'v1', { work_type: 'epic', phases: {} });
    assert.strictEqual(discoveryMapView('v1', mapOf(dir, 'v1')), [
      'Discovery Map (0 topics)',
      '  (empty)',
      '',
    ].join('\n'));
  });
});

describe('discoverySynthesisView', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  const PROPOSED = [
    {
      name: 'kitchen-printers',
      summary: 'Print routing by station, failure handling, and offline queueing for kitchen ticket printers across multiple sites',
      description: 'Tickets must keep printing through a network drop, and each station only wants its own lines.',
    },
    {
      name: 'operator-analytics',
      summary: 'Daily service dashboards for shift leads — covers order throughput, voids, and prep-time drift with per-branch comparison',
      description: 'Shift leads read these after service; what can be measured cheaply is still unknown.',
    },
    { name: 'loyalty', summary: 'Points and rewards', description: 'Repeat diners earn points toward rewards.' },
  ];

  it('wraps long summaries under aligned rows and keeps the existing map below — continuing session', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'payments-core': { source: 'discovery' },
            'onboarding-flow': { source: 'discovery' },
          },
        },
        discussion: { items: { 'payments-core': { status: 'in-progress' }, 'onboarding-flow': { status: 'completed' } } },
      },
    });
    assert.strictEqual(discoverySynthesisView('payments', mapOf(dir, 'payments'), PROPOSED), [
      'Synthesised Discovery Map — Payments',
      '',
      'New this session (3)',
      '  ├─ ○ Kitchen Printers',
      '  │     Print routing by station, failure handling, and offline',
      '  │     queueing for kitchen ticket printers across multiple',
      '  │     sites',
      '  │',
      '  │     Tickets must keep printing through a network drop, and',
      '  │     each station only wants its own lines.',
      '  │',
      '  ├─ ○ Operator Analytics',
      '  │     Daily service dashboards for shift leads — covers order',
      '  │     throughput, voids, and prep-time drift with per-branch',
      '  │     comparison',
      '  │',
      '  │     Shift leads read these after service; what can be',
      '  │     measured cheaply is still unknown.',
      '  │',
      '  └─ ○ Loyalty',
      '        Points and rewards',
      '',
      '        Repeat diners earn points toward rewards.',
      '',
      'Already on the map (2)',
      '  ├─ ✓ Onboarding Flow',
      '  │     ↳ Decided',
      '  │',
      '  └─ ◐ Payments Core',
      '        ↳ Discussing',
      '',
      '3 topics. Summaries and descriptions come from the exploration.',
      '',
    ].join('\n'));
  });

  it('renders a first-session proposal with no existing-map section', () => {
    createManifest(dir, 'payments', { work_type: 'epic', phases: {} });
    assert.strictEqual(discoverySynthesisView('payments', mapOf(dir, 'payments'), [PROPOSED[2]]), [
      'Synthesised Discovery Map — Payments',
      '',
      'Proposed topics (1)',
      '  └─ ○ Loyalty',
      '        Points and rewards',
      '',
      '        Repeat diners earn points toward rewards.',
      '',
      '1 topic. Summaries and descriptions come from the exploration.',
      '',
    ].join('\n'));
  });

  it('throws on an empty proposed set — nothing to render', () => {
    createManifest(dir, 'payments', { work_type: 'epic', phases: {} });
    assert.throws(() => discoverySynthesisView('payments', mapOf(dir, 'payments'), []), /proposed set is empty/);
  });
});

// ---------------------------------------------------------------------------
// Adapter: the map-view gateway verb and the byte-stable positional form.
// ---------------------------------------------------------------------------

describe('gateway.cjs adapter: map-view', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @param {string[]} args */
  function run(args) {
    return spawnSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('emits DATA + DISPLAY sections and no MENU — a map shown for reading carries no gate', () => {
    richFixture(dir);
    const res = run(['map-view', 'payments']);
    assert.strictEqual(res.status, 0);
    assert.ok(res.stdout.includes('=== DATA (reason from this — never display or parse the sections below) ==='));
    assert.ok(res.stdout.includes('=== DISPLAY (emit verbatim as a text code block (```text fence)) ==='));
    assert.ok(!res.stdout.includes('=== MENU'));
    assert.match(res.stdout, /mode: map\n/);
    assert.match(res.stdout, /map: 6 topics — 1 decided, 1 in-flight, 2 fresh, 1 cancelled, 1 postponed/);
    assert.ok(res.stdout.includes('  ├─ ◐ Kitchen Kit\n  │     ↳ Discussing'));
  });

  it('--proposed-file renders the synthesis view and flags each proposed name in DATA', () => {
    richFixture(dir);
    // A waiting roadmap idea sharing a proposed name — the anti-twin flag; a
    // pulled one does not fire it (its collision is the join's business), nor
    // a waiting bug, which never becomes a topic.
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
      roadmap: {
        horizons: ['v1'],
        items: {
          'kitchen-printers': { horizon: 'v1', summary: 'waiting twin', kind: 'idea', origin: 'harvest' },
          'old-idea': { horizon: 'v1', summary: 'pulled elsewhere', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'payments' } },
          'receipt-crash': { horizon: 'v1', summary: 'a waiting bug', kind: 'bug', origin: 'harvest' },
        },
      },
    }, null, 2));
    createFile(dir, 'proposed.json', JSON.stringify([
      { name: 'kitchen-printers', summary: 'Print routing by station', description: 'd' },
      { name: 'menu-management', summary: 'collides with an active item', description: 'd' },
      { name: 'old-idea', summary: 'previously dismissed', description: 'd' },
      { name: 'Bad_Name', summary: 'no lowercase slug, so no folder name', description: 'd' },
      { name: 'receipt-crash', summary: 'shares a waiting bug\'s name', description: 'd' },
    ]));
    const res = run(['map-view', 'payments', '--proposed-file', 'proposed.json']);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /mode: synthesis\n/);
    assert.match(res.stdout, /proposed \(5\):/);
    assert.match(res.stdout, /^ {2}receipt-crash exists_on_map=false matches_dismissed=false legal_name=true waiting_on_roadmap=false$/m);
    assert.match(res.stdout, /^ {2}kitchen-printers exists_on_map=false matches_dismissed=false legal_name=true waiting_on_roadmap=true$/m);
    assert.match(res.stdout, /^ {2}menu-management exists_on_map=true matches_dismissed=false legal_name=true waiting_on_roadmap=false$/m);
    assert.match(res.stdout, /^ {2}old-idea exists_on_map=false matches_dismissed=true legal_name=true waiting_on_roadmap=false$/m);
    assert.match(res.stdout, /^ {2}Bad_Name exists_on_map=false matches_dismissed=false legal_name=false waiting_on_roadmap=false$/m);
    assert.ok(res.stdout.includes('\nSynthesised Discovery Map — Payments'));
    assert.ok(res.stdout.includes('\nNew this session (5)\n'));
    assert.ok(res.stdout.includes('\nAlready on the map (6)\n'));
  });

  it('fails loudly on a missing, malformed, or empty proposed file', () => {
    richFixture(dir);
    const missing = run(['map-view', 'payments', '--proposed-file', 'ghost.json']);
    assert.strictEqual(missing.status, 1);
    assert.match(missing.stderr, /proposed-topics file not found/);

    createFile(dir, 'bad.json', 'not json');
    const malformed = run(['map-view', 'payments', '--proposed-file', 'bad.json']);
    assert.strictEqual(malformed.status, 1);
    assert.match(malformed.stderr, /not valid JSON/);

    createFile(dir, 'empty.json', '[]');
    const empty = run(['map-view', 'payments', '--proposed-file', 'empty.json']);
    assert.strictEqual(empty.status, 1);
    assert.match(empty.stderr, /non-empty JSON array/);

    createFile(dir, 'shape.json', JSON.stringify([{ name: 'x' }]));
    const shape = run(['map-view', 'payments', '--proposed-file', 'shape.json']);
    assert.strictEqual(shape.status, 1);
    assert.match(shape.stderr, /missing "summary"/);

    createFile(dir, 'undescribed.json', JSON.stringify([{ name: 'x', summary: 's', description: '  ' }]));
    const undescribed = run(['map-view', 'payments', '--proposed-file', 'undescribed.json']);
    assert.strictEqual(undescribed.status, 1);
    assert.match(undescribed.stderr, /missing "description"/);
  });

  it('fails loudly on a missing work unit, unknown flags, and a bad work-unit name', () => {
    const noWu = run(['map-view']);
    assert.strictEqual(noWu.status, 1);
    assert.match(noWu.stderr, /Usage: gateway.cjs map-view/);

    richFixture(dir);
    const badFlag = run(['map-view', 'payments', '--frobnicate']);
    assert.strictEqual(badFlag.status, 1);
    assert.match(badFlag.stderr, /unexpected argument "--frobnicate"/);

    const ghost = run(['map-view', 'ghost']);
    assert.strictEqual(ghost.status, 1);
    assert.match(ghost.stderr, /not found/);
  });

  it('keeps the positional dump byte-identical to the library format — the legacy contract', () => {
    richFixture(dir);
    const res = run(['payments']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stdout, format(discover(dir, 'payments')));
  });

  it('keeps the positional error contract: error text on stdout, exit 2', () => {
    const res = run(['ghost']);
    assert.strictEqual(res.status, 2);
    assert.match(res.stdout, /^error: Work unit "ghost" not found/);
  });

  it('keeps the no-args contract: usage on stderr, exit 1', () => {
    const res = run([]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /work unit name required/);
  });
});
