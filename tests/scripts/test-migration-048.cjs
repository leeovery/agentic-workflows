'use strict';

//
// Tests for migration 048: strip-discovery-item-status (.cjs)
//
// Ported from test-migration-048.sh: happy path, skip/no-op paths,
// idempotency, defensive parse guard, and content preservation.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/048-strip-discovery-item-status.cjs');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-048-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function runMigration(dir) {
  let updates = 0;
  let skips = 0;
  MIGRATION.run({
    projectDir: dir,
    reportUpdate: () => { updates += 1; },
    reportSkip: () => { skips += 1; },
  });
  return { updates, skips };
}
function writeManifest(dir, wu, json) {
  fs.mkdirSync(path.join(dir, '.workflows', wu), { recursive: true });
  fs.writeFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), json + '\n');
}
function readRaw(dir, wu) {
  return fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8');
}

describe('migration 048: strip discovery item status', () => {
  it('happy path — status stripped, other fields preserved', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', '{"name":"epic-a","work_type":"epic","phases":{"discovery":{"items":{"topic-x":{"status":"in-progress","routing":"research","source":"discovery","summary":"s","order":2},"topic-y":{"routing":"discussion","source":"discovery"}}}}}');

    const { updates } = runMigration(dir);
    const m = JSON.parse(readRaw(dir, 'epic-a'));
    const items = m.phases.discovery.items;

    assert.ok(!('status' in items['topic-x']), 'status removed');
    assert.strictEqual(items['topic-x'].routing, 'research', 'routing preserved');
    assert.strictEqual(items['topic-x'].order, 2, 'order preserved');
    assert.strictEqual(items['topic-x'].summary, 's', 'summary preserved');
    assert.strictEqual(updates, 1, 'one work unit reported updated');
    teardown(dir);
  });

  it('skip — no discovery items carry status', () => {
    const dir = setup();
    writeManifest(dir, 'epic-b', '{"name":"epic-b","work_type":"epic","phases":{"discovery":{"items":{"topic-z":{"routing":"research","source":"discovery"}}}}}');
    const before = readRaw(dir, 'epic-b');

    const { updates, skips } = runMigration(dir);

    assert.strictEqual(readRaw(dir, 'epic-b'), before, 'clean manifest untouched');
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    teardown(dir);
  });

  it('skip — no discovery phase at all (phase-item status untouched)', () => {
    const dir = setup();
    writeManifest(dir, 'feat-c', '{"name":"feat-c","work_type":"feature","phases":{"discussion":{"items":{"feat-c":{"status":"in-progress"}}}}}');

    runMigration(dir);
    const m = JSON.parse(readRaw(dir, 'feat-c'));

    assert.strictEqual(m.phases.discussion.items['feat-c'].status, 'in-progress');
    teardown(dir);
  });

  it('idempotency — a second run changes nothing', () => {
    const dir = setup();
    writeManifest(dir, 'epic-d', '{"name":"epic-d","work_type":"epic","phases":{"discovery":{"items":{"t":{"status":"in-progress","routing":"research","source":"discovery"}}}}}');

    runMigration(dir);
    const first = readRaw(dir, 'epic-d');
    runMigration(dir);

    assert.strictEqual(readRaw(dir, 'epic-d'), first, 'second run identical');
    teardown(dir);
  });

  it('defensive — an unparseable manifest is left untouched', () => {
    const dir = setup();
    fs.mkdirSync(path.join(dir, '.workflows', 'broken'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'not json{');

    runMigration(dir);

    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'utf8'), 'not json{');
    teardown(dir);
  });

  it('content preservation — dismissed list and sibling phases survive', () => {
    const dir = setup();
    writeManifest(dir, 'epic-e', '{"name":"epic-e","work_type":"epic","phases":{"discovery":{"items":{"t":{"status":"in-progress","routing":"research","source":"discovery"}},"dismissed":["old-idea"]},"research":{"items":{"t":{"status":"completed"}}}}}');

    runMigration(dir);
    const m = JSON.parse(readRaw(dir, 'epic-e'));

    assert.deepStrictEqual(m.phases.discovery.dismissed, ['old-idea'], 'dismissed preserved');
    assert.strictEqual(m.phases.research.items['t'].status, 'completed', 'research status preserved');
    assert.ok(!('status' in m.phases.discovery.items['t']), 'discovery item status stripped');
    teardown(dir);
  });
});
