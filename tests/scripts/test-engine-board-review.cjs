'use strict';

// ---------------------------------------------------------------------------
// `engine board` in the review phase (leeway-engine/scripts/domain/
// projections/board-review.cjs, 20.10): the round under way, each area by
// its reports and the briefs this conversation issued for it in that round;
// a recorded round, the checks each area ran, its findings, its checks not
// proven, what went to the inbox, its verdict and its fix tasks as the
// build's next phase; a later round's areas unchanged, not read again; the
// build past the cut in step, its fix phase with a task behind the one in
// flight and the phase whose merge waits; a finding's page and a check's;
// and that reading it writes nothing.
//
// Layer: verb. World: the review phase's (review-world.cjs) — `pay`, its
// build finished, its spec of two areas — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  UNIT, SESSION_ID, EVERY, RECEIPT, FOUND, FAILING, useWorld, env, enter, inStep, reportText, reported, named, recorded, issued, fixPhaseWritten, cutUnmerged, fixBuilt, reviewCall, filed, firstRoundReady, firstRoundFailed, secondRoundReady, ok, writeState, statePath, git,
} = require('./review-world.cjs');
const { withEnv, treeSnapshot, head: stateHead, holdLock, lockAttempts, layout } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

/** @type {string} */
let dir;
useWorld((made) => {
  dir = made;
});

/** The board's view of the session's review phase, and its banner. */
function board(args = []) {
  const { view, banner } = ok(dir, ['board', SESSION_ID, ...args], { env: env() });
  return { view, banner };
}

/** An area's line. @param {string} area @param {string} title @param {string} state @param {{ran?: number, found?: number, since?: string|null}} [more] */
const area = (area, title, state, { ran = 0, found = 0, since = null } = {}) => ({ area, title, state, ran, found, since });

/** The tests' reader's line. @param {string} state @param {{ran?: number, found?: number, since?: string|null}} [more] */
const tests = (state, more) => area('tests', 'Tests held against the specification', state, more);

/** The view's head: the unit and the tasks built. @param {number} round */
const head = (round) => ({ kind: 'review', unit: UNIT, title: 'Pay', type: 'feature', built: 3, round });

