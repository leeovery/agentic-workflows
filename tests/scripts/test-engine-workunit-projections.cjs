'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { activeWorkUnit, typeConfig } = require('../../skills/leeway-engine/scripts/domain/workunit-detail.cjs');
const { workUnitStatus, workUnitMenu, workUnitData, revisitPhasesSection } = require('../../skills/leeway-engine/scripts/domain/projections/workunit.cjs');

// Golden tests: byte-exact expected strings for the work-unit status display
// and proceed/revisit menu, across the three single-topic types. Fixtures go
// through real manifests in temp dirs (the same shapes the discovery tests
// produce).

/** A feature's build begun by its cut, its one phase in flight. */
const BUILDING = { build: { position: 'auto' }, cut: { phases: [{ name: 'One', scenarios: [], sections: ['1'], relies_on: [] }] } };

function unitOf(dir, type, name) {
  const found = activeWorkUnit(dir, name);
  assert.strictEqual(found.type, type);
  return found.unit;
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
      'MATERIAL',
      '  · seeded from the inbox',
      '  · 2 imports',
      '',
      'PIPELINE (feature)',
      '  ├─ ✓ Discussion       [completed]',
      '  └─ ◐ Specification    [in-progress]',
      '',
    ].join('\n'));
  });

  it('feature: fresh unit renders a single ready row and no callouts', () => {
    createManifest(dir, 'dark-mode', {});
    assert.strictEqual(workUnitStatus('feature', unitOf(dir, 'feature', 'dark-mode')), [
      'PIPELINE (feature)',
      '  └─ → Discussion    [ready]',
      '',
    ].join('\n'));
  });

  it('feature: singular import callout', () => {
    createManifest(dir, 'dark-mode', { imports: [{ path: 'imports/a.md' }] });
    const out = workUnitStatus('feature', unitOf(dir, 'feature', 'dark-mode'));
    assert.ok(out.startsWith('MATERIAL\n  · 1 import\n'));
    assert.ok(!out.includes('seeded from the inbox'));
  });

  it('feature: no seeds and no imports renders no MATERIAL block at all', () => {
    createManifest(dir, 'plain', {});
    const out = workUnitStatus('feature', unitOf(dir, 'feature', 'plain'));
    assert.ok(out.startsWith('PIPELINE (feature)'), out);
    assert.ok(!out.includes('MATERIAL'), out);
  });

  it('feature: an evidence wait renders the experiment slot in flight, never ready', () => {
    // computeNextPhase says `experiment (awaiting evidence)` — a route into a
    // phase already alive, so the row reads ◐ [in-progress], never → [ready].
    createManifest(dir, 'pay', {
      phases: {
        experiment: { items: { pay: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'conceived' } } } } },
        discussion: { items: { pay: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      },
    });
    const unit = unitOf(dir, 'feature', 'pay');
    assert.strictEqual(unit.phase_label, 'experiment (awaiting evidence)');
    assert.strictEqual(workUnitStatus('feature', unit), [
      'PIPELINE (feature)',
      '  ├─ ◐ Experiment    [in-progress]',
      '  └─ ◐ Discussion    [in-progress]',
      '',
    ].join('\n'));
  });

  it('feature: the continue row routes the waiting unit into the laboratory', () => {
    createManifest(dir, 'pay', {
      phases: {
        experiment: { items: { pay: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'conceived' } } } } },
        discussion: { items: { pay: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      },
    });
    const { keys } = workUnitMenu('feature', unitOf(dir, 'feature', 'pay'));
    assert.strictEqual(keys[0].action, 'continue');
    assert.strictEqual(keys[0].route, '/leeway-experiment-process feature pay');
    assert.strictEqual(keys[0].label, 'Proceed to experiment');
  });

  it('feature: neither the experiment phase, the decided discussion nor the concluded spec is a revisit candidate', () => {
    createManifest(dir, 'pay', {
      phases: {
        experiment: { items: { pay: { status: 'completed', experiments: { E1: { slug: 'x', status: 'concluded', verdict: 'held' } } } } },
        discussion: { items: { pay: { status: 'completed' } } },
        specification: { items: { pay: { status: 'completed' } } },
        planning: { items: { pay: { status: 'in-progress' } } },
      },
    });
    const { keys } = workUnitMenu('feature', unitOf(dir, 'feature', 'pay'));
    assert.deepStrictEqual(keys.filter((k) => k.action === 'revisit_phase').map((k) => k.phase), [],
      'a concluded verdict stands — a new spawn reopens the series — a decided discussion reopens by a message, and a concluded spec is never corrected');
  });

  it('feature: a decided discussion alone behind the next phase offers no revisit — a lone continue, no menu', () => {
    createManifest(dir, 'pay', { phases: { discussion: { items: { pay: { status: 'completed' } } } } });
    const menu = workUnitMenu('feature', unitOf(dir, 'feature', 'pay'));
    assert.strictEqual(menu.rendered, '');
    assert.deepStrictEqual(menu.keys.map((k) => [k.key, k.action, k.route]),
      [['y', 'continue', '/leeway-specification-process feature pay']]);
  });

  it('quick-fix: a flagged completed phase carries the cue, the ⚑ line, and takes next_phase', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'completed', reconcile_needed: 'scoping' } } },
      },
    });
    const unit = unitOf(dir, 'quick-fix', 'rename-api');
    assert.strictEqual(workUnitStatus('quick-fix', unit), [
      'PIPELINE (quick-fix)',
      '  ├─ ✓ Scoping           [completed]',
      '  └─ ✓ Implementation    [completed · input moved]',
      '',
      '  ⚑ Implementation input moved — scoping revised since it completed.',
      '',
    ].join('\n'));
    assert.strictEqual(unit.next_phase, 'implementation');
    assert.strictEqual(unit.phase_label, 'implementation (input moved — reconcile)');
    const menu = workUnitMenu('quick-fix', unit);
    assert.strictEqual(menu.keys[0].route, '/leeway-implementation-process quick-fix rename-api');
    assert.match(workUnitData('quick-fix', unit, menu), /^reconcile_pending: implementation \(scoping\)$/m);
  });

  it('bugfix: completed investigation and a ready next phase', () => {
    createManifest(dir, 'login-crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { 'login-crash': { status: 'completed' } } } },
    });
    assert.strictEqual(workUnitStatus('bugfix', unitOf(dir, 'bugfix', 'login-crash')), [
      'PIPELINE (bugfix)',
      '  ├─ ✓ Investigation    [completed]',
      '  └─ → Specification    [ready]',
      '',
    ].join('\n'));
  });

  it('quick-fix: in-progress scoping renders a single in-flight row', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } },
    });
    assert.strictEqual(workUnitStatus('quick-fix', unitOf(dir, 'quick-fix', 'rename-api')), [
      'PIPELINE (quick-fix)',
      '  └─ ◐ Scoping    [in-progress]',
      '',
    ].join('\n'));
  });

  it('quick-fix: finalising unit renders all-completed rows and the finalise callout', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'completed' } } },
        review: { items: { 'rename-api': { status: 'completed' } } },
      },
    });
    assert.strictEqual(workUnitStatus('quick-fix', unitOf(dir, 'quick-fix', 'rename-api')), [
      'PIPELINE (quick-fix)',
      '  ├─ ✓ Scoping           [completed]',
      '  ├─ ✓ Implementation    [completed]',
      '  └─ ✓ Review            [completed]',
      '',
      '  ⚑ All phases complete — ready to finalise.',
      '',
    ].join('\n'));
  });

  it('feature: a reopened discussion with messages waiting cues the pipeline row and DATA', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
        specification: { items: { 'auth-flow': { status: 'completed', reconcile_needed: 'discussion' } } },
      },
    });
    createFile(dir, '.leeway/auth-flow/topics/auth-flow/mail/001-retry-semantics.md', '### Retry semantics\n');
    const unit = unitOf(dir, 'feature', 'auth-flow');
    assert.deepStrictEqual(unit.mail_phases, ['discussion']);
    assert.match(workUnitStatus('feature', unit), /◐ Discussion +\[in-progress · mail waiting\]/);
    assert.match(workUnitStatus('feature', unit), /✓ Specification +\[completed · input moved\]/);
    assert.ok(workUnitData('feature', unit, workUnitMenu('feature', unit)).includes('\nmail_waiting: discussion\n'));
    // The drain retires it.
    fs.rmSync(path.join(dir, '.leeway/auth-flow/topics/auth-flow/mail/001-retry-semantics.md'));
    const drained = unitOf(dir, 'feature', 'auth-flow');
    assert.strictEqual(drained.mail_phases, undefined);
    assert.match(workUnitStatus('feature', drained), /◐ Discussion +\[in-progress\]/);
  });

  it('quick-fix: a reopened phase behind the completed last one is in-progress, never finalising — its continue resumes it', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'in-progress' } } },
        implementation: { items: { 'rename-api': { status: 'completed' } } },
        review: { items: { 'rename-api': { status: 'completed' } } },
      },
    });
    const unit = unitOf(dir, 'quick-fix', 'rename-api');
    assert.strictEqual(unit.finalising, false);
    assert.strictEqual(unit.next_phase, 'scoping');
    assert.strictEqual(unit.phase_label, 'scoping (in-progress)');
    assert.strictEqual(workUnitStatus('quick-fix', unit), [
      'PIPELINE (quick-fix)',
      '  ├─ ◐ Scoping           [in-progress]',
      '  ├─ ✓ Implementation    [completed]',
      '  └─ ✓ Review            [completed]',
      '',
    ].join('\n'));
    assert.deepStrictEqual(workUnitMenu('quick-fix', unit).keys.map((k) => [k.key, k.action, k.route]),
      [['y', 'continue', '/leeway-scoping-process quick-fix rename-api']], 'no finalise entry mid-revisit');
  });

  it('feature: every in-flight phase row renders, even beside the next one', () => {
    createManifest(dir, 'auth-flow', { ...BUILDING, phases: { discussion: { items: { 'auth-flow': { status: 'in-progress' } } } } });
    assert.strictEqual(workUnitStatus('feature', unitOf(dir, 'feature', 'auth-flow')), [
      'PIPELINE (feature)',
      '  ├─ ◐ Discussion        [in-progress]',
      '  ├─ ✓ Specification     [completed]',
      '  └─ ◐ Implementation    [in-progress]',
      '',
    ].join('\n'));
  });
});

