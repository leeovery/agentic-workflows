'use strict';

// ---------------------------------------------------------------------------
// The remedy table of the local landing driver (leeway-engine/scripts/
// drivers/landing/local/driver.cjs, with landing-git.cjs's remedies): one
// row per state of the repository a `land` verb refuses, each giving the
// verb, its refusal word for word, how its remedy is taken where that is
// not by running the commands it names alone, and the branch the remedy
// moves or rewrites, if it moves one; a task a row opens it puts into the
// tracker first (landing-world.cjs, `track`). What stops a stack
// (`STACK_ROWS`): a commit no task of its phase, at the branch's top or
// below; a task landed twice, either copy; a stack a task is built on that
// something stops; a phase's commit changed; a task's branch moved,
// reworded, or gone. What a task holds and what a phase waits on
// (`MERGE_ROWS`): a task holding a task not opened, or one landed in a
// phase off its chain; a task short of its chain's tip; a stacked phase
// whose base the default branch lacks a task of — its phase not merged, its
// branches deleted, landed by hand, or merged without it; a replay that
// conflicts. The hostile-stacks and hostile-merges suites follow every row
// of their half with the person's checkout clean and their config hostile
// to the landing; the held-here and
// held-linked suites each row whose remedy moves a branch, with the person
// holding it, and the busy suite each whose remedy rewrites one, with the
// person holding none (landing-world.cjs, `personState`) — all in the
// landing world with tasks 1.1 and 2.1 opened (`READY`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, tip } = require('./engine-harness.cjs');
const {
  TASKS, openArgs, own, track, commitFiles, mergeBack, landedOn, followRemedy, short: s, scratchOf, way, moveStep, rebaseSteps, strayRefusal: stray,
} = require('./landing-world.cjs');

/** @typedef {import('./landing-world.cjs').Row} Row */
/** @typedef {import('./landing-world.cjs').Held} Held */

const { card, total, rounding, currency } = TASKS;

/** The world every row starts from: tasks 1.1 and 2.1 opened. @param {string} dir */
function READY(dir) {
  ok(dir, openArgs(card));
  ok(dir, openArgs(rounding));
}

const PHASE_ONE = 'feat/pay-phase-1';
const PHASE_TWO = 'feat/pay-phase-2';
const CARD_LANDING = 'feat(pay): Add card\n\nTask: pay-1-1\n';
const ROUND_LANDING = 'fix(pay): Round totals\n\nTask: pay-2-1\n';
const CHAIN_ONE = ['land', 'chain', 'pay', '1.1'];
// The project's own ignore rule, and a local file its keeper stops tracking.
const IGNORE_LOCAL = { '.gitignore': '.leeway/\nlocal.env\n' };

/** The step taking a commit off the top of a branch. @param {string} branch @param {string} sha */
const offTop = (branch, sha) => moveStep(branch, `${s(sha)}^`, `take ${s(sha)} off ${branch}`);

/** The steps taking a commit off a branch below its top. @param {string} dir @param {string} branch @param {string} sha */
const offBelow = (dir, branch, sha) => rebaseSteps(dir, branch, `--onto ${s(sha)}^ ${s(sha)}`, `take ${s(sha)} off ${branch}`);

/**
 * The refusal of task 1.1 landed twice on phase 1, the copy taken off.
 * @param {string} landing @param {string} copy @param {string} remedy
 */
const twice = (landing, copy, remedy) => `land: ${PHASE_ONE} holds task 1.1 twice, ${s(landing)} "feat(pay): Add card" its landing and ${s(copy)} "mine" a copy — ${remedy}`;

/**
 * The refusal of a task's branch that moved since it opened, as it reads
 * where `held` has the branch out.
 * @param {string} dir @param {Held} held @param {string} shown @param {string} branch @param {string} opened @param {string} now
 */
function moved(dir, held, shown, branch, opened, now) {
  const remedy = way(dir, held, branch, moveStep(branch, s(opened), `put ${branch} back`), {
    note: (kept) => `the change from ${s(opened)} to ${s(now)}, on ${kept}, is a task of its own`,
  });
  return `land: task ${shown}'s branch ${branch} has moved since it was opened at ${s(opened)}, to ${s(now)} — ${remedy}`;
}

