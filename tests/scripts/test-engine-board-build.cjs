'use strict';

// ---------------------------------------------------------------------------
// `engine board`'s build (leeway-engine/scripts/domain/projections/
// board-build.cjs, 20.5): This session following the session into its
// build, its progress, phases, tasks and their states — a task building,
// in review, failed, waiting on a question, at its gate or behind the one
// in flight — when the build stops and when it goes on, the questions a
// press can queue, and that reading the tracker writes nothing and never
// waits on the writer lock. The board's frame is test-engine-board.cjs, a
// task's pages test-engine-board-pages.cjs.
//
// Layer: verb. World: the build screens' world (build-screens-world.cjs),
// copied for each test — `pay` building in step, task 1.1 in progress with
// its account taken, 1.2 with its account, 1.3 after 1.2, phase 2 written,
// phase 3 not yet written — its conversations' records in a config folder
// of the test's own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, treeSnapshot, head, git, cleanupFixture, withEnv, readManifest, layout, holdLock, lockAttempts, statePath,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION_ID, QUESTIONS, taskText, buildScreensWorld, buildScreenHelpers, boardHelpers, line } = require('./build-screens-world.cjs');
const { standingOn, place } = require('./board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BOARD_VERSION } = require(path.join(SCRIPTS, 'domain/board-model.cjs'));
const { storeBrief } = require(path.join(SCRIPTS, 'domain/brief.cjs'));

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-board-build-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, parkOn, raisedOutside, phaseOneDone, position } = buildScreenHelpers(() => dir, () => config);
const { board, enterBuild, issued, project } = boardHelpers(() => dir, () => config);

/** The world's phases as the build lists them, task 1.1 as given. @param {object} first */
const phasesWith = (first) => [
  {
    phase: 1,
    name: 'Cards',
    state: 'running',
    done: 0,
    total: 3,
    tasks: [first, line('1.2', 'Show a receipt', 'not-started'), line('1.3', 'Mail the receipt', 'after', { on: ['1.2'] })],
  },
  { phase: 2, name: 'Refunds', state: 'written', done: 0, total: 1, tasks: [line('2.1', 'Refund a card', 'not-started')] },
  { phase: 3, name: 'Reports', state: 'not-written', done: 0, total: 0, tasks: [] },
];

