'use strict';

// ---------------------------------------------------------------------------
// Kernel: the project's repos. The root is git as run at the code root
// (kernel/code-root), whatever repository holds it. A nested repo is a folder inside the project
// holding a `.git` of its own that its parent's git reports as a whole: a
// nested clone — untracked (named at any depth), or its gitlink staged with
// no `.gitmodules` entry, as `git add` stages one — a submodule (a gitlink
// the parent's `.gitmodules` maps, read from what defines one, never from
// the index alone, which a builder changes), or an ignored folder that
// holds `.git` itself. Each found repo is searched the
// same way for its own. A repo inside an ignored folder that is not itself a
// repo is never found: git never descends into one, and walking it
// (`node_modules/`) costs more than the case is worth. A linked worktree of
// the parent's own repository holds `.git` too, but is that repository
// checked out again, never a repo of its own: its folder stays the parent's.
//
// The walk reads each repo's index, its untracked and its ignored folders,
// each folder's `.git` and the `.gitmodules` at its top. It is walked afresh
// by every verb and kept for it, dropped as the verb's reads of git are
// (kernel/git-reads): a repo the verb makes or takes away without git shows
// at the next drop. Never recorded past the verb.
//
// Paths in and out are the project's, `/`-separated, translated to and from
// each nested repo's own; a root inside a larger repository reads only the
// project's folder of it. A parent's git holds out by pathspec each
// untracked repo and submodule directly inside it
// — an ignored one it never reads — so a nested repo's folder or a
// submodule's moved pointer is never the parent's dirt and never rides its
// commit, but for one rule: a code commit that reaches into a submodule
// records the submodule's new pointer in its parent, the child committing
// first. The state is a worktree of the root's own repository, so never a
// repo of the project; in the main checkout, where its folder sits, a read
// of the root's code holds it out, so it is never code dirt.
//
// Where the project sits in its repository is read here alone (`placeOf`):
// the top of the checkout the code root is in, and the code root's folder
// from there, its prefix — `''` at the top. A nested repo is the top of its
// own checkout, so only a root has a prefix, and it is the same in every
// checkout of its repository. Each repo carries its prefix, so a path
// crosses between the repo's folder and its repository's top
// (`topPath`, `folderPath`), and a folder between a checkout's top and the
// repo's folder in it (`checkoutTop`, `folderUnder`), with no read.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, tryGit, dirtyEntries } = require('./git.cjs');
const { keptRead } = require('./git-reads.cjs');
const { stateRoot } = require('./state-root.cjs');
const { codeRoot } = require('./code-root.cjs');

/**
 * Where a folder sits in its repository: `top` the top of the checkout it
 * is in, as git names it, and `prefix` the folder from there — `''` at the
 * top, else ending in `/`.
 * @typedef {{top: string, prefix: string}} Place
 */

/**
 * A repo in the project: `dir` its folder from the project root (`''` for
 * the root), `path` that folder absolute, `prefix` that folder from its
 * repository's top (`Place`), `heldOut` the folders its git holds out — the
 * nested clones and submodules directly inside it, as it names them — and
 * `submodules` those of them `.gitmodules` maps.
 * @typedef {{dir: string, path: string, prefix: string, heldOut: string[], submodules: string[]}} Repo
 */

/** Where the folder `dir` sits in its repository. @param {string} dir @returns {Place} */
function placeOf(dir) {
  const [top, prefix] = git(dir, ['rev-parse', '--show-toplevel', '--show-prefix']).split('\n');
  return { top, prefix };
}

/** A path from the folder, as its repository's top names it. @param {{prefix: string}} at @param {string} rel */
function topPath({ prefix }, rel) {
  return `${prefix}${rel}`;
}

/**
 * A path from the repository's top, as the folder names it — null where it
 * lies outside the folder.
 * @param {{prefix: string}} at @param {string} topRel
 * @returns {string|null}
 */
function folderPath({ prefix }, topRel) {
  return topRel.startsWith(prefix) ? topRel.slice(prefix.length) : null;
}

/** The top of the checkout holding `folder`, a folder `at`'s prefix deep. @param {{prefix: string}} at @param {string} folder */
function checkoutTop({ prefix }, folder) {
  return path.join(folder, ...prefix.split('/').filter(Boolean).map(() => '..'));
}

/** The folder `at`'s prefix deep in the checkout whose top is `top`. @param {{prefix: string}} at @param {string} top */
function folderUnder({ prefix }, top) {
  return path.resolve(top, prefix);
}

/**
 * The NUL-separated entries a git listing answers.
 * @param {string} cwd @param {string[]} args
 * @returns {string[]}
 */
