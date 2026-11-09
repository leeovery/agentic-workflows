'use strict';

// ---------------------------------------------------------------------------
// `engine board` (leeway-engine/scripts/domain/board.cjs, its model
// domain/board-model.cjs): the board's frame — following the session, the
// tabs, the banner, the version and the fixture the mod reads, that it
// writes nothing. The build on it is test-engine-board-build.cjs, a task's
// pages test-engine-board-pages.cjs. The review phase on the
// board is test-engine-board-review.cjs, its rounds recorded
// test-engine-board-review-rounds.cjs and -rounds-end.cjs, and where it
// stands on every view test-engine-board-review-standing.cjs; a
// specification, test-engine-board-spec.cjs and -spec-waits.cjs; a discussion and an experiment,
// test-engine-board-views.cjs; a unit's page and All work,
// test-engine-board-units.cjs.
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
  ok, okSectionsAsync, refusedPristine, treeSnapshot, head, cleanupFixture, readState, readManifest, layout,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION_ID, QUESTIONS, CALL, taskText, buildScreensWorld, buildScreenHelpers, boardHelpers } = require('./build-screens-world.cjs');
const { fixture, misfits, shapeOf, place } = require('./board-world.cjs');
const { raiseHelpers } = require('./raise-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BOARD_VERSION } = require(path.join(SCRIPTS, 'domain/board-model.cjs'));

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
const { board, enterBuild, issued, project } = boardHelpers(() => dir, () => config);

/** The board's refusal, nothing written. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['board', ...args], { env: env() }).error;

describe('the board at the start menu (20.3.3, 20.16)', () => {
  it('shows All work with the project\'s units, no unit\'s tab, and a banner naming the project at the start menu', () => {
    assert.deepStrictEqual(board(), {
      version: BOARD_VERSION,
      place: { unit: null, type: null, phase: null, topic: null },
      banner: { name: project(), state: 'idle', facts: [place('at the start menu')] },
      unit: null,
      tab: 'this',
      view: {
        kind: 'all',
        project: project(),
        at_start: true,
        waiting: 0,
        units: [{ unit: UNIT, title: 'Pay', type: 'feature', phase: 'build', standing: '0 of 4 tasks done', waiting: 0, session: null }],
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

describe('the tabs (20.3)', () => {
  it('the unit\'s tab shows the unit\'s page: each phase from discovery to review with what its records hold and the day each finished closed, the phase it is in since the one before closed, the session in its build, what waits on the person, and what happened lately, newest first (20.15.1)', async () => {
    enterBuild();
    await parkOn(['1.2']);
    const { view } = board(['--tab', 'unit']);
    const { checklists } = readManifest(dir, UNIT);
    const ready = checklists?.['ready-to-build']?.closed ?? null;
    const decided = checklists?.decided?.[UNIT]?.closed ?? null;

    assert.deepStrictEqual({ ...view, lately: view.lately.map(({ kind, detail }) => [kind, detail]) }, {
      kind: 'unit',
      unit: UNIT,
      title: 'Pay',
      type: 'feature',
      about: 'Test: pay',
      started: null,
      now: { phase: 'build', since: ready },
      at_menu: false,
      here: true,
      progress: { complete: 3, total: 5 },
      waiting: [{ kind: 'question', id: 'Q1', text: `Q1 ${QUESTIONS[0]}`, page: view.waiting[0].page }],
      phases: [
        { phase: 'discovery', state: 'complete', words: 'the seed', doing: '', on: null, session: null, page: true },
        { phase: 'discussion', state: 'complete', words: '0 decisions', doing: '', on: decided, session: null, page: true },
        { phase: 'specification', state: 'complete', words: '', doing: '', on: ready, session: null, page: false },
        { phase: 'build', state: 'running', words: '0 of 4 tasks done', doing: 'building', on: null, session: 'this', page: false },
        { phase: 'review', state: 'later', words: '', doing: '', on: null, session: null, page: false },
      ],
      lately: [['raised', 'Q1'], ['task-started', '1.1']],
    });
  });

  it('S3, 20.15.1: two units in their builds, each with a Q1 of its own: each unit\'s tab lists its own, and only the one the session is in is here', async () => {
    const { phases, cut } = readManifest(dir, UNIT);
    createManifest(dir, 'till', { phases: { discussion: { items: { till: phases.discussion.items[UNIT] } } }, build: { position: 'step' }, cut });
    ok(dir, ['task', 'phase', 'till', '1', '--title', 'Drawer']);
    const task = path.join(config, 'till-task.md');
    fs.writeFileSync(task, taskText('Open the drawer', ['The drawer opens on a sale.']));
    ok(dir, ['task', 'create', 'till', '1', '--file', task]);
    const asked = ok(dir, ['ledger', 'ask', 'till.implementation'], { env: env(), stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does the drawer lock?' }) }).id;
    const { conversation } = raiseHelpers(() => dir, () => config, { ...CALL, question: 'Does the drawer lock?' });
    await okSectionsAsync(dir, ['raise', 'till.implementation', '--answers', asked, '--parks', '1.1'], { env: conversation(), stdin: JSON.stringify({ ...CALL, question: 'Does the drawer lock?' }) });
    enterBuild();
    await parkOn(['1.2']);
    const tab = (/** @type {string} */ unit) => {
      const { here, waiting } = board(['--tab', 'unit', '--unit', unit]).view;
      return { here, waiting };
    };

    const [pay, till] = [tab(UNIT), tab('till')];

    assert.deepStrictEqual([pay, till], [
      { here: true, waiting: [{ kind: 'question', id: 'Q1', text: `Q1 ${QUESTIONS[0]}`, page: pay.waiting[0].page }] },
      { here: false, waiting: [{ kind: 'question', id: 'Q1', text: 'Q1 Does the drawer lock?', page: till.waiting[0].page }] },
    ]);
    assert.deepStrictEqual([pay.waiting[0].page, till.waiting[0].page], ['task:1.2', 'task:1.1']);
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

    assert.deepStrictEqual({ kind: view.kind, at_menu: view.at_menu, banner }, { kind: 'unit', at_menu: true, banner: { name: 'Pay', state: 'idle', facts: [place('feature'), place('at its menu')] } });
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

  it('the task pages the mod reads are shaped as the engine answers a done task\'s page, with its account, rounds and calls, and what running the product proved held by both (20.5.4, N7)', async () => {
    enterBuild();
    const page = board(['--page', 'task:1.1']).view;
    const [done, fixing] = [await fixture('board-task.mjs'), await fixture('board-task-fix.mjs')];
    const lists = (/** @type {any} */ view) => [view.reviews.length > 0, view.calls.length > 0, view.account?.differences.length > 0];

    assert.deepStrictEqual(
      [misfits(done, page), misfits(fixing.ran, page.ran), lists(done), lists(page), [fixing.ran.length > 0, page.ran.length > 0]],
      [[], [], [true, true, true], [true, true, true], [true, true]],
    );
  });
});

