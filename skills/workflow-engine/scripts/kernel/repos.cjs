'use strict';

// ---------------------------------------------------------------------------
// Kernel: the project's repos. The root is git as run at the project root,
// whatever repository holds it. A nested repo is a folder inside the project
// holding a `.git` of its own that its parent's git reports as a whole: an
// untracked nested repo (named at any depth), a submodule (its gitlink), or
// an ignored folder that holds `.git` itself. Each found repo is searched the
// same way for its own. A repo inside an ignored folder that is not itself a
// repo is never found: git never descends into one, and walking it
// (`node_modules/`) costs more than the case is worth. A linked worktree of
// the parent's own repository holds `.git` too, but is that repository
// checked out again, never a repo of its own: its folder stays the parent's.
//
// Found on every call, never recorded. Paths in and out are the project's,
// `/`-separated, translated to and from each nested repo's own; a root inside
// a larger repository answers dirt and history as that repository's git
// names them. A parent's git holds out by pathspec each untracked repo and
// submodule directly inside it — it ignores the rest already, and refuses an
// ignored path named to it — so a nested repo's folder or a submodule's moved
// pointer is never the parent's dirt and never rides its commit. The
// project's `.workflows/` is the workflows' own, never code dirt.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { git, dirtyEntries, pathsTouchedBySubject } = require('./git.cjs');

/**
 * A repo in the project: `dir` its folder from the project root (`''` for
 * the root), `path` that folder absolute, `heldOut` the folders its git
 * holds out — the untracked repos and submodules directly inside it, as it
 * names them.
 * @typedef {{dir: string, path: string, heldOut: string[]}} Repo
 */

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
 * linked worktree of one repository shares.
 * @param {string} dir
 * @returns {string}
 */
function commonDir(dir) {
  return git(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
}

/**
 * The folders directly inside the repo at `cwd` that hold a repo of their
 * own, as that repo names them: `taken` those its git would take in — an
 * untracked nested repo, which git marks with a trailing `/`, and a
 * submodule, a `160000` index entry — and `ignored` the ignored ones. A
 * folder holding a worktree of the repo at `cwd` holds no repo of its own.
 * @param {string} cwd
 * @returns {{taken: string[], ignored: string[]}}
 */
function nestedRepoFolders(cwd) {
  /** @type {string|undefined} */
  let own;
  const holdsRepo = (/** @type {string} */ rel) => {
    const abs = path.join(cwd, rel);
    if (!fs.existsSync(path.join(abs, '.git'))) return false;
    own ??= commonDir(cwd);
    return commonDir(abs) !== own;
  };
  const folders = (/** @type {string[]} */ args) => listed(cwd, args).filter((p) => p.endsWith('/')).map((p) => p.slice(0, -1));
  const untracked = folders(['ls-files', '--others', '--exclude-standard', '-z']);
  const submodules = listed(cwd, ['ls-files', '--stage', '-z'])
    .filter((entry) => entry.startsWith('160000 '))
    .map((entry) => entry.slice(entry.indexOf('\t') + 1));
  return {
    taken: [...new Set([...untracked, ...submodules])].filter(holdsRepo),
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
 * The repo at `dir`, then every repo nested inside it, at any depth.
 * @param {string} dir @param {string} abs
 * @returns {Repo[]}
 */
function searched(dir, abs) {
  const { taken, ignored } = nestedRepoFolders(abs);
  const nested = [...taken, ...ignored].flatMap((rel) => searched(projectPath(dir, rel), path.join(abs, rel)));
  return [{ dir, path: abs, heldOut: taken }, ...nested];
}

/**
 * Every repo in the project: the root first, then the nested ones in `dir` order.
 * @param {string} root project root
 * @returns {Repo[]}
 */
function projectRepos(root) {
  const [rootRepo, ...nested] = searched('', root);
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
 * Project paths grouped by the repo that owns each, in `repos` order, each
 * group's paths as its repo names them.
 * @param {Repo[]} repos @param {string[]} relPaths
 * @returns {{repo: Repo, paths: string[]}[]}
 */
function pathsByRepo(repos, relPaths) {
  return repos
    .map((repo) => ({ repo, paths: relPaths.filter((p) => repoOf(repos, p) === repo).map((p) => repoPath(repo, p)) }))
    .filter((group) => group.paths.length > 0);
}

/**
 * `dirtyEntries` across the project: each repo's, root first, its held-out
 * folders held out, and the project's `.workflows/` dropped.
 * @param {Repo[]} repos
 * @returns {{path: string, status: string}[]}
 */
function projectDirtyEntries(repos) {
  return repos
    .flatMap((repo) => dirtyEntries(repo.path, repo.heldOut)
      .map((entry) => ({ path: projectPath(repo.dir, entry.path), status: entry.status })))
    .filter((entry) => entry.path !== '.workflows' && !entry.path.startsWith('.workflows/'));
}

/**
 * `pathsTouchedBySubject` across the project, in project paths.
 * @param {Repo[]} repos @param {string} prefix
 * @returns {Set<string>}
 */
function projectPathsTouchedBySubject(repos, prefix) {
  return new Set(repos.flatMap((repo) => [...pathsTouchedBySubject(repo.path, prefix)].map((p) => projectPath(repo.dir, p))));
}

module.exports = {
  projectRepos, repoOf, repoPath, repoName, pathsByRepo,
  projectDirtyEntries, projectPathsTouchedBySubject,
};
