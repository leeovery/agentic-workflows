'use strict';

// ---------------------------------------------------------------------------
// The task conformance suite (7.3.1–7.3.3, 7.3.5; tests/README.md §10): the
// contract every shipped task driver (domain/drivers.cjs, TaskDriver) meets,
// run against its real tool at or above the floor it declares — a phase;
// links across phases; ready answering several; done unblocking; close, and
// close unblocking; a task closed and replaced, and tasks and a phase made
// after every task of the unit ended, closed or done; an addition to a task;
// a type replaced; list; show — its store made in the state root, never in
// the project's own a walk up would find, and the tasks it names its own,
// whatever else a person gives them. The driver answers whether a phase or
// task is there, and finds its tools — none, or one that fails — for the
// engine to refuse in its words (test-engine-task-verbs.cjs); what stays
// with the driver is refused here: a store it cannot read, or a line of it,
// a link that would make a cycle, a name carried twice, and a unit or phase the person
// ended in the tracker, cancelled or done — a parent the tracker ended itself
// is reopened. 7.S5: the shipped task drivers are exactly one, the default.
//
// Layer: conformance. World: for each driver, a plain folder standing as the
// state root, its store built once through the driver — a unit whose first
// phase holds three tasks, the third after the first, and whose second
// phase holds one after the first phase's second — and copied for each test.
// No git: the verbs' commits are test-engine-task-verbs.cjs's. Each
// driver's side of the suite, the one place its tool is named, is
// tests/drivers/{name}/task.cjs.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { STATE_DIR_NAME, templateFolder, useTempFolder } = require('./discovery-test-utils.cjs');
const { listDrivers, needsRefusal } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');
const { phaseName, unitName, endedInTracker, FOREIGN_TASK } = require('../../skills/workflow-engine/scripts/domain/task-id.cjs');

const UNIT = 'pay';
const SIDES = path.join(__dirname, '..', 'drivers');

/** A driver's side of the suite. @param {string} name */
const sideOf = (name) => path.join(SIDES, name, 'task.cjs');

/** @param {number} phase @param {number} n */
const ref = (phase, n) => ({ unit: UNIT, phase, n });

/** @param {string} title */
const task = (title) => ({ title, type: 'feat', text: `# ${title}\n\n## Problem\n${title} is missing.` });

/** Whether a version is at or above a floor, by each dotted number in turn. @param {string} version @param {string} floor */
function atLeast(version, floor) {
  const [have, need] = [version, floor].map((v) => v.split('.').map((part) => parseInt(part, 10) || 0));
  const differing = need.findIndex((part, i) => (have[i] ?? 0) !== part);
  return differing === -1 || (have[differing] ?? 0) > need[differing];
}

/** @param {{ref: {phase: number, n: number}}[]} rows */
const shown = (rows) => rows.map((row) => `${row.ref.phase}.${row.ref.n}`);

describe('the shipped task drivers (7.S5)', () => {
  it('are exactly one, the default, with its side of the suite', () => {
    const drivers = listDrivers('task');
    assert.deepStrictEqual(drivers.map((driver) => driver.isDefault), [true]);
    assert.deepStrictEqual(drivers.map((driver) => driver.name), fs.readdirSync(SIDES).filter((name) => fs.existsSync(sideOf(name))).sort());
  });
});

