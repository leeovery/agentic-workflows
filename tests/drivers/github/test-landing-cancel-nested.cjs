'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a feature's cancel across nested clones
// (18.3.9; leeway-engine/scripts/domain/landing.cjs, `cancelClose`, over
// drivers/landing/github/): the cancel walks the clones holding the unit's
// work, as the land verbs do, closing each task's pull request in each and
// recording each repository's numbers apart, and passes over a clone that
// holds only the unit's branch names, with no remote; reactivated, each
// task opens anew in each repository, one numbered in a clone as none in
// the project is. GitHub's alone: no other driver opens a pull request on
// a host. Git layer: the nested world (landing-world.cjs), each repository
// on a fake GitHub of its own (world.cjs), built once and copied for each
// test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { git, initRepo, readManifest } = require('../../scripts/engine-harness.cjs');
const { UNIT, NESTED, NESTED_TASKS, openArgs, useNestedWorld } = require('../../scripts/landing-world.cjs');
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
});
