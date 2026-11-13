'use strict';

//
// What the reshape's steps share — the guard (074), the legacy split
// (075–077, through split.cjs beside it) and the move (078): the layout's
// names before and after it, git as they run it, a file written whole, and
// the state worktree put in place. Released with them, it is frozen with
// them: the runtime's own knowledge of the layout before Leeway is the
// migrate skill's `old-layout.cjs`, and neither loads the other.
//
// The state worktree put in place for the reshape (`placeStateWorktree`):
// `.leeway/` in the main checkout, on an unborn `leeway-state`, locked as
// the engine locks it, its `.gitignore` written where it holds none, whole
// or not at all: its scratch is in the repository's git folder, which no
// commit takes, so the state's root holds the `.gitignore` alone. Git
// 2.40 has no `worktree add --orphan`, so the worktree is added detached
// with nothing checked out, and `switch --orphan` empties it onto the
// unborn branch. A plain `.leeway/` already there is set aside while the
// worktree is added, then put back inside it; a registration a removed
// `.leeway/` left behind is cleared first. A placement cut short is
// finished by the next: a worktree added but not switched is switched where
// it stands, and whatever the set-aside still holds goes back inside.
//
// Every git call runs with hooks off and the caller's repository
// environment cleared, so it names its repository by its folder alone.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OLD_STATE = '.workflows';
const STATE_DIR = '.leeway';
const SET_ASIDE = '.leeway-set-aside';
const STATE_BRANCH = 'leeway-state';
const STATE_LOCK_REASON = 'leeway state, do not remove';
const STATE_GITIGNORE = ['/.knowledge/', '/.cache/', '/.lock', '/.lock.*', '.manifest.json.*.tmp', '/.ledger.jsonl.*.tmp', ''].join('\n');

const REPOSITORY_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_CONFIG', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_DIR',
  'GIT_GRAFT_FILE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_NAMESPACE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX', 'GIT_QUARANTINE_PATH', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE', 'GIT_WORK_TREE',
];
const HOOKS_OFF = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor='];

/**
 * `file` written whole or not at all, for a step run again reads it back:
 * through a scratch in `scratch`, a folder on its disk that no commit takes,
 * renamed into place.
 * @param {string} scratch @param {string} file @param {string|Buffer} content @param {number} [mode]
 */
function writeWhole(scratch, file, content, mode) {
  const temp = path.join(scratch, `reshape-${process.pid}-${path.basename(file)}`);
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(temp, content);
  if (mode !== undefined) fs.chmodSync(temp, mode);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.renameSync(temp, file);
}

/** The process's environment, less the variables that point git at a repository. @returns {NodeJS.ProcessEnv} */
function withoutRepository() {
  const env = { ...process.env };
  for (const name of REPOSITORY_ENV) delete env[name];
  return env;
}

/** A git call with hooks off. @param {string} cwd @param {string[]} args @returns {{ok: boolean, stdout: string, stderr: string}} */
function git(cwd, args) {
  const res = spawnSync('git', [...HOOKS_OFF, ...args], { cwd, encoding: 'utf8', env: withoutRepository() });
  return { ok: !res.error && res.status === 0, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/** @param {string} cwd @param {string[]} args */
function mustGit(cwd, args) {
  const res = git(cwd, args);
  if (!res.ok) throw new Error(`git ${args.slice(0, 2).join(' ')} failed: ${res.stderr.trim()}`);
}

/** The main checkout of the repository `projectDir` is in, or null where it is in none. @param {string} projectDir @returns {string|null} */
function mainCheckout(projectDir) {
  const res = git(projectDir, ['rev-parse', '--git-common-dir']);
  if (!res.ok) return null;
  const common = fs.realpathSync(path.resolve(projectDir, res.stdout.trim()));
  return path.basename(common) === '.git' ? path.dirname(common) : null;
}

/** The project's folder as the main checkout holds it. @param {string} projectDir @param {string} main */
function projectInMain(projectDir, main) {
  return path.resolve(main, git(projectDir, ['rev-parse', '--show-prefix']).stdout.trim());
}

/** Whether the state branch has a commit. @param {string} main */
function stateBorn(main) {
  return git(main, ['rev-parse', '--verify', '--quiet', `refs/heads/${STATE_BRANCH}`]).ok;
}

/** Git's record of the worktree at `root`, or null where it holds none. @param {string} main @param {string} root */
function registration(main, root) {
  return git(main, ['worktree', 'list', '--porcelain']).stdout.split('\n\n').find((entry) => entry.startsWith(`worktree ${root}\n`)) ?? null;
}

/** @param {string} root */
function onStateBranch(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return false;
  const res = git(root, ['symbolic-ref', '--quiet', 'HEAD']);
  return res.ok && res.stdout.trim() === `refs/heads/${STATE_BRANCH}`;
}

/**
 * The state worktree added at `root` on an unborn `leeway-state`: switched
 * where a placement cut short added it, else added, a plain folder there
 * set aside first and a registration a removed folder left cleared.
 * @param {string} main @param {string} root @param {string} aside
 */
function addStateWorktree(main, root, aside) {
  const added = registration(main, root) !== null;
  if (!(added && fs.existsSync(path.join(root, '.git')))) {
    if (fs.existsSync(root)) fs.renameSync(root, aside);
    if (added) mustGit(main, ['worktree', 'remove', '--force', '--force', STATE_DIR]);
    mustGit(main, ['worktree', 'add', '--quiet', '--detach', '--no-checkout', STATE_DIR, 'HEAD']);
  }
  mustGit(root, ['switch', '--quiet', '--orphan', STATE_BRANCH]);
}

/** Whatever the set-aside holds put back inside `root`, and the set-aside gone. @param {string} aside @param {string} root */
function putBack(aside, root) {
  if (!fs.existsSync(aside)) return;
  for (const name of fs.readdirSync(aside)) fs.renameSync(path.join(aside, name), path.join(root, name));
  fs.rmdirSync(aside);
}

/**
 * The state worktree at `.leeway/` on an unborn `leeway-state`, locked as
 * the engine locks it, its `.gitignore` written where it holds none: put in
 * place, or found there.
 * @param {string} main @returns {string} the state worktree
 */
function placeStateWorktree(main) {
  const root = path.join(main, STATE_DIR);
  const aside = path.join(main, SET_ASIDE);
  if (!onStateBranch(root)) addStateWorktree(main, root, aside);
  putBack(aside, root);
  if (!/^locked(?: |$)/m.test(registration(main, root) ?? '')) mustGit(main, ['worktree', 'lock', '--reason', STATE_LOCK_REASON, STATE_DIR]);
  const ignore = path.join(root, '.gitignore');
  if (!fs.existsSync(ignore)) writeWhole(path.join(main, '.git'), ignore, STATE_GITIGNORE);
  return root;
}

module.exports = {
  OLD_STATE, STATE_DIR, STATE_GITIGNORE, REPOSITORY_ENV,
  git, mustGit, mainCheckout, projectInMain, stateBorn, placeStateWorktree, writeWhole,
};
