'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (leeway-engine/scripts/drivers/landing/github/)
// and a feature's task changed after its pull request was squashed by hand
// on GitHub's site, GitHub's copy of its branch then holding work the
// branch here lacks (7.2.23): a commit made there on the site, ahead of the
// branch here, its change pushed first, or apart from it; and one made
// there on its pull request opened again and left open. Each refused,
// nothing pushed, opened or merged, the way on to pull that copy first
// (`pullFirst`); followed as worded, the two land whole. Landed by the
// engine, then a commit made on the site with nothing of it here: refused
// so too, and followed, the commit lands. A rewrite after its landing, or
// a merge of main past it, pushed to GitHub as well: refused, the way on
// ending with its branch pushed over GitHub's copy, leased on where GitHub
// holds it, so that copy never refuses it again; followed once, it lands.
// Squashed by hand here with its pull request open, then changed with a
// line main rewords on GitHub: its change pushed to its pull request, then
// refused on the conflict, saying so. The rest of a task changed after its
// landing on GitHub is test-landing-again.cjs's.
// Git layer: the landing world on a fake GitHub (world.cjs), built once and
// copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { UNIT, TASKS, openArgs, own, commitFiles, mergeBack, useLandingWorld, heldOn, followedOn, short } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, calls, madeOnGithub, pulls, ok, refused, tipOnGithub, squashedByHand, madeSince } = require('./world.cjs');
const { git, readManifest } = require('../../scripts/engine-harness.cjs');

const { card } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];

const project = useLandingWorld('github-landing-again-pull-', side.prepare);

/** The pull requests GitHub holds once task 4.1's merged one is opened again and left open. */
const OPENED_AND_LEFT = Object.freeze([{ number: 1, state: 'MERGED', base: 'main' }, { number: 2, state: 'OPEN', base: 'main' }]);

/** 1.1 opened and landed by the engine: its landing on main, and the commit it took. @param {string} dir */
function engineLanded(dir) {
  ok(dir, openArgs(card));
  ok(dir, PHASE);
  const { commit, tip } = readManifest(dir, UNIT).landings[`${UNIT}-1-1`]['.'];
  return { landing: commit, landed: tip };
}

/** The tail of a way on that remakes 1.1's branch, pushing it over GitHub's copy at `held`. @param {string} held */
const pushedOver = (held) => `, push it with \`git push --force-with-lease=refs/heads/${card.branch}:${held} origin ${card.branch}\`, and open the task with \`land open ${UNIT} 1.1\``;

/** The way on of a branch whose copy on GitHub holds work the branch here lacks. @param {string} branch */
const pullFirst = (branch) => `on ${branch}, pull its copy on GitHub first with \`git pull --rebase origin ${branch}\`, and land again`;

/** GitHub's copy's head, moved on by a commit on the site, the branch here given more.txt: pushed first, or not. @type {[string, (dir: string, branch: string) => string][]} */
const ON_THE_SITE = [
  ['ahead of the branch here, its change pushed first', (dir, branch) => {
    commitFiles(dir, branch, branch, { 'more.txt': 'more\n' });
    git(dir, ['push', '-q', 'origin', branch]);
    return madeOnGithub(dir, branch, { 'site.txt': 'site\n' }, 'Apply the suggestion');
  }],
  ['apart from the branch here', (dir, branch) => {
    const head = madeOnGithub(dir, branch, { 'site.txt': 'site\n' }, 'Apply the suggestion');
    commitFiles(dir, branch, branch, { 'more.txt': 'more\n' });
    return head;
  }],
];

