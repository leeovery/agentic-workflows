'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the hook before Bash — Claude Code's hook before every shell
// command, which refuses what would go round the engine's doors (6.3.7,
// 6.2.5). Boot installs it in the project's settings beside the layout hook
// (domain/session-label), so it holds with or without the mod (6.3.10).
//
// It reads the command's text (kernel/shell-reader) and refuses:
// - a raw `git commit` in the state worktree — every state commit is the
//   engine's (6.2.5). A git command's folder is the one it runs in, moved
//   by each `-C`, with the folders `--git-dir` and `--work-tree` name; it is
//   in the state worktree where any of them has a `.ledger` folder in its
//   path;
// - while the conversation stdin's `session_id` names has a task in flight
//   (6.3.12, conversation.cjs) — a subagent's call carries the
//   conversation's — of a unit not completed or cancelled, so a unit another
//   conversation ended holds nothing, a raw `git commit` wherever it runs,
//   naming the commit door, which runs the tests and stamps the task
//   (6.3.7);
// - a command writing to the ledger or a manifest, which only the engine
//   writes, for the reason the layout hook refuses Claude's own write to it,
//   naming the verb (layout.cjs, `engineRefusal`): an output redirection
//   onto it (`>`, `>>`, `>|`, `&>`, `<>`, `>&` a file, each with a
//   descriptor), `tee`, an in-place `sed` or `perl`, `mv` from or onto it,
//   `cp`, `install` or `ln` onto it — their last word, or, were it a
//   folder, the file a source lands as there — and `rm`, `unlink`,
//   `truncate`, `touch` or `dd of=`. The file is read from the command's
//   folder, and is in the state by the part of its path after the first
//   `.ledger`, which the layout reads as the layout hook reads Claude's own
//   write. Reading one passes.
//
// Each refusal is one line on stderr with the way on, and exit 2, the code
// Claude Code blocks the call on. A pass says nothing and writes nothing.
// The decision is the text's, with the files read — the position, and only
// for a raw commit, then, with a task in flight, the manifest of its unit in
// the project's state, found through git's own files from the folder the
// command runs in — and, for a write into the state alone, the layout loaded
// and whether the state's filesystem ignores case: it runs before every
// shell command, so it never asks git. A word that expands at run time — a
// glob among them — an alias, a script, or a command handed to another as
// text (`sh -c`, `eval`, `xargs`) is not seen, and passes. Where the text
// cannot say which folder a command runs in — after a `cd` to such a word,
// or `cd -` — it is not taken for the state worktree, and a relative path
// there names no file in the state.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { simpleCommands } = require('../kernel/shell-reader.cjs');
const { STATE_DIR_NAME } = require('../kernel/state-root.cjs');
const { tasksInFlight } = require('./conversation.cjs');

/** @typedef {import('../kernel/shell-reader.cjs').SimpleCommand} SimpleCommand */
/** @typedef {{unit: string, task: string}} InFlight */

/** The tools the hook stands before, as the settings' matcher names them. */
const SHELL_HOOK_TOOLS = ['Bash'];

/** Why a raw commit in the state worktree is refused. */
const STATE_COMMIT = `a raw git commit in the state worktree (${STATE_DIR_NAME}) is refused — every state commit is the engine's, made by the verb that changes the state`;

/** Why a raw commit is refused during a build, with the commit door's call for each task in flight. @param {InFlight[]} tasks */
function buildCommit(tasks) {
  const named = `${tasks.map(({ unit, task }) => `task ${task} of ${unit}`).join(', ')} ${tasks.length === 1 ? 'is' : 'are'} in flight`;
  const doors = tasks.map(({ unit, task }) => `\`engine commit --paths <file>… --task ${unit} ${task} -m "<message>"\``).join(' or ');
  return `a raw git commit is refused while ${named} — the build commits through the commit door: ${doors}`;
}

/** git's global options that take the next word as their value, where it carries none after `=`. */
const VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix']);

/** Those of them naming a folder git acts in, beside the one it runs in. */
const FOLDERS = new Set(['--git-dir', '--work-tree']);

/**
 * @typedef {object} GitCommand
 * @property {(string|null)[]} folders the folder it acts in, and those `--git-dir` and `--work-tree` name
 * @property {string|null} sub its subcommand
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
  return { folders: [folder, ...named], sub: rest[at] ?? null };
}

/** Whether a git command acts in the state worktree. @param {GitCommand} git */
function inStateWorktree({ folders }) {
  return folders.some((folder) => folder !== null && folder.split(path.sep).includes(STATE_DIR_NAME));
}

