'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/workflow-discussion-entry/scripts/discovery.cjs');

describe('workflow-discussion-entry discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns fresh when nothing exists', () => {
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'fresh');
    assert.strictEqual(r.research.exists, false);
    assert.strictEqual(r.discussions.exists, false);
  });

  it('detects research files', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { status: 'completed' } },
    });
    createFile(dir, '.workflows/v1/research/market-analysis.md', '# Market Analysis');
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'research_only');
    assert.strictEqual(r.research.exists, true);
    assert.strictEqual(r.research.files.length, 1);
    assert.strictEqual(r.research.files[0].name, 'market-analysis');
    assert.strictEqual(r.research.files[0].work_unit, 'v1');
    assert.ok(r.research.checksum);
  });

  it('detects discussions from feature manifest', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'discussions_only');
    assert.strictEqual(r.discussions.exists, true);
    assert.strictEqual(r.discussions.files[0].name, 'auth');
    assert.strictEqual(r.discussions.counts.in_progress, 1);
  });

  it('detects epic discussion items', () => {
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
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.files.length, 2);
    assert.strictEqual(r.discussions.counts.completed, 1);
    assert.strictEqual(r.discussions.counts.in_progress, 1);
  });

  it('returns research_and_discussions when both exist', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { status: 'completed' },
        discussion: { items: { v1: { status: 'in-progress' } } },
      },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'research_and_discussions');
    assert.strictEqual(r.state.has_research, true);
    assert.strictEqual(r.state.has_discussions, true);
  });

  it('detects valid cache from manifest analysis_cache', () => {
    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update('# Notes').digest('hex');

    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: {
          status: 'completed',
          analysis_cache: { checksum, generated: '2026-01-01', files: ['notes.md'] },
        },
      },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');

    const r = discover(dir);
    assert.strictEqual(r.cache.entries.length, 1);
    assert.strictEqual(r.cache.entries[0].status, 'valid');
  });

  it('detects stale cache from manifest analysis_cache', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: {
          status: 'completed',
          analysis_cache: { checksum: 'old-checksum', generated: '2026-01-01', files: ['notes.md'] },
        },
      },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes updated');

    const r = discover(dir);
    assert.strictEqual(r.cache.entries[0].status, 'stale');
  });

  it('returns empty cache entries when no cache exists', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.cache.entries.length, 0);
  });

  it('counts pending discussion items', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: {
            'auth': { status: 'pending' },
            'billing': { status: 'pending' },
            'data': { status: 'in-progress' },
          },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.counts.pending, 2);
    assert.strictEqual(r.discussions.counts.in_progress, 1);
  });

  it('counts skipped discussion items', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: {
            'auth': { status: 'skipped' },
            'billing': { status: 'completed' },
          },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.counts.skipped, 1);
    assert.strictEqual(r.discussions.counts.completed, 1);
  });

  it('epic with flat discussion status but no items returns no discussions', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { status: 'in-progress' } },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.files.length, 0);
  });

  it('reads research_files from manifest analysis_cache', () => {
    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update('# Notes').digest('hex');

    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: {
          status: 'completed',
          analysis_cache: { checksum, generated: '2026-01-01', files: ['notes.md'] },
        },
      },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');

    const r = discover(dir);
    assert.strictEqual(r.cache.entries[0].research_files.length, 1);
    assert.strictEqual(r.cache.entries[0].research_files[0], 'notes.md');
  });

  it('computes research checksum', () => {
    createManifest(dir, 'v1', { work_type: 'epic', phases: { research: { status: 'completed' } } });
    createFile(dir, '.workflows/v1/research/a.md', 'content a');
    createFile(dir, '.workflows/v1/research/b.md', 'content b');
    const r = discover(dir);
    assert.ok(r.research.checksum);
    assert.strictEqual(typeof r.research.checksum, 'string');
    assert.strictEqual(r.research.checksum.length, 32);
  });

  it('returns null checksum when no research files', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.research.checksum, null);
  });
});

describe('workflow-discussion-entry format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('includes all section headers', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('=== RESEARCH ==='));
    assert.ok(out.includes('=== DISCUSSIONS ==='));
    assert.ok(out.includes('=== CACHE ==='));
    assert.ok(out.includes('=== STATE ==='));
  });

  it('shows (none) for empty sections', () => {
    const out = format(discover(dir));
    const noneCount = (out.match(/\(none\)/g) || []).length;
    assert.strictEqual(noneCount, 3);
  });

  it('includes research files with checksum', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { research: { status: 'completed' } },
    });
    createFile(dir, '.workflows/v1/research/market.md', '# Market');
    const out = format(discover(dir));
    assert.ok(out.includes('  v1/market: in-progress'));
    assert.ok(out.includes('  checksum: '));
  });

  it('includes discussion files with counts', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
    });
    const out = format(discover(dir));
    assert.ok(out.includes('  auth/auth (feature): in-progress'));
    assert.ok(out.includes('  counts: 1 in-progress, 0 completed, 0 pending, 0 skipped'));
  });

  it('includes state scenario and flags', () => {
    const out = format(discover(dir));
    assert.ok(out.includes('scenario: fresh'));
    assert.ok(out.includes('has_research: false, has_discussions: false'));
  });

  it('includes cache entries when present', () => {
    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update('# Notes').digest('hex');
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: {
          status: 'completed',
          analysis_cache: { checksum, generated: '2026-01-01', files: ['notes.md'] },
        },
      },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');
    const out = format(discover(dir));
    assert.ok(out.includes('  v1: valid'));
  });
});
