'use strict';

//
// Tests for migration 059: backfill-import-origins (.cjs)
//
// Happy path over both manifests (work-unit entries take `discovery`, the
// roadmap's take `roadmap`), entries already carrying an origin left alone,
// skip/no-op, idempotency, content preservation (other fields, other work
// units, seeds), and the malformed-manifest and missing-.workflows guards.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/059-backfill-import-origins.cjs');

let dir, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

function writeUnit(name, manifest) {
  fs.mkdirSync(path.join(dir, '.workflows', name), { recursive: true });
  fs.writeFileSync(path.join(dir, '.workflows', name, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

function readUnit(name) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', name, 'manifest.json'), 'utf8'));
}

function writeProject(manifest) {
  fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

function readProject() {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'));
}

/** A unit whose imports landed before the field existed. */
function legacyUnit() {
  return {
    name: 'pay',
    work_type: 'epic',
    status: 'in-progress',
    imports: [
      { path: 'imports/notes.md', imported_at: '2026-05-01T08:00:00Z' },
      { path: 'imports/design.md', imported_at: '2026-05-02T08:00:00Z' },
    ],
    seeds: [{ path: 'seeds/idea.md', source: 'inbox:idea', seeded_at: '2026-05-01T07:00:00Z' }],
    phases: { discussion: { items: { billing: { status: 'completed' } } } },
  };
}

describe('migration 059: backfill import origins', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-059-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('describes itself as a mechanical backfill with no verify addendum', () => {
    assert.strictEqual(MIGRATION.id, '059');
    assert.strictEqual(MIGRATION.description, 'backfill import origins — discovery for work-unit imports, roadmap for the product layer');
    assert.strictEqual(MIGRATION.info, undefined);
    writeUnit('pay', legacyUnit());
    assert.strictEqual(run(), undefined);
  });

  it('stamps discovery on work-unit entries and roadmap on the product layer, one update per file', () => {
    writeUnit('pay', legacyUnit());
    writeProject({
      work_units: { pay: { work_type: 'epic' } },
      roadmap: { horizons: ['mvp'], items: {}, imports: [{ path: 'imports/sketch.png', imported_at: '2026-04-01T08:00:00Z' }] },
    });
    run();

    assert.strictEqual(updates, 2);
    assert.strictEqual(skips, 0);
    assert.deepStrictEqual(readUnit('pay').imports, [
      { path: 'imports/notes.md', imported_at: '2026-05-01T08:00:00Z', origin: 'discovery' },
      { path: 'imports/design.md', imported_at: '2026-05-02T08:00:00Z', origin: 'discovery' },
    ]);
    assert.deepStrictEqual(readProject().roadmap.imports, [
      { path: 'imports/sketch.png', imported_at: '2026-04-01T08:00:00Z', origin: 'roadmap' },
    ]);
  });

  it('leaves an entry that already names its origin untouched', () => {
    const unit = legacyUnit();
    unit.imports[0].origin = 'research/billing';
    writeUnit('pay', unit);
    run();

    assert.strictEqual(updates, 1, 'the file still changed — its second entry had none');
    assert.deepStrictEqual(readUnit('pay').imports.map((e) => e.origin), ['research/billing', 'discovery']);
  });

  it('preserves every other field, work unit, and seed', () => {
    writeUnit('pay', legacyUnit());
    writeUnit('untouched', { name: 'untouched', work_type: 'feature', status: 'completed', phases: {} });
    run();

    const m = readUnit('pay');
    assert.strictEqual(m.name, 'pay');
    assert.strictEqual(m.work_type, 'epic');
    assert.deepStrictEqual(m.seeds, [{ path: 'seeds/idea.md', source: 'inbox:idea', seeded_at: '2026-05-01T07:00:00Z' }]);
    assert.deepStrictEqual(m.phases, { discussion: { items: { billing: { status: 'completed' } } } });
    assert.deepStrictEqual(readUnit('untouched'), { name: 'untouched', work_type: 'feature', status: 'completed', phases: {} });
  });

  it('is idempotent — a second run changes nothing and skips', () => {
    writeUnit('pay', legacyUnit());
    writeProject({ roadmap: { imports: [{ path: 'imports/sketch.png' }] } });
    run();
    const afterFirst = { unit: readUnit('pay'), project: readProject() };
    updates = 0;
    skips = 0;
    run();

    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.deepStrictEqual(readUnit('pay'), afterFirst.unit);
    assert.deepStrictEqual(readProject(), afterFirst.project);
  });

  it('skips a project with no imports anywhere', () => {
    writeUnit('pay', { name: 'pay', work_type: 'feature', status: 'in-progress', phases: {} });
    writeProject({ work_units: { pay: { work_type: 'feature' } } });
    run();

    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('skips a project with no .workflows directory', () => {
    fs.rmSync(path.join(dir, '.workflows'), { recursive: true, force: true });
    run();

    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('leaves a malformed manifest, a malformed roadmap node, and a malformed entry alone', () => {
    fs.mkdirSync(path.join(dir, '.workflows', 'broken'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), '{ not json\n');
    writeUnit('stringy', { name: 'stringy', work_type: 'feature', status: 'in-progress', imports: 'corrupt', phases: {} });
    writeUnit('entries', {
      name: 'entries',
      work_type: 'feature',
      status: 'in-progress',
      imports: ['loose string', null, { path: 'imports/real.md' }],
      phases: {},
    });
    writeProject({ roadmap: 'corrupt' });
    run();

    assert.strictEqual(updates, 1, 'only the unit with a real entry changed');
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'utf8'), '{ not json\n');
    assert.strictEqual(readUnit('stringy').imports, 'corrupt');
    assert.deepStrictEqual(readUnit('entries').imports, ['loose string', null, { path: 'imports/real.md', origin: 'discovery' }]);
    assert.strictEqual(readProject().roadmap, 'corrupt');
  });
});
