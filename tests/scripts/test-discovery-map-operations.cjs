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
    phases: { discovery: { items } },
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

describe('discovery map operations: hard-delete on remove', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('removes the named topic and leaves siblings intact', () => {
    seedEpic('payments', {
      'auth-flow':       { status: 'in-progress', summary: 'auth', routing: 'research', source: 'discovery' },
      'billing-history': { status: 'in-progress', summary: 'billing', routing: 'discussion', source: 'discovery' },
      'tax-handling':    { status: 'in-progress', summary: 'tax', routing: 'research', source: 'discovery' },
    });

    const r = runCli('delete', 'payments.discovery', 'items.billing-history');
    assert.strictEqual(r.status, 0, `delete failed: ${r.stderr}`);

    const m = readManifest('payments');
    assert.ok(!('billing-history' in m.phases.discovery.items), 'billing-history still present');
    assert.ok('auth-flow' in m.phases.discovery.items, 'auth-flow was removed');
    assert.ok('tax-handling' in m.phases.discovery.items, 'tax-handling was removed');
  });

  it('returns expected-miss exit code when the topic does not exist', () => {
    seedEpic('payments', {
      'auth-flow': { status: 'in-progress', routing: 'research', source: 'discovery' },
    });

    const r = runCli('delete', 'payments.discovery', 'items.nonexistent');
    assert.strictEqual(r.status, 2, `unexpected exit code: ${r.stderr}`);
  });
});

describe('discovery map operations: dismissed list', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('push adds a name to phases.discovery.dismissed', () => {
    seedEpic('payments', {
      'auth-flow': { status: 'in-progress', routing: 'research', source: 'discovery' },
    });

    const r = runCli('push', 'payments.discovery', 'dismissed', 'old-topic');
    assert.strictEqual(r.status, 0, `push failed: ${r.stderr}`);

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.discovery.dismissed, ['old-topic']);
  });

  it('push appends multiple names in order', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.discovery', 'dismissed', 'first');
    runCli('push', 'payments.discovery', 'dismissed', 'second');
    runCli('push', 'payments.discovery', 'dismissed', 'third');

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.discovery.dismissed, ['first', 'second', 'third']);
  });

  it('pull removes a named entry from the dismissed list', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.discovery', 'dismissed', 'first');
    runCli('push', 'payments.discovery', 'dismissed', 'second');
    runCli('push', 'payments.discovery', 'dismissed', 'third');

    const r = runCli('pull', 'payments.discovery', 'dismissed', 'second');
    assert.strictEqual(r.status, 0, `pull failed: ${r.stderr}`);

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.discovery.dismissed, ['first', 'third']);
  });

  it('pull is a no-op when the entry is missing', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.discovery', 'dismissed', 'first');

    const r = runCli('pull', 'payments.discovery', 'dismissed', 'nonexistent');
    assert.strictEqual(r.status, 0);

    const m = readManifest('payments');
    assert.deepStrictEqual(m.phases.discovery.dismissed, ['first']);
  });

  it('get returns the dismissed list as JSON', () => {
    seedEpic('payments', {});
    runCli('push', 'payments.discovery', 'dismissed', 'a');
    runCli('push', 'payments.discovery', 'dismissed', 'b');

    const r = runCli('get', 'payments.discovery', 'dismissed');
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.deepStrictEqual(parsed, ['a', 'b']);
  });
});

