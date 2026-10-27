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
// Files go into git and come out of it as the bytes they are, whatever the
// person's config says: line endings are never converted (`core.autocrlf`),
// and the person's own attributes file (`core.attributesFile`), which can
// name a conversion for every path, is never read. Every ref a call moves is
// logged whatever the config says (`core.logAllRefUpdates`), so a worktree's
// HEAD log always says which commit its files were last put at.
//
// It also finds a repository's main checkout, the folder the workflows keep
// their state in, refusing the repositories and folders that have none; its
// refusals say so. It knows nothing else of the state.
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
const CONVERSION_OFF = Object.freeze(['-c', 'core.autocrlf=false', '-c', 'core.attributesFile=/dev/null']);
const REFS_LOGGED = Object.freeze(['-c', 'core.logAllRefUpdates=true']);

/**
 * A call's stdin, its time limit, variables layered over the isolated
 * environment, and a file descriptor its output is written to whole rather
 * than answered, for output of any size.
 * @typedef {{input?: string, timeoutMs?: number, env?: Record<string, string>, out?: number}} RunOptions
 */

/**
 * A runner bound to one cwd: `run` answers stdout, empty where it went to a
 * file, and throws a GitError on failure; `tryRun` answers null instead.
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
 * A git runner bound to `cwd`, isolated, with hooks and conversions off and
 * every ref update logged. The config's hooks are read once, at the runner's
 * first call.
 * @param {string} cwd
 * @returns {IsolatedGit}
 */
function isolatedGit(cwd) {
  /** @type {Record<string, string>|null} */
  let base = null;

  /** @param {string[]} args @param {RunOptions} opts */
  function spawn(args, { input, timeoutMs, env, out } = {}) {
    base ??= hooksOffEnv(cwd);
    return spawnSync('git', [...HOOKS_OFF, ...CONVERSION_OFF, ...REFS_LOGGED, ...args], {
      cwd, encoding: 'utf8', input, timeout: timeoutMs, env: { ...base, ...env }, maxBuffer: READ_BUDGET_BYTES, stdio: ['pipe', out ?? 'pipe', 'pipe'],
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
      return res.stdout ?? '';
    },
    tryRun(args, opts = {}) {
      const res = spawn(args, opts);
      return res.error || res.status !== 0 ? null : res.stdout ?? '';
    },
  };
}

/** @param {string} file @returns {string} */
function realpathOrSelf(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}

/** Whether `inner` is `outer` or lies below it. @param {string} inner @param {string} outer */
function within(inner, outer) {
  return inner === outer || inner.startsWith(`${outer}${path.sep}`);
}

/**
 * The git directory a gitfile names, absolute, or null where there is no
 * gitfile to read there.
 * @param {string} gitfile
 * @returns {string|null}
 */
function gitfileTarget(gitfile) {
  let text;
  try {
    text = fs.readFileSync(gitfile, 'utf8');
  } catch {
    return null;
  }
  const named = /^gitdir: (.+)$/m.exec(text);
  return named === null ? null : path.resolve(path.dirname(gitfile), named[1].trim());
}

/**
 * The gitfile a linked worktree's registration names as its worktree's —
 * absolute — or null for a git directory that is no linked worktree's.
 * @param {string} gitDir
 * @returns {string|null}
 */
function registeredGitfile(gitDir) {
  try {
    return path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'gitdir'), 'utf8').trim());
  } catch {
    return null;
  }
}

/**
 * Refuse a cwd in a copy of a linked worktree: its `.git` names a
 * registration whose own worktree is another folder, still linked to it —
 * the project folder was copied, and git reads the copy as the original's
 * worktree, in the original's repository. A worktree moved away from its
 * registration leaves no folder linked to it at the old place, and is not
 * refused.
 * @param {string} cwd @param {string} gitDir the cwd's own git directory
 */
function refuseCopiedWorktree(cwd, gitDir) {
  const dotgit = registeredGitfile(gitDir);
  if (dotgit === null) return;
  const holder = realpathOrSelf(path.dirname(dotgit));
  if (within(fs.realpathSync(cwd), holder)) return;
  const linked = gitfileTarget(dotgit);
  if (linked === null || realpathOrSelf(linked) !== realpathOrSelf(gitDir)) return;
  throw new Error(
    `${cwd} is in a copy of the worktree at ${holder}: git reads it as that worktree, in that repository, ` +
    'so the workflows read and write nothing through it — run from the copy\'s own project folder',
  );
}

/**
 * The repository's main checkout, from any cwd inside the repository — its
 * own folder, a linked worktree, or a folder below either: the folder
 * holding the common git directory. A repository whose common directory is
 * not a `.git` folder has no main checkout, and is refused; so is a copy of
 * a linked worktree, which git reads as the copied-from repository's.
 * @param {string} cwd
 * @returns {string} absolute, every symbolic link resolved
 */
function mainCheckout(cwd) {
  // `--path-format=absolute` is git 2.31's: the relative answer resolves
  // against the cwd it was asked from.
  const out = isolatedGit(cwd).tryRun(['rev-parse', '--git-common-dir', '--absolute-git-dir']);
  if (out === null) throw new Error(`${cwd} is not inside a git repository`);
  const [commonDir, gitDir] = out.trim().split('\n');
  const common = fs.realpathSync(path.resolve(cwd, commonDir));
  if (path.basename(common) !== '.git') {
    throw new Error(
      `the repository at ${common} has no main checkout — a bare repository, or a git directory kept apart from its ` +
      'work tree; the workflows keep their state in the main checkout',
    );
  }
  refuseCopiedWorktree(cwd, gitDir);
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

module.exports = { REPOSITORY_ENV, isolatedGit, mainCheckout, workTree, gitfileTarget, realpathOrSelf };
