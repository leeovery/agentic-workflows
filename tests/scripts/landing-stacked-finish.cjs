'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's fix phases stacked across nested
// repositories and landed at finish (7.3.4, 7.2.6, 7.2.17, the landing half
// of 7.S19), shared by the suites that land phase 1 by a clock each
// (test-engine-landing-conformance-stacked-finish*.cjs): the contract every
// landing driver meets for fix phases stacked on a phase that moved the
// submodule's pointer, cut from its top before it merges. One of two tasks
// moving the pointer, and one of one leaving it alone, land after it at
// finish — the project's default branch pointing the submodule at the
// submodule's after each, every landing under its task's subject (7.2.18),
// each repository holding what its tasks changed, phase 1 never landed
// again (`stackedFinishes`). One merged as a phase is
// test-engine-landing-conformance-stacked.cjs's; the walk itself is
// test-engine-landing-conformance-nested.cjs's. Names no driver and no tool.
// ---------------------------------------------------------------------------

const assert = require('node:assert');

const { tip } = require('./engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, track, cutTask, commitFiles, finishReady } = require('./landing-world.cjs');

const { rates, show } = NESTED_TASKS;

/** @typedef {import('./landing-world.cjs').Nested} Nested */
/** @typedef {ReturnType<typeof import('./landing-world.cjs').nestedConformance>} NestedConformance */

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

/**
 * The contract (the header's) on the driver `conf` reads, phase 1 landed by
 * `land phase` under `during` — the clock its commits are dated by.
 * @param {NestedConformance} conf @param {<T>(act: () => T) => T} during
 */
function stackedFinishes({ side, project, repos, ok, tasksLanded, pointsAtSubmodule }, during) {
  const at = project();
  const fixes = fixPhases(at);
  for (const task of [rates, show, ...fixes]) ok(at.dir, openArgs(task));
  for (const top of ['1.2', '4.2']) ok(at.dir, ['land', 'chain', 'pay', top]);
  assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1', 'pay-1-2', 'pay-4-1', 'pay-4-2', 'pay-5-1'], ['pay-1-1', 'pay-4-1', 'pay-4-2'], ['pay-1-1']]);

  during(() => ok(at.dir, ['land', 'phase', 'pay', '1']));
  assert.ok(pointsAtSubmodule(at), 'phase 1 left the submodule\'s pointer off its default branch');
  finishReady(at.dir);
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
}

/** The suites' names: the describe's, for the driver `name`, and the test's, phase 1 landed `clock`. */
const STACKED_FINISH = {
  /** @param {string} name */
  title: (name) => `the ${name} landing driver's fix phases stacked across nested repositories, landed at finish (7.2.6, 7.2.17, 7.S19)`,
  /** @param {string} clock */
  test: (clock) => `fix phases stacked on the phase that moved the submodule's pointer, landed ${clock}, land after it at finish, moving the pointer or not — the project's default branch pointing the submodule at the submodule's after each, every landing under its task's subject, phase 1 never landed again`,
};

module.exports = { stackedFinishes, STACKED_FINISH };
