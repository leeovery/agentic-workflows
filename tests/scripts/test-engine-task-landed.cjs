'use strict';

// ---------------------------------------------------------------------------
// What has landed, read in one repository (leeway-engine/scripts/domain/
// task-landed.cjs, `repoLanded`, 7.2.22). Where each task's last commit
// stands against the branch it lands on: held there, landed; laid on it,
// its change not there, not landed; laid on it and changing nothing there,
// landed, as merging it would change nothing; one whose branch holds the
// person's own commit alone, merged by hand, landed where its driver took
// it at that commit, never without it. A task landed by its change
// — a phase squashed under its `Task:` lines, or under the person's own
// message, no commit naming it — has landed, and stays landed once later
// work rewrites a line of it (R25); one named there only before its last
// commit, which the branch lacks, has not. It landed at the first commit
// on the branch past where its own was cut that holds its change, past one
// touching its paths without it, made in its commit's second or not, the
// person's duplicate work by hand there among them. However many tasks are read, a chain laid on the branch, a phase
// squashed there, or tasks not landed behind a branch that moved on past
// their paths, however many commits, costs the git commands one task does,
// never a read per task (12.14). A task's landing is the oldest
// commit on the branch's first-parent line holding its change: the merge
// commit bringing its last commit in, whatever names it later, the commit
// first naming it after it, or its own squash, never a commit changing
// nothing that names it — of two such commits naming a task whose change
// main held before its branch was cut, the first. A commit inside a task
// landed has landed where the task's last commit holds it, a later commit
// of the task rewriting its line; one amended away, its change not on the
// branch, has not. A commit of a task alone, rewritten by a later
// one of its own, has landed where a pull request the host merged holds
// it, never by its change; a task whose change a later task reverts on its
// branch, both in a pull request the host merged, landed at that pull
// request's squash, the first commit on main past where its branch was
// cut, never main's later work. Only content decides a landing (R28): a
// task of two commits, one alone cherry-picked onto main, its copy carrying
// the door's stamp, has not landed; both picked, it has; a task cut from
// another's branch, its own work alone squashed onto main as one commit, has
// landed, the task below it not. A task's last commit is
// its own work branch's where that stands — never one only another task's
// branch cut on it holds, nor, the branch holding none, one the reflog
// keeps. A task has landed where its branch's tip has (R29): squashed
// under the person's own message, main merged back into its branch a day
// on, landed, as its task; the person's own commit past that merge, not
// landed, the task taken at that merge changed after its landing; another
// task's branch merged in past the person's own commit there, landed, that
// commit the other task's work; and two or six tasks taken at the person's
// own commit past theirs, landed so, then changed by a commit of their own
// and the person's own past it, main moving on past each task's own file,
// none landed and each changed, cost the git commands two do. A task
// squashed by hand into the person's own commit beside work of theirs, then
// its last commit amended with no change, has landed at its tip — never its
// branch rewritten past its landing (F1). A commit standing for a task
// whole holds the person's own commit no branch holds as the task's work:
// that commit not on main, the task has not landed so.
// The person's own commit on a landed task's branch is that task's work,
// its tip the lowest holding it, wherever a later task's branch is cut
// there — at the same commit, or past it with a commit of its own — and
// has not landed (R31); inside a task's branch, below its last commit, it
// is the task's work too: a task whose commits were cherry-picked onto main
// but the person's own between them has not landed, every one picked it
// has, and one whose commit undoes the person's own below it, squashed, has
// landed, the change its work is laid on read below the person's own — so
// has that commit read alone, where one undoing another task's work below
// it, not landed, has not; a task read from its last commit takes for its
// work the commits that commit holds, never the person's own past it on its
// branch, its landing the copy of its commit alone. Each task's last commit
// is read once for every revision of a repository (`unitLanded`). A
// submodule's pointer read from a commit moves to the landing past that
// commit of the newest task whose work its commits are, as `repointing`
// reads it: a task's squash
// under the person's own message, a line of it rewritten since; never back to a
// landing the commit holds, a task's branch brought up to date with its
// squash, nor to an earlier task's landing where the newest has not landed,
// the pointer refused instead (7.2.21). A pointer the engine moves never
// moves back: a commit pointing it at a task's branch brought up to date
// with its squash leaves the default branch's pointer at that squash; a
// task's own pin, at a task not landed cut before the submodule's main moved
// on, lands as the task wrote it. A pointer at the person's own commit on
// a task's branch in the submodule, through `land phase` on each driver, is
// test-engine-landing-conformance-nested-owner.cjs's. A pointer at the
// person's own commit past a task's commit moves to its own copy, both
// cherry-picked onto main, never the task's, or it alone cherry-picked
// there after the task was fast-forwarded, still the task's work; that
// commit alone squashed, it stays. Whose work a commit is (R32): the
// person's own commit on main before a task's branch was cut, on its
// branch below its first commit, or on a later task's branch below that
// one's first, is no task's; between its commits, fast-forwarded onto
// main, and past its last, it is its; past two tasks' commits on one line,
// both tips holding it there, the lower tip's task's, the earlier task's
// where the tips are one; a landing on main naming its task by its `Task:`
// line, fast-forwarded into another task's branch past its first commit,
// its task's, never the other's. Landings by hand through the verbs, and the
// review's change of them, are the landing suites'
// (test-landing-by-hand-read.cjs, test-engine-land-local-by-hand.cjs,
// test-engine-commit-task-bugfix.cjs); that no read answers by when a
// commit was made, test-engine-task-landed-clock.cjs's. Git layer: seven
// worlds, each built once and copied for each test, each commit a second
// past the last but where a row reads one second (`together`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { createFile, datedAt } = require('./discovery-test-utils.cjs');
const { repoLanded, landedIn, unitLanded } = require('../../skills/leeway-engine/scripts/domain/task-landed.cjs');
const lg = require('../../skills/leeway-engine/scripts/domain/landing-git.cjs');
const { TRAILER } = require('../../skills/leeway-engine/scripts/domain/commit-task.cjs');

const { initRepo, traced, folderFrom, cleanupFixture } = harness;

const UNIT = 'pay';
const MAIN = 'refs/heads/main';
const PHASE = [1, 2, 3, 4, 5, 6];

/** The git commands that make a commit, each dated by the clock while a world's step keeps one. */
const COMMITTING = new Set(['commit', 'cherry-pick', 'merge', 'rebase']);

/**
 * The clock while a world's step runs (`from`, `together`): the second its
 * next commit is made in, and how far each commit moves it. Null outside a
 * step.
 * @type {{next: number, step: number}|null}
 */
let clock = null;

/** Git run at `dir`, a command making a commit dated by the clock where a step keeps one. @param {string} dir @param {string[]} args */
function git(dir, args) {
  const at = clock;
  if (at === null || !COMMITTING.has(args[0])) return harness.git(dir, args);
  const second = at.next;
  at.next += at.step;
  return datedAt(`${second} +0000`, () => harness.git(dir, args));
}

/** `act` run as a step of a world, its commits made from the second `date` names, `step` seconds apart. @param {string} date @param {number} step @param {() => void} act */
function stepping(date, step, act) {
  clock = { next: Date.parse(date) / 1000, step };
  try {
    act();
  } finally {
    clock = null;
  }
}

/** `act` run as a step of a world, each commit it makes a second past the last from `date`, as a person's come. @param {string} date @param {() => void} act */
const from = (date, act) => stepping(date, 1, act);

/** `act` run as a step of a world every commit of which is made in the second `date` names, as a row reading one second asks. @param {string} date @param {() => void} act */
const together = (date, act) => stepping(date, 0, act);

/** A commit stamped with task 1.`n`, through the door's trailer, holding `file` where one is given, else nothing. @param {string} dir @param {number} n @param {string} [file] */
function stamped(dir, n, file) {
  if (file !== undefined) {
    createFile(dir, file, `${file}\n`);
    git(dir, ['add', file]);
  }
  git(dir, ['commit', '-q', ...(file === undefined ? ['--allow-empty'] : []), '-m', `feat(pay): part ${n}`, '-m', `${TRAILER}: ${UNIT}-1-${n}`]);
}

