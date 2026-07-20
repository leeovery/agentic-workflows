'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { startDetail } = require('../../skills/workflow-engine/scripts/domain/start.cjs');
const {
  startOverview,
  startMenu,
  emptyOverview,
  emptyMenu,
  inboxPickupView,
  archivedView,
  workingSetView,
  manageListView,
  manageUnitView,
  completedView,
} = require('../../skills/workflow-engine/scripts/domain/projections/start.cjs');
const { combinedInbox, workingSetDetail } = require('../../skills/workflow-engine/scripts/domain/inbox-set.cjs');
const { manageDetail } = require('../../skills/workflow-engine/scripts/domain/workunit-manage.cjs');

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

// ---------------------------------------------------------------------------
// Sub-view projections
// ---------------------------------------------------------------------------

const DOTS = '· · · · · · · · · · · ·';

describe('start projections: empty state', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('renders the bare empty overview and start menu with no inbox and no closed units', () => {
    const detail = startDetail(dir);
    assert.strictEqual(emptyOverview(detail), [
      ...BOX,
      'No active work found.',
      '',
    ].join('\n'));
    const menu = emptyMenu(detail);
    assert.strictEqual(menu.rendered, [
      DOTS,
      'What would you like to start?',
      '',
      "- **`s`/`start`** — Not sure what kind yet — describe it and we'll shape it",
      '- **`f`/`feature`** — Single topic: (research →) discussion → spec → plan → implement → review',
      '- **`e`/`epic`** — Multiple topics, multi-session, same pipeline per topic',
      '- **`b`/`bugfix`** — Investigation → spec → plan → implement → review',
      '- **`q`/`quick-fix`** — Scoping → implement → review (no formal planning)',
      '- **`c`/`cross-cutting`** — (Research →) discussion → spec (patterns or policies that inform other work)',
      '',
      'Select an option:',
      DOTS,
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.pre_seed || null]),
      [
        ['s', 'start_new', 'none'],
        ['f', 'start_new', 'feature'],
        ['e', 'start_new', 'epic'],
        ['b', 'start_new', 'bugfix'],
        ['q', 'start_new', 'quick-fix'],
        ['c', 'start_new', 'cross-cutting'],
      ]
    );
  });

  it('adds the counts line, singular inbox option, and view option when state has them', () => {
    createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
    createFile(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    const detail = startDetail(dir);
    assert.strictEqual(emptyOverview(detail), [
      ...BOX,
      'No active work found.',
      '',
      '1 completed, 1 cancelled.',
      '',
    ].join('\n'));
    const menu = emptyMenu(detail);
    assert.ok(menu.rendered.includes('- **`i`/`inbox`** — View the inbox and start from an item (1 item)'));
    assert.ok(menu.rendered.includes('- **`v`/`view`** — View completed & cancelled work units'));
    assert.deepStrictEqual(
      menu.keys.map((k) => k.action).slice(6),
      ['view_inbox', 'view_completed']
    );
  });

  it('pluralises the inbox option label', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    createFile(dir, '.workflows/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
    assert.ok(emptyMenu(startDetail(dir)).rendered.includes('start from an item (2 items)'));
  });
});

