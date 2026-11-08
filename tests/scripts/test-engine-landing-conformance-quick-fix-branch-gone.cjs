'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix merged by hand whose
// branch is then deleted (R12 (b)): the contract every landing driver
// meets, run through the engine's verbs against each shipped driver in
// turn, and each way its side says a person merges a fix outside the
// engine. A fix's landing is read by its change on the branch it lands on,
// its last commit read whether or not its branch is left: merged by hand
// and its branch deleted, as `gh pr merge --delete-branch` or `git branch
// -d` leaves it, the fix's opening is refused, naming its done, and its
// close naming the reversal; it is done — never asked whether its branch
// moved — its opening then refused as done; and it is recorded and closed
// with its change landed. One whose branch is kept is
// test-engine-landing-conformance-quick-fix-by-hand.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand,
// deletes a branch and reads what landed where; this file names no driver
// and no tool. Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, readManifest } = require('./engine-harness.cjs');
const { UNIT, CHAIN, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project, changed, record } = quickFixConformance(name, `engine-landing-quick-fix-branch-gone-${name}-`);
  const fix = { unit: UNIT, phase: 1, n: 1 };
  const branch = taskBranch(fix, 'fix', CHAIN[0].title);

  for (const [how, merge] of Object.entries(side.byHand)) {
    describe(`the ${name} landing driver's quick-fix, a fix merged by hand by ${how}, its branch then deleted (R12)`, () => {
      it('reads it as landed: its opening refused naming its done, its close naming the reversal; done, its opening then refused as done; recorded, and closed with its change landed', () => {
        const at = project();
        changed(at, 1);
        ok(at, ['land', 'open', UNIT, '1.1'], as());
        merge(at, fix, branch);
        side.deleted(at, branch);
        const opening = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
        const closing = refuses(at, ['task', 'close', UNIT, '1.1', '--reason', 'Merged by hand.'], as()).error;
        ok(at, ['task', 'done', UNIT, '1.1'], as());
        const reopening = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
        record(at, 1);
        checklistClosed(at, as());
        ok(at, ['finish', 'yes', UNIT], as());

        assert.deepStrictEqual([opening, closing, reopening, readManifest(at, UNIT).status, side.holds(at).includes(CHAIN[0].file)], [
          `land: task 1.1 of ${UNIT} has landed — a fix is done once it lands: task done ${UNIT} 1.1`,
          `task close: task 1.1 of ${UNIT} has landed — so it is done, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`,
          `land: task 1.1 of ${UNIT} has landed, and is done — nothing of it is left to open`,
          'completed', true,
        ]);
      });
    });
  }
}
