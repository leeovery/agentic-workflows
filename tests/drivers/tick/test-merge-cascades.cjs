'use strict';

// ---------------------------------------------------------------------------
// Tick's store merged between two clones reads as if Tick's own cascades had
// run over the merged tasks (drivers/task/tick/merge.cjs; Tick's
// internal/task/cascades.go): a phase's and a unit's status is never the
// person's choice, and is settled from the merged children whoever set it —
// the engine's own reopen before a make among them — but a parent the person
// cancelled, which stays. Each merged store passes Tick's own `tick doctor`
// with neither an error nor a warning, a name both machines made included.
//
// Layer: conformance, Tick's own. World: stores built through the driver in
// temp folders, a unit whose one phase holds two tasks, against real Tick.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { templateFolder, useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const DRIVER = require('../../../skills/leeway-engine/scripts/drivers/task/tick/driver.cjs');
const { endedInTracker, phaseName, unitName } = require('../../../skills/leeway-engine/scripts/domain/task-id.cjs');

const UNIT = 'pay';
const STORE = '.tick/tasks.jsonl';

/** @param {number} phase @param {number} n */
const ref = (phase, n) => ({ unit: UNIT, phase, n });
/** @param {string} title */
const task = (title) => ({ title, type: 'feat', text: `# ${title}` });

const folder = useTempFolder('tick-merge-cascades-');
/** @type {string} */
let template;

before(() => {
  template = templateFolder('tick-merge-cascades-template-');
  DRIVER.ensureStore(template);
  DRIVER.createUnit(template, UNIT);
  DRIVER.createPhase(template, UNIT, 1, 'The ledger');
  DRIVER.createTask(template, ref(1, 1), task('Write the ledger'));
  DRIVER.createTask(template, ref(1, 2), task('Read the ledger'));
});

/** The template's store copied to a folder of its own, changed there. @param {string} name @param {(dir: string) => void} [change] */
function storeAfter(name, change = () => {}) {
  const dir = path.join(folder(), name);
  fs.cpSync(template, dir, { recursive: true });
  change(dir);
  return dir;
}

/** @param {string} dir */
const textOf = (dir) => fs.readFileSync(path.join(dir, STORE), 'utf8');

/** The store's record carrying `held` among its refs. @param {string} dir @param {string} held */
const recordOf = (dir, held) => textOf(dir).trim().split('\n').map((line) => JSON.parse(line)).find((t) => t.refs.includes(held));

/**
 * The base, changed by `start`, merged from a side each changed its own way:
 * the result, and the merged store in a folder of its own, its cache rebuilt.
 * @param {{start?: (dir: string) => void, here: (dir: string) => void, there: (dir: string) => void, pick?: 'local'|'remote'}} sides
 */
function merged({ start = () => {}, here, there, pick }) {
  const base = storeAfter('base', start);
  const copy = (/** @type {string} */ name, /** @type {(dir: string) => void} */ change) => {
    const dir = path.join(folder(), name);
    fs.cpSync(base, dir, { recursive: true });
    change(dir);
    return textOf(dir);
  };
  const result = DRIVER.mergeStore(textOf(base), copy('here', here), copy('there', there), () => pick ?? null);
  const dir = path.join(folder(), `merged-${pick ?? 'none'}`);
  fs.mkdirSync(path.join(dir, path.dirname(STORE)), { recursive: true });
  fs.writeFileSync(path.join(dir, STORE), result.text);
  return { result, dir };
}

/**
 * What Tick's doctor finds wrong with a store, an error or a warning, nothing
 * where it finds neither: it exits clean on warnings, a parent done over a
 * child still open among them.
 * @param {string} dir
 */
