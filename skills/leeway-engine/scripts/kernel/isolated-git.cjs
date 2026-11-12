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
// A command no form of which fires a hook (`HOOKLESS`) runs without the
// names. Every other reads them from the config once per verb
// (`withVerbReads`): every runner the verb makes at one cwd shares the read,
// and a `config` call through any runner that may write, which may have
// changed them, has them read again; one that reads the config leaves them.
// Outside a verb a runner reads them at its first call that needs them, and
// again after its own `config` call that may write. No read outlives its
// verb, so a process running many verbs — the test harness, over many
// worlds — never hands one verb's read to another. Only a read git made is
// kept: one it could not make — in a folder whose link a moved project
// broke, which boot then relinks — is made again at the next call. A verb's
// other reads of git are kept for it too (kernel/git-reads).
//
// Files go into git and come out of it as the bytes they are, whatever the
// person's config says: line endings are never converted (`core.autocrlf`),
// and the person's own attributes file (`core.attributesFile`), which can
// name a conversion for every path, is never read. Every ref a call moves is
// logged whatever the config says (`core.logAllRefUpdates`), so a worktree's
// HEAD log always says which commit its files were last put at.
//
// No call waits without bound: each runs within the time limit it names, or
// `CALL_TIMEOUT_MS`, and one that runs past it fails, naming itself. A git
// that stalls — on a filter the repository configures, say — never holds the
// verb, and the writer lock with it, for ever.
//
// It also reads a repository's facts at a folder (`repoFacts`): where the
// folder sits in its work tree, the repository's git directories, where
// each operation git holds open leaves its marker and where a code commit
// takes its lock, and the ref HEAD names. One `rev-parse` asks them all;
// where HEAD names no commit, or the folder is in no work tree, that call
// fails, and the facts are asked apart — what any repository answers, where
// the folder sits, and HEAD's ref by `symbolic-ref`. They are git's reads,
// so kept for the verb and dropped as every read is (kernel/git-reads). A
// marker's path is a fact; whether the marker is there is the working
// tree's, read by its caller each time.
//
// From the facts it finds the work tree a folder is in, and a repository's
// main checkout, the folder the workflows keep their state in, refusing the
// repositories and folders that have none; its refusals say so. It knows
// nothing else of the state.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const { spawnSync } = require('child_process');
const { GitError, READ_BUDGET_BYTES, OPERATION_MARKERS } = require('./git.cjs');
const { keepingReads, asked, kindOf } = require('./git-reads.cjs');

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
// Whatever their arguments, these move no ref and write no index, and
// commit, check out, merge, rebase and push nothing.
const HOOKLESS = Object.freeze(['cat-file', 'config', 'for-each-ref', 'ls-tree', 'rev-list', 'rev-parse']);
const CONVERSION_OFF = Object.freeze(['-c', 'core.autocrlf=false', '-c', 'core.attributesFile=/dev/null']);
const REFS_LOGGED = Object.freeze(['-c', 'core.logAllRefUpdates=true']);

// The time limit of a call that names none: far past any the workflows make.
const CALL_TIMEOUT_MS = 300000;

/**
 * A call's stdin, its time limit (`CALL_TIMEOUT_MS` where it names none),
 * variables layered over the isolated environment, and a file descriptor its
 * output is written to whole rather than answered, for output of any size.
 * @typedef {{input?: string, timeoutMs?: number, env?: Record<string, string>, out?: number}} RunOptions
 */

/**
 * A runner bound to one cwd, `cwd`: `run` answers stdout, empty where it
 * went to a file, and throws a GitError on failure; `tryRun` answers null
 * instead, but for a call past its time limit, which throws for both.
 * @typedef {{
 *   cwd: string,
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
 * The hooks the config defines, by the cwd they were read at.
 * @typedef {Map<string, string[]>} HookReads
 */

/** The reads of the verb running, where one runs. @type {AsyncLocalStorage<HookReads>} */
const verbReads = new AsyncLocalStorage();

/**
 * Run `fn` as one verb: its runners share one read of the config's hooks at
 * each cwd, dropped once `fn` answers — once its promise settles, where it
 * answers one — and its reads of git are kept for it (kernel/git-reads).
 * @template T @param {() => T} fn @returns {T}
 */
function withVerbReads(fn) {
  return verbReads.run(new Map(), () => keepingReads(fn));
}

