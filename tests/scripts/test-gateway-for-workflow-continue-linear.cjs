'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { activeWorkUnit } = require('../../skills/workflow-engine/scripts/domain/workunit-detail.cjs');
const { view } = require('../../skills/workflow-continue-linear/scripts/gateway.cjs');

/** One item per phase, all under the unit's own name. @param {string} name @param {string[]} phases @param {string} status @returns {object} */
function items(name, phases, status) {
  return Object.fromEntries(phases.map((phase) => [phase, { items: { [name]: { status } } }]));
}

describe('workflow-continue-linear discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('finds a unit of each single-topic type, its type read from its manifest', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    assert.deepStrictEqual(
      ['auth', 'crash', 'rename-api', 'caching'].map((name) => [activeWorkUnit(dir, name).type, activeWorkUnit(dir, name).unit.name]),
      [['feature', 'auth'], ['bugfix', 'crash'], ['quick-fix', 'rename-api'], ['cross-cutting', 'caching']],
    );
  });

  it('finds an active unit only — a completed or cancelled one is gone', () => {
    createManifest(dir, 'old', { work_type: 'feature', status: 'completed', phases: { review: { items: { old: { status: 'completed' } } } } });
    createManifest(dir, 'stopped', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { stopped: { status: 'completed' } } } } });
    assert.strictEqual(activeWorkUnit(dir, 'old'), null);
    assert.strictEqual(activeWorkUnit(dir, 'stopped'), null);
  });

  it('finds no epic and no name the project does not hold', () => {
    createManifest(dir, 'v1', { work_type: 'epic', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    assert.strictEqual(activeWorkUnit(dir, 'v1'), null);
    assert.strictEqual(activeWorkUnit(dir, 'ghost'), null);
  });

  it('surfaces a finished pipeline still in-progress as finalising, whatever the type', () => {
    for (const [type, phases] of /** @type {[string, string[]][]} */ ([
      ['feature', ['discussion', 'specification', 'planning', 'implementation', 'review']],
      ['bugfix', ['investigation', 'specification', 'planning', 'implementation', 'review']],
      ['quick-fix', ['scoping', 'implementation', 'review']],
      ['cross-cutting', ['discussion', 'specification']],
    ])) {
      const name = `done-${type}`;
      createManifest(dir, name, { work_type: type, phases: items(name, phases, 'completed') });
      const { unit } = activeWorkUnit(dir, name);
      assert.strictEqual(unit.next_phase, 'done', type);
      assert.strictEqual(unit.finalising, true, type);
      assert.strictEqual(unit.phase_label, 'pipeline complete', type);
    }
  });

  it('includes phase_label and completed_phases', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const { unit } = activeWorkUnit(dir, 'auth');
    assert.strictEqual(unit.phase_label, 'specification (in-progress)');
    assert.deepStrictEqual(unit.completed_phases, ['discussion']);
  });

  it('returns multiple completed phases in pipeline order', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        research: { items: { auth: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
        planning: { items: { auth: { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        research: { items: { caching: { status: 'completed' } } },
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'in-progress' } } },
      },
    });
    assert.deepStrictEqual(activeWorkUnit(dir, 'auth').unit.completed_phases, ['research', 'discussion', 'specification']);
    assert.deepStrictEqual(activeWorkUnit(dir, 'caching').unit.completed_phases, ['research', 'discussion']);
  });

  describe('edge cases', () => {
    it('a unit in review in-progress is found, never filtered as done', () => {
      for (const [type, phases] of /** @type {[string, string[]][]} */ ([
        ['feature', ['discussion', 'specification', 'planning', 'implementation']],
        ['bugfix', ['investigation', 'specification', 'planning', 'implementation']],
        ['quick-fix', ['scoping', 'implementation']],
      ])) {
        const name = `live-${type}`;
        createManifest(dir, name, { work_type: type, phases: { ...items(name, phases, 'completed'), review: { items: { [name]: { status: 'in-progress' } } } } });
        const { unit } = activeWorkUnit(dir, name);
        assert.strictEqual(unit.next_phase, 'review', type);
        assert.deepStrictEqual(unit.completed_phases, phases, type);
      }
    });

    it('counts only the type\'s own pipeline — research is no bugfix phase, discussion no quick-fix phase', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: {
          research: { items: { crash: { status: 'completed' } } },
          investigation: { items: { crash: { status: 'in-progress' } } },
        },
      });
      createManifest(dir, 'qf', {
        work_type: 'quick-fix',
        phases: {
          discussion: { items: { qf: { status: 'completed' } } },
          scoping: { items: { qf: { status: 'in-progress' } } },
        },
      });
      assert.deepStrictEqual(activeWorkUnit(dir, 'crash').unit.completed_phases, []);
      assert.deepStrictEqual(activeWorkUnit(dir, 'qf').unit.completed_phases, []);
    });
  });

  describe('seeds and imports', () => {
    it('a feature counts its seeds and imports — zero when the manifest tracks none', () => {
      createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
      const { unit } = activeWorkUnit(dir, 'auth');
      assert.strictEqual(unit.seeds_count, 0);
      assert.strictEqual(unit.imports_count, 0);
    });

    it('a feature reports the length of manifest.seeds[] and manifest.imports[]', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
        seeds: [{ path: 'seeds/2026-03-18-login-timeout.md', source: 'inbox:bug', seeded_at: '2026-05-10T10:00:00Z' }],
        imports: [
          { path: 'imports/seed-conversation.md', imported_at: '2026-05-10T10:00:00Z' },
          { path: 'imports/early-thoughts.md', imported_at: '2026-05-10T10:01:00Z' },
        ],
      });
      const { unit } = activeWorkUnit(dir, 'auth');
      assert.strictEqual(unit.seeds_count, 1);
      assert.strictEqual(unit.imports_count, 2);
    });

    it('the other types surface neither count', () => {
      createManifest(dir, 'crash', {
        work_type: 'bugfix',
        phases: { investigation: { items: { crash: { status: 'in-progress' } } } },
        seeds: [{ path: 'seeds/2026-03-18-crash.md', source: 'inbox:bug', seeded_at: '2026-05-10T10:00:00Z' }],
      });
      const { unit } = activeWorkUnit(dir, 'crash');
      assert.strictEqual(unit.seeds_count, undefined);
      assert.strictEqual(unit.imports_count, undefined);
    });
  });
});

