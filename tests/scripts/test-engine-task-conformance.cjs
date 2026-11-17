'use strict';

// ---------------------------------------------------------------------------
// The task conformance suite (7.3.1–7.3.3, 7.3.5; tests/README.md §10): the
// contract every shipped task driver (domain/drivers.cjs, TaskDriver) meets,
// run against its real tool at or above the floor it declares — a phase;
// links across phases; ready answering several; done unblocking; close, and
// close unblocking; a task closed and replaced, and tasks and a phase made
// after every task of the unit ended, closed or done; a phase removed for
// good and made again as new; an addition to a task;
// a type replaced; list; show; a phase's tasks whole; when a task started;
// every read the same from a copy of the store's files alone, and a root
// with nothing set up yet read as a tracker holding nothing; list and ready
// as the tracker itself answers them, a person's own child and link among
// what holds a task —
// its store made in the state root, never in the project's own a walk up would find, and the
// tasks it names its own, whatever else a person gives them. The driver answers whether a phase or
// task is there, and finds its tools — none, or one that fails — for the
// engine to refuse in its words (test-engine-task-verbs.cjs); what stays
// with the driver is refused here: a store it cannot read, or a line of it,
// a link that would make a cycle, a name carried twice, and a unit or phase the person
// ended in the tracker, cancelled or done — a parent the tracker ended itself
// is reopened. A plan the tracker held from before Ledger adopted phase by
// phase (21.8.8): the engine's names added in the order the tracker made
// its tasks, the unit's on the plan's root where it is free — a root
// another unit's taking none — nothing else of a task changed and nothing
// made or reopened; a task's type its tag of the template's types, its
// other tags kept as it takes one; a run again adding only what the last
// left out; a parent the tracker lacks, a task named apart, a name held
// elsewhere and a task holding all the refs the tracker keeps on one
// refused, adding nothing; ready across every phase of the unit wherever
// its parent sits; and the adoption of phases in turn read, writing
// nothing, as adopt then shows them, each phase's title read from its
// parent, refused as adopt refuses. A plan whose
// unit built nothing closed under its root (21.8.4): each task neither done
// nor closed closed with the reason, the plan given no name of the
// engine's, the build's first phase then written under a parent of its own;
// a run again closing nothing; a root the tracker lacks, and a plan holding
// a task done, refused. 7.S5: the shipped task drivers are exactly one, the default.
// The store merged between two clones (7.5.5–7.5.7): each side's changes
// kept, a field both set differently the person's choice in the engine's
// words, a name both made the remote's, this machine's set aside and named,
// and when a task started carried from the side that started it.
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
const { listDrivers, toolStates, needsRefusal } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');
const { phaseName, unitName, taskName, endedInTracker, FOREIGN_TASK } = require('../../skills/ledger-engine/scripts/domain/task-id.cjs');
const { MergeError } = require('../../skills/ledger-engine/scripts/domain/state-merge-rules.cjs');

const UNIT = 'pay';
const SIDES = path.join(__dirname, '..', 'drivers');

/** A driver's side of the suite. @param {string} name */
const sideOf = (name) => path.join(SIDES, name, 'task.cjs');

/** @param {number} phase @param {number} n */
const ref = (phase, n) => ({ unit: UNIT, phase, n });

