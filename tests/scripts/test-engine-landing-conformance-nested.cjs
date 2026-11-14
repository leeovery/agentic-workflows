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
// stands in each; a phase's close in step reads a task in its stack once
// opened wherever its change touches; and a unit with a branch of its own
// has one in each repository a task of it touches, made as that task opens,
// each landed on its default branch at finish, children first, the
// project's then pointing the submodule at a commit the submodule's holds
// (7.2.40, 7.S37). A verb refused in one repository is
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

const { tip, git } = require('./engine-harness.cjs');
const { createManifest, readManifest } = require('./discovery-test-utils.cjs');
const { NESTED, NESTED_TASKS, openArgs, nestedConformance, finishReady, buildBegun, startClosed, phaseReviewed } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show, cache } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { side, project, repos, pointer, ok, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-nested-${name}-`);

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
      finishReady(at.dir);
      const finished = ok(at.dir, ['land', 'finish', 'pay']);
      assert.deepStrictEqual(finished.repos.map((/** @type {{repo: string, phases: {phase: number}[]}} */ { repo, phases }) => [repo, phases.map(({ phase }) => phase)]), [['lib', [2]]]);

      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2'], ext: ['pay-1-1'], lib: ['pay-1-1', 'pay-2-1'] });
      assert.deepStrictEqual(Object.values(repos(at)).map(([dir, into]) => side.holds(dir, into)), [
        ['.gitignore', '.gitmodules', 'app.txt', 'ext', 'rates.txt', 'show.txt'], ['ext-rates.txt', 'ext.txt'], ['cache.txt', 'lib-rates.txt', 'lib.txt'],
      ]);
      for (const [dir, into] of Object.values(repos(at))) assert.strictEqual(tip(dir, into), side.defaultTip(dir, into), `${dir}'s default branch here does not hold its landing`);
    });

    it('a unit with its own branch has one in each repository a task of it touches, made as the task opens, landed at finish on each default branch, children first, by a merge commit, the project\'s pointing the submodule at a commit the submodule\'s holds (7.2.40, 7.S37)', () => {
      const at = project();
      buildBegun(at.dir, 5);
      startClosed(at.dir, 1, side.env);
      const bases = ok(at.dir, openArgs(rates)).repos.map((/** @type {{repo: string, base: string}} */ { repo, base }) => [repo, base]);
      ok(at.dir, openArgs(show));
      phaseReviewed(at.dir, 1, 'auto');
      ok(at.dir, ['land', 'phase', 'pay', '1']);
      finishReady(at.dir);
      const finished = ok(at.dir, ['land', 'finish', 'pay']).repos.filter((/** @type {{landed?: string}} */ answer) => answer.landed !== undefined).map((/** @type {{repo: string, landed: string}} */ { repo, landed }) => [repo, landed]);
      const held = git(side.on(at.ext), ['merge-base', '--is-ancestor', pointer(at), NESTED.ext.into]) === '';

      assert.deepStrictEqual({ bases, finished, tasks: tasksLanded(at), held }, {
        bases: [['ext', 'feat/pay'], ['lib', 'feat/pay'], ['.', 'feat/pay']],
        finished: [['ext', 'feat/pay'], ['lib', 'feat/pay'], ['.', 'feat/pay']],
        tasks: { '.': ['pay-1-1', 'pay-1-2', null], ext: ['pay-1-1', null], lib: ['pay-1-1', null] },
        held: true,
      });
    });

    it('a phase\'s close in step reads a task in its stack once it is opened wherever its change touches, a repository holding its branch with nothing past the default branch passed over (7.2.4)', () => {
      const at = project();
      createManifest(at.dir, 'pay', { ...readManifest(at.dir, 'pay'), build: { position: 'step' }, cut: { phases: [1, 2].map((n) => ({ name: `Phase ${n}`, goal: 'Rates.', scenarios: [`${n}.S1`], sections: [String(n)], relies_on: [] })) } });
      const merged = () => ok(at.dir, ['checklist', 'show', 'phase-close', 'pay', '2']).items.find((/** @type {{key: string}} */ item) => item.key === 'stack-merged').state;
      const before = merged();
      ok(at.dir, openArgs(cache));

      assert.deepStrictEqual([before, merged()], ['open', 'done']);
    });
  });
}
