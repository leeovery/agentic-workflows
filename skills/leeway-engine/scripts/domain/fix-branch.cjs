'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a quick-fix's tasks are built — its fixes, and the fix
// tasks of a review asked for at its close — on the quick-fix's one branch,
// `fix/{unit}` (landing-names.cjs): each task its own commits through the
// door, stamped with its task (commit-task.cjs), and the quick-fix landing
// as that branch's one pull request (landing.cjs). The project's own
// checkout, which a build, the review phase and a quick-fix's work take
// turns in (12.7.8, 19.5.18), has the branch out while a task is built
// there. Only the project's own repository moves; a repository nested in it
// keeps its branch.
//
// - A task's start puts the checkout on the branch (`checkOutBranch`), held
//   already, else cut at the first task's start from the branch the project
//   lands on as the host has it (`landingTips`, landing.cjs) — refused
//   first, before the tracker moves, while the checkout holds changes not
//   committed outside the state, naming each (`codeStatus`, code.cjs).
// - A person's merge of the pull request by hand, by any method, can leave
//   the branch holding commits that have landed past the branch the project
//   lands on as the host has it (`quickFixLanding`, landing.cjs). Where it
//   does, the branch is cut again from that branch's tip (`cutAgain`) — at
//   a task's start, its opening and the quick-fix's landing — and every
//   commit of a task's past it not landed, committed after the merge or
//   never in the pull request, replayed onto it in order under its own
//   message, its stamp kept, merges and commits stamped with none of the
//   unit's tasks left. A commit that does not apply there is left off, with
//   every later commit of its task's, the answer warning of each task left
//   off and the way on: its change made again on the branch through the
//   door. Where a checkout has the branch out it moves there, refused first,
//   nothing moved, while that checkout holds changes not committed, naming
//   each. Nothing else rewrites the branch.
// - The door takes a commit of a quick-fix's task on the branch alone
//   (commit-task.cjs), a commit on any other naming it and the start that
//   puts the checkout there (`branchWayOn`).
// - The close, once the quick-fix has landed, puts the checkout back on the
//   branch the project lands on (finish.cjs), as a move that leaves the
//   quick-fix does (workunit-move.cjs), where it has the branch out —
//   refused, nothing moved, while it holds changes not committed outside the
//   state, naming each (`checkOutLanding`). The move then sets the branch
//   aside (`setBranchAside`): holding commits past the branch the project
//   lands on, it is kept, its commits unlanded, renamed to
//   `moved/fix/{unit}`, a name no landing reads as the unit's
//   (landing-names.cjs), so the new type's build never meets it; holding
//   none, it is deleted. The kept name is what the topic's first opening
//   names (`keptBranches`).
// ---------------------------------------------------------------------------

