'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a quick-fix's review (leeway-engine/scripts/domain/
// projections/board-standing.cjs, board-review.cjs, board-all.cjs; 20.2.4,
// 20.15.1, 20.16.1): asked for at its close, the quick-fix stands in review
// on every view that reads the unit's standing — its tab's review row after
// its implementation, dated by the ask, and All work — and once entered on
// This session and the banner too, through each step of the review, its
// close named so on each; once closed, its implementation and its review
// each dated by when it closed; and its review's fix task parked on a
// question stopping it on every view alike.
//
// Layer: git. World: quick-fix-review-world.cjs's `closeReached`, copied
// for each test, and its review's steps. Each test's conversation keeps its
// records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, okSectionsAsync, statePath, readManifest, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT } = require('./quick-fix-world.cjs');
const { closeReached, reviewSteps } = require('./quick-fix-review-world.cjs');
const { CALL } = require('./quick-fix-board-world.cjs');
const { place } = require('./board-world.cjs');

const SESSION = 'sess-1';

let dir = ''; // the project
const config = useTempFolder('engine-board-quick-fix-review-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation's environment. */
const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** This test's conversation, as a call's options. */
const as = () => ({ env: env() });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, as());

/** The board's answer for this test's conversation. @param {string[]} [args] */
const board = (args = []) => run(['board', SESSION, ...args]);

const { entered, firstRoundRecorded, fixTaskStarted, fixTaskDone, secondRoundPassed } = reviewSteps(() => dir, as);

/** Round 1 recorded failing, its fix task 2.1 started: asked for at the close and entered first. */
function fixTaskBuilding() {
  run(['review', 'ask', UNIT]);
  entered();
  firstRoundRecorded();
  fixTaskStarted();
}

/** The quick-fix's tab's rows from the implementation on, each by its state, its words and the day it closed. @param {any} tab */
const rowsOf = (tab) => tab.phases.slice(1).map((/** @type {{phase: string, state: string, words: string, on: string|null}} */ held) => [held.phase, held.state, held.words, held.on]);

/** The quick-fix's tab. */
const tabOf = () => board(['--tab', 'unit', '--unit', UNIT]);

/**
 * Every view that says where the quick-fix stands: its tab's rows, and what
 * waits on the person there; its line in All work; This session, by its
 * kind and in the review its round and whether it has stopped; and the
 * banner.
 */
function views() {
  const { view: tab, banner } = tabOf();
  const { phase, standing, waiting } = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ line) => line.unit === UNIT);
  const { view } = board();
  return {
    rows: rowsOf(tab),
    waits: tab.waiting.map((/** @type {{kind: string, id: string}} */ { kind, id }) => `${kind} ${id}`),
    all: [phase, standing, waiting],
    session: view.kind === 'review' ? [view.kind, view.round, view.stopped] : [view.kind],
    banner,
  };
}

/** Banner facts, each plain unless flagged. @param {...(string|[string])} held */
const facts = (...held) => held.map((fact) => (typeof fact === 'string' ? { text: fact, needs: false } : { text: fact[0], needs: true }));

/** The banner in the quick-fix's review: its state, and its facts as `facts` takes them after its type and phase. @param {string} state @param {...(string|[string])} held */
const reviewing = (state, ...held) => ({ name: 'Typo', state, facts: [place('quick-fix'), place('review'), ...facts(...held)] });

describe('a quick-fix in its review stands in review on every view (20.2.4, 20.15.1, 20.16.1)', () => {
  it('asked for, entered, failing with its fix task building, then passing with the close waiting: the tab\'s review row after its implementation, dated by the ask, All work, This session and the banner each say where the review stands, the gate named close; once closed, the review is dated by the close', () => {
    dir = closeReached();
    run(['review', 'ask', UNIT]);
    const asked = views();
    entered();
    const reading = views();
    firstRoundRecorded();
    fixTaskStarted();
    const fixing = views();
    fixTaskDone();
    secondRoundPassed();
    const closing = views();
    run(['finish', 'yes', UNIT]);
    const closed = rowsOf(tabOf().view);
    const { fixes, completed_at: completed } = readManifest(dir, UNIT);
    const built = ['implementation', 'complete', '2 of 2 done', fixes.review_asked];

    assert.deepStrictEqual({ ...asked, banner: asked.banner.state }, {
      rows: [built, ['review', 'running', 'round 1', null]], waits: [], all: ['review', 'round 1 reading', 0], session: ['all'], banner: 'idle',
    });
    assert.deepStrictEqual(reading, {
      rows: asked.rows, waits: [], all: asked.all, session: ['review', 1, false], banner: reviewing('running', 'round 1 reading'),
    });
    assert.deepStrictEqual(fixing, {
      rows: [built, ['review', 'running', 'round 1 fails · fix tasks building', null]],
      waits: [],
      all: ['review', 'round 1 fails · fix tasks building', 0],
      session: ['review', 1, false],
      banner: reviewing('running', 'round 1 fails · fix tasks building'),
    });
    assert.deepStrictEqual(closing, {
      rows: [built, ['review', 'waits', 'round 2 passes', null]],
      waits: ['finish close'],
      all: ['review', 'close waits on you', 1],
      session: ['review', 2, false],
      banner: reviewing('needs', 'close waits on you', ['1 waiting on you']),
    });
    assert.deepStrictEqual(closed, [built, ['review', 'complete', 'round 2 passes', completed]]);
  });

  it('its review\'s fix task parked on a question has stopped it on every view alike — This session, the banner, the tab\'s review row and All work — counting the question', async () => {
    dir = closeReached();
    fixTaskBuilding();
    await parkedAtReview('2.1', 'Should the docs name --color too?');
    const { rows, waits, all, session, banner } = views();

    assert.deepStrictEqual({ review: rows[1], waits, all, session, banner }, {
      review: ['review', 'stopped', 'round 1 fails', null],
      waits: ['question Q1'],
      all: ['review', 'stopped · round 1 fails', 1],
      session: ['review', 1, true],
      banner: { name: 'Typo', state: 'needs', facts: [place('quick-fix'), place('review'), place('stopped'), ...facts('round 1 fails', ['1 waiting on you'])] },
    });
  });
});

/**
 * A question the review's fix task `task` parks on, raised at the review.
 * `raise` refuses `--parks` at a quick-fix today (15.6's E5), so the park is
 * made as the build makes one, the unit read as a build for the raise alone.
 * @param {string} task @param {string} question
 */
async function parkedAtReview(task, question) {
  const file = statePath(dir, UNIT, 'manifest.json');
  const held = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(held), work_type: 'feature', build: { position: 'auto' } }));
  try {
    const at = `${UNIT}.review`;
    const asked = ledgerReadHelpers(() => dir).ask(at, question);
    await okSectionsAsync(dir, ['raise', at, '--answers', asked, '--parks', task], { env: env(), stdin: JSON.stringify({ ...CALL, question }) });
  } finally {
    fs.writeFileSync(file, held);
  }
}
