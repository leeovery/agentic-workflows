'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { loadManifest } = require('../../skills/leeway-engine/scripts/domain/reads.cjs');
const { buildDiscoveryMap } = require('../../skills/leeway-engine/scripts/domain/derivations.cjs');
const { discoveryMapView } = require('../../skills/leeway-engine/scripts/domain/projections/discovery-map.cjs');

// Golden tests: byte-exact expected strings for the map's render. Fixtures go
// through real manifests in temp dirs and the one map-row builder, so the
// goldens cover the full derivation path (manifest → map rows → projection).
// Long wrapped summaries are the point — the hand-drawn render this
// projection replaced wrapped raggedly.

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
  const { map, summary } = buildDiscoveryMap(loadManifest(dir, workUnit), path.join(dir, '.leeway'));
  return { rows: map, summary };
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
