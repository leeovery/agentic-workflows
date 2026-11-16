'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite for a unit's cancel (18.3.9, 18.S75;
// ledger-engine/scripts/domain/landing.cjs, `cancelClose`, through
// workunit-lifecycle.cjs): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. A
// feature's cancel, its confirm saying so before the yes, closes each of
// its tasks' pull requests open on a host and keeps every branch under its
// own name; reactivated, its branches are
// there, its pull requests stay closed, and its next landing — `land
// phase`, or finish's — opens each task done again, the one below in its
// stack first, and merges them all; a task built on one the cancel closed,
// in progress at the cancel or started after the reactivate, opens onto it
// once done, its `land open` opening that one again first. The confirm
// says the close only where the driver lands through a host. A unit's cancel with a branch of its
// own closes the unit's own pull request, the branch kept here and on the
// host; cancelled mid-build, before its pull request opens, it closes
// nothing of its own. A quick-fix's cancel: test-engine-landing-
// conformance-quick-fix-nested-cancel.cjs; across nested clones, and what
// the host records: tests/drivers/github/test-landing-cancel*.cjs. A driver's side (tests/drivers/{name}/landing.cjs)
// readies the world and reads what is open on a host; this file names no
// driver and no tool. Conformance layer: the landing world
// (landing-world.cjs), and the unit with its own branch, phase 1 landed on
// it (`unitBranchLanded`), each built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture, statePath } = harness;
const { UNIT, TASKS, TRACKER, openArgs, own, mergeBack, buildLanding, unitBranchLanded, reviewReady, finishReady } = require('./landing-world.cjs');
const { parseShownTask } = require('../../skills/ledger-engine/scripts/domain/task-id.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { card, total } = TASKS;
const OWN = `feat/${UNIT}`;

/** Each of `tasks` done in the tracker, as its build ends it, the state committed. @param {string} dir @param {{shown: string}[]} tasks */
function done(dir, tasks) {
  for (const { shown } of tasks) {
    const ref = parseShownTask(UNIT, shown);
    TRACKER.start(statePath(dir), ref);
    TRACKER.done(statePath(dir), ref);
  }
  git(statePath(dir), ['add', '-A']);
  git(statePath(dir), ['commit', '-q', '-m', 'the tasks done']);
}

/** Task 1.1 started in the tracker, as its build starts it, the state committed. @param {string} dir */
function started(dir) {
  TRACKER.start(statePath(dir), parseShownTask(UNIT, card.shown));
  git(statePath(dir), ['add', '-A']);
  git(statePath(dir), ['commit', '-q', '-m', 'task 1.1 started']);
}

/** Every branch of the repository at `dir` past the state's, at its tip. @param {string} dir */
const branchesAt = (dir) => git(dir, ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads/']).split('\n').filter((line) => line !== '' && !line.startsWith('ledger-state '));

for (const { name } of listDrivers('landing')) {
  /** @type {import('./landing-world.cjs').DriverSide & {unitPullOpen: (dir: string) => {base: string, title: string, body: string}[]|null}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, { env: side.env });
  const world = fixtureFrom(`engine-landing-cancel-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  const ownWorld = fixtureFrom(`engine-landing-cancel-own-${name}-`, (dir) => unitBranchLanded(dir, side));

  describe(`a unit's cancel through the ${name} landing driver (18.3.9)`, () => {
    /** @type {string|null} */
    let dir = null;
    afterEach(() => {
      if (dir !== null) cleanupFixture(dir);
      dir = null;
    });

    /** A copy of `from`. @param {() => string} from @returns {string} */
    const project = (from) => {
      dir = from();
      return dir;
    };

    /** Whether the driver lands through a host. @param {string} at */
    const hosted = (at) => side.on(at) !== at;

    /** Phase 1's two tasks opened as a stack, 1.1 on 1.2, both done: what the cancel finds. @param {string} at */
    const stacked = (at) => {
      ok(at, openArgs(total));
      mergeBack(at, card.branch, total.branch);
      ok(at, openArgs(card));
      done(at, [card, total]);
    };

    it('18.S75: a feature\'s cancel closes its two tasks\' pull requests and keeps their branches under their own names; reactivated, its branches are found, its pull requests stay closed, and `land phase` opens each again, the one below in the stack first, and merges them both', () => {
      const at = project(world);
      stacked(at);
      const open = side.tasksOpen(at);
      const branches = branchesAt(at);
      const gate = harness.output(at, ['render', 'cancel-gate', UNIT], { env: side.env });

      const cancelled = ok(at, ['workunit', 'cancel', UNIT]);
      const afterCancel = { open: side.tasksOpen(at), branches: branchesAt(at) };
      ok(at, ['workunit', 'reactivate', UNIT]);
      const afterReactivate = { open: side.tasksOpen(at), branches: branchesAt(at) };
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

      assert.deepStrictEqual([open, cancelled.pull_requests_closed, cancelled.checkout], [hosted(at) ? ['pay-1-1', 'pay-1-2'] : [], hosted(at), undefined]);
      assert.strictEqual(/ It closes its open pull requests, keeping each branch for a reactivate to carry on from\./.test(gate), hosted(at));
      assert.deepStrictEqual(afterCancel, { open: [], branches });
      assert.deepStrictEqual(afterReactivate, { open: [], branches });
      assert.deepStrictEqual([merged, side.landed(at).map(({ task }) => task)], [['1.2', '1.1'], ['pay-1-2', 'pay-1-1']]);
    });

    for (const [when, before] of [['in progress at the cancel', true], ['started after the reactivate', false]]) {
      it(`18.S75: a task ${when}, built on one done whose pull request the cancel closed, opens onto it once done, its \`land open\` opening that one again first, and \`land phase\` lands both`, () => {
        const at = project(world);
        ok(at, openArgs(total));
        done(at, [total]);
        if (before) started(at);
        ok(at, ['workunit', 'cancel', UNIT]);
        ok(at, ['workunit', 'reactivate', UNIT]);
        if (!before) started(at);
        mergeBack(at, card.branch, total.branch);
        TRACKER.done(statePath(at), parseShownTask(UNIT, card.shown));
        git(statePath(at), ['add', '-A']);
        git(statePath(at), ['commit', '-q', '-m', 'task 1.1 done']);

        ok(at, openArgs(card));
        const open = side.tasksOpen(at);
        const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

        assert.deepStrictEqual([open, merged], [hosted(at) ? ['pay-1-1', 'pay-1-2'] : [], ['1.2', '1.1']]);
      });
    }

    it('18.S75: cancelled with its tasks done and open, reactivated, finish\'s landing opens each again and lands them all — nothing lands short of the work done', () => {
      const at = project(world);
      stacked(at);
      finishReady(at);
      ok(at, ['workunit', 'cancel', UNIT]);
      ok(at, ['workunit', 'reactivate', UNIT]);

      ok(at, ['land', 'finish', UNIT]);

      assert.deepStrictEqual(side.landed(at).map(({ task }) => task), ['pay-1-2', 'pay-1-1']);
    });

    it('a unit with a branch of its own: its cancel closes the unit\'s own pull request, the branch kept here and where the driver lands it', () => {
      const at = project(ownWorld);
      reviewReady(at);
      harness.okSections(at, ['enter', 'review', UNIT], { env: side.env });
      const before = { pull: side.unitPullOpen(at) === null, here: tip(at, OWN), there: tip(side.on(at), OWN) };

      const cancelled = ok(at, ['workunit', 'cancel', UNIT]);

      assert.deepStrictEqual([before.pull, cancelled.pull_requests_closed], [!hosted(at), hosted(at)]);
      assert.deepStrictEqual({ pull: side.unitPullOpen(at), here: tip(at, OWN), there: tip(side.on(at), OWN) }, { pull: null, here: before.here, there: before.there });
    });

    it('a unit with a branch of its own cancelled mid-build, before its own pull request opens, closes nothing of its own and keeps the branch', () => {
      const at = project(ownWorld);
      const before = { here: tip(at, OWN), there: tip(side.on(at), OWN) };

      const cancelled = ok(at, ['workunit', 'cancel', UNIT]);

      assert.deepStrictEqual([cancelled.pull_requests_closed, tip(at, OWN), tip(side.on(at), OWN)], [false, before.here, before.there]);
    });
  });
}
