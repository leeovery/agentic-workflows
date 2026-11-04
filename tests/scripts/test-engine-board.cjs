'use strict';

// ---------------------------------------------------------------------------
// `engine board` (leeway-engine/scripts/domain/board.cjs, its model
// domain/board-model.cjs): the board's frame — following the session, the
// tabs, the banner, the pages, the version and the fixture the mod reads,
// that it writes nothing — and the build on it (domain/projections/
// board-build.cjs): its progress, phases, tasks and their states, the
// questions a press can queue, and a task's pages. The review phase on the
// board is test-engine-board-review.cjs; every other view,
// test-engine-board-views.cjs.
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
  ok, refusedPristine, treeSnapshot, head, git, cleanupFixture, withEnv, readState, writeState, readManifest, layout, holdLock, lockAttempts, statePath,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, QUESTIONS, taskText, buildScreensWorld, buildScreenHelpers } = require('./build-screens-world.cjs');
const { fixture, misfits, shapeOf } = require('./board-fixture-shape.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BOARD_VERSION } = require(path.join(SCRIPTS, 'domain/board-model.cjs'));
const { storeBrief } = require(path.join(SCRIPTS, 'domain/brief.cjs'));
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { titlecase } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-board-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, parkOn, position } = buildScreenHelpers(() => dir, () => config);

/** The conversation the board is drawn for. */
const SESSION = 'sess-1';

/** The board's answer, its `ok` dropped. @param {string[]} [args] */
function board(args = []) {
  const { ok: _ok, ...answer } = ok(dir, ['board', SESSION, ...args], { env: env() });
  return answer;
}

/** The board's refusal, nothing written. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['board', ...args], { env: env() }).error;

/** The conversation entered into the unit's build. */
const enterBuild = () => ok(dir, ['enter', 'implementation', UNIT], { env: env() });

/** The unit's spec: its first scenario parted at its "then", its second. */
const SPEC = [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The card', '', '1.1.1 A card shows its last four digits.', '', '### 1.2 The receipt', '', '1.2.1 A charge prints its receipt.', '',
  '## 1-S. Scenarios for §1', '',
  '1.S1 Given a till, when a card is taken, then it shows the card\'s last four digits. (1.1.1)', '',
  '1.S2 Given a charge, when it lands, then a receipt prints. (1.2.1)', '',
].join('\n');

/** The project's name, as All work and the banner say it. */
const project = () => titlecase(path.basename(dir));

/**
 * A brief the conversation issued for a task, by its role, at `at`.
 * @param {string} role @param {string} task @param {string} at @param {string} [id]
 */
function issued(role, task, at, id = `${role}${task.replace('.', '')}${Date.parse(at)}`) {
  withEnv({ LEEWAY_CONFIG_DIR: config }, () => {
    storeBrief(SESSION, id, 'a brief', { role, agent: 'leeway-builder', unit: UNIT, task, topic: null });
    const when = new Date(at);
    fs.utimesSync(issuedPath(SESSION, id), when, when);
  });
}

/** A task's line, as the build lists it. @param {string} task @param {string} title @param {string} state @param {{since?: string|null, on?: string[]}} [more] */
const line = (task, title, state, { since = null, on = [] } = {}) => ({ task, title, state, since, on });

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

