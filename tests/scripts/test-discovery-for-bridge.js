'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover } = require('../../skills/workflow-bridge/scripts/discovery');

describe('workflow-bridge discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns error for missing manifest', () => {
    const r = discover(dir, 'nonexistent');
    assert.ok(r.error);
  });

  it('returns basic feature state', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.work_unit, 'auth');
    assert.strictEqual(r.work_type, 'feature');
    assert.strictEqual(r.next_phase, 'specification');
    assert.strictEqual(r.phases.discussion.status, 'concluded');
  });

  it('detects file existence', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Discussion');
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.discussion.exists, true);
    assert.strictEqual(r.phases.specification.exists, false);
  });

  it('returns done for completed pipeline', () => {
    createManifest(dir, 'done', {
      work_type: 'feature',
      phases: {
        discussion: { status: 'concluded' },
        specification: { status: 'concluded' },
        planning: { status: 'concluded' },
        implementation: { status: 'completed' },
        review: { status: 'completed' },
      },
    });
    const r = discover(dir, 'done');
    assert.strictEqual(r.next_phase, 'done');
  });

  it('returns interactive for epic', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          status: 'in-progress',
          items: { 'auth-design': { status: 'concluded' }, 'data-model': { status: 'in-progress' } },
        },
      },
    });
    const r = discover(dir, 'v1');
    assert.strictEqual(r.next_phase, 'interactive');
    assert.ok(r.epic_detail);
    assert.strictEqual(r.epic_detail.discussion.items.length, 2);
    assert.strictEqual(r.epic_detail.discussion.items[0].name, 'auth-design');
  });

  it('computes bugfix pipeline correctly', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'concluded' } },
    });
    const r = discover(dir, 'crash');
    assert.strictEqual(r.next_phase, 'specification');
  });
});
