'use strict';

// The world the landing suites share (test-engine-land-*.cjs and
// test-engine-landing-conformance.cjs): the project world, its default
// branch `main` holding the code a build starts from, tagged
// `landing-base`, and the task branches Claude would leave behind, each one
// commit off the branch it was cut from (`TASKS`), each in the tracker, as
// the unit and its phases are — through the default task driver, its real
// tool, where a test puts any other task it opens (`track`), for `land
// open` reads a task's type and title there. A branch is made, and
// merged back onto another as Claude merges a parallel task back, with no
// checkout touched — imported over the commit it starts from, under the
// world's identity — so the main checkout stays as the test left it. What
// landed is read off the default branch past the base, as no config of the
// person's changes it. The nested world (`buildNested`) is the project with
// a repository of its own nested in its folder twice — a submodule and a
// clone — and tasks touching one, some or all of them (`NESTED`). A suite
// takes a copy of a world per call (`useLandingWorld`, `useNestedWorld`) —
// a nested conformance suite through its driver's side (`nestedConformance`)
// — reads a verb's answer for the project's own repository (`own`), checks a
// refusal moved nothing in the repository (`refusedMoving`), as an answer
// finding its work done already does (`alreadyMoving`), and follows the
// remedy it names (`followRemedy`); the
// remedy table (landing-remedies.cjs) is followed a row a test, in a state
// of the person's worktrees, or of their config (`personState`,
// `followed`), against the way on it should read there (`way`), every
// commit the verb then makes signed as that config signs them
// (`signatures`).

require('./hermetic-env.cjs');