describe('workunit projections: menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('feature: empty rendered menu and a lone continue key when nothing to revisit', () => {
    createManifest(dir, 'dark-mode', {});
    const menu = workUnitMenu('feature', unitOf(dir, 'feature', 'dark-mode'));
    assert.strictEqual(menu.rendered, '');
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.route]),
      [['y', 'continue', '/leeway-discussion-process feature dark-mode']]
    );
  });

  it('bugfix: the investigation is a revisit until the spec is written, and closed with every topic once it is', () => {
    createManifest(dir, 'login-crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { 'login-crash': { status: 'completed' } } } },
    });
    assert.deepStrictEqual(unitOf(dir, 'bugfix', 'login-crash').revisit, ['investigation']);
    createFile(dir, '.leeway/login-crash/spec.md', '# Login crash\n');
    assert.deepStrictEqual(unitOf(dir, 'bugfix', 'login-crash').revisit, []);
  });

  it('bugfix: routes carry the bugfix work_type argument', () => {
    createManifest(dir, 'login-crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { 'login-crash': { status: 'completed' } } } },
    });
    const menu = workUnitMenu('bugfix', unitOf(dir, 'bugfix', 'login-crash'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'Continuing "Login Crash" — *ready for specification*.',
      '',
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**     → Proceed to specification',
      '**`r/revisit`** → Revisit an earlier phase',
      '**`b/back`**    → Return to the start menu',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.phase || null, k.route]),
      [
        ['y', 'continue', null, '/leeway-specification-process bugfix login-crash'],
        ['r', 'revisit', null, null],
        ['b', 'back', null, null],
        ['1', 'revisit_phase', 'investigation', '/leeway-investigation-process bugfix login-crash'],
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
      'Continuing "Hotfix Logs" — *implementation (in-progress)*.',
      '',
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**     → Proceed to implementation',
      '**`r/revisit`** → Revisit an earlier phase',
      '**`b/back`**    → Return to the start menu',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.phase || null, k.route]),
      [
        ['y', 'continue', null, '/leeway-implementation-process quick-fix hotfix-logs'],
        ['r', 'revisit', null, null],
        ['b', 'back', null, null],
        ['1', 'revisit_phase', 'scoping', '/leeway-scoping-process quick-fix hotfix-logs'],
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
      [['y', 'continue', '/leeway-scoping-process quick-fix rename-api']]
    );
  });

  it('quick-fix: finalising unit gates on finalise, with every completed phase revisitable', () => {
    createManifest(dir, 'hotfix-logs', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'hotfix-logs': { status: 'completed' } } },
        implementation: { items: { 'hotfix-logs': { status: 'completed' } } },
        review: { items: { 'hotfix-logs': { status: 'completed' } } },
      },
    });
    const menu = workUnitMenu('quick-fix', unitOf(dir, 'quick-fix', 'hotfix-logs'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'Finalising "Hotfix Logs" — *pipeline complete*.',
      '',
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**     → Mark the work unit completed',
      '**`r/revisit`** → Revisit an earlier phase',
      '**`b/back`**    → Return to the start menu',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.phase || null, k.route]),
      [
        ['y', 'finalise', null, null],
        ['r', 'revisit', null, null],
        ['b', 'back', null, null],
        ['1', 'revisit_phase', 'scoping', '/leeway-scoping-process quick-fix hotfix-logs'],
        ['2', 'revisit_phase', 'implementation', '/leeway-implementation-process quick-fix hotfix-logs'],
        ['3', 'revisit_phase', 'review', '/leeway-review-process quick-fix hotfix-logs'],
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
      ...BUILDING,
      phases: { discussion: { items: { 'auth-flow': { status: 'completed' } } } },
      seeds: [{ path: 'seeds/2026-03-18-login-timeout.md', source: 'inbox:bug' }],
    });
    const unit = unitOf(dir, 'feature', 'auth-flow');
    const menu = workUnitMenu('feature', unit);
    assert.strictEqual(workUnitData('feature', unit, menu), [
      'work_unit: auth-flow',
      'work_type: feature',
      'next_phase: implementation',
      'phase_label: implementation (in-progress)',
      'finalising: false',
      'completed_phases: discussion, specification',
      'reconcile_pending: (none)',
      'mail_waiting: (none)',
      'revisit_available: false',
      'seeds_count: 1',
      'imports_count: 0',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  continue  auth-flow  → /leeway-implementation-process feature auth-flow',
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
      'reconcile_pending: (none)',
      'mail_waiting: (none)',
      'revisit_available: false',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  continue  login-crash  → /leeway-investigation-process bugfix login-crash',
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
      'reconcile_pending: (none)',
      'mail_waiting: (none)',
      'revisit_available: true',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  finalise  hotfix-logs  → (internal)',
      '  r  revisit  revisit  hotfix-logs  → (internal)',
      '  b  back  back  hotfix-logs  → (internal)',
      '  1  —  revisit_phase  hotfix-logs  → /leeway-scoping-process quick-fix hotfix-logs',
      '  2  —  revisit_phase  hotfix-logs  → /leeway-implementation-process quick-fix hotfix-logs',
      '  3  —  revisit_phase  hotfix-logs  → /leeway-review-process quick-fix hotfix-logs',
    ].join('\n'));
  });
});

