'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const os = require('os');

const { cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

describe('engine CLI: discovery-map sequence', () => {
  // Hermetic git: no user/system config leaks into the engine's spawned git.
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';

  /** @param {string} dir @param {string[]} args */
  function git(dir, args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  }

  /** A temp-dir git repo holding one epic with a two-topic discovery map. */
  function setupGitFixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-seq-'));
    git(dir, ['init', '-q', '-b', 'main']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'auth-flow': { routing: 'discussion', source: 'discovery' },
            'session-model': { routing: 'research', source: 'discovery', order: 1 },
          },
        },
      },
    });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);
    return dir;
  }

  function readManifest(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'));
  }

  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets every order, commits scoped with the sequence message, reports the assignment', () => {
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    const res = JSON.parse(execFileSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' }).trim());

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.ordered, { 'auth-flow': 1, 'session-model': 2 });
    assert.strictEqual(res.committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'discovery(payments): sequence topic map');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    const items = readManifest(dir).phases.discovery.items;
    assert.strictEqual(items['auth-flow'].order, 1);
    assert.strictEqual(items['session-model'].order, 2);
  });

  it('re-applying the same orders is a no-op commit: committed null, note, exit 0', () => {
    execFileSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' });
    const res = JSON.parse(execFileSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' }).trim());
    assert.deepStrictEqual(res, { ok: true, ordered: { 'auth-flow': 1, 'session-model': 2 }, committed: null, note: 'nothing to commit' });
  });

  it('rejects unknown topics before writing anything', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8');
    const res = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'ghost=2'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.match(JSON.parse(res.stderr.trim()).error, /no discovery item "ghost"/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'), before);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('rejects bad orders and malformed assignments — loud and specific', () => {
    for (const pair of ['auth-flow=0', 'auth-flow=-1', 'auth-flow=abc', 'auth-flow=1.5', 'auth-flow']) {
      const res = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', pair], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(res.status, 1, pair);
      assert.match(JSON.parse(res.stderr.trim()).error, /bad assignment/, pair);
    }
    const dup = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'auth-flow=2'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(dup.stderr.trim()).error, /assigned twice/);
    const usage = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(usage.stderr.trim()).error, /Usage: engine discovery-map sequence/);
    const noMap = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'ghost-unit', 'auth-flow=1'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(noMap.stderr.trim()).error, /manifest not found/);
  });
});