/** A repository at `folder`/`name`, its first commit on main. @param {string} folder @param {string} [name] */
function based(folder, name = 'repo') {
  const dir = initRepo(path.join(folder, name));
  createFile(dir, 'README.md', 'pay\n');
  git(dir, ['add', 'README.md']);
  git(dir, ['commit', '-q', '-m', 'the base']);
  return dir;
}

/** The branch `branch` squashed onto main, which `dir` has out, under `message`'s paragraphs. @param {string} dir @param {string} branch @param {string[]} message */
function squashed(dir, branch, message) {
  git(dir, ['merge', '-q', '--squash', branch]);
  git(dir, ['commit', '-q', ...message.flatMap((paragraph) => ['-m', paragraph])]);
}

/**
 * main holding task 1.1, fast-forwarded there; tasks 1.2, 1.3 and 1.4
 * chained on main's tip, each adding a file; task 1.5 laid on main's tip
 * by one commit changing nothing.
 */
const laidWorld = folderFrom('engine-task-landed-laid-', (folder) => {
  const dir = based(folder);
  stamped(dir, 1, 'held.txt');
  git(dir, ['switch', '-q', '-c', 'chain']);
  [2, 3, 4].forEach((n) => stamped(dir, n, `part-${n}.txt`));
  git(dir, ['switch', '-q', '-c', 'nothing', 'main']);
  stamped(dir, 5);
  git(dir, ['switch', '-q', 'main']);
});

/**
 * Tasks 1.1 to 1.6 chained on a branch, the phase squashed onto main a day
 * later under their `Task:` lines; then task 1.7 squashed under the
 * person's own message; then task 1.8 squashed under its `Task:` line, and
 * a later commit of it the branch it is on holds alone.
 */
const squashedWorld = folderFrom('engine-task-landed-squashed-', (folder) => {
  const dir = based(folder);
  git(dir, ['switch', '-q', '-c', 'phase']);
  from('2026-01-01T00:00:00Z', () => PHASE.forEach((n) => stamped(dir, n, `part-${n}.txt`)));
  git(dir, ['switch', '-q', 'main']);
  from('2026-01-02T00:00:00Z', () => squashed(dir, 'phase', ['feat(pay): the phase', PHASE.map((n) => `Task: ${UNIT}-1-${n}`).join('\n')]));
  git(dir, ['switch', '-q', '-c', 'own']);
  from('2026-01-03T00:00:00Z', () => stamped(dir, 7, 'own.txt'));
  git(dir, ['switch', '-q', 'main']);
  from('2026-01-04T00:00:00Z', () => squashed(dir, 'own', ['In my own words']));
  git(dir, ['switch', '-q', '-c', 'again']);
  from('2026-01-05T00:00:00Z', () => stamped(dir, 8, 'again.txt'));
  git(dir, ['switch', '-q', 'main']);
  from('2026-01-06T00:00:00Z', () => squashed(dir, 'again', ['fix(pay): again', `Task: ${UNIT}-1-8`]));
  git(dir, ['switch', '-q', 'again']);
  from('2026-01-07T00:00:00Z', () => stamped(dir, 8, 'again-later.txt'));
  git(dir, ['switch', '-q', 'main']);
});

/** A commit on what `dir` has out, under `message`'s paragraphs, writing `files`, else nothing. @param {string} dir @param {string[]} message @param {Record<string, string>} [files] */
function committed(dir, message, files = {}) {
  for (const [file, text] of Object.entries(files)) createFile(dir, file, text);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--allow-empty', ...message.flatMap((paragraph) => ['-m', paragraph])]);
}

/** A stamp of task 1.`n`'s, as the door's trailer. @param {number} n */
const stampOf = (n) => `${TRAILER}: ${UNIT}-1-${n}`;

/** A file of `count` lines, each `line {n}` but those `edits` writes. @param {number} count @param {Record<number, string>} edits */
const lines = (count, edits) => `${Array.from({ length: count }, (_, at) => edits[at] ?? `line ${at}`).join('\n')}\n`;

/**
 * Each task landed by hand on main, a day apart: 1.1, of two commits, the
 * second rewriting a line the first wrote, squashed under the person's own
 * message, then a line of it rewritten on main; 1.2 merged by a merge
 * commit, then a commit changing nothing naming it, as the local driver's
 * replay lands one; 1.3 squashed under its `Task:` line, then a later
 * commit naming it again; 1.4 squashed under the person's own message, then
 * a commit changing nothing naming it; 1.5, of two commits, the second the
 * person's own rewriting the first's line, squashed under the person's own
 * message; 1.6, no commit of its stamped, named by its `Task:` line on
 * main, then again on a side line merged back, all in one second; 1.7 and
 * 1.8, cut together, each writing its own line of one file, squashed in
 * turn under the person's own messages, so 1.7's squash touches 1.8's paths
 * first without its change; 1.9 squashed under the person's own message in
 * the second its commit was made; 1.10, its change made on main by hand
 * past where its own branch was cut, the day before its own commit made it
 * again, duplicate work; 1.11, cut on 1.1's branch, not landed; 1.1's
 * branch, on a branch of its own, brought up to date with its squash; 1.12,
 * its change made on main by hand before its branch was cut, then named on
 * main by two commits changing nothing, a day apart; 1.13, its first
 * commit amended away on a branch of its own, its commit made again
 * squashed under the person's own message; and 1.14, its change reverted
 * by 1.15 on its branch, both squashed onto main changing nothing, as a
 * host lands a pull request, main moving on.
 */
