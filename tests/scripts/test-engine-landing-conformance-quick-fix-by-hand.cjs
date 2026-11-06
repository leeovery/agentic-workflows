'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix merged by hand before its
// done (R11): the contract every landing driver meets, run through the
// engine's verbs against each shipped driver in turn, and each way its side
// says a person merges a fix onto the branch it lands on outside the
// engine. A fix's landing is read alone, never through its phase's merge
// state: a fix merged by hand before its done has landed — its opening
// refused naming its done, its close naming the reversal — and is done,
// recorded and closed with its change landed. A later fix in flight when
// the fix below is merged by hand is
// test-engine-landing-conformance-quick-fix-by-hand-laid-on.cjs's; a stack
// merged in part on a host, and one merged whole there before the branch
// here is brought to it, the host driver's own suite's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
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
  const { side, as, project, changed, record } = quickFixConformance(name, `engine-landing-quick-fix-by-hand-${name}-`);
  const fix = { unit: UNIT, phase: 1, n: 1 };

  for (const [how, merge] of Object.entries(side.byHand)) {
    describe(`the ${name} landing driver's quick-fix, a fix merged by hand by ${how} before its done (R11)`, () => {
      it('reads it as landed: its opening refused naming its done, its close naming the reversal; done, recorded, and closed with its change landed', () => {
        const at = project();
        changed(at, 1);
        ok(at, ['land', 'open', UNIT, '1.1'], as());
        merge(at, fix, taskBranch(fix, 'fix', CHAIN[0].title));
        const opening = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
        const closing = refuses(at, ['task', 'close', UNIT, '1.1', '--reason', 'Merged by hand.'], as()).error;
        ok(at, ['task', 'done', UNIT, '1.1'], as());
        record(at, 1);
        checklistClosed(at, as());
        ok(at, ['finish', 'yes', UNIT], as());

        assert.deepStrictEqual([opening, closing, readManifest(at, UNIT).status, side.holds(at).includes(CHAIN[0].file)], [
          `land: task 1.1 of ${UNIT} has landed — a fix is done once it lands: task done ${UNIT} 1.1`,
          `task close: task 1.1 of ${UNIT} has landed — so it is done, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`,
          'completed', true,
        ]);
      });
    });
  }
}
