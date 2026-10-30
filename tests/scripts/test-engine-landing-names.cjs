'use strict';

// ---------------------------------------------------------------------------
// The names a landing takes (leeway-engine/scripts/domain/landing-names.cjs,
// 7.2.18): a task's branch and a phase's, the message a task lands under,
// the title that may not forge its trailer, and each read back — the unit's
// own alone. Unit layer: values in, values out; no git.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const names = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const TASK = { unit: 'pay', phase: 2, n: 7 };

describe('the landing\'s names (7.2.18)', () => {
  it('names a task\'s branch {type}/{unit}-{phase}.{task}-{slug}, a phase\'s feat/{unit}-phase-{phase}, and a task\'s landing {type}({unit}): {title} with its id as a trailer', () => {
    assert.deepStrictEqual(
      [names.taskBranch(TASK, 'fix', 'Round the totals'), names.phaseBranch('pay', 2), names.landedMessage(TASK, 'fix', '  Round the totals ')],
      ['fix/pay-2.7-round-the-totals', 'feat/pay-phase-2', 'fix(pay): Round the totals\n\nTask: pay-2-7\n'],
    );
  });

  it('slugs a title by its words, as many whole ones as fit in 48 characters, one ending at the 48th among them, cutting a first word longer than that', () => {
    assert.strictEqual(names.slugOf('Show the running total beside every line of the basket'), 'show-the-running-total-beside-every-line-of-the');
    assert.strictEqual(names.slugOf(`${'a'.repeat(40)} ${'b'.repeat(7)} c`), `${'a'.repeat(40)}-${'b'.repeat(7)}`);
    assert.strictEqual(names.slugOf('x'.repeat(60)), 'x'.repeat(48));
  });

  it('slugs a Latin letter no accent decomposes by the letters it is written as', () => {
    assert.strictEqual(names.slugOf('Straße Æther Œuvre Øre Łódź Đakovo Ðað Þing Işık'), 'strasse-aether-oeuvre-ore-lodz-dakovo-dad-thing');
    assert.strictEqual(names.slugOf('Işık'), 'isik');
  });

  it('slugs a title with no Latin letter or digit as task, the id before it keeping the branch the task\'s own', () => {
    assert.deepStrictEqual(
      ['Итоги корзины', '合計を表示'].map((title) => names.taskBranch(TASK, 'feat', title)),
      ['feat/pay-2.7-task', 'feat/pay-2.7-task'],
    );
  });

  it('refuses a title that runs past a line by any character that ends one, so no title forges the trailer', () => {
    for (const end of ['\r', '\n', '\u0085', '\u2028', '\u2029']) {
      const title = `x${end}Task: pay-1-1`;
      assert.throws(() => names.landedMessage(TASK, 'feat', title), { message: `land: the task's title is one line of text — got ${JSON.stringify(title)}` });
    }
  });

  it('reads a task and a phase back off a branch of the unit\'s own, never another unit\'s', () => {
    assert.deepStrictEqual(
      [names.taskOfBranch('pay', 'fix/pay-2.7-round-the-totals'), names.phaseOfBranch('pay', 'feat/pay-phase-2')],
      [TASK, 2],
    );
    assert.deepStrictEqual(
      [
        names.taskOfBranch('pay', 'fix/pay-v2-2.7-round'), names.phaseOfBranch('pay', 'feat/pay-v2-phase-2'), names.taskOfBranch('pay', 'pay-2.7-round'),
        names.phaseOfBranch('pay', 'feat/pay-phase-1.1-round'), names.taskOfBranch('pay', 'fix/pay-2.7-round-the-totals.orig'),
      ],
      [null, null, null, null, null],
    );
  });

  it('reads back every task of the unit a message names on a line of its own, each once, and none off a message with no id so, or another shape of one', () => {
    assert.deepStrictEqual(names.tasksOfMessage('pay', names.landedMessage(TASK, 'fix', 'Round')), [TASK]);
    const joined = 'feat(pay): Add card\n\nTask: pay-1-1\n\nfix(pay): Round\n\nTask: pay-2-7\nTask: pay-v2-1-1\nTask: pay-1-1\n';
    assert.deepStrictEqual(names.tasksOfMessage('pay', joined), [{ unit: 'pay', phase: 1, n: 1 }, TASK]);
    assert.deepStrictEqual(
      ['fix(pay): Round\n', 'fix(pay): Round\n\nTask: 2.7\n', 'fix(pay): Round\n\nSee Task: pay-1-1\n', 'fix(pay): Round\n\nTask: pay-1-1 more\n'].map((message) => names.tasksOfMessage('pay', message)),
      [[], [], [], []],
    );
  });

  it('reads a task\'s type and title off the subject above its id, in a message joining several landings', () => {
    const joined = 'feat(pay): Add card\n\nTask: pay-1-1\n\nfix(pay): Round\n\nTask: pay-2-7\n';
    assert.deepStrictEqual(
      [names.landingOf({ unit: 'pay', phase: 1, n: 1 }, joined), names.landingOf(TASK, joined), names.landingOf(TASK, 'tidy\n\nTask: pay-2-7\n')],
      [{ type: 'feat', title: 'Add card' }, { type: 'fix', title: 'Round' }, null],
    );
  });
});
