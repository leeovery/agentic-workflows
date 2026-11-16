'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a feature's cancel across nested clones
// (18.3.9; leeway-engine/scripts/domain/landing.cjs, `cancelClose`, over
// drivers/landing/github/): the cancel walks the clones holding the unit's
// work, as the land verbs do, closing each task's pull request in each and
// recording each repository's numbers apart, and passes over a clone that
// holds only the unit's branch names, with no remote; reactivated, each
// task opens anew in each repository, one numbered in a clone as none in
// the project is; and its phase's merge opens a stack again in its order,
// a task below another only where, in a repository holding both, it holds
// work of its own — never where its worktree merely made its branch, in a
// clone or in the project. GitHub's alone: no other driver opens a pull request on
// a host. Git layer: the nested world (landing-world.cjs), each repository
// on a fake GitHub of its own (world.cjs), built once and copied for each
// test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { git, initRepo, readManifest, commitAll, statePath } = require('../../scripts/engine-harness.cjs');
const { UNIT, NESTED, NESTED_TASKS, TRACKER, openArgs, track, commitFiles, useNestedWorld } = require('../../scripts/landing-world.cjs');
const { parseShownTask } = require('../../../skills/leeway-engine/scripts/domain/task-id.cjs');
const side = require('./landing.cjs');
const { github, ok } = require('./world.cjs');

const { rates, cache } = NESTED_TASKS;
const project = useNestedWorld('github-landing-cancel-nested-', (dir) => {
  side.prepare(dir);
  for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
});

/** Each repository's pull requests on GitHub, `{number}: {state}`. @param {{dir: string, ext: string, lib: string}} at */
const pulls = (at) => Object.fromEntries(Object.entries({ '.': at.dir, ext: at.ext, lib: at.lib }).map(([repo, dir]) => [repo, github(dir).pulls.map(({ number, state }) => `${number}: ${state}`)]));

describe('GitHub\'s landing driver and a feature\'s cancel across nested clones (18.3.9)', () => {
  it('closes each task\'s pull request in each clone holding the unit\'s work, recording each repository\'s numbers apart, and passes over a clone holding only its branch names, with no remote; reactivated, each task opens anew in each repository', () => {
    const at = project();
    const plain = initRepo(path.join(at.dir, 'plain'));
    git(plain, ['commit', '-q', '--allow-empty', '-m', 'plain']);
    for (const task of [rates, cache]) git(plain, ['branch', task.branch]);
    ok(at.dir, openArgs(rates));
    ok(at.dir, openArgs(cache));

    const cancelled = ok(at.dir, ['workunit', 'cancel', UNIT]);
    const closed = pulls(at);
    ok(at.dir, ['workunit', 'reactivate', UNIT]);
    const opened = [rates, cache].map((task) => ok(at.dir, openArgs(task)).already === true);

    assert.deepStrictEqual([cancelled.pull_requests_closed, readManifest(at.dir, UNIT).closed_by_cancel[0]], [true, { ext: ['1'], lib: ['2', '1'], '.': ['1'] }]);
    assert.deepStrictEqual(closed, { '.': ['1: CLOSED'], ext: ['1: CLOSED'], lib: ['1: CLOSED', '2: CLOSED'] });
    assert.deepStrictEqual([opened, pulls(at)], [[false, false], { '.': ['1: CLOSED', '2: OPEN'], ext: ['1: CLOSED', '2: OPEN'], lib: ['1: CLOSED', '2: CLOSED', '3: OPEN', '4: OPEN'] }]);
  });

  /**
   * Phase 3 stacked across the project and ext, both tasks opened and done,
   * then cancelled and reactivated: `lower` (3.2) changing what `inLower`
   * names, `upper` (3.1) what `inUpper` names, merged back onto the lower's
   * branch in each repository where both change it; each branch made where
   * a task changes nothing, at the branch the repository lands on, as a
   * task's worktree makes it there (12.7.10).
   * @param {{dir: string, ext: string, lib: string}} at @param {('dir'|'ext')[]} inLower @param {('dir'|'ext')[]} inUpper
   */
  function cancelledStack(at, inLower, inUpper) {
    const lower = track(at.dir, '3.2', 'feat', 'Lower');
    const upper = track(at.dir, '3.1', 'feat', 'Upper');
    commitAll(at.dir, 'phase 3\'s tasks');
    for (const repo of /** @type {('dir'|'ext')[]} */ (['dir', 'ext'])) {
      const into = repo === 'dir' ? 'main' : NESTED.ext.into;
      if (inLower.includes(repo)) commitFiles(at[repo], lower.branch, into, { [`${repo}-lower.txt`]: 'lower\n' });
      else git(at[repo], ['branch', lower.branch, into]);
      if (inUpper.includes(repo)) commitFiles(at[repo], upper.branch, inLower.includes(repo) ? lower.branch : into, { [`${repo}-upper.txt`]: 'upper\n' });
      else git(at[repo], ['branch', upper.branch, into]);
    }
    for (const task of [lower, upper]) git(at.lib, ['branch', task.branch, NESTED.lib.into]);
    for (const task of [lower, upper]) ok(at.dir, ['land', 'open', UNIT, task.shown]);
    for (const task of [upper, lower]) {
      const ref = parseShownTask(UNIT, task.shown);
      TRACKER.start(statePath(at.dir), ref);
      TRACKER.done(statePath(at.dir), ref);
    }
    git(statePath(at.dir), ['add', '-A']);
    git(statePath(at.dir), ['commit', '-q', '-m', 'phase 3 done']);
    ok(at.dir, ['workunit', 'cancel', UNIT]);
    ok(at.dir, ['workunit', 'reactivate', UNIT]);
  }

  for (const [where, inLower, inUpper] of /** @type {[string, ('dir'|'ext')[], ('dir'|'ext')[]][]} */ ([
    ['the upper\'s branch made in a clone it changes nothing in', ['dir', 'ext'], ['dir']],
    ['the upper\'s branch made in the project, which it changes nothing in', ['dir', 'ext'], ['ext']],
  ])) {
    it(`a stack the cancel closed opens again in its order at its phase's merge, ${where}`, () => {
      const at = project();
      cancelledStack(at, inLower, inUpper);

      const merged = ok(at.dir, ['land', 'phase', UNIT, '3']).repos.map((/** @type {{repo: string, merged: string[]}} */ repo) => [repo.repo, repo.merged]);

      assert.deepStrictEqual(merged, inUpper.includes('dir') ? [['ext', ['3.2']], ['.', ['3.2', '3.1']]] : [['ext', ['3.2', '3.1']], ['.', ['3.2']]]);
    });
  }
});
