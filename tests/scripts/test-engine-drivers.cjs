'use strict';

// ---------------------------------------------------------------------------
// The driver seam (workflow-engine/scripts/domain/drivers.cjs, with the task
// id's shape in domain/task-id.cjs): the loader listing a drivers' folder and
// refusing a driver short of its kind's methods or declared under another
// folder's name; the defaults, task and landing, the landing default turning
// on whether the remote is on GitHub; the project manifest's `drivers`
// setting, and a setting naming no shipped driver refused; the task's
// internal id and its shown form, formatted and parsed. Unit layer: the
// fixture drivers under tests/fixtures/drivers/, and a plain temp folder
// pinned as the state root for the project manifest. No git.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { useTempFolder } = require('./discovery-test-utils.cjs');
const { pinStateRoot } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');
const { listDrivers, defaultDriverName, projectDriver } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');
const { taskId, parseTaskId, shownTask, parseShownTask } = require('../../skills/workflow-engine/scripts/domain/task-id.cjs');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'drivers');
const SHIPPED = path.join(FIXTURES, 'shipped');
const FAULTY = path.join(FIXTURES, 'faulty');

/** @param {{name: string}[]} drivers */
const names = (drivers) => drivers.map((driver) => driver.name);

describe('listDrivers', () => {
  it('lists the folder\'s drivers of a kind by name, each carrying every method of its kind', () => {
    const tasks = listDrivers('task', SHIPPED);
    assert.deepStrictEqual(names(tasks), ['alpha', 'beta']);
    assert.deepStrictEqual(names(listDrivers('landing', SHIPPED)), ['github', 'local']);
    const alpha = tasks[0];
    assert.deepStrictEqual(
      { kind: alpha.kind, isDefault: alpha.isDefault, needs: alpha.needs, ready: alpha.ready() },
      { kind: 'task', isDefault: true, needs: [], ready: 'ready' },
    );
  });

  it('refuses a driver lacking a method of its kind, naming each it lacks', () => {
    assert.throws(() => listDrivers('task', FAULTY), {
      message: 'drivers: the task driver in task/alpha/ lacks ready, done',
    });
  });

  it('refuses a driver declaring another name than its folder\'s', () => {
    assert.throws(() => listDrivers('landing', FAULTY), {
      message: 'drivers: the landing driver in landing/alpha/ must declare kind "landing" and name "alpha"',
    });
  });

  it('refuses a kind of driver there is none of', () => {
    assert.throws(() => listDrivers(/** @type {any} */ ('tracker'), SHIPPED), {
      message: 'drivers: "tracker" is not a kind of driver — the kinds are task, landing',
    });
  });
});

describe('defaultDriverName (22.4.2, 22.4.3)', () => {
  const shipped = { task: listDrivers('task', SHIPPED), landing: listDrivers('landing', SHIPPED) };

  it('is the task driver flagged default, whatever the remote', () => {
    assert.strictEqual(defaultDriverName('task', shipped.task, false), 'alpha');
    assert.strictEqual(defaultDriverName('task', shipped.task, true), 'alpha');
  });

  it('is GitHub\'s landing driver where the remote is on GitHub, and the one flagged default otherwise', () => {
    assert.strictEqual(defaultDriverName('landing', shipped.landing, true), 'github');
    assert.strictEqual(defaultDriverName('landing', shipped.landing, false), 'local');
  });

  it('refuses a kind whose flagged defaults are not exactly one', () => {
    const flagged = shipped.task.map((driver) => ({ ...driver, isDefault: true }));
    assert.throws(() => defaultDriverName('task', flagged, false), {
      message: 'drivers: one task driver is flagged default — flagged: alpha, beta',
    });
    assert.throws(() => defaultDriverName('task', [], false), {
      message: 'drivers: one task driver is flagged default — flagged: none',
    });
  });
});

describe('projectDriver: the project manifest\'s drivers setting', () => {
  const folder = useTempFolder('engine-drivers-');

  /** The project manifest, written where the pinned state root reads it. @param {object} [manifest] */
  function project(manifest) {
    const root = path.join(folder(), '.leeway');
    fs.mkdirSync(root);
    if (manifest !== undefined) fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    pinStateRoot(folder(), root);
    return folder();
  }

  it('is the kind\'s default where the setting is absent', () => {
    assert.strictEqual(projectDriver(project(), 'task', SHIPPED).name, 'alpha');
  });

  it('is the driver the setting names, of each kind', () => {
    const cwd = project({ drivers: { task: 'beta', landing: 'github' } });
    assert.strictEqual(projectDriver(cwd, 'task', SHIPPED).name, 'beta');
    assert.strictEqual(projectDriver(cwd, 'landing', SHIPPED).name, 'github');
  });

  it('refuses a setting naming a driver not shipped, naming those that are', () => {
    assert.throws(() => projectDriver(project({ drivers: { task: 'gamma' } }), 'task', SHIPPED), {
      message: 'drivers: no task driver "gamma" ships — the task drivers are alpha, beta',
    });
  });

  it('refuses a setting that is not a driver\'s name', () => {
    assert.throws(() => projectDriver(project({ drivers: { task: ['alpha'] } }), 'task', SHIPPED), {
      message: 'drivers: the project\'s drivers.task setting is not a driver\'s name',
    });
  });
});

describe('the task id', () => {
  it('is {unit}-{phase}-{n}, shown {phase}.{n}', () => {
    assert.strictEqual(taskId({ unit: 'pay', phase: 2, n: 7 }), 'pay-2-7');
    assert.strictEqual(shownTask({ unit: 'pay', phase: 2, n: 7 }), '2.7');
  });

  it('parses back from its end, so a unit named with hyphens and numbers keeps its name', () => {
    assert.deepStrictEqual(parseTaskId('pay-v-2-3-12'), { unit: 'pay-v-2', phase: 3, n: 12 });
    assert.deepStrictEqual(parseShownTask('pay-v-2', '3.12'), { unit: 'pay-v-2', phase: 3, n: 12 });
  });

  it('refuses an id or shown form of another shape', () => {
    for (const id of ['pay-2', 'pay-0-1', 'pay-2-07', '-2-7', 'pay.v-2-7', 'pay-2-7-']) {
      assert.throws(() => parseTaskId(id), { message: `task-id: "${id}" is not a task's id — it is {unit}-{phase}-{n}` });
    }
    for (const shown of ['2', '2.0', '02.1', '2.1.1', 'pay-2-1']) {
      assert.throws(() => parseShownTask('pay', shown), { message: `task-id: "${shown}" is not a task — it is {phase}.{n}` });
    }
  });

  it('refuses a unit no work unit can take, and a number that is not a whole number from 1', () => {
    assert.throws(() => taskId({ unit: 'pay.v2', phase: 1, n: 1 }), /^Error: task-id: "pay\.v2" is not a legal work unit name/);
    assert.throws(() => taskId({ unit: 'pay', phase: 0, n: 1 }), { message: 'task-id: the phase is a whole number from 1 — got 0' });
    assert.throws(() => shownTask({ unit: 'pay', phase: 1, n: 1.5 }), { message: 'task-id: the task is a whole number from 1 — got 1.5' });
  });
});
