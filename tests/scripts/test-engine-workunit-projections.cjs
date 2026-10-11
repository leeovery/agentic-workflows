'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { activeWorkUnit, typeConfig } = require('../../skills/workflow-engine/scripts/domain/workunit-detail.cjs');
const { workUnitStatus, workUnitMenu, workUnitData, revisitPhasesSection } = require('../../skills/workflow-engine/scripts/domain/projections/workunit.cjs');

// Golden tests: byte-exact expected strings for the work-unit status display
// and proceed/revisit menu, across all four single-topic types. Fixtures go
// through real manifests in temp dirs (the same shapes the discovery tests
// produce).

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
        research: { items: { pay: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
        experiment: { items: { pay: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'conceived' } } } } },
      },
    });
    const unit = unitOf(dir, 'feature', 'pay');
    assert.strictEqual(unit.phase_label, 'experiment (awaiting evidence)');
    assert.strictEqual(workUnitStatus('feature', unit), [
      'PIPELINE (feature)',
      '  ├─ ◐ Research      [in-progress]',
      '  └─ ◐ Experiment    [in-progress]',
      '',
    ].join('\n'));
  });

  it('feature: the continue row routes the waiting unit into the laboratory', () => {
    createManifest(dir, 'pay', {
      phases: {
        research: { items: { pay: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
        experiment: { items: { pay: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'conceived' } } } } },
      },
    });
    const { keys } = workUnitMenu('feature', unitOf(dir, 'feature', 'pay'));
    assert.strictEqual(keys[0].action, 'continue');
    assert.strictEqual(keys[0].route, '/workflow-experiment-process feature pay');
    assert.strictEqual(keys[0].label, 'Proceed to experiment');
  });

  it('feature: the experiment phase is never a revisit candidate', () => {
    createManifest(dir, 'pay', {
      phases: {
        research: { items: { pay: { status: 'completed' } } },
        experiment: { items: { pay: { status: 'completed', experiments: { E1: { slug: 'x', status: 'concluded', verdict: 'held' } } } } },
        discussion: { items: { pay: { status: 'in-progress' } } },
      },
    });
    const unit = unitOf(dir, 'feature', 'pay');
    const { keys } = workUnitMenu('feature', unit);
    assert.ok(keys.some((k) => k.action === 'revisit_phase' && k.phase === 'research'),
      'the completed research is revisitable');
    assert.ok(!keys.some((k) => k.action === 'revisit_phase' && k.phase === 'experiment'),
      'a concluded verdict stands — a new spawn is what reopens the series');
  });

  it('feature: a flagged completed phase carries the cue, the ⚑ line, and takes next_phase', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'completed', reconcile_needed: 'discussion' } } },
        planning: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    const unit = unitOf(dir, 'feature', 'auth-flow');
    assert.strictEqual(workUnitStatus('feature', unit), [
      'PIPELINE (feature)',
      '  ├─ ✓ Discussion       [completed]',
      '  ├─ ✓ Specification    [completed · input moved]',
      '  └─ ✓ Planning         [completed]',
      '',
      '  ⚑ Specification input moved — discussion revised since it completed.',
      '',
    ].join('\n'));
    assert.strictEqual(unit.next_phase, 'specification');
    assert.strictEqual(unit.phase_label, 'specification (input moved — reconcile)');
    const menu = workUnitMenu('feature', unit);
    assert.strictEqual(menu.keys[0].route, '/workflow-specification-process feature auth-flow');
    assert.match(workUnitData('feature', unit, menu), /^reconcile_pending: specification \(discussion\)$/m);
  });

  it('feature: a completed specification staled with no flag cues the same way — one reading for the route and the display', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
        specification: { items: { 'auth-flow': { status: 'completed', sources: { 'auth-flow': { status: 'stale' } } } } },
        planning: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    const unit = unitOf(dir, 'feature', 'auth-flow');
    assert.match(workUnitStatus('feature', unit), /✓ Specification +\[completed · input moved\]/);
    assert.match(workUnitStatus('feature', unit), /⚑ Specification input moved — reconcile at next entry\./,
      'a staled row names no revised upstream, so the line takes the general voice');
    assert.strictEqual(unit.next_phase, 'discussion', 'the earliest in-flight phase still owns the next action');
    const menu = workUnitMenu('feature', unit);
    assert.match(workUnitData('feature', unit, menu), /^reconcile_pending: specification \(true\)$/m);
    // Re-incorporating the row settles the record: no cue, no ⚑, no row.
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
        specification: { items: { 'auth-flow': { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } } } },
        planning: { items: { 'auth-flow': { status: 'completed' } } },
      },
    });
    const settled = unitOf(dir, 'feature', 'auth-flow');
    assert.doesNotMatch(workUnitStatus('feature', settled), /input moved/);
    assert.match(workUnitData('feature', settled, workUnitMenu('feature', settled)), /^reconcile_pending: \(none\)$/m);
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

  it('cross-cutting: two completed phases and a ready terminal phase', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        research: { items: { caching: { status: 'completed' } } },
        discussion: { items: { caching: { status: 'completed' } } },
      },
    });
    assert.strictEqual(workUnitStatus('cross-cutting', unitOf(dir, 'cross-cutting', 'caching')), [
      'PIPELINE (cross-cutting)',
      '  ├─ ✓ Research         [completed]',
      '  ├─ ✓ Discussion       [completed]',
      '  └─ → Specification    [ready]',
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
      'PIPELINE (cross-cutting)',
      '  ├─ ✓ Discussion       [completed]',
      '  └─ ✓ Specification    [completed]',
      '',
      '  ⚑ All phases complete — ready to finalise.',
      '',
    ].join('\n'));
  });

  it('feature: a reopened discussion with messages waiting cues the pipeline row, the proceed gate, and DATA', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        research: { items: { 'auth-flow': { status: 'completed' } } },
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
        specification: { items: { 'auth-flow': { status: 'completed', reconcile_needed: 'discussion' } } },
      },
    });
    createFile(dir, '.workflows/auth-flow/discussion/.mailbox/auth-flow/001-retry-semantics.md', '### Retry semantics\n');
    const unit = unitOf(dir, 'feature', 'auth-flow');
    assert.deepStrictEqual(unit.mail_phases, ['discussion']);
    assert.match(workUnitStatus('feature', unit), /◐ Discussion +\[in-progress · mail waiting\]/);
    assert.match(workUnitStatus('feature', unit), /✓ Specification +\[completed · input moved\]/);
    const menu = workUnitMenu('feature', unit);
    assert.ok(menu.rendered.includes('Continuing "Auth Flow" — *discussion (in-progress)* · mail waiting.'), menu.rendered);
    assert.ok(workUnitData('feature', unit, menu).includes('\nmail_waiting: discussion\n'));
    // The drain retires it.
    fs.rmSync(path.join(dir, '.workflows/auth-flow/discussion/.mailbox/auth-flow/001-retry-semantics.md'));
    const drained = unitOf(dir, 'feature', 'auth-flow');
    assert.strictEqual(drained.mail_phases, undefined);
    assert.match(workUnitStatus('feature', drained), /◐ Discussion +\[in-progress\]/);
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
      'PIPELINE (feature)',
      '  ├─ ◐ Discussion        [in-progress]',
      '  ├─ ✓ Specification     [completed]',
      '  ├─ ✓ Planning          [completed]',
      '  ├─ ✓ Implementation    [completed]',
      '  └─ ✓ Review            [completed]',
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
      'PIPELINE (feature)',
      '  ├─ ◐ Discussion        [in-progress]',
      '  ├─ ✓ Specification     [completed]',
      '  ├─ ◐ Planning          [in-progress]',
      '  ├─ ✓ Implementation    [completed]',
      '  └─ ✓ Review            [completed]',
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
      'Continuing "Auth Flow" — *specification (in-progress)*.',
      '',
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**     → Proceed to specification',
      '**`r/revisit`** → Revisit an earlier phase',
      '**`b/back`**    → Return to the start menu',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.topic, k.phase || null, k.route]),
      [
        ['y', 'continue', 'auth-flow', null, '/workflow-specification-process feature auth-flow'],
        ['r', 'revisit', 'auth-flow', null, null],
        ['b', 'back', 'auth-flow', null, null],
        ['1', 'revisit_phase', 'auth-flow', 'discussion', '/workflow-discussion-process feature auth-flow'],
      ]
    );
  });

  it('feature: empty rendered menu and a lone continue key when nothing to revisit', () => {
    createManifest(dir, 'dark-mode', {});
    const menu = workUnitMenu('feature', unitOf(dir, 'feature', 'dark-mode'));
    assert.strictEqual(menu.rendered, '');
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.route]),
      [['y', 'continue', '/workflow-discussion-process feature dark-mode']]
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
        ['y', 'continue', null, '/workflow-specification-process bugfix login-crash'],
        ['r', 'revisit', null, null],
        ['b', 'back', null, null],
        ['1', 'revisit_phase', 'investigation', '/workflow-investigation-process bugfix login-crash'],
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
        ['y', 'continue', null, '/workflow-implementation-process quick-fix hotfix-logs'],
        ['r', 'revisit', null, null],
        ['b', 'back', null, null],
        ['1', 'revisit_phase', 'scoping', '/workflow-scoping-process quick-fix hotfix-logs'],
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
      [['y', 'continue', '/workflow-scoping-process quick-fix rename-api']]
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
      'Finalising "Auth Flow" — *pipeline complete*.',
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
        ['1', 'revisit_phase', 'discussion', '/workflow-discussion-process feature auth-flow'],
        ['2', 'revisit_phase', 'specification', '/workflow-specification-process feature auth-flow'],
        ['3', 'revisit_phase', 'planning', '/workflow-planning-process feature auth-flow'],
        ['4', 'revisit_phase', 'implementation', '/workflow-implementation-process feature auth-flow'],
        ['5', 'revisit_phase', 'review', '/workflow-review-process feature auth-flow'],
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
      [['y', 'continue', '/workflow-discussion-process feature auth-flow']]
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
      'Continuing "Caching" — *ready for specification*.',
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
        ['y', 'continue', null, '/workflow-specification-process cross-cutting caching'],
        ['r', 'revisit', null, null],
        ['b', 'back', null, null],
        ['1', 'revisit_phase', 'research', '/workflow-research-process cross-cutting caching'],
        ['2', 'revisit_phase', 'discussion', '/workflow-discussion-process cross-cutting caching'],
      ]
    );
  });
});