describe('start projections: inbox pickup', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function pickup(d) {
    const detail = startDetail(d);
    return inboxPickupView(combinedInbox(detail.inbox), detail.state.has_archived);
  }

  it('renders the combined, date-ordered list with the multi-select menu and archived option', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-06-02--dark-launch.md', '# Dark Launch\n');
    createFile(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    createFile(dir, '.workflows/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
    createFile(dir, '.workflows/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    const v = pickup(dir);
    assert.strictEqual(v.data, [
      'inbox_count: 3',
      'has_archived: true',
      'ITEMS (n  type  date  slug  → path):',
      '  1  idea  2026-06-01  smart-retry  → .workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '  2  idea  2026-06-02  dark-launch  → .workflows/.inbox/ideas/2026-06-02--dark-launch.md',
      '  3  bug  2026-06-03  login-timeout  → .workflows/.inbox/bugs/2026-06-03--login-timeout.md',
    ].join('\n'));
    assert.strictEqual(v.display, [
      '●───────────────────────────────────────────────●',
      '  Inbox',
      '●───────────────────────────────────────────────●',
      '',
      '  1. Smart Retry (idea, 2026-06-01)',
      '  2. Dark Launch (idea, 2026-06-02)',
      '  3. Login Timeout (bug, 2026-06-03)',
      '',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      'What would you like to do?',
      '',
      '- **`1`–`3`** — Select item(s) to work on (comma-separated for several)',
      '- **`a`/`archived`** — View archived items (restore or delete)',
      '- **`b`/`back`** — Return',
      DOTS,
    ].join('\n'));
  });

  it('renders the singular select option for one item without an archived store', () => {
    createFile(dir, '.workflows/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
    const v = pickup(dir);
    assert.strictEqual(v.menu, [
      DOTS,
      'What would you like to do?',
      '',
      '- **`1`** — Select the item to work on',
      '- **`b`/`back`** — Return',
      DOTS,
    ].join('\n'));
  });

  it('renders the empty inbox with no select option', () => {
    const v = pickup(dir);
    assert.strictEqual(v.data, [
      'inbox_count: 0',
      'has_archived: false',
      'ITEMS (n  type  date  slug  → path):',
    ].join('\n'));
    assert.strictEqual(v.display, [
      '●───────────────────────────────────────────────●',
      '  Inbox',
      '●───────────────────────────────────────────────●',
      '',
      'No inbox items.',
      '',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      'What would you like to do?',
      '',
      '- **`b`/`back`** — Return',
      DOTS,
    ].join('\n'));
  });
});

describe('start projections: archived store', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('renders the archived list and select prompt', () => {
    createFile(dir, '.workflows/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    createFile(dir, '.workflows/.inbox/.archived/quickfixes/2026-05-02--tidy-logs.md', '# Tidy Logs\n');
    const detail = startDetail(dir);
    const v = archivedView(combinedInbox(detail.inbox.archived, { archived: true }));
    assert.strictEqual(v.data, [
      'archived_count: 2',
      'ITEMS (n  type  date  slug  → path):',
      '  1  idea  2026-05-01  old-idea  → .workflows/.inbox/.archived/ideas/2026-05-01--old-idea.md',
      '  2  quick-fix  2026-05-02  tidy-logs  → .workflows/.inbox/.archived/quickfixes/2026-05-02--tidy-logs.md',
    ].join('\n'));
    assert.strictEqual(v.display, [
      '●───────────────────────────────────────────────●',
      '  Archived',
      '●───────────────────────────────────────────────●',
      '',
      '  1. Old Idea (idea, 2026-05-01)',
      '  2. Tidy Logs (quick-fix, 2026-05-02)',
      '',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      'Select an item (enter number, or **`b`/`back`** to return):',
      DOTS,
    ].join('\n'));
  });

  it('renders the empty archived store with an empty menu', () => {
    const detail = startDetail(dir);
    const v = archivedView(combinedInbox(detail.inbox.archived, { archived: true }));
    assert.ok(v.display.endsWith('No archived items.\n'));
    assert.strictEqual(v.menu, '');
  });
});

describe('start projections: working set', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function seedInbox(d) {
    createFile(d, '.workflows/.inbox/bugs/2026-06-01--login-timeout.md', '# Login Timeout\n');
    createFile(d, '.workflows/.inbox/bugs/2026-06-02--crash-on-save.md', '# Crash On Save\n');
    createFile(d, '.workflows/.inbox/ideas/2026-06-03--smart-retry.md', '# Smart Retry\n');
  }

  it('uniform bug set: offers work, maps the bugfix pre-seed, and defers add/drop gates', () => {
    seedInbox(dir);
    const ws = workingSetDetail(dir, [
      '.workflows/.inbox/bugs/2026-06-01--login-timeout.md',
      '.workflows/.inbox/bugs/2026-06-02--crash-on-save.md',
    ]);
    const v = workingSetView(ws);
    assert.strictEqual(v.data, [
      'set_count: 2',
      'set_uniform: true',
      'set_type: bugfix',
      'addable_count: 1',
      'SET (n  type  date  slug  → path):',
      '  1  bug  2026-06-01  login-timeout  → .workflows/.inbox/bugs/2026-06-01--login-timeout.md',
      '  2  bug  2026-06-02  crash-on-save  → .workflows/.inbox/bugs/2026-06-02--crash-on-save.md',
      'ADDABLE (n  type  date  slug  → path):',
      '  1  idea  2026-06-03  smart-retry  → .workflows/.inbox/ideas/2026-06-03--smart-retry.md',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      'What would you like to do? Type a shortcut, or just tell me in',
      'your own words — e.g. "add 2 and 4", "drop the bug", "archive these".',
      '',
      '- **`w`/`work`** — Proceed to discovery with this set',
      '- **`a`/`add`** — Add another inbox item to the set',
      '- **`d`/`drop`** — Drop item(s) from the set (keeps them in the inbox)',
      '- **`r`/`archive`** — Archive the whole set out of the inbox',
      '- **`v`/`view`** — View full content of the set',
      '- **`b`/`back`** — Return to the inbox list',
      '- **Ask** — Ask about the set',
      DOTS,
    ].join('\n'));
    assert.strictEqual(v.sections, [
      '=== DISPLAY: add candidates (emit verbatim as a code block only at the add-items gate — never at the call) ===',
      '  1. Smart Retry (idea, 2026-06-03)',
      '',
      '=== MENU: add gate (emit verbatim as markdown only at the add-items gate) ===',
      DOTS,
      'Add which? (enter number(s), comma-separated, or **`b`/`back`**)',
      DOTS,
      '',
      '=== DISPLAY: drop candidates (emit verbatim as a code block only at the drop-items gate — never at the call) ===',
      '  1. Login Timeout (bug)',
      '  2. Crash On Save (bug)',
      '',
      '=== MENU: drop gate (emit verbatim as markdown only at the drop-items gate) ===',
      DOTS,
      'Drop which? (enter number(s), comma-separated, or **`b`/`back`**)',
      DOTS,
      '',
    ].join('\n'));
  });

  it('mixed set: no work option, set_type mixed', () => {
    seedInbox(dir);
    const ws = workingSetDetail(dir, [
      '.workflows/.inbox/bugs/2026-06-01--login-timeout.md',
      '.workflows/.inbox/ideas/2026-06-03--smart-retry.md',
    ]);
    assert.strictEqual(ws.uniform, false);
    assert.strictEqual(ws.set_type, 'mixed');
    const v = workingSetView(ws);
    assert.ok(!v.menu.includes('`w`/`work`'));
    assert.ok(v.data.includes('set_uniform: false'));
  });

  it('idea set maps the none pre-seed; a fully-selected inbox defers no add gate', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-06-03--smart-retry.md', '# Smart Retry\n');
    const ws = workingSetDetail(dir, ['.workflows/.inbox/ideas/2026-06-03--smart-retry.md']);
    assert.strictEqual(ws.set_type, 'none');
    const v = workingSetView(ws);
    assert.ok(v.data.includes('addable_count: 0'));
    assert.ok(!v.sections.includes('add candidates'));
    assert.ok(!v.sections.includes('add gate'));
    assert.ok(v.sections.includes('DISPLAY: drop candidates'));
  });

  it('quick-fix set maps the quick-fix pre-seed', () => {
    createFile(dir, '.workflows/.inbox/quickfixes/2026-06-04--tidy-logs.md', '# Tidy Logs\n');
    const ws = workingSetDetail(dir, ['.workflows/.inbox/quickfixes/2026-06-04--tidy-logs.md']);
    assert.strictEqual(ws.set_type, 'quick-fix');
  });

  it('is loud on paths outside the live inbox', () => {
    assert.throws(() => workingSetDetail(dir, ['.workflows/.inbox/bugs/2026-06-01--gone.md']), /not in the live inbox/);
    assert.throws(() => workingSetDetail(dir, []), /working set is empty/);
  });
});

