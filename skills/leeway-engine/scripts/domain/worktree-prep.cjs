'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a worktree the engine lays out (project-layout.cjs) prepared
// as Claude Code prepares an isolation worktree, so the tools run there as
// in the project's checkout: the mutation run's, every repository of it
// (verify.cjs, `verify mutants`), and a task's, each child repository
// `task worktree` lays out in it, the root being Claude Code's own
// (task-worktree.cjs). In each repository laid out, from that repository's
// checkout:
//
// - the files its `.worktreeinclude` names that git ignores, copied — the
//   patterns read as `.gitignore`'s, from the file's own folder, a file
//   tracked or not ignored never one of them, a directory linked below
//   never walked;
// - each directory the project's Claude Code settings name in
//   `worktree.symlinkDirectories` (`.claude/settings.json`, then
//   `.claude/settings.local.json`, settings.cjs), linked where the checkout
//   has it — `node_modules`, say — never copied, so taking the worktree
//   apart removes the link alone.
//
// Nothing the worktree holds already is replaced, and a name that leaves the
// repository is passed over.
//
// A link preparation makes — Claude Code's at the root, this module's in a
// child repository — is never a change of the work, though git names it
// untracked where a `.gitignore` names the folder as one, `node_modules/`:
// wherever the engine reads what a checkout holds not committed, an
// untracked symbolic link at a directory the settings name to link is
// passed over, in every repository of the project (`preparedLinkOf`) — the
// task's end, its close and a take-over (task-worktree.cjs), `code status`
// and `verify run` (code.cjs), the commit door's `left_dirty`, and the
// review's reads of the tree (`codeChanges`) — the door holds each out of
// what it stages, refusing one named (`linksHeldOut`), and taking a
// worktree apart removes each first (`removePreparedLinks`). An index that
// holds one staged already, a nested clone's gitlink, or a file in a nested
// repository's folder is the door's to refuse before it commits by either
// route (`stagedHeldOut`).
//
// The engine lays its own worktrees out beside Claude Code's, in
// `.claude/worktrees/` of the main checkout, each named `leeway-…` — the
// mutation run's and each reader's scratch (project-layout.cjs). Where the
// project does not ignore that folder, git names each untracked in the
// project's own checkout; none is ever the person's change, so every read
// of what the checkout holds passes over them (`codeChanges`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, dirtyEntries, hasCommits, emptyTree, literally } = require('../kernel/git.cjs');
const { projectDirtyEntries, mappedSubmodules, checkoutTop } = require('../kernel/repos.cjs');
const { readSettings } = require('./settings.cjs');
const { projectCheckout } = require('./landing-git.cjs');

const INCLUDE = '.worktreeinclude';

/** Where Claude Code lays out its isolation worktrees in the main checkout, and the engine its own beside them. */
const LAYOUTS = '.claude/worktrees';

/** How each of the engine's own layouts there is named, before its name. */
const LAYOUT = 'leeway-';

/** One of the engine's own layouts, as git names it untracked in the project's own checkout. */
const OWN_LAYOUT = new RegExp(`^${LAYOUTS.replaceAll('.', '\\.')}/${LAYOUT}[^/]+/$`);
const SETTINGS = ['.claude/settings.json', '.claude/settings.local.json'];

/** @typedef {{dir: string, path: string}} Laid a repository by its folder from the project's root, at `path` */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {{path: string, status: string}} Entry a change git names, its two-letter status `??` where untracked */

/** Whether `name` stays within the folder it is named from. @param {string} name */
function within(name) {
  const plain = path.normalize(name);
  return plain !== '.' && !path.isAbsolute(plain) && plain !== '..' && !plain.startsWith(`..${path.sep}`);
}

/**
 * The directories the project's settings at `root` name to link, each once.
 * @param {string} root @returns {string[]}
 */
function linkedDirectories(root) {
  const named = SETTINGS.flatMap((rel) => {
    const listed = readSettings(path.join(root, rel)).settings.worktree?.symlinkDirectories;
    return Array.isArray(listed) ? listed.filter((name) => typeof name === 'string' && within(name)) : [];
  });
  return [...new Set(named.map((name) => path.normalize(name).replace(/\/+$/, '')))];
}

/**
 * A line of a `.worktreeinclude` whose folder is `prefix` deep in its
 * repository, anchored there for git, which reads a pattern handed it from
 * the repository's top; null where the line holds none.
 * @param {string} prefix @param {string} line @returns {string|null}
 */
