'use strict';

//
// Tests for migration 069: settle-cancelled-experiment-series (.cjs)
//
// Happy path (a cancelled series whose records are all terminal reads
// completed, its stash deleted, the records, the spawning conversations, the
// map row, and every other item and field kept in the engine's
// serialisation), a series with a live record (sub-experiments included)
// reads in-progress, one update per changed unit, skip/no-op, idempotency,
// the malformed-manifest guard, shapes that are not objects, and a project
// with no work units.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/069-settle-cancelled-experiment-series.cjs');

let dir, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

/** @param {object} value */
const json = (value) => JSON.stringify(value, null, 2) + '\n';

const manifestPath = (name) => path.join(dir, '.workflows', name, 'manifest.json');

function writeUnit(name, manifest) {
  fs.mkdirSync(path.join(dir, '.workflows', name), { recursive: true });
  fs.writeFileSync(manifestPath(name), typeof manifest === 'string' ? manifest : json(manifest));
}

const readText = (name) => fs.readFileSync(manifestPath(name), 'utf8');

/**
 * An epic with two cancelled series, every record the cancel left terminal,
 * beside a live series, the spawning conversations, and a map that never
 * marked the topics.
 */
function epic() {
  return {
    name: 'lab',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: {
        timing: { routing: 'discussion', source: 'discovery', order: 1 },
        layout: { routing: 'research', source: 'discovery', order: 2 },
        sizing: { routing: 'discussion', source: 'discovery', order: 3 },
      } },
      research: { items: { layout: { status: 'in-progress' } } },
      discussion: { items: {
        timing: { status: 'in-progress', reconcile_needed: 'experiment' },
        sizing: { status: 'in-progress', awaiting_experiments: ['E1'] },
      } },
      experiment: { items: {
        timing: {
          status: 'cancelled',
          previous_status: 'in-progress',
          experiments: {
            E1: { slug: 'window-placement', status: 'concluded', verdict: 'held' },
            E2: { slug: 'multi-monitor', status: 'abandoned', reason: 'series cancelled' },
            'E2.1': { slug: 'single-monitor', status: 'abandoned', reason: 'series cancelled' },
          },
        },
        layout: {
          status: 'cancelled',
          previous_status: 'in-progress',
          experiments: {
            E1: { slug: 'grid', status: 'abandoned', reason: 'series cancelled' },
            'E1.1': { slug: 'columns', status: 'abandoned', reason: 'series cancelled' },
          },
        },
        sizing: {
          status: 'in-progress',
          experiments: { E1: { slug: 'font-scale', status: 'designed' } },
        },
      } },
    },
  };
}

/** The epic as the migration leaves it — each cancelled series settled, its stash gone, nothing else moved. */
function epicSettled() {
  const m = epic();
  const { timing, layout } = m.phases.experiment.items;
  timing.status = 'completed';
  delete timing.previous_status;
  layout.status = 'completed';
  delete layout.previous_status;
  return m;
}

describe('migration 069: settle cancelled experiment series', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-069-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('describes itself and hands nothing back', () => {
    assert.strictEqual(MIGRATION.id, '069');
    assert.strictEqual(MIGRATION.description, 'settle cancelled experiment series — a series the old per-series cancel closed reads completed');
    writeUnit('lab', epic());
    assert.strictEqual(run(), undefined);
  });

  it('settles each cancelled series completed, the stash deleted, the rest of the manifest kept in the engine\'s serialisation', () => {
    writeUnit('lab', epic());
    run();
    assert.strictEqual(readText('lab'), json(epicSettled()));
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('a cancelled series reads completed, its records left as they are', () => {
    writeUnit('lab', epic());
    run();
    const series = JSON.parse(readText('lab')).phases.experiment.items;
    assert.deepStrictEqual(series.timing, {
      status: 'completed',
      experiments: epic().phases.experiment.items.timing.experiments,
    });
    assert.deepStrictEqual(series.layout.experiments, epic().phases.experiment.items.layout.experiments);
  });

  it('counts one update per changed unit, and leaves a unit with nothing cancelled byte-identical', () => {
    writeUnit('lab', epic());
    writeUnit('lab-two', epic());
    const quiet = epicSettled();
    writeUnit('quiet', quiet);
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
    assert.strictEqual(readText('lab'), json(epicSettled()));
    assert.strictEqual(readText('lab-two'), json(epicSettled()));
    assert.strictEqual(readText('quiet'), json(quiet));
  });

  it('leaves the project manifest and every non-unit directory alone', () => {
    const project = json({ work_units: { lab: { work_type: 'epic' } }, defaults: { plan_format: 'local-markdown' } });
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), project);
    fs.mkdirSync(path.join(dir, '.workflows', '.inbox', 'ideas'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.workflows', 'notes'), { recursive: true });
    writeUnit('lab', epic());
    run();
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'), project);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('skips when no series reads cancelled, every manifest byte-identical', () => {
    writeUnit('lab', epicSettled());
    writeUnit('feat', { name: 'feat', work_type: 'feature', status: 'in-progress', phases: { discussion: { items: { feat: { status: 'cancelled' } } } } });
    const before = [readText('lab'), readText('feat')];
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.deepStrictEqual([readText('lab'), readText('feat')], before, 'a cancelled item of another phase is never touched');
  });

  it('skips a manifest that does not parse, never throwing', () => {
    writeUnit('broken', 'not json');
    assert.doesNotThrow(() => run());
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.strictEqual(readText('broken'), 'not json');
  });

  it('degrades to a skip over a manifest, phases, items, or series that is not an object', () => {
    writeUnit('nothing', 'null\n');
    writeUnit('list', '[]\n');
    writeUnit('odd', { name: 'odd', work_type: 'epic', status: 'in-progress', phases: 'nope' });
    writeUnit('odder', { name: 'odder', work_type: 'epic', status: 'in-progress', phases: { experiment: { items: [] } } });
    writeUnit('oddest', { name: 'oddest', work_type: 'epic', status: 'in-progress', phases: { experiment: { items: { a: ['cancelled'], b: null } } } });
    writeUnit('none', { name: 'none', work_type: 'epic', status: 'in-progress', phases: { experiment: 'nope' } });
    assert.doesNotThrow(() => run());
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('skips a project with no work units, and one with no .workflows at all', () => {
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    fs.rmSync(path.join(dir, '.workflows'), { recursive: true, force: true });
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 2 });
  });

  it('is idempotent — a second run reports a skip and changes nothing', () => {
    writeUnit('lab', epic());
    run();
    const settled = readText('lab');
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 1 });
    assert.strictEqual(readText('lab'), settled);
  });
});
