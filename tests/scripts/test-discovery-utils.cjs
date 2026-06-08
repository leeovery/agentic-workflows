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
  computeAnalysisCacheStatus, computeSourceProvenance,
  computeTopicLifecycle, computeNextAction, computeMapSummary,
  compareMapRows, computeNeedsSequencing,
  TIER_RANK,
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

  describe('computeSourceProvenance', () => {
    it('returns null for null/undefined source', () => {
      assert.strictEqual(computeSourceProvenance(null), null);
      assert.strictEqual(computeSourceProvenance(undefined), null);
    });

    it('returns null for source=discovery', () => {
      assert.strictEqual(computeSourceProvenance('discovery'), null);
    });

    it('returns "from {source}" for plain source', () => {
      assert.strictEqual(computeSourceProvenance('research-analysis'), 'from research-analysis');
    });

    it('unwraps colon-prefixed source to "from {parent}"', () => {
      assert.strictEqual(computeSourceProvenance('research-split:kitchen-hardware'), 'from kitchen-hardware');
    });

    it('unwraps incoming:{origin} to "from {origin}"', () => {
      assert.strictEqual(computeSourceProvenance('incoming:auth-flow'), 'from auth-flow');
    });

    it('handles comma-joined plain sources', () => {
      assert.strictEqual(
        computeSourceProvenance('research-analysis,gap-analysis'),
        'from research-analysis + gap-analysis',
      );
    });

    it('handles comma-joined sources with whitespace', () => {
      assert.strictEqual(
        computeSourceProvenance('research-analysis, gap-analysis'),
        'from research-analysis + gap-analysis',
      );
    });

    it('handles mixed colon-prefixed and plain in a comma-joined source', () => {
      assert.strictEqual(
        computeSourceProvenance('research-split:billing,gap-analysis'),
        'from billing + gap-analysis',
      );
    });

    it('returns null for empty source', () => {
      assert.strictEqual(computeSourceProvenance(''), null);
    });

    it('renders bare migration-seeded as "from migration-seeded"', () => {
      assert.strictEqual(computeSourceProvenance('migration-seeded'), 'from migration-seeded');
    });
  });

  describe('computeAnalysisCacheStatus', () => {
    const { createManifest } = require('./discovery-test-utils.cjs');

    it('research-analysis: returns absent when no research files and no cache', () => {
      createManifest(dir, 'alpha', { phases: {} });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'research-analysis');
      assert.strictEqual(r.status, 'absent');
      assert.strictEqual(r.generated, null);
      assert.deepStrictEqual(r.files, []);
    });

    it('research-analysis: returns absent when files exist but no completed research item', () => {
      createManifest(dir, 'alpha', {
        phases: { research: { items: { 'topic-a': { status: 'in-progress' } } } },
      });
      createFile(dir, '.workflows/alpha/research/topic-a.md', 'content');
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'research-analysis');
      // Completed-only input: no completed items → absent (analysis won't fire)
      assert.strictEqual(r.status, 'absent');
    });

    it('research-analysis: returns stale when completed research items exist but no cache', () => {
      createManifest(dir, 'alpha', {
        phases: { research: { items: { 'topic-a': { status: 'completed' } } } },
      });
      createFile(dir, '.workflows/alpha/research/topic-a.md', 'content');
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'research-analysis');
      assert.strictEqual(r.status, 'stale');
    });

    it('research-analysis: returns valid when checksum matches', () => {
      createFile(dir, '.workflows/alpha/research/topic-a.md', 'content-a');
      const checksum = filesChecksum([path.join(dir, '.workflows/alpha/research/topic-a.md')]);
      createManifest(dir, 'alpha', {
        phases: {
          research: {
            items: { 'topic-a': { status: 'completed' } },
            analysis_cache: { checksum, generated: '2026-05-01', files: ['topic-a.md'] },
          },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'research-analysis');
      assert.strictEqual(r.status, 'valid');
      assert.strictEqual(r.generated, '2026-05-01');
      assert.deepStrictEqual(r.files, ['topic-a.md']);
    });

    it('research-analysis: returns valid regardless of manifest insertion order (write-side sorts; read-side must too)', () => {
      // Insert items in non-alphabetical order. The analysis writes its
      // cache checksum over a SORTED file list (research-analysis.md
      // Section E). The read side in computeAnalysisCacheStatus must
      // sort identically — otherwise the cache always reports stale on
      // every workflow-continue-epic, firing analyses + KB re-indexes for no
      // reason.
      createFile(dir, '.workflows/alpha/research/zebra.md', 'z');
      createFile(dir, '.workflows/alpha/research/auth.md', 'a');
      const checksum = filesChecksum([
        path.join(dir, '.workflows/alpha/research/auth.md'),
        path.join(dir, '.workflows/alpha/research/zebra.md'),
      ]);  // sorted order matches analyses' write side
      createManifest(dir, 'alpha', {
        phases: {
          research: {
            // Non-alphabetical insertion order:
            items: { zebra: { status: 'completed' }, auth: { status: 'completed' } },
            analysis_cache: { checksum, generated: '2026-05-01', files: ['auth.md', 'zebra.md'] },
          },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'research-analysis');
      assert.strictEqual(r.status, 'valid', 'cache should be valid — read side must sort to match write side');
    });

    it('gap-analysis: returns valid regardless of manifest insertion order', () => {
      createFile(dir, '.workflows/alpha/research/zebra.md', 'rz');
      createFile(dir, '.workflows/alpha/research/auth.md', 'ra');
      createFile(dir, '.workflows/alpha/discussion/billing.md', 'db');
      const checksum = filesChecksum([
        // Sorted across both directories combined — matches discovery-gap-analysis.md write side.
        path.join(dir, '.workflows/alpha/discussion/billing.md'),
        path.join(dir, '.workflows/alpha/research/auth.md'),
        path.join(dir, '.workflows/alpha/research/zebra.md'),
      ]);
      createManifest(dir, 'alpha', {
        phases: {
          research: { items: { zebra: { status: 'completed' }, auth: { status: 'completed' } } },
          discussion: { items: { billing: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum, generated: '2026-05-02', input_files: ['auth.md', 'billing.md', 'zebra.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'gap-analysis');
      assert.strictEqual(r.status, 'valid', 'gap-analysis cache should be valid — read side must sort');
    });

    it('research-analysis: returns stale when files changed', () => {
      createFile(dir, '.workflows/alpha/research/topic-a.md', 'content-original');
      createManifest(dir, 'alpha', {
        phases: {
          research: {
            items: { 'topic-a': { status: 'completed' } },
            analysis_cache: { checksum: 'stale-hash', generated: '2026-05-01', files: ['topic-a.md'] },
          },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'research-analysis');
      assert.strictEqual(r.status, 'stale');
    });

    it('research-analysis: returns absent when cache exists but no completed items remain', () => {
      // No completed items on disk → analysis precondition fails → absent
      createManifest(dir, 'alpha', {
        phases: { research: { analysis_cache: { checksum: 'old', generated: '2026-05-01', files: ['gone.md'] } } },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'research-analysis');
      assert.strictEqual(r.status, 'absent');
      assert.deepStrictEqual(r.files, ['gone.md']);
    });

    it('gap-analysis: returns absent when no completed material and no cache', () => {
      createManifest(dir, 'alpha', { phases: {} });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'gap-analysis');
      assert.strictEqual(r.status, 'absent');
    });

    it('gap-analysis: returns absent when cache exists but no completed items remain', () => {
      // Symmetry with research-analysis: cache.files preserved on the absent
      // return so observability isn't lost, even though the precondition gate
      // means no analysis will fire.
      createManifest(dir, 'alpha', {
        phases: {
          discovery: { gap_analysis_cache: { checksum: 'old', generated: '2026-05-02', input_files: ['gone.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'gap-analysis');
      assert.strictEqual(r.status, 'absent');
      assert.deepStrictEqual(r.files, ['gone.md']);
    });

    it('gap-analysis: returns absent when discussion file exists but no completed item', () => {
      createManifest(dir, 'alpha', {
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      createFile(dir, '.workflows/alpha/discussion/auth.md', 'content');
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'gap-analysis');
      assert.strictEqual(r.status, 'absent');
    });

    it('gap-analysis: returns stale when completed discussions exist but no cache', () => {
      createManifest(dir, 'alpha', {
        phases: { discussion: { items: { auth: { status: 'completed' } } } },
      });
      createFile(dir, '.workflows/alpha/discussion/auth.md', 'content');
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'gap-analysis');
      assert.strictEqual(r.status, 'stale');
    });

    it('gap-analysis: returns valid when checksum matches completed discussion files', () => {
      createFile(dir, '.workflows/alpha/discussion/auth.md', 'content-d');
      const checksum = filesChecksum([path.join(dir, '.workflows/alpha/discussion/auth.md')]);
      createManifest(dir, 'alpha', {
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum, generated: '2026-05-02', input_files: ['auth.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'gap-analysis');
      assert.strictEqual(r.status, 'valid');
      assert.strictEqual(r.generated, '2026-05-02');
      assert.deepStrictEqual(r.files, ['auth.md']);
    });

    it('gap-analysis: includes completed research files in checksum alongside discussions', () => {
      createFile(dir, '.workflows/alpha/discussion/auth.md', 'content-d');
      createFile(dir, '.workflows/alpha/research/auth.md', 'content-r');
      const checksumDOnly = filesChecksum([path.join(dir, '.workflows/alpha/discussion/auth.md')]);
      createManifest(dir, 'alpha', {
        phases: {
          research: { items: { auth: { status: 'completed' } } },
          discussion: { items: { auth: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum: checksumDOnly, generated: '2026-05-02', input_files: ['auth.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'gap-analysis');
      // Cache only saw discussion checksum, but reality includes the completed research file too
      assert.strictEqual(r.status, 'stale');
    });

    it('returns absent for unknown kind', () => {
      createManifest(dir, 'alpha', { phases: {} });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.workflows'), 'nonsense');
      assert.strictEqual(r.status, 'absent');
    });

    it('returns absent for null manifest', () => {
      const r = computeAnalysisCacheStatus(null, path.join(dir, '.workflows'), 'research-analysis');
      assert.strictEqual(r.status, 'absent');
    });
  });

  describe('TIER_RANK', () => {
    it('orders tiers from ready → in-flight → decided → fresh → handled → cancelled', () => {
      assert.strictEqual(TIER_RANK['→'], 0);
      assert.strictEqual(TIER_RANK['◐'], 1);
      assert.strictEqual(TIER_RANK['✓'], 2);
      assert.strictEqual(TIER_RANK['○'], 3);
      assert.strictEqual(TIER_RANK['⊙'], 4);
      assert.strictEqual(TIER_RANK['⊘'], 5);
    });

    it('ranks handled just before cancelled (both non-actionable)', () => {
      assert.ok(TIER_RANK['⊙'] < TIER_RANK['⊘']);
      assert.ok(TIER_RANK['○'] < TIER_RANK['⊙']);
    });
  });

  describe('computeTopicLifecycle', () => {
    const { createManifest } = require('./discovery-test-utils.cjs');

    // Build a manifest with the named topic placed under the given phase
    // statuses, then resolve and load it.
    function loadWithPhases(name, phaseStatuses) {
      const phases = {};
      for (const [phase, status] of Object.entries(phaseStatuses)) {
        phases[phase] = { items: { [name]: { status } } };
      }
      createManifest(dir, 'alpha', { phases });
      return loadManifest(dir, 'alpha');
    }

    it('returns fresh when neither research nor discussion item exists', () => {
      createManifest(dir, 'alpha', { phases: {} });
      const m = loadManifest(dir, 'alpha');
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'fresh', tier: '○', current_phase: null });
    });

    it('returns researching when research item is in-progress', () => {
      const m = loadWithPhases('auth', { research: 'in-progress' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'researching', tier: '◐', current_phase: 'research' });
    });

    it('returns ready_for_discussion when research is completed and no discussion item yet', () => {
      const m = loadWithPhases('auth', { research: 'completed' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'ready_for_discussion', tier: '→', current_phase: 'research' });
    });

    it('returns discussing when discussion item is in-progress', () => {
      const m = loadWithPhases('auth', { discussion: 'in-progress' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'discussing', tier: '◐', current_phase: 'discussion' });
    });

    it('returns decided when discussion item is completed', () => {
      const m = loadWithPhases('auth', { discussion: 'completed' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'decided', tier: '✓', current_phase: 'discussion' });
    });

    it('returns cancelled only when BOTH research and discussion items are cancelled', () => {
      const m = loadWithPhases('auth', { research: 'cancelled', discussion: 'cancelled' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'cancelled', tier: '⊘', current_phase: null });
    });

    it('falls through to fresh when only research is cancelled (discussion path still open)', () => {
      const m = loadWithPhases('auth', { research: 'cancelled' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'fresh', tier: '○', current_phase: null });
    });

    it('falls through to fresh when only discussion is cancelled (research path still open)', () => {
      const m = loadWithPhases('auth', { discussion: 'cancelled' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'fresh', tier: '○', current_phase: null });
    });

    it('renders ready_for_discussion when research is superseded and no discussion exists', () => {
      // Defensive branch: legacy-research-split deletes the discovery item
      // on supersede, so this isn't reached via that flow. But if a user
      // re-adds the topic to discovery items manually, the discussion path
      // remains open and the lifecycle should reflect that.
      const m = loadWithPhases('auth', { research: 'superseded' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.deepStrictEqual(r, { lifecycle: 'ready_for_discussion', tier: '→', current_phase: 'research' });
    });

    it('discussion status wins over research status — decided overrides ready_for_discussion', () => {
      const m = loadWithPhases('auth', { research: 'completed', discussion: 'completed' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.strictEqual(r.lifecycle, 'decided');
    });

    it('discussion status wins over research status — discussing overrides researching', () => {
      const m = loadWithPhases('auth', { research: 'in-progress', discussion: 'in-progress' });
      const r = computeTopicLifecycle(m, 'auth');
      assert.strictEqual(r.lifecycle, 'discussing');
    });

    // Build a manifest where the discovery item carries the `handled` marker,
    // alongside whatever research/discussion statuses are supplied.
    function loadWithHandled(name, handledValue, phaseStatuses) {
      const phases = { discovery: { items: { [name]: { routing: 'research', handled: handledValue } } } };
      for (const [phase, status] of Object.entries(phaseStatuses || {})) {
        phases[phase] = { items: { [name]: { status } } };
      }
      createManifest(dir, 'alpha', { phases });
      return loadManifest(dir, 'alpha');
    }

    it('handled marker beats ready_for_discussion (research completed, no discussion)', () => {
      const m = loadWithHandled('umbrella', true, { research: 'completed' });
      const r = computeTopicLifecycle(m, 'umbrella');
      assert.deepStrictEqual(r, { lifecycle: 'handled', tier: '⊙', current_phase: null });
    });

    it('handled marker beats decided (same-named discussion completed)', () => {
      const m = loadWithHandled('umbrella', true, { research: 'completed', discussion: 'completed' });
      const r = computeTopicLifecycle(m, 'umbrella');
      assert.strictEqual(r.lifecycle, 'handled');
      assert.strictEqual(r.tier, '⊙');
    });

    it('absent marker falls through to name-matching', () => {
      // No handled field at all → resolves by research/discussion statuses.
      const m = loadWithPhases('topic', { research: 'completed' });
      const r = computeTopicLifecycle(m, 'topic');
      assert.strictEqual(r.lifecycle, 'ready_for_discussion');
    });

    it('handled !== true (e.g. false) falls through to name-matching', () => {
      const m = loadWithHandled('topic', false, { research: 'completed' });
      const r = computeTopicLifecycle(m, 'topic');
      assert.strictEqual(r.lifecycle, 'ready_for_discussion');
    });

    it('reads only the item own field — handled on one topic does not affect another', () => {
      createManifest(dir, 'alpha', {
        phases: {
          discovery: {
            items: {
              umbrella: { routing: 'research', handled: true },
              sibling: { routing: 'research' },
            },
          },
          research: { items: { umbrella: { status: 'completed' }, sibling: { status: 'completed' } } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      assert.strictEqual(computeTopicLifecycle(m, 'umbrella').lifecycle, 'handled');
      assert.strictEqual(computeTopicLifecycle(m, 'sibling').lifecycle, 'ready_for_discussion');
    });
  });

  describe('computeNextAction', () => {
    it('fresh + research → start_research', () => {
      assert.strictEqual(computeNextAction('research', 'fresh'), 'start_research');
    });

    it('fresh + discussion → start_discussion', () => {
      assert.strictEqual(computeNextAction('discussion', 'fresh'), 'start_discussion');
    });

    it('researching → continue_research', () => {
      assert.strictEqual(computeNextAction('research', 'researching'), 'continue_research');
      assert.strictEqual(computeNextAction('discussion', 'researching'), 'continue_research');
    });

    it('ready_for_discussion → start_discussion_after_research', () => {
      assert.strictEqual(computeNextAction('research', 'ready_for_discussion'), 'start_discussion_after_research');
      assert.strictEqual(computeNextAction('discussion', 'ready_for_discussion'), 'start_discussion_after_research');
    });

    it('discussing → continue_discussion', () => {
      assert.strictEqual(computeNextAction('research', 'discussing'), 'continue_discussion');
      assert.strictEqual(computeNextAction('discussion', 'discussing'), 'continue_discussion');
    });

    it('decided → null (no next action)', () => {
      assert.strictEqual(computeNextAction('research', 'decided'), null);
      assert.strictEqual(computeNextAction('discussion', 'decided'), null);
    });

    it('cancelled → null (no next action)', () => {
      assert.strictEqual(computeNextAction('research', 'cancelled'), null);
      assert.strictEqual(computeNextAction('discussion', 'cancelled'), null);
    });

    it('handled → null (no next action)', () => {
      assert.strictEqual(computeNextAction('research', 'handled'), null);
      assert.strictEqual(computeNextAction('discussion', 'handled'), null);
    });

    it('unknown lifecycle → null', () => {
      assert.strictEqual(computeNextAction('research', 'made-up'), null);
    });
  });

  describe('computeMapSummary', () => {
    it('returns zero counts for an empty items array', () => {
      assert.deepStrictEqual(
        computeMapSummary([]),
        { total: 0, decided: 0, in_flight: 0, ready: 0, fresh: 0, handled: 0, cancelled: 0 },
      );
    });

    it('counts items by tier glyph', () => {
      const items = [
        { tier: '→' },
        { tier: '→' },
        { tier: '◐' },
        { tier: '✓' },
        { tier: '○' },
        { tier: '○' },
        { tier: '○' },
        { tier: '⊙' },
        { tier: '⊘' },
      ];
      assert.deepStrictEqual(
        computeMapSummary(items),
        { total: 9, decided: 1, in_flight: 1, ready: 2, fresh: 3, handled: 1, cancelled: 1 },
      );
    });

    it('counts the handled bucket independently of cancelled', () => {
      const items = [{ tier: '⊙' }, { tier: '⊙' }, { tier: '⊘' }];
      const r = computeMapSummary(items);
      assert.strictEqual(r.handled, 2);
      assert.strictEqual(r.cancelled, 1);
    });

    it('ignores items with unrecognised tier glyphs but still counts total', () => {
      const items = [{ tier: '✓' }, { tier: '?' }, { tier: undefined }];
      const r = computeMapSummary(items);
      assert.strictEqual(r.total, 3);
      assert.strictEqual(r.decided, 1);
      assert.strictEqual(r.in_flight, 0);
      assert.strictEqual(r.ready, 0);
      assert.strictEqual(r.fresh, 0);
      assert.strictEqual(r.cancelled, 0);
    });
  });

  describe('computeNeedsSequencing', () => {
    it('returns true when a live item is missing order', () => {
      const items = [
        { tier: '◐', order: 1 },
        { tier: '○', order: null },
      ];
      assert.strictEqual(computeNeedsSequencing(items), true);
    });

    it('returns false when all live items are ordered', () => {
      const items = [
        { tier: '→', order: 1 },
        { tier: '◐', order: 2 },
        { tier: '✓', order: 3 },
      ];
      assert.strictEqual(computeNeedsSequencing(items), false);
    });

    it('returns false when only a cancelled item is missing order', () => {
      const items = [
        { tier: '◐', order: 1 },
        { tier: '⊘', order: null },
      ];
      assert.strictEqual(computeNeedsSequencing(items), false);
    });

    it('returns false when only a handled item is missing order (excluded like cancelled)', () => {
      const items = [
        { tier: '◐', order: 1 },
        { tier: '⊙', order: null },
      ];
      assert.strictEqual(computeNeedsSequencing(items), false);
    });

    it('returns true when a live item is missing order even alongside a handled item', () => {
      const items = [
        { tier: '⊙', order: null },
        { tier: '○', order: null },
      ];
      assert.strictEqual(computeNeedsSequencing(items), true);
    });

    it('treats undefined order the same as null (missing)', () => {
      const items = [{ tier: '○' }];
      assert.strictEqual(computeNeedsSequencing(items), true);
    });

    it('returns false for an empty map', () => {
      assert.strictEqual(computeNeedsSequencing([]), false);
    });
  });

  describe('compareMapRows', () => {
    function sorted(items) {
      return items.slice().sort(compareMapRows).map(i => i.name);
    }

    it('orders by tier rank first', () => {
      const items = [
        { name: 'fresh', tier: '○', order: 1 },
        { name: 'ready', tier: '→', order: 9 },
        { name: 'inflight', tier: '◐', order: 5 },
      ];
      assert.deepStrictEqual(sorted(items), ['ready', 'inflight', 'fresh']);
    });

    it('orders by order ascending within the same tier', () => {
      const items = [
        { name: 'c', tier: '◐', order: 3 },
        { name: 'a', tier: '◐', order: 1 },
        { name: 'b', tier: '◐', order: 2 },
      ];
      assert.deepStrictEqual(sorted(items), ['a', 'b', 'c']);
    });

    it('sorts null order last within a tier', () => {
      const items = [
        { name: 'unordered', tier: '○', order: null },
        { name: 'ordered', tier: '○', order: 2 },
      ];
      assert.deepStrictEqual(sorted(items), ['ordered', 'unordered']);
    });

    it('falls back to name on equal order', () => {
      const items = [
        { name: 'zebra', tier: '◐', order: 1 },
        { name: 'apple', tier: '◐', order: 1 },
      ];
      assert.deepStrictEqual(sorted(items), ['apple', 'zebra']);
    });

    it('falls back to name when both orders are null', () => {
      const items = [
        { name: 'beta', tier: '○', order: null },
        { name: 'alpha', tier: '○', order: null },
      ];
      assert.deepStrictEqual(sorted(items), ['alpha', 'beta']);
    });
  });

});
