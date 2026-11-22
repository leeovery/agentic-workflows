'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the hook before Bash — Claude Code's hook before every shell
// command, which refuses what would lose Ledger's state or go round
// its doors (4.4.2, 6.3.7, 6.3.8, 12.9.8). Boot installs it in the
// project's settings beside the layout hook (domain/session-label), so it
// holds with or without the mod (6.3.10).
//
// It reads the command's text (kernel/shell-reader) and refuses, whatever
// the conversation is doing:
// - `git worktree unlock`, `remove` or `move` of the state worktree, a path
//   ending in `.ledger`;
// - `rm -r` of `.ledger`, `.ledger/`, `.ledger/.` or everything in it,
//   `.ledger/*` — a file under it may go;
// - deleting `ledger-state`: `git branch -d|-D|--delete`, `git update-ref
//   -d refs/heads/ledger-state`;
// - deleting it on the remote: `git push --delete|-d`, or a refspec
//   `:ledger-state`;
// - force-pushing it: `-f` or `--force…` with a refspec naming it, or a
//   refspec `+…ledger-state` — in the state worktree `HEAD` and `@` name
//   it, the branch checked out there, and a forced push naming no refspec
//   pushes it; a mirror push, which forces every branch; `--all` or
//   `--branches` with force;
// - a raw `git commit` in the state worktree — every state commit is the
//   engine's (6.2.5);
// - a raw `git commit` in a quick-fix's worktree, and every other git
//   command that makes a commit (below) — the quick-fix's own
//   conversation's among them, a task of its in flight refusing it as a
//   build's — where the checkout of its folder, or of the folder enclosing
//   a nested repository's checkout there, has out the one branch of a
//   quick-fix of the project's not completed or cancelled (fix-branch.cjs),
//   naming it and the way on: the command's own way through the commit
//   door, where it has one, the door, or a checkout of the caller's own;
//   and, where the text cannot say which folder it runs in, one whose text
//   names a worktree of the engine's own, a path through
//   `.claude/worktrees/ledger-…` by a name only the engine gives, a
//   worktree of the person's own named like one none (kernel/code-root);
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
//   after the first `.ledger`, which the layout reads as the layout hook
//   reads Claude's own write. Reading one passes;
// and, while the conversation stdin's `session_id` names has a task in
// flight (6.3.12, conversation.cjs) — a subagent's call carries the
// conversation's — of a unit not completed or cancelled, so a unit another
// conversation ended holds nothing, a raw `git commit`
// wherever it runs (6.3.7); and every
// other git command that would land a commit on a task's branch past the
// commit door, through which a build commits, and which finishes a merge in
// progress — one run where the checkout of its folder has out a branch a
// task of a unit with a task in flight commits on, a task's own or a
// quick-fix's one branch, a rebase's own among them (landing-names.cjs,
// `isWorkBranch`), or where the text cannot say which folder it runs
// in; anywhere else — the engine's own landing remedies, on a phase's branch
// or the branch the project lands on — it passes. They are a `git merge` but
// with both `--no-ff` and `--no-commit` — a merge that can fast-forward
// moves the branch with `--no-commit` too — or with `--abort` or `--quit`, a
// merge's `--continue` named the door's own way on; a `git pull`; a `git
// cherry-pick` or `git revert` but with `--no-commit`, `-n`, `--abort` or
// `--quit`; a `git am` but with `--abort` or `--quit`; and a `git rebase`
// but with `--abort` or `--quit`, the chain merged back through the door
// instead. A git command's folder is the one it runs in, moved by each
// `-C`, with the folders `--git-dir` and `--work-tree` name; it is in the
// state worktree where any of them has a `.ledger` folder in its path.
//
// Each refusal is one line on stderr with the way on, and exit 2, the code
// Claude Code blocks the call on. A pass says nothing and writes nothing.
// The decision is the text's, with the files read — the position, and only
// for a git command that makes a commit, then, with a task in flight, the
// manifest of its unit in the project's state, found through git's own
// files from the folder the command runs in, and the branch its checkout
// has out, from git's own files — for a commit with none in flight, or one
// off a task's branch, to read the manifest of the quick-fix it may be the
// branch of, in the state beside its repository or, where none is or it
// holds no such quick-fix in progress, beside the next checkout enclosing
// it that has one, and so on up — and, for a write into
// the state alone, the layout loaded and whether the state's filesystem
// ignores case: it runs before every shell command, so it never asks git. A word that expands at run time — a
// glob among them — an alias, a script, or a command handed to another as
// text (`sh -c`, `eval`, `xargs`) is not seen, and passes. Where the text
// cannot say which folder a command runs in — after a `cd` to such a word,
// or `cd -` — it is not taken for the state worktree, and a relative path
// there names no file at user level or in the state; but an `rm -r` or a
// `git worktree` of a relative `.ledger` is refused there, its name enough.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { simpleCommands } = require('../kernel/shell-reader.cjs');
const { STATE_DIR_NAME, STATE_BRANCH, BRANCH_REF } = require('../kernel/state-root.cjs');
const { namesLayout } = require('../kernel/code-root.cjs');
const { tasksInFlight } = require('./conversation.cjs');
const { userLevelRefusal } = require('./user-files.cjs');

