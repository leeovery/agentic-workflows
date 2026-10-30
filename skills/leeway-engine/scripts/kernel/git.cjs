'use strict';

// ---------------------------------------------------------------------------
// Kernel: git, one repo at a time. Two halves:
//
// - Scoped commits — stage the named paths, each taken literally, commit
//   confined to exactly those paths, report the sha. Every commit is
//   pathspec-confined: no engine commit can sweep a path outside its
//   declared scope, so concurrent sessions never take each other's work
//   under their own messages. None lands while git is in the middle of a
//   merge, cherry-pick, revert, rebase or bisect in the work tree, and one
//   that does not land leaves the index as it found it.
// - Reads of a repo's change — its dirt, each untracked file named on its
//   own; the commits a subject selects and the paths they touched; a
//   commit's parent or the empty tree; and the patches `git diff` answers,
//   the uncommitted one with untracked files read as additions from a
//   scratch index.
//
// Mechanism only: it knows nothing about work units or the inbox. Every call
// spawns `git` with an explicit cwd — the project root, or a repo nested in
// the project (kernel/repos). Failures throw loud with git's own stderr; a
// clean scope is not a failure — `commitPathspec` reports it as `null` so
// callers can treat an empty pause as fine.
//
// Index-mutating operations (add, commit) retry on `index.lock`
// contention — another process (a concurrent session, the user) holding
// git's own lock is transient, not fatal. The retry budget is short; a
// holder that outlives it surfaces git's original error.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { sleepSync } = require('./process.cjs');

const INDEX_RETRY_MS = 100;
const INDEX_BUDGET_MS = 5000;

// Test hook: WORKFLOWS_GIT_LOCK_BUDGET_MS overrides the retry budget.
function indexBudgetMs() {
  const env = Number(process.env.WORKFLOWS_GIT_LOCK_BUDGET_MS);
  return Number.isFinite(env) && env > 0 ? env : INDEX_BUDGET_MS;
}

// Whole-history and whole-tree listings (a signal's `git log`, a tree's
// `ls-tree -r`, an index's `ls-files --stage`) can run past spawnSync's 1 MiB
// default; a read past the budget is a failure like any other, never a
// truncated answer.
const READ_BUDGET_BYTES = 64 * 1024 * 1024;

/** A git run that failed — told apart from a bug in the code around it. */
class GitError extends Error {}

/** The command an argv runs, past the settings ahead of it. @param {string[]} args */
function commandOf(args) {
  let i = 0;
  while (args[i] === '-c') i += 2;
  return args[i];
}

/**
 * Run git and return stdout. Throws a GitError with git's stderr on a
 * non-zero exit.
 * @param {string} cwd
 * @param {string[]} args
 * @param {Record<string, string>} [env] variables layered over the process's own
 * @param {string} [input] written to git's stdin
 * @param {number} [timeoutMs] how long it may run, as a call over the network is held
 * @returns {string}
 */
function git(cwd, args, env, input, timeoutMs) {
  const res = spawnSync('git', args, {
    cwd, encoding: 'utf8', env: env && { ...process.env, ...env }, input, maxBuffer: READ_BUDGET_BYTES, timeout: timeoutMs,
  });
  if (/** @type {NodeJS.ErrnoException|undefined} */ (res.error)?.code === 'ETIMEDOUT') throw new GitError(`git ${commandOf(args)} timed out after ${Number(timeoutMs) / 1000}s`);
  if (res.error) throw new GitError(`git ${commandOf(args)} failed: ${res.error.message}`);
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || `exit ${res.status}`).trim();
    throw new GitError(`git ${commandOf(args)} failed: ${detail}`);
  }
  return res.stdout;
}

/**
 * Run git and return stdout, or null on any failure — the tolerant read for
 * advisory probes that must never take their caller down. An empty result
 * (`''`) and a failed one (`null`) stay distinct.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string|null}
 */
function tryGit(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: READ_BUDGET_BYTES });
  if (res.error || res.status !== 0) return null;
  return res.stdout;
}

/** @param {string} message */
function isIndexLockError(message) {
  return message.includes('index.lock') &&
    /file exists|unable to create/i.test(message);
}

/**
 * Run an index-mutating git operation, retrying while another process holds
 * `.git/index.lock`.
 * @param {string} cwd
 * @param {string[]} args
 * @param {string} [input] written to git's stdin
 * @returns {string}
 */
