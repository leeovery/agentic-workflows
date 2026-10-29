'use strict';

// ---------------------------------------------------------------------------
// The driver seam (workflow-engine/scripts/domain/drivers.cjs, with the task
// id's shape in domain/task-id.cjs): the loader reading a drivers' folder and
// refusing a driver whose folder or declaration is amiss; each kind's
// default among its drivers, landing's turning on the remote a driver
// serves; the project manifest's `drivers` setting, honoured, refused where
// it names no shipped driver, and written where absent; why a driver cannot
// run, every tool missing or failing named; the task's internal id and its
// shown form, formatted and parsed. Unit layer: the fixture
// drivers under tests/fixtures/drivers/, and a plain temp folder pinned as
// the state root for the project manifest. No git: the landing default read
// from a real remote is test-engine-drivers-remote.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { useTempFolder } = require('./discovery-test-utils.cjs');
const { pinStateRoot } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');
const { loadDriver, listDrivers, defaultDriver, resolveDriver, needsRefusal } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');
const { taskId, stepOfId, parseTaskId, shownTask, parseShownTask } = require('../../skills/workflow-engine/scripts/domain/task-id.cjs');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'drivers');
const SHIPPED = path.join(FIXTURES, 'shipped');
const FAULTY = path.join(FIXTURES, 'faulty');

/** @param {{name: string}[]} drivers */
const names = (drivers) => drivers.map((driver) => driver.name);

describe('loadDriver and listDrivers', () => {
  it('lists a kind\'s drivers by name, each with what it declares and every method of its kind', () => {
    const tasks = listDrivers('task', SHIPPED);
    assert.deepStrictEqual(names(tasks), ['alpha', 'beta']);
    assert.deepStrictEqual(names(listDrivers('landing', SHIPPED)), ['hosted', 'local']);
    const [alpha] = tasks;
    const [need] = alpha.needs;
    assert.deepStrictEqual(
      { kind: alpha.kind, isDefault: alpha.isDefault, need: { tool: need.tool, floor: need.floor, found: need.found() }, ready: alpha.ready() },
      { kind: 'task', isDefault: true, need: { tool: 'alpha-cli', floor: '1.0.0', found: '1.2.0' }, ready: 'ready' },
    );
  });

  it('loads one driver by its name', () => {
    assert.strictEqual(loadDriver('landing', 'local', SHIPPED).name, 'local');
  });

  it('refuses a driver whose folder or declaration is amiss, saying what is', () => {
    const faults = {
      lacking: 'lacks ready, done',
      misnamed: 'must declare kind "task" and name "misnamed", as its folder does',
      miskinded: 'must declare kind "task" and name "miskinded", as its folder does',
      unflagged: 'must declare isDefault, true or false',
      unfound: 'must declare its needs as a list of {tool, floor, update, found}',
      entryless: 'has no driver.cjs',
    };
    for (const [name, fault] of Object.entries(faults)) {
      assert.throws(() => loadDriver('task', name, FAULTY), { message: `drivers: the task driver in task/${name}/ ${fault}` }, name);
    }
  });

  it('refuses a name no driver ships, naming those that do', () => {
    assert.throws(() => loadDriver('task', 'gamma', SHIPPED), {
      message: 'drivers: no task driver "gamma" ships — the task drivers are alpha, beta',
    });
  });

  it('refuses a kind whose folder of drivers is missing, and a kind there is none of', () => {
    assert.throws(() => listDrivers('landing', FAULTY), {
      message: 'drivers: no landing driver ships — there is no landing/ folder of drivers',
    });
    assert.throws(() => listDrivers(/** @type {any} */ ('tracker'), SHIPPED), {
      message: 'drivers: "tracker" is not a kind of driver — the kinds are task, landing',
    });
  });
});

