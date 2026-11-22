'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix conflicting at its close in a
// nested clone (7.2.24, R16; landing-names.cjs, `quickFixMerged`): the
// contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn. A fix in the clone conflicting with
// the person's own commit on the branch the clone lands on refuses the
// close, nothing landed, naming a one-line task merging that branch, as the
// driver reads it, in the clone's part of the quick-fix's worktree —
// `git -C lib merge --no-ff --no-commit` — and the door, each settled file
// named under lib/; followed, the merge the task's work, the close lands the
// settled change there. In the project's own repository,
// test-engine-quick-fix-windows.cjs's and a host's own host-conflict suite's
// (tests/drivers/{name}/). A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and pushes the person's commit where the driver lands; this file names no
// driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');

const { ok, refuses, git, createFile, readManifest, GIT_TIMEOUT_MS } = require('./engine-harness.cjs');
const { UNIT, quickFixNestedConformance, fixTree, onMain, recordFile, checklistClosed } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { into } = NESTED.lib;
const SETTLED = 'lib --colour // settled\n';

for (const { name } of listDrivers('landing')) {
  const { side, as, project, built } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-conflict-${name}-`);

  describe(`the ${name} landing driver's quick-fix conflicting at its close in a nested clone (7.2.24, R16)`, () => {
    it('refuses the close, nothing landed, naming a one-line task merging the branch the clone lands on there with git -C and the door, its files under the clone; followed, the close lands the settled change', () => {
      const at = project();
      built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      onMain(at.lib, [{ file: 'lib.txt', text: 'lib --color, mine\n', subject: 'Spell the lib my way' }], into);
      side.pushed(at.lib, into);
      checklistClosed(at.dir, as());
      const mine = side.defaultTip(at.lib, into);
      const { error } = refuses(at.dir, ['finish', 'yes', UNIT], as());
      const stood = side.defaultTip(at.lib, into);
      const theirs = /"merge (\S+)"/.exec(error)?.[1] ?? '';
      const merge = ['-C', 'lib', 'merge', '--no-ff', '--no-commit', theirs];
      ok(at.dir, ['task', 'create', UNIT, '1', '--title', `merge ${theirs}`, '--type', 'chore', '--why', 'the lib as both spell it'], as());
      ok(at.dir, ['task', 'start', UNIT, '1.2'], as());
      const merging = spawnSync('git', merge, { cwd: fixTree(at.dir), encoding: 'utf8', timeout: GIT_TIMEOUT_MS }).status;
      createFile(fixTree(at.dir), 'lib/lib.txt', SETTLED);
      ok(fixTree(at.dir), ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.2', '-m', `chore(${UNIT}): merge ${theirs}`], as());
      ok(at.dir, ['land', 'open', UNIT, '1.2'], as());
      ok(at.dir, ['task', 'done', UNIT, '1.2'], as());
      ok(at.dir, ['quick-fix', 'record', UNIT, '1.2', '--file', recordFile(at.dir, 2, { changed: 'The lib as both spell it.', why: 'Its branch spelt it another way meanwhile.', leaves: 'Nothing.' })], as());
      checklistClosed(at.dir, as());
      ok(at.dir, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual([theirs.split('/').at(-1), stood, merging], [into, mine, 1]);
      assert.ok(error.endsWith(` — start a one-line task, "merge ${theirs}", and in ${UNIT}'s worktree run \`git -C lib merge --no-ff --no-commit ${theirs}\`, settle the conflict, `
        + `then commit the merge through the door, naming each file you settled, which finishes it: \`engine commit --paths lib/<file>… --task ${UNIT} <task> -m "<message>"\`, and land again`), error);
      assert.deepStrictEqual([readManifest(at.dir, UNIT).status, git(side.on(at.lib), ['show', `${into}:lib.txt`])], ['completed', SETTLED]);
    });
  });
}
