'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix closed refused first
// (R10): the contract every landing driver meets, run through the engine's
// verbs against each shipped driver in turn. `land open` refuses a fix
// closed before anything else it judges — a fix closed below a fix opened
// over it, which its stack's tip would refuse, and one never started, which
// has no branch. How a fix closed lands nothing, alone in its set and
// between two fixes, is test-engine-landing-conformance-quick-fix-closed.cjs's.
// A driver's side (tests/drivers/{name}/landing.cjs) readies the world;
// this file names no driver and no tool. Conformance layer: the quick-fix
// of quick-fix-world.cjs (`quickFixConformance`), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, createFile } = require('./engine-harness.cjs');
const { UNIT, CHAIN, createFix, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, changed } = quickFixConformance(name, `engine-landing-quick-fix-closed-first-${name}-`);
  /** Fix `n` closed with a reason. @param {string} at @param {number} n */
  const close = (at, n) => ok(at, ['task', 'close', UNIT, `1.${n}`, '--reason', 'The wrong approach.'], as());
  /** The refusal of fix `n`'s opening. @param {string} at @param {number} n */
  const openRefused = (at, n) => refuses(at, ['land', 'open', UNIT, `1.${n}`], as()).error;

  describe(`the ${name} landing driver's quick-fix, a fix closed refused first (R10)`, () => {
    it('refuses the opening of a fix closed before anything else it judges: one committed and closed below a fix opened over it, and one never started', () => {
      const at = project();
      createFix(at, 1, CHAIN[0].title, as());
      ok(at, ['task', 'start', UNIT, '1.1'], as());
      changed(at, 2);
      ok(at, ['land', 'open', UNIT, '1.2'], as());
      ok(at, ['task', 'start', UNIT, '1.1'], as());
      createFile(at, CHAIN[0].file, CHAIN[0].text);
      ok(at, ['commit', '--paths', CHAIN[0].file, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the flag`], as());
      close(at, 1);
      createFix(at, 3, CHAIN[2].title, as());
      close(at, 3);

      assert.deepStrictEqual([openRefused(at, 1), openRefused(at, 3)], [1, 3].map((n) => `land: task 1.${n} of ${UNIT} is closed — a fix closed lands nothing`));
    });
  });
}
