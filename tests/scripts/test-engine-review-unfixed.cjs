'use strict';

// ---------------------------------------------------------------------------
// A bugfix's review phase and its runs on the unfixed code (leeway-engine/
// scripts/domain/review-entry.cjs and review-round.cjs, their rule
// bug-proven.cjs): the entry's DATA names the build's series — its
// scenario, its command, its failures and the commits it ran at, then each
// of its runs — or that the build recorded none, and while round 1 is under
// review how the test's runs on the unfixed code since the review began
// went, or the call that runs it; `review round` refuses round 1 until one
// is recorded, and one that passed is an item of the round, `unfixed#1`,
// serious, which a finding answers, and the round fails (15.5.6, 15.S20).
// The runs themselves are test-engine-verify-unfixed.cjs's; a unit of
// another type, whose DATA holds none of this, test-engine-review-entry.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test, its unit
// made a bugfix and its runs on the unfixed code written by hand: the
// build's series task 1.1's, a re-run no task's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const path = require('path');
const {
  UNIT, ENGINE, EVERY, useWorld, enter, reported, recorded, refusedRound, fixPhaseWritten,
  statePath, writeState, readManifest, createManifest, git, assert,
} = require('./review-world.cjs');

const { runsRel } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/runs.cjs'));

/** @type {string} */
let dir;
useWorld((at) => {
  dir = at;
  createManifest(dir, UNIT, { ...readManifest(dir, UNIT), work_type: 'bugfix' });
});

const TEST = 'sh test/crash.sh';

/** The run's file, state-relative, by its number; the world's 1.S1 holds run 1. @param {number} n */
const runFile = (n) => `${runsRel(UNIT, '1.S1')}/run-${String(n).padStart(3, '0')}.json`;

/**
 * Runs of the test on the unfixed code at main, written as `verify run …
 * --unfixed` records them, numbered from `from`: in the build task 1.1's,
 * in the review phase no task's.
 * @param {number} from @param {('pass'|'fail')[]} verdicts @param {string|null} task
 */
function unfixedRan(from, verdicts, task) {
  const main = git(dir, ['rev-parse', 'main']).trim();
  verdicts.forEach((verdict, at) => writeState(dir, runFile(from + at), JSON.stringify({
    verdict, unfixed: true, command: TEST, at: `2026-11-02T10:${String(from + at).padStart(2, '0')}:00.000Z`, checkout: dir, commits: [{ repo: '.', commit: main }], task, evidence: [{ name: 'output', text: '' }], recordings: [],
  })));
}

/** The build's series: five failures, runs 2 to 6. */
const seriesRan = () => unfixedRan(2, Array(5).fill('fail'), '1.1');

/** The entry's lines on the unfixed code: from the series' to the base line they sit before. */
function bugLines() {
  const lines = enter().sections.split('\n');
  return lines.slice(lines.findIndex((line) => line.startsWith('unfixed series: ')), lines.findIndex((line) => line.startsWith('base: ')));
}

/** The series' lines, as the entry names it. */
const seriesLines = () => [
  `unfixed series: 1.S1, \`${TEST}\` — 5 of its 5 runs failing on the unfixed code, the project at ${git(dir, ['rev-parse', '--short=7', 'main']).trim()}`,
  ...[2, 3, 4, 5, 6].map((n) => `unfixed run: ${statePath(dir, runFile(n))}`),
];

/** Round 1's account with no finding. */
const NOTHING = Object.freeze({ can_now: ['Pay by card.'], findings: [] });

describe('enter review: a bugfix\'s runs on the unfixed code (15.5.6)', () => {
  it('15.S20: names the build\'s series — its scenario, its command, its failures and the commits it ran at — and each of its runs, then that round 1 waits on the test run on the unfixed code again, naming the call', () => {
    seriesRan();

    assert.deepStrictEqual(bugLines(), [
      ...seriesLines(), `rerun: not yet — round 1 is recorded once the test runs on the unfixed code again, where it must fail: \`${ENGINE} verify run ${UNIT} 1.S1 --unfixed --test '${TEST}'\``,
    ]);
  });

  it('names how the runs since the review began went: every one failing, or one passing — the finding round 1 carries', () => {
    seriesRan();
    unfixedRan(7, ['fail'], null);
    const failing = bugLines().at(-1);
    unfixedRan(8, ['pass'], null);

    assert.deepStrictEqual([failing, bugLines().at(-1)], [
      'rerun: 1 since the review began, every one failing', 'rerun: 2 since the review began, one passing — unfixed#1, a finding round 1 carries, so it fails',
    ]);
  });

  it('once round 1 is recorded, names the series alone', () => {
    seriesRan();
    unfixedRan(7, ['fail'], null);
    enter();
    reported(1, EVERY);
    recorded(NOTHING);

    assert.deepStrictEqual(bugLines(), seriesLines());
  });

  it('a build that recorded no series says so, the call naming a first', () => {
    assert.deepStrictEqual(bugLines(), [
      'unfixed series: none — the build recorded no run of the reproducing test on the unfixed code',
      `rerun: not yet — round 1 is recorded once the test runs on the unfixed code again, where it must fail: \`${ENGINE} verify run ${UNIT} <scenario> --unfixed --test '<the command that runs that test alone>'\``,
    ]);
  });
});

describe('review round: a bugfix\'s round 1 (15.5.6)', () => {
  it('15.S20: refused, writing nothing, while the test has not run on the unfixed code again since the review began — the build\'s series alone — naming the call that runs it', () => {
    seriesRan();
    enter();
    reported(1, EVERY);

    assert.strictEqual(refusedRound(NOTHING), `review round: ${UNIT} is a bugfix, and round 1 is recorded once the test that reproduces its bug has run on the unfixed code again since the review began, where it must fail (15.5.6): engine verify run ${UNIT} 1.S1 --unfixed --test '${TEST}'`);
  });

  it('a re-run that failed, the round is recorded as ever, passing with its reports', () => {
    seriesRan();
    unfixedRan(7, ['fail'], null);
    enter();
    reported(1, EVERY);

    assert.strictEqual(recorded(NOTHING).passed, true);
  });

  it('a re-run that passed is unfixed#1, serious, which a finding answers, and the round fails though every report passes', () => {
    seriesRan();
    unfixedRan(7, ['pass'], null);
    enter();
    reported(1, EVERY);
    fixPhaseWritten(3, [['Rework the reproducing test', '§1.1']]);
    const reworked = { area: 'tests', scope: 'in', text: 'The reproducing test passes on the unfixed code.', from: ['unfixed#1'], fix: '3.1' };

    assert.deepStrictEqual([refusedRound(NOTHING), refusedRound({ ...NOTHING, findings: [{ ...reworked, call: 'bug' }] })], [
      'review round: unfixed#1 is answered by no finding — every item of every report lands in the round\'s record (14.3.1)',
      'review round: finding 1 is a bug, and the report items it answers call it a serious',
    ]);
    const res = recorded({ ...NOTHING, findings: [{ ...reworked, call: 'serious' }] });
    assert.deepStrictEqual([res.passed, res.fixes], [false, ['3.1']]);
  });
});
