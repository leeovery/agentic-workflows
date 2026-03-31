'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { setupFixture, cleanupFixture, createFile } = require('./discovery-test-utils.cjs');

const {
  fileExists, listFiles, listDirs, countFiles, filesChecksum,
  loadManifest, loadActiveManifests, loadAllManifests,
  loadProjectManifest,
  phaseStatus, phaseItems, phaseData, computeNextPhase,
} = require('../../skills/workflow-shared/scripts/discovery-utils.cjs');

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
    it('returns only in-progress manifests', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'active', { status: 'in-progress' });
      createManifest(dir, 'done', { status: 'completed' });
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'active');
    });

    it('skips dotfiles', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'good', {});
      fs.mkdirSync(path.join(dir, '.workflows', '.state'), { recursive: true });
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
    });
  });

  describe('loadAllManifests', () => {
    it('returns manifests of all statuses', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'active', { status: 'in-progress' });
      createManifest(dir, 'done', { status: 'completed' });
      createManifest(dir, 'cancelled', { status: 'cancelled' });
      const results = loadAllManifests(dir);
      assert.strictEqual(results.length, 3);
    });

    it('skips dotfiles', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'good', {});
      fs.mkdirSync(path.join(dir, '.workflows', '.state'), { recursive: true });
      const results = loadAllManifests(dir);
      assert.strictEqual(results.length, 1);
    });
  });

  describe('loadProjectManifest', () => {
    it('returns parsed project manifest', () => {
      const proj = { work_units: { alpha: { work_type: 'feature' } } };
      fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(proj));
      const result = loadProjectManifest(dir);
      assert.deepStrictEqual(result, proj);
    });

    it('returns null when missing', () => {
      assert.strictEqual(loadProjectManifest(dir), null);
    });
  });

  describe('loadActiveManifests (project-manifest-driven)', () => {
    it('uses project manifest for work unit names', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'alpha', { status: 'in-progress' });
      createManifest(dir, 'beta', { status: 'completed' });
      // Project manifest only lists alpha and beta
      const proj = { work_units: { alpha: { work_type: 'feature' }, beta: { work_type: 'feature' } } };
      fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(proj));
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'alpha');
    });

    it('skips work units in project manifest whose directory was deleted', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'exists', { status: 'in-progress' });
      // "ghost" is in project manifest but has no directory
      const proj = { work_units: { exists: { work_type: 'feature' }, ghost: { work_type: 'epic' } } };
      fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(proj));
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'exists');
    });

    it('falls back to filesystem when project manifest missing', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'fallback', { status: 'in-progress' });
      // No project manifest file
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'fallback');
    });
  });

  describe('loadAllManifests (project-manifest-driven)', () => {
    it('uses project manifest for work unit names', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'a', { status: 'in-progress' });
      createManifest(dir, 'b', { status: 'completed' });
      const proj = { work_units: { a: { work_type: 'feature' }, b: { work_type: 'epic' } } };
      fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(proj));
      const results = loadAllManifests(dir);
      assert.strictEqual(results.length, 2);
    });

    it('skips deleted work units gracefully', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'real', { status: 'in-progress' });
      const proj = { work_units: { real: { work_type: 'feature' }, gone: { work_type: 'epic' } } };
      fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(proj));
      const results = loadAllManifests(dir);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'real');
    });
  });

  describe('phaseStatus', () => {
    it('extracts status from single item', () => {
      assert.strictEqual(phaseStatus({ phases: { discussion: { items: { test: { status: 'completed' } } } } }, 'discussion'), 'completed');
    });

    it('aggregates multiple items — all completed', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } } },
      }, 'discussion'), 'completed');
    });

    it('aggregates multiple items — some in-progress', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'completed' }, b: { status: 'in-progress' } } } },
      }, 'discussion'), 'in-progress');
    });

    it('aggregates multiple items — no statuses returns null', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: {}, b: {} } } },
      }, 'discussion'), null);
    });

    it('returns null for empty items', () => {
      assert.strictEqual(phaseStatus({ phases: { discussion: { items: {} } } }, 'discussion'), null);
    });

    it('returns null for phase with flat status but no items', () => {
      assert.strictEqual(phaseStatus({ phases: { discussion: { status: 'completed' } } }, 'discussion'), null);
    });

    it('returns null for missing phase', () => {
      assert.strictEqual(phaseStatus({ phases: {} }, 'discussion'), null);
    });

    it('returns null for no phases', () => {
      assert.strictEqual(phaseStatus({}, 'discussion'), null);
    });

    it('aggregates all pending as pending', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'pending' }, b: { status: 'pending' } } } },
      }, 'discussion'), 'pending');
    });

    it('returns in-progress when mixed with pending', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'pending' }, b: { status: 'in-progress' } } } },
      }, 'discussion'), 'in-progress');
    });

    it('skipped items are invisible — completed plus skipped returns completed', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'completed' }, b: { status: 'skipped' } } } },
      }, 'discussion'), 'completed');
    });

    it('all skipped returns null (soft-deleted, phase effectively empty)', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'skipped' }, b: { status: 'skipped' } } } },
      }, 'discussion'), null);
    });

    it('single skipped item returns null', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'skipped' } } } },
      }, 'discussion'), null);
    });

    it('returns pending when mixed completed and pending', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'completed' }, b: { status: 'pending' } } } },
      }, 'discussion'), 'pending');
    });
  });

  describe('phaseItems', () => {
    it('extracts items', () => {
      const items = phaseItems({ phases: { discussion: { items: { auth: { status: 'completed' } } } } }, 'discussion');
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'auth');
      assert.strictEqual(items[0].status, 'completed');
    });

    it('returns empty for no items', () => {
      assert.deepStrictEqual(phaseItems({ phases: { discussion: { status: 'completed' } } }, 'discussion'), []);
    });

    it('returns empty for missing phase', () => {
      assert.deepStrictEqual(phaseItems({ phases: {} }, 'discussion'), []);
    });

    it('returns empty when items is null', () => {
      assert.deepStrictEqual(phaseItems({ phases: { discussion: { items: null } } }, 'discussion'), []);
    });

    it('returns empty when items is a string', () => {
      assert.deepStrictEqual(phaseItems({ phases: { discussion: { items: 'bad' } } }, 'discussion'), []);
    });

    it('returns empty when no phases key', () => {
      assert.deepStrictEqual(phaseItems({}, 'discussion'), []);
    });
  });

  describe('phaseData', () => {
    it('returns phase object', () => {
      const data = phaseData({ phases: { discussion: { status: 'completed', format: 'md' } } }, 'discussion');
      assert.strictEqual(data.status, 'completed');
      assert.strictEqual(data.format, 'md');
    });

    it('returns empty object for missing phase', () => {
      assert.deepStrictEqual(phaseData({ phases: {} }, 'discussion'), {});
    });
  });

  describe('computeNextPhase', () => {
    it('returns done when review completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { review: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'done');
    });

    it('returns review when implementation completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { implementation: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'review');
    });

    it('returns implementation when planning completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { planning: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'implementation');
    });

    it('returns planning when spec completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { specification: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'planning');
    });

    it('returns specification when discussion completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { discussion: { items: { test: { status: 'completed' } } } } });
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

    it('returns specification when investigation completed (bugfix)', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'bugfix', phases: { investigation: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'specification');
    });

    it('returns discussion when research completed (epic)', () => {
      const r = computeNextPhase({ work_type: 'epic', phases: { research: { items: { explore: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('returns in-progress planning', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { planning: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'planning');
      assert.ok(r.phase_label.includes('in-progress'));
    });

    it('returns in-progress review', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { review: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'review');
      assert.strictEqual(r.phase_label, 'review (in-progress)');
    });

    it('returns in-progress implementation', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { implementation: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'implementation');
      assert.strictEqual(r.phase_label, 'implementation (in-progress)');
    });

    it('returns in-progress specification', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { specification: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'specification');
      assert.strictEqual(r.phase_label, 'specification (in-progress)');
    });

    it('returns in-progress discussion', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { discussion: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'discussion');
      assert.strictEqual(r.phase_label, 'discussion (in-progress)');
    });

    it('returns in-progress investigation (bugfix)', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'bugfix', phases: { investigation: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'investigation');
      assert.strictEqual(r.phase_label, 'investigation (in-progress)');
    });

    it('returns in-progress research (epic)', () => {
      const r = computeNextPhase({ work_type: 'epic', phases: { research: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'research');
      assert.strictEqual(r.phase_label, 'research (in-progress)');
    });

    it('returns in-progress research (feature)', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { research: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'research');
      assert.strictEqual(r.phase_label, 'research (in-progress)');
    });

    it('returns discussion when research completed (feature)', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { research: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('higher priority phase takes precedence', () => {
      const r = computeNextPhase({
        name: 'test',
        work_type: 'feature',
        phases: {
          implementation: { items: { test: { status: 'completed' } } },
          review: { items: { test: { status: 'completed' } } },
        },
      });
      assert.strictEqual(r.next_phase, 'done');
    });

    it('epic: returns specification when all discussion items completed', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'completed' },
              'billing': { status: 'completed' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'specification');
      assert.strictEqual(r.phase_label, 'ready for specification');
    });

    it('epic: returns discussion in-progress when some items not completed', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'completed' },
              'billing': { status: 'in-progress' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'discussion');
      assert.strictEqual(r.phase_label, 'discussion (in-progress)');
    });

    it('epic: returns planning when all spec items completed', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth': { status: 'completed' } } },
          specification: { items: { 'auth-spec': { status: 'completed' } } },
        },
      });
      assert.strictEqual(r.next_phase, 'planning');
    });

    it('epic: most advanced phase wins', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: { items: { 'auth': { status: 'completed' }, 'billing': { status: 'in-progress' } } },
          specification: { items: { 'auth-spec': { status: 'in-progress' } } },
        },
      });
      // specification in-progress is checked before discussion
      assert.strictEqual(r.next_phase, 'specification');
      assert.strictEqual(r.phase_label, 'specification (in-progress)');
    });

    it('epic: ignores flat status for uninitialised research', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: { research: { status: 'in-progress' } },
      });
      // Flat status is ignored — falls through to default
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('epic: aggregates research items like other phases', () => {
      const r = computeNextPhase({
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
      assert.strictEqual(r.next_phase, 'research');
      assert.strictEqual(r.phase_label, 'research (in-progress)');
    });

    it('epic: research completed with items advances to discussion', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          research: {
            items: {
              'exploration': { status: 'completed' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'discussion');
      assert.strictEqual(r.phase_label, 'ready for discussion');
    });

    it('epic: items with missing status fields are ignored in aggregation', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'completed' },
              'billing': {},
            },
          },
        },
      });
      // Only 'completed' is present (billing has no status), so aggregation sees only completed
      assert.strictEqual(r.next_phase, 'specification');
    });

    it('epic: mixed completed and completed items returns first status', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          implementation: {
            items: {
              'auth': { status: 'completed' },
              'billing': { status: 'completed' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'review');
    });

    it('quick-fix: returns scoping for fresh quick-fix', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: {} });
      assert.strictEqual(r.next_phase, 'scoping');
      assert.strictEqual(r.phase_label, 'ready for scoping');
    });

    it('quick-fix: returns in-progress scoping', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: { scoping: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'scoping');
      assert.strictEqual(r.phase_label, 'scoping (in-progress)');
    });

    it('quick-fix: returns implementation when scoping completed', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: { scoping: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'implementation');
      assert.strictEqual(r.phase_label, 'ready for implementation');
    });

    it('quick-fix: returns in-progress implementation', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: {
        scoping: { items: { test: { status: 'completed' } } },
        implementation: { items: { test: { status: 'in-progress' } } },
      } });
      assert.strictEqual(r.next_phase, 'implementation');
      assert.strictEqual(r.phase_label, 'implementation (in-progress)');
    });

    it('quick-fix: returns review when implementation completed', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: {
        scoping: { items: { test: { status: 'completed' } } },
        implementation: { items: { test: { status: 'completed' } } },
      } });
      assert.strictEqual(r.next_phase, 'review');
      assert.strictEqual(r.phase_label, 'ready for review');
    });

    it('quick-fix: returns in-progress review', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: {
        scoping: { items: { test: { status: 'completed' } } },
        implementation: { items: { test: { status: 'completed' } } },
        review: { items: { test: { status: 'in-progress' } } },
      } });
      assert.strictEqual(r.next_phase, 'review');
      assert.strictEqual(r.phase_label, 'review (in-progress)');
    });

    it('quick-fix: returns done when review completed', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: {
        scoping: { items: { test: { status: 'completed' } } },
        implementation: { items: { test: { status: 'completed' } } },
        review: { items: { test: { status: 'completed' } } },
      } });
      assert.strictEqual(r.next_phase, 'done');
      assert.strictEqual(r.phase_label, 'pipeline complete');
    });

    it('quick-fix: does not fall through to discussion/spec phases', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', phases: {
        discussion: { items: { test: { status: 'completed' } } },
      } });
      // Should still return scoping, not specification
      assert.strictEqual(r.next_phase, 'scoping');
    });

    it('epic: pending discussions return discussion phase', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'pending' },
              'billing': { status: 'pending' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'discussion');
      assert.ok(r.phase_label.includes('pending'));
    });

    it('epic: all discussions skipped stays on discussion (nothing to specify)', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'skipped' },
              'billing': { status: 'skipped' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('epic: mixed completed and skipped discussions advances to specification', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': { status: 'completed' },
              'billing': { status: 'skipped' },
            },
          },
        },
      });
      assert.strictEqual(r.next_phase, 'specification');
      assert.strictEqual(r.phase_label, 'ready for specification');
    });

    it('epic: all items have no status falls back to null', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          discussion: {
            items: {
              'auth': {},
              'billing': {},
            },
          },
        },
      });
      // No statuses found, aggregation returns null, falls through to default
      assert.strictEqual(r.next_phase, 'discussion');
    });
  });
});
