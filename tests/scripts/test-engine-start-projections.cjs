'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { startDetail } = require('../../skills/leeway-engine/scripts/domain/start.cjs');
const {
  startOverview,
  startMenu,
  emptyOverview,
  emptyMenu,
  inboxPickupView,
  archivedView,
  workingSetView,
  workingSetAddGate,
  workingSetDropGate,
  manageListView,
  manageUnitView,
  absorbTargetMenu,
  planTopicsPick,
  completedView,
} = require('../../skills/leeway-engine/scripts/domain/projections/start.cjs');
const { drawLabel } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { combinedInbox, workingSetDetail } = require('../../skills/leeway-engine/scripts/domain/inbox-set.cjs');
const { manageDetail } = require('../../skills/leeway-engine/scripts/domain/workunit-manage.cjs');
const { auditingRender } = require('./gate-audit.cjs');

const renderSurface = auditingRender(require('../../skills/leeway-engine/scripts/domain/render.cjs').renderSurface);

// Menu label continuations indent with non-breaking spaces (the worklist
// rule) — goldens spell them explicitly.
const NB = (n) => '\u00a0'.repeat(n);

// Golden tests: byte-exact expected strings for the leeway overview
// and menu projections. Fixtures go through real manifests and inbox files in
// temp dirs (the same shapes the discovery tests produce).

// Merge a baseline object into the project manifest (preserving the registry
// the manifest helpers may have written).
function writeProjectBaseline(dir, baseline) {
  const fs = require('fs');
  const path = require('path');
  const p = path.join(dir, '.leeway', 'manifest.json');
  const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  fs.writeFileSync(p, JSON.stringify({ ...existing, baseline }, null, 2));
}

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
      discussion: { items: { 'kitchen-hardware': { status: 'completed' }, 'menu-admin': { status: 'in-progress' } } },
    },
  });
  createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
  createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
  createFile(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
  createFile(dir, '.leeway/.inbox/ideas/2026-06-02--dark-launch.md', '# Dark Launch\n');
  createFile(dir, '.leeway/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
  return startDetail(dir);
}

describe('start projections: overview', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('renders all five type sections, the inbox section, and the counts line byte-for-byte', () => {
    assert.strictEqual(startOverview(fullFixture(dir)), [
      'Features',
      '  ├─ 1. Auth Flow',
      '  └─ 2. Dark Mode',
      '',
      'Bugfixes',
      '  └─ 3. Login Crash',
      '',
      'Quick Fixes',
      '  └─ 4. Rename Api',
      '',
      'Cross-Cutting',
      '  └─ 5. Caching',
      '',
      'Epics',
      '  └─ 6. Quiz Competition V1',
      '',
      'Inbox',
      '  ├─ Smart Retry [idea]',
      '  ├─ Dark Launch [idea]',
      '  └─ Login Timeout [bug]',
      '',
      '1 completed, 1 cancelled.',
      '',
    ].join('\n'));
  });

  it('renders a single populated section with no inbox and no counts line', () => {
    createManifest(dir, 'auth-flow', {});
    assert.strictEqual(startOverview(startDetail(dir)), [
      'Features',
      '  └─ 1. Auth Flow',
      '',
    ].join('\n'));
  });

  it('numbers continuously across sections, skipping empty ones', () => {
    createManifest(dir, 'dark-mode', {});
    createManifest(dir, 'auth-flow', {});
    createManifest(dir, 'v1', { work_type: 'epic', phases: { discussion: { items: { exploration: { status: 'in-progress' } } } } });
    assert.strictEqual(startOverview(startDetail(dir)), [
      'Features',
      '  ├─ 1. Auth Flow',
      '  └─ 2. Dark Mode',
      '',
      'Epics',
      '  └─ 3. V1',
      '',
    ].join('\n'));
  });

  it('renders the inbox section rows with each item\'s bracketed type inline', () => {
    createManifest(dir, 'auth-flow', {});
    createFile(dir, '.leeway/.inbox/ideas/2026-06-01--one.md', '# One\n');
    createFile(dir, '.leeway/.inbox/quickfixes/2026-06-02--qf-a.md', '# A\n');
    createFile(dir, '.leeway/.inbox/quickfixes/2026-06-03--qf-b.md', '# B\n');
    const out = startOverview(startDetail(dir));
    assert.ok(out.includes('\nInbox\n  ├─ One [idea]\n  ├─ A [quick-fix]\n  └─ B [quick-fix]\n'));
  });

  it('epic with no phase items renders a plain row (state lives in the menu tail)', () => {
    createManifest(dir, 'fresh-epic', { work_type: 'epic' });
    assert.strictEqual(startOverview(startDetail(dir)), [
      'Epics',
      '  └─ 1. Fresh Epic',
      '',
    ].join('\n'));
  });

  it('finalising unit renders a plain row (finalising state lives in the menu tail)', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'completed' } } },
      },
    });
    assert.strictEqual(startOverview(startDetail(dir)), [
      'Cross-Cutting',
      '  └─ 1. Caching',
      '',
    ].join('\n'));
  });
});

