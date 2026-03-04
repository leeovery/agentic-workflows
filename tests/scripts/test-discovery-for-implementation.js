'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover } = require('../../skills/start-implementation/scripts/discovery');

describe('start-implementation discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns no_plans when no work units exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'no_plans');
    assert.strictEqual(r.plans.exists, false);
  });

  it('finds plans with planning.md files', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.plans.exists, true);
    assert.strictEqual(r.plans.files.length, 1);
    assert.strictEqual(r.state.scenario, 'single_plan');
  });

  it('tracks implementation state', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: {
          status: 'in-progress',
          current_phase: 1,
          completed_phases: ['Phase 1'],
          completed_tasks: ['auth-1-1', 'auth-1-2'],
        },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.implementation.exists, true);
    assert.strictEqual(r.implementation.files[0].status, 'in-progress');
    assert.strictEqual(r.implementation.files[0].completed_tasks.length, 2);
  });

  it('detects unresolved dependencies', () => {
    createManifest(dir, 'advanced', {
      phases: {
        planning: {
          status: 'concluded',
          format: 'local-markdown',
          external_dependencies: {
            core: { state: 'unresolved', task_id: 'core-1-1' },
          },
        },
      },
    });
    createFile(dir, '.workflows/advanced/planning/advanced/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].has_unresolved_deps, true);
    assert.strictEqual(r.plans.files[0].unresolved_dep_count, 1);
    assert.strictEqual(r.plans.files[0].deps_satisfied, false);
    assert.strictEqual(r.plans.files[0].deps_blocking[0].reason, 'dependency unresolved');
  });

  it('resolves dependencies against completed tasks', () => {
    createManifest(dir, 'core', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: {
          status: 'in-progress',
          completed_tasks: ['core-1-1'],
        },
      },
    });
    createFile(dir, '.workflows/core/planning/core/planning.md', '# Plan');
    createManifest(dir, 'advanced', {
      phases: {
        planning: {
          status: 'concluded',
          format: 'local-markdown',
          external_dependencies: {
            core: { state: 'resolved', task_id: 'core-1-1' },
          },
        },
      },
    });
    createFile(dir, '.workflows/advanced/planning/advanced/planning.md', '# Plan');

    const r = discover(dir);
    const adv = r.plans.files.find(p => p.name === 'advanced');
    assert.strictEqual(adv.deps_satisfied, true);
    assert.strictEqual(adv.deps_blocking.length, 0);
  });

  it('blocks when resolved dep task not completed', () => {
    createManifest(dir, 'core', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'in-progress', completed_tasks: [] },
      },
    });
    createFile(dir, '.workflows/core/planning/core/planning.md', '# Plan');
    createManifest(dir, 'advanced', {
      phases: {
        planning: {
          status: 'concluded',
          format: 'local-markdown',
          external_dependencies: {
            core: { state: 'resolved', task_id: 'core-1-1' },
          },
        },
      },
    });
    createFile(dir, '.workflows/advanced/planning/advanced/planning.md', '# Plan');

    const r = discover(dir);
    const adv = r.plans.files.find(p => p.name === 'advanced');
    assert.strictEqual(adv.deps_satisfied, false);
    assert.strictEqual(adv.deps_blocking[0].task_id, 'core-1-1');
    assert.strictEqual(adv.deps_blocking[0].reason, 'task not yet completed');
  });

  it('blocks when resolved dep has no task_id', () => {
    createManifest(dir, 'advanced', {
      phases: {
        planning: {
          status: 'concluded',
          format: 'local-markdown',
          external_dependencies: {
            core: { state: 'resolved' },
          },
        },
      },
    });
    createFile(dir, '.workflows/advanced/planning/advanced/planning.md', '# Plan');

    const r = discover(dir);
    const adv = r.plans.files.find(p => p.name === 'advanced');
    assert.strictEqual(adv.deps_satisfied, false);
    assert.strictEqual(adv.deps_blocking[0].reason, 'resolved dependency missing task reference');
  });

  it('detects environment setup file', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/.state/environment-setup.md', 'Run: npm install');

    const r = discover(dir);
    assert.strictEqual(r.environment.setup_file_exists, true);
    assert.strictEqual(r.environment.requires_setup, true);
  });

  it('detects no-setup environment', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/.state/environment-setup.md', 'No special setup required.');

    const r = discover(dir);
    assert.strictEqual(r.environment.requires_setup, false);
  });

  it('multiple_plans scenario', () => {
    createManifest(dir, 'a', { phases: { planning: { status: 'concluded', format: 'local-markdown' } } });
    createManifest(dir, 'b', { phases: { planning: { status: 'in-progress', format: 'local-markdown' } } });
    createFile(dir, '.workflows/a/planning/a/planning.md', '# A');
    createFile(dir, '.workflows/b/planning/b/planning.md', '# B');
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'multiple_plans');
  });

  it('plan_id included when present', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'linear', plan_id: 'LIN-42' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].plan_id, 'LIN-42');
  });

  it('no environment file returns null for requires_setup', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.environment.setup_file_exists, false);
    assert.strictEqual(r.environment.requires_setup, null);
  });

  it('specification_exists is tracked', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].specification_exists, true);
  });

  it('plan without planning.md file is skipped', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    // Don't create the planning.md file
    const r = discover(dir);
    assert.strictEqual(r.plans.exists, false);
    assert.strictEqual(r.state.scenario, 'no_plans');
  });

  it('plan with no deps has deps_satisfied true', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].deps_satisfied, true);
    assert.strictEqual(r.plans.files[0].deps_blocking.length, 0);
  });

  it('handles resolved dep pointing to missing manifest', () => {
    createManifest(dir, 'advanced', {
      phases: {
        planning: {
          status: 'concluded',
          format: 'local-markdown',
          external_dependencies: {
            nonexistent: { state: 'resolved', task_id: 'task-1' },
          },
        },
      },
    });
    createFile(dir, '.workflows/advanced/planning/advanced/planning.md', '# Plan');
    const r = discover(dir);
    const adv = r.plans.files.find(p => p.name === 'advanced');
    assert.strictEqual(adv.deps_satisfied, false);
    assert.strictEqual(adv.deps_blocking[0].reason, 'task not yet completed');
  });

  it('no dependency_resolution in return value', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.dependency_resolution, undefined);
  });

  it('no dead count fields in state', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.state.plans_concluded_count, undefined);
    assert.strictEqual(r.state.plans_with_unresolved_deps, undefined);
    assert.strictEqual(r.state.plans_ready_count, undefined);
    assert.strictEqual(r.state.plans_in_progress_count, undefined);
    assert.strictEqual(r.state.plans_completed_count, undefined);
  });
});
