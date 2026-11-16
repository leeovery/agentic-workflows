'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a unit's cancel (18.3.9; leeway-engine/
// scripts/domain/landing.cjs, `cancelClose`, over drivers/landing/github/,
// the record domain/cancel-closed.cjs), past what every driver does
// (test-engine-landing-conformance-cancel.cjs): the pull requests it
// closes recorded on the unit by their numbers, an entry for each cancel,
// on one read of the pull requests, the receipt naming the latest's, and
// its confirm saying the close only while the project lands through
// GitHub, not once it lands locally; a
// unit holding no branch of its own, and a quick-fix whose fixes have not
// begun, asking GitHub nothing; a cancel GitHub stops part way refused as
// the cancel's, the unit left in progress, what it closed recorded and
// committed alone, read as none by a landing before the cancel is run
// again, and run again recording the rest, so after a reactivate each
// opens anew; a merge after a reactivate opening again only its own
// phase's tasks done, never one given up; a stack whose lower task was
// merged by hand before the cancel landing as it would with no cancel, that
// task never opened again; and a pull request the cancel closed that the
// person reopens read as open. Across
// nested clones: test-landing-cancel-nested.cjs. Git layer: the landing
// world on a fake GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readManifest, output, sectionOf, git, statePath } = require('../../scripts/engine-harness.cjs');
const { createManifest } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, TASKS, TRACKER, openArgs, own, mergeBack, useLandingWorld, phaseReviewed, setLandingDriver } = require('../../scripts/landing-world.cjs');
const { parseShownTask } = require('../../../skills/leeway-engine/scripts/domain/task-id.cjs');
const side = require('./landing.cjs');
const { GH_ENV, calls, github, onGithub, ok, refused } = require('./world.cjs');

const { card, total, rounding } = TASKS;

const project = useLandingWorld('github-landing-cancel-', side.prepare);

/** The gh calls made since `before` of them, each by its first two words. @param {string} dir @param {number} before */
const madeSince = (dir, before) => calls(dir).slice(before).map((call) => call.split(' ').slice(0, 2).join(' '));

/** The record of what each cancel closed, each repository's numbers in order. @param {string} dir */
const recorded = (dir) => (readManifest(dir, UNIT).closed_by_cancel ?? []).map((/** @type {Record<string, string[]>} */ closes) => Object.fromEntries(Object.entries(closes).map(([repo, names]) => [repo, [...names].sort()])));

/** The cancel receipt's line naming the pull requests it closed. @param {string} dir */
const closedLine = (dir) => sectionOf(output(dir, ['render', 'workunit-receipt', UNIT, '--verb', 'cancel'], { env: GH_ENV }), 'DISPLAY: confirmation').split('\n').find((line) => line.includes('pull requests were closed'));

/** The pull requests on GitHub, `{number}: {state} {task}`. @param {string} dir */
const pulls = (dir) => github(dir).pulls.map(({ number, state, head }) => `${number}: ${state} ${head}`);

/**
 * Each of `tasks` ended in the tracker as `end` ends it, the state committed.
 * @param {string} dir @param {{shown: string}[]} tasks @param {(root: string, ref: import('../../../skills/leeway-engine/scripts/domain/task-id.cjs').TaskRef) => void} [end]
 */
function ended(dir, tasks, end = (root, ref) => TRACKER.done(root, ref)) {
  for (const { shown } of tasks) {
    const ref = parseShownTask(UNIT, shown);
    TRACKER.start(statePath(dir), ref);
    end(statePath(dir), ref);
  }
  git(statePath(dir), ['add', '-A']);
  git(statePath(dir), ['commit', '-q', '-m', 'the tasks ended']);
}

/** Phase 1's two tasks opened as a stack, 1.1 on 1.2. @param {string} dir */
function stacked(dir) {
  ok(dir, openArgs(total));
  mergeBack(dir, card.branch, total.branch);
  ok(dir, openArgs(card));
}

