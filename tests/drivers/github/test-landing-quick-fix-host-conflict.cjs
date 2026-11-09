'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's branch as GitHub has it, the
// truth for what its pull request holds (R15, N1; leeway-engine/scripts/
// domain/fix-branch.cjs, over drivers/landing/github/), where GitHub's copy
// conflicts with the branch here: a review's suggestion conflicting with a
// commit through the door refuses the opening while a fix is in flight,
// naming the merge the shell guard passes and the door that finishes it,
// which, followed, lands both as settled. In a nested clone,
// test-landing-quick-fix-host-conflict-nested.cjs's; the commits GitHub's
// copy holds brought in without a conflict, test-landing-quick-fix-host.cjs's.
// Git layer: quick-fix-world.cjs's two fixes built on a fake GitHub
// (world.cjs), their pull request #1 open, built once and copied for each
// test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, BRANCH, SET, fixChanged, fixDone, twoFixesBuilt, fixesRecorded, guardedGit } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, madeOnGithub } = require('./world.cjs');
const lg = require('../../../skills/leeway-engine/scripts/domain/landing-git.cjs');

const { ok, refuses, git, createFile, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-host-conflict-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-host-conflict-config-');
const SUGGESTED = 'const flag = \'colour\'; // suggested\n';
const SETTLED = 'const flag = \'colour\'; // reworked, as suggested\n';

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

describe('a quick-fix\'s branch conflicting with GitHub\'s copy (R15, N1)', () => {
  it('a suggestion conflicting with a commit here, while a fix is in flight, refuses the opening naming the merge the shell guard passes and the door that finishes it; followed, both land as settled', () => {
    dir = world();
    fixChanged(dir, 3, SET[2].title, SET[2].file, SET[2].text, as());
    const suggestion = lg.short(madeOnGithub(dir, BRANCH, { [SET[0].file]: SUGGESTED }, `Update ${SET[0].file}`));
    createFile(dir, SET[0].file, 'const flag = \'colour\'; // reworked\n');
    ok(dir, ['commit', '--paths', SET[0].file, '--task', UNIT, '1.3', '-m', `fix(${UNIT}): rework the flag`], as());
    const refusal = refuses(dir, ['land', 'open', UNIT, '1.3'], as()).error;
    try {
      guardedGit(dir, ['merge', '--no-ff', '--no-commit', suggestion], as());
    } catch { /* the conflict the refusal names, settled below */ }
    createFile(dir, SET[0].file, SETTLED);
    ok(dir, ['commit', '--paths', SET[0].file, '--task', UNIT, '1.3', '-m', `fix(${UNIT}): take the suggestion`], as());
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    fixDone(dir, '1.3', as());
    fixesRecorded(dir, 3, as());
    ok(dir, ['finish', 'yes', UNIT], as());

    assert.strictEqual(refusal, `land: ${BRANCH} and its pull request's head, ${suggestion}, each hold commits the other lacks, conflicting at ${SET[0].file}, so nothing moved — `
      + `merge it into ${BRANCH} there with \`git merge --no-ff --no-commit ${suggestion}\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: `
      + `\`engine commit --paths <file>… --task ${UNIT} 1.3 -m "<message>"\`, and try again`);
    assert.strictEqual(git(bareOf(dir), ['show', `main:${SET[0].file}`]), SETTLED);
  });
});