const assert = require('node:assert');
const { afterEach } = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const {
  ok, git, statePath, layout, readState, writeState, commitAll, refuses, fixtureFrom, folderFrom, setupFixtureAt, cleanupFixture, initRepo, addSubmodule,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { parseShownTask } = require('../../skills/leeway-engine/scripts/domain/task-id.cjs');
const names = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const UNIT = 'pay';
const BASE = 'landing-base';
// Who commits in the world, as its config names them (discovery-test-utils.cjs, `testIdentity`).
const IDENTITY = 'Test <test@example.com>';
// The phases the world writes into the tracker, before any task of them.
const PHASES = 5;
// The tracker a project has unless it names another: the default task driver, its real tool.
const TRACKER = /** @type {import('../../skills/leeway-engine/scripts/domain/drivers.cjs').TaskDriver} */ (
  listDrivers('task').filter((driver) => driver.isDefault)[0]
);

/** A task in the tracker, and its branch, named from its type and title. @typedef {{shown: string, type: string, title: string, branch: string}} Tracked */
/** A task the world holds a branch of: its files, committed off the branch it was cut from. @typedef {Tracked & {from: string, files: Record<string, string>}} Task */

/**
 * The tasks the world holds branches of, each cut from `main` but 3.1. 1.1
 * and 1.2 run side by side; 2.1 runs beside phase 1, and 3.1 is cut from
 * it; 1.3 carries a file under `.leeway/`, and 1.9 one under `.LEEWAY/`.
 * @type {Readonly<Record<string, Task>>}
 */
const TASKS = Object.freeze({
  card: { shown: '1.1', type: 'feat', title: 'Add card', branch: 'feat/pay-1.1-add-card', from: 'main', files: { 'card.txt': 'card\n' } },
  total: { shown: '1.2', type: 'feat', title: 'Show total', branch: 'feat/pay-1.2-show-total', from: 'main', files: { 'total.txt': 'total\n' } },
  notes: {
    shown: '1.3', type: 'feat', title: 'Keep notes', branch: 'feat/pay-1.3-keep-notes', from: 'main',
    files: { 'notes.txt': 'notes\n', '.leeway/notes.md': 'state\n' },
  },
  loudNotes: {
    shown: '1.9', type: 'feat', title: 'Keep loud notes', branch: 'feat/pay-1.9-keep-loud-notes', from: 'main',
    files: { 'loud.txt': 'loud\n', '.LEEWAY/notes.md': 'state\n' },
  },
  rounding: { shown: '2.1', type: 'fix', title: 'Round totals', branch: 'fix/pay-2.1-round-totals', from: 'main', files: { 'round.txt': 'round\n' } },
  currency: {
    shown: '3.1', type: 'fix', title: 'Name the currency', branch: 'fix/pay-3.1-name-the-currency', from: 'fix/pay-2.1-round-totals',
    files: { 'currency.txt': 'currency\n' },
  },
});

/** The argv that opens a task. @param {Tracked} task @returns {string[]} */
const openArgs = (task) => ['land', 'open', UNIT, task.shown];

/**
 * A verb's answer for the project's own repository, the only one it lands
 * in where nothing is nested.
 * @param {{repos: Record<string, any>[]}} answer
 */
function own(answer) {
  assert.deepStrictEqual(answer.repos.map(({ repo }) => repo), ['.']);
  return answer.repos[0];
}

/**
 * A task put into the world's tracker at the number given, through the
 * project's task driver, as `task create` makes one — the phase written
 * already — and the branch `land open` will name for it.
 * @param {string} dir @param {string} shown @param {string} type @param {string} title
 * @returns {Tracked}
 */
function track(dir, shown, type, title) {
  const ref = parseShownTask(UNIT, shown);
  TRACKER.createTask(statePath(dir), ref, { title, type, text: `${title}.` });
  return { shown, type, title, branch: names.taskBranch(ref, type, title) };
}

/**
 * A task a test cuts: put into the tracker (`track`), and its branch made,
 * `files` committed over `from` as `commitFiles` commits them.
 * @param {string} dir @param {string} shown @param {string} type @param {string} title @param {string} from @param {Record<string, string>} files
 * @param {Parameters<typeof commitFiles>[4]} [opts]
 * @returns {Tracked}
 */
function cutTask(dir, shown, type, title, from, files, opts) {
  const task = track(dir, shown, type, title);
  commitFiles(dir, task.branch, from, files, opts);
  return task;
}


/**
 * `files` committed over `from`, less the paths `removed`, and each of
 * `gitlinks` as a nested repository's pointer at its commit, made the tip
 * of `branch` under `message`, no checkout touched.
 * @param {string} dir @param {string} branch @param {string} from @param {Record<string, string>} files
 * @param {{gitlinks?: Record<string, string>, removed?: string[], message?: string}} [opts]
 * @returns {string} the commit
 */
function commitFiles(dir, branch, from, files, { gitlinks = {}, removed = [], message = `work on ${branch}` } = {}) {
  const data = (/** @type {string} */ text) => `data ${Buffer.byteLength(text)}\n${text}`;
  const stream = [
    `commit refs/heads/${branch}`, 'mark :1', `committer ${IDENTITY} now`, data(message), `from ${from}^0`,
    ...removed.map((file) => `D ${file}`),
    ...Object.entries(files).map(([file, text]) => `M 100644 inline ${file}\n${data(text)}`),
    ...Object.entries(gitlinks).map(([folder, commit]) => `M 160000 ${commit} ${folder}`),
    '', 'get-mark :1', 'done', '',
  ].join('\n');
  return execFileSync('git', ['-c', 'core.ignoreCase=false', 'fast-import', '--quiet', '--force', '--date-format=now', '--done'], { cwd: dir, encoding: 'utf8', input: stream }).trim();
}

/**
 * `onto` merged into `branch`, as Claude merges a parallel task back onto
 * the chain's tip.
 * @param {string} dir @param {string} branch @param {string} onto
 */
function mergeBack(dir, branch, onto) {
  const tree = git(dir, ['merge-tree', '--write-tree', branch, onto]).trim();
  const commit = git(dir, ['commit-tree', tree, '-p', branch, '-p', onto, '-m', `merge ${onto} into ${branch}`]).trim();
  git(dir, ['update-ref', `refs/heads/${branch}`, commit]);
}

/**
 * The unit in the world's tracker, set up by its first phase's `task
 * phase`, the rest of its phases and each of `tasks` put there through the
 * driver, all committed on the state branch.
 * @param {string} dir @param {Tracked[]} tasks
 */
function trackUnit(dir, tasks) {
  createManifest(dir, UNIT, {});
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Phase 1']);
  for (let phase = 2; phase <= PHASES; phase += 1) TRACKER.createPhase(statePath(dir), UNIT, phase, `Phase ${phase}`);
  for (const task of tasks) track(dir, task.shown, task.type, task.title);
  commitAll(dir, 'the unit\'s tasks');
}

/** A repository's first commit: `file`, holding its name, committed in its checkout. @param {string} repo @param {string} file */
function seed(repo, file) {
  fs.writeFileSync(path.join(repo, file), `${file.split('.')[0]}\n`);
  git(repo, ['add', file]);
  git(repo, ['commit', '-q', '-m', `the ${file.split('.')[0]}`]);
}

/**
 * The landing world built into the project world at `dir`: the code on
 * `main`, committed in the main checkout, the base tagged, and every task's
 * branch; and the unit in the tracker (`trackUnit`) with every task of
 * `TASKS`.
 * @param {string} dir
 */
function buildLanding(dir) {
  seed(dir, 'app.txt');
  git(dir, ['tag', BASE]);
  for (const task of Object.values(TASKS)) commitFiles(dir, task.branch, task.from, task.files);
  trackUnit(dir, Object.values(TASKS));
}

/**
 * The repositories the nested world nests in the project's folder: a
 * submodule, and a clone the project ignores, whose default branch is
 * `trunk` — each by its folder and its default branch.
 */
const NESTED = Object.freeze({ ext: { folder: 'ext', into: 'main' }, lib: { folder: 'lib', into: 'trunk' } });

/**
 * The nested world's tasks: 1.1 touches all three repositories, moving the
 * submodule's pointer; 1.2, cut from 1.1, the project's alone; 2.1 the
 * clone's alone. Each has its branch in every repository, as a task's
 * worktree makes it there (12.7.10) — at its default branch where it
 * touches nothing.
 */
const NESTED_TASKS = Object.freeze({
  rates: { shown: '1.1', type: 'feat', title: 'Add rates', branch: 'feat/pay-1.1-add-rates' },
  show: { shown: '1.2', type: 'feat', title: 'Show rates', branch: 'feat/pay-1.2-show-rates' },
  cache: { shown: '2.1', type: 'fix', title: 'Cache rates', branch: 'fix/pay-2.1-cache-rates' },
});

/** The nested world's project, by its folder in the world, beside its submodule's upstream. */
const NESTED_PROJECT = 'project';

/**
 * The nested world built in `folder`: the project world, its code on
 * `main` with the submodule `ext` — cloned from its upstream beside the
 * project, its clone keeping no remote, so a copy's names only the copy —
 * and the clone `lib` in its folder (`NESTED`), each repository's base
 * tagged; the branches of `NESTED_TASKS`; and the unit in the tracker
 * (`trackUnit`) with each of them.
 * @param {string} folder
 * @returns {string} the project
 */
function buildNested(folder) {
  const { rates, show, cache } = NESTED_TASKS;
  const dir = setupFixtureAt(path.join(folder, NESTED_PROJECT));
  seed(dir, 'app.txt');
  const upstream = initRepo(path.join(folder, NESTED.ext.folder));
  seed(upstream, 'ext.txt');
  const ext = addSubmodule(dir, NESTED.ext.folder, upstream);
  git(ext, ['remote', 'remove', 'origin']);
  const lib = initRepo(path.join(dir, NESTED.lib.folder));
  git(lib, ['symbolic-ref', 'HEAD', `refs/heads/${NESTED.lib.into}`]);
  git(lib, ['config', 'init.defaultBranch', NESTED.lib.into]);
  seed(lib, 'lib.txt');
  fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), `/${NESTED.lib.folder}/\n`);
  for (const repo of [dir, ext, lib]) git(repo, ['tag', BASE]);
  const pointer = commitFiles(ext, rates.branch, 'main', { 'ext-rates.txt': 'rates\n' });
  commitFiles(lib, rates.branch, NESTED.lib.into, { 'lib-rates.txt': 'rates\n' });
  commitFiles(dir, rates.branch, 'main', { 'rates.txt': 'rates\n' }, { gitlinks: { [NESTED.ext.folder]: pointer } });
  commitFiles(dir, show.branch, rates.branch, { 'show.txt': 'show\n' });
  commitFiles(lib, cache.branch, NESTED.lib.into, { 'cache.txt': 'cache\n' });
  for (const [repo, task] of [[ext, show], [lib, show], [ext, cache], [dir, cache]]) git(repo, ['branch', task.branch, repo === lib ? NESTED.lib.into : 'main']);
  trackUnit(dir, Object.values(NESTED_TASKS));
  return dir;
}

