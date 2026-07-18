'use strict';

// ---------------------------------------------------------------------------
// Kernel manifest IO (workflow-engine/scripts/kernel/manifest-io.cjs) and the
// engine's lock discipline over it: one read/parse, one atomic-write
// serialisation, one lock protocol for every manifest writer.
//
// Proves the concurrency contract the island-absorption wave closed: engine
// writes take the same .lock the CLI honours — a fresh lock blocks the engine
// until released, a stale lock is broken per the shared constants, and no
// lock file ever leaks into a transaction's commit.
// ---------------------------------------------------------------------------

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync, spawn } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
const io = require('../../skills/workflow-engine/scripts/kernel/manifest-io.cjs');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-io-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function writeEpicFixture(dir) {
  writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify({
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'auth-flow': { routing: 'research', source: 'discovery', summary: 'Auth' } } },
      research: { items: { 'auth-flow': { status: 'in-progress' } } },
    },
  }, null, 2) + '\n');
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
}

/** Age a lock file well past the stale threshold. @param {string} file */
function makeStale(file) {
  const past = (Date.now() - io.LOCK_STALE_MS - 60000) / 1000;
  fs.utimesSync(file, past, past);
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args) {
  return JSON.parse(execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' }).trim());
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('manifest-io — shared lock constants and IO contract', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-io-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('carries the manifest CLI lock discipline: 30s stale, 50ms retry, 10s timeout', () => {
    assert.strictEqual(io.LOCK_STALE_MS, 30000);
    assert.strictEqual(io.LOCK_RETRY_MS, 50);
    assert.strictEqual(io.LOCK_TIMEOUT_MS, 10000);
  });

  it('work-unit read is loud on missing and on corrupt JSON', () => {
    assert.throws(() => io.readWorkUnitManifest(dir, 'ghost'), /manifest not found/);
    writeFile(dir, 'broken/manifest.json', '{oops');
    assert.throws(() => io.readWorkUnitManifest(dir, 'broken'), /invalid JSON/);
  });

  it('writes with the one shared serialisation: two-space indent plus trailing newline', () => {
    fs.mkdirSync(path.join(dir, 'unit'));
    io.writeWorkUnitManifestAtomic(dir, 'unit', { name: 'unit', phases: {} });
    const raw = fs.readFileSync(path.join(dir, 'unit/manifest.json'), 'utf8');
    assert.strictEqual(raw, JSON.stringify({ name: 'unit', phases: {} }, null, 2) + '\n');
    // No temp file left behind.
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'unit')), ['manifest.json']);
  });

  it('project read: missing file is a first-write {}, corrupt JSON refuses loudly', () => {
    assert.deepStrictEqual(io.readProjectManifest(dir), {});
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{"work_units": {},}');
    assert.throws(() => io.readProjectManifest(dir), /not valid JSON/);
    assert.throws(() => io.readProjectManifest(dir), /by hand/);
  });

  it('withWorkUnitLock: lock file exists (pid inside) during fn, gone after — including on throw', () => {
    fs.mkdirSync(path.join(dir, 'unit'));
    const lock = path.join(dir, 'unit', '.lock');
    const result = io.withWorkUnitLock(dir, 'unit', () => {
      assert.strictEqual(fs.readFileSync(lock, 'utf8'), String(process.pid));
      return 'ran';
    });
    assert.strictEqual(result, 'ran');
    assert.ok(!fs.existsSync(lock));

    assert.throws(() => io.withWorkUnitLock(dir, 'unit', () => { throw new Error('boom'); }), /boom/);
    assert.ok(!fs.existsSync(lock), 'lock must be released when fn throws');
  });

  it('withWorkUnitLock refuses a missing work-unit directory with the read\'s not-found error', () => {
    assert.throws(() => io.withWorkUnitLock(dir, 'ghost', () => 'never'), /manifest not found/);
    assert.ok(!fs.existsSync(path.join(dir, 'ghost')), 'no directory conjured for the lock file');
  });

  it('withWorkUnitLock breaks a stale lock and proceeds', () => {
    fs.mkdirSync(path.join(dir, 'unit'));
    const lock = path.join(dir, 'unit', '.lock');
    fs.writeFileSync(lock, '99999');
    makeStale(lock);
    const result = io.withWorkUnitLock(dir, 'unit', () => 'ran');
    assert.strictEqual(result, 'ran');
    assert.ok(!fs.existsSync(lock));
  });

  it('withProjectLock: .project-lock held during fn, released after', () => {
    const lock = path.join(dir, '.project-lock');
    io.withProjectLock(dir, () => {
      assert.ok(fs.existsSync(lock));
    });
    assert.ok(!fs.existsSync(lock));
  });
});

