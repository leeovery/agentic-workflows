'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite across nested repositories, the person's
// own commit in the submodule (7.2.21, R31): task 1.2's branch in the
// project pointing the submodule at the person's own commit there, on a
// task's branch cut from 1.1's and holding no commit stamped with that
// task. Where the pointer moves is read by whose work the commits it holds
// past the submodule's default branch are — the person's own commit the
// work of the task whose branch's tip is the lowest holding it
// (task-landed.cjs, `ownersOf`), never 1.1's for its stamp below it: on
// 1.2's branch, that task landed in the submodule with the phase, `land
// phase` points the project at the submodule's landing of 1.2, which holds
// the commit's change — never at 1.1's, which lacks it; on 2.1's, a task
// not landed, at the commit, the task's own pin kept. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads
// what landed where; this file names no driver and no tool. Conformance
// layer: the nested world (landing-world.cjs), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { NESTED, NESTED_TASKS, openArgs, commitFiles, nestedConformance, heldOn } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show, cache } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { project, ok, pointer, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-nested-owner-${name}-`);

  /**
   * The person's own commit made on `task`'s branch in ext, cut from 1.1's;
   * task 1.2's branch in the project pointing ext at it; 1.1 and 1.2
   * opened, and their phase landed.
   * @param {{branch: string}} task
   */
  const landedOver = (task) => {
    const at = project();
    const own = commitFiles(at.ext, task.branch, rates.branch, { 'own.txt': 'mine\n' }, { message: 'my own words' });
    commitFiles(at.dir, show.branch, show.branch, {}, { gitlinks: { [NESTED.ext.folder]: own } });
    for (const each of [rates, show]) ok(at.dir, openArgs(each));
    ok(at.dir, ['land', 'phase', 'pay', '1']);
    return { at, own };
  };

  describe(`the ${name} landing driver across nested repositories, task 1.2 pointing ext at the person's own commit on a task's branch there (7.2.21, R31)`, () => {
    it('on 1.2\'s branch, landed in ext with the phase: main points ext at ext\'s landing of 1.2, holding the commit\'s change — never at 1.1\'s', () => {
      const { at } = landedOver(show);

      assert.deepStrictEqual([tasksLanded(at).ext, pointsAtSubmodule(at), heldOn(at.ext, 'own.txt', pointer(at))], [['pay-1-1', 'pay-1-2'], true, 'mine\n']);
    });

    it('on 2.1\'s branch, not landed: main points ext at the commit, the task\'s own pin kept — never at 1.1\'s landing, which lacks it', () => {
      const { at, own } = landedOver(cache);

      assert.deepStrictEqual([tasksLanded(at).ext, pointer(at)], [['pay-1-1'], own]);
    });
  });
}
