'use strict';

// ---------------------------------------------------------------------------
// `engine manifest` — the manifest field surface.
//
// Pins the ruled output split: reads (get/exists/list/key-of/resolve) print
// bare stdout with the `Error: …` stderr exit-code convention (2 = expected
// miss); mutations (set/push/pull/delete) answer
// with the engine's one-line JSON response and fail as {ok:false} stderr
// exit 1. The full behavioural matrix lives in the contract suite
// (tests/scripts/test-engine-manifest.sh); this file pins the namespace
// dispatch, the JSON shapes, and set batching.
// ---------------------------------------------------------------------------

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync, spawn } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

/** @param {string} dir @param {string[]} args */
function run(dir, args) {
  return spawnSync('node', [ENGINE, 'manifest', ...args], { cwd: dir, encoding: 'utf8' });
}

/** Success path: returns raw stdout. */
function runOk(dir, args) {
  return execFileSync('node', [ENGINE, 'manifest', ...args], { cwd: dir, encoding: 'utf8' });
}

/** Mutation success: returns the parsed one-line JSON response. */
function runJson(dir, args) {
  const out = runOk(dir, args).trim();
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.ok, true);
  return parsed;
}

/** Mutation failure: exit 1, {ok:false} JSON on stderr, empty stdout. */
function runFails(dir, args) {
  const res = run(dir, args);
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

/** @param {string} dir @param {string} name @param {string} workType */
function writeWorkUnit(dir, name, workType, extra = {}) {
  const wuDir = path.join(dir, '.workflows', name);
  fs.mkdirSync(wuDir, { recursive: true });
  fs.writeFileSync(path.join(wuDir, 'manifest.json'), JSON.stringify({
    name,
    work_type: workType,
    status: 'in-progress',
    created: '2026-07-01',
    description: 'Fixture',
    phases: {},
    ...extra,
  }, null, 2) + '\n');
  const projPath = path.join(dir, '.workflows', 'manifest.json');
  const proj = fs.existsSync(projPath) ? JSON.parse(fs.readFileSync(projPath, 'utf8')) : {};
  proj.work_units = proj.work_units || {};
  proj.work_units[name] = { work_type: workType };
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2) + '\n');
}

function readWorkUnit(dir, name) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', name, 'manifest.json'), 'utf8'));
}

describe('engine manifest — reads keep the CLI stdout contract', () => {
  let dir;
  beforeEach(() => { dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-fields-'))); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('get: scalar raw, subtree pretty JSON, missing path empty exit 0', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    assert.strictEqual(runOk(dir, ['get', 'auth', 'status']), 'in-progress\n');
    const manifest = readWorkUnit(dir, 'auth');
    assert.strictEqual(runOk(dir, ['get', 'auth']), JSON.stringify(manifest, null, 2) + '\n');

    const missing = run(dir, ['get', 'auth', 'no.such.path']);
    assert.strictEqual(missing.status, 0);
    assert.strictEqual(missing.stdout, '');
    const ghost = run(dir, ['get', 'ghost']);
    assert.strictEqual(ghost.status, 0);
    assert.strictEqual(ghost.stdout, '');
  });

  it('exists: true/false on stdout, always exit 0', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    for (const [args, expected] of [
      [['exists', 'auth'], 'true\n'],
      [['exists', 'auth', 'work_type'], 'true\n'],
      [['exists', 'auth', 'nope'], 'false\n'],
      [['exists', 'ghost'], 'false\n'],
      [['exists', 'ghost', 'work_type'], 'false\n'],
    ]) {
      const res = run(dir, args);
      assert.strictEqual(res.status, 0, args.join(' '));
      assert.strictEqual(res.stdout, expected, args.join(' '));
    }
  });

  it('list: [] without .workflows, full manifests with filters', () => {
    assert.strictEqual(runOk(dir, ['list']), '[]\n');
    writeWorkUnit(dir, 'auth', 'feature');
    writeWorkUnit(dir, 'payments', 'epic');
    const all = JSON.parse(runOk(dir, ['list']));
    assert.deepStrictEqual(all.map(m => m.name).sort(), ['auth', 'payments']);
    const epics = JSON.parse(runOk(dir, ['list', '--work-type', 'epic']));
    assert.deepStrictEqual(epics.map(m => m.name), ['payments']);
  });

  it('key-of: bare key on stdout; a missing value is an expected miss (exit 2)', () => {
    writeWorkUnit(dir, 'auth', 'feature', {
      phases: { planning: { items: { auth: { task_map: { 'auth-1-1': 'tick-abc' } } } } },
    });
    assert.strictEqual(runOk(dir, ['key-of', 'auth.planning.auth', 'task_map', 'tick-abc']), 'auth-1-1\n');
    const miss = run(dir, ['key-of', 'auth.planning.auth', 'task_map', 'tick-zzz']);
    assert.strictEqual(miss.status, 2);
    assert.match(miss.stderr, /^Error: Value "tick-zzz" not found/);
  });

  it('resolve: artifact paths for indexed phases; missing work unit is exit 2', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    assert.strictEqual(
      runOk(dir, ['resolve', 'auth.discussion.auth']),
      path.join(dir, '.workflows/auth/discussion/auth.md') + '\n'
    );
    const miss = run(dir, ['resolve', 'ghost.discussion.foo']);
    assert.strictEqual(miss.status, 2);
    const planning = run(dir, ['resolve', 'auth.planning.auth']);
    assert.strictEqual(planning.status, 1);
    assert.match(planning.stderr, /not indexed/);
  });

  it('read errors keep the CLI convention: Error: line on stderr, never JSON', () => {
    const res = run(dir, ['get', 'auth.cooking.soup', 'status']);
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /^Error: Invalid phase "cooking"/);
    assert.ok(!res.stderr.includes('"ok"'));
  });
});

