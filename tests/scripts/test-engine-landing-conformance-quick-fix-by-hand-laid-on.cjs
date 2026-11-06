'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a later fix in flight when the
// fix below it is merged by hand (R11): the contract every landing driver
// meets, run through the engine's verbs against each shipped driver in
// turn, and each way its side says a person merges a fix onto the branch it
// lands on outside the engine. A fix opens alone, its phase merged by hand
// no stack for it: laid on a fix landed, and merged back onto the branch it
// lands on, it opens there, is done, and the close lands its own change
// alone. A fix merged by hand before its done is
// test-engine-landing-conformance-quick-fix-by-hand.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, readManifest } = require('./engine-harness.cjs');
const { UNIT, CHAIN, guardedGit, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project, changed, landed, record } = quickFixConformance(name, `engine-landing-quick-fix-by-hand-laid-on-${name}-`);
  const below = { unit: UNIT, phase: 1, n: 1 };
  const landing = `fix(${UNIT}): ${CHAIN[1].title}`;

  for (const [how, merge] of Object.entries(side.byHand)) {
    describe(`the ${name} landing driver's quick-fix, a later fix in flight when the fix below is merged by hand by ${how} (R11)`, () => {
      it('opens it, merged back onto the branch it lands on, there, and the close lands its own change alone', () => {
        const at = project();
        changed(at, 1);
        ok(at, ['land', 'open', UNIT, '1.1'], as());
        ok(at, ['task', 'done', UNIT, '1.1'], as());
        changed(at, 2);
        merge(at, below, taskBranch(below, 'fix', CHAIN[0].title));
        guardedGit(at, ['merge', '--no-ff', '--no-commit', 'main'], as());
        ok(at, ['commit', '--paths', CHAIN[1].file, '--task', UNIT, '1.2', '-m', 'merge main back'], as());
        ok(at, ['land', 'open', UNIT, '1.2'], as());
        ok(at, ['task', 'done', UNIT, '1.2'], as());
        record(at, 1);
        record(at, 2);
        checklistClosed(at, as());
        ok(at, ['finish', 'yes', UNIT], as());

        assert.deepStrictEqual([readManifest(at, UNIT).status, landed(at).filter(([subject]) => subject === landing)], ['completed', [[landing, [CHAIN[1].file]]]]);
      });
    });
  }
}
