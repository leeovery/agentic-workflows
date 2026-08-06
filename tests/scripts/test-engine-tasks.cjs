'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

const GATED_GATES = { task_gate_mode: 'gated', fix_gate_mode: 'gated', analysis_gate_mode: 'gated' };

/** A feature manifest with a completed plan carrying a task_map. */
function planPhases() {
  return {
    planning: {
      items: {
        'auth-flow': {
          status: 'completed',
          external_id: 'proj-42',
          task_map: {
            'auth-flow-1-1': 'ext-101',
            'auth-flow-1-2': 'ext-102',
            'auth-flow-2-1': 'ext-201',
          },
        },
      },
    },
  };
}

/** The full set of fields `task init` writes on creation. */
function freshItem() {
  return {
    status: 'in-progress',
    task_gate_mode: 'gated',
    fix_gate_mode: 'gated',
    analysis_gate_mode: 'gated',
    fix_attempts: 0,
    analysis_cycle_total: 0,
    analysis_cycle_session: 0,
    linters: [],
    project_skills: [],
    current_phase: 1,
    current_task: null,
  };
}

/** An in-flight implementation item mid-session: auto gates, progress, counters. */
function inFlightItem() {
  return {
    status: 'in-progress',
    task_gate_mode: 'auto',
    fix_gate_mode: 'auto',
    analysis_gate_mode: 'auto',
    fix_attempts: 2,
    analysis_cycle_total: 7,
    analysis_cycle_session: 2,
    linters: ['run the linter'],
    project_skills: ['project-conventions'],
    current_phase: 2,
    current_task: 'auth-flow-2-1',
    completed_tasks: ['auth-flow-1-1', 'auth-flow-1-2'],
    completed_phases: [1],
  };
}

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8'));
}

function implItem(dir) {
  return readManifest(dir).phases.implementation.items['auth-flow'];
}

function trackingPath(dir, internalId) {
  return path.join(dir, '.workflows', 'auth', 'implementation', 'auth-flow', `fix-tracking-${internalId}.md`);
}

