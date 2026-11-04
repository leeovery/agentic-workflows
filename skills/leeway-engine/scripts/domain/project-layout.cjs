'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project laid out at given tips in a worktree of its own
// repository, by one routine for a task's worktree (task-worktree.cjs), the
// mutation run's scratch worktree (verify.cjs) and a reviewer's
// (scratch.cjs) alike (12.7.10, 15.6.3, 7.2.17):
//
// - Where each repository starts, where no commit is given for it as a
//   reviewer's brief gives each (`layOutCommits`): at the tip of the
//   branch given for it, where one is (`startsAt`); else the project's own
//   repository and each clone at the tip of the branch it lands on, as the
//   landing driver reads it (landing.cjs, `landingTips`); and a submodule
//   at the commit its
//   holder, as laid out, points it at — its own checkout's where that
//   points it nowhere, as a checkout of that commit lays it out
//   (`startOf`).
// - Where each sits: the project's folder in the worktree — a project
//   nested in a larger repository is that folder of it, never the
//   repository's top (kernel/code-root.cjs) — and each child repository at
//   its folder from there, laid out after the repository it is nested in.
// - How each takes its place (`layOut`): a worktree added there — the own
//   repository's at the top its project's folder lies in — on the branch,
//   made at its start or checked out as it stands, or detached at its
//   start; or the worktree there already, the branch made in place or
//   switched to. Each worktree the layout adds is prepared as Claude Code
//   prepares an isolation worktree (worktree-prep.cjs); the root of a
//   task's worktree is Claude Code's own isolation's, prepared already.
// - A scratch worktree sits beside the builders' isolation worktrees, in
//   `.claude/worktrees/` of the project's main checkout, by its name
//   (`scratchTop`), and is taken apart deepest first (`takeApart`).
// ---------------------------------------------------------------------------

const path = require('path');
const { git, tryGit } = require('../kernel/git.cjs');
const { repoOf, repoPath, topPath, checkoutTop, folderUnder } = require('../kernel/repos.cjs');
const lg = require('./landing-git.cjs');
const { prepareWorktree } = require('./worktree-prep.cjs');

// Where a repository lands, loaded at its call: the landing reads the
// tracker, whose verbs lay a task out through this module.
const landing = () => require('./landing.cjs');

/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/**
 * How a repository takes its place: in the worktree at its folder already —
 * the branch made there at `start`, or, `start` null, switched to — or by a
 * worktree added there, on the branch made at `start` or, `start` null,
 * checked out as it stands; with no branch, detached at `start`.
 * @typedef {{inPlace: boolean, start: string|null}} Make
 */

/**
 * One repository's part of the layout: the repository, as the project's own
 * checkout has it; its folder in the worktree; the commit its checkout
 * there is at once laid out; and how it takes its place, or null where it
 * has it already.
 * @typedef {{repo: Repo, at: string, commit: string, make: Make|null}} Part
 */

/** A commit a repository names, in full. @param {string} root @param {string} rev */
const commitOf = (root, rev) => git(root, ['rev-parse', '--verify', `${rev}^{commit}`]).trim();

/**
 * The repository a child repository is nested in, its folder from there,
 * and whether that repository holds it as a submodule.
 * @param {Repo[]} repos @param {Repo} repo
 */
function heldIn(repos, repo) {
  const holder = repoOf(repos.filter((other) => other !== repo), repo.dir);
  const folder = repoPath(holder, repo.dir);
  return { holder, folder, submodule: holder.submodules.includes(folder) };
}

/**
 * The commit a submodule's holder, laid out at `commit`, points it at — its
 * own checkout's where that points it nowhere, as a checkout of that commit
 * lays it out.
 * @param {Repo[]} repos @param {Repo} repo @param {string} commit
 * @returns {string}
 */
function pointedAt(repos, repo, commit) {
  const { holder, folder } = heldIn(repos, repo);
  const [pointers] = lg.pointersAt(holder.path, [commit], [topPath(holder, folder)]);
  return [...pointers.values()][0] ?? commitOf(repo.path, 'HEAD');
}

/**
 * Where each repository but a submodule starts, by folder (the header's):
 * at the tip of the branch `tips` names for it, else at the tip of the
 * branch it lands on.
 * @param {string} project the project's folder in its own checkout @param {string} unit @param {Repo[]} repos @param {Map<string, string>} tips branches, by folder
 * @returns {Map<string, string>}
 */