/** @param {string} title */
const task = (title) => ({ title, type: 'feat', text: `# ${title}\n\n## Problem\n${title} is missing.` });


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
      for (const { tool, found, state, floor, update } of toolStates(driver)) {
        assert.strictEqual(state, 'fine', `${tool} is ${found ?? 'not installed'} — the ${driver.name} driver needs it at ${floor} or later (${update})`);
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

    it('reads a root where nothing is set up yet as a tracker holding nothing, never refusing, and sets nothing up there', () => {
      const empty = path.join(folder(), 'empty');
      fs.mkdirSync(empty);

      assert.deepStrictEqual([
        driver.list(empty, UNIT, 1), driver.tasks(empty, UNIT, 1), driver.ready(empty, UNIT, 1), driver.ready(empty, UNIT, null),
        driver.show(empty, ref(1, 1)), driver.started(empty, ref(1, 1)), fs.readdirSync(empty),
      ], [null, null, null, [], null, null, []]);
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

    it('removePhase: a phase taken out for good with its tasks, a link to them dropped — read as never written, its number and its tasks\' names made again as new under the unit the tracker ended', () => {
      for (const [phase, n] of [[1, 1], [1, 2], [1, 3], [2, 1]]) driver.close(root, ref(phase, n), 'Moved.');
      driver.removePhase(root, UNIT, 1);
      assert.deepStrictEqual([driver.list(root, UNIT, 1), driver.tasks(root, UNIT, 1), driver.show(root, ref(1, 2)), driver.show(root, ref(2, 1))?.after], [null, null, null, []]);
      driver.createPhase(root, UNIT, 1, 'The ledger again');
      driver.createTask(root, ref(1, 1), task('Write the ledger again'));
      assert.deepStrictEqual(driver.list(root, UNIT, 1), [{ ref: ref(1, 1), title: 'Write the ledger again', status: 'open' }]);
      assert.deepStrictEqual([driver.show(root, ref(1, 1))?.reason, shown(driver.ready(root, UNIT, null))], [null, ['1.1']]);
    });

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
        message: 'unit pay and phase 2 of pay were ended in the tracker — reopen them there, in that order, to go on, or cancel pay in Ledger',
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

    it('tasks: a phase\'s own tasks whole, in order, each as show gives it — one closed with its reason; none for a phase not written', () => {
      driver.close(root, ref(1, 2), 'Not needed.');

      assert.deepStrictEqual([driver.tasks(root, UNIT, 1), driver.tasks(root, UNIT, 2), driver.tasks(root, UNIT, 3)], [
        [ref(1, 1), ref(1, 2), ref(1, 3)].map((each) => driver.show(root, each)),
        [driver.show(root, ref(2, 1))],
        null,
      ]);
    });

    it('started: when a task first moved into progress, kept as it ends; none for a task never started, or one the tracker lacks', () => {
      const before = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      driver.start(root, ref(1, 1));
      const started = driver.started(root, ref(1, 1));
      driver.done(root, ref(1, 1));

      assert.ok(started !== null && started >= before && started <= new Date().toISOString(), String(started));
      assert.deepStrictEqual([driver.started(root, ref(1, 1)), driver.started(root, ref(1, 2)), driver.started(root, ref(1, 4))], [started, null, null]);
    });

    it('reads a copy of its store\'s files alone, in a root of their own, as it reads the state root, setting nothing up there', () => {
      driver.start(root, ref(1, 1));
      driver.done(root, ref(1, 2));
      driver.close(root, ref(1, 3), 'Not needed.');
      driver.createTask(root, ref(2, 2), task('Page the ledger'));
      const copy = path.join(folder(), 'copy');
      for (const file of driver.storeFiles()) fs.cpSync(path.join(root, file), path.join(copy, file));
      /** @param {string} at */
      const reads = (at) => [
        [1, 2, 3].map((phase) => [driver.list(at, UNIT, phase), driver.tasks(at, UNIT, phase)]),
        [1, 2, 3, null].map((phase) => driver.ready(at, UNIT, phase)),
        [ref(1, 1), ref(1, 2), ref(1, 3), ref(1, 4), ref(2, 1), ref(2, 2)].map((each) => [driver.show(at, each), driver.started(at, each)]),
      ];

      assert.deepStrictEqual(reads(copy), reads(root));
      assert.deepStrictEqual(fs.readdirSync(copy, { recursive: true }).map(String).filter((name) => fs.statSync(path.join(copy, name)).isFile()).sort(), [...driver.storeFiles()].sort());
    });

    it('list and ready answer as the tracker itself does: in order, by status, held by a link, freed by a closed blocker or one the store lacks, held by a child of its own open or in progress, and held by its phase\'s link', () => {
      const side = require(sideOf(driver.name));
      driver.createTask(root, ref(2, 2), task('Page the ledger'));
      const steps = [
        () => {},
        () => driver.start(root, ref(1, 1)),
        () => side.childOf(root, 'Check the reading', 'Read the ledger'),
        () => side.startUnderOpen(root, 'Check the reading'),
        () => driver.close(root, ref(1, 1), 'Not needed.'),
        () => driver.done(root, ref(1, 3)),
        () => side.linkAfterGone(root, 'Page the ledger'),
        () => side.phaseAfter(root, UNIT, 2, 'Read the ledger'),
      ];

      const readyEach = steps.map((step, n) => {
        step();
        for (const phase of [1, 2, null]) {
          const own = { list: phase === null ? null : driver.list(root, UNIT, phase), ready: driver.ready(root, UNIT, phase) };
          const tool = side.toolAnswers(root, UNIT, phase);
          assert.deepStrictEqual(own, { list: phase === null ? null : tool.list, ready: tool.ready }, `step ${n}, phase ${phase}`);
        }
        return shown(driver.ready(root, UNIT, null));
      });

      assert.deepStrictEqual(readyEach, [['1.1', '1.2', '2.2'], ['1.2', '2.2'], ['2.2'], ['2.2'], ['1.3', '2.2'], ['2.2'], ['2.2'], []]);
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

    describe('adopt (21.8.8): a plan the tracker held from before Ledger given the engine\'s names, phase by phase', () => {
      const OLD = 'shop';
      const PLAN = [
        { title: 'The basket', tasks: ['Hold the basket', 'Price the basket', 'Empty the basket'] },
        { title: 'The till', tasks: ['Open the till', 'Count the till', 'Close the till'] },
      ];
      /** @param {number} phase @param {number} n */
      const old = (phase, n) => ({ unit: OLD, phase, n });
      const UNBUILT = 'memo';
      const UNBUILT_PLAN = [{ title: 'Memos', tasks: ['Write a memo', 'Pin a memo', 'Drop a memo'] }, { title: 'Sharing', tasks: ['Share a memo'] }];
      /** @type {{root: string, phases: string[]}} */
      let plan;
      /** @type {{root: string, phases: string[]}} */
      let unbuilt;
      /** @type {any} */
      let side;
      const store = () => driver.storeFiles().map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
      const adoptBoth = () => [driver.adopt(root, OLD, 1, plan.phases[0]), driver.adopt(root, OLD, 2, plan.phases[1])];

      /** @type {string} */
      let planned;

      before(() => {
        side = require(sideOf(driver.name));
        planned = templateFolder(`task-conformance-${driver.name}-planned-`);
        fs.cpSync(template, planned, { recursive: true });
        plan = side.oldPlan(planned, OLD, PLAN);
        side.linkBy(planned, 'Count the till', 'Open the till');
        unbuilt = side.oldPlan(planned, UNBUILT, UNBUILT_PLAN);
        for (const [act, title] of [['done', 'Price the basket'], ['done', 'Hold the basket'], ['cancel', 'Empty the basket'], ['start', 'Open the till'], ['cancel', 'Drop a memo'], ['start', 'Pin a memo']]) side.taskByHand(planned, act, title);
      });

      beforeEach(() => {
        fs.rmSync(root, { recursive: true });
        fs.cpSync(planned, root, { recursive: true });
      });

      it('names the parent the phase written and its own tasks the phase\'s, in the order the tracker made them, each as it stood, read as the tracker itself answers', () => {
        assert.deepStrictEqual(adoptBoth(), [[old(1, 1), old(1, 2), old(1, 3)], [old(2, 1), old(2, 2), old(2, 3)]]);
        assert.deepStrictEqual([1, 2].map((phase) => driver.list(root, OLD, phase)?.map((row) => [row.title, row.status])), [
          [['Hold the basket', 'done'], ['Price the basket', 'done'], ['Empty the basket', 'closed']],
          [['Open the till', 'in-progress'], ['Count the till', 'open'], ['Close the till', 'open']],
        ]);
        assert.deepStrictEqual([driver.show(root, old(2, 2))?.after, shown(driver.ready(root, OLD, null))], [[old(2, 1)], ['2.3']]);
        for (const phase of [1, 2, null]) {
          const tool = side.toolAnswers(root, OLD, phase);
          assert.deepStrictEqual({ list: phase === null ? tool.list : driver.list(root, OLD, phase), ready: driver.ready(root, OLD, phase) }, tool, `phase ${phase}`);
        }
      });

      it('reads what adopting the phases in turn would name, writing nothing: each phase\'s tasks as adopt then shows them, the name its old plan carries on its root, and its title as a phase\'s reads', () => {
        const before = store();
        const read = driver.adoption(root, OLD, [{ phase: 1, parent: plan.phases[0] }, { phase: 2, parent: plan.phases[1] }]);
        assert.deepStrictEqual(store(), before);
        adoptBoth();
        assert.deepStrictEqual(read, [1, 2].map((phase) => ({ phase, plan: OLD, title: PLAN[phase - 1].title, tasks: [1, 2, 3].map((n) => driver.show(root, old(phase, n))) })));
      });

      it('reads, writing nothing, each task of another unit held after one adopting the phases would name, whole as it would then show', () => {
        const phases = [{ phase: 1, parent: plan.phases[0] }, { phase: 2, parent: plan.phases[1] }];
        side.linkBy(root, 'Read the ledger', 'Count the till');
        const before = store();
        const read = driver.waitingOn(root, OLD, phases);
        assert.deepStrictEqual(store(), before);
        adoptBoth();
        assert.deepStrictEqual(read, [driver.show(root, ref(1, 2))]);
      });

      it('unlink takes a link off before adoption, each task named as adopting the phases would name it, writing no name', () => {
        const phases = [{ phase: 1, parent: plan.phases[0] }, { phase: 2, parent: plan.phases[1] }];
        const before = side.apartFromNames(root, OLD);
        driver.unlink(root, OLD, phases, old(2, 2), old(2, 1));
        const held = driver.adoption(root, OLD, phases)[1].tasks[1];
        assert.deepStrictEqual([held.title, held.after, driver.show(root, old(2, 2))], ['Count the till', [], null]);
        adoptBoth();
        assert.deepStrictEqual([driver.show(root, old(2, 2))?.after, side.apartFromNames(root, OLD).length], [[], before.length]);
      });

      it('a task\'s type is its tag of the template\'s types — the old plan\'s own tags never read as one — and it takes a type with its other tags kept (21.8.8)', () => {
        adoptBoth();
        const typed = () => [driver.show(root, old(2, 2))?.type, side.tagsOf(root, 'Count the till').toSorted()];
        const before = typed();
        driver.setType(root, old(2, 2), 'fix');
        const fixed = typed();
        driver.setType(root, old(2, 2), 'feat');
        assert.deepStrictEqual([before, fixed, typed()], [[null, ['api', 'planned']], ['fix', ['api', 'fix', 'planned']], ['feat', ['api', 'feat', 'planned']]]);
      });

      it('adds to what each task holds, changing nothing else — its status, its history, its type and the old plan\'s refs — and makes and reopens nothing', () => {
        const before = side.apartFromNames(root, OLD);
        adoptBoth();
        assert.deepStrictEqual(side.apartFromNames(root, OLD), before);
        assert.deepStrictEqual(shown(driver.list(root, UNIT, 1) ?? []), ['1.1', '1.2', '1.3']);
      });

      it('a run again adds only what the last left out: a name added before a kill kept, the rest added, and a run over a whole adoption changing nothing', () => {
        side.addRef(root, 'Price the basket', old(1, 2));
        assert.deepStrictEqual(driver.adopt(root, OLD, 1, plan.phases[0]), [old(1, 1), old(1, 2), old(1, 3)]);
        const once = store();
        assert.deepStrictEqual(driver.adopt(root, OLD, 1, plan.phases[0]), [old(1, 1), old(1, 2), old(1, 3)]);
        assert.deepStrictEqual([store(), driver.list(root, OLD, 1)?.map((row) => row.title)], [once, PLAN[0].tasks]);
      });

      it('names the plan\'s root the unit where the unit has none, so a phase written later is made under it; a second plan\'s root takes none, and ready answers every phase wherever its parent sits', () => {
        const second = side.oldPlan(root, 'shop-extras', [{ title: 'The receipt', tasks: ['Print the receipt'] }]);
        driver.adopt(root, OLD, 1, plan.phases[0]);
        driver.adopt(root, OLD, 2, second.phases[0]);
        assert.strictEqual(driver.createUnit(root, OLD), false);
        driver.createPhase(root, OLD, 3, 'The post');
        driver.createTask(root, old(3, 1), task('Post the receipt'));
        assert.deepStrictEqual(driver.list(root, OLD, 3), side.toolAnswers(root, OLD, 3).list);
        assert.deepStrictEqual(shown(driver.ready(root, OLD, null)), ['2.1', '3.1']);
      });

      it('a plan\'s root another unit\'s already takes no second name: the phase and its tasks are named, the root left as it is', () => {
        driver.adopt(root, 'shop-extras', 1, plan.phases[1]);
        assert.deepStrictEqual(driver.adopt(root, OLD, 1, plan.phases[0]), [old(1, 1), old(1, 2), old(1, 3)]);
        assert.deepStrictEqual([driver.createUnit(root, 'shop-extras'), driver.createUnit(root, OLD)], [false, true]);
      });

      it('refuses, adding nothing, a parent the tracker lacks, a task named apart from the name it would take, a name another task holds, and a task holding all the refs the tracker keeps on one — its read of the adoption refusing alike', () => {
        for (const [setUp, phase, parent, named] of /** @type {const} */ ([
          [() => {}, 1, () => 'no-such-task', [phaseName(OLD, 1)]],
          [() => side.fillRefs(root, 'Close the till'), 2, () => plan.phases[1], [taskName(old(2, 3))]],
          [() => side.addRef(root, 'Count the till', old(1, 5)), 2, () => plan.phases[1], [taskName(old(1, 5)), taskName(old(2, 2))]],
          [() => side.makeTask(root, 'Stray', old(1, 2)), 1, () => plan.phases[0], [taskName(old(1, 2))]],
        ])) {
          setUp();
          const before = store();
          const naming = (/** @type {unknown} */ err) => err instanceof Error && named.every((name) => err.message.includes(name));
          assert.throws(() => driver.adoption(root, OLD, [{ phase, parent: parent() }]), naming, `read: ${named.join(', ')}`);
          assert.throws(() => driver.adopt(root, OLD, phase, parent()), naming, named.join(', '));
          assert.deepStrictEqual(store(), before);
        }
      });

      describe('closePlan (21.8.4): the plan of a unit that built nothing closed under its root', () => {
        const REASON = 'its unit built nothing';

        it('closes each task neither done nor closed with the reason, the parents ended by the tracker, the plan given no name of the engine\'s — so the build\'s first phase is written under a parent of its own, its names the plan\'s none', () => {
          assert.strictEqual(driver.closePlan(root, UNBUILT, unbuilt.root, REASON), 3);
          const closed = ['closed', REASON];
          assert.deepStrictEqual(side.planStanding(root, UNBUILT), { 'Write a memo': closed, 'Pin a memo': closed, 'Drop a memo': ['closed', null], 'Share a memo': closed });
          const memo = (/** @type {number} */ n) => ({ unit: UNBUILT, phase: 1, n });
          assert.deepStrictEqual([driver.list(root, UNBUILT, 1), driver.createUnit(root, UNBUILT)], [null, true]);
          driver.createPhase(root, UNBUILT, 1, 'Memos, afresh');
          driver.createTask(root, memo(1), task('Write a memo afresh'));
          assert.deepStrictEqual(driver.list(root, UNBUILT, 1), side.toolAnswers(root, UNBUILT, 1).list);
          assert.deepStrictEqual(shown(driver.list(root, UNBUILT, 1) ?? []), ['1.1']);
        });

        it('a run again closes nothing and changes nothing', () => {
          driver.closePlan(root, UNBUILT, unbuilt.root, REASON);
          const once = store();
          assert.strictEqual(driver.closePlan(root, UNBUILT, unbuilt.root, REASON), 0);
          assert.deepStrictEqual(store(), once);
        });

        it('refuses, closing nothing, a root the tracker lacks, and a plan holding a task done — the tracker winning, its unit built some of it — naming each done', () => {
          const before = store();
          assert.throws(() => driver.closePlan(root, OLD, 'no-such-task', REASON), (err) => err instanceof Error && err.message.includes('no-such-task') && err.message.includes(unitName(OLD)));
          assert.throws(() => driver.closePlan(root, OLD, plan.root, REASON), (err) => err instanceof Error && ['"Hold the basket"', '"Price the basket"', 'the tracker wins'].every((words) => err.message.includes(words)));
          assert.deepStrictEqual(store(), before);
        });
      });
    });

    describe('the store merged between two clones (7.5, 29.14.9)', () => {
      const [store] = driver.storeFiles();

      /** The template's store copied to a folder of its own. @param {string} name */
      const copied = (name) => {
        const dir = path.join(folder(), name);
        fs.cpSync(template, dir, { recursive: true });
        return dir;
      };

      /** The template's store changed in a folder of its own, as its text. @param {string} name @param {(dir: string) => void} [change] */
      const storeAfter = (name, change = () => {}) => {
        const dir = copied(name);
        change(dir);
        return fs.readFileSync(path.join(dir, store), 'utf8');
      };

      /** A merged store's text in a folder the driver reads. @param {string} text */
      const read = (text) => {
        const dir = copied(`merged-${fs.readdirSync(folder()).length}`);
        fs.writeFileSync(path.join(dir, store), text);
        return dir;
      };

      /** The template's store merged from two sides each changed its own way. @param {(dir: string) => void} here @param {(dir: string) => void} there @param {any} [pickOf] */
      const merged = (here, there, pickOf) => driver.mergeStore(storeAfter('base'), storeAfter('here', here), storeAfter('there', there), pickOf);

      /** @param {any} result @returns {string} the merged text, where it merged with no choice left */
      const clean = (result) => {
        assert.deepStrictEqual(result.conflicts, []);
        return result.text;
      };

      it('takes a task only one side changed from that side, and keeps the tasks each side made', () => {
        const dir = read(clean(merged(
          (here) => {
            driver.done(here, ref(1, 1));
            driver.createTask(here, ref(1, 4), task('Page the ledger'));
          },
          (there) => {
            driver.start(there, ref(1, 2));
            driver.createTask(there, ref(2, 2), task('Print the ledger'));
          },
        )));
        assert.deepStrictEqual(driver.list(dir, UNIT, 1)?.map((row) => [shown([row])[0], row.status]), [['1.1', 'done'], ['1.2', 'in-progress'], ['1.3', 'open'], ['1.4', 'open']]);
        assert.deepStrictEqual(shown(driver.ready(dir, UNIT, null)), ['1.3', '1.4', '2.2']);
      });

      it('merges a task both sides changed field by field: each side\'s additions kept, the remote\'s first, its links unioned, a field one side changed taken from it', () => {
        const instruction = { by: 'person', text: 'Keep the ledger\'s file format.' };
        const fact = { by: 'orchestrator', text: 'The reader moved.' };
        const dir = read(clean(merged(
          (here) => {
            driver.add(here, ref(1, 2), instruction);
            driver.link(here, ref(2, 1), ref(1, 1));
          },
          (there) => {
            driver.add(there, ref(1, 2), fact);
            driver.setType(there, ref(1, 2), 'fix');
            driver.link(there, ref(2, 1), ref(1, 3));
          },
        )));
        const read12 = driver.show(dir, ref(1, 2));
        assert.deepStrictEqual([read12?.additions, read12?.type], [[fact, instruction], 'fix']);
        assert.deepStrictEqual(driver.show(dir, ref(2, 1))?.after.map((after) => shown([{ ref: after }])[0]).sort(), ['1.1', '1.2', '1.3']);
      });

      it('carries when a task started from the side that started it', () => {
        const there = copied('started-there');
        driver.start(there, ref(1, 2));
        const text = clean(driver.mergeStore(storeAfter('base'), storeAfter('here', (here) => driver.add(here, ref(1, 2), { by: 'person', text: 'Mind the ledger.' })), fs.readFileSync(path.join(there, store), 'utf8')));

        assert.strictEqual(driver.started(read(text), ref(1, 2)), driver.started(there, ref(1, 2)));
      });

      it('takes a status both sides set alike, asking nothing', () => {
        const dir = read(clean(merged(
          (here) => {
            driver.add(here, ref(1, 1), { by: 'person', text: 'Done here.' });
            driver.done(here, ref(1, 1));
          },
          (there) => driver.done(there, ref(1, 1)),
        )));
        assert.strictEqual(driver.show(dir, ref(1, 1))?.status, 'done');
      });

      it('leaves a field both sides set differently to the person: the choice in the engine\'s words, labelled by the task\'s name and the field\'s meaning, the pick taken', () => {
        const here = (/** @type {string} */ dir) => {
          driver.done(dir, ref(1, 1));
          driver.setType(dir, ref(1, 2), 'fix');
        };
        const there = (/** @type {string} */ dir) => {
          driver.close(dir, ref(1, 1), 'Not needed.');
          driver.setType(dir, ref(1, 2), 'chore');
        };
        /** @type {any[]} */
        const asked = [];
        const open = merged(here, there, (/** @type {any} */ choice) => {
          asked.push(choice);
          return null;
        });
        assert.ok('conflicts' in open);
        assert.deepStrictEqual(open.conflicts.map(({ field, ...c }) => c), [
          { local: { set: true, value: 'done' }, remote: { set: true, value: 'closed' }, pick: null, label: { subject: taskName(ref(1, 1)), name: taskName(ref(1, 1)), field: 'status' } },
          { local: { set: true, value: 'fix' }, remote: { set: true, value: 'chore' }, pick: null, label: { subject: taskName(ref(1, 2)), name: taskName(ref(1, 2)), field: 'type' } },
        ]);
        assert.deepStrictEqual(asked, open.conflicts.map(({ field, local, remote }) => ({ field, local, remote })));

        const mine = merged(here, there, () => 'local');
        const theirs = merged(here, there, () => 'remote');
        assert.ok('conflicts' in mine && 'conflicts' in theirs);
        assert.deepStrictEqual([mine, theirs].map((result) => result.conflicts.map((c) => c.pick)), [['local', 'local'], ['remote', 'remote']]);
        const [kept, taken] = [mine, theirs].map((result) => read(result.text));
        assert.deepStrictEqual([driver.show(kept, ref(1, 1))?.status, driver.show(kept, ref(1, 2))?.type], ['done', 'fix']);
        assert.deepStrictEqual([driver.show(taken, ref(1, 1))?.status, driver.show(taken, ref(1, 1))?.reason, driver.show(taken, ref(1, 2))?.type], ['closed', 'Not needed.', 'chore']);
      });

      it('keeps the remote\'s phase or task where both made one under a name, setting aside this machine\'s with all it holds and every link to it, the rest merged; the notice names them, and what to make again by phase: one set aside by its title, one kept by its number', () => {
        const result = merged(
          (here) => {
            driver.done(here, ref(1, 1));
            driver.createTask(here, ref(2, 2), task('Page the ledger'));
            driver.createTask(here, ref(2, 3), task('Sort the ledger'));
            driver.link(here, ref(2, 3), ref(2, 2));
            driver.createPhase(here, UNIT, 3, 'The export');
            driver.createTask(here, ref(3, 1), task('Export the ledger'));
          },
          (there) => {
            driver.createTask(there, ref(2, 2), task('Print the ledger'));
            driver.createPhase(there, UNIT, 3, 'The archive');
          },
        );
        assert.deepStrictEqual(result.conflicts, [{
          madeTwice: [{ kind: 'task', said: taskName(ref(2, 2)) }, { kind: 'phase', said: phaseName(UNIT, 3) }],
          again: [{ phase: 'The screen', kept: 2, tasks: ['Page the ledger'] }, { phase: 'The export', kept: null, tasks: ['Export the ledger'] }],
        }]);
        const dir = read(result.text);
        assert.strictEqual(driver.show(dir, ref(1, 1))?.status, 'done');
        assert.deepStrictEqual(driver.list(dir, UNIT, 2)?.map((row) => row.title), ['Show the ledger', 'Print the ledger', 'Sort the ledger']);
        assert.deepStrictEqual([driver.show(dir, ref(2, 3))?.after, driver.list(dir, UNIT, 3)], [[], []]);
      });

      it('refuses a side\'s copy it cannot read, naming the side and the line', () => {
        const side = require(sideOf(driver.name));
        let line = 0;
        const garbled = storeAfter('here', (dir) => {
          line = side.garbleStore(dir);
        });
        assert.throws(() => driver.mergeStore(storeAfter('base'), garbled, storeAfter('there')), (err) => err instanceof MergeError
          && err.message.includes('this machine\'s') && new RegExp(`\\bline ${line}\\b`).test(err.message));
      });
    });
  });
}