/** Settle a rebase stopped at a worktree a remedy made, taking `text` for `file`. @param {string} branch @param {string} file @param {string} text */
const settleWith = (branch, file, text) => (/** @type {string} */ at) => {
  const tree = scratchOf(at, branch);
  fs.writeFileSync(path.join(tree, file), text);
  git(tree, ['add', file]);
};

/** What a phase's branch holds that stops its stack: a commit no task of the phase, or a task twice. @type {Row[]} */
const COMMIT_ROWS = [
  {
    name: 'a commit at the top of a phase\'s branch: the branch kept, and moved back past it',
    moves: PHASE_ONE,
    setup: (dir) => {
      const top = commitFiles(dir, PHASE_ONE, PHASE_ONE, { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
      return { args: CHAIN_ONE, refusal: (held) => stray(PHASE_ONE, 1, top, 'my tidy', way(dir, held, PHASE_ONE, offTop(PHASE_ONE, top))) };
    },
  },
  {
    name: 'a task of another phase at the top of a phase\'s branch: taken off as any commit no task of the phase',
    moves: PHASE_ONE,
    setup: (dir) => {
      const top = commitFiles(dir, PHASE_ONE, PHASE_ONE, rounding.files, { message: ROUND_LANDING });
      return { args: CHAIN_ONE, refusal: (held) => stray(PHASE_ONE, 1, top, 'fix(pay): Round totals', way(dir, held, PHASE_ONE, offTop(PHASE_ONE, top))) };
    },
  },
  {
    name: 'a commit below a task, one that stops tracking a file the phase tracked: the branch kept, and rebased off it in a worktree made for it',
    moves: PHASE_ONE,
    rewrites: true,
    setup: (dir) => {
      const landing = commitFiles(dir, PHASE_ONE, 'main', { ...card.files, 'local.env': 'TEMPLATE=1\n' }, { message: CARD_LANDING });
      const below = commitFiles(dir, PHASE_ONE, landing, IGNORE_LOCAL, { removed: ['local.env'], message: 'stop tracking local.env' });
      commitFiles(dir, PHASE_ONE, below, total.files, { message: 'feat(pay): Show total\n\nTask: pay-1-2\n' });
      return {
        args: ['land', 'chain', 'pay', '1.2'],
        refusal: (held) => stray(PHASE_ONE, 1, below, 'stop tracking local.env', way(dir, held, PHASE_ONE, offBelow(dir, PHASE_ONE, below))),
      };
    },
  },
  {
    name: 'another unit\'s task of the same number below a task: taken off as any commit no task of the phase',
    moves: 'feat/pay-phase-4',
    rewrites: true,
    setup: (dir) => {
      const other = commitFiles(dir, 'feat/pay-phase-4', 'main', { 'v2.txt': 'v2\n' }, { message: 'feat(pay-v2): Other\n\nTask: pay-v2-4-1\n' });
      commitFiles(dir, 'feat/pay-phase-4', 'feat/pay-phase-4', { 'four.txt': 'four\n' }, { message: 'fix(pay): Four\n\nTask: pay-4-1\n' });
      return {
        args: ['land', 'chain', 'pay', '4.1'],
        refusal: (held) => stray('feat/pay-phase-4', 4, other, 'feat(pay-v2): Other', way(dir, held, 'feat/pay-phase-4', offBelow(dir, 'feat/pay-phase-4', other))),
      };
    },
  },
  {
    name: 'another unit\'s task of another number below a task: never the phase it stacks on',
    moves: 'feat/pay-phase-5',
    rewrites: true,
    setup: (dir) => {
      const other = commitFiles(dir, 'feat/pay-phase-5', 'main', { 'v2.txt': 'v2\n' }, { message: 'feat(pay-v2): Other\n\nTask: pay-v2-1-1\n' });
      commitFiles(dir, 'feat/pay-phase-5', 'feat/pay-phase-5', { 'five.txt': 'five\n' }, { message: 'fix(pay): Five\n\nTask: pay-5-1\n' });
      return {
        args: ['land', 'chain', 'pay', '5.1'],
        refusal: (held) => stray('feat/pay-phase-5', 5, other, 'feat(pay-v2): Other', way(dir, held, 'feat/pay-phase-5', offBelow(dir, 'feat/pay-phase-5', other))),
      };
    },
  },
  {
    name: 'a task landed twice, the upper copy one whose tree its branch lacks: the branch kept, and moved back past that copy',
    moves: PHASE_ONE,
    setup: (dir) => {
      const landing = tip(dir, PHASE_ONE);
      const copy = commitFiles(dir, PHASE_ONE, PHASE_ONE, { 'mine.txt': 'mine\n' }, { message: 'mine\n\nTask: pay-1-1\n' });
      return { args: CHAIN_ONE, refusal: (held) => twice(landing, copy, way(dir, held, PHASE_ONE, offTop(PHASE_ONE, copy))) };
    },
  },
  {
    name: 'a task landed twice, the lower copy one whose tree its branch lacks: the branch kept, and rebased off that copy',
    moves: PHASE_ONE,
    rewrites: true,
    setup: (dir) => {
      const copy = commitFiles(dir, PHASE_ONE, 'main', { 'mine.txt': 'mine\n' }, { message: 'mine\n\nTask: pay-1-1\n' });
      const tree = git(dir, ['rev-parse', `${card.branch}^{tree}`]).trim();
      const landing = git(dir, ['commit-tree', tree, '-p', copy, '-m', CARD_LANDING.trim()]).trim();
      git(dir, ['update-ref', `refs/heads/${PHASE_ONE}`, landing]);
      return { args: CHAIN_ONE, refusal: (held) => twice(landing, copy, way(dir, held, PHASE_ONE, offBelow(dir, PHASE_ONE, copy))) };
    },
  },
];

/** A landing's trailer gone, a stack built on that something stops, a phase's commit changed, and a task's branch gone, moved or reworded. @type {Row[]} */
const BRANCH_ROWS = [
  {
    name: 'a task\'s landing whose trailer was taken off: the branch kept, and moved back past it, onto another phase\'s landing, which lands nothing, and the phase opens afresh',
    moves: PHASE_ONE,
    setup: (dir) => {
      ok(dir, ['land', 'phase', 'pay', '2']);
      const reworded = commitFiles(dir, PHASE_ONE, 'main', card.files, { message: 'feat(pay): Add a card' });
      const keep = track(dir, '1.4', 'feat', 'Keep cards');
      commitFiles(dir, keep.branch, 'main', { 'keep.txt': 'keep\n' });
      return {
        args: openArgs(keep),
        refusal: (held) => stray(PHASE_ONE, 1, reworded, 'feat(pay): Add a card', way(dir, held, PHASE_ONE, offTop(PHASE_ONE, reworded))),
        check: (at, answer) => assert.strictEqual(own(answer).base, 'main'),
      };
    },
  },
  {
    name: 'a task built on a stack with a commit no task of it at its top: refused as that stack is',
    moves: PHASE_TWO,
    setup: (dir) => {
      const top = commitFiles(dir, PHASE_TWO, PHASE_TWO, { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
      return { args: openArgs(currency), refusal: (held) => stray(PHASE_TWO, 2, top, 'my tidy', way(dir, held, PHASE_TWO, offTop(PHASE_TWO, top))) };
    },
  },
  {
    name: 'a task built on a stack with a commit no task of it below its task: refused as that stack is',
    moves: PHASE_TWO,
    rewrites: true,
    setup: (dir) => {
      const below = commitFiles(dir, PHASE_TWO, 'main', { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
      commitFiles(dir, PHASE_TWO, below, rounding.files, { message: ROUND_LANDING });
      return { args: openArgs(currency), refusal: (held) => stray(PHASE_TWO, 2, below, 'my tidy', way(dir, held, PHASE_TWO, offBelow(dir, PHASE_TWO, below))) };
    },
  },
  {
    name: 'a task built on a stack whose last task\'s branch is gone: the branch made again where it opened',
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
    name: 'its own phase\'s last task\'s branch gone, the task opening cut from it: made again where it opened',
    setup: (dir) => {
      const saved = track(dir, '1.5', 'feat', 'Saved cards');
      commitFiles(dir, saved.branch, card.branch, { 'saved.txt': 'saved\n' });
      const was = tip(dir, card.branch);
      git(dir, ['branch', '-D', card.branch]);
      return {
        args: openArgs(saved),
        refusal: `land: task 1.1's branch is gone, and phase 1's chain ends at it — make it again with \`git branch ${card.branch} ${s(was)}\` and land again`,
      };
    },
  },
  {
    name: 'its own phase\'s last task\'s branch gone, the task opening cut without it: made again where it opened, and the task merged back onto it',
    setup: (dir) => {
      const saved = track(dir, '1.5', 'feat', 'Saved cards');
      commitFiles(dir, saved.branch, 'main', { 'saved.txt': 'saved\n' });
      const was = tip(dir, card.branch);
      git(dir, ['branch', '-D', card.branch]);
      return {
        args: openArgs(saved),
        refusal: `land: task 1.1's branch is gone, and phase 1's chain ends at it — make it again with \`git branch ${card.branch} ${s(was)}\` and land again`,
        follow: (at, refusal) => {
          followRemedy(at, refusal);
          mergeBack(at, saved.branch, card.branch);
        },
      };
    },
  },
  {
    name: 'a phase\'s commit for a task changed since it opened, its task\'s branch where it opened: the branch kept, the commit taken off, and the task opened again',
    moves: PHASE_ONE,
    setup: (dir) => {
      const amended = commitFiles(dir, PHASE_ONE, 'main', { 'card.txt': 'card, amended\n' }, { message: CARD_LANDING });
      const saved = track(dir, '1.5', 'feat', 'Saved cards');
      commitFiles(dir, saved.branch, card.branch, { 'saved.txt': 'saved\n' });
      return {
        args: openArgs(saved),
        refusal: (held) => `land: ${PHASE_ONE}'s commit for task 1.1, ${s(amended)} "feat(pay): Add card", has changed since it was opened — `
          + way(dir, held, PHASE_ONE, offTop(PHASE_ONE, amended), { then: 'open task 1.1 again' }),
        follow: (at, refusal) => {
          followRemedy(at, refusal);
          ok(at, openArgs(card));
        },
      };
    },
  },
  {
    name: 'the chain\'s last task\'s branch moved since it opened, by a review fix that stops tracking a file: the branch kept, and put back where it opened',
    moves: 'feat/pay-1.4-keep-config',
    setup: (dir) => {
      const keep = track(dir, '1.4', 'feat', 'Keep config');
      commitFiles(dir, keep.branch, card.branch, { 'local.env': 'TEMPLATE=1\n' });
      ok(dir, openArgs(keep));
      const opened = tip(dir, keep.branch);
      const fixed = commitFiles(dir, keep.branch, keep.branch, IGNORE_LOCAL, { removed: ['local.env'], message: 'stop tracking local.env' });
      const saved = track(dir, '1.5', 'feat', 'Saved cards');
      commitFiles(dir, saved.branch, keep.branch, { 'saved.txt': 'saved\n' });
      return { args: openArgs(saved), refusal: (held) => moved(dir, held, '1.4', keep.branch, opened, fixed) };
    },
  },
  {
    name: 'a task\'s branch reworded since it opened, below its stack\'s top — its files the same: a task opens on the stack all the same, and the phase is refused until the branch is put back',
    moves: card.branch,
    setup: (dir) => {
      const opened = tip(dir, card.branch);
      const saved = track(dir, '1.5', 'feat', 'Saved cards');
      commitFiles(dir, saved.branch, card.branch, { 'saved.txt': 'saved\n' });
      ok(dir, openArgs(saved));
      const reworded = git(dir, ['commit-tree', `${opened}^{tree}`, '-p', `${opened}^`, '-m', 'add the card']).trim();
      git(dir, ['update-ref', `refs/heads/${card.branch}`, reworded]);
      const limits = track(dir, '1.6', 'feat', 'Card limits');
      commitFiles(dir, limits.branch, saved.branch, { 'limits.txt': 'limits\n' });
      ok(dir, openArgs(limits));
      return {
        args: ['land', 'phase', 'pay', '1'],
        refusal: (held) => moved(dir, held, '1.1', card.branch, opened, reworded),
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ task }) => task), ['pay-1-1', 'pay-1-5', 'pay-1-6']),
      };
    },
  },
];

/** What a task holds and what a stacked phase waits on. @type {Row[]} */
const MERGE_ROWS = [
  {
    name: 'a task holding a task not opened, beside a branch at its own tip and one its tip holds: the task opened first',
    setup: (dir) => {
      const down = track(dir, '2.2', 'fix', 'Round down');
      const show = track(dir, '4.1', 'fix', 'Show rounding');
      commitFiles(dir, down.branch, rounding.branch, { 'down.txt': 'down\n' });
      commitFiles(dir, show.branch, down.branch, { 'show.txt': 'show\n' });
      git(dir, ['branch', 'fix/pay-4.2-not-begun', show.branch]);
      git(dir, ['branch', 'fix/pay-4.5-not-begun', 'main']);
      return {
        args: openArgs(show),
        refusal: 'land: task 4.1\'s branch fix/pay-4.1-show-rounding holds fix/pay-2.2-round-down, not opened — open task 2.2 first',
        follow: (at) => ok(at, openArgs(down)),
      };
    },
  },
  {
    name: 'a task holding a task landed in a phase off its chain: that phase merged first',
    setup: (dir) => {
      const both = track(dir, '1.5', 'feat', 'Both');
      commitFiles(dir, both.branch, card.branch, { 'both.txt': 'both\n' });
      mergeBack(dir, both.branch, rounding.branch);
      return {
        args: openArgs(both),
        refusal: `land: task 1.5's branch feat/pay-1.5-both holds ${rounding.branch}, landed in a phase's stack off its chain — `
          + `merge that phase first with \`land phase pay 2\`, or cut the branch again from ${card.branch} without it, and land again`,
      };
    },
  },
  {
    name: 'a task built on another phase\'s stack short of its tip: merged back onto that tip',
    setup: (dir) => {
      const down = track(dir, '2.2', 'fix', 'Round down');
      commitFiles(dir, down.branch, rounding.branch, { 'down.txt': 'down\n' });
      ok(dir, openArgs(down));
      return {
        args: openArgs(currency),
        refusal: `land: task 3.1's branch ${currency.branch} does not descend from the chain's tip, fix/pay-2.2-round-down (${s(tip(dir, down.branch))}) — merge it back onto fix/pay-2.2-round-down first`,
        follow: (at) => mergeBack(at, currency.branch, down.branch),
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
      const down = track(dir, '2.2', 'fix', 'Round down');
      commitFiles(dir, down.branch, rounding.branch, { 'down.txt': 'down\n' });
      ok(dir, openArgs(down));
      const currencyDown = track(dir, '3.2', 'fix', 'Currency down');
      commitFiles(dir, currencyDown.branch, down.branch, { 'cd.txt': 'cd\n' });
      ok(dir, openArgs(currencyDown));
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
      git(dir, ['branch', '-D', PHASE_TWO]);
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + 'open it again with `land open pay 2.1`, merge it with `land phase pay 2`, and land again',
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on one whose branch and task\'s branch were both deleted unmerged: the task\'s branch made again where it opened, opened, and merged',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      const was = tip(dir, rounding.branch);
      git(dir, ['branch', '-D', PHASE_TWO, rounding.branch]);
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + `make it again with \`git branch ${rounding.branch} ${s(was)}\`, `
          + 'open it again with `land open pay 2.1`, merge it with `land phase pay 2`, and land again',
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on a task landed on the default branch by hand with no trailer: the task merged back, opened as a landing that changes nothing, and merged',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      git(dir, ['branch', '-D', PHASE_TWO]);
      git(dir, ['checkout', '-q', '-b', 'wip']);
      commitFiles(dir, 'main', 'main', rounding.files, { message: 'round the totals, by hand' });
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + 'open it again with `land open pay 2.1`, merge it with `land phase pay 2`, and land again',
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
    name: 'a phase stacked on a task its base phase merged without, a task above editing that task\'s file: the branch kept, the task taken off, and the conflict settled as the rebase stops',
    moves: 'feat/pay-phase-3',
    rewrites: true,
    setup: (dir) => {
      const down = track(dir, '2.2', 'fix', 'Round down');
      commitFiles(dir, down.branch, rounding.branch, { 'down.txt': 'down\n' });
      ok(dir, openArgs(down));
      const dropped = tip(dir, PHASE_TWO);
      const currencyDown = track(dir, '3.2', 'fix', 'Currency down');
      commitFiles(dir, currencyDown.branch, down.branch, { 'down.txt': 'down, in the currency\n' });
      ok(dir, openArgs(currencyDown));
      git(dir, ['update-ref', `refs/heads/${PHASE_TWO}`, `${dropped}^`]);
      ok(dir, ['land', 'phase', 'pay', '2']);
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: (held) => `land: phase 3 is built on task 2.2, which phase 2 merged into main without — ${way(dir, held, 'feat/pay-phase-3', offBelow(dir, 'feat/pay-phase-3', dropped))}`,
        follow: (at, refusal) => followRemedy(at, refusal, settleWith('feat/pay-phase-3', 'down.txt', 'down, in the currency\n')),
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['round.txt'], ['down.txt']]),
      };
    },
  },
  {
    name: 'a phase stacked on a task its base phase no longer lands, that phase standing with another: the task opened again on it, merged back first, and merged',
    setup: (dir) => {
      ok(dir, openArgs(currency));
      git(dir, ['branch', '-f', PHASE_TWO, 'main']);
      const down = track(dir, '2.2', 'fix', 'Round down');
      commitFiles(dir, down.branch, 'main', { 'down.txt': 'down\n' });
      ok(dir, openArgs(down));
      return {
        args: ['land', 'phase', 'pay', '3'],
        refusal: 'land: phase 3 is built on task 2.1, which main does not hold and no branch of phase 2 lands — '
          + 'open it again with `land open pay 2.1`, merge it with `land phase pay 2`, and land again',
        follow: (at, refusal) => {
          assert.match(refuses(at, openArgs(rounding)).error, /does not descend from the chain's tip, fix\/pay-2\.2-round-down .* — merge it back onto fix\/pay-2\.2-round-down first$/);
          mergeBack(at, rounding.branch, down.branch);
          followRemedy(at, refusal);
        },
        check: (at) => assert.deepStrictEqual(landedOn(at, 'main').map(({ paths }) => paths), [['down.txt'], ['round.txt'], ['currency.txt']]),
      };
    },
  },
  {
    name: 'a phase whose change conflicts with the default branch, which gained a file the phase lacks: the branch kept, brought up to date, and the conflict settled as the rebase stops',
    moves: 'feat/pay-phase-4',
    rewrites: true,
    setup: (dir) => {
      const word = track(dir, '4.1', 'fix', 'Word the card');
      commitFiles(dir, word.branch, 'main', { 'card.txt': 'a card\n' });
      ok(dir, openArgs(word));
      ok(dir, ['land', 'phase', 'pay', '1']);
      ok(dir, ['land', 'phase', 'pay', '2']);
      return {
        args: ['land', 'phase', 'pay', '4'],
        refusal: (held) => `land: task 4.1 conflicts with main at card.txt, so nothing moved — `
          + way(dir, held, 'feat/pay-phase-4', rebaseSteps(dir, 'feat/pay-phase-4', 'main', 'bring feat/pay-phase-4 up to date with main')),
        follow: (at, refusal) => followRemedy(at, refusal, settleWith('feat/pay-phase-4', 'card.txt', 'a card\n')),
        check: (at) => assert.strictEqual(git(at, ['show', 'main:card.txt']), 'a card\n'),
      };
    },
  },
];

/** Every row that stops a stack, by what its branch holds or what became of a branch. */
const STACK_ROWS = [...COMMIT_ROWS, ...BRANCH_ROWS];

const ROWS = [...STACK_ROWS, ...MERGE_ROWS];

/** Every row whose remedy moves or rewrites a branch. */
const MOVING = ROWS.filter(({ moves }) => moves !== undefined);

/** Every row whose remedy rewrites a branch in a worktree it makes. */
const REWRITING = ROWS.filter(({ rewrites }) => rewrites === true);

module.exports = { READY, STACK_ROWS, MERGE_ROWS, MOVING, REWRITING };