describe('start projections: manage list', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('numbers continuously across type sections, matching the overview', () => {
    const v = manageListView(fullFixture(dir));
    assert.strictEqual(v.data, [
      'unit_count: 6',
      'UNITS (n  work_type  work_unit):',
      '  1  feature  auth-flow',
      '  2  feature  dark-mode',
      '  3  bugfix  login-crash',
      '  4  quick-fix  rename-api',
      '  5  cross-cutting  caching',
      '  6  epic  quiz-competition-v1',
    ].join('\n'));
    assert.strictEqual(v.display, [
      '●───────────────────────────────────────────────●',
      '  Manage',
      '●───────────────────────────────────────────────●',
      '',
      'Features:',
      '  1. Auth Flow',
      '  2. Dark Mode',
      '',
      'Bugfixes:',
      '  3. Login Crash',
      '',
      'Quick Fixes:',
      '  4. Rename Api',
      '',
      'Cross-Cutting:',
      '  5. Caching',
      '',
      'Epics:',
      '  6. Quiz Competition V1',
      '',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      'Select a work unit (enter number, or **`b`/`back`** to return):',
      DOTS,
    ].join('\n'));
  });

  it('renders the empty case with an empty menu', () => {
    const v = manageListView(startDetail(dir));
    assert.ok(v.display.endsWith('No active work units.\n'));
    assert.strictEqual(v.menu, '');
    assert.deepStrictEqual(v.rows, []);
  });
});

