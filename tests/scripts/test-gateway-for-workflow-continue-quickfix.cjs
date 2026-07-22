'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-continue-quickfix/scripts/gateway.cjs');

describe('workflow-continue-quickfix discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no quick-fixes exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.quick_fixes.length, 0);
    assert.strictEqual(r.summary, 'no active quick-fixes');
  });

  it('lists active quick-fixes only', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'old', { work_type: 'quick-fix', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.quick_fixes[0].name, 'rename-api');
  });

  it('excludes non-quick-fix work types', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
  });

  it('surfaces a finished pipeline still in-progress as finalising', () => {
    createManifest(dir, 'done', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.quick_fixes[0].next_phase, 'done');
    assert.strictEqual(r.quick_fixes[0].finalising, true);
    assert.ok(format(r).includes('  done: finalising — pipeline complete\n'));
  });

  it('includes completed_phases', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.quick_fixes[0].completed_phases, ['scoping']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'update-deps', { work_type: 'quick-fix', phases: { implementation: { items: { 'update-deps': { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active quick-fix(es)');
  });

  it('includes completed quick-fixes in separate array', () => {
    createManifest(dir, 'done', { work_type: 'quick-fix', status: 'completed', phases: { review: { items: { done: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'quick-fix', phases: { scoping: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'review');
  });

  it('includes cancelled quick-fixes in separate array', () => {
    createManifest(dir, 'stopped', { work_type: 'quick-fix', status: 'cancelled', phases: { scoping: { items: { stopped: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
    assert.strictEqual(r.cancelled[0].last_phase, 'scoping');
  });

  describe('edge cases', () => {
    it('completed_phases includes all three pipeline phases when completed', () => {
      createManifest(dir, 'qf', {
        work_type: 'quick-fix',
        phases: {
          scoping: { items: { qf: { status: 'completed' } } },
          implementation: { items: { qf: { status: 'completed' } } },
          review: { items: { qf: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.quick_fixes[0].completed_phases, ['scoping', 'implementation']);
    });

    it('quick-fix in review in-progress is listed (not filtered as done)', () => {
      createManifest(dir, 'qf', {
        work_type: 'quick-fix',
        phases: {
          scoping: { items: { qf: { status: 'completed' } } },
          implementation: { items: { qf: { status: 'completed' } } },
          review: { items: { qf: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.quick_fixes[0].next_phase, 'review');
    });

    it('discussion is not in quick-fix completed_phases even if present', () => {
      createManifest(dir, 'qf', {
        work_type: 'quick-fix',
        phases: {
          discussion: { items: { qf: { status: 'completed' } } },
          scoping: { items: { qf: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.ok(!r.quick_fixes[0].completed_phases.includes('discussion'));
    });
  });
});

describe('workflow-continue-quickfix format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('empty project pins the full dump byte-exactly', () => {
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== QUICK-FIXES (0) ===',
      '=== COMPLETED (0) ===',
      '=== CANCELLED (0) ===',
      '',
    ].join('\n'));
  });

  it('active, completed, and cancelled quick-fixes pin the full dump byte-exactly', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'bump-dep', {
      work_type: 'quick-fix',
      phases: { scoping: { items: { 'bump-dep': { status: 'in-progress' } } } },
    });
    createManifest(dir, 'shipped', { work_type: 'quick-fix', status: 'completed', phases: { review: { items: { shipped: { status: 'completed' } } } } });
    createManifest(dir, 'dropped', { work_type: 'quick-fix', status: 'cancelled', phases: { scoping: { items: { dropped: { status: 'completed' } } } } });
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== QUICK-FIXES (2) ===',
      '  bump-dep: scoping (in-progress)',
      '  rename-api: implementation (in-progress)',
      '=== COMPLETED (1) ===',
      '  shipped (last phase: review)',
      '=== CANCELLED (1) ===',
      '  dropped (last phase: scoping)',
      '=== DISPLAY: selection (emit verbatim as a code block only at the select step) ===',
      '2 quick-fix(es) in progress:',
      '',
      '  1. Bump Dep',
      '     └─ Scoping (In-Progress)',
      '',
      '  2. Rename Api',
      '     └─ Implementation (In-Progress)',
      '',
      '1 completed, 1 cancelled.',
      '',
      "=== MENU: selection (emit verbatim as markdown only at the select step, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Which quick-fix would you like to continue?',
      '',
      '- **`1`** — Continue "Bump Dep" — scoping (in-progress)',
      '- **`2`** — Continue "Rename Api" — implementation (in-progress)',
      '',
      '- **`3`** — View completed & cancelled quick-fixes',
      "- **`m`/`manage`** — Manage a quick-fix's lifecycle",
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
      '',
    ].join('\n'));
  });

  it('carries no completed_phases clause — the view verb owns it', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(!out.includes('[completed:'));
    assert.ok(!out.includes('summary:'));
  });
});

describe('workflow-continue-quickfix CLI dispatch', () => {
  const GATEWAY = path.join(__dirname, '../../skills/workflow-continue-quickfix/scripts/gateway.cjs');
  const USAGE = 'Usage: gateway.cjs | gateway.cjs view {work_unit}\n';

  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [GATEWAY, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('bare call still renders the index byte-identically', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    const res = run([]);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout, format(discover(dir)));
  });

  it('view {work_unit} still answers the sectioned snapshot', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    const res = run(['view', 'rename-api']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.ok(res.stdout.includes('=== DATA'));
    assert.ok(res.stdout.includes('=== DISPLAY'));
    assert.ok(res.stdout.includes('=== MENU'));
  });

  it('a bare positional errors instead of rendering the index', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    const res = run(['rename-api']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "rename-api"\n' + USAGE);
  });

  it('an unknown verb errors with usage', () => {
    const res = run(['veiw', 'rename-api']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "veiw"\n' + USAGE);
  });

  it('view with excess positionals errors with usage', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    const res = run(['view', 'rename-api', 'extra']);
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
