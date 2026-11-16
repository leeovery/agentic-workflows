'use strict';

// ---------------------------------------------------------------------------
// No read of what has landed answers by when a commit was made (task-
// landed.cjs, `repoLanded`, 7.2.22, R25, R29): one history built three
// times — every commit in one second, each a second past the one before
// it, and each a second before it, as a clock set wrong makes them — reads
// alike in all three. A task squashed under the person's own message, or
// under its `Task:` line, has landed at its squash; one changed after its
// squash, by its own commit or the person's, has not, its first commit has; one whose change the person made
// by hand on main past where its branch was cut, before its own commit,
// has landed there; one whose branch is gone, its two commits kept by a
// tag each, has its later one for its last; one whose change main held
// before its branch was cut, named on main twice since, has landed at the
// first naming it; and one whose commit was cherry-picked onto main past
// a commit of main's own, main then merged back into its branch, has its
// own commit for its last, landed. The reads by hand are test-engine-task-landed.cjs's. Git layer:
// three repositories, built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { createFile, datedAt } = require('./discovery-test-utils.cjs');
const { repoLanded } = require('../../skills/ledger-engine/scripts/domain/task-landed.cjs');
const { TRAILER } = require('../../skills/ledger-engine/scripts/domain/commit-task.cjs');

const { initRepo, folderFrom, cleanupFixture } = harness;

const UNIT = 'pay';
const MAIN = 'refs/heads/main';

/** The clocks the history is built by, by their words: how far each commit's second moves from the one before it. */
const CLOCKS = Object.freeze({ 'in one second': 0, 'a second apart': 1, 'each a second before the one before it': -1 });

/** The second the history's first commit is made in. */
const START = Date.parse('2026-07-01T00:00:00Z') / 1000;

/** Task 1.`n`'s branch, named as the engine names a task's. @param {number} n */
const branchOf = (n) => `feat/pay-1.${n}-part-${n}`;

/** A task ref of the unit's phase 1. @param {number} n */
const refOf = (n) => ({ unit: UNIT, phase: 1, n });

/**
 * A commit on what `dir` has out, under `message`'s paragraphs, writing
 * `files`, else nothing, made in the second `at` gives.
 * @param {string} dir @param {() => string} at @param {string[]} message @param {Record<string, string>} [files]
 */
function committed(dir, at, message, files = {}) {
  for (const [file, text] of Object.entries(files)) createFile(dir, file, text);
  harness.git(dir, ['add', '-A']);
  datedAt(at(), () => harness.git(dir, ['commit', '-q', '--allow-empty', ...message.flatMap((paragraph) => ['-m', paragraph])]));
}

/** Git at `dir`, a command making a commit made in the second `at` gives. @param {string} dir @param {() => string} at @param {string[]} args */
const dated = (dir, at, args) => datedAt(at(), () => harness.git(dir, args));

/** The door's stamp of task 1.`n`. @param {number} n */
const stampOf = (n) => `${TRAILER}: ${UNIT}-1-${n}`;

/** `act` with `branch` cut from main out, main out again after. @param {string} dir @param {string} branch @param {() => void} act */
function on(dir, branch, act) {
  harness.git(dir, ['switch', '-q', '-c', branch, 'main']);
  act();
  harness.git(dir, ['switch', '-q', 'main']);
}

/**
 * The history (the header's), in a repository at `folder`/`name`, each
 * commit `step` seconds past the one before it.
 * @param {string} folder @param {string} name @param {number} step
 */