/**
 * The project set to a landing driver, the setting committed on the state branch.
 * @param {string} dir @param {string} name
 */
function setLandingDriver(dir, name) {
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, `${JSON.stringify({ ...project, drivers: { ...project.drivers, landing: name } }, null, 2)}\n`);
  commitAll(dir, 'the landing driver');
}

/**
 * What a branch gained past the base, oldest first: each commit's subject,
 * the task its trailer names, and the paths it touched.
 * @param {string} dir @param {string} branch
 * @returns {{subject: string, task: string|null, paths: string[]}[]}
 */
function landedOn(dir, branch) {
  return git(dir, ['-c', 'i18n.logOutputEncoding=UTF-8', 'log', '--no-show-signature', '--reverse', '--name-only', '--format=%x1e%s%x1f%(trailers:key=Task,valueonly)', `${BASE}..${branch}`])
    .split('\x1e').slice(1).map((entry) => {
      const [head, ...paths] = entry.split('\n').filter(Boolean);
      const [subject, task] = head.split('\x1f');
      return { subject, task: task === '' ? null : task, paths };
    });
}

/**
 * A copy of the landing world at each call in a test of the calling file,
 * every copy removed after the test; the world built once per process, and
 * `ready` run on it then.
 * @param {string} prefix temp-directory prefix, so a leftover names its suite
 * @param {(dir: string) => void} [ready]
 * @returns {() => string}
 */
function useLandingWorld(prefix, ready = () => {}) {
  return copiesOf(prefix, fixtureFrom(prefix, (dir) => {
    buildLanding(dir);
    ready(dir);
  }));
}

/** A copy of the nested world: the project, and its submodule's and clone's checkouts. @typedef {{dir: string, ext: string, lib: string}} Nested */

/**
 * A copy of the nested world at each call, as `useLandingWorld` copies the
 * landing world, `ready` run on its project.
 * @param {string} prefix @param {(dir: string) => void} [ready]
 * @returns {() => Nested}
 */
function useNestedWorld(prefix, ready = () => {}) {
  const copy = copiesOf(prefix, folderFrom(prefix, (folder) => ready(buildNested(folder))));
  return () => {
    const dir = path.join(copy(), NESTED_PROJECT);
    return { dir, ext: path.join(dir, NESTED.ext.folder), lib: path.join(dir, NESTED.lib.folder) };
  };
}

/**
 * A landing driver's side of the conformance suites (tests/drivers/{name}/landing.cjs).
 * @typedef {{
 *   env: Record<string, string|undefined>, prepare: (dir: string) => void, nest: (dir: string, into: string) => void, on: (dir: string) => string,
 *   landed: (dir: string, into?: string) => {subject: string, task: string|null}[], holds: (dir: string, into?: string) => string[],
 *   defaultTip: (dir: string, into?: string) => string, opened: (dir: string) => string[], refuseMerge: (dir: string) => {env: Record<string, string>, undo: () => void},
 * }} DriverSide
 */

/**
 * What a nested conformance suite reads a driver by: its side; the verbs
 * under the side's environment; a copy of the nested world readied for it
 * at each call, built once per process (`useNestedWorld`); each
 * repository's checkout and default branch, by the name an answer gives it;
 * the tasks each default branch gained; and where the project's default
 * branch points the submodule.
 * @param {string} name the driver's
 * @param {string} prefix the copies' temp-directory prefix
 */
