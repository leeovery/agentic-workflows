'use strict';

//
// Tests for migration 058: restore-cancelled-delivery-items (.cjs)
//
// Happy path per delivery phase (the stash returns as the status), the
// stash-less item (status removed), the untouched phases, skip/no-op,
// idempotency, content preservation (other fields, other work units, the
// project manifest), and the malformed-manifest and missing-.workflows
// guards.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/058-restore-cancelled-delivery-items.cjs');

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

// An epic cancelled per item before the unit cancel: every phase carries a
// cancelled row, the delivery ones stashed, one stash-less.
function legacyManifest() {
  return {
    name: 'pay',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { billing: { routing: 'discussion', source: 'discovery', cancelled: true, previous_order: 1 } } },
      research: { items: { billing: { status: 'cancelled', previous_status: 'completed' } } },
      discussion: { items: { billing: { status: 'cancelled', previous_status: 'completed' }, live: { status: 'completed' } } },
      specification: { items: { billing: { status: 'cancelled', previous_status: 'completed', previous_order: 1, sources: { billing: { status: 'incorporated' } } } } },
      planning: { items: {
        billing: { status: 'cancelled', previous_status: 'completed', format: 'local-markdown', external_dependencies: { live: { state: 'unresolved' } } },
        live: { status: 'in-progress', format: 'local-markdown' },
      } },
      implementation: { items: { billing: { status: 'cancelled', previous_status: 'in-progress', current_phase: 2, completed_tasks: ['billing-1-1'] } } },
      review: { items: { billing: { status: 'cancelled' } } },
    },
  };
}

describe('migration 058: restore cancelled delivery items', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-058-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('describes itself as a mechanical restore with no verify addendum', () => {
    assert.strictEqual(MIGRATION.id, '058');
    assert.strictEqual(MIGRATION.description, 'restore cancelled planning, implementation, and review items — Delivery never cancels; the specification unit cancels whole');
    assert.match(MIGRATION.info, /Delivery never cancels/);
    writeUnit('pay', legacyManifest());
    assert.strictEqual(run(), undefined);
  });

  it('restores a cancelled plan, implementation, and review to the status each stashed, one update for the unit', () => {
    writeUnit('pay', legacyManifest());
    run();
    assert.strictEqual(updates, 1);
    assert.strictEqual(skips, 0);
    const m = readUnit('pay');
    assert.deepStrictEqual(m.phases.planning.items.billing,
      { status: 'completed', format: 'local-markdown', external_dependencies: { live: { state: 'unresolved' } } });
    assert.deepStrictEqual(m.phases.implementation.items.billing,
      { status: 'in-progress', current_phase: 2, completed_tasks: ['billing-1-1'] });
  });

  it('a stash-less cancelled item returns to never-attempted — its status removed', () => {
    writeUnit('pay', legacyManifest());
    run();
    assert.deepStrictEqual(readUnit('pay').phases.review.items.billing, {});
  });

  it('never touches the specification, research, discussion, or discovery rows — the unit verbs own those', () => {
    writeUnit('pay', legacyManifest());
    run();
    const m = readUnit('pay');
    const before = legacyManifest().phases;
    assert.deepStrictEqual(m.phases.discovery, before.discovery);
    assert.deepStrictEqual(m.phases.research, before.research);
    assert.deepStrictEqual(m.phases.discussion, before.discussion);
    assert.deepStrictEqual(m.phases.specification, before.specification);
  });

  it('leaves live delivery items and their siblings as they are', () => {
    writeUnit('pay', legacyManifest());
    run();
    const m = readUnit('pay');
    assert.deepStrictEqual(m.phases.planning.items.live, { status: 'in-progress', format: 'local-markdown' });
    assert.strictEqual(m.name, 'pay');
    assert.strictEqual(m.work_type, 'epic');
    assert.strictEqual(m.status, 'in-progress');
  });

  it('skips when no delivery item is cancelled', () => {
    writeUnit('clean', {
      name: 'clean', work_type: 'feature', status: 'in-progress',
      phases: { planning: { items: { clean: { status: 'completed' } } }, review: { items: { clean: { status: 'in-progress' } } } },
    });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('skips a unit whose only cancels sit outside the delivery phases', () => {
    const m = legacyManifest();
    delete m.phases.planning;
    delete m.phases.implementation;
    delete m.phases.review;
    writeUnit('pay', m);
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.deepStrictEqual(readUnit('pay'), m);
  });

  it('skips when .workflows does not exist', () => {
    fs.rmSync(path.join(dir, '.workflows'), { recursive: true, force: true });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('counts one update per changed unit, leaving the others and the project manifest byte-identical', () => {
    writeUnit('pay', legacyManifest());
    const other = { name: 'other', work_type: 'epic', status: 'in-progress', phases: { planning: { items: { x: { status: 'completed' } } } } };
    writeUnit('other', other);
    const project = JSON.stringify({ work_units: { pay: { work_type: 'epic' }, other: { work_type: 'epic' } }, defaults: {} }, null, 2) + '\n';
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), project);
    run();
    assert.strictEqual(updates, 1);
    assert.strictEqual(skips, 0);
    assert.deepStrictEqual(readUnit('other'), other);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'), project);
  });

  it('walks past dot-directories and non-unit directories', () => {
    fs.mkdirSync(path.join(dir, '.workflows', '.inbox', 'ideas'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.workflows', 'notes'), { recursive: true });
    writeUnit('pay', legacyManifest());
    run();
    assert.strictEqual(updates, 1);
  });

  it('leaves a malformed manifest alone and skips', () => {
    fs.mkdirSync(path.join(dir, '.workflows', 'broken'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'not json');
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'utf8'), 'not json');
  });

  it('degrades to a skip over a manifest whose phases are not an object', () => {
    writeUnit('odd', { name: 'odd', work_type: 'epic', status: 'in-progress', phases: 'nope' });
    writeUnit('odder', { name: 'odder', work_type: 'epic', status: 'in-progress', phases: { planning: { items: [] } } });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('is idempotent — a second run reports skip and changes nothing', () => {
    writeUnit('pay', legacyManifest());
    run();
    const after = JSON.stringify(readUnit('pay'));
    updates = 0; skips = 0;
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.strictEqual(JSON.stringify(readUnit('pay')), after);
  });
});
