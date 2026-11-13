'use strict';

// The roadmap's screens over derived roadmap state (projections/roadmap.cjs):
// the roadmap's home as its projection lays it out — each horizon's waiting
// items, where each came from, one column, and the title cut short at the
// width (18.8.10). The home's rows, where each leads and the empty home, as
// `render roadmap` draws them, and the harvest's screen, are
// test-engine-roadmap-menu.cjs's.
//
// Layer: unit. The state is a value, the shape roadmapState answers, at the
// hermetic 65 columns.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { roadmapScreen } = require('../../skills/leeway-engine/scripts/domain/projections/roadmap.cjs');

/** A derived-state fixture — the shape roadmapState returns. */
function state(items, horizons = ['mvp', 'v1']) {
  const totals = { items: items.length, waiting: 0, in_flight: 0, shipped: 0, orphaned: 0 };
  for (const i of items) {
    if (i.state === 'waiting') totals.waiting++;
    else if (i.state === 'in-flight') totals.in_flight++;
    else if (i.state === 'shipped') totals.shipped++;
    else totals.orphaned++;
  }
  return { exists: true, horizons, items, archived: [], totals, session_logs: [] };
}

/** A waiting item. @param {string} name @param {string|null} horizon @param {string} origin @param {string} [kind] */
const waiting = (name, horizon, origin, kind = 'idea') => ({ name, horizon, summary: `${name} summary`, kind, origin, sources: [], state: 'waiting' });

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

describe('the roadmap\'s home (18.8.10)', () => {
  it('18.S35, 18.8.5: each horizon in the person\'s order with what waits on it, numbered across the horizons, one line each with its kind and where it came from, the column one across every horizon; an item in flight left out', () => {
    const screen = roadmapScreen('Fumi', state([...ROWS, ...FIXES], ['v1', 'mvp']));

    assert.deepStrictEqual([screen.title, screen.shows], ['Roadmap · Fumi', [
      'v1 (1)',
      '  └─ 1. Loyalty        idea · mvp',
      '',
      'mvp (3)',
      '  ├─ 2. Menus          idea · discovery',
      '  ├─ 3. Kds            idea · discovery',
      '  └─ 4. Login Crash    bug · inbox',
    ]]);
  });

  it('where an item came from: discovery for the product\'s conversation, the inbox, the roadmap\'s own n, else the unit it left', () => {
    const items = [
      waiting('a', 'mvp', 'harvest'),
      waiting('b', 'mvp', 'park:product'),
      waiting('c', 'mvp', 'inbox:2026-03-01--c'),
      waiting('d', 'mvp', 'roadmap'),
      waiting('e', 'mvp', 'park:checkout'),
      waiting('f', 'mvp', 'postpone:launch'),
      waiting('g', 'mvp', 'topic:saved-views/saved-views'),
    ];
    const origins = roadmapScreen('Fumi', state(items)).shows.slice(1).map((line) => line.split(' · ')[1]);

    assert.deepStrictEqual(origins, ['discovery', 'discovery', 'inbox', 'roadmap', 'checkout', 'launch', 'saved-views']);
  });

  it('a title that would run into the column is cut short with an ellipsis, the column held at the width less the widest tag', () => {
    const long = 'storage-over-a-network-sftp-and-a-nas-and-every-cloud-drive';
    const { shows } = roadmapScreen('Fumi', state([waiting(long, 'later', 'harvest', 'quick-fix'), waiting('a-lifetime-tier', 'later', 'harvest')], ['later']));

    assert.deepStrictEqual(shows, [
      'later (2)',
      '  ├─ 1. Storage Over A Network Sftp And…    quick-fix · discovery',
      '  └─ 2. A Lifetime Tier                     idea · discovery',
    ]);
    assert.strictEqual(shows[1].length, 65);
  });

  it('18.8.20: an item put back on no horizon trails under "(no horizon)"', () => {
    const { shows } = roadmapScreen('Fumi', state([waiting('menus', 'mvp', 'harvest'), waiting('exports', null, 'harvest')]));

    assert.deepStrictEqual(shows.slice(-2), ['(no horizon)', '  └─ 2. Exports    idea · discovery']);
  });

});