function nestedConformance(name, prefix) {
  /** @type {DriverSide} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const env = (/** @type {Record<string, string>} */ more) => ({ env: { ...side.env, ...more } });
  const project = useNestedWorld(prefix, (dir) => {
    side.prepare(dir);
    for (const { folder, into } of Object.values(NESTED)) side.nest(path.join(dir, folder), into);
  });
  /** @param {Nested} at @returns {Record<string, [string, string]>} */
  const repos = (at) => ({ '.': [at.dir, 'main'], ext: [at.ext, NESTED.ext.into], lib: [at.lib, NESTED.lib.into] });
  /** @param {Nested} at */
  const pointer = (at) => git(side.on(at.dir), ['rev-parse', `main:${NESTED.ext.folder}`]).trim();
  return {
    side,
    project,
    repos,
    pointer,
    /** A verb that must go through. @param {string} at @param {string[]} args */
    ok: (at, args) => ok(at, args, env({})),
    /** A verb that must refuse, its refusal. @param {string} at @param {string[]} args @param {Record<string, string>} [more] */
    refuses: (at, args, more = {}) => refuses(at, args, env(more)).error,
    /** The tasks each repository's default branch gained, oldest first. @param {Nested} at */
    tasksLanded: (at) => Object.fromEntries(Object.entries(repos(at)).map(([repo, [dir, into]]) => [repo, side.landed(dir, into).map(({ task }) => task)])),
    /** Whether the project's default branch points the submodule at its default branch's tip. @param {Nested} at */
    pointsAtSubmodule: (at) => pointer(at) === side.defaultTip(at.ext, NESTED.ext.into),
  };
}

/**
 * A copy of `world` at each call in a test of the calling file, every copy
 * removed after the test.
 * @param {string} prefix temp-directory prefix, so a leftover names its suite
 * @param {(dir: string) => string} world
 */