describe('start projections: menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a single-topic unit with messages waiting carries the mail waiting cue on its row — an epic never does', () => {
    createFile(dir, '.leeway/dark-mode/topics/dark-mode/mail/001-escalation-path.md', '### Escalation path\n');
    createFile(dir, '.leeway/quiz-competition-v1/topics/menu-admin/mail/001-cost-model.md', '### Cost model\n');
    const detail = fullFixture(dir);
    assert.deepStrictEqual(detail.features.work_units.find((u) => u.name === 'dark-mode').mail_phases, ['discussion']);
    assert.strictEqual(detail.features.work_units.find((u) => u.name === 'auth-flow').mail_phases, undefined);
    assert.strictEqual(detail.epics.work_units[0].mail_phases, undefined);
    const labels = startMenu(detail).keys.map((k) => drawLabel(k.label));
    assert.ok(labels.includes('Continue "Dark Mode" — *feature, discussion (in-progress)* · mail waiting'), labels.join('\n'));
    assert.ok(labels.includes('Continue "Quiz Competition V1" — *epic*'), labels.join('\n'));
  });

  it('renders continue entries then command options with the conditional i/v present', () => {
    const menu = startMenu(fullFixture(dir));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ What would you like to do?`**',
      '',
      '**`1`**               → Continue "Auth Flow" — *feature, ready for*',
      `${NB(18)}*specification*`,
      '**`2`**               → Continue "Dark Mode" — *feature, discussion*',
      `${NB(18)}*(in-progress)*`,
      '**`3`**               → Continue "Login Crash" — *bugfix, ready for*',
      `${NB(18)}*investigation*`,
      '**`4`**               → Continue "Rename Api" — *quick-fix, scoping*',
      `${NB(18)}*(in-progress)*`,
      '**`5`**               → Continue "Caching" — *cross-cutting, discussion*',
      `${NB(18)}*(in-progress)*`,
      '**`6`**               → Continue "Quiz Competition V1" — *epic*',
      '**`p/product`**       → Talk about the product',
      '**`s/start`**         → Start something new (not sure what kind yet)',
      '**`f/feature`**       → Start new feature',
      '**`e/epic`**          → Start new epic',
      '**`b/bugfix`**        → Start new bugfix',
      '**`q/quick-fix`**     → Start new quick-fix',
      '**`c/cross-cutting`** → Start new cross-cutting concern',
      '**`i/inbox`**         → View the inbox and triage its items',
      '**`v/view`**          → View completed & cancelled work units',
      '**`m/manage`**        → Manage a work unit\'s lifecycle',
      '**`h/help`**          → How the workflows work',
    ].join('\n'));
  });

  it('omits i and v when there is no inbox and nothing completed or cancelled', () => {
    createManifest(dir, 'auth-flow', {});
    const menu = startMenu(startDetail(dir));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      '**`◆ What would you like to do?`**',
      '',
      '**`1`**               → Continue "Auth Flow" — *feature, ready for*',
      `${NB(18)}*discussion*`,
      '**`p/product`**       → Talk about the product',
      '**`s/start`**         → Start something new (not sure what kind yet)',
      '**`f/feature`**       → Start new feature',
      '**`e/epic`**          → Start new epic',
      '**`b/bugfix`**        → Start new bugfix',
      '**`q/quick-fix`**     → Start new quick-fix',
      '**`c/cross-cutting`** → Start new cross-cutting concern',
      '**`m/manage`**        → Manage a work unit\'s lifecycle',
      '**`h/help`**          → How the workflows work',
    ].join('\n'));
  });

  it('finalising unit gets a Finalise entry that still routes to the linear continue menu', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { caching: { status: 'completed' } } },
        specification: { items: { caching: { status: 'completed' } } },
      },
    });
    const menu = startMenu(startDetail(dir));
    assert.ok(/\*\*`1`\*\* +→ Finalise "Caching" — \*cross-cutting, pipeline\*\n\u00a0+\*complete\*/.test(menu.rendered));
    const entry = menu.keys.find((k) => k.key === '1');
    assert.strictEqual(entry.action, 'continue_work_unit');
    assert.strictEqual(entry.route, '/leeway-continue-linear caching');
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
        ['1', 'continue_work_unit', 'auth-flow', '/leeway-continue-linear auth-flow', null],
        ['2', 'continue_work_unit', 'dark-mode', '/leeway-continue-linear dark-mode', null],
        ['3', 'continue_work_unit', 'login-crash', '/leeway-continue-linear login-crash', null],
        ['4', 'continue_work_unit', 'rename-api', '/leeway-continue-linear rename-api', null],
        ['5', 'continue_work_unit', 'caching', '/leeway-continue-linear caching', null],
        ['6', 'continue_work_unit', 'quiz-competition-v1', '/leeway-continue-epic quiz-competition-v1', null],
        ['p', 'open_product', null, '/leeway-discovery none none', null],
        ['s', 'start_new', null, null, 'none'],
        ['f', 'start_new', null, null, 'feature'],
        ['e', 'start_new', null, null, 'epic'],
        ['b', 'start_new', null, null, 'bugfix'],
        ['q', 'start_new', null, null, 'quick-fix'],
        ['c', 'start_new', null, null, 'cross-cutting'],
        ['i', 'view_inbox', null, null, null],
        ['v', 'view_completed', null, null, null],
        ['m', 'manage', null, null, null],
        ['h', 'open_help', null, '/leeway-help', null],
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
    assert.strictEqual(emptyOverview(detail), 'No active work found.\n');
    const menu = emptyMenu(detail);
    assert.strictEqual(menu.rendered, [
      DOTS,
      '**`◆ What would you like to start?`**',
      '',
      '**`p/product`**       → Talk about the product',
      "**`s/start`**         → Not sure what kind yet — describe it and we'll",
      `${NB(18)}shape it`,
      '**`f/feature`**       → Single topic: discussion → spec → plan →',
      `${NB(18)}implement → review`,
      '**`e/epic`**          → Multiple topics, multi-session, same pipeline',
      `${NB(18)}per topic`,
      '**`b/bugfix`**        → Investigation → spec → plan → implement →',
      `${NB(18)}review`,
      '**`q/quick-fix`**     → Scoping → implement → review (no formal',
      `${NB(18)}planning)`,
      '**`c/cross-cutting`** → Discussion → spec (patterns or policies that',
      `${NB(18)}inform other work)`,
      '**`h/help`**          → How the workflows work',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.pre_seed || null]),
      [
        ['p', 'open_product', null],
        ['s', 'start_new', 'none'],
        ['f', 'start_new', 'feature'],
        ['e', 'start_new', 'epic'],
        ['b', 'start_new', 'bugfix'],
        ['q', 'start_new', 'quick-fix'],
        ['c', 'start_new', 'cross-cutting'],
        ['h', 'open_help', null],
      ]
    );
  });

  it('adds the counts line, singular inbox option, and view option when state has them', () => {
    createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
    createFile(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    const detail = startDetail(dir);
    assert.strictEqual(emptyOverview(detail), [
      'No active work found.',
      '',
      '1 completed, 1 cancelled.',
      '',
    ].join('\n'));
    const menu = emptyMenu(detail);
    assert.ok(/\*\*`i\/inbox`\*\* +→ View the inbox and triage its items \(1 item\)/.test(menu.rendered));
    assert.ok(/\*\*`v\/view`\*\* +→ View completed & cancelled work units/.test(menu.rendered));
    assert.deepStrictEqual(
      menu.keys.map((k) => k.action).slice(7),
      ['view_inbox', 'view_completed', 'open_help']
    );
  });

  it('pluralises the inbox option label', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    createFile(dir, '.leeway/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
    assert.ok(emptyMenu(startDetail(dir)).rendered.includes('triage its items (2 items)'));
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
    createFile(dir, '.leeway/.inbox/ideas/2026-06-02--dark-launch.md', '# Dark Launch\n');
    createFile(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    createFile(dir, '.leeway/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    const v = pickup(dir);
    assert.strictEqual(v.data, [
      'inbox_count: 3',
      'has_archived: true',
      'ITEMS (n  type  date  slug  → path  — title):',
      `  1  idea  2026-06-01  smart-retry  → ${dir}/.leeway/.inbox/ideas/2026-06-01--smart-retry.md  — Smart Retry`,
      `  2  idea  2026-06-02  dark-launch  → ${dir}/.leeway/.inbox/ideas/2026-06-02--dark-launch.md  — Dark Launch`,
      `  3  bug  2026-06-03  login-timeout  → ${dir}/.leeway/.inbox/bugs/2026-06-03--login-timeout.md  — Login Timeout`,
    ].join('\n'));
    assert.strictEqual(v.display, [
      'Ideas',
      '  ├─ 1. Smart Retry [2026-06-01]',
      '  └─ 2. Dark Launch [2026-06-02]',
      '',
      'Bugs',
      '  └─ 3. Login Timeout [2026-06-03]',
      '',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      '**`◆ What would you like to do?`**',
      '',
      '**`1–3`**        → Triage item(s) — archive, put on the roadmap, or',
      `${NB(13)}start work (comma-separated for several)`,
      '**`a/archived`** → View archived items (restore or delete)',
      '**`b/back`**     → Return',
    ].join('\n'));
  });

  it('renders the singular select option for one item without an archived store', () => {
    createFile(dir, '.leeway/.inbox/bugs/2026-06-03--login-timeout.md', '# Login Timeout\n');
    const v = pickup(dir);
    assert.strictEqual(v.menu, [
      '· · · · · · · · · · · ·',
      '**`◆ What would you like to do?`**',
      '',
      '**`1`**      → Triage the item — archive it, put it on the roadmap, or',
      `${NB(9)}start work`,
      '**`b/back`** → Return',
    ].join('\n'));
  });

  it('renders the empty inbox as its display alone — no pick to take, so no menu', () => {
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    const v = pickup(dir);
    assert.strictEqual(v.data, [
      'inbox_count: 0',
      'has_archived: true',
      'ITEMS (n  type  date  slug  → path  — title):',
    ].join('\n'));
    assert.strictEqual(v.display, 'No inbox items.\n');
    assert.strictEqual(v.menu, undefined);
  });
});

describe('start projections: archived store', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('the menu is the archived list — one numbered row per item, group-major, then back; no display beside it', () => {
    createFile(dir, '.leeway/.inbox/.archived/quickfixes/2026-05-02--tidy-logs.md', '# Tidy Logs\n');
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    createFile(dir, '.leeway/.inbox/.archived/bugs/2026-05-03--tricky.md', '# A title with **bold**\n');
    const detail = startDetail(dir);
    const v = archivedView(combinedInbox(detail.inbox.archived, { archived: true }));
    assert.strictEqual(v.data, [
      'archived_count: 3',
      'ITEMS (n  type  date  slug  → path  — title):',
      `  1  idea  2026-05-01  old-idea  → ${dir}/.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md  — Old Idea`,
      `  2  bug  2026-05-03  tricky  → ${dir}/.leeway/.inbox/.archived/bugs/2026-05-03--tricky.md  — A title with **bold**`,
      `  3  quick-fix  2026-05-02  tidy-logs  → ${dir}/.leeway/.inbox/.archived/quickfixes/2026-05-02--tidy-logs.md  — Tidy Logs`,
    ].join('\n'));
    assert.strictEqual(v.display, undefined);
    assert.strictEqual(v.menu, [
      DOTS,
      '**`◆ Which item?`**',
      '',
      '**`1`**      → Old Idea — *idea, 2026-05-01*',
      '**`2`**      → A title with \\*\\*bold\\*\\* — *bug, 2026-05-03*',
      '**`3`**      → Tidy Logs — *quick-fix, 2026-05-02*',
      '**`b/back`** → Return to the inbox',
    ].join('\n'));
  });

  it('renders the empty archived store as a display and no menu', () => {
    const detail = startDetail(dir);
    const v = archivedView(combinedInbox(detail.inbox.archived, { archived: true }));
    assert.strictEqual(v.display, 'No archived items.\n');
    assert.strictEqual(v.menu, undefined);
  });

  it('the archived-actions and delete gates render over the selected item by its store path, and refuse a path the store does not hold', () => {
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    createFile(dir, '.leeway/.inbox/ideas/2026-06-01--live-idea.md', '# Live Idea\n');
    const archived = '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md';

    assert.strictEqual(renderSurface(dir, 'archived-actions', { path: archived }), [
      "=== MENU: archived actions (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'Selected: **Old Idea** (idea, archived)',
      '',
      '**`◆ What would you like to do with it?`**',
      '',
      '**`v/view`**      → View full content',
      '**`u/unarchive`** → Restore to the inbox',
      '**`d/delete`**    → Permanently delete (removes the file from git)',
      '**`b/back`**      → Return to the archived list',
      '',
    ].join('\n'));

    assert.strictEqual(renderSurface(dir, 'archived-delete-gate', { path: archived }), [
      "=== MENU: archived delete gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'Permanently deleting "Old Idea" removes the file from the repo and cannot be undone.',
      '',
      '**`◆ Delete it?`**',
      '',
      '**`y/yes`** → Delete permanently',
      '**`n/no`**  → Return',
      '',
    ].join('\n'));

    createFile(dir, '.leeway/.inbox/.archived/bugs/2026-05-02--tricky.md', '# A title with **bold** and a [link]\n');
    const tricky = renderSurface(dir, 'archived-actions', { path: '.leeway/.inbox/.archived/bugs/2026-05-02--tricky.md' });
    assert.match(tricky, /Selected: \*\*A title with \\\*\\\*bold\\\*\\\* and a \\\[link\\\]\*\* \(bug, archived\)/, 'user-authored title markup is escaped');
    assert.match(renderSurface(dir, 'archived-delete-gate', { path: '.leeway/.inbox/.archived/bugs/2026-05-02--tricky.md' }), /deleting "A title with \\\*\\\*bold/);
    assert.throws(() => renderSurface(dir, 'archived-actions', {}), /render archived-actions: --path is required — the selected archived item/);
    assert.throws(() => renderSurface(dir, 'archived-delete-gate', {}), /render archived-delete-gate: --path is required/);
    assert.throws(() => renderSurface(dir, 'archived-actions', { path: '.leeway/.inbox/ideas/2026-06-01--live-idea.md' }), /not an archived inbox path/);
    assert.throws(() => renderSurface(dir, 'archived-delete-gate', { path: '.leeway/.inbox/.archived/ideas/2026-05-02--ghost.md' }), /not in the archived store: "\.leeway\/\.inbox\/\.archived\/ideas\/2026-05-02--ghost\.md"/);
  });
});

describe('start projections: working set', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function seedInbox(d) {
    createFile(d, '.leeway/.inbox/bugs/2026-06-01--login-timeout.md', '# Login Timeout\n');
    createFile(d, '.leeway/.inbox/bugs/2026-06-02--crash-on-save.md', '# Crash On Save\n');
    createFile(d, '.leeway/.inbox/ideas/2026-06-03--smart-retry.md', '# Smart Retry\n');
  }

  it('bug set: offers work and the roadmap row, and maps the bugfix pre-seed', () => {
    seedInbox(dir);
    const ws = workingSetDetail(dir, [
      '.leeway/.inbox/bugs/2026-06-01--login-timeout.md',
      '.leeway/.inbox/bugs/2026-06-02--crash-on-save.md',
    ]);
    const v = workingSetView(ws);
    assert.strictEqual(v.data, [
      'set_count: 2',
      'set_type: bugfix',
      'addable_count: 1',
      'SET (n  type  date  slug  → path  — title):',
      `  1  bug  2026-06-01  login-timeout  → ${dir}/.leeway/.inbox/bugs/2026-06-01--login-timeout.md  — Login Timeout`,
      `  2  bug  2026-06-02  crash-on-save  → ${dir}/.leeway/.inbox/bugs/2026-06-02--crash-on-save.md  — Crash On Save`,
      'ADDABLE (n  type  date  slug  → path  — title):',
      `  1  idea  2026-06-03  smart-retry  → ${dir}/.leeway/.inbox/ideas/2026-06-03--smart-retry.md  — Smart Retry`,
    ].join('\n'));
    // The heading is the adapter's TITLE section — the display opens on the tree.
    assert.strictEqual(v.title, 'Working Set (2 items)');
    assert.strictEqual(v.display, [
      '  ├─ Login Timeout [bug]',
      '  │',
      '  └─ Crash On Save [bug]',
      '',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      'Type a shortcut, or just tell me in your own words — e.g. "add 2 and 4", "drop the bug", "archive these".',
      '',
      '**`◆ What would you like to do?`**',
      '',
      '**`w/work`**    → Proceed to discovery with this set',
      '**`o/roadmap`** → Move the set out of the inbox onto the roadmap',
      '**`a/add`**     → Add another inbox item to the set',
      '**`d/drop`**    → Drop item(s) from the set (keeps them in the inbox)',
      '**`r/archive`** → Archive the whole set out of the inbox',
      '**`v/view`**    → View full content of the set',
      '**`b/back`**    → Return to the inbox list',
      '**Ask**       → Ask about the set',
    ].join('\n'));
    assert.deepStrictEqual(Object.keys(v), ['data', 'title', 'display', 'menu'], 'the snapshot carries no other section');
    assert.strictEqual(workingSetAddGate(ws), [
      "=== MENU: add gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'Pick one, or several comma-separated.',
      '',
      '**`◆ Add which?`**',
      '',
      '**`1`**      → Smart Retry — *idea, 2026-06-03*',
      '**`b/back`** → Return to the working set',
      '',
    ].join('\n'));
    assert.strictEqual(workingSetDropGate(ws), [
      "=== MENU: drop gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'Pick one, or several comma-separated.',
      '',
      '**`◆ Drop which?`**',
      '',
      '**`1`**      → Login Timeout — *bug*',
      '**`2`**      → Crash On Save — *bug*',
      '**`b/back`** → Return to the working set',
      '',
    ].join('\n'));
  });

  it('a mixed set takes the largest shape in it: any idea leaves the type to discovery, work and the roadmap offered', () => {
    seedInbox(dir);
    createFile(dir, '.leeway/.inbox/quickfixes/2026-06-04--tidy-logs.md', '# Tidy Logs\n');
    const ws = workingSetDetail(dir, [
      '.leeway/.inbox/bugs/2026-06-01--login-timeout.md',
      '.leeway/.inbox/quickfixes/2026-06-04--tidy-logs.md',
      '.leeway/.inbox/ideas/2026-06-03--smart-retry.md',
    ]);
    assert.strictEqual(ws.set_type, 'none');
    assert.strictEqual('uniform' in ws, false);
    const v = workingSetView(ws);
    assert.ok(v.menu.includes('`w/work`'));
    assert.ok(v.menu.includes('`o/roadmap`'));
    assert.ok(v.data.includes('set_type: none'));
    assert.ok(!v.data.includes('set_uniform'));
  });

  it('a bug among quick-fixes and no idea makes a bugfix — the quick-fixes never set the type', () => {
    seedInbox(dir);
    createFile(dir, '.leeway/.inbox/quickfixes/2026-06-04--tidy-logs.md', '# Tidy Logs\n');
    const ws = workingSetDetail(dir, [
      '.leeway/.inbox/quickfixes/2026-06-04--tidy-logs.md',
      '.leeway/.inbox/bugs/2026-06-02--crash-on-save.md',
    ]);
    assert.strictEqual(ws.set_type, 'bugfix');
  });

  it('idea set maps the none pre-seed; a fully-selected inbox refuses the add gate', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-06-03--smart-retry.md', '# Smart Retry\n');
    const ws = workingSetDetail(dir, ['.leeway/.inbox/ideas/2026-06-03--smart-retry.md']);
    assert.strictEqual(ws.set_type, 'none');
    const v = workingSetView(ws);
    assert.ok(v.data.includes('addable_count: 0'));
    assert.throws(() => workingSetAddGate(ws), /nothing addable/);
    assert.ok(workingSetDropGate(ws).includes('**`1`**      → Smart Retry — *idea*'));
  });

  it('quick-fixes alone map the quick-fix pre-seed', () => {
    createFile(dir, '.leeway/.inbox/quickfixes/2026-06-04--tidy-logs.md', '# Tidy Logs\n');
    createFile(dir, '.leeway/.inbox/quickfixes/2026-06-05--bump-deps.md', '# Bump Deps\n');
    const ws = workingSetDetail(dir, [
      '.leeway/.inbox/quickfixes/2026-06-04--tidy-logs.md',
      '.leeway/.inbox/quickfixes/2026-06-05--bump-deps.md',
    ]);
    assert.strictEqual(ws.set_type, 'quick-fix');
  });

  it('is loud on paths outside the live inbox', () => {
    assert.throws(() => workingSetDetail(dir, ['.leeway/.inbox/bugs/2026-06-01--gone.md']), /not in the live inbox/);
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
      'baseline: none',
      'UNITS (n  work_type  work_unit):',
      '  1  feature  auth-flow',
      '  2  feature  dark-mode',
      '  3  bugfix  login-crash',
      '  4  quick-fix  rename-api',
      '  5  cross-cutting  caching',
      '  6  epic  quiz-competition-v1',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      '**`◆ Which work unit?`**',
      '',
      '**`1`**          → Auth Flow — *feature*',
      '**`2`**          → Dark Mode — *feature*',
      '**`3`**          → Login Crash — *bugfix*',
      '**`4`**          → Rename Api — *quick-fix*',
      '**`5`**          → Caching — *cross-cutting*',
      '**`6`**          → Quiz Competition V1 — *epic*',
      '**`a/baseline`** → Start the project baseline assessment',
      '**`b/back`**     → Return',
    ].join('\n'));
    assert.strictEqual(v.display, undefined, 'the menu is the list — no display beside it');
  });

  it('with no units the menu still offers the baseline and back', () => {
    const v = manageListView(startDetail(dir));
    assert.deepStrictEqual(v.rows, []);
    assert.strictEqual(v.menu, [
      DOTS,
      '**`◆ Which work unit?`**',
      '',
      '**`a/baseline`** → Start the project baseline assessment',
      '**`b/back`**     → Return',
    ].join('\n'));
  });

  it('labels the baseline option by status', () => {
    writeProjectBaseline(dir, { status: 'in-progress', areas: { overview: 'researched' } });
    assert.match(manageListView(fullFixture(dir)).menu, /\*\*`a\/baseline`\*\* → Resume the baseline interview/);
    writeProjectBaseline(dir, { status: 'completed', areas: { overview: 'completed' } });
    assert.match(manageListView(fullFixture(dir)).menu, /\*\*`a\/baseline`\*\* → View or expand the project baseline/);
    writeProjectBaseline(dir, { status: 'skipped' });
    assert.match(manageListView(fullFixture(dir)).menu, /\*\*`a\/baseline`\*\* → Start the project baseline assessment/);
    writeProjectBaseline(dir, { status: 'native' });
    assert.match(manageListView(fullFixture(dir)).menu, /\*\*`a\/baseline`\*\* → Start the project baseline assessment/);
  });
});

describe('start projections: baseline rows', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('startMenu carries the resume row only while in-progress, ahead of the start options', () => {
    const bare = startMenu(fullFixture(dir));
    assert.ok(!bare.keys.some((k) => k.action === 'open_baseline'), 'no baseline row without an assessment');

    writeProjectBaseline(dir, { status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'researched' } });
    const m = startMenu(fullFixture(dir));
    const row = m.keys.find((k) => k.action === 'open_baseline');
    assert.ok(row, 'in-progress renders the resume row');
    assert.strictEqual(row.key, 'a');
    assert.strictEqual(row.route, '/leeway-baseline');
    assert.strictEqual(drawLabel(row.label), 'Resume the baseline interview — *2 areas remaining*');
    const keys = m.keys.map((k) => k.key);
    assert.ok(keys.indexOf('a') < keys.indexOf('s'), 'the resume row precedes the start options');

    // Completed baselines manage from m/manage — no row on the populated menu.
    writeProjectBaseline(dir, { status: 'completed', areas: { overview: 'completed' } });
    assert.ok(!startMenu(fullFixture(dir)).keys.some((k) => k.action === 'open_baseline'));
  });

  it('emptyMenu carries the resume row in-progress and the view/expand row completed', () => {
    writeProjectBaseline(dir, { status: 'in-progress', areas: { overview: 'researched' } });
    const inProgress = emptyMenu(startDetail(dir));
    const row = inProgress.keys.find((k) => k.action === 'open_baseline');
    assert.ok(row);
    assert.strictEqual(drawLabel(row.label), 'Resume the baseline interview — *1 area remaining*');

    writeProjectBaseline(dir, { status: 'completed', areas: { overview: 'completed' } });
    const completed = emptyMenu(startDetail(dir));
    assert.strictEqual(drawLabel(completed.keys.find((k) => k.action === 'open_baseline').label), 'View or expand the project baseline');

    // The empty state has no manage row, so a declined baseline rides here —
    // the only surface a work-free project renders.
    writeProjectBaseline(dir, { status: 'skipped' });
    assert.strictEqual(drawLabel(emptyMenu(startDetail(dir)).keys.find((k) => k.action === 'open_baseline').label), 'Start the project baseline assessment');
  });

  it('every status reaches the baseline from somewhere: empty state, populated menu, or manage', () => {
    const reachable = (status, areas) => {
      writeProjectBaseline(dir, { status, areas });
      const empty = emptyMenu(startDetail(dir)).keys.some((k) => k.action === 'open_baseline');
      const full = fullFixture(dir) && startMenu(startDetail(dir)).keys.some((k) => k.action === 'open_baseline');
      const manage = manageListView(startDetail(dir)).menu.includes('a/baseline');
      return { empty, full, manage };
    };
    assert.deepStrictEqual(reachable('in-progress', { overview: 'researched' }), { empty: true, full: true, manage: true });
    assert.deepStrictEqual(reachable('completed', { overview: 'completed' }), { empty: true, full: false, manage: true });
    assert.deepStrictEqual(reachable('skipped', undefined), { empty: true, full: false, manage: true });
    assert.deepStrictEqual(reachable('none', undefined), { empty: false, full: false, manage: true });
    // A native verdict is a project that grew up on the workflows: no row
    // anywhere but manage, the one way in should it want the assessment.
    assert.deepStrictEqual(reachable('native', undefined), { empty: false, full: false, manage: true });
  });
});

describe('start projections: roadmap rows', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function writeProjectRoadmap(dir2, roadmap) {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(dir2, '.leeway', 'manifest.json');
    const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
    fs.writeFileSync(p, JSON.stringify({ ...existing, roadmap }, null, 2));
  }

  /** The product's session `n` open: its log on disk and its marker on the project manifest. */
  function openProductSession(dir2, n) {
    const fs = require('fs');
    const path = require('path');
    createFile(dir2, `.leeway/.product/sessions/session-${n}.md`, `# Product session ${n}\n`);
    const p = path.join(dir2, '.leeway', 'manifest.json');
    const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
    fs.writeFileSync(p, JSON.stringify({ ...existing, product_session: n }, null, 2));
  }

  const MAP = {
    horizons: ['mvp', 'v1', 'someday'],
    items: {
      ordering: { horizon: 'mvp', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'auth-flow' } },
      menus: { horizon: 'mvp', summary: 's', origin: 'harvest' },
      loyalty: { horizon: 'v1', summary: 's', origin: 'park:mvp' },
    },
  };

  it('the overview gains a Roadmap section — per-horizon join breakdowns, empty horizons omitted', () => {
    fullFixture(dir);
    writeProjectRoadmap(dir, MAP);
    const overview = startOverview(startDetail(dir));
    assert.match(overview, /Roadmap\n  ├─ mvp — 1 in flight · 1 waiting\n  └─ v1 — 1 waiting\n/);
    assert.ok(!overview.includes('someday —'), 'an empty horizon renders no row');
  });

  it('startMenu and emptyMenu carry the r/roadmap row only once the layer exists', () => {
    const bare = startMenu(fullFixture(dir));
    assert.ok(!bare.keys.some((k) => k.action === 'open_roadmap'), 'no roadmap row before the layer is born');

    writeProjectRoadmap(dir, MAP);
    const m = startMenu(startDetail(dir));
    const row = m.keys.find((k) => k.action === 'open_roadmap');
    assert.ok(row, 'the layer renders its row');
    assert.strictEqual(row.key, 'r');
    assert.strictEqual(row.route, '/leeway-roadmap open');
    assert.strictEqual(drawLabel(row.label), 'Open the product roadmap');
    const keys = m.keys.map((k) => k.key);
    assert.ok(keys.indexOf('r') < keys.indexOf('s'), 'the roadmap row precedes the start options');

    openProductSession(dir, '002');
    const open = startMenu(startDetail(dir)).keys.find((k) => k.action === 'open_roadmap');
    assert.strictEqual(drawLabel(open.label), 'Open the product roadmap', 'an open product session is carried on through p, never the roadmap');
  });

  it('both menus carry the p/product row always, handing into discovery at no unit, with its session count and last date once it has sessions (18.2.13, 18.S70)', () => {
    const productRow = (m) => m.keys.find((k) => k.action === 'open_product');
    const PRODUCT = { key: 'p', word: 'product', action: 'open_product', route: '/leeway-discovery none none', label: 'Talk about the product' };
    assert.deepStrictEqual(productRow(emptyMenu(startDetail(dir))), PRODUCT, 'a bare project has the row, no sessions named');

    createFile(dir, '.leeway/.product/sessions/session-001.md', '## 2026-10-12 · session one\n\nPricing first.\n');
    assert.strictEqual(drawLabel(productRow(emptyMenu(startDetail(dir))).label), 'Talk about the product — *1 session, last on 12 Oct*');

    createFile(dir, '.leeway/.product/sessions/session-002.md', '## 2026-10-18 · session two\n\nSync.\n\n## 2026-10-19 · session three\n\nLicensing.\n');
    createFile(dir, '.leeway/.product/sessions/session-003.md', '');
    const full = startMenu(fullFixture(dir));
    assert.strictEqual(drawLabel(productRow(full).label), 'Talk about the product — *3 sessions, last on 19 Oct*',
      'the date is the latest conversation a log names, past a log none has written in yet');
    const keys = full.keys.map((k) => k.key);
    assert.ok(keys.indexOf('3') < keys.indexOf('p') && keys.indexOf('p') < keys.indexOf('s'), `after the work, before start: ${keys}`);
  });

  it('sessions whose logs name no conversation are counted, with no date', () => {
    createFile(dir, '.leeway/.product/sessions/session-001.md', '# Product session 001\n');
    createFile(dir, '.leeway/.product/sessions/session-002.md', '# Product session 002\n');
    const row = emptyMenu(startDetail(dir)).keys.find((k) => k.action === 'open_product');
    assert.strictEqual(drawLabel(row.label), 'Talk about the product — *2 sessions*');
  });

  it('both menus carry the h/help row unconditionally — nothing about the project hides the teaching', () => {
    const HELP = { key: 'h', word: 'help', action: 'open_help', route: '/leeway-help', label: 'How the workflows work' };
    const helpRow = (m) => m.keys.find((k) => k.action === 'open_help');

    // A bare project, and one carrying every conditional row there is.
    assert.deepStrictEqual(helpRow(emptyMenu(startDetail(dir))), HELP);
    const empty = emptyMenu(startDetail(dir)).keys;
    assert.strictEqual(empty[empty.length - 1].action, 'open_help', 'last on the empty menu');

    writeProjectRoadmap(dir, MAP);
    createFile(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    const full = startMenu(fullFixture(dir));
    assert.deepStrictEqual(helpRow(full), HELP);
    const keys = full.keys.map((k) => k.key);
    assert.ok(keys.indexOf('m') < keys.indexOf('h'), 'after the manage row');
    assert.strictEqual(full.keys[full.keys.length - 1].action, 'open_help', 'last on the start menu');
  });

  it('the harvested-no-work state never renders an empty screen', () => {
    writeProjectRoadmap(dir, MAP);
    const detail = startDetail(dir);
    assert.strictEqual(detail.state.has_any_work, false);
    const overview = emptyOverview(detail);
    assert.match(overview, /^No work in flight\.\n\nRoadmap\n/);
    assert.match(overview, /├─ mvp — 1 waiting · 1 orphaned/); // no work units exist in this fixture — the join names a missing unit honestly
    const menu = emptyMenu(detail);
    assert.ok(menu.keys.some((k) => k.action === 'open_roadmap'));
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
      'ACTIONS (key  word  action):',
      '  p  pivot  pivot',
      '  c  cancel  cancel',
      '  b  back  back',
    ].join('\n'));
    assert.strictEqual(v.menu, [
      DOTS,
      '**Auth Flow** (feature)',
      '',
      '**`◆ What would you like to do?`**',
      '',
      '**`p/pivot`**  → Convert to epic (enables multiple topics)',
      '**`c/cancel`** → Mark as cancelled',
      '**`b/back`**   → Return',
      '**Ask**      → Ask a question about this work unit',
    ].join('\n'));
    assert.strictEqual(v.sections, undefined, 'the manage snapshot carries no deferred sections');
  });

  it('absorbable feature: absorb option; the target menu renders via its builder', () => {
    createManifest(dir, 'auth-flow', {
      phases: { discussion: { items: { 'auth-flow': { status: 'completed' } } } },
    });
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'v2', { work_type: 'epic' });
    const md = manageDetail(dir, 'auth-flow');
    const v = manageUnitView(md);
    assert.ok(/\*\*`a\/absorb`\*\* +→ Merge into an existing epic/.test(v.menu));
    assert.strictEqual(v.sections, undefined, 'the manage snapshot carries no deferred sections');
    assert.strictEqual(absorbTargetMenu(md), [
      "=== MENU: absorb target (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which epic should absorb it?`**',
      '',
      '**`1`**      → V1',
      '**`2`**      → V2',
      '',
      '**`b/back`** → Return',
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
    assert.strictEqual(v.sections, undefined, 'the manage snapshot carries no deferred sections');
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
      '· · · · · · · · · · · ·',
      '**Hotfix** (quick-fix)',
      '',
      '**`◆ What would you like to do?`**',
      '',
      '**`d/done`**      → Mark as completed',
      '**`v/view-plan`** → View the implementation plan',
      '**`c/cancel`**    → Mark as cancelled',
      '**`b/back`**      → Return',
      '**Ask**         → Ask a question about this work unit',
    ].join('\n'));
    assert.ok(v.data.endsWith([
      'ACTIONS (key  word  action):',
      '  d  done  mark_completed',
      '  v  view-plan  view_plan',
      '  c  cancel  cancel',
      '  b  back  back',
    ].join('\n')), 'every row the menu offers resolves by its key or its word');
    assert.ok(!v.menu.includes('pivot'));
    assert.strictEqual(v.sections, undefined, 'the manage snapshot carries no deferred sections');
  });

  it('multi-plan epic renders the plan-topics menu via its builder; a single plan the auto-select line', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { planning: { items: { 'topic-a': { status: 'completed' }, 'topic-b': { status: 'in-progress' } } } },
    });
    createManifest(dir, 'v2', {
      work_type: 'epic',
      phases: { planning: { items: { solo: { status: 'in-progress' } } } },
    });
    const multiMd = manageDetail(dir, 'v1');
    const multi = manageUnitView(multiMd);
    assert.strictEqual(multi.sections, undefined, 'the manage snapshot carries no deferred sections');
    assert.strictEqual(planTopicsPick(multiMd), [
      "=== MENU: plan topics (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Which plan would you like to view?`**',
      '',
      '**`1`** → Topic A — *completed*',
      '**`2`** → Topic B — *in-progress*',
      '',
    ].join('\n'));
    assert.ok(multi.data.includes('planning_topics: topic-a [completed], topic-b [in-progress]'));
    const singleMd = manageDetail(dir, 'v2');
    const single = manageUnitView(singleMd);
    assert.strictEqual(single.sections, undefined, 'the manage snapshot carries no deferred sections');
    assert.strictEqual(planTopicsPick(singleMd), [
      '=== DISPLAY: plan topic auto-select (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Automatically proceeding with "Solo".',
      '',
    ].join('\n'));
  });

  it('manageDetail is null for a missing work unit', () => {
    assert.strictEqual(manageDetail(dir, 'ghost'), null);
  });

  it('the absorb-target and plan-topics surfaces render the menus and refuse when their guards fail', () => {
    createManifest(dir, 'auth-flow', {
      phases: { discussion: { items: { 'auth-flow': { status: 'completed' } } } },
    });
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { planning: { items: { 'topic-a': { status: 'completed' }, 'topic-b': { status: 'in-progress' } } } },
    });
    assert.ok(renderSurface(dir, 'absorb-target', { dotpath: 'auth-flow' }).includes('MENU: absorb target'));
    assert.ok(renderSurface(dir, 'plan-topics', { dotpath: 'v1' }).includes('MENU: plan topics'));
    createManifest(dir, 'v2', {
      work_type: 'epic',
      phases: { planning: { items: { solo: { status: 'in-progress' } } } },
    });
    assert.ok(renderSurface(dir, 'plan-topics', { dotpath: 'v2' }).includes('Automatically proceeding with "Solo".'));
    // Guards: an epic is not absorbable; a feature has no epic plan, nor an epic with no plan.
    assert.throws(() => renderSurface(dir, 'absorb-target', { dotpath: 'v1' }), /not absorbable/);
    assert.throws(() => renderSurface(dir, 'plan-topics', { dotpath: 'auth-flow' }), /"auth-flow" has no epic plan to choose from/);
    createManifest(dir, 'v3', { work_type: 'epic', phases: { discussion: { items: { a: { status: 'completed' } } } } });
    assert.throws(() => renderSurface(dir, 'plan-topics', { dotpath: 'v3' }), /"v3" has no epic plan to choose from/);
    assert.throws(() => renderSurface(dir, 'absorb-target', { dotpath: 'ghost' }), /not found/);
  });

  it('plan-summary renders the plan\'s phases and tasks under the item\'s own format, byte-stable', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { planning: { items: { 'topic-a': { status: 'in-progress', format: 'sample-format' } } } },
    });
    const file = '.leeway/.cache/v1/planning/topic-a/plan-summary.json';
    createFile(dir, file, JSON.stringify({ phases: [
      { name: 'Foundation', tasks: [{ id: 'topic-a-1-1', title: 'Wrap the command', done: true }, { id: 'topic-a-1-2', title: 'Drop the wait', done: false, note: 'blocked by topic-a-1-1' }] },
      { name: 'Regression Net', tasks: [] },
    ] }));
    assert.strictEqual(renderSurface(dir, 'plan-summary', { dotpath: 'v1.planning.topic-a', file }), [
      '=== DISPLAY: plan summary (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**Plan: v1 / Topic A**',
      '',
      '**Format:** sample-format',
      '',
      '### Phase 1: Foundation',
      '- [x] topic-a-1-1: Wrap the command',
      '- [ ] topic-a-1-2: Drop the wait — blocked by topic-a-1-1',
      '',
      '### Phase 2: Regression Net',
      '',
    ].join('\n'));
  });

  it('plan-summary refuses a missing payload, a malformed phase or task, and a plan with no format', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { planning: { items: { 'topic-a': { status: 'in-progress', format: 'sample-format' }, bare: { status: 'in-progress' } } } },
    });
    const write = (/** @type {string} */ name, /** @type {unknown} */ payload) => {
      const rel = `.leeway/.cache/v1/planning/topic-a/${name}.json`;
      createFile(dir, rel, JSON.stringify(payload));
      return rel;
    };
    const render = (/** @type {string|undefined} */ file, dotpath = 'v1.planning.topic-a') => renderSurface(dir, 'plan-summary', { dotpath, file });
    assert.throws(() => render(undefined), /--file <payload\.json> is required — the phases and tasks read through the format/);
    assert.throws(() => render(write('a', {})), /"phases" must be an array of \{name, tasks\}/);
    assert.throws(() => render(write('b', { phases: [{ tasks: [] }] })), /phase 1 needs "name", a non-empty string/);
    assert.throws(() => render(write('c', { phases: [{ name: 'P' }] })), /phase 1 needs "tasks", an array/);
    assert.throws(() => render(write('d', { phases: [{ name: 'P', tasks: [{ id: 'x', done: true }] }] })), /phase 1 task 1 needs "title", a non-empty string/);
    assert.throws(() => render(write('e', { phases: [{ name: 'P', tasks: [{ id: 'x', title: 't', done: 'yes' }] }] })), /phase 1 task 1 needs "done", true or false/);
    assert.throws(() => render(write('f', { phases: [{ name: 'P', tasks: [{ id: 'x', title: 't', done: false, note: '' }] }] })), /"note" must be a non-empty string when present/);
    const ok = write('g', { phases: [] });
    assert.throws(() => render(ok, 'v1.planning.bare'), /planning item "bare" records no format/);
    assert.throws(() => render(ok, 'v1.planning.ghost'), /no planning item "ghost"/);
    assert.throws(() => render(ok, 'v1.discussion.topic-a'), /address must be <work_unit>\.planning\.<topic>/);
  });

  it('the absorb confirm gate renders its consent and refuses out of place', () => {
    createManifest(dir, 'auth-flow', {
      phases: { discussion: { items: { 'auth-flow': { status: 'completed' } } } },
    });
    createManifest(dir, 'v1', { work_type: 'epic' });

    assert.strictEqual(renderSurface(dir, 'absorb-confirm-gate', { dotpath: 'auth-flow' }), [
      "=== MENU: absorb confirm gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`◆ Proceed?`**',
      '',
      '**`y/yes`**',
      '**`n/no`**',
      '',
    ].join('\n'));

    assert.throws(() => renderSurface(dir, 'absorb-confirm-gate', { dotpath: 'v1' }), /not absorbable/);
    assert.throws(() => renderSurface(dir, 'absorb-confirm-gate', { dotpath: 'ghost' }), /not found/);
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

  it('the menu is the list — completed then cancelled, numbered continuously, each closing phase its tail', () => {
    const v = completedView(closedFixture(dir));
    assert.strictEqual(v.data, [
      'completed_count: 2',
      'cancelled_count: 1',
      'UNITS (n  status  work_type  work_unit  last_phase):',
      '  1  completed  cross-cutting  done-cc  specification',
      '  2  completed  feature  done-feat  review',
      '  3  cancelled  bugfix  dropped  none',
    ].join('\n'));
    assert.strictEqual(v.display, undefined, 'no display beside the list');
    assert.strictEqual(v.menu, [
      DOTS,
      '**`◆ Which work unit?`**',
      '',
      '**`1`**      → Done Cc — *completed after specification*',
      '**`2`**      → Done Feat — *completed after review*',
      '**`3`**      → Dropped — *cancelled during none*',
      '**`b/back`** → Return',
    ].join('\n'));
  });

  it('with nothing closed renders the empty display and no menu', () => {
    createManifest(dir, 'auth-flow', {});
    const v = completedView(startDetail(dir));
    assert.strictEqual(v.display, 'No completed or cancelled work units found.\n');
    assert.strictEqual(v.menu, undefined);
    assert.deepStrictEqual(v.rows, []);
  });

  it('the action menu renders over the selected unit, and refuses one the list never holds', () => {
    const { renderSurface } = require('../../skills/leeway-engine/scripts/domain/render.cjs');
    closedFixture(dir);

    assert.strictEqual(renderSurface(dir, 'completed-actions', { dotpath: 'done-feat' }), [
      "=== MENU: completed actions (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**Done Feat** (completed)',
      '',
      '**`◆ What would you like to do?`**',
      '',
      '**`r/reactivate`** → Set status back to in-progress',
      '**`b/back`**       → Return to the list',
      '**Ask**          → Ask a question about this work unit',
      '',
    ].join('\n'));

    assert.match(renderSurface(dir, 'completed-actions', { dotpath: 'dropped' }), /\*\*Dropped\*\* \(cancelled\)/);
    createManifest(dir, 'live-one', {});
    assert.throws(() => renderSurface(dir, 'completed-actions', { dotpath: 'live-one' }),
      /render completed-actions: "live-one" is not completed or cancelled \(status: in-progress\)/);
    assert.throws(() => renderSurface(dir, 'completed-actions', { dotpath: 'ghost' }),
      /render completed-actions: work unit "ghost" not found/);
  });
});