function gitIndexed(cwd, args, input) {
  const deadline = Date.now() + indexBudgetMs();
  while (true) {
    try {
      return git(cwd, args, undefined, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isIndexLockError(message) || Date.now() >= deadline) throw err;
      sleepSync(INDEX_RETRY_MS);
    }
  }
}

/**
 * Pathspecs holding the given paths out, each taken literally.
 * @param {string[]} paths
 * @returns {string[]}
 */
function excluding(paths) {
  return paths.map((p) => `:(exclude,literal)${p}`);
}

/**
 * Pathspecs naming the given paths, each taken literally.
 * @param {string[]} paths
 * @returns {string[]}
 */
function literally(paths) {
  return paths.map((p) => `:(literal)${p}`);
}

/**
 * Whether the given pathspecs differ from HEAD (worktree or index). A
 * submodule differs only where its pointer has moved: work uncommitted
 * inside it is no change a commit here can record.
 * @param {string} cwd
 * @param {string[]} specs
 * @returns {boolean}
 */
function hasChangesInPaths(cwd, specs) {
  return git(cwd, ['status', '--porcelain', '--ignore-submodules=dirty', '--', ...specs]).trim() !== '';
}

/**
 * Whether the directory holds any file, at any depth. An existing-but-empty
 * directory is a git no-man's-land: `git add` tolerates its pathspec silently
 * while `git commit -- <paths>` refuses it — the state every mailbox
 * reaches once its last message's deletion is committed.
 * @param {string} dirAbs
 * @returns {boolean}
 */
function dirHasFiles(dirAbs) {
  /** @type {fs.Dirent[]} */
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (dirHasFiles(path.join(dirAbs, e.name))) return true;
    } else {
      return true;
    }
  }
  return false;
}

/**
 * Keep pathspecs the whole add+commit sequence will accept: a file on disk, a
 * directory with content, or a path holding index entries (a deleted-but-
 * tracked path still commits its deletions). An empty directory with no index
 * entries is dropped — see dirHasFiles.
 * @param {string} cwd @param {string[]} specs
 * @returns {string[]}
 */
function stageableSpecs(cwd, specs) {
  return specs.filter((p) => {
    const abs = path.join(cwd, p);
    if (fs.existsSync(abs)) {
      if (!fs.statSync(abs).isDirectory()) return true;
      if (dirHasFiles(abs)) return true;
    }
    const out = tryGit(cwd, ['ls-files', '--', ...literally([p])]);
    return out !== null && out.trim() !== '';
  });
}

/**
 * Whether the pathspec holds changes staged against HEAD. The one state
 * `stageableSpecs` cannot see: a `git rm` leaves the path in neither the
 * worktree nor the index, so only HEAD still knows it — and `git commit`
 * accepts that pathspec where `git add` refuses it.
 * @param {string} cwd @param {string} spec
 * @returns {boolean}
 */
function hasStagedDeletions(cwd, spec) {
  const out = tryGit(cwd, ['diff', '--cached', '--name-only', '--', ...literally([spec])]);
  return out !== null && out.trim() !== '';
}

/**
 * Whether HEAD's own commit deleted the path — never on a repo's first
 * commit, which has no parent to compare with.
 * @param {string} cwd @param {string} spec
 * @returns {boolean}
 */
function deletedAtHead(cwd, spec) {
  const out = tryGit(cwd, ['diff', '--name-only', '--no-renames', '--diff-filter=D', 'HEAD^', 'HEAD', '--', ...literally([spec])]);
  return out !== null && out.trim() !== '';
}

/**
 * Whether HEAD names a branch — false on a detached HEAD.
 * @param {string} cwd
 * @returns {boolean}
 */
function onBranch(cwd) {
  return tryGit(cwd, ['symbolic-ref', '-q', 'HEAD']) !== null;
}

/**
 * Whether the folder lies inside the pathspec.
 * @param {string} folder @param {string} spec
 * @returns {boolean}
 */
function liesInside(folder, spec) {
  return spec === '.' || folder.startsWith(`${spec}/`);
}