describe('the board at the start menu (20.3.3, 20.16)', () => {
  it('shows All work with the project\'s units, no unit\'s tab, and a banner naming the project at the start menu', () => {
    assert.deepStrictEqual(board(), {
      version: BOARD_VERSION,
      place: { unit: null, type: null, phase: null, topic: null },
      banner: { name: project(), state: 'idle', facts: [{ text: 'at the start menu', needs: false }] },
      unit: null,
      tab: 'this',
      view: {
        kind: 'all',
        project: project(),
        at_start: true,
        waiting: 0,
        units: [{ unit: UNIT, title: 'Pay', type: 'feature', phase: 'build', standing: '', waiting: 0, session: null }],
        roadmap: [],
        inbox: [],
        complete: [],
      },
      beneath: null,
      questions: [],
      warnings: [],
    });
  });

  it('writes nothing: the state, its branch and the conversation\'s folder stand as they were, the conversation unmarked', () => {
    enterBuild();
    const before = { tree: treeSnapshot(dir), head: head(dir) };
    ok(dir, ['board', 'other-conversation'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'other-conversation' } });

    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir), folder: fs.existsSync(path.join(config, 'conversations', 'other-conversation')) }, { ...before, folder: false });
  });

  it('a unit\'s page opened from All work at the start menu stays once the session enters a unit, and a page over it goes back to it (20.3.6, 20.3.5)', () => {
    const page = ['--page', `unit:${UNIT}`, '--page-unit', UNIT];
    const atStart = board(page);
    enterBuild();
    const inBuild = board(page);
    const over = board(['--page', 'task:1.2', '--page-unit', UNIT]);

    assert.deepStrictEqual(
      [[atStart.view.kind, atStart.view.unit, atStart.beneath.kind], [inBuild.view.kind, inBuild.view.unit, inBuild.beneath.kind], [over.view.kind, over.view.unit]],
      [['unit', UNIT, 'all'], ['unit', UNIT, 'build'], ['task', UNIT]],
    );
  });

  it('home is never refused: a session whose unit has left the project reads All work, the banner the project\'s', () => {
    enterBuild();
    fs.rmSync(path.join(dir, '.leeway', UNIT), { recursive: true, force: true });
    const { place, banner, view } = board();

    assert.deepStrictEqual([place.unit, banner.name, view.kind], [null, project(), 'all']);
  });
});

