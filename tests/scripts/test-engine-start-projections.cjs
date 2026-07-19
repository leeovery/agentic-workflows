'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { startDetail } = require('../../skills/workflow-engine/scripts/domain/start.cjs');
const { startOverview, startMenu } = require('../../skills/workflow-engine/scripts/domain/projections/start.cjs');

// Golden tests: byte-exact expected strings for the workflow-start overview
// and menu projections. Fixtures go through real manifests and inbox files in
// temp dirs (the same shapes the discovery tests produce).

const BOX = [
  '●───────────────────────────────────────────────●',
  '  Workflow Overview',
  '●───────────────────────────────────────────────●',
  '',
];

/** All five type sections populated, plus inbox and completed/cancelled. */
function fullFixture(dir) {
  createManifest(dir, 'dark-mode', {
    phases: { discussion: { items: { 'dark-mode': { status: 'in-progress' } } } },
  });
  createManifest(dir, 'auth-flow', {
    phases: { discussion: { items: { 'auth-flow': { status: 'completed' } } } },
  });
  createManifest(dir, 'login-crash', { work_type: 'bugfix' });
  createManifest(dir, 'rename-api', {
    work_type: 'quick-fix',
    phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } },
  });
  createManifest(dir, 'caching', {
    work_type: 'cross-cutting',
    phases: { discussion: { items: { caching: { status: 'in-progress' } } } },
  });
  createManifest(dir, 'quiz-competition-v1', {
    work_type: 'epic',
    phases: {
      research: { items: { 'kitchen-hardware': { status: 'completed' } } },
      discussion: { items: { 'menu-admin': { status: 'in-progress' } } },
    },
  });
  createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
  createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
  createFile(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
  createFile(dir, '.workflows/.inbox/ideas/2026-06-02--dark-launch.md', '# Dark Launch\n');
  createFile(dir, '.workflows/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
  return startDetail(dir);
}

describe('start projections: overview', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('renders all five type sections, the inbox hint, and the counts line byte-for-byte', () => {
    assert.strictEqual(startOverview(fullFixture(dir)), [
      ...BOX,
      'Features:',
      '  1. Auth Flow',
      '     └─ Ready For Specification',
      '',
      '  2. Dark Mode',
      '     └─ Discussion (In-Progress)',
      '',
      'Bugfixes:',
      '  3. Login Crash',
      '     └─ Ready For Investigation',
      '',
      'Quick Fixes:',
      '  4. Rename Api',
      '     └─ Scoping (In-Progress)',
      '',
      'Cross-Cutting:',
      '  5. Caching',
      '     └─ Discussion (In-Progress)',
      '',
      'Epics:',
      '  6. Quiz Competition V1',
      '     └─ Research, Discussion',
      '',
      'Inbox: 2 ideas, 1 bug',
      '',
      '1 completed, 1 cancelled.',
      '',
    ].join('\n'));
  });

  it('renders a single populated section with no inbox and no counts line', () => {
    createManifest(dir, 'auth-flow', {});
    assert.strictEqual(startOverview(startDetail(dir)), [
      ...BOX,
      'Features:',
      '  1. Auth Flow',
      '     └─ Ready For Discussion',
      '',
    ].join('\n'));
  });

  it('numbers continuously across sections, skipping empty ones', () => {
    createManifest(dir, 'dark-mode', {});
    createManifest(dir, 'auth-flow', {});
    createManifest(dir, 'v1', { work_type: 'epic', phases: { research: { items: { exploration: { status: 'in-progress' } } } } });
    assert.strictEqual(startOverview(startDetail(dir)), [
      ...BOX,
      'Features:',
      '  1. Auth Flow',
      '     └─ Ready For Discussion',
      '',
      '  2. Dark Mode',
      '     └─ Ready For Discussion',
      '',
      'Epics:',
      '  3. V1',
      '     └─ Research',
      '',
    ].join('\n'));
  });

  it('pluralises the inbox hint per category and singularises one-item counts', () => {
    createManifest(dir, 'auth-flow', {});
    createFile(dir, '.workflows/.inbox/ideas/2026-06-01--one.md', '# One\n');
    createFile(dir, '.workflows/.inbox/quickfixes/2026-06-02--qf-a.md', '# A\n');
    createFile(dir, '.workflows/.inbox/quickfixes/2026-06-03--qf-b.md', '# B\n');
    const out = startOverview(startDetail(dir));
    assert.ok(out.includes('\nInbox: 1 idea, 2 quick-fixes\n'));
  });

  it('epic with no phase items falls back to its phase label', () => {
    createManifest(dir, 'fresh-epic', { work_type: 'epic' });
    assert.strictEqual(startOverview(startDetail(dir)), [
      ...BOX,
      'Epics:',
      '  1. Fresh Epic',
      '     └─ Ready For Discussion',
      '',
    ].join('\n'));
  });

  it('finalising unit renders the Finalising sub-row', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'completed' } } },
      },
    });
    assert.strictEqual(startOverview(startDetail(dir)), [
      ...BOX,
      'Cross-Cutting:',
      '  1. Caching',
      '     └─ Finalising — Pipeline Complete',
      '',
    ].join('\n'));
  });
});

