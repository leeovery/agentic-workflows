'use strict';

// ---------------------------------------------------------------------------
// Kernel: a verb's reads of git, each question asked once. Every git process
// the engine runs is asked through here (kernel/git, kernel/isolated-git),
// but isolated-git's read of the hooks' names, which it keeps by its own
// rule.
//
// Inside a verb (`keepingReads`, which isolated-git's `withVerbReads` opens),
// git's answer to a read of refs, objects, config or git's own paths is kept
// by the folder it ran in, its arguments, its stdin and every `GIT_*`
// variable it ran under, and the same question asked again is answered from
// it. A read is a command listed as one, kept (`KEPT`) or never kept
// (`NEVER_KEPT`), or a form of a command that reads in some forms only
// (`FORMS`). Never kept are the reads of the working tree and the index
// (`status`, `ls-files`, `diff`, `add --dry-run`), which the engine writes
// without git, of the clock, of a remote, and of the worktrees' list, which
// reads their folders; a read naming an index entry (`:path`) is never kept
// either. Any other call may write.
//
// Everything kept goes at once:
// - at a git call that may write, in any repository, and so at the hooks it
//   runs;
// - at any other process the engine starts, as it starts (kernel/spawn,
//   the one place it starts one);
// - at every wait: a sleep (kernel/process), and an await, since nothing is
//   kept past the verb's synchronous run;
// - at a lock taken, whose last holder may have written since
//   (kernel/manifest-io);
// - where the engine writes git's own files itself (state-worktree's
//   relink).
//
// Outside a verb nothing is kept. A value the engine works out from git and
// the working tree together — the project's repositories, walked
// (kernel/repos) — is kept and dropped as git's reads are (`keptRead`), so a
// change the verb makes to the tree without git shows at the next drop.
// ---------------------------------------------------------------------------

const { AsyncLocalStorage } = require('async_hooks');

/** @typedef {import('child_process').SpawnSyncReturns<string>} GitRun */
/** @typedef {'kept'|'read'|'write'} Kind */

// A merge-tree's answer is kept: the objects it writes are its merge's own,
// which no read before it could have asked of.
const KEPT = Object.freeze(['cat-file', 'cherry', 'for-each-ref', 'log', 'ls-tree', 'merge-base', 'merge-tree', 'rev-list', 'rev-parse', 'show', 'show-ref']);
const NEVER_KEPT = Object.freeze(['check-ignore', 'diff', 'ls-files', 'ls-remote', 'status', 'var']);

/** The arguments that are no option. @param {string[]} rest */
const operands = (rest) => rest.filter((arg) => !arg.startsWith('-'));

/** The arguments ahead of `--`, past which each is a path. @param {string[]} rest */
const ahead = (rest) => (rest.includes('--') ? rest.slice(0, rest.indexOf('--')) : rest);

/** Whether a `config` call reads, in its options' form or its subcommands'. @param {string[]} rest */
const configReads = (rest) => rest.some((arg) => /^--get(-all|-regexp|-urlmatch|-color|-colorbool)?(=|$)/.test(arg) || arg === '--list' || arg === '-l')
  || ['get', 'list'].includes(operands(rest)[0]);

/** Whether a `config` call reads a file of the working tree's, or an object's, over the repository's own config. @param {string[]} rest */
const configOfFile = (rest) => rest.some((arg) => /^(--file|-f|--blob)(=|$)/.test(arg));

/**
 * The commands that read in some forms only: each form's kind, by the
 * arguments after the command.
 * @type {Readonly<Record<string, (rest: string[]) => Kind>>}
 */
const FORMS = Object.freeze({
  add: (rest) => (ahead(rest).some((arg) => arg === '--dry-run' || arg === '-n') ? 'read' : 'write'),
  config: (rest) => {
    if (!configReads(rest)) return 'write';
    return configOfFile(rest) ? 'read' : 'kept';
  },
  'hash-object': (rest) => (rest.includes('-w') ? 'write' : 'read'),
  remote: (rest) => (operands(rest).length === 0 || rest[0] === 'get-url' ? 'kept' : 'write'),
  'symbolic-ref': (rest) => (rest.includes('-d') || rest.includes('--delete') || operands(rest).length > 1 ? 'write' : 'kept'),
  worktree: (rest) => (rest[0] === 'list' ? 'read' : 'write'),
});

