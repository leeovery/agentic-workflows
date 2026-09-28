'use strict';

// ---------------------------------------------------------------------------
// Kernel: scoped git operations — stage a pathspec, commit it confined to
// exactly those paths, report the sha.
//
// Every commit is pathspec-confined: no engine commit can sweep a path
// outside its declared scope, so concurrent sessions never take each other's
// work under their own messages.
//
// Mechanism only: it knows nothing about work units or the inbox. Every call
// spawns `git` with an explicit cwd (the project root). Failures throw loud
// with git's own stderr; a clean scope is not a failure — `commitPathspec`
// reports it as `null` so callers can treat an empty pause as fine.
//
// Index-mutating operations (add, commit, rm) retry on `index.lock`
// contention — another process (a concurrent session, the user) holding
// git's own lock is transient, not fatal. The retry budget is short; a
// holder that outlives it surfaces git's original error.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const INDEX_RETRY_MS = 100;
const INDEX_BUDGET_MS = 5000;

// Block the thread for `ms` without burning CPU (Atomics.wait on a
// throwaway buffer is never notified, so it sleeps the full timeout).
/** @param {number} ms */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Test hook: WORKFLOWS_GIT_LOCK_BUDGET_MS overrides the retry budget.
function indexBudgetMs() {
  const env = Number(process.env.WORKFLOWS_GIT_LOCK_BUDGET_MS);
  return Number.isFinite(env) && env > 0 ? env : INDEX_BUDGET_MS;
}

// Whole-history and whole-tree listings (a signal's `git log`, a tree's
// `ls-tree -r`, an index's `ls-files --stage`) can run past spawnSync's 1 MiB
// default; a read past the budget is a failure like any other, never a
// truncated answer.
const READ_BUDGET_BYTES = 64 * 1024 * 1024;

/**
 * Run git and return stdout. Throws with git's stderr on a non-zero exit.
 * @param {string} cwd
 * @param {string[]} args
 * @param {Record<string, string>} [env] variables layered over the process's own
 * @param {string} [input] written to git's stdin
 * @returns {string}
 */
function git(cwd, args, env, input) {
  const res = spawnSync('git', args, {
    cwd, encoding: 'utf8', env: env && { ...process.env, ...env }, input, maxBuffer: READ_BUDGET_BYTES,
  });
  if (res.error) throw new Error(`git ${args[0]} failed: ${res.error.message}`);
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || `exit ${res.status}`).trim();
    throw new Error(`git ${args[0]} failed: ${detail}`);
  }
  return res.stdout;
}

/**
 * Run git and return stdout, or null on any failure — the tolerant read for
 * advisory probes that must never take their caller down. An empty result
 * (`''`) and a failed one (`null`) stay distinct.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string|null}
 */
function tryGit(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: READ_BUDGET_BYTES });
  if (res.error || res.status !== 0) return null;
  return res.stdout;
}

/** @param {string} message */
function isIndexLockError(message) {
  return message.includes('index.lock') &&
    /file exists|unable to create/i.test(message);
}

/**
 * Run an index-mutating git operation, retrying while another process holds
 * `.git/index.lock`.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function gitIndexed(cwd, args) {
  const deadline = Date.now() + indexBudgetMs();
  while (true) {
    try {
      return git(cwd, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isIndexLockError(message) || Date.now() >= deadline) throw err;
      sleepSync(INDEX_RETRY_MS);
    }
  }
}

/**
 * Whether the given pathspecs differ from HEAD (worktree or index).
 * @param {string} cwd
 * @param {string[]} specs
 * @returns {boolean}
 */
function hasChangesInPaths(cwd, specs) {
  return git(cwd, ['status', '--porcelain', '--', ...specs]).trim() !== '';
}

/**
 * Whether the directory holds any file, at any depth. An existing-but-empty
 * directory is a git no-man's-land: `git add` tolerates its pathspec silently
 * while `git commit -- <paths>` refuses it — the state every triage queue
 * reaches once its last concern's deletion is committed.
 * @param {string} dirAbs
 * @returns {boolean}
 */