function copiesOf(prefix, world) {
  /** @type {string[]} */
  let made = [];
  afterEach(() => {
    made.forEach(cleanupFixture);
    made = [];
  });
  return () => {
    const dir = world(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    made.push(dir);
    return dir;
  };
}

/**
 * Every code branch at its tip — the state branch, which a first verb's
 * setting moves, left out — where HEAD is, and the checkout's state, in the
 * repository at `dir`.
 * @param {string} dir
 */
const repositoryAt = (dir) => ({
  branches: git(dir, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/', 'refs/leeway/']).split('\n').filter((line) => !line.startsWith('refs/heads/leeway-state ')),
  head: git(dir, ['rev-parse', 'HEAD']),
  status: git(dir, ['status', '--porcelain', '--untracked-files=all']),
});

/**
 * A call's refusal, every branch, HEAD and the checkout at `dir` where they
 * were before it.
 * @param {string} dir @param {string[]} args
 * @returns {string} the refusal
 */
function refusedMoving(dir, args) {
  const before = repositoryAt(dir);
  const { error } = refuses(dir, args);
  assert.deepStrictEqual(repositoryAt(dir), before, `${args.join(' ')} moved something`);
  return error;
}

/**
 * A call's answer where it finds its work done already, every branch, HEAD
 * and the checkout at `dir` where they were before it.
 * @param {string} dir @param {string[]} args
 * @returns {Record<string, any>} the answer, `already` held
 */
function alreadyMoving(dir, args) {
  const before = repositoryAt(dir);
  const answer = ok(dir, args);
  assert.deepStrictEqual([answer.already, repositoryAt(dir)], [true, before], `${args.join(' ')} found its work undone, or moved something`);
  return answer;
}

/** A command's words as the shell splits and unquotes them. @param {string} command @returns {string[]} */
function wordsOf(command) {
  return execFileSync('sh', ['-c', `printf '%s\\0' ${command}`], { encoding: 'utf8' }).split('\0').slice(0, -1);
}

/** Every command a refusal names in backquotes, in its order. @param {string} refusal @returns {string[]} */
const commandsOf = (refusal) => [...refusal.matchAll(/`([^`]+)`/g)].map((found) => found[1]);

/** Whether a rebase is stopped in the worktree at `tree`. @param {string} tree */
const rebaseStopped = (tree) => fs.existsSync(path.resolve(tree, git(tree, ['rev-parse', '--git-path', 'rebase-merge']).trim()));

/**
 * Every command a refusal names in backquotes, in its order, run as the
 * person would: a `land` verb through the engine, anything else in a shell
 * at `dir`, an editor git opens closed as it opens. A command that stops — a
 * rebase on a conflict — is handed to `settle`, which settles what stopped
 * it; without one, it fails the test. A remedy goes on with a rebase only
 * where it stopped, so `rebase --continue` runs while one is stopped where
 * it runs, each stop again handed to `settle`.
 * @param {string} dir @param {string} refusal @param {(dir: string, command: string) => void} [settle]
 */
function followRemedy(dir, refusal, settle) {
  const commands = commandsOf(refusal);
  assert.notStrictEqual(commands.length, 0, `the refusal names no command: ${refusal}`);
  const run = (/** @type {string} */ command) => {
    const ran = spawnSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' } });
    if (ran.status === 0) return;
    assert.ok(settle !== undefined, `${command} failed: ${ran.stderr}`);
    settle(dir, command);
  };
  for (const command of commands) {
    const going = /^git -C (.+) rebase --continue$/.exec(command);
    if (command.startsWith('land ')) ok(dir, wordsOf(command));
    else if (going === null) run(command);
    else for (let stops = 0; rebaseStopped(wordsOf(going[1])[0]); stops += 1) {
      assert.ok(stops < 5, `${command} never ends`);
      run(command);
    }
  }
}

/**
 * Where a remedy row leaves the repository: the verb it refuses and its
 * refusal, as it reads where the branch the row's remedy frees is held as
 * the state holds it; how the remedy is taken, if not by running its
 * commands; and the verb that then goes through, if not the same, with
 * what to check of it.
 * @typedef {{args: string[], refusal: string|((held: Held) => string), follow?: (dir: string, refusal: string) => void, then?: string[], check?: (dir: string, answer: any) => void}} Remedy
 */

/**
 * A remedy row: what it is, the repository it builds, the branch its remedy
 * moves or rewrites, if any, and whether it rewrites it — in a worktree it
 * makes, at a path the remedy names. Only a row that moves a branch is
 * followed where the person has that branch out, and only one that
 * rewrites it where nobody has: a branch moved by its ref alone changes no
 * worktree, and names no path.
 * @typedef {{name: string, setup: (dir: string) => Remedy, moves?: string, rewrites?: boolean}} Row
 */

/**
 * Who has the branch a remedy frees out, in the state a row is followed in:
 * the person's own checkout, a linked worktree at `path`, or nobody (null).
 * @typedef {{path: string, here: boolean}|null} Held
 */

/**
 * A state of the person's worktrees a remedy is followed in: the world it
 * is in, what it does to the repository once a row has built it, given the
 * branch the row's remedy moves — answering who then has it out — and
 * whether the person's config then signs every commit.
 * @typedef {{project: () => string, apply: (dir: string, moves?: string) => Held, signs: boolean}} PersonState
 */

/**
 * Every path a code branch has held at any commit that the worktree at
 * `tree` does not track, the state's aside.
 * @param {string} dir @param {string} tree
 * @returns {string[]}
 */
function pathsElsewhere(dir, tree) {
  const here = new Set(pathsOn(tree, 'HEAD'));
  const ever = git(dir, ['log', '--exclude=leeway-state', '--branches', '--format=', '--name-only']).split('\n');
  return [...new Set(ever)].filter((file) => file !== '' && !here.has(file) && !file.toLowerCase().startsWith('.leeway'));
}

/**
 * The worktree at `tree` given what a remedy could lose there: an edit to a
 * tracked file, and a file of its own, ignored, at every path a code branch
 * has held that it does not track.
 * @param {string} dir @param {string} tree
 */
function busy(dir, tree) {
  fs.writeFileSync(path.join(tree, 'app.txt'), 'my edit\n');
  fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
  for (const file of pathsElsewhere(dir, tree)) {
    fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
    fs.writeFileSync(path.join(tree, file), `my own ${file}\n`);
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), `/${file}\n`);
  }
}

/** Where the hostile state keeps the person's signing key: in the repository's own folder, so a copy carries it. @param {string} dir */
const signingKeyOf = (dir) => path.join(dir, '.git', 'person-key');

/** The signers a test checks a signature against, the person's key alone — never the person's config, which names none. @param {string} dir */
const signersOf = (dir) => `${signingKeyOf(dir)}.signers`;

/**
 * The person's signing key made in the world, with the signers file a test
 * checks its signatures against.
 * @param {string} dir
 */
function makeSigningKey(dir) {
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'the person', '-f', signingKeyOf(dir)]);
  fs.writeFileSync(signersOf(dir), `test@example.com ${fs.readFileSync(`${signingKeyOf(dir)}.pub`, 'utf8')}`);
}

/**
 * How each of `commits` is signed, checked against the person's key (git's
 * `%G?`): `G` signed by it, `N` not signed.
 * @param {string} dir @param {string[]} commits
 * @returns {string[]}
 */
function signatures(dir, commits) {
  if (commits.length === 0) return [];
  return git(dir, ['-c', `gpg.ssh.allowedSignersFile=${signersOf(dir)}`, 'log', '--no-show-signature', '--no-walk', '--format=%G?', ...commits]).split('\n').filter(Boolean);
}

/** How each commit a code branch gained past `before` is signed (`signatures`). @param {string} dir @param {Set<string>} before */
const signaturesPast = (dir, before) => signatures(dir, git(dir, ['rev-list', '--exclude=leeway-state', '--branches']).split('\n').filter((sha) => sha !== '' && !before.has(sha)));

/**
 * The person's config in the hostile state (landing-git.cjs, `PINNED`): each
 * setting the landing pins at a value that would change what it makes or
 * reads — the person signing every commit with a key made in the world,
 * written as git reads it but for `true`, no signer git can check, and
 * every log showing signatures — and the printed rebase's at values that
 * would move every branch it holds, merge by another strategy, or stop on a
 * landing that changes nothing; and the settings the landing leaves the
 * person's at values that would show, were they not harmless to it.
 * @param {string} dir @returns {[string, string][]}
 */
const HOSTILE = (dir) => [
  ['log.showSignature', 'true'], ['i18n.logOutputEncoding', 'ISO-8859-1'], ['i18n.commitEncoding', 'ISO-8859-1'],
  ['merge.renames', 'false'], ['merge.renameLimit', '1'], ['merge.directoryRenames', 'true'], ['merge.renormalize', 'true'], ['core.autocrlf', 'input'],
  ['merge.default', 'union'], ['pull.twohead', 'ours'],
  ['merge.verifySignatures', 'true'], ['branch.main.mergeOptions', '--squash'], ['rebase.updateRefs', 'true'], ['rebase.backend', 'apply'],
  ['gpg.format', 'ssh'], ['user.signingKey', signingKeyOf(dir)], ['commit.gpgSign', 'yes'],
  ['color.ui', 'always'], ['diff.noprefix', 'true'], ['diff.relative', 'true'], ['diff.external', 'false'], ['diff.ignoreSubmodules', 'all'],
  ['status.showUntrackedFiles', 'no'], ['status.branch', 'true'], ['status.short', 'true'], ['format.pretty', 'oneline'], ['log.decorate', 'full'],
  ['rebase.autoSquash', 'true'], ['rebase.autoStash', 'true'], ['rebase.rebaseMerges', 'true'], ['merge.autoStash', 'true'], ['merge.ff', 'false'],
  ['merge.conflictStyle', 'diff3'], ['rerere.enabled', 'true'], ['branch.autoSetupMerge', 'always'], ['push.autoSetupRemote', 'true'],
  ['worktree.guessRemote', 'true'], ['submodule.recurse', 'true'],
];

/**
 * Settings as a git config file holds them, each value quoted.
 * @param {[string, string][]} settings `section[.subsection].name` and value
 */
function configText(settings) {
  return settings.map(([key, value]) => {
    const [section, ...rest] = key.split('.');
    const name = rest.pop();
    const header = rest.length === 0 ? `[${section}]` : `[${section} "${rest.join('.')}"]`;
    return `${header}\n\t${name} = "${value.replace(/[\\"]/g, '\\$&')}"\n`;
  }).join('');
}

