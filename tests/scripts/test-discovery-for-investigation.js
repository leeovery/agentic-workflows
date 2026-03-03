'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils');
const { discover } = require('../../skills/start-investigation/scripts/discovery');

describe('start-investigation discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns fresh when no bugfix work units exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'fresh');
    assert.strictEqual(r.investigations.exists, false);
    assert.strictEqual(r.investigations.counts.total, 0);
  });

  it('returns fresh when features exist but no bugfixes', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'fresh');
  });

  it('returns has_investigations with in-progress', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'in-progress' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'has_investigations');
    assert.strictEqual(r.investigations.exists, true);
    assert.strictEqual(r.investigations.counts.in_progress, 1);
    assert.strictEqual(r.investigations.files[0].work_unit, 'crash');
  });

  it('counts concluded investigations', () => {
    createManifest(dir, 'bug1', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'concluded' } },
    });
    createManifest(dir, 'bug2', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'in-progress' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.investigations.counts.total, 2);
    assert.strictEqual(r.investigations.counts.concluded, 1);
    assert.strictEqual(r.investigations.counts.in_progress, 1);
  });

  it('skips bugfixes with no investigation phase', () => {
    createManifest(dir, 'new-bug', { work_type: 'bugfix', phases: {} });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'fresh');
    assert.strictEqual(r.investigations.counts.total, 0);
  });

  it('includes work_type field on each investigation', () => {
    createManifest(dir, 'bug1', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'in-progress' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.investigations.files[0].work_type, 'bugfix');
  });

  it('returns empty state when only epic/feature work units exist', () => {
    createManifest(dir, 'epic1', { work_type: 'epic', phases: { research: { status: 'concluded' } } });
    createManifest(dir, 'feat1', { work_type: 'feature', phases: { discussion: { status: 'concluded' } } });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'fresh');
    assert.strictEqual(r.investigations.counts.total, 0);
  });
});
