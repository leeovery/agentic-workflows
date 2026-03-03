'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils');
const { discover } = require('../../skills/start-discussion/scripts/discovery');

describe('start-discussion discovery', () => {
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
      phases: { research: { status: 'concluded' } },
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
      phases: { discussion: { status: 'in-progress' } },
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
            'auth-design': { status: 'concluded' },
            'data-model': { status: 'in-progress' },
          },
        },
      },
    });
    const r = discover(dir);
    assert.strictEqual(r.discussions.files.length, 2);
    assert.strictEqual(r.discussions.counts.concluded, 1);
    assert.strictEqual(r.discussions.counts.in_progress, 1);
  });

  it('returns research_and_discussions when both exist', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        research: { status: 'concluded' },
        discussion: { status: 'in-progress' },
      },
    });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');
    const r = discover(dir);
    assert.strictEqual(r.state.scenario, 'research_and_discussions');
    assert.strictEqual(r.state.has_research, true);
    assert.strictEqual(r.state.has_discussions, true);
  });

  it('detects valid cache', () => {
    createManifest(dir, 'v1', { work_type: 'epic', phases: { research: { status: 'concluded' } } });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes');

    // Compute checksum for the research file
    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update('# Notes').digest('hex');

    createFile(dir, '.workflows/v1/.state/research-analysis.md',
      `---\nchecksum: ${checksum}\ngenerated: 2026-01-01\n---\n# Analysis`);

    const r = discover(dir);
    assert.strictEqual(r.cache.entries.length, 1);
    assert.strictEqual(r.cache.entries[0].status, 'valid');
  });

  it('detects stale cache', () => {
    createManifest(dir, 'v1', { work_type: 'epic', phases: { research: { status: 'concluded' } } });
    createFile(dir, '.workflows/v1/research/notes.md', '# Notes updated');
    createFile(dir, '.workflows/v1/.state/research-analysis.md',
      '---\nchecksum: old-checksum\ngenerated: 2026-01-01\n---\n# Analysis');

    const r = discover(dir);
    assert.strictEqual(r.cache.entries[0].status, 'stale');
  });

  it('returns no cache when none exists', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const r = discover(dir);
    assert.strictEqual(r.cache.status, 'none');
    assert.strictEqual(r.cache.entries.length, 0);
  });
});