/**
 * The pathspecs holding out each nested repo's folder one of the paths
 * reaches inside, where `add` would take in an untracked repo as a gitlink
 * or a submodule's moved pointer. Only those: `add` refuses an ignored
 * folder an exclude names once its walk meets it.
 * @param {string[]} nested @param {string[]} specs
 * @returns {string[]}
 */
function heldOutOf(nested, specs) {
  return excluding(nested.filter((folder) => specs.some((spec) => liesInside(folder, spec))));
}

/**
 * Commit exactly the named paths — `git commit -- <paths>` builds a
 * temporary index from HEAD plus the worktree content of those paths, so
 * other processes' dirty or staged files are ignored and left untouched.
 * The `add` catches untracked files among the paths. Pathspecs git knows
 * nothing about are dropped: it refuses one that matches nothing, and a
 * scope naming a path its transaction never created is normal (an absent
 * mailbox, a work unit with no imports).
 *
 * `nested` names the folders of the repos nested in this one, held out of
 * the paths that reach inside them (`heldOutOf`). A nested folder named
 * itself is a submodule's pointer: tracked, so committed as the folder
 * stands, never added, and never held out of a path that holds it.
 *
 * Refuses while a merge, cherry-pick, revert, rebase or bisect is in
 * progress, touching nothing. Where no commit lands — git refuses it, a hook
 * among them, or the paths turn out clean — the index is put back as the
 * call found it for the paths it staged (`stagedAside`).
 * @param {string} cwd      the repo's root, or the project root
 * @param {string|string[]} pathspec
 * @param {string} message
 * @param {string[]} [nested]
 * @returns {string|null} the short commit sha, or null when the paths are clean
 */
function commitPathspec(cwd, pathspec, message, nested = []) {
  refuseMidOperation(cwd);
  const specs = Array.isArray(pathspec) ? pathspec : [pathspec];
  const pointers = specs.filter((spec) => nested.includes(spec));
  const files = specs.filter((spec) => !nested.includes(spec));
  const held = heldOutOf(nested.filter((folder) => !pointers.includes(folder)), files);
  const addable = stageableSpecs(cwd, files);
  return stagedAside(cwd, addable, () => {
    if (addable.length > 0) gitIndexed(cwd, ['add', '--', ...literally(addable), ...held]);
    const known = [...files.filter((p) => addable.includes(p) || hasStagedDeletions(cwd, p)), ...pointers];
    if (known.length === 0) return null;
    const scope = [...literally(known), ...held];
    if (!hasChangesInPaths(cwd, scope)) return null;
    gitIndexed(cwd, ['commit', '-m', message, '--', ...scope]);
    return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
  });
}

/**
 * The index's entries under `paths`, each as `update-index --index-info`
 * reads it, named from the top of the work tree.
 * @param {string} cwd @param {string[]} paths
 * @returns {string[]}
 */
function indexEntries(cwd, paths) {
  return git(cwd, ['ls-files', '--stage', '--full-name', '-z', '--', ...literally(paths)]).split('\0').filter(Boolean);
}

/** The path an index entry names. @param {string} entry */
function entryPath(entry) {
  return entry.slice(entry.indexOf('\t') + 1);
}

/**
 * Run `stage`, which stages `paths` and may commit them, and where it lands
 * no commit — answering null, or throwing — put the index back as it was
 * under `paths`: entries it added go, and every entry there before returns
 * as it stood, the person's own staged changes among them.
 * @template T @param {string} cwd @param {string[]} paths @param {() => T|null} stage
 * @returns {T|null}
 */
function stagedAside(cwd, paths, stage) {
  if (paths.length === 0) return stage();
  const before = indexEntries(cwd, paths);
  let landed = null;
  try {
    landed = stage();
    return landed;
  } finally {
    if (landed === null) {
      const top = git(cwd, ['rev-parse', '--show-toplevel']).trim();
      const had = new Set(before.map(entryPath));
      const added = indexEntries(cwd, paths).map(entryPath).filter((p) => !had.has(p));
      if (added.length > 0) gitIndexed(top, ['update-index', '--force-remove', '--', ...added]);
      if (before.length > 0) gitIndexed(top, ['update-index', '-z', '--index-info'], before.map((entry) => `${entry}\0`).join(''));
    }
  }
}

/**
 * A path in the git dir as git resolves it — a linked worktree's own for
 * per-worktree state — made absolute.
 * @param {string} cwd project root
 * @param {string} name
 * @returns {string}
 */