const byHandWorld = folderFrom('engine-task-landed-by-hand-', (folder) => {
  const dir = based(folder);
  const dayOf = (/** @type {number} */ n) => new Date(Date.UTC(2026, 1, n)).toISOString();
  const day = (/** @type {number} */ n, /** @type {() => void} */ act) => from(dayOf(n), act);
  const cut = (/** @type {string} */ branch, /** @type {() => void} */ act) => {
    git(dir, ['switch', '-q', '-c', branch, 'main']);
    act();
    git(dir, ['switch', '-q', 'main']);
  };
  day(1, () => cut('one', () => {
    committed(dir, ['feat(pay): the lines', stampOf(1)], { 'lines.txt': 'one\ntwo\nthree\n' });
    committed(dir, ['feat(pay): shout two', stampOf(1)], { 'lines.txt': 'one\nTWO\nthree\n' });
  }));
  day(2, () => squashed(dir, 'one', ['In my own words, one']));
  day(3, () => committed(dir, ['later work'], { 'lines.txt': 'one\nTwo!\nthree\n' }));
  day(4, () => cut('two', () => committed(dir, ['feat(pay): two', stampOf(2)], { 'two.txt': 'two\n' })));
  day(5, () => git(dir, ['merge', '-q', '--no-ff', '-m', 'Merge two', 'two']));
  day(6, () => committed(dir, ['feat(pay): Two', `Task: ${UNIT}-1-2`], { 'two.txt': 'two, named\n' }));
  day(7, () => cut('three', () => committed(dir, ['feat(pay): three', stampOf(3)], { 'three.txt': 'three\n' })));
  day(8, () => squashed(dir, 'three', ['feat(pay): Three', `Task: ${UNIT}-1-3`]));
  day(9, () => committed(dir, ['chore(pay): three again', `Task: ${UNIT}-1-3`], { 'three.txt': 'three, again\n' }));
  day(10, () => cut('four', () => committed(dir, ['feat(pay): four', stampOf(4)], { 'four.txt': 'four\n' })));
  day(11, () => squashed(dir, 'four', ['In my own words, four']));
  day(12, () => committed(dir, ['feat(pay): Four', `Task: ${UNIT}-1-4`]));
  day(13, () => cut('five', () => {
    committed(dir, ['feat(pay): five', stampOf(5)], { 'five.txt': 'five\n' });
    committed(dir, ['my own words on five'], { 'five.txt': 'five, mine\n' });
  }));
  day(14, () => squashed(dir, 'five', ['In my own words, five']));
  together(dayOf(15), () => {
    committed(dir, ['feat(pay): Six', `Task: ${UNIT}-1-6`], { 'six.txt': 'six\n' });
    cut('six-again', () => {
      committed(dir, ['fix(pay): six again', `Task: ${UNIT}-1-6`], { 'six.txt': 'six, again\n' });
      committed(dir, ['more on the side'], { 'side.txt': 'side\n' });
    });
    committed(dir, ['main moves on'], { 'main.txt': 'main\n' });
    git(dir, ['merge', '-q', '--no-ff', '-m', 'Merge six again', 'six-again']);
  });
  day(16, () => committed(dir, ['the shared lines'], { 'shared.txt': lines(10, {}) }));
  day(17, () => [[7, 1], [8, 8]].forEach(([n, line]) => cut(`part-${n}`, () => committed(dir, [`feat(pay): part ${n}`, stampOf(n)], { 'shared.txt': lines(10, { [line]: `part ${n}` }), [`part-${n}.txt`]: `${n}\n` }))));
  day(18, () => squashed(dir, 'part-7', ['In my own words, seven']));
  day(19, () => squashed(dir, 'part-8', ['In my own words, eight']));
  together(dayOf(20), () => {
    cut('nine', () => committed(dir, ['feat(pay): nine', stampOf(9)], { 'nine.txt': 'nine\n' }));
    squashed(dir, 'nine', ['In my own words, nine']);
  });
  day(21, () => committed(dir, ['ten, by hand'], { 'ten.txt': 'ten\n' }));
  git(dir, ['switch', '-q', '-c', 'ten', 'main~1']);
  day(22, () => committed(dir, ['feat(pay): ten', stampOf(10)], { 'ten.txt': 'ten\n' }));
  git(dir, ['switch', '-q', '-c', 'eleven', 'one']);
  day(23, () => committed(dir, ['feat(pay): eleven', stampOf(11)], { 'eleven.txt': 'eleven\n' }));
  git(dir, ['switch', '-q', '-c', 'one-updated', 'one']);
  day(24, () => git(dir, ['merge', '-q', '--no-ff', '-m', 'Merge the squash of one', ':/In my own words, one']));
  git(dir, ['switch', '-q', 'main']);
  day(25, () => committed(dir, ['twelve, by hand'], { 'twelve.txt': 'twelve\n' }));
  git(dir, ['switch', '-q', '-c', 'twelve', 'main']);
  day(26, () => committed(dir, ['feat(pay): twelve', stampOf(12)], { 'twelve.txt': 'twelve\n' }));
  git(dir, ['switch', '-q', 'main']);
  day(27, () => committed(dir, ['feat(pay): Twelve', `Task: ${UNIT}-1-12`]));
  day(28, () => committed(dir, ['chore(pay): twelve again', `Task: ${UNIT}-1-12`]));
  day(29, () => cut('thirteen-amended', () => committed(dir, ['feat(pay): thirteen', stampOf(13)], { 'thirteen.txt': 'thirteen, at first\n' })));
  day(30, () => cut('thirteen', () => committed(dir, ['feat(pay): thirteen', stampOf(13)], { 'thirteen.txt': 'thirteen\n' })));
  day(31, () => squashed(dir, 'thirteen', ['In my own words, thirteen']));
  day(32, () => cut('fourteen', () => {
    committed(dir, ['feat(pay): fourteen', stampOf(14)], { 'fourteen.txt': 'fourteen\n' });
    fs.rmSync(path.join(dir, 'fourteen.txt'));
    committed(dir, ['fix(pay): put fourteen back', stampOf(15)]);
  }));
  day(33, () => committed(dir, ['In my own words, fourteen']));
  day(34, () => committed(dir, ['after fourteen'], { 'after.txt': 'after\n' }));
});

/** The pending world's repositories, each by its name: how many tasks it holds, and how many commits main moved on by since. */
const PENDING = Object.freeze({ 'two-tasks': [2, 4], 'six-tasks': [6, 4], 'twelve-tasks': [12, 4], 'twelve-tasks-eight-moves': [12, 8] });

/**
 * One repository for each of `PENDING`: its tasks, from 1.1, each cut from
 * main a day after its lines and writing its own line of them, none
 * landed; main moved on since, a day a commit, each writing a line of them
 * none of the tasks does.
 */
const pendingWorld = folderFrom('engine-task-landed-pending-', (folder) => {
  for (const [name, [tasks, moves]] of Object.entries(PENDING)) {
    const dir = based(folder, name);
    from('2026-03-01T00:00:00Z', () => committed(dir, ['the lines'], { 'lines.txt': lines(40, {}) }));
    from('2026-03-02T00:00:00Z', () => {
      for (let n = 1; n <= tasks; n += 1) {
        git(dir, ['switch', '-q', '-c', `pending-${n}`, 'main']);
        committed(dir, [`feat(pay): part ${n}`, stampOf(n)], { 'lines.txt': lines(40, { [n]: `part ${n}` }) });
        git(dir, ['switch', '-q', 'main']);
      }
    });
    for (let at = 0; at < moves; at += 1) from(`2026-03-${String(at + 3).padStart(2, '0')}T00:00:00Z`, () => committed(dir, [`main moves on, ${at + 1}`], { 'lines.txt': lines(40, { [20 + at]: 'main' }) }));
  }
});

/** The work world's repositories, each by its name: how task 1.1, of two commits, reached main a day after them — its commits cherry-picked by hand. */
const PICKED = Object.freeze({ 'first-picked': ['1'], 'last-picked': ['0'], 'both-picked': ['1', '0'] });

/**
 * Tasks on their own work branches, each repository a day: for each of
 * `PICKED`, task 1.1's two commits, each adding its own file, those it
 * names cherry-picked onto main by hand; in `owns`, task 1.1 of two
 * commits, task 1.2 cut on its second, then 1.1's branch taken back to its
 * first and merged onto main; in `owned`, task 1.1's one commit dropped
 * from its branch, put back on main, the reflog keeping it.
 */
const workWorld = folderFrom('engine-task-landed-work-', (folder) => {
  const ab = 'feat/pay-1.1-add-ab';
  for (const [name, picks] of Object.entries(PICKED)) {
    const dir = based(folder, name);
    from('2026-04-01T00:00:00Z', () => {
      git(dir, ['switch', '-q', '-c', ab]);
      committed(dir, ['feat(pay): add a', stampOf(1)], { 'a.txt': 'a\n' });
      committed(dir, ['feat(pay): add b', stampOf(1)], { 'b.txt': 'b\n' });
      git(dir, ['switch', '-q', 'main']);
    });
    from('2026-04-02T00:00:00Z', () => picks.forEach((back) => git(dir, ['cherry-pick', `${ab}~${back}`])));
  }
  const owns = based(folder, 'owns');
  from('2026-04-03T00:00:00Z', () => {
    git(owns, ['switch', '-q', '-c', 'feat/pay-1.1-add-tip']);
    committed(owns, ['feat(pay): add the tip', stampOf(1)], { 'tip.txt': 'tip\n' });
    committed(owns, ['feat(pay): a wrong turn', stampOf(1)], { 'tip.txt': 'tip, a wrong turn\n' });
    git(owns, ['switch', '-q', '-c', 'feat/pay-1.2-add-note']);
    committed(owns, ['feat(pay): add the note', stampOf(2)], { 'note.txt': 'note\n' });
    git(owns, ['switch', '-q', 'main']);
    git(owns, ['branch', '-f', 'feat/pay-1.1-add-tip', 'feat/pay-1.1-add-tip~1']);
    git(owns, ['merge', '-q', '--ff-only', 'feat/pay-1.1-add-tip']);
  });
  const owned = based(folder, 'owned');
  from('2026-04-04T00:00:00Z', () => {
    git(owned, ['switch', '-q', '-c', 'feat/pay-1.1-add-tip']);
    committed(owned, ['feat(pay): add the tip', stampOf(1)], { 'tip.txt': 'tip\n' });
    git(owned, ['switch', '-q', 'main']);
    git(owned, ['branch', '-f', 'feat/pay-1.1-add-tip', 'main']);
  });
});