describe('discovery map operations: rename mechanical sequence', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('preserves summary, routing, and source after a rename', () => {
    seedEpic('payments', {
      'old-name': {
        status: 'in-progress',
        summary: 'an old summary',
        routing: 'research',
        source: 'discovery',
      },
    });

    // 1. Read old fields (scalar values come back as raw text + trailing newline)
    const summary = runCli('get', 'payments.discovery.old-name', 'summary').stdout.trimEnd();
    const routing = runCli('get', 'payments.discovery.old-name', 'routing').stdout.trimEnd();
    const src     = runCli('get', 'payments.discovery.old-name', 'source').stdout.trimEnd();

    assert.strictEqual(summary, 'an old summary');
    assert.strictEqual(routing, 'research');
    assert.strictEqual(src, 'discovery');

    // 2. Delete old key, init new key, write fields
    assert.strictEqual(runCli('delete', 'payments.discovery', 'items.old-name').status, 0);
    assert.strictEqual(runCli('init-phase', 'payments.discovery.new-name').status, 0);
    assert.strictEqual(runCli('set', 'payments.discovery.new-name', 'summary', summary).status, 0);
    assert.strictEqual(runCli('set', 'payments.discovery.new-name', 'routing', routing).status, 0);
    assert.strictEqual(runCli('set', 'payments.discovery.new-name', 'source', src).status, 0);

    const m = readManifest('payments');
    assert.ok(!('old-name' in m.phases.discovery.items), 'old-name still present');
    assert.ok('new-name' in m.phases.discovery.items, 'new-name not created');
    assert.strictEqual(m.phases.discovery.items['new-name'].summary, 'an old summary');
    assert.strictEqual(m.phases.discovery.items['new-name'].routing, 'research');
    assert.strictEqual(m.phases.discovery.items['new-name'].source, 'discovery');
    assert.strictEqual(m.phases.discovery.items['new-name'].status, 'in-progress');
  });

  it('preserves description after a rename when one exists', () => {
    seedEpic('payments', {
      'old-name': {
        status: 'in-progress',
        summary: 'an old summary',
        description: 'a multi-paragraph description\n\nthat must survive the rename intact',
        routing: 'research',
        source: 'discovery',
      },
    });

    // Probe + read pattern matches map-operations.md Rename block.
    const summary = runCli('get', 'payments.discovery.old-name', 'summary').stdout.trimEnd();
    const routing = runCli('get', 'payments.discovery.old-name', 'routing').stdout.trimEnd();
    const src     = runCli('get', 'payments.discovery.old-name', 'source').stdout.trimEnd();
    const descExists = runCli('exists', 'payments.discovery.old-name', 'description').stdout.trimEnd();
    assert.strictEqual(descExists, 'true');
    const description = runCli('get', 'payments.discovery.old-name', 'description').stdout.trimEnd();

    runCli('delete', 'payments.discovery', 'items.old-name');
    runCli('init-phase', 'payments.discovery.new-name');
    runCli('set', 'payments.discovery.new-name', 'summary', summary);
    runCli('set', 'payments.discovery.new-name', 'routing', routing);
    runCli('set', 'payments.discovery.new-name', 'source', src);
    runCli('set', 'payments.discovery.new-name', 'description', description);

    const item = readManifest('payments').phases.discovery.items['new-name'];
    assert.strictEqual(item.description, 'a multi-paragraph description\n\nthat must survive the rename intact');
    assert.strictEqual(item.summary, 'an old summary');
    assert.strictEqual(item.routing, 'research');
    assert.strictEqual(item.source, 'discovery');
  });

  it('omits description field on the renamed item when source had none', () => {
    seedEpic('payments', {
      'old-name': {
        status: 'in-progress',
        summary: 'an old summary',
        routing: 'research',
        source: 'discovery',
        // no description
      },
    });

    // Probe returns false — skip the read+write entirely.
    const descExists = runCli('exists', 'payments.discovery.old-name', 'description').stdout.trimEnd();
    assert.strictEqual(descExists, 'false');

    const summary = runCli('get', 'payments.discovery.old-name', 'summary').stdout.trimEnd();
    const routing = runCli('get', 'payments.discovery.old-name', 'routing').stdout.trimEnd();
    const src     = runCli('get', 'payments.discovery.old-name', 'source').stdout.trimEnd();

    runCli('delete', 'payments.discovery', 'items.old-name');
    runCli('init-phase', 'payments.discovery.new-name');
    runCli('set', 'payments.discovery.new-name', 'summary', summary);
    runCli('set', 'payments.discovery.new-name', 'routing', routing);
    runCli('set', 'payments.discovery.new-name', 'source', src);

    const item = readManifest('payments').phases.discovery.items['new-name'];
    assert.ok(!('description' in item), 'description field should be absent when source had none');
  });

  it('renames a migration-seeded item with no summary or description', () => {
    // Migration 038 (and absorption from start-feature) seed items with
    // routing + source only — no summary, no description. Rename must
    // handle that shape without erroring on a bare get.
    seedEpic('payments', {
      'old-name': {
        status: 'in-progress',
        routing: 'discussion',
        source: 'migration-seeded',
        // no summary, no description
      },
    });

    // Probes return false for both optional fields — skip both reads/writes.
    const sumExists  = runCli('exists', 'payments.discovery.old-name', 'summary').stdout.trimEnd();
    const descExists = runCli('exists', 'payments.discovery.old-name', 'description').stdout.trimEnd();
    assert.strictEqual(sumExists, 'false');
    assert.strictEqual(descExists, 'false');

    // Required fields read cleanly.
    const routing = runCli('get', 'payments.discovery.old-name', 'routing').stdout.trimEnd();
    const src     = runCli('get', 'payments.discovery.old-name', 'source').stdout.trimEnd();

    runCli('delete', 'payments.discovery', 'items.old-name');
    runCli('init-phase', 'payments.discovery.new-name');
    runCli('set', 'payments.discovery.new-name', 'routing', routing);
    runCli('set', 'payments.discovery.new-name', 'source', src);

    const item = readManifest('payments').phases.discovery.items['new-name'];
    assert.strictEqual(item.routing, 'discussion');
    assert.strictEqual(item.source, 'migration-seeded');
    assert.ok(!('summary' in item), 'summary should remain absent');
    assert.ok(!('description' in item), 'description should remain absent');
  });
});

