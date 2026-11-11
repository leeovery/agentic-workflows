'use strict';

// ---------------------------------------------------------------------------
// A task's change read across a submodule's pointer (landing-git.cjs,
// `holdChanges`, `holdsChange`, `pointersHold`, 7.2.17, R25): a task
// pointing a project's submodule at its commit there, landed by a commit
// pointing the submodule at the submodule's squash of that commit, as a
// landing settles the pointer, has landed there, main holding its branch's
// change; its branch then pointing the submodule at a later commit of its
// own the submodule has not landed, the pointer moved alone, has not, nor
// does main hold it; the submodule's squash of that later commit, the
// project's main pointing at it, lands it there. A task pointing two
// submodules at its commits there, main pointing one at its landing and the
// other at a later commit lacking it, has not landed. Reading three tasks
// landed so runs the git commands reading one does (12.14). Its landing
// through the verbs on each driver is the nested conformance suites'. Git
// layer: five projects, each with its submodules' checkouts, built once and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, initRepo, traced, folderFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createFile } = require('./discovery-test-utils.cjs');
const { repoLanded } = require('../../skills/leeway-engine/scripts/domain/task-landed.cjs');
const lg = require('../../skills/leeway-engine/scripts/domain/landing-git.cjs');
const { TRAILER } = require('../../skills/leeway-engine/scripts/domain/commit-task.cjs');

const UNIT = 'pay';
const MAIN = 'refs/heads/main';

/** Task 1.`n`'s branch. @param {number} n */
const branchOf = (n) => `feat/pay-1.${n}-part-${n}`;

/** Task 1.`n`'s stamp, as the door's trailer. @param {number} n */
const stampOf = (n) => `${TRAILER}: ${UNIT}-1-${n}`;

/**
 * A commit on what `dir` has out, under `message`'s paragraphs, writing
 * `files` and pointing each submodule of `pointers` at its commit: the
 * commit made.
 * @param {string} dir @param {string[]} message @param {Record<string, string>} [files] @param {Record<string, string>} [pointers]
 */
function committed(dir, message, files = {}, pointers = {}) {
  for (const [file, text] of Object.entries(files)) createFile(dir, file, text);
  if (Object.keys(files).length > 0) git(dir, ['add', '--', ...Object.keys(files)]);
  for (const [at, sha] of Object.entries(pointers)) git(dir, ['update-index', '--add', '--cacheinfo', `160000,${sha},${at}`]);
  git(dir, ['commit', '-q', '--allow-empty', ...message.flatMap((paragraph) => ['-m', paragraph])]);
  return git(dir, ['rev-parse', 'HEAD']).trim();
}

/** A project at `folder`/`name` with a submodule's checkout in its folder for each of `subs`, the project's git leaving them out: the project and each submodule's checkout. @param {string} folder @param {string} name @param {string[]} subs */
function project(folder, name, subs) {
  const dir = initRepo(path.join(folder, name));
  fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), subs.map((sub) => `/${sub}/\n`).join(''));
  return { dir, subs: subs.map((sub) => initRepo(path.join(dir, sub))) };
}

/** Task 1.`n`'s branch squashed onto main in `dir`, which has main out, under `message`'s paragraphs: the squash. @param {string} dir @param {number} n @param {string[]} message */
function squashed(dir, n, message) {
  git(dir, ['merge', '-q', '--squash', branchOf(n)]);
  return committed(dir, message);
}

/** `act` with task 1.`n`'s branch out in `dir`, made from main where it is not yet, main out again after. @param {string} dir @param {number} n @param {() => void} act */
function onBranch(dir, n, act) {
  const made = git(dir, ['branch', '--list', branchOf(n)]).trim() !== '';
  git(dir, ['switch', '-q', ...(made ? [] : ['-c']), branchOf(n)]);
  act();
  git(dir, ['switch', '-q', 'main']);
}

/**
 * A project at `folder`/`name` pointing its submodule lib — its checkout
 * in the project's folder — at lib's first commit; tasks 1.1 to 1.`tasks`
 * in turn in both, each one's lib commit writing its lib file and the
 * project's writing its file and pointing lib at it; lib's main squashing
 * it under the person's own message, and the project's main writing that
 * file, pointing lib at that squash.
 * @param {string} folder @param {string} name @param {number} [tasks] @returns {{dir: string, lib: string}}
 */
function landedProject(folder, name, tasks = 1) {
  const { dir, subs: [lib] } = project(folder, name, ['lib']);
  committed(dir, ['the project'], { 'README.md': 'pay\n' }, { lib: committed(lib, ['the lib'], { 'lib.txt': 'lib\n' }) });
  for (let n = 1; n <= tasks; n += 1) {
    /** @type {string} */
    let own = '';
    onBranch(lib, n, () => {
      own = committed(lib, [`feat(pay): part ${n}`, stampOf(n)], { [`lib-${n}.txt`]: `${n}\n` });
    });
    const landing = squashed(lib, n, [`In my own words, lib ${n}`]);
    onBranch(dir, n, () => committed(dir, [`feat(pay): part ${n}`, stampOf(n)], { [`${n}.txt`]: `${n}\n` }, { lib: own }));
    committed(dir, [`In my own words, ${n}`], { [`${n}.txt`]: `${n}\n` }, { lib: landing });
  }
  return { dir, lib };
}

