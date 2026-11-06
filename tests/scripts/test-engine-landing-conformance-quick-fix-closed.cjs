'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix closed (R10): the
// contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn. `land open`, the one verb that puts a
// fix in its stack, refuses a fix closed — a fix closed lands nothing —
// alone in its set, where the close then lands nothing, and between two
// fixes, where the fix after it opens onto the fix below and the close
// lands those two alone. The chain itself is
// test-engine-landing-conformance-quick-fix.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses } = require('./engine-harness.cjs');
const { own } = require('./landing-world.cjs');
const { UNIT, CHAIN, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, changed, landed, record } = quickFixConformance(name, `engine-landing-quick-fix-closed-${name}-`);
  /** Fix `n` closed with a reason. @param {string} at @param {number} n */
  const close = (at, n) => ok(at, ['task', 'close', UNIT, `1.${n}`, '--reason', 'The wrong approach.'], as());
  /** The refusal of fix `n`'s opening. @param {string} at @param {number} n */
  const openRefused = (at, n) => refuses(at, ['land', 'open', UNIT, `1.${n}`], as()).error;
  /** The checklist closed and the close made. @param {string} at */
  const finished = (at) => {
    checklistClosed(at, as());
    ok(at, ['finish', 'yes', UNIT], as());
  };

  describe(`the ${name} landing driver's quick-fix, a fix closed (R10)`, () => {
    it('refuses the opening of a fix closed alone in its set, a fix closed landing nothing, and the close lands nothing', () => {
      const at = project();
      changed(at, 1);
      record(at, 1);
      close(at, 1);
      const refusal = openRefused(at, 1);
      finished(at);

      assert.deepStrictEqual([refusal, landed(at)], [`land: task 1.1 of ${UNIT} is closed — a fix closed lands nothing`, []]);
    });

    it('refuses the opening of a fix closed between two fixes, the fix after it opening onto the fix below, and the close lands those two alone', () => {
      const at = project();
      changed(at, 1);
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      changed(at, 2);
      close(at, 2);
      const refusal = openRefused(at, 2);
      changed(at, 3);
      const { base } = own(ok(at, ['land', 'open', UNIT, '1.3'], as()));
      ok(at, ['task', 'done', UNIT, '1.3'], as());
      record(at, 1);
      record(at, 3);
      finished(at);

      assert.deepStrictEqual([refusal, base, landed(at)], [
        `land: task 1.2 of ${UNIT} is closed — a fix closed lands nothing`,
        taskBranch({ unit: UNIT, phase: 1, n: 1 }, 'fix', CHAIN[0].title),
        [CHAIN[0], CHAIN[2]].map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]),
      ]);
    });
  });
}