/**
 * The names of the hooks the config defines at `cwd` (`hook.<name>.command`):
 * none where it defines none — git's exit 1 — and null where git could not
 * read it.
 * @param {string} cwd @param {Record<string, string>} env
 * @returns {string[]|null}
 */
function configuredHookNames(cwd, env) {
  const res = spawnSync('git', ['config', '-z', '--name-only', '--get-regexp', '^hook\\..+\\.command$'], { cwd, env, encoding: 'utf8', timeout: CALL_TIMEOUT_MS });
  if (res.error || (res.status !== 0 && res.status !== 1)) return null;
  return res.stdout.split('\0').filter((key) => key !== '').map((key) => key.slice('hook.'.length, -'.command'.length));
}

/**
 * The hooks the config defines at `cwd`, as `reads` holds them, else read
 * and kept there — none where git could not read them, kept nowhere.
 * @param {HookReads} reads @param {string} cwd @param {Record<string, string>} env
 * @returns {string[]}
 */
function hooksAt(reads, cwd, env) {
  const held = reads.get(cwd);
  if (held !== undefined) return held;
  const names = configuredHookNames(cwd, env);
  if (names === null) return [];
  reads.set(cwd, names);
  return names;
}

/**
 * The variables disabling each hook named, through `GIT_CONFIG_COUNT`, which
 * takes a name holding `=` whole.
 * @param {string[]} names
 * @returns {Record<string, string>}
 */