function doctor(dir) {
  spawnSync('tick', ['rebuild'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
  const ran = spawnSync('tick', ['doctor'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
  const found = `${ran.stdout}${ran.stderr}`;
  return ran.status === 0 && !/✗|\d+ issues? found/.test(found) ? '' : found;
}

/** The unit's and its first phase's status, and each task's, as the driver reads them. @param {string} dir */
function statuses(dir) {
  return { unit: recordOf(dir, `unit:${UNIT}`).status, phase: recordOf(dir, `phase:${UNIT}-1`).status, tasks: DRIVER.list(dir, UNIT, 1)?.map((row) => row.status) };
}

/** @param {string} dir @param {number} n */
const finish = (dir, n) => {
  DRIVER.start(dir, ref(1, n));
  DRIVER.done(dir, ref(1, n));
};

/** Tick run by hand on the phase, as the person runs it. @param {string} verb @returns {(dir: string) => void} */
const onPhase = (verb) => (dir) => {
  spawnSync('tick', [verb, recordOf(dir, `phase:${UNIT}-1`).id], { cwd: dir, encoding: 'utf8', timeout: 30000 });
};

/** The phase finished by Tick, then two tasks added to it, which reopens it and the unit by the engine's hand. @param {string} dir */
const reopenedByTheEngine = (dir) => {
  finish(dir, 1);
  finish(dir, 2);
  DRIVER.createTask(dir, ref(1, 3), task('Fold the ledger'));
  DRIVER.createTask(dir, ref(1, 4), task('File the ledger'));
};

describe('the parents Tick\'s cascades settle', () => {
  for (const [pick, expected] of /** @type {const} */ ([
    ['local', { unit: 'done', phase: 'done', tasks: ['done', 'done'] }],
    ['remote', { unit: 'in_progress', phase: 'in_progress', tasks: ['done', 'in-progress'] }],
  ])) {
    it(`asks only of the task where this machine finished the phase and the remote started its task; the ${pick} pick settles the phase and the unit over it`, () => {
      const { result, dir } = merged({
        here: (d) => {
          finish(d, 1);
          finish(d, 2);
        },
        there: (d) => DRIVER.start(d, ref(1, 2)),
        pick,
      });
      assert.deepStrictEqual(result.conflicts.map((c) => ('label' in c ? [c.label.subject, c.label.field] : c)), [['task 1.2 of pay', 'status']]);
      assert.deepStrictEqual(statuses(dir), expected);
      assert.strictEqual(doctor(dir), '');
    });
  }

  it('reopens and starts the phase and the unit the remote finished, where this machine\'s start of its task is picked', () => {
    const { result, dir } = merged({
      here: (d) => DRIVER.start(d, ref(1, 2)),
      there: (d) => {
        finish(d, 1);
        finish(d, 2);
      },
      pick: 'local',
    });
    assert.deepStrictEqual([result.conflicts.length, statuses(dir)], [1, { unit: 'in_progress', phase: 'in_progress', tasks: ['done', 'in-progress'] }]);
    const phase = recordOf(dir, `phase:${UNIT}-1`);
    assert.deepStrictEqual(phase.transitions.slice(-2).map((/** @type {{from: string, to: string, auto: boolean}} */ t) => [t.from, t.to, t.auto]), [['done', 'open', true], ['open', 'in_progress', true]]);
    assert.strictEqual(doctor(dir), '');
  });

  it('ends the phase and the unit where each machine finished the phase\'s other task', () => {
    const { result, dir } = merged({ start: (d) => DRIVER.start(d, ref(1, 1)), here: (d) => DRIVER.done(d, ref(1, 1)), there: (d) => finish(d, 2) });
    assert.deepStrictEqual([result.conflicts, statuses(dir)], [[], { unit: 'done', phase: 'done', tasks: ['done', 'done'] }]);
    const phase = recordOf(dir, `phase:${UNIT}-1`);
    assert.deepStrictEqual(phase.transitions.at(-1), { from: 'in_progress', to: 'done', at: phase.updated, auto: true });
    assert.strictEqual(doctor(dir), '');
  });

  for (const [how, end] of /** @type {const} */ ([
    ['closes', (/** @type {string} */ d, /** @type {number} */ n) => DRIVER.close(d, ref(1, n), 'not needed')],
    ['marks done without starting', (/** @type {string} */ d, /** @type {number} */ n) => DRIVER.done(d, ref(1, n))],
  ])) {
    it(`ends the phase and the unit the engine reopened by hand to add two tasks, where each machine ${how} one of them`, () => {
      const { result, dir } = merged({ start: reopenedByTheEngine, here: (d) => end(d, 3), there: (d) => end(d, 4) });
      assert.deepStrictEqual([result.conflicts, statuses(dir)], [[], { unit: 'done', phase: 'done', tasks: ['done', 'done', ...Array(2).fill(how === 'closes' ? 'closed' : 'done')] }]);
      assert.strictEqual(doctor(dir), '');
    });
  }

  it('reopens the phase and the unit this machine finished where the remote added a task to the phase', () => {
    const { result, dir } = merged({
      start: (d) => DRIVER.start(d, ref(1, 1)),
      here: (d) => {
        DRIVER.done(d, ref(1, 1));
        finish(d, 2);
      },
      there: (d) => DRIVER.createTask(d, ref(1, 3), task('Fold the ledger')),
    });
    assert.deepStrictEqual([result.conflicts, statuses(dir)], [[], { unit: 'open', phase: 'open', tasks: ['done', 'done', 'open'] }]);
    assert.strictEqual(doctor(dir), '');
    DRIVER.createTask(dir, ref(1, 4), task('Page the ledger'));
  });

  it('reopens and starts a phase the person marked done by hand, where the remote started one of its tasks', () => {
    const { result, dir } = merged({ here: onPhase('done'), there: (d) => DRIVER.start(d, ref(1, 1)) });
    assert.deepStrictEqual([result.conflicts, statuses(dir)], [[], { unit: 'in_progress', phase: 'in_progress', tasks: ['in-progress', 'done'] }]);
    assert.strictEqual(doctor(dir), '');
  });

  it('keeps a phase the person marked done, ended over children the other side closed, as Tick ends no parent already ended', () => {
    const closeBoth = (/** @type {string} */ d) => {
      DRIVER.close(d, ref(1, 1), 'not needed');
      DRIVER.close(d, ref(1, 2), 'not needed');
    };
    const { result, dir } = merged({ here: closeBoth, there: onPhase('done') });
    assert.deepStrictEqual([result.conflicts, statuses(dir)], [[], { unit: 'done', phase: 'done', tasks: ['closed', 'closed'] }]);
    assert.strictEqual(doctor(dir), '');
  });

  it('keeps a phase the person cancelled by hand on one side, over the start the other side\'s task gave it, still theirs', () => {
    const { result, dir } = merged({ here: onPhase('cancel'), there: (d) => DRIVER.start(d, ref(1, 1)) });
    assert.deepStrictEqual([result.conflicts, statuses(dir)], [[], { unit: 'cancelled', phase: 'cancelled', tasks: ['in-progress', 'closed'] }]);
    assert.throws(() => DRIVER.createTask(dir, ref(1, 3), task('Fold the ledger')), { message: endedInTracker([unitName(UNIT), phaseName(UNIT, 1)], UNIT) });
    assert.strictEqual(doctor(dir), '');
  });
});

describe('a name both machines made', () => {
  it('keeps this machine\'s progress on the tasks both held, the remote\'s task under the name, and passes the doctor', () => {
    const { result, dir } = merged({
      here: (d) => {
        finish(d, 1);
        DRIVER.createPhase(d, UNIT, 2, 'The screen');
        DRIVER.createTask(d, ref(2, 1), task('Show the ledger'));
        DRIVER.link(d, ref(1, 2), ref(2, 1));
      },
      there: (d) => {
        DRIVER.createPhase(d, UNIT, 2, 'The report');
        DRIVER.createTask(d, ref(2, 1), task('Print the ledger'));
      },
    });
    assert.deepStrictEqual(result.conflicts, [{
      madeTwice: [{ kind: 'phase', said: 'phase 2 of pay' }, { kind: 'task', said: 'task 2.1 of pay' }],
      again: [{ phase: 'The screen', kept: null, tasks: ['Show the ledger'] }],
    }]);
    assert.deepStrictEqual([DRIVER.show(dir, ref(1, 1))?.status, DRIVER.show(dir, ref(1, 2))?.after, DRIVER.list(dir, UNIT, 2)?.map((row) => row.title)], [
      'done', [], ['Print the ledger'],
    ]);
    assert.strictEqual(doctor(dir), '');
  });

  it('ends the phase the engine reopened by hand to add a task made on both machines, where the remote closed its own', () => {
    const { result, dir } = merged({
      start: (d) => {
        finish(d, 1);
        finish(d, 2);
      },
      here: (d) => DRIVER.createTask(d, ref(1, 3), task('Fold the ledger')),
      there: (d) => {
        DRIVER.createTask(d, ref(1, 3), task('File the ledger'));
        DRIVER.close(d, ref(1, 3), 'not needed');
      },
    });
    assert.deepStrictEqual(result.conflicts, [{
      madeTwice: [{ kind: 'task', said: 'task 1.3 of pay' }],
      again: [{ phase: 'The ledger', kept: 1, tasks: ['Fold the ledger'] }],
    }]);
    assert.deepStrictEqual(statuses(dir), { unit: 'done', phase: 'done', tasks: ['done', 'done', 'closed'] });
    assert.strictEqual(doctor(dir), '');
  });
});
