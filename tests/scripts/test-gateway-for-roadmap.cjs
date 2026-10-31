'use strict';

// The leeway-roadmap adapter: the home snapshot, the pull working set, and
// the harvest proposal overlay — sections, flags, and refusals.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');

const ADAPTER = path.resolve(__dirname, '../../skills/leeway-roadmap/scripts/gateway.cjs');

function writeRoadmap(dir, roadmap) {
  const p = path.join(dir, '.leeway', 'manifest.json');
  const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  fs.writeFileSync(p, JSON.stringify({ ...existing, roadmap }, null, 2));
}

const MAP = {
  horizons: ['mvp', 'v1'],
  items: {
    ordering: { horizon: 'mvp', summary: 'customers order', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'mvp' } },
    menus: { horizon: 'mvp', summary: 'operators maintain', kind: 'idea', origin: 'harvest' },
    loyalty: { horizon: 'v1', summary: 'rewards', kind: 'bug', origin: 'park:mvp' },
  },
};

describe('leeway-roadmap gateway: view', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('emits DATA + TITLE + DISPLAY + MENU with the state tables and action keys', () => {
    writeRoadmap(dir, MAP);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    createFile(dir, '.leeway/.product/sessions/session-001.md', '# Product Session 001\n');
    createFile(dir, '.leeway/.product/sessions/session-002.md', '# Product Session 002\n');
    const res = run(['view']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.match(res.stdout, /=== DATA [^\n]*\nexists: true\nhorizons: mvp, v1\ntotals: /, 'the DATA opens on the roadmap\'s own state');
    assert.match(res.stdout, /ITEMS \(name {2}horizon {2}kind {2}state {2}work_unit\):/);
    assert.match(res.stdout, /  ordering {2}mvp {2}idea {2}in-flight {2}mvp/);
    assert.match(res.stdout, /  loyalty {2}v1 {2}bug {2}waiting {2}—/);
    assert.match(res.stdout, /SESSIONS \(number {2}path\):/);
    assert.match(res.stdout, /ACTIONS \(key {2}word {2}action\):/);
    assert.match(res.stdout, /ACTIONS \(key {2}word {2}action\):\n  w {2}work {2}pull\n  p {2}product {2}open_product\n  b {2}back {2}back\n/,
      'work, then the product\'s conversation, then back (18.8.6)');
    assert.match(res.stdout, /=== TITLE[\s\S]*Roadmap/);
    assert.match(res.stdout, /=== DISPLAY[\s\S]*◐ Ordering/);
    assert.match(res.stdout, /Loyalty\n.*rewards\n.*↳ Bug · waiting/);
    assert.match(res.stdout, /Start work on waiting item\(s\) — creates a piece of\s+work \(2 waiting\)/);
    assert.match(res.stdout, /=== MENU[\s\S]*\*\*`p\/product`\*\*\s+→ Talk about the product\n/);
    // The way out of the roadmap is the surface it was entered from.
    assert.match(res.stdout, /\*\*`b\/back`\*\*\s+→ Return to the start menu/);
  });

  it('names every call — no bare call answers the home and its menu', () => {
    writeRoadmap(dir, MAP);
    const res = run([]);
    assert.notStrictEqual(res.status, 0);
    assert.strictEqual(res.stdout, '');
    assert.match(res.stderr, /no `index` handler registered/);
  });

  it('drops the work row with nothing waiting, the product\'s conversation still there', () => {
    writeRoadmap(dir, {
      horizons: ['mvp'],
      items: { ordering: { horizon: 'mvp', summary: 's', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'mvp' } } },
    });
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    const res = run(['view']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.match(res.stdout, /ACTIONS \(key {2}word {2}action\):\n  p {2}product {2}open_product\n  b {2}back {2}back\n/, 'no pull action over zero waiting items');
  });
});

describe('leeway-roadmap gateway: pull-set', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('numbers waiting items with the resolving table and the select menu', () => {
    writeRoadmap(dir, MAP);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    const res = run(['pull-set']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.match(res.stdout, /ITEMS \(n {2}name {2}horizon {2}kind\):/);
    assert.match(res.stdout, /  1 {2}menus {2}mvp {2}idea/);
    assert.match(res.stdout, /  2 {2}loyalty {2}v1 {2}bug/);
    assert.match(res.stdout, /└─ 2\. Loyalty \[bug\] — rewards/);
    assert.ok(!/=== TITLE/.test(res.stdout), 'no TITLE — the skill step marker heads the ceremony');
    assert.match(res.stdout, /=== MENU[\s\S]*Which items do you want to start building\?/);
  });

  it('wraps a long row at the display width, its continuation under the row\'s text', () => {
    writeRoadmap(dir, { horizons: ['v1'], items: {
      'export-timeout': { horizon: 'v1', kind: 'bug', origin: 'harvest',
        summary: 'large exports of a whole year of orders time out before the file is ready to download' },
    } });
    const res = run(['pull-set']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes([
      '=== DISPLAY (emit verbatim as a text code block (```text fence)) ===',
      'v1',
      '  └─ 1. Export Timeout [bug] — large exports of a whole year',
      '        of orders time out before the file is ready to download',
      '',
    ].join('\n')), res.stdout);
  });

  it('refuses loudly when nothing is waiting', () => {
    writeRoadmap(dir, { horizons: ['mvp'], items: {} });
    const res = run(['pull-set']);
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /no waiting items/);
  });
});

describe('leeway-roadmap gateway: proposal', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('flags each proposed name and renders the overlay', () => {
    writeRoadmap(dir, MAP);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    createFile(dir, 'proposed.json', JSON.stringify([
      { name: 'gift-cards', horizon: 'v1', summary: 'stored value' },
      { name: 'loyalty', horizon: 'v1', summary: 'collides' },
      { name: 'bad.name', horizon: 'v2', summary: 'dots break addressing' },
    ]));
    const res = run(['proposal', '--file', 'proposed.json']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.match(res.stdout, /gift-cards horizon=v1 exists_on_roadmap=false legal_name=true legal_horizon=true new_horizon=false/);
    assert.match(res.stdout, /loyalty horizon=v1 exists_on_roadmap=true legal_name=true legal_horizon=true new_horizon=false/);
    assert.match(res.stdout, /bad\.name horizon=v2 exists_on_roadmap=false legal_name=false legal_horizon=true new_horizon=true/);
    assert.match(res.stdout, /=== DISPLAY[\s\S]*Proposed Roadmap/);
    assert.match(res.stdout, /Already on the roadmap \(3\)/);
  });

  it('fails loudly on a missing, malformed, or empty file', () => {
    writeRoadmap(dir, MAP);
    assert.strictEqual(run(['proposal', '--file', 'ghost.json']).status, 1);
    createFile(dir, 'bad.json', 'not json');
    assert.match(run(['proposal', '--file', 'bad.json']).stderr, /not valid JSON/);
    createFile(dir, 'empty.json', '[]');
    assert.match(run(['proposal', '--file', 'empty.json']).stderr, /non-empty JSON array/);
    createFile(dir, 'shape.json', JSON.stringify([{ name: 'x', horizon: 'mvp' }]));
    assert.match(run(['proposal', '--file', 'shape.json']).stderr, /missing "summary"/);
  });
});