describe('defaultDriver (22.4.2, 22.4.3)', () => {
  const tasks = listDrivers('task', SHIPPED);
  const landings = listDrivers('landing', SHIPPED);

  it('is the task driver flagged default', () => {
    assert.strictEqual(defaultDriver('task', tasks, null).name, 'alpha');
  });

  it('is the landing driver serving the remote, else the one flagged default, as where there is no remote', () => {
    assert.strictEqual(defaultDriver('landing', landings, 'git@github.com:acme/pay.git').name, 'hosted');
    assert.strictEqual(defaultDriver('landing', landings, 'https://git.example.org/acme/pay.git').name, 'local');
    assert.strictEqual(defaultDriver('landing', landings, null).name, 'local');
  });

  it('refuses a remote several landing drivers serve', () => {
    const serving = landings.map((driver) => ({ ...driver, serves: () => true }));
    assert.throws(() => defaultDriver('landing', serving, 'https://git.example.org/acme/pay.git'), {
      message: 'drivers: several landing drivers serve https://git.example.org/acme/pay.git — hosted, local',
    });
  });

  it('refuses a kind whose flagged defaults are not exactly one', () => {
    const flagged = tasks.map((driver) => ({ ...driver, isDefault: true }));
    assert.throws(() => defaultDriver('task', flagged, null), {
      message: 'drivers: one task driver is flagged default — flagged: alpha, beta',
    });
    assert.throws(() => defaultDriver('task', [], null), {
      message: 'drivers: one task driver is flagged default — flagged: none',
    });
  });
});

describe('resolveDriver: the project manifest\'s drivers setting (7.1.4)', () => {
  const folder = useTempFolder('engine-drivers-');

  /** A project whose state root holds this project manifest. @param {object} [manifest] @returns {string} */
  function project(manifest) {
    const root = path.join(folder(), '.leeway');
    fs.mkdirSync(root);
    if (manifest !== undefined) fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    pinStateRoot(folder(), root);
    return folder();
  }

  /** @param {string} cwd */
  const manifestOf = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, '.leeway', 'manifest.json'), 'utf8'));

  it('is the driver the setting names, of each kind, and writes nothing', () => {
    const cwd = project({ drivers: { task: 'beta', landing: 'hosted' } });
    const task = resolveDriver(cwd, 'task', SHIPPED);
    const landing = resolveDriver(cwd, 'landing', SHIPPED);
    assert.deepStrictEqual([task.driver.name, task.written, landing.driver.name, landing.written], ['beta', false, 'hosted', false]);
    assert.deepStrictEqual(manifestOf(cwd), { drivers: { task: 'beta', landing: 'hosted' } });
  });

  it('writes the kind\'s default as the setting where it is absent, beside the other kind\'s', () => {
    const cwd = project({ name: 'pay', drivers: { landing: 'local' } });
    const first = resolveDriver(cwd, 'task', SHIPPED);
    assert.deepStrictEqual([first.driver.name, first.written], ['alpha', true]);
    assert.deepStrictEqual(manifestOf(cwd), { name: 'pay', drivers: { landing: 'local', task: 'alpha' } });
    assert.strictEqual(resolveDriver(cwd, 'task', SHIPPED).written, false);
  });

  it('refuses a setting naming a driver not shipped, naming those that are', () => {
    assert.throws(() => resolveDriver(project({ drivers: { task: 'gamma' } }), 'task', SHIPPED), {
      message: 'drivers: no task driver "gamma" ships — the task drivers are alpha, beta',
    });
  });

  it('refuses a setting that is not a driver\'s name, writing nothing', () => {
    const cwd = project({ drivers: { task: ['alpha'] } });
    assert.throws(() => resolveDriver(cwd, 'task', SHIPPED), {
      message: 'drivers: the project\'s drivers.task setting is not a driver\'s name',
    });
    assert.deepStrictEqual(manifestOf(cwd), { drivers: { task: ['alpha'] } });
  });
});