/** The tips world's repositories, each by its name: how many tasks it holds. */
const TIPS = Object.freeze({ 'two-tips': 2, 'six-tips': 6 });

/** Task 1.`n`'s branch, named as the engine names a task's. @param {number} n */
const branchOf = (n) => `feat/pay-1.${n}-part-${n}`;

/**
 * Tasks on branches named as the engine names a task's, a day a step: for
 * each of `TIPS`, its tasks, from 1.1, each cut from main, the person's own
 * commit made past its own — where the driver took it — and squashed onto
 * main in turn under the person's own message; then a commit of its own
 * made on each branch, and the person's own past that, and main moved on
 * writing each task's file of that commit its own way; in `merged-back`,
 * tasks 1.1 and 1.2 squashed so, main moved on and, the next day, merged
 * back into each branch, then the person's own commit made on 1.2's, and
 * main moved on again past both; in `aside`, tasks 1.1 and 1.4 squashed
 * so, the person's own commit then made on 1.1's branch, tasks 1.2 and 1.3
 * cut there, 1.3 then making a commit of its own, and 1.1's branch merged
 * into 1.4's; in `apart`, task 1.1's commit, the person's own made past
 * it on its branch, then its commit alone squashed so, and its branch
 * taken back to its commit — the person's own kept by a tag alone; in
 * `own-work`, tasks 1.1 and 1.2 each of its commit, the person's own and
 * its commit again, cherry-picked onto main the next day — 1.1's but the
 * person's own, 1.2's every one; tasks 1.3 and 1.6 each of the person's
 * own commit writing a scratch file and its commit removing it, squashed
 * so, 1.6 then making a commit more, left out of its squash; task 1.5's
 * commit removing the scratch file task 1.4's wrote below it, on a branch
 * not a task's, neither landed; and task 1.8 cut from 1.7's branch past
 * the person's own commit there, its commit, then the person's own on top,
 * its commit alone cherry-picked onto main; and task 1.10 cut from 1.9's
 * branch past the person's own commit there writing a scratch file, its
 * commit removing it — 1.9's commit alone cherry-picked onto main, 1.10's
 * branch squashed there.
 */
const tipsWorld = folderFrom('engine-task-landed-tips-', (folder) => {
  /** On each of tasks 1.`ns`' branches, a commit under `message`'s paragraphs writing `{file}-{n}.txt`. @param {string} dir @param {number[]} ns @param {(n: number) => string[]} message @param {string} file */
  const onEach = (dir, ns, message, file) => ns.forEach((n) => {
    git(dir, ['switch', '-q', branchOf(n)]);
    committed(dir, message(n), { [`${file}-${n}.txt`]: `${n}\n` });
    git(dir, ['switch', '-q', 'main']);
  });
  /** @param {string} dir @param {number[]} ns @param {boolean} tidied */
  const squashedOwn = (dir, ns, tidied) => {
    from('2026-05-01T00:00:00Z', () => {
      ns.forEach((n) => git(dir, ['branch', branchOf(n), 'main']));
      onEach(dir, ns, (n) => [`feat(pay): part ${n}`, stampOf(n)], 'part');
      if (tidied) onEach(dir, ns, () => ['my own tidying'], 'tidy');
    });
    from('2026-05-02T00:00:00Z', () => ns.forEach((n) => squashed(dir, branchOf(n), [`In my own words, ${n}`])));
  };
  for (const [name, tasks] of Object.entries(TIPS)) {
    const dir = based(folder, name);
    const ns = Array.from({ length: tasks }, (_, at) => at + 1);
    squashedOwn(dir, ns, true);
    from('2026-05-04T00:00:00Z', () => onEach(dir, ns, (n) => [`feat(pay): more on part ${n}`, stampOf(n)], 'more'));
    from('2026-05-05T00:00:00Z', () => onEach(dir, ns, () => ['my own words on top'], 'own'));
    from('2026-05-06T00:00:00Z', () => committed(dir, ['main moves on'], Object.fromEntries(ns.map((n) => [`own-${n}.txt`, `${n}, main's way\n`]))));
  }
  const dir = based(folder, 'merged-back');
  squashedOwn(dir, [1, 2], false);
  from('2026-05-03T00:00:00Z', () => committed(dir, ['main moves on'], { 'main.txt': 'main\n' }));
  from('2026-05-04T00:00:00Z', () => [1, 2].forEach((n) => {
    git(dir, ['switch', '-q', branchOf(n)]);
    git(dir, ['merge', '-q', '--no-ff', '-m', 'Merge main back', 'main']);
    git(dir, ['switch', '-q', 'main']);
  }));
  from('2026-05-05T00:00:00Z', () => onEach(dir, [2], () => ['my own words on top'], 'own'));
  from('2026-05-06T00:00:00Z', () => committed(dir, ['main moves on again'], { 'later.txt': 'later\n' }));
  const aside = based(folder, 'aside');
  squashedOwn(aside, [1, 4], false);
  from('2026-05-03T00:00:00Z', () => {
    onEach(aside, [1], () => ['my own words on top'], 'own');
    [2, 3].forEach((n) => git(aside, ['branch', branchOf(n), branchOf(1)]));
  });
  from('2026-05-04T00:00:00Z', () => {
    onEach(aside, [3], (n) => [`feat(pay): part ${n}`, stampOf(n)], 'part');
    git(aside, ['switch', '-q', branchOf(4)]);
    git(aside, ['merge', '-q', '--no-ff', '-m', 'Merge 1.1 in', branchOf(1)]);
    git(aside, ['switch', '-q', 'main']);
  });
  const apart = based(folder, 'apart');
  from('2026-05-01T00:00:00Z', () => {
    git(apart, ['branch', branchOf(1), 'main']);
    onEach(apart, [1], (n) => [`feat(pay): part ${n}`, stampOf(n)], 'part');
  });
  from('2026-05-02T00:00:00Z', () => onEach(apart, [1], () => ['my own words on top'], 'own'));
  from('2026-05-03T00:00:00Z', () => squashed(apart, `${branchOf(1)}~1`, ['In my own words, 1']));
  git(apart, ['tag', 'taken', branchOf(1)]);
  git(apart, ['branch', '-f', branchOf(1), `${branchOf(1)}~1`]);
  const work = based(folder, 'own-work');
  /** `branch` cut from `base`: a commit under `first` writing `scratch-{n}.txt`, then task 1.`n`'s removing it and writing `files`. @param {string} branch @param {string} base @param {string[]} first @param {number} n @param {Record<string, string>} files */
  const undone = (branch, base, first, n, files) => {
    git(work, ['switch', '-q', '-c', branch, base]);
    committed(work, first, { [`scratch-${n}.txt`]: 'scratch\n' });
    git(work, ['rm', '-q', `scratch-${n}.txt`]);
    committed(work, [`feat(pay): part ${n}`, stampOf(n)], files);
    git(work, ['switch', '-q', 'main']);
  };
  from('2026-05-01T00:00:00Z', () => {
    [1, 2, 7].forEach((n) => git(work, ['branch', branchOf(n), 'main']));
    onEach(work, [1, 2], (n) => [`feat(pay): part ${n}`, stampOf(n)], 'part');
    onEach(work, [1, 2, 7], () => ['my own words between'], 'own');
    onEach(work, [1, 2], (n) => [`feat(pay): more on part ${n}`, stampOf(n)], 'more');
    [3, 6].forEach((n) => undone(branchOf(n), 'main', ['my own scratch'], n, { [`part-${n}.txt`]: `${n}\n` }));
    onEach(work, [6], (n) => [`feat(pay): more on part ${n}`, stampOf(n)], 'more');
    undone('undo', 'main', ['feat(pay): part 4', stampOf(4)], 5, {});
    git(work, ['branch', branchOf(9), 'main']);
    onEach(work, [9], (n) => [`feat(pay): part ${n}`, stampOf(n)], 'part');
    undone(branchOf(10), branchOf(9), ['my own scratch'], 10, { 'part-10.txt': '10\n' });
    git(work, ['branch', '-f', branchOf(9), `${branchOf(10)}~1`]);
    git(work, ['branch', branchOf(8), branchOf(7)]);
    onEach(work, [8], (n) => [`feat(pay): part ${n}`, stampOf(n)], 'part');
    onEach(work, [8], () => ['my own words on top'], 'own');
  });
  from('2026-05-02T00:00:00Z', () => {
    for (const back of [2, 0]) git(work, ['cherry-pick', `${branchOf(1)}~${back}`]);
    for (const back of [2, 1, 0]) git(work, ['cherry-pick', `${branchOf(2)}~${back}`]);
    squashed(work, branchOf(3), ['In my own words, 3']);
    squashed(work, `${branchOf(6)}~1`, ['In my own words, 6']);
    git(work, ['cherry-pick', `${branchOf(9)}~1`]);
    squashed(work, branchOf(10), ['In my own words, 10']);
    git(work, ['cherry-pick', `${branchOf(8)}~1`]);
  });
});