describe('workunit domain: type registry', () => {
  it('throws loudly on an unknown work type', () => {
    assert.throws(() => typeConfig('epic'), /unknown work type "epic"/);
  });
});

describe('workunit projections: revisit phases section', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('pins the labelled section byte-for-byte', () => {
    assert.strictEqual(revisitPhasesSection(['scoping', 'implementation']), [
      "=== MENU: revisit phases (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which phase would you like to revisit?`**',
      '',
      '**`1`**      → Scoping — *completed*',
      '**`2`**      → Implementation — *completed*',
      '**`b/back`** → Return to the previous menu',
      '',
    ].join('\n'));
  });

  it('renders nothing when there is nothing to revisit', () => {
    assert.strictEqual(revisitPhasesSection([]), '');
    createManifest(dir, 'fresh', {});
    assert.deepStrictEqual(unitOf(dir, 'feature', 'fresh').revisit, []);
  });

  it('filters quick-fix candidates to the quick-fix pipeline', () => {
    createManifest(dir, 'hotfix', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { hotfix: { status: 'completed' } } },
        specification: { items: { hotfix: { status: 'completed' } } },
        planning: { items: { hotfix: { status: 'completed' } } },
        implementation: { items: { hotfix: { status: 'completed' } } },
      },
    });
    const unit = unitOf(dir, 'quick-fix', 'hotfix');
    assert.deepStrictEqual(unit.revisit, ['scoping', 'implementation']);
  });
});
