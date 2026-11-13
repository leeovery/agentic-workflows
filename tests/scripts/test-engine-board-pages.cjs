'use strict';

// ---------------------------------------------------------------------------
// `engine board`'s pages of a task in the build (leeway-engine/scripts/
// domain/projections/board-build.cjs, 20.5.4–20.5.7): a task's page with
// its account, rounds, calls and what running the product proved, the
// calls on no tab of their own (27.S9); a scenario's page and an evidence page; the task as written, a round of its
// review and a call read in full; and how a page stays, is read against
// the unit it was opened in, and answers unavailable. The board's frame and
// the build's view are test-engine-board.cjs.
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
  ok, refuses, cleanupFixture, readState, writeState, layout,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION_ID, buildScreensWorld, buildScreenHelpers, boardHelpers, line } = require('./build-screens-world.cjs');
const { fixture, misfits, place } = require('./board-world.cjs');
const { TABS } = require('../../skills/leeway-engine/scripts/domain/board-model.cjs');

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-board-pages-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, parkOn, position } = buildScreenHelpers(() => dir, () => config);
const { board, enterBuild, project } = boardHelpers(() => dir, () => config);

/** The unit's spec: its first scenario parted at its "then", its second. */
const SPEC = [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The card', '', '1.1.1 A card shows its last four digits.', '', '### 1.2 The receipt', '', '1.2.1 A charge prints its receipt.', '',
  '## 1-S. Scenarios for §1', '',
  '1.S1 Given a till, when a card is taken, then it shows the card\'s last four digits. (1.1.1)', '',
  '1.S2 Given a charge, when it lands, then a receipt prints. (1.2.1)', '',
].join('\n');

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
      questions: [],
      fixes: [],
    });
  });

  it('27.S9: no tab shows the calls made grouped by kind — the board has This session, the unit\'s tab and All work alone, a tab of calls refused, neither the unit\'s nor All work holding any — while a task\'s page still lists the calls it made', () => {
    enterBuild();
    const tabs = ['unit', 'all'].map((tab) => Object.keys(board(['--tab', tab]).view).filter((key) => /call/.test(key)));

    assert.deepStrictEqual([TABS, tabs, board(['--page', 'task:1.1']).view.calls.map((/** @type {{text: string}} */ { text }) => text)], [['this', 'unit', 'all'], [[], []], ['The till masks the digits']]);
    assert.match(refuses(dir, ['board', SESSION_ID, '--tab', 'calls'], { env: env() }).error, /--tab is this, unit or all, not "calls"/);
  });

  it('a scenario opens on the run that decides it: what it proved and when, what it drives and checks by the spec\'s words parted at their "then", and each text evidence kept with it, read whole (15.2.14, D16); the mod\'s fixtures of both pages are shaped as these, each list holding one (N6)', async () => {
    enterBuild();
    writeState(dir, layout.unit(UNIT, 'spec.md'), SPEC);
    const run = layout.unit(UNIT, 'build/runs/1.S1/run-001.json');
    writeState(dir, run, JSON.stringify({ ...JSON.parse(readState(dir, run)), evidence: [{ name: 'till screen', text: 'CARD ****4242\nTAKEN\n' }] }));
    const pages = [board(['--page', 'task:1.1:scenario:1.S1']).view, board(['--page', 'task:1.1:scenario:1.S1:evidence:1']).view];
    const [scenario, evidence] = [await fixture('board-scenario.mjs'), await fixture('board-evidence.mjs')];

    assert.deepStrictEqual([misfits(scenario, pages[0]), misfits(evidence, pages[1]), scenario.evidence.length > 0], [[], [], true]);
    assert.deepStrictEqual(pages, [
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
        check: 'it shows the card\'s last four digits.',
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
        { standing: 'not proven', at: null, drive: 'A charge prints its receipt.', check: null, evidence: [] },
        { kind: 'unavailable', reason: 'task 1.2 of pay holds no scenario 1.S1' },
        { kind: 'unavailable', reason: 'no run of 1.S1 keeps an evidence 1' },
      ],
    );
  });

  it('a task with no account, parked: none, nothing reviewed or called, never started, and the question it waits on whole, with its line; the session gone to the start menu, the page still holds it (20.5.6, 20.3.5, N1)', async () => {
    enterBuild();
    await parkOn(['1.3']);
    const { view, questions } = board(['--page', 'task:1.3']);
    fs.rmSync(path.join(config, 'conversations', SESSION_ID, 'position.json'));
    const atStart = board(['--page', 'task:1.3', '--page-unit', UNIT]);

    assert.deepStrictEqual(
      [{ line: view.line, started: view.started, finished: view.finished, account: view.account, reviews: view.reviews, calls: view.calls, ran: view.ran }, view.questions.map(({ question }) => question), atStart.view.questions, atStart.questions],
      [{ line: line('1.3', 'Mail the receipt', 'waits', { on: ['Q1'] }), started: null, finished: null, account: null, reviews: [], calls: [], ran: null }, ['Q1'], questions, []],
    );
  });

  it('a task not yet started that holds a scenario of the cut opens its page, its scenario not run: it has no branch to run at — and so does the scenario\'s own page (20.5.4)', () => {
    enterBuild();
    const { view } = board(['--page', 'task:2.1']);
    const scenario = board(['--page', 'task:2.1:scenario:2.S1']).view;

    assert.deepStrictEqual([view.kind, view.started, view.ran], ['task', null, [{ scenario: '2.S1', criterion: 'A refund reaches the card.', standing: 'not proven' }]]);
    assert.deepStrictEqual([scenario.kind, scenario.standing, scenario.at, scenario.evidence], ['scenario', 'not proven', null, []]);
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
    fs.rmSync(path.join(config, 'conversations', SESSION_ID, 'position.json'));
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
