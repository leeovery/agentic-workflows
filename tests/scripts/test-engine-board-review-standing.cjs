'use strict';

// ---------------------------------------------------------------------------
// Where the review phase stands, on every view that reads it (leeway-engine/
// scripts/domain/projections/board-standing.cjs, board-review.cjs,
// board-all.cjs; 20.5.3, 20.10, D36, D37): a question parking a fix task,
// one the review raises parking none and a replacement it proposes, the
// fix tasks building, and finish waiting once the phase is over — the
// unit's tab, All work's row and the banner each saying it as the stop and
// finish's hold do. The round itself is test-engine-board-review.cjs.
//
// Layer: verb. World: the review phase's (review-world.cjs) — `pay`, its
// build finished, its spec of two areas — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  UNIT, SESSION_ID, calls, useWorld, env, enter, reported, named, recorded, fixPhaseWritten, fixBuilt, fixClosed, fixParked, raisedAtReview, replacedAtReview, reviewPassed, finishClosed, taskMade, firstRoundFailed, ok,
} = require('./review-world.cjs');
const { fixture, misfits, standingOn } = require('./board-world.cjs');
const { facts, placed, reviewBoard } = require('./review-board-world.cjs');

/** @type {string} */
let dir;
useWorld((made) => {
  dir = made;
});

const { board } = reviewBoard(() => dir);

describe('a question its fix tasks wait on (20.5.3, 20.2.4, S1)', () => {
  it('a question parking the only fix task stands in the review phase as in the build: among the questions a press queues, the view waiting on it and stopped, the banner stopped with the count flagged, its fix tasks not said to build; and the task\'s page holds the question whole, its shape the mod\'s fixture of a parked fix task\'s page, with what it fixes (N7)', async () => {
    firstRoundFailed();
    enter();
    await fixParked();
    const { view, banner, questions } = ok(dir, ['board', SESSION_ID], { env: env() });
    const page = board(['--page', 'task:3.1']).view;
    const fixing = await fixture('board-task-fix.mjs');
    const lists = (/** @type {any} */ held) => [held.questions.length > 0, held.fixes.length > 0];

    assert.deepStrictEqual({
      questions: questions.map(/** @param {{question: string, parks: {task: string}[]}} held */ ({ question: number, parks }) => [number, parks.map(({ task }) => task)]),
      view: [view.kind, view.waiting, view.stopped],
      banner,
      page: page.questions,
      fits: [misfits(fixing, page), lists(fixing), lists(page)],
      standing: standingOn(board, UNIT),
    }, {
      questions: [['Q1', ['3.1']]],
      view: ['review', [{ kind: 'question', id: 'Q1', text: 'Q1 Is the receipt mailed or printed?', page: 'task:3.1' }], true],
      banner: { name: 'Pay', state: 'needs', facts: placed(['feature', 'review', 'stopped'], 'round 1 fails', ['1 waiting on you']) },
      page: questions,
      fits: [[], [true, true], [true, true]],
      standing: {
        tab: { now: 'review', state: 'stopped', words: 'round 1 fails', waiting: ['question Q1 → task:3.1'] },
        all: { phase: 'review', standing: 'stopped · round 1 fails', waiting: 1, total: 1 },
        banner: { state: 'needs', waits: ['⚑ 1 waiting on you'] },
      },
    });
  });
});

describe('where the review stands on every view that reads it (S1)', () => {
  it('N1, N2: a question the review raises parking no task, while round 2\'s readers read, leaves the review going on, never stopped, on every view as the stop has it, and opens its question\'s entry; once the round passes with it still waiting, finish waits on no view and the review has stopped on it, as the stop draws it', async () => {
    firstRoundFailed();
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    await raisedAtReview('Is a refund ever split?');
    const reading = standingOn(board, UNIT);
    const [, opens] = reading.tab.waiting[0].split(' → ');
    const entry = board(['--page', opens]).view;
    reported(2, ['1-cards']);
    recorded({ can_now: ['Pay by card.', 'Mail the receipt.'], findings: [] });

    assert.deepStrictEqual({ reading, entry: [entry.kind, entry.text], passed: standingOn(board, UNIT) }, {
      reading: {
        tab: { now: 'review', state: 'running', words: 'round 2', waiting: [`question Q1 → ${opens}`] },
        all: { phase: 'review', standing: 'round 2 reading', waiting: 1, total: 1 },
        banner: { state: 'running', waits: ['⚑ 1 waiting on you'] },
      },
      entry: ['entry', 'Is a refund ever split?'],
      passed: {
        tab: { now: 'review', state: 'stopped', words: 'round 2 passes', waiting: [`question Q1 → ${opens}`] },
        all: { phase: 'review', standing: 'stopped · round 2 passes', waiting: 1, total: 1 },
        banner: { state: 'needs', waits: ['⚑ 1 waiting on you'] },
      },
    });
  });

  it('a replacement the review proposes parking no task opens the decision it would replace', async () => {
    firstRoundFailed();
    enter();
    await replacedAtReview(calls.token);
    const [, opens] = standingOn(board, UNIT).tab.waiting[0].split(' → ');
    const entry = board(['--page', opens]).view;

    assert.deepStrictEqual([opens, entry.kind, entry.text], [`entry:${calls.token}`, 'entry', 'A card is tokenised.']);
  });

  it('a failing round\'s fix tasks building while any task of its fix phase is not done — one written beyond its findings among them (N7) — the tab\'s review and All work\'s row say so as the banner does, and nothing waits on the person', () => {
    firstRoundFailed();
    const building = standingOn(board, UNIT);
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    const built = standingOn(board, UNIT).tab.words;
    taskMade(3, 'Mail the receipt twice', '§1.2');
    const beyond = standingOn(board, UNIT).tab.words;
    ok(dir, ['session', 'label', UNIT, 'review', UNIT], { env: env() });
    const { fixes } = board().view;

    assert.deepStrictEqual({ building, built, beyond, fixes: fixes.tasks.map(({ task, state }) => [task, state]) }, {
      building: {
        tab: { now: 'review', state: 'running', words: 'round 1 fails · fix tasks building', waiting: [] },
        all: { phase: 'review', standing: 'round 1 fails · fix tasks building', waiting: 0, total: 0 },
        banner: { state: 'running', waits: [] },
      },
      built: 'round 1 fails',
      beyond: 'round 1 fails · fix tasks building',
      fixes: [['3.1', 'done'], ['3.2', 'not-started']],
    });
  });

  it('the phase over and finish\'s checklist closed, so its screen draws: finish waits on the person on the tab, in WAITING ON YOU and in All work\'s count and row (D18, D37) — and not while a task of the round\'s fix phase is still to be done', () => {
    reviewPassed();
    fixPhaseWritten(3, [['Mail the receipt', '§1.2']]);
    const fixing = standingOn(board, UNIT);
    fixClosed(3, 1);
    finishClosed();

    assert.deepStrictEqual([fixing, standingOn(board, UNIT)], [
      {
        tab: { now: 'review', state: 'running', words: 'round 1 passes', waiting: [] },
        all: { phase: 'review', standing: 'round 1 passes', waiting: 0, total: 0 },
        banner: { state: 'running', waits: [] },
      },
      {
        tab: { now: 'review', state: 'waits', words: 'round 1 passes', waiting: ['finish finish'] },
        all: { phase: 'review', standing: 'finish waits on you', waiting: 1, total: 1 },
        banner: { state: 'needs', waits: ['⚑ 1 waiting on you'] },
      },
    ]);
  });
});
