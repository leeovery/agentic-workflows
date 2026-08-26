'use strict';

//
// Tests for migration 057: remove-research-analysis (.cjs)
//
// Happy path (the research analysis_cache, the staging key, and both .state
// files removed), analysis_staging container survival when siblings exist,
// sibling phases.research field preservation, skip/no-op, idempotency,
// unreadable-manifest guard, and the missing-.workflows skip. The KB purge
// branch is pinned through a child_process spy installed before the module
// loads (the migration destructures execFileSync at require time): the
// exact CLI path and argument triple, the no-store guard, and the
// swallow-on-failure degrade. The CLI's own remove behaviour is covered by
// the knowledge suites.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Install the spy before the migration module captures the real binding.
const cp = require('child_process');
const realExecFileSync = cp.execFileSync;
/** @type {{file: string, args: string[]}[]} */
let execCalls = [];
/** @type {Error|null} */
let execThrows = null;
cp.execFileSync = (/** @type {string} */ file, /** @type {string[]} */ args, /** @type {object} */ opts) => {
  execCalls.push({ file, args });
  if (execThrows) throw execThrows;
  return /** @type {never} */ (undefined);
};
const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/057-remove-research-analysis.cjs');
cp.execFileSync = realExecFileSync;

let dir, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
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

function analysedManifest() {
  return {
    name: 'pay',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: { billing: { name: 'billing', routing: 'discussion', source: 'research-analysis:ledger' } },
        dismissed: ['parked-topic'],
        gap_analysis_cache: { checksum: 'def', generated: '2026-08-02', input_files: ['a.md'] },
        analysis_staging: {
          'research-analysis': { gate_mode: 'gated', candidates: { slug: { status: 'pending' } } },
          'discovery-gap-analysis': { gate_mode: 'gated', candidates: { other: { status: 'pending' } } },
        },
      },
      research: {
        items: { ledger: { name: 'ledger', status: 'completed' } },
        analysis_cache: { checksum: 'abc', generated: '2026-08-01', files: ['ledger.md'] },
      },
      discussion: { items: { billing: { name: 'billing', status: 'completed' } } },
    },
  };
}

describe('migration 057: remove research-analysis residue', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-057-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
    execCalls = [];
    execThrows = null;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('removes the analysis cache, the staging key, and both .state files, one update for the unit', () => {
    writeUnit('pay', analysedManifest());
    stateFile('pay', 'research-analysis.md');
    stateFile('pay', 'research-analysis-candidates.md');
    run();
    assert.strictEqual(updates, 1);
    assert.strictEqual(skips, 0);
    const m = readUnit('pay');
    assert.ok(!('analysis_cache' in m.phases.research));
    assert.ok(!('research-analysis' in m.phases.discovery.analysis_staging));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'pay', '.state', 'research-analysis.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'pay', '.state', 'research-analysis-candidates.md')));
  });

  it('preserves sibling staging keys, the research items, the map source, and the gap cache', () => {
    writeUnit('pay', analysedManifest());
    run();
    const m = readUnit('pay');
    assert.deepStrictEqual(m.phases.discovery.analysis_staging['discovery-gap-analysis'],
      { gate_mode: 'gated', candidates: { other: { status: 'pending' } } });
    assert.deepStrictEqual(m.phases.research.items, { ledger: { name: 'ledger', status: 'completed' } });
    assert.strictEqual(m.phases.discovery.items.billing.source, 'research-analysis:ledger');
    assert.deepStrictEqual(m.phases.discovery.dismissed, ['parked-topic']);
    assert.strictEqual(m.phases.discovery.gap_analysis_cache.checksum, 'def');
    assert.strictEqual(m.phases.discussion.items.billing.status, 'completed');
  });

  it('drops the analysis_staging container when research-analysis was its only key', () => {
    const manifest = analysedManifest();
    delete manifest.phases.discovery.analysis_staging['discovery-gap-analysis'];
    writeUnit('pay', manifest);
    run();
    assert.ok(!('analysis_staging' in readUnit('pay').phases.discovery));
  });

  it('removes stray .state files even when the manifest carries no research-analysis fields', () => {
    writeUnit('pay', { name: 'pay', work_type: 'epic', status: 'in-progress', phases: {} });
    stateFile('pay', 'research-analysis.md');
    run();
    assert.strictEqual(updates, 1);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'pay', '.state', 'research-analysis.md')));
  });

  it('leaves a unit with no .state files alone when the manifest is stripped', () => {
    const manifest = analysedManifest();
    delete manifest.phases.discovery.analysis_staging;
    writeUnit('pay', manifest);
    run();
    assert.strictEqual(updates, 1);
    assert.ok(!('analysis_cache' in readUnit('pay').phases.research));
  });

  it('skips when nothing carries research-analysis residue', () => {
    writeUnit('clean', { name: 'clean', work_type: 'feature', status: 'in-progress', phases: { discovery: { items: {} }, research: { items: {} } } });
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

  it('purges the KB with the exact CLI path and argument triple when a store exists', () => {
    writeUnit('pay', analysedManifest());
    fs.mkdirSync(path.join(dir, '.workflows', '.knowledge'), { recursive: true });
    run();
    assert.strictEqual(execCalls.length, 1);
    assert.strictEqual(execCalls[0].file, 'node');
    const [cli, ...rest] = execCalls[0].args;
    assert.ok(cli.endsWith(path.join('workflow-knowledge', 'scripts', 'knowledge.cjs')), `CLI path resolves into the skill tree: ${cli}`);
    assert.ok(fs.existsSync(cli), 'the resolved CLI exists on disk');
    assert.deepStrictEqual(rest, ['remove', '--work-unit', 'pay', '--phase', 'analysis', '--topic', 'research-analysis']);
  });

  it('never invokes the CLI when no store exists', () => {
    writeUnit('pay', analysedManifest());
    run();
    assert.strictEqual(updates, 1, 'the manifest strip still happens');
    assert.strictEqual(execCalls.length, 0);
  });

  it('a failing CLI never blocks the run — the strip lands and the unit still counts', () => {
    writeUnit('pay', analysedManifest());
    fs.mkdirSync(path.join(dir, '.workflows', '.knowledge'), { recursive: true });
    execThrows = new Error('schema drift');
    run();
    assert.strictEqual(updates, 1);
    assert.strictEqual(execCalls.length, 1, 'the purge was attempted');
    assert.ok(!('analysis_cache' in readUnit('pay').phases.research));
  });

  it('is idempotent — a second run reports skip and changes nothing', () => {
    writeUnit('pay', analysedManifest());
    stateFile('pay', 'research-analysis.md');
    run();
    const after = JSON.stringify(readUnit('pay'));
    updates = 0; skips = 0;
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.strictEqual(JSON.stringify(readUnit('pay')), after);
  });

  it('verify addendum: fires naming purged units when the store exists', () => {
    writeUnit('pay', analysedManifest());
    fs.mkdirSync(path.join(dir, '.workflows', '.knowledge'), { recursive: true });
    const ret = run();
    assert.match(ret.verify, /confirm it landed for: pay/);
    assert.match(ret.verify, /remove --work-unit \{wu\} --phase analysis --topic research-analysis/);
  });

  it('verify addendum: absent when no store exists (no chunks can linger)', () => {
    writeUnit('pay', analysedManifest());
    const ret = run();
    assert.strictEqual(ret, undefined);
  });

  it('verify addendum: absent on the clean-skip path', () => {
    writeUnit('pay', { name: 'pay', work_type: 'epic', status: 'in-progress', phases: {} });
    const ret = run();
    assert.strictEqual(ret, undefined);
  });
});
