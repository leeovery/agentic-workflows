'use strict';

// ---------------------------------------------------------------------------
// A build phase's review at its close, as the engine checks it (leeway-
// engine/scripts/domain/phase-checks.cjs, through checklist.cjs): reported
// by every reviewer of the count, passing, or failing with a settlement
// answering its reports and every fix it names done, the way on named while
// it is open (12.11.1–12.11.3, 13.10.1, 12.S24, 13.S13); and `task settle
// --phase` writing that settlement with the reports it answers, refusing
// what it cannot settle, and settling again at any time — a fix closed, or
// one found owed after a settlement naming none (phase-settlement.cjs). The
// close's other items are test-engine-build-checklists-close.cjs.
//
// Layer: verb. World: the build checklists' world (build-checklists-world.cjs),
// built once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  ok, refusedPristine, writeState, readState, statePath, lastMessage, touched, layout, cleanupFixture,
} = require('./engine-harness.cjs');
const {
  UNIT, SESSION, DROPS_CENTS, WHY, SETTLED, taskFile, world, checklistHelpers,
} = require('./build-checklists-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { fingerprint } = require(path.join(SCRIPTS, 'kernel/fingerprint.cjs'));

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

const {
  item, phaseReport, why, settle, reviewItem,
} = checklistHelpers(() => dir);

describe('a phase\'s review at its close (6.4.9)', () => {
  it('reads its phase review passed once every reviewer of the count reported it passing — or, where it failed, once a settlement answers its reports as they stand and every fix it names is done, every task of the phase done answering nothing (12.11.3, 13.10.1, 12.S24, 13.S13)', () => {
    const reviewed = () => item('phase-close', 1, 'phase-review-passed');
    const seen = [reviewed()];
    phaseReport(1, 'a', [], 'pass');
    seen.push(reviewed());
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'done', UNIT, task], { env: SESSION });
    const unsettled = reviewItem();
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    settle(['--fixes', '1.3']);
    const owed = reviewItem();
    ok(dir, ['task', 'done', UNIT, '1.3'], { env: SESSION });
    seen.push(reviewed());
    phaseReport(1, 'a', ['- bug: the refund is never logged\n  Scenario: a refund of 9.99'], 'fail');
    seen.push(reviewed());
    settle([]);
    seen.push(reviewed());
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [], 'pass');

    assert.deepStrictEqual([...seen, reviewed()], ['open', 'open', 'done', 'open', 'done', 'done']);
    assert.deepStrictEqual([unsettled, owed], [
      { state: 'open', way: 'phase 1\'s review failed, and no settlement answers it — write its fixes as tasks of the phase, then settle it, naming them: task settle pay --phase 1 --file <why> [--fixes <task>,…]' },
      { state: 'open', way: 'phase 1\'s review failed, and task 1.3, a fix of it, is open' },
    ]);
  });

  it('reads a settlement that does not read as answering nothing, said as the way on, and settles anew over it', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    settle([]);
    writeState(dir, SETTLED, '{"why": "Kept."}\n');
    const unread = reviewItem();
    settle([]);

    assert.deepStrictEqual(unread, {
      state: 'open',
      way: 'pay/build/phases/phase-1/settlement.json does not read as a settlement — it holds {"why", "fixes", "reports"}; phase 1\'s review failed, and no settlement answers it — write its fixes as tasks of the phase, then settle it, naming them: task settle pay --phase 1 --file <why> [--fixes <task>,…]',
    });
    assert.strictEqual(item('phase-close', 1, 'phase-review-passed'), 'done');
  });

  it('reads a settlement naming a fix since closed as open, its way on the settlement given again — which is let through, passing once its new fixes are done (13.10.1)', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'done', UNIT, task], { env: SESSION });
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    settle(['--fixes', '1.3']);
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'The cents are lost in the receipt, not the total.']);
    const closedFix = reviewItem();
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Print the cents', ['1.S2'])]);
    settle(['--fixes', '1.4']);
    const resettled = reviewItem();
    ok(dir, ['task', 'done', UNIT, '1.4'], { env: SESSION });

    assert.deepStrictEqual([closedFix, resettled, item('phase-close', 1, 'phase-review-passed')], [
      { state: 'open', way: 'phase 1\'s review failed, and task 1.3, a fix of it, is closed — settle it again, naming the fixes that stand: task settle pay --phase 1 --file <why> [--fixes <task>,…]' },
      { state: 'open', way: 'phase 1\'s review failed, and task 1.4, a fix of it, is open' },
      'done',
    ]);
  });
});

