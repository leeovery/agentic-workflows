'use strict';

// Layer: verb.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createFile } = require('./discovery-test-utils.cjs');
const { discover } = require('../../skills/leeway/scripts/gateway.cjs');

const ADAPTER = path.join(__dirname, '../../skills/leeway/scripts/gateway.cjs');

describe('leeway discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

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

  it('a pick sub-view lists its rows in the menu alone — TITLE then MENU', () => {
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');

    for (const [args, title, gate, firstRow] of /** @type {[string[], string, string, string][]} */ ([
      [['archived'], 'Archived', 'archived pick', '**`1`**      → Old Idea — *idea, 2026-05-01*'],
    ])) {
      const out = run(args);
      assert.ok(out.includes(`=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===\n# **\`■ ${title}\`**\n\n=== MENU: ${gate} (emit verbatim as markdown (not a code block)) ===\n`), `${args[0]}: ${out}`);
      assert.ok(!out.includes('=== DISPLAY'), `${args[0]} draws a display beside its list: ${out}`);
      assert.ok(out.includes(`\n${firstRow}\n`), `${args[0]}: ${out}`);
    }

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
      'Error: a verb is required\nUsage: gateway.cjs <inbox|archived|working-set|working-set-add-gate|working-set-drop-gate> [args…]\n']);
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