describe('engine manifest — mutations answer with the engine JSON contract', () => {
  let dir;
  beforeEach(() => { dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-fields-'))); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('set: one-line JSON listing what was written', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    const res = runJson(dir, ['set', 'auth.discussion.auth', 'status', 'completed']);
    assert.deepStrictEqual(res, { ok: true, path: 'auth.discussion.auth', set: { status: 'completed' } });
    assert.strictEqual(readWorkUnit(dir, 'auth').phases.discussion.items.auth.status, 'completed');
  });

  it('set batches <field>=<value> pairs: one write, one response listing all fields', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    const res = runJson(dir, ['set', 'auth', 'status', 'completed', 'completed_at=2026-07-18', 'reviewed=true']);
    assert.deepStrictEqual(res.set, { status: 'completed', completed_at: '2026-07-18', reviewed: true });
    const manifest = readWorkUnit(dir, 'auth');
    assert.strictEqual(manifest.status, 'completed');
    assert.strictEqual(manifest.completed_at, '2026-07-18');
    assert.strictEqual(manifest.reviewed, true);
  });

  it('batch values split on the FIRST = only', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    runJson(dir, ['set', 'auth', 'note', 'plain', 'formula=a=b=c']);
    assert.strictEqual(readWorkUnit(dir, 'auth').formula, 'a=b=c');
  });

  it('a refused value fails the whole batch — nothing written', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    const err = runFails(dir, ['set', 'auth', 'description', 'updated', 'status=bogus']);
    assert.match(err.error, /Invalid status "bogus"/);
    assert.strictEqual(readWorkUnit(dir, 'auth').description, 'Fixture', 'batch must be all-or-nothing');
  });

  it('schema validation is unchanged: statuses, work types, gate modes', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    assert.match(runFails(dir, ['set', 'auth.discussion.auth', 'status', 'concluded']).error, /Invalid status/);
    assert.match(runFails(dir, ['set', 'auth', 'work_type', 'saga']).error, /Invalid work_type/);
    assert.match(runFails(dir, ['set', 'auth.planning.auth', 'task_gate_mode', 'manual']).error, /Invalid gate mode/);
    assert.match(runFails(dir, ['set', 'auth.discovery.topic', 'status', 'in-progress']).error, /carry no status field/);
    assert.match(runFails(dir, ['set', 'ghost', 'status', 'completed']).error, /Work unit "ghost" not found/);
  });

  it('a typed field refuses NON-string values — number, boolean, ~→null, object bypass nothing', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    // The JSON-parsed value is a number/boolean/null/object here, not a string:
    // the guard must refuse each just as it refuses a bad string.
    assert.match(runFails(dir, ['set', 'auth', 'status', '123']).error, /Invalid status 123\b/);
    assert.match(runFails(dir, ['set', 'auth', 'status', 'true']).error, /Invalid status true\b/);
    assert.match(runFails(dir, ['set', 'auth', 'status', '~']).error, /Invalid status null\b/);
    assert.match(runFails(dir, ['set', 'auth', 'work_type', '42']).error, /Invalid work_type 42\b/);
    assert.match(runFails(dir, ['set', 'auth.planning.auth', 'task_gate_mode', '5']).error, /Invalid gate mode 5\b/);
    assert.match(runFails(dir, ['set', 'auth.planning.auth', 'fix_gate_mode', '{}']).error, /Invalid gate mode \{\}/);
    assert.match(runFails(dir, ['set', 'auth.discussion.auth', 'status', '3']).error, /Invalid status 3 for phase "discussion"/);
    // None of the refused writes touched the manifest.
    const m = readWorkUnit(dir, 'auth');
    assert.strictEqual(m.status, 'in-progress');
    assert.strictEqual(m.work_type, 'feature');
  });

  it('a NON-string status inside a batch fails the whole batch — nothing written', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    const err = runFails(dir, ['set', 'auth', 'description', 'updated', 'status=99']);
    assert.match(err.error, /Invalid status 99\b/);
    assert.strictEqual(readWorkUnit(dir, 'auth').description, 'Fixture', 'batch must be all-or-nothing');
  });

  it('UNtyped fields still accept non-string values — counters, ~→null pointers, task maps', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    assert.strictEqual(runJson(dir, ['set', 'auth.implementation.auth', 'fix_attempts', '3']).set.fix_attempts, 3);
    assert.strictEqual(runJson(dir, ['set', 'auth.implementation.auth', 'current_task', '~']).set.current_task, null);
    assert.deepStrictEqual(runJson(dir, ['set', 'auth.planning.auth', 'task_map', '{"a":"b"}']).set.task_map, { a: 'b' });
    const item = readWorkUnit(dir, 'auth').phases.implementation.items.auth;
    assert.strictEqual(item.fix_attempts, 3);
    assert.strictEqual(item.current_task, null);
  });

  it('push: appends (creating the array) and reports the new length', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    const first = runJson(dir, ['push', 'auth', 'tags', 'v1']);
    assert.deepStrictEqual(first, { ok: true, path: 'auth', field: 'tags', pushed: 'v1', length: 1 });
    const second = runJson(dir, ['push', 'auth', 'tags', 'v2']);
    assert.strictEqual(second.length, 2);
    assert.deepStrictEqual(readWorkUnit(dir, 'auth').tags, ['v1', 'v2']);
    assert.match(runFails(dir, ['push', 'auth', 'status', 'x']).error, /not an array/);
  });

  it('push failure releases the lock (the old CLI leaked it)', () => {
    writeWorkUnit(dir, 'auth', 'feature');
    runFails(dir, ['push', 'auth', 'status', 'x']);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/auth/.lock')), 'no lock left behind on a failed mutation');
  });

  it('pull: removed true with new length, removed false on any no-op', () => {
    writeWorkUnit(dir, 'auth', 'feature', { tags: ['v1', 'v2'] });
    const hit = runJson(dir, ['pull', 'auth', 'tags', 'v1']);
    assert.deepStrictEqual(hit, { ok: true, path: 'auth', field: 'tags', removed: true, length: 1 });
    const missValue = runJson(dir, ['pull', 'auth', 'tags', 'v9']);
    assert.deepStrictEqual(missValue, { ok: true, path: 'auth', field: 'tags', removed: false, length: 1 });
    const missField = runJson(dir, ['pull', 'auth', 'nope', 'v1']);
    assert.deepStrictEqual(missField, { ok: true, path: 'auth', field: 'nope', removed: false, length: null });
  });

  it('pull matches object entries by deep equality', () => {
    writeWorkUnit(dir, 'auth', 'feature', {
      imports: [{ path: 'imports/seed.md', imported_at: '2026-05-09T10:00:00Z' }],
    });
    const res = runJson(dir, ['pull', 'auth', 'imports', '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}']);
    assert.strictEqual(res.removed, true);
    assert.deepStrictEqual(readWorkUnit(dir, 'auth').imports, []);
  });

  it('delete: JSON on success, {ok:false} exit 1 on a missing path', () => {
    writeWorkUnit(dir, 'auth', 'feature', { extra: { a: 1 } });
    const res = runJson(dir, ['delete', 'auth', 'extra.a']);
    assert.deepStrictEqual(res, { ok: true, path: 'auth', field: 'extra.a', deleted: true });
    assert.match(runFails(dir, ['delete', 'auth', 'extra.a']).error, /not found/);
  });

  it('project routing: set/push/pull/delete against the project manifest', () => {
    const set = runJson(dir, ['set', 'project.defaults.plan_format', 'tick']);
    assert.deepStrictEqual(set, { ok: true, path: 'project', set: { 'defaults.plan_format': 'tick' } });
    assert.strictEqual(runOk(dir, ['get', 'project.defaults.plan_format']), 'tick\n');

    const push = runJson(dir, ['push', 'project.defaults.project_skills', 'skill-a']);
    assert.strictEqual(push.length, 1);
    const pull = runJson(dir, ['pull', 'project.defaults.project_skills', 'skill-a']);
    assert.strictEqual(pull.removed, true);

    const del = runJson(dir, ['delete', 'project.defaults.plan_format']);
    assert.deepStrictEqual(del, { ok: true, path: 'project', field: 'defaults.plan_format', deleted: true });
    assert.strictEqual(run(dir, ['exists', 'project.defaults.plan_format']).stdout, 'false\n');
  });

  it('retired CLI commands and unknown sub-verbs refuse with the generic usage', () => {
    for (const verb of ['init', 'init-phase', 'project', 'create-discovery-topic', 'frobnicate']) {
      const err = runFails(dir, [verb]);
      assert.match(err.error, /Usage: engine manifest <get\|set\|push\|pull\|delete\|exists\|list\|key-of\|resolve>/);
    }
  });
});