function anchoredAt(prefix, line) {
  const pattern = line.replace(/(?<!\\) +$/, '');
  if (pattern === '' || pattern.startsWith('#')) return null;
  if (prefix === '') return pattern;
  const negated = pattern.startsWith('!') ? '!' : '';
  const body = pattern.slice(negated.length);
  const folder = `/${prefix.replace(/[*?[\\]/g, '\\$&')}`;
  if (body.startsWith('/')) return `${negated}${folder}${body.slice(1)}`;
  return `${negated}${folder}${body.replace(/\/+$/, '').includes('/') ? '' : '**/'}${body}`;
}

/**
 * The files of `repo`'s checkout its `.worktreeinclude` names that git
 * ignores, by path from its folder, never under a directory in `linked`.
 * @param {{path: string, prefix: string}} repo @param {string[]} linked @returns {string[]}
 */
function includedFiles(repo, linked) {
  const file = path.join(repo.path, INCLUDE);
  if (!fs.existsSync(file)) return [];
  const patterns = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => anchoredAt(repo.prefix, line)).filter((pattern) => pattern !== null);
  const listed = (/** @type {string} */ out) => out.split('\0').filter((entry) => entry !== '');
  const ignored = listed(git(repo.path, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory']))
    .filter((entry) => !linked.includes(entry.replace(/\/+$/, '')));
  if (patterns.length === 0 || ignored.length === 0) return [];
  return listed(git(repo.path, ['ls-files', '-z', '--others', '--ignored', ...patterns.map((pattern) => `--exclude=${pattern}`), '--', ...ignored]));
}

/** `from` copied to `to`, its mode kept, where `to` is not there. @param {string} from @param {string} to */
function copied(from, to) {
  if (fs.existsSync(to) || !fs.statSync(from).isFile()) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  fs.chmodSync(to, fs.statSync(from).mode & 0o777);
}

/** `to` made a link to the directory `from`, where it has one and `to` is not there. @param {string} from @param {string} to */
function linked(from, to) {
  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) return;
  try {
    fs.lstatSync(to);
    return;
  } catch { /* not there: linked below */ }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.symlinkSync(from, to, 'dir');
}

/**
 * Each repository of `repos`, laid out at its place in `laid` by the same
 * order, prepared as the header says, the settings read from the project's
 * own checkout, `repos`' first unless named.
 * @param {Repo[]} repos the checkouts @param {Laid[]} laid @param {string} [project] the project's own checkout
 */
function prepareWorktree(repos, laid, project = repos[0].path) {
  const directories = linkedDirectories(project);
  repos.forEach((repo, at) => {
    for (const name of directories) linked(path.join(repo.path, name), path.join(laid[at].path, name));
    for (const file of includedFiles(repo, directories)) copied(path.join(repo.path, file), path.join(laid[at].path, file));
  });
}

