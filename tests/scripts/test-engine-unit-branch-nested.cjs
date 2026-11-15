'use strict';

// ---------------------------------------------------------------------------
// A unit's own branch kept current across nested repositories (7.2.36;
// leeway-engine/scripts/domain/unit-branch.cjs, `bringUp`): a later phase's
// start brings each repository's default branch into its `feat/{unit}`,
// children first, so the project's merge points a submodule whose pointer
// both sides moved at the submodule's `feat/{unit}` as brought up, which
// holds both, and a repository whose default branch stood still moves
// nothing. The bring-up in one repository is
// test-engine-unit-branch-current.cjs's; the branch landed at finish across
// them, test-engine-landing-conformance-nested.cjs's.
// Conformance layer: the nested world (landing-world.cjs,
// `nestedConformance`), built once per driver and copied for each test.
// This file names no driver and no tool.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { tip, git, createFile } = require('./engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, nestedConformance, buildBegun, startClosed, phaseReviewed } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { side, project, ok } = nestedConformance(name, `engine-unit-branch-nested-${name}-`);

  describe(`a unit's own branch kept current across nested repositories through the ${name} landing driver (7.2.36)`, () => {
    it('a later phase\'s start brings each repository\'s default branch into its feat/pay, children first, the project\'s merge pointing the submodule, which both sides moved, at the submodule\'s feat/pay as brought up, a repository whose default branch stood still moving nothing', () => {
      const at = project();
      buildBegun(at.dir, 5);
      startClosed(at.dir, 1, side.env);
      ok(at.dir, openArgs(rates));
      ok(at.dir, openArgs(show));
      phaseReviewed(at.dir, 1, 'auto');
      ok(at.dir, ['land', 'phase', 'pay', '1']);
      const [extLanded, libLanded] = [tip(side.on(at.ext), 'feat/pay'), tip(side.on(at.lib), 'feat/pay')];
      git(at.ext, ['switch', '-q', '--detach', NESTED.ext.into]);
      createFile(at.ext, 'ext-more.txt', 'more\n');
      git(at.ext, ['add', 'ext-more.txt']);
      git(at.ext, ['commit', '-q', '-m', 'More of ext']);
      git(at.ext, ['branch', '-f', NESTED.ext.into, 'HEAD']);
      side.pushed(at.ext, NESTED.ext.into);
      const more = tip(side.on(at.ext), NESTED.ext.into);
      git(at.dir, ['add', NESTED.ext.folder]);
      git(at.dir, ['commit', '-q', '-m', 'Point ext at more']);
      side.pushed(at.dir);
      startClosed(at.dir, 2, side.env);
      const extNow = tip(side.on(at.ext), 'feat/pay');

      assert.deepStrictEqual({
        ext: git(side.on(at.ext), ['log', '-1', '--format=%P %s', extNow]).trim(),
        pointed: git(side.on(at.dir), ['rev-parse', `feat/pay:${NESTED.ext.folder}`]).trim(),
        lib: tip(side.on(at.lib), 'feat/pay'),
      }, { ext: `${extLanded} ${more} Merge main into feat/pay`, pointed: extNow, lib: libLanded });
    });
  });
}
