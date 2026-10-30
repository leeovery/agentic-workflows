'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the hook before Bash — Claude Code's hook before every shell
// command, which refuses what would lose the workflows' state or go round
// their doors (4.4.2, 6.3.7, 6.3.8, 12.9.8). Boot installs it in the
// project's settings beside the layout hook (domain/session-label), so it
// holds with or without the mod (6.3.10).
//
// It reads the command's text (kernel/shell-reader) and refuses, whatever
// the conversation is doing:
// - `git worktree unlock`, `remove` or `move` of the state worktree, a path
//   ending in `.leeway`;
// - `rm -r` of `.leeway`, `.leeway/`, `.leeway/.` or everything in it,
//   `.leeway/*` — a file under it may go;
// - deleting `leeway-state`: `git branch -d|-D|--delete`, `git update-ref
//   -d refs/heads/leeway-state`;
// - deleting it on the remote: `git push --delete|-d`, or a refspec
//   `:leeway-state`;
// - force-pushing it: `-f` or `--force…` with a refspec naming it, or a
//   refspec `+…leeway-state` — in the state worktree `HEAD` and `@` name
//   it, the branch checked out there, and a forced push naming no refspec
//   pushes it; a mirror push, which forces every branch; `--all` or
//   `--branches` with force;
// - a raw `git commit` in the state worktree — every state commit is the
//   engine's (6.2.5);
// - a command naming a file at user level the layout hook refuses Claude's
//   writes to (user-files.cjs, `userLevelRefusal`) — a conversation's
//   briefs, the brief hook's refusals, the trust log and its kin, Claude
//   Code's transcripts — by the names its words give it, a read among them,
//   since the text cannot tell one from a write;
// - a command writing to a file in the state only the engine writes — the
//   manifests, the ledger, `spec-review.json` — for the reason the layout
//   hook refuses Claude's own write to it, naming the verb (layout.cjs,
//   `engineRefusal`): an output redirection onto it (`>`, `>>`, `>|`, `&>`,
//   `<>`, `>&` a file, each with a descriptor), `tee`, an in-place `sed` or
//   `perl`, `mv` from or onto it, `cp`, `install` or `ln` onto it — their
//   last word, or, were it a folder, the file a source lands as there —
//   and `rm`, `unlink`, `truncate`, `touch` or `dd of=`. The file is read
//   from the command's folder, and is in the state by the part of its path
//   after the first `.leeway`, which the layout reads as the layout hook
//   reads Claude's own write. Reading one passes;
// and, while the conversation stdin's `session_id` names has a task in
// flight (6.3.12, conversation.cjs) — a subagent's call carries the
// conversation's — a raw `git commit` anywhere: a build commits through the
// commit door. A git command's folder is the one it runs in, moved by each
// `-C`, with the folders `--git-dir` and `--work-tree` name; it is in the
// state worktree where any of them has a `.leeway` folder in its path.
//
// Each refusal is one line on stderr with the way on, and exit 2, the code
// Claude Code blocks the call on. A pass says nothing and writes nothing.
// The decision is the text's, with one file read — the position, and only
// for a commit — and, for a write into the state alone, the layout loaded
// and whether the state's filesystem ignores case: it runs before every
// shell command, so it never asks git. A word that expands at run time — a
// glob among them — an alias, a script, or a command handed to another as
// text (`sh -c`, `eval`, `xargs`) is not seen, and passes. Where the text
// cannot say which folder a command runs in — after a `cd` to such a word,
// or `cd -` — it is not taken for the state worktree, and a relative path
// there names no file at user level or in the state; but an `rm -r` or a
// `git worktree` of a relative `.leeway` is refused there, its name enough.
// ---------------------------------------------------------------------------

const path = require('path');
const { simpleCommands } = require('../kernel/shell-reader.cjs');
const { STATE_DIR_NAME, STATE_BRANCH, BRANCH_REF } = require('../kernel/state-root.cjs');
const { tasksInFlight } = require('./conversation.cjs');
const { userLevelRefusal } = require('./user-files.cjs');