function listed(cwd, args) {
  return git(cwd, args).split('\0').filter(Boolean);
}

/**
 * The repository a checkout belongs to: its common git dir, which every
 * linked worktree of one repository shares, with symbolic links resolved —
 * or null where git finds no repository there, or where what git names
 * cannot be resolved.
 * @param {string} dir
 * @returns {string|null}
 */
function commonDir(dir) {
  const out = tryGit(dir, ['rev-parse', '--git-common-dir']);
  if (out === null) return null;
  try {
    return fs.realpathSync(path.resolve(dir, out.trim()));
  } catch {
    return null;
  }
}

/**
 * The folders the `.gitmodules` at the top of a folder's repository maps to
 * a submodule, as that folder names them; none where it has none.
 * @param {Place} place the folder's @returns {string[]}
 */
function mappedSubmodules(place) {
  const file = path.join(place.top, '.gitmodules');
  const mapping = fs.existsSync(file) ? tryGit(place.top, ['config', '--file', file, '-z', '--get-regexp', '^submodule\\..*\\.path$']) : null;
  return (mapping ?? '').split('\0').filter(Boolean)
    .flatMap((record) => folderPath(place, record.slice(record.indexOf('\n') + 1)) ?? []);
}

/**
 * The folders directly inside the repo at `cwd` that hold a repo of their
 * own, as that repo names them: the nested clones — untracked, which git
 * marks with a trailing `/`, or a `160000` index entry `.gitmodules` does
 * not map — the submodules, the `160000` entries it maps, and the ignored
 * ones. A folder holding a worktree of the repo at `cwd`, or a `.git` git
 * cannot read, holds no repo of its own.
 * @param {string} cwd @param {Place} place the repo's
 * @returns {{untracked: string[], submodules: string[], ignored: string[]}}
 */
