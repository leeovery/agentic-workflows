'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a commit that does not apply
// where its branch is cut again after its pull request was merged by hand
// mid-set (R14), by the first way the driver's side merges by hand: the
// commit left off, its task's opening refused for the branch holding
// nothing, warning of it and naming its change made again there through the
// door; `task done` refused naming the same; followed through the shell
// guard and the door, it lands. The merge mid-set itself is
// test-engine-landing-conformance-quick-fix-by-hand*.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, refuses, git, createFile } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, guardedGit, fixDone, quickFixConformance } = require('./quick-fix-world.cjs');
const { HELP, steps } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const OTHER = 'const help = \'--color\';\n';

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-left-off-${name}-`);
  const { side, as, project, built, landed } = conf;
  const { started, committed, closed } = steps(conf);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, a commit that does not apply where its branch is cut again after a merge by hand by ${how} (R14)`, () => {
    it('is left off, its opening refused, warning of it and naming its change made again through the door, and its done refused naming the same; made again through the shell guard and the door, it lands', () => {
      const at = project();
      built(at, 1);
      started(at);
      merge(at, BRANCH);
      const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-fix-elsewhere-'));
      git(side.on(at), ['worktree', 'add', '-q', tree, 'main']);
      createFile(tree, HELP.file, OTHER);
      git(tree, ['add', HELP.file]);
      git(tree, ['commit', '-q', '-m', 'Spell the help the American way']);
      git(side.on(at), ['worktree', 'remove', '--force', tree]);
      committed(at, HELP.text);
      const own = git(at, ['rev-parse', '--short', BRANCH]).trim();
      const opening = refuses(at, ['land', 'open', UNIT, '1.2'], as()).error;
      const done = refuses(at, ['task', 'done', UNIT, '1.2'], as()).error;
      const picked = ['cherry-pick', '--no-commit', own];
      try {
        guardedGit(at, picked, as());
      } catch { /* the conflict the refusal names, settled below */ }
      createFile(at, HELP.file, HELP.text);
      guardedGit(at, ['cherry-pick', '--quit'], as());
      ok(at, ['commit', '--paths', HELP.file, '--task', UNIT, '1.2', '-m', `fix(${UNIT}): spell the help --colour again`], as());
      ok(at, ['land', 'open', UNIT, '1.2'], as());
      fixDone(at, '1.2', as());
      closed(at);

      const remade = `\`git cherry-pick --no-commit ${own}\`, settling any conflict and ending the pick with \`git cherry-pick --quit\`, which keeps its change, then \`engine commit --paths <file>… --task ${UNIT} 1.2 -m "<message>"\``;
      assert.strictEqual(opening, `land: task 1.2's branch ${BRANCH} changes nothing past main — commit its change there first — and task 1.2's commit ${own} does not apply on main as it stands, at ${HELP.file}, so ${BRANCH} was cut again without it and its commits after it — make its change again there through the door: ${remade}`);
      assert.strictEqual(done, `task done: task 1.2 of ${UNIT}'s commit ${own} is not on ${BRANCH} — make its change again there through the door: ${remade}`);
      assert.deepStrictEqual([landed(at).at(-1), git(side.on(at), ['show', `main:${HELP.file}`])], [[`fix(${UNIT}): ${DESCRIPTION}`, [HELP.file]], HELP.text]);
    });
  });
}
