'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-continue-feature/scripts/gateway.cjs');

describe('workflow-continue-feature discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no features exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.count, 0);
    assert.strictEqual(r.features.length, 0);
    assert.strictEqual(r.summary, 'no active features');
  });

  it('lists active features only', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    createManifest(dir, 'old', { work_type: 'feature', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.features[0].name, 'auth');
  });

  it('excludes non-feature work types', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'v1', { work_type: 'epic' });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.features[0].name, 'auth');
  });

  it('surfaces a finished pipeline still in-progress as finalising', () => {
    createManifest(dir, 'done', {
      work_type: 'feature',
      phases: {
        discussion: { items: { done: { status: 'completed' } } },
        specification: { items: { done: { status: 'completed' } } },
        planning: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.features[0].next_phase, 'done');
    assert.strictEqual(r.features[0].finalising, true);
    assert.ok(format(r).includes('  done: finalising — pipeline complete\n'));
  });

  it('includes phase_label and completed_phases', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.features[0].phase_label, 'specification (in-progress)');
    assert.deepStrictEqual(r.features[0].completed_phases, ['discussion']);
  });

  it('returns multiple completed phases', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        research: { items: { auth: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
        planning: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.features[0].completed_phases, ['research', 'discussion', 'specification']);
  });

  it('returns summary with count', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    createManifest(dir, 'billing', { work_type: 'feature', phases: { planning: { items: { billing: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.summary, '2 active feature(s)');
  });

  it('includes completed features in separate array', () => {
    createManifest(dir, 'done', { work_type: 'feature', status: 'completed', phases: { review: { items: { done: { status: 'completed' } } } } });
    createManifest(dir, 'active', { work_type: 'feature', phases: { discussion: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done');
    assert.strictEqual(r.completed[0].last_phase, 'review');
  });

  it('includes cancelled features in separate array', () => {
    createManifest(dir, 'stopped', { work_type: 'feature', status: 'cancelled', phases: { specification: { items: { stopped: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'stopped');
    assert.strictEqual(r.cancelled[0].last_phase, 'specification');
  });

  it('excludes non-feature completed work units', () => {
    createManifest(dir, 'done-bug', { work_type: 'bugfix', status: 'completed', phases: { review: { items: { 'done-bug': { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.completed_count, 0);
  });

  describe('edge cases', () => {
    it('recognizes completed as completed in completed_phases', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: { items: { auth: { status: 'completed' } } },
          planning: { items: { auth: { status: 'completed' } } },
          implementation: { items: { auth: { status: 'completed' } } },
          review: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.ok(r.features[0].completed_phases.includes('implementation'));
    });

    it('feature in review in-progress is listed (not filtered as done)', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: { items: { auth: { status: 'completed' } } },
          planning: { items: { auth: { status: 'completed' } } },
          implementation: { items: { auth: { status: 'completed' } } },
          review: { items: { auth: { status: 'in-progress' } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.features[0].next_phase, 'review');
    });

    it('feature with only research completed has it in completed_phases', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { research: { items: { auth: { status: 'completed' } } } },
      });
      const r = discover(dir);
      assert.deepStrictEqual(r.features[0].completed_phases, ['research']);
    });
  });

  describe('imports_count', () => {
    it('reports zero when no imports tracked', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const r = discover(dir);
      assert.strictEqual(r.features[0].imports_count, 0);
    });

    it('reports zero when imports field is missing entirely', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const r = discover(dir);
      assert.strictEqual(r.features[0].imports_count, 0);
    });

    it('reports the length of manifest.imports[]', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
        imports: [
          { path: 'imports/seed-conversation.md', imported_at: '2026-05-10T10:00:00Z' },
          { path: 'imports/early-thoughts.md', imported_at: '2026-05-10T10:01:00Z' },
        ],
      });
      const r = discover(dir);
      assert.strictEqual(r.features[0].imports_count, 2);
    });
  });

  describe('seeds_count', () => {
    it('reports zero when no seeds tracked', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      const r = discover(dir);
      assert.strictEqual(r.features[0].seeds_count, 0);
    });

    it('reports the length of manifest.seeds[]', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
        seeds: [
          { path: 'seeds/2026-03-18-login-timeout.md', source: 'inbox:bug', seeded_at: '2026-05-10T10:00:00Z' },
        ],
      });
      const r = discover(dir);
      assert.strictEqual(r.features[0].seeds_count, 1);
    });

    it('format output carries no seeds clause — seeds are not a dump concern', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
        seeds: [
          { path: 'seeds/2026-03-18-login-timeout.md', source: 'inbox:bug', seeded_at: '2026-05-10T10:00:00Z' },
        ],
      });
      const out = format(discover(dir));
      assert.ok(!out.includes('seed'));
    });
  });
});

