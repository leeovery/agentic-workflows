'use strict';

// The workflow-roadmap adapter: the home snapshot, the pull working set, and
// the harvest proposal overlay — sections, flags, and refusals.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');

const ADAPTER = path.resolve(__dirname, '../../skills/workflow-roadmap/scripts/gateway.cjs');

function writeRoadmap(dir, roadmap) {
  const p = path.join(dir, '.workflows', 'manifest.json');
  const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  fs.writeFileSync(p, JSON.stringify({ ...existing, roadmap }, null, 2));
}

const MAP = {
  horizons: ['mvp', 'v1'],
  active_session: '002',
  imports: [{ path: 'imports/app-idea.md', imported_at: '2026-08-01T00:00:00Z' }],
  items: {
    ordering: { horizon: 'mvp', summary: 'customers order', origin: 'harvest', pulled_to: { work_unit: 'mvp' } },
    menus: { horizon: 'mvp', summary: 'operators maintain', origin: 'harvest' },
    loyalty: { horizon: 'v1', summary: 'rewards', origin: 'park:mvp' },
  },
};

describe('workflow-roadmap gateway: view', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('emits DATA + TITLE + DISPLAY + MENU with the state tables and action keys', () => {
    writeRoadmap(dir, MAP);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    createFile(dir, '.workflows/.roadmap/sessions/session-001.md', '# Roadmap Session 001\n');
    createFile(dir, '.workflows/.roadmap/sessions/session-002.md', '# Roadmap Session 002\n');
    const res = run(['view']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.match(res.stdout, /=== DATA /);
    assert.match(res.stdout, /exists: true/);
    assert.match(res.stdout, /active_session: 002/);
    assert.match(res.stdout, /next_session_number: 3/);
    assert.match(res.stdout, /import_count: 1/);
    assert.match(res.stdout, /ITEMS \(name {2}horizon {2}state {2}work_unit\):/);
    assert.match(res.stdout, /  ordering {2}mvp {2}in-flight {2}mvp/);
    assert.match(res.stdout, /  loyalty {2}v1 {2}waiting {2}—/);
    assert.match(res.stdout, /SESSIONS \(number {2}path\):/);
    assert.match(res.stdout, /ACTIONS \(key {2}action\):/);
    assert.match(res.stdout, /  c {2}converse/);
    assert.match(res.stdout, /  p {2}pull/);
    assert.match(res.stdout, /  b {2}back/);
    assert.match(res.stdout, /=== TITLE[\s\S]*Roadmap/);
    assert.match(res.stdout, /=== DISPLAY[\s\S]*◐ Ordering/);
    assert.match(res.stdout, /=== MENU[\s\S]*Resume the open product session/);
  });

  it('drops the pull row with nothing waiting; converse reads as open with no session', () => {
    writeRoadmap(dir, {
      horizons: ['mvp'],
      items: { ordering: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'mvp' } } },
    });
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    const res = run(['view']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(!/ {2}p {2}pull/.test(res.stdout), 'no pull action over zero waiting items');
    assert.match(res.stdout, /Open a product session/);
  });
});

describe('workflow-roadmap gateway: pull-set', () => {
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
    assert.match(res.stdout, /ITEMS \(n {2}name {2}horizon\):/);
    assert.match(res.stdout, /  1 {2}menus {2}mvp/);
    assert.match(res.stdout, /  2 {2}loyalty {2}v1/);
    assert.match(res.stdout, /=== TITLE[\s\S]*Pull Into Delivery/);
    assert.match(res.stdout, /=== MENU[\s\S]*What goes into delivery\?/);
  });

  it('refuses loudly when nothing is waiting', () => {
    writeRoadmap(dir, { horizons: ['mvp'], items: {} });
    const res = run(['pull-set']);
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /no waiting items/);
  });
});

describe('workflow-roadmap gateway: proposal', () => {
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
    assert.match(res.stdout, /gift-cards horizon=v1 exists_on_roadmap=false legal_name=true new_horizon=false/);
    assert.match(res.stdout, /loyalty horizon=v1 exists_on_roadmap=true legal_name=true new_horizon=false/);
    assert.match(res.stdout, /bad\.name horizon=v2 exists_on_roadmap=false legal_name=false new_horizon=true/);
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
