'use strict';

// The world the state-merge suites share
// (test-engine-state-merge-*.cjs): a temp folder per test (`useWorld`), the
// library's two machines on one remote with a base committed
// (`machinesSharing`), commits made on either side with the push failing, and
// the reads their assertions make: parents, status, the merge's kept stop
// and its leftovers. A `git` wrapper first on PATH
// (`gitWrapper`, `withPath`) stands in for another session's write, a
// remote moving, or a kill (`killedAfter`).

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { git, commitOnState, withEnv } = harness;

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH, openWorktree } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { isolatedGit } = require(path.join(SCRIPTS, 'kernel/isolated-git.cjs'));
const { checkLedger } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { LedgerChanged, checkLedgerCommit } = require(path.join(SCRIPTS, 'domain/ledger-check.cjs'));
const { pickStateMerge, stateMergeGateSurface } = require(MERGE);

/** The running test's folder, once the calling file has taken `useWorld`. @type {() => string} */
let world;

/** A temp folder for each test of the calling file: its getter. */
function useWorld() {
  world = useTempFolder('state-merge-');
  return world;
}

/** @typedef {import('./engine-harness.cjs').Machine} Machine */

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
  const out = pushFailing(machine, () => commitOnState(machine.root, files, message));
  assert.strictEqual(out.pushed, false, 'the push was meant to fail');
  return out.commit;
}

/**
 * The library's two machines on one remote, the project Fumi's, in the
 * running test's folder, `base` committed here, pushed, and fetched there,
 * both standing on it — there brought to it by the engine's own git, its
 * bytes never converted.
 * @param {Record<string, string>} [base]
 * @returns {ReturnType<typeof harness.twoMachines>}
 */
function machinesSharing(base = {}) {
  const machines = harness.twoMachines(world(), { name: 'fumi' });
  if (Object.keys(base).length > 0) {
    commitOnState(machines.here.root, base, 'state: base');
    isolatedGit(machines.there.main).run(['fetch', '-q', 'origin']);
    isolatedGit(machines.there.root).run(['merge', '-q', '--ff-only', `origin/${STATE_BRANCH}`]);
  }
  return machines;
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
  return withEnv({ PATH: `${dir}:${process.env.PATH}` }, fn);
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
  useWorld, blobId, treeId, parents, status, pushFailing, commitUnpushed, machinesSharing, entry, ledger, json, projectManifest, appendOnly, keptStopFile, shownChoice, pickShown, mergeLeftovers, gitWrapper, withPath, killedAfter,
};