/** @typedef {import('../kernel/shell-reader.cjs').SimpleCommand} SimpleCommand */
/** @typedef {{unit: string, task: string}} InFlight */
/** What a git command's refusal reads beyond the command, each when asked: the tasks in flight, and whether the shell command's text names one of the engine's own layouts. @typedef {{inFlight: () => InFlight[], layoutNamed: () => boolean}} Reads */

/** The tools the hook stands before, as the settings' matcher names them. */
const SHELL_HOOK_TOOLS = ['Bash'];

/** Why each command of the state's is refused, with the way on. */
const REFUSED = Object.freeze({
  worktree: `unlocking, moving or removing the state worktree (${STATE_DIR_NAME}) is refused — it holds Ledger's state, and boot keeps it locked where it is`,
  removal: `removing ${STATE_DIR_NAME} is refused — it is the state worktree, holding Ledger's state; a stray file in it is removed by its own name`,
  branch: `deleting the state branch (${STATE_BRANCH}) is refused — it holds Ledger's state, which only the engine changes`,
  remote: `deleting ${STATE_BRANCH} on the remote is refused — it holds Ledger's state, and boot restores a lost local branch from it`,
  force: `force-pushing ${STATE_BRANCH} is refused — the engine pushes it after every commit, and a force would drop what another clone pushed; push your own branches by name`,
  stateCommit: `a raw git commit in the state worktree (${STATE_DIR_NAME}) is refused — every state commit is the engine's, made by the verb that changes the state`,
});

/** The commit door's call for each task in flight. @param {InFlight[]} tasks */
function doorsOf(tasks) {
  return tasks.map(({ unit, task }) => `\`engine commit --paths <file>… --task ${unit} ${task} -m "<message>"\``).join(' or ');
}

/** The tasks in flight, as a refusal names them. @param {InFlight[]} tasks */
function inFlightNamed(tasks) {
  return `${tasks.map(({ unit, task }) => `task ${task} of ${unit}`).join(', ')} ${tasks.length === 1 ? 'is' : 'are'} in flight`;
}

/** Why a raw commit is refused during a build, with the door's call for each task in flight. @param {InFlight[]} tasks */
function buildCommit(tasks) {
  return `a raw git commit is refused while ${inFlightNamed(tasks)} — the build commits through the commit door: ${doorsOf(tasks)}`;
}

/** A merge made through the door, as a way on names it. */
const MERGED = 'merge with --no-ff --no-commit, resolve what conflicts, then commit the merge through the door, which finishes it';

/**
 * The git commands besides `commit` that make a commit, by their
 * subcommand: the flags with which one makes none, each set passing where
 * the command carries all of it, short (`-n`) or long; the way on through
 * the commit door; and, where it differs, the way on for its `--continue`.
 * @type {Readonly<Record<string, {passes: string[][], way: string, continued?: string}>>}
 */
const COMMITTING = Object.freeze({
  merge: { passes: [['--no-ff', '--no-commit'], ['--abort'], ['--quit']], way: MERGED, continued: 'name each file you resolved, and commit the merge through the door, which finishes it' },
  pull: { passes: [], way: `fetch, then ${MERGED}` },
  'cherry-pick': { passes: [['--no-commit'], ['-n'], ['--abort'], ['--quit']], way: 'pick with --no-commit, then commit through the door' },
  revert: { passes: [['--no-commit'], ['-n'], ['--abort'], ['--quit']], way: 'revert with --no-commit, end the revert with --quit, which keeps its change, then commit through the door' },
  am: { passes: [['--abort'], ['--quit']], way: 'apply the patch with git apply, then commit through the door' },
  rebase: { passes: [['--abort'], ['--quit']], way: `rather than rebase, ${MERGED}` },
});

/**
 * Why a git command making a commit past the door is refused during a
 * build, with the way on and the door's call for each task in flight.
 * @param {string} subcommand @param {string} way @param {InFlight[]} tasks
 */
function buildCommitting(subcommand, way, tasks) {
  return `git ${subcommand} is refused while ${inFlightNamed(tasks)} — it makes a commit past the commit door: ${way}, ${doorsOf(tasks)}`;
}

/** What a refusal of a file at user level says beyond the layout hook's reason. */
const NAMED = 'a shell command naming it is refused, and the Read tool reads it';

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