describe('a phase review\'s settlement (13.10.1)', () => {
  it('writes the why, its fixes once each and the reports it answers by their texts\' fingerprints, alone, and commits it with those reports', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    const { phase: settled, fixes } = settle(['--fixes', '1.3,1.3']);
    const print = (/** @type {string} */ letter) => fingerprint(readState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-1', `review-${letter}.md`)));

    assert.deepStrictEqual([settled, fixes], [1, ['1.3']]);
    assert.deepStrictEqual(JSON.parse(readState(dir, SETTLED)), { why: WHY.trimEnd(), fixes: ['1.3'], reports: { 'review-a.md': print('a'), 'review-b.md': print('b') } });
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], ['task(pay): settle phase 1\'s review', [
      'A\tpay/build/phases/phase-1/review-a.md', 'A\tpay/build/phases/phase-1/review-b.md', `A\t${SETTLED}`,
    ]]);
  });

  it('settles again at any time, the newer settlement replacing the older: one naming none widened to name a fix found owed after it, the review open until that fix is done', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'done', UNIT, task], { env: SESSION });
    settle([]);
    const seen = [item('phase-close', 1, 'phase-review-passed')];
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    settle(['--fixes', '1.3']);
    const widened = reviewItem();
    ok(dir, ['task', 'done', UNIT, '1.3'], { env: SESSION });

    assert.deepStrictEqual([...seen, widened, item('phase-close', 1, 'phase-review-passed')], [
      'done', { state: 'open', way: 'phase 1\'s review failed, and task 1.3, a fix of it, is open' }, 'done',
    ]);
    assert.deepStrictEqual(JSON.parse(readState(dir, SETTLED)).fixes, ['1.3']);
  });

  it('refuses, writing nothing, a unit the project lacks, a review not complete, one passing, and each fix no task\'s id, no task of the phase, one the tracker lacks or one it has closed', () => {
    const refused = (/** @type {string[]} */ args, unit = UNIT) => refusedPristine(dir, ['task', 'settle', unit, '--phase', '1', '--file', why(), ...args], { env: SESSION }).error;
    const seen = [refused([], 'nowhere'), refused([])];
    phaseReport(1, 'a', [], 'pass');
    seen.push(refused([]));
    phaseReport(1, 'b', [], 'pass');
    seen.push(refused([]));
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Not needed.']);
    seen.push(refused(['--fixes', 'cents,2.1,1.9,1.2,1.1']));

    assert.deepStrictEqual(seen, [
      'task settle: Work unit "nowhere" not found',
      'task settle: phase 1 of pay has no phase review reported — its reviewers write their reports in pay/build/phases/phase-1/ — a phase review is settled once every reviewer of the count has reported it',
      'task settle: the phase review has no report at pay/build/phases/phase-1/review-b.md — a phase review is settled once every reviewer of the count has reported it',
      'task settle: phase 1 of pay\'s review passed — only a failed review is settled',
      'task settle: task-id: "cents" is not a task — it is {phase}.{n}; --fixes names task 2.1, which is no task of phase 1 of pay; --fixes names task 1.9, which the tracker does not hold in phase 1 of pay; --fixes names task 1.2, which the tracker has closed — a fix is a task still to be done',
    ]);
  });

  it('refuses with its usage given a task and a phase, neither, or fixes for a task', () => {
    const usage = 'Usage: engine task settle <unit> <task> --file <why> | <unit> --phase <N> --file <why> [--fixes <task>,…]';
    const given = [['1.1', '--phase', '1'], [], ['1.1', '--fixes', '1.2']].map((args) => refusedPristine(dir, ['task', 'settle', UNIT, ...args, '--file', why()], { env: SESSION }).error);

    assert.deepStrictEqual(given, [usage, usage, usage]);
  });
});
