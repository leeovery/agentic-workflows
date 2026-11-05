'use strict';

// ---------------------------------------------------------------------------
// `engine board` in the review phase (leeway-engine/scripts/domain/
// projections/board-review.cjs, 20.10): the round under way, each area by
// its reports and the briefs this conversation issued for it in that round;
// and the build past the cut in step, its fix phase with a task behind the
// one in flight and the phase whose merge waits. A round recorded or
// settled is test-engine-board-review-rounds.cjs; where the review stands
// on every view, test-engine-board-review-standing.cjs.
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
  UNIT, SESSION_ID, EVERY, RECEIPT, FOUND, FAILING, useWorld, env, enter, inStep, reportText, reported, named, recorded, issued, fixPhaseWritten, cutUnmerged, fixBranch, fixBuilt, firstRoundFailed, commitFile, ok, writeState, statePath, git,
} = require('./review-world.cjs');
const { withEnv, holdLock, lockAttempts, layout } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { runsRel } = require(path.join(SCRIPTS, 'domain/runs.cjs'));
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

/** Finish, waiting on the person, as the unit's one list holds it. */
const FINISH = { kind: 'finish', id: 'finish', text: 'Finish: the report of every round, and your verdict on each call you changed', page: null };

/** The view's head: the unit, the project and the tasks built, finish waiting where `finish` says, no question waiting. @param {number} round @param {boolean} [finish] */
const head = (round, finish = false) => ({ kind: 'review', unit: UNIT, title: 'Pay', project: projectName(dir), type: 'feature', built: 3, round, waiting: finish ? [FINISH] : [], stopped: false });

/** The banner's facts, each plain unless flagged. @param {...(string|[string])} facts */
const facts = (...facts) => facts.map((fact) => (typeof fact === 'string' ? { text: fact, needs: false } : { text: fact[0], needs: true }));

describe('the round under way (20.10.1)', () => {
  it('each area is waiting, being read since its brief was issued in this conversation (P15), or read with every finding its reports hold, as FOUND lists them (N5); FOUND each finding a landed report holds, by its call and report item, unnumbered; NOT PROVEN each scenario not proven at the change\'s tips — its work not landed among them, a later run on code since amended counting for nothing — as the round will judge it, and so its check\'s page, wherever the session has gone (N3); the banner says the round reads (N2)', () => {
    enter();
    const { res } = issued(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a']);
    const since = fs.statSync(issuedOf(res.id)).mtime.toISOString();
    reported(1, ['2-refunds'], { '2-refunds-a': ['bug: A refund is lost.'], '2-refunds-b': ['bug: A refund is lost.', 'nit: A name.'] });
    cutUnmerged();
    git(dir, ['checkout', '-q', '-b', 'amended', 'main~1']);
    commitFile(dir, 'src/receipt-again.js');
    git(dir, ['checkout', '-q', 'main']);
    const ranAt = (/** @type {string} */ name, /** @type {string} */ verdict, /** @type {string} */ ref) => writeState(dir, `${runsRel(UNIT, '1.S2')}/${name}.json`, JSON.stringify({
      verdict, unfixed: false, at: '2026-11-02T10:00:00.000Z', checkout: dir, commits: [{ repo: '.', commit: git(dir, ['rev-parse', ref]).trim() }], task: null, evidence: [], recordings: [],
    }));
    ranAt('run-002', 'pass', `refs/heads/${fixBranch(2, 2, 'Refund twice')}`);
    ranAt('run-003', 'fail', 'refs/heads/amended');
    const reading = board();
    ok(dir, ['session', 'label', 'roadmap'], { env: env() });

    assert.deepStrictEqual(board(['--page', 'check:1:1.S2', '--page-unit', UNIT]).view.standing, 'proven');
    assert.deepStrictEqual(reading, {
      view: {
        ...head(1),
        built: 4,
        recorded: false,
        areas: [area('1', 'Cards', 'reading', { since }), area('2', 'Refunds', 'read', { found: 3 }), tests('waiting')],
        found: [
          { round: 1, finding: null, from: '2-refunds-a#1', area: '2-refunds', call: 'bug', text: 'A refund is lost.' },
          { round: 1, finding: null, from: '2-refunds-b#1', area: '2-refunds', call: 'bug', text: 'A refund is lost.' },
          { round: 1, finding: null, from: '2-refunds-b#2', area: '2-refunds', call: 'nit', text: 'A name.' },
        ],
        not_proven: [
          { round: 1, scenario: '2.S1', standing: 'named, not run', text: 'Given a charge, when it is refunded whole, then the card is credited.' },
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
