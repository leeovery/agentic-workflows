'use strict';

//
// Tests for migration 070: record-promoted-discussions (.cjs)
//
// Happy path over agntc's shape (one discussion named after the unit) and a
// two-discussion promotion (each moved discussion's epic item reads promoted
// with promoted_to, the unit's bare discussion item takes the epic's other
// fields, the unit's specification gains it as a source at the epic row's
// status, every other item and field kept in the engine's serialisation), a
// source whose file still sits in the epic left alone, a unit item that is no
// longer bare and a source the unit already carries kept, one update per
// changed unit,
// skip/no-op, idempotency, the malformed-manifest guard, shapes that are not
// objects, a promoted_to unit that does not exist or cannot be addressed,
// and a project with no work units.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/070-record-promoted-discussions.cjs');

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

/** @param {string} rel */
function writeFile(rel) {
  const full = path.join(dir, '.workflows', rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '# doc\n');
}

const readText = (name) => fs.readFileSync(manifestPath(name), 'utf8');
const read = (name) => JSON.parse(readText(name));

/** agntc's `v1`: a completed epic whose one-discussion specification was promoted to a unit of the discussion's name. */
function agntcEpic() {
  return {
    name: 'v1',
    work_type: 'epic',
    status: 'completed',
    phases: {
      discussion: { items: {
        'core-architecture': { status: 'completed' },
        'naming-and-identity': { status: 'completed' },
      } },
      specification: { items: {
        'core-system': { status: 'completed', sources: { 'core-architecture': { status: 'incorporated' } } },
        'naming-and-identity': {
          status: 'promoted',
          promoted_to: 'naming-and-identity',
          sources: { 'naming-and-identity': { status: 'incorporated' } },
        },
      } },
    },
  };
}

/** The unit agntc's promotion created: its spec item carries no sources. */
function agntcUnit() {
  return {
    name: 'naming-and-identity',
    work_type: 'cross-cutting',
    status: 'completed',
    source_work_unit: 'v1',
    source_topic: 'naming-and-identity',
    phases: {
      discussion: { items: { 'naming-and-identity': { status: 'completed' } } },
      specification: { items: { 'naming-and-identity': { status: 'completed', date: '2026-03-21' } } },
    },
  };
}

function agntc() {
  writeUnit('v1', agntcEpic());
  writeUnit('naming-and-identity', agntcUnit());
  writeFile('v1/discussion/core-architecture.md');
  writeFile('naming-and-identity/discussion/naming-and-identity.md');
}

/** A two-discussion promotion: a superseded spec among the sources, and an unmoved discussion beside them. */
function paymentsEpic() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discussion: { items: {
        'cache-invalidation': { status: 'completed', subtopics: { ttl: { status: 'decided', parent: null } } },
        'ttl-policy': { status: 'completed' },
        'fee-model': { status: 'completed' },
      } },
      specification: { items: {
        'caching-strategy': {
          status: 'promoted',
          promoted_to: 'caching',
          sources: {
            'cache-invalidation': { status: 'incorporated' },
            'ttl-policy': { status: 'incorporated' },
            'old-spec': { status: 'incorporated' },
          },
        },
        'old-spec': { status: 'superseded', superseded_by: 'caching-strategy' },
      } },
    },
  };
}

function cachingUnit() {
  return {
    name: 'caching',
    work_type: 'cross-cutting',
    status: 'completed',
    phases: {
      discussion: { items: { 'cache-invalidation': { status: 'completed' }, 'ttl-policy': { status: 'completed' } } },
      specification: { items: { caching: { status: 'completed', date: '2026-07-01' } } },
    },
  };
}

function payments() {
  writeUnit('payments', paymentsEpic());
  writeUnit('caching', cachingUnit());
  writeFile('payments/discussion/fee-model.md');
  writeFile('caching/discussion/cache-invalidation.md');
  writeFile('caching/discussion/ttl-policy.md');
}

