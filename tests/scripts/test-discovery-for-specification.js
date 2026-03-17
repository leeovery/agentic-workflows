'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover, format } = require('../../skills/workflow-specification-entry/scripts/discovery');

describe('workflow-specification-entry discovery', () => {
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
        discussion: { items: { auth: { status: 'completed' } } },
        specification: {
          items: {
            auth: {
              status: 'in-progress',
              sources: { auth: { status: 'extracted' } },
            },
          },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.length, 1);
    assert.strictEqual(r.discussions[0].has_individual_spec, true);
    assert.strictEqual(r.discussions[0].spec_status, 'in-progress');
    assert.strictEqual(r.current_state.completed_count, 1);
  });

  it('finds specifications with sources', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: {
          items: {
            auth: {
              status: 'completed',
              type: 'feature',
              sources: { 'auth': { status: 'incorporated' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 1);
    assert.strictEqual(r.specifications[0].status, 'completed');
    assert.strictEqual(r.specifications[0].sources.length, 1);
    assert.strictEqual(r.specifications[0].sources[0].name, 'auth');
    assert.strictEqual(r.specifications[0].sources[0].discussion_status, 'completed');
  });

  it('skips superseded specifications', () => {
    createManifest(dir, 'old', {
      work_type: 'feature',
      phases: {
        specification: { items: { old: { status: 'superseded', superseded_by: 'new-spec' } } },
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
            'auth-design': { status: 'completed' },
            'data-model': { status: 'in-progress' },
          },
        },
        specification: {
          items: {
            'auth-spec': {
              status: 'in-progress',
              sources: { 'auth-design': { status: 'extracted' } },
            },
          },
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

  it('finds epic specification items with sources', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: {
            'auth-design': { status: 'completed' },
            'data-model': { status: 'completed' },
          },
        },
        specification: {
          items: {
            'auth-spec': {
              status: 'completed',
              type: 'feature',
              sources: { 'auth-design': { status: 'incorporated' } },
            },
            'data-spec': {
              status: 'in-progress',
              sources: { 'data-model': { status: 'extracted' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/auth-spec/specification.md', '# Auth Spec');
    createFile(dir, '.workflows/v1/specification/data-spec/specification.md', '# Data Spec');
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 2);
    const authSpec = r.specifications.find(s => s.name === 'auth-spec');
    assert.strictEqual(authSpec.work_unit, 'v1');
    assert.strictEqual(authSpec.status, 'completed');
    assert.strictEqual(authSpec.work_type, 'epic');
    assert.strictEqual(authSpec.sources.length, 1);
    assert.strictEqual(authSpec.sources[0].name, 'auth-design');
    assert.strictEqual(authSpec.sources[0].discussion_status, 'completed');
    const dataSpec = r.specifications.find(s => s.name === 'data-spec');
    assert.strictEqual(dataSpec.status, 'in-progress');
  });

  it('skips superseded epic specification items', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        specification: {
          items: {
            'old-spec': { status: 'superseded', superseded_by: 'new-spec' },
            'new-spec': { status: 'in-progress' },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/old-spec/specification.md', '# Old');
    createFile(dir, '.workflows/v1/specification/new-spec/specification.md', '# New');
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 1);
    assert.strictEqual(r.specifications[0].name, 'new-spec');
  });

  it('computes discussion counts correctly', () => {
    createManifest(dir, 'a', {
      work_type: 'feature',
      phases: { discussion: { items: { a: { status: 'completed' } } } },
    });
    createManifest(dir, 'b', {
      work_type: 'feature',
      phases: { discussion: { items: { b: { status: 'in-progress' } } } },
    });
    createManifest(dir, 'c', {
      work_type: 'feature',
      phases: { discussion: { items: { c: { status: 'completed' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.current_state.discussion_count, 3);
    assert.strictEqual(r.current_state.completed_count, 2);
    assert.strictEqual(r.current_state.in_progress_count, 1);
  });

  it('detects valid cache with anchored names from manifest', () => {
    const crypto = require('crypto');

    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: {
          analysis_cache: { checksum: null, generated: '2026-01-01' },
          items: { auth: { status: 'completed' } },
        },
      },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth');

    const checksum = crypto.createHash('md5').update('# Auth').digest('hex');

    // Update manifest with correct checksum
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: {
          analysis_cache: { checksum, generated: '2026-01-01' },
          items: { auth: { status: 'completed' } },
        },
      },
    });

    // Cache file is pure markdown (no frontmatter)
    createFile(dir, '.workflows/auth/.state/discussion-consolidation-analysis.md',
      '### Auth\nContent here');
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');

    const r = discover(dir);
    assert.strictEqual(r.cache.entries.length, 1);
    assert.strictEqual(r.cache.entries[0].status, 'valid');
    assert.ok(r.cache.entries[0].anchored_names.includes('auth'));
  });

  it('returns empty cache entries when none exists', () => {
    const r = discover(dir);
    assert.strictEqual(r.cache.entries.length, 0);
  });

  it('computes discussions checksum', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth discussion');
    const r = discover(dir);
    assert.ok(r.current_state.discussions_checksum);
  });

  it('returns null checksum when no discussion files', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.current_state.discussions_checksum, null);
  });

  it('tracks superseded_by field on specs', () => {
    createManifest(dir, 'old', {
      work_type: 'feature',
      phases: {
        specification: { items: { old: { status: 'superseded', superseded_by: 'new-spec' } } },
      },
    });
    createFile(dir, '.workflows/old/specification/old/specification.md', '# Old');
    // Superseded specs are excluded, so we won't find it
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 0);
  });

  it('feature without spec shows has_individual_spec false', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions[0].has_individual_spec, false);
  });

  it('spec with no sources has no sources field', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 1);
    assert.strictEqual(r.specifications[0].sources, undefined);
  });

  it('stale cache when discussions changed', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: {
          analysis_cache: { checksum: 'stale-hash', generated: '2026-01-01' },
          items: { auth: { status: 'completed' } },
        },
      },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth updated');
    const r = discover(dir);
    assert.strictEqual(r.cache.entries[0].status, 'stale');
  });

  it('bugfix work unit with investigation as source', () => {
    createManifest(dir, 'login-crash', {
      work_type: 'bugfix',
      phases: {
        investigation: { items: { 'login-crash': { status: 'completed' } } },
        specification: { items: { 'login-crash': { status: 'in-progress' } } },
      },
    });
    createFile(dir, '.workflows/login-crash/specification/login-crash/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.specifications.length, 1);
    assert.strictEqual(r.specifications[0].work_type, 'bugfix');
    assert.strictEqual(r.specifications[0].name, 'login-crash');
  });
});

