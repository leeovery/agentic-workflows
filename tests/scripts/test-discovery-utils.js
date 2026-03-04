'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { setupFixture, cleanupFixture, createFile } = require('./discovery-test-utils');

const {
  fileExists, listFiles, listDirs, countFiles, filesChecksum,
  loadManifest, loadActiveManifests,
  phaseStatus, phaseItems, phaseData, computeNextPhase,
} = require('../../skills/workflow-shared/scripts/discovery-utils');

describe('discovery-utils', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  describe('fileExists', () => {
    it('returns true for existing file', () => {
      createFile(dir, 'test.txt', 'hello');
      assert.strictEqual(fileExists(path.join(dir, 'test.txt')), true);
    });

    it('returns false for missing file', () => {
      assert.strictEqual(fileExists(path.join(dir, 'nope.txt')), false);
    });
  });

  describe('listFiles', () => {
    it('returns sorted .md files', () => {
      createFile(dir, 'sub/b.md', '');
      createFile(dir, 'sub/a.md', '');
      createFile(dir, 'sub/c.txt', '');
      const files = listFiles(path.join(dir, 'sub'), '.md');
      assert.deepStrictEqual(files, ['a.md', 'b.md']);
    });

    it('returns empty array for missing dir', () => {
      assert.deepStrictEqual(listFiles(path.join(dir, 'missing'), '.md'), []);
    });
  });

  describe('listDirs', () => {
    it('returns sorted directories', () => {
      fs.mkdirSync(path.join(dir, 'sub', 'beta'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'sub', 'alpha'), { recursive: true });
      createFile(dir, 'sub/file.txt', '');
      const dirs = listDirs(path.join(dir, 'sub'));
      assert.deepStrictEqual(dirs, ['alpha', 'beta']);
    });

    it('returns empty for missing dir', () => {
      assert.deepStrictEqual(listDirs(path.join(dir, 'missing')), []);
    });
  });

  describe('countFiles', () => {
    it('counts matching files', () => {
      createFile(dir, 'sub/a.md', '');
      createFile(dir, 'sub/b.md', '');
      createFile(dir, 'sub/c.txt', '');
      assert.strictEqual(countFiles(path.join(dir, 'sub'), '.md'), 2);
    });
  });

  describe('filesChecksum', () => {
    it('returns null for empty array', () => {
      assert.strictEqual(filesChecksum([]), null);
    });

    it('returns null for null/undefined', () => {
      assert.strictEqual(filesChecksum(null), null);
      assert.strictEqual(filesChecksum(undefined), null);
    });

    it('returns consistent checksum for same content', () => {
      createFile(dir, 'a.txt', 'hello');
      const p = path.join(dir, 'a.txt');
      const c1 = filesChecksum([p]);
      const c2 = filesChecksum([p]);
      assert.strictEqual(c1, c2);
      assert.ok(typeof c1 === 'string' && c1.length === 32);
    });

    it('returns different checksum for different content', () => {
      createFile(dir, 'a.txt', 'hello');
      createFile(dir, 'b.txt', 'world');
      const c1 = filesChecksum([path.join(dir, 'a.txt')]);
      const c2 = filesChecksum([path.join(dir, 'b.txt')]);
      assert.notStrictEqual(c1, c2);
    });

    it('ignores missing files gracefully', () => {
      createFile(dir, 'a.txt', 'hello');
      const result = filesChecksum([path.join(dir, 'a.txt'), path.join(dir, 'missing.txt')]);
      assert.ok(typeof result === 'string' && result.length === 32);
    });
  });

  describe('loadManifest', () => {
    it('loads valid manifest', () => {
      const mdir = path.join(dir, '.workflows', 'test');
      fs.mkdirSync(mdir, { recursive: true });
      fs.writeFileSync(path.join(mdir, 'manifest.json'), JSON.stringify({ name: 'test', work_type: 'feature' }));
      const m = loadManifest(dir, 'test');
      assert.strictEqual(m.name, 'test');
    });

    it('returns null for missing manifest', () => {
      assert.strictEqual(loadManifest(dir, 'missing'), null);
    });
  });

  describe('loadActiveManifests', () => {
    it('returns only active manifests', () => {
      const { createManifest } = require('./discovery-test-utils');
      createManifest(dir, 'active', { status: 'active' });
      createManifest(dir, 'archived', { status: 'archived' });
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'active');
    });

    it('skips dotfiles', () => {
      const { createManifest } = require('./discovery-test-utils');
      createManifest(dir, 'good', {});
      fs.mkdirSync(path.join(dir, '.workflows', '.state'), { recursive: true });
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
    });
  });

  describe('phaseStatus', () => {
    it('extracts phase status', () => {
      assert.strictEqual(phaseStatus({ phases: { discussion: { status: 'concluded' } } }, 'discussion'), 'concluded');
    });

    it('returns null for missing phase', () => {
      assert.strictEqual(phaseStatus({ phases: {} }, 'discussion'), null);
    });

    it('returns null for no phases', () => {
      assert.strictEqual(phaseStatus({}, 'discussion'), null);
    });
  });

  describe('phaseItems', () => {
    it('extracts items', () => {
      const items = phaseItems({ phases: { discussion: { items: { auth: { status: 'concluded' } } } } }, 'discussion');
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'auth');
      assert.strictEqual(items[0].status, 'concluded');
    });

    it('returns empty for no items', () => {
      assert.deepStrictEqual(phaseItems({ phases: { discussion: { status: 'concluded' } } }, 'discussion'), []);
    });

    it('returns empty for missing phase', () => {
      assert.deepStrictEqual(phaseItems({ phases: {} }, 'discussion'), []);
    });
  });

  describe('phaseData', () => {
    it('returns phase object', () => {
      const data = phaseData({ phases: { discussion: { status: 'concluded', format: 'md' } } }, 'discussion');
      assert.strictEqual(data.status, 'concluded');
      assert.strictEqual(data.format, 'md');
    });

    it('returns empty object for missing phase', () => {
      assert.deepStrictEqual(phaseData({ phases: {} }, 'discussion'), {});
    });
  });

  describe('computeNextPhase', () => {
    it('returns done when review completed', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { review: { status: 'completed' } } });
      assert.strictEqual(r.next_phase, 'done');
    });

    it('returns review when implementation completed', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { implementation: { status: 'completed' } } });
      assert.strictEqual(r.next_phase, 'review');
    });

    it('returns implementation when planning concluded', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { planning: { status: 'concluded' } } });
      assert.strictEqual(r.next_phase, 'implementation');
    });

    it('returns planning when spec concluded', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { specification: { status: 'concluded' } } });
      assert.strictEqual(r.next_phase, 'planning');
    });

    it('returns specification when discussion concluded', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { discussion: { status: 'concluded' } } });
      assert.strictEqual(r.next_phase, 'specification');
    });

    it('returns discussion for fresh feature', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: {} });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('returns discussion for fresh epic (research is optional)', () => {
      const r = computeNextPhase({ work_type: 'epic', phases: {} });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('returns investigation for fresh bugfix', () => {
      const r = computeNextPhase({ work_type: 'bugfix', phases: {} });
      assert.strictEqual(r.next_phase, 'investigation');
    });

    it('returns specification when investigation concluded (bugfix)', () => {
      const r = computeNextPhase({ work_type: 'bugfix', phases: { investigation: { status: 'concluded' } } });
      assert.strictEqual(r.next_phase, 'specification');
    });

    it('returns discussion when research concluded (epic)', () => {
      const r = computeNextPhase({ work_type: 'epic', phases: { research: { status: 'concluded' } } });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('returns in-progress planning', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { planning: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'planning');
      assert.ok(r.phase_label.includes('in-progress'));
    });

    it('returns in-progress review', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { review: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'review');
      assert.strictEqual(r.phase_label, 'review (in-progress)');
    });

    it('returns in-progress implementation', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { implementation: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'implementation');
      assert.strictEqual(r.phase_label, 'implementation (in-progress)');
    });

    it('returns in-progress specification', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { specification: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'specification');
      assert.strictEqual(r.phase_label, 'specification (in-progress)');
    });

    it('returns in-progress discussion', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { discussion: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'discussion');
      assert.strictEqual(r.phase_label, 'discussion (in-progress)');
    });

    it('returns in-progress investigation (bugfix)', () => {
      const r = computeNextPhase({ work_type: 'bugfix', phases: { investigation: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'investigation');
      assert.strictEqual(r.phase_label, 'investigation (in-progress)');
    });

    it('returns in-progress research (epic)', () => {
      const r = computeNextPhase({ work_type: 'epic', phases: { research: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'research');
      assert.strictEqual(r.phase_label, 'research (in-progress)');
    });

    it('returns in-progress research (feature)', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { research: { status: 'in-progress' } } });
      assert.strictEqual(r.next_phase, 'research');
      assert.strictEqual(r.phase_label, 'research (in-progress)');
    });

    it('returns discussion when research concluded (feature)', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: { research: { status: 'concluded' } } });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('higher priority phase takes precedence', () => {
      const r = computeNextPhase({
        work_type: 'feature',
        phases: {
          implementation: { status: 'completed' },
          review: { status: 'completed' },
        },
      });
      assert.strictEqual(r.next_phase, 'done');
    });

    it('epic: returns specification when all discussion items concluded', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'concluded' },
              'billing': { status: 'concluded' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'specification');
      assert.strictEqual(r.phase_label, 'ready for specification');
    });

    it('epic: returns discussion in-progress when some items not concluded', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'concluded' },
              'billing': { status: 'in-progress' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'discussion');
      assert.strictEqual(r.phase_label, 'discussion (in-progress)');
    });

    it('epic: returns planning when all spec items concluded', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth': { status: 'concluded' } } },
          specification: { items: { 'auth-spec': { status: 'concluded' } } },
        },
      });
      assert.strictEqual(r.next_phase, 'planning');
    });

    it('epic: most advanced phase wins', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth': { status: 'concluded' }, 'billing': { status: 'in-progress' } } },
          specification: { items: { 'auth-spec': { status: 'in-progress' } } },
        },
      });
      // specification in-progress is checked before discussion
      assert.strictEqual(r.next_phase, 'specification');
      assert.strictEqual(r.phase_label, 'specification (in-progress)');
    });

    it('epic: uses flat status for research (topicless)', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: { research: { status: 'in-progress' } },
      });
      assert.strictEqual(r.next_phase, 'research');
      assert.strictEqual(r.phase_label, 'research (in-progress)');
    });
  });
});
