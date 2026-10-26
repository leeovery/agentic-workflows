'use strict';

// ---------------------------------------------------------------------------
// Kernel: git run apart from whatever repository the caller sits in. A
// process the engine runs in may carry another repository's environment —
// a git hook's `GIT_DIR` and `GIT_INDEX_FILE`, a parent git's `-c` settings —
// and the repository it runs in may carry hooks of its own. A call through
// `isolatedGit` reads neither: every variable that points git at a
// repository, its index or its objects is cleared, so the cwd alone names
// the repository, and no hook fires.
//
// Hooks go off two ways, as git finds them in two places: the hooks
// directory is pointed at nothing (`core.hooksPath`, every version), and
// each hook the config defines by name (git 2.54 on) is disabled by that
// name. The fsmonitor hook goes off with them.
//
// Mechanism only: it knows nothing about the workflows' state.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { GitError, READ_BUDGET_BYTES } = require('./git.cjs');

/**
 * The variables that point git at a repository, its index, its objects or
 * its config: git's own list (`git rev-parse --local-env-vars`), and the
 * namespace and quarantine a hook's environment can carry.
 * @type {readonly string[]}
 */
const REPOSITORY_ENV = Object.freeze([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_CONFIG',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_PARAMETERS',
  'GIT_DIR',
  'GIT_GRAFT_FILE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX',
  'GIT_QUARANTINE_PATH',
  'GIT_REPLACE_REF_BASE',
  'GIT_SHALLOW_FILE',
  'GIT_WORK_TREE',
]);

const HOOKS_OFF = Object.freeze(['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=']);

/**
 * A call's stdin, its time limit, and variables layered over the isolated
 * environment.
 * @typedef {{input?: string, timeoutMs?: number, env?: Record<string, string>}} RunOptions
 */

/**
 * A runner bound to one cwd: `run` answers stdout and throws a GitError on
 * failure, `tryRun` answers null instead.
 * @typedef {{
 *   run: (args: string[], opts?: RunOptions) => string,
 *   tryRun: (args: string[], opts?: RunOptions) => string|null,
 * }} IsolatedGit
 */

/**
 * The process's environment with every repository variable taken off.
 * @returns {Record<string, string>}
 */
function isolatedEnv() {
  /** @type {Record<string, string>} */
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined || REPOSITORY_ENV.includes(name)) continue;
    env[name] = value;
  }
  return env;
}

/**
 * The names of the hooks the config defines at `cwd` (`hook.<name>.command`),
 * none where git reads none.
 * @param {string} cwd @param {Record<string, string>} env
 * @returns {string[]}
 */
function configuredHookNames(cwd, env) {
  const res = spawnSync('git', ['config', '-z', '--name-only', '--get-regexp', '^hook\\..+\\.command$'], { cwd, env, encoding: 'utf8' });
  if (res.error || res.status !== 0) return [];
  return res.stdout.split('\0').filter((key) => key !== '').map((key) => key.slice('hook.'.length, -'.command'.length));
}

/**
 * The environment a call runs under: isolated, each configured hook disabled
 * by name through `GIT_CONFIG_COUNT`, which takes a name holding `=` whole.
 * @param {string} cwd
 * @returns {Record<string, string>}
 */
function hooksOffEnv(cwd) {
  const env = isolatedEnv();
  const names = configuredHookNames(cwd, env);
  if (names.length === 0) return env;
  env.GIT_CONFIG_COUNT = String(names.length);
  names.forEach((name, i) => {
    env[`GIT_CONFIG_KEY_${i}`] = `hook.${name}.enabled`;
    env[`GIT_CONFIG_VALUE_${i}`] = 'false';
  });
  return env;
}

/**
 * A git runner bound to `cwd`, isolated and with hooks off. The config's
 * hooks are read once, at the runner's first call.
 * @param {string} cwd
 * @returns {IsolatedGit}
 */
function isolatedGit(cwd) {
  /** @type {Record<string, string>|null} */
  let base = null;

  /** @param {string[]} args @param {RunOptions} opts */
  function spawn(args, { input, timeoutMs, env } = {}) {
    base ??= hooksOffEnv(cwd);
    return spawnSync('git', [...HOOKS_OFF, ...args], {
      cwd, encoding: 'utf8', input, timeout: timeoutMs, env: { ...base, ...env }, maxBuffer: READ_BUDGET_BYTES,
    });
  }

  return {
    run(args, opts = {}) {
      const res = spawn(args, opts);
      if (res.error) {
        const timedOut = /** @type {NodeJS.ErrnoException} */ (res.error).code === 'ETIMEDOUT';
        throw new GitError(timedOut
          ? `git ${args[0]} timed out after ${Number(opts.timeoutMs) / 1000}s`
          : `git ${args[0]} failed: ${res.error.message}`);
      }
      if (res.status !== 0) {
        throw new GitError(`git ${args[0]} failed: ${(res.stderr || res.stdout || `exit ${res.status}`).trim()}`);
      }
      return res.stdout;
    },
    tryRun(args, opts = {}) {
      const res = spawn(args, opts);
      return res.error || res.status !== 0 ? null : res.stdout;
    },
  };
}

/**
 * The repository's main checkout, from any cwd inside the repository — its
 * own folder, a linked worktree, or a folder below either: the folder
 * holding the common git directory. A repository whose common directory is
 * not a `.git` folder has no main checkout, and is refused.
 * @param {string} cwd
 * @returns {string} absolute, every symbolic link resolved
 */
function mainCheckout(cwd) {
  // `--path-format=absolute` is git 2.31's: the relative answer resolves
  // against the cwd it was asked from.
  const out = isolatedGit(cwd).tryRun(['rev-parse', '--git-common-dir']);
  if (out === null) throw new Error(`${cwd} is not inside a git repository`);
  const common = fs.realpathSync(path.resolve(cwd, out.trim()));
  if (path.basename(common) !== '.git') {
    throw new Error(
      `the repository at ${common} has no main checkout — a bare repository, or a git directory kept apart from its ` +
      'work tree; the workflows keep their state in the main checkout',
    );
  }
  return path.dirname(common);
}

/**
 * The top of the work tree `cwd` sits in: the main checkout, or the linked
 * worktree it is.
 * @param {string} cwd
 * @returns {string} absolute, every symbolic link resolved
 */
function workTree(cwd) {
  const out = isolatedGit(cwd).tryRun(['rev-parse', '--show-toplevel']);
  if (out === null) throw new Error(`${cwd} is not inside a git work tree`);
  return fs.realpathSync(out.trim());
}

module.exports = { REPOSITORY_ENV, isolatedGit, mainCheckout, workTree };