/**
 * Why a raw commit is refused: in the state worktree, or with a task in
 * flight. Null for any other command.
 * @param {SimpleCommand} command @param {() => InFlight[]} inFlight
 */
function commitRefusal(command, inFlight) {
  const git = gitCommand(command);
  if (git?.sub !== 'commit') return null;
  if (inStateWorktree(git)) return STATE_COMMIT;
  const tasks = inFlight();
  return tasks.length === 0 ? null : buildCommit(tasks);
}

/** The words that are no option, every word after `--` among them. @param {(string|null)[]} args @returns {string[]} */
function operandsOf(args) {
  const end = args.indexOf('--');
  const operand = (/** @type {string|null} */ word, /** @type {number} */ at) => word !== null && ((end >= 0 && at > end) || !word.startsWith('-'));
  return /** @type {string[]} */ (args.filter(operand));
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
 * the first `.ledger` among its names; null where none of them is, or the
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

/**
 * The checkout holding `folder` — its top, the nearest folder up with a
 * `.git` folder or file, and the git directory that names — undefined where
 * none holds it.
 * @param {string} folder @returns {{top: string, gitDir: string}|undefined}
 */
function checkoutOf(folder) {
  for (let at = folder; ; at = path.dirname(at)) {
    const dotGit = path.join(at, '.git');
    const stat = fs.statSync(dotGit, { throwIfNoEntry: false });
    if (stat?.isDirectory()) return { top: at, gitDir: dotGit };
    const named = stat?.isFile() ? /^gitdir: (.+)$/m.exec(fs.readFileSync(dotGit, 'utf8'))?.[1] : undefined;
    if (named !== undefined) return { top: at, gitDir: path.resolve(at, named.trim()) };
    if (path.dirname(at) === at) return undefined;
  }
}

/** The git directory a checkout's shares with the repository's every checkout: the main checkout's own. @param {string} gitDir */
function commonOf(gitDir) {
  try {
    return path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'commondir'), 'utf8').trim());
  } catch {
    return gitDir;
  }
}

/** The checkout enclosing the one whose top is `top`, undefined where none does. @param {string} top */
const enclosing = (top) => (path.dirname(top) === top ? undefined : checkoutOf(path.dirname(top)));

/**
 * The project's state the checkout holding `folder` belongs to, read from
 * git's own files: beside the main checkout, a linked worktree's by its
 * common folder; where none is there — a nested repository's checkout —
 * that of the checkout enclosing it, and so on up. Null where none is found.
 * @param {string} folder @returns {string|null}
 */
function stateOf(folder) {
  for (let held = checkoutOf(folder); held !== undefined; held = enclosing(held.top)) {
    const state = path.join(path.dirname(commonOf(held.gitDir)), STATE_DIR_NAME);
    if (fs.existsSync(state)) return state;
  }
  return null;
}

/** The statuses a unit's work ends in. */
const ENDED = ['completed', 'cancelled'];

/**
 * Whether the unit's work goes on: not completed or cancelled, or its
 * manifest unread, which the guard never takes for ended.
 * @param {string|null} state @param {string} unit
 */
function stillLive(state, unit) {
  if (state === null) return true;
  try {
    return !ENDED.includes(JSON.parse(fs.readFileSync(path.join(state, unit, 'manifest.json'), 'utf8')).status);
  } catch {
    return true;
  }
}

/**
 * The tasks in flight in the conversation `input` names, of units still in
 * progress (the header's), read once and only when asked.
 * @param {string} cwd @param {Record<string, unknown>} input @returns {() => InFlight[]}
 */
function inFlightOf(cwd, { session_id: session }) {
  const named = typeof session === 'string' && session !== '' ? session : null;
  /** @type {InFlight[]|null} */
  let known = null;
  return () => {
    if (known === null) {
      const tasks = named === null ? [] : tasksInFlight(named);
      const state = tasks.length === 0 ? null : stateOf(cwd);
      known = tasks.filter(({ unit }) => stillLive(state, unit));
    }
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
  const inFlight = inFlightOf(cwd, input);
  for (const simple of simpleCommands(command, cwd)) {
    const reason = commitRefusal(simple, inFlight) ?? writeRefusal(simple);
    if (reason !== null) return reason;
  }
  return null;
}

module.exports = { SHELL_HOOK_TOOLS, shellRefusal };
