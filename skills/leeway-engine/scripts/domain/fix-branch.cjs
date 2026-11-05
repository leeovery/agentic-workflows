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
// (`codeStatus`, code.cjs). The commit door takes a fix's commit on its
// branch alone (commit-task.cjs). Only the project's own repository moves;
// a repository nested in it keeps its branch. Taking the checkout back to
// the branch it lands on is the close's.
// ---------------------------------------------------------------------------

const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit, git } = require('../kernel/git.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { codeStatus } = require('./code.cjs');
const { branches, landsOn, switchTo } = require('./landing-git.cjs');
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

/**
 * Refuse to start a fix while the project's checkout holds changes not
 * committed outside the state, naming each.
 * @param {string} cwd @param {TaskRef} ref
 */
function refuseDirty(cwd, ref) {
  const dirty = codeStatus(cwd).files.map(({ path }) => path);
  if (dirty.length === 0) return;
  throw new Error(`${taskName(ref)} is built in the project's own checkout, which holds changes not committed — ${dirty.join(', ')} — so it was not put on the fix's branch: commit them or set them aside, then start the fix again`);
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
  if (held === null) {
    const project = /** @type {import('../kernel/repos.cjs').Repo} */ (projectRepos(root).find((repo) => repo.dir === ''));
    git(root, ['branch', '--no-track', branch, nearestFix(root, ref, (n) => n < ref.n) ?? landsOn(cwd, project)]);
  }
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

module.exports = { refuseDirty, checkOutFix, fixWayOn };
