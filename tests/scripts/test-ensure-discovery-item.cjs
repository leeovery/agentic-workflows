'use strict';

// The ensure-discovery-item reference is markdown — it instructs Claude to
// invoke the manifest CLI with a specific sequence of commands. These tests
// exercise the same CLI sequence the reference prescribes, so we lock in the
// observable manifest state and the back-compat shape:
//
// - No summary / no description supplied → item carries routing + source only.
// - Summary only → summary present, description absent.
// - Both → both present.
// - Idempotency → if the item already exists, the reference returns early
//   (in B. Check Existence) and no overwrite happens — caller-supplied summary
//   and description must not stomp existing values.

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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-discovery-test-'));
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
  const manifest = {
    name: workUnit,
    work_type: 'epic',
    status: 'in-progress',
    description: `Test: ${workUnit}`,
    phases: { discovery: { items: {} } },
  };
  fs.writeFileSync(
    path.join(manifestDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  const projPath = path.join(dir, '.workflows', 'manifest.json');
  let proj = {};
  if (fs.existsSync(projPath)) proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  if (!proj.work_units) proj.work_units = {};
  proj.work_units[workUnit] = { work_type: 'epic' };
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2));
}

// Re-creates the CLI sequence in D. Create Discovery Item. Summary and
// description are only written when supplied + non-empty (back-compat: existing
// callers pass neither and the item carries routing + source only).
function ensureCreate(workUnit, topic, routing, { summary, description } = {}) {
  assert.strictEqual(
    runCli('init-phase', `${workUnit}.discovery.${topic}`).status, 0,
  );
  assert.strictEqual(
    runCli('set', `${workUnit}.discovery.${topic}`, 'routing', routing).status, 0,
  );
  assert.strictEqual(
    runCli('set', `${workUnit}.discovery.${topic}`, 'source', 'direct-start').status, 0,
  );
  if (summary) {
    assert.strictEqual(
      runCli('set', `${workUnit}.discovery.${topic}`, 'summary', summary).status, 0,
    );
  }
  if (description) {
    assert.strictEqual(
      runCli('set', `${workUnit}.discovery.${topic}`, 'description', description).status, 0,
    );
  }
}

describe('ensure-discovery-item: create without summary or description', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('creates an item with routing + source only (back-compat)', () => {
    seedEpic('payments');
    ensureCreate('payments', 'auth', 'discussion');

    const item = readManifest('payments').phases.discovery.items['auth'];
    assert.strictEqual(item.routing, 'discussion');
    assert.strictEqual(item.source, 'direct-start');
    assert.ok(!('summary' in item), 'summary unexpectedly written');
    assert.ok(!('description' in item), 'description unexpectedly written');
  });
});

describe('ensure-discovery-item: create with summary only', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('writes summary but no description', () => {
    seedEpic('payments');
    ensureCreate('payments', 'auth', 'research', { summary: 'oauth + sessions' });

    const item = readManifest('payments').phases.discovery.items['auth'];
    assert.strictEqual(item.summary, 'oauth + sessions');
    assert.ok(!('description' in item), 'description unexpectedly written');
  });
});

describe('ensure-discovery-item: create with summary and description', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('writes both fields verbatim', () => {
    seedEpic('payments');
    const desc = 'Two paragraphs.\n\nSecond paragraph with apostrophe\'s and "quotes".';
    ensureCreate('payments', 'auth', 'research', {
      summary: 'oauth + sessions',
      description: desc,
    });

    const item = readManifest('payments').phases.discovery.items['auth'];
    assert.strictEqual(item.summary, 'oauth + sessions');
    assert.strictEqual(item.description, desc);
    assert.strictEqual(item.routing, 'research');
    assert.strictEqual(item.source, 'direct-start');
  });
});

describe('ensure-discovery-item: idempotency on existing item', () => {
  beforeEach(setup);
  afterEach(cleanup);

  // Section B. Check Existence: when the item already exists, the reference
  // returns to caller before D. Create — so caller-supplied summary/description
  // never reach the CLI. This test exercises the existence check directly: if
  // exists returns true, ensureCreate must NOT run.
  it('returns existence=true and does not overwrite existing summary or description', () => {
    seedEpic('payments');
    ensureCreate('payments', 'auth', 'research', {
      summary: 'original summary',
      description: 'original description',
    });

    const existsResult = runCli('exists', 'payments.discovery.auth');
    assert.strictEqual(existsResult.status, 0);
    assert.strictEqual(existsResult.stdout.trim(), 'true');

    // Caller short-circuits — ensureCreate is not invoked again. Manifest stays.
    const item = readManifest('payments').phases.discovery.items['auth'];
    assert.strictEqual(item.summary, 'original summary');
    assert.strictEqual(item.description, 'original description');
  });
});
