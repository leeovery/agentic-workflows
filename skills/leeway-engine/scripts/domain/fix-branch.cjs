'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a quick-fix's fix is built — the project's own
// checkout, which a build, the review phase and a quick-fix's work take
// turns in (12.7.8, 19.5.18), Claude doing the work there with no builder
// in a worktree of its own (19.5.3). Starting a fix puts the checkout on
// the fix's branch (`taskBranch`, landing-names.cjs): the branch where the
// repository holds it already; else made, the first fix's from the branch
// the repository lands on (`landsOn`, landing-git.cjs), a later fix's on
// the tip of the fix before it, so a set's fixes stack as their pull
// requests chain (7.2.3). It refuses, before the tracker moves, a checkout
// holding changes not committed outside the state, naming each
// (`codeStatus`, code.cjs), as the close does before anything lands. The
// commit door takes a fix's commit on its
// branch alone (commit-task.cjs). Only the project's own repository moves;
// a repository nested in it keeps its branch. Taking the checkout back to
// the branch it lands on is the close's, and a move's that leaves the fixes
// (workunit-move.cjs) where the checkout has one of the unit's fixes'
// branches out: refused, nothing moved, while it holds changes not
// committed outside the state, naming each. The move then sets the fixes'
// branches aside (`setFixesAside`): one holding commits of its own past
// its base — the branch the fixes land on, or the fix before it it was
// laid from — is kept, its commits unlanded, renamed to `moved/{branch}`,
// a name no landing reads as the unit's (`taskOfBranch`, `phaseOfBranch`,
// landing-names.cjs), so the new type's build, numbering its own tasks
// from 1.1, never meets it; one holding none is deleted. The kept names
// are what the topic's first opening names (`keptBranches`).
// ---------------------------------------------------------------------------