describe('start projections: menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('renders continue entries then command options with the conditional i/v present', () => {
    const menu = startMenu(fullFixture(dir));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'What would you like to do?',
      '',
      '- **`1`** — Continue "Auth Flow" — feature, ready for specification',
      '- **`2`** — Continue "Dark Mode" — feature, discussion (in-progress)',
      '- **`3`** — Continue "Login Crash" — bugfix, ready for investigation',
      '- **`4`** — Continue "Rename Api" — quick-fix, scoping (in-progress)',
      '- **`5`** — Continue "Caching" — cross-cutting, discussion (in-progress)',
      '- **`6`** — Continue "Quiz Competition V1" — epic',
      '',
      '- **`s`/`start`** — Start something new (not sure what kind yet)',
      '- **`f`/`feature`** — Start new feature',
      '- **`e`/`epic`** — Start new epic',
      '- **`b`/`bugfix`** — Start new bugfix',
      '- **`q`/`quick-fix`** — Start new quick-fix',
      '- **`c`/`cross-cutting`** — Start new cross-cutting concern',
      '- **`i`/`inbox`** — View the inbox and start from an item',
      '- **`v`/`view`** — View completed & cancelled work units',
      '- **`m`/`manage`** — Manage a work unit\'s lifecycle',
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
    ].join('\n'));
  });

  it('omits i and v when there is no inbox and nothing completed or cancelled', () => {
    createManifest(dir, 'auth-flow', {});
    const menu = startMenu(startDetail(dir));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      'What would you like to do?',
      '',
      '- **`1`** — Continue "Auth Flow" — feature, ready for discussion',
      '',
      '- **`s`/`start`** — Start something new (not sure what kind yet)',
      '- **`f`/`feature`** — Start new feature',
      '- **`e`/`epic`** — Start new epic',
      '- **`b`/`bugfix`** — Start new bugfix',
      '- **`q`/`quick-fix`** — Start new quick-fix',
      '- **`c`/`cross-cutting`** — Start new cross-cutting concern',
      '- **`m`/`manage`** — Manage a work unit\'s lifecycle',
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
    ].join('\n'));
  });

  it('finalising unit gets a Finalise entry that still routes to its continue skill', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'completed' } } },
      },
    });
    const menu = startMenu(startDetail(dir));
    assert.ok(menu.rendered.includes('- **`1`** — Finalise "Caching" — cross-cutting, pipeline complete'));
    const entry = menu.keys.find((k) => k.key === '1');
    assert.strictEqual(entry.action, 'continue_work_unit');
    assert.strictEqual(entry.route, '/workflow-continue-cross-cutting caching');
  });

  it('shows v with cancelled-only work units', () => {
    createManifest(dir, 'auth-flow', {});
    createManifest(dir, 'dropped', { status: 'cancelled' });
    const { keys } = startMenu(startDetail(dir));
    assert.ok(keys.some((k) => k.key === 'v' && k.action === 'view_completed'));
    assert.ok(!keys.some((k) => k.key === 'i'));
  });

  it('keys carry actions, work types/units, routes, and pre_seeds', () => {
    const { keys } = startMenu(fullFixture(dir));
    assert.deepStrictEqual(
      keys.map((k) => [k.key, k.action, k.work_unit || null, k.route, k.pre_seed || null]),
      [
        ['1', 'continue_work_unit', 'auth-flow', '/workflow-continue-feature auth-flow', null],
        ['2', 'continue_work_unit', 'dark-mode', '/workflow-continue-feature dark-mode', null],
        ['3', 'continue_work_unit', 'login-crash', '/workflow-continue-bugfix login-crash', null],
        ['4', 'continue_work_unit', 'rename-api', '/workflow-continue-quickfix rename-api', null],
        ['5', 'continue_work_unit', 'caching', '/workflow-continue-cross-cutting caching', null],
        ['6', 'continue_work_unit', 'quiz-competition-v1', '/workflow-continue-epic quiz-competition-v1', null],
        ['s', 'start_new', null, null, 'none'],
        ['f', 'start_new', null, null, 'feature'],
        ['e', 'start_new', null, null, 'epic'],
        ['b', 'start_new', null, null, 'bugfix'],
        ['q', 'start_new', null, null, 'quick-fix'],
        ['c', 'start_new', null, null, 'cross-cutting'],
        ['i', 'view_inbox', null, null, null],
        ['v', 'view_completed', null, null, null],
        ['m', 'manage', null, null, null],
      ]
    );
    assert.deepStrictEqual(
      keys.filter((k) => k.action === 'continue_work_unit').map((k) => k.work_type),
      ['feature', 'feature', 'bugfix', 'quick-fix', 'cross-cutting', 'epic']
    );
  });
});
