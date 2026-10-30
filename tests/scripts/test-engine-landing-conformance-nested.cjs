'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite across nested repositories (7.3.4, 7.2.17,
// the landing half of 7.S19): the contract every landing driver meets where
// the project nests repositories of its own in its folder — a submodule and
// a clone — run through the `land` verbs against each shipped driver in
// turn. A task lands in every repository it touches, children first, each
// on its own default branch, and in none it does not touch, though it holds
// the task's branch; a phase merges in each, the project's default branch
// then pointing the submodule at the submodule's, and finish lands what
// stands in each. A verb refused in one repository is
// test-engine-landing-conformance-nested-refusals.cjs's; fix phases stacked
// on a phase that moved the pointer,
// test-engine-landing-conformance-stacked.cjs's and
// test-engine-landing-conformance-stacked-finish.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the nested world (landing-world.cjs), built once per driver and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { tip } = require('./engine-harness.cjs');
const { NESTED_TASKS, openArgs, nestedConformance } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show, cache } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { side, project, repos, ok, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-nested-${name}-`);

  describe(`the ${name} landing driver across nested repositories (7.2.17, 7.S19)`, () => {
    it('a task lands in every repository it touches, children first, each on its own default branch, and in none it does not — opened, chained, merged as a phase and finished, the project\'s default branch then pointing the submodule at the submodule\'s', () => {
      const at = project();
      const bases = (/** @type {{repos: {repo: string, base: string}[]}} */ answer) => answer.repos.map(({ repo, base }) => [repo, base]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(rates))), [['ext', 'main'], ['lib', 'trunk'], ['.', 'main']]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(show))), [['.', rates.branch]]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(cache))), [['lib', 'trunk']]);
      assert.deepStrictEqual(ok(at.dir, ['land', 'chain', 'pay', '1.2']).repos.map((/** @type {{repo: string, stack: string[]}} */ { repo, stack }) => [repo, stack]), [['.', ['1.1', '1.2']]]);
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1', 'pay-1-2'], ['pay-1-1'], ['pay-1-1', 'pay-2-1']]);

      const merged = ok(at.dir, ['land', 'phase', 'pay', '1']);
      assert.deepStrictEqual(merged.repos.map((/** @type {{repo: string, merged: string[]}} */ { repo, merged: tasks }) => [repo, tasks]), [['ext', ['1.1']], ['lib', ['1.1']], ['.', ['1.1', '1.2']]]);
      assert.ok(pointsAtSubmodule(at), 'phase 1 left the submodule\'s pointer off its default branch');
      const finished = ok(at.dir, ['land', 'finish', 'pay']);
      assert.deepStrictEqual(finished.repos.map((/** @type {{repo: string, phases: {phase: number}[]}} */ { repo, phases }) => [repo, phases.map(({ phase }) => phase)]), [['lib', [2]]]);

      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2'], ext: ['pay-1-1'], lib: ['pay-1-1', 'pay-2-1'] });
      assert.deepStrictEqual(Object.values(repos(at)).map(([dir, into]) => side.holds(dir, into)), [
        ['.gitignore', '.gitmodules', 'app.txt', 'ext', 'rates.txt', 'show.txt'], ['ext-rates.txt', 'ext.txt'], ['cache.txt', 'lib-rates.txt', 'lib.txt'],
      ]);
      for (const [dir, into] of Object.values(repos(at))) assert.strictEqual(tip(dir, into), side.defaultTip(dir, into), `${dir}'s default branch here does not hold its landing`);
    });
  });
}
