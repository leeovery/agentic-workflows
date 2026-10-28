'use strict';

// The world the state-merge suites share
// (test-engine-state-merge-*.cjs): a temp folder per test (`useWorld`), a
// project on a bare remote and a second clone of it on "another machine"
// (`twoMachines`), commits made on either side, pushed or with the push
// failing, and the reads their assertions make: parents, status, the
// merge's kept stop and its leftovers. A `git` wrapper first on PATH
// (`gitWrapper`, `withPath`) stands in for another session's write, a
// remote moving, or a kill (`killedAfter`).

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { git, initRepo, testIdentity, bareRepo } = require('./engine-harness.cjs');
const { useTempFolder, createFile } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const {
  STATE_BRANCH, createState, createStateBranchFromRemote, addStateWorktree, withStateLock, commitState, openWorktree,
} = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { checkLedger } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { LedgerChanged, checkLedgerCommit } = require(path.join(SCRIPTS, 'domain/ledger-check.cjs'));
const { stateRoot } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));
const { pickStateMerge, stateMergeGateSurface } = require(MERGE);

/** The running test's folder, once the calling file has taken `useWorld`. @type {() => string} */
let world;

/** A temp folder for each test of the calling file: its getter. */
function useWorld() {
  world = useTempFolder('state-merge-');
  return world;
}

/** @typedef {{main: string, root: string}} Machine */

/** The id git names a blob of `text` by. @param {string} text */
function blobId(text) {
  return execFileSync('git', ['hash-object', '--stdin'], { encoding: 'utf8', input: text }).trim();
}

/** The id of a tree of files, written in the repository at `dir`. @param {string} dir @param {Record<string, string>} files */
function treeId(dir, files) {
  const listing = Object.entries(files).map(([name, text]) => `100644 blob ${blobId(text)}\t${name}\n`).join('');
  return execFileSync('git', ['mktree', '--missing'], { cwd: dir, encoding: 'utf8', input: listing }).trim();
}

/** A commit's parents. @param {string} dir @param {string} rev */
function parents(dir, rev) {
  return git(dir, ['rev-list', '--parents', '-n', '1', rev]).trim().split(' ').slice(1);
}

/** @param {string} dir */
function status(dir) {
  return git(dir, ['status', '--porcelain', '--untracked-files=all']);
}

/** Write `files` in the machine's state worktree and commit them there, pushing. @param {Machine} machine @param {Record<string, string>} files */
function commitOn(machine, files, message = 'state: a change') {
  for (const [rel, content] of Object.entries(files)) createFile(machine.root, rel, content);
  return withStateLock(machine.root, () => commitState(machine.root, Object.keys(files), message));
}

/** Run `fn` with the machine's pushes going nowhere, as a failed push leaves the state. @template T @param {Machine} machine @param {() => T} fn @returns {T} */
function pushFailing(machine, fn) {
  git(machine.main, ['config', 'remote.origin.pushurl', path.join(world(), 'nowhere.git')]);
  try {
    return fn();
  } finally {
    git(machine.main, ['config', '--unset', 'remote.origin.pushurl']);
  }
}

/** A commit made here whose push fails. @param {Machine} machine @param {Record<string, string>} files */
function commitUnpushed(machine, files, message = 'state: unpushed') {
  const out = pushFailing(machine, () => commitOn(machine, files, message));
  assert.strictEqual(out.pushed, false, 'the push was meant to fail');
  return out.commit;
}

/**
 * A project named Fumi with its state on a bare remote, `base` committed and
 * pushed there; and a second clone of it on "another machine", its state
 * worktree made from the remote's branch.
 * @param {Record<string, string>} [base]
 * @returns {{here: Machine, there: Machine, bare: string}}
 */
function twoMachines(base = {}) {
  const main = initRepo(path.join(world(), 'fumi'));
  createFile(main, 'README.md', '# Fumi\n');
  git(main, ['add', 'README.md']);
  git(main, ['commit', '-q', '-m', 'code']);
  const bare = bareRepo(path.join(world(), 'fumi-remote.git'));
  git(main, ['remote', 'add', 'origin', bare]);
  git(main, ['push', '-q', 'origin', 'main']);
  const here = { main, root: path.join(main, '.leeway') };
  createState(here.root);
  if (Object.keys(base).length > 0) commitOn(here, base, 'state: base');

  const other = path.join(world(), 'other-machine');
  git(world(), ['clone', '-q', bare, other]);
  testIdentity(other);
  const there = { main: other, root: stateRoot(other) };
  createStateBranchFromRemote(there.root);
  addStateWorktree(there.root);
  return { here, there, bare };
}

/** @param {Record<string, unknown>} fields */
function entry(fields) {
  return `${JSON.stringify(fields)}\n`;
}

/** A ledger of entries, one line each. @param {...string} ids */
function ledger(...ids) {
  return ids.map((id) => entry({ v: 1, id, event: 'decided' })).join('');
}

