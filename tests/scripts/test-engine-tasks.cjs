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
  return path.join(dir, '.workflows', '.cache', 'auth', 'implementation', 'auth-flow', `fix-tracking-${internalId}.md`);
}

function writeFindings(dir, content) {
  const file = path.join(dir, '.workflows', '.cache', 'auth', 'implementation', 'auth-flow', 'attempt-findings.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return '.workflows/.cache/auth/implementation/auth-flow/attempt-findings.md';
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args) {
  return JSON.parse(execFileSync('node', [ENGINE, 'task', ...args], { cwd: dir, encoding: 'utf8' }).trim());
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

  it('resets fix_attempts, deletes the fix-tracking cache file, reports the gates', () => {
    fs.mkdirSync(path.dirname(trackingPath(dir, 'auth-flow-2-1')), { recursive: true });
    fs.writeFileSync(trackingPath(dir, 'auth-flow-2-1'), '## Attempt 1\n\nstale\n');

    const res = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-2-1']);
    assert.deepStrictEqual(res, {
      ok: true,
      task: 'auth-flow-2-1',
      gates: { task_gate_mode: 'auto', fix_gate_mode: 'auto' },
    });
    assert.strictEqual(implItem(dir).fix_attempts, 0);
    assert.ok(!fs.existsSync(trackingPath(dir, 'auth-flow-2-1')));
  });

  it('succeeds when no cache file exists', () => {
    const res = engine(dir, ['start', 'auth', 'auth-flow', 'auth-flow-2-1']);
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
    phases.implementation = { items: { 'auth-flow': { status: 'in-progress', fix_attempts: 0, fix_gate_mode: 'gated' } } };
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

describe('engine task usage', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('rejects an unknown subcommand', () => {
    assert.match(engineFails(dir, ['bogus', 'auth', 'auth-flow']).error, /Usage: engine task <init\|start\|fix-attempt\|complete\|analysis-cycle>/);
  });
});
