'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite across nested repositories, a task changed
// after its phase landed (7.2.23): the contract every landing driver meets,
// run through the `land` verbs against each shipped driver in turn. Its
// branch pointing the submodule at the task's own commit, which the
// submodule's landing holds, and given a commit on top, `land phase` lands
// the change with each pointer settled as a phase's first landing settles
// it — main pointing the submodule at its landing, never at the commit off
// its default branch. Its submodule's part squashed by hand there, outside
// what the driver opened, then taken back on its branch there before any
// verb read it, `land phase` lands the take-back over that landing, never
// asking it kept aside as a task of its own (N3).
// The engine's own move of a pointer is test-engine-land-nested-again.cjs's.
// A driver's side (tests/drivers/{name}/landing.cjs) readies each
// repository and reads what landed where; this file names no driver and no
// tool. Conformance layer: the nested world (landing-world.cjs), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { NESTED, NESTED_TASKS, openArgs, own, commitFiles, nestedConformance, landedHere, heldOn } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { side, project, ok, pointer } = nestedConformance(name, `engine-landing-nested-again-${name}-`);

  describe(`the ${name} landing driver across nested repositories, a task changed after its phase landed, its branch pointing ext at the task's own commit (7.2.23)`, () => {
    it('a commit on top of its branch: land phase lands its change, main pointing ext at ext\'s landing, never at the commit off ext\'s main', () => {
      const at = project();
      for (const task of [rates, show]) ok(at.dir, openArgs(task));
      ok(at.dir, ['land', 'phase', 'pay', '1']);
      const landing = side.defaultTip(at.ext);
      commitFiles(at.dir, rates.branch, rates.branch, { 'more.txt': 'more\n' });
      const before = landedHere(at.dir, '1.1');
      const again = own(ok(at.dir, ['land', 'phase', 'pay', '1']));

      assert.deepStrictEqual([before, again.merged, pointer(at), side.defaultTip(at.ext), heldOn(side.on(at.dir), 'more.txt'), landedHere(at.dir, '1.1')], [
        false, ['1.1'], landing, landing, 'more\n', true,
      ]);
    });

    it('its part in ext squashed by hand there, then taken back on its branch there before any verb read it: land phase lands the take-back in ext, and again answers already (N3)', () => {
      const at = project();
      for (const task of [rates, show]) ok(at.dir, openArgs(task));
      side.squashedHere(at.ext, rates.branch, NESTED.ext.into);
      commitFiles(at.ext, rates.branch, rates.branch, { 'ext-more.txt': 'more\n' }, { removed: ['ext-rates.txt'] });
      ok(at.dir, ['land', 'phase', 'pay', '1']);

      assert.deepStrictEqual([side.holds(at.ext, NESTED.ext.into).filter((file) => file.startsWith('ext-')), ok(at.dir, ['land', 'phase', 'pay', '1']).already], [['ext-more.txt'], true]);
    });
  });
}