/** @typedef {import('../kernel/shell-reader.cjs').SimpleCommand} SimpleCommand */
/** @typedef {{unit: string, task: string}} InFlight */

/** The tools the hook stands before, as the settings' matcher names them. */
const SHELL_HOOK_TOOLS = ['Bash'];

/** Why each command of the state's is refused, with the way on. */
const REFUSED = Object.freeze({
  worktree: `unlocking, moving or removing the state worktree (${STATE_DIR_NAME}) is refused — it holds the workflows' state, and boot keeps it locked where it is`,
  removal: `removing ${STATE_DIR_NAME} is refused — it is the state worktree, holding the workflows' state; a stray file in it is removed by its own name`,
  branch: `deleting the state branch (${STATE_BRANCH}) is refused — it holds the workflows' state, which only the engine changes`,
  remote: `deleting ${STATE_BRANCH} on the remote is refused — it holds the workflows' state, and boot restores a lost local branch from it`,
  force: `force-pushing ${STATE_BRANCH} is refused — the engine pushes it after every commit, and a force would drop what another clone pushed; push your own branches by name`,
  stateCommit: `a raw git commit in the state worktree (${STATE_DIR_NAME}) is refused — every state commit is the engine's, made by the verb that changes the state`,
});

/** Why a raw commit is refused during a build, with the door's call for each task in flight. @param {InFlight[]} tasks */
function buildCommit(tasks) {
  const named = tasks.map(({ unit, task }) => `task ${task} of ${unit}`).join(', ');
  const doors = tasks.map(({ unit, task }) => `\`engine commit --paths <file>… --task ${unit} ${task} -m "<message>"\``).join(' or ');
  return `a raw git commit is refused while ${named} ${tasks.length === 1 ? 'is' : 'are'} in flight — the build commits through the commit door: ${doors}`;
}

/** What a refusal of a file at user level says beyond the layout hook's reason. */
const NAMED = 'a shell command naming it is refused, and the Read and Grep tools read it';

/** git's global options that take the next word as their value, where it carries none after `=`. */
const VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix']);

/** Those of them naming a folder git acts in, beside the one it runs in. */
const FOLDERS = new Set(['--git-dir', '--work-tree']);

/**
 * @typedef {object} GitCommand
 * @property {string|null} folder the folder it acts in
 * @property {(string|null)[]} folders that one, and those `--git-dir` and `--work-tree` name
 * @property {string|null} sub its subcommand
 * @property {(string|null)[]} args the words after it
 */

/** `word` read from `base`; null where the text cannot say where it is. @param {string|null} base @param {string|null} word */
function within(base, word) {
  if (word === null) return null;
  if (path.isAbsolute(word)) return path.resolve(word);
  return base === null ? null : path.resolve(base, word);
}

/**
 * A git command's global options read before its subcommand; null where the
 * command is not git's.
 * @param {SimpleCommand} command @returns {GitCommand|null}
 */
function gitCommand({ words, cwd }) {
  const [name, ...rest] = words;
  if (typeof name !== 'string' || path.basename(name) !== 'git') return null;
  let folder = cwd;
  /** @type {(string|null)[]} */
  const named = [];
  let at = 0;
  for (let word = rest[0]; typeof word === 'string' && word.startsWith('-'); word = rest[++at]) {
    const [option, attached] = word.startsWith('--') && word.includes('=') ? [word.slice(0, word.indexOf('=')), word.slice(word.indexOf('=') + 1)] : [word, undefined];
    if (!VALUED.has(option)) continue;
    const value = attached ?? rest[++at] ?? null;
    if (option === '-C') folder = within(folder, value);
    else if (FOLDERS.has(option)) named.push(within(folder, value));
  }
  return { folder, folders: [folder, ...named], sub: rest[at] ?? null, args: rest.slice(at + 1) };
}

/** Whether a git command acts in the state worktree. @param {GitCommand} git */
function inStateWorktree({ folders }) {
  return folders.some((folder) => folder !== null && folder.split(path.sep).includes(STATE_DIR_NAME));
}

