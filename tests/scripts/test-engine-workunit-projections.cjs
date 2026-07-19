'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { workUnitDetail, typeConfig } = require('../../skills/workflow-engine/scripts/domain/workunit-detail.cjs');
const { workUnitStatus, workUnitMenu, workUnitData } = require('../../skills/workflow-engine/scripts/domain/projections/workunit.cjs');

// Golden tests: byte-exact expected strings for the work-unit status display
// and proceed/revisit menu, across all four single-topic types. Fixtures go
// through real manifests in temp dirs (the same shapes the discovery tests
// produce).

/** @param {string} title */
function boxOf(title) {
  return [
    '●───────────────────────────────────────────────●',
    `  ${title}`,
    '●───────────────────────────────────────────────●',
    '',
  ];
}

function unitOf(dir, type, name) {
  const detail = workUnitDetail(dir, type);
  return detail[typeConfig(type).resultKey].find((u) => u.name === name);
}

describe('workunit projections: status display', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('feature: seed/import callouts, completed and in-progress pipeline rows', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
      seeds: [{ path: 'seeds/2026-03-18-login-timeout.md', source: 'inbox:bug' }],
      imports: [{ path: 'imports/a.md' }, { path: 'imports/b.md' }],
    });
    assert.strictEqual(workUnitStatus('feature', unitOf(dir, 'feature', 'auth-flow')), [
      ...boxOf('Auth Flow'),
      '  · seeded from the inbox',
      '  · 2 imports',
      '',
      '  PIPELINE (feature)',
      '  ├─ ✓ Discussion [completed]',
      '  └─ ◐ Specification [in-progress]',
      '',
    ].join('\n'));
  });

  it('feature: fresh unit renders a single ready row and no callouts', () => {
    createManifest(dir, 'dark-mode', {});
    assert.strictEqual(workUnitStatus('feature', unitOf(dir, 'feature', 'dark-mode')), [
      ...boxOf('Dark Mode'),
      '  PIPELINE (feature)',
      '  └─ → Discussion [ready]',
      '',
    ].join('\n'));
  });

  it('feature: singular import callout', () => {
    createManifest(dir, 'dark-mode', { imports: [{ path: 'imports/a.md' }] });
    const out = workUnitStatus('feature', unitOf(dir, 'feature', 'dark-mode'));
    assert.ok(out.includes('\n  · 1 import\n'));
    assert.ok(!out.includes('seeded from the inbox'));
  });

  it('bugfix: completed investigation and a ready next phase', () => {
    createManifest(dir, 'login-crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { 'login-crash': { status: 'completed' } } } },
    });
    assert.strictEqual(workUnitStatus('bugfix', unitOf(dir, 'bugfix', 'login-crash')), [
      ...boxOf('Login Crash'),
      '  PIPELINE (bugfix)',
      '  ├─ ✓ Investigation [completed]',
      '  └─ → Specification [ready]',
      '',
    ].join('\n'));
  });

  it('quick-fix: in-progress scoping renders a single in-flight row', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } },
    });
    assert.strictEqual(workUnitStatus('quick-fix', unitOf(dir, 'quick-fix', 'rename-api')), [
      ...boxOf('Rename Api'),
      '  PIPELINE (quick-fix)',
      '  └─ ◐ Scoping [in-progress]',
      '',
    ].join('\n'));
  });

  it('cross-cutting: two completed phases and a ready terminal phase', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        research: { items: { caching: { status: 'completed' } } },
        discussion: { items: { caching: { status: 'completed' } } },
      },
    });
    assert.strictEqual(workUnitStatus('cross-cutting', unitOf(dir, 'cross-cutting', 'caching')), [
      ...boxOf('Caching'),
      '  PIPELINE (cross-cutting)',
      '  ├─ ✓ Research [completed]',
      '  ├─ ✓ Discussion [completed]',
      '  └─ → Specification [ready]',
      '',
    ].join('\n'));
  });

  it('cross-cutting: finalising unit renders all-completed rows and the finalise callout', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'completed' } } },
      },
    });
    assert.strictEqual(workUnitStatus('cross-cutting', unitOf(dir, 'cross-cutting', 'caching')), [
      ...boxOf('Caching'),
      '  PIPELINE (cross-cutting)',
      '  ├─ ✓ Discussion [completed]',
      '  └─ ✓ Specification [completed]',
      '',
      '  ⚑ All phases complete — ready to finalise.',
      '',
    ].join('\n'));
  });

  it('feature: a reopened phase behind a completed review is in-progress, never finalising', () => {
    // Review completed but discussion reopened: the unit is mid-revisit — the
    // discussion row renders in flight and the finalise callout stays away.
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
        specification: { items: { 'auth-flow': { status: 'completed' } } },
        planning: { items: { 'auth-flow': { status: 'completed' } } },
        implementation: { items: { 'auth-flow': { status: 'completed' } } },
        review: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    const unit = unitOf(dir, 'feature', 'auth-flow');
    assert.strictEqual(unit.finalising, false);
    assert.strictEqual(unit.next_phase, 'discussion');
    assert.strictEqual(unit.phase_label, 'discussion (in-progress)');
    assert.strictEqual(workUnitStatus('feature', unit), [
      ...boxOf('Auth Flow'),
      '  PIPELINE (feature)',
      '  ├─ ◐ Discussion [in-progress]',
      '  ├─ ✓ Specification [completed]',
      '  ├─ ✓ Planning [completed]',
      '  ├─ ✓ Implementation [completed]',
      '  └─ ✓ Review [completed]',
      '',
    ].join('\n'));
  });

  it('feature: every in-flight phase row renders, even beside the next one', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
        specification: { items: { 'auth-flow': { status: 'completed' } } },
        planning: { items: { 'auth-flow': { status: 'in-progress' } } },
        implementation: { items: { 'auth-flow': { status: 'completed' } } },
        review: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    assert.strictEqual(workUnitStatus('feature', unitOf(dir, 'feature', 'auth-flow')), [
      ...boxOf('Auth Flow'),
      '  PIPELINE (feature)',
      '  ├─ ◐ Discussion [in-progress]',
      '  ├─ ✓ Specification [completed]',
      '  ├─ ◐ Planning [in-progress]',
      '  ├─ ✓ Implementation [completed]',
      '  └─ ✓ Review [completed]',
      '',
    ].join('\n'));
  });
});

