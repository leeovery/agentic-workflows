'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's fix phase stacked across nested
// repositories and merged as a phase (7.3.4, 7.2.6, 7.2.17, the landing
// half of 7.S19): the contract every landing driver meets for a fix phase
// stacked on a phase that touched every repository, cut from its top
// before it merges, run through the `land` verbs against each shipped
// driver in turn. One of two tasks in the project alone, with no
// branch in a clone, lands after it as a phase, every landing under its
// task's subject (7.2.18), each repository holding what its tasks changed.
// One deleting the phase below's file lands at finish with the file gone
// from the default branch, its change read over the phase below's head
// however that phase merged (S3). Those landing at finish are
// test-engine-landing-conformance-stacked-finish.cjs's; the walk itself is
// test-engine-landing-conformance-nested.cjs's. A driver's
// side (tests/drivers/{name}/landing.cjs) readies each repository and reads
// what landed where; this file names no driver and no tool. Conformance
// layer: the nested world (landing-world.cjs), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { tip } = require('./engine-harness.cjs');
const { NESTED_TASKS, openArgs, track, commitFiles, finishReady, nestedConformance } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;

/** @typedef {import('./landing-world.cjs').Nested} Nested */

/**
 * Fix phase 3, stacked on phase 1, cut from its top before it merges: two
 * tasks in the project alone, with no branch in a clone.
 * @param {Nested} at
 */
function fixPhase(at) {
  const alone = [track(at.dir, '3.1', 'fix', 'Fix the app'), track(at.dir, '3.2', 'fix', 'Fix it more')];
  commitFiles(at.dir, alone[0].branch, show.branch, { 'fix.txt': 'fix\n' });
  commitFiles(at.dir, alone[1].branch, alone[0].branch, { 'more.txt': 'more\n' });
  return alone;
}

for (const { name } of listDrivers('landing')) {
  const { side, project, repos, ok, tasksLanded } = nestedConformance(name, `engine-landing-stacked-${name}-`);

  describe(`the ${name} landing driver's fix phase stacked across nested repositories, merged as a phase (7.2.6, 7.2.17, 7.S19)`, () => {
    it('a fix phase stacked on a phase that touched every repository, in the project alone with no branch in a clone, lands after it as a phase, every landing under its task\'s subject', () => {
      const at = project();
      const fixes = fixPhase(at);
      for (const task of [rates, show, ...fixes]) ok(at.dir, openArgs(task));
      for (const top of ['1.2', '3.2']) ok(at.dir, ['land', 'chain', 'pay', top]);
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1', 'pay-1-2', 'pay-3-1', 'pay-3-2'], ['pay-1-1'], ['pay-1-1']]);

      ok(at.dir, ['land', 'phase', 'pay', '1']);
      assert.deepStrictEqual(ok(at.dir, ['land', 'phase', 'pay', '3']).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['.']);

      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2', 'pay-3-1', 'pay-3-2'], ext: ['pay-1-1'], lib: ['pay-1-1'] });
      assert.deepStrictEqual(side.landed(at.dir).map(({ subject }) => subject), ['feat(pay): Add rates', 'feat(pay): Show rates', 'fix(pay): Fix the app', 'fix(pay): Fix it more']);
      assert.deepStrictEqual(Object.values(repos(at)).map(([dir, into]) => side.holds(dir, into)), [
        ['.gitignore', 'app.txt', 'fix.txt', 'more.txt', 'rates.txt', 'show.txt'], ['ext-rates.txt', 'ext.txt'], ['lib-rates.txt', 'lib.txt'],
      ]);
      for (const [dir, into] of Object.values(repos(at))) assert.strictEqual(tip(dir, into), side.defaultTip(dir, into), `${dir}'s default branch here does not hold its landing`);
    });

    it('a fix phase stacked on phase 1 deleting the file phase 1 added lands at finish with the file gone from the default branch (S3)', () => {
      const at = project();
      const undo = track(at.dir, '3.1', 'fix', 'Drop show');
      commitFiles(at.dir, undo.branch, show.branch, {}, { removed: ['show.txt'] });
      for (const task of [rates, show, undo]) ok(at.dir, openArgs(task));
      ok(at.dir, ['land', 'chain', 'pay', '1.2']);
      ok(at.dir, ['land', 'phase', 'pay', '1']);
      finishReady(at.dir);
      ok(at.dir, ['land', 'finish', 'pay']);

      assert.deepStrictEqual([side.holds(at.dir, 'main').filter((file) => file.endsWith('.txt')), tip(at.dir, 'main') === side.defaultTip(at.dir, 'main')], [['app.txt', 'rates.txt'], true]);
    });
  });
}