/** @param {unknown} value */
function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** The project manifest with one roadmap item on `horizon`, and `extra` merged in. @param {string} horizon @param {object} [extra] */
function projectManifest(horizon, extra = {}) {
  return json({ defaults: { plan_format: 'local' }, roadmap: { horizons: ['now', 'next', 'someday'], items: { 'a-lifetime-tier': { horizon, summary: 'Pay once' } } }, ...extra });
}

/**
 * Whether the engine's append-only check passes in the state worktree: the
 * ledger on disk starts byte for byte with the one the branch last committed
 * (5.4.3), and that one with its parent's (5.4.5).
 * @param {string} root
 */
function appendOnly(root) {
  try {
    checkLedger(root, []);
    checkLedgerCommit(/** @type {import('../../skills/workflow-engine/scripts/domain/state-worktree.cjs').OpenWorktree} */ (openWorktree(root)), `${STATE_BRANCH}^`, STATE_BRANCH);
    return true;
  } catch (err) {
    if (err instanceof LedgerChanged) return false;
    throw err;
  }
}

/**
 * Run `fn` with git tracing into a file, answering the git commands traced.
 * @template T @param {() => T} fn @returns {{result: T, traced: string[]}}
 */
function traced(fn) {
  const file = path.join(world(), 'git-trace.log');
  fs.rmSync(file, { force: true });
  process.env.GIT_TRACE = file;
  try {
    const result = fn();
    const log = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { result, traced: [...log.matchAll(/trace: built-in: git (.*)$/gm)].map((m) => m[1]) };
  } finally {
    delete process.env.GIT_TRACE;
  }
}

/** Where the merge keeps its stop: the state worktree's git dir. @param {string} root */
function keptStopFile(root) {
  return path.resolve(root, git(root, ['rev-parse', '--git-path', 'leeway-merge.json']).trim());
}

/** The identity of the choice the stop's screen shows, from its DATA section. @param {Machine} machine */
function shownChoice(machine) {
  const shown = /^choice: (\S+)$/m.exec(stateMergeGateSurface(machine.main, {}));
  assert.ok(shown !== null, 'the screen carries no choice');
  return shown[1];
}

/** Pick `key` at the stop's screen, as the person does: for the choice it shows. @param {Machine} machine @param {string} key */
function pickShown(machine, key) {
  return pickStateMerge(machine.root, key, shownChoice(machine));
}

/** The merge's own files left in the state worktree's git dir. @param {string} root */
function mergeLeftovers(root) {
  return fs.readdirSync(path.dirname(keptStopFile(root))).filter((name) => name.startsWith('leeway-merge'));
}

/**
 * A folder holding a `git` that runs the real one, then, after each call
 * whose arguments hold `marker`, runs the shell line `after`, with `$n` the
 * count of such calls so far and `$real` the real git.
 * @param {string} marker @param {string} after @returns {string}
 */
function gitWrapper(marker, after) {
  const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const dir = fs.mkdtempSync(path.join(world(), 'git-'));
  fs.writeFileSync(path.join(dir, 'git'), [
    '#!/bin/sh',
    `real="${real}"`,
    '"$real" "$@"',
    'status=$?',
    'case "$*" in',
    `  *"${marker}"*)`,
    `    n=$(( $(cat "${dir}/count" 2>/dev/null || echo 0) + 1 )); echo "$n" > "${dir}/count"`,
    `    ${after}`,
    '    ;;',
    'esac',
    'exit $status',
    '',
  ].join('\n'), { mode: 0o755 });
  return dir;
}

/** Run `fn` with `dir` first on PATH. @template T @param {string} dir @param {() => T} fn @returns {T} */
function withPath(dir, fn) {
  const was = process.env.PATH;
  process.env.PATH = `${dir}:${was}`;
  try {
    return fn();
  } finally {
    process.env.PATH = was;
  }
}

/**
 * Run `call` on the merge module in a process of its own, killed just after
 * its first git call whose arguments hold `marker`.
 * @param {string} root @param {string} call  a call on `merge`, given `root` @param {string} marker
 */
function killedAfter(root, call, marker) {
  const res = spawnSync('node', ['-e', `const merge = require(process.argv[1]); const root = process.argv[2]; ${call};`, MERGE, root], {
    encoding: 'utf8', env: { ...process.env, PATH: `${gitWrapper(marker, 'kill -9 "$PPID"')}:${process.env.PATH}` },
  });
  assert.strictEqual(res.signal, 'SIGKILL', `it was not killed after ${marker}: ${res.stderr}`);
}

module.exports = {
  useWorld, blobId, treeId, parents, status, commitOn, pushFailing, commitUnpushed, twoMachines, entry, ledger, json, projectManifest, appendOnly, traced, keptStopFile, shownChoice, pickShown, mergeLeftovers, gitWrapper, withPath, killedAfter,
};
