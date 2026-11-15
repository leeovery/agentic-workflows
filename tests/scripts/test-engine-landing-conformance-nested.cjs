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
// each brought up by a later phase's start and landed on its default branch
// at finish, children first — a submodule pointer both sides moved pointed,
// at either, at a commit the submodule's branch holds with both moves, the
// project's landing then pointing the submodule at a commit the
// submodule's default branch holds (7.2.40, 7.2.36, 7.S37) — and where
// each repository's branch was squashed by hand, the project's first, the
// project re-pointed at the submodule's landing (7.2.32). A verb refused in
// one repository is
// test-engine-landing-conformance-nested-refusals.cjs's; fix phases stacked
// on a phase that moved the pointer,
// test-engine-landing-conformance-stacked.cjs's and
// test-engine-landing-conformance-stacked-finish.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the nested world (landing-world.cjs), built once per driver and copied
// for each test. Budget: 65 s — every verb runs in three repositories, a
// submodule and a clone, on each driver, and the unit's own branch is
// walked there from its first phase through a later phase's start to
// finish, and squashed by hand at finish (50 s probed, 58 to 65 s in
// loaded gate runs); no lighter world nests a repository, and the unit's
// branch across nested repositories is walked nowhere else.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { tip, git, createFile } = require('./engine-harness.cjs');
const { createManifest, readManifest } = require('./discovery-test-utils.cjs');
const { NESTED, NESTED_TASKS, openArgs, nestedConformance, finishReady, buildBegun, startClosed, phaseReviewed, commitFiles } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show, cache } = NESTED_TASKS;

/** @typedef {import('./landing-world.cjs').Nested} Nested */

