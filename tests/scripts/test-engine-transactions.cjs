'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

// Hermetic git: no user/system config leaks into fixtures or the engine's
// spawned git subprocesses.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** A temp-dir fixture that is a real git repo with a `.workflows/` tree. */
function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-tx-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

function cleanupFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
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

function lastMessage(dir) {
  return git(dir, ['log', '-1', '--pretty=%s']).trim();
}

function shortHead(dir) {
  return git(dir, ['rev-parse', '--short', 'HEAD']).trim();
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
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

/** An epic manifest with plural phase items and a discovery-map entry carrying `order`. */
function epicManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'auth-flow': { routing: 'discussion', order: 2, source: 'discovery' } } },
      research: { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'completed' } } },
      discussion: { items: { 'session-model': { status: 'completed' }, 'refund-policy': { status: 'in-progress' } } },
    },
  };
}

function setupEpicFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n');
  commitAll(dir, 'init');
  return dir;
}

describe('engine topic cancel', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('stashes status, cancels, drops the discovery order, commits — KB failure is a warning', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'research');
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, shortHead(dir));
    // No KB configured in the fixture — warn-don't-block: the cancel still
    // landed and the failure is reported, not thrown.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge remove failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], {
      status: 'cancelled',
      previous_status: 'in-progress',
    });
    // `order` deleted; the rest of the map item preserved.
    assert.deepStrictEqual(m.phases.discovery.items['auth-flow'], {
      routing: 'discussion',
      source: 'discovery',
    });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): cancel auth-flow (research)');
  });

  it('rejects cancelling an already-cancelled topic', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    const err = engineFails(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /already cancelled/);
  });

  it('rejects unknown work unit, phase, and topic — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'cancel', 'ghost', 'research', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'nonsense', 'auth-flow']).error, /unknown phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'planning', 'auth-flow']).error, /no planning items/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'research', 'ghost']).error, /no research item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments']).error, /Usage: engine topic cancel/);
  });
});

describe('engine topic reactivate', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('round-trips a cancel: status restored, previous_status removed, commit recorded', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'research', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.committed, shortHead(dir));
    // Restored to a non-completed status — no KB index attempted, no warnings.
    assert.deepStrictEqual(res.warnings, []);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], { status: 'in-progress' });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate auth-flow (research)');
  });

  it('re-indexes a completed topic in an indexed phase — KB failure is a warning', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discussion', 'session-model']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discussion', 'session-model']);

    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate session-model (discussion)');
  });

  it('rejects reactivating a non-cancelled topic', () => {
    const err = engineFails(dir, ['topic', 'reactivate', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /not cancelled \(status: in-progress\)/);
  });

  it('rejects a cancelled topic with no previous_status', () => {
    const m = epicManifest();
    m.phases.research.items['auth-flow'] = { status: 'cancelled' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const err = engineFails(dir, ['topic', 'reactivate', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /no previous_status/);
  });
});

describe('engine topic start', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('creates an absent phase item with status in-progress — init-phase semantics, no commit', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'investigation', status: 'in-progress', created: true });

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.investigation.items, { 'auth-flow': { status: 'in-progress' } });
    // No commit inside — the manifest change is left for the session's cadence.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('creates alongside existing items in a populated phase — siblings untouched', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'settlement']);

    assert.strictEqual(res.created, true);
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
      settlement: { status: 'in-progress' },
    });
  });

  it('resumes an existing in-progress item: created false, fields preserved', () => {
    const m0 = epicManifest();
    m0.phases.research.items['auth-flow'].note = 'keep me';
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'research', status: 'in-progress', created: false });
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], { status: 'in-progress', note: 'keep me' });
  });

  it('rejects starting a completed item — resuming is not starting', () => {
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'fee-model']);
    assert.match(err.error, /already completed — start cannot resume it/);
  });

  it('rejects starting a cancelled item — reactivate owns that path', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is cancelled — reactivate it instead/);
  });

  it('rejects unknown work unit, phase, and missing args — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'start', 'ghost', 'research', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'nonsense', 'auth-flow']).error, /unknown phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'research']).error, /Usage: engine topic start/);
    assert.match(engineFails(dir, ['topic', 'begin', 'payments', 'research', 'auth-flow']).error, /Usage: engine topic <start\|complete\|cancel\|reactivate>/);
  });
});

