'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a quick-fix's fix is built — the project's own
// checkout, which a build, the review phase and a quick-fix's work take
// turns in (12.7.8, 19.5.18), Claude doing the work there with no builder in
// a worktree of its own (19.5.3). Starting a fix puts the checkout on the
// fix's branch (`taskBranch`, landing-names.cjs): the branch where the
// repository holds it already; else made, the first fix's from the branch
// the repository lands on (`landsOn`, landing-git.cjs), a later fix's on the
// tip of the nearest fix before it not closed, so a set's fixes stack as
// their pull requests chain (7.2.3) and a closed fix's work never lands
// (`fixBase`). A fix's own work is a commit its branch holds past the branch
// it is laid on (`fixWork`), which another fix not closed is laid on where
// its branch holds a commit of it — a later fix on an earlier one's
// (`laidOn`, `laidBeneath`) — what a fix's opening and end read
// (fix-end.cjs) and its record (quick-fix-record.cjs). The commit door takes
// a fix's commit on its branch alone (commit-task.cjs). The close, once its
// fixes have landed, puts the checkout back on the branch the repository
// lands on (finish.cjs), as a move that leaves the fixes does
// (workunit-move.cjs) where the checkout has one of the unit's fixes'
// branches out: refused, nothing moved, while it holds changes not committed
// outside the state, naming each. The move then sets the fixes' branches
// aside (`setFixesAside`): one holding commits of its own past its base —
// the branch the fixes land on, or the fix before it it was laid from — is
// kept, its commits unlanded, renamed to `moved/{branch}`, a name no landing
// reads as the unit's (`taskOfBranch`, `phaseOfBranch`, landing-names.cjs),
// so the new type's build, numbering its own tasks from 1.1, never meets it;
// one holding none is deleted. The kept names are what the topic's first
// opening names (`keptBranches`). Each move refuses first a checkout holding
// changes not committed outside the state, naming each (`codeStatus`,
// code.cjs): a fix's start before the tracker moves, the close before
// anything lands. Only the project's own repository moves; a repository
// nested in it keeps its branch.
// ---------------------------------------------------------------------------