function startsAt(project, unit, repos, tips) {
  const landsOn = repos.filter((repo) => !tips.has(repo.dir) && (repo.dir === '' || !heldIn(repos, repo).submodule));
  const landed = landing().landingTips(project, unit, repos, landsOn);
  return new Map(repos.flatMap((repo) => {
    const tip = tips.get(repo.dir);
    if (tip !== undefined) return [[repo.dir, commitOf(repo.path, `refs/heads/${tip}`)]];
    return landed.has(repo.dir) ? [[repo.dir, /** @type {string} */ (landed.get(repo.dir))]] : [];
  }));
}

/**
 * Where a submodule starts that `startsAt` leaves out: the commit its
 * holder's part points it at.
 * @param {Repo[]} repos @param {Repo} repo @param {Map<string, Part>} parts each laid out before it, by folder
 * @returns {string}
 */
function startOf(repos, repo, parts) {
  return pointedAt(repos, repo, /** @type {Part} */ (parts.get(heldIn(repos, repo).holder.dir)).commit);
}

/** A part laid out as its plan says. @param {Part} part @param {string|null} branch */
function layOutPart(part, branch) {
  const { at, make } = part;
  if (make === null) return;
  if (!make.inPlace) lg.addWorktree(part.repo.path, checkoutTop(part.repo, at), branch, make.start);
  else if (make.start === null) lg.switchTo(at, /** @type {string} */ (branch));
  else lg.branchInPlace(at, /** @type {string} */ (branch), make.start);
}

/**
 * The parts laid out in order, on `branch` or, null, detached, then each
 * worktree the layout added prepared (the header's).
 * @param {Part[]} parts holders before the repositories nested in them @param {string|null} branch @param {string} project the project's folder in its own checkout, whose settings name what is linked
 */
function layOut(parts, branch, project) {
  for (const part of parts) layOutPart(part, branch);
  const added = parts.filter(({ make }) => make !== null && !make.inPlace);
  prepareWorktree(added.map(({ repo }) => repo), added.map(({ repo, at }) => ({ dir: repo.dir, path: at })), project);
}

/**
 * The project laid out afresh at `tips` in a worktree whose top is `top`,
 * each repository detached where it starts (the header's): each, by
 * `repos`' order, as laid out there.
 * @param {string} project the project's folder in its own checkout @param {string} unit @param {Repo[]} repos @param {Map<string, string>} tips branches, by folder @param {string} top
 * @returns {Repo[]}
 */
function layOutAt(project, unit, repos, tips, top) {
  const starts = startsAt(project, unit, repos, tips);
  /** @type {Map<string, Part>} */
  const parts = new Map();
  for (const repo of repos) {
    const commit = starts.get(repo.dir) ?? startOf(repos, repo, parts);
    parts.set(repo.dir, { repo, at: '', commit, make: null });
  }
  return layOutCommits(project, repos, new Map([...parts].map(([dir, { commit }]) => [dir, commit])), top);
}

/**
 * The project laid out afresh in a worktree whose top is `top`, each
 * repository detached at the commit `commits` names for its folder, and
 * prepared (the header's): each, by `repos`' order, as laid out there.
 * @param {string} project the project's folder in its own checkout @param {Repo[]} repos @param {Map<string, string>} commits by folder @param {string} top
 * @returns {Repo[]}
 */
function layOutCommits(project, repos, commits, top) {
  const folder = folderUnder(repos[0], top);
  const parts = repos.map((repo) => {
    const commit = /** @type {string} */ (commits.get(repo.dir));
    return { repo, at: path.join(folder, repo.dir), commit, make: { inPlace: false, start: commit } };
  });
  layOut(parts, null, project);
  return parts.map(({ repo, at }) => ({ ...repo, path: at }));
}

/**
 * A scratch worktree's top: beside the builders' isolation worktrees, in
 * `.claude/worktrees/` of the project's main checkout, by its name.
 * @param {Repo} own the project's own repository @param {string} name
 */
const scratchTop = (own, name) => path.join(lg.mainCheckoutOf(own.path), '.claude', 'worktrees', `leeway-${name}`);

/**
 * A scratch worktree at `top` taken apart, deepest first, each
 * repository's registration of it with it; one not there passed over.
 * @param {Repo[]} repos the project's @param {string} top
 */
function takeApart(repos, top) {
  const folder = folderUnder(repos[0], top);
  for (let at = repos.length - 1; at >= 0; at -= 1) {
    const { dir, path: root } = repos[at];
    tryGit(root, ['worktree', 'remove', '--force', '--force', dir === '' ? top : path.join(folder, dir)]);
    tryGit(root, ['worktree', 'prune']);
  }
}

module.exports = { commitOf, heldIn, pointedAt, startsAt, startOf, layOut, layOutAt, layOutCommits, scratchTop, takeApart };