function gitPath(cwd, name) {
  const rel = git(cwd, ['rev-parse', '--git-path', name]).trim();
  return path.isAbsolute(rel) ? rel : path.join(cwd, rel);
}

// The operations git holds open across commands, by the marker each leaves
// in the work tree's git dir. A commit made while one is open takes on its
// state — a merge's second parent, a pick's authorship — and consumes the
// marker; one made mid-bisect moves HEAD off the commit under test, and the
// bisect's reset leaves it behind.
const OPERATION_MARKERS = [
  ['MERGE_HEAD', 'a merge'],
  ['CHERRY_PICK_HEAD', 'a cherry-pick'],
  ['REVERT_HEAD', 'a revert'],
  ['rebase-merge', 'a rebase'],
  ['rebase-apply', 'a rebase'],
  ['BISECT_START', 'a bisect'],
];

/**
 * The operation git is in the middle of, as `{operation, marker}`, or null —
 * as it is for a folder in no repository, where git holds nothing open. The
 * markers are the work tree's own, so a linked worktree reads its own.
 * @param {string} cwd project root
 * @returns {{operation: string, marker: string}|null}
 */
function operationInProgress(cwd) {
  const markers = tryGit(cwd, ['rev-parse', ...OPERATION_MARKERS.flatMap(([marker]) => ['--git-path', marker])]);
  if (markers === null) return null;
  const paths = markers.trim().split('\n');
  const open = OPERATION_MARKERS.find((_, i) => fs.existsSync(path.resolve(cwd, paths[i])));
  return open ? { operation: open[1], marker: open[0] } : null;
}

/**
 * Refuse, touching nothing, while git is in the middle of an operation in
 * the work tree: a commit made then would take on its state — a merge's
 * second parent, a pick's authorship — or land inside a rebase.
 * @param {string} cwd
 */
function refuseMidOperation(cwd) {
  const open = operationInProgress(cwd);
  if (open) throw new Error(`${open.operation} is in progress (${open.marker}) — finish or abort it, then commit again`);
}

/**
 * Stage everything under `specs` — edits, new files, deletions — and commit
 * exactly those paths as the index then records them. A removal staged ahead
 * of the call (`git rm --cached`, the file left on disk) is what lands, where
 * `git commit -- <paths>` would read the file straight back from the working
 * tree: the commit is built from a scratch index holding HEAD with the paths'
 * entries taken from the real one, so whatever else is staged stays staged
 * and out of the commit. Each path is taken literally. A path git refuses
 * to stage — one an ignore rule holds out, one beyond a symbolic link — is
 * left as it is, never forced in, and one matching nothing is dropped.
 * Refuses while a merge, cherry-pick, revert or rebase is in progress,
 * touching nothing.
 * @param {string} cwd project root
 * @param {string[]} specs
 * @param {string} message
 * @returns {string|null} the short commit sha, or null when the paths are clean
 */
function commitStaged(cwd, specs, message) {
  refuseMidOperation(cwd);
  const addable = stageableSpecs(cwd, specs).filter((p) => !addRefused(cwd, p));
  if (addable.length > 0) gitIndexed(cwd, ['add', '--all', '--', ...literally(addable)]);
  return commitIndexEntries(cwd, specs, message);
}

/**
 * Whether `git add` refuses the path — a dry run that fails, holding out
 * the `nested` folders the path reaches inside as `commitPathspec` does.
 * Another process's hold on the index is waited out, never read as a
 * refusal.
 * @param {string} cwd @param {string} spec @param {string[]} [nested]
 * @returns {boolean}
 */
function addRefused(cwd, spec, nested = []) {
  try {
    gitIndexed(cwd, ['add', '--all', '--dry-run', '--', ...literally([spec]), ...heldOutOf(nested, [spec])]);
    return false;
  } catch (err) {
    if (isIndexLockError(err instanceof Error ? err.message : String(err))) throw err;
    return true;
  }
}

/**
 * HEAD's tree, or null on a branch with no commits yet — HEAD naming a
 * branch that does not exist. Any other failure to read it throws, never
 * read as no commits.
 * @param {string} cwd
 * @returns {string|null}
 */
