'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { setupFixture, cleanupFixture, createFile, statePath } = require('./discovery-test-utils.cjs');

const {
  fileExists, listFiles, listDirs, filesChecksum,
  loadManifest, loadActiveManifests, loadAllManifests,
  loadProjectManifest,
} = require('../../skills/leeway-engine/scripts/domain/reads.cjs');
const {
  phaseStatus, phaseItems, phaseData, computeNextPhase, lastCompletedPhase,
  computeAnalysisCacheStatus, computeSourceProvenance,
  computeTopicLifecycle, computeNextAction, computeMapSummary,
  compareMapRows, computeNeedsSequencing, buildDiscoveryMap,
  mailboxDir, mailboxFiles, mailboxDepth, mailPhase, mailPhases,
  awaitedExperiments, waits, topicWaits, CONVERSATION_ACTIONS, CLOSED_LIFECYCLES, lifecyclePhrase,
  TIER_RANK,
  cancelPlan, postponePlan, postponeTarget, postponeClashPhrase, postponedItem, topicKey, noTopicRefusal,
  fixesUnderWay, investigationUnderWay,
} = require('../../skills/leeway-engine/scripts/domain/derivations.cjs');

/**
 * A unit of `type` whose build runs by its two-phase cut, the phases named
 * closed, at `status`.
 * @param {string} type @param {number[]} closed @param {string} [status]
 */
function byCut(type, closed, status = 'in-progress') {
  const checklists = Object.fromEntries(closed.map((phase) => [`phase-${phase}-close`, { items: {}, closed: '2026-11-01T00:00:00.000Z' }]));
  return { name: 'test', work_type: type, status, phases: {}, build: { position: 'step' }, cut: { phases: [{ name: 'One' }, { name: 'Two' }] }, checklists };
}