describe('refusals', () => {
  it('a call with no session id, or two, answers the usage', () => {
    assert.deepStrictEqual([refused([]), refused([SESSION_ID, 'more'])].map((error) => error.startsWith('Usage: engine board <session-id>')), [true, true]);
  });

  it('a tab that is none of the three, the unit\'s tab or a page with no unit, a unit the project lacks, a page no ref names, a page\'s task that is no task\'s number, a page\'s unit with no page, and a unit\'s own page under another unit are refused, nothing written', () => {
    assert.deepStrictEqual([
      refused([SESSION_ID, '--tab', 'mine']),
      refused([SESSION_ID, '--tab', 'unit']),
      refused([SESSION_ID, '--page', 'task:1.1']),
      refused([SESSION_ID, '--tab', 'unit', '--unit', 'nope']),
      refused([SESSION_ID, '--tab', 'all', '--page', 'unit:nope']),
      refused([SESSION_ID, '--tab', 'all', '--page', 'task:1.1']),
      refused([SESSION_ID, '--tab', 'unit', '--unit', UNIT, '--page', 'shelf:1']),
      refused([SESSION_ID, '--tab', 'unit', '--unit', UNIT, '--page', 'task:one']),
      refused([SESSION_ID, '--page', 'task:1.1', '--page-unit', 'nope']),
      refused([SESSION_ID, '--page-unit', UNIT]),
      refused([SESSION_ID, '--page', `unit:${UNIT}`, '--page-unit', 'till']),
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