/** Whether the folder `at` holds a symbolic link at `name`. @param {string} at @param {string} name */
function linkAt(at, name) {
  try {
    return fs.lstatSync(path.join(at, name)).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Whether a change git names in the checkout at `at` of one of the
 * project's repositories, its path from there, is a link preparation made
 * (the header's): untracked, a symbolic link, at a directory the settings
 * of the project's own checkout, `project`, name to link — read once, the
 * first time such a link is met.
 * @param {() => string} project
 * @returns {(at: string, entry: Entry) => boolean}
 */
function preparedLinkOf(project) {
  /** @type {string[]|undefined} */
  let directories;
  return (at, { path: entry, status }) => status === '??' && linkAt(at, entry) && (directories ??= linkedDirectories(project())).includes(entry);
}

/** The predicate of a link preparation made, for the project whose repositories are `repos`, from any checkout of it. @param {Repo[]} repos */
const preparedIn = (repos) => preparedLinkOf(() => projectCheckout(repos[0].path, repos[0]));

/**
 * The links preparation made in a checkout of one of the project's
 * repositories, `repo`'s folder there at `at`, removed, so git takes that
 * worktree apart as a clean one; none where its folder is gone.
 * @param {Repo} repo @param {string} at @param {() => string} project the project's own checkout
 */
function removePreparedLinks(repo, at, project) {
  if (!fs.existsSync(at)) return;
  const prepared = preparedLinkOf(project);
  for (const entry of dirtyEntries(at, repo.prefix)) if (prepared(at, entry)) fs.unlinkSync(path.join(at, entry.path));
}

/** Whether a change git names in a checkout of `repo` is one of the engine's own layouts (the header's). @param {Repo} repo @param {Entry} entry */
const ownLayout = (repo, { path: entry, status }) => repo.dir === '' && status === '??' && OWN_LAYOUT.test(entry);

/**
 * What the checkouts of `repos`, the project's, hold not committed, in
 * project paths (kernel/repos.cjs, `projectDirtyEntries`), less the links
 * preparation made in each and the engine's own layouts; a rename read as
 * its two paths where `renames` is off.
 * @param {Repo[]} repos @param {{renames?: boolean}} [opts] @returns {Entry[]}
 */
function codeChanges(repos, { renames = true } = {}) {
  const prepared = preparedIn(repos);
  return projectDirtyEntries(repos, { kept: (repo, entry) => !prepared(repo.path, entry) && !ownLayout(repo, entry), renames });
}

/**
 * The project's repositories, each holding the links preparation made in
 * its checkout out of what a commit stages, as it holds out a nested
 * repository's folder (`heldOut`), and those links, by its folder.
 * @param {Repo[]} repos
 * @returns {{repos: Repo[], links: Map<string, string[]>}}
 */
function linksHeldOut(repos) {
  const prepared = preparedIn(repos);
  const links = new Map(repos.map((repo) => [repo.dir, dirtyEntries(repo.path, repo.prefix, repo.heldOut).filter((entry) => prepared(repo.path, entry)).map(({ path: entry }) => entry)]));
  return { repos: repos.map((repo) => ({ ...repo, heldOut: [...repo.heldOut, .../** @type {string[]} */ (links.get(repo.dir))] })), links };
}

/**
 * What the index of one of the project's repositories holds against its
 * HEAD that the door never commits (the header's), each by its path from the
 * repository with what it is: a link preparation made — a symbolic link at a
 * directory the settings name to link — a nested clone's gitlink, one
 * `.gitmodules` does not map (kernel/repos.cjs), as `git add` stages a clone,
 * and a file in the folder of a repository nested in it, as a merge or a
 * checkout of a tree holding one writes it there.
 * @param {Repo[]} repos the project's, as `projectRepos` reads them @param {Repo} repo one of them
 * @returns {{path: string, what: string}[]}
 */
function stagedHeldOut(repos, repo) {
  const raw = git(repo.path, ['diff', '--cached', '--raw', '--relative', '--no-renames', '--ignore-submodules=none', '-z', hasCommits(repo.path) ? 'HEAD' : emptyTree(repo.path)]).split('\0');
  const staged = raw.flatMap((record, i) => (record.startsWith(':') ? [{ mode: record.split(' ')[1], name: raw[i + 1] }] : []))
    .filter(({ mode }) => mode !== '000000');
  if (staged.length === 0) return [];
  const directories = linkedDirectories(projectCheckout(repos[0].path, repos[0]));
  const mapped = mappedSubmodules({ top: checkoutTop(repo, repo.path), prefix: repo.prefix });
  /** @type {Map<string, boolean>} */
  const nestedAt = new Map();
  const inNested = (/** @type {string} */ name) => {
    const folder = path.posix.dirname(name);
    if (folder === '.') return false;
    if (!nestedAt.has(folder)) nestedAt.set(folder, fs.existsSync(path.join(repo.path, folder, '.git')) || inNested(folder));
    return /** @type {boolean} */ (nestedAt.get(folder));
  };
  const what = (/** @type {{mode: string, name: string}} */ { mode, name }) => {
    if (mode === '120000' && directories.includes(name)) return 'a link the worktree\'s preparation made, as worktree.symlinkDirectories names';
    if (mode === '160000' && !mapped.includes(name)) return 'the gitlink of a repository nested in it that no .gitmodules entry maps';
    return inNested(name) ? 'in the folder of a repository nested in it' : null;
  };
  return staged.flatMap((entry) => {
    const held = what(entry);
    return held === null ? [] : [{ path: entry.name, what: held }];
  });
}

module.exports = { LAYOUTS, LAYOUT, prepareWorktree, preparedLinkOf, removePreparedLinks, codeChanges, linksHeldOut, stagedHeldOut };
