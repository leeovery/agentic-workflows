'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite across nested repositories (7.3.4, 7.2.17,
// the landing half of 7.S19): the contract every landing driver meets where
// the project nests repositories of its own in its folder — a submodule and
// a clone — run through the `land` verbs against each shipped driver in
// turn. A task lands in every repository it touches, children first, each
// on its own default branch, and in none it does not touch, though it holds
// the task's branch; a phase merges in each, the project's default branch
// then pointing the submodule at a commit on the submodule's, and finish
// lands what stands in each — a fix phase stacked on the phase it fixes
// too, both moving the submodule's pointer, the pointer then at the fix's
// landing; a task pinning the submodule where it lands nothing keeps its
// pin. A task whose branch in one repository does not descend from its
// chain's tip there opens nowhere. A merge refused in one repository leaves
// those before it merged and those after it untouched, the refusal naming
// it and what merged where; landing again merges the rest, each once. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and reads what landed where; this file names no driver and no tool.
// Conformance layer: the nested world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, track, cutTask, commitFiles, useNestedWorld } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');

const { git, tip } = harness;
const { rates, show, cache } = NESTED_TASKS;

/** @typedef {import('./landing-world.cjs').Nested} Nested */

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, nest: (dir: string, into: string) => void, on: (dir: string) => string,
   *   landed: (dir: string, into?: string) => {subject: string, task: string|null}[], holds: (dir: string, into?: string) => string[],
   *   defaultTip: (dir: string, into?: string) => string, opened: (dir: string) => string[], refuseMerge: (dir: string) => {env: Record<string, string>, undo: () => void},
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const env = (/** @type {Record<string, string>} */ more) => ({ env: { ...side.env, ...more } });
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, env({}));
  const refuses = (/** @type {string} */ at, /** @type {string[]} */ args, /** @type {Record<string, string>} */ more) => harness.refuses(at, args, env(more)).error;
  const project = useNestedWorld(`engine-landing-nested-${name}-`, (dir) => {
    side.prepare(dir);
    for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
  });

  /** Each repository's checkout, by the name an answer gives it, with its default branch. @param {Nested} at */
  const repos = (at) => ({ '.': [at.dir, 'main'], ext: [at.ext, NESTED.ext.into], lib: [at.lib, NESTED.lib.into] });

  /** The tasks each repository's default branch gained, by the name an answer gives it, oldest first. @param {Nested} at */
  const tasksLanded = (at) => Object.fromEntries(Object.entries(repos(at)).map(([repo, [dir, into]]) => [repo, side.landed(dir, into).map(({ task }) => task)]));

  /** The commit the project's default branch points the submodule at. @param {Nested} at */
  const pointer = (at) => git(side.on(at.dir), ['rev-parse', `main:${NESTED.ext.folder}`]).trim();

  /** Whether the project's default branch points the submodule at a commit on the submodule's. @param {Nested} at */
  const pointsIntoSubmodule = (at) => git(side.on(at.ext), ['merge-base', pointer(at), NESTED.ext.into]).trim() === pointer(at);

  describe(`the ${name} landing driver across nested repositories (7.2.17, 7.S19)`, () => {
    it('a task lands in every repository it touches, children first, each on its own default branch, and in none it does not — opened, chained, merged as a phase and finished, the project\'s default branch then pointing the submodule at a commit on the submodule\'s', () => {
      const at = project();
      const bases = (/** @type {{repos: {repo: string, base: string}[]}} */ answer) => answer.repos.map(({ repo, base }) => [repo, base]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(rates))), [['ext', 'main'], ['lib', 'trunk'], ['.', 'main']]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(show))), [['.', rates.branch]]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(cache))), [['lib', 'trunk']]);
      assert.deepStrictEqual(ok(at.dir, ['land', 'chain', 'pay', '1.2']).repos.map((/** @type {{repo: string, stack: string[]}} */ { repo, stack }) => [repo, stack]), [['.', ['1.1', '1.2']]]);
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1', 'pay-1-2'], ['pay-1-1'], ['pay-1-1', 'pay-2-1']]);

      const merged = ok(at.dir, ['land', 'phase', 'pay', '1']);
      assert.deepStrictEqual(merged.repos.map((/** @type {{repo: string, merged: string[]}} */ { repo, merged: tasks }) => [repo, tasks]), [['ext', ['1.1']], ['lib', ['1.1']], ['.', ['1.1', '1.2']]]);
      assert.ok(pointsIntoSubmodule(at), 'the project\'s default branch points the submodule at a commit its default branch lacks');
      const finished = ok(at.dir, ['land', 'finish', 'pay']);
      assert.deepStrictEqual(finished.repos.map((/** @type {{repo: string, phases: {phase: number}[]}} */ { repo, phases }) => [repo, phases.map(({ phase }) => phase)]), [['lib', [2]]]);

      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2'], ext: ['pay-1-1'], lib: ['pay-1-1', 'pay-2-1'] });
      assert.deepStrictEqual(Object.values(repos(at)).map(([dir, into]) => side.holds(dir, into)), [
        ['.gitignore', '.gitmodules', 'app.txt', 'ext', 'rates.txt', 'show.txt'], ['ext-rates.txt', 'ext.txt'], ['cache.txt', 'lib-rates.txt', 'lib.txt'],
      ]);
      for (const [dir, into] of Object.values(repos(at))) assert.strictEqual(tip(dir, into), side.defaultTip(dir, into), `${dir}'s default branch here does not hold its landing`);
    });

    it('a merge refused in one repository: those before it stand merged and those after it untouched, the refusal naming it and what merged where — and landing again merges the rest, each once', () => {
      const at = project();
      ok(at.dir, openArgs(rates));
      ok(at.dir, openArgs(show));
      const { env: refusing, undo } = side.refuseMerge(at.lib);

      assert.match(refuses(at.dir, ['land', 'phase', 'pay', '1'], refusing), /^land: in lib, .+ \(phase 1 merged in ext before it\)$/);
      assert.deepStrictEqual(tasksLanded(at), { '.': [], ext: ['pay-1-1'], lib: [] });
      undo();
      assert.deepStrictEqual(ok(at.dir, ['land', 'phase', 'pay', '1']).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['lib', '.']);
      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2'], ext: ['pay-1-1'], lib: ['pay-1-1'] });
      assert.ok(pointsIntoSubmodule(at), 'the project\'s default branch points the submodule at a commit its default branch lacks');
    });

    it('a task whose branch in one repository does not descend from its chain\'s tip there opens nowhere — refused before anything opens, naming the repository', () => {
      const at = project();
      ok(at.dir, openArgs(rates));
      commitFiles(at.ext, show.branch, rates.branch, { 'ext-show.txt': 'show\n' });
      commitFiles(at.lib, show.branch, NESTED.lib.into, { 'lib-show.txt': 'show\n' });

      assert.match(refuses(at.dir, openArgs(show), {}), new RegExp(`^land: in lib, task 1\\.2's branch ${show.branch} does not descend from the chain's tip, ${rates.branch} \\(\\w+\\) — merge it back onto ${rates.branch} first$`));
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1'], ['pay-1-1'], ['pay-1-1']]);
    });

    it('a task pinning the submodule off its default branch, landing nothing there, keeps its pin', () => {
      const at = project();
      const release = commitFiles(at.ext, 'release', NESTED.ext.into, { 'release.txt': 'release\n' });
      const pin = cutTask(at.dir, '4.1', 'chore', 'Pin ext to its release', 'main', {}, { gitlinks: { [NESTED.ext.folder]: release } });
      ok(at.dir, openArgs(pin));
      ok(at.dir, ['land', 'phase', 'pay', '4']);
      assert.strictEqual(pointer(at), release);
      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-4-1'], ext: [], lib: [] });
    });

    it('a fix phase stacked on the phase it fixes, both moving the submodule\'s pointer, lands after it, the pointer then at the submodule\'s landing of the fix', () => {
      const at = project();
      const fix = track(at.dir, '3.1', 'fix', 'Fix ext');
      const fixed = commitFiles(at.ext, fix.branch, rates.branch, { 'ext-fix.txt': 'fix\n' });
      commitFiles(at.dir, fix.branch, rates.branch, { 'fix.txt': 'fix\n' }, { gitlinks: { [NESTED.ext.folder]: fixed } });
      git(at.lib, ['branch', fix.branch, rates.branch]);
      ok(at.dir, openArgs(rates));
      ok(at.dir, openArgs(fix));

      assert.deepStrictEqual(ok(at.dir, ['land', 'finish', 'pay']).repos.map((/** @type {{repo: string, phases: {phase: number}[]}} */ { repo, phases }) => [repo, phases.map(({ phase }) => phase)]), [
        ['ext', [1, 3]], ['lib', [1]], ['.', [1, 3]],
      ]);
      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-3-1'], ext: ['pay-1-1', 'pay-3-1'], lib: ['pay-1-1'] });
      assert.strictEqual(pointer(at), side.defaultTip(at.ext, NESTED.ext.into));
    });
  });
}