for (const driver of listDrivers('task')) {
  /** @type {string} */
  let template;
  /** @type {string} */
  let root;

  describe(`the ${driver.name} task driver (7.3.3)`, () => {
    const folder = useTempFolder(`task-conformance-${driver.name}-`);

    before(() => {
      template = templateFolder(`task-conformance-${driver.name}-template-`);
      driver.ensureStore(template);
      driver.createUnit(template, UNIT);
      driver.createPhase(template, UNIT, 1, 'The ledger');
      for (const [n, title] of [[1, 'Write the ledger'], [2, 'Read the ledger'], [3, 'Fold the ledger']]) driver.createTask(template, ref(1, n), task(title));
      driver.link(template, ref(1, 3), ref(1, 1));
      driver.createPhase(template, UNIT, 2, 'The screen');
      driver.createTask(template, ref(2, 1), task('Show the ledger'));
      driver.link(template, ref(2, 1), ref(1, 2));
    });

    beforeEach(() => {
      root = path.join(folder(), 'state');
      fs.cpSync(template, root, { recursive: true });
    });

    it(`runs against its tools at or above the floors it declares (7.3.5)`, () => {
      for (const need of driver.needs) {
        const version = need.found();
        assert.ok(version !== null, `${need.tool} is not installed — the ${driver.name} driver needs it at ${need.floor} or later (${need.update})`);
        assert.ok(atLeast(version, need.floor), `${need.tool} ${version} is below the ${driver.name} driver's floor, ${need.floor} (${need.update})`);
      }
    });

    it('finds none of its tools where none is installed, and the engine refuses it, naming every one', { skip: driver.needs.length === 0 }, () => {
      const held = process.env.PATH;
      process.env.PATH = folder();
      try {
        assert.deepStrictEqual(driver.needs.map((need) => need.found()), driver.needs.map(() => null));
        const refusal = needsRefusal(driver) ?? '';
        for (const need of driver.needs) assert.ok(refusal.includes(need.tool) && refusal.includes(need.update), `the refusal names ${need.tool} and its updates: ${refusal}`);
      } finally {
        process.env.PATH = held;
      }
    });

    it('passes through the error of a tool installed that fails, or that the system cannot run, never calling it missing', { skip: driver.needs.length === 0 }, () => {
      for (const [body, said] of [['#!/bin/sh\necho "broken here" >&2\nexit 3\n', 'broken here'], ['\u0000\u0001 not a program', '']]) {
        const bin = folder();
        for (const need of driver.needs) fs.writeFileSync(path.join(bin, need.tool), body, { mode: 0o755 });
        const held = process.env.PATH;
        process.env.PATH = bin;
        try {
          for (const need of driver.needs) assert.throws(() => need.found(), (err) => err instanceof Error && err.message.includes(said));
          const refusal = needsRefusal(driver) ?? '';
          assert.ok(driver.needs.every((need) => refusal.includes(`${need.tool} is installed but fails — `)) && refusal.includes(said) && !refusal.includes('not installed'), refusal);
        } finally {
          process.env.PATH = held;
        }
      }
    });

    it('makes its store in the state root, never in the project\'s own a walk up from it finds, and makes it once', () => {
      const project = path.join(folder(), 'project');
      const state = path.join(project, STATE_DIR_NAME);
      fs.mkdirSync(state, { recursive: true });
      const held = require(sideOf(driver.name)).projectStore(project);
      const before = held();
      assert.strictEqual(driver.ensureStore(state), true);
      assert.strictEqual(driver.createUnit(state, UNIT), true);
      assert.deepStrictEqual([driver.ensureStore(state), held()], [false, before]);
      for (const file of driver.storeFiles()) assert.ok(fs.existsSync(path.join(state, file)), `${file} is in the state root`);
    });

    it('refuses a store left without the files the state branch carries, naming them, rather than make it again', () => {
      require(sideOf(driver.name)).breakStore(root);
      assert.throws(() => driver.ensureStore(root), (err) => err instanceof Error && driver.storeFiles().every((file) => err.message.includes(path.basename(file))));
    });

    it('refuses a store holding a line it cannot read, naming the file and the line', () => {
      const line = require(sideOf(driver.name)).garbleStore(root);
      assert.throws(() => driver.list(root, UNIT, 1), (err) => err instanceof Error
        && driver.storeFiles().some((file) => err.message.includes(path.basename(file))) && new RegExp(`\\bline ${line}\\b`).test(err.message));
    });

    it('a phase (7.4.1): the tracker holds only the phases written, the unit made once', () => {
      assert.deepStrictEqual(shown(driver.list(root, UNIT, 1)), ['1.1', '1.2', '1.3']);
      assert.deepStrictEqual([driver.list(root, UNIT, 3), driver.ready(root, UNIT, 3)], [null, null]);
      assert.strictEqual(driver.createUnit(root, UNIT), false);
      driver.createPhase(root, UNIT, 3, 'The export');
      assert.deepStrictEqual([driver.list(root, UNIT, 3), driver.ready(root, UNIT, 3)], [[], []]);
    });

    it('ready answering several (7.S4): every task waiting with nothing unfinished before it, of a phase or the unit, none started', () => {
      assert.deepStrictEqual(driver.ready(root, UNIT, 1), [
        { ref: ref(1, 1), title: 'Write the ledger', status: 'open' },
        { ref: ref(1, 2), title: 'Read the ledger', status: 'open' },
      ]);
      driver.start(root, ref(1, 2));
      assert.deepStrictEqual(shown(driver.ready(root, UNIT, null)), ['1.1']);
      assert.deepStrictEqual(driver.ready(root, 'other', null), []);
    });

    it('done unblocking (7.S4): a task done frees the task linked after it', () => {
      driver.start(root, ref(1, 1));
      driver.done(root, ref(1, 1));
      assert.deepStrictEqual(shown(driver.ready(root, UNIT, 1)), ['1.2', '1.3']);
    });

    it('links across phases (12.6.4): a later phase\'s task waits on an earlier phase\'s, and is freed once it is done', () => {
      assert.deepStrictEqual(driver.ready(root, UNIT, 2), []);
      driver.done(root, ref(1, 2));
      assert.deepStrictEqual(shown(driver.ready(root, UNIT, 2)), ['2.1']);
      assert.deepStrictEqual(driver.show(root, ref(2, 1)).after, [ref(1, 2)]);
    });

    it('close (7.1.12): closed, not done, its reason kept, freeing what waits on it as done does', () => {
      driver.close(root, ref(1, 1), 'The old ledger already writes it.');
      const closed = driver.show(root, ref(1, 1));
      assert.deepStrictEqual([closed.status, closed.reason], ['closed', 'The old ledger already writes it.']);
      assert.deepStrictEqual(shown(driver.ready(root, UNIT, 1)), ['1.2', '1.3']);
    });

    it('a task closed and replaced (12.5.5): the phase\'s one task closed, another made in it and ready', () => {
      driver.close(root, ref(2, 1), 'Superseded.');
      driver.createTask(root, ref(2, 2), task('Page the ledger'));
      assert.deepStrictEqual(driver.list(root, UNIT, 2)?.map((row) => [`${row.ref.phase}.${row.ref.n}`, row.status]), [['2.1', 'closed'], ['2.2', 'open']]);
      assert.deepStrictEqual(shown(driver.ready(root, UNIT, 2)), ['2.2']);
    });

    for (const [ended, end] of /** @type {const} */ ([
      ['closed', (/** @type {{phase: number, n: number}} */ at) => driver.close(root, ref(at.phase, at.n), 'Not needed.')],
      ['done', (/** @type {{phase: number, n: number}} */ at) => driver.done(root, ref(at.phase, at.n))],
    ])) {
      it(`every task of the unit ${ended} (7.4.1): a task made in a phase written before, then a phase written and its task made, each ready`, () => {
        for (const [phase, n] of [[1, 1], [1, 2], [1, 3], [2, 1]]) end({ phase, n });
        driver.createTask(root, ref(1, 4), task('Page the ledger'));
        driver.createPhase(root, UNIT, 3, 'The export');
        driver.createTask(root, ref(3, 1), task('Export the ledger'));
        assert.deepStrictEqual(shown(driver.ready(root, UNIT, null)), ['1.4', '3.1']);
      });
    }

    /** @param {() => void} make @param {string[]} toReopen */
    const refusedFor = (make, toReopen) => assert.throws(make, (err) => err instanceof Error && err.message === endedInTracker(toReopen, UNIT));

    it('makes nothing under a phase the person cancelled, after a task of it started, nor under the unit the tracker cancelled once they cancelled its last open phase; reopens nothing, and names each to reopen, outermost first', () => {
      const side = require(sideOf(driver.name));
      driver.start(root, ref(1, 1));
      side.byHand(root, 'cancel', UNIT, 1);
      refusedFor(() => driver.createTask(root, ref(1, 4), task('Page the ledger')), [phaseName(UNIT, 1)]);
      side.byHand(root, 'cancel', UNIT, 2);
      for (const [phase, n] of [[1, 4], [2, 2], [1, 4]]) {
        refusedFor(() => driver.createTask(root, ref(phase, n), task('Page the ledger')), [unitName(UNIT), phaseName(UNIT, phase)]);
      }
      assert.throws(() => driver.createTask(root, ref(2, 2), task('Page the ledger')), {
        message: 'unit pay and phase 2 of pay were ended in the tracker — reopen them there, in that order, to go on, or cancel pay in the workflows',
      });
      assert.deepStrictEqual([driver.list(root, UNIT, 1)?.length, driver.ready(root, UNIT, null)], [3, []]);
    });

    it('makes nothing under a unit the person cancelled, the phases the tracker cancelled under it left as they are, naming the unit alone', () => {
      require(sideOf(driver.name)).byHand(root, 'cancel', UNIT);
      for (const make of [
        () => driver.createPhase(root, UNIT, 3, 'The export'),
        () => driver.createTask(root, ref(2, 2), task('Page the ledger')),
      ]) refusedFor(make, [unitName(UNIT)]);
      assert.deepStrictEqual([driver.list(root, UNIT, 2)?.map((row) => row.status), driver.list(root, UNIT, 3), driver.ready(root, UNIT, null)], [['closed'], null, []]);
    });

    it('makes nothing under a phase the person marked done, never reopening it, as the tracker would', () => {
      require(sideOf(driver.name)).byHand(root, 'done', UNIT, 2);
      refusedFor(() => driver.createTask(root, ref(2, 2), task('Page the ledger')), [phaseName(UNIT, 2)]);
      assert.deepStrictEqual(driver.list(root, UNIT, 2)?.map((row) => row.status), ['done']);
    });

    it('reopens a phase the tracker cancelled after the person cancelled and reopened it: the last change is whose the cancel is', () => {
      const side = require(sideOf(driver.name));
      side.byHand(root, 'cancel', UNIT, 2);
      side.byHand(root, 'reopen', UNIT, 2);
      driver.createTask(root, ref(2, 2), task('Page the ledger'));
      driver.close(root, ref(2, 2), 'Superseded.');
      driver.createTask(root, ref(2, 3), task('Print the ledger'));
      assert.deepStrictEqual(driver.list(root, UNIT, 2)?.map((row) => row.status), ['closed', 'closed', 'open']);
    });

    it('reads a folder named like the tool\'s ids in a refusal as the folder it is, never as a task', () => {
      const side = require(sideOf(driver.name));
      const odd = path.join(folder(), side.LOOKALIKE_FOLDER);
      fs.cpSync(root, odd, { recursive: true });
      side.setStoreWritable(odd, false);
      try {
        assert.throws(() => driver.createTask(odd, ref(1, 4), task('Page the ledger')), (err) => err instanceof Error && !err.message.includes(FOREIGN_TASK));
      } finally {
        side.setStoreWritable(odd, true);
      }
    });

    it('refuses a link that would make a cycle, so ready is never stalled by one', () => {
      assert.throws(() => driver.link(root, ref(1, 1), ref(1, 3)));
      assert.deepStrictEqual([shown(driver.ready(root, UNIT, 1)), driver.show(root, ref(1, 1))?.after], [['1.1', '1.2'], []]);
    });

    it('an addition to a task (13.11.3): onto the task after any before it, each as written and whose it is', () => {
      const instruction = { by: 'person', text: 'Keep the ledger\'s file format.' };
      const fact = { by: 'orchestrator', text: 'The reader moved:\n\n- `ledger/read.go` is now `ledger/scan.go`' };
      driver.add(root, ref(1, 2), instruction);
      driver.add(root, ref(1, 2), fact);
      assert.deepStrictEqual(driver.show(root, ref(1, 2)).additions, [instruction, fact]);
    });

    it('a type replaced (21.5.21)', () => {
      driver.setType(root, ref(1, 2), 'fix');
      assert.deepStrictEqual([driver.show(root, ref(1, 2))?.type, driver.show(root, ref(1, 1))?.type], ['fix', 'feat']);
    });

    it('list: a phase\'s tasks in order, each as it stands — a task made among them while one is in progress', () => {
      driver.start(root, ref(1, 1));
      driver.done(root, ref(1, 2));
      driver.close(root, ref(1, 3), 'Not needed.');
      driver.createTask(root, ref(1, 4), task('Page the ledger'));
      assert.deepStrictEqual(driver.list(root, UNIT, 1), [
        { ref: ref(1, 1), title: 'Write the ledger', status: 'in-progress' },
        { ref: ref(1, 2), title: 'Read the ledger', status: 'done' },
        { ref: ref(1, 3), title: 'Fold the ledger', status: 'closed' },
        { ref: ref(1, 4), title: 'Page the ledger', status: 'open' },
      ]);
    });

    it('show: the task whole — its title, type and text as written, where it stands and what it waits on', () => {
      assert.deepStrictEqual(driver.show(root, ref(1, 3)), {
        ref: ref(1, 3), title: 'Fold the ledger', status: 'open', type: 'feat', text: task('Fold the ledger').text, additions: [], after: [ref(1, 1)], reason: null,
      });
    });

    it('show answers no task the tracker lacks, and a task a person made carrying the engine\'s name for it, so the engine makes none twice', () => {
      assert.strictEqual(driver.show(root, ref(1, 4)), null);
      require(sideOf(driver.name)).makeTask(root, 'Made by hand', ref(1, 4));
      assert.strictEqual(driver.show(root, ref(1, 4))?.title, 'Made by hand');
    });

    it('a ref a person gives a task, or a task of their own, leaves the engine\'s tasks as they were; a task carrying two names, or a name two tasks carry, is refused, naming them', () => {
      const side = require(sideOf(driver.name));
      side.addRef(root, 'Read the ledger');
      side.makeTask(root, 'Mine');
      side.makeTask(root, 'Mine too');
      assert.deepStrictEqual(shown(driver.list(root, UNIT, 1)), ['1.1', '1.2', '1.3']);
      assert.deepStrictEqual(shown(driver.ready(root, UNIT, 1)), ['1.1', '1.2']);
      assert.deepStrictEqual(driver.show(root, ref(1, 2))?.title, 'Read the ledger');
      side.makeTask(root, 'Read it twice', ref(1, 2));
      assert.throws(() => driver.list(root, UNIT, 1), /\btask 1\.2 of pay\b/);
      side.addRef(root, 'Write the ledger', ref(1, 3));
      assert.throws(() => driver.show(root, ref(1, 1)), /\btask 1\.1 of pay\b.*\btask 1\.3 of pay\b/);
    });
  });
}