function nestedRepoFolders(cwd, place) {
  /** @type {string|null|undefined} */
  let own;
  const holdsRepo = (/** @type {string} */ rel) => {
    const abs = path.join(cwd, rel);
    if (!fs.existsSync(path.join(abs, '.git'))) return false;
    const its = commonDir(abs);
    if (its === null) return false;
    if (own === undefined) own = commonDir(cwd);
    return its !== own;
  };
  const folders = (/** @type {string[]} */ args) => listed(cwd, args).filter((p) => p.endsWith('/')).map((p) => p.slice(0, -1));
  const gitlinks = [...new Set(listed(cwd, ['ls-files', '--stage', '-z'])
    .filter((entry) => entry.startsWith('160000 '))
    .map((entry) => entry.slice(entry.indexOf('\t') + 1)))];
  const mapped = gitlinks.length === 0 ? [] : mappedSubmodules(place);
  return {
    untracked: [...folders(['ls-files', '--others', '--exclude-standard', '-z']), ...gitlinks.filter((folder) => !mapped.includes(folder))].filter(holdsRepo),
    submodules: gitlinks.filter((folder) => mapped.includes(folder)).filter(holdsRepo),
    ignored: folders(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z']).filter(holdsRepo),
  };
}

/**
 * A path in the repo at `dir` as the project names it.
 * @param {string} dir @param {string} repoRel
 * @returns {string}
 */
function projectPath(dir, repoRel) {
  return dir === '' ? repoRel : `${dir}/${repoRel}`;
}

/**
 * The repo at `dir`, then every repo nested inside it, at any depth — each
 * nested one the top of its own checkout.
 * @param {string} dir @param {string} abs @param {Place} place the repo's
 * @returns {Repo[]}
 */
function searched(dir, abs, place) {
  const { untracked, submodules, ignored } = nestedRepoFolders(abs, place);
  const nested = [...untracked, ...submodules, ...ignored].flatMap((rel) => {
    const at = path.join(abs, rel);
    return searched(projectPath(dir, rel), at, { top: at, prefix: '' });
  });
  return [{ dir, path: abs, prefix: place.prefix, heldOut: [...untracked, ...submodules], submodules }, ...nested];
}

/**
 * Every repo in the project: the code root's first, then the nested ones in
 * `dir` order — each call its own copy of what the verb keeps, so no caller
 * changes it for another.
 * @param {string} cwd
 * @returns {Repo[]}
 */
function projectRepos(cwd) {
  return keptRead('repos', cwd, () => walked(cwd)).map((repo) => ({ ...repo, heldOut: [...repo.heldOut], submodules: [...repo.submodules] }));
}

/** The project's repos as a walk finds them now. @param {string} cwd @returns {Repo[]} */
function walked(cwd) {
  const root = codeRoot(cwd);
  const [rootRepo, ...nested] = searched('', root, placeOf(root));
  return [rootRepo, ...nested.sort((a, b) => (a.dir < b.dir ? -1 : 1))];
}

/**
 * Whether the repo's folder holds the project path — the root holds every one.
 * @param {Repo} repo @param {string} relPath
 * @returns {boolean}
 */
function holds(repo, relPath) {
  return repo.dir === '' || relPath === repo.dir || relPath.startsWith(`${repo.dir}/`);
}

/**
 * The repo that owns a project path: the deepest whose folder holds it.
 * @param {Repo[]} repos @param {string} relPath
 * @returns {Repo}
 */
function repoOf(repos, relPath) {
  return repos.filter((repo) => holds(repo, relPath))
    .reduce((deepest, repo) => (repo.dir.length > deepest.dir.length ? repo : deepest));
}

/**
 * A project path as the repo holding it names it — `.` for the repo's own folder.
 * @param {Repo} repo @param {string} relPath
 * @returns {string}
 */
function repoPath(repo, relPath) {
  return repo.dir === '' ? relPath : relPath.slice(repo.dir.length + 1) || '.';
}

/**
 * The name a response gives the repo: its folder, `.` for the root.
 * @param {Repo} repo
 * @returns {string}
 */
function repoName(repo) {
  return repo.dir || '.';
}

/**
 * How deep the repo's folder sits in the project — the root at 0.
 * @param {Repo} repo
 * @returns {number}
 */
function depth(repo) {
  return repo.dir === '' ? 0 : repo.dir.split('/').length;
}

/**
 * Repos deepest first, then by folder, so each comes before the one it is
 * nested in, and the root last.
 * @param {Repo[]} repos
 * @returns {Repo[]}
 */
function childrenFirst(repos) {
  return [...repos].sort((a, b) => depth(b) - depth(a) || (a.dir < b.dir ? -1 : 1));
}

/**
 * A code commit's project paths grouped by the repo that owns each, each
 * group's paths as its repo names them, in commit order (`childrenFirst`),
 * so a repo commits before the one it is nested in. A repo whose
 * submodule has a group takes the submodule's folder too, so the
 * submodule's new pointer lands in the same call.
 * @param {Repo[]} repos @param {string[]} relPaths
 * @returns {{repo: Repo, paths: string[]}[]}
 */
function commitGroups(repos, relPaths) {
  /** @type {Map<string, {repo: Repo, paths: string[]}>} */
  const groups = new Map();
  for (const repo of childrenFirst(repos)) {
    const paths = [
      ...relPaths.filter((p) => repoOf(repos, p) === repo).map((p) => repoPath(repo, p)),
      ...repo.submodules.filter((folder) => groups.has(projectPath(repo.dir, folder))),
    ];
    if (paths.length > 0) groups.set(repo.dir, { repo, paths });
  }
  return [...groups.values()];
}

/**
 * What a read of the repo's code holds out: the folders its git holds out,
 * and in the root the state's folder where it sits inside — the main
 * checkout holds it, a linked worktree never does.
 * @param {Repo} repo
 * @returns {string[]}
 */
function codeHeldOut(repo) {
  if (repo.dir !== '') return repo.heldOut;
  const state = path.relative(fs.realpathSync(repo.path), stateRoot(repo.path));
  const inside = !state.startsWith('..') && !path.isAbsolute(state);
  return inside ? [...repo.heldOut, state.split(path.sep).join('/')] : repo.heldOut;
}

/**
 * `dirtyEntries` across the project: each repo's, root first, in project
 * paths, what a read of its code holds out held out, and each entry `kept`
 * refuses, as the repo names it; a rename read as its two paths where
 * `renames` is off.
 * @param {Repo[]} repos
 * @param {{kept?: (repo: Repo, entry: {path: string, status: string}) => boolean, renames?: boolean}} [opts]
 * @returns {{path: string, status: string}[]}
 */
function projectDirtyEntries(repos, { kept = () => true, renames = true } = {}) {
  return repos.flatMap((repo) => dirtyEntries(repo.path, repo.prefix, codeHeldOut(repo), false, renames).filter((entry) => kept(repo, entry))
    .map((entry) => ({ path: projectPath(repo.dir, entry.path), status: entry.status })));
}

module.exports = {
  projectRepos, mappedSubmodules, repoOf, repoPath, repoName, projectPath, childrenFirst, commitGroups,
  codeHeldOut, projectDirtyEntries, placeOf, topPath, folderPath, checkoutTop, folderUnder,
};
