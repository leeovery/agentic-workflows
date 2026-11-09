'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and the answers of a walk that re-points
// (leeway-engine/scripts/domain/landing.cjs, 7.2.21): a task's pull
// requests squashed by hand in every repository it touches, the project's
// first, so the project's default branch points the submodule at the
// task's own commit, whose change the submodule's holds — a merge of
// GitHub's merging nothing there, the project's step re-points alone, and
// `land phase` and `land finish` each answer it, never `already`; and a
// quick-fix's re-point refused, its pull request unmergeable, after the
// project's merge of a fix in the project alone, naming what merged
// before it there, then run again merging the pull request it opened,
// opening none. Where the merge moves the submodule itself, no
// re-point is made: test-engine-landing-conformance-nested-repoint.cjs's.
// Git layer: the nested world (landing-world.cjs) and quick-fix-world.cjs's
// nested quick-fix, each repository on a fake GitHub of its own
// (world.cjs), each built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { refuses } = require('../../scripts/engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, useNestedWorld, finishReady } = require('../../scripts/landing-world.cjs');
const { UNIT, BRANCH, SET, quickFixNestedConformance, checklistClosed } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { github, tipOnGithub, ok } = require('./world.cjs');

const { rates } = NESTED_TASKS;
const { folder: EXT, into: EXT_INTO } = NESTED.ext;
const project = useNestedWorld('github-landing-nested-repoint-answers-', (dir) => {
  side.prepare(dir);
  for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
});
const quickFix = quickFixNestedConformance('github', 'github-landing-nested-repoint-answers-quick-fix-');

/** Task 1.1 opened, then squashed by hand in every repository it touches, the project's first: the world. */
function squashedByHand() {
  const at = project();
  ok(at.dir, openArgs(rates));
  side.mergedOnGithub(at.dir, rates.branch, 'squash', true);
  side.mergedOnGithub(at.ext, rates.branch, 'squash', true, EXT_INTO);
  side.mergedOnGithub(at.lib, rates.branch, 'squash', true, NESTED.lib.into);
  return at;
}

describe('GitHub\'s landing driver and the answers of a walk that re-points (7.2.21)', () => {
  it('land phase answers the project\'s re-point alone, never already', () => {
    const at = squashedByHand();
    const answer = ok(at.dir, ['land', 'phase', 'pay', '1']);

    assert.deepStrictEqual([answer.already, answer.repos.map((/** @type {{repo: string}} */ { repo }) => repo), answer.repos[0].repointed.pointers], [undefined, ['.'], { [EXT]: tipOnGithub(at.ext, EXT_INTO) }]);
  });

  it('land finish answers the project\'s re-point alone', () => {
    const at = squashedByHand();
    finishReady(at.dir);
    const answer = ok(at.dir, ['land', 'finish', 'pay']);

    assert.deepStrictEqual(answer.repos.map((/** @type {{repo: string, phases: unknown[]}} */ { repo, phases }) => [repo, phases]), [['.', []]]);
    assert.deepStrictEqual(answer.repos[0].repointed.pointers, { [EXT]: tipOnGithub(at.ext, EXT_INTO) });
  });

  it('a quick-fix\'s re-point refused after the project\'s merge of a fix there alone names that merge; run again, it merges the pull request it opened, opening none', () => {
    const at = quickFix.project();
    quickFix.built(at, 1, { 'ext/ext.txt': 'ext --colour\n' });
    side.mergedOnGithub(at.dir, BRANCH, 'squash', true);
    side.mergedOnGithub(at.ext, BRANCH, 'squash', true, EXT_INTO);
    quickFix.built(at, 2, { [SET[1].file]: SET[1].text });
    checklistClosed(at.dir, quickFix.as());
    const next = github(at.dir).pulls.length + 1;

    const { error } = refuses(at.dir, ['land', 'finish', UNIT], { env: { ...quickFix.as().env, GH_STUB_FAULT: `unmergeable@pr merge ${next}`, GH_STUB_FAULT_REPO: github(at.dir).repo } });
    assert.match(error, /pointing ext at its landing.* \(typo's pull request merged in the project before it\)$/);
    const again = ok(at.dir, ['land', 'finish', UNIT], quickFix.as().env);
    assert.deepStrictEqual({
      pulled: again.repos.find((/** @type {{repo: string}} */ { repo }) => repo === '.').repointed.pull_request,
      opened: github(at.dir).pulls.filter(({ head }) => head === `chore/${UNIT}-point-submodules`).map(({ number, state }) => ({ number, state })),
    }, { pulled: next, opened: [{ number: next, state: 'MERGED' }] });
  });
});
