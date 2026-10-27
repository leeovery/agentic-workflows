'use strict';

// ---------------------------------------------------------------------------
// Kernel manifest IO (workflow-engine/scripts/kernel/manifest-io.cjs) and the
// engine's lock discipline over it: one read/parse, one atomic-write
// serialisation, one lock protocol for every manifest writer.
//
// Proves the concurrency contract: every manifest writer holds the one
// writer lock at the state's root — a live holder blocks the engine until it
// lets go, a dead holder's claim is taken over at once, a read never waits,
// and a transaction holds the lock across its commit.
//
// A race runs its contenders as children that wait at a barrier until every
// one is ready, reports evidence that they met, and fails where they did
// not: a race that never happened proves nothing. A call that waits on a
// lock runs in process, and the test lets the lock go at the call's own
// attempts (`lockAttempts`), never on a timer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync, spawn, spawnSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const io = require('../../skills/workflow-engine/scripts/kernel/manifest-io.cjs');
const { processStartTime } = require('../../skills/workflow-engine/scripts/kernel/process.cjs');
const { COMMANDS, WRITER_LOCK_EXEMPT } = require('../../skills/workflow-engine/scripts/engine.cjs');

const { ENGINE, stateGit, commitAll, cleanupFixture, lockAttempts, ok: engine } = harness;

const setupGitFixture = () => harness.setupGitFixture('engine-io-');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function writeEpicFixture(dir) {
  writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify({
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
  return JSON.parse(fs.readFileSync(path.join(dir, '.leeway', wu, 'manifest.json'), 'utf8'));
}

/** Age a lock file well past the stale threshold. @param {string} file */
function makeStale(file) {
  const past = (Date.now() - io.LOCK_STALE_MS - 60000) / 1000;
  fs.utimesSync(file, past, past);
}

/** A claim whose holder no longer runs. */
const DEAD = JSON.stringify({ pid: 2147483646, pid_start: null });

/** A claim this test's own process holds: alive, and never a child's. */
const live = () => JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) });

/** A claim another live process holds: the one running this suite. */
const peer = () => JSON.stringify({ pid: process.ppid, pid_start: processStartTime(process.ppid) });

/**
 * `fn` run in this process with `ps` failing, its PATH put back after.
 * @template T @param {{path: string}} ps @param {() => T} fn @returns {T}
 */
function whilePsFails(ps, fn) {
  const saved = process.env.PATH;
  process.env.PATH = ps.path;
  try {
    return fn();
  } finally {
    process.env.PATH = saved;
  }
}

const IO_PATH = path.join(__dirname, '../../skills/workflow-engine/scripts/kernel/manifest-io.cjs');

/**
 * What every contender's script opens with: the kernel loaded, and its
 * calls — `atBarrier()`, where it says it is ready and waits until every
 * contender is; `report(r)`, its one line back, last; and
 * `untilAllReported()`, where it waits, holding what it holds, until every
 * contender has reported.
 */
const CONTENDER = [
  "const fs = require('fs');",
  `const io = require(${JSON.stringify(IO_PATH)});`,
  "const atBarrier = () => { fs.writeSync(1, 'ready\\n'); fs.readSync(0, Buffer.alloc(1)); };",
  "const report = (r) => fs.writeSync(1, JSON.stringify(r) + '\\n');",
  'const untilAllReported = () => fs.readSync(0, Buffer.alloc(1));',
].join('\n');

/**
 * One contender, a node child running `script`: the `lines` it prints;
 * `printed(n)`, resolved once it has printed `n` of them or exited; and
 * `done`, with its exit code, its stderr and its lines.
 * @param {string} script @param {string[]} args @param {NodeJS.ProcessEnv} env
 */
