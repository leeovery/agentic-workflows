'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its pull request merged by
// hand, its branch then deleted (R12, R14): the contract every landing
// driver meets, run through the engine's verbs against each shipped driver
// in turn, merged as the driver's side first merges by hand — every way it
// merges is the by-hand suite's. A fix the merge landed reads as landed by
// its change on the branch it lands on as the host has it, its own commit
// found where the deleted branch leaves it: its opening refused naming its
// done, its close naming the reversal; done, its opening then refused as
// done. A fix started after cuts the quick-fix's branch again from that
// branch as the host has it, commits there, and lands alone through a pull
// request of its own at the close. A pull request merged mid-set with the
// branch kept, and a commit replayed, are
// test-engine-landing-conformance-quick-fix-by-hand.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, git, readManifest } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project, changed, built, record, landed } = quickFixConformance(name, `engine-landing-quick-fix-branch-gone-${name}-`);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, its pull request merged by hand by ${how}, its branch then deleted (R12, R14)`, () => {
    it('reads the fix it landed as landed — its opening refused naming its done, its close naming the reversal; done, its opening then refused as done — and a fix started after cuts the branch again from the branch it lands on, landing alone at the close', () => {
      const at = project();
      changed(at, 1);
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      merge(at, BRANCH);
      side.deleted(at, BRANCH);
      const opening = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
      const closing = refuses(at, ['task', 'close', UNIT, '1.1', '--reason', 'Merged by hand.'], as()).error;
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      const reopening = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
      const host = side.defaultTip(at);
      built(at, 2);
      const cut = git(at, ['merge-base', BRANCH, host]).trim();
      record(at, 1);
      record(at, 2);
      checklistClosed(at, as());
      ok(at, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual([opening, closing, reopening], [
        `land: task 1.1 of ${UNIT} has landed — a fix is done once it lands: task done ${UNIT} 1.1`,
        `task close: task 1.1 of ${UNIT} holds work of its own — it has landed, so it is done, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`,
        `land: task 1.1 of ${UNIT} has landed, and is done — nothing of it is left to open`,
      ]);
      assert.deepStrictEqual([cut, landed(at).at(-1), readManifest(at, UNIT).status, side.holds(at).includes(SET[0].file)], [
        host, [`fix(${UNIT}): ${DESCRIPTION}`, [SET[1].file]], 'completed', true,
      ]);
    });
  });
}