/** The words that are no option, every word after `--` among them. @param {(string|null)[]} args @returns {string[]} */
function operandsOf(args) {
  const end = args.indexOf('--');
  const operand = (/** @type {string|null} */ word, /** @type {number} */ at) => word !== null && ((end >= 0 && at > end) || !word.startsWith('-'));
  return /** @type {string[]} */ (args.filter(operand));
}

/**
 * Whether the options before any `--` hold one of `letters` — alone or in a
 * cluster of short options — or a long option opening on one of `longs`.
 * @param {(string|null)[]} args @param {string} letters @param {string[]} longs
 */
function carries(args, letters, longs) {
  const end = args.indexOf('--');
  return (end < 0 ? args : args.slice(0, end)).some((word) => word !== null && (
    (/^-[A-Za-z]+$/.test(word) && [...letters].some((letter) => word.includes(letter)))
    || longs.some((long) => word.startsWith(long))));
}

/**
 * Whether `word`, read from `base`, names the state worktree's folder
 * itself, or everything in it.
 * @param {string|null} base @param {string} word
 */
function namesStateFolder(base, word) {
  const at = within(base, word) ?? path.normalize(word);
  return path.basename(path.basename(at) === '*' ? path.dirname(at) : at) === STATE_DIR_NAME;
}

/** @param {GitCommand} git */
function worktreeRefusal({ folder, args }) {
  const [action, ...rest] = args;
  const acts = action === 'unlock' || action === 'remove' || action === 'move';
  return acts && operandsOf(rest).some((word) => namesStateFolder(folder, word)) ? REFUSED.worktree : null;
}

/** @param {GitCommand} git */
function branchRefusal({ args }) {
  return carries(args, 'dD', ['--delete']) && operandsOf(args).includes(STATE_BRANCH) ? REFUSED.branch : null;
}

/** @param {GitCommand} git */
function refRefusal({ args }) {
  return carries(args, 'd', []) && operandsOf(args).includes(BRANCH_REF) ? REFUSED.branch : null;
}

/** The names a refspec gives the branch checked out where git runs. */
const CHECKED_OUT = new Set(['HEAD', '@']);

/**
 * A push's refspec: whether it forces, and where it pushes from and to —
 * `HEAD` and `@` read as `here`, the branch checked out, where it is known.
 * @param {string} word @param {string|null} here
 * @returns {{forced: boolean, from: string, to: string}}
 */
function refspec(word, here) {
  const forced = word.startsWith('+');
  const spec = forced ? word.slice(1) : word;
  const colon = spec.indexOf(':');
  const [from, to] = (colon < 0 ? [spec, spec] : [spec.slice(0, colon), spec.slice(colon + 1)])
    .map((name) => (here !== null && CHECKED_OUT.has(name) ? here : name));
  return { forced, from, to };
}

/** @param {GitCommand} git */
function pushRefusal(git) {
  const { args } = git;
  const here = inStateWorktree(git) ? STATE_BRANCH : null;
  const specs = operandsOf(args).slice(1).map((word) => refspec(word, here));
  const ours = specs.filter(({ to }) => to === STATE_BRANCH || to === BRANCH_REF);
  if (ours.length > 0 && (carries(args, 'd', ['--delete']) || ours.some(({ from }) => from === ''))) return REFUSED.remote;
  const force = carries(args, 'f', ['--force']);
  const forcesOurs = ours.some(({ forced }) => forced || force)
    || carries(args, '', ['--mirror'])
    || (force && (carries(args, '', ['--all', '--branches']) || (specs.length === 0 && here !== null)));
  return forcesOurs ? REFUSED.force : null;
}

/** @param {GitCommand} git @param {() => InFlight[]} inFlight */
function commitRefusal(git, inFlight) {
  if (inStateWorktree(git)) return REFUSED.stateCommit;
  const tasks = inFlight();
  return tasks.length === 0 ? null : buildCommit(tasks);
}