function history(folder, name, step) {
  let second = START;
  const at = () => {
    const now = second;
    second += step;
    return `${now} +0000`;
  };
  const dir = initRepo(path.join(folder, name));
  committed(dir, at, ['the base'], { 'README.md': 'pay\n' });
  on(dir, branchOf(1), () => committed(dir, at, ['feat(pay): part 1', stampOf(1)], { 'part-1.txt': '1\n' }));
  harness.git(dir, ['merge', '-q', '--squash', branchOf(1)]);
  committed(dir, at, ['In my own words, 1']);
  on(dir, branchOf(2), () => committed(dir, at, ['feat(pay): part 2', stampOf(2)], { 'part-2.txt': '2\n' }));
  harness.git(dir, ['merge', '-q', '--squash', branchOf(2)]);
  committed(dir, at, ['feat(pay): Part 2', `Task: ${UNIT}-1-2`]);
  on(dir, branchOf(3), () => committed(dir, at, ['feat(pay): part 3', stampOf(3)], { 'part-3.txt': '3\n' }));
  harness.git(dir, ['merge', '-q', '--squash', branchOf(3)]);
  committed(dir, at, ['feat(pay): Part 3', `Task: ${UNIT}-1-3`]);
  harness.git(dir, ['switch', '-q', branchOf(3)]);
  committed(dir, at, ['feat(pay): more on part 3', stampOf(3)], { 'more-3.txt': '3\n' });
  harness.git(dir, ['switch', '-q', 'main']);
  on(dir, branchOf(8), () => committed(dir, at, ['feat(pay): part 8', stampOf(8)], { 'part-8.txt': '8\n' }));
  harness.git(dir, ['merge', '-q', '--squash', branchOf(8)]);
  committed(dir, at, ['feat(pay): Part 8', `Task: ${UNIT}-1-8`]);
  harness.git(dir, ['switch', '-q', branchOf(8)]);
  committed(dir, at, ['my own words on part 8'], { 'more-8.txt': '8\n' });
  harness.git(dir, ['switch', '-q', 'main']);
  harness.git(dir, ['branch', branchOf(4), 'main']);
  committed(dir, at, ['part 4, by hand'], { 'part-4.txt': '4\n' });
  harness.git(dir, ['switch', '-q', branchOf(4)]);
  committed(dir, at, ['feat(pay): part 4', stampOf(4)], { 'part-4.txt': '4\n' });
  harness.git(dir, ['switch', '-q', 'main']);
  on(dir, branchOf(5), () => {
    committed(dir, at, ['feat(pay): part 5', stampOf(5)], { 'part-5.txt': '5\n' });
    harness.git(dir, ['tag', 'kept-first']);
    committed(dir, at, ['feat(pay): more on part 5', stampOf(5)], { 'more-5.txt': '5\n' });
    harness.git(dir, ['tag', 'kept']);
  });
  harness.git(dir, ['branch', '-q', '-D', branchOf(5)]);
  committed(dir, at, ['part 6, by hand'], { 'part-6.txt': '6\n' });
  on(dir, branchOf(6), () => committed(dir, at, ['feat(pay): part 6', stampOf(6)], { 'part-6.txt': '6\n' }));
  committed(dir, at, ['feat(pay): Part 6', `Task: ${UNIT}-1-6`]);
  committed(dir, at, ['chore(pay): part 6 again', `Task: ${UNIT}-1-6`]);
  on(dir, branchOf(7), () => committed(dir, at, ['feat(pay): part 7', stampOf(7)], { 'part-7.txt': '7\n' }));
  committed(dir, at, ['main moves on'], { 'main.txt': 'main\n' });
  dated(dir, at, ['cherry-pick', branchOf(7)]);
  harness.git(dir, ['switch', '-q', branchOf(7)]);
  dated(dir, at, ['merge', '-q', '--no-ff', '-m', 'Merge main back', 'main']);
  harness.git(dir, ['switch', '-q', 'main']);
}

const clockWorld = folderFrom('engine-task-landed-clock-', (folder) => {
  for (const [name, step] of Object.entries(CLOCKS)) history(folder, name, step);
});

/** @type {string[]} */
let made = [];
afterEach(() => {
  made.forEach(cleanupFixture);
  made = [];
});

/** What `answer` reads of each clock's history, in `CLOCKS`' order. @template T @param {(dir: string) => T} answer @returns {T[]} */
function byClock(answer) {
  const folder = clockWorld(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-task-landed-clock-')));
  made.push(folder);
  return Object.keys(CLOCKS).map((name) => answer(path.join(folder, name)));
}

/** A commit's subject, null for none. @param {string} dir @param {string|null} sha */
const subject = (dir, sha) => (sha === null ? null : harness.git(dir, ['log', '-1', '--format=%s', sha]).trim());

/** Each task of `ns`, whether it has landed and the subject of its landing. @param {string} dir @param {number[]} ns */
function landings(dir, ns) {
  const read = repoLanded(dir, UNIT, MAIN, { since: null });
  return ns.map((n) => [read.task(refOf(n)).landed, subject(dir, read.landing(refOf(n)))]);
}

/** The same answer for every clock. @template T @param {T} answer @returns {T[]} */
const everyClock = (answer) => Object.keys(CLOCKS).map(() => answer);

describe('repoLanded: no read answers by when a commit was made — one history built in one second, a second apart, and each a second before the one before it, read alike (7.2.22, R25, R29)', () => {
  it('a task squashed under the person\'s own message, or under its `Task:` line, landed at its squash; one whose change the person made on main by hand past where its branch was cut, before its own commit, landed there', () => {
    assert.deepStrictEqual(byClock((dir) => landings(dir, [1, 2, 4])), everyClock([[true, 'In my own words, 1'], [true, 'feat(pay): Part 2'], [true, 'part 4, by hand']]));
  });

  it('a task changed on its branch after its squash, by its own commit or the person\'s, has not landed, the commit its squash took has', () => {
    assert.deepStrictEqual(byClock((dir) => {
      const read = repoLanded(dir, UNIT, MAIN, { since: null });
      return [3, 8].map((n) => [read.task(refOf(n)).landed, read.landedAs(refOf(n), harness.git(dir, ['rev-parse', `${branchOf(n)}~1`]).trim())]);
    }), everyClock([[false, true], [false, true]]));
  });

  it('a task whose branch is gone, its two commits each kept by a tag, has its later one for its last', () => {
    assert.deepStrictEqual(byClock((dir) => subject(dir, repoLanded(dir, UNIT, MAIN, { since: null }).task(refOf(5)).found)), everyClock('feat(pay): more on part 5'));
  });

  it('a task whose change main held before its branch was cut, named on main twice since, landed at the commit first naming it', () => {
    assert.deepStrictEqual(byClock((dir) => landings(dir, [6])), everyClock([[true, 'feat(pay): Part 6']]));
  });

  it('a task whose commit was cherry-picked onto main, main then merged back into its branch: its own commit its last, never main\'s copy, and landed', () => {
    assert.deepStrictEqual(byClock((dir) => {
      const { found, landed } = repoLanded(dir, UNIT, MAIN, { since: null }).task(refOf(7));
      return [found === harness.git(dir, ['rev-parse', `${branchOf(7)}^1`]).trim(), landed];
    }), everyClock([true, true]));
  });
});