/**
 * The person's own commits beside task 1.1's, a day a step: in `forwarded`,
 * one on main, then 1.1's branch cut there, one on it before its commit
 * and one after, main fast-forwarded to it, then 1.1's commit again and the
 * person's own past it, and 1.2 cut from that, the person's own before its
 * commit; in `copied`, `squashed` and `picked`, 1.1's commit and the
 * person's own past it — both cherry-picked onto main by hand, as a rebase
 * lays them; 1.1's commit alone squashed under the person's own message,
 * the person's own past it not landed again; or 1.1's commit fast-forwarded
 * onto main, then the person's own cherry-picked there alone; in `shared`,
 * 1.1's commit, 1.2 cut from it, its commit and the person's own past it,
 * 1.1's branch brought up to that, then 1.2's commit again; in `named`,
 * 1.1's commit fast-forwarded onto main, then a squash there naming task
 * 1.2 by its `Task:` line and the person's own hotfix, main then
 * fast-forwarded into 1.1's branch.
 */
const besideWorld = folderFrom('engine-task-landed-beside-', (folder) => {
  const dir = based(folder, 'forwarded');
  from('2026-06-01T00:00:00Z', () => {
    committed(dir, ['my own hotfix'], { 'hotfix.txt': 'hotfix\n' });
    git(dir, ['switch', '-q', '-c', branchOf(1)]);
    committed(dir, ['my own start'], { 'start.txt': 'start\n' });
    committed(dir, ['feat(pay): part 1', stampOf(1)], { 'part-1.txt': '1\n' });
    committed(dir, ['my own words between'], { 'between.txt': 'between\n' });
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['merge', '-q', '--ff-only', branchOf(1)]);
    git(dir, ['switch', '-q', branchOf(1)]);
    committed(dir, ['feat(pay): more on part 1', stampOf(1)], { 'more-1.txt': '1\n' });
    committed(dir, ['my own words past it'], { 'past.txt': 'past\n' });
    git(dir, ['switch', '-q', '-c', branchOf(2)]);
    committed(dir, ['my own words before its first'], { 'before.txt': 'before\n' });
    committed(dir, ['feat(pay): part 2', stampOf(2)], { 'part-2.txt': '2\n' });
    git(dir, ['switch', '-q', 'main']);
  });
  for (const name of ['copied', 'squashed', 'picked']) {
    const at = based(folder, name);
    from('2026-06-01T00:00:00Z', () => {
      git(at, ['switch', '-q', '-c', branchOf(1)]);
      committed(at, ['feat(pay): part 1', stampOf(1)], { 'part-1.txt': '1\n' });
      committed(at, ['my own words past it'], { 'past.txt': 'past\n' });
      git(at, ['switch', '-q', 'main']);
    });
    from('2026-06-02T00:00:00Z', () => {
      if (name === 'copied') git(at, ['cherry-pick', `main..${branchOf(1)}`]);
      else if (name === 'squashed') squashed(at, `${branchOf(1)}~1`, ['In my own words, 1']);
      else {
        git(at, ['merge', '-q', '--ff-only', `${branchOf(1)}~1`]);
        git(at, ['cherry-pick', branchOf(1)]);
      }
    });
  }
  const named = based(folder, 'named');
  from('2026-06-03T00:00:00Z', () => {
    git(named, ['switch', '-q', '-c', branchOf(1)]);
    committed(named, ['feat(pay): part 1', stampOf(1)], { 'part-1.txt': '1\n' });
    git(named, ['switch', '-q', 'main']);
    git(named, ['merge', '-q', '--ff-only', branchOf(1)]);
    committed(named, ['feat(pay): Part 2', `Task: ${UNIT}-1-2`], { 'part-2.txt': '2\n' });
    committed(named, ['my own hotfix'], { 'hotfix.txt': 'hotfix\n' });
    git(named, ['switch', '-q', branchOf(1)]);
    git(named, ['merge', '-q', '--ff-only', 'main']);
    git(named, ['switch', '-q', 'main']);
  });
  const shared = based(folder, 'shared');
  from('2026-06-01T00:00:00Z', () => {
    git(shared, ['switch', '-q', '-c', branchOf(1)]);
    committed(shared, ['feat(pay): part 1', stampOf(1)], { 'part-1.txt': '1\n' });
    git(shared, ['switch', '-q', '-c', branchOf(2)]);
    committed(shared, ['feat(pay): part 2', stampOf(2)], { 'part-2.txt': '2\n' });
    committed(shared, ['my own words past both'], { 'past.txt': 'past\n' });
    git(shared, ['branch', '-f', branchOf(1), branchOf(2)]);
    committed(shared, ['feat(pay): more on part 2', stampOf(2)], { 'more-2.txt': '2\n' });
    git(shared, ['switch', '-q', 'main']);
  });
});

/** @type {string[]} */
let made = [];
afterEach(() => {
  made.forEach(cleanupFixture);
  made = [];
});

/** A copy of a world: its repository named `name`. @param {(dir: string) => string} world @param {string} [name] */
function repo(world, name = 'repo') {
  const folder = world(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-task-landed-')));
  made.push(folder);
  return path.join(folder, name);
}

/** Whether each of tasks 1.`ns` has landed on main, read in one read, and the git commands the read ran. @param {string} dir @param {number[]} ns */
function landed(dir, ns) {
  const { result, commands } = traced(() => {
    const read = repoLanded(dir, UNIT, MAIN, { since: null });
    return ns.map((n) => read.task({ unit: UNIT, phase: 1, n }).landed);
  });
  return { landed: result, commands: commands.length };
}

describe('repoLanded: where each task\'s last commit stands against the branch it lands on (7.2.22, 12.14)', () => {
  it('a task main holds has landed; a task laid on main, its change not there, has not; one laid on main changing nothing there has, as merging it would change nothing', () => {
    assert.deepStrictEqual(landed(repo(laidWorld), [1, 2, 4, 5]).landed, [true, false, false, true]);
  });

  it('reading a chain of three tasks laid on main runs the git commands reading one does', () => {
    const dir = repo(laidWorld);

    assert.strictEqual(landed(dir, [2, 3, 4]).commands, landed(dir, [4]).commands);
  });

  it('a task whose branch holds the person\'s own commit alone, merged onto main by hand by a merge commit: landed at that merge where its driver took it at that commit, its landing point that commit alone; with no commit its driver took, never landed', () => {
    const dir = repo(laidWorld);
    const branch = 'feat/pay-1.6-six';
    git(dir, ['switch', '-q', '-c', branch]);
    createFile(dir, 'six.txt', 'six\n');
    git(dir, ['add', 'six.txt']);
    git(dir, ['commit', '-q', '-m', 'add six']);
    const took = git(dir, ['rev-parse', 'HEAD']).trim();
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['merge', '-q', '--no-ff', '-m', `Merge ${branch}`, branch]);
    const ref = { unit: UNIT, phase: 1, n: 6 };
    const taken = () => new Map([[`${UNIT}-1-6`, took]]);
    const read = repoLanded(dir, UNIT, MAIN, { since: null, taken });

    assert.deepStrictEqual([read.stands(ref), read.earlier(ref, taken), repoLanded(dir, UNIT, MAIN, { since: null }).stands(ref)], ['landed', git(dir, ['rev-parse', 'main']).trim(), 'unlanded']);
  });
});

