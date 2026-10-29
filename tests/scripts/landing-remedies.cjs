'use strict';

// ---------------------------------------------------------------------------
// The remedy table of the local landing driver (workflow-engine/scripts/
// drivers/landing/local/driver.cjs, with landing-git.cjs's commands): one
// row per state the repository can be in that a `land` verb refuses, each
// giving the verb, its refusal word for word, and how its remedy is taken
// where that is not by running the commands it names alone. What stops a
// stack: a commit no task of its phase, at the branch's top or below, its
// branch out in a worktree, dirty or clean, or nowhere; a task landed twice,
// either copy; a stack a task is built on that something stops; a phase's
// commit changed, or a task's branch moved, rewritten or gone. What a task
// holds and what a phase waits on: a task holding a task not opened, or one
// landed in a phase off its chain; a task short of its chain's tip; a
// stacked phase whose base the default branch lacks a task of — its phase
// not merged, its branches deleted, landed by hand, or merged without it; a
// replay that conflicts. The suites test-engine-land-remedies-{rows}-
// {state}.cjs follow each set of rows in one state of the person's
// checkout each (landing-world.cjs, `personState`), in the landing world
// with tasks 1.1 and 2.1 opened (`READY`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, tip } = require('./engine-harness.cjs');
const {
  TASKS, openArgs, commitFiles, mergeBack, landedOn, followRemedy, short: s, shellWord, keepWith, scratchOf, rebaseAside,
} = require('./landing-world.cjs');

/** @typedef {import('./landing-world.cjs').Remedy} Remedy */

const { card, rounding, currency } = TASKS;

/** The world every row starts from: tasks 1.1 and 2.1 opened. @param {string} dir */
function READY(dir) {
  ok(dir, openArgs(card));
  ok(dir, openArgs(rounding));
}

/** The argv opening a task the row makes a branch of. @param {string} task @param {string} type @param {string} title */
const open = (task, type, title) => ['land', 'open', 'pay', task, '--type', type, '--title', title];

/** Git as a remedy runs it in a worktree. @param {string} tree */
const gitIn = (tree) => `git -C ${shellWord(tree)}`;

const PHASE_ONE = 'feat/pay-phase-1';
const CARD_LANDING = 'feat(pay): Add card\n\nTask: pay-1-1\n';
const ROUND_LANDING = 'fix(pay): Round totals\n\nTask: pay-2-1\n';
const CHAIN_ONE = ['land', 'chain', 'pay', '1.1'];

/**
 * The refusal of a commit no task of its phase, and the way it is taken off.
 * @param {string} branch @param {number} phase @param {string} sha @param {string} subject @param {string} off
 */
const stray = (branch, phase, sha, subject, off) => `land: ${branch} holds ${s(sha)} "${subject}", which is no task of phase ${phase} — `
  + `keep it on a branch of its own with ${keepWith(branch, sha)}, take it off ${branch} with ${off}, and land again`;

/** A worktree of the row's own, with a branch checked out. @param {string} dir @param {string} branch */
function linked(dir, branch) {
  const tree = path.join(dir, '.git', 'linked work');
  git(dir, ['worktree', 'add', '-q', tree, branch]);
  return tree;
}

/** A commit made in a worktree, as the person makes one. @param {string} tree @param {string} file @param {string} text @param {string} message */
function commitIn(tree, file, text, message) {
  fs.writeFileSync(path.join(tree, file), text);
  git(tree, ['add', file]);
  git(tree, ['commit', '-q', '-m', message]);
  return git(tree, ['rev-parse', 'HEAD']).trim();
}