function writeFindings(dir, content) {
  const file = path.join(dir, '.workflows', '.cache', 'auth', 'implementation', 'auth-flow', 'attempt-findings.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return '.workflows/.cache/auth/implementation/auth-flow/attempt-findings.md';
}

/**
 * Run the engine expecting success; returns the first-line JSON response and
 * everything after it (the rendered gate sections, '' when none).
 */
function engineRaw(dir, args) {
  const stdout = execFileSync('node', [ENGINE, 'task', ...args], { cwd: dir, encoding: 'utf8' });
  const nl = stdout.indexOf('\n');
  return { res: JSON.parse(stdout.slice(0, nl)), sections: stdout.slice(nl + 1) };
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args) {
  return engineRaw(dir, args).res;
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(dir, args) {
  const res = spawnSync('node', [ENGINE, 'task', ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

describe('engine task init', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('creates the implementation item with every default', () => {
    createManifest(dir, 'auth', { phases: planPhases() });

    const res = engine(dir, ['init', 'auth', 'auth-flow']);
    assert.deepStrictEqual(res, {
      ok: true,
      mode: 'created',
      gates: GATED_GATES,
      counters: { fix_attempts: 0, analysis_cycle_total: 0, analysis_cycle_session: 0 },
    });
    assert.deepStrictEqual(implItem(dir), freshItem());
  });

  it('resumes with a session-only reset — lifetime state and progress untouched', () => {
    // current_task has no tracking file on disk, so there is no in-flight
    // counter/file pair to preserve: fix_attempts resets with the session.
    const phases = planPhases();
    phases.implementation = { items: { 'auth-flow': inFlightItem() } };
    createManifest(dir, 'auth', { phases });

    const res = engine(dir, ['init', 'auth', 'auth-flow']);
    assert.deepStrictEqual(res, {
      ok: true,
      mode: 'resumed',
      gates: GATED_GATES,
      counters: { fix_attempts: 0, analysis_cycle_total: 7, analysis_cycle_session: 0 },
    });

    const expected = inFlightItem();
    expected.task_gate_mode = 'gated';
    expected.fix_gate_mode = 'gated';
    expected.analysis_gate_mode = 'gated';
    expected.fix_attempts = 0;
    expected.analysis_cycle_session = 0;
    assert.deepStrictEqual(implItem(dir), expected);
  });

  it('preserves fix_attempts on resume when current_task has a live tracking file — gates still reset', () => {
    // A crash-resume mid-task: the counter and tracking file are the task's
    // convergence history and survive the session reset in lockstep.
    const phases = planPhases();
    phases.implementation = { items: { 'auth-flow': inFlightItem() } };
    createManifest(dir, 'auth', { phases });
    fs.mkdirSync(path.dirname(trackingPath(dir, 'auth-flow-2-1')), { recursive: true });
    fs.writeFileSync(trackingPath(dir, 'auth-flow-2-1'), '## Attempt 1\n\none\n\n## Attempt 2\n\ntwo\n');

    const res = engine(dir, ['init', 'auth', 'auth-flow']);
    assert.deepStrictEqual(res, {
      ok: true,
      mode: 'resumed',
      gates: GATED_GATES,
      counters: { fix_attempts: 2, analysis_cycle_total: 7, analysis_cycle_session: 0 },
    });
    assert.strictEqual(implItem(dir).fix_attempts, 2);
    assert.strictEqual(implItem(dir).analysis_cycle_session, 0);
    assert.strictEqual(fs.readFileSync(trackingPath(dir, 'auth-flow-2-1'), 'utf8'), '## Attempt 1\n\none\n\n## Attempt 2\n\ntwo\n');
  });

  it('is create-or-resume: a second call resumes what the first created', () => {
    createManifest(dir, 'auth', { phases: planPhases() });
    assert.strictEqual(engine(dir, ['init', 'auth', 'auth-flow']).mode, 'created');
    assert.strictEqual(engine(dir, ['init', 'auth', 'auth-flow']).mode, 'resumed');
    assert.deepStrictEqual(implItem(dir), freshItem());
  });

  it('rejects an unknown work unit and missing args', () => {
    assert.match(engineFails(dir, ['init', 'ghost', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['init', 'auth']).error, /Usage: engine task init/);
  });
});

describe('engine task start', () => {
  let dir;
  beforeEach(() => {
    dir = setupFixture();
    const phases = planPhases();
    phases.implementation = { items: { 'auth-flow': inFlightItem() } };
    createManifest(dir, 'auth', { phases });
  });
  afterEach(() => { cleanupFixture(dir); });

  it('fresh start on a different task resets fix_attempts, deletes its fix-tracking file, and records current_task', () => {
    // current_task is auth-flow-2-1 — starting auth-flow-1-2 is a genuine
    // fresh start: clean slate for the new task.
    fs.mkdirSync(path.dirname(trackingPath(dir, 'auth-flow-1-2')), { recursive: true });
    fs.writeFileSync(trackingPath(dir, 'auth-flow-1-2'), '## Attempt 1\n\nstale\n');

    const res = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-2']);
    assert.deepStrictEqual(res, {
      ok: true,
      task: 'auth-flow-1-2',
      gates: { task_gate_mode: 'auto', fix_gate_mode: 'auto' },
    });
    assert.strictEqual(implItem(dir).fix_attempts, 0);
    assert.strictEqual(implItem(dir).current_task, 'auth-flow-1-2');
    assert.ok(!fs.existsSync(trackingPath(dir, 'auth-flow-1-2')));
  });

  it('restarting the manifest\'s current_task preserves fix_attempts and the fix-tracking file', () => {
    // A resumed session restarting the task in flight must not evade the fix
    // threshold or wipe the task's convergence history.
    fs.mkdirSync(path.dirname(trackingPath(dir, 'auth-flow-2-1')), { recursive: true });
    fs.writeFileSync(trackingPath(dir, 'auth-flow-2-1'), '## Attempt 1\n\nconvergence history\n');

    const res = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-2-1']);
    assert.deepStrictEqual(res, {
      ok: true,
      task: 'auth-flow-2-1',
      gates: { task_gate_mode: 'auto', fix_gate_mode: 'auto' },
    });
    assert.strictEqual(implItem(dir).fix_attempts, 2);
    assert.strictEqual(implItem(dir).current_task, 'auth-flow-2-1');
    assert.strictEqual(fs.readFileSync(trackingPath(dir, 'auth-flow-2-1'), 'utf8'), '## Attempt 1\n\nconvergence history\n');
  });

  it('re-starting current_task WITHOUT a tracking file is a fresh start — the counter resets', () => {
    // current_task alone is not a resume: `complete --next-task` pre-records
    // the id, and inheriting the previous task's attempts through it was the
    // counter-leak defect. No tracking file → no in-flight pair → clean slate.
    const res = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-2-1']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(implItem(dir).fix_attempts, 0);
    assert.strictEqual(implItem(dir).current_task, 'auth-flow-2-1');
  });

  it('succeeds when no cache file exists', () => {
    const res = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-2']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(implItem(dir).fix_attempts, 0);
  });

  it('rejects unknown topic, missing internal id, and path-unsafe ids', () => {
    assert.match(engineFails(dir, ['start', 'auth', 'ghost', 'x-1-1']).error, /no implementation item "ghost"/);
    assert.match(engineFails(dir, ['start', 'auth', 'auth-flow']).error, /Usage: engine task start/);
    assert.match(engineFails(dir, ['start', 'auth', 'auth-flow', '../escape']).error, /invalid internal id/);
  });
});

describe('engine task fix-attempt', () => {
  let dir;
  beforeEach(() => {
    dir = setupFixture();
    const phases = planPhases();
    // current_task is the id being fixed — a fix attempt records against it.
    phases.implementation = { items: { 'auth-flow': { status: 'in-progress', fix_attempts: 0, fix_gate_mode: 'gated', current_task: 'auth-flow-1-1' } } };
    createManifest(dir, 'auth', { phases });
  });
  afterEach(() => { cleanupFixture(dir); });

  it('numbers attempts, accumulates verbatim sections, reaches the threshold at 3', () => {
    const first = engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1',
      '--findings-file', writeFindings(dir, 'ISSUES:\n- one\n\nNOTES:\nnone\n')]);
    assert.deepStrictEqual(first, { ok: true, attempts: 1, threshold_reached: false, fix_gate_mode: 'gated' });

    const second = engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1',
      '--findings-file', writeFindings(dir, 'ISSUES:\n- two')]);
    assert.deepStrictEqual(second, { ok: true, attempts: 2, threshold_reached: false, fix_gate_mode: 'gated' });

    const third = engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1',
      '--findings-file', writeFindings(dir, 'ISSUES:\n- three\n')]);
    assert.deepStrictEqual(third, { ok: true, attempts: 3, threshold_reached: true, fix_gate_mode: 'gated' });

    assert.strictEqual(implItem(dir).fix_attempts, 3);
    assert.strictEqual(fs.readFileSync(trackingPath(dir, 'auth-flow-1-1'), 'utf8'), [
      '## Attempt 1',
      '',
      'ISSUES:',
      '- one',
      '',
      'NOTES:',
      'none',
      '',
      '## Attempt 2',
      '',
      'ISSUES:',
      '- two',
      '',
      '## Attempt 3',
      '',
      'ISSUES:',
      '- three',
      '',
    ].join('\n'));
  });

  it('carries the current fix_gate_mode in the response', () => {
    engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'x\n')]);
    const m = readManifest(dir);
    m.phases.implementation.items['auth-flow'].fix_gate_mode = 'auto';
    fs.writeFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'y\n')]);
    assert.strictEqual(res.fix_gate_mode, 'auto');
    assert.strictEqual(res.attempts, 2);
  });

  it('a missing findings file is loud and leaves the manifest untouched', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8');
    const err = engineFails(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', 'ghost.md']);
    assert.match(err.error, /findings file not found: ghost\.md/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8'), before);
    assert.ok(!fs.existsSync(trackingPath(dir, 'auth-flow-1-1')));
  });

  it('rejects a missing --findings-file flag', () => {
    assert.match(engineFails(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1']).error, /Usage: engine task fix-attempt/);
  });

  it('rejects an id that is not current_task — no counter bump, no stray tracking file', () => {
    const before = readManifest(dir);
    // current_task is auth-flow-1-1; a fix attempt against a different id must
    // not increment the item-level counter or write that id's tracking file.
    const err = engineFails(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-2',
      '--findings-file', writeFindings(dir, 'ISSUES:\n- stray\n')]);
    assert.match(err.error, /"auth-flow-1-2" is not the current task \(current_task is "auth-flow-1-1"\) — run `task start auth-flow-1-2` first/);
    assert.strictEqual(implItem(dir).fix_attempts, 0);
    assert.ok(!fs.existsSync(trackingPath(dir, 'auth-flow-1-2')));
    assert.deepStrictEqual(readManifest(dir), before, 'manifest untouched on a mismatched id');
  });
});