function hooksOff(names) {
  /** @type {Record<string, string>} */
  const env = {};
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
 * every ref update logged. The environment is taken at the runner's first
 * call; the config's hooks are the verb's read (`withVerbReads`), or, where
 * no verb runs, the runner's own.
 * @param {string} cwd
 * @returns {IsolatedGit}
 */
function isolatedGit(cwd) {
  /** @type {Record<string, string>|null} */
  let base = null;
  /** @type {HookReads} */
  const own = new Map();

  /**
   * Run git, throwing where it ran past its time limit: a call cut short has
   * no answer, never a "no".
   * @param {string[]} args @param {RunOptions} opts
   */
  function spawn(args, { input, timeoutMs = CALL_TIMEOUT_MS, env, out }) {
    base ??= isolatedEnv();
    const reads = verbReads.getStore() ?? own;
    const hooks = HOOKLESS.includes(args[0]) ? {} : hooksOff(hooksAt(reads, cwd, base));
    const argv = [...HOOKS_OFF, ...CONVERSION_OFF, ...REFS_LOGGED, ...args];
    const runEnv = { ...base, ...hooks, ...env };
    const res = asked(cwd, argv, { env: runEnv, input, toFile: out !== undefined }, () => spawnSync('git', argv, {
      cwd, encoding: 'utf8', input, timeout: timeoutMs, env: runEnv, maxBuffer: READ_BUDGET_BYTES, stdio: ['pipe', out ?? 'pipe', 'pipe'],
    }));
    if (args[0] === 'config' && kindOf(args) === 'write') reads.clear();
    if (/** @type {NodeJS.ErrnoException|undefined} */ (res.error)?.code === 'ETIMEDOUT') {
      throw new GitError(`git ${args[0]} timed out after ${timeoutMs / 1000}s`);
    }
    return res;
  }

  return {
    cwd,
    run(args, opts = {}) {
      const res = spawn(args, opts);
      if (res.error) throw new GitError(`git ${args[0]} failed: ${res.error.message}`);
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

/**
 * A repository's facts at a folder (the header's):
 * - `place`, where the folder sits in its work tree: `top`, the tree's top,
 *   and `prefix`, the folder from there, `''` at the top, else ending in `/`
 *   — null in a folder of no work tree, a bare repository or a git
 *   directory;
 * - `commonDir`, the git directory every worktree of the repository shares,
 *   and `gitDir`, the folder's own worktree's;
 * - `markers`, where each operation's marker (kernel/git,
 *   `OPERATION_MARKERS`) would be, by its name, and `commitLock`, where a
 *   code commit takes its lock (domain/commit) — the worktree's own, each;
 * - `head`, the ref HEAD names, a branch with no commit yet among them, as
 *   `symbolic-ref -q HEAD` answers it, and `branch`, that ref less
 *   `refs/heads/` — both null on a detached HEAD.
 * Every path is absolute, every symbolic link in it resolved.
 * @typedef {{
 *   place: {top: string, prefix: string}|null,
 *   commonDir: string,
 *   gitDir: string,
 *   markers: Record<string, string>,
 *   commitLock: string,
 *   head: string|null,
 *   branch: string|null,
 * }} RepoFacts
 */

/** The lock a code commit takes in its worktree's git directory (domain/commit). */
const COMMIT_LOCK = 'leeway-commit.lock';

/** git's own paths the facts name: each operation's marker, then the commit lock. */
const FACT_PATHS = Object.freeze([...OPERATION_MARKERS.map(([marker]) => marker), COMMIT_LOCK]);

// The questions any repository answers, bare or not, one line each.
const DIRECTORIES = Object.freeze(['--path-format=absolute', '--git-common-dir', '--absolute-git-dir', ...FACT_PATHS.flatMap((name) => ['--git-path', name])]);
const DIRECTORY_LINES = 2 + FACT_PATHS.length;
// Answered in a work tree alone.
const PLACE = Object.freeze(['--show-toplevel', '--show-prefix']);
// Answered where HEAD names a commit alone: `HEAD` on a detached one. The
// `--` keeps a file named HEAD from answering for it.
const HEAD_REF = Object.freeze(['--symbolic-full-name', 'HEAD', '--']);

/**
 * The facts from git's answers: `lines`, the directories' answers, the
 * place's after them where `placed`, and the ref HEAD names, or null.
 * @param {string[]} lines @param {boolean} placed @param {string|null} head
 * @returns {RepoFacts}
 */
function factsOf(lines, placed, head) {
  const [commonDir, gitDir, ...paths] = lines.slice(0, DIRECTORY_LINES);
  const [top, prefix] = lines.slice(DIRECTORY_LINES);
  const { [COMMIT_LOCK]: commitLock, ...markers } = Object.fromEntries(FACT_PATHS.map((name, at) => [name, paths[at]]));
  return {
    place: placed ? { top, prefix } : null,
    commonDir,
    gitDir,
    markers,
    commitLock,
    head,
    branch: head === null ? null : head.replace(/^refs\/heads\//, ''),
  };
}

/**
 * The repository's facts at `cwd` (the header's), or null where git finds
 * no repository there.
 * @param {string} cwd
 * @returns {RepoFacts|null}
 */
function repoFacts(cwd) {
  const git = isolatedGit(cwd);
  const whole = git.tryRun(['rev-parse', ...DIRECTORIES, ...PLACE, ...HEAD_REF]);
  if (whole === null) return factsApart(git);
  const lines = whole.split('\n');
  const head = lines[DIRECTORY_LINES + PLACE.length];
  return factsOf(lines, true, head === 'HEAD' ? null : head);
}

/**
 * The facts asked apart, where asking them together failed: what any
 * repository answers, with where the folder sits where it is in a work
 * tree, then HEAD's ref; null where git finds no repository.
 * @param {IsolatedGit} git
 * @returns {RepoFacts|null}
 */
function factsApart(git) {
  const placed = git.tryRun(['rev-parse', ...DIRECTORIES, ...PLACE]);
  const answers = placed ?? git.tryRun(['rev-parse', ...DIRECTORIES]);
  if (answers === null) return null;
  const head = git.tryRun(['symbolic-ref', '-q', 'HEAD'])?.trim() || null;
  return factsOf(answers.split('\n'), placed !== null, head);
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

/** The refusal of a folder that is in no git repository at all. */
class NotARepository extends Error {}

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
  const facts = repoFacts(cwd);
  if (facts === null) throw new NotARepository(`${cwd} is not inside a git repository`);
  const common = fs.realpathSync(facts.commonDir);
  if (path.basename(common) !== '.git') {
    throw new Error(
      `the repository at ${common} has no main checkout — a bare repository, or a git directory kept apart from its ` +
      'work tree; the workflows keep their state in the main checkout',
    );
  }
  refuseCopiedWorktree(cwd, facts.gitDir);
  return path.dirname(common);
}

/**
 * The top of the work tree `cwd` sits in: the main checkout, or the linked
 * worktree it is.
 * @param {string} cwd
 * @returns {string} absolute, every symbolic link resolved
 */
function workTree(cwd) {
  const place = repoFacts(cwd)?.place ?? null;
  if (place === null) throw new Error(`${cwd} is not inside a git work tree`);
  return fs.realpathSync(place.top);
}

module.exports = {
  REPOSITORY_ENV, CALL_TIMEOUT_MS, isolatedGit, withVerbReads, repoFacts, NotARepository, mainCheckout, workTree, gitfileTarget, realpathOrSelf, within,
};
