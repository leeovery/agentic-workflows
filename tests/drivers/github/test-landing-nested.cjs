'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver across nested repositories (workflow-engine/
// scripts/drivers/landing/github/), past what every driver gives (the
// nested conformance suite's): a repository a task touches whose remote
// GitHub's driver does not serve — none chosen, or one not on GitHub —
// refused before anything moves, at the open or the merge, naming it, with
// the way on; and the submodule's pointer recorded at its merged tip in one
// commit on the project's top task branch, pushed before the project's
// stack merges, which squashes it into the top task's landing under that
// task's own subject (7.2.17, 7.2.18). Git layer: the nested world
// (landing-world.cjs), each repository on a fake GitHub of its own
// (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('../../scripts/engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, useNestedWorld } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, github, bareOf, tipOnGithub } = require('./world.cjs');

const { git, tip } = harness;
const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('github-landing-nested-', (dir) => {
  side.prepare(dir);
  for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
});

/** A verb that must go through, under the stand-in gh. @param {string} dir @param {string[]} args */
const ok = (dir, args) => harness.ok(dir, args, { env: GH_ENV });

/** A verb that must refuse, its refusal. @param {string} dir @param {string[]} args */
const refused = (dir, args) => harness.refuses(dir, args, { env: GH_ENV }).error;

/** Each pull request's state on GitHub, in each repository at `dirs`. @param {string[]} dirs */
const pullStates = (dirs) => dirs.map((dir) => github(dir).pulls.map(({ state }) => state));

describe('GitHub\'s landing driver across nested repositories (7.2.17)', () => {
  it('refuses, before anything moves, a task touching a repository whose remote it does not serve — none chosen at the open, one not on GitHub at the merge — naming the repository, with the way on', () => {
    const at = project();
    const url = git(at.lib, ['remote', 'get-url', 'origin']).trim();
    git(at.lib, ['remote', 'remove', 'origin']);
    assert.strictEqual(
      refused(at.dir, openArgs(rates)),
      'land: in lib, GitHub\'s driver lands every repository a task touches through that repository\'s own remote, and this one has none chosen — '
      + 'add its repository on GitHub as origin there, or change the landing driver from manage on the start menu',
    );
    assert.deepStrictEqual([pullStates([at.dir, at.ext]), tipOnGithub(at.ext, rates.branch), tipOnGithub(at.dir, rates.branch)], [[[], []], '', '']);

    git(at.lib, ['remote', 'add', 'origin', url]);
    ok(at.dir, openArgs(rates));
    ok(at.dir, openArgs(show));
    git(at.lib, ['remote', 'set-url', 'origin', 'https://git.example.org/acme/lib.git']);
    assert.strictEqual(
      refused(at.dir, ['land', 'phase', 'pay', '1']),
      'land: in lib, its remote, origin, is not on GitHub (https://git.example.org/acme/lib.git), where GitHub\'s driver lands — '
      + 'point it at its repository on GitHub, or change the landing driver from manage on the start menu',
    );
    assert.deepStrictEqual(pullStates([at.dir, at.ext]), [['OPEN', 'OPEN'], ['OPEN']]);
  });

  it('records the submodule\'s pointer at its merged tip in one commit on the project\'s top task branch, pushed before the project\'s stack merges — squashed into the top task\'s landing under that task\'s subject', () => {
    const at = project();
    ok(at.dir, openArgs(rates));
    ok(at.dir, openArgs(show));
    ok(at.dir, ['land', 'phase', 'pay', '1']);

    const merged = tipOnGithub(at.ext, NESTED.ext.into);
    const top = bareOf(at.dir);
    assert.deepStrictEqual(git(top, ['log', '--format=%s', `${rates.branch}..${show.branch}`]).split('\n').filter(Boolean), [
      'chore(pay): point ext at its landing', `work on ${show.branch}`,
    ]);
    assert.strictEqual(git(top, ['rev-parse', `${show.branch}:${NESTED.ext.folder}`]).trim(), merged);
    assert.strictEqual(tip(at.dir, show.branch), tipOnGithub(at.dir, show.branch), 'the branch here is not at the commit pushed');
    assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), ['feat(pay): Add rates', 'feat(pay): Show rates']);
    assert.strictEqual(git(top, ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), merged);
  });
});
