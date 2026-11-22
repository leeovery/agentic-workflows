'use strict';

// ---------------------------------------------------------------------------
// The local landing driver (ledger-engine/scripts/drivers/landing/local/
// driver.cjs) and a task changed after its phase landed by hand (7.2.23):
// squashed under the person's own message, or its task's branch merged by a
// merge commit, then the task changed, `land phase` lands that change
// over its tip at that landing (R29), never refused as moved since it
// opened, nor as conflicting with its own lines or later work's on them —
// the commit its branch opened at read as the task's last, so later work
// rewriting a line of it never takes it back (task-landed.cjs, `landedAs`,
// `landedTip`); a branch moved on by the person's
// own commit besides lands whole with it. Every verb's answer on each driver
// is the conformance table's (landing-again.cjs); a task changed after the
// engine landed its phase, test-engine-land-local-again.cjs's; landings by
// hand alone, test-engine-land-local-by-hand.cjs's. Git layer: the landing
// world (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git } = require('./engine-harness.cjs');
const { openArgs, own, cutTask, commitFiles, useLandingWorld, landedHere, heldOn } = require('./landing-world.cjs');
const side = require('../drivers/local/landing.cjs');

const project = useLandingWorld('engine-land-local-again-by-hand-');

/** Phase 4 squashed onto main by hand under the person's own message. @param {string} dir */
const squashedOwn = (dir) => side.phaseByHand['a squash under the person\'s own message'](dir, 4);

describe('land: a task changed after its phase landed by hand, on the local driver (7.2.23)', () => {
  it('its phase squashed under the person\'s own message, then a line of its own changed: land phase lands the change with no conflict, never refused as moved since it opened', () => {
    const dir = project();
    const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
    ok(dir, openArgs(task));
    squashedOwn(dir);
    commitFiles(dir, task.branch, task.branch, { 'tip.txt': 'tip, changed\n' });
    const before = landedHere(dir, '4.1');
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([before, landed.merged, heldOn(dir, 'tip.txt'), landedHere(dir, '4.1')], [false, ['4.1'], 'tip, changed\n', true]);
  });

  it('its task of two commits, its phase of two squashed under the person\'s own message, a later phase rewriting a line of it, then the task changed on top: land phase lands just its change, the later work kept, never refused as moved since it opened', () => {
    const dir = project();
    const first = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
    commitFiles(dir, first.branch, first.branch, { 'tip-two.txt': 'two\n' });
    const second = cutTask(dir, '4.2', 'feat', 'Add note', first.branch, { 'note.txt': 'note\n' });
    for (const task of [first, second]) ok(dir, openArgs(task));
    squashedOwn(dir);
    ok(dir, openArgs(cutTask(dir, '5.1', 'feat', 'Rework tip', 'main', { 'tip.txt': 'tip, reworked\n' })));
    ok(dir, ['land', 'phase', 'pay', '5']);
    commitFiles(dir, first.branch, first.branch, { 'tip-more.txt': 'more\n' });
    const before = landedHere(dir, '4.1');
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([before, landed.merged, ['tip-more.txt', 'tip.txt'].map((file) => heldOn(dir, file)), landedHere(dir, '4.1')], [
      false, ['4.1'], ['more\n', 'tip, reworked\n'], true,
    ]);
  });

  it('its phase squashed under the person\'s own message, its task\'s branch moved on by the person\'s own commit besides its own: land phase lands the branch whole, never refusing it as moved since it opened', () => {
    const dir = project();
    const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
    ok(dir, openArgs(task));
    squashedOwn(dir);
    commitFiles(dir, task.branch, task.branch, { 'tip-more.txt': 'more\n' });
    commitFiles(dir, task.branch, task.branch, { 'aside.txt': 'aside\n' }, { message: 'work by hand' });
    const before = landedHere(dir, '4.1');
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([before, landed.merged, ['tip-more.txt', 'aside.txt'].map((file) => heldOn(dir, file)), landedHere(dir, '4.1')], [
      false, ['4.1'], ['more\n', 'aside\n'], true,
    ]);
  });

  it('its task\'s branch merged by a merge commit: land phase lands its change, under the message its phase\'s branch landed it under', () => {
    const dir = project();
    const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
    ok(dir, openArgs(task));
    side.byHand['a merge commit of its branch'](dir, task.branch);
    commitFiles(dir, task.branch, task.branch, { 'tip.txt': 'tip, changed\n' });
    const before = landedHere(dir, '4.1');
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([before, landed.merged, heldOn(dir, 'tip.txt'), git(dir, ['log', '-1', '--format=%B', 'main']), landedHere(dir, '4.1')], [
      false, ['4.1'], 'tip, changed\n', 'feat(pay): Add tip\n\nTask: pay-4-1\n\n', true,
    ]);
  });

  it('the first of its two tasks\' branch merged by a merge commit, then changed, the second not landed: land phase lands the phase, then the first\'s change, never refusing it as moved since it opened', () => {
    const dir = project();
    const first = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
    const second = cutTask(dir, '4.2', 'feat', 'Add note', first.branch, { 'note.txt': 'note\n' });
    ok(dir, openArgs(first));
    ok(dir, openArgs(second));
    side.byHand['a merge commit of its branch'](dir, first.branch);
    commitFiles(dir, first.branch, first.branch, { 'tip.txt': 'tip, changed\n' });
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([landed.merged, landed.landed_empty, ['tip.txt', 'note.txt'].map((file) => heldOn(dir, file)), ['4.1', '4.2'].map((shown) => landedHere(dir, shown))], [
      ['4.1', '4.2'], undefined, ['tip, changed\n', 'note\n'], [true, true],
    ]);
  });
});
