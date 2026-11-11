'use strict';

// Layer: verb.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover } = require('../../skills/leeway/scripts/gateway.cjs');

const ADAPTER = path.join(__dirname, '../../skills/leeway/scripts/gateway.cjs');

describe('leeway discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @param {{work_units: {name: string}[]}} group */
  const names = (group) => group.work_units.map(({ name }) => name);

  it('lists nothing when no work units exist', () => {
    const r = discover(dir);
    assert.deepStrictEqual([r.epics, r.features, r.bugfixes, r.quick_fixes].map(names), [[], [], [], []]);
    assert.deepStrictEqual([r.completed, r.cancelled], [[], []]);
  });

  it('groups the units in progress by type, the closed ones apart', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'dark-mode', { work_type: 'feature' });
    createManifest(dir, 'login-crash', { work_type: 'bugfix' });
    createManifest(dir, 'rename-api', { work_type: 'quick-fix' });
    createManifest(dir, 'shipped', { work_type: 'epic', status: 'completed', phases: { review: { items: { a: { status: 'completed' } } } } });
    createManifest(dir, 'old', { work_type: 'feature', status: 'completed' });
    const r = discover(dir);
    assert.deepStrictEqual([r.epics, r.features, r.bugfixes, r.quick_fixes].map(names), [['v1'], ['dark-mode'], ['login-crash'], ['rename-api']]);
    assert.deepStrictEqual(r.features.work_units[0], { name: 'dark-mode', work_type: 'feature' });
  });

  it('an epic stays listed with one topic reviewed and others mid-pipeline, and a feature in review is never filtered out', () => {
    createManifest(dir, 'mint', {
      work_type: 'epic',
      phases: {
        planning: {
          items: {
            'cli-presentation': { status: 'completed' },
            'mint-release-tool': { status: 'completed' },
            'commit-command': { status: 'completed' },
          },
        },
        implementation: { items: { 'cli-presentation': { status: 'completed' } } },
        review: { items: { 'cli-presentation': { status: 'completed' } } },
      },
    });
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
    assert.deepStrictEqual([names(r.epics), names(r.features)], [['mint'], ['auth']]);
  });

  it('lists the completed and the cancelled units apart, each with the phase it closed in', () => {
    createManifest(dir, 'done-feat', { work_type: 'feature', status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(dir, 'cancelled-bug', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { 'cancelled-bug': { status: 'completed' } } } } });
    createManifest(dir, 'active-feat', { work_type: 'feature', phases: { discussion: { items: { 'active-feat': { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.deepStrictEqual(r.completed, [{ name: 'done-feat', work_type: 'feature', status: 'completed', last_phase: 'review' }]);
    assert.deepStrictEqual(r.cancelled, [{ name: 'cancelled-bug', work_type: 'bugfix', status: 'cancelled', last_phase: 'investigation' }]);
  });

  it('discovers inbox quickfixes', () => {
    createFile(dir, '.leeway/.inbox/quickfixes/2026-03-28--replace-interface.md', '# Replace Interface\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.quickfix_count, 1);
    assert.strictEqual(r.inbox.quickfixes[0].slug, 'replace-interface');
    assert.strictEqual(r.inbox.quickfixes[0].date, '2026-03-28');
    assert.strictEqual(r.inbox.quickfixes[0].title, 'Replace Interface');
  });

  it('includes quickfixes in inbox total_count', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-03-19--idea.md', '# Idea\n\nContent.');
    createFile(dir, '.leeway/.inbox/quickfixes/2026-03-28--qf.md', '# QF\n\nContent.');
    assert.strictEqual(discover(dir).inbox.total_count, 2);
  });

  it('discovers inbox ideas', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry Logic\n\nSome idea content.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.ideas[0].slug, 'smart-retry');
    assert.strictEqual(r.inbox.ideas[0].date, '2026-03-19');
    assert.strictEqual(r.inbox.ideas[0].title, 'Smart Retry Logic');
  });

  it('discovers inbox bugs', () => {
    createFile(dir, '.leeway/.inbox/bugs/2026-03-18--login-timeout.md', '# Login Timeout\n\nBug details.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.bug_count, 1);
    assert.strictEqual(r.inbox.bugs[0].slug, 'login-timeout');
    assert.strictEqual(r.inbox.bugs[0].date, '2026-03-18');
    assert.strictEqual(r.inbox.bugs[0].title, 'Login Timeout');
  });

  it('discovers mixed inbox ideas and bugs', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-03-19--idea-one.md', '# Idea One\n\nContent.');
    createFile(dir, '.leeway/.inbox/ideas/2026-03-20--idea-two.md', '# Idea Two\n\nContent.');
    createFile(dir, '.leeway/.inbox/bugs/2026-03-18--bug-one.md', '# Bug One\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 2);
    assert.strictEqual(r.inbox.bug_count, 1);
    assert.strictEqual(r.inbox.total_count, 3);
  });

  it('returns empty inbox when no inbox directory exists', () => {
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 0);
    assert.strictEqual(r.inbox.bug_count, 0);
    assert.strictEqual(r.inbox.total_count, 0);
  });

  it('skips inbox files that do not match expected filename format', () => {
    createFile(dir, '.leeway/.inbox/ideas/random-notes.md', '# Random\n\nContent.');
    createFile(dir, '.leeway/.inbox/ideas/2026-03-19--valid-idea.md', '# Valid Idea\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.ideas[0].slug, 'valid-idea');
  });

  it('falls back to slug when file has no H1 title', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-03-19--no-title.md', 'Just some content without a heading.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.ideas[0].title, 'no-title');
  });

  it('discovers archived items nested under inbox.archived', () => {
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-03-19--old-idea.md', '# Old Idea\n\nContent.');
    createFile(dir, '.leeway/.inbox/.archived/bugs/2026-03-18--old-bug.md', '# Old Bug\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.archived.idea_count, 1);
    assert.strictEqual(r.inbox.archived.bug_count, 1);
    assert.strictEqual(r.inbox.archived.total_count, 2);
    assert.strictEqual(r.inbox.archived.ideas[0].slug, 'old-idea');
    assert.strictEqual(r.inbox.archived.ideas[0].title, 'Old Idea');
  });

  it('archived items do not count toward live inbox totals', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-03-20--live.md', '# Live\n\nContent.');
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-03-19--archived.md', '# Archived\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.total_count, 1);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.archived.total_count, 1);
  });

  it('returns empty archived when no archived directory exists', () => {
    assert.strictEqual(discover(dir).inbox.archived.total_count, 0);
  });
});

