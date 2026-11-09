'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's one checkout, held by one fix at a time
// (19.5.23) — what a fix had not committed when a question parked it set
// aside, so the next fix starts on a clean checkout, and put back when it
// starts again.
//
// - A raise that parks a fix holding the checkout — in progress, no question
//   waiting parking it yet (raise.cjs) — first sets aside what the checkout
//   holds not committed outside the state (worktree-prep.cjs,
//   `codeChanges`), in each of the project's repositories holding any: a
//   commit of it, its untracked files among it, on the tip the checkout has
//   out, at a ref of the unit's own, `refs/leeway/aside/{unit}/{task id}` —
//   never on the stash list, which every checkout shares — then each of its
//   paths back as that tip holds it, so the checkout is left clean at the
//   branch's tip for the next fix to start on.
// - The fix's next start (task-verbs.cjs), once the checkout is on the
//   branch, puts it back onto the tip as it then stands — git's own merge
//   of it from the tip it was set aside on, its change left uncommitted as
//   it was and its ref dropped — refused, nothing moved, where in any
//   repository it conflicts with what the tip now holds, naming each path,
//   the ref and the way on: its change made again by hand, the ref dropped.
// - A brief for a fix whose work is set aside is refused, naming the start
//   that puts it back (brief.cjs); a fix closed drops what it set aside, its
//   work given up with it (task-verbs.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { codeRoot } = require('../kernel/code-root.cjs');
const { git, tryGit, gitPath } = require('../kernel/git.cjs');
const { projectRepos, repoOf, repoPath, projectPath } = require('../kernel/repos.cjs');
const { codeChanges } = require('./worktree-prep.cjs');
const { mergeTree, plain } = require('./landing-git.cjs');
const { quickFixBranch } = require('./landing-names.cjs');
const { taskId, taskName, shownTask } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** Where a fix's work is set aside, in each repository holding any. @param {TaskRef} ref */
const asideRef = (ref) => `refs/leeway/aside/${ref.unit}/${taskId(ref)}`;

/** A git call in a repository as a way on names it: `git -C {folder}` in a nested one. @param {Repo} repo */
const gitIn = (repo) => (repo.dir === '' ? 'git' : `git -C ${plain(repo.dir)}`);

/** Each of the project's repositories holding work the fix set aside, with the commit holding it. @param {string} cwd @param {TaskRef} ref */
function heldAside(cwd, ref) {
  return projectRepos(codeRoot(cwd)).flatMap((repo) => {
    const sha = tryGit(repo.path, ['rev-parse', '-q', '--verify', `${asideRef(ref)}^{commit}`])?.trim();
    return sha === undefined ? [] : [{ repo, sha }];
  });
}

/**
 * What the project's checkout holds not committed, by the repository
 * holding each path, each as that repository names it.
 * @param {Repo[]} repos @returns {Map<Repo, string[]>}
 */
function dirtByRepo(repos) {
  /** @type {Map<Repo, string[]>} */
  const by = new Map();
  for (const { path: at } of codeChanges(repos, { renames: false })) {
    const repo = repoOf(repos, at);
    by.set(repo, [...(by.get(repo) ?? []), repoPath(repo, at)]);
  }
  return by;
}

/**
 * The repository's paths committed on its HEAD, at the fix's ref, its
 * untracked files among them, through an index of its own.
 * @param {Repo} repo @param {string[]} paths @param {TaskRef} ref
 */
function commitAside(repo, paths, ref) {
  const env = { GIT_INDEX_FILE: gitPath(repo.path, `leeway-aside-${process.pid}.index`) };
  try {
    git(repo.path, ['read-tree', 'HEAD'], env);
    git(repo.path, ['--literal-pathspecs', 'add', '--all', '--pathspec-from-file=-', '--pathspec-file-nul'], env, paths.join('\0'));
    const tree = git(repo.path, ['write-tree'], env).trim();
    const sha = git(repo.path, ['commit-tree', tree, '-p', 'HEAD', '-m', `${taskName(ref)}'s work, set aside when a question parked it`]).trim();
    git(repo.path, ['update-ref', asideRef(ref), sha, '']);
  } finally {
    fs.rmSync(env.GIT_INDEX_FILE, { force: true });
  }
}

