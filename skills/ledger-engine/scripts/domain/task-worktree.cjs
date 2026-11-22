'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a task's worktree (12.7.10, 7.2.17, 7.2.21), laid out for its
// builder by `task worktree <unit> <task>`, run from the worktree Claude
// Code's isolation made, so tasks run side by side there as anywhere
// (12.7.3), every repository of the project laid out as the project is, by
// the routine the mutation run's scratch worktree is laid out by too
// (project-layout.cjs); and taken apart again as the task ends.
//
// - The task's branch, named as the landing names it (landing-names.cjs), is
//   made where the task is built on, never where the isolation's worktree
//   happened to start — Claude Code's starts at the remote's default
//   branch, whatever the project's checkout holds: on the work below the
//   task — a task of the cut's on its own phase's chain alone, never
//   another phase's work not landed; a fix phase's on the cut's and the
//   fixes before it with its own chain, so the fixes make one stack
//   (7.2.6) — in each repository holding that work, at its tip
//   (review-change.cjs, `belowTips`); and in each repository holding none,
//   at the tip of the branch it lands on, as the landing driver reads it
//   (project-layout.cjs, `startsAt`). The branch is checked out there, the
//   worktree's files moving to it where it is clean, the branch the
//   isolation made left as it stands; or, where it is made already and no
//   worktree has it out, switched to, as it stands, where the worktree is
//   clean. A task laid out beside another on an older tip is merged back
//   onto the chain's tip as it lands (12.7.1). The commit each repository's
//   branch is made at is recorded in the checkout's cache (round-report.cjs,
//   `recordLaidOut`), where its pair's range starts (brief-records.cjs).
// - Each child repository — a clone nested in the project's folder at any
//   depth, as the project's own checkout has them (kernel/repos.cjs) — gets
//   a worktree of that repository at its folder there, on a branch of the
//   same name, each laid out before the repositories nested in it, the
//   branch made at the tip of the branch it lands on, as the project's own
//   repository's is, never its checkout, which may be on the person's own
//   work; where the repository holds the unit's work not landed below the
//   task, at that work's tip; or, where the branch is made already and no
//   worktree has it out, checked out as it stands. A worktree of that
//   repository already at the folder, on another branch, takes the branch as
//   the project's own repository does. A child repository the task never
//   changes holds the branch with nothing on it, which the landing passes
//   over (landing.cjs); merging a parallel task back is Claude's (12.7.1),
//   and the landing's chain lands it, so nothing here merges. Each child
//   repository's worktree added is prepared as Claude Code prepares the
//   root, the files its `.worktreeinclude` names copied and the directories
//   the project's settings name linked (worktree-prep.cjs), so its tools run
//   with their dependencies.
// - Once the worktree is laid out, the steps the environment setup runs in
//   each worktree are run in the project's folder there (worktree-prep.cjs,
//   environment.cjs; 22.5.1) — after the include is copied, at the root by
//   Claude Code's isolation and in each child repository here — and with
//   the writer lock let go, since a step may run for minutes: the layout
//   holds the lock itself, the verb taking none of the dispatcher's
//   (engine.cjs). Its answer names the steps run. A step that fails refuses
//   the verb with its exit code and its output's last lines, the worktree
//   laid out and its record kept, so the call again runs the steps again;
//   once every one has passed, no call there runs them again; and a call
//   there while another runs them refuses.
// - The worktree is recorded against the task on the conversation's position
//   (position.cjs), so a call made in it is that task's (conversation.cjs,
//   `taskAt`), and the task's commits are made there alone (commit-task.cjs).
//   The reads of the change — the commit door's paths and checks, `code
//   status` and `code diff` — read every repository the folder they run in
//   holds, so in the task's worktree they read each child repository laid
//   out there; a reviewer's diff range reads each repository holding work on
//   the task's branch (brief-records.cjs).
// - As `task done` or `task close` ends the task, before the tracker moves,
//   every worktree of a child repository the task has is removed, deepest
//   first: each with the task's branch out — never a repository's own
//   checkout — and each in the worktree recorded for it, so a conversation
//   that lost its record leaves none behind. The registration of one whose
//   folder is gone goes with them, so no child repository holds the branch
//   out, and the worktree itself is left for Claude Code or plain git to
//   remove; the branches are the landing's, and stay. One holding changes
//   not committed refuses the verb before anything moves: its own files;
//   what a nested repository holds is that repository's to answer for, and
//   a nested clone's folder, which it never tracks, is no change. Removal failing
//   partway leaves the task in flight, so the verb run again finishes it.
//
// A one-line task, the orchestrator's own work (round-report.cjs,
// `reviewedNone`), has no isolation worktree of a builder's: `task
// worktree` lays the whole project out for it from wherever it is run, in
// the engine's own layout beside the builders' worktrees,
// `.claude/worktrees/ledger-{unit}-{task}` of the main checkout
// (project-layout.cjs, `scratchTop`), every repository on the task's
// branch, made where the task is built on or checked out as it stands, and
// each prepared as Claude Code prepares an isolation worktree; laid out
// already, it is answered so; refused for a quick-fix's, made in the
// quick-fix's worktree as its fixes are. As the task ends, that layout is
// taken apart whole, refused first where it holds changes not committed.
//
// A task started again — after a `/clear`, in a new conversation and a new
// worktree of Claude Code's isolation — finds its branch out in the
// worktree it was built in before, which Claude Code keeps for the commits
// it holds. Where the project's own repository has the branch out in such a
// worktree — a linked one, never a repository's own checkout, its folder
// there, the worktree of no task in flight in the calling conversation, and
// holding no change not committed, nor any child repository's worktree in
// it — `task worktree` takes the branch over: it removes each child
// repository's worktree there, deepest first, as the task's end does, then
// detaches that worktree at its own commit, so no file there moves, and
// lays the task out here, saying so. A child repository's branch out in a
// worktree anywhere else stays refused.
//
// Run again where it is laid out already, `task worktree` answers each
// repository so and makes nothing, running only the steps that have not all
// passed there. It refuses, before anything is made, in
// the engine's words: no conversation, or the task not in flight in it; the
// call made in the project's own checkout, or in the worktree of another
// task in flight; the task with no type in the tracker, which its branch is
// named from; its branch out in another worktree of a repository that it
// does not take over — removed, where that worktree's folder is gone,
// switched off, where it is a repository's own checkout, and, where it is
// the worktree of a task in flight in the calling conversation, its builder
// sent back in by the orchestrator — naming why; a worktree switching to
// the branch made already, or making it where the task is built on, with
// changes not committed; the work below the task no one stack in a
// repository, as phase-stack.cjs refuses it; and a child
// repository's folder holding anything but a worktree of that repository.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { handedSession } = require('../kernel/process.cjs');
const { dirtyEntries } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { realpathOrSelf, within } = require('../kernel/isolated-git.cjs');
const { projectRepos, repoName, placeOf, folderUnder } = require('../kernel/repos.cjs');
const { tasksInFlight, taskAt } = require('./conversation.cjs');
const { recordWorktree } = require('./position.cjs');
const { recordLaidOut, reviewedNone } = require('./round-report.cjs');
const { commitOf, heldIn, startsAt, layOut, scratchTop, takeApart } = require('./project-layout.cjs');
const { preparedLinkOf, removePreparedLinks, prepareWorktreeSteps } = require('./worktree-prep.cjs');
const { refusing } = require('./staged-payload.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { taskBranch } = require('./landing-names.cjs');
const lg = require('./landing-git.cjs');
const { shownTask, taskId, taskName } = require('./task-id.cjs');

// What a task is built on, loaded at its call: it reads the tracker, whose
// verbs lay a task out through this module.
const below = () => require('./review-change.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./landing-git.cjs').Worktree} Worktree */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('../kernel/repos.cjs').Place} Place */

