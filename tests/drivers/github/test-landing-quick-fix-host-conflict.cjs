'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's branch as GitHub has it, the
// truth for what its pull request holds (R15, N1; ledger-engine/scripts/
// domain/fix-branch.cjs, over drivers/landing/github/), where GitHub's copy
// conflicts with the branch here: a review's suggestion conflicting with a
// commit through the door refuses the opening while a fix is in flight,
// naming the merge the shell guard passes and the door that finishes it,
// which, followed, lands both as settled; one conflicting at the close, no
// task in flight, naming a one-line task merging it in the worktree, whose
// door merge of GitHub's copy, followed — its start refused by the same
// conflict, naming the merge under it — is the task's work, by the one rule
// a quick-fix's task's own commits are read by (landing-git.cjs,
// `quickFixMerges`), done taking it, landing both as settled; and the
// pull request conflicting at the close with main on GitHub refusing the
// merge, naming a one-line task merging GitHub's main as fetched there,
// whose door merge, followed, is the task's work though main here lacks it,
// landing both as settled. In a nested clone,
// test-landing-quick-fix-host-conflict-nested.cjs's and the conformance
// suite's; the commits GitHub's copy holds brought in without a conflict,
// test-landing-quick-fix-host.cjs's.
// Git layer: quick-fix-world.cjs's two fixes built on a fake GitHub
// (world.cjs), their pull request #1 open, built once and copied for each
// test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const {
  UNIT, BRANCH, SET, fixChanged, fixDone, twoFixesBuilt, fixesRecorded, recordFile, checklistClosed, guardedGit, fixTree,
} = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, madeOnGithub } = require('./world.cjs');
const lg = require('../../../skills/ledger-engine/scripts/domain/landing-git.cjs');

