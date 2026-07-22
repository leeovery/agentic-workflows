'use strict';

//
// Tests for migration 050: purge-closed-workunit-caches (.cjs)
//
// Happy path (completed + cancelled purged), in-progress preserved, orphan
// cache purged, unreadable manifest preserved, no-cache-root skip,
// idempotency, and content preservation for live units.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/050-purge-closed-workunit-caches.cjs');

let dir, updates, skips;

function run() {
  MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}
function unit(name, status) {
  fs.mkdirSync(path.join(dir, '.workflows', name), { recursive: true });
  if (status !== undefined) {
    fs.writeFileSync(path.join(dir, '.workflows', name, 'manifest.json'),
      JSON.stringify({ work_unit: name, work_type: 'feature', status }) + '\n');
  }
}
function cache(name) {
  const p = path.join(dir, '.workflows', '.cache', name, 'discussion', name);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, 'review-1.md'), `scratch for ${name}\n`);
}
function cacheExists(name) {
  return fs.existsSync(path.join(dir, '.workflows', '.cache', name));
}

describe('migration 050: purge closed work-unit caches', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-050-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('purges completed and cancelled caches, keeps in-progress, one update per purged unit', () => {
    unit('done-feature', 'completed'); cache('done-feature');
    unit('dead-epic', 'cancelled'); cache('dead-epic');
    unit('live-bugfix', 'in-progress'); cache('live-bugfix');
    run();
    assert.strictEqual(cacheExists('done-feature'), false);
    assert.strictEqual(cacheExists('dead-epic'), false);
    assert.strictEqual(cacheExists('live-bugfix'), true);
    assert.strictEqual(updates, 2);
    assert.strictEqual(skips, 0);
  });

  it('purges an orphan cache whose work unit no longer exists', () => {
    cache('absorbed-feature'); // no .workflows/absorbed-feature at all
    run();
    assert.strictEqual(cacheExists('absorbed-feature'), false);
    assert.strictEqual(updates, 1);
  });

  it('keeps the cache of a unit with an unreadable manifest — unknown state is live state', () => {
    unit('weird'); // directory exists, no manifest.json? that would be orphan — write malformed instead
    fs.writeFileSync(path.join(dir, '.workflows', 'weird', 'manifest.json'), '{not json');
    cache('weird');
    run();
    assert.strictEqual(cacheExists('weird'), true);
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('skips cleanly when no cache root exists', () => {
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('is idempotent — a second run over the purged tree is a pure skip', () => {
    unit('done-feature', 'completed'); cache('done-feature');
    run();
    assert.strictEqual(updates, 1);
    run();
    assert.strictEqual(updates, 1, 'no further updates');
    assert.strictEqual(skips, 1, 'second run reports skip');
  });

  it('preserves live scratch content byte-for-byte', () => {
    unit('live-bugfix', 'in-progress'); cache('live-bugfix');
    unit('done-feature', 'completed'); cache('done-feature');
    run();
    const kept = path.join(dir, '.workflows', '.cache', 'live-bugfix', 'discussion', 'live-bugfix', 'review-1.md');
    assert.strictEqual(fs.readFileSync(kept, 'utf8'), 'scratch for live-bugfix\n');
  });
});