/** A child repository's worktree, with its repository. @typedef {{repo: Repo, tree: Worktree}} ChildTree */

/**
 * The earlier worktree the task's branch is taken over from (see the
 * header), and each child repository's worktree in it, deepest first.
 * @typedef {{tree: Worktree, children: ChildTree[]}} TakeOver
 */

/**
 * One repository's part of the layout (project-layout.cjs), with the
 * worktree it takes the branch over from, where it does.
 * @typedef {import('./project-layout.cjs').Part & {taken?: TakeOver}} Part
 */

/** A refusal in the verb's words. @param {string} text */
const refusal = (text) => new Error(`task worktree: ${text}`);

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
 * with its links resolved, where the code root sits in it, and the
 * repository's worktrees — refused where it is the project's own checkout,
 * or the worktree of another task in flight.
 * @param {string} cwd @param {string} session @param {TaskRef} ref
 * @returns {{top: string, root: string, place: Place, trees: Worktree[]}}
 */
function worktreeHere(cwd, session, ref) {
  const root = fs.realpathSync(codeRoot(cwd));
  const place = placeOf(root);
  const top = fs.realpathSync(place.top);
  const trees = lg.worktrees(root);
  if (lg.samePlace(top, trees[0].path)) {
    throw refusal(`${top} is the project's own checkout — run it in the worktree made for ${taskName(ref)}`);
  }
  const owner = taskAt(session, root);
  if (owner !== null && (owner.unit !== ref.unit || owner.task !== shownTask(ref))) {
    throw refusal(`this worktree, ${owner.worktree}, is task ${owner.task} of ${owner.unit}'s — build ${taskName(ref)} in a worktree of its own`);
  }
  return { top, root, place, trees };
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
 * The worktrees of child repositories in a worktree of the project, deepest
 * first.
 * @param {Repo[]} repos @param {string} top the worktree's
 * @returns {ChildTree[]}
 */
function childTreesIn(repos, top) {
  const real = realpathOrSelf(top);
  return repos.slice(1)
    .flatMap((repo) => lg.worktrees(repo.path).slice(1).filter((tree) => within(realpathOrSelf(tree.path), real)).map((tree) => ({ repo, tree })))
    .sort((a, b) => b.tree.path.length - a.tree.path.length);
}

/** A repository's folder in a worktree of it: the worktree's top, but for a root inside a larger repository. @param {Repo} repo @param {Worktree} tree */
const folderIn = (repo, tree) => folderUnder(repo, tree.path);

/**
 * Each worktree of `trees` there whose repository's folder holds changes not
 * committed, as a refusal names it: the worktree, that folder, and what it
 * holds.
 * @param {Repo[]} repos @param {ChildTree[]} trees
 */
function dirtIn(repos, trees) {
  return trees.filter(({ tree }) => fs.existsSync(tree.path)).flatMap(({ repo, tree }) => {
    const at = folderIn(repo, tree);
    const dirt = uncommitted(repos, repo, at);
    return dirt.length === 0 ? [] : [{ tree, at, dirt }];
  });
}

/**
 * Child repositories' worktrees removed, deepest first, each with the links
 * its preparation made: where each was.
 * @param {Repo[]} repos the project's, in its own checkout @param {ChildTree[]} trees
 */
function removeChildTrees(repos, trees) {
  return trees.map(({ repo, tree }) => {
    removePreparedLinks(repo, folderIn(repo, tree), () => repos[0].path);
    lg.removeWorktree(repo.path, tree.path);
    return tree.path;
  });
}

/**
 * The project's earlier worktree the task's branch is taken over from (see
 * the header), refused, naming why, where it is the worktree of a task in
 * flight in the calling conversation or holds changes not committed.
 * @param {TaskRef} ref @param {Repo[]} repos @param {Worktree} holder @param {string} what the branch out there, as a refusal names it @param {string} session
 * @returns {TakeOver}
 */
function takeOverFrom(ref, repos, holder, what, session) {
  const owner = tasksInFlight(session).find((task) => task.worktree !== undefined && lg.samePlace(task.worktree, holder.path));
  if (owner !== undefined) {
    throw refusal(`${what}, where task ${owner.task} of ${owner.unit} is in flight in this conversation, so it is never taken over — stop, and report it: the orchestrator sends the builder of task ${owner.task} of ${owner.unit} back in, to carry on at ${holder.path}`);
  }
  const children = childTreesIn(repos, holder.path);
  const dirt = dirtIn(repos, [{ repo: repos[0], tree: holder }, ...children]);
  if (dirt.length > 0) {
    throw refusal(`${what}, with changes not committed — ${dirt.map(({ at, dirt: held }) => `${at}: ${held.join(', ')}`).join('; ')} — so it was not taken over, and nothing was laid out — commit them, or move them out of the way, then run it again`);
  }
  return { tree: holder, children };
}

/**
 * The task's branch out in another worktree of the repository: taken over
 * from it, where it is the project's own repository's earlier worktree
 * (see the header); else refused — built there; that worktree removed,
 * where its folder is gone; or, where it is the repository's own checkout,
 * which no task is built in, switched off the branch. Null where no other
 * worktree has it out.
 * @param {TaskRef} ref @param {Repo[]} repos @param {Repo} repo @param {string} branch @param {Worktree[]} trees the repository's @param {string} session
 * @returns {TakeOver|null}
 */
function heldElsewhere(ref, repos, repo, branch, trees, session) {
  const holder = lg.holderOf(repo.path, branch, trees);
  if (holder === undefined) return null;
  const what = `${taskName(ref)}'s branch ${branch} is checked out${repo.dir === '' ? '' : ` in ${repo.dir}`} at ${holder.path}`;
  if (!fs.existsSync(holder.path)) throw goneRefusal(repo, holder, what);
  if (holder === trees[0]) {
    throw refusal(`${what}, its own checkout — check out another branch there, as \`git -C ${lg.quoted(holder.path)} switch --detach\` does, then run it again`);
  }
  if (repo !== repos[0]) throw refusal(`${what} — build the task there`);
  return takeOverFrom(ref, repos, holder, what, session);
}

/**
 * What `repo`'s folder at `at`, in a worktree of it, holds not committed,
 * named from there: its own files — never what a nested repository holds,
 * its own to answer for, the folder of a clone nested in it, which it never
 * tracks, nor a link the worktree's preparation made (worktree-prep.cjs).
 * @param {Repo[]} repos the project's, in its own checkout @param {Repo} repo @param {string} at
 * @returns {string[]}
 */
function uncommitted(repos, repo, at) {
  const clones = repos.slice(1).map((other) => heldIn(repos, other))
    .filter(({ holder }) => holder === repo).map(({ folder }) => `${folder}/`);
  const prepared = preparedLinkOf(() => repos[0].path);
  return dirtyEntries(at, repo.prefix).filter((entry) => !(entry.status === '??' && clones.includes(entry.path)) && !prepared(at, entry)).map((entry) => lg.plain(entry.path));
}

/**
 * Refuse a worktree of `repo` at `at` holding changes not committed, where
 * laying the branch out there moves its files — `why`.
 * @param {Repo[]} repos @param {Repo} repo @param {string} at @param {string} why
 */
function refuseUncommitted(repos, repo, at, why) {
  const dirt = uncommitted(repos, repo, at);
  if (dirt.length > 0) {
    throw refusal(`${why}, and ${at} has changes not committed: ${dirt.join(', ')}, so nothing was laid out — commit them, or move them out of the way, then run it again`);
  }
}

/**
 * A worktree already at a repository's folder, on another branch, taking
 * the branch in place: made at `start`, what the task is built on there,
 * or else at its own commit, so no file moves; or, made already and out
 * nowhere — or out in a worktree it is taken over from — switched to —
 * refused where its files move and the worktree has changes not committed.
 * @param {TaskRef} ref @param {Repo[]} repos @param {Repo} repo @param {string} at @param {string} branch @param {Worktree[]} trees the repository's @param {string} session @param {string|undefined} start
 * @returns {Part}
 */
function inPlace(ref, repos, repo, at, branch, trees, session, start) {
  const taken = heldElsewhere(ref, repos, repo, branch, trees, session);
  const made = lg.branches(repo.path).get(branch);
  if (made === undefined) {
    const commit = start ?? commitOf(at, 'HEAD');
    if (commit !== commitOf(at, 'HEAD')) refuseUncommitted(repos, repo, at, `${branch} is made at ${lg.short(commit)}, where the task is built on`);
    return { repo, at, make: { inPlace: true, start: commit } };
  }
  refuseUncommitted(repos, repo, at, `${branch} is made already`);
  return { repo, at, make: { inPlace: true, start: null }, ...(taken === null ? {} : { taken }) };
}

/**
 * The project's own repository's part: there already, or taken in place.
 * @param {TaskRef} ref @param {Repo[]} repos @param {{top: string, root: string, trees: Worktree[]}} here @param {string} branch @param {string} session @param {Map<string, string>} base
 * @returns {Part}
 */
function ownPart(ref, repos, { top, root, trees }, branch, session, base) {
  const [own] = repos;
  if (trees.find((tree) => lg.samePlace(tree.path, top))?.branch === branch) return { repo: own, at: root, make: null };
  return inPlace(ref, repos, own, root, branch, trees, session, base.get(own.dir));
}

/** Whether anything is at a folder: a file, or a folder holding anything. @param {string} at */
function occupied(at) {
  if (!fs.existsSync(at)) return false;
  return !fs.statSync(at).isDirectory() || fs.readdirSync(at).length > 0;
}

/**
 * A child repository's part: its worktree there already, on the branch or
 * taking it in place, or one to add, made where it starts (`startsAt`) —
 * refused where its folder holds anything else, or the branch is out in
 * another worktree than those the layout removes as it takes the branch
 * over.
 * @param {TaskRef} ref @param {Repo[]} repos @param {Repo} repo @param {string} root @param {string} branch @param {string} session @param {Set<string>} removing the worktrees' paths @param {Map<string, string>} base
 * @returns {Part}
 */
function childPart(ref, repos, repo, root, branch, session, removing, base) {
  const at = path.join(root, repo.dir);
  const trees = lg.worktrees(repo.path).filter((tree) => !removing.has(tree.path));
  const there = trees.find((tree) => lg.samePlace(tree.path, at));
  if (there !== undefined && !fs.existsSync(there.path)) throw goneRefusal(repo, there, `${repo.dir} in this worktree is a worktree of ${repo.dir}, at ${there.path}`);
  if (there?.branch === branch) return { repo, at, make: null };
  if (there !== undefined) return inPlace(ref, repos, repo, at, branch, trees, session, base.get(repo.dir));
  if (occupied(at)) throw refusal(`${repo.dir} in this worktree holds something other than a worktree of ${repo.dir} — move it out of the way, then run it again`);
  heldElsewhere(ref, repos, repo, branch, trees, session);
  const made = lg.branches(repo.path).get(branch);
  if (made !== undefined) return { repo, at, make: { inPlace: false, start: null } };
  return { repo, at, make: { inPlace: false, start: /** @type {string} */ (base.get(repo.dir)) } };
}

/**
 * `task worktree`: the task's worktree laid out where the call is made under
 * the writer lock, then the steps that prepare it run with the lock let go
 * (see the header): the layout's answer, and the steps run, where any ran.
 * @param {string} cwd @param {TaskRef} ref @param {() => TaskDetail & {committed?: string|null, warnings?: string[]}} read
 */
function layOutTask(cwd, ref, read) {
  const laid = withStateLock(stateRoot(cwd), () => laidOut(cwd, ref, read));
  const prepared = refusing('task worktree', () => prepareWorktreeSteps(cwd, laid.repos[0].path, laid.worktree, 'the task does not start in this worktree'));
  return prepared.length === 0 ? laid : { ...laid, prepared };
}

/**
 * The task's worktree laid out where the call is made (see the header), its
 * type and title read from the tracker by `read` once the task is found in
 * flight and the worktree is its own.
 * @param {string} cwd @param {TaskRef} ref @param {() => TaskDetail & {committed?: string|null, warnings?: string[]}} read
 */
function laidOut(cwd, ref, read) {
  const session = buildingConversation(ref);
  if (reviewedNone(cwd, ref) !== null) return laidOutOneLine(cwd, ref, read, session);
  const here = worktreeHere(cwd, session, ref);
  const { committed, warnings, type, title } = read();
  if (type === null) {
    throw refusal(`${taskName(ref)} has no type in the tracker, and its branch is named from it — give it one with \`engine task type ${ref.unit} ${shownTask(ref)} <type>\`, then run it again`);
  }
  const branch = taskBranch(ref, type, title);
  const project = lg.projectCheckout(here.root, here.place, here.trees);
  const repos = projectRepos(project);
  const base = startsAt(project, ref.unit, repos, below().belowTips(project, ref.unit, ref.phase, repos));
  const own = ownPart(ref, repos, here, branch, session, base);
  const removing = new Set(own.taken?.children.map(({ tree }) => tree.path));
  const parts = [own, ...repos.slice(1).map((repo) => childPart(ref, repos, repo, here.root, branch, session, removing, base))];
  const removed = own.taken === undefined ? [] : removeChildTrees(repos, own.taken.children);
  if (own.taken !== undefined) lg.detach(own.taken.tree.path);
  layOut(parts, branch, project);
  recordLaidOut(cwd, ref, Object.fromEntries(parts.flatMap(({ repo, make }) => (make === null || make.start === null ? [] : [[repo.dir, make.start]]))));
  const { recorded } = recordWorktree(session, ref.unit, shownTask(ref), here.top);
  return {
    task: shownTask(ref),
    id: taskId(ref),
    branch,
    worktree: here.top,
    repos: parts.map(({ repo, at, make }) => ({ repo: repoName(repo), path: at, ...(make === null ? { already: true } : {}) })),
    ...(own.taken === undefined ? {} : { taken_over: { worktree: own.taken.tree.path, removed } }),
    recorded,
    ...(committed === undefined ? {} : { committed }),
    ...(warnings === undefined ? {} : { warnings }),
  };
}

/** A one-line task's layout's top (the header's), by the project's own repository. @param {Repo} own @param {TaskRef} ref */
const oneLineTop = (own, ref) => scratchTop(own, `${ref.unit}-${shownTask(ref)}`);

/**
 * A one-line task's worktree laid out in its layout, or answered as laid
 * out already (the header's), recorded against the task.
 * @param {string} cwd @param {TaskRef} ref @param {() => TaskDetail & {committed?: string|null, warnings?: string[]}} read @param {string} session
 */
function laidOutOneLine(cwd, ref, read, session) {
  if (require('./task-base.cjs').ofQuickFix(cwd, ref.unit)) throw refusal(`${taskName(ref)} is a quick-fix's one-line fix — make it in the quick-fix's worktree, ${require('./fix-branch.cjs').fixWorktree(cwd, ref.unit).root}, as its fixes are`);
  const { committed, warnings, type, title } = read();
  const branch = taskBranch(ref, /** @type {string} */ (type), title);
  const project = lg.projectCheckout(fs.realpathSync(codeRoot(cwd)));
  const repos = projectRepos(project);
  const top = oneLineTop(repos[0], ref);
  const already = fs.existsSync(top);
  const folder = folderUnder(repos[0], top);
  const parts = repos.map((repo) => ({ repo, at: path.join(folder, repo.dir) }));
  if (!already) {
    const base = startsAt(project, ref.unit, repos, below().belowTips(project, ref.unit, ref.phase, repos));
    const start = (/** @type {Repo} */ repo) => (lg.branches(repo.path).has(branch) ? null : /** @type {string} */ (base.get(repo.dir)));
    const made = parts.map(({ repo, at }) => ({ repo, at, make: { inPlace: false, start: start(repo) } }));
    layOut(made, branch, project);
    recordLaidOut(cwd, ref, Object.fromEntries(made.flatMap(({ repo, make }) => (make.start === null ? [] : [[repo.dir, make.start]]))));
  }
  const { recorded } = recordWorktree(session, ref.unit, shownTask(ref), top);
  return {
    task: shownTask(ref),
    id: taskId(ref),
    branch,
    worktree: top,
    repos: parts.map(({ repo, at }) => ({ repo: repoName(repo), path: at, ...(already ? { already: true } : {}) })),
    recorded,
    ...(committed === undefined ? {} : { committed }),
    ...(warnings === undefined ? {} : { warnings }),
  };
}

/**
 * A one-line task's layout taken apart as `task {verb}` ends it, deepest
 * first (the header's): refused where any repository there holds changes
 * not committed, answering where each was; none where it is not laid out.
 * @param {string} cwd @param {TaskRef} ref @param {string} verb
 * @returns {string[]}
 */
function takeOneLineApart(cwd, ref, verb) {
  const repos = projectRepos(lg.projectCheckout(fs.realpathSync(codeRoot(cwd))));
  const top = oneLineTop(repos[0], ref);
  if (!fs.existsSync(top)) return [];
  const folder = folderUnder(repos[0], top);
  const laid = repos.map((repo) => ({ repo, at: path.join(folder, repo.dir) })).filter(({ at }) => fs.existsSync(at));
  const dirty = laid.map(({ repo, at }) => ({ at, dirt: uncommitted(repos, repo, at) })).find(({ dirt }) => dirt.length > 0);
  if (dirty !== undefined) throw new Error(`task ${verb}: ${dirty.at} holds changes not committed: ${dirty.dirt.join(', ')}, so nothing moved — commit them, or move them out of the way, then run it again`);
  takeApart(repos, top);
  return laid.map(({ at }) => at).reverse();
}

/**
 * Each worktree of a child repository the task has (see the header),
 * deepest first: its branch out there, read from the tracker by `read`
 * where it has a type, or in the worktree recorded for the task in the
 * calling conversation.
 * @param {string} cwd @param {TaskRef} ref @param {() => TaskDetail} read
 * @returns {{repos: Repo[], trees: {repo: Repo, tree: Worktree}[]}}
 */
function childWorktrees(cwd, ref, read) {
  const repos = projectRepos(lg.projectCheckout(fs.realpathSync(codeRoot(cwd))));
  if (repos.length === 1) return { repos, trees: [] };
  const { type, title } = read();
  const branch = type === null ? null : taskBranch(ref, type, title);
  const session = handedSession();
  const recorded = session === null ? undefined : inFlightIn(session, ref)?.worktree;
  const trees = repos.slice(1).flatMap((repo) => lg.worktrees(repo.path).slice(1)
    .filter((tree) => (branch !== null && !tree.scratch && tree.branch === branch) || (recorded !== undefined && within(realpathOrSelf(tree.path), recorded)))
    .map((tree) => ({ repo, tree })));
  return { repos, trees: trees.sort((a, b) => b.tree.path.length - a.tree.path.length) };
}

/**
 * The task's worktree taken apart as `task {verb}` ends it (see the
 * header), before the tracker moves: each child repository's worktree the
 * task has checked, refused where one holds changes not committed, then
 * removed, deepest first, answering where each was.
 * @param {string} cwd @param {TaskRef} ref @param {string} verb @param {() => TaskDetail} read
 * @returns {string[]}
 */
function takeWorktreeApart(cwd, ref, verb, read) {
  if (reviewedNone(cwd, ref) !== null) return takeOneLineApart(cwd, ref, verb);
  const { repos, trees } = childWorktrees(cwd, ref, read);
  const [first] = dirtIn(repos, trees);
  if (first !== undefined) {
    throw new Error(`task ${verb}: ${first.tree.branch ?? 'a detached HEAD'} is checked out at ${first.tree.path}, with changes not committed: ${first.dirt.join(', ')}, so nothing moved — commit them, or move them out of the way, then run it again`);
  }
  return removeChildTrees(repos, trees);
}

module.exports = { layOutTask, takeWorktreeApart };
