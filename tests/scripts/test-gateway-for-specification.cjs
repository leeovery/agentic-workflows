'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-specification-entry/scripts/gateway.cjs');

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

  it('detects valid cache from manifest checksum', () => {
    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update('# Auth').digest('hex');

    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: {
          analysis_cache: { checksum, generated: '2026-01-01' },
          items: { auth: { status: 'completed' } },
        },
      },
    });
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth');

    const r = discover(dir);
    assert.strictEqual(r.cache.entries.length, 1);
    assert.strictEqual(r.cache.entries[0].status, 'valid');
    assert.strictEqual(r.cache.entries[0].anchored_names, undefined);
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

  it('emits consult references with name and status', () => {
    createManifest(dir, 'mint', {
      work_type: 'epic',
      phases: {
        discussion: { items: { 'release-engine': { status: 'completed' } } },
        specification: {
          items: {
            'release-engine': {
              status: 'in-progress',
              sources: { 'release-engine': { status: 'incorporated' } },
              consult_references: {
                'cli-presentation': { status: 'pending' },
                'commit-command': { status: 'addressed' },
              },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/mint/specification/release-engine/specification.md', '# Spec');
    const r = discover(dir);
    const spec = r.specifications.find(s => s.name === 'release-engine');
    assert.strictEqual(spec.consult_references.length, 2);
    const cli = spec.consult_references.find(c => c.name === 'cli-presentation');
    assert.strictEqual(cli.status, 'pending');
    const commit = spec.consult_references.find(c => c.name === 'commit-command');
    assert.strictEqual(commit.status, 'addressed');
  });

  it('defaults source status to pending when object-shaped without status', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: {
          items: {
            auth: {
              status: 'completed',
              sources: { auth: {}, design: 'not-an-object' },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const r = discover(dir);
    const spec = r.specifications[0];
    assert.strictEqual(spec.sources.find(s => s.name === 'auth').status, 'pending');
    assert.strictEqual(spec.sources.find(s => s.name === 'design').status, 'pending');
    assert.strictEqual(spec.has_pending_sources, true);
  });

  it('defaults consult reference status to pending when object-shaped without status', () => {
    createManifest(dir, 'mint', {
      work_type: 'epic',
      phases: {
        specification: {
          items: {
            'release-engine': {
              status: 'in-progress',
              consult_references: { 'cli-presentation': {} },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/mint/specification/release-engine/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.specifications[0].consult_references[0].status, 'pending');
  });

  it('spec with no consult references has no consult_references field', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'in-progress' } } },
      },
    });
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    const r = discover(dir);
    assert.strictEqual(r.specifications[0].consult_references, undefined);
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

  it('empty project pins the full dump byte-exactly', () => {
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== STATE ===',
      'counts: discussions=0 completed=0 in_progress=0 specs=0 proposed=0 concluded=0',
      '',
    ].join('\n'));
  });

  it('populated project pins the full dump byte-exactly', () => {
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
    createManifest(dir, 'billing', {
      work_type: 'feature',
      phases: { discussion: { items: { billing: { status: 'in-progress' } } } },
    });
    createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
    createFile(dir, '.workflows/auth/discussion/auth.md', '# Auth');
    const out = format(discover(dir));
    assert.strictEqual(out, [
      '=== STATE ===',
      'counts: discussions=2 completed=1 in_progress=1 specs=1 proposed=0 concluded=0',
      '',
    ].join('\n'));
  });

  it('carries no discussion, spec, cache, or checksum detail — the view verb owns it', () => {
    createManifest(dir, 'mint', {
      work_type: 'epic',
      phases: {
        discussion: { items: { 'cli-presentation': { status: 'completed' } } },
        specification: {
          items: {
            'release-engine': {
              status: 'in-progress',
              sources: { 'cli-presentation': { status: 'incorporated' } },
              consult_references: { 'cli-presentation': { status: 'pending' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/mint/specification/release-engine/specification.md', '# Spec');
    createFile(dir, '.workflows/mint/discussion/cli-presentation.md', '# D');
    const out = format(discover(dir));
    assert.ok(!out.includes('=== DISCUSSIONS ==='));
    assert.ok(!out.includes('=== SPECIFICATIONS ==='));
    assert.ok(!out.includes('=== CACHE ==='));
    assert.ok(!out.includes('source:'));
    assert.ok(!out.includes('consult:'));
    assert.ok(!out.includes('checksum'));
  });

  describe('spec menu reorder', () => {
    // Builds an epic with four spec items in shuffled insertion order:
    // concluded, completed-with-pending, proposed, in-progress. Files exist for
    // every materialized (non-proposed) spec so they pass the fileExists gate.
    function reorderFixture() {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'd-concluded': { status: 'completed' },
              'd-pending-a': { status: 'completed' },
              'd-pending-b': { status: 'completed' },
              'd-proposed': { status: 'completed' },
              'd-wip': { status: 'completed' },
            },
          },
          specification: {
            items: {
              'concluded-spec': {
                status: 'completed',
                sources: { 'd-concluded': { status: 'incorporated' } },
              },
              'pending-spec': {
                status: 'completed',
                sources: {
                  'd-pending-a': { status: 'incorporated' },
                  'd-pending-b': { status: 'pending' },
                },
              },
              'proposed-grp': {
                status: 'proposed',
                sources: { 'd-proposed': { status: 'pending' } },
              },
              'wip-spec': {
                status: 'in-progress',
                sources: { 'd-wip': { status: 'extracted' } },
              },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/concluded-spec/specification.md', '# Concluded');
      createFile(dir, '.workflows/v1/specification/pending-spec/specification.md', '# Pending');
      createFile(dir, '.workflows/v1/specification/wip-spec/specification.md', '# Wip');
    }

    it('has_pending_sources false when all sources incorporated', () => {
      reorderFixture();
      const r = discover(dir);
      const spec = r.specifications.find(s => s.name === 'concluded-spec');
      assert.strictEqual(spec.has_pending_sources, false);
    });

    it('has_pending_sources true when a source is pending', () => {
      reorderFixture();
      const r = discover(dir);
      const spec = r.specifications.find(s => s.name === 'pending-spec');
      assert.strictEqual(spec.has_pending_sources, true);
    });

    it('has_pending_sources true for a proposed grouping', () => {
      reorderFixture();
      const r = discover(dir);
      const spec = r.specifications.find(s => s.name === 'proposed-grp');
      assert.strictEqual(spec.has_pending_sources, true);
    });

    it('has_pending_sources false for a spec with no sources', () => {
      createManifest(dir, 'auth', {
        work_type: 'feature',
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          specification: { items: { auth: { status: 'in-progress' } } },
        },
      });
      createFile(dir, '.workflows/auth/specification/auth/specification.md', '# Spec');
      const r = discover(dir);
      assert.strictEqual(r.specifications[0].has_pending_sources, false);
    });

    it('sorts specifications actionable-first (proposed, in-progress, completed+pending, concluded)', () => {
      reorderFixture();
      const r = discover(dir);
      const order = r.specifications.map(s => s.name);
      assert.deepStrictEqual(order, ['proposed-grp', 'wip-spec', 'pending-spec', 'concluded-spec']);
    });

    it('concluded_count counts only completed specs with no pending sources', () => {
      reorderFixture();
      const r = discover(dir);
      assert.strictEqual(r.current_state.concluded_count, 1);
    });

    it('concluded_count is zero when no spec is concluded', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'd-prop': { status: 'completed' }, 'd-wip': { status: 'completed' } } },
          specification: {
            items: {
              'prop': { status: 'proposed', sources: { 'd-prop': { status: 'pending' } } },
              'wip': { status: 'in-progress', sources: { 'd-wip': { status: 'extracted' } } },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/wip/specification.md', '# Wip');
      const r = discover(dir);
      assert.strictEqual(r.current_state.concluded_count, 0);
    });

    it('format counts line reflects the reorder fixture byte-exactly', () => {
      reorderFixture();
      const out = format(discover(dir));
      assert.strictEqual(out, [
        '=== STATE ===',
        'counts: discussions=5 completed=5 in_progress=0 specs=3 proposed=1 concluded=1',
        '',
      ].join('\n'));
    });
  });

  describe('proposed groupings', () => {
    it('counts a proposed spec item (no file) in proposed_count, not spec_count', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth-design': { status: 'completed' }, 'data-model': { status: 'completed' } } },
          specification: {
            items: {
              'auth-grouping': {
                status: 'proposed',
                sources: { 'auth-design': { status: 'pending' } },
              },
            },
          },
        },
      });
      // No spec file on disk for the proposed item — must still be counted.
      const r = discover(dir);
      assert.strictEqual(r.current_state.proposed_count, 1);
      assert.strictEqual(r.current_state.has_proposed, true);
      assert.strictEqual(r.current_state.spec_count, 0);
      const spec = r.specifications.find(s => s.name === 'auth-grouping');
      assert.ok(spec, 'proposed item present in specifications[]');
      assert.strictEqual(spec.status, 'proposed');
      assert.strictEqual(spec.sources.length, 1);
      assert.strictEqual(spec.sources[0].name, 'auth-design');
      assert.strictEqual(spec.sources[0].status, 'pending');
    });

    it('proposed source does not set has_individual_spec', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth-design': { status: 'completed' } } },
          specification: {
            items: {
              'auth-grouping': { status: 'proposed', sources: { 'auth-design': { status: 'pending' } } },
            },
          },
        },
      });
      const r = discover(dir);
      const disc = r.discussions.find(d => d.name === 'auth-design');
      assert.strictEqual(disc.has_individual_spec, false);
    });

    it('single completed discussion in a proposed item still has no individual spec', () => {
      createManifest(dir, 'solo', {
        work_type: 'feature',
        phases: {
          discussion: { items: { solo: { status: 'completed' } } },
          specification: {
            items: { solo: { status: 'proposed', sources: { solo: { status: 'pending' } } } },
          },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.current_state.completed_count, 1);
      assert.strictEqual(r.discussions[0].has_individual_spec, false);
      assert.strictEqual(r.current_state.proposed_count, 1);
      assert.strictEqual(r.current_state.spec_count, 0);
    });

    it('mixed proposed and materialized specs count separately (R11 routing inputs)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth-design': { status: 'completed' }, 'data-model': { status: 'completed' } } },
          specification: {
            items: {
              'auth-spec': { status: 'in-progress', sources: { 'auth-design': { status: 'extracted' } } },
              'data-grouping': { status: 'proposed', sources: { 'data-model': { status: 'pending' } } },
            },
          },
        },
      });
      createFile(dir, '.workflows/v1/specification/auth-spec/specification.md', '# Auth Spec');
      const r = discover(dir);
      assert.strictEqual(r.current_state.spec_count, 1);
      assert.strictEqual(r.current_state.proposed_count, 1);
      assert.strictEqual(r.specifications.length, 2);
    });

    it('proposed item is included even without a spec file (file not required)', () => {
      createManifest(dir, 'v1', {
        work_type: 'epic',
        phases: {
          specification: { items: { grp: { status: 'proposed', sources: { d: { status: 'pending' } } } } },
        },
      });
      const r = discover(dir);
      assert.strictEqual(r.specifications.length, 1);
      assert.strictEqual(r.specifications[0].status, 'proposed');
      assert.strictEqual(r.current_state.spec_count, 0);
      assert.strictEqual(r.current_state.proposed_count, 1);
    });
  });
});
