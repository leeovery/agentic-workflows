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
const { withEnv, treeSnapshot, head: stateHead, holdLock, lockAttempts, layout, okSectionsAsync } = require('./engine-harness.cjs');
const { MADE } = require('./ledger-world.cjs');
const { fixture, misfits } = require('./board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));

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

/** The view's head: the unit, the project and the tasks built, finish waiting where `finish` says, no question waiting. @param {number} round @param {boolean} [finish] */
const head = (round, finish = false) => ({ kind: 'review', unit: UNIT, title: 'Pay', project: projectName(dir), type: 'feature', built: 3, round, finish, waiting: [], stopped: false });

/** The banner's facts, each plain unless flagged. @param {...(string|[string])} facts */
const facts = (...facts) => facts.map((fact) => (typeof fact === 'string' ? { text: fact, needs: false } : { text: fact[0], needs: true }));

describe('the round under way (20.10.1)', () => {
  it('each area is waiting, being read since its brief was issued in this conversation (P15), or read with what its reports found; FOUND each finding a landed report holds, by its call, unnumbered; NOT PROVEN each scenario its latest runs do not prove, a page away from none; the banner says the round reads (N2)', () => {
    enter();
    const { res } = issued(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a']);
    const since = fs.statSync(issuedOf(res.id)).mtime.toISOString();
    reported(1, ['2-refunds'], { '2-refunds-b': ['bug: A refund is lost.', 'nit: A name.'] });

    assert.deepStrictEqual(board(), {
      view: {
        ...head(1),
        recorded: false,
        areas: [area('1', 'Cards', 'reading', { since }), area('2', 'Refunds', 'read', { found: 2 }), tests('waiting')],
        found: [
          { round: 1, finding: null, area: '2-refunds', call: 'bug', text: 'A refund is lost.' },
          { round: 1, finding: null, area: '2-refunds', call: 'nit', text: 'A name.' },
        ],
        not_proven: [
          { round: null, scenario: '1.S2', standing: 'not proven', text: 'Given a charge, when it lands, then a receipt follows.' },
          { round: null, scenario: '2.S1', standing: 'named, not run', text: 'Given a charge, when it is refunded whole, then the card is credited.' },
        ],
        inbox: [],
        verdict: null,
        fixes: null,
      },
      banner: { name: 'Pay', state: 'running', facts: facts('feature', 'review', 'round 1 reading') },
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

/** Round 1 recorded failing: area 1's receipt fixed by task 3.1, not yet built, and a card's expiry, out of scope, filed to the inbox. */
function roundOneFiled() {
  enter();
  reported(1, EVERY, { '1-cards-a': ['bug: The receipt is never sent.'], '1-cards-b': ['bug: A card\'s expiry is checked nowhere.'] });
  fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
  const call = reviewCall('Filed: a card\'s expiry is checked nowhere.', 'It is a gap beside the change.');
  const item = filed({ kind: 'idea', text: '# Card expiry\n\nNo screen checks a card\'s expiry.', call });
  recorded({
    can_now: ['Pay by card.'],
    findings: [RECEIPT, { area: '1-cards', scope: 'out', call: 'bug', text: 'A card\'s expiry is checked nowhere.', from: ['1-cards-b#1'], inbox: item.filed, ledger: call }],
  });
  enter();
}

describe('a round recorded (20.10.1, 20.10.2)', () => {
  it('a failing round shows its finding in scope, its verdict and its fix tasks as the build\'s phase after the cut until the next round opens; open, the next waits on the areas they changed, every other unchanged, the fix task built counted among the tasks built (20.10.2); the banner says the round fails, its fix tasks building while any is not done, then the next round reading (D36)', () => {
    firstRoundReady();
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    enter();
    const { view: failed, banner: failing } = board();
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    const built = board().banner;
    named(['1-cards']);
    const found = [{ round: 1, finding: 1, area: '1-cards', call: 'bug', text: 'The receipt is never sent.' }];
    const fixes = (/** @type {string} */ state) => ({ phase: 3, round: 1, tasks: [{ task: '3.1', title: 'Send the receipt', state, since: null, on: [] }] });

    assert.deepStrictEqual([failed, board().view], [
      {
        ...head(1), recorded: true, areas: [area('1', 'Cards', 'read', { ran: 2, found: 1 }), area('2', 'Refunds', 'read', { ran: 1 }), tests('read')], found, not_proven: failed.not_proven, inbox: [], verdict: 'failed', fixes: fixes('not-started'),
      },
      {
        ...head(2), built: 4, recorded: false, areas: [area('1', 'Cards', 'waiting'), area('2', 'Refunds', 'unchanged'), tests('unchanged')], found: [], not_proven: failed.not_proven, inbox: [], verdict: null, fixes: fixes('done'),
      },
    ]);
    assert.deepStrictEqual(failed.not_proven.map(/** @param {{round: number}} check */ ({ round }) => round), [1, 1], 'round 1\'s checks stand under round 2 until it is recorded (N2)');
    assert.deepStrictEqual([failing, built, board().banner].map(({ state, facts: said }) => [state, said.at(-1).text]), [
      ['running', 'round 1 fails · fix tasks building'],
      ['running', 'round 1 fails'],
      ['running', 'round 2 reading'],
    ]);
  });

  it('a later round under way shows only what its own landed reports found, round 1\'s checks not proven, what round 1 filed to the inbox and round 1\'s fix tasks; recorded passing, it keeps those fix tasks and that filing (N2)', () => {
    roundOneFiled();
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    reported(2, ['1-cards'], { '1-cards-a': ['nit: The receipt says Reciept.'] });
    const reading = board().view;
    const filedOne = [{ round: 1, finding: 2, text: 'A card\'s expiry is checked nowhere.' }];

    assert.deepStrictEqual(
      [reading.found, reading.not_proven.map(({ round }) => round), reading.inbox, [reading.fixes.phase, reading.fixes.round]],
      [[{ round: 2, finding: null, area: '1-cards', call: 'nit', text: 'The receipt says Reciept.' }], [1, 1], filedOne, [3, 1]],
    );
    reported(2, ['1-cards']);
    recorded({ can_now: ['Pay by card.'], findings: [] });
    const passed = board().view;

    assert.deepStrictEqual([passed.verdict, passed.found, passed.inbox, [passed.fixes.phase, passed.fixes.round]], ['passed', [], filedOne, [3, 1]]);
  });

  it('the next round reads only the areas its fix tasks changed, every other unchanged, not read again (20.S11)', () => {
    secondRoundReady();

    assert.deepStrictEqual(board().view.areas, [area('1', 'Cards', 'read'), area('2', 'Refunds', 'unchanged'), tests('unchanged')]);
  });

  it('a round that passed shows what it found, what could not be proven with its scenario\'s words, and its verdict; the phase over, finish waits on the person, and the banner flags it (D18, D37)', () => {
    enter();
    reported(1, EVERY);
    recorded({ can_now: ['Pay by card.'], findings: [] });

    assert.deepStrictEqual(board(), {
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
      banner: { name: 'Pay', state: 'needs', facts: facts('feature', 'review', 'finish waits on you', ['1 waiting on you']) },
    });
  });

  it('the reviews the mod reads are shaped as the engine answers them, every list holding one at least: round 1 failed, with its finding, fix task, checks not proven and what it filed; and round 2 passed after it, finish waiting on the person (N7)', async () => {
    roundOneFiled();
    const failed = board().view;
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    reported(2, ['1-cards']);
    recorded({ can_now: ['Pay by card.'], findings: [] });
    const passed = board().view;
    const held = (/** @type {any} */ view) => [view.found.length > 0, view.not_proven.length > 0, view.inbox.length > 0, view.fixes?.tasks.length > 0];
    const [failing, ended] = [await fixture('board-review-failed.mjs'), await fixture('board-review.mjs')];

    assert.deepStrictEqual(
      [misfits(failing, failed), misfits(ended, passed), held(failing), held(failed), held(ended).slice(1), held(passed).slice(1)],
      [[], [], [true, true, true, true], [true, true, true, true], [true, true, true], [true, true, true]],
    );
  });

  it('a round that passed with its nits to fix passes, finish not yet waiting while its fix tasks build (D36)', () => {
    enter();
    reported(1, EVERY, { '1-cards-a': ['nit: The receipt says Reciept.'] });
    fixPhaseWritten(3, [['Spell the receipt', '§1.2']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '1-cards', scope: 'in', call: 'nit', text: 'The receipt says Reciept.', from: ['1-cards-a#1'], fix: '3.1' }] });
    const { view, banner } = board();

    assert.deepStrictEqual([view.verdict, view.finish, banner], ['passed', false, { name: 'Pay', state: 'running', facts: facts('feature', 'review', 'round 1 passes') }]);
  });

  it('once finish completes the unit from its review phase, This session is All work at the start menu, the banner the unit\'s close, through the boot that brings the start menu, until the session goes somewhere (20.10.4, D38)', () => {
    enter();
    reported(1, EVERY);
    recorded({ can_now: ['Pay by card.'], findings: [] });
    ok(dir, ['checklist', 'skip', 'phase-start', UNIT, '1', 'design-settled', '--reason', 'One task alone.'], { env: env() });
    ok(dir, ['checklist', 'skip', 'finish', UNIT, 'inbox-closed', '--reason', 'No inbox item was resolved.'], { env: env() });
    ok(dir, ['checklist', 'done', 'finish', UNIT, 'build-log-closed'], { env: env() });
    ok(dir, ['checklist', 'close', 'finish', UNIT], { env: env() });
    ok(dir, ['finish', 'yes', UNIT], { env: env() });
    const read = () => {
      const { view, banner, unit, questions } = ok(dir, ['board', SESSION_ID], { env: env() });
      return { view: [view.kind, view.at_start, view.complete.map(/** @param {{unit: string}} done */ ({ unit: done }) => done)], banner, unit, questions };
    };
    const finished = read();
    ok(dir, ['boot'], { env: env() });
    const booted = read();
    ok(dir, ['session', 'label', 'roadmap'], { env: env() });
    const close = { name: 'Pay', state: 'done', facts: facts('feature', 'complete', 'at the start menu') };

    assert.deepStrictEqual([finished, booted, read().banner], [
      { view: ['all', true, [UNIT]], banner: close, unit: { unit: UNIT, title: 'Pay' }, questions: [] },
      { view: ['all', true, [UNIT]], banner: close, unit: null, questions: [] },
      { name: projectName(dir), state: 'idle', facts: facts('roadmap') },
    ]);
  });

  it('This session follows the session from its build into its review phase (20.3.4)', () => {
    ok(dir, ['enter', 'implementation', UNIT], { env: env() });
    const inBuild = board().view.kind;
    enter();

    assert.deepStrictEqual([inBuild, board().view.kind], ['build', 'review']);
  });
});

/** A question of the product's that a fix task's builder raises. */
const MAILED = {
  question: 'Is the receipt mailed or printed?',
  rows: [
    { key: '1', name: 'Mailed', text: 'The receipt is mailed', notice: 'the customer finds it in their inbox' },
    { key: '2', name: 'Printed', text: 'The receipt is printed', notice: 'the till prints it' },
  ],
  lean: '1',
  why: 'A customer keeps proof.',
  sort: 'several',
  mechanism: 'The gateway mails the receipt.',
  product_wide: false,
};

describe('a question its fix tasks wait on (20.5.3, 20.2.4, S1)', () => {
  it('a question parking the only fix task stands in the review phase as in the build: among the questions a press queues, the view waiting on it and stopped, the banner stopped with the count flagged, and the task\'s page naming it', async () => {
    firstRoundFailed();
    enter();
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const question = ok(dir, ['ledger', 'ask', `${UNIT}.review`], { env: env(), stdin: JSON.stringify({ ...MADE, text: MAILED.question }) }).id;
    await okSectionsAsync(dir, ['raise', `${UNIT}.review`, '--answers', question, '--parks', '3.1'], { env: env(), stdin: JSON.stringify(MAILED) });
    const { view, banner, questions } = ok(dir, ['board', SESSION_ID], { env: env() });

    assert.deepStrictEqual({
      questions: questions.map(/** @param {{question: string, parks: {task: string}[]}} held */ ({ question: number, parks }) => [number, parks.map(({ task }) => task)]),
      view: [view.kind, view.waiting, view.stopped],
      banner,
      page: board(['--page', 'task:3.1']).view.questions,
    }, {
      questions: [['Q1', ['3.1']]],
      view: ['review', ['Q1'], true],
      banner: { name: 'Pay', state: 'needs', facts: facts('feature', 'review', 'stopped', 'round 1 fails · fix tasks building', ['1 waiting on you']) },
      page: ['Q1'],
    });
  });

  it('the fix task\'s page the mod reads is shaped as the engine answers a parked fix task\'s, the questions parking it and what it fixes held by both (N7)', async () => {
    firstRoundFailed();
    enter();
    ok(dir, ['task', 'start', UNIT, '3.1'], { env: env() });
    const question = ok(dir, ['ledger', 'ask', `${UNIT}.review`], { env: env(), stdin: JSON.stringify({ ...MADE, text: MAILED.question }) }).id;
    await okSectionsAsync(dir, ['raise', `${UNIT}.review`, '--answers', question, '--parks', '3.1'], { env: env(), stdin: JSON.stringify(MAILED) });
    const page = board(['--page', 'task:3.1']).view;
    const held = await fixture('board-task-fix.mjs');
    const lists = (/** @type {any} */ view) => [view.questions.length > 0, view.fixes.length > 0];

    assert.deepStrictEqual([misfits(held, page), lists(held), lists(page)], [[], [true, true], [true, true]]);
  });
});

describe('a round settled (20.10.1, 14.S15)', () => {
  it('a round Claude settled ends the phase settled, what went to the inbox listed by its finding, and finish waits on the person (D37)', () => {
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

    assert.deepStrictEqual({ round: view.round, verdict: view.verdict, finish: view.finish, inbox: view.inbox, state: banner.state, fact: banner.facts.at(-1) }, {
      round: 2, verdict: 'settled', finish: true, inbox: [{ round: 2, finding: 2, text: 'A card\'s expiry is checked nowhere.' }], state: 'needs', fact: { text: '1 waiting on you', needs: true },
    });
  });
});

describe('a finding\'s and a check\'s pages (20.10.3)', () => {
  it('a fix task\'s page lists each finding of the review that went to it, and no other (D17)', () => {
    roundOneFiled();

    assert.deepStrictEqual(board(['--page', 'task:3.1']).view.fixes, [{ round: 1, finding: 1, area: '1-cards', call: 'bug', text: 'The receipt is never sent.' }]);
  });

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
      { kind: 'check', unit: UNIT, round: 1, scenario: '1.S2', standing: 'not proven', text: 'Given a charge, when it lands, then a receipt follows.' },
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