for (const { name } of listDrivers('landing')) {
  const { side, project, repos, pointer, ok, refuses, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-nested-${name}-`);

  /** The submodule's default branch moved by a commit writing `file`, pushed where the driver lands it, and the project's default branch pointing the submodule at it: that commit. @param {Nested} at @param {string} file */
  const extMoved = (at, file) => {
    git(at.ext, ['switch', '-q', '--detach', NESTED.ext.into]);
    createFile(at.ext, file, `${file}\n`);
    git(at.ext, ['add', file]);
    git(at.ext, ['commit', '-q', '-m', `Write ${file}`]);
    git(at.ext, ['branch', '-f', NESTED.ext.into, 'HEAD']);
    side.pushed(at.ext, NESTED.ext.into);
    git(at.dir, ['add', NESTED.ext.folder]);
    git(at.dir, ['commit', '-q', '-m', `Point ext at ${file}`]);
    side.pushed(at.dir);
    return tip(at.ext, 'HEAD');
  };

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

    it('a unit with its own branch has one in each repository a task of it touches, made as the task opens; a later phase\'s start brings each default branch in and finish lands each, children first, by merge commits — the submodule\'s pointer, which main moved too each time, pointed at the submodule\'s branch holding both, its landing then at a commit its default branch holds with every change (7.2.40, 7.2.36, 7.S37)', () => {
      const at = project();
      buildBegun(at.dir, 5);
      startClosed(at.dir, 1, side.env);
      const bases = ok(at.dir, openArgs(rates)).repos.map((/** @type {{repo: string, base: string}} */ { repo, base }) => [repo, base]);
      ok(at.dir, openArgs(show));
      phaseReviewed(at.dir, 1, 'auto');
      ok(at.dir, ['land', 'phase', 'pay', '1']);
      const [extLanded, libLanded] = [tip(side.on(at.ext), 'feat/pay'), tip(side.on(at.lib), 'feat/pay')];
      const more = extMoved(at, 'ext-more.txt');
      startClosed(at.dir, 2, side.env);
      const extUp = tip(side.on(at.ext), 'feat/pay');
      const brought = { ext: git(side.on(at.ext), ['log', '-1', '--format=%P %s', extUp]).trim(), pointed: git(side.on(at.dir), ['rev-parse', `feat/pay:${NESTED.ext.folder}`]).trim(), lib: tip(side.on(at.lib), 'feat/pay') };
      extMoved(at, 'ext-late.txt');
      finishReady(at.dir);
      const finished = ok(at.dir, ['land', 'finish', 'pay']).repos.filter((/** @type {{landed?: string}} */ answer) => answer.landed !== undefined).map((/** @type {{repo: string, landed: string}} */ { repo, landed }) => [repo, landed]);
      const holds = git(side.on(at.ext), ['ls-tree', '--name-only', pointer(at)]).split('\n');
      const tasks = Object.fromEntries(Object.entries(tasksLanded(at)).map(([repo, ids]) => [repo, ids.filter((id) => id !== null).sort()]));

      assert.deepStrictEqual({ bases, brought, finished, tasks, pointed: pointsAtSubmodule(at), holds: ['ext-more.txt', 'ext-late.txt', 'ext-rates.txt'].map((file) => holds.includes(file)) }, {
        bases: [['ext', 'feat/pay'], ['lib', 'feat/pay'], ['.', 'feat/pay']],
        brought: { ext: `${extLanded} ${more} Merge main into feat/pay`, pointed: extUp, lib: libLanded },
        finished: [['ext', 'feat/pay'], ['lib', 'feat/pay'], ['.', 'feat/pay']],
        tasks: { '.': ['pay-1-1', 'pay-1-2'], ext: ['pay-1-1'], lib: ['pay-1-1'] },
        pointed: true,
        holds: [true, true, true],
      });
    });

    if (side.mergedOnHost !== null) {
      it('a submodule\'s branch of the unit\'s name on its host alone, holding a commit naming none of its tasks, is another\'s: the first task touching the submodule refused as it opens, nothing opened', () => {
        const at = project();
        buildBegun(at.dir, 5);
        startClosed(at.dir, 1, side.env);
        commitFiles(side.on(at.ext), 'feat/pay', NESTED.ext.into, { 'theirs.txt': 'theirs\n' }, { message: 'Their own work' });

        assert.deepStrictEqual([refuses(at.dir, openArgs(rates)), side.opened(at.dir)], [
          'land: in ext, feat/pay on ext\'s origin holds commits main lacks, so it is no branch the unit made: nothing was made and nothing opened — delete or rename it there, and open the task again', [],
        ]);
      });
    }

    it('a unit with its own branch squashed by hand onto each default branch, the project\'s first, is read landed at finish, nothing more landing, the project\'s default branch re-pointed at the submodule\'s landing (7.S37, 7.2.32)', () => {
      const at = project();
      buildBegun(at.dir, 5);
      startClosed(at.dir, 1, side.env);
      ok(at.dir, openArgs(rates));
      ok(at.dir, openArgs(show));
      phaseReviewed(at.dir, 1, 'auto');
      ok(at.dir, ['land', 'phase', 'pay', '1']);
      finishReady(at.dir);
      side.squashedHere(at.dir, 'feat/pay', 'main');
      side.squashedHere(at.ext, 'feat/pay', NESTED.ext.into);
      side.squashedHere(at.lib, 'feat/pay', NESTED.lib.into);
      const finished = ok(at.dir, ['land', 'finish', 'pay']).repos.map((/** @type {{repo: string, already: boolean, repointed?: {pointers: Record<string, string>}}} */ { repo, already, repointed }) => ({ repo, already, pointers: repointed?.pointers }));

      assert.deepStrictEqual({ finished, pointed: pointsAtSubmodule(at), landed: side.landed(at.dir).map(({ subject }) => subject) }, {
        finished: [{ repo: '.', already: true, pointers: { [NESTED.ext.folder]: side.defaultTip(at.ext, NESTED.ext.into) } }],
        pointed: true,
        landed: ['Spell it the British way', 'chore(pay): point ext at its landing'],
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
