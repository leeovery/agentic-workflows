'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-continue-bugfix/scripts/gateway.cjs');

describe('workflow-continue-bugfix discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no bugfixes exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.bugfixes.length, 0);
    assert.strictEqual(r.summary, 'no active bugfixes');
  });

  it('lists active bugfixes only', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'old', { work_type: 'bugfix', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.bugfixes[0].name, 'crash');
  });

  it('excludes non-bugfix work types', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
  });

  it('surfaces a finished pipeline still in-progress as finalising', () => {
    createManifest(dir, 'done', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { done: { status: 'completed' } } },
        specification: { items: { done: { status: 'completed' } } },
        planning: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.bugfixes[0].next_phase, 'done');
    assert.strictEqual(r.bugfixes[0].finalising, true);
    assert.ok(format(r).includes('  done: finalising — pipeline complete\n'));
  });

  it('includes completed_phases', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { crash: { status: 'completed' } } },
        specification: { items: { crash: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.bugfixes[0].completed_phases, ['investigation']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'leak', { work_type: 'bugfix', phases: { specification: { items: { leak: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active bugfix(es)');
  });

  it('includes completed bugfixes in separate array', () => {
    createManifest(dir, 'done', { work_type: 'bugfix', status: 'completed', phases: { review: { items: { done: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'bugfix', phases: { investigation: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'review');
  });

  it('includes cancelled bugfixes in separate array', () => {
    createManifest(dir, 'stopped', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { stopped: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
    assert.strictEqual(r.cancelled[0].last_phase, 'investigation');
  });

  describe('edge cases', () => {
    it('recognizes completed as completed in completed_phases', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          investigation: { items: { crash: { status: 'completed' } } },
          specification: { items: { crash: { status: 'completed' } } },
          planning: { items: { crash: { status: 'completed' } } },
          implementation: { items: { crash: { status: 'completed' } } },
          review: { items: { crash: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.ok(r.bugfixes[0].completed_phases.includes('implementation'));
    });

    it('bugfix in review in-progress is listed (not filtered as done)', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          investigation: { items: { crash: { status: 'completed' } } },
          specification: { items: { crash: { status: 'completed' } } },
          planning: { items: { crash: { status: 'completed' } } },
          implementation: { items: { crash: { status: 'completed' } } },
          review: { items: { crash: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.bugfixes[0].next_phase, 'review');
    });

    it('research is not in bugfix completed_phases even if present', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          research: { items: { crash: { status: 'completed' } } },
          investigation: { items: { crash: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.ok(!r.bugfixes[0].completed_phases.includes('research'));
    });
  });
});

describe('workflow-continue-bugfix format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('empty project pins the full dump byte-exactly', () => {
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== BUGFIXES (0) ===',
      '=== COMPLETED (0) ===',
      '=== CANCELLED (0) ===',
      '',
    ].join('\n'));
  });

  it('active, completed, and cancelled bugfixes pin the full dump byte-exactly', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { crash: { status: 'completed' } } },
        specification: { items: { crash: { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'leak', {
      work_type: 'bugfix',
      phases: { investigation: { items: { leak: { status: 'in-progress' } } } },
    });
    createManifest(dir, 'fixed', { work_type: 'bugfix', status: 'completed', phases: { review: { items: { fixed: { status: 'completed' } } } } });
    createManifest(dir, 'wontfix', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { wontfix: { status: 'completed' } } } } });
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== BUGFIXES (2) ===',
      '  crash: specification (in-progress)',
      '  leak: investigation (in-progress)',
      '=== COMPLETED (1) ===',
      '  fixed (last phase: review)',
      '=== CANCELLED (1) ===',
      '  wontfix (last phase: investigation)',
      '=== DISPLAY: selection (emit verbatim as a code block only at the select step) ===',
      '2 bugfix(es) in progress:',
      '',
      '  1. Crash',
      '     └─ Specification (In-Progress)',
      '',
      '  2. Leak',
      '     └─ Investigation (In-Progress)',
      '',
      '1 completed, 1 cancelled.',
      '',
      "=== MENU: selection (emit verbatim as markdown only at the select step, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Which bugfix would you like to continue?',
      '',
      '- **`1`** — Continue "Crash" — specification (in-progress)',
      '- **`2`** — Continue "Leak" — investigation (in-progress)',
      '- **`3`** — View completed & cancelled bugfixes',
      "- **`m`/`manage`** — Manage a bugfix's lifecycle",
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
      '',
    ].join('\n'));
  });

  it('carries no completed_phases clause — the view verb owns it', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { crash: { status: 'completed' } } },
        specification: { items: { crash: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(!out.includes('[completed:'));
    assert.ok(!out.includes('summary:'));
  });
});

describe('workflow-continue-bugfix CLI dispatch', () => {
  const GATEWAY = path.join(__dirname, '../../skills/workflow-continue-bugfix/scripts/gateway.cjs');
  const USAGE = 'Usage: gateway.cjs | gateway.cjs view {work_unit}\n';

  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [GATEWAY, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('bare call still renders the index byte-identically', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    const res = run([]);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout, format(discover(dir)));
  });

  it('view {work_unit} still answers the sectioned snapshot', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    const res = run(['view', 'crash']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.ok(res.stdout.includes('=== DATA'));
    assert.ok(res.stdout.includes('=== DISPLAY'));
    assert.ok(res.stdout.includes('=== MENU'));
  });

  it('a bare positional errors instead of rendering the index', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    const res = run(['crash']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "crash"\n' + USAGE);
  });

  it('an unknown verb errors with usage', () => {
    const res = run(['veiw', 'crash']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "veiw"\n' + USAGE);
  });

  it('view with excess positionals errors with usage', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    const res = run(['view', 'crash', 'extra']);
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