describe('needsRefusal: why a driver cannot run', () => {
  /** @param {string} tool @param {() => string|null} found */
  const need = (tool, found) => ({ tool, floor: '1.0.0', update: `https://example.invalid/${tool}`, found });
  const broken = () => { throw new Error('exited 3'); };

  it('names every tool not installed and where its updates are, and passes through the error of each that fails, every one of each', () => {
    const driver = /** @type {any} */ ({
      kind: 'task', needs: [need('ay', () => null), need('bee', broken), need('sea', () => null), need('dee', () => '1.2.0'), need('ee', broken)],
    });
    assert.strictEqual(needsRefusal(driver), 'the task driver needs ay and sea, not installed — ay\'s updates are at https://example.invalid/ay; '
      + 'sea\'s updates are at https://example.invalid/sea; and bee is installed but fails — exited 3; and ee is installed but fails — exited 3');
  });

  it('answers null where every tool runs', () => {
    assert.strictEqual(needsRefusal(/** @type {any} */ ({ kind: 'task', needs: [need('dee', () => '1.2.0')] })), null);
  });
});

describe('the task id', () => {
  it('is {unit}-{phase}-{n}, shown {phase}.{n}', () => {
    assert.strictEqual(taskId({ unit: 'pay', phase: 2, n: 7 }), 'pay-2-7');
    assert.strictEqual(shownTask({ unit: 'pay', phase: 2, n: 7 }), '2.7');
  });

  it('parses back from its end, so a unit named with hyphens and digits keeps its name', () => {
    assert.deepStrictEqual(parseTaskId('pay-v-2-3-12'), { unit: 'pay-v-2', phase: 3, n: 12 });
    assert.deepStrictEqual(parseShownTask('pay-v-2', '3.12'), { unit: 'pay-v-2', phase: 3, n: 12 });
  });

  it('reads the step any id ends in, whatever names it before — the plan\'s older ids, named by their topic, among them', () => {
    assert.deepStrictEqual(stepOfId('Auth_Flow-v2-3-12'), { prefix: 'Auth_Flow-v2', phase: 3, n: 12 });
    for (const id of ['auth-3', 'auth-03-1', 'auth-3-0']) assert.strictEqual(stepOfId(id), null, id);
  });

  it('refuses an id or shown form of another shape', () => {
    for (const id of ['pay-2', 'pay-0-1', 'pay-2-07', '-2-7', 'pay.v-2-7', 'Pay-2-7', 'research-2-7', 'pay-2-7-']) {
      assert.throws(() => parseTaskId(id), { message: `task-id: "${id}" is not a task's id — it is {unit}-{phase}-{n}` }, id);
    }
    for (const shown of ['2', '2.0', '02.1', '2.1.1', 'pay-2-1']) {
      assert.throws(() => parseShownTask('pay', shown), { message: `task-id: "${shown}" is not a task — it is {phase}.{n}` }, shown);
    }
  });

  it('refuses a unit no work unit can be named, by the rule that mints units', () => {
    for (const unit of ['Pay Flow', 'x:y', 'feat(auth)', 'a\nb', 'pay.v2']) {
      assert.throws(() => taskId({ unit, phase: 1, n: 1 }), { message: `task-id: Work unit name "${unit}" must be a kebab-case slug — lowercase letters and digits, joined by single hyphens` }, unit);
    }
    assert.throws(() => parseShownTask('research', '1.1'), { message: 'task-id: Work unit name "research" conflicts with a phase name' });
    assert.throws(() => taskId({ unit: 'none', phase: 1, n: 1 }), { message: 'task-id: Work unit name "none" is reserved' });
  });

  it('refuses a number that is not a whole number from 1', () => {
    assert.throws(() => taskId({ unit: 'pay', phase: 0, n: 1 }), { message: 'task-id: the phase is a whole number from 1 — got 0' });
    assert.throws(() => shownTask({ unit: 'pay', phase: 1, n: 1.5 }), { message: 'task-id: the task is a whole number from 1 — got 1.5' });
  });
});