describe('workflow-continue-linear view', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('pins the snapshot byte-exactly — DATA, TITLE, DISPLAY, and the menu with its way back', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
      seeds: [{ path: 'seeds/2026-03-18-auth.md', source: 'inbox:idea', seeded_at: '2026-05-10T10:00:00Z' }],
    });
    assert.strictEqual(view(dir, 'auth'), [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'work_unit: auth',
      'work_type: feature',
      'next_phase: specification',
      'phase_label: specification (in-progress)',
      'finalising: false',
      'completed_phases: discussion',
      'reconcile_pending: (none)',
      'triage_waiting: (none)',
      'revisit_available: true',
      'seeds_count: 1',
      'imports_count: 0',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  continue  auth  → /workflow-specification-process feature auth',
      '  r  revisit  revisit  auth  → (internal)',
      '  b  back  back  auth  → (internal)',
      '  1  —  revisit_phase  auth  → /workflow-discussion-process feature auth',
      '',
      '=== TITLE (emit verbatim as markdown (not a code block) — the view\'s chrome heading) ===',
      '# **`■ Auth`**',
      '',
      '=== DISPLAY (emit verbatim as a text code block (```text fence)) ===',
      'MATERIAL',
      '  · seeded from the inbox',
      '',
      'PIPELINE (feature)',
      '  ├─ ✓ Discussion       [completed]',
      '  └─ ◐ Specification    [in-progress]',
      '',
      '=== MENU (emit verbatim as markdown (not a code block)) ===',
      '· · · · · · · · · · · ·',
      'Continuing "Auth" — *specification (in-progress)*.',
      '',
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**     → Proceed to specification',
      '**`r/revisit`** → Revisit an earlier phase',
      '**`b/back`**    → Return to the start menu',
      '',
    ].join('\n'));
  });

  it('draws no MENU where there is nothing to revisit or finalise — the continue hands straight on', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    const out = view(dir, 'crash');
    assert.ok(out.includes('=== DATA'));
    assert.ok(out.includes('=== TITLE'));
    assert.ok(out.includes('=== DISPLAY'));
    assert.ok(out.includes('revisit_available: false'));
    assert.doesNotMatch(out, /^=== MENU/m, 'no gate, so no MENU section');
    assert.doesNotMatch(out, /\bback\b/, 'no menu, so no way back to offer');
    assert.ok(out.includes('  y  yes  continue  crash  → /workflow-investigation-process bugfix crash'));
  });

  it('routes each type by the work_type its manifest names', () => {
    for (const [name, type, done, next] of [
      ['crash', 'bugfix', 'investigation', 'specification'],
      ['typo', 'quick-fix', 'scoping', 'implementation'],
      ['logging', 'cross-cutting', 'discussion', 'specification'],
    ]) {
      createManifest(dir, name, { work_type: type, phases: { [done]: { items: { [name]: { status: 'completed' } } } } });
      const out = view(dir, name);
      assert.ok(out.includes(`work_type: ${type}\n`), out);
      assert.ok(out.includes(`  y  yes  continue  ${name}  → /workflow-${next}-process ${type} ${name}\n`), out);
      assert.ok(out.includes(`  1  —  revisit_phase  ${name}  → /workflow-${done}-process ${type} ${name}\n`), out);
      assert.ok(out.includes('**`b/back`**    → Return to the start menu'), out);
    }
  });

  it('a finalising unit gates on finalise beside the revisit and the way back', () => {
    createManifest(dir, 'typo', { work_type: 'quick-fix', phases: items('typo', ['scoping', 'implementation', 'review'], 'completed') });
    const out = view(dir, 'typo');
    assert.ok(out.includes('finalising: true\n'), out);
    assert.ok(out.includes('  y  yes  finalise  typo  → (internal)\n'), out);
    assert.match(out, /\*\*`y\/yes`\*\* +→ Mark the work unit completed\n\*\*`r\/revisit`\*\* → Revisit an earlier phase\n\*\*`b\/back`\*\* +→ Return to the start menu/);
  });

  for (const [label, seed] of /** @type {[string, (dir: string) => void][]} */ ([
    ['a name the project does not hold', () => {}],
    ['a unit closed since', (d) => createManifest(d, 'ghost', { work_type: 'feature', status: 'completed' })],
    ['an epic', (d) => createManifest(d, 'ghost', { work_type: 'epic' })],
  ])) {
    it(`answers the not-found terminal display for ${label}, no gate`, () => {
      seed(dir);
      assert.strictEqual(view(dir, 'ghost'), [
        '=== DATA (reason from this — never display or parse the sections below) ===',
        'work_unit: ghost',
        'error: no active work unit with this name',
        '=== DISPLAY: not found (emit verbatim as a text code block (```text fence), then STOP — terminal condition) ===',
        'No active work unit named "ghost" found.',
        '',
        'Run /workflow-start to see available work units or begin a new one.',
        '',
      ].join('\n'));
    });
  }
});