function contender(script, args, env) {
  const child = spawn(process.execPath, ['-e', script, ...args], { env });
  child.stdin.on('error', () => {}); // one that has exited has no stdin left to write to
  /** @type {string[]} */
  const lines = [];
  let stderr = '';
  let exited = false;
  /** @type {Set<() => void>} */
  const waiters = new Set();
  const changed = () => { for (const wake of waiters) wake(); };
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  readline.createInterface({ input: child.stdout }).on('line', (line) => { lines.push(line); changed(); });
  /** @type {Promise<{code: number|null, stderr: string, lines: string[]}>} */
  const done = new Promise((resolve) => child.on('close', (code) => { exited = true; changed(); resolve({ code, stderr, lines }); }));
  /** @param {number} count @returns {Promise<void>} */
  const printed = (count) => new Promise((resolve) => {
    const check = () => {
      if (lines.length < count && !exited) return;
      waiters.delete(check);
      resolve();
    };
    waiters.add(check);
    check();
  });
  return { child, lines, printed, done };
}

/**
 * Race `n` contenders, each running CONTENDER and then `body` with argv
 * `args`. Each barrier lifts once every one has reached it, so they go on
 * together however slowly each got there; their stdin closes once every
 * one has reported. Answers each one's report.
 * @param {number} n @param {string} body @param {string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<any[]>}
 */
async function contend(n, body, args, env = process.env) {
  const runs = Array.from({ length: n }, () => contender(`${CONTENDER}\n${body}`, args, env));
  for (let line = 1; ; line++) {
    await Promise.all(runs.map((run) => run.printed(line)));
    if (!runs.every((run) => run.lines[line - 1] === 'ready')) break;
    for (const run of runs) run.child.stdin.write('g');
  }
  for (const run of runs) run.child.stdin.end();
  const results = await Promise.all(runs.map((run) => run.done));
  for (const { code, stderr } of results) assert.strictEqual(code, 0, stderr);
  return results.map(({ lines }) => JSON.parse(/** @type {string} */ (lines.at(-1))));
}