/**
 * What each state does to the repository, once a row has built it. Hostile:
 * the main checkout clean on the default branch, the person's config
 * hostile to the landing (`HOSTILE`) written into the repository's own.
 * Busy: the main checkout on a branch of its own, busy (`busy`), and
 * `commit.gpgSign` set nowhere, as for a person who never signs. Held here:
 * the main checkout has the branch the remedy frees out, busy. Held linked:
 * a linked worktree at a path with a space and a quote has it out, busy.
 * @type {Record<'hostile'|'busy'|'heldHere'|'heldLinked', (dir: string, moves?: string) => Held>}
 */
const PERSON_STATES = {
  hostile: (dir) => {
    fs.appendFileSync(path.join(dir, '.git', 'config'), configText(HOSTILE(dir)));
    return null;
  },
  busy: (dir) => {
    git(dir, ['checkout', '-q', '-b', 'mine']);
    git(dir, ['config', '--unset', 'commit.gpgSign']);
    busy(dir, dir);
    return null;
  },
  heldHere: (dir, moves) => {
    git(dir, ['checkout', '-q', /** @type {string} */ (moves)]);
    busy(dir, dir);
    return { path: dir, here: true };
  },
  heldLinked: (dir, moves) => {
    const tree = path.join(dir, '.git', 'the person\'s tree');
    git(dir, ['worktree', 'add', '-q', tree, /** @type {string} */ (moves)]);
    busy(dir, tree);
    return { path: tree, here: false };
  },
};

/**
 * A state a remedy is followed in, its world built once per suite — for the
 * busy state, at a path holding a space and a quote, which every path a
 * remedy names must survive; for the hostile state, holding the person's
 * signing key.
 * @param {keyof typeof PERSON_STATES} kind @param {string} prefix temp-directory prefix @param {(dir: string) => void} [ready]
 * @returns {PersonState}
 */
function personState(kind, prefix, ready = () => {}) {
  const signs = kind === 'hostile';
  const world = !signs ? ready : (/** @type {string} */ dir) => {
    ready(dir);
    makeSigningKey(dir);
  };
  const project = useLandingWorld(kind === 'busy' ? `${prefix}the person's path ` : prefix, world);
  return { project, apply: PERSON_STATES[kind], signs };
}

/**
 * The worktree at `tree` as the person has it: where HEAD is — the default
 * branch named alone, since a landing fast-forwards a clean checkout of it —
 * and, byte for byte, every file that differs from HEAD's tree: an edit,
 * staged or not, a deletion, a file not tracked, and a file ignored.
 * @param {string} tree
 */
function checkoutAt(tree) {
  const records = git(tree, ['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all', '--ignored=traditional']).split('\0');
  /** @type {Record<string, Buffer|null>} */
  const files = {};
  let branch = '';
  let head = '';
  for (let i = 0; i < records.length; i += 1) {
    const [kind, ...fields] = records[i].split(' ');
    if (kind === '#' && fields[0] === 'branch.head') branch = fields[1];
    else if (kind === '#' && fields[0] === 'branch.oid') head = fields[1];
    const file = { 1: fields.slice(7), 2: fields.slice(8), u: fields.slice(9), '?': fields, '!': fields }[kind]?.join(' ');
    if (kind === '2') i += 1;
    if (file !== undefined && !file.endsWith('/')) {
      files[file] = fs.existsSync(path.join(tree, file)) ? fs.readFileSync(path.join(tree, file)) : null;
    }
  }
  return { branch, head: branch === 'main' ? branch : head, files };
}