describe('start projections: manage unit', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('bare feature: pivot only, no absorb without a discussion or epic target', () => {
    createManifest(dir, 'auth-flow', {});
    const md = manageDetail(dir, 'auth-flow');
    const v = manageUnitView(md);
    assert.strictEqual(v.data, [
      'work_unit: auth-flow',
      'work_type: feature',
      'status: in-progress',
      'implementation_completed: false',
      'has_plan: false',
      'has_spec: false',
      'has_discussion: false',
      'absorb_available: false',
      'available_epics: (none)',
      'planning_topics: (none)',
      'ACTIONS (key  action):',
      '  p  pivot',
      '  c  cancel',
      '  b  back',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      '**Auth Flow** (feature)',
      '',
      '- **`p`/`pivot`** — Convert to epic (enables multiple topics)',
      '- **`c`/`cancel`** — Mark as cancelled',
      '- **`b`/`back`** — Return',
      '- **Ask** — Ask a question about this work unit',
      DOTS,
    ].join('\n'));
    assert.strictEqual(v.sections, '');
  });

  it('absorbable feature: absorb option plus the deferred target menu', () => {
    createManifest(dir, 'auth-flow', {
      phases: { discussion: { items: { 'auth-flow': { status: 'completed' } } } },
    });
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'v2', { work_type: 'epic' });
    const v = manageUnitView(manageDetail(dir, 'auth-flow'));
    assert.ok(v.menu.includes('- **`a`/`absorb`** — Merge into an existing epic'));
    assert.strictEqual(v.sections, [
      '=== MENU: absorb target (emit verbatim as markdown only at the absorb target gate — never at the call) ===',
      DOTS,
      'Select a target epic:',
      '',
      '- **`1`** — V1',
      '- **`2`** — V2',
      '',
      '- **`b`/`back`** — Return',
      DOTS,
      '',
    ].join('\n'));
  });

  it('spec-or-beyond feature loses absorb even with a target epic', () => {
    createManifest(dir, 'auth-flow', {
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'v1', { work_type: 'epic' });
    const v = manageUnitView(manageDetail(dir, 'auth-flow'));
    assert.ok(!v.menu.includes('absorb'));
    assert.strictEqual(v.sections, '');
  });

  it('completed implementation offers done; a plan offers view-plan', () => {
    createManifest(dir, 'hotfix', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { hotfix: { status: 'completed' } } },
        planning: { items: { hotfix: { status: 'completed' } } },
        implementation: { items: { hotfix: { status: 'completed' } } },
      },
    });
    const v = manageUnitView(manageDetail(dir, 'hotfix'));
    assert.strictEqual(v.menu, [
      DOTS,
      '**Hotfix** (quick-fix)',
      '',
      '- **`d`/`done`** — Mark as completed',
      '- **`v`/`view-plan`** — View the implementation plan',
      '- **`c`/`cancel`** — Mark as cancelled',
      '- **`b`/`back`** — Return',
      '- **Ask** — Ask a question about this work unit',
      DOTS,
    ].join('\n'));
    assert.ok(!v.menu.includes('pivot'));
    assert.strictEqual(v.sections, '');
  });

  it('multi-plan epic defers the plan-topics menu; a single plan does not', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { planning: { items: { 'topic-a': { status: 'completed' }, 'topic-b': { status: 'in-progress' } } } },
    });
    createManifest(dir, 'v2', {
      work_type: 'epic',
      phases: { planning: { items: { solo: { status: 'in-progress' } } } },
    });
    const multi = manageUnitView(manageDetail(dir, 'v1'));
    assert.strictEqual(multi.sections, [
      '=== MENU: plan topics (emit verbatim as markdown only at the view-plan topic gate — never at the call) ===',
      DOTS,
      'Which plan would you like to view?',
      '',
      '- **`1`** — Topic A — completed',
      '- **`2`** — Topic B — in-progress',
      DOTS,
      '',
    ].join('\n'));
    assert.ok(multi.data.includes('planning_topics: topic-a [completed], topic-b [in-progress]'));
    const single = manageUnitView(manageDetail(dir, 'v2'));
    assert.ok(!single.sections.includes('plan topics'));
  });

  it('manageDetail is null for a missing work unit', () => {
    assert.strictEqual(manageDetail(dir, 'ghost'), null);
  });
});