describe('the round under way (20.10.1)', () => {
  it('each area is waiting, being read since its brief was issued in this conversation (P15), or read with what its reports found; the banner says the round reads', () => {
    enter();
    const { res } = issued(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a']);
    const since = fs.statSync(issuedOf(res.id)).mtime.toISOString();
    reported(1, ['2-refunds'], { '2-refunds-b': ['bug: A refund is lost.', 'nit: A name.'] });

    assert.deepStrictEqual(board(), {
      view: {
        ...head(1),
        recorded: false,
        areas: [area('1', 'Cards', 'reading', { since }), area('2', 'Refunds', 'read', { found: 2 }), tests('waiting')],
        found: [],
        not_proven: [],
        inbox: [],
        verdict: null,
        fixes: null,
      },
      banner: { name: 'Pay', state: 'running', facts: [{ text: 'feature', needs: false }, { text: 'review', needs: false }, { text: 'round 1 reading', needs: false }] },
    });
  });

  it('an area is read once both its reviewers\' reports are written, and only its own brief puts it being read', () => {
    enter();
    issued(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a']);
    writeState(dir, `${UNIT}/review/round-1/2-refunds-a.md`, reportText([]));

    assert.deepStrictEqual(board().view.areas.map(({ state }) => state), ['reading', 'waiting', 'waiting']);
  });

  it('a brief issued for an area in one round never puts the next round\'s read of it being read; that round\'s own brief does, on its own clock (P15)', () => {
    enter();
    issued(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a']);
    reported(1, EVERY, FAILING);
    fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    const before = board().view.areas[0];
    const { res } = issued(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a']);

    assert.deepStrictEqual([before, board().view.areas[0]], [area('1', 'Cards', 'waiting'), area('1', 'Cards', 'reading', { since: fs.statSync(issuedOf(res.id)).mtime.toISOString() })]);
  });
});

/** Where the conversation keeps the record of whose a brief is. @param {string} id */
function issuedOf(id) {
  return withEnv({ LEEWAY_CONFIG_DIR: env().LEEWAY_CONFIG_DIR }, () => issuedPath(SESSION_ID, id));
}

describe('a round recorded (20.10.1, 20.10.2)', () => {
  it('a failing round shows its finding in scope, its verdict and its fix tasks as the build\'s phase after the cut until the next round opens; open, the next waits on the areas they changed, every other unchanged, the fix task built counted among the tasks built (20.10.2)', () => {
    firstRoundReady();
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    enter();
    const failed = board().view;
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    const found = [{ round: 1, finding: 1, area: '1-cards', text: 'The receipt is never sent.' }];
    const fixes = (/** @type {string} */ state) => ({ phase: 3, round: 1, tasks: [{ task: '3.1', title: 'Send the receipt', state, since: null, on: [] }] });

    assert.deepStrictEqual([{ ...failed, not_proven: [] }, board().view], [
      {
        ...head(1), recorded: true, areas: [area('1', 'Cards', 'read', { ran: 2, found: 1 }), area('2', 'Refunds', 'read', { ran: 1 }), tests('read')], found, not_proven: [], inbox: [], verdict: 'failed', fixes: fixes('not-started'),
      },
      {
        ...head(2), built: 4, recorded: false, areas: [area('1', 'Cards', 'waiting'), area('2', 'Refunds', 'unchanged'), tests('unchanged')], found, not_proven: [], inbox: [], verdict: null, fixes: fixes('done'),
      },
    ]);
  });

  it('the next round reads only the areas its fix tasks changed, every other unchanged, not read again (20.S11)', () => {
    secondRoundReady();

    assert.deepStrictEqual(board().view.areas, [area('1', 'Cards', 'read'), area('2', 'Refunds', 'unchanged'), tests('unchanged')]);
  });

  it('a round that passed shows what it found, what could not be proven and its verdict, the banner done', () => {
    enter();
    reported(1, EVERY);
    recorded({ can_now: ['Pay by card.'], findings: [] });
    const { view, banner } = board();

    assert.deepStrictEqual({ view, state: banner.state }, {
      view: {
        ...head(1),
        recorded: true,
        areas: [area('1', 'Cards', 'read', { ran: 2 }), area('2', 'Refunds', 'read', { ran: 1 }), tests('read')],
        found: [],
        not_proven: [{ scenario: '1.S2', standing: 'not proven' }, { scenario: '2.S1', standing: 'named, not run' }],
        inbox: [],
        verdict: 'passed',
        fixes: null,
      },
      state: 'done',
    });
  });
});

describe('a round settled (20.10.1, 14.S15)', () => {
  it('a round Claude settled ends the phase settled, what went to the inbox listed, the banner done', () => {
    secondRoundReady({ '1-cards-a': ['bug: The receipt is never sent.'], '1-cards-b': ['bug: A card\'s expiry is checked nowhere.'] });
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
    const { view, banner } = board();

    assert.deepStrictEqual({ round: view.round, verdict: view.verdict, inbox: view.inbox, state: banner.state, fact: banner.facts.at(-1) }, {
      round: 2, verdict: 'settled', inbox: ['A card\'s expiry is checked nowhere.'], state: 'done', fact: { text: 'round 2 settled', needs: false },
    });
  });
});

describe('a finding\'s and a check\'s pages (20.10.3)', () => {
  it('a finding of a recorded round in full: its area, scope, call, words and the fix task it went to; one the round lacks unavailable, saying why', () => {
    firstRoundReady();
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });

    assert.deepStrictEqual([board(['--page', 'finding:1:1']).view, board(['--page', 'finding:1:2']).view], [
      { kind: 'finding', unit: UNIT, round: 1, finding: 1, area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt is never sent.', fix: '3.1', inbox: null },
      { kind: 'unavailable', reason: 'round 1 of pay\'s review holds no finding 2' },
    ]);
  });

  it('a check the round could not prove: where it stands and its scenario\'s words; one the round never ran unavailable, saying why', () => {
    enter();
    reported(1, EVERY);
    recorded({ can_now: ['Pay by card.'], findings: [] });

    assert.deepStrictEqual([board(['--page', 'check:1:1.S2']).view, board(['--page', 'check:1:3.S1']).view], [
      { kind: 'check', unit: UNIT, round: 1, scenario: '1.S2', standing: 'not proven', text: 'Given a charge, when it lands, then a receipt follows. (1.2.1)' },
      { kind: 'unavailable', reason: 'round 1 of pay\'s review ran no check of 3.S1' },
    ]);
  });
});

describe('the unit\'s tab in the review phase (20.15.1)', () => {
  it('each phase says what its records hold: the spec its sections and the build phases cut, the build its tasks done, the review\'s fix tasks among them, the review its round', () => {
    firstRoundReady();
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);

    assert.deepStrictEqual(board(['--tab', 'unit']).view.phases.slice(2), [
      { phase: 'specification', state: 'complete', words: '2 sections · 2 build phases' },
      { phase: 'build', state: 'complete', words: '4 of 4 tasks done' },
      { phase: 'review', state: 'running', words: 'round 2' },
    ]);
  });
});

describe('the build past the cut (P14, 7.2.4, 12.7.9)', () => {
  it('in step, lists the review\'s fixes after the cut\'s phases, a fix task behind the one in flight, naming it, and the phase whose merge waits at its gate, which the banner leaves to the gate — drawn while a peer holds the writer lock, never trying it', (t) => {
    fixPhaseWritten(3, [['Send the receipt', '§1.2'], ['Send it once', '§1.2']]);
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    ok(dir, ['task', 'start', UNIT, '3.2'], { env: env() });
    cutUnmerged();
    inStep();
    ok(dir, ['enter', 'implementation', UNIT], { env: env() });
    const lock = holdLock(statePath(dir, layout.lock));
    const attempts = lockAttempts(t, lock, () => { throw new Error('the board waited on the writer lock'); });
    const { view, banner } = board();

    assert.deepStrictEqual([
      view.phases.map(({ phase, name, state, tasks }) => [phase, name, state, tasks.map(({ task, state: stands, on }) => [task, stands, ...on].join(' '))]),
      view.progress.running, banner.facts.map(({ text }) => text), attempts,
    ], [
      [
        [1, 'Cards', 'complete', ['1.1 done', '1.2 done', '1.3 closed']],
        [2, 'Refunds', 'merging', ['2.1 done', '2.2 done']],
        [3, 'the review\'s fixes, round 1', 'running', ['3.1 building', '3.2 behind 3.1']],
      ],
      1, ['feature', 'build', '1 building'], [],
    ]);
  });

  it('in step, shows a fix phase merging once its fix tasks are done and its stack waits at its merge gate', () => {
    firstRoundFailed();
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    inStep();
    ok(dir, ['enter', 'implementation', UNIT], { env: env() });

    assert.deepStrictEqual(board().view.phases.map(({ phase, state }) => [phase, state]), [[1, 'complete'], [2, 'complete'], [3, 'merging']]);
  });

  it('draws This session, the unit\'s tab and All work at round 1 reading and after a failed round, every fix phase the build may yet write read as not written, while a peer holds the writer lock, never trying it', (t) => {
    enter();
    const lock = statePath(dir, layout.lock);
    const attempts = lockAttempts(t, lock, () => { throw new Error('the board waited on the writer lock'); });
    const drawn = () => {
      holdLock(lock);
      const from = attempts.length;
      const kinds = [[], ['--tab', 'unit'], ['--tab', 'all']].map((args) => board(args).view.kind);
      fs.rmSync(lock);
      return [kinds, attempts.slice(from)];
    };
    const reading = drawn();
    firstRoundFailed();

    assert.deepStrictEqual([reading, drawn()], [[['review', 'unit', 'all'], []], [['review', 'unit', 'all'], []]]);
  });
});

describe('what it writes (20.1)', () => {
  it('nothing: the review phase\'s view, its fix tasks read from the tracker, leaves the state, its branch and the project\'s HEAD as they were', () => {
    firstRoundReady();
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    enter();
    const standing = () => ({ tree: treeSnapshot(dir), state: stateHead(dir), project: git(dir, ['rev-parse', 'HEAD']).trim() });
    const before = standing();
    const { view } = board();

    assert.deepStrictEqual({ fixes: view.fixes?.tasks.length, after: standing() }, { fixes: 1, after: before });
  });
});
