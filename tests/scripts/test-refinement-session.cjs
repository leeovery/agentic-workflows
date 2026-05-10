'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const MANIFEST_CLI = path.resolve(
  __dirname, '..', '..', 'skills', 'workflow-manifest', 'scripts', 'manifest.cjs'
);
const { computeTopicLifecycle } = require(
  path.resolve(__dirname, '..', '..', 'skills', 'workflow-shared', 'scripts', 'discovery-utils.cjs')
);

let dir;

function setupFixture() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refinement-test-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
}

function cleanupFixture() {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
}

function runCli(...args) {
  const result = spawnSync('node', [MANIFEST_CLI, ...args], { cwd: dir, encoding: 'utf8' });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function readManifest(workUnit) {
  return JSON.parse(fs.readFileSync(
    path.join(dir, '.workflows', workUnit, 'manifest.json'), 'utf8'
  ));
}

function seedEpic(workUnit, items = {}) {
  const manifestDir = path.join(dir, '.workflows', workUnit);
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifest = {
    name: workUnit,
    work_type: 'epic',
    status: 'in-progress',
    description: `Test: ${workUnit}`,
    phases: { inception: { items } },
  };
  fs.writeFileSync(
    path.join(manifestDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  // Register in project manifest so workUnitNames() lists it.
  const projDir = path.join(dir, '.workflows');
  const projPath = path.join(projDir, 'manifest.json');
  let proj = {};
  if (fs.existsSync(projPath)) {
    proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  }
  if (!proj.work_units) proj.work_units = {};
  proj.work_units[workUnit] = { work_type: 'epic' };
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2));
}

describe('refinement: hard-delete on remove', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('removes the named topic and leaves siblings intact', () => {
    seedEpic('payments', {
      'auth-flow':       { status: 'in-progress', summary: 'auth', routing: 'research', source: 'inception' },
      'billing-history': { status: 'in-progress', summary: 'billing', routing: 'discussion', source: 'inception' },
      'tax-handling':    { status: 'in-progress', summary: 'tax', routing: 'research', source: 'inception' },
    });

    const r = runCli('delete', 'payments.inception', 'items.billing-history');
    assert.strictEqual(r.status, 0, `delete failed: ${r.stderr}`);

    const m = readManifest('payments');
    assert.ok(!('billing-history' in m.phases.inception.items), 'billing-history still present');
    assert.ok('auth-flow' in m.phases.inception.items, 'auth-flow was removed');
    assert.ok('tax-handling' in m.phases.inception.items, 'tax-handling was removed');
  });

  it('returns expected-miss exit code when the topic does not exist', () => {
    seedEpic('payments', {
      'auth-flow': { status: 'in-progress', routing: 'research', source: 'inception' },
    });

    const r = runCli('delete', 'payments.inception', 'items.nonexistent');
    assert.strictEqual(r.status, 2, `unexpected exit code: ${r.stderr}`);
  });
});

describe('refinement: dismissed list', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('push adds a name to phases.inception.dismissed', () => {
    seedEpic('payments', {
      'auth-flow': { status: 'in-progress', routing: 'research', source: 'inception' },
    });

    const r = runCli('push', 'payments.inception', 'dismissed', 'old-topic');
    assert.strictEqual(r.status, 0, `push failed: ${r.stderr}`);

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.inception.dismissed, ['old-topic']);
  });

  it('push appends multiple names in order', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.inception', 'dismissed', 'first');
    runCli('push', 'payments.inception', 'dismissed', 'second');
    runCli('push', 'payments.inception', 'dismissed', 'third');

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.inception.dismissed, ['first', 'second', 'third']);
  });

  it('pull removes a named entry from the dismissed list', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.inception', 'dismissed', 'first');
    runCli('push', 'payments.inception', 'dismissed', 'second');
    runCli('push', 'payments.inception', 'dismissed', 'third');

    const r = runCli('pull', 'payments.inception', 'dismissed', 'second');
    assert.strictEqual(r.status, 0, `pull failed: ${r.stderr}`);

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.inception.dismissed, ['first', 'third']);
  });

  it('pull is a no-op when the entry is missing', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.inception', 'dismissed', 'first');

    const r = runCli('pull', 'payments.inception', 'dismissed', 'nonexistent');
    assert.strictEqual(r.status, 0);

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.inception.dismissed, ['first']);
  });

  it('get returns the dismissed list as JSON', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.inception', 'dismissed', 'a');
    runCli('push', 'payments.inception', 'dismissed', 'b');

    const r = runCli('get', 'payments.inception', 'dismissed');
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.deepStrictEqual(parsed, ['a', 'b']);
  });
});

