'use strict';

// The world the state worktree's suites share (test-engine-state-worktree.cjs,
// test-engine-state-lock.cjs, test-engine-state-commit.cjs): a temp folder per
// test (`useWorld`); a repository of its own for the environment to point at
// (`elsewhereRepo`); the reads their assertions make: a repository as it
// looks from outside (`snapshot`), and whether the state ignores a path
// (`ignored`); and the time limit on a child of theirs (`CHILD_TIMEOUT_MS`,
// `childStderr`).

require('./hermetic-env.cjs');

const path = require('path');
const { git, initRepo, createFile, tip } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { WRITER_LOCK_TIMEOUT_MS } = require('../../skills/workflow-engine/scripts/kernel/manifest-io.cjs');

// Past twice the writer lock's wait, a child of these suites still running
// has hung: it is killed, and its test fails.
const CHILD_TIMEOUT_MS = 2 * WRITER_LOCK_TIMEOUT_MS;

/** The running test's folder, once the calling file has taken `useWorld`. @type {() => string} */
let world;

/** A temp folder for each test of the calling file: its getter. */
function useWorld() {
  world = useTempFolder('state-worktree-');
  return world;
}

/** A repo of its own with one commit, for the environment to point at. @param {string} name */
function elsewhereRepo(name = 'elsewhere') {
  const dir = initRepo(path.join(world(), name));
  createFile(dir, 'other.md', 'other\n');
  git(dir, ['add', 'other.md']);
  git(dir, ['commit', '-q', '-m', 'other']);
  return dir;
}

/** What a repo looks like from outside: its HEAD, its branches, its index. @param {string} dir */
function snapshot(dir) {
  return {
    head: git(dir, ['symbolic-ref', 'HEAD']).trim(),
    sha: tip(dir, 'HEAD'),
    branches: git(dir, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']),
    index: git(dir, ['ls-files', '--stage']),
  };
}

/** Whether git ignores the path in the state worktree. @param {string} root @param {string} rel */
function ignored(root, rel) {
  try {
    git(root, ['check-ignore', '-q', rel]);
    return true;
  } catch (err) {
    if (/** @type {{status?: number}} */ (err).status === 1) return false;
    throw err;
  }
}

/**
 * A child's stderr, led by the limit where the limit killed it.
 * @param {NodeJS.Signals|null} signal @param {string} stderr
 */
function childStderr(signal, stderr) {
  return signal ? `killed by ${signal} past ${CHILD_TIMEOUT_MS / 1000}s\n${stderr}` : stderr;
}

module.exports = { CHILD_TIMEOUT_MS, useWorld, elsewhereRepo, snapshot, ignored, childStderr };