/** Every worktree of the repository at `dir` as the person has it, by its path, the state's aside. @param {string} dir */
function checkoutsAt(dir) {
  const trees = git(dir, ['worktree', 'list', '--porcelain']).split('\n\n').filter((block) => block !== '' && !block.includes('\nbranch refs/heads/leeway-state'));
  return Object.fromEntries(trees.map((block) => {
    const tree = block.split('\n')[0].slice('worktree '.length);
    return [tree, checkoutAt(tree)];
  }));
}

/**
 * The patch id of each commit a `git log` of `args` walks.
 * @param {string} dir @param {string[]} args
 * @returns {Map<string, string>} by commit
 */
function patchIds(dir, args) {
  const log = 'git -c diff.noprefix=false log --no-show-signature --no-color --no-ext-diff -p --diff-merges=first-parent --format="commit %H" "$@"';
  const out = execFileSync('sh', ['-c', `${log} | git patch-id --stable`, 'sh', ...args], { cwd: dir, encoding: 'utf8' });
  return new Map(out.split('\n').filter(Boolean).map((line) => {
    const [id, sha] = line.split(' ');
    return [sha, id];
  }));
}

/** Every commit a branch holds. @param {string} dir @returns {Set<string>} */
const onBranches = (dir) => new Set(git(dir, ['rev-list', '--branches']).split('\n').filter(Boolean));

/**
 * The commits a branch held at `before` that none holds now, nor any
 * commit making the same change or holding the same files — a commit left
 * on no branch — by subject.
 * @param {string} dir @param {Set<string>} before
 * @returns {string[]}
 */
function leftOnNoBranch(dir, before) {
  const now = onBranches(dir);
  const gone = [...before].filter((sha) => !now.has(sha));
  if (gone.length === 0) return [];
  const ids = patchIds(dir, ['--branches', ...gone]);
  const trees = new Map(git(dir, ['log', '--no-show-signature', '--format=%H %T', '--branches', ...gone]).split('\n').filter(Boolean).map((line) => line.split(' ')));
  const kept = (/** @type {Map<string, string>} */ of) => new Set([...of].filter(([sha]) => now.has(sha)).map(([, value]) => value));
  const [changes, held] = [kept(ids), kept(trees)];
  const lost = gone.filter((sha) => !changes.has(ids.get(sha) ?? '') && !held.has(trees.get(sha) ?? ''));
  return lost.length === 0 ? [] : git(dir, ['-c', 'i18n.logOutputEncoding=UTF-8', 'log', '--no-show-signature', '--no-walk', '--format=%h %s', ...lost]).split('\n').filter(Boolean);
}

/**
 * The test of a remedy row in a state of the person's worktrees: the verb
 * refuses as the row says for that state, moving nothing; its remedy is
 * taken; the verb then goes through. Every worktree is then as the person
 * left it, byte for byte — the one that had the branch out detached at the
 * commit it was at — with no worktree left behind, the stash as it was, no
 * commit left on no branch, and every commit the verb then made signed by
 * the person's key where their config signs every commit, and none where
 * it does not.
 * @param {PersonState} state @param {Row} row
 */
function followed(state, { setup, moves }) {
  return () => {
    const dir = state.project();
    const { args, refusal, follow = followRemedy, then = args, check = () => {} } = setup(dir);
    const held = state.apply(dir, moves);
    const before = { checkouts: checkoutsAt(dir), stash: git(dir, ['stash', 'list']), commits: onBranches(dir) };
    const expected = typeof refusal === 'string' ? refusal : refusal(held);
    assert.strictEqual(refusedMoving(dir, args), expected);
    follow(dir, expected);
    const followedAt = onBranches(dir);
    check(dir, ok(dir, then));
    if (held !== null) Object.assign(before.checkouts[held.path], { branch: '(detached)' });
    assert.deepStrictEqual(checkoutsAt(dir), before.checkouts, 'a worktree the person has changed');
    assert.strictEqual(git(dir, ['stash', 'list']), before.stash, 'the stash changed');
    assert.deepStrictEqual(leftOnNoBranch(dir, before.commits), [], 'a commit was left on no branch');
    const signature = state.signs ? 'G' : 'N';
    assert.deepStrictEqual(signaturesPast(dir, followedAt).filter((made) => made !== signature), [], `a landing made ${state.signs ? 'unsigned' : 'signed'}`);
  };
}

/** A commit as refusals name it. @param {string} sha */
const short = (sha) => sha.slice(0, 7);

/** A word as a remedy quotes it for the shell. @param {string} word */
const shellWord = (word) => (/^[\w@%+=:,./^-]+$/.test(word) ? word : `'${word.replace(/'/g, "'\\''")}'`);

