'use strict';

//
// old-layout.cjs — what the runtime knows of a project's layout from before
// Leeway, which the runner (migrate.cjs) and the engine ask, so no engine
// module names it. It stays free to change: the reshape's released steps
// keep their own reading of the layout (migrations/reshape/), and neither
// loads the other.
//
// Whether the project owes the reshape (`owed`): the main checkout's HEAD
// holds the project's `.workflows/` — in its own folder, nested in its
// repository or at the top — and `leeway-state` has no commit. A folder in
// no repository, or in one with no main checkout, owes nothing. Whether the
// reshape is owed or under way (`reshaping`): owed, or its state worktree
// checked out at the main checkout's `.leeway/` on a `leeway-state` with
// no commit yet, whatever the code branch holds — which the runner meets
// only while the migration runs, since boot restores a branch lost under
// its folder, or refuses it, before any run.
//
// The line the migrations record holds once the session has made the
// checks the chain before the reshape handed back, which the runner's stop
// before the move waits on and `engine migrate checked` writes
// (`CHECKS_DONE`).
//
// What the reshape leaves behind where boot ran in another checkout
// (`unmoved`): it moves the main checkout's copy of `.workflows/`, the one
// the default branch drops, so each file of the calling checkout's copy
// that differs from it, or that only one of the two holds, stays where it
// is — the files the old state ignores aside.
//
// Every git call runs with hooks off and the caller's repository
// environment cleared, so it names its repository by its folder alone.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OLD_STATE = '.workflows';
const STATE_DIR = '.leeway';
const CHECKS_DONE = 'old-chain-checks';
const STATE_BRANCH = 'leeway-state';

const REPOSITORY_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_CONFIG', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_DIR',
  'GIT_GRAFT_FILE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_NAMESPACE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX', 'GIT_QUARANTINE_PATH', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE', 'GIT_WORK_TREE',
];
const HOOKS_OFF = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor='];

/** A git call with hooks off, the caller's repository environment cleared. @param {string} cwd @param {string[]} args */
function git(cwd, args) {
  const env = { ...process.env };
  for (const name of REPOSITORY_ENV) delete env[name];
  const res = spawnSync('git', [...HOOKS_OFF, ...args], { cwd, encoding: 'utf8', env });
  return { ok: !res.error && res.status === 0, stdout: res.stdout || '' };
}

/** The main checkout of the repository `dir` is in, or null where it is in none. @param {string} dir @returns {string|null} */
function mainCheckout(dir) {
  const res = git(dir, ['rev-parse', '--git-common-dir']);
  if (!res.ok) return null;
  const common = fs.realpathSync(path.resolve(dir, res.stdout.trim()));
  return path.basename(common) === '.git' ? path.dirname(common) : null;
}

/** The project's folder as the main checkout holds it. @param {string} dir @param {string} main */
function projectInMain(dir, main) {
  return path.resolve(main, git(dir, ['rev-parse', '--show-prefix']).stdout.trim());
}

/** The main checkout of the repository `dir` is in, where its `leeway-state` has no commit; else null. @param {string} dir @returns {string|null} */
function unbornMain(dir) {
  const main = mainCheckout(dir);
  return main === null || git(main, ['rev-parse', '--verify', '--quiet', `refs/heads/${STATE_BRANCH}`]).ok ? null : main;
}

/** Whether the main checkout's HEAD holds the project's `.workflows/`. @param {string} projectDir @param {string} main */
function holdsOldState(projectDir, main) {
  const listed = git(projectInMain(projectDir, main), ['ls-tree', '--name-only', 'HEAD', '--', OLD_STATE]);
  return listed.ok && listed.stdout.trim() !== '';
}

/** Whether the state worktree at the main checkout's `.leeway/` has `leeway-state` checked out. @param {string} main */
function stateCheckedOut(main) {
  const root = path.join(main, STATE_DIR);
  if (!fs.existsSync(path.join(root, '.git'))) return false;
  const head = git(root, ['symbolic-ref', '--quiet', 'HEAD']);
  return head.ok && head.stdout.trim() === `refs/heads/${STATE_BRANCH}`;
}

/**
 * Whether the project at `projectDir` owes the reshape.
 * @param {string} projectDir
 * @returns {boolean}
 */
function owed(projectDir) {
  const main = unbornMain(projectDir);
  return main !== null && holdsOldState(projectDir, main);
}

/**
 * Whether the project at `projectDir` owes the reshape, or has it under way.
 * @param {string} projectDir
 * @returns {boolean}
 */
function reshaping(projectDir) {
  const main = unbornMain(projectDir);
  return main !== null && (stateCheckedOut(main) || holdsOldState(projectDir, main));
}

/** The files under `.workflows/` in the project's folder `project` the old state does not ignore, by their path there. @param {string} project */
function filesOf(project) {
  return git(project, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', OLD_STATE]).stdout.split('\0').filter(Boolean);
}

/** A file's bytes, or null where it is none. @param {string} file */
function bytesAt(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

/**
 * The files under `.workflows/` in the project's folder `here` the reshape
 * leaves where they are, by their path there: none where `here` is the
 * main checkout's.
 * @param {string} here
 * @returns {string[]}
 */
function unmoved(here) {
  const main = mainCheckout(here);
  if (main === null) return [];
  const project = projectInMain(here, main);
  const calling = fs.realpathSync(here);
  if (calling === project) return [];
  return [...new Set([...filesOf(calling), ...filesOf(project)])].sort().filter((rel) => {
    const [ours, theirs] = [bytesAt(path.join(calling, rel)), bytesAt(path.join(project, rel))];
    return ours === null || theirs === null ? ours !== theirs : !ours.equals(theirs);
  });
}

module.exports = { OLD_STATE, CHECKS_DONE, owed, reshaping, unmoved };
