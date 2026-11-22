'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a fix done left off by the
// close's own cut (R15): the contract every landing driver meets, run
// through the engine's verbs against each shipped driver in turn. Both fixes
// done and in the pull request, the host's default branch gains a copy of
// the first and a change the second's commit does not apply on: the close
// cuts the branch again, the second left off, and refuses — never answering
// that it landed already, the unit left in progress — naming its change
// made again through the door, which takes it though the fix is done;
// followed in the quick-fix's worktree through the shell guard and the
// door, the close lands it. A fix
// in flight left off is test-engine-landing-conformance-quick-fix-left-off.cjs's;
// a fix whose last commit was dropped from its branch before it opened,
// test-engine-landing-conformance-quick-fix-close-dropped.cjs's.
// A driver's side (tests/drivers/{name}/landing.cjs) readies the world and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, git, createFile, readManifest } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, guardedGit, checklistClosed, fixTree, onMain, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const [FLAG, HELP] = SET;
const OTHER = 'const help = \'--color\';\n';

/**
 * The host's default branch given a copy of the first fix's change and a
 * change of the help the second's commit does not apply on, each committed
 * by hand (`onMain`).
 * @param {string} repo where the default branch the quick-fix lands on is
 */
const movedOnHost = (repo) => onMain(repo, [
  { file: FLAG.file, text: FLAG.text, subject: 'Spell the flag the British way' },
  { file: HELP.file, text: OTHER, subject: 'Spell the help the American way' },
]);

for (const { name } of listDrivers('landing')) {
  const { side, as, project, built, record, landed } = quickFixConformance(name, `engine-landing-quick-fix-close-left-off-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a fix done left off by the close's own cut (R15)`, () => {
    it('refuses the close, never as landed already, naming its change made again through the door, which takes it though the fix is done; made again, the close lands it', () => {
      const at = project();
      built(at, 1);
      built(at, 2);
      const own = git(at, ['rev-parse', '--short', BRANCH]).trim();
      movedOnHost(side.on(at));
      record(at, 1);
      record(at, 2);
      checklistClosed(at, as());
      const close = refuses(at, ['finish', 'yes', UNIT], as()).error;
      const standing = readManifest(at, UNIT).status;
      try {
        guardedGit(fixTree(at), ['cherry-pick', '--no-commit', own], as());
      } catch { /* the conflict the refusal names, settled below */ }
      createFile(fixTree(at), HELP.file, HELP.text);
      guardedGit(fixTree(at), ['cherry-pick', '--quit'], as());
      ok(fixTree(at), ['commit', '--paths', HELP.file, '--task', UNIT, '1.2', '-m', `fix(${UNIT}): spell the help --colour again`], as());
      ok(at, ['finish', 'yes', UNIT], as());

      const remade = `\`git cherry-pick --no-commit ${own}\`, settling any conflict and ending the pick with \`git cherry-pick --quit\`, which keeps its change, then \`engine commit --paths <file>… --task ${UNIT} 1.2 -m "<message>"\``;
      assert.deepStrictEqual([close, standing], [
        `finish yes: land: ${UNIT} lands once each task done is landed or in its pull request — task 1.2 of ${UNIT} holds ${own}, which is neither landed nor on ${BRANCH} — make its change again there through the door, then land again: ${remade}`,
        'in-progress',
      ]);
      assert.deepStrictEqual([landed(at).at(-1), git(side.on(at), ['show', `main:${HELP.file}`]), readManifest(at, UNIT).status], [
        [`fix(${UNIT}): ${DESCRIPTION}`, [HELP.file]], HELP.text, 'completed',
      ]);
    });
  });
}