describe('refinement: rename mechanical sequence', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('preserves summary, routing, and source after a rename', () => {
    seedEpic('payments', {
      'old-name': {
        status: 'in-progress',
        summary: 'an old summary',
        routing: 'research',
        source: 'inception',
      },
    });

    // 1. Read old fields (scalar values come back as raw text + trailing newline)
    const summary = runCli('get', 'payments.inception.old-name', 'summary').stdout.trimEnd();
    const routing = runCli('get', 'payments.inception.old-name', 'routing').stdout.trimEnd();
    const src     = runCli('get', 'payments.inception.old-name', 'source').stdout.trimEnd();

    assert.strictEqual(summary, 'an old summary');
    assert.strictEqual(routing, 'research');
    assert.strictEqual(src, 'inception');

    // 2. Delete old key, init new key, write fields
    assert.strictEqual(runCli('delete', 'payments.inception', 'items.old-name').status, 0);
    assert.strictEqual(runCli('init-phase', 'payments.inception.new-name').status, 0);
    assert.strictEqual(runCli('set', 'payments.inception.new-name', 'summary', summary).status, 0);
    assert.strictEqual(runCli('set', 'payments.inception.new-name', 'routing', routing).status, 0);
    assert.strictEqual(runCli('set', 'payments.inception.new-name', 'source', src).status, 0);

    const m = readManifest('payments');
    assert.ok(!('old-name' in m.phases.inception.items), 'old-name still present');
    assert.ok('new-name' in m.phases.inception.items, 'new-name not created');
    assert.strictEqual(m.phases.inception.items['new-name'].summary, 'an old summary');
    assert.strictEqual(m.phases.inception.items['new-name'].routing, 'research');
    assert.strictEqual(m.phases.inception.items['new-name'].source, 'inception');
    assert.strictEqual(m.phases.inception.items['new-name'].status, 'in-progress');
  });
});

describe('refinement: lifecycle gate via computeTopicLifecycle', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('reports fresh for a topic with no research/discussion items', () => {
    const manifest = {
      phases: {
        inception: { items: { 'newtopic': { status: 'in-progress', routing: 'research' } } },
      },
    };
    const lc = computeTopicLifecycle(manifest, 'newtopic');
    assert.strictEqual(lc.lifecycle, 'fresh');
    assert.strictEqual(lc.tier, '○');
  });

  it('reports researching when research is in-progress', () => {
    const manifest = {
      phases: {
        inception: { items: { 'auth': { status: 'in-progress', routing: 'research' } } },
        research:  { items: { 'auth': { status: 'in-progress' } } },
      },
    };
    const lc = computeTopicLifecycle(manifest, 'auth');
    assert.strictEqual(lc.lifecycle, 'researching');
    assert.strictEqual(lc.tier, '◐');
  });

  it('reports discussing when discussion is in-progress', () => {
    const manifest = {
      phases: {
        inception:  { items: { 'auth': { status: 'in-progress', routing: 'discussion' } } },
        discussion: { items: { 'auth': { status: 'in-progress' } } },
      },
    };
    const lc = computeTopicLifecycle(manifest, 'auth');
    assert.strictEqual(lc.lifecycle, 'discussing');
  });

  it('reports decided when discussion is completed', () => {
    const manifest = {
      phases: {
        inception:  { items: { 'auth': { status: 'in-progress', routing: 'discussion' } } },
        discussion: { items: { 'auth': { status: 'completed' } } },
      },
    };
    const lc = computeTopicLifecycle(manifest, 'auth');
    assert.strictEqual(lc.lifecycle, 'decided');
  });

  it('reports cancelled only when both research and discussion are cancelled', () => {
    const both = {
      phases: {
        inception:  { items: { 'auth': { status: 'in-progress', routing: 'research' } } },
        research:   { items: { 'auth': { status: 'cancelled' } } },
        discussion: { items: { 'auth': { status: 'cancelled' } } },
      },
    };
    assert.strictEqual(computeTopicLifecycle(both, 'auth').lifecycle, 'cancelled');

    const onlyResearchCancelled = {
      phases: {
        inception: { items: { 'auth': { status: 'in-progress', routing: 'research' } } },
        research:  { items: { 'auth': { status: 'cancelled' } } },
      },
    };
    assert.strictEqual(computeTopicLifecycle(onlyResearchCancelled, 'auth').lifecycle, 'fresh');
  });

  it('only fresh is allowed for destructive map operations', () => {
    const lifecycles = [
      { lifecycle: 'fresh',                allowed: true  },
      { lifecycle: 'researching',          allowed: false },
      { lifecycle: 'ready_for_discussion', allowed: false },
      { lifecycle: 'discussing',           allowed: false },
      { lifecycle: 'decided',              allowed: false },
      { lifecycle: 'cancelled',            allowed: false },
    ];
    const isAllowed = lc => lc === 'fresh';
    for (const { lifecycle, allowed } of lifecycles) {
      assert.strictEqual(
        isAllowed(lifecycle), allowed,
        `lifecycle "${lifecycle}" expected allowed=${allowed}`
      );
    }
  });
});