describe('manifest-io — shared lock constants and IO contract', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-io-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('carries the shared lock discipline: 30s stale, 50ms retry, 10s timeout, 60s tmp orphan, 60s writer wait', () => {
    assert.strictEqual(io.LOCK_STALE_MS, 30000);
    assert.strictEqual(io.LOCK_RETRY_MS, 50);
    assert.strictEqual(io.LOCK_TIMEOUT_MS, 10000);
    assert.strictEqual(io.TMP_STALE_MS, 60000);
    assert.strictEqual(io.WRITER_LOCK_TIMEOUT_MS, 60000);
  });

  it('tells a JSON object from an array, null, and a scalar', () => {
    assert.deepStrictEqual([{}, { a: 1 }].map(io.isObject), [true, true]);
    assert.deepStrictEqual([[], null, 'x', 3, true, undefined].map(io.isObject), [false, false, false, false, false, false]);
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

  it('a mode given is the written file\'s exactly, the umask notwithstanding; none given is the umask\'s default', () => {
    const file = path.join(dir, 'settings.json');
    for (const mode of [0o600, 0o666]) {
      io.writeJsonAtomic(file, { mode }, { mode });
      assert.strictEqual(fs.statSync(file).mode & 0o777, mode, mode.toString(8));
    }
    const plain = path.join(dir, 'plain.json');
    io.writeJsonAtomic(plain, {});
    const umask = process.umask();
    assert.strictEqual(fs.statSync(plain).mode & 0o777, 0o666 & ~umask);
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['plain.json', 'settings.json'], 'no temp file left behind');
  });

  it('project read: missing file is a first-write {}, corrupt JSON refuses loudly', () => {
    assert.deepStrictEqual(io.readProjectManifest(dir), {});
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{"work_units": {},}');
    assert.throws(() => io.readProjectManifest(dir), /not valid JSON/);
    assert.throws(() => io.readProjectManifest(dir), /by hand/);
  });

  it('withWorkUnitLock and withProjectLock hold the one writer lock at the state root, gone after — including on throw', () => {
    fs.mkdirSync(path.join(dir, 'unit'));
    const lock = path.join(dir, '.lock');
    const holder = { pid: process.pid, pid_start: processStartTime(process.pid) };
    const held = [
      io.withWorkUnitLock(dir, 'unit', () => JSON.parse(fs.readFileSync(lock, 'utf8'))),
      io.withProjectLock(dir, () => JSON.parse(fs.readFileSync(lock, 'utf8'))),
    ];
    assert.deepStrictEqual(held, [holder, holder]);
    assert.ok(!fs.existsSync(lock));
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['unit'], 'no lock of the unit\'s or the project\'s own');
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'unit')), []);

    assert.throws(() => io.withWorkUnitLock(dir, 'unit', () => { throw new Error('boom'); }), /boom/);
    assert.throws(() => io.withProjectLock(dir, () => { throw new Error('bang'); }), /bang/);
    assert.ok(!fs.existsSync(lock), 'lock must be released when fn throws');
  });

  it('withWorkUnitLock refuses a missing work-unit directory with the read\'s not-found error', () => {
    assert.throws(() => io.withWorkUnitLock(dir, 'ghost', () => 'never'), /manifest not found/);
    assert.ok(!fs.existsSync(path.join(dir, 'ghost')), 'no directory conjured for the lock file');
  });

  it('the manifest locks run inside a verb\'s writer lock without claiming it again', (t) => {
    fs.mkdirSync(path.join(dir, 'unit'));
    const attempts = lockAttempts(t, path.join(dir, '.lock'), () => { throw new Error('a nested hold claimed the lock again'); });
    const ran = io.withWriterLock(dir, () => io.withWorkUnitLock(dir, 'unit', () => io.withProjectLock(dir, () => 'ran')));
    assert.strictEqual(ran, 'ran');
    assert.deepStrictEqual(attempts, ['made'], 'one claim, the outer hold\'s');
    assert.ok(!fs.existsSync(path.join(dir, '.lock')));
  });

  it('withWorkUnitLock takes over a dead holder\'s claim and proceeds', () => {
    fs.mkdirSync(path.join(dir, 'unit'));
    const lock = path.join(dir, '.lock');
    fs.writeFileSync(lock, DEAD);
    const result = io.withWorkUnitLock(dir, 'unit', () => 'ran');
    assert.strictEqual(result, 'ran');
    assert.ok(!fs.existsSync(lock));
  });

  it('a live holder\'s claim is never broken by age: the wait times out naming it', () => {
    const lock = path.join(dir, '.lock');
    fs.writeFileSync(lock, live());
    makeStale(lock);
    assert.throws(() => io.withWriterLock(dir, () => 'never', { timeoutMs: 250 }), (/** @type {Error} */ err) => {
      assert.ok(err.message.startsWith(`Timed out waiting for the state lock (lock file: ${lock}) — process ${process.pid} holds it`), err.message);
      return true;
    });
    assert.strictEqual(fs.readFileSync(lock, 'utf8'), live(), 'the live claim untouched');
  });

  it('withWriterLock refuses a missing state root and conjures no folder for the lock', () => {
    const missing = path.join(dir, '.leeway');
    assert.throws(() => io.withWriterLock(missing, () => 'never'), /no state worktree at .*\.leeway — nothing written/);
    assert.ok(!fs.existsSync(missing));
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

  it('a contended wait sleeps between attempts instead of spinning: no more than one attempt a retry interval', (t) => {
    const lock = path.join(dir, '.lock');
    fs.writeFileSync(lock, String(process.pid)); // fresh — never breakable
    const attempts = lockAttempts(t, lock);
    const timeoutMs = 250;
    assert.throws(() => io.acquireLockFile(lock, 'Timed out', timeoutMs), /Timed out/);
    assert.deepStrictEqual([...new Set(attempts)], ['taken'], 'every attempt found the lock taken');
    assert.ok(attempts.length <= timeoutMs / io.LOCK_RETRY_MS + 1, `${attempts.length} attempts in ${timeoutMs}ms — a busy wait`);
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
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-break-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('contenders that each judged a lock stale race to break it: exactly one breaks it, and no guard is left', async () => {
    const lock = path.join(dir, '.lock');
    fs.writeFileSync(lock, '99999');
    makeStale(lock);
    const reports = await contend(6, [
      'const [lock] = process.argv.slice(1);',
      'const stale = Date.now() - fs.statSync(lock).mtimeMs > io.LOCK_STALE_MS;',
      'atBarrier();',
      'report({ stale, won: io.breakStaleLockFile(lock) });',
    ].join('\n'), [lock]);

    assert.deepStrictEqual(reports.map((report) => report.stale), reports.map(() => true), 'every contender judged the lock stale before any broke it');
    assert.strictEqual(reports.filter((report) => report.won).length, 1, `exactly one breaker:\n${JSON.stringify(reports)}`);
    assert.deepStrictEqual(fs.readdirSync(dir), [], 'the stale lock gone, and no breaker\'s guard left beside it');
  });

  it('contenders racing a dead holder\'s claim through withProjectLock: each holds it in turn while the rest wait, never two at once', async () => {
    const lock = path.join(dir, '.lock');
    fs.writeFileSync(lock, DEAD);
    const reports = await contend(5, [
      'const [dir] = process.argv.slice(1);',
      "const waiting = dir + '/waiting-' + process.pid;",
      "const inside = dir + '/inside';",
      "fs.writeFileSync(waiting, '');",
      'atBarrier();',
      'report(io.withProjectLock(dir, () => {',
      '  fs.unlinkSync(waiting);',
      "  let alone = true; try { fs.closeSync(fs.openSync(inside, 'wx')); } catch { alone = false; }",
      "  const others = fs.readdirSync(dir).filter((name) => name.startsWith('waiting-')).length;",
      '  if (alone) fs.unlinkSync(inside);',
      '  return { alone, others };',
      '}));',
    ].join('\n'), [dir]);

    assert.deepStrictEqual(reports.map((report) => report.alone), reports.map(() => true), 'two contenders held the lock at once');
    assert.deepStrictEqual(reports.map((report) => report.others).sort((a, b) => a - b), [0, 1, 2, 3, 4], 'the waiting each hold saw: every other contender, then one fewer each time');
    assert.deepStrictEqual(fs.readdirSync(dir), [], 'the lock let go after the last holder');
  });
});

describe('the claim — one holder at a time, never waited on', () => {
  let dir;
  let claim;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-'));
    claim = path.join(dir, '.fill');
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('claims for this process, refuses a second while it holds, and its release frees it', () => {
    const release = io.tryClaimFile(claim);
    assert.ok(release);
    assert.strictEqual(JSON.parse(fs.readFileSync(claim, 'utf8')).pid, process.pid);
    assert.strictEqual(io.tryClaimFile(claim), null, 'a live owner holds it');
    release();
    assert.ok(!fs.existsSync(claim));
    assert.deepStrictEqual(fs.readdirSync(dir), [], 'no temporary file left beside it');
  });

  it('takes over the claim of an owner that no longer runs', () => {
    fs.writeFileSync(claim, DEAD);
    const release = io.tryClaimFile(claim);
    assert.ok(release);
    assert.strictEqual(JSON.parse(fs.readFileSync(claim, 'utf8')).pid, process.pid);
    release();
  });

  it('a claim whose owner cannot be read stands until it is stale', () => {
    fs.writeFileSync(claim, '');
    assert.strictEqual(io.tryClaimFile(claim), null, 'an owner mid-write may be alive');
    makeStale(claim);
    const release = io.tryClaimFile(claim);
    assert.ok(release, 'a stale unreadable claim is broken');
    release();
  });

  it('never takes over while another breaker holds the guard', () => {
    fs.writeFileSync(claim, DEAD);
    fs.writeFileSync(`${claim}.breaking`, '1');
    assert.strictEqual(io.tryClaimFile(claim), null);
    assert.strictEqual(fs.readFileSync(claim, 'utf8'), DEAD, 'the dead owner\'s claim is left to the breaker');
  });

  it('a release removes only this process\'s own claim', () => {
    const release = io.tryClaimFile(claim);
    fs.writeFileSync(claim, JSON.stringify({ pid: 1, pid_start: 'another' }));
    release();
    assert.ok(fs.existsSync(claim), 'a claim another took is theirs to release');
  });

  it('while `ps` fails, a live owner\'s claim stands and a gone owner\'s is still taken over', () => {
    const ps = harness.failingPs(dir);
    const theirs = peer();
    fs.writeFileSync(claim, theirs);
    assert.strictEqual(whilePsFails(ps, () => io.tryClaimFile(claim)), null, 'a start time that cannot be read proves nothing');
    assert.strictEqual(fs.readFileSync(claim, 'utf8'), theirs);

    fs.writeFileSync(claim, JSON.stringify({ pid: 2147483646, pid_start: 'gone' }));
    const release = whilePsFails(ps, () => io.tryClaimFile(claim));
    assert.ok(release, 'a pid that is gone needs no start time');
    assert.strictEqual(JSON.parse(fs.readFileSync(claim, 'utf8')).pid, process.pid);
    release();
  });

  it('reads its own start time once: a later claim asks `ps` nothing, and still names it', () => {
    /** @type {() => void} */ (io.tryClaimFile(claim))();
    const own = live();
    const ps = harness.failingPs(dir);
    const release = whilePsFails(ps, () => io.tryClaimFile(claim));
    assert.strictEqual(fs.readFileSync(claim, 'utf8'), own);
    /** @type {() => void} */ (release)();
    assert.deepStrictEqual(ps.runs(), []);
  });

  it('a claim found gone is made again, never broken: a claim another makes meanwhile is never removed', (t) => {
    const theirs = peer();
    fs.writeFileSync(claim, theirs);
    const unlink = fs.unlinkSync;
    // The owner lets go just as this contender finds the claim taken…
    lockAttempts(t, claim, () => unlink(claim));
    // …and a peer claims in the instant before this contender removes one.
    /** @type {string[]} */
    const removed = [];
    t.mock.method(fs, 'unlinkSync', (/** @type {string} */ file) => {
      if (file === claim) {
        fs.writeFileSync(claim, theirs);
        removed.push(theirs);
      }
      return unlink(file);
    });

    const release = io.tryClaimFile(claim);

    assert.ok(release, 'the claim made again');
    assert.deepStrictEqual(removed, [], 'a claim removed after it was found gone');
    assert.strictEqual(fs.readFileSync(claim, 'utf8'), live());
  });

  it('contenders that each found a dead owner\'s claim race to take it over: exactly one does', async () => {
    fs.writeFileSync(claim, DEAD);
    const reports = await contend(6, [
      'const [claim, dead] = process.argv.slice(1);',
      "const sawDead = fs.readFileSync(claim, 'utf8') === dead;",
      'atBarrier();',
      'report({ sawDead, won: io.tryClaimFile(claim) !== null });',
      'untilAllReported();',
    ].join('\n'), [claim, DEAD]);

    assert.deepStrictEqual(reports.map((report) => report.sawDead), reports.map(() => true), 'every contender found the dead owner\'s claim before any took it over');
    assert.strictEqual(reports.filter((report) => report.won).length, 1, `exactly one holder:\n${JSON.stringify(reports)}`);
  });

  it('contenders × holds: never two holders at once, and no holder\'s claim removed from under it', async () => {
    // The race made dense: `ps` is off the contenders' PATH, so an owner is
    // read bare and an attempt spawns nothing; and each removal of the claim
    // is slowed, as it would be were its contender preempted between
    // deciding and removing, so a removal made on what was seen a moment
    // before meets the claims made since.
    const reports = await contend(8, [
      'const [claim, holds] = process.argv.slice(1);',
      "const inside = claim + '.inside';",
      'const unlink = fs.unlinkSync;',
      'fs.unlinkSync = (file) => { if (file === claim) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2); return unlink(file); };',
      'let twice = 0; let lost = 0; let taken = 0;',
      'atBarrier();',
      'for (let i = 0; i < Number(holds); i++) {',
      '  let release;',
      '  while ((release = io.tryClaimFile(claim)) === null) taken += 1;',
      "  let alone = true; try { fs.closeSync(fs.openSync(inside, 'wx')); } catch { alone = false; twice += 1; }",
      "  let owner = null; try { owner = JSON.parse(fs.readFileSync(claim, 'utf8')).pid; } catch { /* removed */ }",
      '  if (owner !== process.pid) lost += 1;',
      '  if (alone) unlink(inside);',
      '  release();',
      '}',
      'report({ twice, lost, taken });',
    ].join('\n'), [claim, '40'], { ...process.env, PATH: dir });

    const total = (/** @type {string} */ key) => reports.reduce((sum, report) => sum + report[key], 0);
    assert.ok(total('taken') > 0, 'no contender ever found the claim held');
    assert.deepStrictEqual({ twice: total('twice'), lost: total('lost') }, { twice: 0, lost: 0 },
      'holds that found another inside, and holds whose claim was gone or another\'s by their end');
  });
});

describe('structurally corrupt manifests refuse writes', () => {
  let dir;
  beforeEach(() => {
    dir = harness.setupGitFixture('engine-root-');
    fs.mkdirSync(path.join(dir, '.leeway/unit'), { recursive: true });
  });
  afterEach(() => { cleanupFixture(dir); });

  /** Run the engine expecting `{ok:false}` exit 1; returns the parsed stderr JSON. */
  const engineFail = (/** @type {string[]} */ args) => harness.refuses(dir, args);

  /** Write raw manifest bytes; returns a function asserting they are untouched. */
  function plant(rel, raw) {
    const file = path.join(dir, rel);
    fs.writeFileSync(file, raw);
    return () => assert.strictEqual(fs.readFileSync(file, 'utf8'), raw, 'manifest bytes must be untouched');
  }

  it('array root: set refuses with the domain diagnostic, file byte-identical', () => {
    const untouched = plant('.leeway/unit/manifest.json', '[]\n');
    const res = engineFail(['manifest', 'set', 'unit', 'status', 'completed']);
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /manifest root is not an object/);
    untouched();
  });

  it('null root: the domain diagnostic, never a raw TypeError', () => {
    const untouched = plant('.leeway/unit/manifest.json', 'null\n');
    const res = engineFail(['manifest', 'set', 'unit', 'status', 'completed']);
    assert.match(res.error, /manifest root is not an object/);
    assert.ok(!/TypeError/.test(res.error), 'no raw JS TypeError may surface');
    untouched();
  });

  it('number root: the domain diagnostic, never a raw TypeError', () => {
    const untouched = plant('.leeway/unit/manifest.json', '42\n');
    const res = engineFail(['manifest', 'set', 'unit', 'status', 'completed']);
    assert.match(res.error, /manifest root is not an object/);
    assert.ok(!/TypeError/.test(res.error));
    untouched();
  });

  it('string `phases` + topic start: refusal, manifest pristine — no silent coercion', () => {
    const untouched = plant('.leeway/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'epic', status: 'in-progress', phases: 'oops',
    }, null, 2) + '\n');
    const res = engineFail(['topic', 'start', 'unit', 'research', 'auth']);
    assert.match(res.error, /"phases" is not an object \(found string\)/);
    untouched();
  });

  it('array `phases` + topic start: refusal — fields set into an array are stringify-dropped', () => {
    const untouched = plant('.leeway/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'epic', status: 'in-progress', phases: [],
    }, null, 2) + '\n');
    const res = engineFail(['topic', 'start', 'unit', 'research', 'auth']);
    assert.match(res.error, /"phases" is not an object \(found array\)/);
    untouched();
  });

  it('scalar mid-path container: set refuses instead of coercing to {}', () => {
    const untouched = plant('.leeway/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'epic', status: 'in-progress', phases: { research: 'active' },
    }, null, 2) + '\n');
    const res = engineFail(['manifest', 'set', 'unit.research.auth', 'status', 'in-progress']);
    assert.match(res.error, /"phases\.research" is not an object — refusing to overwrite/);
    untouched();
  });

  it('named field into an array: set refuses — stringify would silently drop it', () => {
    const untouched = plant('.leeway/unit/manifest.json', JSON.stringify({
      name: 'unit', work_type: 'feature', status: 'in-progress', imports: [], phases: {},
    }, null, 2) + '\n');
    const res = engineFail(['manifest', 'set', 'unit', 'imports.name', 'x']);
    assert.match(res.error, /"imports" is an array — cannot set field "name"/);
    untouched();
  });

  it('array-root project manifest: set refuses with the domain diagnostic, file byte-identical', () => {
    const untouched = plant('.leeway/manifest.json', '[]\n');
    const res = engineFail(['manifest', 'set', 'project.defaults.plan_format', 'tick']);
    assert.match(res.error, /manifest root is not an object/);
    untouched();
  });
});