function dirHasFiles(dirAbs) {
  /** @type {fs.Dirent[]} */
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (dirHasFiles(path.join(dirAbs, e.name))) return true;
    } else {
      return true;
    }
  }
  return false;
}

/**
 * Keep pathspecs the whole add+commit sequence will accept: a file on disk, a
 * directory with content, or a path holding index entries (a deleted-but-
 * tracked path still commits its deletions). An empty directory with no index
 * entries is dropped — see dirHasFiles.
 * @param {string} cwd @param {string[]} specs
 * @returns {string[]}
 */
function stageableSpecs(cwd, specs) {
  return specs.filter((p) => {
    const abs = path.join(cwd, p);
    if (fs.existsSync(abs)) {
      if (!fs.statSync(abs).isDirectory()) return true;
      if (dirHasFiles(abs)) return true;
    }
    const out = tryGit(cwd, ['ls-files', '--', p]);
    return out !== null && out.trim() !== '';
  });
}

/**
 * Whether the pathspec holds changes staged against HEAD. The one state
 * `stageableSpecs` cannot see: a `git rm` leaves the path in neither the
 * worktree nor the index, so only HEAD still knows it — and `git commit`
 * accepts that pathspec where `git add` refuses it.
 * @param {string} cwd @param {string} spec
 * @returns {boolean}
 */
function hasStagedDeletions(cwd, spec) {
  const out = tryGit(cwd, ['diff', '--cached', '--name-only', '--', spec]);
  return out !== null && out.trim() !== '';
}

/**
 * Commit exactly the named pathspecs — `git commit -- <paths>` builds a
 * temporary index from HEAD plus the worktree content of those paths, so
 * other processes' dirty or staged files are ignored and left untouched.
 * The `add` catches untracked files among the paths. Pathspecs git knows
 * nothing about are dropped: it refuses one that matches nothing, and a
 * scope naming a path its transaction never created is normal (an absent
 * triage queue, a work unit with no imports).
 * @param {string} cwd      project root
 * @param {string|string[]} pathspec
 * @param {string} message
 * @returns {string|null} the short commit sha, or null when the paths are clean
 */
function commitPathspec(cwd, pathspec, message) {
  const specs = Array.isArray(pathspec) ? pathspec : [pathspec];
  const addable = stageableSpecs(cwd, specs);
  if (addable.length > 0) gitIndexed(cwd, ['add', '--', ...addable]);
  const known = specs.filter((p) => addable.includes(p) || hasStagedDeletions(cwd, p));
  if (known.length === 0 || !hasChangesInPaths(cwd, known)) return null;
  gitIndexed(cwd, ['commit', '-m', message, '--', ...known]);
  return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
}

/**
 * A path in the git dir as git resolves it — a linked worktree's own for
 * per-worktree state — made absolute.
 * @param {string} cwd project root
 * @param {string} name
 * @returns {string}
 */
function gitPath(cwd, name) {
  const rel = git(cwd, ['rev-parse', '--git-path', name]).trim();
  return path.isAbsolute(rel) ? rel : path.join(cwd, rel);
}

// The operations git holds open across commands, by the marker each leaves
// in the git dir. A commit made while one is open takes on its state — a
// merge's second parent, a pick's authorship — and consumes the marker.
const OPERATION_MARKERS = [
  ['MERGE_HEAD', 'a merge'],
  ['CHERRY_PICK_HEAD', 'a cherry-pick'],
  ['REVERT_HEAD', 'a revert'],
  ['rebase-merge', 'a rebase'],
  ['rebase-apply', 'a rebase'],
];

/**
 * The operation git is in the middle of, as `{operation, marker}`, or null.
 * @param {string} cwd project root
 * @returns {{operation: string, marker: string}|null}
 */
function operationInProgress(cwd) {
  const open = OPERATION_MARKERS.find(([marker]) => fs.existsSync(gitPath(cwd, marker)));
  return open ? { operation: open[1], marker: open[0] } : null;
}

