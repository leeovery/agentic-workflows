'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, the order its fixes open and
// end in (7.2.3, 19.S32): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. A fix
// opens only after each fix it is laid on, and is done only once it is
// opened, on every driver alike: `task done` refuses a fix not opened,
// naming its opening, and `land open` a fix laid on one not opened, naming
// that one's — so no pull request carries a fix below it — and, opened in
// turn, each lands with only its own change. The chain itself is
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
const { UNIT, CHAIN, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, changed, landed, closed } = quickFixConformance(name, `engine-landing-quick-fix-order-${name}-`);

  describe(`the ${name} landing driver's quick-fix, in the order its fixes open (7.2.3, 19.S32)`, () => {
    it('refuses a fix done before it is opened, and the opening of a fix laid on one not opened, each naming the opening owed, so no pull request carries a fix below it; opened in turn, each lands with only its own change', () => {
      const at = project();
      changed(at, 1);
      const unopened = refuses(at, ['task', 'done', UNIT, '1.1'], as()).error;
      changed(at, 2);
      const laid = refuses(at, ['land', 'open', UNIT, '1.2'], as()).error;
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      const { base } = own(ok(at, ['land', 'open', UNIT, '1.2'], as()));
      ok(at, ['task', 'done', UNIT, '1.2'], as());
      closed(at);

      assert.deepStrictEqual([unopened, laid, base], [
        `task done: task 1.1 of ${UNIT} is not opened to land as its branch stands — a fix is done once it lands: land open ${UNIT} 1.1`,
        `land: task 1.2 of ${UNIT} is laid on 1.1, not opened to land — a fix opens after each fix it is laid on: land open ${UNIT} 1.1`,
        taskBranch({ unit: UNIT, phase: 1, n: 1 }, 'fix', CHAIN[0].title),
      ]);
      assert.deepStrictEqual(landed(at), CHAIN.slice(0, 2).map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
    });
  });
}