const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit, git } = require('../kernel/git.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { codeStatus } = require('./code.cjs');
const { branches, holdsBeyond, landsOn, switchTo } = require('./landing-git.cjs');
const { taskBranch, taskOfBranch } = require('./landing-names.cjs');
const { shownTask, taskName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

/** The branch the checkout has out, or null where it is detached. @param {string} root */
const branchOut = (root) => tryGit(root, ['symbolic-ref', '-q', '--short', 'HEAD'])?.trim() ?? null;

/**
 * The fix's own branch where the repository holds it, else that of the
 * nearest fix before it, of the unit's fixes `phase` holds; null for none.
 * @param {string} root @param {TaskRef} ref @param {(n: number) => boolean} wanted the fix numbers looked for
 * @returns {string|null}
 */
function nearestFix(root, ref, wanted) {
  const held = [...branches(root).keys()].flatMap((branch) => {
    const of = taskOfBranch(ref.unit, branch);
    return of !== null && of.phase === ref.phase && wanted(of.n) ? [{ branch, n: of.n }] : [];
  });
  return held.sort((a, b) => b.n - a.n)[0]?.branch ?? null;
}

/** The fix's branch, where the repository holds it. @param {string} root @param {TaskRef} ref */
const fixBranchOf = (root, ref) => nearestFix(root, ref, (n) => n === ref.n);

/** The branch the fixes land on, in the project's own repository at `root`. @param {string} cwd @param {string} root */
const fixesLandOn = (cwd, root) => landsOn(cwd, /** @type {import('../kernel/repos.cjs').Repo} */ (projectRepos(root).find((repo) => repo.dir === '')));

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

/** Refuse to start a fix while the project's checkout holds changes not committed. @param {string} cwd @param {TaskRef} ref */
function refuseDirty(cwd, ref) {
  refuseDirt(cwd, (dirty) => `${taskName(ref)} is built in the project's own checkout, which holds changes not committed — ${dirty} — so it was not put on the fix's branch: commit them or set them aside, then start the fix again`);
}

/** Refuse a quick-fix's close while the project's checkout holds changes not committed. @param {string} cwd @param {string} unit */
function refuseDirtyClose(cwd, unit) {
  refuseDirt(cwd, (dirty) => `${unit}'s fixes were built in the project's own checkout, which holds changes not committed — ${dirty} — so nothing was landed: commit them or set them aside, then close it again`);
}

/**
 * The project's checkout put on the fix's branch, made where the repository
 * lacks it (the header's): the branch it has out.
 * @param {string} cwd @param {TaskRef} ref @param {string} type @param {string} title the fix's, as the tracker holds them
 * @returns {string}
 */
function checkOutFix(cwd, ref, type, title) {
  const root = codeRoot(cwd);
  const held = fixBranchOf(root, ref);
  const branch = held ?? taskBranch(ref, type, title);
  if (held === null) git(root, ['branch', '--no-track', branch, nearestFix(root, ref, (n) => n < ref.n) ?? fixesLandOn(cwd, root)]);
  if (branchOut(root) !== branch) switchTo(root, branch);
  return branch;
}

/**
 * The way on for a fix's commit made on another branch: the fix's own,
 * where the repository holds it, and its start, which puts the checkout
 * there.
 * @param {string} root @param {TaskRef} ref
 */
function fixWayOn(root, ref) {
  const held = fixBranchOf(root, ref);
  const start = `\`engine task start ${ref.unit} ${shownTask(ref)}\``;
  return `a quick-fix's fix is built in the project's own checkout, on its branch${held === null ? '' : `, ${held}`} — ${start} puts the checkout on it`;
}

const MOVED = 'moved/';

/** The name a move keeps a fix's branch under (the header's). @param {string} branch */
const movedBranch = (branch) => `${MOVED}${branch}`;

/** @typedef {{branch: string, of: TaskRef}} FixBranch */

/** Branches in the order of their fixes. @template {FixBranch} B @param {B[]} held @returns {B[]} */
const inFixOrder = (held) => held.sort((a, b) => a.of.phase - b.of.phase || a.of.n - b.of.n);

/**
 * The unit's fixes' branches, in the order of their fixes, each with
 * whether it holds commits of its own past its base: the branch the fixes
 * land on, and each fix's before it, the one it was laid from among them.
 * @param {string} root @param {string} cwd @param {string} unit
 * @returns {(FixBranch & {holds: boolean})[]}
 */
function fixBranches(root, cwd, unit) {
  const lands = fixesLandOn(cwd, root);
  const fixes = inFixOrder([...branches(root).keys()].flatMap((branch) => {
    const of = taskOfBranch(unit, branch);
    return of === null ? [] : [{ branch, of }];
  }));
  return fixes.map((fix, at) => {
    const before = fixes.slice(0, at).filter(({ of }) => of.phase === fix.of.phase).map(({ branch }) => branch);
    return { ...fix, holds: holdsBeyond(root, [fix.branch], [lands, ...before]) };
  });
}

/**
 * The unit's fixes' branches a move has kept (the header's), in the order
 * of their fixes.
 * @param {string} root @param {string} unit
 * @returns {FixBranch[]}
 */
function movedFixes(root, unit) {
  return inFixOrder([...branches(root).keys()].flatMap((branch) => {
    const of = branch.startsWith(MOVED) ? taskOfBranch(unit, branch.slice(MOVED.length)) : null;
    return of === null ? [] : [{ branch, of }];
  }));
}

/**
 * The names the unit's fixes' branches holding commits of their own are
 * kept under, in the order of their fixes: those a move has kept already,
 * and those it keeps.
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function keptFixes(cwd, unit) {
  const root = codeRoot(cwd);
  const keeps = fixBranches(root, cwd, unit).flatMap(({ branch, of, holds }) => (holds ? [{ branch: movedBranch(branch), of }] : []));
  return inFixOrder([...movedFixes(root, unit), ...keeps]).map(({ branch }) => branch);
}

/**
 * The unit's fixes' branches set aside for its move (the header's): each
 * holding commits of its own renamed to the name it is kept under, the
 * rest deleted — none left to set aside where a move set them aside
 * before. Answers the names this call kept, in the order of their fixes.
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function setFixesAside(cwd, unit) {
  const root = codeRoot(cwd);
  return fixBranches(root, cwd, unit).flatMap(({ branch, holds }) => {
    git(root, holds ? ['branch', '-m', branch, movedBranch(branch)] : ['branch', '-D', branch]);
    return holds ? [movedBranch(branch)] : [];
  });
}

/**
 * The names of the unit's fixes' branches a move has kept, in the order of
 * their fixes: what its topic's first opening names (enter.cjs).
 * @param {string} cwd @param {string} unit
 * @returns {string[]}
 */
function keptBranches(cwd, unit) {
  return movedFixes(codeRoot(cwd), unit).map(({ branch }) => branch);
}

/**
 * The project's checkout taken back to the branch the fixes land on, where
 * it has one of the unit's fixes' branches out — refused first, nothing
 * moved, while it holds changes not committed outside the state, naming
 * each. Answers the branch it took the checkout to, or null where it had
 * none of the unit's out.
 * @param {string} cwd @param {string} unit
 * @returns {string|null}
 */
function checkOutLanding(cwd, unit) {
  const root = codeRoot(cwd);
  const out = branchOut(root);
  if (out === null || taskOfBranch(unit, out) === null) return null;
  const lands = fixesLandOn(cwd, root);
  const dirty = dirtOf(cwd);
  if (dirty.length > 0) {
    throw new Error(`${unit}'s fixes leave the project's checkout, which holds changes not committed — ${dirty.join(', ')} — so it was not taken back to ${lands}: commit them on the fix's branch or set them aside, then say yes again`);
  }
  switchTo(root, lands);
  return lands;
}

module.exports = { refuseDirty, refuseDirtyClose, checkOutFix, fixWayOn, keptFixes, setFixesAside, keptBranches, checkOutLanding };