describe('repoLanded: the commits on the branch it lands on naming a task (7.2.22, 12.14)', () => {
  it('a phase squashed under its tasks\' Task: lines has landed, each task; one squashed under the person\'s own message has, by its change; one named there only before its last commit, which main lacks, has not', () => {
    assert.deepStrictEqual(landed(repo(squashedWorld), [...PHASE, 7, 8]).landed, [...PHASE.map(() => true), true, false]);
  });

  it('reading a phase of six tasks squashed under their Task: lines runs the git commands reading one, or three, does', () => {
    const dir = repo(squashedWorld);
    const counts = [[1], [1, 2, 3], PHASE].map((ns) => landed(dir, ns).commands);

    assert.deepStrictEqual(counts, counts.map(() => counts[0]));
  });
});

describe('repoLanded: tasks not landed behind a branch that moved on, touching their paths (7.2.22, R25, 12.14)', () => {
  it('none has landed, and reading two, six and twelve, main moved on past them by four commits, or twelve by eight, runs the same git commands', () => {
    const reads = Object.entries(PENDING).map(([name, [tasks]]) => landed(repo(pendingWorld, name), Array.from({ length: tasks }, (_, at) => at + 1)));

    assert.deepStrictEqual(reads, reads.map(({ landed: each }) => ({ landed: each.map(() => false), commands: reads[0].commands })));
  });
});

describe('repoLanded: a task landed by hand, and its landing (7.2.22, R25)', () => {
  it('a task landed stays landed, a line of it rewritten later; each landing the oldest commit on main holding its change — the merge commit bringing it in, not a later commit naming it, the commit first naming it, never one naming it again, and the person\'s own squash over a commit changing nothing that names it', () => {
    const dir = repo(byHandWorld);
    const read = repoLanded(dir, UNIT, MAIN, { since: null });
    const subject = (/** @type {string|null} */ sha) => (sha === null ? null : git(dir, ['log', '-1', '--format=%s', sha]).trim());
    const refs = [1, 2, 3, 4].map((n) => ({ unit: UNIT, phase: 1, n }));

    assert.deepStrictEqual(refs.map((ref) => [read.task(ref).landed, subject(read.landing(ref))]), [
      [true, 'In my own words, one'], [true, 'Merge two'], [true, 'feat(pay): Three'], [true, 'In my own words, four'],
    ]);
  });

  it('a commit alone whose line a later commit squashed with it rewrote has landed where a pull request the host merged holds it, and not by its change', () => {
    const dir = repo(byHandWorld);
    const [first, head] = ['five~1', 'five'].map((rev) => git(dir, ['rev-parse', rev]).trim());
    const landedWith = (/** @type {string[]} */ merged) => repoLanded(dir, UNIT, MAIN, { since: null, merged: () => merged }).landedCommit(first, `${UNIT}-1-5`);

    assert.deepStrictEqual([landedWith([head]), landedWith([])], [true, false]);
  });

  it('a task whose change a later task reverts on its branch, a pull request the host merged holding both: landed at its squash changing nothing, the first commit on main past where its branch was cut, never main\'s later work; no pull request holding it, not landed', () => {
    const dir = repo(byHandWorld);
    const head = git(dir, ['rev-parse', 'fourteen']).trim();
    const read = (/** @type {string[]} */ merged) => {
      const landed = repoLanded(dir, UNIT, MAIN, { since: null, merged: () => merged });
      const ref = { unit: UNIT, phase: 1, n: 14 };
      const landing = landed.landing(ref);
      return [landed.task(ref).landed, landing === null ? null : git(dir, ['log', '-1', '--format=%s', landing]).trim()];
    };

    assert.deepStrictEqual([read([head]), read([])], [[true, 'In my own words, fourteen'], [false, null]]);
  });

  it('a task landed by its change at the first commit on main past where its branch was cut that holds it — past one touching its paths without it, one made in its commit\'s second, and the person\'s duplicate work by hand there the day before its commit', () => {
    const dir = repo(byHandWorld);
    const read = repoLanded(dir, UNIT, MAIN, { since: null });
    const subject = (/** @type {string|null} */ sha) => (sha === null ? null : git(dir, ['log', '-1', '--format=%s', sha]).trim());
    const refs = [7, 8, 9, 10].map((n) => ({ unit: UNIT, phase: 1, n }));

    assert.deepStrictEqual(refs.map((ref) => [read.task(ref).landed, subject(read.landing(ref))]), [
      [true, 'In my own words, seven'], [true, 'In my own words, eight'], [true, 'In my own words, nine'], [true, 'ten, by hand'],
    ]);
  });

  it('a task whose change main held before its branch was cut, named on main twice since by commits changing nothing: landed at the commit first naming it, never the later one', () => {
    const dir = repo(byHandWorld);
    const landing = repoLanded(dir, UNIT, MAIN, { since: null }).landing({ unit: UNIT, phase: 1, n: 12 });

    assert.deepStrictEqual(landing === null ? null : git(dir, ['log', '-1', '--format=%s', landing]).trim(), 'feat(pay): Twelve');
  });

  it('a commit inside a task landed: one its last commit holds has landed, its line rewritten by the task\'s later commit and on main since; one its last commit does not hold, amended away, its change not on main, has not', () => {
    const dir = repo(byHandWorld);
    const read = repoLanded(dir, UNIT, MAIN, { since: null });
    const inside = (/** @type {string} */ rev, /** @type {number} */ n) => read.landedCommit(git(dir, ['rev-parse', rev]).trim(), `${UNIT}-1-${n}`);

    assert.deepStrictEqual([inside('one~1', 1), inside('thirteen-amended', 13)], [true, false]);
  });

  it('a task no commit is stamped with, named on main, then again on a side line merged back, all in one second: landed at the commit first naming it, never the merge bringing in the later one', () => {
    const dir = repo(byHandWorld);
    const landing = repoLanded(dir, UNIT, MAIN, { since: null }).landing({ unit: UNIT, phase: 1, n: 6 });

    assert.deepStrictEqual(landing === null ? null : git(dir, ['log', '-1', '--format=%s', landing]).trim(), 'feat(pay): Six');
  });
});

describe('repoLanded: only content decides a landing, the door\'s stamp never naming one (R28)', () => {
  it('a task of two commits, one of them cherry-picked onto main by hand, the first or the last, its copy carrying the stamp: not landed; both cherry-picked: landed', () => {
    const reads = Object.keys(PICKED).map((name) => landed(repo(workWorld, name), [1]).landed[0]);

    assert.deepStrictEqual(reads, [false, false, true]);
  });

  it('a task cut from another\'s branch, its own work alone squashed onto main by hand as one commit: landed, and the task below it, whose work main lacks, not — a chain lands whole only by a squash of its whole work', () => {
    const dir = repo(laidWorld);
    git(dir, ['switch', '-q', '-c', branchOf(6), 'main']);
    stamped(dir, 6, 'six.txt');
    git(dir, ['switch', '-q', '-c', branchOf(7)]);
    stamped(dir, 7, 'seven.txt');
    stamped(dir, 7, 'seven-more.txt');
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['checkout', branchOf(7), '--', 'seven.txt', 'seven-more.txt']);
    committed(dir, ['In my own words']);

    assert.deepStrictEqual(landed(dir, [6, 7]).landed, [false, true]);
  });
});

describe('repoLanded: a task\'s last commit, its work branch standing (7.2.22)', () => {
  it('a task whose branch was taken back past a commit another task\'s branch cut on it holds: its last commit its own branch\'s, never one only the other\'s holds, so it has landed where main holds that', () => {
    const dir = repo(workWorld, 'owns');
    const read = repoLanded(dir, UNIT, MAIN, { since: null });

    assert.deepStrictEqual(read.task({ unit: UNIT, phase: 1, n: 1 }), { own: null, found: git(dir, ['rev-parse', 'feat/pay-1.1-add-tip']).trim(), held: true, landed: true });
  });

  it('a task whose branch stands holding none of its commits: no last commit, never one the reflog keeps', () => {
    const dir = repo(workWorld, 'owned');

    assert.deepStrictEqual(repoLanded(dir, UNIT, MAIN, { since: null }).task({ unit: UNIT, phase: 1, n: 1 }), { own: null, found: null, held: false, landed: false });
  });
});

