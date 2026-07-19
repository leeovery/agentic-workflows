'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-continue-cross-cutting/scripts/gateway.cjs');

describe('workflow-continue-cross-cutting discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no cross-cutting concerns exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.cross_cutting.length, 0);
    assert.strictEqual(r.summary, 'no active cross-cutting concerns');
  });

  it('lists active cross-cutting concerns only', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'old', { work_type: 'cross-cutting', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.cross_cutting[0].name, 'caching');
  });

  it('excludes non-cross-cutting work types', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'v1', { work_type: 'epic' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.cross_cutting[0].name, 'caching');
  });

  it('excludes done cross-cutting concerns', () => {
    createManifest(dir, 'done-cc', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { 'done-cc': { status: 'completed' } } },
        specification: { items: { 'done-cc': { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
  });

  it('includes phase_label and completed_phases', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.cross_cutting[0].phase_label, 'specification (in-progress)');
    assert.deepStrictEqual(r.cross_cutting[0].completed_phases, ['discussion']);
  });

  it('returns multiple completed phases', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        research: { items: { caching: { status: 'completed' } } },
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.cross_cutting[0].completed_phases, ['research', 'discussion']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'error-handling', { work_type: 'cross-cutting', phases: { specification: { items: { 'error-handling': { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active cross-cutting concern(s)');
  });

  it('includes completed cross-cutting concerns in separate array', () => {
    createManifest(dir, 'done', { work_type: 'cross-cutting', status: 'completed', phases: { specification: { items: { done: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'cross-cutting', phases: { discussion: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'specification');
  });

  it('includes cancelled cross-cutting concerns in separate array', () => {
    createManifest(dir, 'stopped', { work_type: 'cross-cutting', status: 'cancelled', phases: { discussion: { items: { stopped: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
    assert.strictEqual(r.cancelled[0].last_phase, 'discussion');
  });

  it('excludes non-cross-cutting completed work units', () => {
    createManifest(dir, 'done-feat', { work_type: 'feature', status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.completed_count, 0);
  });
});

describe('workflow-continue-cross-cutting format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('empty project pins the full dump byte-exactly', () => {
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== CROSS-CUTTING (0) ===',
      '=== COMPLETED (0) ===',
      '=== CANCELLED (0) ===',
      '',
    ].join('\n'));
  });

  it('active, completed, and cancelled concerns pin the full dump byte-exactly', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'error-handling', {
      work_type: 'cross-cutting',
      phases: { discussion: { items: { 'error-handling': { status: 'in-progress' } } } },
    });
    createManifest(dir, 'logging', { work_type: 'cross-cutting', status: 'completed', phases: { specification: { items: { logging: { status: 'completed' } } } } });
    createManifest(dir, 'naming', { work_type: 'cross-cutting', status: 'cancelled' });
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== CROSS-CUTTING (2) ===',
      '  caching: specification (in-progress)',
      '  error-handling: discussion (in-progress)',
      '=== COMPLETED (1) ===',
      '  logging (last phase: specification)',
      '=== CANCELLED (1) ===',
      '  naming (last phase: none)',
      '',
    ].join('\n'));
  });

  it('carries no completed_phases clause — the view verb owns it', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(!out.includes('[completed:'));
    assert.ok(!out.includes('summary:'));
  });
});

describe('workflow-continue-cross-cutting CLI dispatch', () => {
  const GATEWAY = path.join(__dirname, '../../skills/workflow-continue-cross-cutting/scripts/gateway.cjs');
  const USAGE = 'Usage: gateway.cjs | gateway.cjs view {work_unit}\n';

  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [GATEWAY, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('bare call still renders the index byte-identically', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    const res = run([]);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout, format(discover(dir)));
  });

  it('view {work_unit} still answers the sectioned snapshot', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    const res = run(['view', 'caching']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.ok(res.stdout.includes('=== DATA'));
    assert.ok(res.stdout.includes('=== DISPLAY'));
    assert.ok(res.stdout.includes('=== MENU'));
  });

  it('a bare positional errors instead of rendering the index', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    const res = run(['caching']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "caching"\n' + USAGE);
  });

  it('an unknown verb errors with usage', () => {
    const res = run(['veiw', 'caching']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "veiw"\n' + USAGE);
  });

  it('view with excess positionals errors with usage', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    const res = run(['view', 'caching', 'extra']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: view takes exactly one work unit\n' + USAGE);
  });

  it('view without a work unit errors with usage', () => {
    const res = run(['view']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: view takes exactly one work unit\n' + USAGE);
  });

  it('index with excess positionals errors with usage', () => {
    const res = run(['index', 'extra']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: index takes no arguments\n' + USAGE);
  });
});