/** The branch a ref file names, `ref: refs/heads/…` or `refs/heads/…`, or null. @param {string} file */
function branchIn(file) {
  try {
    return /^(?:ref: )?refs\/heads\/(.+)$/.exec(fs.readFileSync(file, 'utf8').trim())?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * The branch the checkout holding `folder` has out, read from git's own
 * files: HEAD's, or, HEAD detached while a rebase runs, the branch it
 * rewrites; null where it is detached otherwise, or no checkout holds it.
 * @param {string} folder @returns {string|null}
 */
function branchOut(folder) {
  const gitDir = checkoutOf(folder)?.gitDir;
  if (gitDir === undefined) return null;
  return branchIn(path.join(gitDir, 'HEAD')) ?? branchIn(path.join(gitDir, 'rebase-merge', 'head-name')) ?? branchIn(path.join(gitDir, 'rebase-apply', 'head-name'));
}

/**
 * Whether a commit a git command but `commit` makes would land on a task's
 * branch (the header's): its checkout has out a branch a task commits on of
 * a unit with a task in flight, or the text cannot say where it runs.
 * @param {GitCommand} git @param {InFlight[]} tasks
 */
function onTaskBranch({ folder }, tasks) {
  if (folder === null) return true;
  const branch = branchOut(folder);
  const { isWorkBranch } = require('./landing-names.cjs');
  return branch !== null && tasks.some(({ unit }) => isWorkBranch(unit, branch));
}

/** What a commit in a quick-fix's worktree goes through instead: the door for a fix's change, a checkout of the caller's own for anything else. @param {string} unit */
const fixDoor = (unit) => `a fix's change with \`engine commit --paths <file>… --task ${unit} <task> -m "<message>"\`, anything else from a checkout of your own`;

/**
 * Why a git command making a commit is refused in a quick-fix's worktree
 * (the header's), by what it is — `a raw git commit`, `git merge` — with
 * the command's own way through the door before the door, where it has
 * one: its checkout, or that of the folder enclosing its nested
 * repository, has out the one branch of a quick-fix of the project's not
 * completed or cancelled, naming it; where the text cannot say where it
 * runs, the shell command's text names one of the engine's own layouts.
 * Null otherwise.
 * @param {GitCommand} git @param {Reads} reads @param {string} said @param {string|null} way
 */
function fixRefusal({ folder }, { layoutNamed }, said, way) {
  const door = (/** @type {string} */ unit) => `${way === null ? '' : `${way}; `}${fixDoor(unit)}`;
  if (folder === null) {
    return layoutNamed() ? `${said} is refused here — the command names a worktree of Ledger's own, and its text cannot say where it runs: a quick-fix's work goes through the commit door alone, ${door('<unit>')}` : null;
  }
  const branch = branchOut(folder);
  const unit = branch === null ? null : require('./landing-names.cjs').quickFixOfBranch(branch);
  if (unit === null || !liveQuickFix(folder, unit)) return null;
  return `${said} is refused here — ${branch} is checked out for ${unit}, a quick-fix in progress, whose work goes through the commit door alone: ${door(unit)}`;
}

/**
 * Whether a state the checkout holding `folder` belongs to holds `unit` as
 * a quick-fix not completed or cancelled, the nearest first, walking up
 * past one that holds no such quick-fix — a nested repository that is a
 * project of its own (`statesOf`).
 * @param {string} folder @param {string} unit
 */
function liveQuickFix(folder, unit) {
  for (const state of statesOf(folder)) {
    const manifest = unitIn(state, unit);
    if (manifest?.work_type === 'quick-fix' && !ENDED.includes(manifest.status)) return true;
  }
  return false;
}

/** @param {GitCommand} git @param {Reads} reads */
function commitRefusal(git, reads) {
  if (inStateWorktree(git)) return REFUSED.stateCommit;
  const tasks = reads.inFlight();
  return tasks.length === 0 ? fixRefusal(git, reads, 'a raw git commit', null) : buildCommit(tasks);
}

/** Whether the options carry `flag`, a short one or a long. @param {(string|null)[]} args @param {string} flag */
const carriesFlag = (args, flag) => (flag.startsWith('--') ? carries(args, '', [flag]) : carries(args, flag.slice(1), []));

/**
 * The refusal of a git command of `COMMITTING`'s, by its subcommand: a
 * build's where it lands on a task's branch, else one in a quick-fix's
 * worktree (`fixRefusal`).
 * @param {string} subcommand
 */
function committingRefusal(subcommand) {
  const { passes, way, continued } = COMMITTING[subcommand];
  return (/** @type {GitCommand} */ git, /** @type {Reads} */ reads) => {
    const { args } = git;
    if (passes.some((flags) => flags.every((flag) => carriesFlag(args, flag)))) return null;
    const ways = continued !== undefined && carriesFlag(args, '--continue') ? continued : way;
    const tasks = reads.inFlight();
    return tasks.length > 0 && onTaskBranch(git, tasks) ? buildCommitting(subcommand, ways, tasks) : fixRefusal(git, reads, `git ${subcommand}`, ways);
  };
}

/**
 * Each refusal of a git command, by its subcommand.
 * @type {Readonly<Record<string, (git: GitCommand, reads: Reads) => string|null>>}
 */
const GIT_REFUSALS = Object.freeze({
  worktree: worktreeRefusal,
  branch: branchRefusal,
  'update-ref': refRefusal,
  push: pushRefusal,
  commit: commitRefusal,
  ...Object.fromEntries(Object.keys(COMMITTING).map((subcommand) => [subcommand, committingRefusal(subcommand)])),
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

/** @param {SimpleCommand} command @param {Reads} reads */
function gitRefusal(command, reads) {
  const git = gitCommand(command);
  if (git === null || git.sub === null || !Object.hasOwn(GIT_REFUSALS, git.sub)) return null;
  return GIT_REFUSALS[git.sub](git, reads);
}

/**
 * Why the hook refuses one simple command, or null.
 * @param {SimpleCommand} command @param {Reads} reads
 * @returns {string|null}
 */
function commandRefusal(command, reads) {
  return gitRefusal(command, reads) ?? removalRefusal(command) ?? namedRefusal(command) ?? writeRefusal(command);
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
 * Each project's state the checkout holding `folder` belongs to, read from
 * git's own files, the nearest first: beside the main checkout, a linked
 * worktree's by its common folder; then, or where none is there — a nested
 * repository's checkout, one in a quick-fix's worktree among them — that of
 * the checkout enclosing it, and so on up, each read as it is asked for.
 * @param {string} folder @returns {Generator<string>}
 */
function* statesOf(folder) {
  for (let held = checkoutOf(folder); held !== undefined; held = enclosing(held.top)) {
    const state = path.join(path.dirname(commonOf(held.gitDir)), STATE_DIR_NAME);
    if (fs.existsSync(state)) yield state;
  }
}

/** The project's state the checkout holding `folder` belongs to, the nearest (`statesOf`); null where none is found. @param {string} folder @returns {string|null} */
const stateOf = (folder) => statesOf(folder).next().value ?? null;

/** The statuses a unit's work ends in. */
const ENDED = ['completed', 'cancelled'];

/** The unit's manifest in the project's state, or null where it is not read. @param {string|null} state @param {string} unit @returns {Record<string, any>|null} */
function unitIn(state, unit) {
  try {
    return state === null ? null : JSON.parse(fs.readFileSync(path.join(state, unit, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Whether the unit's work goes on: not completed or cancelled, or its
 * manifest unread, which the guard never takes for ended.
 * @param {string|null} state @param {string} unit
 */
function stillLive(state, unit) {
  const manifest = unitIn(state, unit);
  return manifest === null || !ENDED.includes(manifest.status);
}

/** `read` once, its answer kept. @template T @param {() => T} read @returns {() => T} */
function once(read) {
  /** @type {{value: T}|null} */
  let known = null;
  return () => {
    known ??= { value: read() };
    return known.value;
  };
}

/**
 * The tasks in flight in the conversation `input` names, of units still in
 * progress (the header's), read once and only when asked.
 * @param {string} cwd @param {Record<string, unknown>} input @returns {() => InFlight[]}
 */
function inFlightOf(cwd, { session_id: session }) {
  const named = typeof session === 'string' && session !== '' ? session : null;
  return once(() => {
    const tasks = named === null ? [] : tasksInFlight(named);
    const state = tasks.length === 0 ? null : stateOf(cwd);
    return tasks.filter(({ unit }) => stillLive(state, unit));
  });
}

/**
 * Whether the shell command's text names one of the engine's own layouts of
 * the project the hook's folder belongs to: a path through one by a name
 * only the engine gives (kernel/code-root.cjs, `namesLayout`), a worktree of
 * the person's own named like one none.
 * @param {string} cwd @param {string} command
 */
function layoutNamedIn(cwd, command) {
  const state = stateOf(cwd);
  return state !== null && namesLayout(path.dirname(state), command);
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
  const reads = { inFlight: inFlightOf(cwd, input), layoutNamed: once(() => layoutNamedIn(cwd, command)) };
  for (const simple of simpleCommands(command, cwd)) {
    const reason = commandRefusal(simple, reads);
    if (reason !== null) return reason;
  }
  return null;
}

module.exports = { SHELL_HOOK_TOOLS, shellRefusal };