describe('discovery map operations: edit description', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  // Section I. Edit Description mirrors E. Edit Summary — a single
  // `set ... description` per topic, preserving the other fields.
  it('overwrites description and preserves summary, routing, source', () => {
    seedEpic('payments', {
      'auth-flow': {
        status: 'in-progress',
        summary: 'oauth + sessions',
        description: 'original paragraph',
        routing: 'research',
        source: 'discovery',
      },
    });

    const r = runCli('set', 'payments.discovery.auth-flow', 'description', 'replacement description spans\n\ntwo paragraphs');
    assert.strictEqual(r.status, 0, `set failed: ${r.stderr}`);

    const item = readManifest('payments').phases.discovery.items['auth-flow'];
    assert.strictEqual(item.description, 'replacement description spans\n\ntwo paragraphs');
    assert.strictEqual(item.summary, 'oauth + sessions');
    assert.strictEqual(item.routing, 'research');
    assert.strictEqual(item.source, 'discovery');
  });

  it('is idempotent when the same description is written twice', () => {
    seedEpic('payments', {
      'auth-flow': {
        status: 'in-progress',
        summary: 'oauth + sessions',
        description: 'original paragraph',
        routing: 'research',
        source: 'discovery',
      },
    });

    runCli('set', 'payments.discovery.auth-flow', 'description', 'second take');
    const first = readManifest('payments').phases.discovery.items['auth-flow'].description;
    runCli('set', 'payments.discovery.auth-flow', 'description', 'second take');
    const second = readManifest('payments').phases.discovery.items['auth-flow'].description;

    assert.strictEqual(first, 'second take');
    assert.strictEqual(second, 'second take');
  });

  it('writes description on a lifecycle past fresh — no gate', () => {
    // Edit description lifecycle row says "any" — researching/discussing items
    // are valid targets.
    seedEpic('payments', {
      'auth-flow': {
        status: 'in-progress',
        summary: 'oauth + sessions',
        description: 'before',
        routing: 'research',
        source: 'discovery',
      },
    });
    const manifest = readManifest('payments');
    manifest.phases.research = { items: { 'auth-flow': { status: 'in-progress' } } };
    fs.writeFileSync(
      path.join(dir, '.workflows', 'payments', 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );

    const r = runCli('set', 'payments.discovery.auth-flow', 'description', 'after');
    assert.strictEqual(r.status, 0);
    assert.strictEqual(
      readManifest('payments').phases.discovery.items['auth-flow'].description,
      'after',
    );
  });
});