describe('start projections: completed & cancelled', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function closedFixture(d) {
    createManifest(d, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(d, 'done-cc', { work_type: 'cross-cutting', status: 'completed', phases: { specification: { items: { 'done-cc': { status: 'completed' } } } } });
    createManifest(d, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
    return startDetail(d);
  }

  it('renders both lists with continuous numbering and no filter line', () => {
    const v = completedView(closedFixture(dir));
    assert.strictEqual(v.data, [
      'filter: (none)',
      'completed_count: 2',
      'cancelled_count: 1',
      'UNITS (n  status  work_type  work_unit  last_phase):',
      '  1  completed  cross-cutting  done-cc  specification',
      '  2  completed  feature  done-feat  review',
      '  3  cancelled  bugfix  dropped  none',
    ].join('\n'));
    assert.strictEqual(v.display, [
      '●───────────────────────────────────────────────●',
      '  Completed & Cancelled',
      '●───────────────────────────────────────────────●',
      '',
      'Completed:',
      '  1. Done Cc',
      '     └─ Completed after: specification',
      '',
      '  2. Done Feat',
      '     └─ Completed after: review',
      '',
      'Cancelled:',
      '  3. Dropped',
      '     └─ Cancelled during: none',
      '',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      'Select a work unit for details, or **`b`/`back`** to return.',
      '',
      'Select an option (enter number):',
      DOTS,
    ].join('\n'));
  });

  it('filters to one work type with the Showing line', () => {
    const v = completedView(closedFixture(dir), 'feature');
    assert.strictEqual(v.display, [
      '●───────────────────────────────────────────────●',
      '  Completed & Cancelled',
      '●───────────────────────────────────────────────●',
      '',
      'Showing: Features',
      '',
      'Completed:',
      '  1. Done Feat',
      '     └─ Completed after: review',
      '',
    ].join('\n'));
    assert.ok(v.data.includes('filter: feature'));
  });

  it('a filter with no matches renders the empty display and no menu', () => {
    const v = completedView(closedFixture(dir), 'quick-fix');
    assert.ok(v.display.endsWith('No completed or cancelled work units found.\n'));
    assert.strictEqual(v.menu, '');
    assert.deepStrictEqual(v.rows, []);
  });

  it('is loud on an unknown filter', () => {
    assert.throws(() => completedView(closedFixture(dir), 'gizmo'), /unknown work-type filter/);
  });
});
