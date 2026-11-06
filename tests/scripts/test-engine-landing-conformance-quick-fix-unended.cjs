'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its set landed only once each
// fix has ended (R11): the contract every landing driver meets, run through
// the engine's verbs against each shipped driver in turn. `land phase` and
// `land finish` land a quick-fix only once each of its fixes is done or
// closed, refused naming each that is neither, and the way on for the first
// of them; nothing lands. The order its fixes open and end in is
// test-engine-landing-conformance-quick-fix-order.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses } = require('./engine-harness.cjs');
const { UNIT, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, changed, landed } = quickFixConformance(name, `engine-landing-quick-fix-unended-${name}-`);

  describe(`the ${name} landing driver's quick-fix, its set landed only once each fix has ended (R11)`, () => {
    it('refuses the set landed, its phase or whole, while a fix is neither done nor closed, naming each, and lands nothing', () => {
      const at = project();
      changed(at, 1);
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      changed(at, 2);
      changed(at, 3);
      const phase = refuses(at, ['land', 'phase', UNIT, '1'], as()).error;
      ok(at, ['task', 'close', UNIT, '1.3', '--reason', 'The wrong approach.'], as());
      const finish = refuses(at, ['land', 'finish', UNIT], as()).error;

      assert.deepStrictEqual([phase, finish, landed(at)], [
        `land: ${UNIT} lands once each of its fixes is done or closed — tasks 1.2, 1.3 are neither: task done ${UNIT} 1.2, or task close ${UNIT} 1.2 --reason <why>`,
        `land: ${UNIT} lands once each of its fixes is done or closed — task 1.2 is neither: task done ${UNIT} 1.2, or task close ${UNIT} 1.2 --reason <why>`,
        [],
      ]);
    });
  });
}