describe('workunit projections: menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('feature: renders the proceed/revisit gate byte-for-byte when a phase can be revisited', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
    });
    const menu = workUnitMenu('feature', unitOf(dir, 'feature', 'auth-flow'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'Continuing "Auth Flow" — specification (in-progress).',
      '',
      '- **`y`/`yes`** — Proceed to specification',
      '- **`r`/`revisit`** — Revisit an earlier phase',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.topic, k.phase || null, k.route]),
      [
        ['y', 'continue', 'auth-flow', null, '/workflow-specification-entry feature auth-flow'],
        ['r', 'revisit', 'auth-flow', null, null],
        ['1', 'revisit_phase', 'auth-flow', 'discussion', '/workflow-discussion-entry feature auth-flow'],
      ]
    );
  });

  it('feature: empty rendered menu and a lone continue key when nothing to revisit', () => {
    createManifest(dir, 'dark-mode', {});
    const menu = workUnitMenu('feature', unitOf(dir, 'feature', 'dark-mode'));
    assert.strictEqual(menu.rendered, '');
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.route]),
      [['y', 'continue', '/workflow-discussion-entry feature dark-mode']]
    );
  });

  it('bugfix: routes carry the bugfix work_type argument', () => {
    createManifest(dir, 'login-crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { 'login-crash': { status: 'completed' } } } },
    });
    const menu = workUnitMenu('bugfix', unitOf(dir, 'bugfix', 'login-crash'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'Continuing "Login Crash" — ready for specification.',
      '',
      '- **`y`/`yes`** — Proceed to specification',
      '- **`r`/`revisit`** — Revisit an earlier phase',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.phase || null, k.route]),
      [
        ['y', 'continue', null, '/workflow-specification-entry bugfix login-crash'],
        ['r', 'revisit', null, null],
        ['1', 'revisit_phase', 'investigation', '/workflow-investigation-entry bugfix login-crash'],
      ]
    );
  });

  it('quick-fix: routes carry the hyphenated quick-fix work_type argument', () => {
    createManifest(dir, 'hotfix-logs', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'hotfix-logs': { status: 'completed' } } },
        implementation: { items: { 'hotfix-logs': { status: 'in-progress' } } },
      },
    });
    const menu = workUnitMenu('quick-fix', unitOf(dir, 'quick-fix', 'hotfix-logs'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'Continuing "Hotfix Logs" — implementation (in-progress).',
      '',
      '- **`y`/`yes`** — Proceed to implementation',
      '- **`r`/`revisit`** — Revisit an earlier phase',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.phase || null, k.route]),
      [
        ['y', 'continue', null, '/workflow-implementation-entry quick-fix hotfix-logs'],
        ['r', 'revisit', null, null],
        ['1', 'revisit_phase', 'scoping', '/workflow-scoping-entry quick-fix hotfix-logs'],
      ]
    );
  });

  it('quick-fix: no revisit keys while the first phase is still in flight', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } },
    });
    const menu = workUnitMenu('quick-fix', unitOf(dir, 'quick-fix', 'rename-api'));
    assert.strictEqual(menu.rendered, '');
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.route]),
      [['y', 'continue', '/workflow-scoping-entry quick-fix rename-api']]
    );
  });

  it('feature: finalising unit gates on finalise, with every completed phase revisitable', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'completed' } } },
        planning: { items: { 'auth-flow': { status: 'completed' } } },
        implementation: { items: { 'auth-flow': { status: 'completed' } } },
        review: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    const menu = workUnitMenu('feature', unitOf(dir, 'feature', 'auth-flow'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'Finalising "Auth Flow" — pipeline complete.',
      '',
      '- **`y`/`yes`** — Mark the work unit completed',
      '- **`r`/`revisit`** — Revisit an earlier phase',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.phase || null, k.route]),
      [
        ['y', 'finalise', null, null],
        ['r', 'revisit', null, null],
        ['1', 'revisit_phase', 'discussion', '/workflow-discussion-entry feature auth-flow'],
        ['2', 'revisit_phase', 'specification', '/workflow-specification-entry feature auth-flow'],
        ['3', 'revisit_phase', 'planning', '/workflow-planning-entry feature auth-flow'],
        ['4', 'revisit_phase', 'implementation', '/workflow-implementation-entry feature auth-flow'],
        ['5', 'revisit_phase', 'review', '/workflow-review-entry feature auth-flow'],
      ]
    );
  });

  it('feature: a reopened phase behind a completed review continues into that phase, never finalise', () => {
    // `y` must resume the reopened discussion — a finalise entry here would
    // abandon the revisit.
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
        specification: { items: { 'auth-flow': { status: 'completed' } } },
        planning: { items: { 'auth-flow': { status: 'completed' } } },
        implementation: { items: { 'auth-flow': { status: 'completed' } } },
        review: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    const menu = workUnitMenu('feature', unitOf(dir, 'feature', 'auth-flow'));
    assert.ok(!menu.keys.some((k) => k.action === 'finalise'), 'no finalise entry mid-revisit');
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.route]),
      [['y', 'continue', '/workflow-discussion-entry feature auth-flow']]
    );
    assert.strictEqual(menu.rendered, '');
  });

  it('cross-cutting: numbers one revisit_phase entry per completed phase in pipeline order', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        research: { items: { caching: { status: 'completed' } } },
        discussion: { items: { caching: { status: 'completed' } } },
      },
    });
    const menu = workUnitMenu('cross-cutting', unitOf(dir, 'cross-cutting', 'caching'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'Continuing "Caching" — ready for specification.',
      '',
      '- **`y`/`yes`** — Proceed to specification',
      '- **`r`/`revisit`** — Revisit an earlier phase',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.phase || null, k.route]),
      [
        ['y', 'continue', null, '/workflow-specification-entry cross-cutting caching'],
        ['r', 'revisit', null, null],
        ['1', 'revisit_phase', 'research', '/workflow-research-entry cross-cutting caching'],
        ['2', 'revisit_phase', 'discussion', '/workflow-discussion-entry cross-cutting caching'],
      ]
    );
  });
});