describe('workunit projections: a promoted unit routes to its moved discussions by name', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** A reactivated cross-cutting unit promoted with two discussions, neither named after it. @param {Record<string, any>} [overrides] */
  function promoted(overrides = {}) {
    createManifest(dir, 'fees', {
      work_type: 'cross-cutting',
      source_work_unit: 'billing',
      source_topic: 'fees',
      phases: {
        discussion: { items: { 'fee-rules': { status: 'completed' }, 'fee-display': { status: 'completed' }, ...overrides.discussion } },
        specification: { items: { fees: {
          status: 'completed',
          sources: { 'fee-rules': { status: 'incorporated' }, 'fee-display': { status: 'incorporated' } },
          ...overrides.specification,
        } } },
      },
    });
    return unitOf(dir, 'cross-cutting', 'fees');
  }

  it('offers one revisit entry per moved discussion, each route naming it, the specification by the unit alone', () => {
    const menu = workUnitMenu('cross-cutting', promoted());
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.topic, k.phase || null, k.route]),
      [
        ['y', 'finalise', 'fees', null, null],
        ['r', 'revisit', 'fees', null, null],
        ['b', 'back', 'fees', null, null],
        ['1', 'revisit_phase', 'fee-rules', 'discussion', '/workflow-discussion-process cross-cutting fees fee-rules'],
        ['2', 'revisit_phase', 'fee-display', 'discussion', '/workflow-discussion-process cross-cutting fees fee-display'],
        ['3', 'revisit_phase', 'fees', 'specification', '/workflow-specification-process cross-cutting fees'],
      ]
    );
  });

  it('names each moved discussion on its revisit row', () => {
    assert.strictEqual(revisitPhasesSection(promoted().revisit), [
      "=== MENU: revisit phases (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which phase would you like to revisit?`**',
      '',
      '**`1`**      → Discussion "Fee Rules" — *completed*',
      '**`2`**      → Discussion "Fee Display" — *completed*',
      '**`3`**      → Specification — *completed*',
      '**`b/back`** → Return to the previous menu',
      '',
    ].join('\n'));
  });

  it('continues into the moved discussion in flight, by name', () => {
    const unit = promoted({ discussion: { 'fee-rules': { status: 'in-progress' } } });
    assert.strictEqual(unit.next_phase, 'discussion');
    assert.strictEqual(unit.next_topic, 'fee-rules');
    assert.strictEqual(workUnitMenu('cross-cutting', unit).keys[0].route, '/workflow-discussion-process cross-cutting fees fee-rules');
  });

  it('cues a message waiting on a moved discussion as mail waiting', () => {
    assert.strictEqual(promoted().mail_phases, undefined);
    createFile(dir, '.workflows/fees/discussion/.mailbox/fee-display/001-rounding.md', '# Rounding\n');
    const unit = unitOf(dir, 'cross-cutting', 'fees');
    assert.deepStrictEqual(unit.mail_phases, ['discussion']);
    assert.match(workUnitStatus('cross-cutting', unit), /Discussion +\[completed\]/);
    assert.match(workUnitMenu('cross-cutting', unit).rendered, /· mail waiting\./);
  });

  it('continues into a parked stub by name where nothing is in flight in the phase', () => {
    createManifest(dir, 'fees', {
      work_type: 'cross-cutting',
      phases: {
        research: { items: { 'fee-rules': { status: 'unstarted' } } },
        discussion: { items: { 'fee-rules': { status: 'in-progress' }, 'fee-display': { status: 'completed' } } },
        specification: { items: { fees: { status: 'completed', sources: { 'fee-rules': { status: 'stale' }, 'fee-display': { status: 'incorporated' } } } } },
      },
    });
    const parked = unitOf(dir, 'cross-cutting', 'fees');
    assert.strictEqual(parked.phase_label, 'research (parked — feeds the discussion)');
    assert.strictEqual(parked.next_topic, 'fee-rules');
    assert.strictEqual(workUnitMenu('cross-cutting', parked).keys[0].route, '/workflow-research-process cross-cutting fees fee-rules');
  });

  it('continues into the item whose input moved by name where nothing is in flight or parked', () => {
    const unit = promoted({ discussion: { 'fee-display': { status: 'completed', reconcile_needed: 'research' } } });
    assert.strictEqual(unit.phase_label, 'discussion (input moved — reconcile)');
    assert.strictEqual(unit.next_topic, 'fee-display');
    const [cont] = workUnitMenu('cross-cutting', unit).keys;
    assert.deepStrictEqual([cont.topic, cont.route], ['fee-display', '/workflow-discussion-process cross-cutting fees fee-display'],
      'the continue row names the item its route names');
  });

  it('continues into the specification\'s reconcile once the discussion concludes again — by the unit alone', () => {
    const unit = promoted({ specification: { reconcile_needed: 'discussion', sources: { 'fee-rules': { status: 'stale' }, 'fee-display': { status: 'incorporated' } } } });
    assert.strictEqual(unit.phase_label, 'specification (input moved — reconcile)');
    assert.strictEqual(unit.next_topic, null);
    const menu = workUnitMenu('cross-cutting', unit);
    assert.strictEqual(menu.keys[0].route, '/workflow-specification-process cross-cutting fees');
    assert.deepStrictEqual(menu.keys.filter((k) => k.action === 'revisit_phase').map((k) => k.route), [
      '/workflow-discussion-process cross-cutting fees fee-rules',
      '/workflow-discussion-process cross-cutting fees fee-display',
    ]);
  });

  it('routes a promoted unit whose one discussion carries its name exactly as any unit', () => {
    createManifest(dir, 'naming', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { naming: { status: 'completed' } } },
        specification: { items: { naming: { status: 'completed', sources: { naming: { status: 'incorporated' } } } } },
      },
    });
    const unit = unitOf(dir, 'cross-cutting', 'naming');
    assert.deepStrictEqual(unit.revisit, [{ phase: 'discussion', topic: null }, { phase: 'specification', topic: null }]);
    assert.deepStrictEqual(workUnitMenu('cross-cutting', unit).keys.filter((k) => k.route).map((k) => k.route), [
      '/workflow-discussion-process cross-cutting naming',
      '/workflow-specification-process cross-cutting naming',
    ]);
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
      'reconcile_pending: (none)',
      'mail_waiting: (none)',
      'revisit_available: true',
      'seeds_count: 1',
      'imports_count: 0',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  continue  auth-flow  → /workflow-specification-process feature auth-flow',
      '  r  revisit  revisit  auth-flow  → (internal)',
      '  b  back  back  auth-flow  → (internal)',
      '  1  —  revisit_phase  auth-flow  → /workflow-discussion-process feature auth-flow',
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
      '  y  yes  continue  login-crash  → /workflow-investigation-process bugfix login-crash',
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
      '  1  —  revisit_phase  hotfix-logs  → /workflow-scoping-process quick-fix hotfix-logs',
      '  2  —  revisit_phase  hotfix-logs  → /workflow-implementation-process quick-fix hotfix-logs',
      '  3  —  revisit_phase  hotfix-logs  → /workflow-review-process quick-fix hotfix-logs',
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

  it('mirrors the revisit_phase keys for a mid-pipeline feature', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'completed' } } },
        planning: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
    });
    const unit = unitOf(dir, 'feature', 'auth-flow');
    assert.deepStrictEqual(unit.revisit, [{ phase: 'discussion', topic: null }, { phase: 'specification', topic: null }]);
  });

  it('pins the labelled section byte-for-byte', () => {
    assert.strictEqual(revisitPhasesSection([{ phase: 'discussion', topic: null }, { phase: 'specification', topic: null }]), [
      "=== MENU: revisit phases (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which phase would you like to revisit?`**',
      '',
      '**`1`**      → Discussion — *completed*',
      '**`2`**      → Specification — *completed*',
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
    assert.deepStrictEqual(unit.revisit, [{ phase: 'scoping', topic: null }, { phase: 'implementation', topic: null }]);
  });
});