/**
 * Each refusal of a git command, by its subcommand.
 * @type {Readonly<Record<string, (git: GitCommand, inFlight: () => InFlight[]) => string|null>>}
 */
const GIT_REFUSALS = Object.freeze({
  worktree: worktreeRefusal,
  branch: branchRefusal,
  'update-ref': refRefusal,
  push: pushRefusal,
  commit: commitRefusal,
});

/** @param {SimpleCommand} command */
function removalRefusal({ words: [name, ...args], cwd }) {
  const removes = typeof name === 'string' && path.basename(name) === 'rm' && carries(args, 'rR', ['--recursive']);
  return removes && operandsOf(args).some((word) => namesStateFolder(cwd, word)) ? REFUSED.removal : null;
}

/**
 * The names that reach `file` from the folder `root` as the text spells
 * them, read without the disk; none where it is not below `root`.
 * @param {string} file absolute @param {string} root @returns {string[]}
 */
function namesFrom(file, root) {
  const names = path.relative(path.resolve(root), file).split(path.sep);
  return names[0] === '' || names[0] === '..' ? [] : names;
}

/**
 * Why a command naming a file at user level the layout hook refuses is
 * refused: each of its words, and its redirections' targets, read from its
 * folder as a path.
 * @param {SimpleCommand} command
 */
function namedRefusal({ words, redirections, cwd }) {
  for (const word of [...words, ...redirections.map(({ target }) => target)]) {
    const file = within(cwd, word);
    const reason = file === null ? null : userLevelRefusal(file, (name) => name, namesFrom);
    if (reason !== null) return `${reason} — ${NAMED}`;
  }
  return null;
}

/**
 * The redirections that write to what they name: out, appended, clobbering,
 * both streams, and opened to read and write. A `>&` that copies or closes
 * a descriptor names no file in the state.
 */
const WRITING = new Set(['>', '>>', '>|', '>&', '<>']);

/** The option clusters `sed` edits its files in place by: `-i`, or BSD's `-I`, after letters taking no value. */
const SED_IN_PLACE = /^-[nrEsuza]*[iI]/;

/** The switch clusters `perl` edits its files in place by: `-i`, after letters taking no value. */
const PERL_IN_PLACE = /^-[acnpsStTuUwWXl]*i/;

/**
 * Whether the options before any `--` edit the files named in place: a
 * cluster `inPlace` matches, or `--in-place`.
 * @param {(string|null)[]} args @param {RegExp} inPlace
 */
function editsInPlace(args, inPlace) {
  const end = args.indexOf('--');
  return (end < 0 ? args : args.slice(0, end)).some((word) => word !== null && (inPlace.test(word) || word.startsWith('--in-place')));
}

/**
 * Where a command copying, moving or linking the operands before its last
 * word to it writes: that word, and the file in it each one would land as,
 * were it a folder; nothing where the last word is no operand, or the only one.
 * @param {(string|null)[]} args @returns {string[]}
 */
function landings(args) {
  const to = args[args.length - 1];
  const from = args.slice(0, -1).filter((word) => word === null || !word.startsWith('-'));
  if (typeof to !== 'string' || to.startsWith('-') || from.length === 0) return [];
  return [to, ...from.flatMap((word) => (word === null ? [] : [path.join(to, path.basename(word))]))];
}

/**
 * The words naming the files each command writes to, by its name, from its
 * arguments.
 * @type {Readonly<Record<string, (args: (string|null)[]) => string[]>>}
 */
const WRITERS = Object.freeze({
  tee: operandsOf,
  sed: (args) => (editsInPlace(args, SED_IN_PLACE) ? operandsOf(args) : []),
  perl: (args) => (editsInPlace(args, PERL_IN_PLACE) ? operandsOf(args) : []),
  mv: (args) => [...operandsOf(args), ...landings(args)],
  cp: landings,
  install: landings,
  ln: landings,
  rm: operandsOf,
  unlink: operandsOf,
  truncate: operandsOf,
  touch: operandsOf,
  dd: (args) => args.flatMap((word) => (word !== null && word.startsWith('of=') ? [word.slice('of='.length)] : [])),
});