describe('engine task complete', () => {
  let dir;
  beforeEach(() => {
    dir = setupFixture();
    const phases = planPhases();
    phases.implementation = { items: { 'auth-flow': freshItem() } };
    createManifest(dir, 'auth', { phases });
  });
  afterEach(() => { cleanupFixture(dir); });

  it('records a completed task by internal id: push, current_phase, current_task', () => {
    const res = engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--phase', '1', '--next-task', 'auth-flow-1-2']);
    assert.deepStrictEqual(res, {
      ok: true,
      internal_id: 'auth-flow-1-1',
      recorded: { completed_task: 'auth-flow-1-1', current_phase: 1, current_task: 'auth-flow-1-2' },
    });
    const item = implItem(dir);
    assert.deepStrictEqual(item.completed_tasks, ['auth-flow-1-1']);
    assert.strictEqual(item.current_phase, 1);
    assert.strictEqual(item.current_task, 'auth-flow-1-2');
  });

  it('zeroes fix_attempts — the finished task\'s in-flight counter never leaks into the next task', () => {
    const m = readManifest(dir);
    m.phases.implementation.items['auth-flow'].fix_attempts = 2;
    m.phases.implementation.items['auth-flow'].current_task = 'auth-flow-1-1';
    fs.writeFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');

    engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--next-task', 'auth-flow-1-2']);
    assert.strictEqual(implItem(dir).fix_attempts, 0);
  });

  it('completing an id that is not current_task preserves the in-flight task\'s fix counter', () => {
    const m = readManifest(dir);
    m.phases.implementation.items['auth-flow'].fix_attempts = 2;
    m.phases.implementation.items['auth-flow'].current_task = 'auth-flow-1-2';
    fs.writeFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');

    engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--skipped']);
    const item = implItem(dir);
    assert.deepStrictEqual(item.completed_tasks, ['auth-flow-1-1']);
    assert.strictEqual(item.fix_attempts, 2, 'an out-of-band completion never zeroes a live fix loop');
    assert.strictEqual(item.current_task, 'auth-flow-1-2');
  });

  it('--next-task ~ clears current_task to null', () => {
    const res = engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--next-task', '~']);
    assert.deepStrictEqual(res.recorded, { completed_task: 'auth-flow-1-1', current_task: null });
    assert.strictEqual(implItem(dir).current_task, null);
  });

  it('resolves --external through the planning task_map (key-of semantics)', () => {
    const res = engine(dir, ['complete', 'auth', 'auth-flow', '--external', 'ext-102']);
    assert.strictEqual(res.internal_id, 'auth-flow-1-2');
    assert.deepStrictEqual(implItem(dir).completed_tasks, ['auth-flow-1-2']);
  });

  it('--skipped still records the id in completed_tasks, flagged in the response', () => {
    const res = engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--skipped', '--next-task', 'auth-flow-1-2']);
    assert.deepStrictEqual(res.recorded, { completed_task: 'auth-flow-1-1', skipped: true, current_task: 'auth-flow-1-2' });
    assert.deepStrictEqual(implItem(dir).completed_tasks, ['auth-flow-1-1']);
  });

  it('--phase-complete pushes the explicit --phase to completed_phases', () => {
    const res = engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-2', '--phase', '2', '--next-task', 'auth-flow-2-1', '--phase-complete']);
    assert.strictEqual(res.recorded.completed_phase, 2);
    assert.deepStrictEqual(implItem(dir).completed_phases, [2]);
  });

  it('--phase-complete derives the phase from the internal id when --phase is absent', () => {
    const res = engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-2-1', '--next-task', '~', '--phase-complete']);
    assert.strictEqual(res.recorded.completed_phase, 2);
    assert.deepStrictEqual(implItem(dir).completed_phases, [2]);
  });

  it('appends to existing progress arrays', () => {
    engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1']);
    engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-2', '--phase-complete']);
    const item = implItem(dir);
    assert.deepStrictEqual(item.completed_tasks, ['auth-flow-1-1', 'auth-flow-1-2']);
    assert.deepStrictEqual(item.completed_phases, [1]);
  });

  it('re-recording a completion is idempotent — no double-count, same response', () => {
    const first = engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-2-1', '--phase-complete']);
    const second = engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-2-1', '--phase-complete']);
    assert.deepStrictEqual(second, first);
    const item = implItem(dir);
    assert.deepStrictEqual(item.completed_tasks, ['auth-flow-2-1']);
    assert.deepStrictEqual(item.completed_phases, [2]);
  });

  it('is loud on unresolvable ids and malformed calls, manifest untouched', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8');
    assert.match(
      engineFails(dir, ['complete', 'auth', 'auth-flow', '--external', 'ext-999']).error,
      /Value "ext-999" not found in "phases\.planning\.items\.auth-flow\.task_map"/);
    assert.match(
      engineFails(dir, ['complete', 'auth', 'auth-flow']).error,
      /exactly one of <internal-id> or --external/);
    assert.match(
      engineFails(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--external', 'ext-101']).error,
      /exactly one of <internal-id> or --external/);
    assert.match(
      engineFails(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--phase', 'two']).error,
      /--phase must be a number/);
    assert.match(
      engineFails(dir, ['complete', 'auth', 'auth-flow', 'oddly-shaped-id', '--phase-complete']).error,
      /cannot derive the phase from "oddly-shaped-id"/);
    assert.match(
      engineFails(dir, ['complete', 'auth', 'ghost', 'x-1-1']).error,
      /no implementation item "ghost"/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), 'utf8'), before);
  });

  it('is loud when the topic has no planning task_map to resolve against', () => {
    const m = readManifest(dir);
    delete m.phases.planning.items['auth-flow'].task_map;
    fs.writeFileSync(path.join(dir, '.workflows', 'auth', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
    assert.match(
      engineFails(dir, ['complete', 'auth', 'auth-flow', '--external', 'ext-101']).error,
      /Path "phases\.planning\.items\.auth-flow\.task_map" is not an object in "auth"/);
  });
});

describe('engine task counter/file lockstep (composition)', () => {
  // The invariant across init/start/fix-attempt/complete: `fix_attempts` and
  // the fix-tracking file always describe the in-flight work of
  // `current_task`. Each scenario runs the real verb sequence a session runs.
  let dir;
  beforeEach(() => {
    dir = setupFixture();
    createManifest(dir, 'auth', { phases: planPhases() });
    engine(dir, ['init', 'auth', 'auth-flow']);
  });
  afterEach(() => { cleanupFixture(dir); });

  it('complete --next-task then start: the next task opens at attempt 1, not the previous task\'s count', () => {
    // Work T1 to two attempts…
    engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']);
    engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'ISSUES:\n- a\n')]);
    engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'ISSUES:\n- b\n')]);
    assert.strictEqual(implItem(dir).fix_attempts, 2);

    // …complete it handing over to T2, start T2: clean slate even though
    // complete pre-recorded T2 as current_task.
    engine(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--next-task', 'auth-flow-1-2']);
    assert.strictEqual(implItem(dir).fix_attempts, 0);
    engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-2']);
    assert.strictEqual(implItem(dir).fix_attempts, 0);

    const res = engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-2', '--findings-file', writeFindings(dir, 'ISSUES:\n- first for T2\n')]);
    assert.strictEqual(res.attempts, 1);
    assert.strictEqual(res.threshold_reached, false);
    assert.match(fs.readFileSync(trackingPath(dir, 'auth-flow-1-2'), 'utf8'), /^## Attempt 1\n/);
  });

  it('crash-resume (init → start) preserves the counter AND the file — sections stay monotonic', () => {
    engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']);
    engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'ISSUES:\n- a\n')]);
    engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'ISSUES:\n- b\n')]);

    // Crash. New session: init resumes, start restarts the task in flight.
    assert.strictEqual(engine(dir, ['init', 'auth', 'auth-flow']).counters.fix_attempts, 2);
    engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']);
    assert.strictEqual(implItem(dir).fix_attempts, 2);

    const res = engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'ISSUES:\n- c\n')]);
    assert.strictEqual(res.attempts, 3);
    assert.strictEqual(res.threshold_reached, true);
    const sections = fs.readFileSync(trackingPath(dir, 'auth-flow-1-1'), 'utf8').match(/^## Attempt (\d+)$/gm);
    assert.deepStrictEqual(sections, ['## Attempt 1', '## Attempt 2', '## Attempt 3']);
  });

  it('re-running start for the in-flight task is idempotent — the post-compaction re-fetch is non-destructive', () => {
    const first = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']);
    engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'ISSUES:\n- a\n')]);
    const fileBefore = fs.readFileSync(trackingPath(dir, 'auth-flow-1-1'), 'utf8');

    const again = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']);
    assert.deepStrictEqual(again, first);
    assert.strictEqual(implItem(dir).fix_attempts, 1);
    assert.strictEqual(fs.readFileSync(trackingPath(dir, 'auth-flow-1-1'), 'utf8'), fileBefore);
  });

  it('starting a different task mid-flight resets the pair for the new task', () => {
    engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']);
    engine(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1', '--findings-file', writeFindings(dir, 'ISSUES:\n- a\n')]);

    engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-2-1']);
    const item = implItem(dir);
    assert.strictEqual(item.fix_attempts, 0);
    assert.strictEqual(item.current_task, 'auth-flow-2-1');
    assert.ok(!fs.existsSync(trackingPath(dir, 'auth-flow-2-1')));
  });
});

