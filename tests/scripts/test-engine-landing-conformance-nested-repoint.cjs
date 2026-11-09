'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's submodule merged by hand after the
// project holding it (7.2.21): a task moving the submodule's pointer, its
// pull request in the project merged by hand first, the project's default
// branch then pointing the submodule at the task's own commit there, then
// its pull request in the submodule, so the submodule's default branch
// holds the change and not the commit. The next landing points the
// project at the submodule's landing of the change in one commit and goes
// on — where it would refuse, a pull bringing nothing: the merge's own,
// where it moves the submodule, else one of its own after it, landed as
// the driver lands a change. A later task of the phase, opened on it,
// moving the submodule again lands its pointer at the submodule's landing
// of its change, no re-point made, by a squash and a rebase. A default branch pointing the submodule
// at a commit whose change no landing there holds is refused still:
// test-engine-land-nested.cjs's and
// tests/drivers/github/test-landing-nested-merge-up.cjs's. A quick-fix's is
// test-engine-landing-conformance-quick-fix-submodule-repoint.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository, merges by hand and reads what landed where; this file names
// no driver and no tool. Conformance layer: the nested world
// (landing-world.cjs), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { NESTED, NESTED_TASKS, openArgs, commitFiles, nestedConformance } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;
const { folder: EXT, into: EXT_INTO } = NESTED.ext;

for (const { name } of listDrivers('landing')) {
  const { side, project, ok, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-nested-repoint-${name}-`);

  /**
   * Task 1.1 opened — and, `again`, task 1.2 on it, moving the submodule
   * again — then 1.1 merged by hand by `merge` in the project, then in the
   * submodule: the world.
   * @param {(dir: string, branch: string, into?: string) => void} merge @param {boolean} again
   */
  const mergedByHand = (merge, again) => {
    const at = project();
    if (again) commitFiles(at.dir, show.branch, show.branch, {}, { gitlinks: { [EXT]: commitFiles(at.ext, show.branch, rates.branch, { 'ext-show.txt': 'show\n' }) } });
    ok(at.dir, openArgs(rates));
    if (again) ok(at.dir, openArgs(show));
    merge(at.dir, rates.branch, 'main');
    merge(at.ext, rates.branch, EXT_INTO);
    return at;
  };

  /** The project's commits landed since `before` that moved the submodule. @param {import('./landing-world.cjs').Nested} at @param {number} before */
  const extMoves = (at, before) => side.landed(at.dir).slice(before).filter(({ paths }) => paths.includes(EXT));

  const [[how, merge]] = Object.entries(side.byHand);
  describe(`the ${name} landing driver's submodule merged by hand after the project holding it, each by ${how} (7.2.21)`, () => {
    it('the next landing points the project at the submodule\'s landing of the change in one commit — the merge\'s own where it moves the submodule, else one of its own after it — and lands', () => {
      const at = mergedByHand(merge, false);
      const landing = side.defaultTip(at.ext, EXT_INTO);
      const before = side.landed(at.dir).length;

      const merged = ok(at.dir, ['land', 'phase', 'pay', '1']);

      const moves = extMoves(at, before);
      const { repo, repointed } = merged.repos.at(-1);
      assert.deepStrictEqual([repo, moves.length], ['.', 1]);
      if (repointed !== undefined) {
        assert.deepStrictEqual([repointed.pointers, moves[0].subject], [{ [EXT]: landing }, 'chore(pay): point ext at its landing']);
      }
      assert.deepStrictEqual(tasksLanded(at).lib, ['pay-1-1']);
      assert.ok(pointsAtSubmodule(at), 'the project\'s default branch points the submodule off its default branch');
    });
  });

  for (const [way, mergeBy] of Object.entries(side.byHand).filter(([named]) => /squash|rebase/.test(named))) {
    describe(`the ${name} landing driver's submodule merged by hand after the project holding it, each by ${way}, then moved again by a later task (7.2.21)`, () => {
      it('the later task\'s landing points the project at the submodule\'s landing of its change, no re-point made', () => {
        const at = mergedByHand(mergeBy, true);
        const before = side.landed(at.dir).length;

        const merged = ok(at.dir, ['land', 'phase', 'pay', '1']);

        assert.deepStrictEqual(merged.repos.map((/** @type {{repointed?: unknown}} */ { repointed }) => repointed), merged.repos.map(() => undefined));
        assert.deepStrictEqual(extMoves(at, before).map(({ subject }) => subject).at(-1), 'feat(pay): Show rates');
        assert.ok(pointsAtSubmodule(at), 'the project\'s default branch points the submodule off its default branch');
      });
    });
  }
}
