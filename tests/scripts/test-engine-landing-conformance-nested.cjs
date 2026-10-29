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
// lands what stands in each. Fix phases stacked on the phase that moved the
// submodule's pointer land after it — one leaving the pointer alone, with
// no branch in the submodule, merged as a phase, and ones of one task and
// of two, moving it or not, at finish — the project's default branch
// pointing the submodule at a commit on the submodule's after each, every
// landing under its task's subject. A task pinning the submodule where it
// lands nothing keeps its pin. A task whose branch in one repository does
// not descend from its chain's tip there opens nowhere. A merge refused in
// one repository leaves those before it merged and those after it
// untouched, the refusal naming it and what merged where; landing again
// merges the rest, each once. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the nested world (landing-world.cjs), built once per driver and copied
// for each test.
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

  /** Whether the project's default branch points the submodule at its default branch's tip. @param {Nested} at */
  const pointsAtSubmodule = (at) => pointer(at) === side.defaultTip(at.ext, NESTED.ext.into);

  /** Each repository's phases a finish merged, by the name its answer gives it. @param {{repos: {repo: string, phases: {phase: number}[]}[]}} answer */
  const finished = (answer) => answer.repos.map(({ repo, phases }) => [repo, phases.map(({ phase }) => phase)]);

  /**
   * Fix phases stacked on phase 1, cut from its top before it merges: 3,
   * two tasks leaving the submodule alone with no branch there; 4, two
   * moving it; 5, one leaving it alone.
   * @param {Nested} at
   */
  function fixPhases(at) {
    const alone = [track(at.dir, '3.1', 'fix', 'Fix the app'), track(at.dir, '3.2', 'fix', 'Fix it more')];
    commitFiles(at.dir, alone[0].branch, show.branch, { 'fix.txt': 'fix\n' });
    commitFiles(at.dir, alone[1].branch, alone[0].branch, { 'more.txt': 'more\n' });
    const moving = [track(at.dir, '4.1', 'fix', 'Fix ext'), track(at.dir, '4.2', 'fix', 'Fix ext more')];
    let [from, extFrom] = [show.branch, rates.branch];
    for (const task of moving) {
      const moved = commitFiles(at.ext, task.branch, extFrom, { [`ext-${task.shown}.txt`]: `${task.shown}\n` });
      commitFiles(at.dir, task.branch, from, { [`${task.shown}.txt`]: `${task.shown}\n` }, { gitlinks: { [NESTED.ext.folder]: moved } });
      [from, extFrom] = [task.branch, task.branch];
    }
    const last = cutTask(at.dir, '5.1', 'fix', 'Fix the last', show.branch, { 'last.txt': 'last\n' });
    return [...alone, ...moving, last];
  }

  describe(`the ${name} landing driver across nested repositories (7.2.17, 7.S19)`, () => {
    it('a task lands in every repository it touches, children first, each on its own default branch, and in none it does not — opened, chained, merged as a phase and finished, fix phases stacked on it after it, moving the submodule\'s pointer or not, the project\'s default branch pointing the submodule at a commit on the submodule\'s after each', () => {
      const at = project();
      const fixes = fixPhases(at);
      const bases = (/** @type {{repos: {repo: string, base: string}[]}} */ answer) => answer.repos.map(({ repo, base }) => [repo, base]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(rates))), [['ext', 'main'], ['lib', 'trunk'], ['.', 'main']]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(show))), [['.', rates.branch]]);
      assert.deepStrictEqual(bases(ok(at.dir, openArgs(cache))), [['lib', 'trunk']]);
      assert.deepStrictEqual(ok(at.dir, ['land', 'chain', 'pay', '1.2']).repos.map((/** @type {{repo: string, stack: string[]}} */ { repo, stack }) => [repo, stack]), [['.', ['1.1', '1.2']]]);
      for (const fix of fixes) ok(at.dir, openArgs(fix));
      for (const top of ['3.2', '4.2']) ok(at.dir, ['land', 'chain', 'pay', top]);
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [
        ['pay-1-1', 'pay-1-2', 'pay-3-1', 'pay-3-2', 'pay-4-1', 'pay-4-2', 'pay-5-1'], ['pay-1-1', 'pay-4-1', 'pay-4-2'], ['pay-1-1', 'pay-2-1'],
      ]);

      const merged = ok(at.dir, ['land', 'phase', 'pay', '1']);
      assert.deepStrictEqual(merged.repos.map((/** @type {{repo: string, merged: string[]}} */ { repo, merged: tasks }) => [repo, tasks]), [['ext', ['1.1']], ['lib', ['1.1']], ['.', ['1.1', '1.2']]]);
      assert.ok(pointsAtSubmodule(at), 'phase 1 left the submodule\'s pointer off its default branch');
      assert.deepStrictEqual(ok(at.dir, ['land', 'phase', 'pay', '3']).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['.']);
      assert.ok(pointsAtSubmodule(at), 'phase 3 left the submodule\'s pointer off its default branch');
      assert.deepStrictEqual(finished(ok(at.dir, ['land', 'finish', 'pay'])), [['ext', [4]], ['lib', [2]], ['.', [4, 5]]]);
      assert.ok(pointsAtSubmodule(at), 'finish left the submodule\'s pointer off its default branch');

      assert.deepStrictEqual(tasksLanded(at), {
        '.': ['pay-1-1', 'pay-1-2', 'pay-3-1', 'pay-3-2', 'pay-4-1', 'pay-4-2', 'pay-5-1'], ext: ['pay-1-1', 'pay-4-1', 'pay-4-2'], lib: ['pay-1-1', 'pay-2-1'],
      });
      assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), [
        'feat(pay): Add rates', 'feat(pay): Show rates', 'fix(pay): Fix the app', 'fix(pay): Fix it more', 'fix(pay): Fix ext', 'fix(pay): Fix ext more', 'fix(pay): Fix the last',
      ]);
      assert.deepStrictEqual(Object.values(repos(at)).map(([dir, into]) => side.holds(dir, into)), [
        ['.gitignore', '.gitmodules', '4.1.txt', '4.2.txt', 'app.txt', 'ext', 'fix.txt', 'last.txt', 'more.txt', 'rates.txt', 'show.txt'],
        ['ext-4.1.txt', 'ext-4.2.txt', 'ext-rates.txt', 'ext.txt'], ['cache.txt', 'lib-rates.txt', 'lib.txt'],
      ]);
      for (const [dir, into] of Object.values(repos(at))) assert.strictEqual(tip(dir, into), side.defaultTip(dir, into), `${dir}'s default branch here does not hold its landing`);
    });

    it('a merge refused in one repository: those before it stand merged and those after it untouched, the refusal naming it and what merged where — and landing again merges the rest, each once; a task pinning the submodule where it lands nothing then keeps its pin', () => {
      const at = project();
      const release = commitFiles(at.ext, 'release', NESTED.ext.into, { 'release.txt': 'release\n' });
      const pin = cutTask(at.dir, '4.1', 'chore', 'Pin ext to its release', 'main', {}, { gitlinks: { [NESTED.ext.folder]: release } });
      for (const task of [rates, show, pin]) ok(at.dir, openArgs(task));
      const { env: refusing, undo } = side.refuseMerge(at.lib);

      assert.match(refuses(at.dir, ['land', 'phase', 'pay', '1'], refusing), /^land: in lib, .+ \(phase 1 merged in ext before it\)$/);
      assert.deepStrictEqual(tasksLanded(at), { '.': [], ext: ['pay-1-1'], lib: [] });
      undo();
      assert.deepStrictEqual(ok(at.dir, ['land', 'phase', 'pay', '1']).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['lib', '.']);
      assert.ok(pointsAtSubmodule(at), 'phase 1 left the submodule\'s pointer off its default branch');
      ok(at.dir, ['land', 'phase', 'pay', '4']);
      assert.strictEqual(pointer(at), release);
      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2', 'pay-4-1'], ext: ['pay-1-1'], lib: ['pay-1-1'] });
    });

    it('a task whose branch in one repository does not descend from its chain\'s tip there opens nowhere — refused before anything opens, naming the repository', () => {
      const at = project();
      ok(at.dir, openArgs(rates));
      commitFiles(at.ext, show.branch, rates.branch, { 'ext-show.txt': 'show\n' });
      commitFiles(at.lib, show.branch, NESTED.lib.into, { 'lib-show.txt': 'show\n' });

      assert.match(refuses(at.dir, openArgs(show), {}), new RegExp(`^land: in lib, task 1\\.2's branch ${show.branch} does not descend from the chain's tip, ${rates.branch} \\(\\w+\\) — merge it back onto ${rates.branch} first$`));
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1'], ['pay-1-1'], ['pay-1-1']]);
    });
  });
}