describe('engine task analysis-cycle', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function seed(total, session, gateMode = 'gated') {
    const phases = planPhases();
    phases.implementation = {
      items: {
        'auth-flow': {
          status: 'in-progress',
          analysis_cycle_total: total,
          analysis_cycle_session: session,
          analysis_gate_mode: gateMode,
        },
      },
    };
    createManifest(dir, 'auth', { phases });
  }

  it('increments both counters; session 3 is within the limit', () => {
    seed(7, 2);
    const res = engine(dir, ['analysis-cycle', 'auth', 'auth-flow']);
    assert.deepStrictEqual(res, {
      ok: true, cycle_total: 8, cycle_session: 3, over_session_limit: false, analysis_gate_mode: 'gated',
    });
    const item = implItem(dir);
    assert.strictEqual(item.analysis_cycle_total, 8);
    assert.strictEqual(item.analysis_cycle_session, 3);
  });

  it('session 4 crosses the limit; the gate mode is carried in the response', () => {
    seed(10, 3, 'auto');
    const res = engine(dir, ['analysis-cycle', 'auth', 'auth-flow']);
    assert.deepStrictEqual(res, {
      ok: true, cycle_total: 11, cycle_session: 4, over_session_limit: true, analysis_gate_mode: 'auto',
    });
  });

  it('missing counters start from zero', () => {
    const phases = planPhases();
    phases.implementation = { items: { 'auth-flow': { status: 'in-progress' } } };
    createManifest(dir, 'auth', { phases });
    const res = engine(dir, ['analysis-cycle', 'auth', 'auth-flow']);
    assert.strictEqual(res.cycle_total, 1);
    assert.strictEqual(res.cycle_session, 1);
  });

  it('rejects unknown work unit and topic', () => {
    seed(0, 0);
    assert.match(engineFails(dir, ['analysis-cycle', 'ghost', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['analysis-cycle', 'auth', 'ghost']).error, /no implementation item "ghost"/);
  });
});

