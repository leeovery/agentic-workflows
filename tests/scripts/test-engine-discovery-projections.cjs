'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-discovery/scripts/discovery.cjs');
const { discoveryMapView, discoverySynthesisView } = require('../../skills/workflow-engine/scripts/domain/projections/discovery.cjs');

const ADAPTER = path.resolve(__dirname, '../../skills/workflow-discovery/scripts/discovery.cjs');

// Golden tests: byte-exact expected strings for the discovery-session map
// renders. Fixtures go through real manifests in temp dirs and the adapter's
// own discover(), so the goldens cover the full derivation path (manifest →
// discovery result → projection). Long wrapped summaries are the point — the
// hand-drawn render this projection replaced wrapped raggedly.

/** All six tiers, plural rows, so glyphs, labels, and the breakdown all show. */
function richFixture(dir) {
  createManifest(dir, 'payments', {
    work_type: 'epic',
    phases: {
      discovery: {
        items: {
          'kitchen-hardware': { routing: 'research', source: 'discovery', summary: 'printers and tills' },
          'menu-management': { routing: 'research', source: 'discovery', summary: 'menus' },
          'ordering-flow': { routing: 'discussion', source: 'discovery', summary: 'order lifecycle' },
          'loyalty': { source: 'discovery', summary: 'points and rewards' },
          'operator-analytics': { routing: 'research', source: 'discovery', summary: 'dashboards' },
          'umbrella': { routing: 'research', source: 'discovery', handled: true },
          'legacy-import': { routing: 'research', source: 'discovery' },
        },
        dismissed: ['old-idea'],
      },
      research: {
        items: {
          'kitchen-hardware': { status: 'completed' },
          'menu-management': { status: 'in-progress' },
          'legacy-import': { status: 'cancelled' },
        },
      },
      discussion: {
        items: {
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

  it('renders the box, the tier breakdown, and one labelled row per topic in tier order', () => {
    richFixture(dir);
    assert.strictEqual(discoveryMapView('payments', mapOf(dir, 'payments')), [
      '●───────────────────────────────────────────────●',
      '  Discovery — Payments',
      '●───────────────────────────────────────────────●',
      '',
      '  Discovery Map (7 topics — 1 decided · 1 in flight · 1 ready · 2 fresh · 1 handled · 1 cancelled)',
      '  ├─ → Kitchen Hardware [research complete · ready for discussion]',
      '  ├─ ◐ Menu Management [researching]',
      '  ├─ ✓ Ordering Flow [decided]',
      '  ├─ ○ Loyalty [fresh]',
      '  ├─ ○ Operator Analytics [fresh · routed to research]',
      '  ├─ ⊙ Umbrella [handled · research fanned out]',
      '  └─ ⊘ Legacy Import [cancelled]',
      '',
    ].join('\n'));
  });

  it('omits the breakdown when only one tier bucket is non-zero', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'alpha': { routing: 'research', source: 'discovery' },
            'beta': { routing: 'discussion', source: 'discovery' },
          },
        },
      },
    });
    assert.strictEqual(discoveryMapView('v1', mapOf(dir, 'v1')), [
      '●───────────────────────────────────────────────●',
      '  Discovery — V1',
      '●───────────────────────────────────────────────●',
      '',
      '  Discovery Map (2 topics)',
      '  ├─ ○ Alpha [fresh · routed to research]',
      '  └─ ○ Beta [fresh · routed to discussion]',
      '',
    ].join('\n'));
  });

  it('renders (empty) for a map with no items', () => {
    createManifest(dir, 'v1', { work_type: 'epic', phases: {} });
    assert.strictEqual(discoveryMapView('v1', mapOf(dir, 'v1')), [
      '●───────────────────────────────────────────────●',
      '  Discovery — V1',
      '●───────────────────────────────────────────────●',
      '',
      '  Discovery Map (0 topics)',
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
      routing: 'discussion',
      summary: 'Print routing by station, failure handling, and offline queueing for kitchen ticket printers across multiple sites',
    },
    {
      name: 'operator-analytics',
      routing: 'research',
      summary: 'Daily service dashboards for shift leads — covers order throughput, voids, and prep-time drift with per-branch comparison',
    },
    { name: 'loyalty', routing: 'discussion', summary: 'Points and rewards' },
  ];

  it('wraps long summaries under aligned rows and keeps the existing map below — continuing session', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'payments-core': { routing: 'research', source: 'discovery' },
            'onboarding-flow': { routing: 'discussion', source: 'discovery' },
          },
        },
        research: { items: { 'payments-core': { status: 'in-progress' } } },
        discussion: { items: { 'onboarding-flow': { status: 'completed' } } },
      },
    });
    assert.strictEqual(discoverySynthesisView('payments', mapOf(dir, 'payments'), PROPOSED), [
      '  Synthesised Discovery Map — Payments',
      '',
      '  New this session (3):',
      '  ├─ ○ Kitchen Printers [discussion]',
      '  │     Print routing by station, failure handling, and offline',
      '  │     queueing for kitchen ticket printers across multiple',
      '  │     sites',
      '  ├─ ○ Operator Analytics [research]',
      '  │     Daily service dashboards for shift leads — covers order',
      '  │     throughput, voids, and prep-time drift with per-branch',
      '  │     comparison',
      '  └─ ○ Loyalty [discussion]',
      '        Points and rewards',
      '',
      '  Already on the map (2):',
      '  ├─ ◐ Payments Core [researching]',
      '  └─ ✓ Onboarding Flow [decided]',
      '',
      '  3 topic(s). Summaries come from the exploration; routing is my',
      '  read of where each one goes next.',
      '',
    ].join('\n'));
  });

  it('renders a first-session proposal with no existing-map section', () => {
    createManifest(dir, 'payments', { work_type: 'epic', phases: {} });
    assert.strictEqual(discoverySynthesisView('payments', mapOf(dir, 'payments'), [PROPOSED[2]]), [
      '  Synthesised Discovery Map — Payments',
      '',
      '  Proposed topics (1):',
      '  └─ ○ Loyalty [discussion]',
      '        Points and rewards',
      '',
      '  1 topic(s). Summaries come from the exploration; routing is my',
      '  read of where each one goes next.',
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

describe('discovery.cjs adapter: map-view', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @param {string[]} args */
  function run(args) {
    return spawnSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('emits DATA + DISPLAY sections and no MENU — the confirm gate stays prose', () => {
    richFixture(dir);
    const res = run(['map-view', 'payments']);
    assert.strictEqual(res.status, 0);
    assert.ok(res.stdout.includes('=== DATA (reason from this — never display or parse the sections below) ==='));
    assert.ok(res.stdout.includes('=== DISPLAY (emit verbatim as a code block) ==='));
    assert.ok(!res.stdout.includes('=== MENU'));
    assert.match(res.stdout, /mode: map\n/);
    assert.match(res.stdout, /map: 7 topics — 1 decided, 1 in-flight, 1 ready, 2 fresh, 1 handled, 1 cancelled/);
    assert.ok(res.stdout.includes('  ├─ → Kitchen Hardware [research complete · ready for discussion]'));
  });

  it('--proposed-file renders the synthesis view and flags each proposed name in DATA', () => {
    richFixture(dir);
    createFile(dir, 'proposed.json', JSON.stringify([
      { name: 'kitchen-printers', routing: 'discussion', summary: 'Print routing by station' },
      { name: 'menu-management', routing: 'research', summary: 'collides with an active item' },
      { name: 'old-idea', routing: 'research', summary: 'previously dismissed' },
      { name: 'bad.name', routing: 'research', summary: 'dots break addressing' },
    ]));
    const res = run(['map-view', 'payments', '--proposed-file', 'proposed.json']);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /mode: synthesis\n/);
    assert.match(res.stdout, /proposed \(4\):/);
    assert.match(res.stdout, /kitchen-printers routing=discussion exists_on_map=false matches_dismissed=false legal_name=true/);
    assert.match(res.stdout, /menu-management routing=research exists_on_map=true matches_dismissed=false legal_name=true/);
    assert.match(res.stdout, /old-idea routing=research exists_on_map=false matches_dismissed=true legal_name=true/);
    assert.match(res.stdout, /bad\.name routing=research exists_on_map=false matches_dismissed=false legal_name=false/);
    assert.ok(res.stdout.includes('  Synthesised Discovery Map — Payments'));
    assert.ok(res.stdout.includes('  New this session (4):'));
    assert.ok(res.stdout.includes('  Already on the map (7):'));
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

    createFile(dir, 'shape.json', JSON.stringify([{ name: 'x', routing: 'research' }]));
    const shape = run(['map-view', 'payments', '--proposed-file', 'shape.json']);
    assert.strictEqual(shape.status, 1);
    assert.match(shape.stderr, /missing "summary"/);
  });

  it('fails loudly on a missing work unit, unknown flags, and a bad work-unit name', () => {
    const noWu = run(['map-view']);
    assert.strictEqual(noWu.status, 1);
    assert.match(noWu.stderr, /Usage: discovery.cjs map-view/);

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
