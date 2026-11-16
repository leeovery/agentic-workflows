'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix whose last commit was
// dropped from its branch before it opened (R15): the contract every landing
// driver meets, run through the engine's verbs against each shipped driver
// in turn. Its pull request merged by hand keeping its commits, the fix is
// read by its branch as it stands, never by the commit the reflog keeps: the
// close lands, nothing left off. A fix done left off by the close's own cut
// is test-engine-landing-conformance-quick-fix-close-left-off.cjs's.
// A driver's side (tests/drivers/{name}/landing.cjs) readies the world and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, createFile, readManifest } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, checklistClosed, quickFixConformance, fixChanged, fixDone } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const [FLAG] = SET;

for (const { name } of listDrivers('landing')) {
  const { side, as, project, built, record } = quickFixConformance(name, `engine-landing-quick-fix-close-dropped-${name}-`);
  const [[keeping, keep]] = Object.entries(side.byHandKeeping);

  describe(`the ${name} landing driver's quick-fix, a fix's last commit dropped from its branch before it opened, the pull request then merged by hand by ${keeping} (R15)`, () => {
    it('reads the fix by its branch as it stands, never by the commit dropped, which the reflog keeps: the close lands, nothing left off', () => {
      const at = project();
      fixChanged(at, 1, FLAG.title, FLAG.file, FLAG.text, as());
      createFile(at, FLAG.file, 'const flag = \'a wrong turn\';\n');
      ok(at, ['commit', '--paths', FLAG.file, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): take a wrong turn`], as());
      git(at, ['reset', '-q', '--hard', 'HEAD~1']);
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      fixDone(at, '1.1', as());
      built(at, 2);
      record(at, 1);
      record(at, 2);
      keep(at, BRANCH);
      checklistClosed(at, as());
      ok(at, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual([readManifest(at, UNIT).status, git(side.on(at), ['show', `main:${FLAG.file}`])], ['completed', FLAG.text]);
    });
  });
}