describe('discovery persistence: new topic write', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  // confirm-and-persist runs init-phase + set summary/description/routing/source
  // for each new topic on the working list. Description is derived in the same
  // session turn that proposes routing.
  it('writes description on a newly-added topic', () => {
    seedEpic('payments', {});

    assert.strictEqual(runCli('init-phase', 'payments.discovery.tax-handling').status, 0);
    assert.strictEqual(runCli('set', 'payments.discovery.tax-handling', 'summary', 'VAT + invoice rules').status, 0);
    assert.strictEqual(runCli('set', 'payments.discovery.tax-handling', 'description', 'two-paragraph framing of the tax problem space').status, 0);
    assert.strictEqual(runCli('set', 'payments.discovery.tax-handling', 'routing', 'research').status, 0);
    assert.strictEqual(runCli('set', 'payments.discovery.tax-handling', 'source', 'discovery').status, 0);

    const item = readManifest('payments').phases.discovery.items['tax-handling'];
    assert.strictEqual(item.summary, 'VAT + invoice rules');
    assert.strictEqual(item.description, 'two-paragraph framing of the tax problem space');
    assert.strictEqual(item.routing, 'research');
    assert.strictEqual(item.source, 'discovery');
  });
});

describe('discovery map operations: lifecycle gate via computeTopicLifecycle', () => {
  beforeEach(setupFixture);
  afterEach(cleanupFixture);

  it('reports fresh for a topic with no research/discussion items', () => {
    const manifest = {
      phases: {
        discovery: { items: { 'newtopic': { status: 'in-progress', routing: 'research' } } },
      },
    };
    const lc = computeTopicLifecycle(manifest, 'newtopic');
    assert.strictEqual(lc.lifecycle, 'fresh');
    assert.strictEqual(lc.tier, '○');
  });

  it('reports researching when research is in-progress', () => {
    const manifest = {
      phases: {
        discovery: { items: { 'auth': { status: 'in-progress', routing: 'research' } } },
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
        discovery:  { items: { 'auth': { status: 'in-progress', routing: 'discussion' } } },
        discussion: { items: { 'auth': { status: 'in-progress' } } },
      },
    };
    const lc = computeTopicLifecycle(manifest, 'auth');
    assert.strictEqual(lc.lifecycle, 'discussing');
  });

  it('reports decided when discussion is completed', () => {
    const manifest = {
      phases: {
        discovery:  { items: { 'auth': { status: 'in-progress', routing: 'discussion' } } },
        discussion: { items: { 'auth': { status: 'completed' } } },
      },
    };
    const lc = computeTopicLifecycle(manifest, 'auth');
    assert.strictEqual(lc.lifecycle, 'decided');
  });

  it('reports cancelled only when both research and discussion are cancelled', () => {
    const both = {
      phases: {
        discovery:  { items: { 'auth': { status: 'in-progress', routing: 'research' } } },
        research:   { items: { 'auth': { status: 'cancelled' } } },
        discussion: { items: { 'auth': { status: 'cancelled' } } },
      },
    };
    assert.strictEqual(computeTopicLifecycle(both, 'auth').lifecycle, 'cancelled');

    const onlyResearchCancelled = {
      phases: {
        discovery: { items: { 'auth': { status: 'in-progress', routing: 'research' } } },
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