describe('repoLanded: a task landed where its branch\'s tip has (R29, 12.14)', () => {
  /**
   * Whether each of tasks 1.`ns` has landed on main and where it stands, the
   * driver having taken it at the person's tidying, read in one read, and
   * the git commands the read ran.
   * @param {string} dir @param {number[]} ns
   */
  const standing = (dir, ns) => {
    const taken = new Map(ns.map((n) => [`${UNIT}-1-${n}`, git(dir, ['rev-parse', `${branchOf(n)}~2`]).trim()]));
    const { result, commands } = traced(() => {
      const read = repoLanded(dir, UNIT, MAIN, { since: null, taken: () => taken });
      return ns.map((n) => [read.task({ unit: UNIT, phase: 1, n }).landed, read.stands({ unit: UNIT, phase: 1, n })]);
    });
    return { read: result, commands: commands.length };
  };

  it('a task squashed under the person\'s own message, main merged back into its branch since: landed, as its task — the person\'s own commit past that merge, not landed, and the task taken at that merge changed after its landing', () => {
    const dir = repo(tipsWorld, 'merged-back');
    const taken = new Map([[`${UNIT}-1-2`, git(dir, ['rev-parse', `${branchOf(2)}~1`]).trim()]]);

    assert.deepStrictEqual([landed(dir, [1, 2]).landed, repoLanded(dir, UNIT, MAIN, { since: null, taken: () => taken }).stands({ unit: UNIT, phase: 1, n: 2 })], [[true, false], 'changed']);
  });

  it('a task squashed under the person\'s own message, another task\'s branch merged into its own since, past the person\'s own commit there: landed, as its task — that commit the other task\'s work', () => {
    assert.deepStrictEqual(landed(repo(tipsWorld, 'aside'), [4]).landed, [true]);
  });

  it('a commit standing for a task whole, holding the person\'s own commit no branch holds past the task\'s commit, that commit alone squashed onto main: the person\'s own the task\'s work, so not landed — the task, its branch at its commit, landed', () => {
    const dir = repo(tipsWorld, 'apart');
    const read = repoLanded(dir, UNIT, MAIN, { since: null });
    const ref = { unit: UNIT, phase: 1, n: 1 };

    assert.deepStrictEqual([read.landedAs(ref, git(dir, ['rev-parse', 'taken']).trim()), read.task(ref).landed], [false, true]);
  });

  it('two and six tasks taken at the person\'s own commit past their own, squashed under the person\'s own message, then a commit of their own and the person\'s own past that on each branch: none landed, each changed after its landing — and reading them runs the same git commands', () => {
    const reads = Object.entries(TIPS).map(([name, tasks]) => standing(repo(tipsWorld, name), Array.from({ length: tasks }, (_, at) => at + 1)));

    assert.deepStrictEqual(reads, reads.map(({ read }) => ({ read: read.map(() => [false, 'changed']), commands: reads[0].commands })));
  });

  it('a task of two commits squashed by hand into the person\'s own commit beside work of their own, then its last commit amended with no change: landed at its branch\'s tip, a commit its branch holds landed too — never its branch rewritten past its landing (F1)', () => {
    const dir = repo(laidWorld);
    const branch = branchOf(6);
    git(dir, ['switch', '-q', '-c', branch, 'main']);
    stamped(dir, 6, 'six.txt');
    stamped(dir, 6, 'six-more.txt');
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['merge', '-q', '--squash', branch]);
    committed(dir, ['In my own words'], { 'mine.txt': 'mine\n' });
    git(dir, ['switch', '-q', branch]);
    git(dir, ['commit', '-q', '--amend', '-m', 'feat(pay): part 6, reworded', '-m', stampOf(6)]);
    git(dir, ['switch', '-q', 'main']);
    const ref = { unit: UNIT, phase: 1, n: 6 };
    const read = repoLanded(dir, UNIT, MAIN, { since: null });

    assert.deepStrictEqual([read.stands(ref), read.rewritten(ref)], ['landed', null]);
  });
});

describe('repoLanded: the tasks whose work a branch holds past main, not landed (R31)', () => {
  it('the person\'s own commit on a landed task\'s branch, its tip the lowest holding it: that task\'s work on each branch cut there — one standing at the same commit, a later task, and one past it with a commit of its own — not landed', () => {
    const dir = repo(tipsWorld, 'aside');
    const read = repoLanded(dir, UNIT, MAIN, { since: null });
    const main = git(dir, ['rev-parse', 'main']).trim();

    assert.deepStrictEqual([2, 3].map((n) => read.heldPast(`refs/heads/${branchOf(n)}`, [main]).map((ref) => ref.n)), [[1], [1, 3]]);
  });
});

describe('repoLanded: the person\'s own commit inside a task\'s branch, below its last commit, that task\'s work (R31, R25, R28)', () => {
  it('a task of its commit, the person\'s own and its commit again, each cherry-picked onto main but the person\'s own, has not landed; every one picked, it has', () => {
    assert.deepStrictEqual(landed(repo(tipsWorld, 'own-work'), [1, 2]).landed, [false, true]);
  });

  it('a task whose commit undoes the person\'s own commit below it, squashed under the person\'s own message, has landed: the change its work is laid on read below the person\'s own', () => {
    assert.deepStrictEqual(landed(repo(tipsWorld, 'own-work'), [3]).landed, [true]);
  });

  it('a commit of a task, read alone: undoing the person\'s own commit below it on its task\'s branch, squashed so, it has landed; undoing another task\'s work below it, not landed, it has not', () => {
    const dir = repo(tipsWorld, 'own-work');
    const read = repoLanded(dir, UNIT, MAIN, { since: null });
    const at = (/** @type {string} */ rev) => git(dir, ['rev-parse', rev]).trim();

    assert.deepStrictEqual([read.landedCommit(at(`${branchOf(6)}~1`), `${UNIT}-1-6`), read.landedCommit(at('undo'), `${UNIT}-1-5`)], [true, false]);
  });

  it('a task whose commit undoes the person\'s own commit past another task\'s, that task\'s work (R32), its branch cut there, the other task\'s branch at that commit: the other task\'s commit alone cherry-picked onto main and its own branch squashed there, the chain landed whole — it has landed, its commit read alone too, and the other task with it, however the later undid the earlier\'s work (the chain read)', () => {
    const dir = repo(tipsWorld, 'own-work');
    const undo = git(dir, ['rev-parse', branchOf(10)]).trim();

    assert.deepStrictEqual([landed(dir, [9, 10]).landed, repoLanded(dir, UNIT, MAIN, { since: null }).landedCommit(undo, `${UNIT}-1-10`)], [[true, true], true]);
  });

  it('a task read from its last commit, its work the commits that commit holds: cut from another task\'s branch past the person\'s own commit there, its commit cherry-picked onto main, the person\'s own past it never among them — its landing that copy', () => {
    const dir = repo(tipsWorld, 'own-work');

    assert.strictEqual(repoLanded(dir, UNIT, MAIN, { since: null }).landing({ unit: UNIT, phase: 1, n: 8 }), git(dir, ['rev-parse', 'main']).trim());
  });
});