/** Phase 1 made again by hand: a commit no task of it, then 1.1's landing above it. @param {string} dir */
function strayBelowCard(dir) {
  const below = commitFiles(dir, PHASE_ONE, 'main', { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
  commitFiles(dir, PHASE_ONE, below, card.files, { message: CARD_LANDING });
  return below;
}

/** What a phase's branch holds that stops its stack: a commit no task of the phase, or a task twice. @type {{name: string, setup: (dir: string) => Remedy}[]} */
const COMMIT_ROWS = [
  {
    name: 'a commit at the top of a phase\'s branch out nowhere: kept, and the branch moved back past it',
    setup: (dir) => {
      const top = commitFiles(dir, PHASE_ONE, PHASE_ONE, { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
      return { args: CHAIN_ONE, refusal: stray(PHASE_ONE, 1, top, 'my tidy', `\`git branch -f ${PHASE_ONE} ${s(top)}^\``) };
    },
  },
  {
    name: 'a commit at the top of a phase\'s branch out in a worktree: kept, and reset there, keeping what is not committed',
    setup: (dir) => {
      const tree = linked(dir, PHASE_ONE);
      const top = commitIn(tree, 'tidy.txt', 'tidy\n', 'my tidy');
      return { args: CHAIN_ONE, refusal: stray(PHASE_ONE, 1, top, 'my tidy', `\`${gitIn(tree)} reset --keep ${s(top)}^\``) };
    },
  },
  {
    name: 'a task of another phase at the top of a phase\'s branch: taken off as any commit no task of the phase',
    setup: (dir) => {
      const top = commitFiles(dir, PHASE_ONE, PHASE_ONE, rounding.files, { message: ROUND_LANDING });
      return { args: CHAIN_ONE, refusal: stray(PHASE_ONE, 1, top, 'fix(pay): Round totals', `\`git branch -f ${PHASE_ONE} ${s(top)}^\``) };
    },
  },
  {
    name: 'a commit below a task on a phase\'s branch out nowhere: kept, and rebased off it in a worktree made for it',
    setup: (dir) => {
      const below = strayBelowCard(dir);
      return { args: CHAIN_ONE, refusal: stray(PHASE_ONE, 1, below, 'my tidy', rebaseAside(dir, PHASE_ONE, `--onto ${s(below)}^ ${s(below)}`)) };
    },
  },
  {
    name: 'a commit below a task on a phase\'s branch out in a worktree: kept, and rebased off it there',
    setup: (dir) => {
      const below = strayBelowCard(dir);
      const tree = linked(dir, PHASE_ONE);
      return { args: CHAIN_ONE, refusal: stray(PHASE_ONE, 1, below, 'my tidy', `\`${gitIn(tree)} rebase --onto ${s(below)}^ ${s(below)}\``) };
    },
  },
  {
    name: 'a commit below a task on a phase\'s branch out in a worktree with changes not committed: those set aside there first',
    setup: (dir) => {
      const below = strayBelowCard(dir);
      const tree = linked(dir, PHASE_ONE);
      fs.writeFileSync(path.join(tree, 'card.txt'), 'card, being edited\n');
      const off = `\`${gitIn(tree)} stash\` to set aside the changes not committed there, then \`${gitIn(tree)} rebase --onto ${s(below)}^ ${s(below)}\``;
      return { args: CHAIN_ONE, refusal: stray(PHASE_ONE, 1, below, 'my tidy', off) };
    },
  },
  {
    name: 'another unit\'s task of the same number below a task: taken off as any commit no task of the phase',
    setup: (dir) => {
      const other = commitFiles(dir, 'feat/pay-phase-4', 'main', { 'v2.txt': 'v2\n' }, { message: 'feat(pay-v2): Other\n\nTask: pay-v2-4-1\n' });
      commitFiles(dir, 'feat/pay-phase-4', 'feat/pay-phase-4', { 'four.txt': 'four\n' }, { message: 'fix(pay): Four\n\nTask: pay-4-1\n' });
      const off = rebaseAside(dir, 'feat/pay-phase-4', `--onto ${s(other)}^ ${s(other)}`);
      return { args: ['land', 'chain', 'pay', '4.1'], refusal: stray('feat/pay-phase-4', 4, other, 'feat(pay-v2): Other', off) };
    },
  },
  {
    name: 'another unit\'s task of another number below a task: never the phase it stacks on',
    setup: (dir) => {
      const other = commitFiles(dir, 'feat/pay-phase-5', 'main', { 'v2.txt': 'v2\n' }, { message: 'feat(pay-v2): Other\n\nTask: pay-v2-1-1\n' });
      commitFiles(dir, 'feat/pay-phase-5', 'feat/pay-phase-5', { 'five.txt': 'five\n' }, { message: 'fix(pay): Five\n\nTask: pay-5-1\n' });
      const off = rebaseAside(dir, 'feat/pay-phase-5', `--onto ${s(other)}^ ${s(other)}`);
      return { args: ['land', 'chain', 'pay', '5.1'], refusal: stray('feat/pay-phase-5', 5, other, 'feat(pay-v2): Other', off) };
    },
  },
  {
    name: 'a task landed twice, the upper copy one whose tree its branch lacks: that copy kept and taken off',
    setup: (dir) => {
      const landing = tip(dir, PHASE_ONE);
      const copy = commitFiles(dir, PHASE_ONE, PHASE_ONE, { 'mine.txt': 'mine\n' }, { message: 'mine\n\nTask: pay-1-1\n' });
      return {
        args: CHAIN_ONE,
        refusal: `land: ${PHASE_ONE} holds task 1.1 twice, ${s(landing)} "feat(pay): Add card" its landing — of ${s(copy)} "mine", `
          + `keep it on a branch of its own with ${keepWith(PHASE_ONE, copy)}, take it off ${PHASE_ONE} with \`git branch -f ${PHASE_ONE} ${s(copy)}^\`, and land again`,
      };
    },
  },
  {
    name: 'a task landed twice, the lower copy one whose tree its branch lacks: that copy kept and rebased off',
    setup: (dir) => {
      const copy = commitFiles(dir, PHASE_ONE, 'main', { 'mine.txt': 'mine\n' }, { message: 'mine\n\nTask: pay-1-1\n' });
      const tree = git(dir, ['rev-parse', `${card.branch}^{tree}`]).trim();
      const landing = git(dir, ['commit-tree', tree, '-p', copy, '-m', CARD_LANDING.trim()]).trim();
      git(dir, ['update-ref', `refs/heads/${PHASE_ONE}`, landing]);
      return {
        args: CHAIN_ONE,
        refusal: `land: ${PHASE_ONE} holds task 1.1 twice, ${s(landing)} "feat(pay): Add card" its landing — of ${s(copy)} "mine", `
          + `keep it on a branch of its own with ${keepWith(PHASE_ONE, copy)}, take it off ${PHASE_ONE} with ${rebaseAside(dir, PHASE_ONE, `--onto ${s(copy)}^ ${s(copy)}`)}, and land again`,
      };
    },
  },
];

/** A landing's trailer gone, a stack built on that something stops, and a task's branch gone, changed or moved. @type {{name: string, setup: (dir: string) => Remedy}[]} */
const BRANCH_ROWS = [
  {
    name: 'a task\'s landing whose trailer was taken off: kept, the branch moved back past it, onto another phase\'s landing, which lands nothing, and the phase opens afresh',
    setup: (dir) => {
      ok(dir, ['land', 'phase', 'pay', '2']);
      const reworded = commitFiles(dir, PHASE_ONE, 'main', card.files, { message: 'feat(pay): Add a card' });
      commitFiles(dir, 'feat/pay-1.4-keep-cards', 'main', { 'keep.txt': 'keep\n' });
      return {
        args: open('1.4', 'feat', 'Keep cards'),
        refusal: stray(PHASE_ONE, 1, reworded, 'feat(pay): Add a card', `\`git branch -f ${PHASE_ONE} ${s(reworded)}^\``),
        check: (at, answer) => assert.strictEqual(answer.base, 'main'),
      };
    },
  },
  {
    name: 'a task built on a stack with a commit no task of it at its top: refused as that stack is',
    setup: (dir) => {
      const top = commitFiles(dir, 'feat/pay-phase-2', 'feat/pay-phase-2', { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
      return { args: openArgs(currency), refusal: stray('feat/pay-phase-2', 2, top, 'my tidy', `\`git branch -f feat/pay-phase-2 ${s(top)}^\``) };
    },
  },
  {
    name: 'a task built on a stack with a commit no task of it below its task: refused as that stack is',
    setup: (dir) => {
      const below = commitFiles(dir, 'feat/pay-phase-2', 'main', { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
      commitFiles(dir, 'feat/pay-phase-2', below, rounding.files, { message: ROUND_LANDING });
      const off = rebaseAside(dir, 'feat/pay-phase-2', `--onto ${s(below)}^ ${s(below)}`);
      return { args: openArgs(currency), refusal: stray('feat/pay-phase-2', 2, below, 'my tidy', off) };
    },
  },
  {
    name: 'a task built on a stack whose last task\'s branch is gone: the branch made again where the task holds it',
    setup: (dir) => {
      const was = tip(dir, rounding.branch);
      git(dir, ['branch', '-D', rounding.branch]);
      return {
        args: openArgs(currency),
        refusal: `land: task 2.1's branch is gone, and phase 2's chain ends at it — make it again with \`git branch ${rounding.branch} ${s(was)}\` and land again`,
      };
    },
  },
  {
    name: 'its own phase\'s last task\'s branch gone: made again where the task holds it',
    setup: (dir) => {
      commitFiles(dir, 'feat/pay-1.5-saved-cards', card.branch, { 'saved.txt': 'saved\n' });
      const was = tip(dir, card.branch);
      git(dir, ['branch', '-D', card.branch]);
      return {
        args: open('1.5', 'feat', 'Saved cards'),
        refusal: `land: task 1.1's branch is gone, and phase 1's chain ends at it — make it again with \`git branch ${card.branch} ${s(was)}\` and land again`,
      };
    },
  },
  {
    name: 'a phase\'s commit for a task changed since it opened, its task\'s branch where it opened: kept, taken off, and the task opened again',
    setup: (dir) => {
      const amended = commitFiles(dir, PHASE_ONE, 'main', { 'card.txt': 'card, amended\n' }, { message: CARD_LANDING });
      commitFiles(dir, 'feat/pay-1.5-saved-cards', card.branch, { 'saved.txt': 'saved\n' });
      return {
        args: open('1.5', 'feat', 'Saved cards'),
        refusal: `land: ${PHASE_ONE}'s commit for task 1.1, ${s(amended)} "feat(pay): Add card", has changed since it was opened — `
          + `keep it on a branch of its own with ${keepWith(PHASE_ONE, amended)}, take it off ${PHASE_ONE} with \`git branch -f ${PHASE_ONE} ${s(amended)}^\`, and open task 1.1 again`,
        follow: (at, refusal) => {
          followRemedy(at, refusal);
          ok(at, openArgs(card));
        },
      };
    },
  },
  {
    name: 'a task\'s branch moved on since it opened, out nowhere: what it holds kept, and put back where it opened',
    setup: (dir) => {
      const opened = tip(dir, card.branch);
      const moved = commitFiles(dir, card.branch, card.branch, { 'card.txt': 'card, fixed\n' });
      commitFiles(dir, 'feat/pay-1.5-saved-cards', card.branch, { 'saved.txt': 'saved\n' });
      return {
        args: open('1.5', 'feat', 'Saved cards'),
        refusal: movedRefusal(card.branch, opened, moved, `\`git branch -f ${card.branch} ${s(opened)}\``),
      };
    },
  },
  {
    name: 'a task\'s branch rewritten since it opened: what it holds kept, and put back where it opened',
    setup: (dir) => {
      const opened = tip(dir, card.branch);
      const amended = commitFiles(dir, card.branch, 'main', { 'card.txt': 'card, amended\n' }, { message: 'my amended card' });
      return {
        args: ['land', 'phase', 'pay', '1'],
        refusal: movedRefusal(card.branch, opened, amended, `\`git branch -f ${card.branch} ${s(opened)}\``),
        check: (at) => assert.strictEqual(git(at, ['show', 'main:card.txt']), 'card\n'),
      };
    },
  },
  {
    name: 'a task\'s branch moved on since it opened, out in a worktree: the phase refuses to merge it, what it holds is kept, and it is reset there',
    setup: (dir) => {
      const opened = tip(dir, card.branch);
      const tree = linked(dir, card.branch);
      const moved = commitIn(tree, 'card.txt', 'card, fixed\n', 'fix the card');
      return {
        args: ['land', 'phase', 'pay', '1'],
        refusal: movedRefusal(card.branch, opened, moved, `\`${gitIn(tree)} reset --keep ${s(opened)}\``),
        check: (at) => assert.strictEqual(git(at, ['show', 'main:card.txt']), 'card\n'),
      };
    },
  },
];

/**
 * The refusal of a task's branch that moved since it opened.
 * @param {string} branch @param {string} opened @param {string} now @param {string} back
 */
function movedRefusal(branch, opened, now, back) {
  return `land: task 1.1's branch ${branch} has moved since it was opened at ${s(opened)}, to ${s(now)} — `
    + `keep what it holds now with \`git branch ${branch}.kept-${s(now)} ${s(now)}\`, put it back with ${back}, and land again; `
    + `its commits past ${s(opened)}, on ${branch}.kept-${s(now)} then, are a task of their own`;
}

/** What a task holds and what a stacked phase waits on. @type {{name: string, setup: (dir: string) => Remedy}[]} */
const MERGE_ROWS = [
  {
    name: 'a task holding a task not opened, beside a branch at its own tip and one its tip holds: the task opened first',
    setup: (dir) => {
      commitFiles(dir, 'fix/pay-2.2-round-down', rounding.branch, { 'down.txt': 'down\n' });
      commitFiles(dir, 'fix/pay-4.1-show-rounding', 'fix/pay-2.2-round-down', { 'show.txt': 'show\n' });
      git(dir, ['branch', 'fix/pay-4.2-not-begun', 'fix/pay-4.1-show-rounding']);
      git(dir, ['branch', 'fix/pay-4.5-not-begun', 'main']);
      return {
        args: open('4.1', 'fix', 'Show rounding'),
        refusal: 'land: task 4.1\'s branch fix/pay-4.1-show-rounding holds fix/pay-2.2-round-down, not opened — open task 2.2 first',
        follow: (at) => ok(at, open('2.2', 'fix', 'Round down')),
      };
    },
  },
  {
    name: 'a task holding a task landed in a phase off its chain: that phase merged first',
    setup: (dir) => {
      commitFiles(dir, 'feat/pay-1.5-both', card.branch, { 'both.txt': 'both\n' });
      mergeBack(dir, 'feat/pay-1.5-both', rounding.branch);
      return {
        args: open('1.5', 'feat', 'Both'),
        refusal: `land: task 1.5's branch feat/pay-1.5-both holds ${rounding.branch}, landed in a phase's stack off its chain — `
          + `merge that phase first with \`land phase pay 2\`, or cut the branch again from ${card.branch} without it, and land again`,
      };
    },
  },
  {
    name: 'a task built on another phase\'s stack short of its tip: merged back onto that tip',
    setup: (dir) => {
      commitFiles(dir, 'fix/pay-2.2-round-down', rounding.branch, { 'down.txt': 'down\n' });
      ok(dir, open('2.2', 'fix', 'Round down'));
      return {
        args: openArgs(currency),
        refusal: `land: task 3.1's branch ${currency.branch} does not descend from the chain's tip, fix/pay-2.2-round-down (${s(tip(dir, 'fix/pay-2.2-round-down'))}) — merge it back onto fix/pay-2.2-round-down first`,
        follow: (at) => mergeBack(at, currency.branch, 'fix/pay-2.2-round-down'),
      };
    },
  },
  {
    name: 'a phase stacked on one not merged: that one merged first',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 stacks on phase 2, which has not merged — merge it first with `land phase pay 2`, then land again',
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on one partly on the default branch by hand: that one merged first, not passed over',
    setup: (dir) => {
      commitFiles(dir, 'fix/pay-2.2-round-down', rounding.branch, { 'down.txt': 'down\n' });
      ok(dir, open('2.2', 'fix', 'Round down'));
      commitFiles(dir, 'fix/pay-3.2-currency-down', 'fix/pay-2.2-round-down', { 'cd.txt': 'cd\n' });
      ok(dir, open('3.2', 'fix', 'Currency down'));
      git(dir, ['checkout', '-q', '-b', 'wip']);
      commitFiles(dir, 'main', 'main', rounding.files, { message: ROUND_LANDING });
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 stacks on phase 2, which has not merged — merge it first with `land phase pay 2`, then land again',
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], [], ['down.txt'], ['cd.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on one whose branch was deleted unmerged: its task opened again and merged',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      git(dir, ['branch', '-D', 'feat/pay-phase-2']);
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + 'open it again with `land open pay 2.1 --type fix --title \'Round totals\'`, merge it with `land phase pay 2`, and land again',
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on one whose branch and task\'s branch were both deleted unmerged: the task\'s branch made again, opened, and merged',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      const landing = tip(dir, 'feat/pay-phase-2');
      git(dir, ['branch', '-D', 'feat/pay-phase-2', rounding.branch]);
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + `make it again with \`git branch ${rounding.branch} ${s(landing)}\`, `
          + 'open it again with `land open pay 2.1 --type fix --title \'Round totals\'`, merge it with `land phase pay 2`, and land again',
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on a task landed on the default branch by hand with no trailer: the task merged back, opened as a landing that changes nothing, and merged',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      git(dir, ['branch', '-D', 'feat/pay-phase-2']);
      git(dir, ['checkout', '-q', '-b', 'wip']);
      commitFiles(dir, 'main', 'main', rounding.files, { message: 'round the totals, by hand' });
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + 'open it again with `land open pay 2.1 --type fix --title \'Round totals\'`, merge it with `land phase pay 2`, and land again',
        follow: (at, refusal) => {
          assert.match(refuses(at, openArgs(rounding)).error, /does not descend from the chain's tip, main .* — merge it back onto main first$/);
          mergeBack(at, rounding.branch, 'main');
          followRemedy(at, refusal);
        },
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], [], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on a task its base phase merged without: the task taken off it too',
    setup: (dir) => {
      commitFiles(dir, 'fix/pay-2.2-round-down', rounding.branch, { 'down.txt': 'down\n' });
      ok(dir, open('2.2', 'fix', 'Round down'));
      const dropped = tip(dir, 'feat/pay-phase-2');
      commitFiles(dir, 'fix/pay-3.2-currency-down', 'fix/pay-2.2-round-down', { 'cd.txt': 'cd\n' });
      ok(dir, open('3.2', 'fix', 'Currency down'));
      git(dir, ['update-ref', 'refs/heads/feat/pay-phase-2', `${dropped}^`]);
      ok(dir, ['land', 'phase', 'pay', '2']);
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.2, which phase 2 merged into main without — '
          + `keep it on a branch of its own with ${keepWith('feat/pay-phase-3', dropped)}, `
          + `take it off feat/pay-phase-3 with ${rebaseAside(dir, 'feat/pay-phase-3', `--onto ${s(dropped)}^ ${s(dropped)}`)}, and land again`,
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], ['cd.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on a task its base phase no longer lands, that phase standing with another: the task opened again on it, merged back first, and merged',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      git(dir, ['branch', '-f', 'feat/pay-phase-2', 'main']);
      commitFiles(dir, 'fix/pay-2.2-round-down', 'main', { 'down.txt': 'down\n' });
      ok(dir, open('2.2', 'fix', 'Round down'));
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + 'open it again with `land open pay 2.1 --type fix --title \'Round totals\'`, merge it with `land phase pay 2`, and land again',
        follow: (at, refusal) => {
          assert.match(refuses(at, openArgs(rounding)).error, /does not descend from the chain's tip, fix\/pay-2\.2-round-down .* — merge it back onto fix\/pay-2\.2-round-down first$/);
          mergeBack(at, rounding.branch, 'fix/pay-2.2-round-down');
          followRemedy(at, refusal);
        },
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['down.txt'], ['round.txt'], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase whose change conflicts with the default branch: brought up to date, the conflict settled as the rebase stops',
    setup: (dir) => {
      commitFiles(dir, 'fix/pay-4.1-word-the-card', 'main', { 'card.txt': 'a card\n' });
      ok(dir, open('4.1', 'fix', 'Word the card'));
      ok(dir, ['land', 'phase', 'pay', '1']);
      return {
        args: ['land', 'phase', 'pay', '4'],
        refusal: 'land: task 4.1 conflicts with main at card.txt, so nothing moved — bring feat/pay-phase-4 up to date with main: '
          + `${rebaseAside(dir, 'feat/pay-phase-4', 'main', true)}, and land again`,
        follow: (at, refusal) => followRemedy(at, refusal, () => {
          const tree = scratchOf(at, 'feat/pay-phase-4');
          fs.writeFileSync(path.join(tree, 'card.txt'), 'a card\n');
          git(tree, ['add', 'card.txt']);
        }),
        check: (at) => assert.strictEqual(git(at, ['show', 'main:card.txt']), 'a card\n'),
      };
    },
  },
];

module.exports = { READY, COMMIT_ROWS, BRANCH_ROWS, MERGE_ROWS };