describe('workflow-continue-feature format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('empty project pins the full dump byte-exactly', () => {
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== FEATURES (0) ===',
      '=== COMPLETED (0) ===',
      '=== CANCELLED (0) ===',
      '',
    ].join('\n'));
  });

  it('active, completed, and cancelled features pin the full dump byte-exactly', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'dark-mode', {
      work_type: 'feature',
      phases: { discussion: { items: { 'dark-mode': { status: 'in-progress' } } } },
    });
    createManifest(dir, 'done-feat', { work_type: 'feature', status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(dir, 'stopped', { work_type: 'feature', status: 'cancelled', phases: { specification: { items: { stopped: { status: 'completed' } } } } });
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== FEATURES (2) ===',
      '  auth: specification (in-progress)',
      '  dark-mode: discussion (in-progress)',
      '=== COMPLETED (1) ===',
      '  done-feat (last phase: review)',
      '=== CANCELLED (1) ===',
      '  stopped (last phase: specification)',
      '=== DISPLAY: selection (emit verbatim as a code block only at the select step) ===',
      '2 feature(s) in progress:',
      '',
      '  1. Auth',
      '     └─ Specification (In-Progress)',
      '',
      '  2. Dark Mode',
      '     └─ Discussion (In-Progress)',
      '',
      '1 completed, 1 cancelled.',
      '',
      "=== MENU: selection (emit verbatim as markdown only at the select step, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      'Which feature would you like to continue?',
      '',
      '- **`1`** — Continue "Auth" — specification (in-progress)',
      '- **`2`** — Continue "Dark Mode" — discussion (in-progress)',
      '- **`3`** — View completed & cancelled features',
      "- **`m`/`manage`** — Manage a feature's lifecycle",
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
      '',
    ].join('\n'));
  });

  it('shows (last phase: none) for a closed feature with nothing completed', () => {
    createManifest(dir, 'never-started', { work_type: 'feature', status: 'cancelled' });
    const out = format(discover(dir));
    assert.ok(out.includes('  never-started (last phase: none)'));
  });

  it('carries no completed_phases, seeds, or imports clauses — the view verb owns those', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
      imports: [{ path: 'imports/seed.md', imported_at: '2026-05-10T10:00:00Z' }],
      seeds: [{ path: 'seeds/2026-03-18-x.md', source: 'inbox:idea', seeded_at: '2026-05-10T10:00:00Z' }],
    });
    const out = format(discover(dir));
    assert.ok(!out.includes('[completed:'));
    assert.ok(!out.includes('imports'));
    assert.ok(!out.includes('seed'));
    assert.ok(!out.includes('summary:'));
  });
});

describe('workflow-continue-feature CLI dispatch', () => {
  const GATEWAY = path.join(__dirname, '../../skills/workflow-continue-feature/scripts/gateway.cjs');
  const USAGE = 'Usage: gateway.cjs | gateway.cjs view {work_unit}\n';

  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function run(args) {
    return spawnSync('node', [GATEWAY, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('bare call still renders the index byte-identically', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const res = run([]);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout, format(discover(dir)));
  });

  it('view {work_unit} still answers the sectioned snapshot', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const res = run(['view', 'auth']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.ok(res.stdout.includes('=== DATA'));
    assert.ok(res.stdout.includes('=== DISPLAY'));
    assert.ok(res.stdout.includes('=== MENU'));
  });

  it('a bare positional errors instead of rendering the index', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const res = run(['auth']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "auth"\n' + USAGE);
  });

  it('an unknown verb errors with usage', () => {
    const res = run(['veiw', 'auth']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "veiw"\n' + USAGE);
  });

  it('view with excess positionals errors with usage', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const res = run(['view', 'auth', 'extra']);
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
