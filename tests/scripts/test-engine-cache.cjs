'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { stampAnalysisCache } = require('../../skills/workflow-engine/scripts/domain/cache.cjs');
const { computeAnalysisCacheStatus, collectAnalysisInputs } = require('../../skills/workflow-engine/scripts/domain/discovery-utils.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

// The drift-proof contract: a stamp is computed with the same collection and
// checksum logic the read side uses, so computeAnalysisCacheStatus must judge
// a fresh stamp `valid` — and judge it `stale` again as soon as any input
// file's content changes.

/** An epic with completed research and discussion items plus their files. */
function seedEpic(dir) {
  createManifest(dir, 'payments', {
    work_type: 'epic',
    phases: {
      research: {
        items: {
          'kitchen-hardware': { status: 'completed' },
          'menu-admin': { status: 'completed' },
          'in-flight': { status: 'in-progress' },
        },
      },
      discussion: {
        items: {
          'auth-flow': { status: 'completed' },
          'zebra-topic': { status: 'in-progress' },
        },
      },
    },
  });
  createFile(dir, '.workflows/payments/research/kitchen-hardware.md', '# Kitchen Hardware\n');
  createFile(dir, '.workflows/payments/research/menu-admin.md', '# Menu Admin\n');
  createFile(dir, '.workflows/payments/research/in-flight.md', '# In Flight\n');
  createFile(dir, '.workflows/payments/discussion/auth-flow.md', '# Auth Flow\n');
}

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'));
}

