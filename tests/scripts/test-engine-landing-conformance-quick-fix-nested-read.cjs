'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a nested clone marked as one it
// touches by the door's stamp alone (R17): the contract every landing
// driver meets, run through the engine's verbs against each shipped driver
// in turn. A fix committed in the clone, its branch there gone before it
// opened, so neither the branch nor the host holds it: its done refused
// naming its commit to make again through the door, and its close refused,
// as a fix holding work — never taken for a fix with no work, closed as
// met. The person's own commit alone on the clone's branch is
// test-engine-landing-conformance-quick-fix-nested-read-own.cjs's; the host
// holding the branch alone, -nested-second-clone's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, git, createFile } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, createFix, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { as, project, gone } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-read-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a nested clone marked as one it touches by the door's stamp alone (R17)`, () => {
    it('a fix committed in the clone, its branch gone there before it opened, has its done refused naming its commit to make again, and its close refused as holding work', () => {
      const at = project();
      createFix(at.dir, 1, SET[0].title, as());
      ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      createFile(at.dir, 'lib/lib.txt', 'lib --colour\n');
      ok(at.dir, ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the lib --colour`], as());
      const own = git(at.lib, ['rev-parse', '--short', BRANCH]).trim();
      gone(at.lib, NESTED.lib.into);

      const remade = `\`git cherry-pick --no-commit ${own}\`, settling any conflict and ending the pick with \`git cherry-pick --quit\`, which keeps its change, then \`engine commit --paths <file>… --task ${UNIT} 1.1 -m "<message>"\``;
      assert.deepStrictEqual([refuses(at.dir, ['task', 'done', UNIT, '1.1'], as()).error, refuses(at.dir, ['task', 'close', UNIT, '1.1', '--reason', 'Met.'], as()).error], [
        `task done: task 1.1 of ${UNIT}'s commit ${own} is not on ${BRANCH} in lib — make its change again there through the door: ${remade}`,
        `task close: task 1.1 of ${UNIT} holds work of its own — it lands as it is with ${UNIT}'s pull request, done once it is in it, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`,
      ]);
    });
  });
}