const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit, git } = require('../kernel/git.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { codeStatus } = require('./code.cjs');
const { branches, landsOn, switchTo, isAncestor, holdsBeyond, mergeBase } = require('./landing-git.cjs');
const { taskBranch, taskOfBranch } = require('./landing-names.cjs');
const { shownTask, taskName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */

/** The branch the checkout has out, or null where it is detached. @param {string} root */
const branchOut = (root) => tryGit(root, ['symbolic-ref', '-q', '--short', 'HEAD'])?.trim() ?? null;

/** The project's own repository, from its code root. @param {string} root */
const ownRepo = (root) => /** @type {Repo} */ (projectRepos(root).find((repo) => repo.dir === ''));

/**
 * The branches of the unit's fixes `phase` holds that the repository holds,
 * of the fix numbers `wanted`, each with its fix's number.
 * @param {string} root @param {TaskRef} ref @param {(n: number) => boolean} wanted
 * @returns {{branch: string, n: number}[]}
 */
function phaseFixes(root, ref, wanted) {
  return [...branches(root).keys()].flatMap((branch) => {
    const of = taskOfBranch(ref.unit, branch);
    return of !== null && of.phase === ref.phase && wanted(of.n) ? [{ branch, n: of.n }] : [];
  });
}

/**
 * The branch of the highest-numbered fix of those `wanted` the repository
 * holds, of the unit's fixes `phase` holds; null for none.
 * @param {string} root @param {TaskRef} ref @param {(n: number) => boolean} wanted the fix numbers looked for
 * @returns {string|null}
 */
function nearestFix(root, ref, wanted) {
  return phaseFixes(root, ref, wanted).sort((a, b) => b.n - a.n)[0]?.branch ?? null;
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

/** The numbers of the fixes closed, of the set's tasks as the tracker holds them. @param {TaskDetail[]} fixes */
const closedFixes = (fixes) => fixes.filter(({ status }) => status === 'closed').map(({ ref }) => ref.n);

/**
 * The branch a fix is laid on: the nearest fix before it not closed, else
 * the branch the repository lands on.
 * @param {string} cwd @param {TaskRef} ref @param {number[]} closed the set's fixes closed, by number
 */
function fixBase(cwd, ref, closed) {
  const root = codeRoot(cwd);
  return nearestFix(root, ref, (n) => n < ref.n && !closed.includes(n)) ?? landsOn(cwd, ownRepo(root));
}

/**
 * The project's checkout put on the fix's branch, made where the repository
 * lacks it (the header's): the branch it has out.
 * @param {string} cwd @param {TaskRef} ref @param {string} type @param {string} title the fix's, as the tracker holds them
 * @param {number[]} closed the set's fixes closed, by number
 * @returns {string}
 */
function checkOutFix(cwd, ref, type, title, closed) {
  const root = codeRoot(cwd);
  const held = fixBranchOf(root, ref);
  const branch = held ?? taskBranch(ref, type, title);
  if (held === null) git(root, ['branch', '--no-track', branch, fixBase(cwd, ref, closed)]);
  if (branchOut(root) !== branch) switchTo(root, branch);
  return branch;
}

/**
 * A fix's work: its branch, where the repository holds it, with the branch
 * it is laid on (`fixBase`) and whether it holds a commit of its own past
 * it; null where the repository holds no branch of it.
 * @param {string} cwd @param {TaskRef} ref @param {TaskDetail[]} fixes the set's, as the tracker holds them
 * @returns {{branch: string, base: string, own: boolean}|null}
 */
function fixWork(cwd, ref, fixes) {
  const root = codeRoot(cwd);
  const branch = fixBranchOf(root, ref);
  if (branch === null) return null;
  const base = fixBase(cwd, ref, closedFixes(fixes));
  return { branch, base, own: holdsBeyond(root, [branch], [base]) };
}

/** Whether `branch` holds a commit of a fix's own work. @param {string} root @param {string} branch @param {{branch: string, base: string}} work the fix's */
const holdsWorkOf = (root, branch, work) => !isAncestor(root, mergeBase(root, work.branch, branch), work.base);

/** Fixes' numbers, lowest first. @param {{n: number}[]} fixes */
const lowestFirst = (fixes) => fixes.map(({ n }) => n).sort((a, b) => a - b);

/**
 * The later fixes not closed laid on a fix's own work — each whose branch
 * holds a commit of it — by number, lowest first.
 * @param {string} cwd @param {TaskRef} ref @param {{branch: string, base: string}} work the fix's (`fixWork`)
 * @param {TaskDetail[]} fixes the set's, as the tracker holds them
 * @returns {number[]}
 */
function laidOn(cwd, ref, work, fixes) {
  const root = codeRoot(cwd);
  const closed = closedFixes(fixes);
  return lowestFirst(phaseFixes(root, ref, (n) => n > ref.n && !closed.includes(n)).filter(({ branch }) => holdsWorkOf(root, branch, work)));
}

/**
 * The earlier fixes not closed a fix is laid on — each whose own work its
 * branch holds a commit of — by number, lowest first; none where the
 * repository holds no branch of it.
 * @param {string} cwd @param {TaskRef} ref @param {TaskDetail[]} fixes the set's, as the tracker holds them
 * @returns {number[]}
 */
function laidBeneath(cwd, ref, fixes) {
  const root = codeRoot(cwd);
  const branch = fixBranchOf(root, ref);
  if (branch === null) return [];
  const closed = closedFixes(fixes);
  const below = phaseFixes(root, ref, (n) => n < ref.n && !closed.includes(n));
  return lowestFirst(below.filter((fix) => holdsWorkOf(root, branch, { branch: fix.branch, base: fixBase(cwd, { ...ref, n: fix.n }, closed) })));
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

module.exports = { refuseDirty, refuseDirtyClose, checkOutFix, checkOutLanding, fixWayOn, closedFixes, fixWork, laidOn, laidBeneath, keptFixes, setFixesAside, keptBranches };
