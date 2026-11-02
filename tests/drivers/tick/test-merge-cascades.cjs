'use strict';

// ---------------------------------------------------------------------------
// Tick's store merged between two clones reads as if Tick's own cascades had
// run over the merged tasks (drivers/task/tick/merge.cjs; Tick's
// internal/task/cascades.go): a phase's and a unit's status Tick set is
// never the person's choice, and is settled from the merged children; one
// the person set by hand stands. Each merged store passes Tick's own
// `tick doctor`, a name both machines made included.
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

/** What Tick's doctor finds wrong with a store, nothing where it passes. @param {string} dir */
function doctor(dir) {
  spawnSync('tick', ['rebuild'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
  const ran = spawnSync('tick', ['doctor'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
  return ran.status === 0 ? '' : `${ran.stdout}${ran.stderr}`;
}

/** The unit's and its first phase's status, and each task's, as the driver reads them. @param {string} dir */
function statuses(dir) {
  const held = textOf(dir).trim().split('\n').map((line) => JSON.parse(line));
  const of = (/** @type {string} */ refName) => held.find((t) => t.refs.includes(refName)).status;
  return { unit: of(`unit:${UNIT}`), phase: of(`phase:${UNIT}-1`), tasks: DRIVER.list(dir, UNIT, 1)?.map((row) => row.status) };
}

/** @param {string} dir @param {number} n */
const finish = (dir, n) => {
  DRIVER.start(dir, ref(1, n));
  DRIVER.done(dir, ref(1, n));
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
    const phase = textOf(dir).trim().split('\n').map((line) => JSON.parse(line)).find((t) => t.refs.includes(`phase:${UNIT}-1`));
    assert.deepStrictEqual(phase.transitions.slice(-2).map((/** @type {{from: string, to: string, auto: boolean}} */ t) => [t.from, t.to, t.auto]), [['done', 'open', true], ['open', 'in_progress', true]]);
    assert.strictEqual(doctor(dir), '');
  });

  it('ends the phase and the unit where each machine finished the phase\'s other task', () => {
    const { result, dir } = merged({ start: (d) => DRIVER.start(d, ref(1, 1)), here: (d) => DRIVER.done(d, ref(1, 1)), there: (d) => finish(d, 2) });
    assert.deepStrictEqual([result.conflicts, statuses(dir)], [[], { unit: 'done', phase: 'done', tasks: ['done', 'done'] }]);
    const phase = textOf(dir).trim().split('\n').map((line) => JSON.parse(line)).find((t) => t.refs.includes(`phase:${UNIT}-1`));
    assert.deepStrictEqual(phase.transitions.at(-1), { from: 'in_progress', to: 'done', at: phase.updated, auto: true });
    assert.strictEqual(doctor(dir), '');
  });

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

  it('keeps a phase the person cancelled by hand on one side, over the start the other side\'s task gave it, still theirs', () => {
    const cancel = (/** @type {string} */ d) => {
      const held = textOf(d).trim().split('\n').map((line) => JSON.parse(line)).find((t) => t.refs.includes(`phase:${UNIT}-1`));
      spawnSync('tick', ['cancel', held.id], { cwd: d, encoding: 'utf8', timeout: 30000 });
    };
    const { result, dir } = merged({ here: cancel, there: (d) => DRIVER.start(d, ref(1, 1)) });
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
    assert.deepStrictEqual(result.conflicts, [{ madeTwice: ['phase 2 of pay', 'task 2.1 of pay'], again: [{ phase: 2, title: 'Show the ledger' }] }]);
    assert.deepStrictEqual([DRIVER.show(dir, ref(1, 1))?.status, DRIVER.show(dir, ref(1, 2))?.after, DRIVER.list(dir, UNIT, 2)?.map((row) => row.title)], [
      'done', [], ['Print the ledger'],
    ]);
    assert.strictEqual(doctor(dir), '');
  });
});