describe('workunit projections: data body', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('feature: flags include seed/import counts and the ACTIONS table carries routes', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
      seeds: [{ path: 'seeds/2026-03-18-login-timeout.md', source: 'inbox:bug' }],
    });
    const unit = unitOf(dir, 'feature', 'auth-flow');
    const menu = workUnitMenu('feature', unit);
    assert.strictEqual(workUnitData('feature', unit, menu), [
      'work_unit: auth-flow',
      'work_type: feature',
      'next_phase: specification',
      'phase_label: specification (in-progress)',
      'finalising: false',
      'completed_phases: discussion',
      'revisit_available: true',
      'seeds_count: 1',
      'imports_count: 0',
      'ACTIONS (key  action  topic  → route):',
      '  y  continue  auth-flow  → /workflow-specification-entry feature auth-flow',
      '  r  revisit  auth-flow  → (internal)',
      '  1  revisit_phase  auth-flow  → /workflow-discussion-entry feature auth-flow',
    ].join('\n'));
  });

  it('bugfix: no seed/import flags and a false revisit flag on a fresh unit', () => {
    createManifest(dir, 'login-crash', { work_type: 'bugfix' });
    const unit = unitOf(dir, 'bugfix', 'login-crash');
    const menu = workUnitMenu('bugfix', unit);
    assert.strictEqual(workUnitData('bugfix', unit, menu), [
      'work_unit: login-crash',
      'work_type: bugfix',
      'next_phase: investigation',
      'phase_label: ready for investigation',
      'finalising: false',
      'completed_phases: (none)',
      'revisit_available: false',
      'ACTIONS (key  action  topic  → route):',
      '  y  continue  login-crash  → /workflow-investigation-entry bugfix login-crash',
    ].join('\n'));
  });

  it('quick-fix: finalising unit flags true and the finalise entry is internal', () => {
    createManifest(dir, 'hotfix-logs', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'hotfix-logs': { status: 'completed' } } },
        implementation: { items: { 'hotfix-logs': { status: 'completed' } } },
        review: { items: { 'hotfix-logs': { status: 'completed' } } },
      },
    });
    const unit = unitOf(dir, 'quick-fix', 'hotfix-logs');
    const menu = workUnitMenu('quick-fix', unit);
    assert.strictEqual(workUnitData('quick-fix', unit, menu), [
      'work_unit: hotfix-logs',
      'work_type: quick-fix',
      'next_phase: done',
      'phase_label: pipeline complete',
      'finalising: true',
      'completed_phases: scoping, implementation, review',
      'revisit_available: true',
      'ACTIONS (key  action  topic  → route):',
      '  y  finalise  hotfix-logs  → (internal)',
      '  r  revisit  hotfix-logs  → (internal)',
      '  1  revisit_phase  hotfix-logs  → /workflow-scoping-entry quick-fix hotfix-logs',
      '  2  revisit_phase  hotfix-logs  → /workflow-implementation-entry quick-fix hotfix-logs',
      '  3  revisit_phase  hotfix-logs  → /workflow-review-entry quick-fix hotfix-logs',
    ].join('\n'));
  });
});

describe('workunit domain: type registry', () => {
  it('throws loudly on an unknown work type', () => {
    assert.throws(() => typeConfig('epic'), /unknown work type "epic"/);
  });
});