describe('repoLanded: whose work a commit is, on main or past it (R32)', () => {
  it('the person\'s own commit on main before a task\'s branch was cut, on its branch below its first commit, or on a later task\'s branch below that one\'s first: no task\'s; between its commits, fast-forwarded onto main, and past its last: its', () => {
    const dir = repo(besideWorld, 'forwarded');
    const subjects = new Map(git(dir, ['log', '--all', '--format=%H %s']).trim().split('\n').map((line) => [line.slice(0, 40), line.slice(41)]));
    const owned = repoLanded(dir, UNIT, MAIN, { since: null }).ownedSince(branchOf(2)).map(({ sha, owners }) => [subjects.get(sha), owners]);

    assert.deepStrictEqual(owned, [
      ['the base', []], ['my own hotfix', []], ['my own start', []], ['feat(pay): part 1', ['pay-1-1']], ['my own words between', ['pay-1-1']],
      ['feat(pay): more on part 1', ['pay-1-1']], ['my own words past it', ['pay-1-1']], ['my own words before its first', []], ['feat(pay): part 2', ['pay-1-2']],
    ]);
  });

  it('a landing on main naming its task by its `Task:` line, main then fast-forwarded into another task\'s branch past its first commit: that landing\'s task\'s, never the other\'s — the person\'s own hotfix past it the other\'s, as decided', () => {
    const dir = repo(besideWorld, 'named');
    const subjects = new Map(git(dir, ['log', '--all', '--format=%H %s']).trim().split('\n').map((line) => [line.slice(0, 40), line.slice(41)]));
    const owned = repoLanded(dir, UNIT, MAIN, { since: null }).ownedSince(branchOf(1)).map(({ sha, owners }) => [subjects.get(sha), owners]);

    assert.deepStrictEqual(owned, [['the base', []], ['feat(pay): part 1', ['pay-1-1']], ['feat(pay): Part 2', ['pay-1-2']], ['my own hotfix', ['pay-1-1']]]);
  });

  it('the person\'s own commit past two tasks\' commits on one line, both tips holding it there: the task whose tip is the lower its owner, holding the fewest commits; both tips at it, the earlier task', () => {
    const dir = repo(besideWorld, 'shared');
    const mine = git(dir, ['rev-parse', branchOf(1)]).trim();
    const owners = () => repoLanded(dir, UNIT, MAIN, { since: null }).ownedSince(mine).find(({ sha }) => sha === mine)?.owners;
    const lower = owners();
    git(dir, ['branch', '-f', branchOf(2), branchOf(1)]);

    assert.deepStrictEqual([lower, owners()], [['pay-1-1'], ['pay-1-1']]);
  });
});

describe('unitLanded: each task\'s last commit read once for every revision of a repository (12.14)', () => {
  it('a task read on main and on another revision: its last commit read once, and main asked again answers the read already made', () => {
    const dir = repo(squashedWorld);
    const project = { dir: '.', path: dir, prefix: '', heldOut: [], submodules: [] };
    const ref = { unit: UNIT, phase: 1, n: 8 };
    const real = lg.lastStamped;
    let reads = 0;
    lg.lastStamped = (...args) => {
      reads += 1;
      return real(...args);
    };
    try {
      const read = unitLanded(dir, UNIT, [project], null, null);
      const onMain = read.on(project, MAIN);
      const landedOn = [onMain.task(ref).landed, read.on(project, 'refs/heads/again').task(ref).landed];

      assert.deepStrictEqual([landedOn, reads, read.on(project, MAIN) === onMain], [[false, true], 1, true]);
    } finally {
      lg.lastStamped = real;
    }
  });
});

describe('repoLanded: a task\'s landing past a commit, where a submodule\'s pointer read from it moves (landing-git.cjs, `repointing`, 7.2.21, R25)', () => {
  /** The by-hand world's repository as a submodule a default branch points at `pointer`, re-pointed. @param {string} dir @param {string} pointer */
  const repointed = (dir, pointer) => {
    const sub = { root: dir, unit: UNIT, into: 'main', landedOn: landedIn(dir, UNIT, null) };
    const [at, onto] = [pointer, 'main'].map((rev) => git(dir, ['rev-parse', rev]).trim());
    return lg.repointing('main', 'lib', sub, at, onto);
  };

  /** The refusal of a default branch pointing the submodule at `pointer`, its main not holding it. @param {string} dir @param {string} pointer */
  const refusal = (dir, pointer) => ({
    refused: `land: main points lib at ${git(dir, ['rev-parse', '--short=7', pointer]).trim()}, a commit lib's main does not hold — bring lib's main up to it, as \`git -C lib pull\` does where its remote holds it, and land again`,
  });

  it('a pointer at a task\'s last commit, the task squashed under the person\'s own message and a line of it rewritten since, moves to the squash', () => {
    const dir = repo(byHandWorld);

    assert.deepStrictEqual(repointed(dir, 'one'), { to: git(dir, ['rev-parse', ':/In my own words, one']).trim() });
  });

  it('a pointer at a task\'s branch brought up to date with its squash after it landed: nothing moves, the pointer refused, never moved back to the landing it holds', () => {
    const dir = repo(byHandWorld);

    assert.deepStrictEqual(repointed(dir, 'one-updated'), refusal(dir, 'one-updated'));
  });

  it('a pointer at a task not landed, cut on a task that has landed since: nothing moves, the pointer refused, never moved to a landing lacking the later task\'s work', () => {
    const dir = repo(byHandWorld);

    assert.deepStrictEqual(repointed(dir, 'eleven'), refusal(dir, 'eleven'));
  });

  it('a pointer at the person\'s own commit past a task\'s commit, both cherry-picked onto main by hand: moves to that commit\'s own copy, never to the copy of the task\'s', () => {
    const dir = repo(besideWorld, 'copied');

    assert.deepStrictEqual(repointed(dir, branchOf(1)), { to: git(dir, ['rev-parse', 'main']).trim() });
  });

  it('a pointer at the person\'s own commit past a task\'s commit, the task fast-forwarded onto main by hand and that commit cherry-picked there after: moves to its copy, read as the task\'s work though no commit of the task\'s stands past main (R32)', () => {
    const dir = repo(besideWorld, 'picked');

    assert.deepStrictEqual(repointed(dir, branchOf(1)), { to: git(dir, ['rev-parse', 'main']).trim() });
  });

  it('a pointer at the person\'s own commit past a task\'s commit, that commit alone squashed onto main: nothing moves, the pointer refused, never moved back to the task\'s landing, which lacks it', () => {
    const dir = repo(besideWorld, 'squashed');

    assert.deepStrictEqual(repointed(dir, branchOf(1)), refusal(dir, branchOf(1)));
  });
});

describe('stackMoves: the engine\'s own move of a pointer never moves it back, a task\'s pin kept as written (landing-git.cjs, `pointerFrom`)', () => {
  /**
   * The pointer a holder's main pointing the by-hand world's repository, as
   * lib, at `start` is moved to by a commit on it pointing lib at `pointer`.
   * @param {string} dir @param {string} start @param {string} pointer
   */
  const movedTo = (dir, start, pointer) => {
    const holder = initRepo(path.join(path.dirname(dir), 'holder'));
    const [from, to] = [start, pointer].map((rev) => {
      git(holder, ['update-index', '--add', '--cacheinfo', `160000,${git(dir, ['rev-parse', rev]).trim()},lib`]);
      git(holder, ['commit', '-q', '-m', `lib at ${rev}`]);
      return git(holder, ['rev-parse', 'HEAD']).trim();
    });
    const sub = { root: dir, unit: UNIT, into: 'main', landedOn: landedIn(dir, UNIT, null) };
    const [moves] = lg.stackMoves({ root: holder, into: 'main', gitlinks: ['lib'], submodules: [{ path: 'lib', ctx: sub }] }, [{ sha: to, parents: [from] }], from, () => git(dir, ['rev-parse', 'main']).trim());
    return moves.get('lib');
  };

  it('a commit pointing it at a task\'s branch brought up to date with its squash, the default branch pointing it at that squash: the pointer stays there, never moved to the branch\'s merge off the submodule\'s line', () => {
    const dir = repo(byHandWorld);

    assert.strictEqual(movedTo(dir, ':/In my own words, one', 'one-updated'), git(dir, ['rev-parse', ':/In my own words, one']).trim());
  });

  it('a commit pointing it at a task not landed, cut before the submodule\'s main moved on, the default branch pointing it at main\'s tip: the task\'s pin, kept as the task wrote it', () => {
    const dir = repo(byHandWorld);

    assert.strictEqual(movedTo(dir, 'main', 'eleven'), git(dir, ['rev-parse', 'eleven']).trim());
  });
});
