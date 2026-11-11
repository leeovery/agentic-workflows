'use strict';

// ---------------------------------------------------------------------------
// The local landing driver (leeway-engine/scripts/drivers/landing/local/
// driver.cjs) and a task changed after the engine landed its phase
// (7.2.23): not landed, `land phase` lands its change onto main over their
// merge base, as a pull request squash-merges — refused where it conflicts,
// the way on to merge main into its branch, followed; refused, its branch
// gone, naming where to make it again — and `land finish` lands an earlier
// task of a phase so changed. A change landed again moves main alone, the
// phase's branch staying at its landing, so each later change of any task
// it landed lands too, a later phase landed between; tasks changed together
// land oldest first, one whose change is on main already answered landed
// empty. Its phase landed by hand is test-engine-land-local-again-by-hand
// .cjs's; its tasks read off its branch's top,
// test-engine-land-local-again-top.cjs's; every verb's answer on each
// driver, the conformance table's (landing-again.cjs); submodules,
// test-engine-land-nested-again.cjs's. Git layer: the landing world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, git, tip } = require('./engine-harness.cjs');
const { openArgs, own, cutTask, commitFiles, useLandingWorld, refusedMoving, alreadyMoving, finishReady, landedHere, heldOn, mergedInto } = require('./landing-world.cjs');

const project = useLandingWorld('engine-land-local-again-');

/** The subjects of main's newest `count` commits, newest first. @param {string} dir @param {number} count */
const mainLog = (dir, count) => git(dir, ['log', `-${count}`, '--format=%s', 'main']).trim().split('\n');

/** Tasks 4.1 and 4.2, chained, opened, and phase 4 landed. @param {string} dir */
function phaseOfTwo(dir) {
  const first = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
  const second = cutTask(dir, '4.2', 'feat', 'Add note', first.branch, { 'note.txt': 'note\n' });
  ok(dir, openArgs(first));
  ok(dir, openArgs(second));
  ok(dir, ['land', 'phase', 'pay', '4']);
  return { first, second };
}

describe('land: a task changed after its phase landed, on the local driver (7.2.23)', () => {
  for (const how of ['on top of its branch', 'its last commit made again']) {
    it(`${how}: not landed, land phase refused on its conflict with main, naming the way on; main merged into its branch, land phase lands its change, and answers it merged after`, () => {
      const dir = project();
      const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
      ok(dir, openArgs(task));
      ok(dir, ['land', 'phase', 'pay', '4']);
      commitFiles(dir, task.branch, how === 'on top of its branch' ? task.branch : `${task.branch}^`, { 'tip.txt': 'tip, changed\n' });
      const before = landedHere(dir, '4.1');
      const refusal = refusedMoving(dir, ['land', 'phase', 'pay', '4']);
      mergedInto(dir, task.branch);
      const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

      assert.deepStrictEqual([before, refusal, landed.merged, heldOn(dir, 'tip.txt'), landedHere(dir, '4.1'), alreadyMoving(dir, ['land', 'phase', 'pay', '4']).repos], [
        false,
        `land: task 4.1 changed since phase 4 landed on main, and its change conflicts with main at tip.txt, so nothing moved — merge main into ${task.branch}, settling the conflict, and land again`,
        ['4.1'], 'tip, changed\n', true, [],
      ]);
    });
  }

  it('the earlier of two tasks its phase landed, changed on top of its branch: land finish lands its change alone, under the message it landed under, the later task\'s work kept', () => {
    const dir = project();
    const { first } = phaseOfTwo(dir);
    commitFiles(dir, first.branch, first.branch, { 'tip.txt': 'tip, changed\n' });
    mergedInto(dir, first.branch);
    finishReady(dir);
    const finished = own(ok(dir, ['land', 'finish', 'pay']));

    assert.deepStrictEqual([finished.phases.map((/** @type {{merged: string[]}} */ { merged }) => merged), ['tip.txt', 'note.txt'].map((file) => heldOn(dir, file)), git(dir, ['log', '-1', '--format=%B', 'main']), landedHere(dir, '4.1')], [
      [['4.1']], ['tip, changed\n', 'note\n'], 'feat(pay): Add tip\n\nTask: pay-4-1\n\n', true,
    ]);
  });

  it('a change landed again moves main alone, the phase\'s branch staying at its landing: a later phase landed, then the later task changed and landed again, then the earlier — each landed by land phase, land finish passing, main holding both', () => {
    const dir = project();
    const { first, second } = phaseOfTwo(dir);
    const landing = tip(dir, 'feat/pay-phase-4');
    ok(dir, openArgs(cutTask(dir, '5.1', 'feat', 'Add tax', 'main', { 'tax.txt': 'tax\n' })));
    ok(dir, ['land', 'phase', 'pay', '5']);
    commitFiles(dir, second.branch, second.branch, { 'note-more.txt': 'more\n' });
    const later = own(ok(dir, ['land', 'phase', 'pay', '4'])).merged;
    const stood = tip(dir, 'feat/pay-phase-4');
    commitFiles(dir, first.branch, first.branch, { 'tip-more.txt': 'more\n' });
    const earlier = own(ok(dir, ['land', 'phase', 'pay', '4'])).merged;
    finishReady(dir);

    assert.deepStrictEqual([later, stood, earlier, tip(dir, 'feat/pay-phase-4'), ok(dir, ['land', 'finish', 'pay']).repos, ['note-more.txt', 'tip-more.txt'].map((file) => heldOn(dir, file)), ['4.1', '4.2'].map((shown) => landedHere(dir, shown))], [
      ['4.2'], landing, ['4.1'], landing, [], ['more\n', 'more\n'], [true, true],
    ]);
  });

  it('both tasks of a phase changed since it landed, each adding one file alike: land phase lands them oldest first, the later answered landed empty, its change on main already', () => {
    const dir = project();
    const { first, second } = phaseOfTwo(dir);
    for (const task of [first, second]) commitFiles(dir, task.branch, task.branch, { 'shared.txt': 'shared\n' });
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([landed.merged, landed.landed_empty, mainLog(dir, 2), heldOn(dir, 'shared.txt')], [
      ['4.1', '4.2'], [{ task: '4.2', why: 'its change was on main already' }], ['feat(pay): Add note', 'feat(pay): Add tip'], 'shared\n',
    ]);
  });

  it('its branch gone, the change kept in the reflog: land phase refused, nothing moved, naming where to make it again', () => {
    const dir = project();
    const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
    ok(dir, openArgs(task));
    ok(dir, ['land', 'phase', 'pay', '4']);
    const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
    git(dir, ['switch', '-q', task.branch]);
    fs.writeFileSync(path.join(dir, 'tip-more.txt'), 'more\n');
    git(dir, ['add', 'tip-more.txt']);
    git(dir, ['commit', '-q', '-m', 'feat(pay): more on the tip', '-m', 'Leeway-Task: pay-4-1']);
    const changed = tip(dir, task.branch);
    git(dir, ['switch', '-q', back]);
    git(dir, ['branch', '-q', '-D', task.branch]);

    assert.deepStrictEqual(refusedMoving(dir, ['land', 'phase', 'pay', '4']), `land: task 4.1 changed since phase 4 landed on main, and its branch is gone — make it again with \`git branch ${task.branch} ${changed.slice(0, 7)}\` and land again`);
  });
});