/**
 * Stage everything under `specs` — edits, new files, deletions — and commit
 * exactly those paths as the index then records them. A removal staged ahead
 * of the call (`git rm --cached`, the file left on disk) is what lands, where
 * `git commit -- <paths>` would read the file straight back from the working
 * tree: the commit is built from a scratch index holding HEAD with the paths'
 * entries taken from the real one, so whatever else is staged stays staged
 * and out of the commit. A pathspec git ignores is left to git, never forced
 * in, and one matching nothing is dropped. Refuses while a merge,
 * cherry-pick, revert or rebase is in progress, touching nothing.
 * @param {string} cwd project root
 * @param {string[]} specs
 * @param {string} message
 * @returns {string|null} the short commit sha, or null when the paths are clean
 */
function commitStaged(cwd, specs, message) {
  const open = operationInProgress(cwd);
  if (open) throw new Error(`${open.operation} is in progress (${open.marker}) — finish or abort it, then commit again`);
  const addable = stageableSpecs(cwd, specs).filter((p) => !isIgnored(cwd, p));
  if (addable.length > 0) gitIndexed(cwd, ['add', '--all', '--', ...addable]);
  return commitIndexEntries(cwd, specs, message);
}

/**
 * Whether an ignore rule holds the path out of git — untracked and matched,
 * so `git add` would refuse it by name.
 * @param {string} cwd @param {string} spec
 * @returns {boolean}
 */
function isIgnored(cwd, spec) {
  return tryGit(cwd, ['check-ignore', '-q', '--', spec]) !== null;
}

/**
 * Commit HEAD's tree with `specs` as the real index records them, from a
 * scratch index. Null when that is HEAD's tree, or when there is no HEAD and
 * the index records nothing under them.
 * @param {string} cwd @param {string[]} specs @param {string} message
 * @returns {string|null}
 */
function commitIndexEntries(cwd, specs, message) {
  const head = tryGit(cwd, ['rev-parse', '--verify', '-q', 'HEAD^{tree}']);
  const entries = git(cwd, ['ls-files', '--stage', '-z', '--', ...specs]);
  if (head === null && entries === '') return null;
  const env = { GIT_INDEX_FILE: gitPath(cwd, 'workflows-commit.index') };
  try {
    git(cwd, head === null ? ['read-tree', '--empty'] : ['read-tree', 'HEAD'], env);
    git(cwd, ['rm', '--cached', '-r', '-q', '--ignore-unmatch', '--', ...specs], env);
    if (entries !== '') git(cwd, ['update-index', '-z', '--index-info'], env, entries);
    if (head !== null && git(cwd, ['write-tree'], env).trim() === head.trim()) return null;
    git(cwd, ['commit', '-q', '-m', message], env);
  } finally {
    fs.rmSync(env.GIT_INDEX_FILE, { force: true });
  }
  return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
}

/**
 * Every path in the working tree that differs from HEAD — tracked
 * modifications and untracked, non-ignored files alike — project-relative.
 * NUL-separated so paths with spaces or non-ASCII bytes survive; a rename
 * record's second field (the source path) is consumed with it.
 * @param {string} cwd
 * @returns {string[]}
 */
function dirtyPaths(cwd) {
  const fields = git(cwd, ['status', '--porcelain', '-z']).split('\0');
  /** @type {string[]} */
  const paths = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i];
    if (entry.length < 4) continue;
    paths.push(entry.slice(3));
    if (entry[0] === 'R' || entry[0] === 'C') i += 1;
  }
  return paths;
}

/**
 * `git rm` the given files (stages the deletions). One call — git validates
 * every pathspec before removing anything.
 * @param {string} cwd
 * @param {string[]} paths
 */
function removeFiles(cwd, paths) {
  gitIndexed(cwd, ['rm', '-q', '--', ...paths]);
}

module.exports = { git, tryGit, gitPath, commitPathspec, commitStaged, dirtyPaths, stageableSpecs, hasStagedDeletions, removeFiles };