/**
 * The words naming the files a command writes to: its writing
 * redirections' targets, and those its name writes among its arguments.
 * @param {SimpleCommand} command @returns {(string|null)[]}
 */
function writtenWords({ words: [name, ...args], redirections }) {
  const writer = typeof name === 'string' ? path.basename(name) : '';
  const named = Object.hasOwn(WRITERS, writer) ? WRITERS[writer](args) : [];
  return [...redirections.filter(({ op }) => WRITING.has(op)).map(({ target }) => target), ...named];
}

/**
 * The state folder a file is in, and its path from there: the part after
 * the first `.leeway` among its names; null where none of them is, or the
 * last is.
 * @param {string} file absolute @returns {{root: string, rel: string}|null}
 */
function inStateFolder(file) {
  const names = file.split(path.sep);
  const at = names.indexOf(STATE_DIR_NAME);
  return at < 0 || at === names.length - 1 ? null : { root: names.slice(0, at + 1).join(path.sep), rel: names.slice(at + 1).join('/') };
}

/**
 * Why a write to the state-relative `rel` in the state folder `root` is
 * refused, as the layout hook refuses Claude's own: a file only the engine
 * writes. Null where it is another place, or none.
 * @param {{root: string, rel: string}} file
 */
function engineFileRefusal({ root, rel }) {
  // Loaded for a write into the state alone: the layout reads every shipped task driver.
  const { folding, layoutPlace, engineRefusal } = require('./layout.cjs');
  return engineRefusal(layoutPlace(rel, folding(root)), rel);
}

/**
 * Why a command writing to a file in the state only the engine writes is
 * refused, each file it writes to read from its folder as a path.
 * @param {SimpleCommand} command
 */
function writeRefusal(command) {
  for (const word of writtenWords(command)) {
    const file = within(command.cwd, word);
    const state = file === null ? null : inStateFolder(file);
    const reason = state === null ? null : engineFileRefusal(state);
    if (reason !== null) return reason;
  }
  return null;
}

/** @param {SimpleCommand} command @param {() => InFlight[]} inFlight */
function gitRefusal(command, inFlight) {
  const git = gitCommand(command);
  if (git === null || git.sub === null || !Object.hasOwn(GIT_REFUSALS, git.sub)) return null;
  return GIT_REFUSALS[git.sub](git, inFlight);
}

/**
 * Why the hook refuses one simple command, or null.
 * @param {SimpleCommand} command @param {() => InFlight[]} inFlight
 * @returns {string|null}
 */
function commandRefusal(command, inFlight) {
  return gitRefusal(command, inFlight) ?? removalRefusal(command) ?? namedRefusal(command) ?? writeRefusal(command);
}

/**
 * The tasks in flight in the conversation `input` names, read once and only
 * when asked.
 * @param {Record<string, unknown>} input @returns {() => InFlight[]}
 */
function inFlightOf({ session_id: session }) {
  /** @type {InFlight[]|null} */
  let known = null;
  return () => {
    known ??= typeof session === 'string' && session !== '' ? tasksInFlight(session) : [];
    return known;
  };
}

/**
 * Why the hook refuses the shell command the tool call `input` describes —
 * the first refusal one of its commands meets, in the order they appear —
 * or null where it lets it run, as it does a call it cannot read.
 * @param {string} cwd the folder the command runs in @param {Record<string, unknown>} input the hook's stdin JSON
 * @returns {string|null}
 */
function shellRefusal(cwd, input) {
  const toolInput = input.tool_input;
  const command = toolInput !== null && typeof toolInput === 'object' ? /** @type {Record<string, unknown>} */ (toolInput).command : null;
  if (typeof command !== 'string') return null;
  const inFlight = inFlightOf(input);
  for (const simple of simpleCommands(command, cwd)) {
    const reason = commandRefusal(simple, inFlight);
    if (reason !== null) return reason;
  }
  return null;
}

module.exports = { SHELL_HOOK_TOOLS, shellRefusal };