describe('a feature\'s task changed after its pull request merged on GitHub, GitHub\'s copy of its branch holding work the branch here lacks (7.2.23)', () => {
  for (const [how, moved] of ON_THE_SITE) {
    it(`changed on top here, GitHub's copy of its branch given a commit on the site since it merged, ${how}: refused, nothing pushed or opened, naming the way on — that copy pulled first; followed, the two land whole`, () => {
      const dir = project();
      const tip = squashedByHand(dir);
      const head = moved(dir, tip.branch);
      const here = git(dir, ['rev-parse', tip.branch]).trim();
      const from = calls(dir).length;
      const refusal = refused(dir, ['land', 'phase', 'pay', '4']);
      const untouched = [madeSince(dir, from), tipOnGithub(dir, tip.branch)];
      followedOn(dir, tip.branch, refusal, GH_ENV);
      const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

      assert.deepStrictEqual([refusal, untouched, landed.merged, ['site.txt', 'more.txt'].map((file) => heldOn(bareOf(dir), file))], [
        `land: task 4.1's branch ${tip.branch} has moved here and on GitHub since its pull request #1 merged, to ${short(here)} and ${short(head)} — ${pullFirst(tip.branch)}`,
        [[], head], ['4.1'], ['site\n', 'more\n'],
      ]);
    });
  }

  it('changed on top here, its pull request opened again and left open by GitHub, then a commit made on it on the site: refused, nothing merged, naming the way on — its copy on GitHub pulled first; followed, the pull request merges with both changes', () => {
    const dir = project();
    const tip = squashedByHand(dir);
    commitFiles(dir, tip.branch, tip.branch, { 'tip-note.txt': 'note\n' });
    refused(dir, ['land', 'phase', 'pay', '4'], side.refuseMerge(dir).env);
    const head = madeOnGithub(dir, tip.branch, { 'site.txt': 'site\n' }, 'Apply the suggestion');
    const here = git(dir, ['rev-parse', tip.branch]).trim();
    const from = calls(dir).length;
    const refusal = refused(dir, ['land', 'phase', 'pay', '4']);
    const untouched = [madeSince(dir, from), pulls(dir), tipOnGithub(dir, tip.branch)];
    followedOn(dir, tip.branch, refusal, GH_ENV);
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([refusal, untouched, [landed.merged, landed.pull_requests], ['tip-note.txt', 'site.txt'].map((file) => heldOn(bareOf(dir), file))], [
      `land: task 4.1's branch ${tip.branch} on GitHub, at ${short(head)}, holds work the branch here, at ${short(here)}, lacks, and nothing merged — ${pullFirst(tip.branch)}`,
      [[], OPENED_AND_LEFT, head], [['4.1'], [2]], ['note\n', 'site\n'],
    ]);
  });

  it('landed by the engine, then a commit made on its branch on the site, nothing of it here: land phase refuses before anything merges, naming the way on — that copy pulled first; followed, the commit lands', () => {
    const dir = project();
    engineLanded(dir);
    const head = madeOnGithub(dir, card.branch, { 'site.txt': 'site\n' }, 'Apply suggestions from code review');
    const from = calls(dir).length;
    const refusal = refused(dir, PHASE);
    const untouched = madeSince(dir, from);
    followedOn(dir, card.branch, refusal, GH_ENV);
    const landed = own(ok(dir, PHASE));

    assert.deepStrictEqual([refusal, untouched, landed.merged, heldOn(bareOf(dir), 'site.txt')], [
      `land: task 1.1's branch ${card.branch} on GitHub, at ${short(head)}, holds work made since its pull request #1 landed, which main lacks, and nothing merged — ${pullFirst(card.branch)}`,
      [], ['1.1'], 'site\n',
    ]);
  });

  it('landed by the engine, its commit then amended here and force-pushed to GitHub: land phase refuses with F1, the way on ending with its branch pushed over GitHub\'s copy; followed once, the amend lands', () => {
    const dir = project();
    const { landing, landed } = engineLanded(dir);
    commitFiles(dir, card.branch, `${landed}^`, { 'card.txt': 'card, amended\n' });
    git(dir, ['push', '-q', '--force', 'origin', card.branch]);
    const held = tipOnGithub(dir, card.branch);
    const refusal = refused(dir, PHASE);
    followedOn(dir, card.branch, refusal, GH_ENV);
    const merged = own(ok(dir, PHASE)).merged;

    assert.deepStrictEqual([refusal, merged, heldOn(bareOf(dir), 'card.txt')], [
      `land: task 1.1's branch ${card.branch} has moved apart from where its work landed on main (${short(landing)}): its commit ${short(landed)} landed, which the branch lacks — `
        + `lay ${card.branch}'s own work on that commit with \`git rebase ${short(landed)} ${card.branch}\`${pushedOver(held)}`,
      ['1.1'], 'card, amended\n',
    ]);
  });

  it('landed by the engine, then main merged into its branch here past that landing, a commit made on it, and the two pushed to GitHub: land phase refuses the merge, the way on ending with its branch pushed over GitHub\'s copy; followed once, the commit lands, main keeping its own', () => {
    const dir = project();
    const { landing, landed } = engineLanded(dir);
    side.picked(dir, commitFiles(dir, 'aside', 'main', { 'own.txt': 'own\n' }, { message: 'my own on main' }));
    mergeBack(dir, card.branch, 'main');
    const merge = git(dir, ['rev-parse', card.branch]).trim();
    const more = commitFiles(dir, card.branch, card.branch, { 'more.txt': 'more\n' });
    git(dir, ['push', '-q', 'origin', card.branch]);
    const refusal = refused(dir, PHASE);
    followedOn(dir, card.branch, refusal, GH_ENV);
    const merged = own(ok(dir, PHASE)).merged;

    assert.deepStrictEqual([refusal, merged, ['own.txt', 'more.txt'].map((file) => heldOn(bareOf(dir), file))], [
      `land: task 1.1's branch ${card.branch} merged ${short(merge)} past its work's landing on main (${short(landing)}), at its commit ${short(landed)}, and nothing is read past a merge — `
        + `make ${card.branch} again on origin/main with its own commits since that one, leaving out the merge and what it brought in, with \`git switch --no-track -C ${card.branch} origin/main\` then \`git cherry-pick ${short(more)}\`${pushedOver(more)}`,
      ['1.1'], ['own\n', 'more\n'],
    ]);
  });

  it('opened, squashed by hand here and read, then changed with a line main then rewords on GitHub: land phase pushes its change to its pull request, then refuses on the conflict, saying what it pushed', () => {
    const dir = project();
    ok(dir, openArgs(card));
    side.squashedHere(dir, card.branch);
    ok(dir, openArgs(card));
    const changed = commitFiles(dir, card.branch, card.branch, { 'app.txt': 'app, the card\'s\n', 'more.txt': 'more\n' });
    side.picked(dir, commitFiles(dir, 'aside', 'main', { 'app.txt': 'app, main\'s\n' }, { message: 'Reword the app' }));
    const refusal = refused(dir, PHASE);

    assert.deepStrictEqual([refusal.split(' — ')[0], tipOnGithub(dir, card.branch)], [
      `land: ${card.branch} conflicts with origin/main at app.txt, so nothing merged, and ${card.branch} was pushed to origin as it stands here`, changed,
    ]);
  });
});