function readStatus(dir, kind) {
  return computeAnalysisCacheStatus(readManifest(dir), path.join(dir, '.workflows'), kind);
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args) {
  return JSON.parse(execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' }).trim());
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(dir, args) {
  const res = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

describe('engine cache stamp: research-analysis', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); seedEpic(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('stamps completed research files only — the read side judges the stamp valid', () => {
    assert.strictEqual(readStatus(dir, 'research-analysis').status, 'stale');

    const res = engine(dir, ['cache', 'stamp', 'payments', 'research-analysis']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.kind, 'research-analysis');
    assert.strictEqual(res.files, 2);
    assert.match(res.checksum, /^[0-9a-f]{32}$/);

    const cache = readManifest(dir).phases.research.analysis_cache;
    assert.strictEqual(cache.checksum, res.checksum);
    assert.deepStrictEqual(cache.files, ['kitchen-hardware.md', 'menu-admin.md']);
    assert.ok(!Number.isNaN(Date.parse(cache.generated)), `generated is a timestamp: ${cache.generated}`);

    assert.strictEqual(readStatus(dir, 'research-analysis').status, 'valid');
    // The other kind's cache is untouched.
    assert.strictEqual(readManifest(dir).phases.discovery, undefined);
  });

  it('a changed input makes the stamp stale; restamping makes it valid again', () => {
    engine(dir, ['cache', 'stamp', 'payments', 'research-analysis']);
    createFile(dir, '.workflows/payments/research/menu-admin.md', '# Menu Admin — revised\n');
    assert.strictEqual(readStatus(dir, 'research-analysis').status, 'stale');

    engine(dir, ['cache', 'stamp', 'payments', 'research-analysis']);
    assert.strictEqual(readStatus(dir, 'research-analysis').status, 'valid');
  });

  it('a completed item whose file is missing on disk is excluded, matching the read side', () => {
    fs.rmSync(path.join(dir, '.workflows/payments/research/menu-admin.md'));
    const res = engine(dir, ['cache', 'stamp', 'payments', 'research-analysis']);
    assert.strictEqual(res.files, 1);
    assert.deepStrictEqual(readManifest(dir).phases.research.analysis_cache.files, ['kitchen-hardware.md']);
    assert.strictEqual(readStatus(dir, 'research-analysis').status, 'valid');
  });

  it('indexes the .state cache file in the same call — a failed index is a warning, never a block', () => {
    // No .state/research-analysis.md on disk — the index attempt always
    // fails (deterministically, whatever the machine's KB configuration),
    // lands as a warning naming the cache file, and never blocks the stamp.
    const res = engine(dir, ['cache', 'stamp', 'payments', 'research-analysis']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index \(\.state\/research-analysis\.md\) failed/);
    assert.strictEqual(readStatus(dir, 'research-analysis').status, 'valid');
  });
});

describe('engine cache stamp: gap-analysis', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); seedEpic(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('stamps completed research + discussion files under phases.discovery — read side judges valid', () => {
    const res = engine(dir, ['cache', 'stamp', 'payments', 'gap-analysis']);
    assert.strictEqual(res.kind, 'gap-analysis');
    assert.strictEqual(res.files, 3);

    const cache = readManifest(dir).phases.discovery.gap_analysis_cache;
    assert.strictEqual(cache.checksum, res.checksum);
    // Names follow the shared collection's sorted path order.
    assert.deepStrictEqual(cache.input_files, ['auth-flow.md', 'kitchen-hardware.md', 'menu-admin.md']);
    assert.ok(!Number.isNaN(Date.parse(cache.generated)));

    assert.strictEqual(readStatus(dir, 'gap-analysis').status, 'valid');
    // The research-analysis cache is untouched.
    assert.strictEqual(readManifest(dir).phases.research.analysis_cache, undefined);
  });

  it('a discussion conclusion after the stamp makes it stale', () => {
    engine(dir, ['cache', 'stamp', 'payments', 'gap-analysis']);
    const m = readManifest(dir);
    m.phases.discussion.items['zebra-topic'].status = 'completed';
    fs.writeFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), JSON.stringify(m, null, 2));
    createFile(dir, '.workflows/payments/discussion/zebra-topic.md', '# Zebra\n');
    assert.strictEqual(readStatus(dir, 'gap-analysis').status, 'stale');
  });

  it('stamps via the library entry too, sharing the read side collection', () => {
    const res = stampAnalysisCache(dir, 'payments', 'gap-analysis');
    const inputs = collectAnalysisInputs(readManifest(dir), path.join(dir, '.workflows'), 'gap-analysis');
    assert.strictEqual(res.files, inputs.length);
    assert.strictEqual(readStatus(dir, 'gap-analysis').status, 'valid');
  });

  it('indexes discovery-gap-analysis.md in the same call — warning names the gap-analysis cache file', () => {
    // The cache file is absent, so the index attempt fails deterministically.
    const res = engine(dir, ['cache', 'stamp', 'payments', 'gap-analysis']);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index \(\.state\/discovery-gap-analysis\.md\) failed/);
  });
});

describe('engine cache stamp: validation', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('rejects unknown kinds, missing args, and missing work units — loud and specific', () => {
    createManifest(dir, 'payments', { work_type: 'epic' });
    assert.match(engineFails(dir, ['cache', 'stamp', 'payments', 'nonsense']).error, /unknown cache kind "nonsense"/);
    assert.match(engineFails(dir, ['cache', 'stamp', 'payments']).error, /Usage: engine cache stamp/);
    assert.match(engineFails(dir, ['cache', 'nonsense', 'payments', 'gap-analysis']).error, /Usage: engine cache stamp/);
    assert.match(engineFails(dir, ['cache', 'stamp', 'ghost', 'gap-analysis']).error, /manifest not found/);
  });

  it('rejects a stamp with no qualifying inputs, manifest untouched', () => {
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: { research: { items: { topic: { status: 'in-progress' } } } },
    });
    const before = fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8');
    assert.match(
      engineFails(dir, ['cache', 'stamp', 'payments', 'research-analysis']).error,
      /nothing to stamp: no completed research files/);
    assert.match(
      engineFails(dir, ['cache', 'stamp', 'payments', 'gap-analysis']).error,
      /nothing to stamp: no completed research or discussion files/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'), before);
  });
});
