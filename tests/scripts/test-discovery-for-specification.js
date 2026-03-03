'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover } = require('../../skills/start-specification/scripts/discovery');

describe('start-specification discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns empty when no discussions exist', () => {
    const r = discover(dir);
    assert.strictEqual(r.current_state.has_discussions, false);
    assert.strictEqual(r.current_state.has_specs, false);
    assert.strictEqual(r.discussions.length, 0);
    assert.strictEqual(r.specifications.length, 0);
  });

  it('finds discussions with spec status', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { status: 'concluded' },
        specification: { status: 'in-progress' },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.length, 1);
    assert.strictEqual(r.discussions[0].has_individual_spec, true);
    assert.strictEqual(r.discussions[0].spec_status, 'in-progress');
    assert.strictEqual(r.current_state.concluded_count, 1);
  });

  it('finds specifications with sources', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { status: 'concluded' },
        specification: {
          status: 'concluded',
          type: 'feature',
          sources: { 'auth': { status: 'incorporated' } },
        },
      },
    });
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 1);
    assert.strictEqual(r.specifications[0].status, 'concluded');
    assert.strictEqual(r.specifications[0].sources.length, 1);
    assert.strictEqual(r.specifications[0].sources[0].name, 'auth');
    assert.strictEqual(r.specifications[0].sources[0].discussion_status, 'concluded');
  });

  it('skips superseded specifications', () => {
    createManifest(dir, 'old', {
      work_type: 'feature',
      phases: {
        specification: { status: 'superseded', superseded_by: 'new-spec' },
      },
    });
    createFile(dir, '.workflows/old/specification/old/specification.md', '# Old');
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 0);
  });

  it('detects epic discussion items with spec cross-reference', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          status: 'in-progress',
          items: {
            'auth-design': { status: 'concluded' },
            'data-model': { status: 'in-progress' },
          },
        },
        specification: {
          status: 'in-progress',
          sources: { 'auth-design': { status: 'extracted' } },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.length, 2);
    const auth = r.discussions.find(d => d.name === 'auth-design');
    assert.strictEqual(auth.has_individual_spec, true);
    const data = r.discussions.find(d => d.name === 'data-model');
    assert.strictEqual(data.has_individual_spec, false);
  });

  it('computes discussion counts correctly', () => {
    createManifest(dir, 'a', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    createManifest(dir, 'b', {
      work_type: 'feature',
      phases: { discussion: { status: 'in-progress' } },
    });
    createManifest(dir, 'c', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.current_state.discussion_count, 3);
    assert.strictEqual(r.current_state.concluded_count, 2);
    assert.strictEqual(r.current_state.in_progress_count, 1);
  });

  it('detects valid cache with anchored names', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth');

    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update('# Auth').digest('hex');

    createFile(dir, '.workflows/auth/.state/discussion-consolidation-analysis.md',
      `---\nchecksum: ${checksum}\ngenerated: 2026-01-01\n---\n### Auth\nContent here`);
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');

    const r = discover(dir);
    assert.strictEqual(r.cache.entries.length, 1);
    assert.strictEqual(r.cache.entries[0].status, 'valid');
    assert.ok(r.cache.entries[0].anchored_names.includes('auth'));
  });

  it('returns no cache when none exists', () => {
    const r = discover(dir);
    assert.strictEqual(r.cache.status, 'none');
  });

  it('computes discussions checksum', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'concluded' } },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth discussion');
    const r = discover(dir);
    assert.ok(r.current_state.discussions_checksum);
  });
});