describe('leeway sub-view sections', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @param {string[]} args */
  function run(args) {
    return execFileSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
  }

  it('every list sub-view carries its heading as TITLE, above a display that opens on the list', () => {
    createFile(dir, '.leeway/.inbox/bugs/2026-06-01--login-timeout.md', '# Login Timeout\n');

    for (const [args, title, firstDisplayLine] of /** @type {[string[], string, string][]} */ ([
      [['inbox'], 'Inbox', 'Bugs'],
      [['working-set', '.leeway/.inbox/bugs/2026-06-01--login-timeout.md'], 'Working Set (1 item)', '  └─ Login Timeout [bug]'],
    ])) {
      const out = run(args);
      assert.ok(out.includes(`# **\`■ ${title}\`**`), `${args[0]}: ${out}`);
      const display = out.split('=== DISPLAY (emit verbatim as a text code block (```text fence)) ===\n')[1];
      assert.ok(display, `${args[0]} has no DISPLAY section: ${out}`);
      assert.strictEqual(display.split('\n')[0], firstDisplayLine, `${args[0]}: ${out}`);
      assert.ok(!display.startsWith(title), `${args[0]} redraws its heading inside the fence: ${out}`);
    }
  });

  it('a pick sub-view lists its rows in the menu alone — TITLE then MENU, the display only when there is nothing to pick', () => {
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    createManifest(dir, 'auth-flow', { phases: { discussion: { items: { 'auth-flow': { status: 'in-progress' } } } } });
    createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });

    for (const [args, title, gate, firstRow] of /** @type {[string[], string, string, string][]} */ ([
      [['archived'], 'Archived', 'archived pick', '**`1`**      → Old Idea — *idea, 2026-05-01*'],
      [['manage'], 'Manage', 'manage pick', '**`1`**      → Auth Flow — *feature*'],
      [['completed'], 'Completed & Cancelled', 'completed pick', '**`1`**      → Done Feat — *completed after review*'],
    ])) {
      const out = run(args);
      assert.ok(out.includes(`=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===\n# **\`■ ${title}\`**\n\n=== MENU: ${gate} (emit verbatim as markdown (not a code block)) ===\n`), `${args[0]}: ${out}`);
      assert.ok(!out.includes('=== DISPLAY'), `${args[0]} draws a display beside its list: ${out}`);
      assert.ok(out.includes(`\n${firstRow}\n`), `${args[0]}: ${out}`);
    }

    fs.rmSync(path.join(dir, '.leeway', 'done-feat'), { recursive: true });
    const empty = run(['completed']);
    assert.ok(empty.includes('=== DISPLAY (emit verbatim as a text code block (```text fence)) ===\nNo completed or cancelled work units found.\n'), empty);
    assert.ok(!empty.includes('=== MENU'), empty);
  });

  it('an empty inbox answers its display and no gate — the flow returns without a pick', () => {
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    const out = run(['inbox']);
    assert.ok(out.includes('inbox_count: 0\n'), out);
    assert.ok(out.includes('=== DISPLAY (emit verbatim as a text code block (```text fence)) ===\nNo inbox items.\n'), out);
    assert.ok(!out.includes('=== MENU'), out);
  });

  it('a call naming no verb is refused with the usage, every verb in it', () => {
    const res = spawnSync('node', [ADAPTER], { cwd: dir, encoding: 'utf8' });
    assert.deepStrictEqual([res.status, res.stdout, res.stderr], [1, '',
      'Error: a verb is required\nUsage: gateway.cjs <inbox|archived|working-set|working-set-add-gate|working-set-drop-gate|manage|completed> [args…]\n']);
  });

  it('the inbox offers the archived items once one is archived, and only then', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-05-02--live-idea.md', '# Live Idea\n');
    const before = run(['inbox']);
    assert.ok(before.includes('has_archived: false\n') && !before.includes('a/archived'), before);
    createFile(dir, '.leeway/.inbox/.archived/quickfixes/2026-03-28--gone.md', '# Gone\n');
    const after = run(['inbox']);
    assert.ok(after.includes('has_archived: true\n') && after.includes('**`a/archived`** → View archived items (restore or delete)'), after);
  });

  it('a set of any mix offers work and the roadmap row, its pre-seed the largest shape in it — never a blocker', () => {
    const IDEA = '.leeway/.inbox/ideas/2026-06-02--smart-retry.md';
    const BUG = '.leeway/.inbox/bugs/2026-06-01--login-timeout.md';
    const QUICKFIX = '.leeway/.inbox/quickfixes/2026-06-03--tidy-logs.md';
    createFile(dir, IDEA, '# Smart Retry\n');
    createFile(dir, BUG, '# Login Timeout\n');
    createFile(dir, QUICKFIX, '# Tidy Logs\n');

    for (const [set, type] of /** @type {[string[], string][]} */ ([
      [[BUG, QUICKFIX, IDEA], 'none'],
      [[QUICKFIX, BUG], 'bugfix'],
      [[QUICKFIX], 'quick-fix'],
    ])) {
      const out = run(['working-set', ...set]);
      assert.ok(out.includes(`\nset_type: ${type}\n`), out);
      assert.ok(!out.includes('set_uniform'), out);
      assert.ok(out.includes('**`w/work`**'), out);
      assert.ok(out.includes('**`o/roadmap`** → Move the set out of the inbox onto the roadmap'), out);
      assert.ok(!out.includes('blocker') && !out.includes('⚑'), out);
      assert.ok(out.trimEnd().endsWith('**Ask**       → Ask about the set'), 'the menu closes the snapshot');
    }
  });

  it('the add and drop gates render on demand over the caller-held set — never on the snapshot', () => {
    createFile(dir, '.leeway/.inbox/bugs/2026-06-01--login-timeout.md', '# Login Timeout\n');
    createFile(dir, '.leeway/.inbox/ideas/2026-06-02--smart-retry.md', '# Smart Retry\n');
    const set = ['.leeway/.inbox/bugs/2026-06-01--login-timeout.md'];

    const snapshot = run(['working-set', ...set]);
    assert.ok(!snapshot.includes('add gate') && !snapshot.includes('drop gate'),
      'the snapshot carries no gate sections');

    const add = run(['working-set-add-gate', ...set]);
    assert.ok(add.startsWith('=== MENU: add gate') && !add.includes('DISPLAY'), add);
    assert.ok(add.includes('Smart Retry — *idea, 2026-06-02*'), 'candidates computed fresh from the same paths');

    const drop = run(['working-set-drop-gate', ...set]);
    assert.ok(drop.startsWith('=== MENU: drop gate') && !drop.includes('DISPLAY'), drop);
    assert.ok(drop.includes('Login Timeout — *bug*'), drop);
  });
});
