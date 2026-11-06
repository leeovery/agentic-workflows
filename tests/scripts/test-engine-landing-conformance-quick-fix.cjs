'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix chain (7.2.3, 19.S32, 19.S38):
// the contract every landing driver meets for a quick-fix's set of fixes,
// run through the engine's verbs against each shipped driver in turn.
// Three fixes, built one after another in the project's own checkout, land
// as a chain — each fix's pull request based on the fix before it,
// carrying nothing of it, and the close landing them bottom to top, each
// under its fix's subject with only its own change — the checkout put back
// on the default branch, holding the landing. The order fixes open and end
// in is test-engine-landing-conformance-quick-fix-order.cjs's, a branch
// moved past its pull request test-engine-landing-conformance-quick-fix-moved.cjs's;
// the close itself test-engine-quick-fix-close.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, tip } = require('./engine-harness.cjs');
const { own } = require('./landing-world.cjs');
const { UNIT, CHAIN, fixBuilt, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const BRANCHES = CHAIN.map(({ title }, at) => taskBranch({ unit: UNIT, phase: 1, n: at + 1 }, 'fix', title));

for (const { name } of listDrivers('landing')) {
  const { side, as, project, record, landed } = quickFixConformance(name, `engine-landing-quick-fix-${name}-`);

  describe(`the ${name} landing driver's quick-fix chain (7.2.3, 19.S32)`, () => {
    it('19.S38: three fixes land as a chain — each pull request based on the fix before it, the close landing them bottom to top, each with only its own change, the checkout back on the default branch', () => {
      const at = project();
      const bases = CHAIN.map(({ title, file, text }, n) => own(fixBuilt(at, n + 1, title, file, text, as())).base);
      CHAIN.forEach((_, n) => record(at, n + 1));
      checklistClosed(at, as());
      const closed = ok(at, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual(bases, ['main', BRANCHES[0], BRANCHES[1]]);
      assert.deepStrictEqual([closed.landed.map((/** @type {any} */ { repo, phases }) => [repo, phases.map((/** @type {any} */ { phase }) => phase)]), closed.checkout], [[['.', [1]]], 'main']);
      assert.deepStrictEqual(landed(at), CHAIN.map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
      assert.deepStrictEqual([git(at, ['symbolic-ref', '--short', 'HEAD']).trim(), tip(at, 'main')], ['main', side.defaultTip(at)]);
    });
  });
}
