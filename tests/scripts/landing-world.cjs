'use strict';

// The world the landing suites share (test-engine-land-verbs.cjs,
// test-engine-land-local.cjs, test-engine-land-remedies.cjs,
// test-engine-land-remedies-merge.cjs, test-engine-land-checkout.cjs,
// test-engine-land-worktrees.cjs, test-engine-landing-conformance.cjs): the
// project world, its default branch `main` holding the code a build starts
// from, tagged `landing-base`, and the task branches Claude would leave
// behind, each one commit off the branch it was cut from (`TASKS`). A branch
// is made, and merged back onto another as Claude merges a parallel task
// back, with no checkout touched — a scratch index over the commit it starts
// from — so the main checkout stays as the test left it. What landed is read
// off the default branch past the base. A suite takes a copy of the world per call
// (`useLandingWorld`), checks a refusal moved nothing in the repository
// (`refusedMoving`), and follows the remedy it names (`followRemedy`), a
// table of them a test a row (`followed`).

require('./hermetic-env.cjs');

const assert = require('node:assert');
const { afterEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { ok, git, statePath, commitAll, refuses, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');

const UNIT = 'pay';
const BASE = 'landing-base';

/** @typedef {{shown: string, type: string, title: string, branch: string, from: string, files: Record<string, string>}} Task */

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

/** The argv that opens a task. @param {Task} task @returns {string[]} */
const openArgs = (task) => ['land', 'open', UNIT, task.shown, '--type', task.type, '--title', task.title];

/**
 * Git under a scratch index of its own.
 * @param {string} dir @param {string} index @param {string[]} args @param {string} [input]
 */
function indexed(dir, index, args, input) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', input, env: { ...process.env, GIT_INDEX_FILE: index } }).trim();
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
  const index = path.join(dir, '.git', 'landing-world-index');
  try {
    indexed(dir, index, ['read-tree', from]);
    if (removed.length > 0) indexed(dir, index, ['update-index', '--force-remove', '--', ...removed]);
    const entries = Object.entries(files).flatMap(([file, text]) => {
      const blob = indexed(dir, index, ['hash-object', '-w', '--stdin'], text);
      return ['--cacheinfo', `100644,${blob},${file}`];
    });
    entries.push(...Object.entries(gitlinks).flatMap(([folder, commit]) => ['--cacheinfo', `160000,${commit},${folder}`]));
    indexed(dir, index, ['update-index', '--add', ...entries]);
    const tree = indexed(dir, index, ['write-tree']);
    const commit = indexed(dir, index, ['commit-tree', tree, '-p', from, '-m', message]);
    git(dir, ['update-ref', `refs/heads/${branch}`, commit]);
    return commit;
  } finally {
    fs.rmSync(index, { force: true });
  }
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
 * The landing world built into the project world at `dir`: the code on
 * `main`, committed in the main checkout, the base tagged, and every task's
 * branch.
 * @param {string} dir
 */
function buildLanding(dir) {
  fs.writeFileSync(path.join(dir, 'app.txt'), 'app\n');
  git(dir, ['add', 'app.txt']);
  git(dir, ['commit', '-q', '-m', 'the app']);
  git(dir, ['tag', BASE]);
  for (const task of Object.values(TASKS)) commitFiles(dir, task.branch, task.from, task.files);
}

/**
 * The project set to a landing driver, the setting committed on the state branch.
 * @param {string} dir @param {string} name
 */
function setLandingDriver(dir, name) {
  fs.writeFileSync(statePath(dir, 'manifest.json'), `${JSON.stringify({ drivers: { landing: name } }, null, 2)}\n`);
  commitAll(dir, 'the landing driver');
}

/**
 * What a branch gained past the base, oldest first: each commit's subject,
 * the task its trailer names, and the paths it touched.
 * @param {string} dir @param {string} branch
 * @returns {{subject: string, task: string|null, paths: string[]}[]}
 */
function landedOn(dir, branch) {
  return git(dir, ['log', '--reverse', '--name-only', '--format=%x1e%s%x1f%(trailers:key=Task,valueonly)', `${BASE}..${branch}`])
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
  const world = fixtureFrom(prefix, (dir) => {
    buildLanding(dir);
    ready(dir);
  });
  /** @type {string[]} */
  let made = [];
  afterEach(() => {
    made.forEach(cleanupFixture);
    made = [];
  });
  return () => {
    const dir = world();
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
  status: git(dir, ['status', '--porcelain']),
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

/** A command's words as the shell splits and unquotes them. @param {string} command @returns {string[]} */
function wordsOf(command) {
  return execFileSync('sh', ['-c', `printf '%s\\0' ${command}`], { encoding: 'utf8' }).split('\0').slice(0, -1);
}

/**
 * Every command a refusal names in backquotes, in its order, run as the
 * person would: a `land` verb through the engine, anything else in a shell
 * at `dir`, an editor git opens closed as it opens. A command that stops — a
 * rebase on a conflict — is handed to `settle`, which takes it on from
 * there; without one, it fails the test.
 * @param {string} dir @param {string} refusal @param {(dir: string, command: string) => void} [settle]
 */
function followRemedy(dir, refusal, settle) {
  const commands = [...refusal.matchAll(/`([^`]+)`/g)].map((found) => found[1]);
  assert.notStrictEqual(commands.length, 0, `the refusal names no command: ${refusal}`);
  for (const command of commands) {
    if (command.startsWith('land ')) {
      ok(dir, wordsOf(command));
      continue;
    }
    const run = spawnSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' } });
    if (run.status === 0) continue;
    assert.ok(settle !== undefined, `${command} failed: ${run.stderr}`);
    settle(dir, command);
  }
}

/**
 * Where a remedy row leaves the repository: the verb it refuses and its
 * refusal; how the remedy is taken, if not by running its commands; and
 * the verb that then goes through, if not the same, with what to check of
 * it.
 * @typedef {{args: string[], refusal: string, follow?: (dir: string, refusal: string) => void, then?: string[], check?: (dir: string, answer: any) => void}} Remedy
 */

/**
 * A state the person's own checkout is in when a remedy is followed: the
 * world it is in, and what it does to the main checkout there.
 * @typedef {{project: () => string, apply: (dir: string) => void}} PersonState
 */

/** The main checkout on a branch of its own. @param {string} dir */
const ownBranch = (dir) => git(dir, ['checkout', '-q', '-b', 'mine']);

/**
 * Every path a code branch tracks that the main checkout's HEAD does not.
 * @param {string} dir
 * @returns {string[]}
 */
function pathsElsewhere(dir) {
  const here = new Set(pathsOn(dir, 'HEAD'));
  const heads = git(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/']).split('\n').filter((head) => head !== '' && head !== 'leeway-state');
  return [...new Set(heads.flatMap((head) => pathsOn(dir, head)))].filter((file) => !here.has(file) && !file.toLowerCase().startsWith('.leeway'));
}

/**
 * A state a remedy is followed in, in a world built once per suite: the
 * main checkout clean on the default branch; on a branch of its own with an
 * edit to a tracked file; on a branch of its own with a file it ignores at
 * every path a code branch tracks; or clean, the project in a folder whose
 * path holds a space.
 * @param {keyof typeof PERSON_STATES} kind @param {string} prefix temp-directory prefix @param {(dir: string) => void} [ready]
 * @returns {PersonState}
 */
function personState(kind, prefix, ready) {
  const project = useLandingWorld(kind === 'spaced' ? `${prefix}spaced path ` : prefix, ready);
  return { project, apply: PERSON_STATES[kind] };
}

/** What each state of the person's checkout does to it. @type {Record<'clean'|'dirty'|'ignored'|'spaced', (dir: string) => void>} */
const PERSON_STATES = {
  clean: () => {},
  dirty: (dir) => {
    ownBranch(dir);
    fs.writeFileSync(path.join(dir, 'app.txt'), 'my edit\n');
  },
  ignored: (dir) => {
    ownBranch(dir);
    fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
    for (const file of pathsElsewhere(dir)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), `my own ${file}\n`);
      fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), `/${file}\n`);
    }
  },
  spaced: () => {},
};

/**
 * The person's own checkout: the branch it has out, its changes not
 * committed, and each file it does not track, ignored or not, with what it
 * holds.
 * @param {string} dir
 */
function personAt(dir) {
  const others = git(dir, ['ls-files', '-z', '--others', '--directory']).split('\0').filter((file) => file !== '' && !file.endsWith('/'));
  return {
    head: git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(),
    changes: git(dir, ['diff', 'HEAD']),
    others: Object.fromEntries(others.map((file) => [file, fs.readFileSync(path.join(dir, file), 'utf8')])),
  };
}

/**
 * The patch id of each commit a `git log` of `args` walks.
 * @param {string} dir @param {string[]} args
 * @returns {Map<string, string>} by commit
 */
function patchIds(dir, args) {
  const out = execFileSync('sh', ['-c', 'git log -p --diff-merges=first-parent --format="commit %H" "$@" | git patch-id --stable', 'sh', ...args], { cwd: dir, encoding: 'utf8' });
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
  const changes = new Set(patchIds(dir, ['--branches']).values());
  const trees = new Set(git(dir, ['log', '--format=%T', '--branches']).split('\n'));
  const goneIds = patchIds(dir, ['--no-walk', ...gone]);
  return gone
    .filter((sha) => !changes.has(goneIds.get(sha) ?? '') && !trees.has(git(dir, ['rev-parse', `${sha}^{tree}`]).trim()))
    .map((sha) => `${sha.slice(0, 7)} ${git(dir, ['log', '-1', '--format=%s', sha]).trim()}`);
}

/**
 * The test of a remedy row in one state of the person's checkout: the verb
 * refuses as the row says, moving nothing; its remedy is taken; the verb
 * then goes through; and the person's checkout is as they left it, its
 * branch, its edits, and its files not tracked, with no commit left on no
 * branch.
 * @param {PersonState} state @param {(dir: string) => Remedy} setup
 */
function followed(state, setup) {
  return () => {
    const dir = state.project();
    const { args, refusal, follow = followRemedy, then = args, check = () => {} } = setup(dir);
    state.apply(dir);
    const person = personAt(dir);
    const before = onBranches(dir);
    assert.strictEqual(refusedMoving(dir, args), refusal);
    follow(dir, refusal);
    check(dir, ok(dir, then));
    assert.deepStrictEqual(personAt(dir), person, 'the person\'s checkout changed');
    assert.deepStrictEqual(leftOnNoBranch(dir, before), [], 'a commit was left on no branch');
  };
}

/** A commit as refusals name it. @param {string} sha */
const short = (sha) => sha.slice(0, 7);

/** A word as a remedy quotes it for the shell. @param {string} word */
const shellWord = (word) => (/^[\w@%+=:,./^-]+$/.test(word) ? word : `'${word.replace(/'/g, "'\\''")}'`);

/** How a remedy keeps a commit on a branch of its own. @param {string} branch @param {string} sha */
const keepWith = (branch, sha) => `\`git branch ${branch}.kept-${short(sha)} ${short(sha)}\``;

/** The worktree a remedy makes to rewrite a branch out nowhere. @param {string} dir @param {string} branch */
const scratchOf = (dir, branch) => path.join(dir, '.git', 'leeway', branch.replace(/\//g, '-'));

/**
 * How a remedy rebases a branch out nowhere: in a worktree it makes for it,
 * removed after, and, for a rebase that stops, how it goes on.
 * @param {string} dir @param {string} branch @param {string} args @param {boolean} [settle]
 */
function rebaseAside(dir, branch, args, settle = false) {
  const tree = scratchOf(dir, branch);
  const there = `git -C ${shellWord(tree)}`;
  const go = settle ? [`settle each conflict at ${tree} as it stops and go on with \`${there} rebase --continue\``] : [];
  return [`\`git worktree add ${shellWord(tree)} ${branch}\``, `\`${there} rebase ${args}\``, ...go, `\`git worktree remove ${shellWord(tree)}\``].join(', then ');
}

/** The branch the main checkout has out, and its files' state. @param {string} dir */
const checkoutOf = (dir) => ({ head: git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), status: git(dir, ['status', '--porcelain']) });

/** How a refusal of a branch out in a worktree reads. @param {string} branch @param {string} tree @param {string} state @param {string} remedy */
const heldRefusal = (branch, tree, state, remedy) => `land: ${branch} is checked out at ${tree}${state}, so nothing moved — ${remedy}`;

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
  UNIT, BASE, TASKS, openArgs, commitFiles, mergeBack, buildLanding, setLandingDriver, landedOn, pathsOn, useLandingWorld, refusedMoving, followRemedy,
  personState, followed, short, shellWord, keepWith, scratchOf, rebaseAside, checkoutOf, heldRefusal, rebasingRefusal, stops, stoppedRebase,
};