describe('engine task verbs answer with pure JSON', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // The gate sections live on the render surfaces — a task verb's stdout is
  // exactly its one-line JSON response, whatever the gate modes and counters.

  /** @param {string} mode @param {number} [attempts] */
  function seedGates(mode, attempts = 0) {
    const phases = planPhases();
    phases.implementation = {
      items: {
        'auth-flow': {
          status: 'in-progress',
          task_gate_mode: mode,
          fix_gate_mode: mode,
          analysis_gate_mode: mode,
          fix_attempts: attempts,
          current_task: 'auth-flow-1-1',
        },
      },
    };
    createManifest(dir, 'auth', { phases });
  }

  it('init, start, fix-attempt, complete emit no sections in any gate mode', () => {
    createManifest(dir, 'auth', { phases: planPhases() });
    assert.strictEqual(engineRaw(dir, ['init', 'auth', 'auth-flow']).sections, '');
    assert.strictEqual(engineRaw(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']).sections, '');
    assert.strictEqual(
      engineRaw(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1',
        '--findings-file', writeFindings(dir, 'ISSUES:\n- one\n')]).sections,
      '');
    assert.strictEqual(
      engineRaw(dir, ['complete', 'auth', 'auth-flow', 'auth-flow-1-1', '--next-task', '~']).sections,
      '');

    cleanupFixture(dir);
    dir = setupFixture();
    seedGates('auto', 2);
    assert.strictEqual(engineRaw(dir, ['start', 'auth', 'auth-flow', 'auth-flow-1-1']).sections, '');
    assert.strictEqual(
      engineRaw(dir, ['fix-attempt', 'auth', 'auth-flow', 'auth-flow-1-1',
        '--findings-file', writeFindings(dir, 'ISSUES:\n- two\n')]).sections,
      '');
  });

  it('analysis-cycle emits no sections, over the limit or not', () => {
    seedGates('auto');
    let raw = engineRaw(dir, ['analysis-cycle', 'auth', 'auth-flow']);
    assert.strictEqual(raw.sections, '');
    assert.strictEqual(raw.res.over_session_limit, false);

    cleanupFixture(dir);
    dir = setupFixture();
    const phases = planPhases();
    phases.implementation = {
      items: { 'auth-flow': { status: 'in-progress', analysis_cycle_session: 3, analysis_gate_mode: 'auto' } },
    };
    createManifest(dir, 'auth', { phases });
    raw = engineRaw(dir, ['analysis-cycle', 'auth', 'auth-flow']);
    assert.strictEqual(raw.sections, '');
    assert.strictEqual(raw.res.over_session_limit, true);
  });
});