const { ok, refuses, git, createFile, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('quick-fix-two-fixes-github-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-host-conflict-config-');
const SUGGESTED = 'const flag = \'colour\'; // suggested\n';
const SETTLED = 'const flag = \'colour\'; // reworked, as suggested\n';

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEDGER_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

describe('a quick-fix\'s branch conflicting with GitHub\'s copy (R15, N1)', () => {
  it('a suggestion conflicting with a commit here, while a fix is in flight, refuses the opening naming the merge the shell guard passes and the door that finishes it; followed, both land as settled', () => {
    dir = world();
    fixChanged(dir, 3, SET[2].title, SET[2].file, SET[2].text, as());
    const suggestion = lg.short(madeOnGithub(dir, BRANCH, { [SET[0].file]: SUGGESTED }, `Update ${SET[0].file}`));
    createFile(fixTree(dir), SET[0].file, 'const flag = \'colour\'; // reworked\n');
    ok(fixTree(dir), ['commit', '--paths', SET[0].file, '--task', UNIT, '1.3', '-m', `fix(${UNIT}): rework the flag`], as());
    const refusal = refuses(dir, ['land', 'open', UNIT, '1.3'], as()).error;
    try {
      guardedGit(fixTree(dir), ['merge', '--no-ff', '--no-commit', suggestion], as());
    } catch { /* the conflict the refusal names, settled below */ }
    createFile(fixTree(dir), SET[0].file, SETTLED);
    ok(fixTree(dir), ['commit', '--paths', SET[0].file, '--task', UNIT, '1.3', '-m', `fix(${UNIT}): take the suggestion`], as());
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    fixDone(dir, '1.3', as());
    fixesRecorded(dir, 3, as());
    ok(dir, ['finish', 'yes', UNIT], as());

    assert.strictEqual(refusal, `land: ${BRANCH} and its pull request's head, ${suggestion}, each hold commits the other lacks, conflicting at ${SET[0].file}, so nothing moved — `
      + `merge it into ${BRANCH} in ${UNIT}'s worktree with \`git merge --no-ff --no-commit ${suggestion}\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: `
      + `\`engine commit --paths <file>… --task ${UNIT} 1.3 -m "<message>"\`, and try again`);
    assert.strictEqual(git(bareOf(dir), ['show', `main:${SET[0].file}`]), SETTLED);
  });

  it('a suggestion conflicting at the close with a commit here, no task in flight, refuses naming a one-line task merging it in the worktree and the door; followed — its start refused by the same conflict, naming the merge under it — the merge is the task\'s work, done takes it, and both land as settled', () => {
    dir = world();
    fixesRecorded(dir, 2, as());
    const suggestion = lg.short(madeOnGithub(dir, BRANCH, { [SET[0].file]: SUGGESTED }, `Update ${SET[0].file}`));
    createFile(fixTree(dir), SET[0].file, 'const flag = \'colour\'; // mine\n');
    git(fixTree(dir), ['commit', '-qam', 'My own touch']);
    const closing = refuses(dir, ['finish', 'yes', UNIT], as()).error;
    ok(dir, ['task', 'create', UNIT, '1', '--title', `merge ${suggestion}`, '--type', 'chore', '--why', 'the suggestion and my own touch settled by hand'], as());
    const starting = refuses(dir, ['task', 'start', UNIT, '1.3'], as()).error;
    try {
      guardedGit(fixTree(dir), ['merge', '--no-ff', '--no-commit', suggestion], as());
    } catch { /* the conflict the refusals name, settled below */ }
    createFile(fixTree(dir), SET[0].file, SETTLED);
    ok(fixTree(dir), ['commit', '--paths', SET[0].file, '--task', UNIT, '1.3', '-m', `chore(${UNIT}): merge ${suggestion}`], as());
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    ok(dir, ['task', 'done', UNIT, '1.3'], as());
    ok(dir, ['quick-fix', 'record', UNIT, '1.3', '--file', recordFile(dir, 3, { changed: 'The flag as the suggestion and I spell it.', why: 'A suggestion met my own touch.', leaves: 'Nothing.' })], as());
    checklistClosed(dir, as());
    ok(dir, ['finish', 'yes', UNIT], as());

    const conflict = `land: ${BRANCH} and its pull request's head, ${suggestion}, each hold commits the other lacks, conflicting at ${SET[0].file}, so nothing moved — `;
    assert.deepStrictEqual([closing, starting], [
      `finish yes: ${conflict}start a one-line task, "merge ${suggestion}", and in ${UNIT}'s worktree run \`git merge --no-ff --no-commit ${suggestion}\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: `
        + `\`engine commit --paths <file>… --task ${UNIT} <task> -m "<message>"\`, and try again`,
      `${conflict}merge it into ${BRANCH} in ${UNIT}'s worktree with \`git merge --no-ff --no-commit ${suggestion}\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: `
        + `\`engine commit --paths <file>… --task ${UNIT} 1.3 -m "<message>"\`, and try again`,
    ]);
    assert.strictEqual(git(bareOf(dir), ['show', `main:${SET[0].file}`]), SETTLED);
  });
});

describe('a quick-fix\'s pull request conflicting at the close with main on GitHub', () => {
  it('refuses, nothing merged, naming a one-line task merging GitHub\'s main as fetched in the worktree and the door; followed, the merge the task\'s work though main here lacks it, both land as settled', () => {
    dir = world();
    fixesRecorded(dir, 2, as());
    madeOnGithub(dir, 'main', { [SET[0].file]: 'const flag = \'colour\'; // mine\n' }, 'Spell the flag my way');
    const { error } = refuses(dir, ['finish', 'yes', UNIT], as());
    ok(dir, ['task', 'create', UNIT, '1', '--title', 'merge origin/main', '--type', 'chore', '--why', 'a merge of main as GitHub has it, its one conflict settled by hand'], as());
    ok(dir, ['task', 'start', UNIT, '1.3'], as());
    try {
      guardedGit(fixTree(dir), ['merge', '--no-ff', '--no-commit', 'origin/main'], as());
    } catch { /* the conflict the refusal names, settled below */ }
    createFile(fixTree(dir), SET[0].file, SETTLED);
    ok(fixTree(dir), ['commit', '--paths', SET[0].file, '--task', UNIT, '1.3', '-m', `chore(${UNIT}): merge origin/main`], as());
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    ok(dir, ['task', 'done', UNIT, '1.3'], as());
    ok(dir, ['quick-fix', 'record', UNIT, '1.3', '--file', recordFile(dir, 3, { changed: 'The flag as both spell it.', why: 'Main spelt it another way meanwhile.', leaves: 'Nothing.' })], as());
    checklistClosed(dir, as());
    ok(dir, ['finish', 'yes', UNIT], as());

    assert.strictEqual(error, `finish yes: land: ${UNIT}'s pull request #1 conflicts with main on GitHub, so ${UNIT}'s pull request was not merged — `
      + `start a one-line task, "merge origin/main", and in ${UNIT}'s worktree run \`git merge --no-ff --no-commit origin/main\`, settle the conflict, then commit the merge through the door, naming each file you settled, which finishes it: `
      + `\`engine commit --paths <file>… --task ${UNIT} <task> -m "<message>"\`, and land again`);
    assert.strictEqual(git(bareOf(dir), ['show', `main:${SET[0].file}`]), SETTLED);
  });
});
