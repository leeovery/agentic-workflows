'use strict';

//
// Tests for migration 056: remove-coherence-analysis (.cjs)
//
// Happy path (all three manifest fields + both .state files removed),
// analysis_staging container survival when siblings exist, `dismissed`
// (map list) preservation, skip/no-op, idempotency, content preservation,
// unreadable-manifest guard, and the missing-.workflows skip. The KB purge
// is exercised only for its guards (no store dir → no CLI call can fail the
// run); the CLI's own remove behaviour is covered by the knowledge suites.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/056-remove-coherence-analysis.cjs');

let dir, updates, skips;

function run() {
  MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

function writeUnit(name, manifest) {
  fs.mkdirSync(path.join(dir, '.workflows', name, '.state'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.workflows', name, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n');
}

function readUnit(name) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', name, 'manifest.json'), 'utf8'));
}

function stateFile(name, file, content = 'cache content\n') {
  fs.writeFileSync(path.join(dir, '.workflows', name, '.state', file), content);
}

function coherentManifest() {
  return {
    name: 'pay',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: { billing: { name: 'billing', routing: 'discussion' } },
        dismissed: ['parked-topic'],
        dismissed_findings: ['a|b|slug'],
        coherence_analysis_cache: { checksum: 'abc', generated: '2026-08-01', input_files: ['a.md'] },
        gap_analysis_cache: { checksum: 'def', generated: '2026-08-02', input_files: ['a.md'] },
        analysis_staging: {
          'coherence-analysis': { gate_mode: 'gated', candidates: { slug: { status: 'pending' } } },
          'discovery-gap-analysis': { gate_mode: 'gated', candidates: { other: { status: 'pending' } } },
        },
      },
      discussion: { items: { billing: { name: 'billing', status: 'completed' } } },
    },
  };
}

describe('migration 056: remove coherence-analysis residue', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-056-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('removes the three manifest fields and both .state files, one update for the unit', () => {
    writeUnit('pay', coherentManifest());
    stateFile('pay', 'coherence-analysis.md');
    stateFile('pay', 'coherence-analysis-candidates.md');
    run();
    assert.strictEqual(updates, 1);
    assert.strictEqual(skips, 0);
    const m = readUnit('pay');
    assert.ok(!('coherence_analysis_cache' in m.phases.discovery));
    assert.ok(!('dismissed_findings' in m.phases.discovery));
    assert.ok(!('coherence-analysis' in m.phases.discovery.analysis_staging));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'pay', '.state', 'coherence-analysis.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'pay', '.state', 'coherence-analysis-candidates.md')));
  });

  it('preserves sibling staging keys, the map dismissed list, and the gap cache', () => {
    writeUnit('pay', coherentManifest());
    run();
    const m = readUnit('pay');
    assert.deepStrictEqual(m.phases.discovery.analysis_staging['discovery-gap-analysis'],
      { gate_mode: 'gated', candidates: { other: { status: 'pending' } } });
    assert.deepStrictEqual(m.phases.discovery.dismissed, ['parked-topic']);
    assert.strictEqual(m.phases.discovery.gap_analysis_cache.checksum, 'def');
    assert.strictEqual(m.phases.discussion.items.billing.status, 'completed');
  });

  it('drops the analysis_staging container when coherence was its only key', () => {
    const manifest = coherentManifest();
    delete manifest.phases.discovery.analysis_staging['discovery-gap-analysis'];
    writeUnit('pay', manifest);
    run();
    assert.ok(!('analysis_staging' in readUnit('pay').phases.discovery));
  });

  it('removes stray .state files even when the manifest carries no coherence fields', () => {
    writeUnit('pay', { name: 'pay', work_type: 'epic', status: 'in-progress', phases: {} });
    stateFile('pay', 'coherence-analysis.md');
    run();
    assert.strictEqual(updates, 1);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'pay', '.state', 'coherence-analysis.md')));
  });

  it('skips when nothing carries coherence residue', () => {
    writeUnit('clean', { name: 'clean', work_type: 'feature', status: 'in-progress', phases: { discovery: { items: {} } } });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('skips when .workflows does not exist', () => {
    fs.rmSync(path.join(dir, '.workflows'), { recursive: true, force: true });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('leaves unreadable manifests alone', () => {
    fs.mkdirSync(path.join(dir, '.workflows', 'broken'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'not json');
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'utf8'), 'not json');
  });

  it('is idempotent — a second run reports skip and changes nothing', () => {
    writeUnit('pay', coherentManifest());
    stateFile('pay', 'coherence-analysis.md');
    run();
    const after = JSON.stringify(readUnit('pay'));
    updates = 0; skips = 0;
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.strictEqual(JSON.stringify(readUnit('pay')), after);
  });
});