describe('engine render task surfaces', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // Byte-pinned renders: every gate-mode × counter state that changes the
  // section output. The task verbs' JSON lines are covered by the suites
  // above — these surfaces are fetched by the loop at each gate's own stage.

  /** Run `engine render` expecting success; returns the whole stdout. */
  function render(args) {
    return execFileSync('node', [ENGINE, 'render', ...args], { cwd: dir, encoding: 'utf8' });
  }

  /** Run `engine render` expecting failure; returns the parsed stderr JSON. */
  function renderFails(args) {
    const res = spawnSync('node', [ENGINE, 'render', ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const parsed = JSON.parse(res.stderr.trim());
    assert.strictEqual(parsed.ok, false);
    return parsed;
  }

  const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

  const BLOCKED_MENU = [
    `=== MENU: blocked tasks (${MENU_INSTRUCTION}) ===`,
    '· · · · · · · · · · · ·',
    '**\`◆ How would you like to proceed?\`**',
    '',
    '**`p/proceed`** → Continue with the first blocked task anyway (its blocker will not be completed)',
    '**`s/skip`**    → Skip the blocked tasks and conclude the loop',
    '**`t/stop`**    → Stop implementation entirely',
    '',
  ].join('\n');

  const CYCLE_MENU = [
    `=== MENU: cycle gate (${MENU_INSTRUCTION}) ===`,
    '· · · · · · · · · · · ·',
    '**`◆ Continue with analysis?`**',
    '',
    '**`p/proceed`** → Continue analysis',
    '**`s/skip`**    → Skip analysis, proceed to completion',
    '',
  ].join('\n');

  /** @param {string} id */
  function taskGateMenu(id) {
    return [
      `=== MENU: task gate (${MENU_INSTRUCTION}) ===`,
      '· · · · · · · · · · · ·',
      `**\`◆ Approve task ${id}?\`**`,
      '',
      '**`y/yes`**       → Commit and continue to next task',
      '**`a/auto`**      → Approve this and all future tasks automatically',
      "**`t/technical`** → Retell the result from the code's perspective",
      "**Ask**         → Ask questions about the implementation (doesn't approve or reject)",
      '**Comment**     → Request changes (triggers a fix round)',
      '',
    ].join('\n');
  }

  /** @param {string} id @param {{auto?: boolean}} [opts] */
  function fixGateMenu(id, { auto = false } = {}) {
    return [
      `=== MENU: fix gate (${MENU_INSTRUCTION}) ===`,
      '· · · · · · · · · · · ·',
      `**\`◆ Accept the reviewer's fix analysis for task ${id}?\`**`,
      '',
      '**`y/yes`**       → Pass to executor',
      ...(auto ? [] : ['**`a/auto`**      → Accept and auto-approve future fix analyses']),
      '**`s/skip`**      → Override the reviewer and proceed as-is',
      "**`t/technical`** → Retell the review from the code's perspective",
      "**Ask**         → Ask questions about the review (doesn't accept or reject)",
      '**Comment**     → Accept with adjustments — pass your own direction alongside the review',
      '',
    ].join('\n');
  }

  /** @param {string} mode @param {number} [attempts] */
  function seedGates(mode, attempts = 0) {
    const phases = planPhases();
    phases.implementation = {
      items: {
        'auth-flow': {
          status: 'in-progress',
          task_gate_mode: mode,
          fix_gate_mode: mode,
          analysis_gate_mode: mode,
          fix_attempts: attempts,
          current_task: 'auth-flow-1-1',
        },
      },
    };
    createManifest(dir, 'auth', { phases });
  }

  it('blocked-tasks renders the static stop menu, no address needed', () => {
    assert.strictEqual(render(['blocked-tasks']), BLOCKED_MENU);
  });

  it('cycle-gate renders the static cycle menu, no address needed', () => {
    assert.strictEqual(render(['cycle-gate']), CYCLE_MENU);
  });

  it('task-gate under a gated mode renders the approval menu named for the in-flight task', () => {
    seedGates('gated');
    assert.strictEqual(render(['task-gate', 'auth.implementation.auth-flow']), taskGateMenu('auth-flow-1-1'));
  });

  it('task-gate under an auto mode renders the continuation line', () => {
    seedGates('auto');
    assert.strictEqual(
      render(['task-gate', 'auth.implementation.auth-flow']),
      [
        '=== DISPLAY: task gate auto-approved (emit verbatim as a code block after the result summary) ===',
        'Task auth-flow-1-1 — approved [auto]. Committing and moving to the next task.',
        '',
      ].join('\n'));
  });

  it('fix-gate below the threshold: gated renders the full menu, auto the continuation line', () => {
    seedGates('gated', 1);
    assert.strictEqual(render(['fix-gate', 'auth.implementation.auth-flow']), fixGateMenu('auth-flow-1-1'));

    cleanupFixture(dir);
    dir = setupFixture();
    seedGates('auto', 2);
    assert.strictEqual(
      render(['fix-gate', 'auth.implementation.auth-flow']),
      [
        '=== DISPLAY: fix gate auto-accepted (emit verbatim as a code block after the findings summary) ===',
        'Fix analysis for task auth-flow-1-1 — accepted [auto]. Passing the findings to the executor.',
        '',
      ].join('\n'));
  });

  it('fix-gate at the threshold renders the menu in both modes — auto omits the auto option', () => {
    seedGates('gated', 3);
    assert.strictEqual(render(['fix-gate', 'auth.implementation.auth-flow']), fixGateMenu('auth-flow-1-1'));

    cleanupFixture(dir);
    dir = setupFixture();
    seedGates('auto', 3);
    assert.strictEqual(
      render(['fix-gate', 'auth.implementation.auth-flow']),
      fixGateMenu('auth-flow-1-1', { auto: true }));
  });

  it('task-gate and fix-gate refuse a missing in-flight task, a wrong-phase address, and an unknown work unit', () => {
    const phases = planPhases();
    phases.implementation = { items: { 'auth-flow': { status: 'in-progress' } } };
    createManifest(dir, 'auth', { phases });
    assert.match(renderFails(['task-gate', 'auth.implementation.auth-flow']).error, /no current task/);
    assert.match(renderFails(['fix-gate', 'auth.implementation.auth-flow']).error, /no current task/);
    assert.match(renderFails(['task-gate', 'auth.planning.auth-flow']).error, /must be <work_unit>\.implementation\.<topic>/);
    assert.match(renderFails(['fix-gate', 'ghost.implementation.auth-flow']).error, /not found/);
  });

  it('fix-threshold renders the escalation callout at and past the threshold, refuses below it', () => {
    seedGates('auto', 3);
    assert.strictEqual(
      render(['fix-threshold', 'auth.implementation.auth-flow']),
      [
        '=== DISPLAY: fix threshold (emit verbatim as a code block) ===',
        '⚑ Fix attempt 3 for task auth-flow-1-1 — escalation threshold reached.',
        '',
      ].join('\n'));

    cleanupFixture(dir);
    dir = setupFixture();
    seedGates('gated', 4);
    assert.match(render(['fix-threshold', 'auth.implementation.auth-flow']), /⚑ Fix attempt 4 for task auth-flow-1-1/);

    cleanupFixture(dir);
    dir = setupFixture();
    seedGates('gated', 2);
    assert.match(renderFails(['fix-threshold', 'auth.implementation.auth-flow']).error, /below the threshold/);
  });

  it('cycle-limit renders the over-limit callout, refuses within the limit', () => {
    const phases = planPhases();
    phases.implementation = { items: { 'auth-flow': { status: 'in-progress', analysis_cycle_session: 4 } } };
    createManifest(dir, 'auth', { phases });
    assert.strictEqual(
      render(['cycle-limit', 'auth.implementation.auth-flow']),
      [
        '=== DISPLAY: cycle limit (emit verbatim as a code block) ===',
        '⚑ Analysis cycle 4 this session — over the session limit of 3.',
        '',
      ].join('\n'));

    cleanupFixture(dir);
    dir = setupFixture();
    const within = planPhases();
    within.implementation = { items: { 'auth-flow': { status: 'in-progress', analysis_cycle_session: 3 } } };
    createManifest(dir, 'auth', { phases: within });
    assert.match(renderFails(['cycle-limit', 'auth.implementation.auth-flow']).error, /within the session limit/);
  });
});

describe('engine task usage', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('rejects an unknown subcommand', () => {
    assert.match(engineFails(dir, ['bogus', 'auth', 'auth-flow']).error, /Usage: engine task <init\|start\|fix-attempt\|complete\|analysis-cycle>/);
  });
});