describe('engine topic complete', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('completes an indexed-phase item and KB-indexes it — failure is a warning, no commit', () => {
    const res = engine(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'research');
    assert.strictEqual(res.status, 'completed');
    // No KB configured in the fixture — warn-don't-block.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'completed' },
      'fee-model': { status: 'completed' },
    });
    // No commit inside.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('completes a non-indexed phase with no KB attempt — empty warnings', () => {
    const m0 = epicManifest();
    m0.phases.scoping = { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'in-progress' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'complete', 'payments', 'scoping', 'fee-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'fee-model', phase: 'scoping', status: 'completed', warnings: [] });
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.scoping.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
    });
  });

  it('is idempotent on an already-completed item — mirrors the manifest set it replaces', () => {
    engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    const res = engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    assert.strictEqual(res.status, 'completed');
  });

  it('rejects completing a non-existent item, unknown phase, and a cancelled item', () => {
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'research', 'ghost']).error, /no research item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']).error, /no investigation items/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'nonsense', 'auth-flow']).error, /unknown phase "nonsense"/);
    engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']).error, /is cancelled — reactivate it instead/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments']).error, /Usage: engine topic complete/);
  });

  it('round-trips with start: start → complete → reopen via start is still rejected', () => {
    engine(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);
    const res = engine(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.warnings.length, 1);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);
    assert.match(err.error, /already completed/);
  });
});

describe('engine inbox archive / restore / delete', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    writeFile(dir, '.workflows/.inbox/bugs/2026-06-02--login-loop.md', '# Login Loop\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('archives a single item — file moved to its source folder under .archived, slug commit message', () => {
    const res = engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.archived, ['.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive smart-retry');
  });

  it('archives a multi-item set in one commit with the N-items message form', () => {
    const res = engine(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/bugs/2026-06-02--login-loop.md',
    ]);

    assert.deepStrictEqual(res.archived, [
      '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/.archived/bugs/2026-06-02--login-loop.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/bugs/2026-06-02--login-loop.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive 2 items');
    // One commit for the whole set.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '2');
  });

  it('restores an archived item back to its live folder', () => {
    engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'restore', '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.restored, ['.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): restore smart-retry');
  });

  it('deletes an archived item via git rm', () => {
    engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'delete', '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.deleted, ['.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): delete smart-retry');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '');
  });

  it('rejects invalid paths strictly, before anything moves', () => {
    // Outside the inbox entirely.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/payments/manifest.json']).error,
      /not a live inbox path/);
    // Unknown folder.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/notes/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Traversal.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/../../../etc/passwd.md']).error,
      /not a live inbox path|without ".."/);
    // Archived path passed to archive.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/.archived/ideas/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Live path passed to delete.
    assert.match(
      engineFails(dir, ['inbox', 'delete', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Live path passed to restore.
    assert.match(
      engineFails(dir, ['inbox', 'restore', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Missing file.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--ghost.md']).error,
      /not found/);
    // One bad path poisons the whole set — the good file did not move.
    engineFails(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/ideas/2026-06-01--ghost.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.match(engineFails(dir, ['inbox', 'archive']).error, /Usage: engine inbox/);
  });
});

describe('engine commit', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', '{"name":"payments"}\n');
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-01--x.md', '# X\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('stages the work-unit scope and commits with the given message', () => {
    writeFile(dir, '.workflows/payments/discussion/auth.md', '# Auth\n');
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): document decision']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'discussion(payments/auth): document decision');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('a clean tree is fine: committed null, nothing-to-commit note, exit 0', () => {
    const res = engine(dir, ['commit', 'payments', '-m', 'noop']);
    assert.deepStrictEqual(res, { ok: true, committed: null, note: 'nothing to commit' });
  });

  it('--inbox commits the inbox scope', () => {
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-02--y.md', '# Y\n');
    const res = engine(dir, ['commit', '--inbox', '-m', 'workflow(inbox): capture y']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): capture y');
  });

  it('rejects a missing message, missing scope, and bad work unit names', () => {
    assert.match(engineFails(dir, ['commit', 'payments']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', 'payments', '--inbox', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '../escape', '-m', 'msg']).error, /invalid work unit name/);
    assert.match(engineFails(dir, ['commit', 'ghost', '-m', 'msg']).error, /no work unit directory/);
  });
});
