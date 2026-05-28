'use strict';

// The absorb-into-epic reference is markdown — it instructs Claude to invoke
// the manifest CLI with a specific sequence of commands. These tests exercise
// the same CLI sequence the reference prescribes for J. Register Discovery
// Item, locking in the observable manifest state:
//
// - has_research = true  → discovery item with routing = research
// - has_research = false → discovery item with routing = discussion
// - summary/description left unset (summary-backfill catches them later)
// - source field left unset (defaults to "discovery" at render time)

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const MANIFEST_CLI = path.resolve(
  __dirname, '..', '..', 'skills', 'workflow-manifest', 'scripts', 'manifest.cjs'
);

let dir;

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'absorb-test-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
}

function cleanup() {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
}

function runCli(...args) {
  const r = spawnSync('node', [MANIFEST_CLI, ...args], { cwd: dir, encoding: 'utf8' });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function readManifest(workUnit) {
  return JSON.parse(fs.readFileSync(
    path.join(dir, '.workflows', workUnit, 'manifest.json'), 'utf8'
  ));
}

function seedEpic(workUnit) {
  const manifestDir = path.join(dir, '.workflows', workUnit);
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, 'manifest.json'),
    JSON.stringify({
      name: workUnit,
      work_type: 'epic',
      status: 'in-progress',
      phases: { discovery: { items: {} } },
    }, null, 2),
  );
  const projPath = path.join(dir, '.workflows', 'manifest.json');
  let proj = {};
  if (fs.existsSync(projPath)) proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  if (!proj.work_units) proj.work_units = {};
  proj.work_units[workUnit] = { work_type: 'epic' };
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2));
}

// Re-creates the CLI sequence in J. Register Discovery Item.
function registerDiscoveryItem(targetEpic, topic, routing) {
  assert.strictEqual(
    runCli('init-phase', `${targetEpic}.discovery.${topic}`).status, 0,
  );
  assert.strictEqual(
    runCli('set', `${targetEpic}.discovery.${topic}`, 'routing', routing).status, 0,
  );
}

describe('absorb-into-epic: J. Register Discovery Item', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('creates an discovery item with routing = research when has_research is true', () => {
    seedEpic('payments-overhaul');
    registerDiscoveryItem('payments-overhaul', 'auth-flow', 'research');

    const item = readManifest('payments-overhaul').phases.discovery.items['auth-flow'];
    assert.strictEqual(item.routing, 'research');
  });

  it('creates an discovery item with routing = discussion when has_research is false', () => {
    seedEpic('payments-overhaul');
    registerDiscoveryItem('payments-overhaul', 'auth-flow', 'discussion');

    const item = readManifest('payments-overhaul').phases.discovery.items['auth-flow'];
    assert.strictEqual(item.routing, 'discussion');
  });

  it('leaves summary and description unset for summary-backfill to catch later', () => {
    seedEpic('payments-overhaul');
    registerDiscoveryItem('payments-overhaul', 'auth-flow', 'discussion');

    const item = readManifest('payments-overhaul').phases.discovery.items['auth-flow'];
    assert.ok(!('summary' in item), 'summary should be absent — left for summary-backfill');
    assert.ok(!('description' in item), 'description should be absent — left for summary-backfill');
  });

  it('leaves source unset — discovery renders it as discovery by default', () => {
    seedEpic('payments-overhaul');
    registerDiscoveryItem('payments-overhaul', 'auth-flow', 'discussion');

    const item = readManifest('payments-overhaul').phases.discovery.items['auth-flow'];
    assert.ok(!('source' in item), 'source should be absent — discovery defaults to "discovery"');
  });

  it('makes the absorbed topic visible to the discovery discovery script', () => {
    seedEpic('payments-overhaul');
    registerDiscoveryItem('payments-overhaul', 'auth-flow', 'research');

    // The discovery script builds the map from phases.discovery.items.
    // Without the J. Register step, this assertion would fail — the topic
    // would only exist in phases.discussion (or research) and be invisible
    // to the map.
    const items = readManifest('payments-overhaul').phases.discovery.items;
    assert.ok('auth-flow' in items, 'topic must appear in phases.discovery.items');
    assert.strictEqual(Object.keys(items).length, 1);
  });

  it('coexists with other discovery items in the target epic', () => {
    seedEpic('payments-overhaul');
    // Pre-existing topic from earlier discovery or refinement.
    runCli('init-phase', 'payments-overhaul.discovery.existing-topic');
    runCli('set', 'payments-overhaul.discovery.existing-topic', 'routing', 'discussion');

    // Absorption registers a new topic.
    registerDiscoveryItem('payments-overhaul', 'auth-flow', 'research');

    const items = readManifest('payments-overhaul').phases.discovery.items;
    assert.strictEqual(Object.keys(items).sort().join(','), 'auth-flow,existing-topic');
    assert.strictEqual(items['existing-topic'].routing, 'discussion');
    assert.strictEqual(items['auth-flow'].routing, 'research');
  });
});
