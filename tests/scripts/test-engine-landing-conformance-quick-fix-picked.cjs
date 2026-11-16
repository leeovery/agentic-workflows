'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix of two commits whose
// first alone was cherry-picked onto main by hand (R28): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. Only content decides a landing — the copy carries the
// door's stamp, which never names one — so the fix has not landed: the next
// fix's start cuts the branch again keeping its second commit, and the close
// lands it, main holding the whole fix. A driver's side (tests/drivers/
// {name}/landing.cjs) readies the world, cherry-picks the commit, and reads
// what landed where; this file names no driver and no tool. Conformance
// layer: the quick-fix of quick-fix-world.cjs (`quickFixConformance`),
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, createFile, readManifest, datedAt } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixConformance, fixChanged, fixDone } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const [FLAG, HELP] = SET;
const EXTRA = 'src/extra.js';

for (const { name } of listDrivers('landing')) {
  const { side, as, project, built, closed } = quickFixConformance(name, `engine-landing-quick-fix-picked-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a fix of two commits whose first alone was cherry-picked onto main by hand (R28)`, () => {
    it('the fix not landed, its copy carrying the stamp: the next fix\'s start keeps its second commit on the branch, and the close lands it, main holding the whole fix', () => {
      const at = project();
      fixChanged(at, 1, FLAG.title, FLAG.file, FLAG.text, as());
      const first = git(at, ['rev-parse', 'HEAD']).trim();
      createFile(at, EXTRA, 'const extra = 1;\n');
      ok(at, ['commit', '--paths', EXTRA, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): add the extra`], as());
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      fixDone(at, '1.1', as());
      datedAt(new Date(Date.now() + 60_000).toISOString(), () => side.picked(at, first));
      built(at, 2);
      const kept = git(at, ['ls-tree', '--name-only', '-r', BRANCH]).split('\n').includes(EXTRA);
      closed(at);

      assert.deepStrictEqual([kept, readManifest(at, UNIT).status, [FLAG.file, HELP.file, EXTRA].map((file) => side.holds(at).includes(file))], [true, 'completed', [true, true, true]]);
    });
  });
}
