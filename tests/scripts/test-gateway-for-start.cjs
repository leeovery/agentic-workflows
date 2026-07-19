'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-start/scripts/gateway.cjs');

describe('workflow-start discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty state when no work units exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, false);
    assert.strictEqual(r.state.epic_count, 0);
    assert.strictEqual(r.state.feature_count, 0);
    assert.strictEqual(r.state.bugfix_count, 0);
  });

  it('groups work units by type', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'dark-mode', { work_type: 'feature' });
    createManifest(dir, 'login-crash', { work_type: 'bugfix' });
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, true);
    assert.strictEqual(r.state.epic_count, 1);
    assert.strictEqual(r.state.feature_count, 1);
    assert.strictEqual(r.state.bugfix_count, 1);
    assert.strictEqual(r.epics.work_units[0].name, 'v1');
    assert.strictEqual(r.features.work_units[0].name, 'dark-mode');
    assert.strictEqual(r.bugfixes.work_units[0].name, 'login-crash');
  });

  it('computes next_phase for feature pipeline', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.features.work_units[0].next_phase, 'specification');
    assert.strictEqual(r.features.work_units[0].phase_label, 'ready for specification');
  });

  it('computes next_phase for bugfix pipeline', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { crash: { status: 'in-progress' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.bugfixes.work_units[0].next_phase, 'investigation');
    assert.strictEqual(r.bugfixes.work_units[0].phase_label, 'investigation (in-progress)');
  });

  it('surfaces a finished pipeline still in-progress as finalising work', () => {
    createManifest(dir, 'done-feature', {
      work_type: 'feature',
      phases: {
        discussion: { items: { 'done-feature': { status: 'completed' } } },
        specification: { items: { 'done-feature': { status: 'completed' } } },
        planning: { items: { 'done-feature': { status: 'completed' } } },
        implementation: { items: { 'done-feature': { status: 'completed' } } },
        review: { items: { 'done-feature': { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, true);
    assert.strictEqual(r.features.count, 1);
    assert.strictEqual(r.features.work_units[0].next_phase, 'done');
    assert.strictEqual(r.features.work_units[0].finalising, true);
  });

  it('epic stays active when one topic completes review with others mid-pipeline', () => {
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
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, true);
    assert.strictEqual(r.state.epic_count, 1);
    assert.strictEqual(r.epics.work_units[0].name, 'mint');
  });

  it('epic with completed status is not listed as active', () => {
    createManifest(dir, 'shipped', {
      work_type: 'epic',
      status: 'completed',
      phases: { review: { items: { a: { status: 'completed' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.state.epic_count, 0);
  });

  it('skips archived work units', () => {
    createManifest(dir, 'old', { work_type: 'feature', status: 'completed' });
    createManifest(dir, 'active', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.state.feature_count, 1);
    assert.strictEqual(r.features.work_units[0].name, 'active');
  });

  it('handles multiple features', () => {
    createManifest(dir, 'a', { work_type: 'feature', phases: { discussion: { items: { a: { status: 'in-progress' } } } } });
    createManifest(dir, 'b', { work_type: 'feature', phases: { specification: { items: { b: { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.state.feature_count, 2);
    assert.strictEqual(r.features.work_units.length, 2);
  });

  it('epic includes active_phases', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { items: { exploration: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.epics.work_units[0].active_phases, ['research', 'discussion', 'specification']);
  });

  it('epic with no phases has empty active_phases', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const r = discover(dir);
    assert.deepStrictEqual(r.epics.work_units[0].active_phases, []);
  });

  it('feature/bugfix units include phase_label', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { crash: { status: 'completed' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.features.work_units[0].phase_label, 'discussion (in-progress)');
    assert.strictEqual(r.bugfixes.work_units[0].phase_label, 'ready for specification');
  });

  it('mixed active and finalising in same type lists both', () => {
    createManifest(dir, 'active-feat', {
      work_type: 'feature',
      phases: { discussion: { items: { 'active-feat': { status: 'in-progress' } } } },
    });
    createManifest(dir, 'done-feat', {
      work_type: 'feature',
      phases: {
        discussion: { items: { 'done-feat': { status: 'completed' } } },
        specification: { items: { 'done-feat': { status: 'completed' } } },
        planning: { items: { 'done-feat': { status: 'completed' } } },
        implementation: { items: { 'done-feat': { status: 'completed' } } },
        review: { items: { 'done-feat': { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.features.count, 2);
    assert.deepStrictEqual(r.features.work_units.map((u) => [u.name, u.finalising]), [
      ['active-feat', false],
      ['done-feat', true],
    ]);
  });

  it('has_any_work counts a finalising unit — only closed units leave it false', () => {
    createManifest(dir, 'archived', { work_type: 'feature', status: 'completed' });
    createManifest(dir, 'done', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { done: { status: 'completed' } } },
        specification: { items: { done: { status: 'completed' } } },
        planning: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, true);
    assert.strictEqual(r.bugfixes.work_units[0].finalising, true);
  });

  it('groups quick-fix work units separately', () => {
    createManifest(dir, 'rename-api', { work_type: 'quick-fix' });
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.state.quickfix_count, 1);
    assert.strictEqual(r.quick_fixes.work_units[0].name, 'rename-api');
    assert.strictEqual(r.state.feature_count, 1);
    assert.strictEqual(r.state.has_any_work, true);
  });

  it('quick-fix includes phase_label', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.quick_fixes.work_units[0].phase_label, 'scoping (in-progress)');
  });

  it('quick-fix done is surfaced as finalising', () => {
    createManifest(dir, 'done-qf', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'done-qf': { status: 'completed' } } },
        implementation: { items: { 'done-qf': { status: 'completed' } } },
        review: { items: { 'done-qf': { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.quick_fixes.count, 1);
    assert.strictEqual(r.quick_fixes.work_units[0].finalising, true);
  });

  it('discovers inbox quickfixes', () => {
    createFile(dir, '.workflows/.inbox/quickfixes/2026-03-28--replace-interface.md', '# Replace Interface\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.quickfix_count, 1);
    assert.strictEqual(r.inbox.quickfixes[0].slug, 'replace-interface');
    assert.strictEqual(r.inbox.quickfixes[0].date, '2026-03-28');
    assert.strictEqual(r.inbox.quickfixes[0].title, 'Replace Interface');
  });

  it('includes quickfixes in inbox total_count', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--idea.md', '# Idea\n\nContent.');
    createFile(dir, '.workflows/.inbox/quickfixes/2026-03-28--qf.md', '# QF\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.total_count, 2);
    assert.strictEqual(r.state.inbox_count, 2);
  });

  it('groups cross-cutting work units separately', () => {
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.state.cross_cutting_count, 1);
    assert.strictEqual(r.cross_cutting.work_units[0].name, 'caching');
    assert.strictEqual(r.state.feature_count, 1);
    assert.strictEqual(r.state.has_any_work, true);
  });

  it('cross-cutting includes phase_label', () => {
    createManifest(dir, 'caching', {
      work_type: 'cross-cutting',
      phases: { discussion: { items: { caching: { status: 'in-progress' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.cross_cutting.work_units[0].phase_label, 'discussion (in-progress)');
  });

  it('cross-cutting done is surfaced as finalising', () => {
    createManifest(dir, 'done-cc', {
      work_type: 'cross-cutting',
      phases: {
        discussion: { items: { 'done-cc': { status: 'completed' } } },
        specification: { items: { 'done-cc': { status: 'completed' } } },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.cross_cutting.count, 1);
    assert.strictEqual(r.cross_cutting.work_units[0].finalising, true);
  });

  it('cross-cutting completed shows in completed array', () => {
    createManifest(dir, 'done-cc', { work_type: 'cross-cutting', status: 'completed' });
    const r = discover(dir);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].work_type, 'cross-cutting');
  });

  it('epic active_phases ignores flat status with no items', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { status: 'in-progress' } },
    });
    const r = discover(dir);
    assert.deepStrictEqual(r.epics.work_units[0].active_phases, []);
  });

  it('includes completed work units in separate array', () => {
    createManifest(dir, 'done-feat', { work_type: 'feature', status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(dir, 'active-feat', { work_type: 'feature', phases: { discussion: { items: { 'active-feat': { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.completed_count, 1);
    assert.strictEqual(r.completed[0].name, 'done-feat');
    assert.strictEqual(r.completed[0].work_type, 'feature');
    assert.strictEqual(r.completed[0].last_phase, 'review');
  });

  it('includes cancelled work units in separate array', () => {
    createManifest(dir, 'cancelled-bug', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { 'cancelled-bug': { status: 'completed' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.cancelled_count, 1);
    assert.strictEqual(r.cancelled[0].name, 'cancelled-bug');
    assert.strictEqual(r.cancelled[0].last_phase, 'investigation');
  });

  it('completed and cancelled counts are zero when none exist', () => {
    createManifest(dir, 'active', { work_type: 'feature', phases: { discussion: { items: { active: { status: 'in-progress' } } } } });
    const r = discover(dir);
    assert.strictEqual(r.completed_count, 0);
    assert.strictEqual(r.cancelled_count, 0);
  });

  it('feature in review (in-progress) is not filtered out', () => {
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
    assert.strictEqual(r.features.count, 1);
    assert.strictEqual(r.features.work_units[0].next_phase, 'review');
  });

  it('discovers inbox ideas', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry Logic\n\nSome idea content.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.ideas[0].slug, 'smart-retry');
    assert.strictEqual(r.inbox.ideas[0].date, '2026-03-19');
    assert.strictEqual(r.inbox.ideas[0].title, 'Smart Retry Logic');
    assert.strictEqual(r.state.has_inbox, true);
    assert.strictEqual(r.state.inbox_count, 1);
  });

  it('discovers inbox bugs', () => {
    createFile(dir, '.workflows/.inbox/bugs/2026-03-18--login-timeout.md', '# Login Timeout\n\nBug details.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.bug_count, 1);
    assert.strictEqual(r.inbox.bugs[0].slug, 'login-timeout');
    assert.strictEqual(r.inbox.bugs[0].date, '2026-03-18');
    assert.strictEqual(r.inbox.bugs[0].title, 'Login Timeout');
    assert.strictEqual(r.state.has_inbox, true);
  });

  it('discovers mixed inbox ideas and bugs', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--idea-one.md', '# Idea One\n\nContent.');
    createFile(dir, '.workflows/.inbox/ideas/2026-03-20--idea-two.md', '# Idea Two\n\nContent.');
    createFile(dir, '.workflows/.inbox/bugs/2026-03-18--bug-one.md', '# Bug One\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 2);
    assert.strictEqual(r.inbox.bug_count, 1);
    assert.strictEqual(r.inbox.total_count, 3);
    assert.strictEqual(r.state.inbox_count, 3);
  });

  it('returns empty inbox when no inbox directory exists', () => {
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 0);
    assert.strictEqual(r.inbox.bug_count, 0);
    assert.strictEqual(r.inbox.total_count, 0);
    assert.strictEqual(r.state.has_inbox, false);
    assert.strictEqual(r.state.inbox_count, 0);
  });

  it('skips inbox files that do not match expected filename format', () => {
    createFile(dir, '.workflows/.inbox/ideas/random-notes.md', '# Random\n\nContent.');
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--valid-idea.md', '# Valid Idea\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.ideas[0].slug, 'valid-idea');
  });

  it('falls back to slug when file has no H1 title', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--no-title.md', 'Just some content without a heading.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.ideas[0].title, 'no-title');
  });

  it('discovers archived items nested under inbox.archived', () => {
    createFile(dir, '.workflows/.inbox/.archived/ideas/2026-03-19--old-idea.md', '# Old Idea\n\nContent.');
    createFile(dir, '.workflows/.inbox/.archived/bugs/2026-03-18--old-bug.md', '# Old Bug\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.archived.idea_count, 1);
    assert.strictEqual(r.inbox.archived.bug_count, 1);
    assert.strictEqual(r.inbox.archived.total_count, 2);
    assert.strictEqual(r.inbox.archived.ideas[0].slug, 'old-idea');
    assert.strictEqual(r.inbox.archived.ideas[0].title, 'Old Idea');
  });

  it('archived items do not count toward live inbox totals', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-20--live.md', '# Live\n\nContent.');
    createFile(dir, '.workflows/.inbox/.archived/ideas/2026-03-19--archived.md', '# Archived\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.total_count, 1);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.archived.total_count, 1);
  });

  it('exposes has_archived and archived_count in state', () => {
    createFile(dir, '.workflows/.inbox/.archived/quickfixes/2026-03-28--gone.md', '# Gone\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.state.has_archived, true);
    assert.strictEqual(r.state.archived_count, 1);
  });

  it('returns empty archived when no archived directory exists', () => {
    const r = discover(dir);
    assert.strictEqual(r.inbox.archived.total_count, 0);
    assert.strictEqual(r.state.has_archived, false);
    assert.strictEqual(r.state.archived_count, 0);
  });
});

describe('workflow-start format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('empty project pins the full dump byte-exactly', () => {
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== EPICS ===',
      '=== FEATURES ===',
      '=== BUGFIXES ===',
      '=== QUICK-FIXES ===',
      '=== CROSS-CUTTING ===',
      '=== STATE ===',
      'has_any_work: false',
      'counts: 0 epic, 0 feature, 0 bugfix, 0 quick-fix, 0 cross-cutting',
      'completed_count: 0',
      'cancelled_count: 0',
      'has_inbox: false',
      'inbox_count: 0',
      'has_archived: false',
      'archived_count: 0',
      '',
    ].join('\n'));
  });

  it('populated project pins the full dump byte-exactly', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { items: { exploration: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    createManifest(dir, 'rename-api', { work_type: 'quick-fix', phases: { scoping: { items: { 'rename-api': { status: 'in-progress' } } } } });
    createManifest(dir, 'caching', { work_type: 'cross-cutting', phases: { discussion: { items: { caching: { status: 'in-progress' } } } } });
    createManifest(dir, 'done-feat', { work_type: 'feature', status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { dropped: { status: 'completed' } } } } });
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry\n\nContent.');
    createFile(dir, '.workflows/.inbox/bugs/2026-03-18--login-timeout.md', '# Login Timeout\n\nContent.');
    createFile(dir, '.workflows/.inbox/quickfixes/2026-03-28--bump-dep.md', '# Bump Dep\n\nContent.');
    createFile(dir, '.workflows/.inbox/.archived/ideas/2026-03-01--old-idea.md', '# Old Idea\n\nContent.');
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== EPICS ===',
      '  v1',
      '=== FEATURES ===',
      '  auth',
      '=== BUGFIXES ===',
      '  crash',
      '=== QUICK-FIXES ===',
      '  rename-api',
      '=== CROSS-CUTTING ===',
      '  caching',
      '=== COMPLETED ===',
      '  done-feat (feature, last phase: review)',
      '=== CANCELLED ===',
      '  dropped (bugfix, last phase: investigation)',
      '=== INBOX ===',
      '  smart-retry (idea, 2026-03-19) — Smart Retry',
      '  login-timeout (bug, 2026-03-18) — Login Timeout',
      '  bump-dep (quick-fix, 2026-03-28) — Bump Dep',
      '=== ARCHIVED ===',
      '  old-idea (idea, 2026-03-01) — Old Idea',
      '=== STATE ===',
      'has_any_work: true',
      'counts: 1 epic, 1 feature, 1 bugfix, 1 quick-fix, 1 cross-cutting',
      'completed_count: 1',
      'cancelled_count: 1',
      'has_inbox: true',
      'inbox_count: 3',
      'has_archived: true',
      'archived_count: 1',
      '',
    ].join('\n'));
  });

  it('shows (last phase: none) for a closed unit with nothing completed', () => {
    createManifest(dir, 'never-started', { work_type: 'feature', status: 'cancelled' });
    const out = format(discover(dir));
    assert.ok(out.includes('  never-started (feature, last phase: none)'));
  });

  it('inbox item with no H1 falls back to the slug as its title', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--no-title.md', 'Just some content without a heading.');
    const out = format(discover(dir));
    assert.ok(out.includes('  no-title (idea, 2026-03-19) — no-title'));
  });

  it('omits COMPLETED, CANCELLED, INBOX, and ARCHIVED sections when empty', () => {
    const out = format(discover(dir));
    assert.ok(!out.includes('=== COMPLETED ==='));
    assert.ok(!out.includes('=== CANCELLED ==='));
    assert.ok(!out.includes('=== INBOX ==='));
    assert.ok(!out.includes('=== ARCHIVED ==='));
  });

  it('carries no phase labels or active phases — the view verb owns them', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { items: { exploration: { status: 'completed' } } } },
    });
    createManifest(dir, 'auth', { work_type: 'feature', phases: { discussion: { items: { auth: { status: 'in-progress' } } } } });
    const out = format(discover(dir));
    assert.ok(!out.includes('  v1 ('));
    assert.ok(!out.includes('  auth ('));
  });
});
