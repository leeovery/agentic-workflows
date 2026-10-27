'use strict';

// The world every engine suite starts from: a git repository whose state
// worktree is in place at `.leeway/`, made by the machinery, and whose
// default branch holds one commit, the code tree's `.gitignore` naming it.
// Both first commits carry one fixed date, so a suite's own commits always
// come after them. One template is made per process and copied for each
// fixture, its state worktree relinked by the machinery's repair
// (`copyWorld`) — as is every richer world the harness makes once per
// process (`fixtureFrom`, engine-harness.cjs).

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { createState, repairStateWorktree } = require('../../skills/workflow-engine/scripts/domain/state-worktree.cjs');
const { STATE_DIR_NAME } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/**
 * The test identity, no signing, and no auto maintenance, on the repo at
 * `dir`. Git otherwise ends every commit and fetch by starting its
 * maintenance in the background, which outlives the call: a test pays for
 * the process, and a copy or removal of the repository meets its lock file
 * coming and going.
 * @param {string} dir
 */
function testIdentity(dir) {
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'maintenance.auto', 'false']);
}

/** When the template's two commits were made. */
const TEMPLATE_DATE = '2026-01-01T00:00:00Z';

/**
 * Run `fn` with git dating every commit at `date`.
 * @template T @param {string} date @param {() => T} fn @returns {T}
 */
function datedAt(date, fn) {
  const before = { GIT_AUTHOR_DATE: process.env.GIT_AUTHOR_DATE, GIT_COMMITTER_DATE: process.env.GIT_COMMITTER_DATE };
  process.env.GIT_AUTHOR_DATE = date;
  process.env.GIT_COMMITTER_DATE = date;
  try {
    return fn();
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** @type {string|null} */
let template = null;

/** The process's template world, made at its first fixture. @returns {string} */
function fixtureTemplate() {
  if (template !== null) return template;
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-template-')));
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, ['init', '-q', '--template=', '-b', 'main']);
  testIdentity(dir);
  fs.writeFileSync(path.join(dir, '.gitignore'), `${STATE_DIR_NAME}/\n`);
  datedAt(TEMPLATE_DATE, () => {
    git(dir, ['add', '.gitignore']);
    git(dir, ['commit', '-q', '-m', 'ignore the state']);
    createState(path.join(dir, STATE_DIR_NAME));
  });
  template = dir;
  return dir;
}

/**
 * A copy of the world at `from` at `dir`, the folder made where it is
 * missing, its state worktree relinked to the copy's own repository.
 * @param {string} from @param {string} dir
 * @returns {string} dir, symbolic links resolved — the path the engine names it by
 */
function copyWorld(from, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const at = fs.realpathSync(dir);
  fs.cpSync(from, at, { recursive: true });
  repairStateWorktree(path.join(at, STATE_DIR_NAME));
  return at;
}

/**
 * A fresh world at `dir`, the folder made where it is missing.
 * @param {string} dir
 * @returns {string} dir, symbolic links resolved — the path the engine names it by
 */
function setupFixtureAt(dir) {
  return copyWorld(fixtureTemplate(), dir);
}

/**
 * A fresh world in a temp folder.
 * @param {string} [prefix] temp-directory prefix, so a leftover names its suite
 * @returns {string} symbolic links resolved — the path the engine names it by
 */
function setupFixture(prefix = 'discovery-test-') {
  return setupFixtureAt(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function cleanupFixture(dir) {
  // Retries absorb the macOS teardown race (ENOTEMPTY while a just-exited
  // child's writes settle).
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/**
 * An absolute path in the world's state.
 * @param {string} dir @param {...string} segments
 * @returns {string}
 */
function statePath(dir, ...segments) {
  return path.join(dir, STATE_DIR_NAME, ...segments);
}

function createManifest(dir, name, data) {
  const manifest = {
    name,
    work_type: 'feature',
    status: 'in-progress',
    description: `Test: ${name}`,
    phases: {},
    ...data,
  };
  const mdir = statePath(dir, name);
  fs.mkdirSync(mdir, { recursive: true });
  fs.writeFileSync(path.join(mdir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function createFile(dir, relativePath, content) {
  const full = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content || '');
  return full;
}

module.exports = {
  STATE_DIR_NAME, TEMPLATE_DATE, datedAt, git, testIdentity, copyWorld, setupFixture, setupFixtureAt, cleanupFixture, statePath,
  createManifest, createFile,
};
