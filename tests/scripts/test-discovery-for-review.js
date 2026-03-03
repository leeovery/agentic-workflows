'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover } = require('../../skills/start-review/scripts/discovery');

describe('start-review discovery', () => {
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
    assert.strictEqual(r.plans.files[0].name, 'auth');
    assert.strictEqual(r.state.scenario, 'single_plan');
  });

  it('skips plans without planning.md file', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.plans.exists, false);
  });

  it('counts review versions', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/auth/review/auth/r1/review.md', '**QA Verdict**: PASS with notes');
    createFile(dir, '.workflows/auth/review/auth/r2/review.md', '**QA Verdict**: PASS');

    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].review_count, 2);
    assert.strictEqual(r.plans.files[0].latest_review_version, 2);
    assert.strictEqual(r.plans.files[0].latest_review_verdict, 'PASS');
    assert.strictEqual(r.reviews.entries.length, 1);
    assert.strictEqual(r.reviews.entries[0].versions, 2);
  });

  it('tracks implementation status', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'in-progress' },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].implementation_status, 'in-progress');
    assert.strictEqual(r.state.implemented_count, 1);
  });

  it('detects all_reviewed', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/auth/review/auth/r1/review.md', '**QA Verdict**: PASS');

    const r = discover(dir);
    assert.strictEqual(r.state.all_reviewed, true);
  });

  it('detects synthesis files', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/auth/review/auth/r1/review.md', '**QA Verdict**: FAIL');
    createFile(dir, '.workflows/auth/implementation/auth/review-tasks-c1.md', '# Fix tasks');

    const r = discover(dir);
    assert.strictEqual(r.reviews.entries[0].has_synthesis, true);
  });

  it('multiple_plans scenario', () => {
    createManifest(dir, 'a', { phases: { planning: { status: 'concluded', format: 'local-markdown' } } });
    createManifest(dir, 'b', { phases: { planning: { status: 'concluded', format: 'local-markdown' } } });
    createFile(dir, '.workflows/a/planning/a/planning.md', '# A');
    createFile(dir, '.workflows/b/planning/b/planning.md', '# B');
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'multiple_plans');
  });

  it('all_reviewed is false when no implementations exist', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.state.all_reviewed, false);
    assert.strictEqual(r.state.implemented_count, 0);
  });

  it('plan_id included when present', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'linear', plan_id: 'LIN-42' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].plan_id, 'LIN-42');
  });

  it('completed_count tracks completed implementations', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    createManifest(dir, 'data', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'in-progress' },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/data/planning/data/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.state.implemented_count, 2);
    assert.strictEqual(r.state.completed_count, 1);
  });

  it('review verdict parsing handles multiline', () => {
    createManifest(dir, 'auth', {
      phases: {
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/auth/review/auth/r1/review.md',
      '# Review\n\n**QA Verdict**: FAIL with critical issues\n\nDetails here...');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].latest_review_verdict, 'FAIL with critical issues');
  });

  it('specification_exists tracks spec file', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].specification_exists, true);
  });

  it('specification_exists is false when no spec file', () => {
    createManifest(dir, 'auth', {
      phases: { planning: { status: 'concluded', format: 'local-markdown' } },
    });
    createFile(dir, '.workflows/auth/planning/auth/planning.md', '# Plan');
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].specification_exists, false);
  });
});
