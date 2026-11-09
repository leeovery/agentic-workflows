'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's branch in a nested clone
// conflicting with GitHub's copy (R15, N1; leeway-engine/scripts/domain/
// fix-branch.cjs, over drivers/landing/github/): a review's suggestion on
// the clone's pull request conflicting with a commit in the clone here
// refuses the opening while the fix is in flight, naming the merge the
// shell guard passes there — `git -C lib merge --no-ff --no-commit` — and
// the door that finishes it, which, followed, lands both as settled. In the
// project's own repository, test-landing-quick-fix-host-conflict.cjs's.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance` on
// GitHub's side (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, git, createFile } = require('../../scripts/engine-harness.cjs');
const { UNIT, BRANCH, quickFixNestedConformance, guardedGit } = require('../../scripts/quick-fix-world.cjs');
const { NESTED } = require('../../scripts/landing-world.cjs');
const { bareOf, madeOnGithub } = require('./world.cjs');
const lg = require('../../../skills/leeway-engine/scripts/domain/landing-git.cjs');

const { as, project, opened, ended, closed } = quickFixNestedConformance('github', 'github-landing-quick-fix-host-conflict-nested-');

const SETTLED = 'lib --colour // reworked, as suggested\n';

describe('a quick-fix\'s branch in a nested clone conflicting with GitHub\'s copy (R15, N1)', () => {
  it('a suggestion conflicting with a commit in the clone, while the fix is in flight, refuses the opening naming the merge there the shell guard passes and the door; followed, both land as settled', () => {
    const at = project();
    opened(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
    const suggestion = lg.short(madeOnGithub(at.lib, BRANCH, { 'lib.txt': 'lib --colour // suggested\n' }, 'Update lib.txt'));
    createFile(at.dir, 'lib/lib.txt', 'lib --colour // reworked\n');
    ok(at.dir, ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): rework the lib`], as());
    const refusal = refuses(at.dir, ['land', 'open', UNIT, '1.1'], as()).error;
    try {
      guardedGit(at.dir, ['-C', 'lib', 'merge', '--no-ff', '--no-commit', suggestion], as());
    } catch { /* the conflict the refusal names, settled below */ }
    createFile(at.dir, 'lib/lib.txt', SETTLED);
    ok(at.dir, ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): take the suggestion`], as());
    ok(at.dir, ['land', 'open', UNIT, '1.1'], as());
    ended(at, 1);
    closed(at);

    assert.strictEqual(refusal, `land: ${BRANCH} in lib and its pull request's head, ${suggestion}, each hold commits the other lacks, conflicting at lib.txt, so nothing moved — `
      + `merge it into ${BRANCH} there with \`git -C lib merge --no-ff --no-commit ${suggestion}\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: `
      + `\`engine commit --paths <file>… --task ${UNIT} 1.1 -m "<message>"\`, and try again`);
    assert.strictEqual(git(bareOf(at.lib), ['show', `${NESTED.lib.into}:lib.txt`]), SETTLED);
  });
});