/** Each path back as the repository's HEAD holds it, one HEAD lacks removed. @param {Repo} repo @param {string[]} paths */
function cleaned(repo, paths) {
  const tracked = paths.filter((at) => tryGit(repo.path, ['cat-file', '-e', `HEAD:${at}`]) !== null);
  if (tracked.length > 0) git(repo.path, ['--literal-pathspecs', 'restore', '--source=HEAD', '--staged', '--worktree', '--pathspec-from-file=-', '--pathspec-file-nul'], undefined, tracked.join('\0'));
  const added = paths.filter((at) => !tracked.includes(at));
  if (added.length > 0) git(repo.path, ['--literal-pathspecs', 'rm', '-r', '-q', '--cached', '--ignore-unmatch', '--pathspec-from-file=-', '--pathspec-file-nul'], undefined, added.join('\0'));
  for (const at of added) fs.rmSync(path.join(repo.path, at), { recursive: true, force: true });
}

/**
 * What the checkout holds not committed set aside for the fix parked (the
 * header's), and the checkout left clean at its tip: answers each path set
 * aside, from the project, in order, none where it held nothing.
 * @param {string} cwd @param {TaskRef} ref @returns {string[]}
 */
function setAside(cwd, ref) {
  const repos = projectRepos(codeRoot(cwd));
  const dirt = dirtByRepo(repos);
  for (const [repo, paths] of dirt) commitAside(repo, paths, ref);
  for (const [repo, paths] of dirt) cleaned(repo, paths);
  return [...dirt].flatMap(([repo, paths]) => paths.map((at) => projectPath(repo.dir, at))).sort();
}

/**
 * The fix's work set aside put back onto the branch's tip as it stands
 * (the header's), its ref dropped: answers each path put back, from the
 * project — refused in the words of `said`, nothing moved, where it
 * conflicts in any repository.
 * @param {string} cwd @param {TaskRef} ref @param {string} said @returns {string[]}
 */
function putBack(cwd, ref, said) {
  const held = heldAside(cwd, ref).map((aside) => ({ ...aside, merged: mergeTree(aside.repo.path, `${aside.sha}^`, 'HEAD', aside.sha) }));
  const conflicts = held.flatMap(({ repo, merged }) => ('conflicts' in merged ? merged.conflicts.map((at) => projectPath(repo.dir, at)) : []));
  if (conflicts.length > 0) {
    const ways = held.map(({ repo }) => `\`${gitIn(repo)} diff ${asideRef(ref)}^ ${asideRef(ref)}\``).join(', ');
    const drops = held.map(({ repo }) => `\`${gitIn(repo)} update-ref -d ${asideRef(ref)}\``).join(', ');
    throw new Error(`${said}: ${taskName(ref)}'s work, set aside when a question parked it, does not go back onto ${quickFixBranch(ref.unit)} as it stands — it conflicts at ${conflicts.join(', ')} — so nothing moved: it is kept at ${asideRef(ref)}; make its change again by hand, ${ways} showing it, then drop it, ${drops}, and start the task again`);
  }
  return held.flatMap(({ repo, sha, merged }) => {
    git(repo.path, ['read-tree', '-m', '-u', 'HEAD', /** @type {{tree: string}} */ (merged).tree]);
    git(repo.path, ['reset', '-q']);
    git(repo.path, ['update-ref', '-d', asideRef(ref), sha]);
    return git(repo.path, ['diff', '--name-only', '-z', `${sha}^`, sha]).split('\0').filter(Boolean).map((at) => projectPath(repo.dir, at));
  });
}

/** The fix's work set aside dropped, in each repository holding any. @param {string} cwd @param {TaskRef} ref */
function dropAside(cwd, ref) {
  for (const { repo, sha } of heldAside(cwd, ref)) git(repo.path, ['update-ref', '-d', asideRef(ref), sha]);
}

/**
 * Why a brief for the fix waits, or null: its work is set aside, and its
 * start puts it back.
 * @param {string} cwd @param {TaskRef} ref @returns {string|null}
 */
function asideRefusal(cwd, ref) {
  if (heldAside(cwd, ref).length === 0) return null;
  return `${taskName(ref)}'s work, set aside when a question parked it, is not back in the checkout — start it again first, engine task start ${ref.unit} ${shownTask(ref)}, which puts it back`;
}

module.exports = { asideRef, heldAside, setAside, putBack, dropAside, asideRefusal };
