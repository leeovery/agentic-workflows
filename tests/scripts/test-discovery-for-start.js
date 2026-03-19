'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover, format } = require('../../skills/workflow-start/scripts/discovery');

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

  it('filters out done work units', () => {
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
    assert.strictEqual(r.state.has_any_work, false);
    assert.strictEqual(r.features.count, 0);
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

  it('mixed active and done in same type only shows active', () => {
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
    assert.strictEqual(r.features.count, 1);
    assert.strictEqual(r.features.work_units[0].name, 'active-feat');
  });

  it('has_any_work is false when only completed and done exist', () => {
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
    assert.strictEqual(r.state.has_any_work, false);
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
    createFile(dir, '.workflows/inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry Logic\n\nSome idea content.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.ideas[0].slug, 'smart-retry');
    assert.strictEqual(r.inbox.ideas[0].date, '2026-03-19');
    assert.strictEqual(r.inbox.ideas[0].title, 'Smart Retry Logic');
    assert.strictEqual(r.state.has_inbox, true);
    assert.strictEqual(r.state.inbox_count, 1);
  });

  it('discovers inbox bugs', () => {
    createFile(dir, '.workflows/inbox/bugs/2026-03-18--login-timeout.md', '# Login Timeout\n\nBug details.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.bug_count, 1);
    assert.strictEqual(r.inbox.bugs[0].slug, 'login-timeout');
    assert.strictEqual(r.inbox.bugs[0].date, '2026-03-18');
    assert.strictEqual(r.inbox.bugs[0].title, 'Login Timeout');
    assert.strictEqual(r.state.has_inbox, true);
  });

  it('discovers mixed inbox ideas and bugs', () => {
    createFile(dir, '.workflows/inbox/ideas/2026-03-19--idea-one.md', '# Idea One\n\nContent.');
    createFile(dir, '.workflows/inbox/ideas/2026-03-20--idea-two.md', '# Idea Two\n\nContent.');
    createFile(dir, '.workflows/inbox/bugs/2026-03-18--bug-one.md', '# Bug One\n\nContent.');
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
    createFile(dir, '.workflows/inbox/ideas/random-notes.md', '# Random\n\nContent.');
    createFile(dir, '.workflows/inbox/ideas/2026-03-19--valid-idea.md', '# Valid Idea\n\nContent.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.idea_count, 1);
    assert.strictEqual(r.inbox.ideas[0].slug, 'valid-idea');
  });

  it('falls back to slug when file has no H1 title', () => {
    createFile(dir, '.workflows/inbox/ideas/2026-03-19--no-title.md', 'Just some content without a heading.');
    const r = discover(dir);
    assert.strictEqual(r.inbox.ideas[0].title, 'no-title');
  });
});

describe('workflow-start format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('includes section headers for all types', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('=== EPICS ==='));
    assert.ok(out.includes('=== FEATURES ==='));
    assert.ok(out.includes('=== BUGFIXES ==='));
    assert.ok(out.includes('=== STATE ==='));
  });

  it('shows (none) for empty sections', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('  (none)'));
  });

  it('includes feature with phase_label', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  auth (discussion (in-progress))'));
  });

  it('includes epic with active_phases', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { items: { exploration: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  v1 (research, discussion)'));
  });

  it('includes has_any_work in state', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('has_any_work: false'));
  });

  it('includes counts in state', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const out = format(discover(dir));
    assert.ok(out.includes('counts: 0 epic, 1 feature, 0 bugfix'));
  });

  it('includes completed_count and cancelled_count', () => {
    createManifest(dir, 'done', { work_type: 'feature', status: 'completed' });
    createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled' });
    const out = format(discover(dir));
    assert.ok(out.includes('completed_count: 1'));
    assert.ok(out.includes('cancelled_count: 1'));
  });

  it('shows zero completed and cancelled when none exist', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('completed_count: 0'));
    assert.ok(out.includes('cancelled_count: 0'));
  });

  it('emits completed work unit details', () => {
    createManifest(dir, 'done-feat', { work_type: 'feature', status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    const out = format(discover(dir));
    assert.ok(out.includes('=== COMPLETED ==='));
    assert.ok(out.includes('  done-feat (feature, last phase: review)'));
  });

  it('emits cancelled work unit details', () => {
    createManifest(dir, 'dropped', { work_type: 'bugfix', status: 'cancelled', phases: { investigation: { items: { dropped: { status: 'completed' } } } } });
    const out = format(discover(dir));
    assert.ok(out.includes('=== CANCELLED ==='));
    assert.ok(out.includes('  dropped (bugfix, last phase: investigation)'));
  });

  it('omits completed/cancelled sections when empty', () => {
    const out = format(discover(dir));
    assert.ok(!out.includes('=== COMPLETED ==='));
    assert.ok(!out.includes('=== CANCELLED ==='));
  });

  it('emits inbox section with ideas and bugs', () => {
    createFile(dir, '.workflows/inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry\n\nContent.');
    createFile(dir, '.workflows/inbox/bugs/2026-03-18--login-timeout.md', '# Login Timeout\n\nContent.');
    const out = format(discover(dir));
    assert.ok(out.includes('=== INBOX ==='));
    assert.ok(out.includes('  ideas: 1'));
    assert.ok(out.includes('  bugs: 1'));
    assert.ok(out.includes('  smart-retry (idea, 2026-03-19)'));
    assert.ok(out.includes('  login-timeout (bug, 2026-03-18)'));
  });

  it('omits inbox section when empty', () => {
    const out = format(discover(dir));
    assert.ok(!out.includes('=== INBOX ==='));
  });

  it('includes has_inbox and inbox_count in state output', () => {
    createFile(dir, '.workflows/inbox/ideas/2026-03-19--idea.md', '# Idea\n\nContent.');
    const out = format(discover(dir));
    assert.ok(out.includes('has_inbox: true'));
    assert.ok(out.includes('inbox_count: 1'));
  });

  it('shows has_inbox false when no inbox items', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('has_inbox: false'));
    assert.ok(out.includes('inbox_count: 0'));
  });
});