describe('the build on the board (20.5)', () => {
  it('This session follows the session into its build: the unit\'s tab named, each phase of the cut with its tasks and their states — in step, a task at its gate, not running — and the banner\'s facts (20.3.4, 20.5.1, 20.5.2)', () => {
    enterBuild();

    assert.deepStrictEqual(board(), {
      version: BOARD_VERSION,
      place: { unit: UNIT, type: 'feature', phase: 'implementation', topic: UNIT },
      banner: { name: 'Pay', state: 'running', facts: [place('feature'), place('build')] },
      unit: { unit: UNIT, title: 'Pay' },
      tab: 'this',
      view: {
        kind: 'build',
        unit: UNIT,
        title: 'Pay',
        type: 'feature',
        progress: { done: 0, total: 4, phase: 1, phases: 3, running: 0, stopped: false },
        waiting: [],
        phases: phasesWith(line('1.1', 'Take a card', 'at-gate')),
      },
      beneath: null,
      questions: [],
      warnings: [],
    });
  });

  it('20.S10: This session follows the session from its specification into its build, the yes at ready to build entering it (20.3.4)', () => {
    ok(dir, ['session', 'label', UNIT, 'specification', UNIT], { env: env() });
    const inSpec = board();
    enterBuild();
    const inBuild = board();

    assert.deepStrictEqual([[inSpec.place.phase, inSpec.view.kind], [inBuild.place.phase, inBuild.view.kind]], [['specification', 'spec'], ['implementation', 'build']]);
  });

  it('a task in progress builds, or is in review, by the last brief this conversation issued for it, since it was issued — the builder\'s and a fix round\'s building, a reviewer\'s in review (P15)', () => {
    enterBuild();
    fs.rmSync(path.join(dir, '.leeway', UNIT, 'build/tasks/1.1/figures.json'));
    const states = [];
    for (const [role, at] of [['builder', '2026-10-21T10:00:00.000Z'], ['reviewer', '2026-10-21T10:20:00.000Z'], ['fix', '2026-10-21T10:40:00.000Z']]) {
      issued(role, '1.1', at);
      states.push(board().view.phases[0].tasks[0]);
    }

    assert.deepStrictEqual(states, [
      line('1.1', 'Take a card', 'building', { since: '2026-10-21T10:00:00.000Z' }),
      line('1.1', 'Take a card', 'in-review', { since: '2026-10-21T10:20:00.000Z' }),
      line('1.1', 'Take a card', 'building', { since: '2026-10-21T10:40:00.000Z' }),
    ]);
  });

  it('its clock ends once task account takes its account, in auto, where no gate stops it (P15)', () => {
    enterBuild();
    position('auto');
    issued('reviewer', '1.1', '2026-10-21T10:20:00.000Z');

    assert.deepStrictEqual(board().view.phases[0].tasks[0], line('1.1', 'Take a card', 'in-review'));
  });

  it('20.4.9, P5: a task in progress whose builder stopped has failed, unclocked, its stop among the unit\'s moments; a task a question parks waits, whatever its builder did', async () => {
    enterBuild();
    position('auto');
    issued('builder', '1.1', '2026-10-21T10:00:00.000Z');
    const { stopped } = ok(dir, ['task', 'stopped', UNIT, '1.1'], { env: env() });
    const failed = { task: board().view.phases[0].tasks[0], moment: board(['--tab', 'unit']).view.lately.find(({ kind }) => kind === 'task-failed') };
    await parkOn(['1.1']);

    assert.deepStrictEqual([failed, board().view.phases[0].tasks[0].state], [
      { task: line('1.1', 'Take a card', 'failed'), moment: { kind: 'task-failed', at: stopped, topic: null, detail: '1.1' } },
      'waits',
    ]);
  });

  it('a brief the conversation issued for another unit\'s task of the same number never clocks this one (P15)', () => {
    enterBuild();
    fs.rmSync(path.join(dir, '.leeway', UNIT, 'build/tasks/1.1/figures.json'));
    issued('builder', '1.1', '2026-10-21T10:00:00.000Z');
    withEnv({ LEEWAY_CONFIG_DIR: config }, () => {
      storeBrief(SESSION_ID, 'elsewhere', 'a brief', { role: 'reviewer', agent: 'leeway-reviewer', unit: 'shop', task: '1.1', topic: null });
    });

    assert.strictEqual(board().view.phases[0].tasks[0].state, 'building');
  });

  it('a question parks its task: the task waits on it, the question lists what it parks and the tasks after those, and the banner counts it waiting on the person (20.5.3, 20.2.4); S1: every view that reads the unit stands it so — its tab building, the question waiting there opening the task it parks, All work counting it', async () => {
    enterBuild();
    await parkOn(['1.2']);
    const { view, questions, banner } = board();
    const [{ since, ...question }] = questions;
    const standing = standingOn(board, UNIT);
    const parked = board(['--page', standing.tab.waiting[0].split(' → ')[1]]).view;

    assert.deepStrictEqual({ ...standing, tab: { ...standing.tab, waiting: standing.tab.waiting.map((line) => line.split(' → ')[0]) }, parked: [parked.kind, parked.line.task] }, {
      tab: { now: 'build', state: 'running', words: '0 of 4 tasks done', waiting: ['question Q1'] },
      all: { phase: 'build', standing: '0 of 4 tasks done', waiting: 1, total: 1 },
      banner: { state: 'running', waits: ['⚑ 1 waiting on you'] },
      parked: ['task', '1.2'],
    });

    assert.deepStrictEqual(
      { tasks: view.phases[0].tasks.slice(1), waiting: view.waiting, question, banner: banner.facts.at(-1) },
      {
        tasks: [line('1.2', 'Show a receipt', 'waits', { on: ['Q1'] }), line('1.3', 'Mail the receipt', 'after', { on: ['1.2'] })],
        waiting: ['Q1'],
        question: { question: 'Q1', asks: QUESTIONS[0], parks: [{ task: '1.2', title: 'Show a receipt' }], after: ['1.3'] },
        banner: { text: '1 waiting on you', needs: true },
      },
    );
    assert.ok(!Number.isNaN(Date.parse(since)), since);
  });

  it('the build stops once every task waits on the person: the progress says so, and the banner says it after the type and the phase, plain, the waiting count flagged (20.2.4, 20.5.1, 20.S27, D6, D20); S1: every view that reads the unit stands it so — the tab\'s build stopped, its question waiting there, All work\'s row stopped and counting it', async () => {
    enterBuild();
    await parkOn(['1.1', '1.2', '2.1']);
    const { view, banner } = board();
    const { tab, all } = standingOn(board, UNIT);

    assert.deepStrictEqual({ stopped: view.progress.stopped, running: view.progress.running, banner, tab: { ...tab, waiting: tab.waiting.map((line) => line.split(' → ')[0]) }, all }, {
      stopped: true,
      running: 0,
      banner: { name: 'Pay', state: 'needs', facts: [place('feature'), place('build'), place('stopped'), { text: '1 waiting on you', needs: true }] },
      tab: { now: 'build', state: 'stopped', words: '0 of 4 tasks done', waiting: ['question Q1'] },
      all: { phase: 'build', standing: 'stopped · 0 of 4 tasks done', waiting: 1, total: 1 },
    });
  });

  it('stops where the only task ready is of a phase whose start the engine holds — Refunds relying on Cards — and goes on once only Claude\'s own items stand before that start, as the stop report does (20.5.1, 12.13.22)', async () => {
    enterBuild();
    await parkOn(['1.1', '1.2']);
    const held = board().view.progress.stopped;
    const manifest = readManifest(dir, UNIT);
    manifest.cut.phases[1].relies_on = [];
    createManifest(dir, UNIT, manifest);

    assert.deepStrictEqual([held, board().view.progress.stopped], [true, false]);
  });

  it('goes on, never stopped, while a question parking no task waits and every task of a phase not closed is done: the phase\'s close goes on, as the stop report says (20.5.1, 20.S27, 12.13.22)', async () => {
    enterBuild();
    await raisedOutside();
    phaseOneDone();
    const { view, banner } = board();
    const { tab, all } = standingOn(board, UNIT);

    assert.deepStrictEqual([view.progress.stopped, banner.facts.map(({ text }) => text), tab.state, all.standing], [false, ['feature', 'build', '1 waiting on you'], 'running', '3 of 4 tasks done']);
  });

  it('goes on while a task no question parks is in progress, or one is ready in an open phase (20.5.1, 12.13.22)', async () => {
    enterBuild();
    await parkOn(['1.2']);
    const running = board().view.progress.stopped;
    await parkOn(['1.1'], 1);
    const held = board().view.progress.stopped;
    fs.writeFileSync(path.join(config, 'task.md'), taskText('Void a charge', ['A void charge prints nothing.']));
    ok(dir, ['task', 'create', UNIT, '1', '--file', path.join(config, 'task.md')], { env: env() });

    assert.deepStrictEqual([running, held, board().view.progress.stopped], [false, true, false]);
  });

  it('a phase whose every task not closed is done is complete, its tasks done; one with a task still to do runs; and with nothing running, nothing ready in an open phase and no question waiting, the build has not stopped (20.4.9, 20.4.7, 20.5.1)', () => {
    enterBuild();
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    const phase = () => {
      const { phases: [{ state, done, total, tasks }], progress: { stopped } } = board().view;
      return { state, done, total, tasks: tasks.map((task) => task.state), stopped };
    };
    const running = phase();
    for (const task of ['1.2', '1.3']) ok(dir, ['task', 'close', UNIT, task, '--reason', 'not needed'], { env: env() });

    assert.deepStrictEqual([running, phase()], [
      { state: 'running', done: 1, total: 3, tasks: ['done', 'not-started', 'after'], stopped: false },
      { state: 'complete', done: 1, total: 1, tasks: ['done', 'closed', 'closed'], stopped: false },
    ]);
  });

  it('reading the tracker writes nothing: the build\'s view and a task\'s pages leave the state, its branch and the project\'s HEAD as they were', async () => {
    enterBuild();
    await parkOn(['1.2']);
    const standing = () => ({ tree: treeSnapshot(dir), state: head(dir), project: git(dir, ['rev-parse', 'HEAD']).trim() });
    const before = standing();
    for (const page of [[], ['--page', 'task:1.1'], ['--page', 'task:1.2:written'], ['--tab', 'unit']]) board(page);

    assert.deepStrictEqual(standing(), before);
  });

  it('is drawn while a peer holds the writer lock, never trying it — the stop asked of a phase\'s start among it — so it neither waits behind that writer nor holds it up', async (t) => {
    enterBuild();
    await parkOn(['1.1', '1.2']);
    const lock = holdLock(statePath(dir, layout.lock));
    const attempts = lockAttempts(t, lock, () => { throw new Error('the board waited on the writer lock'); });
    const drawn = [[], ['--tab', 'unit'], ['--tab', 'all'], ['--page', 'task:1.1']].map((args) => board(args).view);

    assert.deepStrictEqual([drawn.map((view) => [view.kind, view.progress?.stopped ?? null]), attempts], [[['build', true], ['unit', null], ['all', null], ['task', null]], []]);
  });

  it('draws, in step, a task at its gate and one behind the task in flight, naming it, while a peer holds the writer lock, never trying it, neither running nor in the banner — their phase holding no task not started (12.7.9)', (t) => {
    enterBuild();
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Not needed.'], { env: env() });
    position('step');
    const lock = holdLock(statePath(dir, layout.lock));
    const attempts = lockAttempts(t, lock, () => { throw new Error('the board waited on the writer lock'); });
    const { view, banner } = board();

    assert.deepStrictEqual([view.phases[0].tasks.slice(0, 2), view.progress.running, banner.facts.map(({ text }) => text), attempts], [
      [line('1.1', 'Take a card', 'at-gate'), line('1.2', 'Show a receipt', 'behind', { on: ['1.1'] })], 0, ['feature', 'build'], [],
    ]);
  });

  it('in step, holds no task behind one a question parks: the parked one waits, the other stands at its own gate (12.7.9)', async () => {
    enterBuild();
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    position('step');
    await parkOn(['1.1']);

    assert.deepStrictEqual(board().view.phases[0].tasks.slice(0, 2).map(({ state }) => state), ['waits', 'at-gate']);
  });
});