describe('workflow-specification-entry format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('includes all section headers', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('=== DISCUSSIONS ==='));
    assert.ok(out.includes('=== SPECIFICATIONS ==='));
    assert.ok(out.includes('=== CACHE ==='));
    assert.ok(out.includes('=== STATE ==='));
  });

  it('shows (none) for empty sections', () => {
    const out = format(discover(dir));
    const noneCount = (out.match(/\(none\)/g) || []).length;
    assert.strictEqual(noneCount, 3);
  });

  it('includes discussion with spec status', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: {
          items: {
            auth: {
              status: 'in-progress',
              sources: { auth: { status: 'extracted' } },
            },
          },
        },
      },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  auth/auth (feature): completed, spec: in-progress'));
  });

  it('includes specification with sources', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: {
          items: {
            auth: {
              status: 'completed',
              type: 'feature',
              sources: { auth: { status: 'incorporated' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const out = format(discover(dir));
    assert.ok(out.includes('  auth: completed, type=feature'));
    assert.ok(out.includes('    source: auth (incorporated, discussion: completed)'));
  });

  it('includes state with counts', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('discussions: 1 (1 completed, 0 in-progress)'));
  });

  it('includes checksum when discussions have files', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth');
    const out = format(discover(dir));
    assert.ok(out.includes('checksum: '));
  });
});
