'use strict';

// ---------------------------------------------------------------------------
// Kernel manifest IO (workflow-engine/scripts/kernel/manifest-io.cjs) and the
// engine's lock discipline over it: one read/parse, one atomic-write
// serialisation, one lock protocol for every manifest writer.
//
// Proves the concurrency contract the island-absorption wave closed: engine
// writes take the same .lock as every manifest writer — a fresh lock blocks the engine
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

  it('carries the shared lock discipline: 30s stale, 50ms retry, 10s timeout, 60s tmp orphan', () => {
    assert.strictEqual(io.LOCK_STALE_MS, 30000);
    assert.strictEqual(io.LOCK_RETRY_MS, 50);
    assert.strictEqual(io.LOCK_TIMEOUT_MS, 10000);
    assert.strictEqual(io.TMP_STALE_MS, 60000);
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

  it('lock timeout carries the remedy: lock path, 30s stale self-clear, manual delete', () => {
    fs.mkdirSync(path.join(dir, 'unit'));
    const lock = path.join(dir, 'unit', '.lock');
    fs.writeFileSync(lock, String(process.pid)); // fresh — never breakable
    assert.throws(
      () => io.acquireLockFile(lock, 'Timed out waiting for lock on "unit"', 250),
      (/** @type {Error} */ err) => {
        assert.match(err.message, /Timed out waiting for lock on "unit"/);
        assert.ok(err.message.includes(lock), 'message names the lock file');
        assert.match(err.message, /clears automatically after 30 seconds/);
        assert.match(err.message, /delete the lock file/);
        return true;
      }
    );
    assert.strictEqual(fs.readFileSync(lock, 'utf8'), String(process.pid), 'fresh lock never touched');
  });

  it('write sweeps orphaned temp files past TMP_STALE_MS and spares fresh ones', () => {
    fs.mkdirSync(path.join(dir, 'unit'));
    const orphan = path.join(dir, 'unit', '.manifest.json.11111.tmp');
    const fresh = path.join(dir, 'unit', '.manifest.json.22222.tmp');
    fs.writeFileSync(orphan, '{}');
    fs.writeFileSync(fresh, '{}');
    const past = (Date.now() - io.TMP_STALE_MS - 5000) / 1000;
    fs.utimesSync(orphan, past, past);

    io.writeWorkUnitManifestAtomic(dir, 'unit', { name: 'unit' });
    assert.ok(!fs.existsSync(orphan), 'crashed writer\'s orphan swept');
    assert.ok(fs.existsSync(fresh), 'fresh temp file spared — a live concurrent writer owns it');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'unit/manifest.json'), 'utf8')), { name: 'unit' });
  });
});

describe('stale-lock break is atomic — one winner, mutual exclusion holds', () => {
  const IO_PATH = path.join(__dirname, '../../skills/workflow-engine/scripts/kernel/manifest-io.cjs');
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-break-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  /** Spawn a node child running `script` with argv, resolving with its exit code. */
  function child(script, args) {
    const proc = spawn('node', ['-e', script, ...args]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    return new Promise((resolve) => proc.on('exit', (code) => resolve({ code, stderr })));
  }

  it('N contenders racing the break primitive: exactly one wins, no residue', async () => {
    const lock = path.join(dir, '.lock');
    const log = path.join(dir, 'break.log');
    fs.writeFileSync(lock, '99999');
    makeStale(lock);

    const script = [
      "const fs = require('fs');",
      'const [ioPath, lock, fenceStr, log] = process.argv.slice(1);',
      'const io = require(ioPath);',
      'const fence = Number(fenceStr);',
      'while (Date.now() < fence) {}',
      'const won = io.breakStaleLockFile(lock);',
      "fs.appendFileSync(log, process.pid + ' ' + won + '\\n');",
    ].join('\n');

    // Fence far enough out that every child has booted before contending.
    const fence = Date.now() + 700;
    const results = await Promise.all(
      Array.from({ length: 6 }, () => child(script, [IO_PATH, lock, String(fence), log])));
    for (const r of results) assert.strictEqual(r.code, 0, r.stderr);

    const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 6, 'every contender reported');
    const winners = lines.filter((line) => line.endsWith(' true'));
    assert.strictEqual(winners.length, 1, `exactly one contender may break the stale lock:\n${lines.join('\n')}`);
    assert.ok(!fs.existsSync(lock), 'stale lock gone');
    assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => n.includes('.breaking.')), [],
      'the winner removed its renamed file');
  });

  it('N contenders racing a stale lock through withProjectLock: all acquire, never concurrently', async () => {
    const lock = path.join(dir, '.project-lock');
    const log = path.join(dir, 'hold.log');
    fs.writeFileSync(lock, '99999');
    makeStale(lock);

    const script = [
      "const fs = require('fs');",
      'const [ioPath, wfDir, fenceStr, log] = process.argv.slice(1);',
      'const io = require(ioPath);',
      'const fence = Number(fenceStr);',
      'while (Date.now() < fence) {}',
      'io.withProjectLock(wfDir, () => {',
      '  const t0 = Date.now();',
      '  const end = t0 + 40;',
      '  while (Date.now() < end) {}',
      "  fs.appendFileSync(log, process.pid + ' ' + t0 + ' ' + Date.now() + '\\n');",
      '});',
    ].join('\n');

    const fence = Date.now() + 700;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => child(script, [IO_PATH, dir, String(fence), log])));
    for (const r of results) assert.strictEqual(r.code, 0, r.stderr);

    const holds = fs.readFileSync(log, 'utf8').trim().split('\n')
      .map((line) => line.split(' ').map(Number))
      .sort((a, b) => a[1] - b[1]);
    assert.strictEqual(holds.length, 5, 'every contender eventually acquired');
    for (let i = 1; i < holds.length; i++) {
      assert.ok(holds[i][1] >= holds[i - 1][2],
        `holds overlap — two contenders held the lock at once:\n${holds.map((h) => h.join(' ')).join('\n')}`);
    }
    assert.ok(!fs.existsSync(lock), 'lock released after the last holder');
  });
});

