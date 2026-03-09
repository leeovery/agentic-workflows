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

  it('computes next_phase for epic same as other types', () => {
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
    assert.strictEqual(r.next_phase, 'discussion');
    assert.strictEqual(r.epic_detail, undefined);
  });

  it('computes bugfix pipeline correctly', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'concluded' } },
    });
    const r = discover(dir, 'crash');
    assert.strictEqual(r.next_phase, 'specification');
  });

  it('detects all phase file types', () => {
    createManifest(dir, 'full', {
      work_type: 'feature',
      phases: {
        discussion: { status: 'concluded' },
        specification: { status: 'concluded' },
        planning: { status: 'concluded' },
        implementation: { status: 'completed' },
        review: { status: 'completed' },
      },
    });
    createFile(dir, '.workflows/full/discussion/full.md', '');
    createFile(dir, '.workflows/full/specification/full/specification.md', '');
    createFile(dir, '.workflows/full/planning/full/planning.md', '');
    createFile(dir, '.workflows/full/implementation/full/implementation.md', '');
    createFile(dir, '.workflows/full/review/full/r1/review.md', '');
    const r = discover(dir, 'full');
    assert.strictEqual(r.phases.discussion.exists, true);
    assert.strictEqual(r.phases.specification.exists, true);
    assert.strictEqual(r.phases.planning.exists, true);
    assert.strictEqual(r.phases.implementation.exists, true);
    assert.strictEqual(r.phases.review.exists, true);
  });

  it('returns status from manifest', () => {
    createManifest(dir, 'auth', { work_type: 'feature', status: 'in-progress' });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.status, 'in-progress');
  });

  it('detects research file existence', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { status: 'in-progress' } },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');
    const r = discover(dir, 'v1');
    assert.strictEqual(r.phases.research.exists, true);
    assert.strictEqual(r.phases.research.status, 'in-progress');
  });

  it('detects investigation file existence', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { status: 'in-progress' } },
    });
    createFile(dir, '.workflows/crash/investigation/crash.md', '# Investigation');
    const r = discover(dir, 'crash');
    assert.strictEqual(r.phases.investigation.exists, true);
    assert.strictEqual(r.phases.investigation.status, 'in-progress');
  });

  it('reports false for missing research files', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { status: 'in-progress' } },
    });
    const r = discover(dir, 'v1');
    assert.strictEqual(r.phases.research.exists, false);
  });

  it('epic returns phases and next_phase without epic_detail', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: {
          items: {
            'exploration': { status: 'concluded' },
            'architecture': { status: 'in-progress' },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/research/exploration.md', '# Exploration');
    const r = discover(dir, 'v1');
    assert.strictEqual(r.epic_detail, undefined);
    assert.strictEqual(r.phases.research.exists, true);
    assert.strictEqual(r.work_type, 'epic');
  });
});
