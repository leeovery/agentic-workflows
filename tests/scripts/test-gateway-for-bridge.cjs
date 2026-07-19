'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-bridge/scripts/gateway.cjs');

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
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.work_unit, 'auth');
    assert.strictEqual(r.work_type, 'feature');
    assert.strictEqual(r.next_phase, 'specification');
    assert.strictEqual(r.phases.discussion.status, 'completed');
  });

  it('detects file existence', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
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
        discussion: { items: { done: { status: 'completed' } } },
        specification: { items: { done: { status: 'completed' } } },
        planning: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
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
          items: { 'auth-design': { status: 'completed' }, 'data-model': { status: 'in-progress' } },
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
      phases: { investigation: { items: { crash: { status: 'completed' } } } },
    });
    const r = discover(dir, 'crash');
    assert.strictEqual(r.next_phase, 'specification');
  });

  it('detects all phase file types', () => {
    createManifest(dir, 'full', {
      work_type: 'feature',
      phases: {
        discussion: { items: { full: { status: 'completed' } } },
        specification: { items: { full: { status: 'completed' } } },
        planning: { items: { full: { status: 'completed' } } },
        implementation: { items: { full: { status: 'completed' } } },
        review: { items: { full: { status: 'completed' } } },
      },
    });
    createFile(dir, '.workflows/full/discussion/full.md', '');
    createFile(dir, '.workflows/full/specification/full/specification.md', '');
    const r = discover(dir, 'full');
    assert.strictEqual(r.phases.discussion.exists, true);
    assert.strictEqual(r.phases.specification.exists, true);
    assert.strictEqual(r.phases.planning.exists, true);
    assert.strictEqual(r.phases.implementation.exists, true);
  });

  it('detects planning existence from manifest not files', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
        planning: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.planning.exists, true);
  });

  it('detects implementation existence from manifest not files', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
        planning: { items: { auth: { status: 'completed' } } },
        implementation: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.implementation.exists, true);
  });

  it('reports planning as not existing when no manifest entry', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.planning.exists, false);
  });

  it('returns status from manifest', () => {
    createManifest(dir, 'auth', { work_type: 'feature', status: 'in-progress' });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.status, 'in-progress');
  });

  it('detects research file existence', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { items: { exploration: { status: 'in-progress' } } } },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');
    const r = discover(dir, 'v1');
    assert.strictEqual(r.phases.research.exists, true);
    assert.strictEqual(r.phases.research.status, 'in-progress');
  });

  it('detects investigation file existence', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { crash: { status: 'in-progress' } } } },
    });
    createFile(dir, '.workflows/crash/investigation/crash.md', '# Investigation');
    const r = discover(dir, 'crash');
    assert.strictEqual(r.phases.investigation.exists, true);
    assert.strictEqual(r.phases.investigation.status, 'in-progress');
  });

  it('reports false for missing research files', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { items: { exploration: { status: 'in-progress' } } } },
    });
    const r = discover(dir, 'v1');
    assert.strictEqual(r.phases.research.exists, false);
  });

  it('ignores flat phase status (returns null)', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'completed' } },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.discussion.status, 'none');
    assert.strictEqual(r.next_phase, 'discussion');
  });

  it('epic returns phases and next_phase without epic_detail', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: {
          items: {
            'exploration': { status: 'completed' },
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

describe('workflow-bridge format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns error string for missing manifest', () => {
    const out = format(discover(dir, 'nonexistent'));
    assert.ok(out.startsWith('Error: '));
  });

  it('fresh feature pins the full dump byte-exactly', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const out = format(discover(dir, 'auth'));
    assert.strictEqual(out, [
      '=== auth (feature) ===',
      'next_phase: discussion',
      'completed_phases: (none)',
      '',
    ].join('\n'));
  });

  it('mid-pipeline feature pins the full dump byte-exactly', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        research: { items: { auth: { status: 'completed' } } },
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
        planning: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir, 'auth'));
    assert.strictEqual(out, [
      '=== auth (feature) ===',
      'next_phase: planning',
      'completed_phases: research, discussion, specification',
      '',
    ].join('\n'));
  });

  it('completed pipeline reports next_phase done', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        scoping: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'completed' } } },
        review: { items: { 'rename-api': { status: 'completed' } } },
      },
    });
    const out = format(discover(dir, 'rename-api'));
    assert.strictEqual(out, [
      '=== rename-api (quick-fix) ===',
      'next_phase: done',
      'completed_phases: scoping, implementation, review',
      '',
    ].join('\n'));
  });

  it('carries no per-phase status or file-existence lines — completed_phases is the surface', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const out = format(discover(dir, 'auth'));
    assert.ok(!out.includes('(no files)'));
    assert.ok(!out.includes('  discussion:'));
    assert.ok(!out.includes(': none'));
  });
});