describe('GitHub\'s landing driver and a unit\'s cancel (18.3.9)', () => {
  it('the pull requests a cancel closes are recorded on the unit by their numbers, an entry for each cancel, on one read of the pull requests, the receipt naming the latest\'s; cancelled again after a reactivate, the reads pass over both entries\', so each task opens anew', () => {
    const dir = project();
    stacked(dir);
    const before = calls(dir).length;

    ok(dir, ['workunit', 'cancel', UNIT]);
    const first = { made: madeSince(dir, before), line: closedLine(dir) };
    ok(dir, ['workunit', 'reactivate', UNIT]);
    for (const task of [total, card]) ok(dir, openArgs(task));
    ok(dir, ['workunit', 'cancel', UNIT]);
    const second = closedLine(dir);
    ok(dir, ['workunit', 'reactivate', UNIT]);
    const opened = [total, card].map((task) => ok(dir, openArgs(task)).already === true);
    const says = () => output(dir, ['render', 'cancel-gate', UNIT], { env: GH_ENV }).includes('It closes its open pull requests');
    const gates = [says()];
    setLandingDriver(dir, 'local');
    gates.push(says());

    assert.deepStrictEqual(gates, [true, false]);
    assert.deepStrictEqual(first, { made: ['pr list', 'pr close', 'pr close'], line: '⚑ Its open pull requests were closed, each branch kept: #1, #2' });
    assert.deepStrictEqual([recorded(dir), second, opened], [[{ '.': ['1', '2'] }, { '.': ['3', '4'] }, {}], '⚑ Its open pull requests were closed, each branch kept: #3, #4', [false, false]]);
  });

  it('a cancel GitHub stops part way is refused as the cancel\'s, its way on the cancel again, the unit in progress and what it closed recorded and committed alone; the build carrying on reads the one it closed as none, opening its task anew; run again it records the rest beside it, and after a reactivate each task opens anew', () => {
    const dir = project();
    stacked(dir);

    const refusal = refused(dir, ['workunit', 'cancel', UNIT], { GH_STUB_FAULT: 'offline@pr close 1' });
    const left = {
      status: readManifest(dir, UNIT).status,
      record: recorded(dir),
      commit: git(statePath(dir), ['log', '-1', '--format=%s']).trim(),
      uncommitted: git(statePath(dir), ['status', '--porcelain']).trim(),
    };
    const carried = ok(dir, openArgs(card)).already === true;
    ok(dir, ['workunit', 'cancel', UNIT]);
    const record = recorded(dir);
    ok(dir, ['workunit', 'reactivate', UNIT]);
    const opened = [total, card].map((task) => ok(dir, openArgs(task)).already === true);

    assert.match(refusal, /^cancel: .* — cancel again once the network is back$/);
    assert.deepStrictEqual(left, { status: 'in-progress', record: [{ '.': ['2'] }], commit: `workflow(${UNIT}): record the pull requests its cancel closed`, uncommitted: '' });
    assert.deepStrictEqual([carried, record, opened], [false, [{ '.': ['1', '2', '3'] }], [false, false]]);
  });

  it('after a reactivate, `land phase` opens again only its own phase\'s tasks done: never one given up, nor another phase\'s', () => {
    const dir = project();
    for (const task of [card, rounding]) ok(dir, openArgs(task));
    ended(dir, [card, rounding]);
    ended(dir, [total], (root, ref) => TRACKER.close(root, ref, 'given up'));
    ok(dir, ['workunit', 'cancel', UNIT]);
    ok(dir, ['workunit', 'reactivate', UNIT]);

    const merged = own(ok(dir, ['land', 'phase', UNIT, '1'])).merged;

    assert.deepStrictEqual([merged, side.tasksOpen(dir)], [['1.1'], []]);
  });

  it('a stack whose lower task was squashed on GitHub by hand and pulled before the cancel lands after the reactivate as it would with no cancel, that task never opened again: the upper opens onto the default branch, its change laid from the lower\'s head', () => {
    const dir = project();
    stacked(dir);
    ended(dir, [card, total]);
    side.byHand['a squash on GitHub, pulled'](dir, total.branch);
    ok(dir, ['workunit', 'cancel', UNIT]);
    ok(dir, ['workunit', 'reactivate', UNIT]);
    phaseReviewed(dir, 1, 'auto');

    const merged = own(ok(dir, ['land', 'phase', UNIT, '1'])).merged;

    assert.deepStrictEqual([merged, pulls(dir)], [['1.1'], [`1: MERGED ${total.branch}`, `2: CLOSED ${card.branch}`, `3: MERGED ${card.branch}`]]);
    assert.strictEqual(git(side.on(dir), ['show', 'main:card.txt']), card.files['card.txt']);
  });

  it('a pull request the cancel closed that the person reopens on GitHub is read as open: the task\'s opening finds it there', () => {
    const dir = project();
    ok(dir, openArgs(total));
    ok(dir, ['workunit', 'cancel', UNIT]);
    ok(dir, ['workunit', 'reactivate', UNIT]);
    onGithub(dir, (state) => {
      for (const pull of state.pulls) pull.state = 'OPEN';
    });

    assert.strictEqual(ok(dir, openArgs(total)).already, true);
  });

  it('a unit holding no branch of its own, as one cancelled in its discussion, and a quick-fix whose fixes have not begun ask GitHub nothing and close nothing; a unit with branches but none opened is not told a close at its confirm', () => {
    const dir = project();
    createManifest(dir, 'other', {});
    createManifest(dir, 'typo', { work_type: 'quick-fix' });
    const before = calls(dir).length;

    const gate = output(dir, ['render', 'cancel-gate', UNIT], { env: GH_ENV });
    const cancelled = ['other', 'typo'].map((unit) => ok(dir, ['workunit', 'cancel', unit]).pull_requests_closed);

    assert.deepStrictEqual([cancelled, madeSince(dir, before), gate.includes('pull requests')], [[false, false], [], false]);
  });
});