function headTree(cwd) {
  const branch = (tryGit(cwd, ['symbolic-ref', '-q', 'HEAD']) || '').trim();
  if (branch !== '' && !git(cwd, ['for-each-ref', '--format=%(refname)', branch]).split('\n').includes(branch)) return null;
  return git(cwd, ['rev-parse', '--verify', 'HEAD^{tree}']).trim();
}

/**
 * Commit HEAD's tree with `specs` as the real index records them, from a
 * scratch index. Null when that is HEAD's tree, or when there is no HEAD and
 * the index records nothing under them.
 * @param {string} cwd @param {string[]} specs @param {string} message
 * @returns {string|null}
 */
function commitIndexEntries(cwd, specs, message) {
  const head = headTree(cwd);
  // `--index-info` reads paths from the repository root, whatever the cwd.
  const entries = git(cwd, ['ls-files', '--stage', '-z', '--full-name', '--', ...literally(specs)]);
  if (head === null && entries === '') return null;
  const env = { GIT_INDEX_FILE: gitPath(cwd, 'workflows-commit.index') };
  try {
    git(cwd, head === null ? ['read-tree', '--empty'] : ['read-tree', 'HEAD'], env);
    git(cwd, ['rm', '--cached', '-r', '-q', '--ignore-unmatch', '--', ...literally(specs)], env);
    if (entries !== '') git(cwd, ['update-index', '-z', '--index-info'], env, entries);
    if (head !== null && git(cwd, ['write-tree'], env).trim() === head) return null;
    git(cwd, ['commit', '-q', '-m', message], env);
  } finally {
    fs.rmSync(env.GIT_INDEX_FILE, { force: true });
  }
  return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
}

/**
 * Every path under `cwd` that differs from HEAD — tracked modifications and
 * untracked, non-ignored files alike, each untracked file on its own and
 * never its folder, whatever the user's `status.showUntrackedFiles` — named
 * from `cwd`, each with its two-letter porcelain status (`??` untracked),
 * `exclude` held out. A nested repo git still names by its folder. Porcelain
 * names a path from the repository's top whatever the cwd, so a cwd below
 * the top has its own prefix taken off. NUL-separated so paths with spaces
 * or non-ASCII bytes survive; a rename record's second field (the source
 * path) is consumed with it.
 * @param {string} cwd
 * @param {string[]} [exclude]
 * @returns {{path: string, status: string}[]}
 */
function dirtyEntries(cwd, exclude = []) {
  const cwdPrefix = git(cwd, ['rev-parse', '--show-prefix']).trim();
  const fields = git(cwd, ['status', '--porcelain', '-z', '--untracked-files=all', '--', '.', ...excluding(exclude)]).split('\0');
  /** @type {{path: string, status: string}[]} */
  const entries = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i];
    if (entry.length < 4) continue;
    entries.push({ path: entry.slice(3 + cwdPrefix.length), status: entry.slice(0, 2) });
    if (entry[0] === 'R' || entry[0] === 'C') i += 1;
  }
  return entries;
}

/**
 * Whether the repo has a commit yet.
 * @param {string} cwd
 * @returns {boolean}
 */
function hasCommits(cwd) {
  return tryGit(cwd, ['rev-parse', '-q', '--verify', 'HEAD']) !== null;
}

/**
 * Every commit whose subject `selects`, oldest first, with the paths under
 * `cwd`, named from it, that it touched, `exclude` left out — a commit that
 * touched none of the rest is not one of `cwd`'s. A move names both its
 * paths. `grep` narrows the walk as a fixed string; `selects` tests the
 * whole subject. NUL-separated names, so no path is quoted, and no
 * signature is read among them whatever the user's `log.showSignature`. A
 * repo with no commits yet has none.
 * @param {string} cwd
 * @param {string} grep
 * @param {(subject: string) => boolean} selects
 * @param {string[]} [exclude]
 * @returns {{sha: string, subject: string, paths: string[]}[]}
 */
function commitsBySubject(cwd, grep, selects, exclude = []) {
  if (!hasCommits(cwd)) return [];
  const out = git(cwd, ['log', '--reverse', '--relative', '--no-renames', '--no-show-signature', '--fixed-strings', `--grep=${grep}`,
    '--format=%x1e%H%x09%s', '--name-only', '-z']);
  return out.split('\x1e').slice(1).flatMap((record) => {
    const end = record.search(/[\n\0]/);
    const head = end < 0 ? record : record.slice(0, end);
    const tab = head.indexOf('\t');
    const subject = head.slice(tab + 1);
    const paths = end < 0 ? [] : record.slice(end).split('\0').map((name) => name.replace(/^\n+/, ''))
      .filter((p) => p !== '' && !exclude.includes(p));
    return selects(subject) && paths.length > 0 ? [{ sha: head.slice(0, tab), subject, paths }] : [];
  });
}