describe('structurally corrupt manifests refuse writes', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-root-'));
    fs.mkdirSync(path.join(dir, '.workflows/unit'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  /** Run the engine expecting `{ok:false}` exit 1; returns the parsed stderr JSON. */
  function engineFail(args) {
    const res = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    return JSON.parse(res.stderr.trim());
  }

  /** Write raw manifest bytes; returns a function asserting they are untouched. */
  function plant(rel, raw) {
    const file = path.join(dir, rel);
    fs.writeFileSync(file, raw);
    return () => assert.strictEqual(fs.readFileSync(file, 'utf8'), raw, 'manifest bytes must be untouched');
  }

  it('array root: set refuses with the domain diagnostic, file byte-identical', () => {
    const untouched = plant('.workflows/unit/manifest.json', '[]\n');
    const res = engineFail(['manifest', 'set', 'unit', 'status', 'completed']);
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /manifest root is not an object/);
    untouched();
  });

  it('null root: the domain diagnostic, never a raw TypeError', () => {
    const untouched = plant('.workflows/unit/manifest.json', 'null\n');
    const res = engineFail(['manifest', 'set', 'unit', 'status', 'completed']);
    assert.match(res.error, /manifest root is not an object/);
    assert.ok(!/TypeError/.test(res.error), 'no raw JS TypeError may surface');
    untouched();
  });

  it('number root: the domain diagnostic, never a raw TypeError', () => {
    const untouched = plant('.workflows/unit/manifest.json', '42\n');
    const res = engineFail(['manifest', 'set', 'unit', 'status', 'completed']);
    assert.match(res.error, /manifest root is not an object/);
    assert.ok(!/TypeError/.test(res.error));
    untouched();
  });

  it('string `phases` + topic start: refusal, manifest pristine — no silent coercion', () => {
    const untouched = plant('.workflows/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'epic', status: 'in-progress', phases: 'oops',
    }, null, 2) + '\n');
    const res = engineFail(['topic', 'start', 'unit', 'research', 'auth']);
    assert.match(res.error, /"phases" is not an object \(found string\)/);
    untouched();
  });

  it('array `phases` + topic start: refusal — fields set into an array are stringify-dropped', () => {
    const untouched = plant('.workflows/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'epic', status: 'in-progress', phases: [],
    }, null, 2) + '\n');
    const res = engineFail(['topic', 'start', 'unit', 'research', 'auth']);
    assert.match(res.error, /"phases" is not an object \(found array\)/);
    untouched();
  });

  it('scalar mid-path container: set refuses instead of coercing to {}', () => {
    const untouched = plant('.workflows/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'epic', status: 'in-progress', phases: { research: 'active' },
    }, null, 2) + '\n');
    const res = engineFail(['manifest', 'set', 'unit.research.auth', 'status', 'in-progress']);
    assert.match(res.error, /"phases\.research" is not an object — refusing to overwrite/);
    untouched();
  });

  it('named field into an array: set refuses — stringify would silently drop it', () => {
    const untouched = plant('.workflows/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'feature', status: 'in-progress', imports: [], phases: {},
    }, null, 2) + '\n');
    const res = engineFail(['manifest', 'set', 'unit', 'imports.name', 'x']);
    assert.match(res.error, /"imports" is an array — cannot set field "name"/);
    untouched();
  });

  it('array-root project manifest: set refuses with the domain diagnostic, file byte-identical', () => {
    const untouched = plant('.workflows/manifest.json', '[]\n');
    const res = engineFail(['manifest', 'set', 'project.defaults.plan_format', 'tick']);
    assert.match(res.error, /manifest root is not an object/);
    untouched();
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
    // 'close', not 'exit': stdout must be fully flushed before it is parsed.
    const exit = new Promise((resolve) => child.on('close', resolve));

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
    // 'close', not 'exit': stdout must be fully flushed before it is parsed.
    const exit = new Promise((resolve) => child.on('close', resolve));

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

describe('field surface and transactions stay one implementation', () => {
  it('the field surface requires the kernel manifest-io module — no local lock or write copies', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../skills/workflow-engine/scripts/domain/fields.cjs'), 'utf8');
    assert.ok(src.includes("require('../kernel/manifest-io.cjs')"),
      'fields must consume the kernel manifest IO');
    assert.ok(!src.includes('openSync'), 'no local lock implementation in the field surface');
    assert.ok(!src.includes('renameSync'), 'no local atomic-write implementation in the field surface');
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