describe('migration 070: record promoted discussions', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-070-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('describes itself and hands nothing back', () => {
    assert.strictEqual(MIGRATION.id, '070');
    assert.strictEqual(MIGRATION.description, 'record promoted discussions — a discussion that moved with its specification reads promoted, and is its unit\'s source');
    agntc();
    assert.strictEqual(run(), undefined);
  });

  it("agntc's shape: the moved discussion reads promoted, and the unit's specification sources it", () => {
    agntc();
    run();
    const epic = agntcEpic();
    epic.phases.discussion.items['naming-and-identity'] = { status: 'promoted', promoted_to: 'naming-and-identity' };
    assert.strictEqual(readText('v1'), json(epic), 'the rest of the epic kept in the engine\'s serialisation');
    const unit = agntcUnit();
    unit.phases.specification.items['naming-and-identity'].sources = { 'naming-and-identity': { status: 'incorporated' } };
    assert.strictEqual(readText('naming-and-identity'), json(unit));
    assert.deepStrictEqual(read('naming-and-identity').phases.discussion.items['naming-and-identity'], { status: 'completed' },
      'the epic\'s item holds nothing but its status, so the bare item has nothing to take');
    assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
  });

  it("agntc's shape with a Discussion Map: the bare unit item takes it", () => {
    agntc();
    const epic = agntcEpic();
    epic.phases.discussion.items['naming-and-identity'].subtopics = { prefix: { status: 'decided', parent: null } };
    writeUnit('v1', epic);
    run();
    assert.deepStrictEqual(read('naming-and-identity').phases.discussion.items['naming-and-identity'],
      { status: 'completed', subtopics: { prefix: { status: 'decided', parent: null } } });
    assert.deepStrictEqual(read('v1').phases.discussion.items['naming-and-identity'],
      { status: 'promoted', subtopics: { prefix: { status: 'decided', parent: null } }, promoted_to: 'naming-and-identity' });
  });

  it('a two-discussion promotion records both, keeping each item\'s own fields and leaving the unmoved discussion and the superseded source alone', () => {
    payments();
    run();
    const epic = read('payments');
    assert.deepStrictEqual(epic.phases.discussion.items, {
      'cache-invalidation': { status: 'promoted', subtopics: { ttl: { status: 'decided', parent: null } }, promoted_to: 'caching' },
      'ttl-policy': { status: 'promoted', promoted_to: 'caching' },
      'fee-model': { status: 'completed' },
    });
    assert.deepStrictEqual(epic.phases.specification, paymentsEpic().phases.specification);
    assert.deepStrictEqual(read('caching').phases.discussion.items, {
      'cache-invalidation': { status: 'completed', subtopics: { ttl: { status: 'decided', parent: null } } },
      'ttl-policy': { status: 'completed' },
    }, 'the bare item takes the epic\'s fields — its own status kept, promoted_to never');
    assert.deepStrictEqual(read('caching').phases.specification.items.caching, {
      status: 'completed',
      date: '2026-07-01',
      sources: { 'cache-invalidation': { status: 'incorporated' }, 'ttl-policy': { status: 'incorporated' } },
    });
    assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
  });

  it('leaves a source whose file still sits in the epic alone — it never moved', () => {
    payments();
    writeFile('payments/discussion/ttl-policy.md');
    run();
    assert.strictEqual(read('payments').phases.discussion.items['ttl-policy'].status, 'completed');
    assert.deepStrictEqual(read('caching').phases.specification.items.caching.sources,
      { 'cache-invalidation': { status: 'incorporated' } });
  });

  it('fills only the bare item promote wrote — a discussion the unit already worked keeps every field of its own', () => {
    payments();
    const unit = cachingUnit();
    unit.phases.discussion.items['cache-invalidation'] = { status: 'completed', subtopics: { purge: { status: 'decided', parent: null } } };
    writeUnit('caching', unit);
    const epic = paymentsEpic();
    epic.phases.discussion.items['cache-invalidation'].dismissed_grounds = ['a CDN purge is out of scope'];
    writeUnit('payments', epic);
    run();
    assert.deepStrictEqual(read('caching').phases.discussion.items['cache-invalidation'],
      { status: 'completed', subtopics: { purge: { status: 'decided', parent: null } } });
  });

  it("keeps a source the unit's specification already carries, at its own status", () => {
    payments();
    const unit = cachingUnit();
    unit.phases.specification.items.caching.sources = { 'cache-invalidation': { status: 'stale' } };
    writeUnit('caching', unit);
    run();
    assert.deepStrictEqual(read('caching').phases.specification.items.caching.sources, {
      'cache-invalidation': { status: 'stale' },
      'ttl-policy': { status: 'incorporated' },
    });
  });

  it('marks the epic but writes no source where the epic row carries no status', () => {
    payments();
    const epic = paymentsEpic();
    epic.phases.specification.items['caching-strategy'].sources['ttl-policy'] = {};
    writeUnit('payments', epic);
    run();
    assert.strictEqual(read('payments').phases.discussion.items['ttl-policy'].status, 'promoted');
    assert.deepStrictEqual(read('caching').phases.specification.items.caching.sources,
      { 'cache-invalidation': { status: 'incorporated' } });
  });

  it('leaves the epic alone when the promoted_to unit does not exist', () => {
    writeUnit('payments', paymentsEpic());
    const before = readText('payments');
    run();
    assert.strictEqual(readText('payments'), before);
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it("records the epic's side over a unit whose manifest does not parse, and leaves that manifest alone", () => {
    payments();
    writeUnit('caching', 'not json');
    run();
    assert.strictEqual(read('payments').phases.discussion.items['ttl-policy'].status, 'promoted');
    assert.strictEqual(readText('caching'), 'not json');
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('never reads or writes through a promoted_to or source name that breaks path addressing', () => {
    payments();
    const epic = paymentsEpic();
    epic.phases.specification.items['caching-strategy'].promoted_to = '../caching';
    writeUnit('payments', epic);
    const dotted = paymentsEpic();
    dotted.name = 'dotted';
    dotted.phases.specification.items['caching-strategy'].sources = { '../caching/discussion/ttl-policy': { status: 'incorporated' } };
    writeUnit('dotted', dotted);
    const before = [readText('payments'), readText('dotted'), readText('caching')];
    run();
    assert.deepStrictEqual([readText('payments'), readText('dotted'), readText('caching')], before);
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('touches only epics — a promoted item on another work type is not a promotion', () => {
    payments();
    const feature = paymentsEpic();
    feature.name = 'feat';
    feature.work_type = 'feature';
    writeUnit('payments', { ...paymentsEpic(), phases: { ...paymentsEpic().phases, specification: { items: {} } } });
    writeUnit('feat', feature);
    const before = [readText('feat'), readText('caching')];
    run();
    assert.deepStrictEqual([readText('feat'), readText('caching')], before);
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('leaves the project manifest and every non-unit directory alone', () => {
    const project = json({ work_units: { payments: { work_type: 'epic' }, caching: { work_type: 'cross-cutting' } } });
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), project);
    fs.mkdirSync(path.join(dir, '.workflows', '.inbox', 'ideas'), { recursive: true });
    payments();
    run();
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'), project);
    assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
  });

  it('skips when nothing is promoted, every manifest byte-identical', () => {
    writeUnit('lab', { name: 'lab', work_type: 'epic', status: 'in-progress', phases: { specification: { items: { a: { status: 'completed' } } } } });
    writeUnit('feat', { name: 'feat', work_type: 'feature', status: 'in-progress', phases: {} });
    const before = [readText('lab'), readText('feat')];
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.deepStrictEqual([readText('lab'), readText('feat')], before);
  });

  it('skips a manifest that does not parse, never throwing', () => {
    writeUnit('broken', 'not json');
    assert.doesNotThrow(() => run());
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.strictEqual(readText('broken'), 'not json');
  });

  it('degrades to a skip over a manifest, phases, items, specification or sources that is not an object', () => {
    writeUnit('nothing', 'null\n');
    writeUnit('list', '[]\n');
    writeUnit('odd', { name: 'odd', work_type: 'epic', phases: 'nope' });
    writeUnit('odder', { name: 'odder', work_type: 'epic', phases: { specification: { items: [] } } });
    writeUnit('oddest', { name: 'oddest', work_type: 'epic', phases: { specification: { items: { a: ['promoted'], b: null } } } });
    writeUnit('rows', { name: 'rows', work_type: 'epic', phases: { specification: { items: {
      a: { status: 'promoted', promoted_to: 'caching', sources: [{ name: 'ttl-policy' }] },
      b: { status: 'promoted', promoted_to: 'caching', sources: { 'ttl-policy': 'incorporated' } },
      c: { status: 'promoted', promoted_to: 7, sources: { 'ttl-policy': { status: 'incorporated' } } },
    } } } });
    writeUnit('caching', cachingUnit());
    writeFile('caching/discussion/ttl-policy.md');
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
    payments();
    run();
    const recorded = [readText('payments'), readText('caching')];
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 1 });
    assert.deepStrictEqual([readText('payments'), readText('caching')], recorded);
  });
});