/** The worktree a remedy makes to rebase a branch. @param {string} dir @param {string} branch */
const scratchOf = (dir, branch) => path.join(dir, '.git', 'leeway', branch.replace(/\//g, '-'));

/**
 * A remedy's way on for a branch it moves or rewrites, as it reads where
 * `held` has the branch out (landing-git.cjs, `remedy`): the branch kept as
 * it stands, the worktree that has it out detached, then `act`'s steps.
 * @param {string} dir @param {Held} held @param {string} branch @param {string[]} act
 * @param {{then?: string, note?: (kept: string) => string}} [opts]
 */
function way(dir, held, branch, act, { then = 'land again', note } = {}) {
  const at = short(git(dir, ['rev-parse', branch]).trim());
  const kept = `${branch}.kept-${at}`;
  const steps = [`keep ${branch} as it stands with \`git branch ${kept} ${at}\``];
  const notes = note === undefined ? [] : [note(kept)];
  if (held !== null) {
    const who = held.here ? 'your checkout' : `the worktree at ${held.path}`;
    steps.push(`detach ${who} from ${branch} with \`${held.here ? 'git' : `git -C ${shellWord(held.path)}`} switch --detach\`, which leaves it at ${at} with its edits`);
    notes.push(`switching ${who} back to ${branch} is yours, when you're ready`);
  }
  return `${[...steps, ...act].join(', then ')}, and ${then}${notes.map((line) => `; ${line}`).join('')}`;
}

/** A remedy's step moving a branch to a commit. @param {string} branch @param {string} to @param {string} how */
const moveStep = (branch, to, how) => [`${how} with \`git branch -f ${branch} ${to}\``];

/** Git as a remedy's rebase runs in the worktree made for it, merging by the replay's settings. @param {string} tree */
const rebasingIn = (tree) => `git -C ${shellWord(tree)} -c merge.renames=true -c merge.renameLimit=7000 -c merge.directoryRenames=conflict -c merge.renormalize=false -c merge.default=text`;

/**
 * A remedy's steps rebasing a branch in a worktree made for it, removed after.
 * @param {string} dir @param {string} branch @param {string} args @param {string} how
 */
function rebaseSteps(dir, branch, args, how) {
  const tree = scratchOf(dir, branch);
  const there = rebasingIn(tree);
  return [
    `${how} in a worktree of its own with \`git worktree add ${shellWord(tree)} ${branch}\``,
    `\`${there} rebase --merge --no-update-refs -s ort ${args}\`, settling each conflict at ${tree} as it stops and going on with \`${there} rebase --continue\``,
    `\`git worktree remove ${shellWord(tree)}\``,
  ];
}

/** The branch the main checkout has out, and its files' state. @param {string} dir */
const checkoutOf = (dir) => ({ head: git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), status: git(dir, ['status', '--porcelain']) });

/** How a refusal of a branch out in a worktree reads. @param {string} branch @param {string} tree @param {string} state @param {string} remedy */
const heldRefusal = (branch, tree, state, remedy) => `land: ${branch} is checked out at ${tree}${state}, so nothing moved — ${remedy}`;

/**
 * How a refusal of a commit no task of its phase reads.
 * @param {string} branch @param {number} phase @param {string} sha @param {string} subject @param {string} remedy
 */
const strayRefusal = (branch, phase, sha, subject, remedy) => `land: ${branch} holds ${short(sha)} "${subject}", which is no task of phase ${phase} — ${remedy}`;

/** How a refusal of a branch a rebase holds reads. @param {string} branch @param {string} tree @param {string} run git as the remedy runs it there */
const rebasingRefusal = (branch, tree, run) => `land: ${branch} is being rebased at ${tree}, so nothing moved — finish that rebase, or end it with \`${run} rebase --abort\`, and land again`;

/** A git command stopped, as a person's would. @param {string} tree @param {string[]} args */
function stops(tree, args) {
  assert.notStrictEqual(spawnSync('git', args, { cwd: tree, encoding: 'utf8' }).status, 0, `git ${args.join(' ')} went through`);
}

/**
 * A rebase of `main` in the worktree at `tree`, stopped on a conflict: main
 * gains an edit of app.txt there, `held` left on it, and a file after it,
 * and is rebased onto a branch editing app.txt too, moving `held` with it.
 * @param {string} dir @param {string} tree @param {string[]} [how] the rebase's own options
 */
function stoppedRebase(dir, tree, how = ['--update-refs']) {
  fs.writeFileSync(path.join(tree, 'app.txt'), 'main side\n');
  git(tree, ['commit', '-q', '-am', 'main edit']);
  git(tree, ['branch', 'held']);
  fs.writeFileSync(path.join(tree, 'more.txt'), 'more\n');
  git(tree, ['add', 'more.txt']);
  git(tree, ['commit', '-q', '-m', 'more']);
  commitFiles(dir, 'side', BASE, { 'app.txt': 'side side\n' });
  stops(tree, ['rebase', ...how, 'side']);
}

/** Every path a branch's tree holds. @param {string} dir @param {string} branch @returns {string[]} */
function pathsOn(dir, branch) {
  return git(dir, ['ls-tree', '-r', '--name-only', branch]).split('\n').filter(Boolean);
}

module.exports = {
  UNIT, BASE, TASKS, NESTED, NESTED_TASKS, TRACKER, openArgs, own, track, cutTask, commitFiles, mergeBack, buildLanding, buildNested, setLandingDriver, landedOn, pathsOn, useLandingWorld, useNestedWorld, nestedConformance,
  refusedMoving, alreadyMoving, commandsOf, followRemedy,
  personState, followed, signatures, short, shellWord, scratchOf, way, moveStep, rebasingIn, rebaseSteps, checkoutOf, heldRefusal, strayRefusal, rebasingRefusal, stops, stoppedRebase,
};
