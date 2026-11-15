'use strict';

// ---------------------------------------------------------------------------
// The local landing driver (leeway-engine/scripts/drivers/landing/local/
// driver.cjs) and the tasks a phase landed, read off its branch's top
// (7.2.23, 12.14, `landedTop`): however many, the commit at its top alone,
// the line below never read — a task landed below it, changed since, read
// from where it opened, so it lands that change. A task changed
// after its phase landed is test-engine-land-local-again.cjs's. Git layer: the
// landing world (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, traced } = require('./engine-harness.cjs');
const { openArgs, own, cutTask, commitFiles, useLandingWorld, alreadyMoving, heldOn } = require('./landing-world.cjs');

const project = useLandingWorld('engine-land-local-again-top-');

describe('land: a phase\'s tasks read off its branch\'s top (7.2.23, 12.14)', () => {
  it('a phase landed on main forty commits on: land phase reads its tasks off the commit at its branch\'s top, never the line below it', () => {
    const dir = project();
    for (let n = 1; n <= 40; n += 1) commitFiles(dir, 'main', 'main', { 'history.txt': `${n}\n` }, { message: `chore: history ${n}` });
    ok(dir, openArgs(cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' })));
    ok(dir, ['land', 'phase', 'pay', '4']);
    const { result, commands } = traced(() => alreadyMoving(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([result.already, commands.filter((command) => /--max-count=1\b/.test(command)).length], [true, 1]);
  });

  it('a phase of seventeen tasks landed, its first changed since: land phase lands that change, read from where it opened, below its branch\'s top', () => {
    const dir = project();
    let from = 'main';
    const tasks = Array.from({ length: 17 }, (_, at) => {
      const task = cutTask(dir, `4.${at + 1}`, 'feat', `Part ${at + 1}`, from, { [`part-${at + 1}.txt`]: `${at + 1}\n` });
      from = task.branch;
      ok(dir, openArgs(task));
      return task;
    });
    ok(dir, ['land', 'phase', 'pay', '4']);
    commitFiles(dir, tasks[0].branch, tasks[0].branch, { 'part-1-more.txt': 'more\n' });

    assert.deepStrictEqual([own(ok(dir, ['land', 'phase', 'pay', '4'])).merged, heldOn(dir, 'part-1-more.txt')], [['4.1'], 'more\n']);
  });
});
