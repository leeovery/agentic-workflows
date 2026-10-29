'use strict';

// The world the landing suites share (test-engine-land-*.cjs and
// test-engine-landing-conformance.cjs): the project world, its default
// branch `main` holding the code a build starts from, tagged
// `landing-base`, and the task branches Claude would leave behind, each one
// commit off the branch it was cut from (`TASKS`). A branch is made, and
// merged back onto another as Claude merges a parallel task back, with no
// checkout touched — a scratch index over the commit it starts from — so
// the main checkout stays as the test left it. What landed is read off the
// default branch past the base. A suite takes a copy of the world per call
// (`useLandingWorld`), checks a refusal moved nothing in the repository
// (`refusedMoving`), and follows the remedy it names (`followRemedy`); the
// remedy table (landing-remedies.cjs) is followed a row a test, in a state
// of the person's worktrees (`personState`, `followed`), against the way on
// it should read there (`way`).

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
 * is in, and what it does to the repository once a row has built it, given
 * the branch the row's remedy moves — answering who then has it out.
 * @typedef {{project: () => string, apply: (dir: string, moves?: string) => Held}} PersonState
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

/**
 * What each state does to the repository, once a row has built it. Clean:
 * the main checkout clean on the default branch. Busy: the main checkout on
 * a branch of its own, busy (`busy`). Held here: the main checkout has the
 * branch the remedy frees out, busy. Held linked: a linked worktree at a
 * path with a space and a quote has it out, busy.
 * @type {Record<'clean'|'busy'|'heldHere'|'heldLinked', (dir: string, moves?: string) => Held>}
 */
const PERSON_STATES = {
  clean: () => null,
  busy: (dir) => {
    git(dir, ['checkout', '-q', '-b', 'mine']);
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
 * remedy names must survive.
 * @param {keyof typeof PERSON_STATES} kind @param {string} prefix temp-directory prefix @param {(dir: string) => void} [ready]
 * @returns {PersonState}
 */
function personState(kind, prefix, ready) {
  const project = useLandingWorld(kind === 'busy' ? `${prefix}the person's path ` : prefix, ready);
  return { project, apply: PERSON_STATES[kind] };
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
 * The test of a remedy row in a state of the person's worktrees: the verb
 * refuses as the row says for that state, moving nothing; its remedy is
 * taken; the verb then goes through. Every worktree is then as the person
 * left it, byte for byte — the one that had the branch out detached at the
 * commit it was at — with no worktree left behind, the stash as it was,
 * and no commit left on no branch.
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
    check(dir, ok(dir, then));
    if (held !== null) Object.assign(before.checkouts[held.path], { branch: '(detached)' });
    assert.deepStrictEqual(checkoutsAt(dir), before.checkouts, 'a worktree the person has changed');
    assert.strictEqual(git(dir, ['stash', 'list']), before.stash, 'the stash changed');
    assert.deepStrictEqual(leftOnNoBranch(dir, before.commits), [], 'a commit was left on no branch');
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

/**
 * A remedy's steps rebasing a branch in a worktree made for it, removed after.
 * @param {string} dir @param {string} branch @param {string} args @param {string} how
 */
function rebaseSteps(dir, branch, args, how) {
  const tree = scratchOf(dir, branch);
  const there = `git -C ${shellWord(tree)}`;
  return [
    `${how} in a worktree of its own with \`git worktree add ${shellWord(tree)} ${branch}\``,
    `\`${there} rebase ${args}\`, settling each conflict at ${tree} as it stops and going on with \`${there} rebase --continue\``,
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
  UNIT, BASE, TASKS, openArgs, commitFiles, mergeBack, buildLanding, setLandingDriver, landedOn, pathsOn, useLandingWorld, refusedMoving, commandsOf, followRemedy,
  personState, followed, short, shellWord, scratchOf, way, moveStep, rebaseSteps, checkoutOf, heldRefusal, strayRefusal, rebasingRefusal, stops, stoppedRebase,
};
