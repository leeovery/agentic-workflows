'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix below merged back onto
// the fix laid on it (R8): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. A fix's
// own work is its own commits through the door: a fix opened over the fix
// below before that one held any, the fix below then merged back onto it
// once it does — every git command asked of the shell guard, the merge
// committed through the door — is done in its turn, and both land,
// recorded. The order fixes open and end in is
// test-engine-landing-conformance-quick-fix-order.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, createFile, readManifest } = require('./engine-harness.cjs');
const { UNIT, CHAIN, createFix, guardedGit, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, changed, landed, record } = quickFixConformance(name, `engine-landing-quick-fix-merge-back-${name}-`);
  /** Fix `n` of the chain's branch. @param {number} n */
  const branchOf = (n) => taskBranch({ unit: UNIT, phase: 1, n }, 'fix', CHAIN[n - 1].title);

  describe(`the ${name} landing driver's quick-fix, a fix below merged back onto the fix laid on it (R8)`, () => {
    it('is done with a fix opened over the fix below before that one held a commit, the fix below merged back onto it once it did through the shell guard and the door, and both land, recorded', () => {
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

      assert.strictEqual(behind.slice(behind.indexOf(' — ') + 3), `merge ${branchOf(2)} back into ${branchOf(1)} through the door, under the fix — with it out, `
        + `\`git merge --no-ff --no-commit ${branchOf(2)}\`, settling any conflict, then \`engine commit --paths <file>… --task ${UNIT} 1.1 -m "<message>"\`, and open it again`);
      assert.deepStrictEqual([landed(at), readManifest(at, UNIT).fixes.recorded], [
        [CHAIN[1], CHAIN[0]].map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]), [`${UNIT}-1-1`, `${UNIT}-1-2`],
      ]);
    });
  });
}