/**
 * Every path under `cwd`, named from it, that a commit whose subject opens
 * `prefix` touched, across the whole history (`commitsBySubject`).
 * @param {string} cwd
 * @param {string} prefix
 * @returns {Set<string>}
 */
function pathsTouchedBySubject(cwd, prefix) {
  return new Set(commitsBySubject(cwd, prefix, (subject) => subject.startsWith(prefix)).flatMap((commit) => commit.paths));
}

/**
 * What a diff from a commit's parent starts at: the parent, or the empty
 * tree where the commit has none.
 * @param {string} cwd @param {string} sha
 * @returns {string}
 */
function parentOrEmptyTree(cwd, sha) {
  const parent = tryGit(cwd, ['rev-parse', '-q', '--verify', `${sha}^`]);
  return parent === null ? emptyTree(cwd) : parent.trim();
}

/**
 * The empty tree's name in the repo's object format — the base of a repo
 * with no commits yet.
 * @param {string} cwd
 * @returns {string}
 */
function emptyTree(cwd) {
  return git(cwd, ['hash-object', '-t', 'tree', '--stdin'], undefined, '').trim();
}

/**
 * The untracked, unignored files under `cwd`, one by one and named from it,
 * `exclude` held out — never a folder, so a nested repo git names by its
 * folder is not one.
 * @param {string} cwd
 * @param {string[]} [exclude]
 * @returns {string[]}
 */
function untrackedFiles(cwd, exclude = []) {
  return git(cwd, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...excluding(exclude)])
    .split('\0').filter((p) => p !== '' && !p.endsWith('/'));
}

/**
 * The patch `git diff` answers for `args`, plain whatever the user's config —
 * no colour, no external diff driver.
 * @param {string} cwd
 * @param {string[]} args
 * @param {Record<string, string>} [env] variables layered over the process's own
 * @returns {string}
 */
function diffPatch(cwd, args, env) {
  return git(cwd, ['diff', '--no-color', '--no-ext-diff', ...args], env);
}

/**
 * The patch `git diff {base}` answers under `cwd` with every untracked file
 * there read as an addition beside the tracked change, `exclude` held out of
 * both. The untracked files are taken in as intent-to-add on a scratch copy
 * of the index, removed after, so the real index never changes.
 * @param {string} cwd
 * @param {string} base a commit or a tree
 * @param {string[]} args diff options
 * @param {string[]} exclude
 * @returns {string}
 */
function diffWithUntracked(cwd, base, args, exclude) {
  const index = gitPath(cwd, 'index');
  const env = { GIT_INDEX_FILE: gitPath(cwd, `workflows-diff-${process.pid}.index`) };
  try {
    // The copy keeps the index's modified time: git reads an entry no older
    // than the index file as possibly changed, and a fresh time would pass a
    // file edited in the index's own second as clean.
    if (fs.existsSync(index)) fs.cpSync(index, env.GIT_INDEX_FILE, { preserveTimestamps: true });
    const untracked = untrackedFiles(cwd, exclude);
    if (untracked.length > 0) {
      git(cwd, ['--literal-pathspecs', 'add', '--intent-to-add', '--pathspec-from-file=-', '--pathspec-file-nul'], env, untracked.join('\0'));
    }
    return diffPatch(cwd, [...args, base, '--', '.', ...excluding(exclude)], env);
  } finally {
    fs.rmSync(env.GIT_INDEX_FILE, { force: true });
  }
}

module.exports = {
  READ_BUDGET_BYTES, git, tryGit, GitError, gitPath, commitPathspec, commitStaged, dirtyEntries, hasCommits, commitsBySubject, pathsTouchedBySubject,
  parentOrEmptyTree, emptyTree, diffPatch, diffWithUntracked, literally,
  stageableSpecs, hasStagedDeletions, deletedAtHead, onBranch, operationInProgress, addRefused,
};