/**
 * Well inside the writer lock's 60s wait: a call still running at this
 * point was waiting on the lock, and is killed.
 */
const ANSWERS_AT_ONCE_MS = 10000;

/**
 * One call per entry of the writer lock's exempt table, each one that
 * succeeds in the epic fixture with a specification beside its research.
 * Boot and the ledger's writes are the table's verbs that wait on the lock,
 * each taking it itself around the state writes it makes, so they have none:
 * the ledger's suite holds its writes to waiting.
 */
const EXEMPT_CALLS = [
  ['knowledge', 'status'],
  ['presence', 'scan', 'payments'],
  ['conversation', 'position', 'sess-1'],
  ['code', 'status'],
  ['render', 'signpost', 'Hello'],
  ['handoff', 'workflow-continue-epic', 'payments'],
  ['topic', 'mailbox', 'payments', 'research', 'auth-flow'],
  ['topic', 'incorporations', 'payments', 'auth-flow'],
  ['roadmap', 'state'],
  ['session', 'label', 'payments'],
  ['session', 'repair'],
  ['session', 'cleanup', 'sess-1'],
  ['session', 'resume', 'sess-1'],
  ['layout', 'guard'],
];

describe('engine writes take the writer lock', () => {
  let dir;
  let lock;
  beforeEach(() => {
    dir = setupGitFixture();
    writeEpicFixture(dir);
    lock = path.join(dir, '.leeway/.lock');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('a dead holder\'s claim is taken over at once: the write proceeds, the lock is cleaned up', () => {
    fs.writeFileSync(lock, DEAD);

    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['auth-flow'].status, 'in-progress');
    assert.ok(!fs.existsSync(lock), 'the dead claim taken over and not left behind');
  });

  it('a read never tries the lock: it answers while a live holder has it', (t) => {
    fs.writeFileSync(lock, live());
    const attempts = lockAttempts(t, lock, () => { throw new Error('the read waited on the lock'); });
    assert.strictEqual(harness.output(dir, ['manifest', 'get', 'payments', 'status']).trim(), 'in-progress');
    assert.deepStrictEqual(attempts, []);
    assert.strictEqual(fs.readFileSync(lock, 'utf8'), live(), 'the holder\'s claim untouched');
  });

  it('a live holder blocks the engine until released — the write lands only after', (t) => {
    fs.writeFileSync(lock, live());
    const summary = () => readManifest(dir, 'payments').phases.discovery.items['auth-flow'].summary;
    /** @type {string[]} */
    const whileHeld = [];
    // The lock is let go at the write's second attempt: it found the lock held, and waited.
    const attempts = lockAttempts(t, lock, (taken) => {
      whileHeld.push(summary());
      if (taken === 2) fs.unlinkSync(lock);
    });

    const res = engine(dir, ['discovery-map', 'edit', 'payments', 'auth-flow', '--summary', 'After the lock']);

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.deepStrictEqual(whileHeld, ['Auth', 'Auth'], 'no write while the lock is held');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(summary(), 'After the lock');
    assert.ok(!fs.existsSync(lock));
  });

  it('a command the engine does not dispatch answers the usage at once — no lock waited on, no state looked for', () => {
    fs.writeFileSync(lock, live());
    const stateless = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-io-stateless-'));
    try {
      for (const [where, args] of [[dir, ['not-a-verb']], [dir, []], [dir, ['toString']], [stateless, ['not-a-verb']], [stateless, []]]) {
        const res = spawnSync('node', [ENGINE, ...args], { cwd: where, encoding: 'utf8', timeout: ANSWERS_AT_ONCE_MS });
        assert.strictEqual(res.status, 1, `engine ${args.join(' ')} in ${where}: ${res.signal ? 'waited on the lock' : res.stderr}`);
        assert.match(res.stderr, /^Usage: engine <command>/);
      }
    } finally {
      fs.rmSync(stateless, { recursive: true, force: true });
    }
    assert.strictEqual(fs.readFileSync(lock, 'utf8'), live(), 'the holder\'s claim untouched');
  });

  it('every exempt command answers at once while a live holder has the lock — none but boot and the ledger take it anywhere', () => {
    const entries = (/** @type {string[][]} */ calls) => [...new Set(calls.map(([command, sub]) => (WRITER_LOCK_EXEMPT[command] === '*' ? command : `${command} ${sub}`)))];
    const table = Object.entries(WRITER_LOCK_EXEMPT).flatMap(([command, subs]) => (subs === '*' ? [command] : subs.map((sub) => `${command} ${sub}`)));
    assert.deepStrictEqual([...entries(EXEMPT_CALLS), 'boot', 'ledger'].sort(), table.sort(), 'a call below for every exempt entry, boot and the ledger aside');
    assert.deepStrictEqual(Object.keys(WRITER_LOCK_EXEMPT).filter((command) => !Object.hasOwn(COMMANDS, command)), [],
      'the table names dispatched commands alone');
    const manifest = readManifest(dir, 'payments');
    manifest.phases.specification = { items: { 'auth-flow': { status: 'in-progress', sources: {} } } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(lock, live());

    for (const args of EXEMPT_CALLS) {
      const res = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8', timeout: ANSWERS_AT_ONCE_MS });
      assert.strictEqual(res.status, 0, `engine ${args.join(' ')}: ${res.signal ? 'waited on the lock' : res.stderr}`);
    }
    assert.strictEqual(fs.readFileSync(lock, 'utf8'), live(), 'the holder\'s claim untouched');
  });

  it('a committing transaction holds the lock across its writes and its commit: one claim, the state branch moving under it', (t) => {
    commitAll(dir, 'init');
    // git as the engine runs it, noting who holds the lock as the branch moves.
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-io-git-'));
    t.after(() => fs.rmSync(wrapper, { recursive: true, force: true }));
    const moves = path.join(wrapper, 'moves');
    fs.writeFileSync(path.join(wrapper, 'git'),
      `#!/bin/sh\ncase "$*" in *" update-ref "*) { cat "${lock}" 2>/dev/null || printf unheld; echo; } >> "${moves}" ;; esac\nexec "${real}" "$@"\n`,
      { mode: 0o755 });
    const attempts = lockAttempts(t, lock);

    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow'], { env: { PATH: `${wrapper}:${process.env.PATH}` } });

    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(attempts, ['made'], 'the lock let go between the write and the commit');
    assert.deepStrictEqual(fs.readFileSync(moves, 'utf8').split('\n').slice(0, -1), [live()]);
    assert.ok(!fs.existsSync(lock));
  });
});

describe('engine project-manifest writes take the writer lock', () => {
  let dir;
  let lock;
  beforeEach(() => {
    dir = setupGitFixture();
    lock = path.join(dir, '.leeway/.lock');
    writeFile(dir, '.leeway/.cache/payments/discovery/session-001.md', '# Session\n');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('a dead holder\'s claim is taken over: create registers and cleans up', () => {
    fs.writeFileSync(lock, DEAD);

    const res = engine(dir, [
      'workunit', 'create', 'payments', 'feature',
      '--description', 'Payments', '--session-log-file', '.leeway/.cache/payments/discovery/session-001.md',
    ]);
    assert.strictEqual(res.ok, true);
    const project = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/manifest.json'), 'utf8'));
    assert.deepStrictEqual(project.work_units, { payments: { work_type: 'feature' } });
    assert.ok(!fs.existsSync(lock), 'the dead claim taken over and not left behind');
  });

  it('a live holder blocks create until released', (t) => {
    fs.writeFileSync(lock, live());
    const project = path.join(dir, '.leeway/manifest.json');
    /** @type {boolean[]} */
    const registered = [];
    // The lock is let go at create's second attempt: it found the lock held, and waited.
    const attempts = lockAttempts(t, lock, (taken) => {
      registered.push(fs.existsSync(project));
      if (taken === 2) fs.unlinkSync(lock);
    });

    const res = engine(dir, [
      'workunit', 'create', 'payments', 'feature',
      '--description', 'Payments', '--session-log-file', '.leeway/.cache/payments/discovery/session-001.md',
    ]);

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.deepStrictEqual(registered, [false, false], 'no registration while the lock is held');
    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(project, 'utf8')).work_units, { payments: { work_type: 'feature' } });
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
