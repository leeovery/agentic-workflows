'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix whose fix a question parks, its
// work set aside in a nested repository conflicting with what the next fix
// committed there (19.5.23, R20): the contract every landing driver meets,
// run through the engine's verbs against each shipped driver in turn. The
// parked fix's start refuses the put back, naming each path from the
// project, the nested repository's folder before it, and its way on in
// that repository's calls (leeway-engine/scripts/domain/fix-aside.cjs). The
// set-aside and put-back that go through:
// test-engine-landing-conformance-quick-fix-nested-aside.cjs. A driver's
// side (tests/drivers/{name}/landing.cjs) readies each repository; this
// file names no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, okSections, refuses, createFile } = require('./engine-harness.cjs');
const {
  UNIT, FLAG, HELP, BRANCH, createFix, fixDone, parkedOn, quickFixNestedConformance,
} = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

/** Where fix 1.1's work is set aside, in each repository holding any. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

for (const { name } of listDrivers('landing')) {
  const { as, project } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-aside-conflict-${name}-`);

  /** A call that must succeed. @param {import('./quick-fix-world.cjs').NestedQuickFix} at @param {string[]} args */
  const run = (at, args) => ok(at.dir, args, as());

  describe(`the ${name} landing driver's quick-fix whose parked fix's work conflicts in a nested repository (19.5.23, R20)`, () => {
    it('the parked fix\'s start refuses a put back that conflicts in a nested repository, naming the path from the project and the way on in that repository\'s calls', async () => {
      const at = project();
      createFix(at.dir, 1, FLAG, as());
      run(at, ['task', 'start', UNIT, '1.1']);
      createFile(at.dir, 'lib/alias.txt', 'lib --color\n');
      await parkedOn(at.dir, '1.1', as());
      createFix(at.dir, 2, HELP, as());
      run(at, ['task', 'start', UNIT, '1.2']);
      createFile(at.dir, 'lib/alias.txt', 'lib --colour\n');
      run(at, ['commit', '--paths', 'lib/alias.txt', '--task', UNIT, '1.2', '-m', `fix(${UNIT}): spell the lib --colour`]);
      run(at, ['land', 'open', UNIT, '1.2']);
      fixDone(at.dir, '1.2', as());
      const { raise } = okSections(at.dir, ['raise', 'draw', UNIT, 'Q1'], as()).res;
      ok(at.dir, ['raise', 'answer', raise, '--pick', '1'], { ...as(), stdin: JSON.stringify({ why: 'Old scripts pass it.' }) });

      assert.strictEqual(refuses(at.dir, ['task', 'start', UNIT, '1.1'], as()).error, `task start: task 1.1 of ${UNIT}'s work, set aside when a question parked it, does not go back onto ${BRANCH} as it stands — it conflicts at lib/alias.txt — so nothing moved: it is kept at ${ASIDE}; see it, \`git -C lib diff ${ASIDE}^ ${ASIDE}\`, drop it, \`git -C lib update-ref -d ${ASIDE}\`, start the task again, engine task start ${UNIT} 1.1, then make its change again by hand and commit it through the door`);
    });
  });
}