describe('workflow-continue-linear CLI dispatch', () => {
  const GATEWAY = path.join(__dirname, '../../skills/workflow-continue-linear/scripts/gateway.cjs');
  const USAGE = 'Usage: gateway.cjs view {work_unit}\n';

  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @param {string[]} args */
  function run(args) {
    return spawnSync('node', [GATEWAY, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('view {work_unit} answers the snapshot, byte-identical to view()', () => {
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'completed' } } } } });
    const res = run(['view', 'auth']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout, view(dir, 'auth'));
  });

  it('the bare call errors with usage — there is no index to render', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const res = run([]);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: a verb is required\n' + USAGE);
  });

  it('a bare positional errors instead of rendering anything', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const res = run(['auth']);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.strictEqual(res.stderr, 'gateway: unknown verb "auth"\n' + USAGE);
  });

  it('an unknown verb errors with usage — select among them, the unit always given', () => {
    for (const verb of ['veiw', 'select']) {
      const res = run([verb, 'auth']);
      assert.strictEqual(res.status, 1, verb);
      assert.strictEqual(res.stdout, '', verb);
      assert.strictEqual(res.stderr, `gateway: unknown verb "${verb}"\n` + USAGE, verb);
    }
  });

  it('view with excess positionals errors with usage', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
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
});
