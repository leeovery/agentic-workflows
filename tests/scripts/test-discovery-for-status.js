'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover } = require('../../skills/status/scripts/discovery');

describe('status discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns no work when empty', () => {
    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, false);
    assert.strictEqual(r.work_units.length, 0);
  });

  it('shows full pipeline state for a feature', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      description: 'Auth flow',
      phases: {
        discussion: { status: 'concluded' },
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: {
          status: 'in-progress',
          current_phase: 1,
          completed_tasks: ['auth-1-1'],
        },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/tasks/auth-1-1.md', '');
    createFile(dir, '.workflows/auth/planning/auth/tasks/auth-1-2.md', '');

    const r = discover(dir);
    assert.strictEqual(r.state.has_any_work, true);
    const u = r.work_units[0];
    assert.strictEqual(u.name, 'auth');
    assert.strictEqual(u.discussion.status, 'concluded');
    assert.strictEqual(u.specification.status, 'concluded');
    assert.strictEqual(u.specification.type, 'feature');
    assert.strictEqual(u.planning.format, 'local-markdown');
    assert.strictEqual(u.implementation.status, 'in-progress');
    assert.strictEqual(u.implementation.completed_tasks, 1);
    assert.strictEqual(u.implementation.total_tasks, 2);
  });

  it('aggregates counts by work type', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    createManifest(dir, 'auth', { work_type: 'feature' });
    createManifest(dir, 'dark', { work_type: 'feature' });
    createManifest(dir, 'crash', { work_type: 'bugfix' });

    const r = discover(dir);
    assert.strictEqual(r.counts.by_work_type.epic, 1);
    assert.strictEqual(r.counts.by_work_type.feature, 2);
    assert.strictEqual(r.counts.by_work_type.bugfix, 1);
  });

  it('counts research files', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { status: 'concluded' } },
    });
    createFile(dir, '.workflows/v1/research/market.md', '# Market');
    createFile(dir, '.workflows/v1/research/tech.md', '# Tech');

    const r = discover(dir);
    assert.strictEqual(r.work_units[0].research.file_count, 2);
    assert.strictEqual(r.counts.research, 1);
  });

  it('counts discussion statuses', () => {
    createManifest(dir, 'a', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    createManifest(dir, 'b', {
      work_type: 'feature',
      phases: { discussion: { status: 'in-progress' } },
    });

    const r = discover(dir);
    assert.strictEqual(r.counts.discussion.total, 2);
    assert.strictEqual(r.counts.discussion.concluded, 1);
    assert.strictEqual(r.counts.discussion.in_progress, 1);
  });

  it('separates feature and cross-cutting specs', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { specification: { status: 'concluded', type: 'feature' } },
    });
    createManifest(dir, 'caching', {
      work_type: 'feature',
      phases: { specification: { status: 'concluded', type: 'cross-cutting' } },
    });

    const r = discover(dir);
    assert.strictEqual(r.counts.specification.feature, 1);
    assert.strictEqual(r.counts.specification.crosscutting, 1);
    assert.strictEqual(r.counts.specification.active, 2);
  });

  it('excludes superseded specs from counts', () => {
    createManifest(dir, 'old', {
      work_type: 'feature',
      phases: { specification: { status: 'superseded', superseded_by: 'new' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.counts.specification.active, 0);
  });

  it('tracks external dependencies', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        planning: {
          status: 'concluded',
          format: 'local-markdown',
          external_dependencies: {
            core: { state: 'unresolved', task_id: 'core-1' },
          },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.work_units[0].planning.has_unresolved_deps, true);
    assert.strictEqual(r.work_units[0].planning.external_deps.length, 1);
  });

  it('includes spec sources', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        specification: {
          status: 'concluded',
          type: 'feature',
          sources: { 'auth-discussion': { status: 'incorporated' } },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.work_units[0].specification.sources.length, 1);
    assert.strictEqual(r.work_units[0].specification.sources[0].name, 'auth-discussion');
  });

  it('returns empty counts when no work units', () => {
    const r = discover(dir);
    assert.ok(r.counts);
    assert.strictEqual(r.counts.by_work_type.epic, 0);
    assert.strictEqual(r.counts.by_work_type.feature, 0);
    assert.strictEqual(r.counts.by_work_type.bugfix, 0);
    assert.strictEqual(r.counts.research, 0);
    assert.strictEqual(r.counts.discussion.total, 0);
    assert.strictEqual(r.counts.specification.active, 0);
    assert.strictEqual(r.counts.planning.total, 0);
    assert.strictEqual(r.counts.implementation.total, 0);
  });

  it('handles investigation status for bugfix', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'concluded' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.work_units[0].investigation.status, 'concluded');
  });

  it('tracks review status', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { review: { status: 'completed' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.work_units[0].review.status, 'completed');
  });

  it('handles sources as array format', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        specification: {
          status: 'concluded',
          type: 'feature',
          sources: [{ name: 'auth-disc', status: 'incorporated' }],
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.work_units[0].specification.sources.length, 1);
    assert.strictEqual(r.work_units[0].specification.sources[0].name, 'auth-disc');
  });

  it('superseded_by tracked in specification', () => {
    createManifest(dir, 'old', {
      work_type: 'feature',
      phases: {
        specification: { status: 'superseded', superseded_by: 'new-spec' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.work_units[0].specification.superseded_by, 'new-spec');
  });

  it('planning in-progress counted', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { planning: { status: 'in-progress', format: 'local-markdown' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.counts.planning.in_progress, 1);
    assert.strictEqual(r.counts.planning.total, 1);
  });

  it('implementation completed counted', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { implementation: { status: 'completed' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.counts.implementation.completed, 1);
  });

  it('description field included', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      description: 'Auth flow feature',
    });
    const r = discover(dir);
    assert.strictEqual(r.work_units[0].description, 'Auth flow feature');
  });
});
