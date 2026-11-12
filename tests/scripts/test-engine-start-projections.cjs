'use strict';

// ---------------------------------------------------------------------------
// The start skill's projections (leeway-engine/scripts/domain/projections/
// start.cjs, read through start.cjs and inbox-set.cjs): the inbox pickup,
// the archived store, the working set and its gates, and the completed and
// cancelled action menu — each a golden of the screen whole, its gate
// payload held to the menu it states (gate-audit.cjs).
//
// Layer: verb, each projection called in process over the state the start
// reads. World: the project world (`setupFixture`), copied for each test,
// its manifests and inbox files written by hand in the shapes the discovery
// suites produce.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { startDetail } = require('../../skills/leeway-engine/scripts/domain/start.cjs');
const {
  inboxPickupView,
  archivedView,
  workingSetView,
  workingSetAddGate,
  workingSetDropGate,
} = require('../../skills/leeway-engine/scripts/domain/projections/start.cjs');
const { combinedInbox, workingSetDetail } = require('../../skills/leeway-engine/scripts/domain/inbox-set.cjs');
const { auditingRender } = require('./gate-audit.cjs');

const renderSurface = auditingRender(require('../../skills/leeway-engine/scripts/domain/render.cjs').renderSurface);

// Menu label continuations indent with non-breaking spaces (the worklist
// rule) — goldens spell them explicitly.
const NB = (n) => '\u00a0'.repeat(n);

// Golden tests: byte-exact expected strings for the leeway overview
// and menu projections. Fixtures go through real manifests and inbox files in
// temp dirs (the same shapes the discovery tests produce).

const DOTS = '· · · · · · · · · · · ·';

describe('start projections: inbox pickup', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function pickup(d) {
    const detail = startDetail(d);
    return inboxPickupView(combinedInbox(detail.inbox), detail.inbox.archived.total_count > 0);
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

describe('start projections: the completed and cancelled action menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function closedFixture(d) {
    createManifest(d, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(d, 'done-cc', { work_type: 'cross-cutting', status: 'completed', phases: { specification: { items: { 'done-cc': { status: 'completed' } } } } });
    createManifest(d, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
  }

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
