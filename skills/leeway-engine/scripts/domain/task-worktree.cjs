'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a task's worktree (12.7.10, 7.2.17, 7.2.21), laid out for its
// builder by `task worktree <unit> <task>`, run from the worktree Claude
// Code's isolation made, so tasks run side by side there as anywhere
// (12.7.3), every repository of the project laid out as the project is; and
// taken apart again as the task ends.
//
// - The task's branch, named as the landing names it (landing-names.cjs), is
//   made there at the worktree's own commit and checked out, so no file
//   moves, the branch the isolation made left as it stands; or, where it is
//   made already and no worktree has it out, switched to, where the worktree
//   is clean.
// - Each child repository — a clone or a submodule nested in the project's
//   folder at any depth, as the project's own checkout has them
//   (kernel/repos.cjs) — gets a worktree of that repository at its folder
//   there, on a branch of the same name, each laid out before the
//   repositories nested in it: a submodule's branch made at the commit its
//   holder's laid-out commit points it at, as a checkout of that commit lays
//   it out — at the submodule's own checkout's commit where that commit
//   points it nowhere — and a clone's at its own checkout's commit; or,
//   where the branch is made already and no worktree has it out, checked out
//   as it stands. A worktree of that repository already at the folder, on
//   another branch, takes the branch as the project's own repository does. A
//   child repository the task never changes holds the branch with nothing on
//   it, which the landing passes over (landing.cjs); merging a parallel task
//   back is Claude's (12.7.1), and the landing's chain lands it, so nothing
//   here merges.
// - The worktree is recorded against the task on the conversation's position
//   (position.cjs), so a call made in it is that task's (conversation.cjs,
//   `taskAt`), and the task's commits are made there alone (commit-task.cjs).
//   The reads of the change — the commit door's paths and checks, `code
//   status` and `code diff` — read every repository the folder they run in
//   holds, so in the task's worktree they read each child repository laid
//   out there; a reviewer's diff range reads each repository holding work on
//   the task's branch (brief-records.cjs).
// - As `task done` or `task close` ends the task, before its record goes,
//   each child repository's worktree in it is removed, deepest first — the
//   registration of one whose folder is gone with it, and a submodule's
//   folder left empty, as a checkout of its holder leaves it — so its
//   repository no longer holds the task's branch out, and the worktree
//   itself is left for Claude Code or plain git to remove; the branches are
//   the landing's, and stay. A child worktree holding changes not committed refuses the verb
//   before anything moves.
//
// Run again where it is laid out already, `task worktree` answers each
// repository so and makes nothing. It refuses, before anything is made, in
// the engine's words: no conversation, or the task not in flight in it; the
// call made in the project's own checkout, or in the worktree of another
// task in flight; the task with no type in the tracker, which its branch is
// named from; its branch out in another worktree of a repository — removed,
// where that worktree's folder is gone; a worktree switching to the branch
// made already with changes not committed; and a child repository's folder
// holding anything but a worktree of that repository.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { handedSession } = require('../kernel/process.cjs');
const { git, dirtyEntries } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { realpathOrSelf, within } = require('../kernel/isolated-git.cjs');
const { projectRepos, repoOf, repoPath, repoName } = require('../kernel/repos.cjs');
const { tasksInFlight, taskAt } = require('./conversation.cjs');
const { recordWorktree } = require('./position.cjs');
const { taskBranch } = require('./landing-names.cjs');
const lg = require('./landing-git.cjs');
const { shownTask, taskId, taskName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./landing-git.cjs').Worktree} Worktree */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/**
 * How a repository takes the task's branch: in the worktree at its folder
 * already — made there at `start`, its own commit, or, `start` null,
 * switched to — or by a worktree added there, made at `start` or, `start`
 * null, checked out as it stands.
 * @typedef {{inPlace: boolean, start: string|null}} Make
 */

/**
 * One repository's part of the layout: the repository, as the project's own
 * checkout has it; its folder in the task's worktree; the commit its
 * checkout there is at once laid out; and how it takes the branch, or null
 * where it has it already.
 * @typedef {{repo: Repo, at: string, commit: string, make: Make|null}} Part
 */

/** A refusal in the verb's words. @param {string} text */
const refusal = (text) => new Error(`task worktree: ${text}`);

/** A commit a repository names, in full. @param {string} root @param {string} rev */
const commitOf = (root, rev) => git(root, ['rev-parse', '--verify', `${rev}^{commit}`]).trim();

/** The project's folder in its own checkout, from the code root of any worktree of it. @param {string} root */
const projectOf = (root) => path.join(lg.worktrees(root)[0].path, lg.prefixOf(root));

/** The task in flight in the conversation, if it is. @param {string} session @param {TaskRef} ref */
const inFlightIn = (session, ref) => tasksInFlight(session).find((task) => task.unit === ref.unit && task.task === shownTask(ref));

/**
 * The calling conversation, refused where none is named or the task is not
 * in flight in it.
 * @param {TaskRef} ref @returns {string}
 */
function buildingConversation(ref) {
  const session = handedSession();
  if (session === null) {
    throw refusal('no conversation is named, so no task is in flight — CLAUDE_CODE_SESSION_ID is unset; run it from the Claude Code conversation building the task');
  }
  if (inFlightIn(session, ref) === undefined) {
    throw refusal(`${taskName(ref)} is not in flight in this conversation — start it with \`engine task start ${ref.unit} ${shownTask(ref)}\`, then run it again`);
  }
  return session;
}

/**
 * The worktree the call is made in — its top and the code root in it, each
 * with its links resolved, and the repository's worktrees — refused where
 * it is the project's own checkout, or the worktree of another task in
 * flight.
 * @param {string} cwd @param {string} session @param {TaskRef} ref
 * @returns {{top: string, root: string, trees: Worktree[]}}
 */
function worktreeHere(cwd, session, ref) {
  const root = fs.realpathSync(codeRoot(cwd));
  const top = fs.realpathSync(git(root, ['rev-parse', '--show-toplevel']).trim());
  const trees = lg.worktrees(root);
  if (lg.samePlace(top, trees[0].path)) {
    throw refusal(`${top} is the project's own checkout — run it in the worktree made for ${taskName(ref)}`);
  }
  const owner = taskAt(session, root);
  if (owner !== null && (owner.unit !== ref.unit || owner.task !== shownTask(ref))) {
    throw refusal(`this worktree, ${owner.worktree}, is task ${owner.task} of ${owner.unit}'s — build ${taskName(ref)} in a worktree of its own`);
  }
  return { top, root, trees };
}

/**
 * The refusal of a worktree of a repository whose folder is gone: its
 * registration removed, as the landing's remedy removes one.
 * @param {Repo} repo @param {Worktree} tree @param {string} what the worktree, as the refusal names it
 */
function goneRefusal(repo, tree, what) {
  return refusal(`${what}, whose folder is missing — remove that worktree with ${lg.removing(tree, repo.dir === '' ? undefined : repo.path)}, then run it again`);
}

/**
 * Refuses the task's branch out in another worktree of the repository —
 * built there, or that worktree removed where its folder is gone.
 * @param {TaskRef} ref @param {Repo} repo @param {string} branch @param {Worktree[]} trees the repository's
 */
function refuseHeldElsewhere(ref, repo, branch, trees) {
  const holder = lg.holderOf(repo.path, branch, trees);
  if (holder === undefined) return;
  const what = `${taskName(ref)}'s branch ${branch} is checked out${repo.dir === '' ? '' : ` in ${repo.dir}`} at ${holder.path}`;
  if (!fs.existsSync(holder.path)) throw goneRefusal(repo, holder, what);
  throw refusal(`${what} — build the task there`);
}

/**
 * The folders of the repositories nested in `repo`, from its own folder —
 * what a read of its changes holds out.
 * @param {Repo[]} repos @param {Repo} repo
 */
function nestedFolders(repos, repo) {
  return repos.filter((other) => other !== repo && (repo.dir === '' || other.dir.startsWith(`${repo.dir}/`)))
    .map((other) => (repo.dir === '' ? other.dir : other.dir.slice(repo.dir.length + 1)));
}

/**
 * A worktree already at a repository's folder, on another branch, taking
 * the branch in place: made at its own commit, so no file moves; or, made
 * already and out nowhere, switched to — refused where the worktree has
 * changes not committed.
 * @param {TaskRef} ref @param {Repo[]} repos @param {Repo} repo @param {string} at @param {string} branch @param {Worktree[]} trees the repository's
 * @returns {Part}
 */
function inPlace(ref, repos, repo, at, branch, trees) {
  refuseHeldElsewhere(ref, repo, branch, trees);
  const made = lg.branches(repo.path).get(branch);
  if (made === undefined) {
    const commit = commitOf(at, 'HEAD');
    return { repo, at, commit, make: { inPlace: true, start: commit } };
  }
  const dirt = dirtyEntries(at, nestedFolders(repos, repo)).map((entry) => lg.plain(entry.path));
  if (dirt.length > 0) {
    throw refusal(`${branch} is made already, and ${at} has changes not committed: ${dirt.join(', ')}, so nothing was laid out — commit them, or move them out of the way, then run it again`);
  }
  return { repo, at, commit: made, make: { inPlace: true, start: null } };
}

/**
 * The project's own repository's part: there already, or taken in place.
 * @param {TaskRef} ref @param {Repo[]} repos @param {{top: string, root: string, trees: Worktree[]}} here @param {string} branch
 * @returns {Part}
 */
function ownPart(ref, repos, { top, root, trees }, branch) {
  const [own] = repos;
  if (trees.find((tree) => lg.samePlace(tree.path, top))?.branch === branch) return { repo: own, at: root, commit: commitOf(root, 'HEAD'), make: null };
  return inPlace(ref, repos, own, root, branch, trees);
}

/** Whether anything is at a folder: a file, or a folder holding anything. @param {string} at */
function occupied(at) {
  if (!fs.existsSync(at)) return false;
  return !fs.statSync(at).isDirectory() || fs.readdirSync(at).length > 0;
}

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
 * The commit a child repository's branch is made at: where it is a
 * submodule, the commit its holder's laid-out commit points it at, if any;
 * else its own checkout's.
 * @param {Repo[]} repos @param {Repo} repo @param {Map<string, Part>} parts each laid out before it, by folder
 * @returns {string}
 */
function startOf(repos, repo, parts) {
  const { holder, folder, submodule } = heldIn(repos, repo);
  if (submodule) {
    const { at, commit } = /** @type {Part} */ (parts.get(holder.dir));
    const [pointers] = lg.pointersAt(holder.path, [commit], [`${holder.dir === '' ? lg.prefixOf(at) : ''}${folder}`]);
    const pointer = [...pointers.values()][0];
    if (pointer !== null) return pointer;
  }
  return commitOf(repo.path, 'HEAD');
}

/**
 * A child repository's part: its worktree there already, on the branch or
 * taking it in place, or one to add — refused where its folder holds
 * anything else, or the branch is out in another worktree.
 * @param {TaskRef} ref @param {Repo[]} repos @param {Repo} repo @param {string} root @param {string} branch @param {Map<string, Part>} parts
 * @returns {Part}
 */
function childPart(ref, repos, repo, root, branch, parts) {
  const at = path.join(root, repo.dir);
  const trees = lg.worktrees(repo.path);
  const there = trees.find((tree) => lg.samePlace(tree.path, at));
  if (there !== undefined && !fs.existsSync(there.path)) throw goneRefusal(repo, there, `${repo.dir} in this worktree is a worktree of ${repo.dir}, at ${there.path}`);
  if (there?.branch === branch) return { repo, at, commit: commitOf(at, 'HEAD'), make: null };
  if (there !== undefined) return inPlace(ref, repos, repo, at, branch, trees);
  if (occupied(at)) throw refusal(`${repo.dir} in this worktree holds something other than a worktree of ${repo.dir} — move it out of the way, then run it again`);
  refuseHeldElsewhere(ref, repo, branch, trees);
  const made = lg.branches(repo.path).get(branch);
  if (made !== undefined) return { repo, at, commit: made, make: { inPlace: false, start: null } };
  const start = startOf(repos, repo, parts);
  return { repo, at, commit: start, make: { inPlace: false, start } };
}

/** A part laid out as its plan says. @param {Part} part @param {string} branch */
function layOutPart({ repo, at, make }, branch) {
  if (make === null) return;
  if (!make.inPlace) lg.addWorktree(repo.path, at, branch, make.start);
  else if (make.start === null) lg.switchTo(at, branch);
  else lg.branchInPlace(at, branch);
}

/**
 * `task worktree`: the task's worktree laid out where the call is made (see
 * the header), its type and title read from the tracker by `read` once the
 * task is found in flight and the worktree is its own.
 * @param {string} cwd @param {TaskRef} ref @param {() => TaskDetail & {committed?: string|null, warnings?: string[]}} read
 */
function layOutTask(cwd, ref, read) {
  const session = buildingConversation(ref);
  const here = worktreeHere(cwd, session, ref);
  const { committed, warnings, type, title } = read();
  if (type === null) {
    throw refusal(`${taskName(ref)} has no type in the tracker, and its branch is named from it — give it one with \`engine task type ${ref.unit} ${shownTask(ref)} <type>\`, then run it again`);
  }
  const branch = taskBranch(ref, type, title);
  const repos = projectRepos(projectOf(here.root));
  /** @type {Map<string, Part>} */
  const parts = new Map([['', ownPart(ref, repos, here, branch)]]);
  for (const repo of repos.slice(1)) parts.set(repo.dir, childPart(ref, repos, repo, here.root, branch, parts));
  for (const part of parts.values()) layOutPart(part, branch);
  const { recorded } = recordWorktree(session, ref.unit, shownTask(ref), here.top);
  return {
    task: shownTask(ref),
    id: taskId(ref),
    branch,
    worktree: here.top,
    repos: [...parts.values()].map(({ repo, at, make }) => ({ repo: repoName(repo), path: at, ...(make === null ? { already: true } : {}) })),
    recorded,
    ...(committed === undefined ? {} : { committed }),
    ...(warnings === undefined ? {} : { warnings }),
  };
}

/**
 * What ending the task does to its worktree (see the header), checked as
 * `task {verb}` begins: each child repository's worktree in the one recorded
 * for it in the calling conversation, deepest first — refused where one has
 * changes not committed — and what removes them, answering where each was;
 * nothing where no worktree is recorded.
 * @param {string} cwd @param {TaskRef} ref @param {string} verb
 * @returns {() => string[]}
 */
function leavingWorktree(cwd, ref, verb) {
  const session = handedSession();
  const recorded = session === null ? undefined : inFlightIn(session, ref)?.worktree;
  if (recorded === undefined) return () => [];
  const repos = projectRepos(projectOf(fs.realpathSync(codeRoot(cwd))));
  const children = repos.slice(1).flatMap((repo) => lg.worktrees(repo.path)
    .filter((tree) => within(realpathOrSelf(tree.path), recorded))
    .map((tree) => ({ repo, tree, submodule: heldIn(repos, repo).submodule })))
    .sort((a, b) => b.tree.path.length - a.tree.path.length);
  for (const { tree } of children.filter((child) => fs.existsSync(child.tree.path))) {
    const inner = children.filter((other) => other.tree !== tree && within(other.tree.path, tree.path)).map((other) => path.relative(tree.path, other.tree.path));
    const dirt = dirtyEntries(tree.path, inner).map((entry) => lg.plain(entry.path));
    if (dirt.length > 0) {
      throw new Error(`task ${verb}: ${tree.branch ?? 'a detached HEAD'} is checked out at ${tree.path}, with changes not committed: ${dirt.join(', ')}, so nothing moved — commit them, or move them out of the way, then run it again`);
    }
  }
  return () => children.map(({ repo, tree, submodule }) => {
    lg.removeWorktree(repo.path, tree.path);
    if (submodule && fs.existsSync(path.dirname(tree.path))) fs.mkdirSync(tree.path, { recursive: true });
    return tree.path;
  });
}

module.exports = { layOutTask, leavingWorktree };
