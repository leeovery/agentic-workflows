'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's fix phases stacked across nested
// repositories and landed at finish (7.3.4, 7.2.6, 7.2.17, the landing half
// of 7.S19): the contract every landing driver meets for fix phases stacked
// on a phase that moved the submodule's pointer, cut from its top before it
// merges, run through the `land` verbs against each shipped driver in turn.
// One of two tasks moving the pointer, and one of one leaving it alone,
// land after it at finish — the project's default branch pointing the
// submodule at the submodule's after each, every landing under its task's
// subject (7.2.18), each repository holding what its tasks changed. One
// merged as a phase is test-engine-landing-conformance-stacked.cjs's; the
// walk itself is test-engine-landing-conformance-nested.cjs's. A driver's
// side (tests/drivers/{name}/landing.cjs) readies each repository and reads
// what landed where; this file names no driver and no tool. Conformance
// layer: the nested world (landing-world.cjs), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { tip } = require('./engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, track, cutTask, commitFiles, nestedConformance } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;

/** @typedef {import('./landing-world.cjs').Nested} Nested */

/**
 * Fix phases stacked on phase 1, cut from its top before it merges: 4, two
 * tasks moving the submodule's pointer; 5, one leaving it alone.
 * @param {Nested} at
 */
function fixPhases(at) {
  const moving = [track(at.dir, '4.1', 'fix', 'Fix ext'), track(at.dir, '4.2', 'fix', 'Fix ext more')];
  let [from, extFrom] = [show.branch, rates.branch];
  for (const task of moving) {
    const moved = commitFiles(at.ext, task.branch, extFrom, { [`ext-${task.shown}.txt`]: `${task.shown}\n` });
    commitFiles(at.dir, task.branch, from, { [`${task.shown}.txt`]: `${task.shown}\n` }, { gitlinks: { [NESTED.ext.folder]: moved } });
    [from, extFrom] = [task.branch, task.branch];
  }
  const last = cutTask(at.dir, '5.1', 'fix', 'Fix the last', show.branch, { 'last.txt': 'last\n' });
  return [...moving, last];
}

for (const { name } of listDrivers('landing')) {
  const { side, project, repos, ok, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-stacked-finish-${name}-`);

  describe(`the ${name} landing driver's fix phases stacked across nested repositories, landed at finish (7.2.6, 7.2.17, 7.S19)`, () => {
    it('fix phases stacked on the phase that moved the submodule\'s pointer land after it at finish, moving the pointer or not — the project\'s default branch pointing the submodule at the submodule\'s after each, every landing under its task\'s subject', () => {
      const at = project();
      const fixes = fixPhases(at);
      for (const task of [rates, show, ...fixes]) ok(at.dir, openArgs(task));
      for (const top of ['1.2', '4.2']) ok(at.dir, ['land', 'chain', 'pay', top]);
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1', 'pay-1-2', 'pay-4-1', 'pay-4-2', 'pay-5-1'], ['pay-1-1', 'pay-4-1', 'pay-4-2'], ['pay-1-1']]);

      ok(at.dir, ['land', 'phase', 'pay', '1']);
      assert.ok(pointsAtSubmodule(at), 'phase 1 left the submodule\'s pointer off its default branch');
      const finished = ok(at.dir, ['land', 'finish', 'pay']);
      assert.deepStrictEqual(finished.repos.map((/** @type {{repo: string, phases: {phase: number}[]}} */ { repo, phases }) => [repo, phases.map(({ phase }) => phase)]), [['ext', [4]], ['.', [4, 5]]]);
      assert.ok(pointsAtSubmodule(at), 'finish left the submodule\'s pointer off its default branch');

      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2', 'pay-4-1', 'pay-4-2', 'pay-5-1'], ext: ['pay-1-1', 'pay-4-1', 'pay-4-2'], lib: ['pay-1-1'] });
      assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), [
        'feat(pay): Add rates', 'feat(pay): Show rates', 'fix(pay): Fix ext', 'fix(pay): Fix ext more', 'fix(pay): Fix the last',
      ]);
      assert.deepStrictEqual(Object.values(repos(at)).map(([dir, into]) => side.holds(dir, into)), [
        ['.gitignore', '.gitmodules', '4.1.txt', '4.2.txt', 'app.txt', 'ext', 'last.txt', 'rates.txt', 'show.txt'],
        ['ext-4.1.txt', 'ext-4.2.txt', 'ext-rates.txt', 'ext.txt'], ['lib-rates.txt', 'lib.txt'],
      ]);
      for (const [dir, into] of Object.values(repos(at))) assert.strictEqual(tip(dir, into), side.defaultTip(dir, into), `${dir}'s default branch here does not hold its landing`);
    });
  });
}