describe('reads + derivations', () => {
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
      const mdir = path.join(dir, '.leeway', 'test');
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
      fs.mkdirSync(path.join(dir, '.leeway', '.state'), { recursive: true });
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
      fs.mkdirSync(path.join(dir, '.leeway', '.state'), { recursive: true });
      const results = loadAllManifests(dir);
      assert.strictEqual(results.length, 1);
    });
  });

  describe('loadProjectManifest', () => {
    it('returns parsed project manifest', () => {
      const proj = { work_units: { alpha: { work_type: 'feature' } } };
      fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(proj));
      const result = loadProjectManifest(dir);
      assert.deepStrictEqual(result, proj);
    });

    it('returns null when missing', () => {
      fs.rmSync(path.join(dir, '.leeway', 'manifest.json'));
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
      fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(proj));
      const results = loadActiveManifests(dir);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'alpha');
    });

    it('skips work units in project manifest whose directory was deleted', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'exists', { status: 'in-progress' });
      // "ghost" is in project manifest but has no directory
      const proj = { work_units: { exists: { work_type: 'feature' }, ghost: { work_type: 'epic' } } };
      fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(proj));
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
      fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(proj));
      const results = loadAllManifests(dir);
      assert.strictEqual(results.length, 2);
    });

    it('skips deleted work units gracefully', () => {
      const { createManifest } = require('./discovery-test-utils.cjs');
      createManifest(dir, 'real', { status: 'in-progress' });
      const proj = { work_units: { real: { work_type: 'feature' }, gone: { work_type: 'epic' } } };
      fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(proj));
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

    it('a promoted discussion drops out of the aggregate — it continues in its cross-cutting unit', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'promoted', promoted_to: 'cc' }, b: { status: 'in-progress' } } } },
      }, 'discussion'), 'in-progress');
      assert.strictEqual(phaseStatus({ phases: { discussion: { items: { a: { status: 'promoted', promoted_to: 'cc' } } } } }, 'discussion'), null);
    });

    it('aggregates multiple items — no statuses returns null', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: {}, b: {} } } },
      }, 'discussion'), null);
    });

    it('returns null for empty items', () => {
      assert.strictEqual(phaseStatus({ phases: { discussion: { items: {} } } }, 'discussion'), null);
    });

    it('returns null for a single proposed spec item', () => {
      assert.strictEqual(phaseStatus({
        phases: { specification: { items: { auth: { status: 'proposed' } } } },
      }, 'specification'), null);
    });

    it('returns null when every spec item is proposed', () => {
      assert.strictEqual(phaseStatus({
        phases: { specification: { items: { a: { status: 'proposed' }, b: { status: 'proposed' } } } },
      }, 'specification'), null);
    });

    it('ignores proposed when aggregating — proposed + completed → completed', () => {
      assert.strictEqual(phaseStatus({
        phases: { specification: { items: { a: { status: 'proposed' }, b: { status: 'completed' } } } },
      }, 'specification'), 'completed');
    });

    it('ignores proposed when aggregating — proposed + in-progress → in-progress', () => {
      assert.strictEqual(phaseStatus({
        phases: { specification: { items: { a: { status: 'proposed' }, b: { status: 'in-progress' } } } },
      }, 'specification'), 'in-progress');
    });

    it('returns null for a single unstarted item — a stub is pre-live, not a reached phase', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { auth: { status: 'unstarted' } } } },
      }, 'discussion'), null);
    });

    it('returns null when every item is unstarted', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'unstarted' }, b: { status: 'unstarted' } } } },
      }, 'discussion'), null);
    });

    it('ignores unstarted when aggregating — unstarted + completed → completed', () => {
      assert.strictEqual(phaseStatus({
        phases: { discussion: { items: { a: { status: 'unstarted' }, b: { status: 'completed' } } } },
      }, 'discussion'), 'completed');
    });

    it('ignores unstarted when aggregating — unstarted + in-progress → in-progress', () => {
      assert.strictEqual(phaseStatus({
        phases: { investigation: { items: { a: { status: 'unstarted' }, b: { status: 'in-progress' } } } },
      }, 'investigation'), 'in-progress');
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

    it('reads a build by its cut off its own records: the build in progress until every phase of its cut has closed, the review phase in progress from then, both completed once finish completed the unit — its review items never read (P13, 14.6.1)', () => {
      const reviewed = { review: { items: { test: { status: 'completed' } } } };
      const places = (/** @type {Record<string, any>} */ unit) => [phaseStatus(unit, 'implementation'), phaseStatus(unit, 'review')];
      assert.deepStrictEqual([
        places({ ...byCut('feature', [1]), phases: reviewed }),
        places(byCut('feature', [1, 2])),
        places(byCut('feature', [1, 2], 'completed')),
      ], [['in-progress', null], ['completed', 'in-progress'], ['completed', 'completed']]);
    });

    it('reads the one spec a unit writes, which keeps no items, completed once its build has begun and none before (P7); a unit with the old spec\'s items reads them', () => {
      const built = { build: { position: 'auto' } };
      assert.deepStrictEqual([
        phaseStatus({ phases: {} }, 'specification'),
        phaseStatus({ phases: {}, ...built }, 'specification'),
        phaseStatus({ phases: { specification: { items: {} } }, ...built }, 'specification'),
        phaseStatus({ phases: {}, ...built }, 'planning'),
        phaseStatus({ phases: { specification: { items: { a: { status: 'in-progress' } } } } }, 'specification'),
      ], [null, 'completed', 'completed', null, 'in-progress']);
    });
  });

  describe('lastCompletedPhase', () => {
    it('reads the one spec completed once its build has begun, the unit cancelled after ready to build\'s yes past its discussion', () => {
      const decided = { discussion: { items: { pay: { status: 'completed' } } } };
      assert.deepStrictEqual([
        lastCompletedPhase({ phases: decided }, ['discussion', 'specification', 'implementation']),
        lastCompletedPhase({ phases: decided, build: { position: 'auto' } }, ['discussion', 'specification', 'implementation']),
      ], ['discussion', 'specification']);
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
    it('returns done when an old unit\'s review completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { implementation: { items: { test: { status: 'completed' } } }, review: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'done');
    });

    it('epic: not done when one topic completes review with others mid-pipeline', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          planning: { items: { 'cli-presentation': { status: 'completed' }, 'mint-release-tool': { status: 'completed' } } },
          implementation: { items: { 'cli-presentation': { status: 'completed' } } },
          review: { items: { 'cli-presentation': { status: 'completed' } } },
        },
      });
      assert.strictEqual(r.next_phase, 'review');
      assert.strictEqual(r.phase_label, 'review completed for current topics');
    });

    it('epic: never phase-derives done — completion is the explicit status flip', () => {
      const r = computeNextPhase({
        work_type: 'epic',
        phases: {
          implementation: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
          review: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        },
      });
      assert.notStrictEqual(r.next_phase, 'done');
    });

    it('returns review when implementation completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { implementation: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'review');
    });

    it('returns implementation when planning completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { planning: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'implementation');
    });

    it('returns planning when the old spec\'s item completed — a unit whose building began under it keeps its plan, a build begun on it never read by the cut (P12)', () => {
      const kept = (/** @type {Record<string, unknown>} */ more) => computeNextPhase({ name: 'test', work_type: 'feature', phases: { specification: { items: { test: { status: 'completed' } } } }, ...more }).next_phase;
      assert.deepStrictEqual([kept({}), kept({ build: { position: 'step' } })], ['planning', 'planning']);
    });

    it('returns implementation in progress once ready to build\'s yes began the build, whatever the work type that writes a spec, until every phase of the cut has closed, then the review phase under way; once finish completed the unit, an epic to its menu, its review completed, and every other type done (E6, 12.6.7, 14.6.1, 24.1.2)', () => {
      const types = ['feature', 'epic', 'bugfix'];
      const at = (/** @type {number[]} */ phases, /** @type {string} */ status = 'in-progress') => types.map((type) => computeNextPhase(byCut(type, phases, status)));
      assert.deepStrictEqual([at([]), at([1]), at([1, 2]), at([1, 2], 'completed')], [
        types.map(() => ({ next_phase: 'implementation', phase_label: 'implementation (in-progress)' })),
        types.map(() => ({ next_phase: 'implementation', phase_label: 'implementation (in-progress)' })),
        types.map(() => ({ next_phase: 'review', phase_label: 'review (in-progress)' })),
        [{ next_phase: 'done', phase_label: 'pipeline complete' }, { next_phase: 'review', phase_label: 'review completed' }, { next_phase: 'done', phase_label: 'pipeline complete' }],
      ]);
    });

    it('routes a build by its cut from its own records, never from items: review items and an experiment awaited are not read (P13)', () => {
      const unit = byCut('feature', [1, 2]);
      const items = {
        discussion: { items: { test: { status: 'completed' } } },
        experiment: { items: { test: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
        review: { items: { test: { status: 'completed' } } },
      };
      assert.deepStrictEqual(computeNextPhase({ ...unit, phases: items }), { next_phase: 'review', phase_label: 'review (in-progress)' });
    });

    it('returns specification when discussion completed', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { discussion: { items: { test: { status: 'completed' } } } } });
      assert.strictEqual(r.next_phase, 'specification');
    });

    it('returns discussion for fresh feature', () => {
      const r = computeNextPhase({ work_type: 'feature', phases: {} });
      assert.strictEqual(r.next_phase, 'discussion');
    });

    it('returns discussion for fresh epic', () => {
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

    it('returns in-progress planning', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: { planning: { items: { test: { status: 'in-progress' } } } } });
      assert.strictEqual(r.next_phase, 'planning');
      assert.ok(r.phase_label.includes('in-progress'));
    });

    it('an upstream phase in flight owns the next action — the walk routes to it, never past it', () => {
      const r = computeNextPhase({ name: 'test', work_type: 'feature', phases: {
        discussion: { items: { test: { status: 'in-progress' } } },
        specification: { items: { test: { status: 'completed' } } },
      } });
      assert.strictEqual(r.next_phase, 'discussion');
      assert.strictEqual(r.phase_label, 'discussion (in-progress)');
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

    it('19.5.14: a quick-fix goes from discovery straight into its fixes, its implementation — ready before they begin, in progress once begun', () => {
      const fresh = computeNextPhase({ work_type: 'quick-fix', status: 'in-progress', phases: {} });
      const begun = computeNextPhase({ work_type: 'quick-fix', status: 'in-progress', fixes: { began: '2026-06-03T09:00:00Z' }, phases: {} });

      assert.deepStrictEqual([fresh, begun], [
        { next_phase: 'implementation', phase_label: 'ready for implementation' },
        { next_phase: 'implementation', phase_label: 'implementation (in-progress)' },
      ]);
    });

    it('19.5.14: a quick-fix\'s review only once the person asked for it at its close; complete, done', () => {
      const asked = computeNextPhase({ work_type: 'quick-fix', status: 'in-progress', fixes: { began: '2026-06-03T09:00:00Z', review_asked: '2026-06-03T10:00:00Z' }, phases: {} });
      const complete = computeNextPhase({ work_type: 'quick-fix', status: 'completed', fixes: { began: '2026-06-03T09:00:00Z' }, phases: {} });

      assert.deepStrictEqual([asked, complete], [
        { next_phase: 'review', phase_label: 'review (in-progress)' },
        { next_phase: 'done', phase_label: 'pipeline complete' },
      ]);
    });

    it('P12: a quick-fix built under the old plan, its scoping\'s spec and plan items standing, waits on the migration\'s cut', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', status: 'in-progress', phases: {
        specification: { items: { test: { status: 'completed' } } },
        planning: { items: { test: { status: 'in-progress' } } },
      } });
      assert.deepStrictEqual(r, { next_phase: 'done', phase_label: 'waiting on the migration\'s cut' });
    });

    it('quick-fix: does not fall through to discussion/spec phases', () => {
      const r = computeNextPhase({ work_type: 'quick-fix', status: 'in-progress', phases: {
        discussion: { items: { test: { status: 'completed' } } },
      } });
      assert.strictEqual(r.next_phase, 'implementation');
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
      assert.strictEqual(computeSourceProvenance('pivot'), 'from pivot');
    });

    it('unwraps colon-prefixed source to "from {parent}"', () => {
      assert.strictEqual(computeSourceProvenance('message:kitchen-hardware'), 'from kitchen-hardware');
    });

    it('unwraps message:{origin} to "from {origin}"', () => {
      assert.strictEqual(computeSourceProvenance('message:auth-flow'), 'from auth-flow');
    });

    it('handles comma-joined plain sources', () => {
      assert.strictEqual(
        computeSourceProvenance('pivot,gap-analysis'),
        'from pivot + gap-analysis',
      );
    });

    it('handles comma-joined sources with whitespace', () => {
      assert.strictEqual(
        computeSourceProvenance('pivot, gap-analysis'),
        'from pivot + gap-analysis',
      );
    });

    it('handles mixed colon-prefixed and plain in a comma-joined source', () => {
      assert.strictEqual(
        computeSourceProvenance('message:billing,gap-analysis'),
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
    /** A decided discussion's record as the knowledge base renders it. */
    const record = (topic) => `.leeway/.knowledge/records/alpha/${topic}.md`;

    it('gap-analysis: returns absent when a record exists but its discussion is not decided', () => {
      createManifest(dir, 'alpha', {
        phases: { discussion: { items: { auth: { status: 'in-progress' } } } },
      });
      createFile(dir, record('auth'), 'content');
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'gap-analysis');
      // Decided-only input: no decided discussion → absent (analysis won't fire)
      assert.strictEqual(r.status, 'absent');
    });

    it('gap-analysis: returns stale when decided discussions exist but no cache', () => {
      createManifest(dir, 'alpha', {
        phases: { discussion: { items: { auth: { status: 'completed' } } } },
      });
      createFile(dir, record('auth'), 'content');
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'gap-analysis');
      assert.strictEqual(r.status, 'stale');
    });

    it('gap-analysis: returns stale when a cached input file changes', () => {
      createFile(dir, record('auth'), 'content-original');
      createManifest(dir, 'alpha', {
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum: 'stale-hash', generated: '2026-05-01', input_files: ['auth.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'gap-analysis');
      assert.strictEqual(r.status, 'stale');
    });

    it('gap-analysis: returns valid regardless of manifest insertion order (write-side sorts; read-side must too)', () => {
      // Insert items in non-alphabetical order. The analysis writes its cache
      // checksum over a SORTED file list. The read side in
      // computeAnalysisCacheStatus must sort identically — otherwise the cache
      // always reports stale on every leeway-continue-epic, firing the
      // analysis + KB re-indexes for no reason.
      for (const topic of ['zebra', 'auth', 'billing']) createFile(dir, record(topic), topic);
      const checksum = filesChecksum(['auth', 'billing', 'zebra'].map((topic) => path.join(dir, record(topic))));
      createManifest(dir, 'alpha', {
        phases: {
          discussion: { items: { zebra: { status: 'completed' }, billing: { status: 'completed' }, auth: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum, generated: '2026-05-02', input_files: ['auth.md', 'billing.md', 'zebra.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'gap-analysis');
      assert.strictEqual(r.status, 'valid', 'gap-analysis cache should be valid — read side must sort');
    });

    it('gap-analysis: returns absent when no completed material and no cache', () => {
      createManifest(dir, 'alpha', { phases: {} });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'gap-analysis');
      assert.strictEqual(r.status, 'absent');
      assert.strictEqual(r.generated, null);
      assert.deepStrictEqual(r.files, []);
    });

    it('gap-analysis: returns absent when cache exists but no completed items remain', () => {
      // cache.input_files preserved on the absent return so observability
      // isn't lost, even though the precondition gate means no analysis will
      // fire.
      createManifest(dir, 'alpha', {
        phases: {
          discovery: { gap_analysis_cache: { checksum: 'old', generated: '2026-05-02', input_files: ['gone.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'gap-analysis');
      assert.strictEqual(r.status, 'absent');
      assert.deepStrictEqual(r.files, ['gone.md']);
    });

    it('gap-analysis: returns valid when checksum matches the decided discussions\' records', () => {
      createFile(dir, record('auth'), 'content-d');
      const checksum = filesChecksum([path.join(dir, record('auth'))]);
      createManifest(dir, 'alpha', {
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum, generated: '2026-05-02', input_files: ['auth.md'] } },
        },
      });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'gap-analysis');
      assert.strictEqual(r.status, 'valid');
      assert.strictEqual(r.generated, '2026-05-02');
      assert.deepStrictEqual(r.files, ['auth.md']);
    });

    it('gap-analysis: a decided discussion\'s log is never an input — only its record', () => {
      createFile(dir, '.leeway/alpha/topics/auth/log.md', 'the conversation');
      createManifest(dir, 'alpha', { phases: { discussion: { items: { auth: { status: 'completed' } } } } });
      assert.strictEqual(computeAnalysisCacheStatus(loadManifest(dir, 'alpha'), path.join(dir, '.leeway'), 'gap-analysis').status, 'absent',
        'a log alone gives the analysis nothing to read');

      createFile(dir, record('auth'), 'the record');
      const checksum = filesChecksum([path.join(dir, record('auth'))]);
      createManifest(dir, 'alpha', {
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum, generated: '2026-05-02', input_files: ['auth.md'] } },
        },
      });
      createFile(dir, '.leeway/alpha/topics/auth/log.md', 'the conversation, carried on');
      assert.strictEqual(computeAnalysisCacheStatus(loadManifest(dir, 'alpha'), path.join(dir, '.leeway'), 'gap-analysis').status, 'valid',
        'the log moving leaves the analysis current');
    });

    it('stamped tells a cache an analysis never wrote from one the inputs have moved past', () => {
      createFile(dir, record('auth'), 'content-a');
      createManifest(dir, 'alpha', { phases: { discussion: { items: { auth: { status: 'completed' } } } } });
      const unstamped = computeAnalysisCacheStatus(loadManifest(dir, 'alpha'), path.join(dir, '.leeway'), 'gap-analysis');
      assert.deepStrictEqual([unstamped.status, unstamped.stamped], ['stale', false]);
      createManifest(dir, 'alpha', {
        phases: {
          discussion: { items: { auth: { status: 'completed' } } },
          discovery: { gap_analysis_cache: { checksum: 'old', generated: '2026-05-02', input_files: ['auth.md'] } },
        },
      });
      const moved = computeAnalysisCacheStatus(loadManifest(dir, 'alpha'), path.join(dir, '.leeway'), 'gap-analysis');
      assert.deepStrictEqual([moved.status, moved.stamped], ['stale', true]);
    });

    it('returns absent for unknown kind', () => {
      createManifest(dir, 'alpha', { phases: {} });
      const m = loadManifest(dir, 'alpha');
      const r = computeAnalysisCacheStatus(m, path.join(dir, '.leeway'), 'nonsense');
      assert.strictEqual(r.status, 'absent');
    });

    it('returns absent for null manifest', () => {
      const r = computeAnalysisCacheStatus(null, path.join(dir, '.leeway'), 'gap-analysis');
      assert.strictEqual(r.status, 'absent');
    });
  });

  describe('TIER_RANK', () => {
    it('orders tiers from decided → in-flight → fresh → cancelled → postponed', () => {
      assert.deepStrictEqual(TIER_RANK, { '✓': 0, '◐': 1, '○': 2, '⊘': 3, '⊖': 4 });
    });

    it('ranks decided above every unsettled tier (the map leads with what is agreed)', () => {
      assert.ok(TIER_RANK['✓'] < TIER_RANK['◐']);
      assert.ok(TIER_RANK['✓'] < TIER_RANK['○']);
    });
  });

  describe('the cancel units', () => {
    // A map with a live topic holding open and closed records, and a decided
    // topic with no series.
    function unitManifest() {
      return {
        name: 'pay',
        work_type: 'epic',
        phases: {
          discovery: { items: { auth: { source: 'discovery' }, gone: { source: 'discovery', cancelled: true } } },
          discussion: { items: { auth: { status: 'in-progress' }, timing: { status: 'completed' }, gone: { status: 'completed' }, held: { status: 'completed' } } },
          experiment: { items: {
            auth: { status: 'in-progress', experiments: { E2: { status: 'running' }, E1: { status: 'concluded' }, 'E2.1': { status: 'conceived' } } },
          } },
        },
      };
    }

    it('cancelPlan over a discovery unit: the live items, every open record in register order', () => {
      const plan = cancelPlan(unitManifest(), 'auth');
      assert.deepStrictEqual(plan.items.map(({ phase, item }) => [phase, item.status]), [['discussion', 'in-progress']]);
      assert.deepStrictEqual(plan.records, ['E2', 'E2.1']);
    });

    it('cancelPlan over a topic with no series takes no records', () => {
      assert.deepStrictEqual(cancelPlan(unitManifest(), 'timing').records, []);
    });

  });

  describe('the postpone plan', () => {
    // A live topic, a decided one, one with a live record on its series, one
    // already postponed, and one cancelled.
    function manifest() {
      return {
        name: 'pay',
        work_type: 'epic',
        phases: {
          discovery: { items: {
            auth: { source: 'discovery' },
            timing: { source: 'discovery' },
            busy: { source: 'discovery' },
            away: { source: 'discovery', postponed: true },
            gone: { source: 'discovery', cancelled: true },
          } },
          discussion: { items: {
            auth: { status: 'in-progress' },
            timing: { status: 'completed' },
            busy: { status: 'in-progress' },
            away: { status: 'postponed', previous_status: 'in-progress' },
          } },
          experiment: { items: {
            busy: { status: 'in-progress', experiments: { E1: { status: 'concluded' }, E2: { status: 'running' }, 'E2.1': { status: 'conceived' } } },
          } },
        },
      };
    }

    const project = { roadmap: { horizons: ['next'], items: {
      auth: { horizon: 'next', summary: 'somebody else\'s', origin: 'harvest' },
      ordering: { horizon: 'next', summary: 's', origin: 'harvest', pulled_to: { work_unit: 'pay', topic: 'busy' } },
    } } };

    it('takes the live items; the experiment series is never touched', () => {
      const plan = postponePlan(manifest(), 'auth', null);
      assert.deepStrictEqual(plan.items.map(({ phase, item }) => [phase, item.status]), [['discussion', 'in-progress']]);
      assert.deepStrictEqual(plan.locks, []);
    });

    it('locks, in refusal order: no such topic, already postponed, cancelled, the build begun, a live record, an illegal horizon, a roadmap clash', () => {
      const m = manifest();
      const reasons = (name, proj = null, horizon = undefined) => postponePlan(m, name, proj, horizon).locks.map((l) => l.reason);
      assert.deepStrictEqual(reasons('ghost'), ['no topic "ghost" — the map\'s topics are auth, timing, busy']);
      assert.deepStrictEqual(reasons('away'), ['"away" is already postponed — it waits on the roadmap']);
      assert.deepStrictEqual(reasons('gone'), ['"gone" is cancelled — reactivate it from the epic menu first']);
      assert.deepStrictEqual(reasons('timing'), [], 'a decided topic goes while the spec is written');
      assert.deepStrictEqual(postponePlan({ ...m, build: { position: 'auto' } }, 'timing', null).locks.map((l) => l.reason),
        ['postponing "timing" is refused — pay\'s build has begun, so its map is closed: a decision that must change is settled in the build, and abandoning the work is the unit\'s cancel, through manage on the start menu']);
      assert.deepStrictEqual(reasons('busy'), ['postponing "busy" is refused while an experiment is live (E2, with E2.1) — conclude or abandon it first; a laboratory cannot run under a topic that has left the epic']);
      assert.deepStrictEqual(reasons('auth', project), ['postponing "auth" is refused — a roadmap item named "auth" (horizon "next") is not this topic\'s: rename it on the roadmap, or rename the topic, first']);
      // The horizon is read here, before the epic moves — a name the roadmap
      // could not take would otherwise refuse at the landing.
      assert.deepStrictEqual(reasons('auth', null, 'v2.1'), ['"v2.1" is not a legal horizon name — dots and slashes break manifest addressing']);
      assert.deepStrictEqual(reasons('auth', project, 'v2.1'), [
        '"v2.1" is not a legal horizon name — dots and slashes break manifest addressing',
        'postponing "auth" is refused — a roadmap item named "auth" (horizon "next") is not this topic\'s: rename it on the roadmap, or rename the topic, first',
      ]);
      assert.deepStrictEqual(reasons('auth', null, 'v2'), [], 'a legal horizon locks nothing, and the menu asks with none');
    });

    it('an item joined to the topic is its own — the re-wait arm, never a clash', () => {
      assert.deepStrictEqual(postponePlan(manifest(), 'busy', project).locks.map((l) => l.reason),
        ['postponing "busy" is refused while an experiment is live (E2, with E2.1) — conclude or abandon it first; a laboratory cannot run under a topic that has left the epic'],
        'the joined item named "ordering" holds no clash against "busy"');
      const born = { joined: false, archived: false, clash: false };
      assert.deepStrictEqual(postponeTarget(project, 'pay', 'busy', 'busy'), { name: 'ordering', item: project.roadmap.items.ordering, joined: true, archived: false, clash: false });
      assert.deepStrictEqual(postponeTarget(project, 'pay', 'timing', 'timing'), { name: 'timing', item: undefined, ...born });
      assert.deepStrictEqual(postponeTarget(project, 'pay', 'timing', 'pacing'), { name: 'pacing', item: undefined, ...born }, 'a birth takes the name the topic goes by');
      assert.deepStrictEqual(postponeTarget(null, 'pay', 'timing', 'timing'), { name: 'timing', item: undefined, ...born });
    });

    it('an archived item an earlier postpone of the epic left is brought back; another\'s, archived or waiting, is the clash (18.8.17, 18.8.21)', () => {
      const archived = { at: '2026-11-10T09:00:00Z', horizon: 'next' };
      const own = { summary: 's', origin: 'postpone:pay', archived };
      const others = { summary: 's', origin: 'harvest', archived };
      const held = { roadmap: { horizons: ['next'], items: { timing: own, pacing: others } } };
      assert.deepStrictEqual(postponeTarget(held, 'pay', 'timing', 'timing'), { name: 'timing', item: own, joined: false, archived: true, clash: false });
      assert.deepStrictEqual(postponeTarget(held, 'pay', 'pacing', 'pacing'), { name: 'pacing', item: others, joined: false, archived: false, clash: true });
      assert.deepStrictEqual(postponeTarget(held, 'cart', 'timing', 'timing'), { name: 'timing', item: own, joined: false, archived: false, clash: true }, 'another epic\'s postpone is not this one\'s');
    });

    it('the clash phrase names the topic and the item, the horizon the item has or its archive, and stands without either (18.8.17, 18.8.21)', () => {
      assert.strictEqual(postponeClashPhrase('auth', 'auth', { horizon: 'next' }),
        'postponing "auth" is refused — a roadmap item named "auth" (horizon "next") is not this topic\'s: rename it on the roadmap, or rename the topic, first');
      assert.strictEqual(postponeClashPhrase('auth', 'sign-in', { archived: { at: '2026-11-10T09:00:00Z', horizon: 'next' } }),
        'postponing "auth" is refused — a roadmap item named "sign-in" (archived) is not this topic\'s: rename it on the roadmap, or rename the topic, first');
      assert.strictEqual(postponeClashPhrase('auth', 'auth', {}),
        'postponing "auth" is refused — a roadmap item named "auth" is not this topic\'s: rename it on the roadmap, or rename the topic, first');
    });

    it('postponedItem joins the roadmap by postponed_from, null when nothing does', () => {
      const proj = { roadmap: { horizons: ['next'], items: {
        ordering: { horizon: 'next', summary: 's', origin: 'postpone:pay', postponed_from: { work_unit: 'pay', topic: 'away' } },
        taken: { horizon: 'next', summary: 's', origin: 'postpone:pay', postponed_from: { work_unit: 'pay', topic: 'gone' }, pulled_to: { work_unit: 'other' } },
      } } };
      // The item's own name, not the topic's — a harvest rename moves them apart.
      assert.deepStrictEqual(postponedItem(proj, 'pay', 'away'), { name: 'ordering', horizon: 'next', waiting: true });
      // Pulled into another epic since: still the topic's item, no longer waiting.
      assert.deepStrictEqual(postponedItem(proj, 'pay', 'gone'), { name: 'taken', horizon: 'next', waiting: false });
      assert.strictEqual(postponedItem(proj, 'other', 'away'), null);
      assert.strictEqual(postponedItem(proj, 'pay', 'auth'), null);
      assert.strictEqual(postponedItem(null, 'pay', 'away'), null);
    });

    it('the lifecycle reads the marker first, and a map-less topic by its discussion', () => {
      const m = manifest();
      assert.deepStrictEqual(computeTopicLifecycle(m, 'away'),
        { lifecycle: 'postponed', tier: '⊖', current_phase: null, discussion_state: 'postponed' });
      // The cancel outranks the postpone: a row holding both is off the board.
      m.phases.discovery.items.away.cancelled = true;
      assert.strictEqual(computeTopicLifecycle(m, 'away').lifecycle, 'cancelled');
      // No map row: the postponed discussion reads postponed.
      delete m.phases.discovery.items.away;
      assert.strictEqual(computeTopicLifecycle(m, 'away').lifecycle, 'postponed');
    });

    it('phaseStatus drops a postponed item, as it drops every non-live one', () => {
      const items = (statuses) => ({ phases: { discussion: { items: Object.fromEntries(statuses.map((s, i) => [`t${i}`, { status: s }])) } } });
      assert.strictEqual(phaseStatus(items(['postponed']), 'discussion'), null);
      assert.strictEqual(phaseStatus(items(['postponed', 'completed']), 'discussion'), 'completed');
      assert.strictEqual(phaseStatus(items(['postponed', 'in-progress']), 'discussion'), 'in-progress');
    });
  });

  describe('the topic a person names (8.8.17)', () => {
    // A started topic renamed, its key keeping its first name.
    const manifest = {
      name: 'fumi',
      work_type: 'epic',
      phases: { discovery: { items: { 'note-model': { source: 'discovery', title: 'data-model' }, sync: { source: 'discovery' } } } },
    };

    it('a key is its own topic, a rename\'s title resolves to its key, and any other name comes back as said', () => {
      assert.deepStrictEqual(['sync', 'data-model', 'note-model', 'ghost'].map((said) => topicKey(manifest, said)), ['sync', 'note-model', 'note-model', 'ghost']);
    });

    it('a name no topic goes by is refused naming the topics as they go by, and the map empty only when it is', () => {
      assert.strictEqual(noTopicRefusal(manifest, 'ghost'), 'no topic "ghost" — the map\'s topics are data-model, sync');
      assert.strictEqual(noTopicRefusal({ name: 'fumi', work_type: 'epic', phases: {} }, 'ghost'), 'no topic "ghost" — the map has no live topics');
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

    it('returns fresh when no discussion item exists', () => {
      createManifest(dir, 'alpha', { phases: {} });
      const m = loadManifest(dir, 'alpha');
      assert.deepStrictEqual(computeTopicLifecycle(m, 'auth'), { lifecycle: 'fresh', tier: '○', current_phase: null, discussion_state: null });
    });

    it('returns discussing when discussion item is in-progress', () => {
      const m = loadWithPhases('auth', { discussion: 'in-progress' });
      assert.deepStrictEqual(computeTopicLifecycle(m, 'auth'), { lifecycle: 'discussing', tier: '◐', current_phase: 'discussion', discussion_state: 'in-progress' });
    });

    it('returns decided when discussion item is completed', () => {
      const m = loadWithPhases('auth', { discussion: 'completed' });
      assert.deepStrictEqual(computeTopicLifecycle(m, 'auth'), { lifecycle: 'decided', tier: '✓', current_phase: 'discussion', discussion_state: 'completed' });
    });

    it('returns decided when the discussion was promoted with its specification — concluded and moved on', () => {
      const m = loadWithPhases('auth', { discussion: 'promoted' });
      assert.deepStrictEqual(computeTopicLifecycle(m, 'auth'), { lifecycle: 'decided', tier: '✓', current_phase: 'discussion', discussion_state: 'promoted' });
      assert.strictEqual(computeNextAction('decided'), null, 'nothing left to start on it');
    });

    it('the map marker reads cancelled first, over a live item', () => {
      createManifest(dir, 'alpha', { phases: {
        discovery: { items: { auth: { source: 'discovery', cancelled: true }, fresh: { source: 'discovery' } } },
        discussion: { items: { auth: { status: 'in-progress' } } },
      } });
      const m = loadManifest(dir, 'alpha');
      assert.deepStrictEqual(computeTopicLifecycle(m, 'auth'), { lifecycle: 'cancelled', tier: '⊘', current_phase: null, discussion_state: 'in-progress' });
      assert.strictEqual(computeTopicLifecycle(m, 'fresh').lifecycle, 'fresh', 'no marker, no cancel');
    });

    it('a topic with no map row reads its discussion\'s own closure — cancelled, postponed', () => {
      assert.deepStrictEqual(computeTopicLifecycle(loadWithPhases('auth', { discussion: 'cancelled' }), 'auth'),
        { lifecycle: 'cancelled', tier: '⊘', current_phase: null, discussion_state: 'cancelled' });
      assert.deepStrictEqual(computeTopicLifecycle(loadWithPhases('auth', { discussion: 'postponed' }), 'auth'),
        { lifecycle: 'postponed', tier: '⊖', current_phase: null, discussion_state: 'postponed' });
    });

    it('an unstarted stub renders fresh', () => {
      const m = loadWithPhases('auth', { discussion: 'unstarted' });
      assert.deepStrictEqual(computeTopicLifecycle(m, 'auth'), { lifecycle: 'fresh', tier: '○', current_phase: null, discussion_state: 'unstarted' });
    });
  });

  describe('computeNextAction', () => {
    it('fresh → start_discussion; discussing → continue_discussion', () => {
      assert.strictEqual(computeNextAction('fresh'), 'start_discussion');
      assert.strictEqual(computeNextAction('discussing'), 'continue_discussion');
    });

    it('every closed or concluded lifecycle, and an unknown one, has no next action', () => {
      for (const lifecycle of ['decided', 'cancelled', 'postponed', 'made-up']) {
        assert.strictEqual(computeNextAction(lifecycle), null, lifecycle);
      }
    });
  });
  describe('computeMapSummary', () => {
    it('returns zero counts for an empty items array', () => {
      assert.deepStrictEqual(
        computeMapSummary([]),
        { total: 0, decided: 0, in_flight: 0, fresh: 0, cancelled: 0, postponed: 0 },
      );
    });

    it('counts items by tier glyph', () => {
      const items = [
        { tier: '◐' },
        { tier: '◐' },
        { tier: '✓' },
        { tier: '○' },
        { tier: '○' },
        { tier: '○' },
        { tier: '⊘' },
        { tier: '⊖' },
      ];
      assert.deepStrictEqual(
        computeMapSummary(items),
        { total: 8, decided: 1, in_flight: 2, fresh: 3, cancelled: 1, postponed: 1 },
      );
    });

    it('ignores items with unrecognised tier glyphs but still counts total', () => {
      const items = [{ tier: '✓' }, { tier: '?' }, { tier: undefined }];
      const r = computeMapSummary(items);
      assert.strictEqual(r.total, 3);
      assert.strictEqual(r.decided, 1);
      assert.strictEqual(r.in_flight, 0);
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
        { tier: '○', order: 1 },
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
        { name: 'inflight', tier: '◐', order: 5 },
      ];
      assert.deepStrictEqual(sorted(items), ['inflight', 'fresh']);
    });

    it('floats decided above in-flight regardless of order value', () => {
      const items = [
        { name: 'inflight', tier: '◐', order: 2 },
        { name: 'decided', tier: '✓', order: 9 },
        { name: 'fresh', tier: '○', order: 3 },
      ];
      assert.deepStrictEqual(sorted(items), ['decided', 'inflight', 'fresh']);
    });

    it('keeps cancelled and postponed below decided at the bottom', () => {
      const items = [
        { name: 'postponed', tier: '⊖', order: null },
        { name: 'cancelled', tier: '⊘', order: null },
        { name: 'decided', tier: '✓', order: null },
      ];
      assert.deepStrictEqual(sorted(items), ['decided', 'cancelled', 'postponed']);
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

  describe('experiment derivations — waits and the next-phase route', () => {
    const waiting = (phase, extra = {}) => ({
      name: 'pay', work_type: 'feature',
      phases: {
        [phase]: { items: { pay: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
        experiment: { items: { pay: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'running' } } } } },
        ...extra,
      },
    });

    it('awaitedExperiments reads one item\'s lock', () => {
      const m = waiting('discussion');
      assert.deepStrictEqual(awaitedExperiments(m, 'discussion', 'pay'), ['E1']);
      assert.deepStrictEqual(awaitedExperiments(m, 'investigation', 'pay'), []);
    });

    it('a linear type\'s waiting conversation routes to the experiment', () => {
      const r = computeNextPhase(waiting('discussion'));
      assert.strictEqual(r.next_phase, 'experiment');
      assert.strictEqual(r.phase_label, 'experiment (awaiting evidence)');
    });

    it('the override is linear-work-types-only — an epic\'s next_phase stays phase-coarse', () => {
      const m = waiting('discussion');
      m.work_type = 'epic';
      const r = computeNextPhase(m);
      assert.strictEqual(r.next_phase, 'discussion', 'the epic ladder answers by aggregate, no experiment override');
      assert.strictEqual(r.phase_label, 'discussion (in-progress)');
    });

    it('a released wait routes the linear type back to its conversation', () => {
      const m = waiting('discussion');
      delete m.phases.discussion.items.pay.awaiting_experiments;
      m.phases.experiment.items.pay.experiments.E1.status = 'concluded';
      m.phases.experiment.items.pay.status = 'completed';
      const r = computeNextPhase(m);
      assert.strictEqual(r.next_phase, 'discussion');
      assert.strictEqual(r.phase_label, 'discussion (in-progress)');
    });

    it('the map row carries the topic\'s live waits for the awaiting cue', () => {
      const m = {
        name: 'lab', work_type: 'epic',
        phases: {
          discovery: { items: { timing: { summary: 'Timing' } } },
          discussion: { items: { timing: { status: 'in-progress', awaiting_experiments: ['E1', 'E2'] } } },
        },
      };
      const row = buildDiscoveryMap(m, path.join(__dirname, '.no-such-workflows')).map.find((t) => t.name === 'timing');
      assert.deepStrictEqual(row.waits, [
        { kind: 'experiment', id: 'E1' },
        { kind: 'experiment', id: 'E2' },
      ], 'the discussion\'s waits in the derivation\'s order');
    });

    it('the map row names the unit a promoted discussion moved to, and no unit otherwise', () => {
      const m = {
        name: 'pay', work_type: 'epic',
        phases: {
          discovery: { items: { fees: {}, refunds: {} } },
          discussion: { items: { fees: { status: 'promoted', promoted_to: 'fees-cc' }, refunds: { status: 'completed' } } },
        },
      };
      const rows = buildDiscoveryMap(m, path.join(__dirname, '.no-such-workflows')).map;
      assert.deepStrictEqual(rows.map((r) => [r.name, r.lifecycle, r.promoted_to]), [['fees', 'decided', 'fees-cc'], ['refunds', 'decided', null]]);
    });
  });

  describe('the mailbox — one per topic, one reader, one meaning of mail waiting', () => {
    const state = () => statePath(dir);
    const message = (wu, topic, file) => createFile(state(), `${mailboxDir(wu, topic)}/${file}`, 'M\n');

    it('a topic\'s mailbox sits under the topic, naming no phase', () => {
      assert.strictEqual(mailboxDir('pay', 'fees'), 'pay/topics/fees/mail');
    });

    it('mailboxFiles lists the message files in the order they landed — .md files alone, [] for no mailbox', () => {
      assert.deepStrictEqual(mailboxFiles(state(), 'pay', 'fees'), []);
      message('pay', 'fees', '002-second.md');
      message('pay', 'fees', '001-first.md');
      message('pay', 'fees', 'notes.txt');
      fs.mkdirSync(path.join(state(), mailboxDir('pay', 'fees'), '003-dir.md'));
      assert.deepStrictEqual(mailboxFiles(state(), 'pay', 'fees'), ['001-first.md', '002-second.md']);
      assert.strictEqual(mailboxDepth(state(), 'pay', 'fees'), 2);
    });

    it('the map row reads mail waiting off the mailbox whatever the item\'s status — a started item with messages cues, a message-less stub does not', () => {
      const m = {
        name: 'pay', work_type: 'epic',
        phases: {
          discovery: { items: { fees: {}, refunds: {} } },
          discussion: { items: { fees: { status: 'in-progress' }, refunds: { status: 'unstarted' } } },
        },
      };
      message('pay', 'fees', '001-escalation.md');
      const rows = buildDiscoveryMap(m, state()).map;
      const row = (name) => /** @type {any} */ (rows.find((r) => r.name === name));
      assert.deepStrictEqual([row('fees').mail_waiting, row('fees').mail_queued], [true, 1]);
      assert.deepStrictEqual([row('refunds').mail_waiting, row('refunds').mail_queued], [false, 0]);
    });

    it('mail is raised in the phase a work type talks its topics through — a bugfix\'s investigation, a quick-fix\'s none', () => {
      assert.deepStrictEqual(['epic', 'feature', 'bugfix', 'quick-fix'].map(mailPhase), ['discussion', 'discussion', 'investigation', null]);
    });

    it('a single-topic unit\'s mail phases read its one mailbox', () => {
      const m = { name: 'pay', work_type: 'feature', phases: { discussion: { items: { pay: { status: 'in-progress' } } } } };
      assert.deepStrictEqual(mailPhases(state(), m), []);
      message('pay', 'pay', '001-escalation.md');
      assert.deepStrictEqual(mailPhases(state(), m), ['discussion']);
    });
  });

  describe('the conversation actions — one vocabulary for the map, the guard, and the menu', () => {
    it('names the actions each conversation phase enters', () => {
      assert.deepStrictEqual(CONVERSATION_ACTIONS, { discussion: ['start_discussion', 'continue_discussion'] });
    });

    it('lifecyclePhrase names where the topic stands in the refusals\' one voice', () => {
      assert.strictEqual(lifecyclePhrase('fresh'), 'nothing has started on it');
      assert.strictEqual(lifecyclePhrase('discussing'), 'discussion is in flight on it');
      assert.strictEqual(lifecyclePhrase('cancelled'), 'it is cancelled and stays on the map as record');
    });

    it('CLOSED_LIFECYCLES names the lifecycles that leave the board', () => {
      assert.deepStrictEqual(CLOSED_LIFECYCLES, ['cancelled', 'postponed']);
    });
  });

  describe('the work under way where a raise waits — a quick-fix\'s fixes, a bug\'s investigation (raise.cjs, the board and the waits)', () => {
    it('a quick-fix\'s fixes are under way once begun, while it is in progress', () => {
      const quickFix = (/** @type {Record<string, unknown>} */ more) => ({ name: 'typo', work_type: 'quick-fix', status: 'in-progress', phases: {}, ...more });

      assert.deepStrictEqual([
        fixesUnderWay(quickFix({ fixes: { started: '2026-11-01T00:00:00.000Z' } })),
        fixesUnderWay(quickFix({})),
        fixesUnderWay(quickFix({ fixes: { started: '2026-11-01T00:00:00.000Z' }, status: 'completed' })),
        fixesUnderWay({ ...quickFix({ fixes: {} }), work_type: 'feature' }),
      ], [true, false, false, false]);
    });

    it('a bug\'s investigation is under way while its topic\'s item is in progress', () => {
      const bug = (/** @type {string} */ status, type = 'bugfix') => ({ name: 'crash', work_type: type, status: 'in-progress', phases: { investigation: { items: { crash: { status } } } } });

      assert.deepStrictEqual([bug('in-progress'), bug('completed'), bug('in-progress', 'feature')].map(investigationUnderWay), [true, false, false]);
    });
  });

  describe('waits — every kind that holds a conclusion shut', () => {
    const world = (discussion) => ({
      name: 'lab', work_type: 'epic',
      phases: discussion ? { discussion: { items: { pay: discussion } } } : {},
    });

    it('a discussion waits on one descriptor per awaited experiment, and on nothing else', () => {
      const m = world({ status: 'in-progress', awaiting_experiments: ['E1', 'E2'] });
      assert.deepStrictEqual(waits(m, 'discussion', 'pay'), [{ kind: 'experiment', id: 'E1' }, { kind: 'experiment', id: 'E2' }]);
      assert.deepStrictEqual(waits(world({ status: 'in-progress' }), 'discussion', 'pay'), []);
    });

    it('an absent item holds nothing, and no other phase waits on experiments', () => {
      assert.deepStrictEqual(waits(world(undefined), 'discussion', 'pay'), [], 'no discussion item — nothing to hold shut');
      assert.deepStrictEqual(waits(world({ status: 'in-progress', awaiting_experiments: ['E3'] }), 'specification', 'pay'), []);
    });

    it('topicWaits joins the in-progress holders alone — a parked or concluded discussion waits on nothing', () => {
      assert.deepStrictEqual(topicWaits(world({ status: 'in-progress', awaiting_experiments: ['E1'] }), 'pay'), [{ kind: 'experiment', id: 'E1' }]);
      assert.deepStrictEqual(topicWaits(world({ status: 'completed', awaiting_experiments: ['E1'] }), 'pay'), []);
      assert.deepStrictEqual(topicWaits(world({ status: 'unstarted', awaiting_experiments: ['E1'] }), 'pay'), []);
    });
  });

});