describe('engine writes take the work-unit lock', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); writeEpicFixture(dir); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('a stale .lock is broken per the constants: the write proceeds, the lock is cleaned up', () => {
    const lock = path.join(dir, '.workflows/payments/.lock');
    fs.writeFileSync(lock, '99999');
    makeStale(lock);

    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['auth-flow'].status, 'in-progress');
    assert.ok(!fs.existsSync(lock), 'stale lock broken and not left behind');
  });

  it('a fresh .lock blocks the engine until released — the write lands only after', async () => {
    const lock = path.join(dir, '.workflows/payments/.lock');
    fs.writeFileSync(lock, '12345');

    const child = spawn('node', [ENGINE, 'discovery-map', 'edit', 'payments', 'auth-flow', '--summary', 'After the lock'], {
      cwd: dir,
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const exit = new Promise((resolve) => child.on('exit', resolve));

    // Long enough for node to start and reach the lock wait; far inside the
    // 10s timeout, so a passing run never races it.
    const raced = await Promise.race([exit.then(() => 'exited'), sleep(1500).then(() => 'waiting')]);
    assert.strictEqual(raced, 'waiting', 'engine must wait on a live lock');
    assert.strictEqual(readManifest(dir, 'payments').phases.discovery.items['auth-flow'].summary, 'Auth',
      'no write while the lock is held');

    fs.unlinkSync(lock);
    assert.strictEqual(await exit, 0);
    assert.strictEqual(JSON.parse(stdout.trim()).ok, true);
    assert.strictEqual(readManifest(dir, 'payments').phases.discovery.items['auth-flow'].summary, 'After the lock');
    assert.ok(!fs.existsSync(lock));
  });

  it('committing transactions release the lock before staging — no .lock in the commit', () => {
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);

    const res = engine(dir, ['topic', 'cancel', 'payments', 'research', 'auth-flow']);
    assert.strictEqual(res.ok, true);
    assert.ok(res.committed, 'cancel commits');
    const show = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']);
    assert.ok(!show.includes('.lock'), `lock file leaked into the commit:\n${show}`);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/payments/.lock')));
  });
});

describe('engine project-manifest writes take the project lock', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/.cache/payments/discovery/session-001.md', '# Session\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('a stale .project-lock is broken: create registers and cleans up', () => {
    const lock = path.join(dir, '.workflows/.project-lock');
    fs.writeFileSync(lock, '99999');
    makeStale(lock);

    const res = engine(dir, [
      'workunit', 'create', 'payments', 'feature',
      '--description', 'Payments', '--session-log-file', '.workflows/.cache/payments/discovery/session-001.md',
    ]);
    assert.strictEqual(res.ok, true);
    const project = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/manifest.json'), 'utf8'));
    assert.deepStrictEqual(project.work_units, { payments: { work_type: 'feature' } });
    assert.ok(!fs.existsSync(lock), 'stale project lock broken and not left behind');
    const show = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']);
    assert.ok(!show.includes('lock'), `lock file leaked into the commit:\n${show}`);
  });

  it('a fresh .project-lock blocks create until released', async () => {
    const lock = path.join(dir, '.workflows/.project-lock');
    fs.writeFileSync(lock, '12345');

    const child = spawn('node', [ENGINE,
      'workunit', 'create', 'payments', 'feature',
      '--description', 'Payments', '--session-log-file', '.workflows/.cache/payments/discovery/session-001.md',
    ], { cwd: dir });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const exit = new Promise((resolve) => child.on('exit', resolve));

    const raced = await Promise.race([exit.then(() => 'exited'), sleep(1500).then(() => 'waiting')]);
    assert.strictEqual(raced, 'waiting', 'create must wait on a live project lock');
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/manifest.json')), 'no registration while the lock is held');

    fs.unlinkSync(lock);
    assert.strictEqual(await exit, 0);
    assert.strictEqual(JSON.parse(stdout.trim()).ok, true);
    const project = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/manifest.json'), 'utf8'));
    assert.deepStrictEqual(project.work_units, { payments: { work_type: 'feature' } });
  });
});

describe('CLI and engine stay one implementation', () => {
  it('the manifest CLI requires the kernel manifest-io module — no local lock or write copies', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../skills/workflow-manifest/scripts/manifest.cjs'), 'utf8');
    assert.ok(src.includes("require('../../workflow-engine/scripts/kernel/manifest-io.cjs')"),
      'manifest CLI must consume the kernel manifest IO');
    assert.ok(!src.includes('openSync'), 'no local lock implementation in the CLI');
    assert.ok(!src.includes('renameSync'), 'no local atomic-write implementation in the CLI');
    assert.ok(!/LOCK_STALE_MS\s*=/.test(src), 'no local copy of the lock constants');
  });

  it('the engine kernel façade requires the sibling manifest-io module — no local IO copy', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../skills/workflow-engine/scripts/kernel/manifest.cjs'), 'utf8');
    assert.ok(src.includes("require('./manifest-io.cjs')"),
      'engine kernel must consume the sibling manifest IO');
    assert.ok(!src.includes('readFileSync'), 'no local read implementation in the kernel');
    assert.ok(!src.includes('renameSync'), 'no local atomic-write implementation in the kernel');
  });
});
