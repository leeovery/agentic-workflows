'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver landing a stack built on a phase GitHub squashed
// (leeway-engine/scripts/drivers/landing/github/, S3), past what every
// driver gives (test-engine-landing-conformance-stacked.cjs): a fix phase
// cut from phase 1's task, deleting its file, whose change conflicts with
// the default branch on GitHub, which moved on after phase 1 squashed, is
// refused before anything is pushed, its way on its own commits rebased
// onto that branch and pushed — which, followed as the refusal words it, its
// conflict settled, lands the phase with the file still gone. Git layer:
// the landing world on a fake GitHub (world.cjs), built once and copied for
// each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { git } = require('../../scripts/engine-harness.cjs');
const { TASKS, openArgs, track, commitFiles, useLandingWorld, finishReady } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { bareOf, madeOnGithub, tipOnGithub, ok, refused } = require('./world.cjs');

const { card } = TASKS;
const project = useLandingWorld('github-landing-squashed-below-', side.prepare);

/** Each command the refusal names between backticks, as git's arguments. @param {string} refusal */
const named = (refusal) => [...refusal.matchAll(/`git ([^`]+)`/g)].map(([, args]) => args.split(' '));

describe('GitHub\'s landing driver landing a stack built on a phase GitHub squashed (S3)', () => {
  it('a fix phase cut from phase 1\'s task, deleting its file, its change conflicting with the default branch on GitHub moved on since phase 1 squashed: refused before anything is pushed, naming its own commits rebased onto that branch and pushed — which, followed, its conflict settled, lands the phase with the file still gone', () => {
    const dir = project();
    const undo = track(dir, '4.1', 'fix', 'Drop the card');
    commitFiles(dir, undo.branch, card.branch, { 'shared.txt': 'undo\n' }, { removed: ['card.txt'] });
    ok(dir, openArgs(card));
    ok(dir, openArgs(undo));
    ok(dir, ['land', 'phase', 'pay', '1']);
    madeOnGithub(dir, 'main', { 'shared.txt': 'main\n' }, 'Share it');
    finishReady(dir);
    const pushed = tipOnGithub(dir, undo.branch);
    const refusal = refused(dir, ['land', 'finish', 'pay']);
    const unpushed = tipOnGithub(dir, undo.branch) === pushed;

    const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
    const [rebase, push] = named(refusal);
    const stopped = spawnSync('git', rebase, { cwd: dir, encoding: 'utf8' }).status;
    fs.writeFileSync(path.join(dir, 'shared.txt'), 'both\n');
    git(dir, ['add', 'shared.txt']);
    git(dir, ['-c', 'core.editor=true', 'rebase', '--continue']);
    git(dir, ['switch', '-q', back]);
    git(dir, push);
    ok(dir, ['land', 'finish', 'pay']);

    const landed = [side.holds(dir).filter((file) => ['card.txt', 'shared.txt'].includes(file)), git(bareOf(dir), ['show', 'main:shared.txt'])];

    assert.deepStrictEqual([refusal.replace(/[0-9a-f]{7}/, 'SHA'), unpushed, stopped, landed], [
      `land: ${undo.branch} conflicts with origin/main at shared.txt, so nothing was pushed and nothing merged — rebase phase 4's own commits onto origin/main, settling the conflict, with \`git rebase --onto origin/main SHA ${undo.branch}\`, push it with \`git push --force-with-lease origin ${undo.branch}\`, and land again`,
      true, 1, [['shared.txt'], 'both\n'],
    ]);
  });
});