describe('engine manifest — the batched set holds the work-unit lock', () => {
  let dir;
  beforeEach(() => { dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-fields-'))); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  it('a fresh .lock blocks a batched set until released — nothing lands early, everything lands together', async () => {
    writeWorkUnit(dir, 'auth', 'feature', { phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const lock = path.join(dir, '.workflows/auth/.lock');
    fs.writeFileSync(lock, '12345');

    const child = spawn('node', [ENGINE, 'manifest', 'set', 'auth.discussion.auth', 'review_cycle', '2', 'date=2026-07-18'], { cwd: dir });
    let stdout = '';
    child.stdout.on('data', (c) => { stdout += c; });
    // 'close', not 'exit': stdout must be fully flushed before it is parsed.
    const exit = new Promise((resolve) => child.on('close', resolve));

    const raced = await Promise.race([exit.then(() => 'exited'), sleep(1500).then(() => 'waiting')]);
    assert.strictEqual(raced, 'waiting', 'batched set must wait on a live lock');
    const before = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/auth/manifest.json'), 'utf8'));
    assert.strictEqual(before.phases.discussion.items.auth.review_cycle, undefined, 'no field lands while the lock is held');

    fs.unlinkSync(lock);
    assert.strictEqual(await exit, 0);
    assert.strictEqual(JSON.parse(stdout.trim()).ok, true);
    const after = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/auth/manifest.json'), 'utf8'));
    assert.strictEqual(after.phases.discussion.items.auth.review_cycle, 2);
    assert.strictEqual(after.phases.discussion.items.auth.date, '2026-07-18');
    assert.ok(!fs.existsSync(lock), 'lock released after the batch');
  });
});
