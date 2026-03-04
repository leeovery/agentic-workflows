'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover } = require('../../skills/start-planning/scripts/discovery');

describe('start-planning discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns no_specs when no specifications exist', () => {
    createManifest(dir, 'auth', { phases: { discussion: { status: 'concluded' } } });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'no_specs');
    assert.strictEqual(r.specifications.exists, false);
  });

  it('finds feature specifications', () => {
    createManifest(dir, 'auth', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'has_options');
    assert.strictEqual(r.specifications.feature.length, 1);
    assert.strictEqual(r.specifications.feature[0].name, 'auth');
    assert.strictEqual(r.specifications.counts.feature_ready, 1);
  });

  it('separates cross-cutting from feature', () => {
    createManifest(dir, 'caching', {
      phases: { specification: { status: 'concluded', type: 'cross-cutting' } },
    });
    createManifest(dir, 'auth', {
      phases: { specification: { status: 'concluded', type: 'feature' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.specifications.crosscutting.length, 1);
    assert.strictEqual(r.specifications.feature.length, 1);
    assert.strictEqual(r.specifications.counts.crosscutting, 1);
  });

  it('tracks plans with format', () => {
    createManifest(dir, 'auth', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'in-progress', format: 'local-markdown' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.plans.exists, true);
    assert.strictEqual(r.plans.files[0].format, 'local-markdown');
    assert.strictEqual(r.plans.common_format, 'local-markdown');
  });

  it('returns nothing_actionable when all specs have completed implementations', () => {
    createManifest(dir, 'auth', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'nothing_actionable');
  });

  it('skips superseded specifications', () => {
    createManifest(dir, 'old', {
      phases: { specification: { status: 'superseded' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.specifications.exists, false);
    assert.strictEqual(r.state.scenario, 'no_specs');
  });

  it('detects mixed format across plans', () => {
    createManifest(dir, 'a', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'concluded', format: 'local-markdown' },
      },
    });
    createManifest(dir, 'b', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'concluded', format: 'linear' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.plans.common_format, '');
  });

  it('includes plan_id when present', () => {
    createManifest(dir, 'auth', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'concluded', format: 'linear', plan_id: 'LIN-123' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].plan_id, 'LIN-123');
  });

  it('in-progress spec is not ready', () => {
    createManifest(dir, 'auth', {
      phases: {
        specification: { status: 'in-progress', type: 'feature' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.specifications.counts.feature_ready, 0);
    assert.strictEqual(r.specifications.counts.feature, 1);
  });

  it('counts actionable plans correctly', () => {
    createManifest(dir, 'a', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'in-progress', format: 'local-markdown' },
      },
    });
    createManifest(dir, 'b', {
      phases: {
        specification: { status: 'concluded', type: 'feature' },
        planning: { status: 'concluded', format: 'local-markdown' },
        implementation: { status: 'completed' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.specifications.counts.feature_with_plan, 2);
    assert.strictEqual(r.specifications.counts.feature_actionable_with_plan, 1);
    assert.strictEqual(r.specifications.counts.feature_implemented, 1);
  });

  it('returns no_specs for empty project', () => {
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'no_specs');
    assert.strictEqual(r.specifications.exists, false);
    assert.strictEqual(r.plans.exists, false);
  });

  it('includes work_type on plans', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: {
          items: { 'auth': { status: 'concluded', type: 'feature' } },
        },
        planning: {
          items: { 'auth': { status: 'concluded', format: 'local-markdown' } },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.plans.files[0].work_type, 'epic');
  });

  it('discovers epic spec and plan items independently', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: {
          items: {
            'auth': { status: 'concluded', type: 'feature' },
            'billing': { status: 'concluded', type: 'feature' },
            'caching': { status: 'concluded', type: 'cross-cutting' },
          },
        },
        planning: {
          items: {
            'auth': { status: 'concluded', format: 'local-markdown' },
          },
        },
        implementation: {
          items: {
            'auth': { status: 'completed' },
          },
        },
      },
    });
    const r = discover(dir);
    // 2 feature specs (auth + billing), 1 cross-cutting (caching)
    assert.strictEqual(r.specifications.feature.length, 2);
    assert.strictEqual(r.specifications.crosscutting.length, 1);
    assert.strictEqual(r.specifications.crosscutting[0].name, 'caching');
    // auth has a plan and completed impl; billing is ready (no plan)
    assert.strictEqual(r.specifications.counts.feature_ready, 1);
    assert.strictEqual(r.specifications.counts.feature_with_plan, 1);
    assert.strictEqual(r.specifications.counts.feature_implemented, 1);
    assert.strictEqual(r.plans.files.length, 1);
    assert.strictEqual(r.plans.files[0].name, 'auth');
    // billing is actionable (concluded, no plan) so scenario is has_options
    assert.strictEqual(r.state.scenario, 'has_options');
  });
});
