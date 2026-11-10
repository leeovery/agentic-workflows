'use strict';

// ---------------------------------------------------------------------------
// The linear continue menu's projections (leeway-engine/scripts/domain/
// projections/workunit.cjs, read through workunit-detail.cjs): a
// single-topic unit's status display, its proceed and revisit menu, its
// data body and its revisit-phases section, across the feature, the bugfix
// and the quick-fix; and the type registry they read. Each a golden of the
// screen whole.
//
// Layer: verb, each projection called in process on the unit as
// `activeWorkUnit` reads it. World: the project world (`setupFixture`),
// copied for each test, each unit's manifest written by hand.
// ---------------------------------------------------------------------------

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

/** A quick-fix's fixes begun: its entry's record of their phase written. */
const BEGUN = { began: '2026-06-03T09:00:00Z' };

function unitOf(dir, type, name) {
  const found = activeWorkUnit(dir, name);
  assert.strictEqual(found.type, type);
  return found.unit;
}

describe('workunit projections: status display', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('feature: the seed callout, completed and in-progress pipeline rows', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
      seeds: [{ path: 'seeds/2026-03-18-login-timeout.md', source: 'inbox:bug' }],
    });
    assert.strictEqual(workUnitStatus('feature', unitOf(dir, 'feature', 'auth-flow')), [
      'MATERIAL',
      '  · seeded from the inbox',
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

  it('feature: no seeds renders no MATERIAL block at all', () => {
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

  it('19.5.14: a quick-fix\'s pipeline is its fixes, ready before they begin and in flight once begun, and its review once asked for', () => {
    const statusOf = (/** @type {object} */ data) => {
      createManifest(dir, 'rename-api', { work_type: 'quick-fix', ...data });
      return workUnitStatus('quick-fix', unitOf(dir, 'quick-fix', 'rename-api'));
    };

    assert.deepStrictEqual([statusOf({}), statusOf({ fixes: BEGUN }), statusOf({ fixes: { ...BEGUN, review_asked: '2026-06-03T10:00:00Z' } })], [
      ['PIPELINE (quick-fix)', '  └─ → Implementation    [ready]', ''].join('\n'),
      ['PIPELINE (quick-fix)', '  └─ ◐ Implementation    [in-progress]', ''].join('\n'),
      ['PIPELINE (quick-fix)', '  ├─ ◐ Implementation    [in-progress]', '  └─ ◐ Review            [in-progress]', ''].join('\n'),
    ]);
  });

  it('feature: a discussion with messages waiting cues the pipeline row and DATA', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
    });
    createFile(dir, '.leeway/auth-flow/topics/auth-flow/mail/001-retry-semantics.md', '### Retry semantics\n');
    const unit = unitOf(dir, 'feature', 'auth-flow');
    assert.deepStrictEqual(unit.mail_phases, ['discussion']);
    assert.match(workUnitStatus('feature', unit), /◐ Discussion +\[in-progress · mail waiting\]/);
    assert.ok(workUnitData('feature', unit, workUnitMenu('feature', unit)).includes('\nmail_waiting: discussion\n'));
    // The drain retires it.
    fs.rmSync(path.join(dir, '.leeway/auth-flow/topics/auth-flow/mail/001-retry-semantics.md'));
    const drained = unitOf(dir, 'feature', 'auth-flow');
    assert.strictEqual(drained.mail_phases, undefined);
    assert.match(workUnitStatus('feature', drained), /◐ Discussion +\[in-progress\]/);
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

  it('quick-fix: its continue carries on in the quick-fix\'s skill, ready or begun, and in the review\'s once asked for, with no revisit', () => {
    const keysOf = (/** @type {object} */ data) => {
      createManifest(dir, 'hotfix-logs', { work_type: 'quick-fix', ...data });
      const menu = workUnitMenu('quick-fix', unitOf(dir, 'quick-fix', 'hotfix-logs'));
      assert.strictEqual(menu.rendered, '');
      return menu.keys.map((k) => [k.key, k.action, k.route]);
    };

    assert.deepStrictEqual([keysOf({}), keysOf({ fixes: BEGUN }), keysOf({ fixes: { ...BEGUN, review_asked: '2026-06-03T10:00:00Z' } })], [
      [['y', 'continue', '/leeway-quick-fix-process quick-fix hotfix-logs']],
      [['y', 'continue', '/leeway-quick-fix-process quick-fix hotfix-logs']],
      [['y', 'continue', '/leeway-review-process quick-fix hotfix-logs']],
    ]);
  });

  it('P12: a quick-fix its old scoping made waits on the migration\'s cut, with no route into its work', () => {
    createManifest(dir, 'hotfix-logs', {
      work_type: 'quick-fix',
      phases: {
        planning: { items: { 'hotfix-logs': { status: 'completed' } } },
        implementation: { items: { 'hotfix-logs': { status: 'in-progress' } } },
      },
    });
    const menu = workUnitMenu('quick-fix', unitOf(dir, 'quick-fix', 'hotfix-logs'));

    assert.deepStrictEqual([menu.rendered.split('\n')[1], menu.keys.map((k) => [k.key, k.action])], [
      'hotfix-logs was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it',
      [['b', 'back']],
    ]);
  });

});

describe('workunit projections: data body', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('feature: flags include the seed count and the ACTIONS table carries routes', () => {
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
      'completed_phases: discussion, specification',
      'mail_waiting: (none)',
      'revisit_available: false',
      'seeds_count: 1',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  continue  auth-flow  → /leeway-implementation-process feature auth-flow',
    ].join('\n'));
  });

  it('bugfix: no seed flag and a false revisit flag on a fresh unit', () => {
    createManifest(dir, 'login-crash', { work_type: 'bugfix' });
    const unit = unitOf(dir, 'bugfix', 'login-crash');
    const menu = workUnitMenu('bugfix', unit);
    assert.strictEqual(workUnitData('bugfix', unit, menu), [
      'work_unit: login-crash',
      'work_type: bugfix',
      'next_phase: investigation',
      'phase_label: ready for investigation',
      'completed_phases: (none)',
      'mail_waiting: (none)',
      'revisit_available: false',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  continue  login-crash  → /leeway-investigation-process bugfix login-crash',
    ].join('\n'));
  });

  it('quick-fix: its fixes begun, in flight, its continue into the quick-fix\'s skill', () => {
    createManifest(dir, 'hotfix-logs', { work_type: 'quick-fix', fixes: BEGUN });
    const unit = unitOf(dir, 'quick-fix', 'hotfix-logs');
    const menu = workUnitMenu('quick-fix', unit);
    assert.strictEqual(workUnitData('quick-fix', unit, menu), [
      'work_unit: hotfix-logs',
      'work_type: quick-fix',
      'next_phase: implementation',
      'phase_label: implementation (in-progress)',
      'completed_phases: (none)',
      'mail_waiting: (none)',
      'revisit_available: false',
      'ACTIONS (key  word  action  topic  → route):',
      '  y  yes  continue  hotfix-logs  → /leeway-quick-fix-process quick-fix hotfix-logs',
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
    assert.strictEqual(revisitPhasesSection(['investigation', 'implementation']), [
      "=== MENU: revisit phases (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which phase would you like to revisit?`**',
      '',
      '**`1`**      → Investigation — *completed*',
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
});