/** Where the command stands in git's arguments, past the options ahead of it, or -1 where none does. @param {string[]} argv */
function commandAt(argv) {
  let at = 0;
  while (at < argv.length && argv[at].startsWith('-')) at += argv[at] === '-c' || argv[at] === '-C' ? 2 : 1;
  return at < argv.length ? at : -1;
}

/**
 * Whether a read names an index entry: an argument ahead of `--`, or a line
 * of its stdin, starting `:`.
 * @param {string[]} rest @param {string|undefined} input
 */
function namesIndexEntry(rest, input) {
  return ahead(rest).some((arg) => arg.startsWith(':')) || (input ?? '').split('\n').some((line) => line.startsWith(':'));
}

/**
 * What a git call is: a read kept, a read never kept, or a call that may
 * write. git asked of itself alone (`--version`) reads nothing.
 * @param {string[]} argv @param {string} [input]
 * @returns {Kind}
 */
function kindOf(argv, input) {
  const at = commandAt(argv);
  if (at === -1) return 'read';
  const [command, ...rest] = argv.slice(at);
  if (KEPT.includes(command)) return namesIndexEntry(rest, input) ? 'read' : 'kept';
  if (NEVER_KEPT.includes(command)) return 'read';
  return Object.hasOwn(FORMS, command) ? FORMS[command](rest) : 'write';
}

/** What a verb has kept. @typedef {{kept: Map<string, unknown>}} VerbReads */

/** @type {AsyncLocalStorage<VerbReads>} */
const verbReads = new AsyncLocalStorage();

/**
 * Run `fn` as one verb, its reads of git kept for it.
 * @template T @param {() => T} fn @returns {T}
 */
function keepingReads(fn) {
  return verbReads.run({ kept: new Map() }, fn);
}

/** Drop everything the running verb keeps, where one runs. */
function dropReads() {
  const reads = verbReads.getStore();
  if (reads !== undefined) reads.kept = new Map();
}

/**
 * What `read` answers under `key`: kept for the running verb where it keeps
 * one — taken once, and only where nothing was dropped while it read and
 * `keeps` takes it — and read afresh where no verb runs. What is kept goes
 * at the end of the verb's synchronous run, at the latest.
 * @template T @param {string} key @param {() => T} read @param {(value: T) => boolean} keeps
 * @returns {T}
 */
function held(key, read, keeps) {
  const reads = verbReads.getStore();
  if (reads === undefined) return read();
  // What the verb kept as the read began: a value read across a drop goes
  // with what was dropped.
  const { kept } = reads;
  if (kept.has(key)) return /** @type {T} */ (kept.get(key));
  const value = read();
  if (!keeps(value)) return value;
  if (kept.size === 0) queueMicrotask(() => kept.clear());
  kept.set(key, value);
  return value;
}

/**
 * What `read`, worked out from git and the working tree beside it, answers
 * for `name` at `cwd`: kept for the verb as a read of git is.
 * @template T @param {string} name @param {string} cwd @param {() => T} read
 * @returns {T}
 */
function keptRead(name, cwd, read) {
  return held(JSON.stringify([name, cwd]), read, () => true);
}

/**
 * The `GIT_*` variables of an environment, as a key takes them.
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]}
 */
function gitVariables(env) {
  return Object.keys(env).filter((name) => name.startsWith('GIT_')).sort().map((name) => `${name}=${env[name]}`);
}

/**
 * git's run of `argv` at `cwd` under `env`, `input` on its stdin, as `run`
 * makes it: inside a verb, a kept read's answer where the verb asked it
 * before, else `run`'s, kept where git gave one — never for a call whose
 * output goes to a file (`toFile`). A call that may write drops everything
 * kept first.
 * @param {string} cwd @param {string[]} argv
 * @param {{env: NodeJS.ProcessEnv, input?: string, toFile?: boolean}} call
 * @param {() => GitRun} run
 * @returns {GitRun}
 */
function asked(cwd, argv, { env, input, toFile = false }, run) {
  if (verbReads.getStore() === undefined) return run();
  const kind = kindOf(argv, input);
  if (kind === 'write') dropReads();
  if (kind !== 'kept' || toFile) return run();
  return held(JSON.stringify(['git', cwd, argv, input ?? null, gitVariables(env)]), run, (res) => res.error === undefined);
}

module.exports = { keepingReads, asked, keptRead, dropReads, kindOf };