/** Task 1.1's branch in `at` pointing lib at a later commit of the task's there, lib not landing it, the pointer moved alone. @param {{dir: string, lib: string}} at */
function movedOn(at) {
  /** @type {string} */
  let later = '';
  onBranch(at.lib, 1, () => {
    later = committed(at.lib, ['feat(pay): part 1, more', stampOf(1)], { 'lib-two.txt': 'two\n' });
  });
  onBranch(at.dir, 1, () => committed(at.dir, ['feat(pay): part 1, the pointer moved', stampOf(1)], {}, { lib: later }));
  return at;
}

/** lib's main in `at` squashing task 1.1's later commit, and the project's main pointing lib at that squash. @param {{dir: string, lib: string}} at */
function landedAgain(at) {
  committed(at.dir, ['lib moved on'], {}, { lib: squashed(at.lib, 1, ['In my own words, lib again']) });
  return at;
}

/**
 * A project at `folder`/`name` pointing its submodules lib and lib2 at
 * their first commits; task 1.1 in all three, its commit in each
 * submodule writing a file and the project's pointing both at them; lib's
 * main squashing its commit, lib2's main moving on without it, and the
 * project's main pointing lib at that squash and lib2 at its main.
 * @param {string} folder @param {string} name
 */
function landedInOne(folder, name) {
  const { dir, subs } = project(folder, name, ['lib', 'lib2']);
  const [lib, lib2] = subs;
  committed(dir, ['the project'], { 'README.md': 'pay\n' }, Object.fromEntries(subs.map((sub) => [path.basename(sub), committed(sub, ['the lib'], { 'lib.txt': 'lib\n' })])));
  /** @type {Record<string, string>} */
  const own = {};
  for (const sub of subs) {
    onBranch(sub, 1, () => {
      own[path.basename(sub)] = committed(sub, ['feat(pay): part 1', stampOf(1)], { 'lib-1.txt': '1\n' });
    });
  }
  const pointers = { lib: squashed(lib, 1, ['In my own words, lib 1']), lib2: committed(lib2, ['lib2 moves on'], { 'lib-other.txt': 'other\n' }) };
  onBranch(dir, 1, () => committed(dir, ['feat(pay): part 1', stampOf(1)], { '1.txt': '1\n' }, own));
  committed(dir, ['In my own words, 1'], { '1.txt': '1\n' }, pointers);
}

/** The projects of the header, by their names. */
const pointerWorld = folderFrom('engine-task-landed-pointer-', (folder) => {
  landedProject(folder, 'landed');
  movedOn(landedProject(folder, 'moved'));
  landedAgain(movedOn(landedProject(folder, 'landed-again')));
  landedInOne(folder, 'one-of-two');
  landedProject(folder, 'three', 3);
});

/** @type {string[]} */
let made = [];
afterEach(() => {
  made.forEach(cleanupFixture);
  made = [];
});

/** The pointer world copied for a test. */
function world() {
  const folder = pointerWorld(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-task-landed-pointer-')));
  made.push(folder);
  return folder;
}

describe('repoLanded: a task\'s change held where the submodule\'s pointer points at a commit holding the change of the one the task points it at (landing-git.cjs, `pointersHold`, 7.2.17)', () => {
  it('landed at the commit pointing lib at lib\'s squash of its commit there, main holding its branch\'s change; its pointer then moved alone to a later commit lib has not landed, neither; lib\'s squash of that, main pointing at it, landed there; landed in lib but not in lib2 beside it, neither', () => {
    const folder = world();
    const read = (/** @type {string} */ name) => {
      const dir = path.join(folder, name);
      const landed = repoLanded(dir, UNIT, MAIN, { since: null });
      const ref = { unit: UNIT, phase: 1, n: 1 };
      const landing = landed.landing(ref);
      return [landed.task(ref).landed, landing === null ? null : git(dir, ['log', '-1', '--format=%s', landing]).trim(), lg.holdsChange(dir, MAIN, branchOf(1))];
    };

    assert.deepStrictEqual(['landed', 'moved', 'landed-again', 'one-of-two'].map(read), [
      [true, 'In my own words, 1', true], [false, null, false], [true, 'lib moved on', true], [false, null, false],
    ]);
  });

  it('reading three tasks landed so, one after another, runs the git commands reading one does (12.14)', () => {
    const folder = world();
    const read = (/** @type {string} */ name, /** @type {number} */ tasks) => {
      const dir = path.join(folder, name);
      const { result, commands } = traced(() => {
        const landed = repoLanded(dir, UNIT, MAIN, { since: null });
        return Array.from({ length: tasks }, (_, at) => landed.task({ unit: UNIT, phase: 1, n: at + 1 }).landed);
      });
      return { landed: result, commands: commands.length };
    };
    const [one, three] = [read('landed', 1), read('three', 3)];

    assert.deepStrictEqual([one.landed, three.landed, three.commands], [[true], [true, true, true], one.commands]);
  });
});