describe('the build on the board (20.5)', () => {
  it('This session follows the session into its build: the unit\'s tab named, each phase of the cut with its tasks and their states — in step, a task at its gate, not running — and the banner\'s facts (20.3.4, 20.5.1, 20.5.2)', () => {
    enterBuild();

    assert.deepStrictEqual(board(), {
      version: BOARD_VERSION,
      place: { unit: UNIT, type: 'feature', phase: 'implementation', topic: UNIT },
      banner: { name: 'Pay', state: 'running', facts: [{ text: 'feature', needs: false }, { text: 'build', needs: false }] },
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
      storeBrief(SESSION, 'elsewhere', 'a brief', { role: 'reviewer', agent: 'leeway-reviewer', unit: 'shop', task: '1.1', topic: null });
    });

    assert.strictEqual(board().view.phases[0].tasks[0].state, 'building');
  });

  it('a question parks its task: the task waits on it, the question lists what it parks and the tasks after those, and the banner counts it waiting on the person (20.5.3, 20.2.4)', async () => {
    enterBuild();
    await parkOn(['1.2']);
    const { view, questions, banner } = board();
    const [{ since, ...question }] = questions;

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

  it('the build stops once every task waits on the person: the progress says so, and the banner says it after the type and the phase, plain, the waiting count flagged (20.2.4, 20.5.1, 20.S27, D6, D20)', async () => {
    enterBuild();
    await parkOn(['1.1', '1.2', '2.1']);
    const { view, banner } = board();

    assert.deepStrictEqual({ stopped: view.progress.stopped, running: view.progress.running, banner }, {
      stopped: true,
      running: 0,
      banner: { name: 'Pay', state: 'needs', facts: [{ text: 'feature', needs: false }, { text: 'build', needs: false }, { text: 'stopped', needs: false }, { text: '1 waiting on you', needs: true }] },
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

describe('a task\'s pages (20.5.4–20.5.7)', () => {
  it('a task with its account: what it does, what was done with the engine\'s figures, what differs, each round\'s summary, the calls it made and what running the product proved', () => {
    enterBuild();
    const figures = JSON.parse(readState(dir, layout.unit(UNIT, 'build/tasks/1.1/figures.json')));

    assert.deepStrictEqual(board(['--page', 'task:1.1']).view, {
      kind: 'task',
      unit: UNIT,
      phase: 1,
      phase_name: 'Cards',
      line: line('1.1', 'Take a card', 'at-gate'),
      started: figures.started,
      finished: figures.finished,
      does: 'Take a card works at the till, and the customer sees it.',
      criteria: 2,
      account: {
        done: 'A card is taken at the till, and the receipt line names its last four digits.',
        where: 'The till and the card.\n\n- src/card.js: the card taken and masked\n- src/till.js: the till asks for the card',
        tests: 'Two tests take a card and read its masked digits back.\n\n```text\ntill ──▶ card ──▶ receipt\n```',
        differences: ['The till also beeps once the card is taken, which the task did not ask for.'],
        figures: { files: 2, added: 3, removed: 0, criteria: 2 },
      },
      reviews: [{ round: 'Round 1', summary: 'The digits were shown whole; the builder masked them.' }, { round: 'Round 2', summary: 'Passed.' }],
      calls: [{ id: board(['--page', 'task:1.1']).view.calls[0].id, text: 'The till masks the digits' }],
      ran: [{ scenario: '1.S1', criterion: 'A card is taken at the till.', standing: 'proven' }],
      question: null,
      fixes: [],
    });
  });

  it('a scenario opens on the run that decides it: what it proved and when, what it drives and checks by the spec\'s words parted at their "then", and each text evidence kept with it, read whole (15.2.14, D16)', () => {
    enterBuild();
    writeState(dir, layout.unit(UNIT, 'spec.md'), SPEC);
    const run = layout.unit(UNIT, 'build/runs/1.S1/run-001.json');
    writeState(dir, run, JSON.stringify({ ...JSON.parse(readState(dir, run)), evidence: [{ name: 'till screen', text: 'CARD ****4242\nTAKEN\n' }] }));

    assert.deepStrictEqual([board(['--page', 'task:1.1:scenario:1.S1']).view, board(['--page', 'task:1.1:scenario:1.S1:evidence:1']).view], [
      {
        kind: 'scenario',
        unit: UNIT,
        task: '1.1',
        title: 'Take a card',
        scenario: '1.S1',
        criterion: 'A card is taken at the till.',
        standing: 'proven',
        at: JSON.parse(readState(dir, run)).at,
        drive: 'Given a till, when a card is taken',
        check: 'it shows the card\'s last four digits. (1.1.1)',
        evidence: [{ name: 'till screen', lines: 2 }],
      },
      { kind: 'evidence', unit: UNIT, task: '1.1', scenario: '1.S1', name: 'till screen', text: 'CARD ****4242\nTAKEN\n' },
    ]);
  });

  it('a scenario no run proved opens not proven, no run deciding it, its words whole where no "then" parts them; one the task does not hold, and an evidence its run does not keep, unavailable, saying why', () => {
    enterBuild();
    writeState(dir, layout.unit(UNIT, 'spec.md'), SPEC.replace('1.S2 Given a charge, when it lands, then a receipt prints.', '1.S2 A charge prints its receipt.'));
    const unproven = board(['--page', 'task:1.2:scenario:1.S2']).view;

    assert.deepStrictEqual(
      [{ standing: unproven.standing, at: unproven.at, drive: unproven.drive, check: unproven.check, evidence: unproven.evidence }, board(['--page', 'task:1.2:scenario:1.S1']).view, board(['--page', 'task:1.1:scenario:1.S1:evidence:1']).view],
      [
        { standing: 'not proven', at: null, drive: 'A charge prints its receipt. (1.2.1)', check: null, evidence: [] },
        { kind: 'unavailable', reason: 'task 1.2 of pay holds no scenario 1.S1' },
        { kind: 'unavailable', reason: 'no run of 1.S1 keeps an evidence 1' },
      ],
    );
  });

  it('a fix task lists each finding of the review that went to it (D17)', () => {
    enterBuild();
    writeState(dir, layout.unit(UNIT, 'review/round-1.json'), JSON.stringify({
      reports: [], passed: false, can_now: [], settled: null, scenarios: [],
      findings: [
        { area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt is never sent.', from: [], fix: '1.2' },
        { area: '1-cards', scope: 'in', call: 'bug', text: 'The digits show whole.', from: [], fix: '1.1' },
        { area: 'tests', scope: 'in', call: 'bug', text: 'No test sends a receipt.', from: [], fix: '1.2' },
      ],
    }));

    assert.deepStrictEqual(board(['--page', 'task:1.2']).view.fixes, [
      { round: 1, finding: 1, area: '1-cards', text: 'The receipt is never sent.' },
      { round: 1, finding: 3, area: 'tests', text: 'No test sends a receipt.' },
    ]);
  });

  it('a task with no account, parked: none, nothing reviewed or called, never started, and the question it waits on with its line (20.5.6)', async () => {
    enterBuild();
    await parkOn(['1.3']);
    const { view } = board(['--page', 'task:1.3']);

    assert.deepStrictEqual(
      { line: view.line, started: view.started, finished: view.finished, account: view.account, reviews: view.reviews, calls: view.calls, ran: view.ran, question: view.question },
      { line: line('1.3', 'Mail the receipt', 'waits', { on: ['Q1'] }), started: null, finished: null, account: null, reviews: [], calls: [], ran: null, question: 'Q1' },
    );
  });

  it('the task as written, each section by its heading; a round of its review, each reviewer\'s report whole', () => {
    enterBuild();
    const written = board(['--page', 'task:1.2:written']).view;
    const round = board(['--page', 'task:1.1:round:2']).view;

    assert.deepStrictEqual({ written: written.sections.map(({ heading }) => heading), outcome: written.sections[3], round: round.reports.map(({ letter }) => letter) }, {
      written: ['Type', 'Problem', 'Solution', 'Outcome', 'Acceptance scenarios', 'Spec reference'],
      outcome: { heading: 'Outcome', text: 'Show a receipt works at the till, and the customer sees it.' },
      round: ['a', 'b'],
    });
    assert.match(round.reports[1].text, /^## Findings\n\n- nit: A name\./);
  });

  it('a call read in full: whose it is, its words, why, and the question it answers', () => {
    enterBuild();
    const [{ id }] = board(['--page', 'task:1.1']).view.calls;

    assert.deepStrictEqual(board(['--page', `entry:${id}`]).view, {
      kind: 'entry', unit: UNIT, id, entry: 'decision', by: 'claude', text: 'The till masks the digits', why: 'The till needs it.', question: 'What of The till masks the digits?',
    });
  });

  it('a page stays while the session moves beneath it: a task\'s page is read at the unit\'s menu as in its build (20.3.5, 20.S8)', () => {
    enterBuild();
    const inBuild = board(['--page', 'task:1.2']);
    ok(dir, ['session', 'label', UNIT], { env: env() });
    const atMenu = board(['--page', 'task:1.2']);

    assert.deepStrictEqual({ view: atMenu.view, place: atMenu.place }, { view: { ...inBuild.view, line: line('1.2', 'Show a receipt', 'not-started') }, place: { unit: UNIT, type: 'feature', phase: null, topic: null } });
  });

  it('a page is read against the unit it was opened in, from the start menu and from another unit; the banner, the unit\'s tab and what lies beneath it are the session\'s (20.3.5)', () => {
    enterBuild();
    const page = ['--page', 'task:1.2', '--page-unit', UNIT];
    const opened = board(page);
    fs.rmSync(path.join(config, 'conversations', SESSION, 'position.json'));
    const atStart = board(page);
    createManifest(dir, 'till', {});
    ok(dir, ['session', 'label', 'till'], { env: env() });
    const inTill = board(page);
    const seen = (/** @type {any} */ answer) => ({ page: [answer.view.kind, answer.view.unit, answer.view.line.task], banner: answer.banner.name, unit: answer.unit, beneath: [answer.beneath.kind, answer.beneath.unit] });

    assert.deepStrictEqual([opened, atStart, inTill].map(seen), [
      { page: ['task', UNIT, '1.2'], banner: 'Pay', unit: { unit: UNIT, title: 'Pay' }, beneath: ['build', UNIT] },
      { page: ['task', UNIT, '1.2'], banner: project(), unit: null, beneath: ['all', undefined] },
      { page: ['task', UNIT, '1.2'], banner: 'Till', unit: { unit: 'till', title: 'Till' }, beneath: ['unit', 'till'] },
    ]);
  });

  it('--unit names the unit\'s tab alone: a page on This session is the session\'s unit\'s, the tab\'s unit standing as named', () => {
    createManifest(dir, 'till', {});
    ok(dir, ['session', 'label', 'till'], { env: env() });
    const answer = board(['--unit', UNIT, '--page', 'task:1.2']);

    assert.deepStrictEqual([answer.view, answer.unit], [{ kind: 'unavailable', reason: 'till\'s build has not begun' }, { unit: UNIT, title: 'Pay' }]);
  });

  it('a page that cannot be drawn answers unavailable in its tab, saying why, the banner and the questions standing beside it', async () => {
    enterBuild();
    await parkOn(['1.2']);
    const { view, banner, questions } = board(['--tab', 'unit', '--unit', UNIT, '--page', 'task:9.9']);

    assert.deepStrictEqual({ view, banner: banner.facts.at(-1), questions: questions.map(({ question }) => question) }, {
      view: { kind: 'unavailable', reason: 'task 9.9 of pay is not in the tracker' },
      banner: { text: '1 waiting on you', needs: true },
      questions: ['Q1'],
    });
  });
});

describe('the tabs (20.3)', () => {
  it('the unit\'s tab shows the unit\'s page: each phase from discovery to review with what its records hold, what waits on the person, and what happened lately, newest first (20.15.1)', async () => {
    enterBuild();
    await parkOn(['1.2']);
    const { view } = board(['--tab', 'unit']);

    assert.deepStrictEqual({ ...view, lately: view.lately.map(({ kind, detail }) => [kind, detail]) }, {
      kind: 'unit',
      unit: UNIT,
      title: 'Pay',
      type: 'feature',
      about: 'Test: pay',
      started: null,
      at_menu: false,
      progress: { complete: 3, total: 5 },
      waiting: [{ kind: 'question', id: 'Q1', text: QUESTIONS[0] }],
      phases: [
        { phase: 'discovery', state: 'complete', words: '' },
        { phase: 'discussion', state: 'complete', words: '0 decisions' },
        { phase: 'specification', state: 'complete', words: '' },
        { phase: 'build', state: 'running', words: '0 of 4 tasks done' },
        { phase: 'review', state: 'later', words: '' },
      ],
      lately: [['raised', 'Q1'], ['task-started', '1.1']],
    });
  });

  it('a task done says when it finished among the unit\'s moments, as its account was taken', () => {
    enterBuild();
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    const figures = JSON.parse(readState(dir, layout.unit(UNIT, 'build/tasks/1.1/figures.json')));

    assert.deepStrictEqual(board(['--tab', 'unit']).view.lately, [{ kind: 'task-finished', at: figures.finished, topic: null, detail: '1.1' }]);
  });

  it('at the unit\'s menu, This session is the unit\'s page at its menu (20.3.3)', () => {
    ok(dir, ['session', 'label', UNIT], { env: env() });
    const { view, banner } = board();

    assert.deepStrictEqual({ kind: view.kind, at_menu: view.at_menu, banner }, { kind: 'unit', at_menu: true, banner: { name: 'Pay', state: 'idle', facts: [{ text: 'feature', needs: false }, { text: 'at its menu', needs: false }] } });
  });

  it('All work lists the session\'s unit with how far its build has come, what waits in it, this session in it, and what waits across the units; and opens a unit\'s page, and a page of a unit opened from it (20.16, 20.3.6)', async () => {
    enterBuild();
    await parkOn(['1.2']);
    await parkOn(['2.1'], 1);
    const { units, waiting } = board(['--tab', 'all']).view;

    assert.deepStrictEqual([{ units, waiting }, board(['--tab', 'all', '--page', `unit:${UNIT}`]).view.kind, board(['--tab', 'all', '--page', 'task:1.2', '--page-unit', UNIT]).view.kind], [
      { units: [{ unit: UNIT, title: 'Pay', type: 'feature', phase: 'build', standing: '0 of 4 tasks done', waiting: 2, session: 'this' }], waiting: 2 },
      'unit',
      'task',
    ]);
  });
});

describe('the contract with the mod (14.16)', () => {
  it('the fixture the mod reads is a board of this version, shaped as the engine answers a build with a question waiting, the waiting count alone flagged on its banner (20.2.4)', async () => {
    enterBuild();
    await parkOn(['1.2']);
    issued('builder', '1.1', '2026-10-21T10:00:00.000Z');
    fs.rmSync(path.join(dir, '.leeway', UNIT, 'build/tasks/1.1/figures.json'));
    const held = await fixture('board-build.mjs');
    const answer = board();
    const forShape = (/** @type {any} */ board) => ({ ...board, view: { ...board.view, phases: board.view.phases.filter((/** @type {any} */ phase) => phase.tasks.length > 0) } });

    const flagged = (/** @type {any} */ board) => board.banner.facts.filter((/** @type {any} */ { needs }) => needs).map((/** @type {any} */ { text }) => text);

    assert.deepStrictEqual(
      { version: held.version, shape: shapeOf(forShape(held)), flagged: [flagged(held), flagged(answer)] },
      { version: BOARD_VERSION, shape: shapeOf(forShape(answer)), flagged: [['3 waiting on you'], ['1 waiting on you']] },
    );
  });

  it('the task page the mod reads is shaped as the engine answers a done task\'s page, with its account, rounds, calls and runs (20.5.4)', async () => {
    enterBuild();

    assert.deepStrictEqual(misfits(await fixture('board-task.mjs'), board(['--page', 'task:1.1']).view), []);
  });
});

describe('refusals', () => {
  it('a call with no session id, or two, answers the usage', () => {
    assert.deepStrictEqual([refused([]), refused([SESSION, 'more'])].map((error) => error.startsWith('Usage: engine board <session-id>')), [true, true]);
  });

  it('a tab that is none of the three, the unit\'s tab or a page with no unit, a unit the project lacks, a page no ref names, a page\'s task that is no task\'s number, a page\'s unit with no page, and a unit\'s own page under another unit are refused, nothing written', () => {
    assert.deepStrictEqual([
      refused([SESSION, '--tab', 'mine']),
      refused([SESSION, '--tab', 'unit']),
      refused([SESSION, '--page', 'task:1.1']),
      refused([SESSION, '--tab', 'unit', '--unit', 'nope']),
      refused([SESSION, '--tab', 'all', '--page', 'unit:nope']),
      refused([SESSION, '--tab', 'all', '--page', 'task:1.1']),
      refused([SESSION, '--tab', 'unit', '--unit', UNIT, '--page', 'shelf:1']),
      refused([SESSION, '--tab', 'unit', '--unit', UNIT, '--page', 'task:one']),
      refused([SESSION, '--page', 'task:1.1', '--page-unit', 'nope']),
      refused([SESSION, '--page-unit', UNIT]),
      refused([SESSION, '--page', `unit:${UNIT}`, '--page-unit', 'till']),
    ].map((error) => error.split(' — ')[0]), [
      '--tab is this, unit or all, not "mine"',
      'the unit\'s tab is at no unit, whose page it would show',
      'the session is at no unit, whose page it would show',
      'there is no work unit "nope"',
      'there is no work unit "nope"',
      'no page of All work is named "task:1.1"',
      'no page is named "shelf:1"',
      'task-id: "one" is not a task',
      'there is no work unit "nope"',
      '--page-unit names the unit a page was opened in, and goes with --page',
      `unit:${UNIT} is ${UNIT}'s own page, not a page of till`,
    ]);
  });
});
