'use strict';

// ---------------------------------------------------------------------------
// A review round that ends the phase on the board (leeway-engine/scripts/
// domain/projections/board-review.cjs, 20.10.1, 20.10.4, 14.S15): one that
// passed with its nits to fix, finish not yet waiting; one that passed, what
// it found and could not prove, finish waiting and the unit's close once
// given; and a round Claude settled after a later round read only the areas
// its fix tasks changed. A round recorded failing is
// test-engine-board-review-rounds.cjs.
//
// Layer: verb. World: the review phase's (review-world.cjs) — `pay`, its
// build finished, its spec of two areas — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  UNIT, SESSION_ID, EVERY, FOUND, useWorld, env, enter, reported, recorded, fixPhaseWritten, reviewCall, filed, finishClosed, finishReady, secondRoundReady, ok,
} = require('./review-world.cjs');
const { place } = require('./board-world.cjs');
const { area, tests, FINISH, facts, placed, reviewBoard } = require('./review-board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));

/** @type {string} */
let dir;
useWorld((made) => {
  dir = made;
});

const { board, head } = reviewBoard(() => dir);

describe('a round that passed (20.10.1, 20.10.4)', () => {
  it('a round that passed with its nits to fix passes, finish not yet waiting while its fix tasks build (D36)', () => {
    enter();
    reported(1, EVERY, { '1-cards-a': ['nit: The receipt says Reciept.'] });
    fixPhaseWritten(3, [['Spell the receipt', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'nit', text: 'The receipt says Reciept.', from: ['1-cards-a#1'], fix: '3.1' }] });
    const { view, banner } = board();

    assert.deepStrictEqual([view.verdict, view.waiting, banner], ['passed', [], { name: 'Pay', state: 'running', facts: placed(['feature', 'review'], 'round 1 passes') }]);
  });

  it('a round that passed shows what it found, what could not be proven with its scenario\'s words, and its verdict; the phase over, finish waits on the person, and the banner flags it (D18, D37); once finish completes the unit from its review phase, This session is All work at the start menu, the banner the unit\'s close, through the boot that brings the start menu, until the session goes somewhere (20.10.4, D38)', () => {
    finishReady();
    const over = board();
    ok(dir, ['finish', 'yes', UNIT], { env: env() });
    const read = () => {
      const { view, banner, unit, questions } = ok(dir, ['board', SESSION_ID], { env: env() });
      return { view: [view.kind, view.at_start, view.complete.map(/** @param {{unit: string}} done */ ({ unit: done }) => done)], banner, unit, questions };
    };
    const finished = read();
    ok(dir, ['boot'], { env: env() });
    const booted = read();
    ok(dir, ['session', 'label', 'roadmap'], { env: env() });
    const close = { name: 'Pay', state: 'done', facts: [...facts('feature', 'complete'), place('at the start menu')] };

    assert.deepStrictEqual(over, {
      view: {
        ...head(1, true),
        recorded: true,
        areas: [area('1', 'Cards', 'read', { ran: 2 }), area('2', 'Refunds', 'read', { ran: 1 }), tests('read')],
        found: [],
        not_proven: [
          { round: 1, scenario: '1.S2', standing: 'not proven', text: 'Given a charge, when it lands, then a receipt follows.' },
          { round: 1, scenario: '2.S1', standing: 'named, not run', text: 'Given a charge, when it is refunded whole, then the card is credited.' },
        ],
        inbox: [],
        verdict: 'passed',
        fixes: null,
      },
      banner: { name: 'Pay', state: 'needs', facts: placed(['feature', 'review'], 'finish waits on you', ['1 waiting on you']) },
    });
    assert.deepStrictEqual([finished, booted, read().banner], [
      { view: ['all', true, [UNIT]], banner: close, unit: { unit: UNIT, title: 'Pay' }, questions: [] },
      { view: ['all', true, [UNIT]], banner: close, unit: null, questions: [] },
      { name: projectName(dir), state: 'idle', facts: [place('roadmap')] },
    ]);
  });
});

describe('a round settled (20.10.1, 14.S15)', () => {
  it('the next round reads only the areas its fix tasks changed, every other unchanged, not read again (20.S11); a round Claude settled ends the phase settled, what went to the inbox listed by its finding, and finish waits on the person (D37)', () => {
    secondRoundReady({ '1-cards-a': ['bug: The receipt is never sent.'], '1-cards-b': ['bug: A card\'s expiry is checked nowhere.'] });
    const reading = board().view.areas;
    const dropped = reviewCall('Dropped: the reviewer read a stale build.', 'Task 3.1 sends the receipt.');
    const fileCall = reviewCall('Filed: a card\'s expiry is checked nowhere.', 'It is a gap beside the change.');
    const item = filed({ kind: 'idea', text: '# Card expiry\n\nNo screen checks a card\'s expiry.', call: fileCall });
    recorded({
      can_now: ['Pay by card.'],
      findings: [
        { ...FOUND, from: ['1-cards-a#1'], drop: 'Fixed by 3.1; the reviewer read a stale build.', ledger: dropped },
        { area: '1-cards', scope: 'out', call: 'bug', text: 'A card\'s expiry is checked nowhere.', from: ['1-cards-b#1'], inbox: item.filed, ledger: fileCall },
      ],
      settled: 'Task 3.1 sends the receipt; its test proves it.',
    });
    finishClosed();
    const { view, banner } = board();

    assert.deepStrictEqual(reading, [area('1', 'Cards', 'read', { found: 2 }), area('2', 'Refunds', 'unchanged'), tests('unchanged')]);
    assert.deepStrictEqual({ round: view.round, verdict: view.verdict, waiting: view.waiting, inbox: view.inbox, state: banner.state, fact: banner.facts.at(-1) }, {
      round: 2, verdict: 'settled', waiting: [FINISH], inbox: [{ round: 2, finding: 2, text: 'A card\'s expiry is checked nowhere.' }], state: 'needs', fact: { text: '1 waiting on you', needs: true },
    });
  });
});