const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit, git } = require('../kernel/git.cjs');
const { projectRepos, repoName } = require('../kernel/repos.cjs');
const { codeStatus } = require('./code.cjs');
const lg = require('./landing-git.cjs');
const { quickFixBranch } = require('./landing-names.cjs');
const { parseTaskId, shownTask, taskName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** The landing, read when asked: it reads the task verbs, which read this module. */
const landing = () => require('./landing.cjs');

/** The branch the checkout has out, or null where it is detached. @param {string} root */
const branchOut = (root) => tryGit(root, ['symbolic-ref', '-q', '--short', 'HEAD'])?.trim() ?? null;

/** The branch the project lands on, in its own repository at `root`. @param {string} cwd @param {string} root */
const landsHere = (cwd, root) => lg.landsOn(cwd, /** @type {Repo} */ (projectRepos(root).find((repo) => repo.dir === '')));

/** The changes the project's checkout holds not committed outside the state. @param {string} cwd */
const dirtOf = (cwd) => codeStatus(cwd).files.map(({ path }) => path);

/**
 * Refuse a move of the project's checkout while it holds changes not
 * committed outside the state, the refusal naming them.
 * @param {string} cwd @param {(dirty: string) => string} refusal
 */
function refuseDirt(cwd, refusal) {
  const dirty = dirtOf(cwd);
  if (dirty.length > 0) throw new Error(refusal(dirty.join(', ')));
}

/** Refuse to start a quick-fix's task while the project's checkout holds changes not committed. @param {string} cwd @param {TaskRef} ref */
function refuseDirty(cwd, ref) {
  refuseDirt(cwd, (dirty) => `${taskName(ref)} is built in the project's own checkout, which holds changes not committed — ${dirty} — so it was not put on ${ref.unit}'s branch: commit them or set them aside, then start the task again`);
}

/** Refuse a quick-fix's close while the project's checkout holds changes not committed. @param {string} cwd @param {string} unit */
function refuseDirtyClose(cwd, unit) {
  refuseDirt(cwd, (dirty) => `${unit}'s tasks were built in the project's own checkout, which holds changes not committed — ${dirty} — so nothing was landed: commit them or set them aside, then close it again`);
}

/**
 * The project's checkout put on the quick-fix's branch (the header's): cut
 * again where a merge by hand left it holding work landed, or cut from the
 * branch the project lands on as the host has it where the repository
 * lacks it. Answers the branch, and what cutting it again did and warned
 * of, where it did.
 * @param {string} cwd @param {string} unit
 * @returns {{branch: string, cut_again?: Record<string, unknown>, warnings?: string[]}}
 */
function checkOutBranch(cwd, unit) {
  const root = codeRoot(cwd);
  const branch = quickFixBranch(unit);
  const cut = lg.branches(root).has(branch) ? cutAgain(cwd, unit) : cutFresh(cwd, unit, root, branch);
  if (branchOut(root) !== branch) lg.switchTo(root, branch);
  if (cut === null) return { branch };
  return { branch, cut_again: cut.answer, ...(cut.warnings.length > 0 ? { warnings: cut.warnings } : {}) };
}

/** The quick-fix's branch cut from the branch the project lands on as the host has it: nothing cut again. @param {string} cwd @param {string} unit @param {string} root @param {string} branch @returns {null} */
function cutFresh(cwd, unit, root, branch) {
  const repos = projectRepos(root);
  git(root, ['branch', '--no-track', branch, /** @type {string} */ (landing().landingTips(cwd, unit, repos, [repos[0]]).get(''))]);
  return null;
}

/** A commit replayed, or left off, and the task it is stamped with. @typedef {{sha: string, message: string, id: string|null}} Commit */

/**
 * The commits replayed onto `onto`, in order, each under its own message: a
 * commit that conflicts there left off, with every later commit of its
 * task's. The tip they make, and each task left off, with the commit that
 * did not apply and the paths it conflicts at.
 * @param {string} root @param {Commit[]} commits @param {string} onto
 * @returns {{tip: string, off: Map<string, {sha: string, paths: string[]}>}}
 */
function replayed(root, commits, onto) {
  let tip = onto;
  /** @type {Map<string, {sha: string, paths: string[]}>} */
  const off = new Map();
  const signed = lg.signs(root);
  for (const { sha, message, id } of commits) {
    const task = /** @type {string} */ (id);
    if (off.has(task)) continue;
    const merged = lg.mergeTree(root, `${sha}^`, tip, sha);
    if ('conflicts' in merged) {
      off.set(task, { sha, paths: merged.conflicts });
      continue;
    }
    tip = lg.commitTree(root, { tree: merged.tree, parent: tip, message, signed }, `${lg.short(sha)}'s replay`, 'try again');
  }
  return { tip, off };
}

/**
 * The quick-fix's branch moved from `from` to `to` — in the checkout that
 * has it out, refused first, nothing moved, while that checkout holds
 * changes not committed, naming them.
 * @param {string} root @param {string} branch @param {string} from @param {string} to @param {string} onto the branch it is cut from, as the refusal names it
 */
function moveBranch(root, branch, from, to, onto) {
  const holder = lg.holderOf(root, branch);
  if (holder === undefined) {
    git(root, ['update-ref', '-m', `cut again from ${onto}`, `refs/heads/${branch}`, to, from]);
    return;
  }
  const dirty = lg.changesAt(holder.path);
  if (dirty.length > 0) {
    throw new Error(`${branch} holds work landed on ${onto} by hand, so it is cut again from there, and it is checked out at ${holder.path} with changes not committed — ${dirty.map(lg.plain).join(', ')} — so nothing moved: commit them or set them aside, then try again`);
  }
  git(holder.path, ['reset', '-q', '--keep', to]);
}

/**
 * A task's change made again on the quick-fix's branch through the door,
 * from its commit `sha`, as a task left off it takes it (the header's).
 * @param {TaskRef} ref @param {string} sha
 */
function remade(ref, sha) {
  return `\`git cherry-pick --no-commit ${lg.short(sha)}\`, settling any conflict and ending the pick with \`git cherry-pick --quit\`, which keeps its change, then \`engine commit --paths <file>… --task ${ref.unit} ${shownTask(ref)} -m "<message>"\``;
}

/**
 * The warning of a task left off the branch cut again (the header's): its
 * change made again there through the door.
 * @param {string} branch @param {string} onto @param {string} id @param {{sha: string, paths: string[]}} left
 */
function leftOff(branch, onto, id, { sha, paths }) {
  const ref = parseTaskId(id);
  return `task ${shownTask(ref)}'s commit ${lg.short(sha)} does not apply on ${onto} as it stands, at ${paths.map(lg.plain).join(', ')}, so ${branch} was cut again without it and its commits after it — make its change again there through the door: ${remade(ref, sha)}`;
}

/**
 * The quick-fix's branch cut again (the header's), where it holds commits
 * past the branch the project lands on as the host has it that have
 * landed: what that did — where it moved from and to, the tasks replayed,
 * those left off — and a warning for each task left off; null where it
 * holds none, or the repository lacks it.
 * @param {string} cwd @param {string} unit
 * @returns {{answer: Record<string, unknown>, warnings: string[]}|null}
 */
function cutAgain(cwd, unit) {
  const read = landing().quickFixLanding(cwd, unit);
  const { ctx, branch, at, tip } = read;
  if (at === undefined) return null;
  const past = read.commits().filter((commit) => commit.id !== null);
  const left = past.filter(({ sha, id }) => !read.landedCommit(sha, /** @type {string} */ (id)));
  if (left.length === past.length) return null;
  const { tip: cut, off } = replayed(ctx.root, left, tip);
  moveBranch(ctx.root, branch, at, cut, ctx.into);
  const tasks = (/** @type {Commit[]} */ commits) => [...new Set(commits.map(({ id }) => shownTask(parseTaskId(/** @type {string} */ (id)))))];
  const answer = {
    from: lg.short(at),
    to: lg.short(cut),
    replayed: tasks(left.filter(({ id }) => !off.has(/** @type {string} */ (id)))),
    ...(off.size > 0 ? { left_off: tasks(left.filter(({ id }) => off.has(/** @type {string} */ (id)))) } : {}),
  };
  return { answer, warnings: [...off].map(([id, missed]) => leftOff(branch, ctx.into, id, missed)) };
}

/**
 * The way on for a quick-fix's task's commit made on another branch: the
 * quick-fix's own, and the start that puts the checkout there.
 * @param {TaskRef} ref
 */
function branchWayOn(ref) {
  return `a quick-fix's task is built in the project's own checkout, on ${quickFixBranch(ref.unit)} — \`engine task start ${ref.unit} ${shownTask(ref)}\` puts the checkout on it`;
}

/**
 * The quick-fix's branch's tip, as a run names the code it ran (runs.cjs):
 * null where the repository lacks it.
 * @param {string} cwd @param {string} unit
 * @returns {{repo: string, commit: string}[]|null}
 */
function branchHead(cwd, unit) {
  const root = codeRoot(cwd);
  const tip = lg.branches(root).get(quickFixBranch(unit));
  if (tip === undefined) return null;
  return [{ repo: repoName(/** @type {Repo} */ (projectRepos(root).find((repo) => repo.dir === ''))), commit: tip }];
}

const MOVED = 'moved/';

/** The name a move keeps the quick-fix's branch under (the header's). @param {string} unit */
const movedBranch = (unit) => `${MOVED}${quickFixBranch(unit)}`;

/**
 * Whether the quick-fix's branch holds commits past the branch the project
 * lands on — false where the repository lacks it.
 * @param {string} cwd @param {string} root @param {string} unit
 */
function branchHolds(cwd, root, unit) {
  return lg.branches(root).has(quickFixBranch(unit)) && lg.holdsBeyond(root, [quickFixBranch(unit)], [landsHere(cwd, root)]);
}

/**
 * The names the quick-fix's branch holding commits past the branch the
 * project lands on is kept under: the one a move has kept already, and the
 * one it keeps.
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function keptUnder(cwd, unit) {
  const root = codeRoot(cwd);
  return lg.branches(root).has(movedBranch(unit)) || branchHolds(cwd, root, unit) ? [movedBranch(unit)] : [];
}

/**
 * The quick-fix's branch set aside for its move (the header's): renamed to
 * the name it is kept under where it holds commits past the branch the
 * project lands on, else deleted — nothing to set aside where the
 * repository lacks it. Answers the name this call kept it under, where it
 * did.
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function setBranchAside(cwd, unit) {
  const root = codeRoot(cwd);
  const branch = quickFixBranch(unit);
  if (!lg.branches(root).has(branch)) return [];
  const holds = branchHolds(cwd, root, unit);
  git(root, holds ? ['branch', '-m', branch, movedBranch(unit)] : ['branch', '-D', branch]);
  return holds ? [movedBranch(unit)] : [];
}

/**
 * The name the quick-fix's branch a move kept is under, where it kept it:
 * what its topic's first opening names (enter.cjs).
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function keptBranches(cwd, unit) {
  return lg.branches(codeRoot(cwd)).has(movedBranch(unit)) ? [movedBranch(unit)] : [];
}

/**
 * The project's checkout taken back to the branch the project lands on,
 * where it has the quick-fix's branch out — refused first, nothing moved,
 * while it holds changes not committed outside the state, naming each.
 * Answers the branch it took the checkout to, or null where it had another
 * out.
 * @param {string} cwd @param {string} unit
 * @returns {string|null}
 */
function checkOutLanding(cwd, unit) {
  const root = codeRoot(cwd);
  if (branchOut(root) !== quickFixBranch(unit)) return null;
  const lands = landsHere(cwd, root);
  refuseDirt(cwd, (dirty) => `${unit}'s tasks leave the project's checkout, which holds changes not committed — ${dirty} — so it was not taken back to ${lands}: commit them on ${quickFixBranch(unit)} or set them aside, then say yes again`);
  lg.switchTo(root, lands);
  return lands;
}

module.exports = { refuseDirty, refuseDirtyClose, checkOutBranch, cutAgain, remade, checkOutLanding, branchWayOn, branchHead, keptUnder, setBranchAside, keptBranches };
