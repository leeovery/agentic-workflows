'use strict';

//
// Tests for migration 062: clear-unasked-implementation-setup (.cjs)
//
// Happy path (both empty arrays cleared from an unstarted in-progress
// implementation), the progress guards (a current task, a completed task),
// the status guard, populated arrays, one field empty and the other not,
// skip/no-op, idempotency, content preservation (other fields, other phases,
// other work units, the project manifest), and the malformed-manifest and
// missing-.workflows guards.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/062-clear-unasked-implementation-setup.cjs');

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

/** The item `task init` created before its setup steps ran. */
function unstartedItem() {
  return {
    status: 'in-progress',
    task_gate_mode: 'gated',
    fix_gate_mode: 'gated',
    analysis_gate_mode: 'gated',
    consolidation_gate_mode: 'gated',
    fix_attempts: 0,
    analysis_cycle_total: 0,
    linters: [],
    project_skills: [],
    current_phase: 1,
    current_task: null,
  };
}

function unitWith(item) {
  return {
    name: 'pay',
    work_type: 'feature',
    status: 'in-progress',
    phases: {
      specification: { items: { pay: { status: 'completed', project_skills: [] } } },
      planning: { items: { pay: { status: 'completed', format: 'local-markdown' } } },
      implementation: { items: { pay: item } },
    },
  };
}

describe('migration 062: clear the unasked implementation setup arrays', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-062-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('describes itself as a mechanical clear with no verify addendum', () => {
    assert.strictEqual(MIGRATION.id, '062');
    assert.strictEqual(MIGRATION.description, 'clear the empty project_skills and linters an unstarted implementation carries — never asked, so its setup steps ask');
    assert.match(MIGRATION.info, /absent is never asked/);
    writeUnit('pay', unitWith(unstartedItem()));
    assert.strictEqual(run(), undefined);
  });

  it('deletes both empty arrays from an in-progress implementation that never reached its task loop', () => {
    writeUnit('pay', unitWith(unstartedItem()));
    run();
    assert.strictEqual(updates, 1);
    assert.strictEqual(skips, 0);
    const expected = unstartedItem();
    delete expected.linters;
    delete expected.project_skills;
    assert.deepStrictEqual(readUnit('pay').phases.implementation.items.pay, expected);
  });

  it('treats an absent current_task and an empty completed_tasks as no progress', () => {
    const item = unstartedItem();
    delete item.current_task;
    item.completed_tasks = [];
    writeUnit('pay', unitWith(item));
    run();
    assert.strictEqual(updates, 1);
    const after = readUnit('pay').phases.implementation.items.pay;
    assert.ok(!('linters' in after));
    assert.ok(!('project_skills' in after));
    assert.deepStrictEqual(after.completed_tasks, []);
  });

  it('keeps the empty arrays on an item with a task in flight — its setup steps ran', () => {
    const item = unstartedItem();
    item.current_task = 'pay-1-1';
    writeUnit('pay', unitWith(item));
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.deepStrictEqual(readUnit('pay').phases.implementation.items.pay, item);
  });

  it('keeps the empty arrays on an item with a completed task and no task in flight', () => {
    const item = unstartedItem();
    item.completed_tasks = ['pay-1-1'];
    writeUnit('pay', unitWith(item));
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.deepStrictEqual(readUnit('pay').phases.implementation.items.pay, item);
  });

  it('keeps the empty arrays on an item that is not in progress', () => {
    const item = unstartedItem();
    item.status = 'completed';
    writeUnit('pay', unitWith(item));
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.deepStrictEqual(readUnit('pay').phases.implementation.items.pay, item);
  });

  it('leaves populated arrays alone and clears only the empty one beside them', () => {
    const item = unstartedItem();
    item.project_skills = ['.claude/skills/golang-pro'];
    writeUnit('pay', unitWith(item));
    run();
    assert.strictEqual(updates, 1);
    const after = readUnit('pay').phases.implementation.items.pay;
    assert.deepStrictEqual(after.project_skills, ['.claude/skills/golang-pro']);
    assert.ok(!('linters' in after));
  });

  it('never touches another phase or the rest of the manifest', () => {
    writeUnit('pay', unitWith(unstartedItem()));
    run();
    const m = readUnit('pay');
    const before = unitWith(unstartedItem());
    assert.deepStrictEqual(m.phases.specification, before.phases.specification);
    assert.deepStrictEqual(m.phases.planning, before.phases.planning);
    assert.strictEqual(m.name, 'pay');
    assert.strictEqual(m.work_type, 'feature');
    assert.strictEqual(m.status, 'in-progress');
  });

  it('skips when no implementation item carries an unasked empty array', () => {
    const item = unstartedItem();
    delete item.linters;
    delete item.project_skills;
    writeUnit('pay', unitWith(item));
    writeUnit('plan', { name: 'plan', work_type: 'feature', status: 'in-progress', phases: { planning: { items: { plan: { status: 'in-progress' } } } } });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('skips when .workflows does not exist', () => {
    fs.rmSync(path.join(dir, '.workflows'), { recursive: true, force: true });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('counts one update per changed unit, leaving the others and the project manifest byte-identical', () => {
    writeUnit('pay', unitWith(unstartedItem()));
    const item = unstartedItem();
    item.current_task = 'other-1-1';
    const other = { name: 'other', work_type: 'feature', status: 'in-progress', phases: { implementation: { items: { other: item } } } };
    writeUnit('other', other);
    const project = JSON.stringify({ work_units: { pay: { work_type: 'feature' }, other: { work_type: 'feature' } }, defaults: { project_skills: [], linters: [] } }, null, 2) + '\n';
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
    writeUnit('pay', unitWith(unstartedItem()));
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

  it('degrades to a skip over a manifest whose phases, items, or item are not objects', () => {
    writeUnit('odd', { name: 'odd', work_type: 'feature', status: 'in-progress', phases: 'nope' });
    writeUnit('odder', { name: 'odder', work_type: 'feature', status: 'in-progress', phases: { implementation: { items: [] } } });
    writeUnit('oddest', { name: 'oddest', work_type: 'feature', status: 'in-progress', phases: { implementation: { items: { oddest: ['in-progress'], blank: null } } } });
    writeUnit('none', { name: 'none', work_type: 'feature', status: 'in-progress', phases: { implementation: 'nope' } });
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
  });

  it('is idempotent — a second run reports skip and changes nothing', () => {
    writeUnit('pay', unitWith(unstartedItem()));
    run();
    const after = JSON.stringify(readUnit('pay'));
    updates = 0; skips = 0;
    run();
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    assert.strictEqual(JSON.stringify(readUnit('pay')), after);
  });
});
