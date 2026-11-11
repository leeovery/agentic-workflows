'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix of two commits, the
// second rewriting the line the first wrote, merged by hand with the set by
// the first way the driver's side merges by hand (7.2.22, R14): the review
// asked for at the close reads every fix landed and nothing not, its first
// commit with it, and the review's fix task starts on the branch cut again,
// nothing left off and no warning. Merged mid-set, it is
// test-engine-landing-conformance-quick-fix-rewritten.cjs's. A driver's
// side (tests/drivers/{name}/landing.cjs) readies the world, merges by hand
// and reads the review's change; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, okSections } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixConformance, fixRewritten, cutLeftOff, checklistClosed } = require('./quick-fix-world.cjs');
const { changeRead, firstRoundFailed } = require('./quick-fix-review-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const [FLAG, HELP] = SET;

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-rewritten-review-${name}-`);
  const { side, as, project, built, record } = conf;
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, a fix of two commits, the second rewriting the line the first wrote, merged by hand with the set by ${how}: its first commit landed with it (7.2.22, R14)`, () => {
    it('the review\'s first change reads every fix landed and nothing not, and its fix task starts on the branch cut again, nothing left off and no warning', () => {
      const at = project();
      fixRewritten(at, as());
      built(at, 2);
      record(at, 1);
      record(at, 2);
      merge(at, BRANCH);
      checklistClosed(at, as());
      ok(at, ['review', 'ask', UNIT], as());
      okSections(at, ['enter', 'review', UNIT], as());
      const change = changeRead(conf, at);
      firstRoundFailed(conf, at);

      assert.deepStrictEqual([change, cutLeftOff(ok(at, ['task', 'start', UNIT, '2.1'], as()))], [{ landed: [FLAG.file, HELP.file].sort(), notLanded: [] }, [[], []]]);
    });
  });
}
