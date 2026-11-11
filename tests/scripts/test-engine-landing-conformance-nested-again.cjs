'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite across nested repositories, a task changed
// after its phase landed (7.2.23): the contract every landing driver meets,
// run through the `land` verbs against each shipped driver in turn. Its
// branch pointing the submodule at the task's own commit, which the
// submodule's landing holds, `land phase` lands the change with each
// pointer settled as a phase's first landing settles it — main pointing the
// submodule at its landing, never at the commit off its default branch.
// The engine's own move of a pointer is test-engine-land-nested-again.cjs's.
// A driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository and reads what landed where; this file names no driver and no
// tool. Conformance layer: the nested world (landing-world.cjs), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, own, commitFiles, nestedConformance, landedHere, heldOn } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;

/** The ways task 1.1 changes after its phase landed, its branch's pointer kept at its own commit: each by what it does. */
const CHANGES = {
  /** A commit on top of its branch. @param {import('./landing-world.cjs').Nested} at */
  'on top of its branch': (at) => commitFiles(at.dir, rates.branch, rates.branch, { 'more.txt': 'more\n' }),
  /** Its last commit made again, keeping its own pointer. @param {import('./landing-world.cjs').Nested} at */
  'its last commit made again': (at) => commitFiles(at.dir, rates.branch, `${rates.branch}^`, { 'rates.txt': 'rates\n', 'more.txt': 'more\n' }, {
    gitlinks: { [NESTED.ext.folder]: git(at.dir, ['rev-parse', `${rates.branch}:${NESTED.ext.folder}`]).trim() },
    message: 'feat(pay): rates, made again\n\nLeeway-Task: pay-1-1',
  }),
};

for (const { name } of listDrivers('landing')) {
  const { side, project, ok, pointer } = nestedConformance(name, `engine-landing-nested-again-${name}-`);

  describe(`the ${name} landing driver across nested repositories, a task changed after its phase landed, its branch pointing ext at the task's own commit (7.2.23)`, () => {
    for (const [how, change] of Object.entries(CHANGES)) {
      it(`${how}: land phase lands its change, main pointing ext at ext's landing, never at the commit off ext's main`, () => {
        const at = project();
        for (const task of [rates, show]) ok(at.dir, openArgs(task));
        ok(at.dir, ['land', 'phase', 'pay', '1']);
        const landing = side.defaultTip(at.ext);
        change(at);
        const before = landedHere(at.dir, '1.1');
        const again = own(ok(at.dir, ['land', 'phase', 'pay', '1']));

        assert.deepStrictEqual([before, again.merged, pointer(at), side.defaultTip(at.ext), heldOn(side.on(at.dir), 'more.txt'), landedHere(at.dir, '1.1')], [
          false, ['1.1'], landing, landing, 'more\n', true,
        ]);
      });
    }
  });
}
