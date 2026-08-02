'use strict';

//
// Tests for the commit door: `engine commit --topic` pathspec'd commits,
// the commit lock, the index.lock retry, and the transaction-tail degrade.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync, spawn } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-commit-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

function cleanupFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

/** Files in the HEAD commit. */
function headFiles(dir) {
  return git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean);
}

/** `git status --porcelain` lines. */
function statusLines(dir) {
  return git(dir, ['status', '--porcelain']).split('\n').filter(Boolean);
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args, env) {
  const out = execFileSync('node', [ENGINE, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  const nl = out.indexOf('\n');
  return JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim());
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(dir, args, env) {
  const res = spawnSync('node', [ENGINE, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

function epicManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'topic-a': { routing: 'discussion', source: 'discovery' } } },
      research: { items: { 'auth-flow': { status: 'in-progress' } } },
      discussion: { items: { 'topic-a': { status: 'in-progress' }, 'topic-b': { status: 'in-progress' } } },
    },
  };
}

/** Two in-progress discussion topics, both committed clean. */
function setupTwoTopicFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n');
  writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\n');
  writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\n');
  commitAll(dir, 'init');
  return dir;
}

describe('engine commit --topic: pathspec isolation', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits own topic + manifest, leaves the other topic dirty and uncommitted', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.strictEqual(res.ok, true);
    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('.workflows/payments/discussion/topic-a.md'), 'own topic committed');
    assert.ok(files.includes('.workflows/payments/manifest.json'), 'manifest committed');
    assert.ok(!files.includes('.workflows/payments/discussion/topic-b.md'), 'peer topic not committed');
    assert.deepStrictEqual(statusLines(dir), [' M .workflows/payments/discussion/topic-b.md'], 'peer dirt untouched');
  });

  it('leaves content another process staged out of the commit and still staged', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    git(dir, ['add', '--', '.workflows/payments/discussion/topic-b.md']);

    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.ok(!headFiles(dir).includes('.workflows/payments/discussion/topic-b.md'), 'staged peer file not committed');
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '.workflows/payments/discussion/topic-b.md', 'peer staging preserved');
  });

  it('commits an untracked artifact directory (specification phase)', () => {
    writeFile(dir, '.workflows/payments/specification/topic-a/specification.md', '# Spec\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'spec(payments): construct topic-a', '--topic', 'specification/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(headFiles(dir).includes('.workflows/payments/specification/topic-a/specification.md'));
  });

  it('reports nothing to commit on clean paths, and on paths that do not exist', () => {
    const clean = engine(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'discussion/topic-a']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');

    const missing = engine(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'review/never-started']);
    assert.strictEqual(missing.committed, null);
    assert.strictEqual(missing.note, 'nothing to commit');
  });

  it('does not stage the knowledge store — the KB dir never rides a --topic commit', () => {
    writeFile(dir, '.workflows/.knowledge/metadata.json', '{}\n');
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');

    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.ok(!headFiles(dir).some((f) => f.startsWith('.workflows/.knowledge/')), 'KB dir not committed');
    assert.ok(statusLines(dir).some((l) => l.includes('.workflows/.knowledge')), 'KB dirt left in place');
  });

  it('--kb stages the knowledge store alongside the topic pathspec', () => {
    writeFile(dir, '.workflows/.knowledge/metadata.json', '{}\n');
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nconcluded\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer dirt\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments): complete topic-a discussion', '--topic', 'discussion/topic-a', '--kb']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('.workflows/.knowledge/metadata.json'), 'KB dirt rides the --kb commit');
    assert.ok(!files.includes('.workflows/payments/discussion/topic-b.md'), 'peer topic still excluded');
  });

  it('rejects malformed and illegal --topic specs', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'bogus/topic-a']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion/..']).error, /invalid topic name/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion/topic-a', '--plan', 'topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--inbox', '-m', 'x', '--topic', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--kb']).error, /Usage/);
  });
});

describe('commit door: index.lock retry and the commit lock', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('retries through transient index.lock contention', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    const indexLock = path.join(dir, '.git', 'index.lock');
    fs.writeFileSync(indexLock, '');
    // A detached deleter releases git's own lock mid-retry.
    spawn('node', ['-e', `setTimeout(() => require('fs').unlinkSync(${JSON.stringify(indexLock)}), 400)`], {
      detached: true, stdio: 'ignore',
    }).unref();

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
  });

  it('surfaces the git error once the retry budget is exhausted, and releases the commit lock', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');

    const res = engineFails(
      dir,
      ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a'],
      { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' },
    );

    assert.match(res.error, /index\.lock/);
    assert.ok(!fs.existsSync(path.join(dir, '.git', 'workflows-commit.lock')), 'commit lock released on failure');
  });

  it('breaks a stale commit lock left by a crashed process', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    const lock = path.join(dir, '.git', 'workflows-commit.lock');
    fs.writeFileSync(lock, '99999');
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(lock, past, past);

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(!fs.existsSync(lock), 'stale lock cleared');
  });
});

describe('commit door: transaction-tail degrade', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a tail-committing verb saves state and degrades to a pending note when git is blocked', () => {
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');

    const res = engine(
      dir,
      ['topic', 'cancel', 'payments', 'research', 'auth-flow'],
      { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' },
    );

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, null);
    assert.strictEqual(res.note, 'commit pending — state saved; retry with engine commit');
    assert.ok(res.warnings.some((w) => w.includes('commit failed')), `warnings carry the git error: ${JSON.stringify(res.warnings)}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    assert.strictEqual(manifest.phases.research.items['auth-flow'].status, 'cancelled', 'state landed despite the failed commit');
  });
});
