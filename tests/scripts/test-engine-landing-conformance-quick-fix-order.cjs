'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, the order its fixes open and
// end in (7.2.3, 19.S32): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. A fix
// opens only after each fix it is laid on, and is done only once it is
// opened, on every driver alike: `task done` refuses a fix not opened,
// naming its opening, and `land open` a fix laid on one not opened, naming
// that one's — so no pull request carries a fix below it — and, opened in
// turn, each lands with only its own change. A fix's own work is its own
// commits through the door (R8): a fix opened over the fix below before
// that one held any, the fix below then merged back onto it once it does,
// is done in its turn, and both land, recorded. The chain itself is
// test-engine-landing-conformance-quick-fix.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, createFile, readManifest } = require('./engine-harness.cjs');
const { own } = require('./landing-world.cjs');
const { UNIT, CHAIN, createFix, guardedGit, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, changed, landed, closed, record } = quickFixConformance(name, `engine-landing-quick-fix-order-${name}-`);
  /** Fix `n` of the chain's branch. @param {number} n */
  const branchOf = (n) => taskBranch({ unit: UNIT, phase: 1, n }, 'fix', CHAIN[n - 1].title);

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
        branchOf(1),
      ]);
      assert.deepStrictEqual(landed(at), CHAIN.slice(0, 2).map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
    });

    it('R8: is done with a fix opened over the fix below before that one held a commit, the fix below merged back onto it once it did through the shell guard and the door, and both land, recorded', () => {
      const at = project();
      createFix(at, 1, CHAIN[0].title, as());
      ok(at, ['task', 'start', UNIT, '1.1'], as());
      changed(at, 2);
      record(at, 2);
      ok(at, ['land', 'open', UNIT, '1.2'], as());
      ok(at, ['task', 'start', UNIT, '1.1'], as());
      createFile(at, CHAIN[0].file, CHAIN[0].text);
      ok(at, ['commit', '--paths', CHAIN[0].file, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the flag`], as());
      record(at, 1);
      const behind = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
      guardedGit(at, ['merge', '--no-ff', '--no-commit', branchOf(2)], as());
      ok(at, ['commit', '--paths', CHAIN[1].file, '--task', UNIT, '1.1', '-m', `merge ${branchOf(2)} back`], as());
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      ok(at, ['task', 'done', UNIT, '1.2'], as());
      checklistClosed(at, as());
      ok(at, ['finish', 'yes', UNIT], as());

      assert.strictEqual(behind.split(' — ')[1], `merge it back onto ${branchOf(2)} first`);
      assert.deepStrictEqual([landed(at), readManifest(at, UNIT).fixes.recorded], [
        [CHAIN[1], CHAIN[0]].map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]), [`${UNIT}-1-1`, `${UNIT}-1-2`],
      ]);
    });
  });
}
