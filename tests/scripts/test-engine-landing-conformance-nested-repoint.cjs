'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's submodule merged by hand after the
// project holding it (7.2.21): a task moving the submodule's pointer, its
// pull request in the project squashed by hand first, the project's default
// branch then pointing the submodule at the task's own commit there, then
// its pull request in the submodule squashed by hand, so the submodule's
// default branch holds the change and not the commit. The next landing
// points the project at the submodule's landing of the change, by a commit
// of its own landed as the driver lands a change, and goes on — where it
// would refuse, a pull bringing nothing. A default branch pointing the
// submodule at a commit whose change no landing there holds is refused
// still: test-engine-land-nested.cjs's and
// tests/drivers/github/test-landing-nested-merge-up.cjs's. A quick-fix's is
// test-engine-landing-conformance-quick-fix-submodule-by-hand.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository, merges by hand and reads what landed where; this file names
// no driver and no tool. Conformance layer: the nested world
// (landing-world.cjs), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { NESTED, NESTED_TASKS, openArgs, nestedConformance } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { side, project, ok, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-nested-repoint-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's submodule merged by hand after the project holding it, each by ${how} (7.2.21)`, () => {
    it('the next landing points the project at the submodule\'s landing of the change, by a commit of its own, and lands', () => {
      const at = project();
      ok(at.dir, openArgs(rates));
      merge(at.dir, rates.branch, 'main');
      merge(at.ext, rates.branch, NESTED.ext.into);
      const landing = side.defaultTip(at.ext, NESTED.ext.into);
      const before = side.landed(at.dir).length;

      const merged = ok(at.dir, ['land', 'phase', 'pay', '1']);

      const [repointing] = side.landed(at.dir).slice(before);
      const { repo, already, repointed } = merged.repos.at(-1);
      assert.deepStrictEqual([repo, already, repointed.pointers], ['.', undefined, { [NESTED.ext.folder]: landing }]);
      assert.deepStrictEqual(repointing, { subject: 'chore(pay): point ext at its landing', task: null, paths: [NESTED.ext.folder] });
      assert.deepStrictEqual(tasksLanded(at).lib, ['pay-1-1']);
      assert.ok(pointsAtSubmodule(at), 'the project\'s default branch points the submodule off its default branch');
    });
  });
}
