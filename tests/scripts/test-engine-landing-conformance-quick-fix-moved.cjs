'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix's branch moved past its
// pull request (7.2.3, 19.S32): the contract every landing driver meets,
// run through the engine's verbs against each shipped driver in turn. A
// fix is done only once its pull request holds its branch as it stands, as
// the driver records what it holds (`openedAt`): `task done` refuses a fix
// whose branch moved past it, naming the way back a phase's landing names
// for it — the branch kept, put back where it opened, the change past it a
// task of its own — and, that followed, every git command asked of the
// shell guard, the fix is done and the change past its opening never
// lands. The chain itself is test-engine-landing-conformance-quick-fix.cjs's.
// A driver's side (tests/drivers/{name}/landing.cjs) readies the world and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, tip, createFile } = require('./engine-harness.cjs');
const { commandsOf, way, moveStep, short } = require('./landing-world.cjs');
const { UNIT, CHAIN, fixBuilt, guardedGit, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const BRANCH = taskBranch({ unit: UNIT, phase: 1, n: 1 }, 'fix', CHAIN[0].title);

for (const { name } of listDrivers('landing')) {
  const { as, project, changed, landed, closed } = quickFixConformance(name, `engine-landing-quick-fix-moved-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a branch moved past its pull request (7.2.3, 19.S32)`, () => {
    it('refuses a fix done while its branch has moved past what its pull request holds, naming the way back — the branch kept, put back where it opened, the change past it a task of its own; followed through the shell guard, the fix is done, and the change past its opening never lands', () => {
      const at = project();
      changed(at, 1);
      ok(at, ['land', 'open', UNIT, '1.1'], as());
      const opened = short(tip(at, BRANCH));
      createFile(at, 'src/more.js', 'more\n');
      ok(at, ['commit', '--paths', 'src/more.js', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): more`], as());
      const now = short(tip(at, BRANCH));
      const moved = refuses(at, ['task', 'done', UNIT, '1.1'], as()).error;
      const back = way(at, { here: true, path: at }, BRANCH, moveStep(BRANCH, opened, `put ${BRANCH} back`), {
        then: 'mark it done again', note: (kept) => `the change from ${opened} to ${now}, on ${kept}, is a task of its own`,
      });
      for (const command of commandsOf(moved)) guardedGit(at, command.split(' ').slice(1), as());
      ok(at, ['task', 'done', UNIT, '1.1'], as());
      fixBuilt(at, 2, CHAIN[1].title, CHAIN[1].file, CHAIN[1].text, as());
      closed(at);

      assert.strictEqual(moved, `task done: task 1.1's branch ${BRANCH} has moved since it was opened at ${opened}, to ${now} — ${back}`);
      assert.deepStrictEqual(landed(at), CHAIN.slice(0, 2).map(({ title, file }) => [`fix(${UNIT}): ${title}`, [file]]));
    });
  });
}
